import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const app = require("../app.js");
const catalog = JSON.parse(await readFile(new URL("../data/catalog.json", import.meta.url), "utf8"));
const registry = app.normalizeCatalogRegistry(catalog.metadata);
const records = catalog.records.map((record, index) => app.prepareRecord(record, index, registry));

function stableIds(values) {
  return values.map(({ id }) => id).sort();
}

function addNumericTarget(queries, value) {
  if (value !== null && value !== undefined && /^\d+$/.test(String(value))) queries.add(String(value));
}

function numericQueries() {
  const queries = new Set();
  for (const record of records) {
    for (const value of [
      record.catalogId, record.catalogLabel, record.designation, record.catalogItem, record.catalogNumber,
      record.entryOrder, record.reportedNumber, record.specimenId, record.typeNumber, record.name,
      record.description, record.classification, typeof record.locality === "string" ? record.locality : null,
      record.locality?.code, record.locality?.name, record.locality?.areaReferenceCoordinate,
      record.individualFindLocation, record.year, record.dateOfDiscovery, record.eventDate, record.section,
      record.pane, record.reference, record.representedWeight?.valueText,
      ...(record.representedWeight?.componentTexts || []),
      record.weight?.grams, record.olivineFa, record.pyroxeneFs, record.weathering,
      record.metbull?.canonicalName, record.metbull?.meteoriteCode, record.metbull?.alternateNameNote,
      record.reportedTotalWeight?.grams, record.publicationState
    ]) addNumericTarget(queries, value);
    for (const holding of record.holdings || []) {
      for (const value of [
        holding.designation, holding.kind, holding.description, holding.provenance, holding.count,
        holding.weight?.grams, holding.reportedTotalWeight?.grams
      ]) addNumericTarget(queries, value);
      for (const weight of holding.weights || []) {
        addNumericTarget(queries, weight.grams);
        addNumericTarget(queries, weight.kind);
      }
      for (const representation of holding.representations || []) {
        addNumericTarget(queries, representation.kind);
        addNumericTarget(queries, representation.count);
      }
    }
    for (const amendment of record.amendments || []) {
      for (const value of [amendment.kind, amendment.effectiveDate, amendment.targetHolding, amendment.resultingState]) {
        addNumericTarget(queries, value);
      }
    }
    if (record.sourceEvidence) {
      addNumericTarget(queries, record.sourceEvidence.primary);
      for (const table of [record.sourceEvidence.tableA, record.sourceEvidence.tableB]) {
        if (!table) continue;
        for (const field of ["massGrams", "classification", "classificationContext", "weathering", "fracturing"]) {
          addNumericTarget(queries, table[field]);
        }
      }
      for (const conflict of record.sourceEvidence.conflicts) addNumericTarget(queries, conflict);
    }
    if (record.australianMuseumRepresentation) {
      addNumericTarget(queries, record.australianMuseumRepresentation.status);
      addNumericTarget(queries, record.australianMuseumRepresentation.representedOccurrences);
      addNumericTarget(queries, record.australianMuseumRepresentation.notRepresentedOccurrences);
    }
  }
  return [...queries].sort((left, right) => Number(left) - Number(right) || left.localeCompare(right));
}

function expectedNumericTokens(record) {
  const tokens = new Set();
  const add = (value) => addNumericTarget(tokens, value);
  const addTokens = (value) => {
    for (const token of app.searchable(value).split(/\s+/).filter(Boolean)) add(token);
  };
  for (const designation of app.recordDesignations(record)) {
    add(designation);
    add(app.searchable(designation).replace(/ /g, ""));
  }
  if (record.recordModel === "table-a-specimen") add(record.specimenId.slice(-5));
  for (const grams of app.recordSearchMasses(record)) add(grams);
  add(record.metbull?.meteoriteCode);
  addTokens(record.catalogNumber);
  addTokens(record.reportedNumber);
  addTokens(record.pane);
  addTokens(record.reference);
  addTokens(record.representedWeight?.valueText);
  for (const componentText of record.representedWeight?.componentTexts || []) addTokens(componentText);
  for (const value of [record.catalogItem, record.entryOrder, record.typeNumber]) add(value);
  addTokens([record.year, record.dateOfDiscovery, record.eventDate].filter(Boolean).join(" "));
  addTokens((record.holdings || []).flatMap((holding) => [
    holding.designation, holding.description, holding.provenance
  ]).filter(Boolean).join(" "));
  return tokens;
}

function structuredMasses(record) {
  return [
    record.weight?.grams,
    record.reportedTotalWeight?.grams,
    ...(record.holdings || []).flatMap((holding) => [
      holding.weight?.grams,
      holding.reportedTotalWeight?.grams,
      ...(holding.weights || []).map((weight) => weight.grams)
    ])
  ].filter(Number.isFinite);
}

function legacyParserWouldOmit(record, value) {
  const parsed = app.parseSearchQuery(value);
  if (!parsed.designations.length || app.isDesignationQuery(value)) return false;
  const recordSegments = record.designationSegmentsList || app.recordDesignations(record)
    .map(app.designationComponents).filter(Boolean);
  const designationMatches = parsed.designations.every((querySegments) => recordSegments.some((segments) =>
    querySegments.every((segment, index) => segments[index] === segment)
  ));
  if (designationMatches) return false;
  const haystackTerms = new Set(record.searchText.split(/\s+/));
  const query = app.searchable(value);
  return !(parsed.designations.length === 1 && parsed.textTerms.length === 0 &&
    query.split(/\s+/).every((term) => haystackTerms.has(term)));
}

