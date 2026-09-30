import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const CATALOG_ID = "monnig-current";
export const SOURCE_SHA256 = "4b84a685c9cd3fe289346570045fc6a165ec6b4fb590e52d99aac2c7bd8a123d";
export const SOURCE_BYTE_COUNT = 203656;
export const SOURCE_ROW_COUNT = 3218;
export const SOURCE_HEADER = "Name,Monnig Number,Country,Class,Clan,Group,Year Found,Sample Weight (g)";
export const NORMALIZED_SHA256 = "b7c655805366025398d05190ee523e0b8522d5a0b018e418502f33b1a4e34f64";
const ACQUISITION_SHA256 = "b9b906200c8fd0406d007a605cfa9cccce2862584a5bea9ec5c29883b3f59cf0";
export const LEDGER_SHA256 = "229d1d754c3f5eeacaa788f60163a260b50106f362561d222eadbc1f4520c79f";
export const ORDERED_IDS_SHA256 = "d24c1468b90ea5d37191be725d99f712c06aceb237b89e9fe6235226415c18f9";
export const SLICE_SHA256 = "fa847d6affe38e784051e48479a6cb0da1d6e33fc7cf1ca8d4621baf0f893ad7";
export const CLASSIFICATION_COLLAPSE_COUNT = 101;
export const CLASSIFICATION_COLLAPSE_SHA256 = "62e3c50f35a4a9a9b4964628f78aa917fe9f9fe052f652e64397b5b10fd324d8";
const NON_MONNIG_RECORDS_SHA256 = "a6ceb57546d29699577987690c721869810dbb87d4de85aa57157e68da922fcc";
const NON_MONNIG_DESCRIPTORS_SHA256 = "bfef87111cad5167c259b60ae744a1b96a88a7040bdfb04bac7f446a401708af";
const FACTUAL_FIELDS_SHA256 = "7463521d7049a3405ffaa4ebf6ddb6ef6b13887e2f25d1aa21c70d4d1c0b9141";
const NON_MONNIG_FOLIOS_SHA256 = "5d5832a687d9b049e2bc53b786db0854632d6ab4c596c9ef49f353fe39e53823";
const NON_MONNIG_RELEASE_LOCK_SHA256 = "c65ef7ce1de2e8db9d59d3af14c61c0fdce5da99f7fed851b09a1812b998ee76";
const RELEASE_ASSETS_SHA256 = "35bdb761a33700830be8e32d41b3fb6d40e723e84e54847808e2baf9a035587c";

export const REPAIRED_SOURCE_ROWS = [
  64, 68, 69, 70, 78, 88, 269, 270, 275, 276, 277, 278, 279, 280, 455, 456,
  457, 792, 834, 865, 866, 919, 920, 959, 967, 968, 1013, 1226, 1491, 1492,
  1589, 1904, 2130, 2420, 2423, 2424, 2447, 2537, 2687, 2755, 2756, 2757,
  2758, 2811, 2821, 2822, 2841, 2909,
];
const PALLASITE_REPAIR_ROWS = new Set(REPAIRED_SOURCE_ROWS.filter((row) => row !== 1904));
const SOURCE_COLUMNS = [
  "Name", "Monnig Number", "Country", "Class", "Clan", "Group", "Year Found", "Sample Weight (g)",
];
export const CANONICAL_TEXT_CHANGES = [
  { row: 967, column: "Name", before: "Glorieta  Mountain", after: "Glorieta Mountain" },
  { row: 968, column: "Name", before: "Glorieta  Mountain", after: "Glorieta Mountain" },
  { row: 1050, column: "Name", before: "Happy Draw  (a)", after: "Happy Draw (a)" },
  { row: 1348, column: "Name", before: "Little River  (a)", after: "Little River (a)" },
];
const UUID_V4 = /^obs-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
export const PUBLIC_KEYS = [
  "id", "catalogId", "designation", "name", "weight", "classification", "locality", "year",
  "catalogPage", "confidence",
];

