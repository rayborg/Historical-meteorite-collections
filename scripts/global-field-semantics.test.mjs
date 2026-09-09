import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalog = JSON.parse(await readFile(new URL("../data/catalog.json", import.meta.url), "utf8"));
const byId = new Map(catalog.records.map((record) => [record.id, record]));

test("Huss unnamed observations retain designations without invented source identities", () => {
  const unnamed = catalog.records.filter(({ catalogId, name }) => catalogId.startsWith("huss-") && name === null);

  assert.equal(unnamed.length, 57);
  assert.equal(
    createHash("sha256").update(JSON.stringify(unnamed.map(({ id }) => id).sort())).digest("hex"),
    "760879501500805befc568c7c58ea270316fbb303732d78324adef3596662a0f",
  );
  assert.equal(unnamed.filter(({ designation }) => designation !== null).length, 56);
  assert.deepEqual(unnamed.filter(({ designation }) => designation === null).map(({ id }) => id),
    ["unnamed-stony-meteorite-0b06ce6849db"]);
  assert(unnamed.every(({ metbull }) => metbull.matchType === "unresolved" &&
    metbull.canonicalName === null && metbull.meteoriteCode === null && metbull.metbullUrl === null));
});

test("generic Mason and USNM holding labels remain semantic nulls", () => {
  const mason = catalog.records.filter(({ catalogId }) => catalogId === "mason-1964");
  const usnm = catalog.records.filter(({ catalogId }) => catalogId === "usnm-1886");
  const usnmWeightRows = usnm.filter(({ holdings }) => holdings[0].description === null);

  assert.equal(mason.length, 1374);
  assert(mason.every(({ holdings }) => holdings.length === 1 && holdings[0].description === null));
  assert.equal(usnmWeightRows.length, 154);
  assert.equal(usnmWeightRows.filter(({ holdings }) => holdings[0].weights.length > 0).length, 153);
  assert.deepEqual(usnmWeightRows.filter(({ holdings }) => holdings[0].weights.length === 0).map(({ id }) => id),
    ["obs-d927b8d5-d99c-469c-bb70-fed9e8288bcd"]);
});

test("corrected identity-bearing names retain their reviewed public dispositions", () => {
  const sierra = byId.get("obs-360ed131-c947-4f04-8bd3-bbc2a307a056");
  const mighei = byId.get("obs-572a66b2-a2a3-4455-97a0-2baca85a99c0");
  const chassigny = byId.get("obs-599b88b6-40fa-4e96-bfbf-6e72daac1198");

  assert.equal(sierra.name, "Sierra de las Adargas b. Huejuquilla");
  assert.equal(sierra.metbull, undefined);
  assert.deepEqual([mighei.name, mighei.metbull.matchType, mighei.metbull.canonicalName, mighei.metbull.meteoriteCode],
    ["MIGHEI", "exact", "Mighei", "16634"]);
  assert.deepEqual([chassigny.name, chassigny.metbull.matchType, chassigny.metbull.canonicalName],
    ["Chassigny, Haute Marne, Frankreich", "source-heading-exact", "Chassigny"]);
});

test("punctuation placeholders do not become dates, numbers, or represented weights", () => {
  const dateIds = [
    "obs-2907e261-a584-4ddd-aba3-a528bdaa25ff", "obs-388fced0-1416-47e1-8b44-a98037e315f9",
    "obs-4b3f5a26-f655-47f2-b8a1-31a697c1f2e0", "obs-4d1d3808-15b2-498d-885d-1c37bd9293dc",
    "obs-4e1545e1-334f-48e1-a7a1-7b45681c2d4f", "obs-65dd11c1-5d4a-4939-9b84-c0a9ccb1537a",
    "obs-9c1cb46c-12d5-4eb5-888a-105a7ee8cf58", "obs-c36d7e36-31e0-4671-b8ed-98ed9beb4ce7",
    "obs-e22f0346-6bbe-426f-a689-713198dc74eb", "obs-f4d47135-aec3-4b98-8ee9-4ba856dc6f25",
    "obs-f8cf0b8a-4824-4c6b-ba67-2d9c419f6402", "obs-f95e08b1-e689-48c9-b158-2709c22a855b",
  ];
  const greifswaldNulls = catalog.records.filter(({ catalogId, reportedNumber }) =>
    catalogId.startsWith("greifswald-") && reportedNumber === null);

  assert(dateIds.every((id) => byId.get(id).dateOfDiscovery === null));
  assert.equal(greifswaldNulls.length, 5);
  for (const id of ["fletcher-1886-representation-0051", "fletcher-1904-representation-0098"]) {
    assert.deepEqual(byId.get(id).representedWeight, {
      valueText: null,
      componentTexts: [],
      grams: null,
      semantics: "collection-representation-context",
    });
  }
});

test("Berlin descriptions and Kantor fields expose source semantics without implementation prose", () => {
  const berlinDescriptions = catalog.records
    .filter(({ catalogId }) => catalogId.startsWith("berlin-"))
    .map(({ holdings }) => holdings[1]?.description)
    .filter((description) => description?.includes(" | "));
  const tarapaca = byId.get("obs-61dfdde3-e70e-4100-8435-82aad88bae73");
  const bendego = byId.get("obs-bcdb1ae5-bdb9-4cb8-9334-40a80326cd5c");

  assert.equal(berlinDescriptions.length, 17);
  assert(berlinDescriptions.every((description) => !description.startsWith("[") && !description.endsWith("]")));
  assert.deepEqual([tarapaca.classification, tarapaca.locality], ["Meteorito", null]);
  assert.equal(bendego.classification, "Meteorito");
  assert.match(bendego.locality, /^Bah.+, Brasil\.$/u);
});
