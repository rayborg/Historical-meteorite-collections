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
  "kind", "identifier", "semanticLabel", "sourceName", "description", "facts", "sourceCitation", "sourceLabel", "catalogId", "catalogPages", "lineage"
];
const STANDARD_SPECIMEN_LABELS = [
  "Class", "Specimen form", "Source locality",
  "Individual find location", "Event", "Lineage", "Specimen weight"
];
const STANDARD_OBSERVATION_LABELS = ["Class", "Source locality", "Event"];
const FLETCHER_OBSERVATION_LABELS = ["Class", "Source locality", "Date or report of find"];
const FLETCHER_LABELS = ["Section", "Pane or case", "Reference", "Represented weight"];
const SEMANTIC_LABELS = {
  "direct-specimen": "Specimen.",
  "projected-atomic-specimen": "Individual specimen.",
  "source-observation": "Source catalog observation; reviewed as plural terrestrial material, not an individual specimen.",
  "collection-observation": "Collection catalog observation; not asserted here as one individual specimen.",
  "regional-observation": "Regional census/catalog observation, not a specimen or holding.",
  "dealer-observation": "Dealer catalog observation, not a specimen or holding",
  "collection-representation-observation": "Collection representation observation; not a specimen, holding, or inventory identity.",
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

function expectedSourceIdentifier(descriptor, kind) {
  const record = descriptor.parentRecord;
  if (kind === "projected-atomic-specimen") {
    return app.specimenCardHolding(record, descriptor.holdingPath)?.holding?.designation || null;
  }
  if (record.recordModel === "catalog-item") return `Catalog item ${record.catalogItem}`;
  if (record.recordModel === "catalog-number") return `Catalog no. ${record.catalogNumber}`;
  if (record.recordModel === "collection-entry") {
    return record.reportedNumber ? `Reported no. ${record.reportedNumber}` : `Collection entry ${record.entryOrder}`;
  }
  if (record.recordModel === "regional-census-fact") {
    return record.reportedNumber ? `Source number ${record.reportedNumber}` : `Regional census entry ${record.entryOrder}`;
  }
  if (record.recordModel === "collection-representation-fact") {
    return record.reportedNumber ? `List no. ${record.reportedNumber}` : `Collection representation ${record.entryOrder}`;
  }
  if (record.recordModel === "table-a-specimen") return record.specimenId || null;
  if (record.recordModel === "dealer-offer-fact") return `Type number ${record.typeNumber}`;
  return record.designation || null;
}

function expectedIdentifier(descriptor, kind) {
  const sourceIdentifier = expectedSourceIdentifier(descriptor, kind);
  const catalogId = descriptor.parentRecord.catalogId;
  return sourceIdentifier
    ? `${app.catalogDropdownLabel(registry[catalogId], catalogId)} · ${sourceIdentifier}`
    : null;
}

function expectedEvent(record) {
  if (record.recordModel === "catalog-number") return record.dateOfDiscovery;
  if (["collection-entry", "regional-census-fact", "collection-representation-fact"].includes(record.recordModel)) return record.eventDate;
  if (["specimen", "catalog-item"].includes(record.recordModel)) return record.year;
  return null;
}

function expectedFacts(descriptor) {
  const record = descriptor.parentRecord;
  const kind = app.classifyHarmonizedCard(descriptor);
  const specimen = ["direct-specimen", "projected-atomic-specimen"].includes(kind);
  const entries = [];
  const add = (label, value) => {
    if (typeof value === "string" && value.length > 0 && value.toLocaleLowerCase() !== "unknown") {
      entries.push({ label, value });
    }
  };
  const currentName = record.metbull?.canonicalName &&
    !app.namesAreDisplayEquivalent(record.name, record.metbull.canonicalName)
    ? record.metbull.canonicalName : null;
  add("Current Meteoritical Bulletin name", currentName);
  add("Class", record.classification);
  if (specimen && (kind === "projected-atomic-specimen" || record.recordModel === "table-a-specimen")) entries.push({
    label: "Specimen form",
    value: "Individual specimen",
  });
  add("Source locality", record.recordModel === "table-a-specimen" ? record.locality?.name : record.locality);
  if (specimen) add("Individual find location", record.individualFindLocation);
  add(record.recordModel === "collection-representation-fact" ? "Date or report of find" : "Event", expectedEvent(record));
  if (record.recordModel === "collection-representation-fact") {
    add("Section", record.section);
    add("Pane or case", record.pane);
    add("Reference", record.reference);
    add("Represented weight", record.representedWeight.valueText);
  }
  if (specimen) {
    const claims = app.lineageEntriesForSpecimenCard(descriptor, lineageIndex.get(record.id) || []);
    if (claims.length) entries.push({ label: "Lineage", value: app.formatLineageSummary(claims) });
    const grams = kind === "projected-atomic-specimen"
      ? descriptor.repeatedMass
        ? app.resolveSpecimenCardRepeatedMass(record, descriptor.holdingPath, descriptor.repeatedMass)?.grams
        : descriptor.massPath === null ? null
          : app.resolveSpecimenCardSelection(record, descriptor.holdingPath, descriptor.massPath)?.grams
      : record.weight?.grams;
    const qualitativeWeight = kind === "projected-atomic-specimen"
      ? descriptor.qualitativeWeightEvidence?.statement : record.weightEvidence?.statement;
    add("Specimen weight", Number.isFinite(grams) ? app.formatMass(grams) : qualitativeWeight);
    entries.push(...app.victoriaConflictFacts(record));
  }
  return entries;
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
    if (dto.identifier) {
      const shortCatalogLabel = app.catalogDropdownLabel(registry[descriptor.parentRecord.catalogId], descriptor.parentRecord.catalogId);
      assert.match(dto.identifier, new RegExp(`^${shortCatalogLabel.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")} · `, "u"), descriptor.parentRecord.id);
    }
    assert.equal(dto.semanticLabel, SEMANTIC_LABELS[dto.kind], descriptor.parentRecord.id);
    assert.equal(dto.catalogId, descriptor.parentRecord.catalogId, descriptor.parentRecord.id);
    assert.deepEqual(dto.catalogPages, app.recordCatalogPages(descriptor.parentRecord), descriptor.parentRecord.id);
    assert(dto.facts.every(({ label, value }) => typeof label === "string" && label && typeof value === "string" && value));
  }
  assert.deepEqual(counts, {
    "collection-observation": 6867,
    "projected-atomic-specimen": 8410,
    "direct-specimen": 5739,
    "source-observation": 3,
    "regional-observation": 84,
    "dealer-observation": 6,
    "collection-representation-observation": 3447,
  });
  assert.equal(descriptors.length, 24556);
});

