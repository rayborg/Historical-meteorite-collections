"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const fixture = require("./test-multicatalog-fixture.json");
const app = require("../app.js");

const SPECIMEN_FIELDS = [
  "id", "catalogId", "designation", "name", "weight", "classification", "locality", "year", "catalogPage", "confidence"
];
const CATALOG_ITEM_FIELDS = [
  "id", "catalogId", "catalogItem", "holdings", "name", "classification", "locality", "year", "catalogPage", "confidence"
];
const HOLDING_FIELDS = ["designation", "kind", "description", "count", "weight"];
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
  return { query: "", catalog: null, min: null, max: null, sort: "designation-asc", ...overrides };
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
      rightsStatus: "public-domain"
    }
  };
}

function page(image, alt) {
  return { image, alt };
}

function threeCatalogManifest() {
  return {
    schemaVersion: 1,
    catalogs: {
      "huss-1976": { displayPolicy: "blocked", rightsStatus: "undetermined", pages: {} },
      "museum-1890": {
        displayPolicy: "display",
        rightsStatus: "public-domain",
        pages: {
          27: page("assets/folios/museum-1890/page-27.webp", "Museum catalog page 27"),
          7: page("assets/folios/museum-1890/page-7.webp", "Museum catalog page 7")
        }
      },
      "university-1912": {
        displayPolicy: "display",
        rightsStatus: "public-domain",
        pages: {
          27: page("assets/folios/university-1912/page-27.webp", "University catalog page 27"),
          30: page("assets/folios/university-1912/page-30.webp", "University catalog page 30")
        }
      }
    }
  };
}

test("schema 3 fixture validates with exact model-aware shapes", () => {
  assert.equal(app.validateCatalog(fixture), fixture);
  assert.equal(fixture.metadata.schemaVersion, 3);
  assert.deepEqual(fixture.metadata.catalogs.map(({ id, recordModel }) => [id, recordModel]), [
    ["huss-1976", "specimen"],
    ["huss-1986", "specimen"],
    ["nininger-1933", "catalog-item"]
  ]);
  fixture.metadata.catalogs.forEach((descriptor) => {
    assert.deepEqual(Object.keys(descriptor).sort(), [...CATALOG_FIELDS].sort());
  });
  fixture.records.forEach((record) => {
    const descriptor = fixture.metadata.catalogs.find(({ id }) => id === record.catalogId);
    assert.deepEqual(
      Object.keys(record).sort(),
      [...(descriptor.recordModel === "specimen" ? SPECIMEN_FIELDS : CATALOG_ITEM_FIELDS)].sort()
    );
    if (descriptor.recordModel === "specimen") assert.deepEqual(Object.keys(record.weight), ["grams"]);
    else record.holdings.forEach((holding) => {
      assert.deepEqual(Object.keys(holding).sort(), [...HOLDING_FIELDS].sort());
      assert.deepEqual(Object.keys(holding.weight), ["grams"]);
    });
  });
});

test("schema 2 and legacy metadata are intentionally rejected", () => {
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
    ...candidate.records.filter(({ catalogId }) => catalogId === "huss-1976")
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
});

