import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { flattenMassObservations } from "./specimen-lineages-lib.mjs";

const require = createRequire(import.meta.url);
const app = require("../app.js");
const readText = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [catalogText, foliosText, sourceClaimsText, lineageText, projectionText, indexHtml, catalogsHtml] = await Promise.all([
  readText("../data/catalog.json"),
  readText("../data/folios.json"),
  readText("../data/source-claims.json"),
  readText("../data/specimen-lineages.json"),
  readText("../data/specimen-card-projections.json"),
  readText("../index.html"),
  readText("../catalogs.html"),
]);
const catalog = JSON.parse(catalogText);
const sourceClaims = JSON.parse(sourceClaimsText);
const lineages = JSON.parse(lineageText);
const projections = JSON.parse(projectionText);
const recordById = new Map(catalog.records.map((record) => [record.id, record]));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const resolvePath = (value, path) => path.match(/[A-Za-z]+|[0-9]+/gu)
  .reduce((current, key) => current?.[key], value);

function normalizeCollisionName(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .replace(/\b(?:mt|mts)\b/gu, "mountains")
    .replace(/\bco\b/gu, "county");
}

function identityConsistent(left, right) {
  if (left.meteoriteCode !== null && right.meteoriteCode !== null) {
    return left.meteoriteCode === right.meteoriteCode;
  }
  if (left.meteoriteCode !== null || right.meteoriteCode !== null) return true;
  const leftNames = new Set([left.sourceName, left.canonicalName].filter(Boolean).map(normalizeCollisionName));
  return [right.sourceName, right.canonicalName].filter(Boolean)
    .map(normalizeCollisionName).some((name) => leftNames.has(name));
}

function projectionSemantics() {
  return projections.projections.map((projection) => ({
    parentRecordId: projection.parentRecordId,
    cards: projection.cards.map((card) => {
      const record = recordById.get(projection.parentRecordId);
      return {
        holdingPath: card.holdingPath,
        evidence: card.clause
          ? resolvePath(record, card.clause.textPath).slice(card.clause.start, card.clause.end)
          : resolvePath(record, card.componentPath),
        mass: card.massPath === null ? null : resolvePath(record, card.massPath),
        repeatedMass: card.repeatedMass ? Object.fromEntries(Object.entries(card.repeatedMass).map(([key, value]) => [
          key,
          key.endsWith("Path") ? resolvePath(record, value) : value,
        ])) : null,
      };
    }),
  }));
}

test("CF001 installs the exact accepted catalog bytes", () => {
  assert.equal(sha256(catalogText), "f339b16bf0b799ee0abedb4ce17d41b0f457ab2f7d2afbfda8581523c134d221");
  assert.deepEqual([catalog.records.length, catalog.metadata.catalogs.length], [14477, 40]);
});

test("CF002 installs the exact accepted folio and source-claims bytes", () => {
  assert.equal(sha256(foliosText), "145498213ac8ddd24527b5092bfc4cad8dce1880f8d304d29e2c2c4d44595460");
  assert.equal(sha256(sourceClaimsText), "edb201339e9e1068ac45d3333a9224959b4dcdbf8e317afcbb0657c6635b85fb");
  assert.equal(sourceClaims.claims.length, 21);
});

test("CF003 scopes all Victoria references to descriptor pages 85-94", () => {
  const descriptor = catalog.metadata.catalogs.find(({ id }) => id === "victoria-land-1982");
  assert.deepEqual(descriptor.sourcePages, [85, 86, 87, 88, 89, 90, 91, 92, 93, 94]);
  assert.equal(descriptor.sourcePageCount, 10);
  const pages = new Set(descriptor.sourcePages);
  for (const record of catalog.records.filter(({ catalogId }) => catalogId === descriptor.id)) {
    assert(pages.has(record.catalogPage));
    assert(pages.has(record.sourceEvidence.tableA.printedPage));
    if (record.sourceEvidence.tableB) assert(pages.has(record.sourceEvidence.tableB.printedPage));
  }
  assert(sourceClaims.claims.every(({ printedPage }) => pages.has(printedPage)));
});