const paths = {
  source: new URL("../data/private/monnig-current/source.csv", import.meta.url),
  acquisition: new URL("../data/private/monnig-current/acquisition.json", import.meta.url),
  ledger: new URL("../data/private/monnig-current/observation-id-ledger.json", import.meta.url),
  archiveLedger: new URL(
    "../../Historical-meteorite-collections-private/source-images/incoming-20260930/monnig-current-catalog/observation-id-ledger.json",
    import.meta.url,
  ),
  catalog: new URL("../data/catalog.json", import.meta.url),
  folios: new URL("../data/folios.json", import.meta.url),
  releaseLock: new URL("./folio-release-lock.json", import.meta.url),
};

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sortCatalogMap = (catalogs) => Object.fromEntries(
  Object.entries(catalogs).sort(([left], [right]) => left.localeCompare(right)),
);
export const sourceRowKey = (rowNumber) => `${CATALOG_ID}:source-row:${String(rowNumber).padStart(4, "0")}`;
export const canonicalizeText = (value) => value.normalize("NFC").trim().replace(/\s+/gu, " ");
export function buildClassification(...components) {
  const seen = new Set();
  const unique = components.filter((value) => value !== null && !seen.has(value) && seen.add(value));
  return unique.join(" > ") || null;
}
export function validateClassificationCollapse(changes) {
  assert.equal(changes.length, CLASSIFICATION_COLLAPSE_COUNT,
    "classification duplicate-collapse count drift");
  assert.equal(sha256(JSON.stringify(changes)), CLASSIFICATION_COLLAPSE_SHA256,
    "classification duplicate-collapse census drift");
}

export function parseSource(sourceBuffer, { lockEnvelope = true } = {}) {
  assert(Buffer.isBuffer(sourceBuffer), "source must be supplied as raw bytes");
  if (lockEnvelope) {
    assert.equal(sourceBuffer.byteLength, SOURCE_BYTE_COUNT, "source byte count drift");
    assert.equal(sha256(sourceBuffer), SOURCE_SHA256, "source hash drift");
  }
  const sourceText = sourceBuffer.toString("utf8");
  assert(!sourceText.includes("\r"), "CR/CRLF source newlines are prohibited");
  assert(!sourceText.includes("\""), "quoted CSV fields are prohibited");
  assert(!sourceText.includes("\0"), "NUL source bytes are prohibited");
  assert(!sourceText.endsWith("\n"), "source must retain its locked no-final-newline envelope");

  const lines = sourceText.split("\n");
  assert.equal(lines[0], SOURCE_HEADER, "source header drift");
  assert.equal(lines.length - 1, SOURCE_ROW_COUNT, "source row count drift");

  const repairedRows = [];
  const canonicalTextChanges = [];
  let eightFieldCount = 0;
  const normalized = lines.slice(1).map((line, index) => {
    const rowNumber = index + 1;
    let fields = line.split(",");
    if (fields.length === 8) {
      eightFieldCount += 1;
    } else if (fields.length === 9) {
      repairedRows.push(rowNumber);
      if (rowNumber === 1904) {
        assert.deepEqual(fields.slice(2, 4), ["1", "Northwest Africa"],
          "source row 1904 country repair contract drift");
        fields = [fields[0], fields[1], `${fields[2]}, ${fields[3]}`, ...fields.slice(4)];
      } else {
        assert(PALLASITE_REPAIR_ROWS.has(rowNumber), `unknown malformed source row ${rowNumber}`);
        assert.equal(fields[5], "Pallasite", `source row ${rowNumber} group repair contract drift`);
        assert([" PMG", " PES"].includes(fields[6]),
          `source row ${rowNumber} pallasite subgroup repair contract drift`);
        fields = [...fields.slice(0, 5), `${fields[5]},${fields[6]}`, ...fields.slice(7)];
      }
    } else {
      assert.fail(`source row ${rowNumber} has ${fields.length} fields; expected 8 or a known 9-field repair`);
    }
    assert.equal(fields.length, 8, `source row ${rowNumber} repair did not produce eight fields`);
    for (const field of fields) {
      assert(!field.includes(" > "), `source row ${rowNumber} collides with the classification delimiter`);
      assert(!field.includes("\n"), `source row ${rowNumber} contains a prohibited embedded newline`);
    }
    return fields.map((field, columnIndex) => {
      const outerTrimmed = field.trim();
      const canonical = canonicalizeText(field);
      if (canonical !== outerTrimmed) {
        canonicalTextChanges.push({
          row: rowNumber,
          column: SOURCE_COLUMNS[columnIndex],
          before: outerTrimmed,
          after: canonical,
        });
      }
      return canonical || null;
    });
  });

  assert.equal(eightFieldCount, 3170, "eight-field source row count drift");
  assert.deepEqual(repairedRows, REPAIRED_SOURCE_ROWS, "known nine-field repair rows drift");
  assert.deepEqual(canonicalTextChanges, CANONICAL_TEXT_CHANGES,
    "canonical NFC/internal-whitespace change census drift");
  if (lockEnvelope) {
    assert.equal(sha256(JSON.stringify(normalized)), NORMALIZED_SHA256, "normalized source hash drift");
  }
  return normalized;
}

