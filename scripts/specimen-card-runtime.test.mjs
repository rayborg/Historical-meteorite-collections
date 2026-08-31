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

function weightedRecord(id, holdingCount, order = 0) {
  return {
    id,
    catalogId: "synthetic-1937",
    recordModel: "collection-entry",
    entryOrder: order + 1,
    reportedNumber: null,
    catalogPages: [1],
    section: "Synthetic section",
    holdings: Array.from({ length: holdingCount }, (_, index) => ({
      description: `Holding ${index + 1}`,
      provenance: null,
      count: null,
      weights: [{ grams: index + 1 }],
    })),
    name: `Synthetic ${order + 1}`,
    classification: null,
    locality: null,
    eventDate: null,
    confidence: "high",
    order,
  };
}

function fullCard(record, holdingIndex, massPath = `holdings[${holdingIndex}].weights[0].grams`) {
  return {
    holdingPath: `holdings[${holdingIndex}]`,
    clause: {
      textPath: `holdings[${holdingIndex}].description`,
      start: 0,
      end: record.holdings[holdingIndex].description.length,
    },
    massPath,
  };
}

function syntheticManifest(sourceRecords, projections) {
  return {
    metadata: {
      schemaVersion: 3,
      scope: "reviewed-atomic-specimen-card-display-projections",
      catalogSchemaVersion: 7,
      sourceRecordCount: sourceRecords.length,
      sourceCatalogSha256: "0".repeat(64),
      projectionCount: projections.length,
      atomicCardCount: projections.reduce((sum, projection) => sum + projection.cards.length, 0),
      sourceContextCardCount: projections.filter((projection) => {
        const record = sourceRecords.find(({ id }) => id === projection.parentRecordId);
        return app.specimenCardContextEntries(record, projection).length > 0;
      }).length,
    },
    projections,
  };
}

test("schema-3 contract is closed and has no schema-2 fallback", () => {
  const parent = weightedRecord("schema-parent", 2);
  const projection = { parentRecordId: parent.id, cards: [fullCard(parent, 0), fullCard(parent, 1)] };
  const document = syntheticManifest([parent], [projection]);
  assert.equal(app.validateSpecimenCardManifest(document, [parent]), true);

  for (const mutate of [
    (value) => { value.metadata.schemaVersion = 2; },
    (value) => { value.metadata.scope = "reviewed-specimen-card-display-projections"; },
    (value) => { value.metadata.atomicCardCount += 1; },
    (value) => { value.metadata.sourceContextCardCount += 1; },
    (value) => { value.metadata.privatePath = "/private/review.json"; },
    (value) => { value.projections[0].retainParentContext = false; },
    (value) => { value.projections[0].cards[0].text = "forged"; },
    (value) => { value.projections[0].cards[0].clause.extra = true; },
  ]) {
    const changed = structuredClone(document);
    mutate(changed);
    assert.equal(app.validateSpecimenCardManifest(changed, [parent]), false);
  }

  const single = weightedRecord("single-parent", 1);
  assert.equal(app.validateSpecimenCardManifest(
    syntheticManifest([single], [{ parentRecordId: single.id, cards: [fullCard(single, 0)] }]), [single]
  ), false);
});

test("span validation rejects empty, reversed, overlapping, reordered, and surrogate-splitting clauses", () => {
  const parent = weightedRecord("span-parent", 1);
  parent.holdings[0].description = "A😀B clause";
  const validCards = [
    { holdingPath: "holdings[0]", clause: { textPath: "holdings[0].description", start: 0, end: 4 }, massPath: null },
    { holdingPath: "holdings[0]", clause: { textPath: "holdings[0].description", start: 4, end: 11 }, massPath: "holdings[0].weights[0].grams" },
  ];
  const make = (cards) => syntheticManifest([parent], [{ parentRecordId: parent.id, cards }]);
  assert.equal(app.validateSpecimenCardManifest(make(validCards), [parent]), true);
  assert.equal(app.validateSpecimenCardManifest(make([{ ...validCards[0], clause: { ...validCards[0].clause, end: 0 } }]), [parent]), false);
  assert.equal(app.validateSpecimenCardManifest(make([{ ...validCards[0], clause: { ...validCards[0].clause, start: 4, end: 3 } }]), [parent]), false);
  assert.equal(app.validateSpecimenCardManifest(make([{ ...validCards[0], clause: { ...validCards[0].clause, end: 5 } }, validCards[1]]), [parent]), false);
  assert.equal(app.validateSpecimenCardManifest(make([...validCards].reverse()), [parent]), false);
  assert.equal(app.validateSpecimenCardManifest(make([{ ...validCards[0], clause: { ...validCards[0].clause, end: 2 } }]), [parent]), false);
});

