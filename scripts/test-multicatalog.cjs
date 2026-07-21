"use strict";

const assert = require("node:assert/strict");
const fixture = require("./test-multicatalog-fixture.json");
const app = require("../app.js");

const RECORD_FIELDS = [
  "id",
  "catalogId",
  "designation",
  "name",
  "weight",
  "classification",
  "locality",
  "year",
  "catalogPage",
  "confidence"
];
const METADATA_FIELDS = [
  "schemaVersion",
  "scope",
  "factualFields",
  "catalogs",
  "recordCount",
  "recordsWithDesignation",
  "recordsWithWeight",
  "confidenceCounts"
];
const CATALOG_FIELDS = [
  "id",
  "label",
  "compiler",
  "year",
  "sourcePages",
  "sourcePageCount",
  "recordCount",
  "recordsWithDesignation",
  "recordsWithWeight",
  "confidenceCounts",
  "folioDisplayPolicy",
  "rightsStatus"
];
const PRIVATE_FIELDS = new Set([
  "display",
  "filename",
  "filepath",
  "image",
  "imagepath",
  "note",
  "notes",
  "ocr",
  "ocrtext",
  "path",
  "rawtext",
  "scan",
  "scanfile",
  "scanpath",
  "sourcefile",
  "sourcefilename",
  "sourceimage",
  "sourceimages",
  "thumbnail"
]);
const SORTS = [
  "designation-asc",
  "designation-desc",
  "name-asc",
  "name-desc",
  "weight-asc",
  "weight-desc"
];

const tests = [];

function test(name, callback) {
  tests.push({ name, callback });
}

function skip(name, reason) {
  tests.push({ name, reason });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ids(records) {
  return records.map((record) => record.id);
}

function preparedRecords() {
  const registry = app.normalizeCatalogRegistry(fixture.metadata);
  return fixture.records.map((record, index) => app.prepareRecord(record, index, registry));
}

function metadataCatalog(catalogId, metadata = fixture.metadata) {
  return metadata.catalogs.find((catalog) => catalog.id === catalogId);
}

function replaceCatalogId(catalog, currentId, nextId) {
  metadataCatalog(currentId, catalog.metadata).id = nextId;
  catalog.records.forEach((record) => {
    if (record.catalogId === currentId) record.catalogId = nextId;
  });
}

function assertNoPrivateFields(value, path = "fixture") {
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertNoPrivateFields(child, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[-_]/g, "");
    assert(!PRIVATE_FIELDS.has(normalizedKey), `${path}.${key} is a private field`);
    assertNoPrivateFields(child, `${path}.${key}`);
  }
}

function page(image, alt) {
  return { image, alt };
}

