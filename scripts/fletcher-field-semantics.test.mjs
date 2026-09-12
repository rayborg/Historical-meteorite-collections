import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const app = require("../app.js");
const catalog = JSON.parse(await readFile(new URL("../data/catalog.json", import.meta.url), "utf8"));
const ids = new Set(["fletcher-1886", "fletcher-1894", "fletcher-1896", "fletcher-1904", "fletcher-1908"]);
const records = catalog.records.filter(({ catalogId }) => ids.has(catalogId));
const byNumber = new Map(records.map((record) => [`${record.catalogId}:${record.reportedNumber}`, record]));
const narrativeName = /\.\s+(?:Found|Known|Described|Presented|Reported|Mentioned|Acquired|Fell|A second|A specimen|One specimen)\b/iu;
const citationName = /\b(?:vol\.|pp?\.\s*\d|Amer\.\s+Jour\.|Proc\.\s+|Trans\.\s+|Bull\.\s+|Pogg\.\s+Ann\.|Mineralog\.\s+Magazine)/iu;

test("publishes complete clean Fletcher name, event, and reference accounting", () => {
  assert.equal(records.length, 2464);
  assert.equal(records.filter(({ name }) => name).length, 2464);
  assert.equal(records.filter(({ eventDate }) => eventDate).length, 2440);
  assert.equal(records.filter(({ reference }) => reference).length, 939);
  assert(records.every(({ name }) => !narrativeName.test(name) && !citationName.test(name)));
  assert(records.every(({ name, eventDate }) => name !== eventDate));
});

test("keeps the reported Jewell Hill continuation in its three exact fields", () => {
  const record = byNumber.get("fletcher-1894:58b");
  assert.deepEqual({ name: record.name, eventDate: record.eventDate, reference: record.reference }, {
    name: "Jewell Hill, Walnut Mtns., Madison County, N. Carolina, U.S.A.",
    eventDate: "A second was found in use in 1873, supporting a corner of a rail-fence: described as from Duel Hill in 1876 by Burton.",
    reference: "Amer. Jour. Sc. 1876, ser. 3, vol. 12, p. 439. The Minerals and Mineral Localities of North Carolina, by Genth and Kerr. Raleigh, 1885, p. 14.",
  });
  assert(!records.some(({ name }) => name.includes("supporting a corner of a rail-fence")));
  assert(!Object.hasOwn(record, "metbull"));
});

test("keeps all nine source-proven continuation localities unresolved", () => {
  const expected = new Map([
    ["fletcher-1886:97c", "The Butcher iron, Desert of Bolson de Mapimi, Mexico."],
    ["fletcher-1894:58b", "Jewell Hill, Walnut Mtns., Madison County, N. Carolina, U.S.A."],
    ["fletcher-1894:113b", "Glorieta Mountain, 1 m. N.E. of Canoncito, Santa Fé County, New Mexico, U.S.A."],
    ["fletcher-1896:65", "Jewell Hill, Walnut Mtns., Madison County, N. Carolina, U.S.A."],
    ["fletcher-1896:126b", "Glorieta Mountain, 1 m. N.E. of Canoncito, Santa Fé County, New Mexico, U.S.A."],
    ["fletcher-1904:75b", "Jewell Hill, Walnut Mtns., Madison County, N. Carolina, U.S.A."],
    ["fletcher-1904:151b", "Glorieta Mountain, 1 m. N.E. of Canoncito, Santa Fé County, New Mexico, U.S.A."],
    ["fletcher-1908:78b", "JEWELL HILL, Walnut Mtns., Madison County, N. Carolina, U.S.A."],
    ["fletcher-1908:158b", "GLORIETA MOUNTAIN, 1 m. N.E. of Canoncito, Santa Fé County, New Mexico, U.S.A."],
  ]);
  for (const [key, name] of expected) {
    const record = byNumber.get(key);
    assert.equal(record.name, name, key);
    assert(record.eventDate, key);
    assert(!Object.hasOwn(record, "metbull"), key);
  }
});

test("searches all three fields and presents field-specific Fletcher labels", () => {
  const registry = app.normalizeCatalogRegistry(catalog.metadata);
  const record = app.prepareRecord(byNumber.get("fletcher-1894:58b"), 0, registry);
  assert(app.matchesSearch(record, "Jewell Hill"));
  assert(app.matchesSearch(record, "rail-fence"));
  assert(app.matchesSearch(record, "Minerals and Mineral Localities"));
  const dto = app.presentHarmonizedCard(record);
  assert(dto.facts.some(({ label, value }) => label === "Date or report of find" && value === record.eventDate));
  assert(dto.facts.some(({ label, value }) => label === "Reference" && value === record.reference));
  assert.equal(app.shouldDisplaySemanticLabel(dto.kind), true);
  assert.equal(app.harmonizedCardNameLabel(dto.kind), "Meteorite or locality name");
});
