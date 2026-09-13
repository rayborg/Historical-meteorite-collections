import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const app = require("../app.js");
const [catalog, projections, lineages, currentContext] = await Promise.all([
  readFile(new URL("../data/catalog.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/specimen-card-projections.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/specimen-lineages.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/metbull-current-context.json", import.meta.url), "utf8").then(JSON.parse),
]);
const catalogIds = new Set(["farrington-north-america-1915", "silberrad-1932"]);
const raw = catalog.records.filter(({ catalogId }) => catalogIds.has(catalogId));
const registry = app.normalizeCatalogRegistry(catalog.metadata);
const records = catalog.records.map((record, index) => app.prepareRecord(record, index, registry));
const integrated = records.filter(({ catalogId }) => catalogIds.has(catalogId));
const projectionParents = new Set(projections.projections.map(({ parentRecordId }) => parentRecordId));
const lineageEndpoints = new Set(lineages.relationships.flatMap(({ observations }) =>
  observations.map(({ recordId }) => recordId)));
const comparisonEndpoints = new Set(lineages.comparisonGroups.flatMap(({ candidates }) =>
  candidates.flatMap(({ observations }) => observations.map(({ recordId }) => recordId))));

test("Farrington and Silberrad retain their accepted closed regional-event census", () => {
  const farrington = raw.filter(({ catalogId }) => catalogId === "farrington-north-america-1915");
  const silberrad = raw.filter(({ catalogId }) => catalogId === "silberrad-1932");
  assert.deepEqual([farrington.length, silberrad.length, raw.length], [247, 106, 353]);
  assert.equal(silberrad.flatMap(({ reportedMaterial }) => reportedMaterial).length, 108);
  assert.equal(silberrad.filter(({ reportedMaterial }) => reportedMaterial.length > 0).length, 100);
  assert(raw.every((record) => record.metbull.matchType === "unresolved" &&
    !("weight" in record) && !("holdings" in record) && !("lineage" in record)));
  assert(raw.flatMap(({ reportedMaterial }) => reportedMaterial).every((material) =>
    Object.keys(material).join("|") === "statement|quantityType|semantics" &&
    material.semantics === "regional-event-context-only" && !("grams" in material)));
});

test("regional-event facts remain searchable observations without specimen projections or lineage", () => {
  const ids = new Set(integrated.map(({ id }) => id));
  assert.equal(integrated.length, 353);
  assert(integrated.every((record) => app.classifyHarmonizedCard(record) === "regional-event-observation"));
  assert(integrated.every((record) => app.recordMasses(record).length === 0 &&
    app.recordSchemaMasses(record).length === 0 && app.recordSearchMasses(record).length === 0));
  assert(integrated.every((record) => !projectionParents.has(record.id) &&
    !lineageEndpoints.has(record.id) && !comparisonEndpoints.has(record.id)));
  assert.equal([...ids].filter((id) => JSON.stringify(currentContext).includes(id)).length, 0);
  for (const record of integrated) {
    assert.equal(app.matchesSearch(record, record.name), true, record.id);
    if (record.jurisdiction) assert.equal(app.matchesSearch(record, record.jurisdiction), true, record.id);
    if (record.eventText) assert.equal(app.matchesSearch(record, record.eventText), true, record.id);
    for (const material of record.reportedMaterial) assert.equal(app.matchesSearch(record, material.statement), true, record.id);
  }
});

test("runtime rejects promotion or widening of regional-event material", () => {
  const targetIndex = catalog.records.findIndex(({ catalogId, reportedMaterial }) =>
    catalogId === "silberrad-1932" && reportedMaterial.length > 0);
  const reject = (mutate) => {
    const records = [...catalog.records];
    records[targetIndex] = structuredClone(records[targetIndex]);
    mutate(records[targetIndex]);
    assert.throws(() => app.validateCatalog({ metadata: catalog.metadata, records }), /facts-only schema/u);
  };
  reject((record) => { record.weight = { grams: 1 }; });
  reject((record) => { record.holdings = []; });
  reject((record) => { record.reportedMaterial[0].grams = 1; });
  reject((record) => { record.reportedMaterial[0].semantics = "specimen-weight"; });
  reject((record) => { record.metbull.matchType = "exact"; });
});