test("semantic type labels are hidden for specimens and retained for observations", () => {
  assert.equal(app.shouldDisplaySemanticLabel("direct-specimen"), false);
  assert.equal(app.shouldDisplaySemanticLabel("projected-atomic-specimen"), false);
  assert.equal(app.shouldDisplaySemanticLabel("collection-observation"), true);
  assert.equal(app.shouldDisplaySemanticLabel("regional-observation"), true);
  assert.equal(app.shouldDisplaySemanticLabel("dealer-observation"), true);
  assert.equal(app.shouldDisplaySemanticLabel("collection-representation-observation"), true);
});

test("every production card uses the approved known-fact order and omits unavailable values", () => {
  const omitted = {};
  let specimenCount = 0;
  let individualSpecimenCount = 0;
  let displayedCurrentNameCount = 0;
  let omittedIdentifierCount = 0;
  for (const descriptor of descriptors) {
    const record = descriptor.parentRecord;
    const dto = present(descriptor);
    const specimen = ["direct-specimen", "projected-atomic-specimen"].includes(dto.kind);
    const currentName = record.metbull?.canonicalName && !app.namesAreDisplayEquivalent(record.name, record.metbull.canonicalName)
      ? record.metbull.canonicalName : null;
    assert.deepEqual(dto.facts, expectedFacts(descriptor), record.id);
    assert.equal(dto.sourceName, record.name || null, record.id);
    assert.equal(dto.facts.some(({ value }) => value === "Unknown"), false, record.id);
    if (dto.identifier === null) omittedIdentifierCount += 1;
    assert.equal(fact(dto, "Current Meteoritical Bulletin name"), currentName || undefined, record.id);
    assert.equal(fact(dto, "Class"), record.classification?.toLocaleLowerCase() === "unknown"
      ? undefined : record.classification || undefined, record.id);
    assert.equal(fact(dto, "Source locality"),
      (record.recordModel === "table-a-specimen" ? record.locality?.name : record.locality) || undefined, record.id);
    assert.equal(fact(dto, record.recordModel === "collection-representation-fact" ? "Date or report of find" : "Event"), expectedEvent(record) || undefined, record.id);
    if (specimen) {
      specimenCount += 1;
      if (currentName) displayedCurrentNameCount += 1;
      const individualSpecimen = dto.kind === "projected-atomic-specimen" || record.recordModel === "table-a-specimen";
      assert.equal(fact(dto, "Specimen form"), individualSpecimen ? "Individual specimen" : undefined, record.id);
      if (individualSpecimen) individualSpecimenCount += 1;
      assert.equal(fact(dto, "Individual find location"), record.individualFindLocation || undefined, record.id);
      for (const label of STANDARD_SPECIMEN_LABELS) {
        if (fact(dto, label) === undefined) omitted[label] = (omitted[label] || 0) + 1;
      }
      if (dto.sourceName === null) omitted.sourceName = (omitted.sourceName || 0) + 1;
    }
  }
  assert.equal(specimenCount, 14149);
  assert.equal(individualSpecimenCount, 8683);
  assert.equal(displayedCurrentNameCount, 2231);
  assert.equal(omittedIdentifierCount, 8210);
  assert.deepEqual(omitted, {
    "Individual find location": 14038,
    "Specimen form": 5466,
    Lineage: 13186,
    Event: 2736,
    Class: 232,
    "Source locality": 1097,
    "Specimen weight": 172,
    sourceName: 57,
  });
  assert.deepEqual({
    classDisplayed: specimenCount - omitted.Class,
    formDisplayed: specimenCount - omitted["Specimen form"],
    eventDisplayed: specimenCount - omitted.Event,
    locationDisplayed: specimenCount - omitted["Individual find location"],
    lineageDisplayed: specimenCount - omitted.Lineage,
    weightDisplayed: specimenCount - omitted["Specimen weight"],
  }, {
    classDisplayed: 13917,
    formDisplayed: 8683,
    eventDisplayed: 11413,
    locationDisplayed: 111,
    lineageDisplayed: 963,
    weightDisplayed: 13977,
  });
});

