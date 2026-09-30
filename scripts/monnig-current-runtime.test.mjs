import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validatePublicCatalog } from "./validate-public-catalog.mjs";

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const app = require("../app.js");

const [catalogText, foliosText, projectionsText, lineagesText, currentContextText, appSource] = await Promise.all([
  readFile(new URL("../data/catalog.json", import.meta.url), "utf8"),
  readFile(new URL("../data/folios.json", import.meta.url), "utf8"),
  readFile(new URL("../data/specimen-card-projections.json", import.meta.url), "utf8"),
  readFile(new URL("../data/specimen-lineages.json", import.meta.url), "utf8"),
  readFile(new URL("../data/metbull-current-context.json", import.meta.url), "utf8"),
  readFile(new URL("../app.js", import.meta.url), "utf8"),
]);
const catalog = JSON.parse(catalogText);
const folios = JSON.parse(foliosText);
const projections = JSON.parse(projectionsText);
const lineages = JSON.parse(lineagesText);
const currentContext = JSON.parse(currentContextText);
const registry = app.normalizeCatalogRegistry(catalog.metadata);
const records = catalog.records.map((record, index) => app.prepareRecord(record, index, registry));
const monnig = records.filter(({ catalogId }) => catalogId === "monnig-current");
const projectionIndex = app.deriveSpecimenCardProjectionIndex(projections, records, {
  sourceCatalogSha256: app.CATALOG_SHA256,
});
const rawDescriptors = app.expandSpecimenCardDescriptors(records, projectionIndex);
const currentContextIndex = app.deriveMetbullCurrentContextIndex(currentContext, rawDescriptors);
const descriptors = app.attachMetbullCurrentContext(rawDescriptors, currentContextIndex);
const monnigDescriptors = descriptors.filter(({ parentRecord }) => parentRecord.catalogId === "monnig-current");
const lineageIndex = app.deriveEarlierRecordIndex(lineages, records, registry);
const comparisonIndex = app.deriveComparisonGroupIndex(lineages, records, registry);

