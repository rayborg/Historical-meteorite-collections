import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const app = require("../app.js");
const [catalogText, fixture, projections, lineages, html, styles, source] = await Promise.all([
  readFile(new URL("../data/catalog.json", import.meta.url), "utf8"),
  readFile(new URL("./test-multicatalog-fixture.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/specimen-card-projections.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/specimen-lineages.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8"),
  readFile(new URL("../app.js", import.meta.url), "utf8"),
]);
const catalog = JSON.parse(catalogText);
const registry = app.normalizeCatalogRegistry(catalog.metadata);
const records = catalog.records.map((record, index) => app.prepareRecord(record, index, registry));
const hodge = records.filter(({ catalogId }) => catalogId === "hodge-smith-1939");
const victoria = records.filter(({ catalogId }) => catalogId === "victoria-land-1982");

const clone = structuredClone;
const fixtureRecord = (document, catalogId) => document.records.find((record) => record.catalogId === catalogId);

test("schema 11 runtime accepts all closed models and rejects schema or shape widening", () => {
  assert.equal(app.validateCatalog(clone(fixture)).metadata.schemaVersion, 11);
  for (const mutate of [
    (value) => { value.metadata.schemaVersion = 10; },
    (value) => { value.metadata.factualFields.splice(9, 1); },
    (value) => { fixtureRecord(value, "hodge-smith-1939").holdings = []; },
    (value) => { fixtureRecord(value, "hodge-smith-1939").weight = { grams: 1 }; },
    (value) => { fixtureRecord(value, "victoria-land-1982").name = "Inferred name"; },
    (value) => { fixtureRecord(value, "victoria-land-1982").designation = "Inferred designation"; },
    (value) => { fixtureRecord(value, "victoria-land-1982").lineage = "forged"; },
  ]) {
    const changed = clone(fixture);
    mutate(changed);
    assert.throws(() => app.validateCatalog(changed), /facts-only schema/u);
  }
});

test("regional census validation fails closed on identity, representation, section, and citation mutations", () => {
  const mutations = [
    (record) => { record.entryOrder = 0; },
    (record) => { record.reportedNumber = ""; },
    (record) => { record.section = ""; },
    (record) => { record.name = ""; },
    (record) => { record.classification = ""; },
    (record) => { record.eventDate = ""; },
    (record) => { record.catalogPages = []; },
    (record) => { record.catalogPages = [10]; },
    (record) => { record.australianMuseumRepresentation.status = "holding"; },
    (record) => { record.australianMuseumRepresentation.status = "represented"; },
    (record) => { record.australianMuseumRepresentation.representedOccurrences = -1; },
    (record) => { record.australianMuseumRepresentation.notRepresentedOccurrences = 0; },
    (record) => { record.australianMuseumRepresentation.extra = true; },
  ];
  for (const mutate of mutations) {
    const changed = clone(fixture);
    mutate(fixtureRecord(changed, "hodge-smith-1939"));
    assert.throws(() => app.validateCatalog(changed), /facts-only schema/u);
  }
});

test("Table A validation fails closed on specimen, mass, composition, locality, and citation mutations", () => {
  const mutations = [
    (record) => { record.entryOrder = 0; },
    (record) => { record.specimenId = "ALH 76001"; },
    (record) => { record.specimenId = "ALHA7600"; },
    (record) => { record.weight.grams = 0; },
    (record) => { record.weight.grams = Infinity; },
    (record) => { record.classification = ""; },
    (record) => { record.olivineFa = ""; },
    (record) => { record.pyroxeneFs = ""; },
    (record) => { record.weathering = ""; },
    (record) => { record.locality.code = "Alh"; },
    (record) => { record.locality.name = ""; },
    (record) => { record.locality.areaReferenceCoordinate = ""; },
    (record) => { record.locality.extra = "private-looking"; },
    (record) => { record.catalogPage = 90; },
  ];
  for (const mutate of mutations) {
    const changed = clone(fixture);
    mutate(fixtureRecord(changed, "victoria-land-1982"));
    assert.throws(() => app.validateCatalog(changed), /facts-only schema/u);
  }
});

test("all Hodge-Smith source facts remain searchable but representation counters stay off cards", () => {
  assert.equal(hodge.length, 84);
  assert(hodge.every((record) => record.recordModel === "regional-census-fact"));
  assert(hodge.every((record) => !("holdings" in record) && !("weight" in record) && app.recordMasses(record).length === 0));
  for (const record of hodge) {
    assert.equal(app.matchesSearch(record, record.name), true, record.id);
    if (record.reportedNumber) assert.equal(app.matchesSearch(record, `reported no. ${record.reportedNumber}`), true, record.id);
    assert.equal(app.matchesSearch(record, record.section), true, record.id);
    if (record.classification) assert.equal(app.matchesSearch(record, record.classification), true, record.id);
    if (record.eventDate) assert.equal(app.matchesSearch(record, record.eventDate), true, record.id);
    for (const { label, value } of app.regionalCensusFacts(record)) {
      assert.equal(app.matchesSearch(record, `${label} ${value}`), true, `${record.id}: ${label}`);
    }
  }
  const mixed = hodge.find(({ australianMuseumRepresentation }) => australianMuseumRepresentation.status === "mixed");
  assert.deepEqual(app.regionalCensusFacts(mixed), [
    { label: "Australian Museum representation", value: "Mixed representation in the Australian Museum" },
    { label: "Represented occurrences", value: String(mixed.australianMuseumRepresentation.representedOccurrences) },
    { label: "Not represented occurrences", value: String(mixed.australianMuseumRepresentation.notRepresentedOccurrences) },
  ]);
  for (const record of hodge) {
    const dto = app.presentHarmonizedCard(record);
    assert.equal(dto.facts.some(({ label }) => /Australian Museum|occurrences/u.test(label)), false, record.id);
  }
  const reviewed = hodge.filter((record) => record.metbull);
  assert.equal(reviewed.length, 58);
  assert(reviewed.every((record) => app.namesAreDisplayEquivalent(record.name, record.metbull.canonicalName)));
  assert(reviewed.every((record) => app.metbullPanelDetails(record) === null));
});

test("all Victoria Land Table A specimens preserve exact identifiers and searchable scientific facts", () => {
  assert.equal(victoria.length, 273);
  assert.equal(new Set(victoria.map(({ specimenId }) => specimenId)).size, victoria.length);
  assert(victoria.every((record) => record.recordModel === "table-a-specimen" && record.name === record.specimenId &&
    record.metbull.matchType === "official-abbreviation"));
  for (const record of victoria) {
    assert.deepEqual(app.recordMasses(record), [record.weight.grams], record.id);
    assert.equal(app.matchesSearch(record, record.specimenId), true, record.id);
    assert.equal(app.matchesSearch(record, String(record.weight.grams)), true, record.id);
    assert.equal(app.matchesSearch(record, record.classification), true, record.id);
    assert.equal(app.matchesSearch(record, record.locality.code), true, record.id);
    assert.equal(app.matchesSearch(record, record.locality.name), true, record.id);
    if (record.locality.areaReferenceCoordinate) assert.equal(app.matchesSearch(record, record.locality.areaReferenceCoordinate), true, record.id);
    assert.equal(app.matchesSearch(record, record.metbull.canonicalName), true, record.id);
    assert.equal(app.matchesSearch(record, record.metbull.meteoriteCode), true, record.id);
    if (record.olivineFa) assert.equal(app.matchesSearch(record, `olivine Fa ${record.olivineFa}`), true, record.id);
    if (record.pyroxeneFs) assert.equal(app.matchesSearch(record, `pyroxene Fs ${record.pyroxeneFs}`), true, record.id);
    if (record.weathering) assert.equal(app.matchesSearch(record, `weathering ${record.weathering}`), true, record.id);
    assert.equal(app.matchesSearch(record, "Table A"), true, record.id);
  }
  assert.deepEqual(app.tableASpecimenFacts(victoria[0]), [
    { label: "Locality code", value: "ALH" },
    { label: "Area reference coordinate", value: "76°45'S, 159°40'E" },
    { label: "Olivine Fa", value: "25" },
    { label: "Pyroxene Fs", value: "21" },
    { label: "Weathering", value: "A" },
    { label: "Source section", value: "Table A" },
  ]);
  assert.deepEqual(app.filterRecords(victoria, {
    query: "", catalog: "victoria-land-1982", min: 20151, max: 20151, lineageOnly: false, sort: "weight-desc",
  }).map(({ specimenId }) => specimenId), ["ALHA76001"]);
  assert.equal(app.filterRecords([...victoria].reverse(), {
    query: "", catalog: "victoria-land-1982", min: null, max: null, lineageOnly: false, sort: "designation-asc",
  })[0].specimenId, "ALHA76001");
});

test("statistics count each Victoria mass once, no Hodge mass, and retain parent observation semantics", () => {
  const hodgeStats = app.calculateStatistics(hodge);
  const victoriaStats = app.calculateStatistics(victoria);
  const legacy = records.filter(({ recordModel }) => !["regional-census-fact", "table-a-specimen"].includes(recordModel));
  const total = app.calculateStatistics(records);
  assert.deepEqual({ observations: hodgeStats.observations, grams: hodgeStats.grams }, { observations: 84, grams: 0 });
  assert.equal(victoriaStats.observations, 273);
  assert.equal(victoriaStats.grams, victoria.reduce((sum, record) => sum + record.weight.grams, 0));
  assert.equal(total.observations, 14477);
  assert.equal(total.catalogs, 40);
  assert(Math.abs(total.grams - (app.calculateStatistics(legacy).grams + victoriaStats.grams)) < 1e-6);
});

test("lineage and projection enhancements bind schema 11 and retain exact source-attested groups", () => {
  assert.equal(lineages.metadata.source.catalogSchemaVersion, 11);
  const lineageIndex = app.deriveEarlierRecordIndex(lineages, records, registry);
  assert(hodge.every(({ id }) => !lineageIndex.has(id)));
  assert.equal(victoria.filter(({ id }) => lineageIndex.get(id)?.some(({ kind }) =>
    kind === "source-attested-tentative-pairing-group")).length, 77);
  assert.equal([...lineageIndex.values()].flat().filter(({ kind }) =>
    kind === "source-attested-tentative-pairing-group").length, 79);
  const sourceCatalogSha256 = createHash("sha256").update(catalogText).digest("hex");
  assert.equal(sourceCatalogSha256, projections.metadata.sourceCatalogSha256);
  const projectionIndex = app.deriveSpecimenCardProjectionIndex(projections, records, { sourceCatalogSha256 });
  assert.equal(projectionIndex.size, 2224);
  const descriptors = app.expandSpecimenCardDescriptors([...hodge, ...victoria], projectionIndex);
  assert.equal(descriptors.length, 357);
  assert(descriptors.every(({ kind, projected }) => kind === "parent" && projected === false));
});

test("schema 11 card semantics, cache keys, responsive layout, and privacy boundary are explicit", () => {
  assert.match(html, /<p class="record-semantic-label"><\/p>/u);
  const hodgeDto = app.presentHarmonizedCard(hodge[0]);
  const victoriaDto = app.presentHarmonizedCard(victoria[0]);
  assert.equal(hodgeDto.semanticLabel, "Regional census/catalog observation, not a specimen or holding.");
  assert.equal(victoriaDto.facts.find(({ label }) => label === "Specimen form").value, "Individual specimen");
  assert.equal(victoriaDto.facts.some(({ label }) => label === "Coordinate"), false);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.catalog-grid \{ grid-template-columns: 1fr; \}/u);
  assert.match(styles, /\.record-meta div \{[^}]*grid-template-columns: minmax\(0, 1fr\);/u);
  assert.match(styles, /\.record-meta dt \{[^}]*overflow-wrap: normal;/u);
  assert.equal(app.CACHE_VERSION, "20260904-victoria-public-1");
  assert.equal(app.ASSET_CACHE_VERSION, "20260904-victoria-public-1");
  assert.match(html, /styles\.css\?v=20260904-victoria-public-1/u);
  assert.match(html, /app\.js\?v=20260904-victoria-public-1/u);
  const newSourceRecords = catalog.records.filter(({ catalogId }) => ["hodge-smith-1939", "victoria-land-1982"].includes(catalogId));
  assert.doesNotMatch(JSON.stringify(newSourceRecords), /(?:raw[ _-]*ocr|\/private\/|\/Users\/|source[ _-]*image|scan[ _-]*(?:file|path)|research[ _-]*notes?)/iu);
});
