import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  serializeSpecimenCardProjections,
  validateSpecimenCardProjections,
} from "./validate-specimen-card-projections.mjs";

const projectionText = await readFile(new URL("../data/specimen-card-projections.json", import.meta.url), "utf8");
const published = JSON.parse(projectionText);
const catalogText = await readFile(new URL("../data/catalog.json", import.meta.url), "utf8");
const catalog = JSON.parse(catalogText);
const schema = JSON.parse(await readFile(new URL("../data/specimen-card-projections.schema.json", import.meta.url), "utf8"));
const recordById = new Map(catalog.records.map((record) => [record.id, record]));
const PRIOR_630_ID = "obs-344d0b6d-920e-403f-8fd5-c113fc05291d";
const REEDS_366_ID = "obs-b02789ea-869e-447a-97cc-28c2c6900e88";

function clone(value = published) {
  return structuredClone(value);
}

function mutate(label, callback, pattern = /invalid|differs|must|dangling|duplicated|ordered|lock|unsupported|exhausted/iu) {
  const changed = clone();
  callback(changed);
  assert.throws(() => validateSpecimenCardProjections(changed, catalog, catalogText), pattern, label);
}

function resolve(record, path) {
  return path.match(/[A-Za-z]+|[0-9]+/gu).reduce((value, key) => value?.[key], record);
}

test("production manifest is deterministic and validates against the locked catalog", () => {
  assert.deepEqual(validateSpecimenCardProjections(published, catalog, catalogText), {
    projectionCount: 1699,
    projectedCardCount: 6316,
    retainedParentContextCount: 807,
  });
  assert.equal(serializeSpecimenCardProjections(published), projectionText);
  assert.equal(createHash("sha256").update(catalogText).digest("hex"), published.metadata.sourceCatalogSha256);
  assert.equal(createHash("sha256").update(projectionText).digest("hex"), "5fce5d3b44d55616325e4678146a459dc2c98f9b20bb8b47324f3494ea5b16ba");
});

test("schema is a closed, count-locked projection contract", () => {
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.$id, "urn:hmc:schema:specimen-card-projections:1");
  assert.deepEqual(schema.required, ["metadata", "projections"]);
  assert.equal(schema.properties.projections.minItems, 1699);
  assert.equal(schema.properties.projections.maxItems, 1699);
  assert.equal(schema.$defs.metadata.properties.sourceRecordCount.const, 13542);
  assert.equal(schema.$defs.metadata.properties.projectedCardCount.const, 6316);
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (value === null || typeof value !== "object") return;
    if (value.type === "object") assert.equal(value.additionalProperties, false);
    Object.values(value).forEach(visit);
  };
  visit(schema);
});

test("every card path resolves exactly and follows source model and canonical order", () => {
  const modelByCatalog = new Map(catalog.metadata.catalogs.map(({ id, recordModel }) => [id, recordModel]));
  const sourceOrder = new Map(catalog.records.map(({ id }, index) => [id, index]));
  let priorOrder = -1;
  const references = new Set();
  for (const projection of published.projections) {
    const record = recordById.get(projection.parentRecordId);
    assert.ok(record);
    assert(sourceOrder.get(record.id) > priorOrder);
    priorOrder = sourceOrder.get(record.id);
    const model = modelByCatalog.get(record.catalogId);
    let previous = [-1, -1];
    for (const card of projection.cards) {
      assert.strictEqual(resolve(record, card.holdingPath), resolve(record, card.massPath.replace(/\.(?:weight|weights\[[0-9]+\])\.grams$/u, "")));
      assert(Number.isFinite(resolve(record, card.massPath)));
      assert.match(card.massPath, model === "catalog-item"
        ? /^holdings\[[0-9]+\]\.weight\.grams$/u
        : /^holdings\[[0-9]+\]\.weights\[[0-9]+\]\.grams$/u);
      const indexes = [...card.massPath.matchAll(/[0-9]+/gu)].map(([value]) => Number(value));
      const order = [indexes[0], indexes[1] ?? -1];
      assert(order[0] > previous[0] || (order[0] === previous[0] && order[1] > previous[1]));
      previous = order;
      const reference = `${record.id}\0${card.massPath}`;
      assert(!references.has(reference));
      references.add(reference);
    }
  }
  assert.equal(references.size, 6316);
});

test("Reeds entry 366 has exactly ten ordered cards and no residual; Prior entry 630 is absent", () => {
  const reeds = published.projections.find(({ parentRecordId }) => parentRecordId === REEDS_366_ID);
  assert.ok(reeds);
  assert.equal(reeds.retainParentContext, false);
  assert.deepEqual(reeds.cards.map(({ holdingPath }) => holdingPath), Array.from({ length: 10 }, (_, index) => `holdings[${index}]`));
  assert.deepEqual(reeds.cards.map(({ massPath }) => resolve(recordById.get(REEDS_366_ID), massPath)),
    [28.9, 310.1, 142, 30, 9.6, 124.5, 2.3, 128.5, 658.7, 51.2]);
  assert(!published.projections.some(({ parentRecordId }) => parentRecordId === PRIOR_630_ID));
});