test("page-less specimen catalogs are generic and fail closed on invalid page, model, and weight shapes", () => {
  assert.doesNotThrow(() => app.validateCatalog(catalog));
  assert.doesNotThrow(() => validatePublicCatalog(catalog, folios));

  const generic = structuredClone(catalog);
  const descriptor = generic.metadata.catalogs.find(({ id }) => id === "monnig-current");
  descriptor.id = "current-collection";
  generic.records.filter(({ catalogId }) => catalogId === "monnig-current")
    .forEach((record) => { record.catalogId = descriptor.id; });
  assert.doesNotThrow(() => app.validateCatalog(generic));

  for (const mutate of [
    (value) => { value.metadata.catalogs.find(({ id }) => id === "current-collection").recordModel = "collection-entry"; },
    (value) => {
      const current = value.metadata.catalogs.find(({ id }) => id === "current-collection");
      current.sourcePages = [1];
      current.sourcePageCount = 1;
    },
    (value) => { value.records.find(({ catalogId }) => catalogId === "current-collection").catalogPage = 1; },
    (value) => { value.records.find(({ catalogId }) => catalogId === "current-collection").weight = { grams: null }; },
  ]) {
    const changed = structuredClone(generic);
    mutate(changed);
    assert.throws(() => app.validateCatalog(changed), /facts-only schema/u);
  }

  assert.doesNotMatch(appSource.replace(/^const CACHE_VERSION = .*$/mu, ""), /["']monnig-current["']/u);
});

test("all 3,218 Monnig observations become source-only direct specimen cards", () => {
  assert.equal(monnig.length, 3218);
  assert.equal(monnigDescriptors.length, 3218);
  assert(monnigDescriptors.every((descriptor) =>
    !descriptor.projected && app.classifyHarmonizedCard(descriptor) === "direct-specimen"));
  assert(monnigDescriptors.every(({ currentMetbull }) => currentMetbull === null));
  assert(monnigDescriptors.every(({ parentRecord }) =>
    !(lineageIndex.get(parentRecord.id)?.length) && !(comparisonIndex.get(parentRecord.id)?.length)));

  const dtos = monnigDescriptors.map((descriptor) => app.presentHarmonizedCard(descriptor, {
    lineageEntries: lineageIndex.get(descriptor.parentRecord.id) || [],
    comparisonEntries: comparisonIndex.get(descriptor.parentRecord.id) || [],
    registry,
  }));
  assert(dtos.every((dto, index) => dto.identifier ===
    `Monnig Current (2026) · ${monnigDescriptors[index].parentRecord.designation}`));
  assert(dtos.every((dto) => dto.sourceCitation === "Monnig Current" && dto.sourceLabel === "Monnig Current"));
  assert(dtos.every((dto) => dto.catalogPages.length === 0 && dto.headingUrl === null));
  assert(dtos.every((dto) => dto.catalogNotes.length === 0 && dto.lineage.claims.length === 0 && dto.comparison.groups.length === 0));
  assert.equal(dtos.filter(({ facts }) => facts.some(({ label }) => label === "Weight")).length, 3187);
  assert.equal(dtos.filter(({ facts }) => facts.some(({ label }) => label === "Class")).length, 3134);
  assert.equal(dtos.filter(({ facts }) => facts.some(({ label }) => label === "Place")).length, 3208);
  assert.equal(dtos.filter(({ facts }) => facts.some(({ label }) => label === "Year / date")).length, 3122);
  assert(dtos.every(({ facts }) => facts.some(({ label, value }) => label === "Form" && value === "Specimen")));
});

test("72 collapsed Unknown classifications remain searchable but honor placeholder suppression", () => {
  const unknown = monnigDescriptors.filter(({ parentRecord }) => parentRecord.classification === "Unknown");
  assert.equal(unknown.length, 72);
  assert.equal(app.isKnownCardFact("Catalog classification", "Unknown"), false);
  assert(unknown.every(({ parentRecord }) => app.matchesSearch(parentRecord, "Unknown")));
  assert(unknown.every((descriptor) => !app.presentHarmonizedCard(descriptor, { registry }).facts
    .some(({ label }) => label === "Class")));
});

test("Monnig search, filters, and all supported sorts retain source occurrences", () => {
  const baseFilters = { catalog: "monnig-current", min: null, max: null, lineageOnly: false };
  assert.equal(app.filterRecords(records, { ...baseFilters, query: "", sort: "designation-asc" }).length, 3218);
  assert.equal(app.filterRecords(records, { ...baseFilters, query: "M22326", sort: "designation-asc" }).length, 2);
  assert.equal(app.filterRecords(records, { ...baseFilters, query: "Allende", sort: "name-asc" }).length, 8);
  assert.equal(app.filterSpecimenCardDescriptors(monnigDescriptors, {
    ...baseFilters, query: "", includeUnknownWeight: false,
  }, lineageIndex).length, 3187);
  assert.equal(app.filterSpecimenCardDescriptors(monnigDescriptors, {
    ...baseFilters, query: "", includeUnknownWeight: true,
  }, lineageIndex).length, 3218);
  for (const sort of ["designation-asc", "designation-desc", "name-asc", "name-desc", "weight-asc", "weight-desc"]) {
    const sorted = app.filterRecords(records, { ...baseFilters, query: "", sort });
    assert.equal(sorted.length, 3218, sort);
    assert.equal(new Set(sorted.map(({ id }) => id)).size, 3218, sort);
  }
});

test("Monnig directory and source relations expose no page or folio action", () => {
  const summary = app.catalogSummaryEntries(registry).find(({ id }) => id === "monnig-current");
  assert.deepEqual(summary, {
    id: "monnig-current",
    label: "Monnig Current",
    year: 2026,
    compiler: "Texas Christian University",
    pageCoverage: "No pages recorded",
    observationCount: 3218,
  });
  assert.equal(app.validateFolioManifest(folios, registry), true);
  assert.deepEqual(app.getAuthorizedFolioPages(folios, "monnig-current", registry), []);
  assert.equal(app.getAuthorizedFolio(folios, "monnig-current", null, registry), null);
  assert.equal(app.getAuthorizedFolio(folios, "monnig-current", 1, registry), null);
});

test("current-context assignments explicitly keep every Monnig card unmapped", () => {
  const assignments = app.reconstructMetbullCardAssignments(currentContext, rawDescriptors);
  const monnigCardKeys = new Set(monnigDescriptors.map(app.metbullCardKey));
  const monnigAssignments = assignments.filter(({ cardKey }) => monnigCardKeys.has(cardKey));
  assert.equal(monnigAssignments.length, 3218);
  assert(monnigAssignments.every(({ status }) => status === "unmapped"));

  const changed = structuredClone(currentContext);
  changed.metadata.unmappedDirectCardCount -= 1;
  changed.metadata.mappedDirectCardCount += 1;
  assert.equal(app.validateMetbullCurrentContext(changed, rawDescriptors), false);
});
