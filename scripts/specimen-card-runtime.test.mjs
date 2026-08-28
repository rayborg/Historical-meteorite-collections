import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = require(path.join(projectRoot, "app.js"));
const [catalogText, manifest, lineageData, html, source] = await Promise.all([
  readFile(path.join(projectRoot, "data", "catalog.json"), "utf8"),
  readFile(path.join(projectRoot, "data", "specimen-card-projections.json"), "utf8").then(JSON.parse),
  readFile(path.join(projectRoot, "data", "specimen-lineages.json"), "utf8").then(JSON.parse),
  readFile(path.join(projectRoot, "index.html"), "utf8"),
  readFile(path.join(projectRoot, "app.js"), "utf8"),
]);
const catalog = JSON.parse(catalogText);
const registry = app.normalizeCatalogRegistry(catalog.metadata);
const records = catalog.records.map((record, index) => app.prepareRecord(record, index, registry));
const sourceCatalogSha256 = createHash("sha256").update(catalogText).digest("hex");
const sha256 = async (value) => createHash("sha256").update(value).digest("hex");

function projectionResponse(value) {
  return { ok: true, text: async () => JSON.stringify(value) };
}

function weightedRecord(id, masses, order = 0) {
  return {
    id,
    catalogId: "synthetic-1937",
    recordModel: "collection-entry",
    entryOrder: order + 1,
    reportedNumber: null,
    catalogPages: [1],
    section: "Synthetic section",
    holdings: masses.map((grams, index) => ({
      description: `Holding ${index + 1}`,
      provenance: null,
      count: null,
      weights: [{ grams }],
    })),
    name: `Synthetic ${order + 1}`,
    classification: null,
    locality: null,
    eventDate: null,
    confidence: "high",
    order,
  };
}

function card(holdingIndex, weightIndex = 0) {
  return {
    holdingPath: `holdings[${holdingIndex}]`,
    massPath: `holdings[${holdingIndex}].weights[${weightIndex}].grams`,
  };
}

function syntheticManifest(sourceRecords, projections) {
  return {
    metadata: {
      schemaVersion: 1,
      scope: "reviewed-specimen-card-display-projections",
      catalogSchemaVersion: 6,
      sourceRecordCount: sourceRecords.length,
      sourceCatalogSha256: "0".repeat(64),
      projectionCount: projections.length,
      projectedCardCount: projections.reduce((sum, projection) => sum + projection.cards.length, 0),
    },
    projections,
  };
}

test("real reviewed projections validate exact metadata and source hash", () => {
  assert.equal(sourceCatalogSha256, manifest.metadata.sourceCatalogSha256);
  assert.equal(app.validateSpecimenCardManifest(manifest, records, { sourceCatalogSha256 }), true);
  assert.equal(app.deriveSpecimenCardProjectionIndex(manifest, records, { sourceCatalogSha256 }).size, 1699);

  const forged = structuredClone(manifest);
  forged.metadata.privateAuditPath = "/private/audit.json";
  assert.equal(app.validateSpecimenCardManifest(forged, records), false);
  assert.equal(app.validateSpecimenCardManifest(manifest, records, { sourceCatalogSha256: "f".repeat(64) }), false);
});

test("runtime rejects non-specimen catalog-item holdings", () => {
  const parent = {
    id: "catalog-item-parent",
    catalogId: "synthetic-1933",
    recordModel: "catalog-item",
    catalogItem: 1,
    holdings: [{ designation: "1a", kind: "aggregate", description: "Fragments", count: null, weight: { grams: 10 } }],
    name: "Synthetic",
    classification: null,
    locality: null,
    year: "1933",
    catalogPage: 1,
    confidence: "high",
    order: 0,
  };
  const projection = {
    parentRecordId: parent.id,
    retainParentContext: true,
    cards: [{ holdingPath: "holdings[0]", massPath: "holdings[0].weight.grams" }],
  };
  assert.equal(app.validateSpecimenCardManifest(syntheticManifest([parent], [projection]), [parent]), false);
});

