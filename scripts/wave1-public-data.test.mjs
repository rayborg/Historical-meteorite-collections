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

test("installs the exact accepted schema-10 export over the current37 baseline", () => {
  assert.equal(sha256(catalogText), "9a921861c782abe1218e2d3b33bc2fc0b229908ce0a3c08e93bdc2596b91c536");
  assert.equal(sha256(foliosText), "145498213ac8ddd24527b5092bfc4cad8dce1880f8d304d29e2c2c4d44595460");
  assert.equal(catalog.metadata.schemaVersion, 10);
  assert.equal(catalog.metadata.catalogs.length, 40);
  assert.equal(catalog.records.length, 14477);
  const baselineRecords = catalog.records.filter(({ catalogId }) => !waveCatalogIds.has(catalogId));
  const baselineDescriptors = catalog.metadata.catalogs.filter(({ id }) => !waveCatalogIds.has(id));
  assert.equal(baselineRecords.length, 14176);
  assert.equal(jsonSha256(baselineRecords), "d7c8a328528c7286415683cb9133c89fb212f5e83b041d6c634d57d852293ccf");
  assert.equal(jsonSha256(baselineDescriptors), "adef164bb9b2feb5fdfe47153cc8ef5f81e8079ecabbb421cd3cdf5b7587ceb8");
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