test("specimen mass and lineage facts resolve exactly from source and projection paths", () => {
  for (const descriptor of descriptors.filter((item) =>
    ["direct-specimen", "projected-atomic-specimen"].includes(app.classifyHarmonizedCard(item)))) {
    const record = descriptor.parentRecord;
    const dto = present(descriptor);
    const entries = lineageIndex.get(record.id) || [];
    const expectedClaims = app.lineageEntriesForSpecimenCard(descriptor, entries);
    const grams = dto.kind === "projected-atomic-specimen"
      ? descriptor.repeatedMass
        ? app.resolveSpecimenCardRepeatedMass(record, descriptor.holdingPath, descriptor.repeatedMass)?.grams
        : descriptor.massPath === null ? null : app.resolveSpecimenCardSelection(record, descriptor.holdingPath, descriptor.massPath)?.grams
      : record.weight?.grams;
    const qualitativeWeight = dto.kind === "projected-atomic-specimen"
      ? descriptor.qualitativeWeightEvidence?.statement : record.weightEvidence?.statement;
    assert.equal(fact(dto, "Lineage"), expectedClaims.length ? app.formatLineageSummary(expectedClaims) : undefined, record.id);
    assert.equal(fact(dto, "Specimen weight"), Number.isFinite(grams) ? app.formatMass(grams) : qualitativeWeight || undefined, record.id);
  }
});