function threeCatalogManifest() {
  return {
    schemaVersion: 1,
    catalogs: {
      "huss-1976": {
        displayPolicy: "blocked",
        rightsStatus: "undetermined",
        pages: {}
      },
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

test("synthetic catalog is valid, facts-only, and contains exactly three catalogs", () => {
  assert.equal(app.validateCatalog(fixture), fixture);
  assert.deepEqual(Object.keys(fixture.metadata).sort(), [...METADATA_FIELDS].sort());
  assert.equal(fixture.metadata.schemaVersion, 2);
  assert.equal(fixture.metadata.scope, "facts-only");
  assert.equal(Array.isArray(fixture.metadata.catalogs), true);
  assert.equal(fixture.metadata.catalogs.length, 3);
  fixture.metadata.catalogs.forEach((catalog) => {
    assert.deepEqual(Object.keys(catalog).sort(), [...CATALOG_FIELDS].sort());
    assert.equal(catalog.sourcePageCount, catalog.sourcePages.length);
  });
  assert.deepEqual(Object.keys(app.normalizeCatalogRegistry(fixture.metadata)), [
    "huss-1976",
    "museum-1890",
    "university-1912"
  ]);
  assert.deepEqual(new Set(fixture.records.map((record) => record.catalogId)), new Set([
    "huss-1976",
    "museum-1890",
    "university-1912"
  ]));
  fixture.records.forEach((record) => {
    assert.deepEqual(Object.keys(record).sort(), [...RECORD_FIELDS].sort());
    assert.deepEqual(Object.keys(record.weight), ["grams"]);
  });
  assertNoPrivateFields(fixture);
});

test("canonical global and per-catalog counts match the synthetic records", () => {
  const totals = {
    recordCount: fixture.records.length,
    recordsWithDesignation: fixture.records.filter((record) => record.designation !== null).length,
    recordsWithWeight: fixture.records.filter((record) => record.weight.grams !== null).length,
    confidenceCounts: { high: 0, medium: 0, low: 0 }
  };

  fixture.records.forEach((record) => { totals.confidenceCounts[record.confidence] += 1; });
  fixture.metadata.catalogs.forEach((catalog) => {
    const records = fixture.records.filter((record) => record.catalogId === catalog.id);
    const sourcePages = [...new Set(records.map((record) => record.catalogPage))].sort((a, b) => a - b);
    const confidenceCounts = { high: 0, medium: 0, low: 0 };
    records.forEach((record) => { confidenceCounts[record.confidence] += 1; });

    assert.deepEqual(catalog.sourcePages, sourcePages);
    assert.equal(catalog.sourcePageCount, sourcePages.length);
    assert.equal(catalog.recordCount, records.length);
    assert.equal(catalog.recordsWithDesignation, records.filter((record) => record.designation !== null).length);
    assert.equal(catalog.recordsWithWeight, records.filter((record) => record.weight.grams !== null).length);
    assert.deepEqual(catalog.confidenceCounts, confidenceCounts);
  });

  assert.equal(fixture.metadata.recordCount, totals.recordCount);
  assert.equal(fixture.metadata.recordsWithDesignation, totals.recordsWithDesignation);
  assert.equal(fixture.metadata.recordsWithWeight, totals.recordsWithWeight);
  assert.deepEqual(fixture.metadata.confidenceCounts, totals.confidenceCounts);
});

test("the full fixture follows canonical deterministic deployment order", () => {
  assert.deepEqual(ids(fixture.records), [
    "museum-a12",
    "university-h2-7",
    "huss-h27",
    "museum-h27",
    "huss-h27-1",
    "university-h27-20",
    "stable-first",
    "stable-second",
    "stable-third",
    "huss-h270",
    "museum-m7",
    "university-null"
  ]);
});

test("public catalog validation rejects private and unexpected record fields", () => {
  for (const field of ["notes", "rawText", "sourceImage", "imagePath", "scanPath"]) {
    const candidate = clone(fixture);
    candidate.records[0][field] = "private/source-page-27.jpg";
    assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
  }

  const nestedCandidate = clone(fixture);
  nestedCandidate.records[0].weight.display = "10 g";
  assert.throws(() => app.validateCatalog(nestedCandidate), /facts-only schema/);
});

test("catalog validation rejects metadata leakage keys and values", () => {
  const candidates = [];

  const rootLeak = clone(fixture);
  rootLeak.metadata.sourceFilename = "private-page-27.dat";
  candidates.push(rootLeak);

  const descriptorLeak = clone(fixture);
  descriptorLeak.metadata.catalogs[0].notes = "Private transcription notes";
  candidates.push(descriptorLeak);

  for (const value of [
    "Raw OCR output for line 27",
    "Source filename IMG_0027",
    "../private/page-27",
    "page-27.TIFF"
  ]) {
    const valueLeak = clone(fixture);
    valueLeak.metadata.catalogs[0].label = value;
    candidates.push(valueLeak);
  }

  candidates.forEach((candidate) => assert.throws(() => app.validateCatalog(candidate)));
});

test("catalog validation rejects incorrect global and per-catalog metadata counts", () => {
  const globalMismatch = clone(fixture);
  globalMismatch.metadata.recordCount += 1;
  assert.throws(() => app.validateCatalog(globalMismatch));

  const catalogMismatch = clone(fixture);
  catalogMismatch.metadata.catalogs[1].recordsWithWeight += 1;
  assert.throws(() => app.validateCatalog(catalogMismatch));
});

test("runtime validation rejects invalid and empty catalog IDs", () => {
  for (const catalogId of ["", "Uppercase-id", "invalid_id", "a".repeat(81)]) {
    const candidate = clone(fixture);
    replaceCatalogId(candidate, "huss-1976", catalogId);
    assert.throws(() => app.validateCatalog(candidate), /facts-only schema/, JSON.stringify(catalogId));
  }
});

test("runtime validation rejects non-string record catalog IDs", () => {
  const candidate = clone(fixture);
  candidate.records.find((record) => record.catalogId === "huss-1976").catalogId = ["huss-1976"];
  assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
});

test("runtime validation rejects overlong and control-containing public text", () => {
  const candidates = [];

  const overlongLabel = clone(fixture);
  overlongLabel.metadata.catalogs[0].label = "x".repeat(161);
  candidates.push(overlongLabel);

  const overlongCompiler = clone(fixture);
  overlongCompiler.metadata.catalogs[0].compiler = "x".repeat(161);
  candidates.push(overlongCompiler);

  const metadataControl = clone(fixture);
  metadataControl.metadata.catalogs[0].label = "Huss\u0000collection";
  candidates.push(metadataControl);

  const recordControl = clone(fixture);
  recordControl.records[0].name = "Non-H\u0000alpha";
  candidates.push(recordControl);

  candidates.forEach((candidate) => assert.throws(() => app.validateCatalog(candidate), /facts-only schema/));
});

test("runtime validation rejects empty record IDs", () => {
  const candidate = clone(fixture);
  candidate.records[0].id = "";
  assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
});

test("runtime validation rejects records without a substantive public fact", () => {
  const candidate = clone(fixture);
  Object.assign(candidate.records[0], {
    designation: null,
    name: null,
    weight: { grams: null },
    classification: null,
    locality: null,
    year: null
  });
  assert.throws(() => app.validateCatalog(candidate), /facts-only schema/);
});

test("duplicate labels retain distinct disambiguation inputs and catalog IDs", () => {
  const museum = metadataCatalog("museum-1890");
  const university = metadataCatalog("university-1912");
  assert.equal(museum.label, university.label);
  assert.notEqual(museum.id, university.id);
  assert.notEqual(museum.compiler, university.compiler);
  assert.notEqual(museum.year, university.year);

  const registry = app.normalizeCatalogRegistry(fixture.metadata);
  assert.equal(registry["museum-1890"].displayLabel, "Historical register (1890; museum-1890)");
  assert.equal(registry["university-1912"].displayLabel, "Historical register (1912; university-1912)");
  assert.notEqual(registry["museum-1890"].displayLabel, registry["university-1912"].displayLabel);
});

test("record preparation preserves catalog identity and page identity", () => {
  const records = preparedRecords();
  assert.deepEqual(
    records.filter((record) => record.catalogPage === 27).map((record) => [record.id, record.catalogId]),
    [
      ["university-h2-7", "university-1912"],
      ["huss-h27", "huss-1976"],
      ["museum-h27", "museum-1890"]
    ]
  );
  assert.equal(
    records.find((record) => record.id === "museum-h27").catalogLabel,
    "Historical register (1890; museum-1890)"
  );
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
  const record = {
    designation: "(2)H399.1",
    designationSegments: app.designationComponents("(2)H399.1"),
    searchText: app.searchable("(2)H399.1 Canyon Diablo iron")
  };
  assert.equal(app.matchesSearch(record, "H399"), true);
  assert.equal(app.matchesSearch(record, "(2)H399.1"), true);
  assert.equal(app.matchesSearch(record, "H399 canyon"), true);
  assert.equal(app.matchesSearch(record, "H39"), false);
});

test("bare numeric queries match exact designations or year tokens", () => {
  const one = { designation: "1", year: "1928", searchText: "1 1928" };
  const ten = { designation: "10", year: "1932", searchText: "10 1932" };
  assert.equal(app.matchesSearch(one, "1"), true);
  assert.equal(app.matchesSearch(ten, "1"), false);
  assert.equal(app.matchesSearch(ten, "1932"), true);
});

test("H27 search matches its segment descendants but not numeric lookalikes", () => {
  const records = preparedRecords();
  const matched = records.filter((record) => app.matchesSearch(record, "H27"));
  assert.deepEqual(new Set(ids(matched)), new Set([
    "huss-h27",
    "huss-h27-1",
    "museum-h27",
    "university-h27-20"
  ]));
  assert(!ids(matched).includes("huss-h270"));
  assert(!ids(matched).includes("university-h2-7"));
  assert.equal(app.matchesSearch(records.find((record) => record.id === "huss-h27"), "H27.1"), false);
});

test("compound H27 search enforces designation segments and remaining terms", () => {
  const records = preparedRecords();
  const matched = app.filterRecords(records, {
    query: "H27 stone",
    catalog: null,
    min: null,
    max: null,
    sort: "designation-asc"
  });
  assert.deepEqual(ids(matched), ["museum-h27"]);
  assert.equal(app.matchesSearch(records.find((record) => record.id === "museum-h27"), "H27 stone"), true);
  assert.equal(app.matchesSearch(records.find((record) => record.id === "huss-h270"), "H27 stone"), false);
});

test("non-H designations use normalized factual text search", () => {
  const records = preparedRecords();
  assert.equal(app.isDesignationQuery("A12"), false);
  assert.equal(app.isDesignationQuery("M7"), false);
  assert.equal(app.normalizeDesignation("A12"), "a12");
  assert.equal(app.normalizeDesignation("M7"), "m7");
  assert.deepEqual(app.genericDesignation("A12"), { prefix: "a", segments: ["12"] });
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "A12"))), ["museum-a12"]);
  assert.deepEqual(ids(records.filter((record) => app.matchesSearch(record, "m 7"))), ["museum-m7"]);
});