test("Reeds collection entry 366 expands to ten exact cards in source order", () => {
  const reeds = records.find((record) => record.catalogId === "reeds-1937" && record.entryOrder === 366);
  const index = app.deriveSpecimenCardProjectionIndex(manifest, records);
  const descriptors = app.expandSpecimenCardDescriptors([reeds], index);
  assert.equal(descriptors.length, 10);
  assert.deepEqual(descriptors.map(({ parentRecord }) => parentRecord), Array(10).fill(reeds));
  assert.deepEqual(descriptors.map(({ sourcePosition }) => sourcePosition), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(descriptors.map((descriptor) => app.specimenCardDescriptorMasses(descriptor)[0]),
    [28.9, 310.1, 142, 30, 9.6, 124.5, 2.3, 128.5, 658.7, 51.2]);
  assert(descriptors.every(({ residual }) => residual === false));
});

test("unprojected parents remain one canonical card and statistics remain parent-based", () => {
  const prior = records.find((record) => record.catalogId === "prior-1923");
  const descriptors = app.expandSpecimenCardDescriptors([prior], new Map());
  assert.equal(descriptors.length, 1);
  assert.equal(descriptors[0].parentRecord, prior);
  assert.equal(descriptors[0].projected, false);
  assert.deepEqual(app.calculateStatistics([prior]), app.calculateStatistics(descriptors.map(({ parentRecord }) => parentRecord)));
});

test("partial projections add a residual with only unmatched holdings and masses", () => {
  const parent = weightedRecord("partial-parent", [10, 20, 30]);
  const projection = { parentRecordId: parent.id, retainParentContext: true, cards: [card(0), card(1)] };
  const document = syntheticManifest([parent], [projection]);
  assert.equal(app.validateSpecimenCardManifest(document, [parent]), true);
  const descriptors = app.expandSpecimenCardDescriptors([parent], app.deriveSpecimenCardProjectionIndex(document, [parent]));
  assert.equal(descriptors.length, 3);
  assert.deepEqual(descriptors.map(app.specimenCardDescriptorMasses), [[10], [20], [30]]);
  assert.equal(descriptors[2].residual, true);
  assert.deepEqual(app.specimenCardDescriptorHoldings(descriptors[2]), [parent.holdings[2]]);

  projection.retainParentContext = false;
  assert.equal(app.validateSpecimenCardManifest(document, [parent]), false);
});

test("weight filtering applies to selected card and residual masses", () => {
  const parent = weightedRecord("weight-parent", [10, 20, 30]);
  const projection = { parentRecordId: parent.id, retainParentContext: true, cards: [card(0), card(1)] };
  const document = syntheticManifest([parent], [projection]);
  const descriptors = app.expandSpecimenCardDescriptors([parent], app.deriveSpecimenCardProjectionIndex(document, [parent]));
  const exactTwenty = app.filterSpecimenCardDescriptors(descriptors, { min: 20, max: 20, lineageOnly: false });
  const residualThirty = app.filterSpecimenCardDescriptors(descriptors, { min: 25, max: 35, lineageOnly: false });
  assert.deepEqual(exactTwenty.map(({ massPath }) => massPath), [card(1).massPath]);
  assert.deepEqual(residualThirty.map(({ residual }) => residual), [true]);
});

test("lineage routes only by exact later mass path, never equal mass value", () => {
  const parent = weightedRecord("lineage-parent", [50, 50, 75]);
  const projection = { parentRecordId: parent.id, retainParentContext: true, cards: [card(0), card(1)] };
  const document = syntheticManifest([parent], [projection]);
  const descriptors = app.expandSpecimenCardDescriptors([parent], app.deriveSpecimenCardProjectionIndex(document, [parent]));
  const entries = [
    { relationshipId: "first", massPath: card(0).massPath },
    { relationshipId: "second", massPath: card(1).massPath },
    { relationshipId: "remaining", massPath: card(2).massPath },
  ];
  assert.deepEqual(app.lineageEntriesForSpecimenCard(descriptors[0], entries).map(({ relationshipId }) => relationshipId), ["first"]);
  assert.deepEqual(app.lineageEntriesForSpecimenCard(descriptors[1], entries).map(({ relationshipId }) => relationshipId), ["second"]);
  assert.deepEqual(app.lineageEntriesForSpecimenCard(descriptors[2], entries).map(({ relationshipId }) => relationshipId), ["remaining"]);
});

test("derived lineage entries retain their exact later mass path", () => {
  const index = app.deriveEarlierRecordIndex(lineageData, records, registry);
  const entries = [...index.values()].flat();
  assert(entries.length > 0);
  assert(entries.every((entry) => typeof entry.massPath === "string" && entry.massPath.endsWith("grams")));
});

test("1,360 display cards paginate to 120 before card creation", () => {
  const sourceRecords = Array.from({ length: 136 }, (_, index) => weightedRecord(`bulk-${String(index).padStart(4, "0")}`, Array.from({ length: 10 }, (__, mass) => mass + 1), index));
  const projections = sourceRecords.map((record) => ({
    parentRecordId: record.id,
    retainParentContext: false,
    cards: record.holdings.map((holding, index) => card(index)),
  }));
  const document = syntheticManifest(sourceRecords, projections);
  const descriptors = app.expandSpecimenCardDescriptors(sourceRecords, app.deriveSpecimenCardProjectionIndex(document, sourceRecords));
  assert.equal(descriptors.length, 1360);
  assert.equal(app.paginateSpecimenCardDescriptors(descriptors).length, 120);
  assert.match(source, /const visibleCards = paginateSpecimenCardDescriptors\(displayCards, visibleLimit\);/u);
  assert.match(source, /visibleCards\.forEach\(\(descriptor\) => fragment\.append\(createRecordCard\(descriptor\)\)\);/u);
  assert.doesNotMatch(source, /displayCards\.forEach\([^\n]*createRecordCard/u);
});

test("optional loading is digest-bound, fails closed, and rendering remains text-only", async () => {
  const options = { sourceCatalogSha256, sha256 };
  const loaded = await app.loadSpecimenCardProjectionIndex(records, async () => projectionResponse(manifest), options);
  const failed = await app.loadSpecimenCardProjectionIndex(records, async () => { throw new Error("offline"); }, options);
  const missing = await app.loadSpecimenCardProjectionIndex(records, async () => ({ ok: false }), options);
  const malformed = await app.loadSpecimenCardProjectionIndex(records, async () => projectionResponse({ metadata: {}, projections: [] }), options);
  const staleCatalog = await app.loadSpecimenCardProjectionIndex(records, async () => projectionResponse(manifest), {
    sourceCatalogSha256: "f".repeat(64), sha256,
  });
  const altered = structuredClone(manifest);
  altered.projections[0].retainParentContext = !altered.projections[0].retainParentContext;
  const alteredSet = await app.loadSpecimenCardProjectionIndex(records, async () => projectionResponse(altered), options);
  const priorInserted = structuredClone(manifest);
  priorInserted.projections[0].parentRecordId = "obs-344d0b6d-920e-403f-8fd5-c113fc05291d";
  const forgedPrior = await app.loadSpecimenCardProjectionIndex(records, async () => projectionResponse(priorInserted), options);
  assert.equal(loaded.size, 1699);
  assert.equal(failed.size, 0);
  assert.equal(missing.size, 0);
  assert.equal(malformed.size, 0);
  assert.equal(staleCatalog.size, 0);
  assert.equal(alteredSet.size, 0);
  assert.equal(forgedPrior.size, 0);
  assert.doesNotMatch(source, /\.innerHTML\b/u);
  assert.match(html, /<p class="specimen-position" hidden><\/p>/u);
  assert.match(html, /styles\.css\?v=20260806-2-cards/u);
  assert.match(html, /app\.js\?v=20260806-2-cards/u);
  assert.equal(app.ASSET_CACHE_VERSION, "20260806-2-cards");
});
