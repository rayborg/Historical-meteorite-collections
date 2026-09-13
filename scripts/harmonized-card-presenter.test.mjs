import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const app = require("../app.js");
const [catalogText, projectionText, lineageText, reviewText, currentContextText, html, catalogsHtml, styles, appSource] = await Promise.all([
  readFile(new URL("../data/catalog.json", import.meta.url), "utf8"),
  readFile(new URL("../data/specimen-card-projections.json", import.meta.url), "utf8"),
  readFile(new URL("../data/specimen-lineages.json", import.meta.url), "utf8"),
  readFile(new URL("../data/specimen-comparison-reviews.json", import.meta.url), "utf8"),
  readFile(new URL("../data/metbull-current-context.json", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../catalogs.html", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8"),
  readFile(new URL("../app.js", import.meta.url), "utf8"),
]);
const catalog = JSON.parse(catalogText);
const projections = JSON.parse(projectionText);
const lineages = JSON.parse(lineageText);
const registry = app.normalizeCatalogRegistry(catalog.metadata);
const records = catalog.records.map((record, index) => app.prepareRecord(record, index, registry));
const sourceCatalogSha256 = createHash("sha256").update(catalogText).digest("hex");
const projectionIndex = app.deriveSpecimenCardProjectionIndex(projections, records, {
  sourceCatalogSha256,
});
const rawDescriptors = app.expandSpecimenCardDescriptors(records, projectionIndex);
const currentContext = JSON.parse(currentContextText);
const currentContextIndex = app.deriveMetbullCurrentContextIndex(currentContext, rawDescriptors);
const descriptors = app.attachMetbullCurrentContext(rawDescriptors, currentContextIndex);
const lineageIndex = app.deriveEarlierRecordIndex(lineages, records, registry);
const comparisonIndex = app.deriveComparisonGroupIndex(lineages, records, registry);

const DTO_KEYS = [
  "kind", "identifier", "semanticLabel", "sourceName", "headingName", "headingLabel", "headingUrl", "description", "facts", "catalogNotes", "sourceCitation", "sourceLabel", "catalogId", "catalogPages", "lineage", "comparison"
];
const STANDARD_SPECIMEN_LABELS = [
  "Catalog classification", "Specimen form", "Source locality",
  "Individual find location", "Event", "Lineage", "Cross-catalog comparisons", "Specimen weight"
];
const STANDARD_OBSERVATION_LABELS = ["Catalog classification", "Source locality", "Event"];
const FLETCHER_OBSERVATION_LABELS = ["Catalog classification", "Source locality", "Date or report of find"];
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
    comparisonEntries: comparisonIndex.get(descriptor.parentRecord.id) || [],
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
    return record.reportedNumber ? `Reported no. ${record.reportedNumber}` : null;
  }
  if (record.recordModel === "regional-census-fact") {
    return record.reportedNumber ? `Source number ${record.reportedNumber}` : null;
  }
  if (record.recordModel === "collection-representation-fact") {
    return record.reportedNumber ? `List no. ${record.reportedNumber}` : null;
  }
  if (["table-a-specimen", "appendix-specimen"].includes(record.recordModel)) return record.specimenId || null;
  if (record.recordModel === "dealer-offer-fact") return `Type number ${record.typeNumber}`;
  return record.designation || null;
}

