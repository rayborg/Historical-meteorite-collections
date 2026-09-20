import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const CATALOG_ID = "haag-2003";
const ACCEPTED_SHA256 = "c0b800dc176d61a0d1384cf4198d3ed0a0392ae0f344ebf967fbd0623296f039";
const LEDGER_SHA256 = "18b25d7c40bc6f4dbcd4c91ac7910602c45153abfc36c1c64704305b924e7639";
const SLICE_SHA256 = "9b67eb8920ba5617e4193b32baec09a0cbfaa36fb53ec1197112632d8211b846";
const UNRECOVERED_IDS_SHA256 = "c6d606552831853dedb5a323d19f3a8cf25941b0cfda7dfde3171ef909b22056";
const RECOVERED_MAPPINGS = [
  ["haag-2003-caption-0001", "haag-2003:source-row:001", 1, "ADAMANA", "obs-3efe5a17-0bf6-4af0-af8b-1157dc1e73a5"],
  ["haag-2003-caption-0002", "haag-2003:source-row:002", 2, "ESQUEL", "obs-b0895814-8e72-45c1-b209-30fd720a313c"],
  ["haag-2003-caption-0003", "haag-2003:source-row:003", 3, "BEN SOUR", "obs-a1f492ce-aee2-44ed-926b-de266d098fb3"],
  ["haag-2003-caption-0004", "haag-2003:source-row:004", 4, "PORTALES VALLEY", "obs-62d5f842-d170-4756-a5f2-d4e8639195c6"],
  ["haag-2003-caption-0005", "haag-2003:source-row:005", 5, "Gibeon", "obs-b89aac34-3b2e-4de8-830f-257339fec29b"],
  ["haag-2003-caption-0006", "haag-2003:source-row:006", 6, "SIKHOTE ALIN", "obs-8000be81-82f5-4110-ac34-d600a2296f42"],
  ["haag-2003-caption-0007", "haag-2003:source-row:007", 7, "HENBURY", "obs-d93bd883-eff3-47a6-b379-5f1205e97b47"],
  ["haag-2003-caption-0008", "haag-2003:source-row:008", 8, "TAZA", "obs-1b8c4840-be2b-4d87-bc42-4c1532312057"],
  ["haag-2003-caption-0009", "haag-2003:source-row:009", 9, "MUNDRABILLA", "obs-a1a42915-3a15-4837-aa2b-4a007b13766a"],
  ["haag-2003-caption-0010", "haag-2003:source-row:010", 10, "haag-2003-caption-0010", "obs-9fe7ae68-2892-4f00-8dbe-75776be86841"],
  ["haag-2003-caption-0011", "haag-2003:source-row:011", 11, "GIBEON", "obs-68b13e78-3a89-4c3e-986c-abdcf5925b62"],
  ["haag-2003-caption-0013", "haag-2003:source-row:012", 12, "CANYON DIABLO", "obs-4da1fc86-4833-46d8-9ca5-473a120dd385"],
  ["haag-2003-caption-0014", "haag-2003:source-row:013", 13, "Canyon Diablo", "obs-32287bd9-a55c-4057-8066-7ed42b8a15e2"],
  ["haag-2003-caption-0015", "haag-2003:source-row:014", 14, "BOXHOLE", "obs-eb124cd9-8e67-47d1-91d8-99af05fc1350"],
].map(([boundaryId, sourceRowKey, sourceOrder, sourceName, observationId]) => ({
  boundaryId,
  sourceRowKey,
  sourceOrder,
  sourceName,
  observationId,
}));
const UUID_V4 = /^obs-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const PUBLIC_KEYS = [
  "id",
  "catalogId",
  "entryOrder",
  "captionTitle",
  "name",
  "classification",
  "reportedMass",
  "reportedDimensions",
  "photoPanelCount",
  "sourceRelation",
  "catalogPages",
  "printedPageLabel",
  "confidence",
];
const CONFIDENCE_FIELDS = [
  "titleField",
  "subjectNameText",
  "classificationText",
  "massText",
  "dimensionsText",
  "photoPanelCount",
  "repeatedViewOf",
  "printedPageText",
];
const FACTUAL_FIELDS = [
  "captionTitle",
  "reportedMass.valueText",
  "reportedMass.semantics",
  "reportedDimensions.valueText",
  "reportedDimensions.semantics",
  "photoPanelCount",
  "sourceRelation.type",
  "sourceRelation.recordId",
  "printedPageLabel",
];

