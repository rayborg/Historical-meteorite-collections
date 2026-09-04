import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const app = require("../app.js");
const catalog = JSON.parse(await readFile(new URL("../data/catalog.json", import.meta.url), "utf8"));
const registry = app.normalizeCatalogRegistry(catalog.metadata);
const records = catalog.records.map((record, index) => app.prepareRecord(record, index, registry));
const victoria = records.filter(({ catalogId }) => catalogId === "victoria-land-1982");

function search(query) {
  return app.filterRecords(victoria, {
    query, catalog: "victoria-land-1982", min: null, max: null, lineageOnly: false, sort: "designation-asc"
  }).map(({ specimenId }) => specimenId);
}

function fact(dto, label) {
  return dto.facts.find((entry) => entry.label === label)?.value;
}

test("all Victoria cards preserve exact source IDs and resolved current names", () => {
  assert.equal(victoria.length, 273);
  for (const record of victoria) {
    const dto = app.presentHarmonizedCard(record);
    assert.equal(dto.identifier, record.specimenId, record.id);
    assert.equal(dto.sourceName, record.specimenId, record.id);
    assert.equal(fact(dto, "Current Meteoritical Bulletin name"), record.metbull.canonicalName, record.id);
    assert.equal(app.matchesSearch(record, record.specimenId), true, record.id);
    assert.equal(app.matchesSearch(record, `${record.specimenId.slice(0, -5)} ${record.specimenId.slice(-5)}`), true, record.id);
    assert.equal(app.matchesSearch(record, `${record.specimenId.slice(0, -5)}-${record.specimenId.slice(-5)}`), true, record.id);
  }
  assert.equal(victoria.filter(({ metbull }) => !metbull.canonicalName || !metbull.meteoriteCode).length, 0);
});

test("five-digit searches resolve exact terminal suffix groups without prefix inference", () => {
  const suffixGroups = Map.groupBy(victoria, ({ specimenId }) => specimenId.slice(-5));
  const duplicates = [...suffixGroups.values()].filter((group) => group.length > 1);
  assert.deepEqual({ groups: suffixGroups.size, duplicateGroups: duplicates.length, duplicateIds: duplicates.flat().length },
    { groups: 237, duplicateGroups: 24, duplicateIds: 60 });
  for (const [suffix, group] of suffixGroups) {
    assert.deepEqual(search(suffix), group.map(({ specimenId }) => specimenId).toSorted(), suffix);
  }
  assert.deepEqual(search("76009"), ["ALHA76009"]);
  for (const query of ["7600", "076009", "x76009", "76009x", "EETA76009"]) assert.deepEqual(search(query), [], query);
});

test("ALHA76009 exposes Table A primary and Table B reported mass without changing primary mass behavior", () => {
  const record = victoria.find(({ specimenId }) => specimenId === "ALHA76009");
  const dto = app.presentHarmonizedCard(record);
  assert.equal(dto.sourceName, "ALHA76009");
  assert.equal(fact(dto, "Current Meteoritical Bulletin name"), "Allan Hills A76009");
  assert.equal(fact(dto, "Specimen weight"), "407 kg");
  assert.equal(fact(dto, "Specimen weight, Table A primary (printed page 85)"), "407 kg");
  assert.equal(fact(dto, "Specimen weight, Table B reported (printed page 91)"), "3.95 kg");
  assert.equal(dto.sourceCitation,
    "Catalog of Meteorites from Victoria Land, Antarctica, 1978-1980 (1982) · Appendix Table A printed page 85 · Table B printed page 91");
  assert.deepEqual(search("3950").includes("ALHA76009"), true);
  assert.equal(app.filterRecords(victoria, {
    query: "", catalog: "victoria-land-1982", min: 3950, max: 3950, lineageOnly: false, sort: "weight-asc"
  }).some(({ specimenId }) => specimenId === "ALHA76009"), false);
  assert.equal(app.calculateStatistics([record]).grams, 407000);
  assert.equal(app.weightSortValue(record, false), 407000);
});

test("all Victoria conflicts are visibly dual, non-conflicts stay concise, and citations use printed pages", () => {
  const conflictCounts = { mass: 0, classification: 0, weathering: 0 };
  let tableBCitations = 0;
  for (const record of victoria) {
    const dto = app.presentHarmonizedCard(record);
    const conflictFacts = app.victoriaConflictFacts(record);
    assert.equal(fact(dto, "Class"), record.classification, record.id);
    assert.equal(fact(dto, "Specimen weight"), app.formatMass(record.weight.grams), record.id);
    assert.equal(conflictFacts.length, record.sourceEvidence.conflicts.length * 2, record.id);
    for (const field of record.sourceEvidence.conflicts) conflictCounts[field] += 1;
    for (const { label, value } of conflictFacts) {
      assert.match(label, /Table [AB] (?:primary|reported) \(printed page \d+\)$/u, record.id);
      assert.equal(typeof value, "string", record.id);
      assert(value.length > 0, record.id);
    }
    assert.match(dto.sourceCitation, /Appendix Table A printed page (?:85|86|87|88)/u, record.id);
    assert.doesNotMatch(dto.sourceCitation, /PDF|position|folio/iu, record.id);
    if (record.sourceEvidence.tableB) {
      tableBCitations += 1;
      assert.match(dto.sourceCitation, /Table B printed page (?:88|89|90|91|92|93|94)/u, record.id);
    } else {
      assert.doesNotMatch(dto.sourceCitation, /Table B/u, record.id);
    }
    assert.doesNotMatch(JSON.stringify(dto), /rawRowText|sourceImage|pageId|pdfPage|\/private\/|\/Users\//iu, record.id);
  }
  assert.deepEqual(conflictCounts, { mass: 40, classification: 2, weathering: 8 });
  assert.equal(tableBCitations, 270);
});

test("Table B, official-name, and area-reference facts are searchable without entering primary statistics", () => {
  for (const record of victoria) {
    const tableB = record.sourceEvidence.tableB;
    assert.equal(app.matchesSearch(record, record.metbull.canonicalName), true, record.id);
    assert.equal(app.matchesSearch(record, record.metbull.meteoriteCode), true, record.id);
    if (record.locality.areaReferenceCoordinate) {
      assert.equal(app.matchesSearch(record, record.locality.areaReferenceCoordinate), true, record.id);
    }
    if (!tableB) continue;
    assert.equal(app.matchesSearch(record, String(tableB.massGrams)), true, record.id);
    for (const value of [tableB.classification, tableB.classificationContext, tableB.weathering, tableB.fracturing]) {
      if (value) assert.equal(app.matchesSearch(record, value), true, `${record.id}: ${value}`);
    }
  }
  assert.equal(app.calculateStatistics(victoria).grams,
    victoria.reduce((sum, { sourceEvidence }) => sum + sourceEvidence.tableA.massGrams, 0));
});
