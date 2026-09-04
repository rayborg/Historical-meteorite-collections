import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalogText = await readFile(new URL("../data/catalog.json", import.meta.url), "utf8");
const foliosText = await readFile(new URL("../data/folios.json", import.meta.url), "utf8");
const catalog = JSON.parse(catalogText);
const folios = JSON.parse(foliosText);
const releaseLock = JSON.parse(await readFile(new URL("./folio-release-lock.json", import.meta.url), "utf8"));
const waveCatalogIds = new Set(["brown-1916", "minnesota-1892", "foote-1909"]);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const jsonSha256 = (value) => sha256(JSON.stringify(value));

test("installs the exact accepted schema-11 export without changing non-Victoria data", () => {
  assert.equal(sha256(catalogText), "c6ace08a04d70c5a869ed8f6401f3ad505da530b9501d3fd8227740a64257039");
  assert.equal(sha256(foliosText), "145498213ac8ddd24527b5092bfc4cad8dce1880f8d304d29e2c2c4d44595460");
  assert.equal(catalog.metadata.schemaVersion, 11);
  assert.equal(catalog.metadata.catalogs.length, 40);
  assert.equal(catalog.records.length, 14477);
  const nonVictoriaRecords = catalog.records.filter(({ catalogId }) => catalogId !== "victoria-land-1982");
  const nonVictoriaDescriptors = catalog.metadata.catalogs.filter(({ id }) => id !== "victoria-land-1982");
  assert.equal(nonVictoriaRecords.length, 14204);
  assert.equal(jsonSha256(nonVictoriaRecords), "ffacd94974737ed155b143e5a28718fe4ec22d8bd0a6eafde5d4cdf17018498a");
  assert.equal(jsonSha256(nonVictoriaDescriptors), "8066f1c06de5c8021ffa24020cfe37c4e9cdc5ce1d357e95c20268c2699a1d6e");
});

test("publishes exact Brown, Minnesota, and non-specimen Foote facts with blocked folios", () => {
  const expectations = {
    "brown-1916": { count: 237, hash: "7a66d453fa13b4ffc26627549e6957d4b4a000b77be58a99783ff24813f1117a" },
    "minnesota-1892": { count: 58, hash: "29a66c19e0435a94df00451169a9f94d0ae841f74b87650ee7f0d5da84abfeec" },
    "foote-1909": { count: 6, hash: "020b6a4f635b16afef7c8305d0717373b41958b6bb12e4eaa016e5f7664a0bfc" },
  };
  for (const [catalogId, expected] of Object.entries(expectations)) {
    const records = catalog.records.filter((record) => record.catalogId === catalogId);
    assert.equal(records.length, expected.count);
    assert.equal(jsonSha256(records), expected.hash);
    assert.deepEqual(folios.catalogs[catalogId], {
      displayPolicy: "blocked", rightsStatus: "undetermined", pages: [],
    });
    assert.deepEqual(releaseLock.catalogs[catalogId], {
      displayPolicy: "blocked", rightsStatus: "undetermined", basis: null, basisUrl: null, pageIds: [],
    });
    assert(!releaseLock.assets.some(({ path }) => path.includes(catalogId)));
  }
  const foote = catalog.records.filter(({ catalogId }) => catalogId === "foote-1909");
  assert.deepEqual(foote.map(({ typeNumber }) => typeNumber), [95, 96, 97, 98, 99, 100]);
  assert(foote.every((record) => Object.keys(record).join("|") ===
    "id|catalogId|typeNumber|name|description|catalogPage|confidence"));
  assert.equal(catalog.metadata.catalogs.find(({ id }) => id === "foote-1909").recordModel, "dealer-offer-fact");
  assert.equal(Object.values(folios.catalogs).reduce((count, { pages }) => count + pages.length, 0), 49);
});

test("Wave 1 public outputs contain no source artifacts or private leakage", () => {
  const records = catalog.records.filter(({ catalogId }) => waveCatalogIds.has(catalogId));
  assert.doesNotMatch(JSON.stringify(records),
    /(?:\/private\/|\/Users\/|file:\/\/|data\/ocr\/|source-images|assets\/|\.(?:pdf|png|webp|tiff?|txt|csv))/iu);
  assert.equal(Object.keys(folios.catalogs).length, 40);
  assert.equal(releaseLock.assets.filter(({ path }) => [...waveCatalogIds].some((id) => path.includes(id))).length, 0);
});
