import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const app = require("../app.js");
const [catalogText, projectionText, lineageText, reviewText, html, catalogsHtml, styles] = await Promise.all([
  readFile(new URL("../data/catalog.json", import.meta.url), "utf8"),
  readFile(new URL("../data/specimen-card-projections.json", import.meta.url), "utf8"),
  readFile(new URL("../data/specimen-lineages.json", import.meta.url), "utf8"),
  readFile(new URL("../data/specimen-lineage-reviews.json", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../catalogs.html", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8"),
]);
const catalog = JSON.parse(catalogText);
const projections = JSON.parse(projectionText);
const lineages = JSON.parse(lineageText);
const registry = app.normalizeCatalogRegistry(catalog.metadata);
const records = catalog.records.map((record, index) => app.prepareRecord(record, index, registry));
const sourceCatalogSha256 = createHash("sha256").update(catalogText).digest("hex");
const projectionIndex = app.deriveSpecimenCardProjectionIndex(projections, records, { sourceCatalogSha256 });
const descriptors = app.expandSpecimenCardDescriptors(records, projectionIndex);
const lineageIndex = app.deriveEarlierRecordIndex(lineages, records, registry);

const DTO_KEYS = [
  "kind", "identifier", "semanticLabel", "sourceName", "facts", "sourceCitation", "sourceLabel", "catalogId", "catalogPages"
];
const STANDARD_SPECIMEN_LABELS = [
  "Current Meteoritical Bulletin name", "Class", "Specimen form", "Source locality",
  "Individual find location", "Event", "Lineage", "Specimen weight"
];
const STANDARD_OBSERVATION_LABELS = ["Class", "Source locality", "Event"];
const SEMANTIC_LABELS = {
  "direct-specimen": "Specimen.",
  "projected-atomic-specimen": "Individual specimen.",
  "collection-observation": "Collection catalog observation; not asserted here as one individual specimen.",
  "regional-observation": "Regional census/catalog observation, not a specimen or holding.",
};

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function present(descriptor) {
  return app.presentHarmonizedCard(descriptor, {
    lineageEntries: lineageIndex.get(descriptor.parentRecord.id) || [],
  });
}

function fact(dto, label) {
  return dto.facts.find((entry) => entry.label === label)?.value;
}

function expectedIdentifier(descriptor, kind) {
  const record = descriptor.parentRecord;
  if (kind === "projected-atomic-specimen") {
    return app.specimenCardHolding(record, descriptor.holdingPath)?.holding?.designation || "Unknown";
  }
  if (record.recordModel === "catalog-item") return `Catalog item ${record.catalogItem}`;
  if (record.recordModel === "catalog-number") return `Catalog no. ${record.catalogNumber}`;
  if (record.recordModel === "collection-entry") {
    return record.reportedNumber ? `Reported no. ${record.reportedNumber}` : `Collection entry ${record.entryOrder}`;
  }
  if (record.recordModel === "regional-census-fact") {
    return record.reportedNumber ? `Source number ${record.reportedNumber}` : `Regional census entry ${record.entryOrder}`;
  }
  if (record.recordModel === "table-a-specimen") return record.specimenId || "Unknown";
  return record.designation || "Unknown";
}

function expectedEvent(record) {
  if (record.recordModel === "catalog-number") return record.dateOfDiscovery;
  if (["collection-entry", "regional-census-fact"].includes(record.recordModel)) return record.eventDate;
  if (["specimen", "catalog-item"].includes(record.recordModel)) return record.year;
  return null;
}

test("every production display descriptor has the closed harmonized DTO and exact kind counts", () => {
  const counts = {};
  for (const descriptor of descriptors) {
    const dto = present(descriptor);
    counts[dto.kind] = (counts[dto.kind] || 0) + 1;
    assert.deepEqual(Object.keys(dto), DTO_KEYS, descriptor.parentRecord.id);
    assert.deepEqual(dto.facts.map(Object.keys), dto.facts.map(() => ["label", "value"]), descriptor.parentRecord.id);
    assert.equal(dto.kind, app.classifyHarmonizedCard(descriptor), descriptor.parentRecord.id);
    assert.equal(dto.identifier, expectedIdentifier(descriptor, dto.kind), descriptor.parentRecord.id);
    assert.equal(dto.semanticLabel, SEMANTIC_LABELS[dto.kind], descriptor.parentRecord.id);
    assert.equal(dto.catalogId, descriptor.parentRecord.catalogId, descriptor.parentRecord.id);
    assert.deepEqual(dto.catalogPages, app.recordCatalogPages(descriptor.parentRecord), descriptor.parentRecord.id);
    assert(dto.facts.every(({ label, value }) => typeof label === "string" && label && typeof value === "string" && value));
  }
  assert.deepEqual(counts, {
    "collection-observation": 6395,
    "projected-atomic-specimen": 6675,
    "direct-specimen": 5742,
    "regional-observation": 84,
  });
  assert.equal(descriptors.length, 18896);
});

test("every production card uses the approved fact order, values, missing behavior, and current-name suppression", () => {
  const missing = {};
  let specimenCount = 0;
  for (const descriptor of descriptors) {
    const record = descriptor.parentRecord;
    const dto = present(descriptor);
    const specimen = ["direct-specimen", "projected-atomic-specimen"].includes(dto.kind);
    const currentName = record.metbull?.canonicalName && !app.namesAreDisplayEquivalent(record.name, record.metbull.canonicalName)
      ? record.metbull.canonicalName : null;
    const expectedLabels = specimen
      ? STANDARD_SPECIMEN_LABELS
      : [...(currentName ? ["Current Meteoritical Bulletin name"] : []), ...STANDARD_OBSERVATION_LABELS];
    assert.deepEqual(dto.facts.map(({ label }) => label), expectedLabels, record.id);
    assert.equal(dto.sourceName, record.name || "Unknown", record.id);
    assert.equal(fact(dto, "Current Meteoritical Bulletin name"), specimen
      ? record.metbull?.canonicalName
        ? app.namesAreDisplayEquivalent(record.name, record.metbull.canonicalName)
          ? "Same as source catalog name" : record.metbull.canonicalName
        : "Unknown"
      : currentName || undefined, record.id);
    assert.equal(fact(dto, "Class"), record.classification || "Unknown", record.id);
    assert.equal(fact(dto, "Source locality"),
      (record.recordModel === "table-a-specimen" ? record.locality?.name : record.locality) || "Unknown", record.id);
    assert.equal(fact(dto, "Event"), expectedEvent(record) || "Unknown", record.id);
    if (specimen) {
      specimenCount += 1;
      assert.equal(fact(dto, "Specimen form"),
        dto.kind === "projected-atomic-specimen" || record.recordModel === "table-a-specimen" ? "Individual specimen" : "Specimen",
        record.id);
      assert.equal(fact(dto, "Individual find location"), record.individualFindLocation || "Unknown", record.id);
      for (const { label, value } of dto.facts) {
        if (value === "Unknown") missing[label] = (missing[label] || 0) + 1;
      }
      if (dto.sourceName === "Unknown") missing.sourceName = (missing.sourceName || 0) + 1;
    }
  }
  assert.equal(specimenCount, 12417);
  assert.deepEqual(missing, {
    "Current Meteoritical Bulletin name": 2279,
    "Individual find location": 12306,
    Lineage: 11788,
    Event: 2739,
    Class: 222,
    "Source locality": 255,
    "Specimen weight": 173,
    sourceName: 273,
  });
  assert.deepEqual({
    currentNameResolved: 2420 - missing["Current Meteoritical Bulletin name"],
    classResolved: 236 - missing.Class,
    eventResolved: 2796 - missing.Event,
    locationResolved: 12417 - missing["Individual find location"],
    lineageResolved: 11821 - missing.Lineage,
    weightResolved: 290 - missing["Specimen weight"],
  }, {
    currentNameResolved: 141,
    classResolved: 14,
    eventResolved: 57,
    locationResolved: 111,
    lineageResolved: 33,
    weightResolved: 117,
  });
});

test("specimen mass and lineage facts resolve exactly from source and projection paths", () => {
  for (const descriptor of descriptors.filter((item) =>
    ["direct-specimen", "projected-atomic-specimen"].includes(app.classifyHarmonizedCard(item)))) {
    const record = descriptor.parentRecord;
    const dto = present(descriptor);
    const entries = lineageIndex.get(record.id) || [];
    const expectedEntries = dto.kind === "projected-atomic-specimen"
      ? descriptor.massPath === null ? [] : entries.filter(({ massPath }) => massPath === descriptor.massPath)
      : entries;
    const grams = dto.kind === "projected-atomic-specimen"
      ? descriptor.repeatedMass
        ? app.resolveSpecimenCardRepeatedMass(record, descriptor.holdingPath, descriptor.repeatedMass)?.grams
        : descriptor.massPath === null ? null : app.resolveSpecimenCardSelection(record, descriptor.holdingPath, descriptor.massPath)?.grams
      : record.weight?.grams;
    assert.equal(fact(dto, "Lineage"), expectedEntries.length ? app.formatLineageSummary(expectedEntries.length) : "Unknown", record.id);
    assert.equal(fact(dto, "Specimen weight"), Number.isFinite(grams) ? app.formatMass(grams) : "Unknown", record.id);
  }
});

test("observation cards omit specimen claims and catalog-specific facts", () => {
  for (const descriptor of descriptors) {
    const record = descriptor.parentRecord;
    const dto = present(descriptor);
    const pages = app.recordCatalogPages(record);
    const sourceLabel = record.catalogLabel || record.catalogId;
    assert.equal(dto.sourceCitation, pages.length
      ? `${sourceLabel} \u00b7 ${pages.length === 1 ? "p." : "pp."} ${pages.join(", ")}`
      : `${sourceLabel} \u00b7 page not recorded`, record.id);
    if (["collection-observation", "regional-observation"].includes(dto.kind)) {
      assert.equal(dto.facts.some(({ label }) => ["Specimen form", "Lineage", "Specimen weight"].includes(label)), false, record.id);
    }
    assert.equal(dto.facts.some(({ label }) => /Australian Museum|occurrences/u.test(label)), false, record.id);
  }
});

test("only typed specimen locations can create an individual find location or specimen form", () => {
  const victoria = structuredClone(descriptors.find(({ parentRecord }) => parentRecord.catalogId === "victoria-land-1982"));
  victoria.parentRecord.locality.name = "General locality only";
  victoria.parentRecord.locality.coordinate = "INJECTED COORDINATE";
  const victoriaDto = app.presentHarmonizedCard(victoria);
  assert.equal(fact(victoriaDto, "Source locality"), "General locality only");
  assert.equal(fact(victoriaDto, "Specimen form"), "Individual specimen");
  assert.doesNotMatch(JSON.stringify(victoriaDto), /INJECTED COORDINATE/u);

  const collection = structuredClone(descriptors.find(({ kind, parentRecord }) =>
    kind === "parent" && parentRecord.recordModel === "collection-entry" && parentRecord.holdings[0]?.provenance));
  collection.parentRecord.locality = "General locality only";
  collection.parentRecord.holdings[0].description = "INJECTED INDIVIDUAL FORM";
  collection.parentRecord.holdings[0].provenance = "INJECTED FIND LOCATION";
  collection.parentRecord.metbull = {
    matchType: "historical-alias",
    canonicalName: "INJECTED CURRENT NAME",
    meteoriteCode: "1",
    metbullUrl: "https://www.lpi.usra.edu/meteor/metbull.cfm?code=1",
    alternateNameNote: "INJECTED LOCATION NOTE",
  };
  const collectionDto = app.presentHarmonizedCard(collection);
  assert.equal(fact(collectionDto, "Source locality"), "General locality only");
  assert.equal(fact(collectionDto, "Current Meteoritical Bulletin name"), "INJECTED CURRENT NAME");
  assert.equal(fact(collectionDto, "Specimen form"), undefined);
  assert.doesNotMatch(JSON.stringify(collectionDto), /INJECTED (?:INDIVIDUAL FORM|FIND LOCATION|LOCATION NOTE)/u);

  for (const descriptor of descriptors) {
    const dto = present(descriptor);
    const specimen = ["direct-specimen", "projected-atomic-specimen"].includes(dto.kind);
    assert.equal(fact(dto, "Individual find location"),
      specimen ? descriptor.parentRecord.individualFindLocation || "Unknown" : undefined, descriptor.parentRecord.id);
  }
});

test("Kuleschowka renders two 2.7 g repeated specimens with unknown lineage", () => {
  const cards = descriptors.filter(({ parentRecord }) => parentRecord.id === "obs-4611763e-40ee-4872-920e-968183aa348b");
  assert.equal(cards.length, 3);
  assert.deepEqual(cards.map(({ massPath, repeatedMass }) => ({ massPath, occurrence: repeatedMass?.occurrence || null })), [
    { massPath: "holdings[0].weights[0].grams", occurrence: null },
    { massPath: null, occurrence: 1 },
    { massPath: null, occurrence: 2 },
  ]);
  assert.deepEqual(cards.map((descriptor) => fact(present(descriptor), "Specimen weight")), ["5.95 g", "2.7 g", "2.7 g"]);
  assert(cards.slice(1).every((descriptor) => fact(present(descriptor), "Lineage") === "Unknown"));
  assert(cards.slice(1).every((descriptor) => app.lineageEntriesForSpecimenCard(
    descriptor, lineageIndex.get(descriptor.parentRecord.id) || []
  ).length === 0));
});

test("representative corrected and unresolved specimen cards preserve the complete Safari-safe text DTO", () => {
  const corrected = descriptors.find((descriptor) => descriptor.parentRecord.metbull?.matchType === "corrected-spelling" &&
    ["direct-specimen", "projected-atomic-specimen"].includes(app.classifyHarmonizedCard(descriptor)));
  const unresolved = descriptors.find((descriptor) => descriptor.parentRecord.metbull?.matchType === "unresolved" &&
    ["direct-specimen", "projected-atomic-specimen"].includes(app.classifyHarmonizedCard(descriptor)));
  for (const descriptor of [corrected, unresolved]) {
    const dto = present(descriptor);
    assert(["direct-specimen", "projected-atomic-specimen"].includes(dto.kind));
    assert.deepEqual(dto.facts.map(({ label }) => label), STANDARD_SPECIMEN_LABELS);
    assert(dto.facts.every(({ value }) => typeof value === "string" && value.length > 0));
  }
  assert.equal(fact(present(corrected), "Current Meteoritical Bulletin name"), corrected.parentRecord.metbull.canonicalName);
  assert.equal(fact(present(unresolved), "Current Meteoritical Bulletin name"), "Unknown");
  assert.match(styles, /overflow-wrap: anywhere;/u);
  assert.match(styles, /\.record-meta div \{[^}]*grid-template-columns: minmax\(0, 1fr\);/u);
  assert.match(styles, /\.record-meta dt \{[^}]*word-break: normal;[^}]*overflow-wrap: normal;/u);
});