test("manifest exposes only projection identifiers and paths, with no prose or private material", () => {
  const allowedKeys = new Set([
    "metadata", "projections", "schemaVersion", "scope", "catalogSchemaVersion", "sourceRecordCount",
    "sourceCatalogSha256", "projectionCount", "projectedCardCount", "parentRecordId", "retainParentContext",
    "cards", "holdingPath", "massPath",
  ]);
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (value === null || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert(allowedKeys.has(key), `unexpected public key ${key}`);
      visit(child);
    }
  };
  visit(published);
  assert.doesNotMatch(projectionText, /(?:description|label|source(?:File|Path)|notes?|urls?|images?|private|\/Users\/|\/private\/|\.pdf|\.png|\.webp)/iu);
});

test("cards exclude casts, aggregates, and scalar group totals", () => {
  for (const projection of published.projections) {
    const record = recordById.get(projection.parentRecordId);
    const cardsByHolding = Map.groupBy(projection.cards, ({ holdingPath }) => holdingPath);
    for (const [holdingPath, cards] of cardsByHolding) {
      const holding = resolve(record, holdingPath);
      if (holding.kind !== undefined) assert.equal(holding.kind, "specimen");
      if (holding.count > 1) {
        assert(cards.every(({ massPath }) => massPath.includes(".weights[")));
        assert.equal(cards.length, holding.weights.length);
        assert(holding.weights.length > 1);
      }
    }
  }
});

test("rejects wrong metadata, extra fields, free text, and altered source bytes", () => {
  for (const key of ["schemaVersion", "scope", "catalogSchemaVersion", "sourceRecordCount", "sourceCatalogSha256", "projectionCount", "projectedCardCount"]) {
    mutate(`wrong ${key}`, (value) => { value.metadata[key] = key === "scope" ? "other" : 0; });
  }
  mutate("extra root key", (value) => { value.description = "private prose"; }, /exactly keys/iu);
  mutate("extra metadata key", (value) => { value.metadata.sourcePath = "/private/catalog.json"; }, /exactly keys/iu);
  mutate("extra projection key", (value) => { value.projections[0].label = "specimen"; }, /exactly keys/iu);
  mutate("extra card key", (value) => { value.projections[0].cards[0].note = "review note"; }, /exactly keys/iu);
  assert.throws(() => validateSpecimenCardProjections(published, catalog, `${catalogText} `), /SHA-256/iu);
});

test("rejects duplicate, dangling, reordered, malformed, mismatched, and model-incompatible paths", () => {
  mutate("duplicate parent", (value) => { value.projections[1].parentRecordId = value.projections[0].parentRecordId; });
  mutate("dangling parent", (value) => { value.projections[0].parentRecordId = "obs-00000000-0000-4000-8000-000000000000"; });
  mutate("reordered parents", (value) => { [value.projections[0], value.projections[1]] = [value.projections[1], value.projections[0]]; });
  mutate("duplicate mass", (value) => { value.projections[0].cards[1] = clone(value.projections[0].cards[0]); });
  mutate("reordered cards", (value) => { value.projections.find(({ cards }) => cards.length > 1).cards.reverse(); });
  mutate("mismatched holding", (value) => { value.projections[0].cards[0].holdingPath = "holdings[1]"; });
  mutate("dangling holding", (value) => { value.projections[0].cards[0].holdingPath = "holdings[999]"; value.projections[0].cards[0].massPath = "holdings[999].weight.grams"; });
  mutate("malformed path", (value) => { value.projections[0].cards[0].holdingPath = "/holdings/0"; });
  mutate("wrong model path", (value) => { value.projections[0].cards[0].massPath = "holdings[0].weights[0].grams"; });
  mutate("cast path", (value) => {
    const projection = value.projections.find(({ parentRecordId }) => parentRecordId === "obs-11bc479c-55f1-43c6-a7d6-f55931c6b4ca");
    projection.cards[0] = { holdingPath: "holdings[2]", massPath: "holdings[2].weight.grams" };
  }, /non-specimen/iu);
});

test("rejects unsafe residual changes, Prior insertion, Reeds mutations, and reviewed-set drift", () => {
  mutate("single display without residual", (value) => {
    const projection = value.projections.find(({ retainParentContext, cards }) => retainParentContext && cards.length === 1);
    projection.retainParentContext = false;
  }, /one display unit/iu);
  mutate("false exhaustive flag becomes residual", (value) => {
    value.projections.find(({ retainParentContext }) => !retainParentContext).retainParentContext = true;
  }, /reviewed production lock/iu);
  mutate("Prior entry 630 insertion", (value) => { value.projections[0].parentRecordId = PRIOR_630_ID; }, /Prior entry 630/iu);
  mutate("Reeds residual", (value) => {
    value.projections.find(({ parentRecordId }) => parentRecordId === REEDS_366_ID).retainParentContext = true;
  }, /Reeds entry 366/iu);
  mutate("Reeds card removed", (value) => {
    value.projections.find(({ parentRecordId }) => parentRecordId === REEDS_366_ID).cards.pop();
    value.metadata.projectedCardCount--;
  });
  mutate("reviewed path changed to another resolving mass", (value) => {
    const projection = value.projections.find(({ cards }) => cards.length >= 3);
    projection.cards.splice(1, 1);
    value.metadata.projectedCardCount--;
  });
});