function expectedIdentifier(descriptor, kind) {
  const sourceIdentifier = expectedSourceIdentifier(descriptor, kind);
  const catalogId = descriptor.parentRecord.catalogId;
  return [
    app.catalogDropdownLabel(registry[catalogId], catalogId),
    sourceIdentifier,
    kind === "projected-atomic-specimen" && descriptor.sourceCatalogNumber
      ? `Catalog no. ${descriptor.sourceCatalogNumber.value}` : null,
  ].filter(Boolean).join(" · ");
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
    if (app.isKnownCardFact(label, value)) entries.push({ label, value });
  };
  if (descriptor.currentMetbull) {
    add("Current MetBull classification", descriptor.currentMetbull.classification);
    add("Current MetBull place", descriptor.currentMetbull.place);
    add("Current MetBull fall/find", app.metbullFallDisplay(descriptor.currentMetbull.fall));
    add("Current MetBull year", descriptor.currentMetbull.year);
  } else {
    add("Catalog classification", record.classification);
  }
  if (specimen && (kind === "projected-atomic-specimen" || ["table-a-specimen", "appendix-specimen"].includes(record.recordModel))) entries.push({
    label: "Specimen form",
    value: "Individual specimen",
  });
  if (!descriptor.currentMetbull) {
    add("Source locality", ["table-a-specimen", "appendix-specimen"].includes(record.recordModel) ? record.locality?.name : record.locality);
  }
  if (specimen) add("Individual find location", record.individualFindLocation);
  if (!descriptor.currentMetbull) {
    add(record.recordModel === "collection-representation-fact" ? "Date or report of find" : "Event", expectedEvent(record));
  }
  if (record.recordModel === "collection-representation-fact") {
    add("Section", record.section);
    add("Pane or case", record.pane);
    add("Reference", record.reference);
    add("Represented weight", record.representedWeight.valueText);
  }
  if (specimen) {
    const claims = app.lineageEntriesForSpecimenCard(descriptor, lineageIndex.get(record.id) || []);
    if (claims.length) entries.push({ label: "Lineage", value: app.formatLineageSummary(claims) });
    const comparisons = app.comparisonCardDto(descriptor, comparisonIndex.get(record.id) || []);
    if (comparisons.groups.length) entries.push({ label: "Cross-catalog comparisons", value: comparisons.summary.text });
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
    entries.push(...app.appendixSpecimenFacts(record).filter(({ value }) => value !== null));
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
    const shortCatalogLabel = app.catalogDropdownLabel(registry[descriptor.parentRecord.catalogId], descriptor.parentRecord.catalogId);
    assert.match(dto.identifier, new RegExp(`^${shortCatalogLabel.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(?: · |$)`, "u"), descriptor.parentRecord.id);
    assert.equal(dto.semanticLabel, SEMANTIC_LABELS[dto.kind], descriptor.parentRecord.id);
    assert.equal(dto.catalogId, descriptor.parentRecord.catalogId, descriptor.parentRecord.id);
    assert.deepEqual(dto.catalogPages, app.recordCatalogPages(descriptor.parentRecord), descriptor.parentRecord.id);
    assert(dto.facts.every(({ label, value }) => typeof label === "string" && label && typeof value === "string" && value));
  }
  assert.deepEqual(counts, {
    "collection-observation": 6867,
    "projected-atomic-specimen": 8410,
    "direct-specimen": 5824,
    "source-observation": 3,
    "regional-observation": 84,
    "dealer-observation": 6,
    "collection-representation-observation": 3447,
  });
  assert.equal(descriptors.length, 24641);
});

test("all seven populated-name branches use concise kind-specific labels", () => {
  assert.deepEqual(Object.fromEntries(Object.keys(SEMANTIC_LABELS).map((kind) => [kind, app.harmonizedCardNameLabel(kind)])), {
    "direct-specimen": "Meteorite name",
    "projected-atomic-specimen": "Meteorite name",
    "source-observation": "Source name",
    "collection-observation": "Meteorite name",
    "regional-observation": "Meteorite name",
    "dealer-observation": "Catalog name",
    "collection-representation-observation": "Meteorite or locality name",
  });
  assert.equal(app.harmonizedCardNameLabel("not-a-card-kind"), null);
  assert(descriptors.every((descriptor) => {
    const dto = present(descriptor);
    return dto.sourceName === null || app.harmonizedCardNameLabel(dto.kind) !== null;
  }));
  assert.doesNotMatch(appSource,
    /Source catalog (?:meteorite name|meteorite or locality name|name)/u);
  assert.match(appSource, /label: hasSourceIdentifier \? "Source catalog identifier" : "Source catalog record"/u);
});

