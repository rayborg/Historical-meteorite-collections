"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const app = require("../app.js");
const publicFixture = require("./test-multicatalog-fixture.json");

const runtimeSchemaVersion = Number(readFileSync(join(__dirname, "..", "app.js"), "utf8")
  .match(/metadata\.schemaVersion === ([0-9]+)/u)?.[1]);
const fixture = structuredClone(publicFixture);
fixture.metadata.schemaVersion = runtimeSchemaVersion;
fixture.metadata.factualFields = [...publicFixture.metadata.factualFields];
fixture.metadata.catalogs = fixture.metadata.catalogs.filter(({ id }) =>
  !["hodge-smith-1939", "victoria-land-1982"].includes(id));
fixture.records = fixture.records.filter(({ catalogId }) =>
  !["hodge-smith-1939", "victoria-land-1982"].includes(catalogId));
Object.assign(fixture.metadata, {
  recordCount: 15,
  recordsWithDesignation: 7,
  recordsWithWeight: 12,
  confidenceCounts: { high: 8, medium: 6, low: 1 },
});

const SPECIMEN_FIELDS = [
  "id", "catalogId", "designation", "name", "weight", "classification", "locality", "year", "catalogPage", "confidence"
];
const CATALOG_ITEM_FIELDS = [
  "id", "catalogId", "catalogItem", "holdings", "name", "classification", "locality", "year", "catalogPage", "confidence"
];
const CATALOG_NUMBER_FIELDS = [
  "id", "catalogId", "catalogNumber", "holdings", "name", "classification", "locality", "dateOfDiscovery", "catalogPages", "confidence"
];
const COLLECTION_ENTRY_FIELDS = [
  "id", "catalogId", "entryOrder", "reportedNumber", "catalogPages", "section", "holdings", "name", "classification", "locality",
  "eventDate", "confidence"
];
const REGIONAL_CENSUS_FACT_FIELDS = [
  "id", "catalogId", "entryOrder", "reportedNumber", "section", "name", "classification", "eventDate",
  "australianMuseumRepresentation", "catalogPages", "confidence",
];
const TABLE_A_SPECIMEN_FIELDS = [
  "id", "catalogId", "entryOrder", "specimenId", "weight", "classification", "olivineFa", "pyroxeneFs",
  "weathering", "locality", "catalogPage", "confidence",
];
const HOLDING_FIELDS = ["designation", "kind", "description", "count", "weight"];
const CATALOG_NUMBER_HOLDING_FIELDS = ["description", "provenance", "count", "weights"];
const CATALOG_FIELDS = [
  "id", "recordModel", "label", "compiler", "year", "sourcePages", "sourcePageCount", "recordCount",
  "recordsWithDesignation", "recordsWithWeight", "confidenceCounts", "folioDisplayPolicy", "rightsStatus"
];
const tests = [];

