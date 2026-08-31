import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const app = require("../app.js");
const [catalog, projections, folios, styles, html, source] = await Promise.all([
  readFile(new URL("../data/catalog.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/specimen-card-projections.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/folios.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../styles.css", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../app.js", import.meta.url), "utf8"),
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

test("projected specimen weight and detail layouts remain clean at desktop and narrow widths", () => {
  assert.match(styles, /\.holdings-list \.projected-content-weight,[\s\S]*padding-block: \.45rem;/u);
  assert.match(styles, /\.holdings-list \.specimen-weight \{[^}]*font-variant-numeric: tabular-nums;/u);
  assert.match(styles, /\.holdings-list \.specimen-details \{[^}]*white-space: pre-wrap;/u);
  assert.match(styles, /@media \(max-width: 700px\) \{[\s\S]*\.catalog-grid \{ grid-template-columns: 1fr; \}/u);
  assert.match(styles, /@media \(max-width: 420px\) \{[\s\S]*\.record-heading \{ grid-template-columns: minmax\(0, 1fr\); \}/u);
  assert.match(html, /<section class="record-holdings" aria-label="Holdings" hidden>/u);
});

test("long Hamburg fact labels stack above values instead of sharing narrow columns", () => {
  assert.match(styles, /\.record-meta \.hamburg-fact-row \{[^}]*grid-template-columns: minmax\(0, 1fr\);/u);
  assert.match(styles, /\.record-meta \.hamburg-fact-row dt \{[^}]*overflow-wrap: anywhere;/u);
});

test("schema8 runtime validates and preserves Hamburg additive facts", () => {
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

test("Hamburg projection runtime emits all 218 components across 142 parents and keeps five observations unprojected", () => {
  const projectionIndex = app.deriveSpecimenCardProjectionIndex(projections, records, {
    catalogSchemaVersion: 8,
    sourceCatalogSha256: projections.metadata.sourceCatalogSha256,
  });
  const hamburgIds = new Set(hamburg.map(({ id }) => id));
  const hamburgProjectionCount = [...projectionIndex.keys()].filter((id) => hamburgIds.has(id)).length;
  const descriptors = app.expandSpecimenCardDescriptors(hamburg, projectionIndex);
  const projected = descriptors.filter(({ projected }) => projected);
  const contextOnly = descriptors.filter(({ projected }) => !projected);
  assert.equal(hamburgProjectionCount, 142);
  assert.equal(projected.length, 218);
  assert.equal(contextOnly.length, 5);
  assert(contextOnly.every(({ kind }) => kind === "parent"));
  assert.equal(hamburg.filter(({ id }) => projectionIndex.get(id)?.cards.length > 1).length, 36);
  assert(projected.every(({ componentPath, clause, clauseText }) => componentPath && clause === null && clauseText === null));
  assert(projected.every((descriptor) => app.specimenCardDescriptorHoldings(descriptor)[0].type === "weight"));

  const stannernCards = app.expandSpecimenCardDescriptors([byName("Stannern")], projectionIndex);
  const bethanienCards = app.expandSpecimenCardDescriptors([byName("Bethanien")], projectionIndex);
  assert.equal(stannernCards.length, 3);
  assert.deepEqual(stannernCards.map(app.specimenCardDescriptorMasses), [[231], [23.6], [4.4]]);
  assert.equal(bethanienCards.length, 15);
  assert.deepEqual(bethanienCards.map(({ componentPath }) => componentPath), [
    ...Array.from({ length: 3 }, (_, index) => `holdings[0].weights[${index}]`),
    ...Array.from({ length: 11 }, (_, index) => `holdings[1].weights[${index}]`),
    "holdings[2].weights[0]",
  ]);

  const excludedKinds = hamburg.flatMap(({ holdings }) => holdings.flatMap(({ weights }) => weights))
    .filter(({ kind }) => kind !== "individual-holding");
  assert.equal(excludedKinds.filter(({ kind }) => kind === "aggregate-holding").length, 4);
  assert.equal(excludedKinds.filter(({ kind }) => kind === "associated-material").length, 5);
  assert.equal(hamburg.flatMap(({ holdings }) => holdings.flatMap(({ representations }) => representations))
    .reduce((sum, { count }) => sum + count, 0), 26);
  assert(projected.every((descriptor) => app.resolveSpecimenCardComponent(descriptor.parentRecord, descriptor)?.component.kind === "individual-holding"));
});

test("weighted cards expose only specimen weight and route the Bethanien amendment to its exact component", () => {
  const projectionIndex = app.deriveSpecimenCardProjectionIndex(projections, records, {
    sourceCatalogSha256: projections.metadata.sourceCatalogSha256,
  });
  const stannernCards = app.expandSpecimenCardDescriptors([byName("Stannern")], projectionIndex);
  const bethanienCards = app.expandSpecimenCardDescriptors([byName("Bethanien")], projectionIndex);
  assert(stannernCards.every((descriptor) => app.specimenCardHamburgFacts(descriptor).map(({ label }) => label).join() === "Publication"));
  assert.deepEqual(bethanienCards.map((descriptor) => app.specimenCardHamburgFacts(descriptor).map(({ label }) => label)),
    bethanienCards.map(({ componentPath }) => componentPath === "holdings[1].weights[4]"
      ? ["Publication", "Amendment (base observation retained)"] : ["Publication"]));
  assert.doesNotMatch(source, /"Specimen clause"|`Component:|"Meteorite holding"|"Meteorite group"/u);
  assert.match(source, /weighted \? "Specimen weight" : "Specimen details"/u);
  assert.match(source, /hamburgAmendmentComponentPath\(record, amendment\) === descriptor\.componentPath/u);
});

test("schema-3 runtime rejects malformed or widened Hamburg component evidence", () => {
  const validOptions = { sourceCatalogSha256: projections.metadata.sourceCatalogSha256 };
  const byEntryOrder = (document, entryOrder) => document.projections.find(({ parentRecordId }) =>
    hamburg.find(({ id }) => id === parentRecordId)?.entryOrder === entryOrder);
  for (const mutate of [
    (value) => { value.metadata.schemaVersion = 2; },
    (value) => { byEntryOrder(value, 1).cards[0].privateLabel = "forged"; },
    (value) => { byEntryOrder(value, 1).cards[0].clause = { textPath: "holdings[0].description", start: 0, end: 15 }; },
    (value) => { byEntryOrder(value, 1).cards[0].componentPath = "holdings[0].weights[99]"; },
    (value) => { byEntryOrder(value, 1).cards[0].massPath = "holdings[0].weights[1].grams"; },
    (value) => { byEntryOrder(value, 1).cards.reverse(); },
    (value) => {
      const record = hamburg.find(({ holdings }) => holdings.some(({ weights }) => weights.some(({ kind }) => kind === "aggregate-holding")));
      const holdingIndex = record.holdings.findIndex(({ weights }) => weights.some(({ kind }) => kind === "aggregate-holding"));
      const weightIndex = record.holdings[holdingIndex].weights.findIndex(({ kind }) => kind === "aggregate-holding");
      const card = value.projections.find(({ parentRecordId }) => parentRecordId === record.id).cards[0];
      card.holdingPath = `holdings[${holdingIndex}]`;
      card.componentPath = `holdings[${holdingIndex}].weights[${weightIndex}]`;
      card.massPath = `${card.componentPath}.grams`;
    },
  ]) {
    const changed = structuredClone(projections);
    mutate(changed);
    assert.equal(app.validateSpecimenCardManifest(changed, records, validOptions), false);
  }
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