test("null source names distinguish genuine identifiers from bare catalog shortnames", () => {
  const nullNameCards = descriptors.filter((descriptor) => present(descriptor).sourceName === null);
  const counts = { "Source catalog identifier": 0, "Source catalog record": 0 };
  for (const descriptor of nullNameCards) {
    const kind = app.classifyHarmonizedCard(descriptor);
    const dto = present(descriptor);
    const heading = app.harmonizedCardNullNameHeading(descriptor.parentRecord, kind, descriptor, dto.identifier);
    const typedIdentifier = expectedSourceIdentifier(descriptor, kind);
    const sourceCatalogNumber = app.resolveSpecimenCardSourceCatalogNumber(descriptor.parentRecord, descriptor);
    assert.deepEqual(Object.keys(heading), ["label", "value"]);
    assert.equal(heading.value, dto.identifier);
    assert.equal(heading.label, typedIdentifier || sourceCatalogNumber
      ? "Source catalog identifier" : "Source catalog record");
    counts[heading.label] += 1;
  }
  assert.equal(nullNameCards.length, 70);
  assert.deepEqual(counts, { "Source catalog identifier": 62, "Source catalog record": 8 });

  const bare = nullNameCards.find((descriptor) => {
    const kind = app.classifyHarmonizedCard(descriptor);
    return !expectedSourceIdentifier(descriptor, kind) && !descriptor.sourceCatalogNumber;
  });
  const bareDto = present(bare);
  assert.deepEqual(app.harmonizedCardNullNameHeading(
    bare.parentRecord, bareDto.kind, bare, bareDto.identifier
  ), {
    label: "Source catalog record",
    value: app.catalogDropdownLabel(registry[bare.parentRecord.catalogId], bare.parentRecord.catalogId),
  });

  const evidenceBound = structuredClone(descriptors.find(({ sourceCatalogNumber }) => sourceCatalogNumber));
  evidenceBound.parentRecord.name = null;
  const evidenceDto = app.presentHarmonizedCard(evidenceBound, { registry });
  assert.deepEqual(app.harmonizedCardNullNameHeading(
    evidenceBound.parentRecord, evidenceDto.kind, evidenceBound, evidenceDto.identifier
  ), { label: "Source catalog identifier", value: evidenceDto.identifier });
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
  const census = { specimens: 0, mapped: 0, unmapped: 0, factRows: 0, noteCards: 0, noteRows: 0 };
  const noteLabels = {};
  let shortnameOnlyIdentifierCount = 0;
  for (const descriptor of descriptors) {
    const record = descriptor.parentRecord;
    const dto = present(descriptor);
    const specimen = ["direct-specimen", "projected-atomic-specimen"].includes(dto.kind);
    assert.deepEqual(dto.facts, expectedFacts(descriptor), record.id);
    assert.equal(dto.sourceName, record.name || null, record.id);
    assert(dto.facts.every(({ label, value }) => app.isKnownCardFact(label, value)), record.id);
    assert(dto.catalogNotes.every(({ label, value }) => typeof label === "string" && typeof value === "string" && value), record.id);
    census.factRows += dto.facts.length;
    census.noteRows += dto.catalogNotes.length;
    if (dto.catalogNotes.length) census.noteCards += 1;
    for (const { label } of dto.catalogNotes) noteLabels[label] = (noteLabels[label] || 0) + 1;
    if (dto.identifier === app.catalogDropdownLabel(registry[record.catalogId], record.catalogId)) shortnameOnlyIdentifierCount += 1;
    if (specimen) {
      census.specimens += 1;
      census[descriptor.currentMetbull ? "mapped" : "unmapped"] += 1;
      assert.equal(dto.headingName, descriptor.currentMetbull?.name || record.name || null, record.id);
      const individualSpecimen = dto.kind === "projected-atomic-specimen" ||
        ["table-a-specimen", "appendix-specimen"].includes(record.recordModel);
      assert.equal(fact(dto, "Specimen form"), individualSpecimen ? "Individual specimen" : undefined, record.id);
      assert.equal(fact(dto, "Individual find location"), record.individualFindLocation || undefined, record.id);
      assert.equal(Boolean(fact(dto, "Current MetBull classification")), Boolean(descriptor.currentMetbull), record.id);
    }
  }
  assert.deepEqual(census, {
    specimens: 14234, mapped: 11859, unmapped: 2375, factRows: 112030, noteCards: 11798, noteRows: 29984,
  });
  assert.deepEqual(noteLabels, {
    "Catalog classification": 11352,
    "Catalog locality": 9916,
    "Catalog meteorite name": 2316,
    "Catalog event or date": 6400,
  });
  assert.equal(shortnameOnlyIdentifierCount, 6058);
  assert(descriptors.every((descriptor) => present(descriptor).identifier !== null));
  const generatedEntryOrderFallbacks = descriptors.filter(({ parentRecord }) =>
    ["collection-entry", "regional-census-fact", "collection-representation-fact"].includes(parentRecord.recordModel) &&
    !parentRecord.reportedNumber).filter((descriptor) => app.classifyHarmonizedCard(descriptor) !== "projected-atomic-specimen");
  assert.equal(generatedEntryOrderFallbacks.length, 2906);
  assert(generatedEntryOrderFallbacks.every((descriptor) => present(descriptor).identifier ===
    app.catalogDropdownLabel(registry[descriptor.parentRecord.catalogId], descriptor.parentRecord.catalogId)));
});

