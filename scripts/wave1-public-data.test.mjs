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

test("installs the exact accepted schema-12 export without changing non-correction data", () => {
  assert.equal(sha256(catalogText), "cf429e6660f00272f2f81fe69bac81c891f41574bbfff6e6bb46499d2d0672b4");
  assert.equal(sha256(foliosText), "1c8f08b357358789b9133a568246f48964970748635adbf6f21b7ac156e16165");
  assert.equal(catalog.metadata.schemaVersion, 12);
  assert.equal(catalog.metadata.catalogs.length, 52);
  assert.equal(catalog.records.length, 19553);
  const correctedRecordIds = new Set([
    "obs-68c7e39b-9d99-4f9a-a1d2-7b2374d76d47",
    "obs-38554aa8-007c-447f-9410-91d447f74149",
  ]);
  const wave2CatalogIds = new Set(["berlin-1903", "berlin-1904", "greifswald-1895", "greifswald-1901"]);
  const fletcherCatalogIds = new Set(["fletcher-1886", "fletcher-1894", "fletcher-1896", "fletcher-1904", "fletcher-1908"]);
  const museum3CatalogIds = new Set(["story-maskelyne-1872", "prior-guide-1926", "brauns-bonn-1926"]);
  const nonCorrectionRecords = catalog.records.filter(({ id, catalogId }) => !correctedRecordIds.has(id) && !wave2CatalogIds.has(catalogId) && !fletcherCatalogIds.has(catalogId) && !museum3CatalogIds.has(catalogId));
  const nonVictoriaDescriptors = catalog.metadata.catalogs.filter(({ id }) => id !== "victoria-land-1982" && !wave2CatalogIds.has(id) && !fletcherCatalogIds.has(id) && !museum3CatalogIds.has(id));
  assert.equal(nonCorrectionRecords.length, 14475);
  assert.equal(jsonSha256(nonCorrectionRecords), "ec2a8ad5fea13c2503a5d3db84f26a263baf086d18f89eaab5849b1b5a6948a7");
  assert.equal(jsonSha256(nonVictoriaDescriptors), "31aa040fb71302cb0b8c3a9c691ad747ead2eafec725ac804bdca58cc9b7849e");
});

test("publishes exact Brown, Minnesota, and non-specimen Foote facts with blocked folios", () => {
  const expectations = {
    "brown-1916": { count: 237, hash: "2419781ce8aa17b1e091371ffe2f10628e5df540da187522875e8764e51f62fa" },
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
  assert.equal(Object.keys(folios.catalogs).length, 52);
  assert.equal(releaseLock.assets.filter(({ path }) => [...waveCatalogIds].some((id) => path.includes(id))).length, 0);
});