test("class-like queries match factual text as well as designations", () => {
  const classificationOnly = {
    designation: "X1",
    designationKey: app.genericDesignation("X1"),
    searchText: app.searchable("X1 Example Stone chondrite L6")
  };
  const hDesignation = {
    designation: "H5.1",
    designationSegments: app.designationComponents("H5.1"),
    searchText: app.searchable("H5.1 Example Iron")
  };
  const hClassification = {
    designation: "X2",
    designationKey: app.genericDesignation("X2"),
    searchText: app.searchable("X2 Example Stone chondrite H5")
  };
  assert.equal(app.matchesSearch(classificationOnly, "L6"), true);
  assert.equal(app.matchesSearch(hDesignation, "H5"), true);
  assert.equal(app.matchesSearch(hClassification, "H5"), true);
});

test("catalog filtering selects one catalog without leaking same-page records", () => {
  const matched = app.filterRecords(preparedRecords(), {
    query: "H27",
    catalog: "museum-1890",
    min: null,
    max: null,
    sort: "designation-asc"
  });
  assert.deepEqual(ids(matched), ["museum-h27"]);
  assert(matched.every((record) => record.catalogId === "museum-1890"));
});

test("an empty catalog filter retains matching records from all three catalogs", () => {
  const matched = app.filterRecords(preparedRecords(), {
    query: "H27",
    catalog: null,
    min: null,
    max: null,
    sort: "designation-asc"
  });
  assert.deepEqual(new Set(matched.map((record) => record.catalogId)), new Set([
    "huss-1976",
    "museum-1890",
    "university-1912"
  ]));
  assert.equal(matched.filter((record) => record.catalogPage === 27).length, 2);
});