test("Allende keeps the Huss 1976 classification explicitly source-scoped", () => {
  const descriptor = descriptors.find(({ parentRecord }) =>
    parentRecord.catalogId === "huss-1976" && parentRecord.designation === "H103.11");
  const dto = present(descriptor);
  assert.equal(dto.sourceName, "Allende");
  assert.equal(dto.headingName, "Allende");
  assert.equal(fact(dto, "Current MetBull classification"), "CV3");
  assert.deepEqual(dto.catalogNotes, [{
    label: "Catalog classification", value: "Stone. Carbonaceous chondrite, Type III",
  }]);
  assert.equal(fact(dto, "Class"), undefined);
  assert.equal(fact(dto, "Current Meteoritical Bulletin classification"), undefined);
  assert.equal(descriptor.parentRecord.metbull.meteoriteCode, "2278");
});

test("all reviewed projected source catalog numbers render exact representative identifiers without changing typed identifiers", () => {
  const sourceNumberCards = descriptors.filter(({ sourceCatalogNumber }) => sourceCatalogNumber);
  assert.equal(sourceNumberCards.length, 5058);
  const ensisheim = sourceNumberCards.filter(({ parentRecord }) =>
    parentRecord.id === "obs-43d6c2fe-be9b-4d2e-93a1-eecea0e09c9a");
  assert.deepEqual(ensisheim.map((descriptor) => present(descriptor).identifier), [
    "Farrington (1903) · Catalog no. 207",
    "Farrington (1903) · Catalog no. 208",
  ]);
  const representativeDisplays = new Map([
    ["obs-47bef700-eb27-4908-b683-91a388b33f0b", [
      "Reeds (1937) · Catalog no. 128", "Reeds (1937) · Catalog no. 716",
    ]],
    ["obs-8a35b787-68ed-4bb9-97b2-851535d915a2", [
      "Farrington (1916) · Catalog no. 1013", "Farrington (1916) · Catalog no. 1012",
    ]],
    ["obs-a95a5abf-da69-4648-8d6f-a85e49a3ee08", [
      "Prior (1923) · Catalog no. [1913,177]", "Prior (1923) · Catalog no. [1912,112]",
    ]],
    ["obs-97675b82-6728-4606-8a99-a6d5931ae224", ["Tassin (1902) · Catalog no. 44363"]],
    ["obs-bc046387-49aa-469f-b9cb-2d68f42193b8", ["Merrill (1916) · Catalog no. 13"]],
  ]);
  for (const [parentRecordId, expected] of representativeDisplays) {
    assert.deepEqual(sourceNumberCards.filter(({ parentRecord }) => parentRecord.id === parentRecordId)
      .map((descriptor) => present(descriptor).identifier), expected);
  }
  const shortnameOnly = descriptors.find(({ parentRecord, sourceCatalogNumber }) =>
    parentRecord.id === "obs-95822a38-806a-47e5-b73a-e84e71fc9d7a" && !sourceCatalogNumber);
  assert.equal(present(shortnameOnly).identifier, "Hovey (1896)");

  const typed = descriptors.filter((descriptor) => expectedSourceIdentifier(descriptor, app.classifyHarmonizedCard(descriptor)));
  assert.equal(typed.length, 13525);
  assert(typed.every((descriptor) => present(descriptor).identifier.includes(
    ` · ${expectedSourceIdentifier(descriptor, app.classifyHarmonizedCard(descriptor))}`)));
});