function test(name, callback) {
  tests.push({ name, callback });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function preparedRecords() {
  const registry = app.normalizeCatalogRegistry(fixture.metadata);
  return fixture.records.map((record, index) => app.prepareRecord(record, index, registry));
}

function recordsFor(catalogId) {
  return preparedRecords().filter((record) => record.catalogId === catalogId);
}

function ids(records) {
  return records.map((record) => record.id);
}

function recordById(catalog, recordId) {
  return catalog.records.find((record) => record.id === recordId);
}

function filters(overrides = {}) {
  return { query: "", catalog: null, min: null, max: null, lineageOnly: false, sort: "designation-asc", ...overrides };
}

function specimenSource({
  id,
  catalogId = "huss-1976",
  designation,
  name = "Test specimen",
  grams = 10,
  classification = "Stone",
  locality = "Test locality",
  year = "1900",
  catalogPage = catalogId === "huss-1986" ? 19 : 27,
  confidence = "high"
}) {
  return {
    id,
    catalogId,
    designation,
    name,
    weight: { grams },
    classification,
    locality,
    year,
    catalogPage,
    confidence
  };
}

function prepareSpecimens(sources) {
  const registry = app.normalizeCatalogRegistry(fixture.metadata);
  return sources.map((source, index) => app.prepareRecord(source, index, registry));
}

function folioRegistry() {
  return {
    "huss-1976": {
      id: "huss-1976",
      label: "Huss collection",
      year: 1976,
      sourcePages: [7, 27],
      folioDisplayPolicy: "blocked",
      rightsStatus: "undetermined"
    },
    "museum-1890": {
      id: "museum-1890",
      label: "Historical register",
      year: 1890,
      sourcePages: [7, 27],
      folioDisplayPolicy: "display",
      rightsStatus: "public-domain"
    },
    "university-1912": {
      id: "university-1912",
      label: "Historical register",
      year: 1912,
      sourcePages: [27, 30],
      folioDisplayPolicy: "display",
      rightsStatus: "no-copyright-us"
    }
  };
}

function page(pageId, catalogPage, pageLabel, image, alt) {
  return { pageId, catalogPage, pageLabel, image, alt };
}

function threeCatalogManifest() {
  return {
    schemaVersion: 2,
    catalogs: {
      "huss-1976": { displayPolicy: "blocked", rightsStatus: "undetermined", pages: [] },
      "museum-1890": {
        displayPolicy: "display",
        rightsStatus: "public-domain",
        pages: [
          page("leaf-27", 27, null, "assets/folios/museum-1890/leaf-27.webp", "Museum catalog page 27"),
          page("front-cover", null, "Front cover", "assets/folios/museum-1890/front-cover.webp", "Museum catalog front cover"),
          page("leaf-7", 7, null, "assets/folios/museum-1890/leaf-7.webp", "Museum catalog page 7")
        ]
      },
      "university-1912": {
        displayPolicy: "display",
        rightsStatus: "no-copyright-us",
        pages: [
          page("leaf-30", 30, "Leaf 30", "assets/folios/university-1912/leaf-30.webp", "University catalog page 30"),
          page("leaf-27", 27, null, "assets/folios/university-1912/leaf-27.webp", "University catalog page 27")
        ]
      }
    }
  };
}

test("runtime fixture projection validates with exact legacy model-aware shapes", () => {
  assert.equal(app.validateCatalog(fixture), fixture);
  assert.equal(fixture.metadata.schemaVersion, runtimeSchemaVersion);
  assert.deepEqual(fixture.metadata.catalogs.map(({ id, recordModel }) => [id, recordModel]), [
    ["huss-1976", "specimen"],
    ["huss-1986", "specimen"],
    ["nininger-1933", "catalog-item"],
    ["hovey-1896", "catalog-number"],
    ["museum-1914", "collection-entry"]
  ]);
  fixture.metadata.catalogs.forEach((descriptor) => {
    assert.deepEqual(Object.keys(descriptor).sort(), [...CATALOG_FIELDS].sort());
  });
  fixture.records.forEach((record) => {
    const descriptor = fixture.metadata.catalogs.find(({ id }) => id === record.catalogId);
    assert.deepEqual(
      Object.keys(record).sort(),
      [...(descriptor.recordModel === "specimen"
        ? SPECIMEN_FIELDS
        : descriptor.recordModel === "catalog-item"
          ? CATALOG_ITEM_FIELDS
          : descriptor.recordModel === "catalog-number" ? CATALOG_NUMBER_FIELDS : COLLECTION_ENTRY_FIELDS)].sort()
    );
    if (descriptor.recordModel === "specimen") assert.deepEqual(Object.keys(record.weight), ["grams"]);
    else if (descriptor.recordModel === "catalog-item") record.holdings.forEach((holding) => {
      assert.deepEqual(Object.keys(holding).sort(), [...HOLDING_FIELDS].sort());
      assert.deepEqual(Object.keys(holding.weight), ["grams"]);
    });
    else record.holdings.forEach((holding) => {
      assert.deepEqual(Object.keys(holding).sort(), [...CATALOG_NUMBER_HOLDING_FIELDS].sort());
      holding.weights.forEach((weight) => assert.deepEqual(Object.keys(weight), ["grams"]));
    });
  });
});

test("schema 8 public fixture carries both exact new data models", () => {
  assert.equal(publicFixture.metadata.schemaVersion, 8);
  assert.deepEqual(publicFixture.metadata.catalogs.slice(-2).map(({ id, recordModel }) => [id, recordModel]), [
    ["hodge-smith-1939", "regional-census-fact"],
    ["victoria-land-1982", "table-a-specimen"],
  ]);
  for (const record of publicFixture.records.filter(({ catalogId }) =>
    ["hodge-smith-1939", "victoria-land-1982"].includes(catalogId))) {
    const expected = record.catalogId === "hodge-smith-1939" ? REGIONAL_CENSUS_FACT_FIELDS : TABLE_A_SPECIMEN_FIELDS;
    assert.deepEqual(Object.keys(record).filter((key) => key !== "metbull").sort(), [...expected].sort());
  }
});

test("older and legacy metadata are intentionally rejected", () => {
  const schema5 = clone(fixture);
  schema5.metadata.schemaVersion = 5;
  assert.throws(() => app.validateCatalog(schema5), /facts-only schema/);

  const schema4 = clone(fixture);
  schema4.metadata.schemaVersion = 4;
  assert.throws(() => app.validateCatalog(schema4), /facts-only schema/);

  const schema3 = clone(fixture);
  schema3.metadata.schemaVersion = 3;
  assert.throws(() => app.validateCatalog(schema3), /facts-only schema/);

  const schema2 = clone(fixture);
  schema2.metadata.schemaVersion = 2;
  assert.throws(() => app.validateCatalog(schema2), /facts-only schema/);

  const legacy = clone(fixture);
  delete legacy.metadata.schemaVersion;
  assert.throws(() => app.validateCatalog(legacy), /facts-only schema/);
});

test("record shape must agree exactly with descriptor recordModel", () => {
  const specimenAsItem = clone(fixture);
  specimenAsItem.records.find(({ catalogId }) => catalogId === "huss-1976").catalogItem = 27;
  assert.throws(() => app.validateCatalog(specimenAsItem), /facts-only schema/);

  const itemAsSpecimen = clone(fixture);
  const item = itemAsSpecimen.records.find(({ catalogId }) => catalogId === "nininger-1933");
  delete item.holdings;
  item.designation = "N1";
  item.weight = { grams: 1 };
  assert.throws(() => app.validateCatalog(itemAsSpecimen), /facts-only schema/);

  const wrongDescriptor = clone(fixture);
  wrongDescriptor.metadata.catalogs.find(({ id }) => id === "nininger-1933").recordModel = "specimen";
  assert.throws(() => app.validateCatalog(wrongDescriptor), /facts-only schema/);
});

test("validates, prepares, and searches explicit reviewed MetBull harmonization", () => {
  const candidate = clone(fixture);
  const source = candidate.records.find(({ id }) => id === "huss-h27-3");
  source.metbull = {
    matchType: "historical-alias",
    canonicalName: "Current Alpha Name",
    meteoriteCode: "12345",
    metbullUrl: app.metbullUrlForCode("12345"),
    alternateNameNote: "The catalog uses a historical name."
  };
  assert.equal(app.validateCatalog(candidate), candidate);

  const registry = app.normalizeCatalogRegistry(candidate.metadata);
  const prepared = app.prepareRecord(source, 0, registry);
  assert.equal(prepared.name, source.name);
  assert.equal(prepared.metbull.canonicalName, "Current Alpha Name");
  assert.equal(app.metbullUrlForCode("12345"), "https://www.lpi.usra.edu/meteor/metbull.cfm?code=12345");
  assert.equal(app.matchesSearch(prepared, "Current Alpha"), true);
  assert.equal(app.matchesSearch(prepared, "Current Alp"), true);
  assert.equal(app.matchesSearch(prepared, "urrent Alpha"), false);
  assert.equal(app.matchesSearch(prepared, "historical name"), true);

  const caseCandidate = clone(fixture);
  const caseSource = caseCandidate.records.find(({ id }) => id === "huss-h27-3");
  caseSource.metbull = {
    matchType: "case-normalized-exact",
    canonicalName: caseSource.name.toLocaleUpperCase("en-US"),
    meteoriteCode: "12345",
    metbullUrl: app.metbullUrlForCode("12345"),
    alternateNameNote: null
  };
  assert.equal(app.validateCatalog(caseCandidate), caseCandidate);
});

test("rejects inferred, malformed, and identity-claiming unresolved MetBull mappings", () => {
  const valid = {
    matchType: "corrected-spelling",
    canonicalName: "Current Alpha Name",
    meteoriteCode: "12345",
    metbullUrl: app.metbullUrlForCode("12345"),
    alternateNameNote: null
  };
  for (const mutate of [
    (value) => { value.matchType = "fuzzy"; },
    (value) => { value.meteoriteCode = "012345"; },
    (value) => { value.metbullUrl = "https://example.test/12345"; },
    (value) => { value.matchType = "exact"; },
    (value) => { value.matchType = "unresolved"; },
  ]) {
    const candidate = clone(fixture);
    const record = candidate.records.find(({ id }) => id === "huss-h27-3");
    record.metbull = clone(valid);
    mutate(record.metbull);
    assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
  }
});

test("holding scalar constraints and exact keys are enforced", () => {
  const mutations = [
    (holding) => { holding.kind = "replica"; },
    (holding) => { holding.count = 0; },
    (holding) => { holding.count = 1.5; },
    (holding) => { holding.weight.grams = -1; },
    (holding) => { holding.weight.grams = Infinity; },
    (holding) => { holding.description = ""; },
    (holding) => { holding.extra = "public-looking"; }
  ];
  mutations.forEach((mutate) => {
    const candidate = clone(fixture);
    mutate(recordById(candidate, "nininger-item-1").holdings[0]);
    assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
  });

  const noHoldings = clone(fixture);
  recordById(noHoldings, "nininger-item-1").holdings = [];
  assert.throws(() => app.validateCatalog(noHoldings), /facts-only schema/);
});

for (const [name, recordId, mutate] of [
  ["specimen holding without designation", "nininger-item-1", (holding) => { holding.designation = null; }],
  ["specimen holding without weight", "nininger-item-1", (holding) => { holding.weight.grams = null; }],
  ["specimen holding with count", "nininger-item-1", (holding) => { holding.count = 1; }],
  ["cast holding without designation", "nininger-item-3", (holding) => { holding.designation = null; }],
  ["cast holding with count", "nininger-item-3", (holding) => { holding.count = 1; }],
  ["cast holding with weight", "nininger-item-3", (holding) => { holding.weight.grams = 1; }],
  ["aggregate holding without description", "nininger-item-4", (holding) => { holding.description = null; }],
  ["aggregate holding without count or weight", "nininger-item-4", (holding) => { holding.count = null; }]
]) {
  test(`runtime validation rejects ${name}`, () => {
    const candidate = clone(fixture);
    const holding = recordById(candidate, recordId).holdings[0];
    mutate(holding);
    assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
  });
}

test("catalog item numbers are positive integers", () => {
  for (const value of [null, 0, -1, 1.5, "1"]) {
    const candidate = clone(fixture);
    recordById(candidate, "nininger-item-1").catalogItem = value;
    assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
  }
});

test("catalog item numbers must be unique within a catalog", () => {
  const candidate = clone(fixture);
  recordById(candidate, "nininger-item-2").catalogItem = 1;
  assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
});

test("catalog item numbers must not decrease within a catalog", () => {
  const candidate = clone(fixture);
  recordById(candidate, "nininger-item-2").catalogItem = 100;
  recordById(candidate, "nininger-item-3").catalogItem = 50;
  assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
});

test("catalog item gaps and independent catalog numbering are valid", () => {
  assert.equal(app.validateCatalog(clone(fixture)).metadata.catalogs[2].recordsWithWeight, 4);
  const candidate = clone(fixture);
  candidate.metadata.catalogs.find(({ id }) => id === "huss-1986").recordModel = "catalog-item";
  const secondCollection = candidate.records.filter(({ catalogId }) => catalogId === "huss-1986");
  secondCollection.forEach((record, index) => {
    const holding = {
      designation: record.designation,
      kind: "specimen",
      description: null,
      count: null,
      weight: record.weight
    };
    delete record.designation;
    delete record.weight;
    record.catalogItem = index + 1;
    record.holdings = [holding];
  });
  const nininger = candidate.records.filter(({ catalogId }) => catalogId === "nininger-1933");
  candidate.records = [
    nininger[0], secondCollection[0], nininger[1], secondCollection[1], ...nininger.slice(2),
    ...candidate.records.filter(({ catalogId }) => catalogId === "huss-1976"),
    ...candidate.records.filter(({ catalogId }) => catalogId === "hovey-1896"),
    ...candidate.records.filter(({ catalogId }) => catalogId === "museum-1914")
  ];
  assert.equal(app.validateCatalog(candidate), candidate);
});

test("privacy rejects remain recursive through holding fields", () => {
  for (const [field, value] of [
    ["designation", "../private/holding"],
    ["description", "Raw OCR output from IMG_0031.TIFF"]
  ]) {
    const candidate = clone(fixture);
    recordById(candidate, "nininger-item-1").holdings[0][field] = value;
    assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
  }

  for (const field of ["notes", "sourceImage", "rawText", "scanPath"]) {
    const candidate = clone(fixture);
    recordById(candidate, "nininger-item-1").holdings[0][field] = "private/page-1.jpg";
    assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
  }
});

test("runtime rejects rooted, relative, UNC, and formula-continuation path probes", () => {
  for (const value of [
    "/private", "/Users", "/secret", "/tmp", "/etc", "/home", "/var", "/root", "/Volumes",
    "//server", "//Tii-vJatllO", "../private", "..\\private", "../l2O3)", "..\\l2O3)",
    "./private", ".\\private", "./l2O3)", "\\\\server", "\\\\server\\share", "\\private", "\\secret",
    "/Tii-vJatllO/private", "/Tii-vJatllO\\private", "/-I/private", "/-I\\private",
    "/Nickel iron/private", "/Nickel iron\\private", "/Nickel iron.private",
    "(.\\l2O3)/private", "(.\\l2O3)\\private", "(.\\l2O3).private",
    "\\i./private", "\\i.\\private", "\\N./private", "\\N.\\private",
    "\\N\\\\\\\\^m/private", "\\N\\\\\\\\^m\\private", "\\\\./private", "\\\\.\\private",
    "\\\\i.", "\\\\N.", "\\\\N\\\\\\\\^m",
    "/Tii-vJatllO,/private", "/Tii-vJatllO,\\private", "/-I,/private", "/-I,\\private",
    "/Nickel iron,/private", "/Nickel iron,\\private", "(.\\l2O3),/private", "(.\\l2O3),\\private"
  ]) {
    const candidate = clone(fixture);
    recordById(candidate, "nininger-item-1").holdings[0].description = value;
    assert.throws(() => app.validateCatalog(candidate), /facts-only schema/, value);
  }
});

test("runtime and build-time path logic share a locked factual formula allowlist", () => {
  assert.deepEqual(app.FACTUAL_FORMULA_TOKENS, [
    "/Tii-vJatllO", "/-I", "/Nickel iron", "/?e/ermces", "(.\\l2O3)", "\\ 1.753",
    "D?i\\\\hvQQ", "\\i.", "\\N.", "\\N\\\\\\\\^m", "\\\\.", "\\iin.",
  ]);
  assert.deepEqual(app.FACTUAL_FORMULA_UNSAFE_PREFIXES, ["C:", "file:", "https:", "ftp:", "scheme:"]);
  const root = join(__dirname, "..");
  const validator = readFileSync(join(root, "scripts", "validate-public-catalog.mjs"), "utf8");
  assert.match(validator, /FACTUAL_FORMULA_TOKENS,[\s\S]*containsUnsafePath,[\s\S]*require\("\.\.\/app\.js"\)/u);
  assert.doesNotMatch(validator, /const (?:FACTUAL_FORMULA_TOKENS|PATH_LIKE_STRING|STRICT_PATH_LIKE_STRING)/u);
});

test("every factual formula token rejects every generated path continuation", () => {
  for (const token of app.FACTUAL_FORMULA_TOKENS) {
    for (const suffix of app.FACTUAL_FORMULA_INVALID_SUFFIXES) {
      const candidate = clone(fixture);
      recordById(candidate, "nininger-item-1").holdings[0].description = `${token}${suffix}`;
      assert.throws(() => app.validateCatalog(candidate), /facts-only schema/, `${token}${suffix}`);
    }
  }
});

test("every slash or backslash formula token rejects every drive or scheme prefix", () => {
  for (const token of app.FACTUAL_FORMULA_TOKENS.filter((value) => /^[\\/]/u.test(value))) {
    for (const prefix of app.FACTUAL_FORMULA_UNSAFE_PREFIXES) {
      const candidate = clone(fixture);
      recordById(candidate, "nininger-item-1").holdings[0].description = `${prefix}${token}`;
      assert.throws(() => app.validateCatalog(candidate), /facts-only schema/, `${prefix}${token}`);
    }
  }
});

for (const value of [
  "OCR line 4",
  "Reviewer note: uncertain",
  "review note: uncertain",
  "12 grams",
  "12 g",
  "3 kg",
  "Known Wt. 15.2 Kgs.",
  "transcript.docx",
  "Page ID 0042",
  "page_0042",
  "private-source-0042.dat",
  "source/pages/0042.dat"
]) {
  test(`holding privacy rejects ${value}`, () => {
    const candidate = clone(fixture);
    recordById(candidate, "nininger-item-1").holdings[0].description = value;
    assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
  });
}

test("holding privacy permits factual designation and description boundaries", () => {
  const candidate = clone(fixture);
  recordById(candidate, "nininger-item-1").holdings[0].description = "found in 1932";
  recordById(candidate, "nininger-item-2").holdings[0].description = "M1 to M15";
  recordById(candidate, "nininger-item-1").holdings[0].designation = "134g";
  recordById(candidate, "nininger-item-2").holdings[1].designation = "128 s";
  recordById(candidate, "nininger-item-2").holdings[1].description = "a series of 15 individuals";
  assert.equal(app.validateCatalog(candidate), candidate);
  for (const formula of app.FACTUAL_FORMULA_TOKENS) {
    for (const suffix of app.FACTUAL_FORMULA_VALID_SUFFIXES) {
      const formulaCandidate = clone(fixture);
      recordById(formulaCandidate, "nininger-item-3").holdings[0].description = `${formula}${suffix}`;
      assert.equal(app.validateCatalog(formulaCandidate), formulaCandidate, `${formula}${suffix}`);
    }
  }
  const calciumFormula = clone(fixture);
  recordById(calciumFormula, "nininger-item-3").holdings[0].description = "Calcium \\ 1.753";
  assert.equal(app.validateCatalog(calciumFormula), calciumFormula);
  const escapedWeight = clone(fixture);
  recordById(escapedWeight, "nininger-item-3").holdings[0].description = "Weight \\\\ pounds";
  assert.equal(app.validateCatalog(escapedWeight), escapedWeight);
  for (const prose of ["Formula: /Tii-vJatllO", "Citation: \\N."]) {
    const colonBoundary = clone(fixture);
    recordById(colonBoundary, "nininger-item-3").holdings[0].description = prose;
    assert.equal(app.validateCatalog(colonBoundary), colonBoundary, prose);
  }
});

test("metadata summaries use holding designation and mass presence", () => {
  assert.equal(fixture.metadata.recordsWithDesignation, 7);
  assert.equal(fixture.metadata.recordsWithWeight, 12);
  assert.deepEqual(app.recordDesignations(recordById(fixture, "hovey-catalog-z9")), []);
  const candidate = clone(fixture);
  recordById(candidate, "nininger-item-4").holdings[0].designation = "N. 404";
  assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
});

test("Huss H27.3 and parenthesized second-collection forms remain scalar", () => {
  const records = preparedRecords();
  const h273 = records.find(({ id }) => id === "huss-h27-3");
  const second = records.find(({ id }) => id === "huss-second-h399-1");
  assert.equal(h273.recordModel, "specimen");
  assert.equal(h273.designation, "H27.3");
  assert.deepEqual(h273.weight, { grams: 10 });
  assert.equal(second.recordModel, "specimen");
  assert.equal(second.designation, "(2)H399.1");
  assert.deepEqual(second.weight, { grams: 5 });
  assert.deepEqual(app.designationComponents("H27.3"), ["27", "3"]);
  assert.deepEqual(app.designationComponents("(2)H399.1"), ["399", "1"]);
  assert.equal(app.matchesSearch(second, "H399"), true);
});

test("catalog item preparation preserves source-order holdings and exact values", () => {
  const item = recordsFor("nininger-1933").find(({ catalogItem }) => catalogItem === 2);
  assert.deepEqual(item.holdings.map(({ designation }) => designation), ["168a", "34jj"]);
  assert.deepEqual(item.holdings.map(({ weight }) => weight.grams), [12, 3]);
  assert.deepEqual(app.recordMasses(item), [12, 3]);
});

test("catalog-number preparation preserves opaque numbers, holding order, weights, and pages", () => {
  const records = recordsFor("hovey-1896");
  assert.deepEqual(records.map(({ catalogNumber }) => catalogNumber), ["Z-9", "1/2"]);
  assert.deepEqual(records[0].catalogPages, [149, 150]);
  assert.deepEqual(records[0].holdings[0], {
    description: "Fragments",
    provenance: "Museum collection",
    count: 22,
    weights: [{ grams: 212.6 }]
  });
  assert.deepEqual(app.recordMasses(records[1]), [24.7, 11.4]);
  assert.deepEqual(app.recordCatalogPages(records[0]), [149, 150]);
});

test("catalog numbers are unique opaque strings and need not increase", () => {
  assert.doesNotThrow(() => app.validateCatalog(clone(fixture)));
  assert.equal(recordById(fixture, "hovey-catalog-fraction-like").catalogNumber, "1/2");
  const duplicate = clone(fixture);
  recordById(duplicate, "hovey-catalog-fraction-like").catalogNumber = "Z-9";
  assert.throws(() => app.validateCatalog(duplicate), /facts-only schema/);
  for (const value of [null, "", 12]) {
    const candidate = clone(fixture);
    recordById(candidate, "hovey-catalog-z9").catalogNumber = value;
    assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
  }
});

test("catalog-number holding exact shape and scalar constraints are enforced", () => {
  const mutations = [
    (holding) => { holding.description = ""; },
    (holding) => { holding.provenance = ""; },
    (holding) => { holding.count = 0; },
    (holding) => { holding.count = 1.5; },
    (holding) => { holding.weights = []; },
    (holding) => { holding.weights[0].grams = -1; },
    (holding) => { holding.weights[0].grams = Infinity; },
    (holding) => { holding.weights[0].display = "212.6 g"; },
    (holding) => { holding.notes = "Public-looking"; }
  ];
  mutations.forEach((mutate) => {
    const candidate = clone(fixture);
    mutate(recordById(candidate, "hovey-catalog-z9").holdings[0]);
    assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
  });
  const noHoldings = clone(fixture);
  recordById(noHoldings, "hovey-catalog-z9").holdings = [];
  assert.throws(() => app.validateCatalog(noHoldings), /facts-only schema/);
});

test("catalog-number pages are nonempty, ordered, unique, and descriptor-scoped", () => {
  for (const pages of [[], [150, 149], [149, 149], [149, 151], [0], [149.5]]) {
    const candidate = clone(fixture);
    recordById(candidate, "hovey-catalog-z9").catalogPages = pages;
    assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
  }
});

test("catalog-number privacy rules cover descriptions and provenance", () => {
  const sourceWeightProse = clone(fixture);
  const sourceHolding = recordById(sourceWeightProse, "hovey-catalog-z9").holdings[0];
  sourceHolding.description = "Twenty-two individuals ranging from 1.5 g. to 26.2 g.";
  sourceHolding.provenance = "Purchased as a 12 g portion.";
  assert.equal(app.validateCatalog(sourceWeightProse), sourceWeightProse);

  for (const [field, value] of [
    ["description", "Raw OCR output"],
    ["description", "source/pages/149.dat"],
    ["provenance", "Reviewer note: uncertain"],
    ["provenance", "IMG_0149.TIFF"]
  ]) {
    const candidate = clone(fixture);
    recordById(candidate, "hovey-catalog-z9").holdings[0][field] = value;
    assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
  }
});

test("generic leakage validation rejects private labels and OCR batch identifiers", () => {
  for (const value of ["Notes", "batch-4"]) {
    const candidate = clone(fixture);
    recordById(candidate, "hovey-catalog-z9").locality = value;
    assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
  }
});

test("catalog-number search covers number, facts, descriptions, and provenance", () => {
  const records = recordsFor("hovey-1896");
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "catalog no. 1/2"))), ["hovey-catalog-fraction-like"]);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "Cross-page"))), ["hovey-catalog-z9"]);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "Synthetic locality"))), ["hovey-catalog-z9"]);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "1890"))), ["hovey-catalog-z9"]);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "Fragments"))), ["hovey-catalog-z9"]);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "Museum collection"))), ["hovey-catalog-z9"]);
});

