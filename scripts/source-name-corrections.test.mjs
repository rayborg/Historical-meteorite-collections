import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalogText = await readFile(new URL("../data/catalog.json", import.meta.url), "utf8");
const catalog = JSON.parse(catalogText);
const fixture = JSON.parse(await readFile(new URL("./source-name-corrections.fixture.json", import.meta.url), "utf8"));

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function jsonSha256(value) {
  return sha256(JSON.stringify(value));
}

test("locks the accepted 86-record source-name correction projection without non-name drift", () => {
  assert.equal(fixture.schemaVersion, 1);
  assert.equal(sha256(catalogText), fixture.catalogSha256);
  assert.equal(catalog.metadata.catalogs.length, 34);
  assert.equal(catalog.records.length, 13672);
  assert.equal(jsonSha256(catalog.metadata), fixture.metadataSha256);
  assert.equal(jsonSha256(catalog.records.map(({ id }) => id)), fixture.orderedIdsSha256);
  assert.equal(jsonSha256(catalog.records.map(({ name: _name, ...record }) => record)), fixture.nonNameRecordsSha256);

  const recordsById = new Map(catalog.records.map((record) => [record.id, record]));
  const correctionRecords = Object.entries(fixture.recordIdsByCatalog).flatMap(([catalogId, ids]) =>
    ids.map((id) => {
      const record = recordsById.get(id);
      assert.ok(record, `missing corrected record ${id}`);
      assert.equal(record.catalogId, catalogId, `${id} catalog`);
      return record;
    }));

  assert.equal(correctionRecords.length, 86);
  assert.deepEqual(
    Object.fromEntries(Object.entries(fixture.recordIdsByCatalog).map(([catalogId, ids]) => [catalogId, ids.length])),
    {
      "mason-1964": 1,
      "farrington-1916": 11,
      "foote-1912": 1,
      "merrill-1916": 58,
      "prior-1923": 1,
      "reeds-1937": 12,
      "tassin-1902": 1,
      "ward-1904": 1,
    },
  );
  assert.equal(
    jsonSha256(correctionRecords.map(({ id, catalogId, name }) => ({ id, catalogId, name }))),
    fixture.correctedProjectionSha256,
  );
});

test("preserves reported corrections and legitimate source punctuation exactly", () => {
  const namesById = new Map(catalog.records.map(({ id, name }) => [id, name]));
  assert.equal(namesById.get("obs-de95d443-2232-476d-8589-337b596e31a9"), "Smith's Mountain");
  assert.equal(namesById.get("obs-83b14a1c-26e5-4f4b-b470-300fe71477f1"), "Indarch");
  assert.equal(namesById.get("obs-450ee972-0512-4433-a3d2-6b960c663fad"), "WARRENTON");
  assert.equal(namesById.get("obs-afc9e097-4165-4014-9fc8-be5c0fb650ea"), "Lucé");
  assert.equal(namesById.get("obs-ad827190-b504-4aba-9776-c722a5058866"), "Murfreesboro'");
  assert.equal(namesById.get("obs-f48b4567-25a8-4a6b-be15-61dc0ea92806"), "Tucson, Arizona, “Signet Iron”");
  assert.equal(namesById.get("obs-1197d2c1-cf47-45a1-844b-cbe5c637a6a9"), "Tucson, Arizona, “Carleton Iron”");
  assert.equal(namesById.get("obs-dd8a31ed-d879-4d31-9358-8710da8d98a7"), "Agen [Brethon, near Castelmoron]");
});
