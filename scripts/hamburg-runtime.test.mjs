import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const app = require("../app.js");
const [catalog, projections, folios] = await Promise.all([
  readFile(new URL("../data/catalog.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/specimen-card-projections.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/folios.json", import.meta.url), "utf8").then(JSON.parse),
]);
const registry = app.normalizeCatalogRegistry(catalog.metadata);
const records = catalog.records.map((record, index) => app.prepareRecord(record, index, registry));
const hamburg = records.filter(({ catalogId }) => catalogId === "hamburg-1913");
const byName = (name) => hamburg.find((record) => record.name === name);
const amendmentTargetMutations = [
  ["changed holding identity", (record) => { record.amendments[0].targetHolding = "Bethanien"; }],
  ["removed target component", (record) => { record.holdings[1].weights.splice(4, 1); }],
  ["changed target component mass", (record) => { record.holdings[1].weights[4].grams = 14501; }],
  ["changed target component kind", (record) => { record.holdings[1].weights[4].kind = "aggregate-holding"; }],
  ["reordered target component", (record) => {
    [record.holdings[1].weights[4], record.holdings[1].weights[5]] =
      [record.holdings[1].weights[5], record.holdings[1].weights[4]];
  }],
  ["changed target component order", (record) => { record.amendments[0].targetComponentOrder = 6; }],
  ["changed amendment target mass", (record) => { record.amendments[0].targetWeight.grams = 14150; }],
];

test("schema7 runtime validates and preserves Hamburg additive facts", () => {
  assert.equal(app.validateCatalog(catalog), catalog);
  assert.equal(hamburg.length, 147);

  const stannern = byName("Stannern");
  assert.deepEqual(stannern.holdings[0].weights, [
    { grams: 231, kind: "individual-holding" },
    { grams: 23.6, kind: "individual-holding" },
    { grams: 4.4, kind: "individual-holding" },
  ]);
  assert.deepEqual(app.hamburgHoldingDetails(stannern.holdings[0]), [
    "Reported count: 3",
    "Components: Individual holding: 231 g; Individual holding: 23.6 g; Individual holding: 4.4 g",
    "Reported total: 259 g",
    "Representations: 2 thin sections",
  ]);
  assert.deepEqual(app.hamburgRecordFacts(stannern), [
    { label: "Publication", value: "Base register" },
    { label: "Observation reported total", value: "259 g" },
  ]);
});

test("Hamburg search, filter masses, supplement, and amendment facts remain distinct", () => {
  const holbrook = byName("Holbrook");
  const bethanien = byName("Bethanien");
  assert.equal(app.matchesSearch(holbrook, "supplement"), true);
  assert.equal(app.matchesSearch(byName("Stannern"), "Representations: 2 thin sections"), true);
  assert.equal(app.matchesSearch(byName("Stannern"), "reported total"), true);
  assert.equal(app.matchesSearch(bethanien, "Gibeon disposed"), true);
  assert.deepEqual(app.hamburgRecordFacts(holbrook), [
    { label: "Publication", value: "August 1913 supplement" },
    { label: "Observation reported total", value: "490.6 g" },
  ]);
  assert.match(app.hamburgRecordFacts(bethanien).at(-1).value,
    /^August 1913: 14\.5 kg component identified as Gibeon, Deutsch.Südwestafrika disposed by exchange; destination not recorded\.$/u);
  const amendmentText = app.hamburgRecordFacts(bethanien).at(-1).value;
  assert.equal(app.matchesSearch(bethanien, amendmentText), true);
  assert.equal(app.matchesSearch(bethanien, "disposed by exchange destination not recorded"), true);
  assert.deepEqual(app.filterRecords(hamburg, {
    query: amendmentText, catalog: "hamburg-1913", min: null, max: null, lineageOnly: false, sort: "name-asc"
  }).map(({ id }) => id), [bethanien.id]);

  const associated = byName("Sao Julião de Moreira");
  assert.deepEqual(app.recordSchemaMasses(associated), [5.8]);
  assert.deepEqual(app.recordMasses(associated), []);
  assert.deepEqual(app.recordMasses(byName("Stannern")), [231, 23.6, 4.4]);
  const statistics = app.calculateStatistics(hamburg);
  assert.equal(statistics.observations, 147);
  assert.equal(statistics.catalogs, 1);
  assert(Math.abs(statistics.grams - 748695) < 1e-6);
  assert.equal(app.filterRecords(hamburg, {
    query: "Sao Julião", catalog: "hamburg-1913", min: 5, max: 6, lineageOnly: false, sort: "name-asc"
  }).length, 0);
});