test("catalog-number mass behavior flattens weights without multiplying counts", () => {
  const records = recordsFor("hovey-1896");
  assert.deepEqual(ids(app.filterRecords(records, filters({ min: 11, max: 12 }))), ["hovey-catalog-fraction-like"]);
  assert.deepEqual(ids(app.filterRecords(records, filters({ min: 200, max: 220 }))), ["hovey-catalog-z9"]);
  assert.deepEqual(ids(app.filterRecords(records, filters({ sort: "weight-asc" }))), [
    "hovey-catalog-fraction-like", "hovey-catalog-z9"
  ]);
  assert.deepEqual(ids(app.filterRecords(records, filters({ sort: "weight-desc" }))), [
    "hovey-catalog-z9", "hovey-catalog-fraction-like"
  ]);
  assert.equal(app.calculateStatistics(records).grams, 248.7);
});

test("catalog-number holding labels distinguish reported group counts", () => {
  const [holding] = recordsFor("hovey-1896")[0].holdings;
  assert.deepEqual(app.catalogNumberHoldingDetails(holding), [
    "Provenance: Museum collection", "Reported count: 22", "Masses: 212.6 g"
  ]);
  assert.deepEqual(app.catalogNumberHoldingDetails(recordsFor("hovey-1896")[1].holdings[0]), [
    "Reported count: 2", "Masses: 24.7 g, 11.4 g"
  ]);
});