export function validateLedger(ledgerText, ledger, normalized, { lockHash = true } = {}) {
  if (lockHash) assert.equal(sha256(ledgerText), LEDGER_SHA256, "observation ID ledger hash drift");
  assert.deepEqual(Object.keys(ledger), [
    "schemaVersion", "catalogId", "sourceSha256", "sourceByteCount", "sourceRowCount", "idScheme", "records",
  ]);
  assert.deepEqual(
    {
      schemaVersion: ledger.schemaVersion,
      catalogId: ledger.catalogId,
      sourceSha256: ledger.sourceSha256,
      sourceByteCount: ledger.sourceByteCount,
      sourceRowCount: ledger.sourceRowCount,
      idScheme: ledger.idScheme,
    },
    {
      schemaVersion: 1,
      catalogId: CATALOG_ID,
      sourceSha256: SOURCE_SHA256,
      sourceByteCount: SOURCE_BYTE_COUNT,
      sourceRowCount: SOURCE_ROW_COUNT,
      idScheme: "obs-uuidv4",
    },
  );
  const expectedKeys = normalized.map((_, index) => sourceRowKey(index + 1));
  assert.deepEqual(Object.keys(ledger.records), expectedKeys, "ledger must exactly follow source-row occurrence order");
  const ids = Object.values(ledger.records);
  assert.equal(ids.length, SOURCE_ROW_COUNT);
  assert.equal(new Set(ids).size, SOURCE_ROW_COUNT, "ledger observation IDs must be globally unique within the source");
  for (const id of ids) assert.match(id, UUID_V4);
  assert.equal(sha256(JSON.stringify(ids)), ORDERED_IDS_SHA256, "ordered observation ID hash drift");
}

export function buildRecords(normalized, ledger) {
  const classificationChanges = [];
  const records = normalized.map(([name, designation, locality, className, clan, group, year, weight], index) => {
    assert(name !== null, `source row ${index + 1} has no name`);
    assert(designation !== null, `source row ${index + 1} has no Monnig number`);
    assert(weight === null || /^(?:0|[1-9][0-9]*)\.[0-9]{2}$/u.test(weight),
      `source row ${index + 1} weight is not a locked two-decimal gram value`);
    const sourceComponents = [className, clan, group].filter((value) => value !== null);
    const classification = buildClassification(className, clan, group);
    const sourceClassification = sourceComponents.join(" > ") || null;
    if (classification !== sourceClassification) {
      classificationChanges.push({ row: index + 1, before: sourceClassification, after: classification });
    }
    const record = {
      id: ledger.records[sourceRowKey(index + 1)],
      catalogId: CATALOG_ID,
      designation,
      name,
      weight: weight === null ? null : { grams: Number(weight) },
      classification,
      locality,
      year,
      catalogPage: null,
      confidence: "high",
    };
    assert.deepEqual(Object.keys(record), PUBLIC_KEYS);
    return record;
  });
  validateClassificationCollapse(classificationChanges);
  assert.equal(sha256(JSON.stringify(records)), SLICE_SHA256, "emitted Monnig slice hash drift");
  return records;
}