test("runtime rejects atomic cards for non-specimen catalog-item holdings", () => {
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
    cards: [{
      holdingPath: "holdings[0]",
      clause: { textPath: "holdings[0].description", start: 0, end: 9 },
      massPath: null,
    }],
  };
  assert.equal(app.validateSpecimenCardManifest(syntheticManifest([parent], [projection]), [parent]), false);
});

test("Prior entry 630 renders only seventeen exact atomic clauses", () => {
  const prior = records.find((record) => record.catalogId === "prior-1923" && record.entryOrder === 630);
  const projection = manifest.projections.find(({ parentRecordId }) => parentRecordId === prior.id);
  const document = syntheticManifest([prior], [projection]);
  assert.equal(app.validateSpecimenCardManifest(document, [prior]), true);
  const descriptors = app.expandSpecimenCardDescriptors([prior], app.deriveSpecimenCardProjectionIndex(document, [prior]));
  assert.equal(descriptors.length, 17);
  assert.equal(descriptors.filter(({ kind }) => kind === "atomic").length, 17);
  assert.equal(descriptors.filter(({ kind }) => kind === "context").length, 0);
  assert.deepEqual(descriptors.slice(0, 17).map(({ clauseText }) => clauseText), projection.cards.map(({ clause }) =>
    prior.holdings[0].description.slice(clause.start, clause.end)));
  assert.equal(descriptors.slice(0, 17).filter(({ massPath }) => massPath === null).length, 5);
  assert(descriptors.slice(0, 17).every((descriptor) => app.specimenCardPositionLabel(descriptor) === null));
  assert.deepEqual(descriptors.slice(0, 17).map(app.specimenCardDescriptorMasses),
    [[9095], [3545], [845], [793], [538], [425], [], [], [158], [145], [], [1111], [108], [], [821], [76], []]);
  assert.deepEqual(descriptors.slice(0, 17).map(app.specimenCardDescriptorHoldings), projection.cards.map(({ clause, massPath }, index) =>
    massPath === null
      ? [{ type: "detail", text: prior.holdings[0].description.slice(clause.start, clause.end) }]
      : [{ type: "weight", grams: app.specimenCardDescriptorMasses(descriptors[index])[0] }]));

  const contextEntries = app.specimenCardContextEntries(prior, projection);
  assert.deepEqual(contextEntries.filter(({ type }) => type === "segment").map(({ text }) => text), [
    prior.holdings[0].description.slice(0, 77),
    prior.holdings[0].description.slice(536, 743),
  ]);
  assert.deepEqual(contextEntries.filter(({ type }) => type === "mass").map(({ grams }) => grams), [64, 999, 50, 243]);

  const lineageIndex = app.deriveEarlierRecordIndex(lineageData, records, registry);
  const entries = lineageIndex.get(prior.id);
  assert.equal(entries.length, 2);
  assert.deepEqual(descriptors.map((descriptor) => app.lineageEntriesForSpecimenCard(descriptor, entries).length),
    [0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0]);
});

test("position labels appear only for duplicate normalized masses within one parent", () => {
  const parent = weightedRecord("duplicate-mass-parent", 3);
  parent.holdings[1].weights[0].grams = parent.holdings[0].weights[0].grams;
  const projection = { parentRecordId: parent.id, cards: parent.holdings.map((holding, index) => fullCard(parent, index)) };
  const document = syntheticManifest([parent], [projection]);
  const descriptors = app.expandSpecimenCardDescriptors([parent], app.deriveSpecimenCardProjectionIndex(document, [parent]));
  assert.deepEqual(descriptors.map(app.specimenCardPositionLabel), [
    "Specimen 1 of 2 with this reported mass",
    "Specimen 2 of 2 with this reported mass",
    null,
  ]);
});