test("collection-entry preparation preserves reported facts, pages, and numeric mass", () => {
  const records = recordsFor("museum-1914");
  assert.deepEqual(records.map(({ entryOrder }) => entryOrder), [1, 2, 3]);
  assert.deepEqual(records.map(({ reportedNumber }) => reportedNumber), ["No. 17", "No. 17", null]);
  assert.deepEqual(records.map(({ catalogPages }) => catalogPages), [[201], [202], [202, 203]]);
  assert.deepEqual(records[0].holdings[0].weights, []);
  assert.deepEqual(records[1].holdings[0].weights, [{ grams: 64.5 }]);
  assert.deepEqual(records[2].holdings[0].weights, [{ grams: 2.25 }]);
  assert.deepEqual(app.recordMasses(records[0]), []);
  assert.deepEqual(app.recordMasses(records[1]), [64.5]);
  assert.deepEqual(app.recordCatalogPages(records[2]), [202, 203]);
  assert.equal(records[2].section, "Unnumbered accessions");
  assert.equal(records[2].eventDate, "Found during reorganization");
  assert.equal(records[2].holdings[0].provenance, "Old museum collection");
});

test("collection-entry reported numbers are optional, opaque, and non-unique", () => {
  assert.doesNotThrow(() => app.validateCatalog(clone(fixture)));
  const records = recordsFor("museum-1914");
  assert.equal(records[0].reportedNumber, records[1].reportedNumber);
  assert.equal(records[2].reportedNumber, null);

  for (const value of ["", 17, [], {}]) {
    const candidate = clone(fixture);
    recordById(candidate, "museum-entry-duplicate-a").reportedNumber = value;
    assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
  }
});

test("collection entry orders must be unique within a catalog", () => {
  const candidate = clone(fixture);
  recordById(candidate, "museum-entry-duplicate-b").entryOrder = 1;
  assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
});

test("collection entry orders must not decrease within a catalog", () => {
  const candidate = clone(fixture);
  recordById(candidate, "museum-entry-duplicate-b").entryOrder = 100;
  recordById(candidate, "museum-entry-anonymous").entryOrder = 50;
  assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
});

test("collection-entry exact shape excludes historical mass text", () => {
  assert.equal("historicalMass" in recordById(fixture, "museum-entry-duplicate-a"), false);
  const historicalMass = clone(fixture);
  recordById(historicalMass, "museum-entry-duplicate-a").historicalMass = "about two ounces";
  assert.throws(() => app.validateCatalog(historicalMass), /facts-only schema/);

  const nestedDisplay = clone(fixture);
  recordById(nestedDisplay, "museum-entry-duplicate-b").holdings[0].weights[0].display = "64.5 g";
  assert.throws(() => app.validateCatalog(nestedDisplay), /facts-only schema/);
});

test("collection-entry scalar and page constraints are enforced", () => {
  const mutations = [
    (record) => { record.entryOrder = 0; },
    (record) => { record.entryOrder = 1.5; },
    (record) => { record.section = ""; },
    (record) => { record.eventDate = ""; },
    (record) => { record.holdings[0].description = ""; },
    (record) => { record.holdings[0].provenance = ""; },
    (record) => { record.holdings[0].count = 0; },
    (record) => { record.holdings[0].weights[0].grams = null; },
    (record) => { record.holdings[0].weights[0].grams = -1; },
    (record) => { record.holdings[0].weights[0].grams = Infinity; },
    (record) => { record.holdings[0].extra = "Public-looking"; },
    (record) => { record.holdings = []; },
    (record) => { record.catalogPages = []; },
    (record) => { record.catalogPages = [203, 202]; },
    (record) => { record.catalogPages = [202, 202]; },
    (record) => { record.catalogPages = [204]; }
  ];
  mutations.forEach((mutate) => {
    const candidate = clone(fixture);
    mutate(recordById(candidate, "museum-entry-anonymous"));
    assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
  });
});

test("collection-entry search covers reported number, section, event, and provenance", () => {
  const records = recordsFor("museum-1914");
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "reported no. No. 17"))), [
    "museum-entry-duplicate-a", "museum-entry-duplicate-b"
  ]);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "Mineralogical collection"))), ["museum-entry-duplicate-a"]);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "Received by exchange"))), ["museum-entry-duplicate-b"]);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "Old museum collection"))), ["museum-entry-anonymous"]);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "Unnumbered accessions"))), ["museum-entry-anonymous"]);
});

test("collection-entry sorting retains duplicate and anonymous source identities", () => {
  const records = [...recordsFor("museum-1914")].reverse();
  assert.deepEqual(ids(app.filterRecords(records, filters({ sort: "designation-asc" }))), [
    "museum-entry-anonymous", "museum-entry-duplicate-a", "museum-entry-duplicate-b"
  ]);
  assert.deepEqual(ids(app.filterRecords(records, filters({ sort: "weight-asc" }))), [
    "museum-entry-anonymous", "museum-entry-duplicate-b", "museum-entry-duplicate-a"
  ]);
});

test("search covers catalog items and rendered holding facts", () => {
  const records = recordsFor("nininger-1933");
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "record id nininger-item-2"))), ["nininger-item-2"]);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "record id missing-record"))), []);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "record id NININGER-ITEM-2"))), []);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "2"))), ["nininger-item-2"]);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "catalog item 2"))), ["nininger-item-2"]);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "34jj"))), ["nininger-item-2"]);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "paired fragments"))), ["nininger-item-2"]);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "unnumbered individual"))), ["nininger-item-6"]);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "cast"))), ["nininger-item-3"]);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "aggregate"))), [
    "nininger-item-2", "nininger-item-4", "nininger-item-5", "nininger-item-6"
  ]);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "count 4"))), ["nininger-item-4"]);
});

test("ordinary text search matches normalized token prefixes instead of token interiors", () => {
  const [allende, alais] = prepareSpecimens([
    specimenSource({
      id: "allende", designation: "H1", name: "Állende-Sur", locality: "Chihuahua, México"
    }),
    specimenSource({
      id: "alais", designation: "H2", name: "Alais", locality: "Von selbst zerfallenden Substanz"
    })
  ]);

  assert.equal(app.matchesSearch(allende, "Allende"), true);
  assert.equal(app.matchesSearch(allende, "Allen"), true);
  assert.equal(app.matchesSearch(allende, "ÁLLEN, CHIH."), true);
  assert.equal(app.matchesSearch(allende, "H1 allen"), true);
  assert.equal(app.matchesSearch(allende, "llende"), false);
  assert.equal(app.matchesSearch(allende, "H1 llende"), false);
  assert.equal(app.matchesSearch(alais, "Allende"), false);
  assert.equal(app.matchesSearch(alais, "zerfall"), true);
  assert.equal(app.matchesSearch(alais, "fallenden"), false);
});

test("numeric-leading holding codes match exactly after case and space normalization", () => {
  const records = recordsFor("nininger-1933");
  const specimen = prepareSpecimens([specimenSource({ id: "direct-26a", designation: "26a" })])[0];
  assert.equal(app.matchesSearch(specimen, "26a"), true);
  assert.equal(app.matchesSearch(specimen, "26b"), false);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "8a"))), [
    "nininger-item-1", "nininger-item-3"
  ]);
  assert(!ids(records.filter((record) => app.matchesSearch(record, "8a"))).includes("nininger-item-2"));
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "34jj"))), ["nininger-item-2"]);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "128aaa"))), ["nininger-item-3"]);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "10l"))), ["nininger-item-3"]);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "128s"))), ["nininger-item-3"]);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "128 s"))), ["nininger-item-3"]);
  assert.equal(app.numericLeadingHoldingCode("2a"), "2a");
  assert.equal(app.numericLeadingHoldingCode("34jj"), "34jj");
  assert.equal(app.numericLeadingHoldingCode("128aaa"), "128aaa");
  assert.equal(app.numericLeadingHoldingCode("10L"), "10l");
  assert.equal(app.numericLeadingHoldingCode("128 s"), "128s");
  assert.equal(app.numericLeadingHoldingCode("8-a"), null);
});

test("weight ranges match when any one holding mass satisfies the full interval", () => {
  const records = recordsFor("nininger-1933");
  assert.deepEqual(ids(app.filterRecords(records, filters({ min: 10, max: 15 }))), ["nininger-item-2"]);
  assert.deepEqual(ids(app.filterRecords(records, filters({ min: 2, max: 4 }))), ["nininger-item-2"]);
  assert.deepEqual(ids(app.filterRecords(records, filters({ min: 4, max: 7 }))), []);
  assert(!ids(app.filterRecords(records, filters({ min: 0, max: 200 }))).includes("nininger-item-4"));
});

test("weight sorting uses minimum holding mass ascending and maximum descending", () => {
  const records = recordsFor("nininger-1933");
  assert.deepEqual(ids(app.filterRecords(records, filters({ sort: "weight-asc" }))), [
    "nininger-item-6", "nininger-item-2", "nininger-item-5", "nininger-item-1", "nininger-item-3", "nininger-item-4"
  ]);
  assert.deepEqual(ids(app.filterRecords(records, filters({ sort: "weight-desc" }))), [
    "nininger-item-1", "nininger-item-5", "nininger-item-2", "nininger-item-6", "nininger-item-3", "nininger-item-4"
  ]);
});

