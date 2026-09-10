import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const catalogText = await readFile(new URL("../data/catalog.json", import.meta.url), "utf8");
const catalog = JSON.parse(catalogText);
const path = new URL("../data/specimen-card-projections.json", import.meta.url);
const manifest = JSON.parse(await readFile(path, "utf8"));
const byParent = new Map(manifest.projections.map((projection) => [projection.parentRecordId, projection]));

assert.equal(catalog.metadata.schemaVersion, 12);
manifest.metadata.schemaVersion = 5;
manifest.metadata.catalogSchemaVersion = 12;
manifest.metadata.sourceCatalogSha256 = createHash("sha256").update(catalogText).digest("hex");

const qualitative = [
  ["obs-e2b4f522-b31d-4dcb-9cf6-7b8ba35da649", 0, "main mass"],
  ["obs-014fa351-665c-4bcb-b83f-3610f0ff425c", 4, "one-third of mass"],
  ["obs-26389145-2d52-4acf-8b33-06aa8489edfe", 2, "less than a gram"],
];
for (const [parentId, cardIndex, statement] of qualitative) {
  const card = byParent.get(parentId)?.cards[cardIndex];
  assert(card && card.massPath === null && !card.repeatedMass, `Qualitative projection ${parentId} changed.`);
  card.qualitativeWeightEvidence = { type: "qualitative", statement };
}

const orgueil = byParent.get("obs-0160c21a-e363-4606-978c-0fee7b58d643");
assert.deepEqual(orgueil.cards.map(({ massPath }) => massPath), [null, null]);
orgueil.cards[0].massPath = "holdings[0].weights[0].grams";
orgueil.cards[1].massPath = "holdings[0].weights[1].grams";

const pavlograd = byParent.get("obs-26389145-2d52-4acf-8b33-06aa8489edfe").cards[2];
pavlograd.clause.end = 141;
assert.equal(catalog.records.find(({ id }) => id === "obs-26389145-2d52-4acf-8b33-06aa8489edfe")
  .holdings[0].description.slice(pavlograd.clause.start, pavlograd.clause.end), "[46011], less than a gram");

await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
console.log("Applied accepted qualitative evidence, Orgueil mass paths, and Pavlograd clause correction.");