test("URL filters parse and serialize a normalized multi-catalog round trip", () => {
  const registry = app.normalizeCatalogRegistry(fixture.metadata);
  const parsed = app.parseUrlFilters(
    "?q=H27+stone&catalog=university-1912&min=0&max=42&sort=weight-desc&ignored=value",
    registry
  );
  assert.deepEqual(parsed, {
    query: "H27 stone",
    catalog: "university-1912",
    min: "0",
    max: "42",
    sort: "weight-desc"
  });
  assert.equal(
    app.serializeUrlFilters(parsed).toString(),
    "q=H27+stone&catalog=university-1912&min=0&max=42&sort=weight-desc"
  );
  assert.deepEqual(app.parseUrlFilters(`?${app.serializeUrlFilters(parsed)}`, registry), parsed);
});

test("URL filters discard unknown catalogs and malformed values", () => {
  const registry = app.normalizeCatalogRegistry(fixture.metadata);
  assert.deepEqual(
    app.parseUrlFilters("?catalog=missing&min=-1&max=NaN&sort=unknown", registry),
    { query: "", catalog: "", min: "", max: "", sort: app.DEFAULT_SORT }
  );
  assert.equal(app.serializeUrlFilters({
    query: "",
    catalog: "",
    min: "-1",
    max: "Infinity",
    sort: "unknown"
  }).toString(), "");
});

test("URL filters discard crossed minimum and maximum ranges", () => {
  const registry = app.normalizeCatalogRegistry(fixture.metadata);
  assert.deepEqual(
    app.parseUrlFilters("?q=H27&catalog=museum-1890&min=50&max=10&sort=name-asc", registry),
    { query: "H27", catalog: "museum-1890", min: "", max: "", sort: "name-asc" }
  );
  assert.equal(app.serializeUrlFilters({
    query: "H27",
    catalog: "museum-1890",
    min: "50",
    max: "10",
    sort: "name-asc"
  }).toString(), "q=H27&catalog=museum-1890&sort=name-asc");
});