test("designation sorting uses numeric Nininger catalog items", () => {
  const records = [...recordsFor("nininger-1933")].reverse();
  assert.deepEqual(ids(app.filterRecords(records, filters({ sort: "designation-asc" }))), [
    "nininger-item-1", "nininger-item-2", "nininger-item-3", "nininger-item-4", "nininger-item-5", "nininger-item-6"
  ]);
  assert.deepEqual(ids(app.filterRecords(records, filters({ sort: "designation-desc" }))), [
    "nininger-item-6", "nininger-item-5", "nininger-item-4", "nininger-item-3", "nininger-item-2", "nininger-item-1"
  ]);
});

test("statistics keep parent observations and sum every holding mass once", () => {
  const statistics = app.calculateStatistics(preparedRecords());
  assert.equal(statistics.observations, 15);
  assert.equal(statistics.specimens, 15);
  assert.equal(statistics.catalogs, 5);
  assert.equal(statistics.grams, 520.45);
  assert.equal(statistics.pages, 15);
});

test("statistics expose the responsive catalog-count tile", () => {
  const root = join(__dirname, "..");
  const html = readFileSync(join(root, "index.html"), "utf8");
  const styles = readFileSync(join(root, "styles.css"), "utf8");
  const script = readFileSync(join(root, "app.js"), "utf8");
  assert.match(html, /id="stat-catalogs"[^>]*>-[^<]*<\/strong><span>catalogs included<\/span>/);
  assert.match(styles, /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.statistics div:last-child\s*\{[^}]*grid-column:\s*1 \/ -1;/s);
  assert.match(script, /elements\.stats\.catalogs\.textContent = integerFormat\.format\(statistics\.catalogs\)/);
});

test("holding labels are concise for count, cast, and aggregate rows", () => {
  const items = recordsFor("nininger-1933");
  assert.deepEqual(app.holdingDetails(items[1].holdings[1]), ["Paired fragments", "Count: 2", "Aggregate"]);
  assert.deepEqual(app.holdingDetails(items[2].holdings[0]), ["Plaster replica", "Cast"]);
  assert.deepEqual(app.holdingDetails(items[3].holdings[0]), ["Small fragments", "Count: 4", "Aggregate"]);
  assert.deepEqual(app.holdingDetails(items[4].holdings[0]), ["Combined material", "Aggregate"]);
});

test("catalog selector and summaries retain descriptor model identity", () => {
  const registry = app.normalizeCatalogRegistry(fixture.metadata);
  assert.deepEqual(app.catalogSelectorEntries(registry).map(([id]) => id), [
    "hovey-1896", "museum-1914", "nininger-1933", "huss-1976", "huss-1986"
  ]);
  assert.equal(registry["nininger-1933"].recordModel, "catalog-item");
  assert.equal(registry["hovey-1896"].recordModel, "catalog-number");
  assert.equal(registry["museum-1914"].recordModel, "collection-entry");
  assert.deepEqual(app.catalogSummaryEntries(registry).map(({ observationCount }) => observationCount), [2, 3, 6, 2, 2]);
});

test("catalog dropdown labels are concise and leave summary titles unchanged", () => {
  const descriptors = [
    { id: "lucas-1813", year: 1813, label: "Tableau méthodique des espèces minérales, seconde partie (1813)" },
    { id: "chladni-1819", year: 1819, label: "Ueber Feuer-Meteore (1819)" },
    { id: "chladni-1825", year: 1825, label: "Beschreibung seiner Sammlung (1825)" },
    { id: "haidinger-1859", year: 1859, label: "Die Meteoriten des k. k. Hof-Mineralien-Cabinetes (1859)" },
    { id: "buchner-1863", year: 1863, label: "Die Meteoriten in Sammlungen (1863)" },
    { id: "nordenskiold-1870", year: 1870, label: "Förteckning på meteoriter (1870)" },
    { id: "ball-1882", year: 1882, label: "Catalogue of the Examples of Meteoric Falls (1882)" },
    { id: "usnm-1886", year: 1886, label: "The Meteorite Collection in the U. S. National Museum (1886)" },
    { id: "hovey-1896", year: 1896, label: "Catalogue of meteorites in the AMNH (1896)" },
    { id: "washington-1897", year: 1897, label: "Catalogue of the Collection of Meteorites in the Peabody Museum (1897)" },
    { id: "hogbom-1902", year: 1902, label: "Verzeichniss über die Meteoriten des Mineralogischen Instituts (1902)" },
    { id: "farrington-1903", year: 1903, label: "Catalogue of the Meteorite Collection of the Field Columbian Museum, May 1, 1903 (1903)" },
    { id: "merrill-1916", year: 1916, label: "Handbook and Descriptive Catalogue of the Meteorite Collections in the United States National Museum (1916)" },
    { id: "prior-1923", year: 1923, label: "Catalogue of Meteorites: global survey with British Museum representation status (1923)" },
    { id: "madrid-1923", year: 1923, label: "Los Meteoritos del Museo de Madrid (1923)" },
    { id: "palache-1926", year: 1926, label: "Catalogue of the Collection of Meteorites in the Mineralogical Museum of Harvard University (1926)" },
    { id: "nininger-1933", year: 1933, label: "The Nininger Collection (1933)" },
    { id: "reeds-1937", year: 1937, label: "Catalogue of the Meteorites in the American Museum of Natural History as of October 1, 1935 (1937)" },
    { id: "barnes-1940", year: 1940, label: "Catalogue of Texas Meteorites and Their Known Specimen Holdings: University of Texas Bureau of Economic Geology (1940)" },
    { id: "nininger-1950", year: 1950, label: "The Nininger Collection (1950)" },
    { id: "huss-1976", year: 1976, label: "Huss Meteorite Collection catalog (1976)" },
    { id: "huss-1986", year: 1986, label: "The Second Huss Collection of Meteorites (1986)" },
    { id: "kanagawa-1996", year: 1996, label: "Meteorite Catalogue of the Kanagawa Prefectural Museum of Natural History (1996)" },
    { id: "asu-2024-09", year: 2024, label: "Arizona State University Meteorite Collection Catalog (2024)" }
  ];
  const labels = descriptors.map((descriptor) => app.catalogDropdownLabel(descriptor, descriptor.id));
  assert.deepEqual(labels, [
    "Lucas (1813)", "Chladni (1819)", "Chladni (1825)", "Haidinger (1859)", "Buchner (1863)",
    "Nordenskiöld (1870)", "Ball (1882)", "USNM (1886)", "Hovey (1896)", "Washington (1897)",
    "Högbom (1902)", "Farrington (1903)", "Merrill (1916)", "Prior (1923)", "Madrid (1923)", "Palache (1926)",
    "Nininger (1933)", "Reeds (1937)",
    "Barnes (1940)", "Nininger (1950)", "Huss (1976)", "Huss (1986)", "Kanagawa (1996)", "ASU (2024)"
  ]);
  assert.equal(new Set(labels).size, descriptors.length);
  assert.deepEqual(app.catalogSummaryEntries(descriptors).map(({ label }) => label), descriptors.map(({ label }) => label));
  assert.equal(app.catalogDropdownLabel({ year: 2001 }, "natural-history-2001"), "Natural History (2001)");
  assert.equal(app.catalogDropdownLabel({ label: "Future catalog" }), "Future catalog");
});

test("URL filters strictly round-trip lineage state and cache version remains stable", () => {
  const registry = app.normalizeCatalogRegistry(fixture.metadata);
  const html = readFileSync(join(__dirname, "..", "index.html"), "utf8");
  const parsed = app.parseUrlFilters("?q=catalog+item+2&catalog=nininger-1933&min=3&max=12&lineage=1&sort=weight-desc", registry);
  assert.deepEqual(parsed, {
    query: "catalog item 2", catalog: "nininger-1933", min: "3", max: "12", lineageOnly: true, sort: "weight-desc"
  });
  assert.equal(app.serializeUrlFilters(parsed).toString(), "q=catalog+item+2&catalog=nininger-1933&min=3&max=12&lineage=1&sort=weight-desc");
  for (const search of ["", "?lineage=0", "?lineage=true", "?lineage=1&lineage=1", "?lineage=1&lineage=0"]) {
    assert.equal(app.parseUrlFilters(search, registry).lineageOnly, false, search);
  }
  assert.equal(app.CACHE_VERSION, "20260831-harmonized-cards-3");
  assert.equal(app.ASSET_CACHE_VERSION, "20260831-harmonized-cards-3");
  assert.match(html, new RegExp(`styles\\.css\\?v=${app.ASSET_CACHE_VERSION}`));
  assert.match(html, new RegExp(`app\\.js\\?v=${app.ASSET_CACHE_VERSION}`));
});

test("lineage-only filtering fails closed and composes with every record filter", () => {
  const records = preparedRecords();
  const target = records.find(({ catalogId, name }) => catalogId === "nininger-1933" && name);
  const lineageIndex = new Map([[target.id, [{ relationship: "possible-match" }]]]);
  const composed = filters({
    query: target.name,
    catalog: target.catalogId,
    min: 0,
    max: 1_000_000,
    lineageOnly: true,
    sort: "name-desc"
  });
  assert.deepEqual(ids(app.filterRecords(records, composed)), []);
  assert.deepEqual(ids(app.filterRecords(records, composed, new Map([[target.id, []]]))), []);
  assert.deepEqual(ids(app.filterRecords(records, composed, lineageIndex)), [target.id]);
});

test("runtime rejects deterministic specimen order violations", () => {
  const candidate = clone(fixture);
  const first = candidate.records.findIndex(({ id }) => id === "huss-second-h399-1");
  const second = candidate.records.findIndex(({ id }) => id === "huss-second-h400");
  [candidate.records[first], candidate.records[second]] = [candidate.records[second], candidate.records[first]];
  assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
});