const paths = {
  accepted: new URL("../data/private/haag-2003/accepted-records.json", import.meta.url),
  ledger: new URL("../data/private/haag-2003/observation-id-ledger.json", import.meta.url),
  catalog: new URL("../data/catalog.json", import.meta.url),
  folios: new URL("../data/folios.json", import.meta.url),
  releaseLock: new URL("./folio-release-lock.json", import.meta.url),
};

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;
const pageRange = (start, end) => Array.from({ length: end - start + 1 }, (_, index) => start + index);
const sortCatalogMap = (catalogs) => Object.fromEntries(
  Object.entries(catalogs).sort(([left], [right]) => left.localeCompare(right)),
);
const contextualValue = (value) => value === null ? null : {
  valueText: value,
  semantics: "caption-context-only",
};

function validateInputs(acceptedText, accepted, ledgerText, ledger) {
  assert.equal(sha256(acceptedText), ACCEPTED_SHA256, "accepted-records.json hash drift");
  assert.equal(sha256(ledgerText), LEDGER_SHA256, "observation ID ledger hash drift");
  assert.deepEqual(
    { schemaVersion: accepted.schemaVersion, catalogId: accepted.catalogId, status: accepted.status },
    { schemaVersion: 1, catalogId: CATALOG_ID, status: "accepted-zero-open" },
  );
  assert.equal(accepted.counts.records, 250);
  assert.equal(accepted.counts.openDecisions, 0);
  assert.equal(accepted.records.length, 250);
  assert.deepEqual(
    { schemaVersion: ledger.schemaVersion, catalogId: ledger.catalogId, idScheme: ledger.idScheme },
    { schemaVersion: 1, catalogId: CATALOG_ID, idScheme: "obs-uuidv4" },
  );
  assert.deepEqual(ledger.recoveredMappings, RECOVERED_MAPPINGS, "recovered historical UUID prefix drift");

  const acceptedBoundaryIds = accepted.records.map(({ boundaryId }) => boundaryId);
  assert.deepEqual(Object.keys(ledger.records), acceptedBoundaryIds, "ledger must exactly follow accepted source order");
  assert.deepEqual(
    Object.entries(ledger.records).slice(0, RECOVERED_MAPPINGS.length),
    RECOVERED_MAPPINGS.map(({ boundaryId, observationId }) => [boundaryId, observationId]),
    "recovered historical UUID reassignment",
  );
  assert.equal(
    sha256(JSON.stringify(Object.entries(ledger.records).slice(RECOVERED_MAPPINGS.length))),
    UNRECOVERED_IDS_SHA256,
    "stable newly allocated UUID suffix drift",
  );
  const ids = Object.values(ledger.records);
  assert.equal(new Set(ids).size, 250, "ledger IDs must be unique");
  for (const id of ids) assert.match(id, UUID_V4);
}

function buildRecords(accepted, ledger) {
  const seenBoundaryIds = new Set();
  const records = accepted.records.map((source, index) => {
    assert.equal(source.boundaryOrder > 0, true);
    assert.equal(source.pdfPages.length > 0, true);
    assert(source.pdfPages.every((page) => Number.isInteger(page) && page >= 1 && page <= 146));

    let sourceRelation = null;
    if (source.repeatedViewOf !== null) {
      assert(seenBoundaryIds.has(source.repeatedViewOf), `${source.boundaryId} must link to an earlier record`);
      sourceRelation = { type: "repeated-view", recordId: ledger.records[source.repeatedViewOf] };
    }
    seenBoundaryIds.add(source.boundaryId);

    const confidence = CONFIDENCE_FIELDS.some((field) => source.fieldConfidence[field] === "low")
      ? "low"
      : "high";
    const record = {
      id: ledger.records[source.boundaryId],
      catalogId: CATALOG_ID,
      entryOrder: index + 1,
      captionTitle: source.titleField,
      name: source.subjectNameText,
      classification: source.classificationText,
      reportedMass: contextualValue(source.massText),
      reportedDimensions: contextualValue(source.dimensionsText),
      photoPanelCount: source.photoPanelCount,
      sourceRelation,
      catalogPages: source.pdfPages,
      printedPageLabel: source.printedPageText,
      confidence,
    };
    assert.deepEqual(Object.keys(record), PUBLIC_KEYS);
    return record;
  });

  assert.equal(records.filter(({ sourceRelation }) => sourceRelation !== null).length, 18);
  assert.deepEqual(
    records.reduce(
      (counts, { confidence }) => ({ ...counts, [confidence]: counts[confidence] + 1 }),
      { high: 0, medium: 0, low: 0 },
    ),
    { high: 247, medium: 0, low: 3 },
  );
  assert.equal(new Set(records.flatMap(({ catalogPages }) => catalogPages)).size, 134);
  assert.equal(sha256(JSON.stringify(records)), SLICE_SHA256, "emitted Haag slice hash drift");
  return records;
}