function buildDescriptor(records) {
  return {
    id: CATALOG_ID,
    recordModel: "specimen",
    label: "Monnig Meteorite Collection Catalog",
    compiler: "Texas Christian University",
    year: 2026,
    sourcePages: [],
    sourcePageCount: 0,
    recordCount: records.length,
    recordsWithDesignation: records.filter(({ designation }) => designation !== null).length,
    recordsWithWeight: records.filter(({ weight }) => weight !== null).length,
    confidenceCounts: { high: records.length, medium: 0, low: 0 },
    folioDisplayPolicy: "blocked",
    rightsStatus: "undetermined",
  };
}

function assertPreservedInputs(catalog, folios, releaseLock) {
  assert.equal(sha256(JSON.stringify(catalog.records.filter(({ catalogId }) => catalogId !== CATALOG_ID))),
    NON_MONNIG_RECORDS_SHA256, "preexisting public records drift");
  assert.equal(sha256(JSON.stringify(catalog.metadata.catalogs.filter(({ id }) => id !== CATALOG_ID))),
    NON_MONNIG_DESCRIPTORS_SHA256, "preexisting catalog descriptors drift");
  assert.equal(sha256(JSON.stringify(catalog.metadata.factualFields)), FACTUAL_FIELDS_SHA256,
    "preexisting factual fields drift");
  assert.equal(sha256(JSON.stringify(Object.fromEntries(
    Object.entries(folios.catalogs).filter(([id]) => id !== CATALOG_ID),
  ))), NON_MONNIG_FOLIOS_SHA256, "preexisting folio descriptors drift");
  assert.equal(sha256(JSON.stringify(Object.fromEntries(
    Object.entries(releaseLock.catalogs).filter(([id]) => id !== CATALOG_ID),
  ))), NON_MONNIG_RELEASE_LOCK_SHA256, "preexisting release-lock descriptors drift");
  assert.equal(sha256(JSON.stringify(releaseLock.assets)), RELEASE_ASSETS_SHA256, "preexisting release assets drift");
}