test("folio policy validation still fails closed", () => {
  const registry = app.normalizeCatalogRegistry(fixture.metadata);
  const blockedManifest = {
    schemaVersion: 2,
    catalogs: Object.fromEntries(Object.keys(registry).map((id) => [id, {
      displayPolicy: "blocked", rightsStatus: "undetermined", pages: []
    }]))
  };
  assert.equal(app.validateFolioManifest(blockedManifest, registry), true);
  assert.equal(app.getAuthorizedFolio(blockedManifest, "nininger-1933", 1, registry), null);
  assert.equal(app.getAuthorizedFolio(blockedManifest, "hovey-1896", 149, registry), null);

  const unsafe = clone(blockedManifest);
  unsafe.catalogs["nininger-1933"].displayPolicy = "display";
  unsafe.catalogs["nininger-1933"].pages.push(
    page("leaf-1", 1, null, "../private/page.jpg", "Page 1")
  );
  assert.equal(app.validateFolioManifest(unsafe, registry), false);
});

test("HTML and runtime expose the accessible harmonized card contract", () => {
  const root = join(__dirname, "..");
  const html = readFileSync(join(root, "index.html"), "utf8");
  const script = readFileSync(join(root, "app.js"), "utf8");
  assert.match(html, /<p class="record-semantic-label"><\/p>/);
  assert.match(html, /<dl class="record-meta" aria-label="Catalog record details"><\/dl>/);
  assert.match(html, /Source catalog name/);
  assert.match(html, /An open-source project started by Raymond Borges Hink in July 2026\./);
  assert.match(html, /Designation \/ source identifier, ascending/);
  assert.doesNotMatch(html, /record-holdings|metbull-name|lineage-row|earlier-records/);
  const record = preparedRecords().find(({ id }) => id === "huss-h27-3");
  const dto = app.presentHarmonizedCard(record);
  assert.equal(dto.kind, "direct-specimen");
  assert.deepEqual(dto.facts.map(({ label }) => label), [
    "Current Meteoritical Bulletin name", "Class", "Specimen form", "Source locality",
    "Individual find location", "Event", "Lineage", "Specimen weight"
  ]);
  assert.equal(dto.facts.find(({ label }) => label === "Individual find location").value, "Unknown");
  assert.match(script, /dto\.facts\.forEach\(\(\{ label, value \}\) => appendMetaRow\(meta, label, value\)\)/);
});

test("default cross-catalog order is alphabetical by source name", () => {
  const records = prepareSpecimens([
    specimenSource({ id: "punctuated-designation", designation: "(2)H9.83", name: "Dimitt (a)" }),
    specimenSource({ id: "alphabetical-name", designation: "H1", name: "Aachener Masse" })
  ]);
  assert.equal(app.DEFAULT_SORT, "name-asc");
  assert.deepEqual(ids(app.filterRecords(records, filters({ sort: app.DEFAULT_SORT }))), [
    "alphabetical-name", "punctuated-designation"
  ]);
});

test("result grid layout isolates card heights and widens exactly one result", () => {
  const root = join(__dirname, "..");
  const styles = readFileSync(join(root, "styles.css"), "utf8");
  const script = readFileSync(join(root, "app.js"), "utf8");
  assert.equal(app.isSingleResultCount(1), true);
  assert.equal(app.isSingleResultCount(0), false);
  assert.equal(app.isSingleResultCount(2), false);
  assert.match(styles, /\.catalog-grid\s*\{[^}]*align-items:\s*start;/s);
  assert.match(styles, /\.catalog-grid\.single-result\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s);
  assert.match(styles, /\.catalog-grid\.single-result \.record-card\s*\{[^}]*width:\s*min\(100%, 52rem\);/s);
  assert.match(script, /classList\.toggle\("single-result", isSingleResultCount\(matches\.length\)\)/);
  assert.match(script, /classList\.remove\("single-result"\)/);
});

test("canonical global and per-catalog counts match the synthetic records", () => {
  const totals = { recordCount: 0, recordsWithDesignation: 0, recordsWithWeight: 0, confidenceCounts: { high: 0, medium: 0, low: 0 } };
  fixture.metadata.catalogs.forEach((descriptor) => {
    const records = fixture.records.filter((record) => record.catalogId === descriptor.id);
    const confidenceCounts = { high: 0, medium: 0, low: 0 };
    records.forEach((record) => { confidenceCounts[record.confidence] += 1; });
    assert.equal(descriptor.recordCount, records.length);
    assert.equal(descriptor.recordsWithDesignation, records.filter((record) => app.recordDesignations(record).length).length);
    assert.equal(descriptor.recordsWithWeight, records.filter((record) => app.recordMasses(record).length).length);
    assert.deepEqual(descriptor.confidenceCounts, confidenceCounts);
    totals.recordCount += records.length;
    totals.recordsWithDesignation += descriptor.recordsWithDesignation;
    totals.recordsWithWeight += descriptor.recordsWithWeight;
    Object.keys(confidenceCounts).forEach((level) => { totals.confidenceCounts[level] += confidenceCounts[level]; });
  });
  assert.equal(fixture.metadata.recordCount, totals.recordCount);
  assert.equal(fixture.metadata.recordsWithDesignation, totals.recordsWithDesignation);
  assert.equal(fixture.metadata.recordsWithWeight, totals.recordsWithWeight);
  assert.deepEqual(fixture.metadata.confidenceCounts, totals.confidenceCounts);
});

test("canonical order preserves existing models before collection entries", () => {
  assert.deepEqual(ids(fixture.records), [
    "nininger-item-1", "nininger-item-2", "nininger-item-3", "nininger-item-4", "nininger-item-5",
    "nininger-item-6", "huss-second-h399-1", "huss-second-h400", "huss-h27-3", "huss-h42",
    "hovey-catalog-z9", "hovey-catalog-fraction-like", "museum-entry-duplicate-a",
    "museum-entry-duplicate-b", "museum-entry-anonymous"
  ]);
  const parenthesized = preparedRecords().find(({ id }) => id === "huss-second-h399-1");
  assert.equal(app.matchesSearch(parenthesized, "H399"), true);
  assert.equal(app.matchesSearch(parenthesized, "(2)H399.1"), true);
});

test("runtime rejects collection entries placed before existing record models", () => {
  const candidate = clone(fixture);
  const collectionIndex = candidate.records.findIndex(({ id }) => id === "museum-entry-duplicate-a");
  const catalogNumberIndex = candidate.records.findIndex(({ id }) => id === "hovey-catalog-fraction-like");
  [candidate.records[collectionIndex], candidate.records[catalogNumberIndex]] =
    [candidate.records[catalogNumberIndex], candidate.records[collectionIndex]];
  assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
});

test("public catalog validation rejects private and unexpected specimen fields", () => {
  for (const field of ["notes", "rawText", "sourceImage", "imagePath", "scanPath"]) {
    const candidate = clone(fixture);
    candidate.records.find((record) => record.catalogId === "huss-1976")[field] = "private/source-page-27.jpg";
    assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
  }
  const nested = clone(fixture);
  nested.records.find((record) => record.catalogId === "huss-1976").weight.display = "10 g";
  assert.throws(() => app.validateCatalog(nested), /facts-only schema/);
});

test("catalog validation rejects metadata leakage keys and values", () => {
  const candidates = [];
  const rootLeak = clone(fixture);
  rootLeak.metadata.sourceFilename = "private-page-27.dat";
  candidates.push(rootLeak);
  const descriptorLeak = clone(fixture);
  descriptorLeak.metadata.catalogs[0].notes = "Private transcription notes";
  candidates.push(descriptorLeak);
  for (const value of ["Raw OCR output for line 27", "Source filename IMG_0027", "../private/page-27", "page-27.TIFF"]) {
    const valueLeak = clone(fixture);
    valueLeak.metadata.catalogs[0].label = value;
    candidates.push(valueLeak);
  }
  candidates.forEach((candidate) => assert.throws(() => app.validateCatalog(candidate), /facts-only schema/));
});

test("catalog validation rejects incorrect global and per-catalog metadata counts", () => {
  const globalMismatch = clone(fixture);
  globalMismatch.metadata.recordCount += 1;
  assert.throws(() => app.validateCatalog(globalMismatch), /facts-only schema/);
  const catalogMismatch = clone(fixture);
  catalogMismatch.metadata.catalogs[2].recordsWithWeight -= 1;
  assert.throws(() => app.validateCatalog(catalogMismatch), /facts-only schema/);
});

test("runtime validation rejects invalid and empty catalog IDs", () => {
  for (const catalogId of ["", "Uppercase-id", "invalid_id", "a".repeat(81)]) {
    const candidate = clone(fixture);
    candidate.metadata.catalogs[0].id = catalogId;
    candidate.records.filter((record) => record.catalogId === "huss-1976").forEach((record) => { record.catalogId = catalogId; });
    assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
  }
});

test("runtime validation rejects non-string record catalog IDs", () => {
  const candidate = clone(fixture);
  recordById(candidate, "huss-h27-3").catalogId = ["huss-1976"];
  assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
});

test("runtime validation rejects overlong and control-containing public text", () => {
  const candidates = [];
  const label = clone(fixture);
  label.metadata.catalogs[0].label = "x".repeat(161);
  candidates.push(label);
  const compiler = clone(fixture);
  compiler.metadata.catalogs[0].compiler = "x".repeat(161);
  candidates.push(compiler);
  const metadataControl = clone(fixture);
  metadataControl.metadata.catalogs[0].label = "Huss\u0000collection";
  candidates.push(metadataControl);
  const recordControl = clone(fixture);
  recordById(recordControl, "huss-h27-3").name = "Non-H\u0000alpha";
  candidates.push(recordControl);
  candidates.forEach((candidate) => assert.throws(() => app.validateCatalog(candidate), /facts-only schema/));
});