test("observation cards omit specimen claims and catalog-specific facts", () => {
  for (const descriptor of descriptors) {
    const record = descriptor.parentRecord;
    const dto = present(descriptor);
    const pages = app.recordCatalogPages(record);
    const sourceLabel = record.catalogLabel || record.catalogId;
    assert.equal(dto.sourceCitation, record.recordModel === "table-a-specimen"
      ? `${sourceLabel} \u00b7 Appendix Table A printed page ${record.sourceEvidence.tableA.printedPage}${record.sourceEvidence.tableB
        ? ` \u00b7 Table B printed page ${record.sourceEvidence.tableB.printedPage}` : ""}`
      : pages.length
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
  victoria.parentRecord.locality.areaReferenceCoordinate = "INJECTED COORDINATE";
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
      specimen ? descriptor.parentRecord.individualFindLocation || undefined : undefined, descriptor.parentRecord.id);
  }
});

test("Kuleschowka renders two 2.7 g repeated specimens without an unsupported lineage field", () => {
  const cards = descriptors.filter(({ parentRecord }) => parentRecord.id === "obs-4611763e-40ee-4872-920e-968183aa348b");
  assert.equal(cards.length, 3);
  assert.deepEqual(cards.map(({ massPath, repeatedMass }) => ({ massPath, occurrence: repeatedMass?.occurrence || null })), [
    { massPath: "holdings[0].weights[0].grams", occurrence: null },
    { massPath: null, occurrence: 1 },
    { massPath: null, occurrence: 2 },
  ]);
  assert.deepEqual(cards.map((descriptor) => fact(present(descriptor), "Specimen weight")), ["5.95 g", "2.7 g", "2.7 g"]);
  assert(cards.slice(1).every((descriptor) => fact(present(descriptor), "Lineage") === undefined));
  assert(cards.slice(1).every((descriptor) => app.lineageEntriesForSpecimenCard(
    descriptor, lineageIndex.get(descriptor.parentRecord.id) || []
  ).length === 0));
});

test("representative corrected and unresolved specimen cards preserve the known Safari-safe text DTO", () => {
  const corrected = descriptors.find((descriptor) => descriptor.parentRecord.metbull?.matchType === "corrected-spelling" &&
    ["direct-specimen", "projected-atomic-specimen"].includes(app.classifyHarmonizedCard(descriptor)));
  const unresolved = descriptors.find((descriptor) => descriptor.parentRecord.metbull?.matchType === "unresolved" &&
    ["direct-specimen", "projected-atomic-specimen"].includes(app.classifyHarmonizedCard(descriptor)));
  for (const descriptor of [corrected, unresolved]) {
    const dto = present(descriptor);
    assert(["direct-specimen", "projected-atomic-specimen"].includes(dto.kind));
    assert.deepEqual(dto.facts, expectedFacts(descriptor));
    assert(dto.facts.every(({ value }) => typeof value === "string" && value.length > 0));
  }
  assert.equal(fact(present(corrected), "Current Meteoritical Bulletin name"), corrected.parentRecord.metbull.canonicalName);
  assert.equal(fact(present(unresolved), "Current Meteoritical Bulletin name"), undefined);
  assert.match(styles, /overflow-wrap: anywhere;/u);
  assert.match(styles, /\.record-meta div \{[^}]*grid-template-columns: minmax\(7\.25rem, 9rem\) minmax\(0, 1fr\);/u);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*\.record-meta div \{ grid-template-columns: minmax\(0, 1fr\);/u);
  assert.match(styles, /\.record-meta dt \{[^}]*word-break: normal;[^}]*overflow-wrap: normal;/u);
});

