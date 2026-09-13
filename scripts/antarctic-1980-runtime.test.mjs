import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const app = require("../app.js");
const [catalogText, folios, sourceClaims, currentContext] = await Promise.all([
  readFile(new URL("../data/catalog.json", import.meta.url), "utf8"),
  readFile(new URL("../data/folios.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/source-claims.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/metbull-current-context.json", import.meta.url), "utf8").then(JSON.parse),
]);
const catalog = JSON.parse(catalogText);
const registry = app.normalizeCatalogRegistry(catalog.metadata);
const records = catalog.records.map((record, index) => app.prepareRecord(record, index, registry));
const antarctic = records.filter(({ catalogId }) => catalogId === "antarctic-1980");
const descriptors = app.expandSpecimenCardDescriptors(antarctic);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const fact = (dto, label) => dto.facts.find((entry) => entry.label === label)?.value;

test("installs the accepted schema-13 Antarctic 1980 package and closed census", () => {
  assert.equal(sha256(catalogText), "9c11b7478b2ec1ce4bd8d13c275272b28f6409570c246820c2e3ce28f2f73e74");
  assert.deepEqual({ schema: catalog.metadata.schemaVersion, catalogs: catalog.metadata.catalogs.length,
    records: catalog.records.length }, { schema: 13, catalogs: 53, records: 19638 });
  assert.equal(app.validateCatalog(catalog), catalog);
  assert.deepEqual(registry["antarctic-1980"], {
    id: "antarctic-1980",
    recordModel: "appendix-specimen",
    label: "Catalog of Antarctic Meteorites, 1977-1978 (1980)",
    compiler: "Ursula B. Marvin; Brian Mason",
    year: 1980,
    sourcePages: [47, 48],
    sourcePageCount: 2,
    recordCount: 85,
    recordsWithDesignation: 85,
    recordsWithWeight: 85,
    confidenceCounts: { high: 85, medium: 0, low: 0 },
    folioDisplayPolicy: "blocked",
    rightsStatus: "undetermined",
    displayLabel: "Catalog of Antarctic Meteorites, 1977-1978 (1980)",
  });
  assert.equal(sha256(JSON.stringify(catalog.records.filter(({ catalogId }) => catalogId === "antarctic-1980"))),
    "c44e0b794a25f18088f836b32b10504dc955bddc0bb105d7fab595d46929fb08");
  assert.equal(antarctic.reduce((sum, record) => sum + record.weight.grams, 0), 89891.09999999999);
  assert.deepEqual([...new Set(antarctic.map(({ catalogPage }) => catalogPage))], [47, 48]);
  assert.deepEqual({
    olivineFa: antarctic.filter(({ olivineFa }) => olivineFa === null).length,
    pyroxeneFs: antarctic.filter(({ pyroxeneFs }) => pyroxeneFs === null).length,
    weathering: antarctic.filter(({ weathering }) => weathering === null).length,
  }, { olivineFa: 9, pyroxeneFs: 7, weathering: 6 });
  assert.deepEqual(Object.fromEntries([...Map.groupBy(antarctic, ({ classification }) => classification)]
    .sort(([left], [right]) => left.localeCompare(right)).map(([classification, values]) => [classification, values.length])), {
    A: 1, C2: 1, C3: 1, Di: 1, Eu: 1, "H?": 1, H3: 2, H4: 8, H5: 19, H6: 6,
    iron: 6, L3: 10, L4: 5, L5: 2, L6: 17, LL3: 2, M: 1, Ur: 1,
  });
});

test("all 85 appendix rows become one direct individual card with exact source facts", () => {
  assert.equal(descriptors.length, 85);
  for (const descriptor of descriptors) {
    const record = descriptor.parentRecord;
    assert.equal(descriptor.projected, false, record.id);
    assert.equal(app.classifyHarmonizedCard(descriptor), "direct-specimen", record.id);
    assert.deepEqual(app.recordMasses(record), [record.weight.grams], record.id);
    assert.equal(record.name, record.specimenId, record.id);
    assert.equal(record.locality.code, "ALH", record.id);
    assert.equal(record.locality.name, "Allan Hills", record.id);
    assert.equal(record.locality.areaReferenceCoordinate, "77°S, 159°E", record.id);
    assert.equal(Object.hasOwn(record, "sourceEvidence"), false, record.id);
    const dto = app.presentHarmonizedCard(descriptor);
    assert.equal(dto.identifier, `Antarctic (1980) · ${record.specimenId}`, record.id);
    assert.equal(dto.headingName, record.specimenId, record.id);
    assert.equal(fact(dto, "Specimen form"), "Individual specimen", record.id);
    assert.equal(fact(dto, "Catalog classification"), record.classification, record.id);
    assert.equal(fact(dto, "Source locality"), "Allan Hills", record.id);
    assert.equal(fact(dto, "Specimen weight"), app.formatMass(record.weight.grams), record.id);
    assert.equal(fact(dto, "Locality code"), "ALH", record.id);
    assert.equal(fact(dto, "Area reference coordinate"), "77°S, 159°E", record.id);
    assert.equal(fact(dto, "Olivine Fa"), record.olivineFa ?? undefined, record.id);
    assert.equal(fact(dto, "Pyroxene Fs"), record.pyroxeneFs ?? undefined, record.id);
    assert.equal(fact(dto, "Weathering"), record.weathering ?? undefined, record.id);
    assert.equal(fact(dto, "Source section"), "Appendix", record.id);
    assert.equal(dto.sourceCitation,
      `${registry[record.catalogId].label} · Appendix printed page ${record.catalogPage}`, record.id);
    assert.doesNotMatch(JSON.stringify(dto), /Table [AB]|conflict|sourceEvidence/u, record.id);
  }
});