test("runtime validation rejects empty record IDs", () => {
  const candidate = clone(fixture);
  recordById(candidate, "nininger-item-1").id = "";
  assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
});

test("runtime validation rejects specimen records without a substantive public fact", () => {
  const candidate = clone(fixture);
  Object.assign(recordById(candidate, "huss-h27-3"), {
    designation: null, name: null, weight: { grams: null }, classification: null, locality: null, year: null
  });
  assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
});

test("duplicate labels retain distinct disambiguation inputs and catalog IDs", () => {
  const metadata = clone(fixture.metadata);
  metadata.catalogs[0].label = "Historical register";
  metadata.catalogs[1].label = "Historical register";
  const registry = app.normalizeCatalogRegistry(metadata);
  assert.equal(registry["huss-1976"].displayLabel, "Historical register (1976; huss-1976)");
  assert.equal(registry["huss-1986"].displayLabel, "Historical register (1986; huss-1986)");
  assert.notEqual(registry["huss-1976"].displayLabel, registry["huss-1986"].displayLabel);
});

test("catalog selector and summary order public sources chronologically without changing source data", () => {
  const registry = app.normalizeCatalogRegistry(fixture.metadata);
  const sourceOrder = fixture.metadata.catalogs.map(({ id }) => id);
  assert.deepEqual(app.catalogSelectorEntries(registry).map(([id]) => id), [
    "hovey-1896", "museum-1914", "nininger-1933", "huss-1976", "huss-1986"
  ]);
  assert.deepEqual(fixture.metadata.catalogs.map(({ id }) => id), sourceOrder);
  assert.deepEqual(app.catalogSummaryEntries(registry).map(({ id }) => id), [
    "hovey-1896", "museum-1914", "nininger-1933", "huss-1976", "huss-1986"
  ]);
});

test("catalog selector breaks publication-year ties by display label then catalog ID", () => {
  const registry = {
    "zeta-2000": { year: 2000, displayLabel: "Alpha" },
    "beta-2000": { year: 2000, displayLabel: "Beta" },
    "alpha-2000": { year: 2000, displayLabel: "Alpha" },
    "early-1999": { year: 1999, displayLabel: "Zulu" }
  };
  assert.deepEqual(app.catalogSelectorEntries(registry).map(([id]) => id), [
    "early-1999", "alpha-2000", "zeta-2000", "beta-2000"
  ]);
  assert.deepEqual(Object.keys(registry), ["zeta-2000", "beta-2000", "alpha-2000", "early-1999"]);
});

test("record preparation preserves catalog identity and page identity", () => {
  const records = prepareSpecimens([
    specimenSource({ id: "first-page-27", catalogId: "huss-1976", designation: "H27", catalogPage: 27 }),
    specimenSource({ id: "second-page-27", catalogId: "huss-1986", designation: "(2)H27", catalogPage: 27 })
  ]);
  assert.deepEqual(records.map(({ id, catalogId, catalogPage }) => [id, catalogId, catalogPage]), [
    ["first-page-27", "huss-1976", 27], ["second-page-27", "huss-1986", 27]
  ]);
  assert.notEqual(records[0].catalogLabel, records[1].catalogLabel);
});

test("H27 parsing and normalization use exact numeric segments", () => {
  assert.deepEqual(app.designationComponents("H27"), ["27"]);
  assert.deepEqual(app.designationComponents("h27.020"), ["27", "020"]);
  assert.deepEqual(app.designationComponents("(2)H399.1"), ["399", "1"]);
  assert.equal(app.normalizeDesignation(" H27 / 020 "), "h27.020");
  assert.equal(app.normalizeDesignation("(2)H399.1"), "h399.1");
  assert.equal(app.isDesignationQuery("H27"), true);
  assert.equal(app.isDesignationQuery("H270"), true);
});

test("parenthesized Huss designations retain exact segment search", () => {
  const [record] = prepareSpecimens([specimenSource({
    id: "parenthesized", catalogId: "huss-1986", designation: "(2)H399.1", name: "Canyon Diablo"
  })]);
  assert.equal(app.matchesSearch(record, "H399"), true);
  assert.equal(app.matchesSearch(record, "(2)H399.1"), true);
  assert.equal(app.matchesSearch(record, "H399 canyon"), true);
  assert.equal(app.matchesSearch(record, "H39"), false);
});

test("bare numeric queries match exact designations or year tokens", () => {
  const records = prepareSpecimens([
    specimenSource({ id: "one", designation: "1", year: "1928" }),
    specimenSource({ id: "ten", designation: "10", year: "1932" })
  ]);
  assert.equal(app.matchesSearch(records[0], "1"), true);
  assert.equal(app.matchesSearch(records[1], "1"), false);
  assert.equal(app.matchesSearch(records[1], "1932"), true);
});

test("H27 search matches segment descendants but not numeric lookalikes", () => {
  const records = prepareSpecimens([
    specimenSource({ id: "h27", designation: "H27" }),
    specimenSource({ id: "h27-1", designation: "H27.1" }),
    specimenSource({ id: "h270", designation: "H270" }),
    specimenSource({ id: "h2-7", designation: "H2.7" })
  ]);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "H27"))), ["h27", "h27-1"]);
  assert.equal(app.matchesSearch(records[0], "H27.1"), false);
});

test("compound H27 search enforces designation segments and remaining terms", () => {
  const records = prepareSpecimens([
    specimenSource({ id: "h27-stone", designation: "H27", name: "Example stone" }),
    specimenSource({ id: "h270-stone", designation: "H270", name: "Example stone" })
  ]);
  assert.deepEqual(ids(app.filterRecords(records, filters({ query: "H27 stone" }))), ["h27-stone"]);
});

test("non-H designations use normalized factual text search", () => {
  const records = prepareSpecimens([
    specimenSource({ id: "a12", designation: "A12" }),
    specimenSource({ id: "m7", designation: "M7" })
  ]);
  assert.equal(app.isDesignationQuery("A12"), false);
  assert.equal(app.normalizeDesignation("A12"), "a12");
  assert.deepEqual(app.genericDesignation("A12"), { prefix: "a", segments: ["12"] });
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "A12"))), ["a12"]);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "m 7"))), ["m7"]);
});

test("class-like queries match factual text as well as designations", () => {
  const records = prepareSpecimens([
    specimenSource({ id: "class-l6", designation: "X1", classification: "Chondrite L6" }),
    specimenSource({ id: "designation-h5", designation: "H5.1", classification: "Iron" }),
    specimenSource({ id: "class-h5", designation: "X2", classification: "Chondrite H5" })
  ]);
  assert.equal(app.matchesSearch(records[0], "L6"), true);
  assert.equal(app.matchesSearch(records[1], "H5"), true);
  assert.equal(app.matchesSearch(records[2], "H5"), true);
});

test("catalog filtering selects one catalog without leaking same-page records", () => {
  const records = prepareSpecimens([
    specimenSource({ id: "first-h27", catalogId: "huss-1976", designation: "H27", catalogPage: 27 }),
    specimenSource({ id: "second-h27", catalogId: "huss-1986", designation: "(2)H27", catalogPage: 27 })
  ]);
  assert.deepEqual(ids(app.filterRecords(records, filters({ query: "H27", catalog: "huss-1976" }))), ["first-h27"]);
});

test("an empty catalog filter retains matching records from every catalog", () => {
  const records = prepareSpecimens([
    specimenSource({ id: "first-h27", catalogId: "huss-1976", designation: "H27" }),
    specimenSource({ id: "second-h27", catalogId: "huss-1986", designation: "(2)H27" })
  ]);
  assert.deepEqual(new Set(app.filterRecords(records, filters({ query: "H27" })).map(({ catalogId }) => catalogId)),
    new Set(["huss-1976", "huss-1986"]));
});

test("URL filters discard unknown catalogs and malformed values", () => {
  const registry = app.normalizeCatalogRegistry(fixture.metadata);
  assert.deepEqual(app.parseUrlFilters("?catalog=missing&min=-1&max=NaN&sort=unknown", registry),
    { query: "", catalog: "", min: "", max: "", lineageOnly: false, sort: app.DEFAULT_SORT });
  assert.equal(app.serializeUrlFilters({ query: "", catalog: "", min: "-1", max: "Infinity", sort: "unknown" }).toString(), "");
});

test("URL filters discard crossed minimum and maximum ranges", () => {
  const registry = app.normalizeCatalogRegistry(fixture.metadata);
  assert.deepEqual(app.parseUrlFilters("?q=H27&catalog=huss-1976&min=50&max=10&sort=name-asc", registry),
    { query: "H27", catalog: "huss-1976", min: "", max: "", lineageOnly: false, sort: "name-asc" });
  assert.equal(app.serializeUrlFilters({
    query: "H27", catalog: "huss-1976", min: "50", max: "10", sort: "name-asc"
  }).toString(), "q=H27&catalog=huss-1976");
});

test("URL catalog IDs disambiguate catalogs that share a display label", () => {
  const metadata = clone(fixture.metadata);
  metadata.catalogs[0].label = "Shared label";
  metadata.catalogs[1].label = "Shared label";
  const registry = app.normalizeCatalogRegistry(metadata);
  assert.equal(app.parseUrlFilters("?catalog=huss-1976", registry).catalog, "huss-1976");
  assert.equal(app.parseUrlFilters("?catalog=huss-1986", registry).catalog, "huss-1986");
});

test("statistics count the same page number separately in different catalogs", () => {
  const statistics = app.calculateStatistics([
    { catalogId: "first", catalogPage: 27, name: "Alpha", weight: { grams: 1 } },
    { catalogId: "second", catalogPage: 27, name: "Beta", weight: { grams: 2 } }
  ]);
  assert.equal(statistics.observations, 2);
  assert.equal(statistics.catalogs, 2);
  assert.equal(statistics.pages, 2);
});