test("URL catalog IDs disambiguate catalogs that share a display label", () => {
  const registry = app.normalizeCatalogRegistry(fixture.metadata);
  const museum = app.parseUrlFilters("?catalog=museum-1890", registry);
  const university = app.parseUrlFilters("?catalog=university-1912", registry);
  assert.equal(museum.catalog, "museum-1890");
  assert.equal(university.catalog, "university-1912");
  assert.notEqual(museum.catalog, university.catalog);
});

test("statistics count the same page number separately in different catalogs", () => {
  const statistics = app.calculateStatistics(preparedRecords());
  assert.equal(statistics.specimens, 12);
  assert.equal(statistics.pages, 12);
});

test("all exported sort modes preserve source order for complete ties", () => {
  const records = preparedRecords();
  for (const sort of SORTS) {
    const matched = app.filterRecords(records, { query: "H42", min: null, max: null, sort });
    assert.deepEqual(ids(matched), ["stable-first", "stable-second", "stable-third"], sort);
  }
});

test("three-catalog folio policy is structurally valid", () => {
  const registry = app.normalizeCatalogRegistry(fixture.metadata);
  assert.equal(app.validateFolioManifest(threeCatalogManifest(), registry), true);
  fixture.metadata.catalogs.forEach((catalog) => {
    const policy = threeCatalogManifest().catalogs[catalog.id];
    assert.equal(policy.displayPolicy, catalog.folioDisplayPolicy);
    assert.equal(policy.rightsStatus, catalog.rightsStatus);
  });
});

test("contradictory metadata policy is rejected before folio authorization", () => {
  const candidate = clone(fixture);
  const museum = metadataCatalog("museum-1890", candidate.metadata);
  museum.rightsStatus = "undetermined";
  assert.throws(() => app.validateCatalog(candidate));
});

test("the same page number resolves within its own catalog", () => {
  const manifest = threeCatalogManifest();
  const registry = app.normalizeCatalogRegistry(fixture.metadata);
  const museum = app.getAuthorizedFolio(manifest, "museum-1890", "27", registry);
  const university = app.getAuthorizedFolio(manifest, "university-1912", 27, registry);

  assert.equal(museum.catalogId, "museum-1890");
  assert.equal(museum.catalogPage, 27);
  assert.equal(museum.image, "assets/folios/museum-1890/page-27.webp");
  assert.equal(university.catalogId, "university-1912");
  assert.equal(university.catalogPage, 27);
  assert.equal(university.image, "assets/folios/university-1912/page-27.webp");
  assert.notEqual(museum.image, university.image);
});

test("authorized folio page lists are numeric-sorted and catalog-scoped", () => {
  const manifest = threeCatalogManifest();
  const registry = app.normalizeCatalogRegistry(fixture.metadata);
  assert.deepEqual(app.getAuthorizedFolioPages(manifest, "museum-1890", registry).map((folio) => folio.catalogPage), [7, 27]);
  assert.deepEqual(app.getAuthorizedFolioPages(manifest, "university-1912", registry).map((folio) => folio.catalogPage), [27, 30]);
});

test("a valid blocked/undetermined catalog denies every folio", () => {
  const manifest = threeCatalogManifest();
  const registry = app.normalizeCatalogRegistry(fixture.metadata);
  assert.equal(app.getAuthorizedFolio(manifest, "huss-1976", 27, registry), null);
  assert.deepEqual(app.getAuthorizedFolioPages(manifest, "huss-1976", registry), []);
  assert.equal(app.getAuthorizedFolio(manifest, "missing-catalog", 27, registry), null);
});

test("metadata/manifest policy mismatch denies folios", () => {
  const manifest = threeCatalogManifest();
  const mismatchedMetadata = clone(fixture.metadata);
  const museum = metadataCatalog("museum-1890", mismatchedMetadata);
  museum.folioDisplayPolicy = "blocked";
  museum.rightsStatus = "undetermined";
  const mismatchedRegistry = app.normalizeCatalogRegistry(mismatchedMetadata);

  assert.equal(app.validateFolioManifest(manifest, mismatchedRegistry), false);
  assert.equal(app.getAuthorizedFolio(manifest, "museum-1890", 27, mismatchedRegistry), null);
  assert.deepEqual(app.getAuthorizedFolioPages(manifest, "museum-1890", mismatchedRegistry), []);
});