test("Hamburg projection runtime accepts exact atomics and rejects grouped context as atomic", () => {
  const projectionIndex = app.deriveSpecimenCardProjectionIndex(projections, records, {
    catalogSchemaVersion: 7,
    sourceCatalogSha256: projections.metadata.sourceCatalogSha256,
  });
  const hamburgIds = new Set(hamburg.map(({ id }) => id));
  assert.equal([...projectionIndex.keys()].filter((id) => hamburgIds.has(id)).length, 104);
  for (const name of ["Stannern", "Holbrook", "Bethanien"]) assert.equal(projectionIndex.has(byName(name).id), false);

  const atomic = hamburg.find(({ id }) => projectionIndex.has(id));
  const [descriptor] = app.expandSpecimenCardDescriptors([atomic], projectionIndex);
  assert.equal(descriptor.kind, "atomic");
  assert.equal(descriptor.massPath, "holdings[0].weights[0].grams");
  assert.deepEqual(app.specimenCardDescriptorMasses(descriptor), [atomic.holdings[0].weights[0].grams]);

  const grouped = byName("Stannern");
  const fake = {
    metadata: {
      schemaVersion: 2,
      scope: "reviewed-atomic-specimen-card-display-projections",
      catalogSchemaVersion: 7,
      sourceRecordCount: 1,
      sourceCatalogSha256: "0".repeat(64),
      projectionCount: 1,
      atomicCardCount: 1,
      sourceContextCardCount: 1,
    },
    projections: [{
      parentRecordId: grouped.id,
      cards: [{
        holdingPath: "holdings[0]",
        clause: { textPath: "holdings[0].description", start: 0, end: grouped.holdings[0].description.length },
        massPath: "holdings[0].weights[0].grams",
      }],
    }],
  };
  assert.equal(app.validateSpecimenCardManifest(fake, [grouped]), false);
});

test("Hamburg schema additions fail closed without widening old models", () => {
  const invalidKind = structuredClone(catalog);
  invalidKind.records.find(({ catalogId }) => catalogId === "hamburg-1913").holdings[0].weights[0].kind = "reported-total";
  assert.throws(() => app.validateCatalog(invalidKind), /facts-only schema/u);

  const invalidAmendment = structuredClone(catalog);
  invalidAmendment.records.find(({ catalogId, entryOrder }) => catalogId === "hamburg-1913" && entryOrder === 105)
    .amendments[0].baseObservationRetained = false;
  assert.throws(() => app.validateCatalog(invalidAmendment), /facts-only schema/u);

  for (const [description, mutate] of amendmentTargetMutations) {
    const candidate = structuredClone(catalog);
    mutate(candidate.records.find(({ catalogId, entryOrder }) => catalogId === "hamburg-1913" && entryOrder === 105));
    assert.throws(() => app.validateCatalog(candidate), /facts-only schema/u, description);
  }

  const widenedOldModel = structuredClone(catalog);
  const oldEntry = widenedOldModel.records.find(({ catalogId }) => catalogId === "madrid-1923");
  oldEntry.publicationState = "base-register";
  assert.throws(() => app.validateCatalog(widenedOldModel), /facts-only schema/u);
});

test("public validator rejects every dangling or changed Hamburg amendment target", async () => {
  const { validatePublicCatalog } = await import("./validate-public-catalog.mjs");
  for (const [description, mutate] of amendmentTargetMutations) {
    const candidate = structuredClone(catalog);
    mutate(candidate.records.find(({ catalogId, entryOrder }) => catalogId === "hamburg-1913" && entryOrder === 105));
    assert.throws(() => validatePublicCatalog(candidate, folios, `Hamburg ${description}`), undefined, description);
  }
});