test("Reeds entry 366 derives ten full-description cards with exact masses and no context", () => {
  const reeds = records.find((record) => record.catalogId === "reeds-1937" && record.entryOrder === 366);
  const projection = { parentRecordId: reeds.id, cards: reeds.holdings.map((holding, index) => fullCard(reeds, index)) };
  const document = syntheticManifest([reeds], [projection]);
  assert.equal(app.validateSpecimenCardManifest(document, [reeds]), true);
  const descriptors = app.expandSpecimenCardDescriptors([reeds], app.deriveSpecimenCardProjectionIndex(document, [reeds]));
  assert.equal(descriptors.length, 10);
  assert(descriptors.every(({ kind }) => kind === "atomic"));
  assert.deepEqual(descriptors.map(({ clauseText }) => clauseText), reeds.holdings.map(({ description }) => description));
  assert.deepEqual(descriptors.map((descriptor) => app.specimenCardDescriptorMasses(descriptor)[0]),
    [28.9, 310.1, 142, 30, 9.6, 124.5, 2.3, 128.5, 658.7, 51.2]);
});

test("context partition remains auditable but is not emitted as a specimen card", () => {
  const parent = weightedRecord("context-parent", 2);
  parent.holdings[0].description = "Preamble. Clause one. Middle. Clause two. Tail.";
  parent.holdings[0].weights.push({ grams: 99 });
  parent.holdings[1].provenance = "Separate source fact";
  parent.holdings[1].count = 2;
  const firstStart = parent.holdings[0].description.indexOf("Clause one.");
  const secondStart = parent.holdings[0].description.indexOf("Clause two.");
  const projection = {
    parentRecordId: parent.id,
    cards: [
      { holdingPath: "holdings[0]", clause: { textPath: "holdings[0].description", start: firstStart, end: firstStart + 11 }, massPath: "holdings[0].weights[0].grams" },
      { holdingPath: "holdings[0]", clause: { textPath: "holdings[0].description", start: secondStart, end: secondStart + 11 }, massPath: null },
    ],
  };
  const document = syntheticManifest([parent], [projection]);
  const descriptors = app.expandSpecimenCardDescriptors([parent], app.deriveSpecimenCardProjectionIndex(document, [parent]));
  assert.equal(descriptors.length, 2);
  assert(descriptors.every(({ kind }) => kind === "atomic"));
  const contextEntries = app.specimenCardContextEntries(parent, projection);
  assert.deepEqual(contextEntries.filter(({ type }) => type === "segment").map(({ text }) => text),
    ["Preamble. ", " Middle. ", " Tail.", "Holding 2", "Separate source fact"]);
  assert.deepEqual(contextEntries.filter(({ type }) => type === "fact").map(({ label, text }) => [label, text]),
    [["Reported count", "2"]]);
  assert.deepEqual(contextEntries.filter(({ type }) => type === "mass").map(({ grams }) => grams), [99, 2]);
});

test("massless atomic cards remain visible without a range and are excluded by any range", () => {
  const parent = weightedRecord("massless-parent", 1);
  parent.holdings[0].description = "Massless. Weighted.";
  const projection = {
    parentRecordId: parent.id,
    cards: [
      { holdingPath: "holdings[0]", clause: { textPath: "holdings[0].description", start: 0, end: 9 }, massPath: null },
      { holdingPath: "holdings[0]", clause: { textPath: "holdings[0].description", start: 10, end: 19 }, massPath: "holdings[0].weights[0].grams" },
    ],
  };
  const document = syntheticManifest([parent], [projection]);
  const descriptors = app.expandSpecimenCardDescriptors([parent], app.deriveSpecimenCardProjectionIndex(document, [parent]));
  const noRange = app.filterSpecimenCardDescriptors(descriptors, { min: null, max: null, lineageOnly: false });
  const ranged = app.filterSpecimenCardDescriptors(descriptors, { min: 0, max: 10, lineageOnly: false });
  assert.equal(noRange.filter(({ kind }) => kind === "atomic").length, 2);
  assert.deepEqual(ranged.filter(({ kind }) => kind === "atomic").map(({ massPath }) => massPath), ["holdings[0].weights[0].grams"]);
  assert.deepEqual(descriptors.map(app.specimenCardDescriptorHoldings), [
    [{ type: "detail", text: "Massless." }],
    [{ type: "weight", grams: 1 }],
  ]);
});