test("metadata summaries use holding designation and mass presence", () => {
  assert.equal(fixture.metadata.recordsWithDesignation, 7);
  assert.equal(fixture.metadata.recordsWithWeight, 8);
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

test("search covers catalog items and rendered holding facts", () => {
  const records = recordsFor("nininger-1933");
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

test("numeric-leading holding codes match exactly after case and space normalization", () => {
  const records = recordsFor("nininger-1933");
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
  assert.equal(statistics.observations, 10);
  assert.equal(statistics.specimens, 10);
  assert.equal(statistics.grams, 205);
  assert.equal(statistics.pages, 10);
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
    "nininger-1933", "huss-1976", "huss-1986"
  ]);
  assert.equal(registry["nininger-1933"].recordModel, "catalog-item");
  assert.deepEqual(app.catalogSummaryEntries(registry).map(({ observationCount }) => observationCount), [2, 2, 6]);
});

test("URL filter behavior and cache version remain stable", () => {
  const registry = app.normalizeCatalogRegistry(fixture.metadata);
  const html = readFileSync(join(__dirname, "..", "index.html"), "utf8");
  const parsed = app.parseUrlFilters("?q=catalog+item+2&catalog=nininger-1933&min=3&max=12&sort=weight-desc", registry);
  assert.deepEqual(parsed, {
    query: "catalog item 2", catalog: "nininger-1933", min: "3", max: "12", sort: "weight-desc"
  });
  assert.equal(app.serializeUrlFilters(parsed).toString(), "q=catalog+item+2&catalog=nininger-1933&min=3&max=12&sort=weight-desc");
  assert.equal(app.CACHE_VERSION, "20260722-1");
  assert.match(html, new RegExp(`styles\\.css\\?v=${app.CACHE_VERSION}`));
  assert.match(html, new RegExp(`app\\.js\\?v=${app.CACHE_VERSION}`));
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
    schemaVersion: 1,
    catalogs: Object.fromEntries(Object.keys(registry).map((id) => [id, {
      displayPolicy: "blocked", rightsStatus: "undetermined", pages: {}
    }]))
  };
  assert.equal(app.validateFolioManifest(blockedManifest, registry), true);
  assert.equal(app.getAuthorizedFolio(blockedManifest, "nininger-1933", 1, registry), null);

  const unsafe = clone(blockedManifest);
  unsafe.catalogs["nininger-1933"].displayPolicy = "display";
  unsafe.catalogs["nininger-1933"].pages[1] = { image: "../private/page.jpg", alt: "Page 1" };
  assert.equal(app.validateFolioManifest(unsafe, registry), false);
});

test("HTML and runtime contain accessible catalog-item card behavior", () => {
  const root = join(__dirname, "..");
  const html = readFileSync(join(root, "index.html"), "utf8");
  const script = readFileSync(join(root, "app.js"), "utf8");
  assert.match(html, /<section class="record-holdings" aria-label="Holdings" hidden>/);
  assert.match(html, /<ol class="holdings-list" role="list"><\/ol>/);
  assert.match(html, /Designation \/ catalog item, ascending/);
  assert.match(script, /recordWeight\.remove\(\)/);
  assert.match(script, /`Catalog item \$\{record\.catalogItem\}`/);
  assert.match(script, /holdings\.forEach\(\(holding\) =>/);
  assert.match(script, /"Unnumbered"/);
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

test("canonical order is Nininger-first and literal while parenthesized search stays semantic", () => {
  assert.deepEqual(ids(fixture.records), [
    "nininger-item-1", "nininger-item-2", "nininger-item-3", "nininger-item-4", "nininger-item-5",
    "nininger-item-6", "huss-second-h399-1", "huss-second-h400", "huss-h27-3", "huss-h42"
  ]);
  const parenthesized = preparedRecords().find(({ id }) => id === "huss-second-h399-1");
  assert.equal(app.matchesSearch(parenthesized, "H399"), true);
  assert.equal(app.matchesSearch(parenthesized, "(2)H399.1"), true);
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

test("catalog selector orders public sources chronologically without changing source order", () => {
  const registry = app.normalizeCatalogRegistry(fixture.metadata);
  const sourceOrder = fixture.metadata.catalogs.map(({ id }) => id);
  assert.deepEqual(app.catalogSelectorEntries(registry).map(([id]) => id), ["nininger-1933", "huss-1976", "huss-1986"]);
  assert.deepEqual(fixture.metadata.catalogs.map(({ id }) => id), sourceOrder);
  assert.deepEqual(app.catalogSummaryEntries(registry).map(({ id }) => id), sourceOrder);
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
    { query: "", catalog: "", min: "", max: "", sort: app.DEFAULT_SORT });
  assert.equal(app.serializeUrlFilters({ query: "", catalog: "", min: "-1", max: "Infinity", sort: "unknown" }).toString(), "");
});

test("URL filters discard crossed minimum and maximum ranges", () => {
  const registry = app.normalizeCatalogRegistry(fixture.metadata);
  assert.deepEqual(app.parseUrlFilters("?q=H27&catalog=huss-1976&min=50&max=10&sort=name-asc", registry),
    { query: "H27", catalog: "huss-1976", min: "", max: "", sort: "name-asc" });
  assert.equal(app.serializeUrlFilters({
    query: "H27", catalog: "huss-1976", min: "50", max: "10", sort: "name-asc"
  }).toString(), "q=H27&catalog=huss-1976&sort=name-asc");
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
  assert.equal(museum.image, "assets/folios/museum-1890/page-27.webp");
  assert.equal(university.image, "assets/folios/university-1912/page-27.webp");
  assert.notEqual(museum.image, university.image);
});

test("authorized folio page lists are numeric-sorted and catalog-scoped", () => {
  const manifest = threeCatalogManifest();
  const registry = folioRegistry();
  assert.deepEqual(app.getAuthorizedFolioPages(manifest, "museum-1890", registry).map(({ catalogPage }) => catalogPage), [7, 27]);
  assert.deepEqual(app.getAuthorizedFolioPages(manifest, "university-1912", registry).map(({ catalogPage }) => catalogPage), [27, 30]);
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
  candidates.forEach((candidate) => {
    assert.equal(app.validateFolioManifest(candidate, registry), false);
    assert.equal(app.getAuthorizedFolio(candidate, "university-1912", 27, registry), null);
  });
});

test("malformed folio entries invalidate the whole manifest and deny display", () => {
  const registry = folioRegistry();
  const mutations = [
    (entry) => { entry.image = "https://example.test/page-27.webp"; },
    (entry) => { entry.image = "assets/folios/museum-1890/../page-27.webp"; },
    (entry) => { entry.image = "assets/folios/museum-1890/page-27.svg"; },
    (entry) => { entry.alt = "<em>Catalog page 27</em>"; },
    (entry) => { entry.thumbnail = "assets/folios/museum-1890/page%2027.webp"; },
    (entry) => { entry.caption = "Unexpected field"; }
  ];
  mutations.forEach((mutate) => {
    const candidate = threeCatalogManifest();
    mutate(candidate.catalogs["museum-1890"].pages[27]);
    assert.equal(app.validateFolioManifest(candidate, registry), false);
    assert.equal(app.getAuthorizedFolio(candidate, "museum-1890", 27, registry), null);
  });
});

test("cross-catalog image and thumbnail paths invalidate the whole manifest", () => {
  const registry = folioRegistry();
  const image = threeCatalogManifest();
  image.catalogs["museum-1890"].pages[27].image = "assets/folios/university-1912/page-27.webp";
  const thumbnail = threeCatalogManifest();
  thumbnail.catalogs["museum-1890"].pages[27].thumbnail = "assets/folios/university-1912/page-27-thumb.webp";
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
  extra.catalogs["extra-1900"] = { displayPolicy: "blocked", rightsStatus: "undetermined", pages: {} };
  const outOfRange = threeCatalogManifest();
  outOfRange.catalogs["museum-1890"].pages[999] = {
    image: "assets/folios/museum-1890/page-999.webp", alt: "Museum catalog page 999"
  };
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