test("all seven card kinds use only shortname, typed-identifier, or reviewed-number identifier branches", () => {
  const census = {};
  for (const descriptor of descriptors) {
    const kind = app.classifyHarmonizedCard(descriptor);
    const dto = present(descriptor);
    const shortname = app.catalogDropdownLabel(registry[descriptor.parentRecord.catalogId], descriptor.parentRecord.catalogId);
    const branch = descriptor.sourceCatalogNumber ? "number"
      : expectedSourceIdentifier(descriptor, kind) ? "typed" : "shortname";
    census[kind] ||= { shortname: 0, typed: 0, number: 0 };
    census[kind][branch] += 1;
    assert.equal(dto.identifier.startsWith(shortname), true);
    assert.doesNotMatch(dto.identifier, /unknown/iu);
  }
  assert.deepEqual(census, {
    "collection-observation": { shortname: 2219, typed: 4648, number: 0 },
    "projected-atomic-specimen": { shortname: 3111, typed: 241, number: 5058 },
    "direct-specimen": { shortname: 38, typed: 5786, number: 0 },
    "source-observation": { shortname: 3, typed: 0, number: 0 },
    "regional-observation": { shortname: 7, typed: 77, number: 0 },
    "dealer-observation": { shortname: 0, typed: 6, number: 0 },
    "collection-representation-observation": { shortname: 680, typed: 2767, number: 0 },
  });
});

test("field-aware availability removes only complete placeholders and preserves all compound evidence", () => {
  for (const value of ["unknown", " Unknown. ", "UNKNOWN..."]) {
    assert.equal(app.isKnownCardFact("Catalog classification", value), false, value);
  }
  for (const value of ["locality unknown", " Exact   locality unknown. "]) {
    assert.equal(app.isKnownCardFact("Source locality", value), false, value);
    assert.equal(app.isKnownCardFact("Event", value), true, value);
  }
  for (const value of ["Date of fall unknown.", "date of find unknown"]) {
    assert.equal(app.isKnownCardFact("Event", value), false, value);
    assert.equal(app.isKnownCardFact("Date or report of find", value), false, value);
    assert.equal(app.isKnownCardFact("Source locality", value), true, value);
  }
  assert.equal(app.isKnownCardFact("Event", "Date of fall unknown; found in 1842"), true);
  assert.equal(app.isKnownCardFact("Source locality", "locality unknown, probably Toluca, Mexico"), true);

  const completePlaceholders = descriptors.flatMap(({ parentRecord: record }) => [{
    label: "Source locality",
    value: record.recordModel === "table-a-specimen" ? record.locality?.name : record.locality,
  }, {
    label: record.recordModel === "collection-representation-fact" ? "Date or report of find" : "Event",
    value: expectedEvent(record),
  }]).filter(({ label, value }) => typeof value === "string" && value.trim() &&
    value.trim().toLocaleLowerCase() !== "unknown" && !app.isKnownCardFact(label, value));
  assert.equal(completePlaceholders.length, 39);
  assert.deepEqual([...new Set(completePlaceholders.map(({ value }) => value))].sort(), [
    "Date of fall unknown.", "Date of find unknown", "Locality unknown", "exact locality unknown", "locality unknown",
  ]);

  const compoundFacts = descriptors.flatMap((descriptor) => present(descriptor).facts)
    .filter(({ value }) => value.toLocaleLowerCase().includes("unknown"));
  assert.equal(compoundFacts.length, 64);
  assert(compoundFacts.every(({ label, value }) => app.isKnownCardFact(label, value)));
  assert(compoundFacts.some(({ value }) => value === "Date of fall unknown; found in 1842."));
  assert(compoundFacts.some(({ value }) => value === "locality unknown, probably Toluca, Mexico"));
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
      : record.recordModel === "appendix-specimen"
        ? `${sourceLabel} \u00b7 Appendix printed page ${record.catalogPage}`
      : pages.length
        ? `${sourceLabel} \u00b7 ${pages.length === 1 ? "p." : "pp."} ${pages.join(", ")}`
        : sourceLabel, record.id);
    if (["collection-observation", "regional-observation"].includes(dto.kind)) {
      assert.equal(dto.facts.some(({ label }) => ["Specimen form", "Lineage", "Specimen weight"].includes(label)), false, record.id);
    }
    assert.equal(dto.facts.some(({ label }) => /Australian Museum|occurrences/u.test(label)), false, record.id);
  }
});

