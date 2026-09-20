import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const acceptedUrl = new URL("../data/private/haag-2003/accepted-records.json", import.meta.url);
const ledgerUrl = new URL("../data/private/haag-2003/observation-id-ledger.json", import.meta.url);

async function readOptionalPrivateFile(url) {
  try {
    return await readFile(url, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

const [catalogText, foliosText, releaseLockText, acceptedText, ledgerText] = await Promise.all([
  readFile(new URL("../data/catalog.json", import.meta.url), "utf8"),
  readFile(new URL("../data/folios.json", import.meta.url), "utf8"),
  readFile(new URL("./folio-release-lock.json", import.meta.url), "utf8"),
  readOptionalPrivateFile(acceptedUrl),
  readOptionalPrivateFile(ledgerUrl),
]);
assert.equal(acceptedText === null, ledgerText === null,
  "private Haag inputs must either both be present or both be absent");
const hasPrivateInputs = acceptedText !== null;
const accepted = hasPrivateInputs ? JSON.parse(acceptedText) : null;
const ledger = hasPrivateInputs ? JSON.parse(ledgerText) : null;
const catalog = JSON.parse(catalogText);
const folios = JSON.parse(foliosText);
const releaseLock = JSON.parse(releaseLockText);
const records = catalog.records.filter(({ catalogId }) => catalogId === "haag-2003");
const descriptor = catalog.metadata.catalogs.find(({ id }) => id === "haag-2003");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const privateTest = { skip: hasPrivateInputs ? false : "private Haag source inputs are unavailable" };
const publicKeys = [
  "id", "catalogId", "entryOrder", "captionTitle", "name", "classification", "reportedMass",
  "reportedDimensions", "photoPanelCount", "sourceRelation", "catalogPages", "printedPageLabel", "confidence",
];
const recoveredMappings = [
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

function assertRecoveredPrefix(candidate) {
  assert.deepEqual(candidate.recoveredMappings, recoveredMappings);
  assert.deepEqual(
    Object.entries(candidate.records).slice(0, recoveredMappings.length),
    recoveredMappings.map(({ boundaryId, observationId }) => [boundaryId, observationId]),
  );
}

test("locks all public Haag observations and recovered historical identities", () => {
  assert.equal(sha256(JSON.stringify(records)), "9b67eb8920ba5617e4193b32baec09a0cbfaa36fb53ec1197112632d8211b846");
  assert.equal(records.length, 250);
  assert.equal(sha256(JSON.stringify(records.map(({ id }) => id))),
    "05db17faf592e1f76c9f3ac10b58ccbaeea4b768b1036741802070dc561b3370");
  assert.equal(new Set(records.map(({ id }) => id)).size, 250);
  assert(records.every(({ id }) => /^obs-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(id)));
  assert.deepEqual(
    records.slice(0, recoveredMappings.length).map(({ entryOrder, id }) => ({ entryOrder, id })),
    recoveredMappings.map(({ sourceOrder: entryOrder, observationId: id }) => ({ entryOrder, id })),
  );
});

test("locks private accepted source and immutable ledger when available", privateTest, () => {
  assert.equal(sha256(acceptedText), "c0b800dc176d61a0d1384cf4198d3ed0a0392ae0f344ebf967fbd0623296f039");
  assert.equal(sha256(ledgerText), "18b25d7c40bc6f4dbcd4c91ac7910602c45153abfc36c1c64704305b924e7639");
  assert.deepEqual(Object.keys(ledger.records), accepted.records.map(({ boundaryId }) => boundaryId));
  assert.deepEqual(records.map(({ id }) => id), Object.values(ledger.records));
  assert.equal(
    sha256(JSON.stringify(Object.entries(ledger.records).slice(recoveredMappings.length))),
    "c6d606552831853dedb5a323d19f3a8cf25941b0cfda7dfde3171ef909b22056",
  );
});

test("private ledger rejects changing or coordinating recovered UUID assignments", privateTest, () => {
  assertRecoveredPrefix(ledger);
  for (let index = 0; index < recoveredMappings.length; index += 1) {
    const boundaryId = recoveredMappings[index].boundaryId;
    const recordOnlyChange = structuredClone(ledger);
    recordOnlyChange.records[boundaryId] = "obs-00000000-0000-4000-8000-000000000000";
    assert.throws(() => assertRecoveredPrefix(recordOnlyChange), { name: "AssertionError" });

    const coordinatedChange = structuredClone(ledger);
    coordinatedChange.records[boundaryId] = "obs-00000000-0000-4000-8000-000000000000";
    coordinatedChange.recoveredMappings[index].observationId = coordinatedChange.records[boundaryId];
    assert.throws(() => assertRecoveredPrefix(coordinatedChange), { name: "AssertionError" });
  }
});

test("publishes a closed facts-only slice with locked pages and confidence", () => {
  for (const [index, record] of records.entries()) {
    assert.deepEqual(Object.keys(record), publicKeys);
    assert.equal(record.entryOrder, index + 1);
    assert.equal(record.catalogId, "haag-2003");
    for (const value of [record.captionTitle, record.name, record.classification, record.printedPageLabel]) {
      assert(value === null || typeof value === "string");
    }
    for (const value of [record.reportedMass, record.reportedDimensions]) {
      if (value === null) continue;
      assert.deepEqual(Object.keys(value), ["valueText", "semantics"]);
      assert.equal(typeof value.valueText, "string");
      assert.equal(value.semantics, "caption-context-only");
    }
    assert(Number.isInteger(record.photoPanelCount) && record.photoPanelCount >= 0);
    assert(record.catalogPages.length > 0);
    assert(record.catalogPages.every((page) => Number.isInteger(page) && page >= 1 && page <= 146));
  }

  assert.equal(new Set(records.flatMap(({ catalogPages }) => catalogPages)).size, 134);
  assert.deepEqual(
    records.reduce((counts, { confidence }) => ({ ...counts, [confidence]: counts[confidence] + 1 }),
      { high: 0, medium: 0, low: 0 }),
    { high: 247, medium: 0, low: 3 },
  );
});

test("matches every public fact to the private accepted source when available", privateTest, () => {
  for (const [index, source] of accepted.records.entries()) {
    const record = records[index];
    assert.deepEqual(Object.keys(record), publicKeys);
    assert.equal(record.entryOrder, index + 1);
    assert.equal(record.captionTitle, source.titleField);
    assert.equal(record.name, source.subjectNameText);
    assert.equal(record.classification, source.classificationText);
    assert.deepEqual(record.catalogPages, source.pdfPages);
    assert.equal(record.printedPageLabel, source.printedPageText);
    assert.equal(record.photoPanelCount, source.photoPanelCount);
    for (const [publicValue, sourceValue] of [
      [record.reportedMass, source.massText],
      [record.reportedDimensions, source.dimensionsText],
    ]) {
      assert.deepEqual(publicValue, sourceValue === null ? null : {
        valueText: sourceValue,
        semantics: "caption-context-only",
      });
    }
  }
});

test("locks 18 public repeated-view relations to earlier observations", () => {
  const indexById = new Map(records.map(({ id }, index) => [id, index]));
  const relations = records.filter(({ sourceRelation }) => sourceRelation !== null);
  assert.equal(relations.length, 18);
  for (const [index, record] of records.entries()) {
    if (record.sourceRelation === null) continue;
    assert.deepEqual(Object.keys(record.sourceRelation), ["type", "recordId"]);
    assert.equal(record.sourceRelation.type, "repeated-view");
    assert(indexById.get(record.sourceRelation.recordId) < index);
  }
});

test("matches public repeated views to private source relations when available", privateTest, () => {
  for (const [index, record] of records.entries()) {
    const sourceTarget = accepted.records[index].repeatedViewOf;
    assert.deepEqual(record.sourceRelation, sourceTarget === null
      ? null
      : { type: "repeated-view", recordId: ledger.records[sourceTarget] });
  }
});

test("uses schema 15 totals, a non-specimen descriptor, and blocked empty folios", () => {
  assert.deepEqual(
    { schema: catalog.metadata.schemaVersion, catalogs: catalog.metadata.catalogs.length, records: catalog.records.length },
    { schema: 15, catalogs: 56, records: 20241 },
  );
  assert.equal(catalog.metadata.recordCount, 20241);
  assert.equal(descriptor.recordModel, "caption-observation-fact");
  assert.deepEqual(descriptor.sourcePages, Array.from({ length: 146 }, (_, index) => index + 1));
  assert.equal(descriptor.sourcePageCount, 146);
  assert.equal(descriptor.recordCount, 250);
  assert.equal(descriptor.recordsWithDesignation, 0);
  assert.equal(descriptor.recordsWithWeight, 0);
  assert.deepEqual(descriptor.confidenceCounts, { high: 247, medium: 0, low: 3 });
  assert.deepEqual(folios.catalogs["haag-2003"], {
    displayPolicy: "blocked", rightsStatus: "undetermined", pages: [],
  });
  assert.deepEqual(releaseLock.catalogs["haag-2003"], {
    displayPolicy: "blocked", rightsStatus: "undetermined", basis: null, basisUrl: null, pageIds: [],
  });
  assert(!releaseLock.assets.some(({ path }) => path.includes("haag-2003")));
});

test("excludes prose, provenance, normalized specimen claims, and private artifacts", () => {
  const rendered = JSON.stringify(records);
  for (const prohibitedKey of [
    "captionText", "priceText", "boundaryId", "boundaryOrder", "sourceBoundaryIds", "notes", "fileName",
    "provenance", "designation", "metbull", "specimenId", "holdings", "weight", "reportedTotalWeight",
  ]) {
    assert(!rendered.includes(`\"${prohibitedKey}\"`), prohibitedKey);
  }
  assert.doesNotMatch(rendered, /(?:\/private\/|\/Users\/|file:\/\/|assets\/|\.(?:pdf|png|webp|tiff?|txt|csv))/iu);
});

test("the private-input builder confirms byte-deterministic output when available", privateTest, async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    new URL("./build-haag-2003-public.mjs", import.meta.url).pathname,
    "--check",
  ]);
  assert.match(stdout, /Haag 2003 public data is current \(250 records/u);
});
