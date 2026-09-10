import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { flattenMassObservations } from "./specimen-lineages-lib.mjs";
import { validatePublicCatalog } from "./validate-public-catalog.mjs";

const [catalogText, foliosText, sourceClaimsText] = await Promise.all([
  readFile(new URL("../data/catalog.json", import.meta.url), "utf8"),
  readFile(new URL("../data/folios.json", import.meta.url), "utf8"),
  readFile(new URL("../data/source-claims.json", import.meta.url), "utf8"),
]);
const catalog = JSON.parse(catalogText);
const folios = JSON.parse(foliosText);
const victoria = catalog.records.filter(({ catalogId }) => catalogId === "victoria-land-1982");
const victoriaDescriptor = catalog.metadata.catalogs.find(({ id }) => id === "victoria-land-1982");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

test("imports all three accepted public package files exactly", () => {
  assert.equal(sha256(catalogText), "d06cb3c737ffec0259e43e778ed62056d88701c36637b661d20a91dd1061d5b3");
  assert.equal(sha256(foliosText), "ed23bc9af5bb73eb932fd928f7d46b02379265bbeb43911d44004aa4cddacdd5");
  assert.equal(sha256(sourceClaimsText), "edb201339e9e1068ac45d3333a9224959b4dcdbf8e317afcbb0657c6635b85fb");
  assert.deepEqual({ schema: catalog.metadata.schemaVersion, records: catalog.records.length, catalogs: catalog.metadata.catalogs.length },
    { schema: 12, records: 18217, catalogs: 49 });
  assert.doesNotThrow(() => validatePublicCatalog(catalog, folios));
});

test("publishes exact Victoria Table A names, official abbreviations, coordinates, pages, and ALHA76009", () => {
  assert.equal(victoria.length, 273);
  assert(victoria.every(({ name, specimenId, metbull }) => name === specimenId && metbull.matchType === "official-abbreviation"));
  assert.equal(new Set(victoria.map(({ specimenId }) => specimenId)).size, 273);
  assert.equal(new Set(victoria.map(({ metbull }) => metbull.meteoriteCode)).size, 273);
  assert.equal(victoria.filter(({ locality }) => locality.areaReferenceCoordinate !== null).length, 240);
  assert.deepEqual(victoriaDescriptor.sourcePages, [85, 86, 87, 88, 89, 90, 91, 92, 93, 94]);
  assert.equal(victoriaDescriptor.sourcePageCount, 10);
  assert.deepEqual([...new Set(victoria.map(({ catalogPage }) => catalogPage))], [85, 86, 87, 88]);
  assert.equal(victoria.reduce((sum, { weight }) => sum + weight.grams, 0), 969562.2);
  assert.equal(sha256(JSON.stringify(victoria)), "c427fa0bf07a8ce57c01d4520fc3b2eb2c2aa7483f1d8bf5d7f8bce483f96806");
  assert.deepEqual(victoria.find(({ specimenId }) => specimenId === "ALHA76009"), {
    id: "obs-2a63d720-397d-4fa3-9c21-a6783d91c303",
    catalogId: "victoria-land-1982",
    entryOrder: 9,
    specimenId: "ALHA76009",
    name: "ALHA76009",
    weight: { grams: 407000 },
    classification: "L6",
    olivineFa: "24",
    pyroxeneFs: "21",
    weathering: "B",
    locality: { code: "ALH", name: "Allan Hills", areaReferenceCoordinate: "76°45'S, 159°40'E" },
    catalogPage: 85,
    sourceEvidence: {
      primary: "tableA",
      tableA: {
        printedPage: 85,
        massGrams: 407000,
        classification: "L6",
        olivineFa: "24",
        pyroxeneFs: "21",
        weathering: "B",
      },
      tableB: {
        printedPage: 91,
        massGrams: 3950,
        classification: "L6",
        classificationContext: null,
        weathering: "B",
        fracturing: "B",
      },
      conflicts: ["mass"],
    },
    confidence: "high",
    metbull: {
      matchType: "official-abbreviation",
      canonicalName: "Allan Hills A76009",
      meteoriteCode: "1316",
      metbullUrl: "https://www.lpi.usra.edu/meteor/metbull.cfm?code=1316",
      alternateNameNote: null,
    },
  });
});