test("source citations omit page placeholders when no source page is available", () => {
  const descriptor = structuredClone(descriptors.find(({ parentRecord }) =>
    parentRecord.recordModel === "collection-entry"));
  descriptor.parentRecord.catalogPages = [];
  assert.equal(app.presentHarmonizedCard(descriptor).sourceCitation,
    descriptor.parentRecord.catalogLabel || descriptor.parentRecord.catalogId);
});

test("only typed specimen locations can create an individual find location or specimen form", () => {
  const victoria = structuredClone(descriptors.find(({ parentRecord }) => parentRecord.catalogId === "victoria-land-1982"));
  victoria.parentRecord.locality.name = "General locality only";
  victoria.parentRecord.locality.areaReferenceCoordinate = "INJECTED COORDINATE";
  const victoriaDto = app.presentHarmonizedCard(victoria);
  assert.equal(fact(victoriaDto, "Current MetBull place"), victoria.currentMetbull.place);
  assert(victoriaDto.catalogNotes.some(({ label, value }) => label === "Catalog locality" && value === "General locality only"));
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
  assert.equal(fact(collectionDto, "Current MetBull classification"), undefined);
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
  assert.equal(present(corrected).headingName, corrected.currentMetbull.name);
  assert.equal(present(unresolved).headingName, unresolved.parentRecord.name);
  assert.match(styles, /overflow-wrap: anywhere;/u);
  assert.match(styles, /\.record-meta div \{[^}]*grid-template-columns: minmax\(7\.25rem, 9rem\) minmax\(0, 1fr\);/u);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*\.record-meta div \{ grid-template-columns: minmax\(0, 1fr\);/u);
  assert.match(styles, /\.record-meta dt \{[^}]*word-break: normal;[^}]*overflow-wrap: normal;/u);
});