test("catalog-specific source facts stay out of cards while representative hidden facts remain searchable", () => {
  const allowed = new Set([
    "Current Meteoritical Bulletin name", ...STANDARD_SPECIMEN_LABELS, ...STANDARD_OBSERVATION_LABELS, ...FLETCHER_OBSERVATION_LABELS, ...FLETCHER_LABELS
  ]);
  for (const descriptor of descriptors) {
    assert(present(descriptor).facts.every(({ label }) => allowed.has(label) ||
      /^(?:Class|Specimen weight|Weathering), Table [AB] (?:primary|reported) \(printed page \d+\)$/u.test(label)), descriptor.parentRecord.id);
  }
  assert.doesNotMatch(html, /<dt>|record-holdings|metbull-name|lineage-row|earlier-records/u);

  for (const record of records.filter(({ recordModel }) => recordModel === "table-a-specimen")) {
    assert.equal(app.matchesSearch(record, record.locality.code), true, record.id);
    if (record.locality.areaReferenceCoordinate) assert.equal(app.matchesSearch(record, record.locality.areaReferenceCoordinate), true, record.id);
    if (record.olivineFa) assert.equal(app.matchesSearch(record, `olivine Fa ${record.olivineFa}`), true, record.id);
    if (record.pyroxeneFs) assert.equal(app.matchesSearch(record, `pyroxene Fs ${record.pyroxeneFs}`), true, record.id);
    if (record.weathering) assert.equal(app.matchesSearch(record, `weathering ${record.weathering}`), true, record.id);
    assert.equal(app.matchesSearch(record, "Table A"), true, record.id);
  }
  for (const record of records.filter(({ recordModel }) => recordModel === "regional-census-fact")) {
    assert.equal(app.matchesSearch(record, record.section), true, record.id);
  }
  for (const record of records.filter(({ recordModel }) => recordModel === "collection-representation-fact")) {
    assert.equal(app.matchesSearch(record, record.section), true, record.id);
    if (record.pane) assert.equal(app.matchesSearch(record, `pane ${record.pane}`), true, record.id);
    if (record.reference) assert.equal(app.matchesSearch(record, `reference ${record.reference}`), true, record.id);
    if (record.representedWeight.valueText) assert.equal(app.matchesSearch(record, `represented weight ${record.representedWeight.valueText}`), true, record.id);
  }
  const hamburg = records.find(({ catalogId, name }) => catalogId === "hamburg-1913" && name === "Stannern");
  assert.equal(app.matchesSearch(hamburg, "reported total"), true);
  assert.equal(app.matchesSearch(hamburg, "Representations: 2 thin sections"), true);
  const noted = records.find(({ metbull }) => metbull?.alternateNameNote);
  assert.equal(app.matchesSearch(noted, noted.metbull.alternateNameNote), true);
});

test("catalog-scoped identifiers distinguish duplicate source numbers across catalogs", () => {
  const duplicateNineB = descriptors
    .filter((descriptor) => expectedSourceIdentifier(descriptor, app.classifyHarmonizedCard(descriptor)) === "9b")
    .map((descriptor) => present(descriptor).identifier);
  assert(duplicateNineB.includes("Nininger (1933) · 9b"));
  assert(duplicateNineB.includes("Nininger (1950) · 9b"));
  assert.notEqual("Nininger (1933) · 9b", "Nininger (1950) · 9b");
});

test("projection changes display-card multiplicity without changing parent result counts", () => {
  const filters = {
    query: "", catalog: null, min: null, max: null,
    lineageOnly: false, includeUnknownWeight: true, sort: app.DEFAULT_SORT
  };
  assert.equal(app.filterRecords(records, filters, lineageIndex).length, 19553);
  assert.equal(new Set(descriptors.map(({ parentRecord }) => parentRecord.id)).size, 19553);
  for (const descriptor of catalog.metadata.catalogs) {
    const parents = app.filterRecords(records, { ...filters, catalog: descriptor.id }, lineageIndex);
    assert.equal(parents.length, descriptor.recordCount, descriptor.id);
    assert.equal(new Set(descriptors.filter(({ parentRecord }) => parentRecord.catalogId === descriptor.id)
      .map(({ parentRecord }) => parentRecord.id)).size, descriptor.recordCount, descriptor.id);
  }
});