test("CF004 retains only the audited Merrill El Capitan masses", () => {
  const record = recordById.get("obs-68c7e39b-9d99-4f9a-a1d2-7b2374d76d47");
  assert.deepEqual(record.holdings[0].weights.map(({ grams }) => grams), [66, 753, 4000]);
  assert(!record.holdings[0].weights.some(({ grams }) => grams === 0));
});

test("CF005 publishes the exact Mantos Blancos classification", () => {
  assert.equal(recordById.get("obs-38554aa8-007c-447f-9410-91d447f74149").classification,
    "Siderite: Fine octahedrite, Of.");
});

test("CF006 lineage derivation admits only positive masses", () => {
  const masses = flattenMassObservations(catalog);
  assert.equal(masses.length, 15137);
  assert(masses.every(({ public: observation }) => observation.massGrams > 0));
});

test("CF007 omits incompatible inventory 139b and reconciles lineage counts", () => {
  assert(!lineages.relationships.some(({ collectionSeries }) => collectionSeries?.inventoryId === "139b"));
  assert.deepEqual({
    relationships: lineages.metadata.counts.relationshipCount,
    sameInventory: lineages.metadata.counts.sameInventoryRelationshipCount,
    possible: lineages.metadata.counts.possibleMatchRelationshipCount,
    omitted: lineages.metadata.counts.omittedAmbiguousInventoryKeyCount,
  }, { relationships: 1559, sameInventory: 194, possible: 1365, omitted: 1 });
});

test("CF008 every established same-inventory pair is identity-consistent", () => {
  const established = lineages.relationships.filter(({ relationship }) => relationship === "same-inventory");
  assert.equal(established.length, 194);
  assert(established.every(({ observations: [left, right] }) => identityConsistent(left, right)));
});

test("CF009 projections retain exact counts and source semantics after rebinding", () => {
  assert.deepEqual(projections.metadata, {
    schemaVersion: 4,
    scope: "reviewed-atomic-specimen-card-display-projections",
    catalogSchemaVersion: 11,
    sourceRecordCount: 14477,
    sourceCatalogSha256: "f339b16bf0b799ee0abedb4ce17d41b0f457ab2f7d2afbfda8581523c134d221",
    projectionCount: 2224,
    atomicCardCount: 7224,
    sourceContextCardCount: 1694,
  });
  const elCapitan = projections.projections.find(({ parentRecordId }) =>
    parentRecordId === "obs-68c7e39b-9d99-4f9a-a1d2-7b2374d76d47");
  assert.deepEqual(elCapitan.cards.map(({ massPath }) => massPath), [
    "holdings[0].weights[0].grams",
    "holdings[0].weights[1].grams",
    "holdings[0].weights[2].grams",
  ]);
  assert.equal(sha256(JSON.stringify(projectionSemantics())),
    "615e4448aab42607cf0d8a4ba0adbd7c542e686db6ec658af5b757be53816eef");
});

test("CF010 preserves non-target data, privacy, cache, and label behavior", () => {
  const correctedRecordIds = new Set([
    "obs-68c7e39b-9d99-4f9a-a1d2-7b2374d76d47",
    "obs-38554aa8-007c-447f-9410-91d447f74149",
  ]);
  assert.equal(sha256(JSON.stringify(catalog.records.filter(({ id }) => !correctedRecordIds.has(id)))),
    "5892e877d2b41a018bbd1836f3d9369a60e923f0dd31920b6671970aa32686b1");
  assert.equal(sha256(JSON.stringify(catalog.metadata.catalogs.filter(({ id }) => id !== "victoria-land-1982"))),
    "8066f1c06de5c8021ffa24020cfe37c4e9cdc5ce1d357e95c20268c2699a1d6e");
  assert.doesNotMatch(catalogText + sourceClaimsText + projectionText,
    /(?:\/private\/|\/Users\/|file:\/\/|sourcePath|sourceFile|rawRowText|raw\s+ocr)/iu);
  assert.equal(app.CACHE_VERSION, "20260905-audited-corrections-1");
  for (const html of [indexHtml, catalogsHtml]) assert.match(html, /20260905-audited-corrections-1/u);
  assert.equal(app.shouldDisplaySemanticLabel("direct-specimen"), false);
  assert.equal(app.shouldDisplaySemanticLabel("projected-atomic-specimen"), false);
  assert.equal(app.shouldDisplaySemanticLabel("collection-observation"), true);
});