test("closed catalog-specific card facts and representative hidden facts remain searchable", () => {
  const allowed = new Set([
    "Current MetBull classification", "Current MetBull place", "Current MetBull fall/find", "Current MetBull year",
    ...STANDARD_SPECIMEN_LABELS, ...STANDARD_OBSERVATION_LABELS, ...FLETCHER_OBSERVATION_LABELS, ...FLETCHER_LABELS,
    "Locality code", "Area reference coordinate", "Olivine Fa", "Pyroxene Fs", "Weathering", "Source section"
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
  assert.equal(app.matchesSearch(noted, noted.metbull.alternateNameNote), false);
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
  assert.equal(app.filterRecords(records, filters, lineageIndex).length, 19638);
  assert.equal(new Set(descriptors.map(({ parentRecord }) => parentRecord.id)).size, 19638);
  for (const descriptor of catalog.metadata.catalogs) {
    const parents = app.filterRecords(records, { ...filters, catalog: descriptor.id }, lineageIndex);
    assert.equal(parents.length, descriptor.recordCount, descriptor.id);
    assert.equal(new Set(descriptors.filter(({ parentRecord }) => parentRecord.catalogId === descriptor.id)
      .map(({ parentRecord }) => parentRecord.id)).size, descriptor.recordCount, descriptor.id);
  }
});

test("default strict filter retains only the 14,062 source-listed-weight specimen cards", () => {
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
  assert.equal(inclusive.length, 24641);
  assert.equal(weightedOnly.length, 14062);
  assert.equal(defaultFiltered.length, 14062);
  assert.deepEqual(defaultFiltered, weightedOnly);
  assert.equal(app.WEIGHTED_DESCRIPTOR_COUNT, 14062);
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

test("weight census is a closed 14,051 numeric, 11 qualitative, and 172 source-unlisted specimen partition", () => {
  const specimens = descriptors.filter((descriptor) =>
    ["direct-specimen", "projected-atomic-specimen"].includes(app.classifyHarmonizedCard(descriptor)));
  const numeric = specimens.filter((descriptor) => app.specimenCardDescriptorMasses(descriptor).length > 0);
  const qualitative = specimens.filter((descriptor) => app.specimenCardDescriptorMasses(descriptor).length === 0 &&
    app.specimenCardDescriptorHasKnownWeight(descriptor));
  const sourceUnlisted = specimens.filter((descriptor) => !app.specimenCardDescriptorHasKnownWeight(descriptor));
  const notIndividual = descriptors.filter((descriptor) => app.classifyHarmonizedCard(descriptor) === "source-observation");
  assert.deepEqual({ specimens: specimens.length, numeric: numeric.length, qualitative: qualitative.length,
    sourceUnlisted: sourceUnlisted.length, notIndividual: notIndividual.length },
  { specimens: 14234, numeric: 14051, qualitative: 11, sourceUnlisted: 172, notIndividual: 3 });
  assert.equal(app.filterSpecimenCardDescriptors(specimens, {
    min: 0, max: null, lineageOnly: false, includeUnknownWeight: true,
  }, lineageIndex).length, 14051);
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

test("Foote and reviewed comparison endpoints retain non-specimen and exact-path semantics", () => {
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
  const candidates = lineages.comparisonGroups.flatMap(({ candidates: groupCandidates }) => groupCandidates)
    .filter(({ observations }) => observations.some(({ catalogId }) => waveCatalogs.has(catalogId)));
  assert.equal(candidates.length, 22);
  for (const candidate of candidates) {
    for (const endpoint of candidate.observations.filter(({ catalogId }) => waveCatalogs.has(catalogId))) {
      assert(descriptors.some((descriptor) => descriptor.parentRecord.id === endpoint.recordId &&
        descriptor.massPath === endpoint.massPath), `${candidate.id}: ${endpoint.massPath}`);
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
  assert.equal(app.CACHE_VERSION, "20260913-antarctic-1980-1");
  assert.equal(app.ASSET_CACHE_VERSION, "20260913-antarctic-1980-1");
  for (const document of [html, catalogsHtml]) {
    assert.match(document, /styles\.css\?v=20260913-antarctic-1980-1/u);
    assert.match(document, /app\.js\?v=20260913-antarctic-1980-1/u);
  }
  assert.match(catalogsHtml, /catalogs\.js\?v=20260913-antarctic-1980-1/u);
  assert.deepEqual({
    catalog: sha256(catalogText),
    projections: sha256(projectionText),
    lineages: sha256(lineageText),
    reviews: sha256(reviewText),
  }, {
    catalog: "9c11b7478b2ec1ce4bd8d13c275272b28f6409570c246820c2e3ce28f2f73e74",
    projections: "3437976048240713b3dbfd10cf3558bf7c6a32336560731ce89ea40455cce489",
    lineages: "0cd635900d1c3e961112e07301dc462e7e10a0bf168f5a7c1951c97394f45d87",
    reviews: "32580c887d4e26a7c22950c95e2b8629de12a60c3f307708c1ea76e33fb31938",
  });
});