test("default strict filter retains only the 13,977 source-listed-weight specimen cards", () => {
  const inclusive = app.filterSpecimenCardDescriptors(descriptors, {
    min: null, max: null, lineageOnly: false, includeUnknownWeight: true
  }, lineageIndex);
  const weightedOnly = app.filterSpecimenCardDescriptors(descriptors, {
    min: null, max: null, lineageOnly: false, includeUnknownWeight: false
  }, lineageIndex);
  const defaultFiltered = app.filterSpecimenCardDescriptors(descriptors, {
    min: null, max: null, lineageOnly: false
  }, lineageIndex);
  const unknownSpecimens = inclusive.filter((descriptor) =>
    ["direct-specimen", "projected-atomic-specimen"].includes(app.classifyHarmonizedCard(descriptor)) &&
    !app.specimenCardDescriptorHasKnownWeight(descriptor));
  assert.equal(inclusive.length, 24556);
  assert.equal(weightedOnly.length, 13977);
  assert.equal(defaultFiltered.length, 13977);
  assert.deepEqual(defaultFiltered, weightedOnly);
  assert.equal(app.WEIGHTED_DESCRIPTOR_COUNT, 13977);
  assert.equal(unknownSpecimens.length, 172);
  assert(weightedOnly.every((descriptor) => {
    const kind = app.classifyHarmonizedCard(descriptor);
    return ["direct-specimen", "projected-atomic-specimen"].includes(kind) &&
      app.specimenCardDescriptorHasKnownWeight(descriptor);
  }));
  assert.equal(weightedOnly.filter((descriptor) =>
    ["collection-observation", "regional-observation", "dealer-observation", "collection-representation-observation"].includes(app.classifyHarmonizedCard(descriptor))).length, 0);

  const mason3986 = descriptors.find(({ parentRecord }) =>
    parentRecord.id === "obs-6ce2e39e-311c-4fb2-83e2-d8c726b52c44");
  assert(mason3986);
  assert.equal(app.classifyHarmonizedCard(mason3986), "collection-observation");
  assert.deepEqual(app.specimenCardDescriptorMasses(mason3986), [2.9]);
  assert.equal(weightedOnly.includes(mason3986), false);

  const byParent = Map.groupBy(descriptors, ({ parentRecord }) => parentRecord.id);
  const mixed = [...byParent.values()].find((cards) => {
    const masses = cards.map((descriptor) => app.specimenCardDescriptorMasses(descriptor).length > 0);
    return masses.includes(true) && masses.includes(false);
  });
  assert(mixed);
  const mixedFiltered = app.filterSpecimenCardDescriptors(mixed, {
    min: null, max: null, lineageOnly: false, includeUnknownWeight: false
  });
  assert(mixedFiltered.length > 0 && mixedFiltered.length < mixed.length);
  assert(mixedFiltered.every((descriptor) => app.specimenCardDescriptorMasses(descriptor).length > 0));
});