test("catalog validation rejects Victoria mapping, name, evidence, coordinate, and printed-page drift", () => {
  const cases = [
    ["mapping type", "ALHA76001", (record) => { record.metbull.matchType = "historical-alias"; }],
    ["source name", "ALHA76001", (record) => { record.name = "Allan Hills A76001"; }],
    ["malformed source evidence", "ALHA76001", (record) => { record.sourceEvidence = { primary: "tableA" }; }],
    ["non-primary source role", "ALHA76001", (record) => { record.sourceEvidence.primary = "tableB"; }],
    ["top-level and Table A mismatch", "ALHA76001", (record) => { record.sourceEvidence.tableA.massGrams += 1; }],
    ["Table B conflict mismatch", "ALHA76009", (record) => { record.sourceEvidence.conflicts = []; }],
    ["Table B unclassified context mismatch", "ALHA76009", (record) => {
      record.sourceEvidence.tableB.classification = null;
    }],
    ["coordinate key", "ALHA76001", (record) => {
      record.locality.coordinate = record.locality.areaReferenceCoordinate;
      delete record.locality.areaReferenceCoordinate;
    }],
    ["printed page", "ALHA76001", (record) => { record.catalogPage = 89; }],
  ];
  for (const [label, specimenId, mutate] of cases) {
    const changed = structuredClone(catalog);
    mutate(changed.records.find((record) => record.specimenId === specimenId));
    assert.throws(() => validatePublicCatalog(changed, folios),
      /official|name|matchType|keys|page|package|primary|evidence|conflict|context/iu, label);
  }
});

test("publishes closed normalized source evidence while excluding all 40 mass conflicts from lineages", () => {
  const rendered = JSON.stringify(victoria);
  for (const field of ["descriptionEvidence", "sourceRowKey", "pageIds", "sourceImages", "qualifiedLinkage", "rawRowText", "weightGramsText"]) {
    assert(!rendered.includes(`\"${field}\"`), field);
  }
  assert.doesNotMatch(rendered, /(?:\/private\/|\/Users\/|file:\/\/|assets\/|\.(?:pdf|png|webp|tiff?))/iu);
  assert.equal(victoria.filter(({ sourceEvidence }) => sourceEvidence.primary === "tableA").length, 273);
  assert.equal(victoria.filter(({ sourceEvidence }) => sourceEvidence.tableB !== null).length, 270);
  assert.equal(victoria.filter(({ sourceEvidence }) => sourceEvidence.tableB !== null &&
    sourceEvidence.tableB.classification !== null).length, 268);
  assert.equal(victoria.filter(({ sourceEvidence }) => sourceEvidence.tableB !== null &&
    sourceEvidence.tableB.weathering !== null).length, 249);
  assert.equal(victoria.filter(({ sourceEvidence }) => sourceEvidence.tableB !== null &&
    sourceEvidence.tableB.fracturing !== null).length, 250);
  assert.equal(victoria.filter(({ sourceEvidence }) =>
    sourceEvidence.tableB?.classificationContext === "Unclassified").length, 2);
  assert.equal(victoria.filter(({ sourceEvidence }) => sourceEvidence.conflicts.includes("classification")).length, 2);
  assert.equal(victoria.filter(({ sourceEvidence }) => sourceEvidence.conflicts.includes("weathering")).length, 8);
  const massConflicts = new Set(victoria.filter(({ sourceEvidence }) =>
    sourceEvidence.conflicts.includes("mass")).map(({ specimenId }) => specimenId));
  assert.equal(massConflicts.size, 40);
  const lineageMasses = flattenMassObservations(catalog).filter(({ public: observation }) =>
    observation.catalogId === "victoria-land-1982");
  assert.equal(lineageMasses.length, 233);
  assert(lineageMasses.every(({ public: observation }) =>
    !massConflicts.has(observation.designation)));
});

test("preserves every non-correction record and descriptor byte-semantically", () => {
  const correctedRecordIds = new Set([
    "obs-68c7e39b-9d99-4f9a-a1d2-7b2374d76d47",
    "obs-38554aa8-007c-447f-9410-91d447f74149",
  ]);
  const wave2CatalogIds = new Set(["berlin-1903", "berlin-1904", "greifswald-1895", "greifswald-1901"]);
  const fletcherCatalogIds = new Set(["fletcher-1886", "fletcher-1894", "fletcher-1896", "fletcher-1904", "fletcher-1908"]);
  assert.equal(sha256(JSON.stringify(catalog.records.filter(({ id, catalogId }) => !correctedRecordIds.has(id) && !wave2CatalogIds.has(catalogId) && !fletcherCatalogIds.has(catalogId)))),
    "ec2a8ad5fea13c2503a5d3db84f26a263baf086d18f89eaab5849b1b5a6948a7");
  assert.equal(sha256(JSON.stringify(catalog.metadata.catalogs.filter(({ id }) => id !== "victoria-land-1982" && !wave2CatalogIds.has(id) && !fletcherCatalogIds.has(id)))),
    "31aa040fb71302cb0b8c3a9c691ad747ead2eafec725ac804bdca58cc9b7849e");
});