test("catalog-specific source facts stay out of cards while representative hidden facts remain searchable", () => {
  const allowed = new Set([
    "Current Meteoritical Bulletin name", ...STANDARD_SPECIMEN_LABELS, ...STANDARD_OBSERVATION_LABELS
  ]);
  for (const descriptor of descriptors) {
    assert(present(descriptor).facts.every(({ label }) => allowed.has(label)), descriptor.parentRecord.id);
  }
  assert.doesNotMatch(html, /<dt>|record-holdings|metbull-name|lineage-row|earlier-records/u);

  for (const record of records.filter(({ recordModel }) => recordModel === "table-a-specimen")) {
    assert.equal(app.matchesSearch(record, record.locality.code), true, record.id);
    if (record.locality.coordinate) assert.equal(app.matchesSearch(record, record.locality.coordinate), true, record.id);
    if (record.olivineFa) assert.equal(app.matchesSearch(record, `olivine Fa ${record.olivineFa}`), true, record.id);
    if (record.pyroxeneFs) assert.equal(app.matchesSearch(record, `pyroxene Fs ${record.pyroxeneFs}`), true, record.id);
    if (record.weathering) assert.equal(app.matchesSearch(record, `weathering ${record.weathering}`), true, record.id);
    assert.equal(app.matchesSearch(record, "Table A"), true, record.id);
  }
  for (const record of records.filter(({ recordModel }) => recordModel === "regional-census-fact")) {
    assert.equal(app.matchesSearch(record, record.section), true, record.id);
  }
  const hamburg = records.find(({ catalogId, name }) => catalogId === "hamburg-1913" && name === "Stannern");
  assert.equal(app.matchesSearch(hamburg, "reported total"), true);
  assert.equal(app.matchesSearch(hamburg, "Representations: 2 thin sections"), true);
  const noted = records.find(({ metbull }) => metbull?.alternateNameNote);
  assert.equal(app.matchesSearch(noted, noted.metbull.alternateNameNote), true);
});