test("weight census is a closed 13,966 numeric, 11 qualitative, and 172 source-unlisted specimen partition", () => {
  const specimens = descriptors.filter((descriptor) =>
    ["direct-specimen", "projected-atomic-specimen"].includes(app.classifyHarmonizedCard(descriptor)));
  const numeric = specimens.filter((descriptor) => app.specimenCardDescriptorMasses(descriptor).length > 0);
  const qualitative = specimens.filter((descriptor) => app.specimenCardDescriptorMasses(descriptor).length === 0 &&
    app.specimenCardDescriptorHasKnownWeight(descriptor));
  const sourceUnlisted = specimens.filter((descriptor) => !app.specimenCardDescriptorHasKnownWeight(descriptor));
  const notIndividual = descriptors.filter((descriptor) => app.classifyHarmonizedCard(descriptor) === "source-observation");
  assert.deepEqual({ specimens: specimens.length, numeric: numeric.length, qualitative: qualitative.length,
    sourceUnlisted: sourceUnlisted.length, notIndividual: notIndividual.length },
  { specimens: 14149, numeric: 13966, qualitative: 11, sourceUnlisted: 172, notIndividual: 3 });
  assert.equal(app.filterSpecimenCardDescriptors(specimens, {
    min: 0, max: null, lineageOnly: false, includeUnknownWeight: true,
  }, lineageIndex).length, 13966);
  assert.deepEqual(qualitative.map(({ parentRecord, projected, sourcePosition }) =>
    projected ? `${parentRecord.id}--specimen-${sourcePosition + 1}` : parentRecord.id).sort(), [
    "obs-014fa351-665c-4bcb-b83f-3610f0ff425c--specimen-5",
    "obs-26389145-2d52-4acf-8b33-06aa8489edfe--specimen-3",
    "obs-327f24de-1d9e-4d32-beb5-02d92da394ed--specimen-1",
    "obs-3d14d6ee-ac0e-4ee1-afa2-6e120be03784--specimen-1",
    "obs-4abadfcd-cac6-495a-baa3-6247c4f23029--specimen-1",
    "obs-6a96e225-20b3-48c2-b29d-abc6e3b6993e--specimen-1",
    "obs-9286c6b5-4942-41f0-a905-8854f457bd9d",
    "obs-9dec06e1-df7f-4306-9a80-1dca86be2974--specimen-1",
    "obs-b9a75360-da41-4407-8e2a-4283bfe2a566--specimen-1",
    "obs-c826a6f7-d9a3-417f-a304-a4e566f36f6c--specimen-1",
    "obs-e2b4f522-b31d-4dcb-9cf6-7b8ba35da649--specimen-1",
  ]);
});

test("Brown and Minnesota retain exactly 538 source-listed specimen cards in default results", () => {
  const weightedOnly = app.filterSpecimenCardDescriptors(descriptors, {
    min: null, max: null, lineageOnly: false, includeUnknownWeight: false
  }, lineageIndex);
  for (const [catalogId, total, sourceListed] of [["brown-1916", 385, 375], ["minnesota-1892", 164, 163]]) {
    const cards = descriptors.filter((descriptor) => descriptor.parentRecord.catalogId === catalogId &&
      app.classifyHarmonizedCard(descriptor) === "projected-atomic-specimen");
    assert.equal(cards.length, total);
    assert.equal(weightedOnly.filter((descriptor) => cards.includes(descriptor)).length, sourceListed);
    assert(cards.every(({ clauseText }) => clauseText.startsWith("Specimen:")));
    assert(cards.every(({ clauseText }) => !/^(?:Group context|Excluded non-meteorite context):/u.test(clauseText)));
  }
});

test("Foote and Wave 1 lineage endpoints retain non-specimen and exact-path semantics", () => {
  const foote = descriptors.filter(({ parentRecord }) => parentRecord.catalogId === "foote-1909");
  assert.deepEqual(foote.map((descriptor) => present(descriptor).identifier),
    [95, 96, 97, 98, 99, 100].map((typeNumber) => `Foote (1909) · Type number ${typeNumber}`));
  for (const descriptor of foote) {
    const dto = present(descriptor);
    assert.equal(dto.kind, "dealer-observation");
    assert.equal(dto.semanticLabel, "Dealer catalog observation, not a specimen or holding");
    assert.equal(dto.description, descriptor.parentRecord.description);
    assert.deepEqual(dto.facts, expectedFacts(descriptor));
    assert.equal(descriptor.parentRecord.metbull, undefined);
    assert.equal(descriptor.parentRecord.weight, undefined);
    assert.equal(descriptor.parentRecord.holdings, undefined);
  }
  assert.equal(foote.filter(({ parentRecord }) => app.matchesSearch(parentRecord, "diamondiferous mass")).length, 1);
  assert.equal(foote.filter(({ parentRecord }) => app.matchesSearch(parentRecord, "etched plate")).length, 2);

  const waveCatalogs = new Set(["brown-1916", "minnesota-1892"]);
  const relationships = lineages.relationships.filter(({ observations }) =>
    observations.some(({ catalogId }) => waveCatalogs.has(catalogId)));
  assert.equal(relationships.length, 22);
  for (const relationship of relationships) {
    for (const endpoint of relationship.observations.filter(({ catalogId }) => waveCatalogs.has(catalogId))) {
      assert(descriptors.some((descriptor) => descriptor.parentRecord.id === endpoint.recordId &&
        descriptor.massPath === endpoint.massPath), `${relationship.id}: ${endpoint.massPath}`);
    }
  }
});