function buildDescriptor(records) {
  const confidenceCounts = records.reduce(
    (counts, { confidence }) => ({ ...counts, [confidence]: counts[confidence] + 1 }),
    { high: 0, medium: 0, low: 0 },
  );
  return {
    id: CATALOG_ID,
    recordModel: "caption-observation-fact",
    label: "Robert Haag Meteorite Catalog 2003",
    compiler: "Robert Haag",
    year: 2003,
    sourcePages: pageRange(1, 146),
    sourcePageCount: 146,
    recordCount: records.length,
    recordsWithDesignation: 0,
    recordsWithWeight: 0,
    confidenceCounts,
    folioDisplayPolicy: "blocked",
    rightsStatus: "undetermined",
  };
}

function buildCatalog(current, records) {
  const previousDescriptor = current.metadata.catalogs.find(({ id }) => id === CATALOG_ID);
  const nonHaagRecords = current.records.filter(({ catalogId }) => catalogId !== CATALOG_ID);
  const existingIds = new Set(nonHaagRecords.map(({ id }) => id));
  for (const record of records) assert(!existingIds.has(record.id), `duplicate public ID ${record.id}`);

  const descriptors = current.metadata.catalogs.filter(({ id }) => id !== CATALOG_ID);
  const descriptor = buildDescriptor(records);
  const insertionIndex = descriptors.findIndex(({ id }) => id.localeCompare(CATALOG_ID) > 0);
  descriptors.splice(insertionIndex === -1 ? descriptors.length : insertionIndex, 0, descriptor);

  const allRecords = [...nonHaagRecords, ...records];
  const confidenceCounts = allRecords.reduce(
    (counts, { confidence }) => ({ ...counts, [confidence]: counts[confidence] + 1 }),
    { high: 0, medium: 0, low: 0 },
  );
  return {
    metadata: {
      ...current.metadata,
      schemaVersion: 15,
      factualFields: [...current.metadata.factualFields.filter((field) => !FACTUAL_FIELDS.includes(field)), ...FACTUAL_FIELDS],
      catalogs: descriptors,
      recordCount: allRecords.length,
      recordsWithDesignation: current.metadata.recordsWithDesignation -
        (previousDescriptor?.recordsWithDesignation ?? 0),
      recordsWithWeight: current.metadata.recordsWithWeight - (previousDescriptor?.recordsWithWeight ?? 0),
      confidenceCounts,
    },
    records: allRecords,
  };
}

function buildFolios(current) {
  return {
    ...current,
    catalogs: sortCatalogMap({
      ...current.catalogs,
      [CATALOG_ID]: { displayPolicy: "blocked", rightsStatus: "undetermined", pages: [] },
    }),
  };
}

function buildReleaseLock(current) {
  assert(!current.assets.some(({ path }) => path.includes(CATALOG_ID)), "Haag folio assets are prohibited");
  return {
    ...current,
    catalogs: sortCatalogMap({
      ...current.catalogs,
      [CATALOG_ID]: {
        displayPolicy: "blocked",
        rightsStatus: "undetermined",
        basis: null,
        basisUrl: null,
        pageIds: [],
      },
    }),
  };
}

async function main() {
  const mode = process.argv[2];
  assert(["--check", "--write"].includes(mode), "usage: node scripts/build-haag-2003-public.mjs --check|--write");
  assert.equal(process.argv.length, 3, "unexpected arguments");

  const [acceptedText, ledgerText, catalogText, foliosText, releaseLockText] = await Promise.all([
    readFile(paths.accepted, "utf8"),
    readFile(paths.ledger, "utf8"),
    readFile(paths.catalog, "utf8"),
    readFile(paths.folios, "utf8"),
    readFile(paths.releaseLock, "utf8"),
  ]);
  const accepted = JSON.parse(acceptedText);
  const ledger = JSON.parse(ledgerText);
  validateInputs(acceptedText, accepted, ledgerText, ledger);
  const records = buildRecords(accepted, ledger);
  const outputs = [
    [paths.catalog, catalogText, serialize(buildCatalog(JSON.parse(catalogText), records))],
    [paths.folios, foliosText, serialize(buildFolios(JSON.parse(foliosText)))],
    [paths.releaseLock, releaseLockText, serialize(buildReleaseLock(JSON.parse(releaseLockText)))],
  ];

  if (mode === "--check") {
    for (const [path, currentText, expectedText] of outputs) {
      assert.equal(currentText, expectedText, `${path.pathname} is not the deterministic Haag public output`);
    }
    console.log(`Haag 2003 public data is current (${records.length} records, ${SLICE_SHA256}).`);
    return;
  }

  await Promise.all(outputs
    .filter(([, currentText, expectedText]) => currentText !== expectedText)
    .map(([path, , expectedText]) => writeFile(path, expectedText)));
  console.log(`Wrote Haag 2003 public data (${records.length} records, ${SLICE_SHA256}).`);
}

await main();