test("projection changes display-card multiplicity without changing parent result counts", () => {
  const filters = { query: "", catalog: null, min: null, max: null, lineageOnly: false, sort: app.DEFAULT_SORT };
  assert.equal(app.filterRecords(records, filters, lineageIndex).length, 14176);
  assert.equal(new Set(descriptors.map(({ parentRecord }) => parentRecord.id)).size, 14176);
  for (const descriptor of catalog.metadata.catalogs) {
    const parents = app.filterRecords(records, { ...filters, catalog: descriptor.id }, lineageIndex);
    assert.equal(parents.length, descriptor.recordCount, descriptor.id);
    assert.equal(new Set(descriptors.filter(({ parentRecord }) => parentRecord.catalogId === descriptor.id)
      .map(({ parentRecord }) => parentRecord.id)).size, descriptor.recordCount, descriptor.id);
  }
});

test("accessible shell, responsive breakpoints, approved cache, and immutable data hashes are locked", () => {
  assert.match(html, /<div id="results" class="catalog-grid" aria-busy="true"><\/div>/u);
  assert.match(html, /id="status" class="status" role="status" aria-live="polite"/u);
  assert.match(html, /<article class="record-card">[\s\S]*<p class="record-semantic-label"><\/p>[\s\S]*<h3 class="record-name"><\/h3>/u);
  assert.match(html, /<dl class="record-meta" aria-label="Catalog record details"><\/dl>/u);
  assert.match(html, /<p class="record-source"><\/p>/u);
  assert.match(styles, /\.catalog-grid \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/u);
  assert.match(styles, /@media \(max-width: 1200px\)[\s\S]*\.catalog-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/u);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.catalog-grid \{ grid-template-columns: 1fr; \}/u);
  assert.match(styles, /@media \(max-width: 420px\)[\s\S]*\.record-card \{ padding-inline: 1rem; \}/u);
  assert.doesNotMatch(styles, /\.record-meta dt \{[^}]*overflow-wrap: anywhere;/u);
  assert.equal(app.CACHE_VERSION, "20260901-card-labels-1");
  assert.equal(app.ASSET_CACHE_VERSION, "20260901-card-labels-1");
  for (const document of [html, catalogsHtml]) {
    assert.match(document, /styles\.css\?v=20260901-card-labels-1/u);
    assert.match(document, /app\.js\?v=20260901-card-labels-1/u);
  }
  assert.match(catalogsHtml, /catalogs\.js\?v=20260901-card-labels-1/u);
  assert.deepEqual({
    catalog: sha256(catalogText),
    projections: sha256(projectionText),
    lineages: sha256(lineageText),
    reviews: sha256(reviewText),
  }, {
    catalog: "f5435256d1ff5c9500217112c8beeb7141e278487b3a1e98b5bb86e162739c0e",
    projections: "5df8dd03261f1ba47c374401fa5a1df1828860a7802adb680e56c7bcf1ce4d1e",
    lineages: "bf73d5fe32aa88b123a110db3108c45cd2053c2f32ac5463fa52035b859291b7",
    reviews: "966326e41d0e2d75b7be129dab1aab19a8f7f8be786141392cb2aabcf8940fe8",
  });
});