test("lineage routes only to emitted atomic cards", () => {
  const parent = weightedRecord("lineage-parent", 1);
  parent.holdings[0].description = "First. Second.";
  parent.holdings[0].weights = [{ grams: 50 }, { grams: 50 }, { grams: 75 }];
  const projection = {
    parentRecordId: parent.id,
    cards: [
      { holdingPath: "holdings[0]", clause: { textPath: "holdings[0].description", start: 0, end: 6 }, massPath: "holdings[0].weights[0].grams" },
      { holdingPath: "holdings[0]", clause: { textPath: "holdings[0].description", start: 7, end: 14 }, massPath: null },
    ],
  };
  const document = syntheticManifest([parent], [projection]);
  const descriptors = app.expandSpecimenCardDescriptors([parent], app.deriveSpecimenCardProjectionIndex(document, [parent]));
  const entries = [
    { relationshipId: "selected", massPath: "holdings[0].weights[0].grams" },
    { relationshipId: "equal-unmatched", massPath: "holdings[0].weights[1].grams" },
    { relationshipId: "remaining", massPath: "holdings[0].weights[2].grams" },
  ];
  assert.deepEqual(app.lineageEntriesForSpecimenCard(descriptors[0], entries).map(({ relationshipId }) => relationshipId), ["selected"]);
  assert.deepEqual(app.lineageEntriesForSpecimenCard(descriptors[1], entries), []);
});