test("malformed and contradictory rights policies fail closed", () => {
  const candidates = [];
  const registry = app.normalizeCatalogRegistry(fixture.metadata);

  const undeterminedDisplay = threeCatalogManifest();
  undeterminedDisplay.catalogs["museum-1890"].rightsStatus = "undetermined";
  candidates.push(undeterminedDisplay);

  const blockedWithPages = threeCatalogManifest();
  blockedWithPages.catalogs["museum-1890"].displayPolicy = "blocked";
  candidates.push(blockedWithPages);

  const unknownPolicy = threeCatalogManifest();
  unknownPolicy.catalogs["museum-1890"].displayPolicy = "reviewed";
  candidates.push(unknownPolicy);

  const extraPolicyField = threeCatalogManifest();
  extraPolicyField.catalogs["museum-1890"].legalNote = "Not part of the public policy schema";
  candidates.push(extraPolicyField);

  for (const candidate of candidates) {
    assert.equal(app.validateFolioManifest(candidate, registry), false);
    assert.equal(app.getAuthorizedFolio(candidate, "university-1912", 27, registry), null);
    assert.deepEqual(app.getAuthorizedFolioPages(candidate, "university-1912", registry), []);
  }
});

test("malformed folio entries invalidate the whole manifest and deny display", () => {
  const registry = app.normalizeCatalogRegistry(fixture.metadata);
  const mutations = [
    (entry) => { entry.image = "https://example.test/page-27.webp"; },
    (entry) => { entry.image = "assets/folios/museum-1890/../page-27.webp"; },
    (entry) => { entry.image = "assets/folios/museum-1890/page-27.svg"; },
    (entry) => { entry.alt = "<em>Catalog page 27</em>"; },
    (entry) => { entry.thumbnail = "assets/folios/museum-1890/page%2027.webp"; },
    (entry) => { entry.caption = "Unexpected field"; }
  ];

  for (const mutate of mutations) {
    const candidate = threeCatalogManifest();
    mutate(candidate.catalogs["museum-1890"].pages[27]);
    assert.equal(app.validateFolioManifest(candidate, registry), false);
    assert.equal(app.getAuthorizedFolio(candidate, "museum-1890", 27, registry), null);
  }
});

test("cross-catalog image and thumbnail paths invalidate the whole manifest and deny display", () => {
  const registry = app.normalizeCatalogRegistry(fixture.metadata);
  const crossCatalogImage = threeCatalogManifest();
  crossCatalogImage.catalogs["museum-1890"].pages[27].image = "assets/folios/university-1912/page-27.webp";

  const crossCatalogThumbnail = threeCatalogManifest();
  crossCatalogThumbnail.catalogs["museum-1890"].pages[27].thumbnail = "assets/folios/university-1912/page-27-thumb.webp";

  for (const candidate of [crossCatalogImage, crossCatalogThumbnail]) {
    assert.equal(app.validateFolioManifest(candidate, registry), false);
    assert.equal(app.getAuthorizedFolio(candidate, "museum-1890", 27, registry), null);
    assert.deepEqual(app.getAuthorizedFolioPages(candidate, "university-1912", registry), []);
  }
});

test("incomplete, extra, and out-of-range folio manifests fail closed", () => {
  const registry = app.normalizeCatalogRegistry(fixture.metadata);
  const incomplete = threeCatalogManifest();
  delete incomplete.catalogs["huss-1976"];

  const extra = threeCatalogManifest();
  extra.catalogs["extra-1900"] = { displayPolicy: "blocked", rightsStatus: "undetermined", pages: {} };

  const outOfRange = threeCatalogManifest();
  outOfRange.catalogs["museum-1890"].pages[999] = {
    image: "assets/folios/museum-1890/page-999.webp",
    alt: "Museum catalog page 999"
  };

  for (const candidate of [incomplete, extra, outOfRange]) {
    assert.equal(app.validateFolioManifest(candidate, registry), false);
    assert.equal(app.getAuthorizedFolio(candidate, "museum-1890", 27, registry), null);
    assert.deepEqual(app.getAuthorizedFolioPages(candidate, "university-1912", registry), []);
  }
});

let passed = 0;
let skipped = 0;
let failed = 0;

for (const [index, entry] of tests.entries()) {
  const number = index + 1;
  if (entry.reason) {
    skipped += 1;
    console.log(`ok ${number} - ${entry.name} # SKIP ${entry.reason}`);
    continue;
  }

  try {
    entry.callback();
    passed += 1;
    console.log(`ok ${number} - ${entry.name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok ${number} - ${entry.name}`);
    console.error(error.stack || error);
  }
}

console.log(`1..${tests.length}`);
console.log(`# pass ${passed}`);
console.log(`# skip ${skipped}`);
console.log(`# fail ${failed}`);

if (failed) process.exitCode = 1;