test("accessible shell, responsive breakpoints, approved cache, and immutable data hashes are locked", () => {
  assert.match(html, /<div id="results" class="catalog-grid" aria-busy="true"><\/div>/u);
  assert.match(html, /id="status" class="status" role="status" aria-live="polite"/u);
  assert.match(html, /<article class="record-card">[\s\S]*<p class="record-semantic-label"><\/p>[\s\S]*<h3 class="record-name"><\/h3>/u);
  assert.match(html, /<dl class="record-meta" aria-label="Catalog record details"><\/dl>/u);
  assert.match(html, /<p class="record-source"><\/p>/u);
  assert.match(html, /<input id="include-unknown-weight" name="include-unknown-weight" type="checkbox">/u);
  assert.doesNotMatch(html, /id="include-unknown-weight"[^>]*\bchecked\b/u);
  assert.match(html, /<span>Include observations and source-unlisted specimens<\/span>/u);
  assert.match(styles, /\.filters > \.filter-toggles \{[^}]*display: flex;[^}]*flex-wrap: wrap;/u);
  assert.match(styles, /\.catalog-grid \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/u);
  assert.match(styles, /@media \(max-width: 1200px\)[\s\S]*\.catalog-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/u);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.catalog-grid \{ grid-template-columns: 1fr; \}/u);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*\.record-meta div \{ grid-template-columns: minmax\(0, 1fr\);/u);
  assert.match(styles, /@media \(max-width: 420px\)[\s\S]*\.record-card \{ padding-inline: 1rem; \}/u);
  assert.match(styles, /\.record-card \{[^}]*padding: 1rem 1rem \.85rem;/u);
  assert.match(styles, /\.record-name \{[^}]*font-size: clamp\(1\.2rem, 1\.8vw, 1\.55rem\);/u);
  assert.match(styles, /\.record-meta dt \{[^}]*font-size: \.6rem;/u);
  assert.match(styles, /\.record-meta dd \{[^}]*font-size: \.8rem;/u);
  assert.doesNotMatch(styles, /\.record-meta dt \{[^}]*overflow-wrap: anywhere;/u);
  assert.equal(app.CACHE_VERSION, "20260911-scoped-ids-1");
  assert.equal(app.ASSET_CACHE_VERSION, "20260911-scoped-ids-1");
  for (const document of [html, catalogsHtml]) {
    assert.match(document, /styles\.css\?v=20260911-scoped-ids-1/u);
    assert.match(document, /app\.js\?v=20260911-scoped-ids-1/u);
  }
  assert.match(catalogsHtml, /catalogs\.js\?v=20260911-scoped-ids-1/u);
  assert.deepEqual({
    catalog: sha256(catalogText),
    projections: sha256(projectionText),
    lineages: sha256(lineageText),
    reviews: sha256(reviewText),
  }, {
    catalog: "cf429e6660f00272f2f81fe69bac81c891f41574bbfff6e6bb46499d2d0672b4",
    projections: "e128dc388ede6590b5e373fe36958d4b5d068641a4454719c23044c146e13e0e",
    lineages: "3f1d63db2effbe497e328ac99831c22d661fd72a2fba2fd1ec74a83186a523a9",
    reviews: "aff7c3773af3e812578776b82ee81cd20060009eb72ca1326220cd2e0c8d5283",
  });
});