test("search, statistics, result observations, and citations remain parent-based", () => {
  const parent = weightedRecord("parent-based", 2);
  const projection = { parentRecordId: parent.id, cards: parent.holdings.map((holding, index) => fullCard(parent, index)) };
  const document = syntheticManifest([parent], [projection]);
  const descriptors = app.expandSpecimenCardDescriptors([parent], app.deriveSpecimenCardProjectionIndex(document, [parent]));
  assert.equal(descriptors.length, 2);
  assert.deepEqual(app.calculateStatistics([parent]), app.calculateStatistics(descriptors.map(({ parentRecord }) => parentRecord).slice(0, 1)));
  assert.match(source, /const parentMatches = filterRecords\(records,/u);
  assert.match(source, /new Set\(displayCards\.map\(\(\{ parentRecord \}\) => parentRecord\.id\)\)/u);
  assert.match(source, /const citedPages = recordCatalogPages\(record\);/u);
});

test("1,360 atomic descriptors paginate before DOM card creation", () => {
  const sourceRecords = Array.from({ length: 136 }, (_, index) => weightedRecord(`bulk-${String(index).padStart(4, "0")}`, 10, index));
  const projections = sourceRecords.map((record) => ({
    parentRecordId: record.id,
    cards: record.holdings.map((holding, index) => fullCard(record, index)),
  }));
  const document = syntheticManifest(sourceRecords, projections);
  const descriptors = app.expandSpecimenCardDescriptors(sourceRecords, app.deriveSpecimenCardProjectionIndex(document, sourceRecords));
  assert.equal(descriptors.length, 1360);
  assert.equal(app.paginateSpecimenCardDescriptors(descriptors).length, 120);
  assert.match(source, /const visibleCards = paginateSpecimenCardDescriptors\(displayCards, visibleLimit\);/u);
  assert.match(source, /visibleCards\.forEach\(\(descriptor\) => fragment\.append\(createRecordCard\(descriptor\)\)\);/u);
  assert.doesNotMatch(source, /displayCards\.forEach\([^\n]*createRecordCard/u);
});

test("digest lock loads the exact set and fails closed to parent cards on mismatch", async () => {
  const parent = weightedRecord("digest-parent", 1);
  const document = syntheticManifest([parent], [{ parentRecordId: parent.id, cards: [fullCard(parent, 0)] }]);
  document.metadata.sourceCatalogSha256 = sourceCatalogSha256;
  const options = { sourceCatalogSha256, sha256 };
  assert.equal((await app.loadSpecimenCardProjectionIndex(records, async () => projectionResponse(manifest), options)).size, manifest.metadata.projectionCount);
  assert.equal((await app.loadSpecimenCardProjectionIndex([parent], async () => { throw new Error("offline"); }, options)).size, 0);
  assert.equal((await app.loadSpecimenCardProjectionIndex([parent], async () => ({ ok: false }), options)).size, 0);
  assert.equal((await app.loadSpecimenCardProjectionIndex([parent], async () => projectionResponse({ metadata: {}, projections: [] }), options)).size, 0);
  assert.equal((await app.loadSpecimenCardProjectionIndex([parent], async () => projectionResponse(document), {
    sourceCatalogSha256: "f".repeat(64), sha256,
  })).size, 0);
  const altered = structuredClone(manifest);
  altered.projections[0].cards[0].clause.end -= 1;
  assert.equal((await app.loadSpecimenCardProjectionIndex(records, async () => projectionResponse(altered), options)).size, 0);
  assert.equal(app.SPECIMEN_CARD_SOURCE_CATALOG_SHA256, "91694659e5f7210db10ffc42873c54d5d38d3e5a485d51c38072746faa7f41e0");
  assert.equal(app.SPECIMEN_CARD_PROJECTION_SET_SHA256, "45490022fc876f4df62c07110b3fa40a04c0a1edc6aec26797d616f7c159c263");
});

test("rendering is text-only, omits context cards, and synchronizes cache keys", () => {
  assert.doesNotMatch(source, /\.innerHTML\b/u);
  assert.doesNotMatch(source, /Source context, not an individual specimen/u);
  assert.doesNotMatch(source, /source-context-card/u);
  assert.doesNotMatch(source, /"Specimen clause"|`Component:/u);
  assert.match(source, /weighted \? "Specimen weight" : "Specimen details"/u);
  assert.match(source, /with this reported mass/u);
  assert.match(html, /<p class="specimen-position" hidden><\/p>/u);
  assert.match(html, /styles\.css\?v=20260831-specimen-cards-1/u);
  assert.match(html, /app\.js\?v=20260831-specimen-cards-1/u);
  assert.equal(app.ASSET_CACHE_VERSION, "20260831-specimen-cards-1");
});

test("production projection fixture validates when the schema-3 data dependency is present", {
  skip: manifest.metadata.schemaVersion !== 3 ? "schema-3 projection data has not landed in this worktree" : false,
}, () => {
  assert.equal(sourceCatalogSha256, manifest.metadata.sourceCatalogSha256);
  assert.deepEqual([
    manifest.metadata.projectionCount,
    manifest.metadata.atomicCardCount,
    manifest.metadata.sourceContextCardCount,
  ], [1955, 6675, 1657]);
  assert.equal(app.validateSpecimenCardManifest(manifest, records, { sourceCatalogSha256 }), true);
  const index = app.deriveSpecimenCardProjectionIndex(manifest, records, { sourceCatalogSha256 });
  assert.equal(index.size, manifest.metadata.projectionCount);
  const projectedRecords = records.filter(({ id }) => index.has(id));
  const descriptors = app.expandSpecimenCardDescriptors(projectedRecords, index);
  assert.equal(descriptors.filter(({ kind }) => kind === "atomic").length, manifest.metadata.atomicCardCount);
  assert.equal(descriptors.filter(({ kind }) => kind === "context").length, 0);
});

test("Madrid runtime keeps parent statistics while loading reviewed atomic cards and eligible earlier lineages", async () => {
  const madridRecords = records.filter(({ catalogId }) => catalogId === "madrid-1923");
  const projectionIndex = await app.loadSpecimenCardProjectionIndex(records, async () => projectionResponse(manifest), {
    sourceCatalogSha256,
    sha256,
  });
  const madridDescriptors = app.expandSpecimenCardDescriptors(madridRecords, projectionIndex);
  const madridRecordIds = new Set(madridRecords.map(({ id }) => id));
  const madridRelationships = lineageData.relationships.filter(({ observations }) =>
    observations.some(({ recordId }) => madridRecordIds.has(recordId)));
  const lineageIndex = await app.loadEarlierRecordIndex(records, registry, async () => ({
    ok: true,
    json: async () => lineageData,
  }));
  const loadedRelationshipIds = new Set([...lineageIndex.values()].flatMap((entries) =>
    entries.map(({ relationshipId }) => relationshipId)));

  assert.equal(app.calculateStatistics(records).observations, 13819);
  assert.equal(app.calculateStatistics(records).catalogs, 35);
  assert.equal(madridRecords.filter(({ id }) => projectionIndex.has(id)).length, 23);
  assert.equal(madridDescriptors.filter(({ kind }) => kind === "atomic").length, 54);
  assert.equal(madridDescriptors.filter(({ kind }) => kind === "context").length, 0);
  assert.equal(madridRelationships.length, 3);
  assert(madridRelationships.every(({ relationship, review }) =>
    relationship === "possible-match" && review.status === "unreviewed"));
  assert.equal(madridRelationships.filter(({ id }) => loadedRelationshipIds.has(id)).length, 2);
  assert.equal(madridRelationships.find(({ catalogPair }) => catalogPair === "madrid-1923|prior-1923")
    .observations.every(({ catalogYear }) => catalogYear === 1923), true);
});