test("synthetic current context supplies official headings without replacing appendix source facts", () => {
  for (const descriptor of descriptors) {
    const record = descriptor.parentRecord;
    const current = currentContext.meteorites[record.metbull.meteoriteCode];
    assert(current, record.id);
    const dto = app.presentHarmonizedCard(descriptor, {
      currentMetbull: { meteoriteCode: record.metbull.meteoriteCode, ...current },
    });
    assert.equal(dto.headingName, record.metbull.canonicalName, record.id);
    assert.equal(dto.headingLabel, "Current MetBull meteorite name", record.id);
    assert.equal(fact(dto, "Current MetBull classification"), current.classification, record.id);
    assert.equal(fact(dto, "Olivine Fa"), record.olivineFa ?? undefined, record.id);
    assert.equal(fact(dto, "Pyroxene Fs"), record.pyroxeneFs ?? undefined, record.id);
    assert.equal(fact(dto, "Weathering"), record.weathering ?? undefined, record.id);
    assert(dto.catalogNotes.some(({ label, value }) => label === "Catalog meteorite name" && value === record.name), record.id);
  }
});

test("appendix specimen IDs, source facts, mass filters, and sorting are searchable", () => {
  for (const record of antarctic) {
    assert.equal(app.matchesSearch(record, record.specimenId), true, record.id);
    assert.equal(app.matchesSearch(record, `${record.specimenId.slice(0, 4)} ${record.specimenId.slice(4)}`), true, record.id);
    assert.equal(app.matchesSearch(record, record.specimenId.slice(-5)), true, record.id);
    assert.equal(app.matchesSearch(record, `Class ${record.classification}`), true, record.id);
    assert.equal(app.matchesSearch(record, String(record.weight.grams)), true, record.id);
    if (record.olivineFa) assert.equal(app.matchesSearch(record, `olivine Fa ${record.olivineFa}`), true, record.id);
    if (record.pyroxeneFs) assert.equal(app.matchesSearch(record, `pyroxene Fs ${record.pyroxeneFs}`), true, record.id);
    if (record.weathering) assert.equal(app.matchesSearch(record, `weathering ${record.weathering}`), true, record.id);
    assert.equal(app.matchesSearch(record, "Appendix"), true, record.id);
  }
  assert.equal(app.filterRecords(antarctic, {
    query: "", catalog: "antarctic-1980", min: 252, max: 252, lineageOnly: false, sort: "weight-asc",
  }).some(({ specimenId }) => specimenId === "ALHA77001"), true);
  assert.equal(app.filterRecords([...antarctic].reverse(), {
    query: "", catalog: "antarctic-1980", min: null, max: null, lineageOnly: false, sort: "designation-asc",
  })[0].specimenId, "ALHA77001");
  assert.equal(app.calculateStatistics(antarctic).grams, 89891.1);
});

test("Antarctic folios remain blocked and source claims remain absent", () => {
  assert.deepEqual(folios.catalogs["antarctic-1980"], {
    displayPolicy: "blocked", rightsStatus: "undetermined", pages: [],
  });
  assert.equal(app.getAuthorizedFolioPages(folios, "antarctic-1980", registry).length, 0);
  assert.equal(app.getAuthorizedFolio(folios, "antarctic-1980", 47, registry), null);
  assert.equal(sourceClaims.claims.some(({ catalogId }) => catalogId === "antarctic-1980"), false);
  const publicBoundary = JSON.stringify({
    descriptor: catalog.metadata.catalogs.find(({ id }) => id === "antarctic-1980"),
    records: catalog.records.filter(({ catalogId }) => catalogId === "antarctic-1980"),
    folios: folios.catalogs["antarctic-1980"],
  });
  assert.doesNotMatch(publicBoundary,
    /raw[ _-]*ocr|\/private\/|\/Users\/|source[ _-]*(?:image|file)|scan[ _-]*(?:file|path)|research[ _-]*notes?/iu);
});

test("runtime rejects appendix shape, model, page, locality, and source-field mutations", () => {
  const mutations = [
    (value) => { value.metadata.catalogs.find(({ id }) => id === "antarctic-1980").recordModel = "table-a-specimen"; },
    (value) => { value.records.find(({ catalogId }) => catalogId === "antarctic-1980").sourceEvidence = {}; },
    (value) => { value.records.find(({ catalogId }) => catalogId === "antarctic-1980").specimenId = "ALH 77001"; },
    (value) => { value.records.find(({ catalogId }) => catalogId === "antarctic-1980").catalogPage = 49; },
    (value) => { value.records.find(({ catalogId }) => catalogId === "antarctic-1980").locality.name = "Victoria Land"; },
    (value) => { value.records.find(({ catalogId }) => catalogId === "antarctic-1980").olivineFa = null; },
    (value) => { value.metadata.catalogs.find(({ id }) => id === "antarctic-1980").recordCount = 84; },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(catalog);
    mutate(changed);
    assert.throws(() => app.validateCatalog(changed), /facts-only schema/u);
  }
});