test("every structured and Victoria Table B mass is searchable by grams and displayed text", () => {
  const structuredPairs = new Set();
  const searchablePairs = new Set();
  let structuredOccurrences = 0;
  let searchableOccurrences = 0;
  let tableBMasses = 0;
  for (const record of records) {
    for (const grams of structuredMasses(record)) {
      structuredOccurrences += 1;
      structuredPairs.add(`${record.id}\0${grams}`);
      assert.equal(app.matchesSearch(record, String(grams)), true, `${record.id}: ${grams}`);
      assert.equal(app.matchesSearch(record, app.formatMass(grams)), true, `${record.id}: ${app.formatMass(grams)}`);
    }
    for (const grams of app.recordSearchMasses(record)) {
      searchableOccurrences += 1;
      searchablePairs.add(`${record.id}\0${grams}`);
      assert.equal(app.matchesSearch(record, String(grams)), true, `${record.id}: ${grams}`);
      assert.equal(app.matchesSearch(record, app.formatMass(grams)), true, `${record.id}: ${app.formatMass(grams)}`);
    }
    if (Number.isFinite(record.sourceEvidence?.tableB?.massGrams)) tableBMasses += 1;
  }
  assert.equal(structuredOccurrences, 22703);
  assert.equal(structuredPairs.size, 19516);
  assert.equal(searchableOccurrences, 22974);
  assert.equal(searchablePairs.size, 19556);
  assert.equal(tableBMasses, 270);
});

test("every resolved MetBull code owner and displayed regional identifier is searchable", () => {
  const resolved = records.filter(({ metbull }) => metbull && metbull.matchType !== "unresolved");
  const regional = records.filter(({ recordModel }) => recordModel === "regional-census-fact");
  const numbered = regional.filter(({ reportedNumber }) => reportedNumber);
  assert.equal(resolved.length, 13400);
  assert.equal(regional.length, 84);
  assert.equal(numbered.length, 77);
  for (const record of resolved) assert.equal(app.matchesSearch(record, record.metbull.meteoriteCode), true, record.id);
  for (const record of regional) {
    const query = record.reportedNumber
      ? `Source number ${record.reportedNumber}`
      : `Regional census entry ${record.entryOrder}`;
    assert.equal(app.matchesSearch(record, query), true, `${record.id}: ${query}`);
  }
});

test("H-style classification and collateral prose no longer lose owners", () => {
  const classifications = records.filter((record) => record.classification && legacyParserWouldOmit(record, record.classification));
  const collateral = records.flatMap((record) => [
    record.metbull?.alternateNameNote,
    ...(record.holdings || []).map((holding) => holding.description)
  ].filter((value) => value && legacyParserWouldOmit(record, value)).map((value) => ({ record, value })));
  assert.equal(classifications.length, 511);
  assert.equal(collateral.length, 483);
  for (const record of classifications) assert.equal(app.matchesSearch(record, record.classification), true, record.id);
  for (const { record, value } of collateral) assert.equal(app.matchesSearch(record, value), true, record.id);
});

test("all real pure Huss designation result sets retain exact segment semantics", () => {
  const queries = [...new Set(records.flatMap(app.recordDesignations)
    .filter((designation) => app.designationComponents(designation)))].sort();
  assert.equal(queries.length, 1415);
  for (const query of queries) {
    const querySegments = app.designationComponents(query);
    const expected = stableIds(records.filter((record) => record.designationSegmentsList.some((segments) =>
      querySegments.every((segment, index) => segments[index] === segment)
    )));
    const actual = stableIds(records.filter((record) => app.matchesSearch(record, query)));
    assert.deepEqual(actual, expected, query);
  }
});

test("all numeric result sets equal the deterministic union oracle", () => {
  const queries = numericQueries();
  const expectedTokens = records.map(expectedNumericTokens);
  assert.equal(queries.length, 6182);
  for (const query of queries) {
    const expected = records.filter((record, index) => expectedTokens[index].has(query)).map(({ id }) => id).sort();
    const actual = stableIds(records.filter((record) => record.numericSearchTokens.has(query)));
    assert.deepEqual(actual, expected, query);
    const owner = records.find((record) => record.numericSearchTokens.has(query));
    if (owner) assert.equal(app.matchesSearch(owner, query), true, `${owner.id}: ${query}`);
  }
});

test("search exactness controls retain record IDs, Huss compounds, and Victoria suffix boundaries", () => {
  const huss = records.find(({ catalogId, designation }) => catalogId === "huss-1976" && designation === "H1.1");
  const huss2749 = records.find(({ designation }) => designation === "(2)H27.49");
  const water = records.find((record) => record.proseSearchText.includes("h2o") &&
    !record.designationSegmentsList.some((segments) => segments[0] === "2"));
  const victoria = records.find(({ specimenId }) => specimenId === "ALHA76009");
  const first = records[0];
  assert.equal(app.matchesSearch(first, `record id ${first.id}`), true);
  assert.equal(app.matchesSearch(first, `record id ${first.id.toUpperCase()}`), false);
  assert(huss);
  assert.equal(app.matchesSearch(huss, "H1"), true);
  assert.equal(app.matchesSearch(huss, "H10"), false);
  assert.equal(app.matchesSearch(huss, "H1 missing-prose"), false);
  assert.equal(app.matchesSearch(huss2749, "(2)H27.46"), false);
  assert.equal(app.matchesSearch(water, "H2"), false);
  assert.equal(app.matchesSearch(water, "H2O"), true);
  assert.equal(app.matchesSearch(victoria, "76009"), true);
  for (const query of ["7600", "076009", "x76009", "76009x", "EETA76009"]) {
    assert.equal(app.matchesSearch(victoria, query), false, query);
  }
});
