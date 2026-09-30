import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";
import {
  CANONICAL_TEXT_CHANGES,
  CATALOG_ID,
  CLASSIFICATION_COLLAPSE_COUNT,
  CLASSIFICATION_COLLAPSE_SHA256,
  LEDGER_SHA256,
  NORMALIZED_SHA256,
  ORDERED_IDS_SHA256,
  PUBLIC_KEYS,
  REPAIRED_SOURCE_ROWS,
  SLICE_SHA256,
  SOURCE_BYTE_COUNT,
  SOURCE_HEADER,
  SOURCE_ROW_COUNT,
  SOURCE_SHA256,
  buildRecords,
  buildClassification,
  canonicalizeText,
  parseSource,
  sha256,
  sourceRowKey,
  validateClassificationCollapse,
  validateLedger,
} from "./build-monnig-current-public.mjs";

const execFileAsync = promisify(execFile);
const privateUrls = [
  new URL("../data/private/monnig-current/source.csv", import.meta.url),
  new URL("../data/private/monnig-current/acquisition.json", import.meta.url),
  new URL("../data/private/monnig-current/observation-id-ledger.json", import.meta.url),
];

async function readOptional(url, encoding) {
  try {
    return await readFile(url, encoding);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export function assertPrivateInputState(values) {
  const present = values.map((value) => value !== null);
  assert(present.every(Boolean) || present.every((value) => !value),
    "private Monnig source, acquisition metadata, and ledger must all be present or all be absent");
  return present.every(Boolean);
}

const [catalogText, foliosText, releaseLockText, sourceBuffer, acquisitionText, ledgerText] = await Promise.all([
  readFile(new URL("../data/catalog.json", import.meta.url), "utf8"),
  readFile(new URL("../data/folios.json", import.meta.url), "utf8"),
  readFile(new URL("./folio-release-lock.json", import.meta.url), "utf8"),
  readOptional(privateUrls[0]),
  readOptional(privateUrls[1], "utf8"),
  readOptional(privateUrls[2], "utf8"),
]);
const hasPrivateInputs = assertPrivateInputState([sourceBuffer, acquisitionText, ledgerText]);
const privateTest = { skip: hasPrivateInputs ? false : "private Monnig inputs are unavailable" };
const catalog = JSON.parse(catalogText);
const folios = JSON.parse(foliosText);
const releaseLock = JSON.parse(releaseLockText);
const records = catalog.records.filter(({ catalogId }) => catalogId === CATALOG_ID);
const descriptor = catalog.metadata.catalogs.find(({ id }) => id === CATALOG_ID);
const normalized = hasPrivateInputs ? parseSource(sourceBuffer) : null;
const ledger = hasPrivateInputs ? JSON.parse(ledgerText) : null;

test("locks the public Monnig slice and stable ordered UUIDv4 identities", () => {
  assert.equal(records.length, SOURCE_ROW_COUNT);
  assert.equal(sha256(JSON.stringify(records)), SLICE_SHA256);
  assert.equal(sha256(JSON.stringify(records.map(({ id }) => id))), ORDERED_IDS_SHA256);
  assert.equal(new Set(records.map(({ id }) => id)).size, SOURCE_ROW_COUNT);
  assert(records.every(({ id }) => /^obs-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(id)));
  const allIds = catalog.records.map(({ id }) => id);
  assert.equal(new Set(allIds).size, allIds.length, "Monnig IDs must also be globally unique");
});

test("preserves every pre-correction UUID assignment", () => {
  const preCorrectionOrderedIdsSha256 = "d24c1468b90ea5d37191be725d99f712c06aceb237b89e9fe6235226415c18f9";
  assert.equal(ORDERED_IDS_SHA256, preCorrectionOrderedIdsSha256);
  assert.equal(sha256(JSON.stringify(records.map(({ id }) => id))), preCorrectionOrderedIdsSha256);
  assert.deepEqual([967, 968, 1050, 1348].map((row) => records[row - 1].id), [
    "obs-35de5330-7f83-46a9-8e85-555d1d73c86c",
    "obs-a6a07519-a86a-47a0-b052-2e068899ad5a",
    "obs-cfb692b1-b292-4f23-a8ab-d56c540c9156",
    "obs-09f8e1e1-1671-4e56-ac38-319ea8c271e0",
  ]);
});

test("preserves every pre-classification-correction ID and non-classification field", () => {
  assert.equal(sha256(JSON.stringify(records.map(({ id }) => id))),
    "d24c1468b90ea5d37191be725d99f712c06aceb237b89e9fe6235226415c18f9");
  assert.equal(sha256(JSON.stringify(records.map(({ classification, ...record }) => record))),
    "737867fcc100a2758c7e6fc03055b399402edf6d99e14fc4e8fd8000b16e7680");
});

test("publishes exact closed specimen facts with all nullable-property counts", () => {
  for (const record of records) {
    assert.deepEqual(Object.keys(record), PUBLIC_KEYS);
    assert.equal(record.catalogId, CATALOG_ID);
    assert.equal(record.catalogPage, null);
    assert.equal(record.confidence, "high");
    assert.equal(typeof record.name, "string");
    assert.equal(typeof record.designation, "string");
    for (const value of [
      record.designation, record.name, record.classification, record.locality, record.year,
    ]) {
      if (value !== null) assert.equal(value, canonicalizeText(value));
    }
    assert(record.weight === null || (
      Object.keys(record.weight).length === 1 && Number.isFinite(record.weight.grams) && record.weight.grams >= 0
    ));
    assert(record.classification === null || !record.classification.startsWith(" > "));
    assert(record.classification === null || !record.classification.endsWith(" > "));
    if (record.classification !== null) {
      const components = record.classification.split(" > ");
      assert.equal(new Set(components).size, components.length, `${record.id} repeats a classification component`);
    }
  }
  assert.deepEqual({
    weight: records.filter(({ weight }) => weight === null).length,
    classification: records.filter(({ classification }) => classification === null).length,
    locality: records.filter(({ locality }) => locality === null).length,
    year: records.filter(({ year }) => year === null).length,
  }, { weight: 31, classification: 12, locality: 10, year: 96 });
  assert.equal(records.filter(({ classification }) => classification?.includes("Pallasite, PMG")).length, 43);
  assert.equal(records.filter(({ classification }) => classification?.includes("Pallasite, PES")).length, 4);
  assert.equal(records[1903].locality, "1, Northwest Africa");
  assert.equal(records[1903].classification, "Primitive Achondrite > WIN-IAB-IICD > IAB");
});

test("retains all three duplicated Monnig numbers as six distinct observations", () => {
  const duplicateGroups = Object.groupBy(records, ({ designation }) => designation);
  assert.deepEqual(
    Object.entries(duplicateGroups).filter(([, group]) => group.length > 1).map(([designation, group]) => ({
      designation,
      count: group.length,
      ids: new Set(group.map(({ id }) => id)).size,
    })),
    [
      { designation: "M22326", count: 2, ids: 2 },
      { designation: "M2298", count: 2, ids: 2 },
      { designation: "M22329", count: 2, ids: 2 },
    ],
  );
});

test("uses schema 16 totals, the current-catalog descriptor, and blocked zero-folio metadata", () => {
  assert.deepEqual(
    { schema: catalog.metadata.schemaVersion, catalogs: catalog.metadata.catalogs.length, records: catalog.records.length },
    { schema: 16, catalogs: 57, records: 23459 },
  );
  assert.equal(catalog.metadata.recordCount, 23459);
  assert.equal(catalog.metadata.recordsWithDesignation, 9175);
  assert.equal(catalog.metadata.recordsWithWeight, 21169);
  assert.deepEqual(catalog.metadata.confidenceCounts, { high: 22101, medium: 1355, low: 3 });
  assert.deepEqual(descriptor, {
    id: CATALOG_ID,
    recordModel: "specimen",
    label: "Monnig Meteorite Collection Catalog",
    compiler: "Texas Christian University",
    year: 2026,
    sourcePages: [],
    sourcePageCount: 0,
    recordCount: 3218,
    recordsWithDesignation: 3218,
    recordsWithWeight: 3187,
    confidenceCounts: { high: 3218, medium: 0, low: 0 },
    folioDisplayPolicy: "blocked",
    rightsStatus: "undetermined",
  });
  assert.deepEqual(folios.catalogs[CATALOG_ID], {
    displayPolicy: "blocked", rightsStatus: "undetermined", pages: [],
  });
  assert.deepEqual(releaseLock.catalogs[CATALOG_ID], {
    displayPolicy: "blocked", rightsStatus: "undetermined", basis: null, basisUrl: null, pageIds: [],
  });
  assert(!releaseLock.assets.some(({ path }) => path.includes(CATALOG_ID)));
  assert.deepEqual(Object.keys(folios.catalogs), Object.keys(folios.catalogs).toSorted());
  assert.deepEqual(Object.keys(releaseLock.catalogs), Object.keys(releaseLock.catalogs).toSorted());
});

test("preserves every preexisting public record, descriptor, folio, field, and asset", () => {
  assert.equal(sha256(JSON.stringify(catalog.records.filter(({ catalogId }) => catalogId !== CATALOG_ID))),
    "a6ceb57546d29699577987690c721869810dbb87d4de85aa57157e68da922fcc");
  assert.equal(sha256(JSON.stringify(catalog.metadata.catalogs.filter(({ id }) => id !== CATALOG_ID))),
    "bfef87111cad5167c259b60ae744a1b96a88a7040bdfb04bac7f446a401708af");
  assert.equal(sha256(JSON.stringify(catalog.metadata.factualFields)),
    "7463521d7049a3405ffaa4ebf6ddb6ef6b13887e2f25d1aa21c70d4d1c0b9141");
  assert.equal(sha256(JSON.stringify(Object.fromEntries(
    Object.entries(folios.catalogs).filter(([id]) => id !== CATALOG_ID),
  ))), "5d5832a687d9b049e2bc53b786db0854632d6ab4c596c9ef49f353fe39e53823");
  assert.equal(sha256(JSON.stringify(Object.fromEntries(
    Object.entries(releaseLock.catalogs).filter(([id]) => id !== CATALOG_ID),
  ))), "c65ef7ce1de2e8db9d59d3af14c61c0fdce5da99f7fed851b09a1812b998ee76");
  assert.equal(sha256(JSON.stringify(releaseLock.assets)),
    "35bdb761a33700830be8e32d41b3fb6d40e723e84e54847808e2baf9a035587c");
});

test("excludes private mechanics, prohibited claims, prose, files, and source metadata", () => {
  const rendered = JSON.stringify(records);
  for (const prohibitedKey of [
    "metbull", "lineage", "currentContext", "sourceRow", "sourceUrl", "notes", "description", "provenance",
    "entryOrder", "catalogPages", "specimenId", "holdings", "weightEvidence", "associatedMaterial",
  ]) {
    assert(!rendered.includes(`\"${prohibitedKey}\"`), prohibitedKey);
  }
  assert.doesNotMatch(rendered, /(?:\/private\/|\/Users\/|file:\/\/|assets\/|\.csv|4b84a685c9cd)/iu);
});

test("locks source bytes, acquisition evidence, normalized rows, and ledger when available", privateTest, () => {
  assert.equal(sourceBuffer.byteLength, SOURCE_BYTE_COUNT);
  assert.equal(sha256(sourceBuffer), SOURCE_SHA256);
  assert.equal(sha256(acquisitionText), "b9b906200c8fd0406d007a605cfa9cccce2862584a5bea9ec5c29883b3f59cf0");
  assert.equal(sha256(ledgerText), LEDGER_SHA256);
  assert.equal(sha256(JSON.stringify(normalized)), NORMALIZED_SHA256);
  assert.equal(normalized.length, SOURCE_ROW_COUNT);
  assert.deepEqual(Object.keys(ledger.records), normalized.map((_, index) => sourceRowKey(index + 1)));
  assert.equal(sha256(JSON.stringify(Object.values(ledger.records))), ORDERED_IDS_SHA256);
  validateLedger(ledgerText, ledger, normalized);
  const acquisition = JSON.parse(acquisitionText);
  assert.deepEqual(
    { rows: acquisition.dataRowCount, bytes: acquisition.byteCount, sha256: acquisition.sha256 },
    { rows: SOURCE_ROW_COUNT, bytes: SOURCE_BYTE_COUNT, sha256: SOURCE_SHA256 },
  );
});

test("locks the exact four-field canonical whitespace census", privateTest, () => {
  const lines = sourceBuffer.toString("utf8").split("\n").slice(1);
  const changes = [];
  for (const [index, line] of lines.entries()) {
    const row = index + 1;
    let fields = line.split(",");
    if (row === 1904) fields = [fields[0], fields[1], `${fields[2]}, ${fields[3]}`, ...fields.slice(4)];
    else if (fields.length === 9) fields = [...fields.slice(0, 5), `${fields[5]},${fields[6]}`, ...fields.slice(7)];
    for (const [columnIndex, field] of fields.entries()) {
      const before = field.trim();
      const after = canonicalizeText(field);
      if (before !== after) changes.push({
        row,
        column: [
          "Name", "Monnig Number", "Country", "Class", "Clan", "Group", "Year Found", "Sample Weight (g)",
        ][columnIndex],
        before,
        after,
      });
    }
  }
  assert.equal(changes.length, 4);
  assert.equal(new Set(changes.map(({ row }) => row)).size, 4);
  assert.deepEqual(changes, CANONICAL_TEXT_CHANGES);
  assert.deepEqual(CANONICAL_TEXT_CHANGES.map(({ row, after }) => ({ row, name: records[row - 1].name })),
    CANONICAL_TEXT_CHANGES.map(({ row, after }) => ({ row, name: after })));
});

test("maps every exact source-row occurrence one-to-one through the documented transform", privateTest, () => {
  assert.deepEqual(records, buildRecords(normalized, ledger));
  for (const [index, [name, designation, locality, className, clan, group, year, weight]] of normalized.entries()) {
    assert.deepEqual(records[index], {
      id: ledger.records[sourceRowKey(index + 1)],
      catalogId: CATALOG_ID,
      designation,
      name,
      weight: weight === null ? null : { grams: Number(weight) },
      classification: buildClassification(className, clan, group),
      locality,
      year,
      catalogPage: null,
      confidence: "high",
    });
  }
});

test("locks all 101 exact duplicate-classification collapses", privateTest, () => {
  const changes = normalized.flatMap(([, , , className, clan, group], index) => {
    const before = [className, clan, group].filter((value) => value !== null).join(" > ") || null;
    const after = buildClassification(className, clan, group);
    return before === after ? [] : [{ row: index + 1, before, after }];
  });
  assert.equal(changes.length, CLASSIFICATION_COLLAPSE_COUNT);
  assert.equal(sha256(JSON.stringify(changes)), CLASSIFICATION_COLLAPSE_SHA256);
  assert.equal(sha256(JSON.stringify(changes.map(({ row }) => row))),
    "58540cf2d36918d8960cbe34fb39134d6e1008aafa814c60d839710689290427");
  assert.deepEqual(
    Object.fromEntries(Object.entries(Object.groupBy(changes, ({ before }) => before)).map(([before, group]) => [
      before,
      group.length,
    ])),
    {
      "Carbonaceous Chondrite > CR > CR": 21,
      "Primitive Achondrite > IAB > IAB": 1,
      "Iron > Iron > Ungrouped": 1,
      "Iron > Iron": 1,
      "Iron > Iron > IIAB": 1,
      "Unknown > Unknown > Unknown": 72,
      "Carbonaceous Chondrite > CI > CI": 3,
      "Carbonaceous Chondrite > C > C": 1,
    },
  );
  for (const { row, after } of changes) assert.equal(records[row - 1].classification, after);
});

test("classification construction cannot regress to an undeduplicated join", () => {
  assert.equal(buildClassification("Unknown", "Unknown", "Unknown"), "Unknown");
  assert.equal(buildClassification("Iron", "Iron", "IIAB"), "Iron > IIAB");
  assert.equal(buildClassification("A", "B", "A"), "A > B");
  assert.equal(buildClassification(null, null, null), null);
  assert.notEqual(buildClassification("CR", "CR"), ["CR", "CR"].join(" > "));
});

test("rejects mutations that remove or alter duplicate collapses", privateTest, () => {
  const changes = normalized.flatMap(([, , , className, clan, group], index) => {
    const before = [className, clan, group].filter((value) => value !== null).join(" > ") || null;
    const after = buildClassification(className, clan, group);
    return before === after ? [] : [{ row: index + 1, before, after }];
  });
  validateClassificationCollapse(changes);
  const altered = structuredClone(changes);
  altered[0].after = altered[0].before;
  for (const candidate of [changes.slice(1), [...changes, changes[0]], altered]) {
    assert.throws(() => validateClassificationCollapse(candidate), { name: "AssertionError" });
  }
});

test("accepts only 3,170 eight-field rows and the 48 exact named repairs", privateTest, () => {
  const lines = sourceBuffer.toString("utf8").split("\n");
  assert.equal(lines[0], SOURCE_HEADER);
  const widths = lines.slice(1).map((line) => line.split(",").length);
  assert.equal(widths.filter((width) => width === 8).length, 3170);
  assert.equal(widths.filter((width) => width === 9).length, 48);
  assert.deepEqual(widths.flatMap((width, index) => width === 9 ? [index + 1] : []), REPAIRED_SOURCE_ROWS);
});

test("source parser fails closed on every envelope and repair mutation", privateTest, () => {
  const sourceText = sourceBuffer.toString("utf8");
  const lines = sourceText.split("\n");
  const mutations = [
    ["header", () => [SOURCE_HEADER.replace("Name", "Title"), ...lines.slice(1)].join("\n")],
    ["missing row", () => lines.slice(0, -1).join("\n")],
    ["final newline", () => `${sourceText}\n`],
    ["quoted field", () => sourceText.replace("Aba Panu", "\"Aba Panu\"")],
    ["CRLF", () => sourceText.replace("\n", "\r\n")],
    ["delimiter collision", () => sourceText.replace("Aba Panu", "Aba > Panu")],
    ["unknown nine-field row", () => sourceText.replace("Aba Panu,M22326", "Aba,Panu,M22326")],
    ["unknown ten-field row", () => sourceText.replace("Aba Panu,M22326", "Aba,Panu,M22,326")],
    ["changed pallasite repair", () => sourceText.replace("Pallasite, PMG", "Pallasite, XYZ")],
    ["missing named repair", () => sourceText.replace("Pallasite, PMG", "Pallasite PMG")],
    ["changed country repair", () => sourceText.replace(
      "NWA 2677,M1683,1,Northwest Africa,Primitive",
      "NWA 2677,M1683,2,Northwest Africa,Primitive",
    )],
  ];
  for (const [name, mutate] of mutations) {
    assert.throws(() => parseSource(Buffer.from(mutate()), { lockEnvelope: false }), { name: "AssertionError" }, name);
  }
});

test("ledger validation fails closed on identity and occurrence mutations", privateTest, () => {
  const mutations = [
    ["schema", (candidate) => { candidate.schemaVersion = 2; }],
    ["source identity", (candidate) => { candidate.sourceSha256 = "0".repeat(64); }],
    ["missing occurrence", (candidate) => { delete candidate.records[sourceRowKey(1)]; }],
    ["extra occurrence", (candidate) => { candidate.records.extra = "obs-00000000-0000-4000-8000-000000000000"; }],
    ["reordered occurrences", (candidate) => {
      candidate.records = Object.fromEntries(Object.entries(candidate.records).toReversed());
    }],
    ["non-v4 ID", (candidate) => { candidate.records[sourceRowKey(1)] = "obs-00000000-0000-3000-8000-000000000000"; }],
    ["duplicate ID", (candidate) => { candidate.records[sourceRowKey(2)] = candidate.records[sourceRowKey(1)]; }],
  ];
  for (const [name, mutate] of mutations) {
    const candidate = structuredClone(ledger);
    mutate(candidate);
    assert.throws(
      () => validateLedger(`${JSON.stringify(candidate, null, 2)}\n`, candidate, normalized, { lockHash: false }),
      { name: "AssertionError" },
      name,
    );
  }
});

test("partial private input states fail while clean public-only state remains valid", () => {
  assert.equal(assertPrivateInputState([null, null, null]), false);
  assert.equal(assertPrivateInputState([Buffer.alloc(0), "{}", "{}"]), true);
  for (const state of [
    [Buffer.alloc(0), null, null], [null, "{}", null], [null, null, "{}"],
    [Buffer.alloc(0), "{}", null], [Buffer.alloc(0), null, "{}"], [null, "{}", "{}"],
  ]) assert.throws(() => assertPrivateInputState(state), { name: "AssertionError" });
});

test("the private-input builder confirms byte-deterministic output when available", privateTest, async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    new URL("./build-monnig-current-public.mjs", import.meta.url).pathname,
    "--check",
  ]);
  assert.match(stdout, /Monnig current public data is current \(3218 records/u);
});