function buildCatalog(current, records) {
  const previous = current.metadata.catalogs.find(({ id }) => id === CATALOG_ID);
  const descriptors = current.metadata.catalogs.filter(({ id }) => id !== CATALOG_ID);
  const insertionIndex = descriptors.findIndex(({ id }) => id.localeCompare(CATALOG_ID) > 0);
  descriptors.splice(insertionIndex === -1 ? descriptors.length : insertionIndex, 0, buildDescriptor(records));
  const nonMonnigRecords = current.records.filter(({ catalogId }) => catalogId !== CATALOG_ID);
  const existingIds = new Set(nonMonnigRecords.map(({ id }) => id));
  for (const { id } of records) assert(!existingIds.has(id), `Monnig observation ID collides with existing public ID ${id}`);
  const allRecords = [...nonMonnigRecords, ...records];
  const confidenceCounts = allRecords.reduce(
    (counts, { confidence }) => ({ ...counts, [confidence]: counts[confidence] + 1 }),
    { high: 0, medium: 0, low: 0 },
  );
  return {
    metadata: {
      ...current.metadata,
      schemaVersion: 16,
      catalogs: descriptors,
      recordCount: allRecords.length,
      recordsWithDesignation: current.metadata.recordsWithDesignation -
        (previous?.recordsWithDesignation ?? 0) + records.length,
      recordsWithWeight: current.metadata.recordsWithWeight -
        (previous?.recordsWithWeight ?? 0) + records.filter(({ weight }) => weight !== null).length,
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
  assert(!current.assets.some(({ path }) => path.includes(CATALOG_ID)), "Monnig folio assets are prohibited");
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

async function pathExists(url) {
  try {
    await access(url);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function initializeLedger() {
  assert.equal(await pathExists(paths.ledger), false, "private ledger already exists; refusing to regenerate it");
  assert.equal(await pathExists(paths.archiveLedger), false, "archived ledger already exists; refusing to regenerate it");
  const sourceBuffer = await readFile(paths.source);
  const normalized = parseSource(sourceBuffer);
  const records = Object.fromEntries(normalized.map((_, index) => [
    sourceRowKey(index + 1), `obs-${randomUUID()}`,
  ]));
  const ledgerText = serialize({
    schemaVersion: 1,
    catalogId: CATALOG_ID,
    sourceSha256: SOURCE_SHA256,
    sourceByteCount: SOURCE_BYTE_COUNT,
    sourceRowCount: SOURCE_ROW_COUNT,
    idScheme: "obs-uuidv4",
    records,
  });
  await Promise.all([writeFile(paths.ledger, ledgerText, { flag: "wx" }), writeFile(paths.archiveLedger, ledgerText, { flag: "wx" })]);
  console.log(`Initialized and archived ${SOURCE_ROW_COUNT} Monnig UUIDv4 observation IDs (${sha256(ledgerText)}).`);
}

async function main() {
  const mode = process.argv[2];
  assert(["--check", "--write", "--initialize-ledger"].includes(mode),
    "usage: node scripts/build-monnig-current-public.mjs --check|--write|--initialize-ledger");
  assert.equal(process.argv.length, 3, "unexpected arguments");
  if (mode === "--initialize-ledger") {
    await initializeLedger();
    return;
  }

  const [sourceBuffer, acquisitionText, ledgerText, catalogText, foliosText, releaseLockText] = await Promise.all([
    readFile(paths.source),
    readFile(paths.acquisition, "utf8"),
    readFile(paths.ledger, "utf8"),
    readFile(paths.catalog, "utf8"),
    readFile(paths.folios, "utf8"),
    readFile(paths.releaseLock, "utf8"),
  ]);
  assert.equal(sha256(acquisitionText), ACQUISITION_SHA256, "private acquisition metadata hash drift");
  const acquisition = JSON.parse(acquisitionText);
  assert.deepEqual(
    { rows: acquisition.dataRowCount, bytes: acquisition.byteCount, sha256: acquisition.sha256 },
    { rows: SOURCE_ROW_COUNT, bytes: SOURCE_BYTE_COUNT, sha256: SOURCE_SHA256 },
  );
  const normalized = parseSource(sourceBuffer);
  const ledger = JSON.parse(ledgerText);
  validateLedger(ledgerText, ledger, normalized);
  const records = buildRecords(normalized, ledger);
  const catalog = JSON.parse(catalogText);
  const folios = JSON.parse(foliosText);
  const releaseLock = JSON.parse(releaseLockText);
  assertPreservedInputs(catalog, folios, releaseLock);
  const outputs = [
    [paths.catalog, catalogText, serialize(buildCatalog(catalog, records))],
    [paths.folios, foliosText, serialize(buildFolios(folios))],
    [paths.releaseLock, releaseLockText, serialize(buildReleaseLock(releaseLock))],
  ];

  if (mode === "--check") {
    for (const [path, currentText, expectedText] of outputs) {
      assert.equal(currentText, expectedText, `${path.pathname} is not the deterministic Monnig public output`);
    }
    console.log(`Monnig current public data is current (${records.length} records, ${SLICE_SHA256}).`);
    return;
  }
  await Promise.all(outputs
    .filter(([, currentText, expectedText]) => currentText !== expectedText)
    .map(([path, , expectedText]) => writeFile(path, expectedText)));
  console.log(`Wrote Monnig current public data (${records.length} records, ${SLICE_SHA256}).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