test("all exported sort modes preserve source order for complete ties", () => {
  const records = prepareSpecimens(["first", "second", "third"].map((id) => specimenSource({
    id, designation: "H42", name: "Stable twin", grams: 42
  })));
  for (const sort of ["designation-asc", "designation-desc", "name-asc", "name-desc", "weight-asc", "weight-desc"]) {
    assert.deepEqual(ids(app.filterRecords(records, filters({ query: "H42", sort }))), ["first", "second", "third"], sort);
  }
});

test("three-catalog folio policy is structurally valid", () => {
  assert.equal(app.validateFolioManifest(threeCatalogManifest(), folioRegistry()), true);
});

test("contradictory metadata policy is rejected before folio authorization", () => {
  const candidate = clone(fixture);
  candidate.metadata.catalogs[0].folioDisplayPolicy = "display";
  assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
});

test("the same page number resolves within its own catalog", () => {
  const manifest = threeCatalogManifest();
  const registry = folioRegistry();
  const museum = app.getAuthorizedFolio(manifest, "museum-1890", 27, registry);
  const university = app.getAuthorizedFolio(manifest, "university-1912", 27, registry);
  assert.equal(museum.image, "assets/folios/museum-1890/leaf-27.webp");
  assert.equal(university.image, "assets/folios/university-1912/leaf-27.webp");
  assert.notEqual(museum.image, university.image);
});

test("authorized folio page arrays preserve manifest order and catalog scope", () => {
  const manifest = threeCatalogManifest();
  const registry = folioRegistry();
  assert.deepEqual(app.getAuthorizedFolioPages(manifest, "museum-1890", registry).map(({ pageId, catalogPage }) => [pageId, catalogPage]), [
    ["leaf-27", 27], ["front-cover", null], ["leaf-7", 7]
  ]);
  assert.deepEqual(app.getAuthorizedFolioPages(manifest, "university-1912", registry).map(({ pageId, catalogPage }) => [pageId, catalogPage]), [
    ["leaf-30", 30], ["leaf-27", 27]
  ]);
});

test("unnumbered folios are browseable but cannot impersonate catalog pages", () => {
  const manifest = threeCatalogManifest();
  const registry = folioRegistry();
  const unnumbered = app.getAuthorizedFolioPages(manifest, "museum-1890", registry)[1];
  assert.deepEqual(unnumbered, {
    catalogId: "museum-1890",
    pageId: "front-cover",
    catalogPage: null,
    pageLabel: "Front cover",
    image: "assets/folios/museum-1890/front-cover.webp",
    alt: "Museum catalog front cover"
  });
  assert.equal(app.getAuthorizedFolio(manifest, "museum-1890", null, registry), null);
  assert.equal(app.getAuthorizedFolio(manifest, "museum-1890", "front-cover", registry), null);
});

test("NoC-US policy authorizes only its own catalog's browse-all pages", () => {
  const manifest = threeCatalogManifest();
  const registry = folioRegistry();
  assert.equal(registry["university-1912"].rightsStatus, "no-copyright-us");
  assert.equal(app.hasMatchingFolioPolicy(manifest, "university-1912", registry), true);
  assert.deepEqual(app.getAuthorizedFolioPages(manifest, "university-1912", registry).map(({ catalogId }) => catalogId), [
    "university-1912", "university-1912"
  ]);
  assert.equal(app.getAuthorizedFolio(manifest, "university-1912", 30, registry).pageLabel, "Leaf 30");
  assert.match(readFileSync(join(__dirname, "..", "app.js"), "utf8"), /Browse all source images/);
});

test("a valid blocked/undetermined catalog denies every folio", () => {
  const manifest = threeCatalogManifest();
  const registry = folioRegistry();
  assert.equal(app.getAuthorizedFolio(manifest, "huss-1976", 27, registry), null);
  assert.deepEqual(app.getAuthorizedFolioPages(manifest, "huss-1976", registry), []);
  assert.equal(app.getAuthorizedFolio(manifest, "missing-catalog", 27, registry), null);
});

test("metadata/manifest policy mismatch denies folios", () => {
  const manifest = threeCatalogManifest();
  const registry = folioRegistry();
  registry["museum-1890"].folioDisplayPolicy = "blocked";
  registry["museum-1890"].rightsStatus = "undetermined";
  assert.equal(app.validateFolioManifest(manifest, registry), false);
  assert.equal(app.getAuthorizedFolio(manifest, "museum-1890", 27, registry), null);
  assert.deepEqual(app.getAuthorizedFolioPages(manifest, "museum-1890", registry), []);
});

test("malformed and contradictory rights policies fail closed", () => {
  const registry = folioRegistry();
  const candidates = [];
  const undetermined = threeCatalogManifest();
  undetermined.catalogs["museum-1890"].rightsStatus = "undetermined";
  candidates.push(undetermined);
  const blockedWithPages = threeCatalogManifest();
  blockedWithPages.catalogs["museum-1890"].displayPolicy = "blocked";
  candidates.push(blockedWithPages);
  const unknown = threeCatalogManifest();
  unknown.catalogs["museum-1890"].displayPolicy = "reviewed";
  candidates.push(unknown);
  const extra = threeCatalogManifest();
  extra.catalogs["museum-1890"].legalNote = "Not in schema";
  candidates.push(extra);
  const schema1 = threeCatalogManifest();
  schema1.schemaVersion = 1;
  candidates.push(schema1);
  candidates.forEach((candidate) => {
    assert.equal(app.validateFolioManifest(candidate, registry), false);
    assert.equal(app.getAuthorizedFolio(candidate, "university-1912", 27, registry), null);
  });
});

test("malformed folio entries invalidate the whole manifest and deny display", () => {
  const registry = folioRegistry();
  const mutations = [
    (entry) => { entry.pageId = ""; },
    (entry) => { entry.catalogPage = 0; },
    (entry) => { entry.catalogPage = 999; },
    (entry) => { entry.pageLabel = ""; },
    (entry) => { entry.image = "https://example.test/page-27.webp"; },
    (entry) => { entry.image = "assets/folios/museum-1890/nested/leaf-27.webp"; },
    (entry) => { entry.image = "assets/folios/museum-1890/leaf-27.png"; },
    (entry) => { entry.image = "assets/folios/museum-1890/page-27.webp"; },
    (entry) => { entry.alt = "<em>Catalog page 27</em>"; },
    (entry) => { entry.thumbnail = "assets/folios/museum-1890/page%2027.webp"; },
    (entry) => { entry.caption = "Unexpected field"; }
  ];
  mutations.forEach((mutate) => {
    const candidate = threeCatalogManifest();
    mutate(candidate.catalogs["museum-1890"].pages[0]);
    assert.equal(app.validateFolioManifest(candidate, registry), false);
    assert.equal(app.getAuthorizedFolio(candidate, "museum-1890", 27, registry), null);
  });
});

test("runtime folio paths exactly bind catalog ID, page ID, and WebP filename", () => {
  assert.equal(app.isSafeFolioPath(
    "assets/folios/museum-1890/leaf-27.webp", "museum-1890", "leaf-27"
  ), true);
  assert.equal(app.isSafeFolioPath(
    "assets/folios/museum-1890/nested/leaf-27.webp", "museum-1890", "leaf-27"
  ), false);
  assert.equal(app.isSafeFolioPath(
    "assets/folios/museum-1890/leaf-27.png", "museum-1890", "leaf-27"
  ), false);
  assert.equal(app.isSafeFolioPath(
    "assets/folios/museum-1890/page-27.webp", "museum-1890", "leaf-27"
  ), false);
});

test("duplicate folio page IDs fail closed", () => {
  const registry = folioRegistry();
  const duplicateId = threeCatalogManifest();
  duplicateId.catalogs["museum-1890"].pages[1].pageId = "leaf-27";
  assert.equal(app.validateFolioManifest(duplicateId, registry), false);
  assert.equal(app.getAuthorizedFolio(duplicateId, "museum-1890", 27, registry), null);
  assert.deepEqual(app.getAuthorizedFolioPages(duplicateId, "university-1912", registry), []);
});

test("cross-catalog paths and unexpected thumbnail fields invalidate the whole manifest", () => {
  const registry = folioRegistry();
  const image = threeCatalogManifest();
  image.catalogs["museum-1890"].pages[0].image = "assets/folios/university-1912/leaf-27.webp";
  const thumbnail = threeCatalogManifest();
  thumbnail.catalogs["museum-1890"].pages[0].thumbnail = "assets/folios/university-1912/page-27-thumb.webp";
  for (const candidate of [image, thumbnail]) {
    assert.equal(app.validateFolioManifest(candidate, registry), false);
    assert.equal(app.getAuthorizedFolio(candidate, "museum-1890", 27, registry), null);
  }
});

test("incomplete, extra, and out-of-range folio manifests fail closed", () => {
  const registry = folioRegistry();
  const incomplete = threeCatalogManifest();
  delete incomplete.catalogs["huss-1976"];
  const extra = threeCatalogManifest();
  extra.catalogs["extra-1900"] = { displayPolicy: "blocked", rightsStatus: "undetermined", pages: [] };
  const outOfRange = threeCatalogManifest();
  outOfRange.catalogs["museum-1890"].pages.push(
    page("leaf-999", 999, null, "assets/folios/museum-1890/leaf-999.webp", "Museum catalog page 999")
  );
  for (const candidate of [incomplete, extra, outOfRange]) {
    assert.equal(app.validateFolioManifest(candidate, registry), false);
    assert.equal(app.getAuthorizedFolio(candidate, "museum-1890", 27, registry), null);
    assert.deepEqual(app.getAuthorizedFolioPages(candidate, "university-1912", registry), []);
  }
});

let passed = 0;
let failed = 0;

for (const [index, entry] of tests.entries()) {
  try {
    entry.callback();
    passed += 1;
    console.log(`ok ${index + 1} - ${entry.name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok ${index + 1} - ${entry.name}`);
    console.error(error.stack || error);
  }
}

console.log(`1..${tests.length}`);
console.log(`# pass ${passed}`);
console.log(`# fail ${failed}`);
if (failed) process.exitCode = 1;
