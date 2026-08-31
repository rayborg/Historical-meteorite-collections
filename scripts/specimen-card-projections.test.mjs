import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  HAMBURG_AUDIT_COVERAGE,
  MADRID_AUDIT_COVERAGE,
  REVIEWED_AUDIT_COVERAGE,
  deriveSourceContext,
  serializeSpecimenCardProjections,
  validateSpecimenCardProjections,
} from "./validate-specimen-card-projections.mjs";

const projectionText = await readFile(new URL("../data/specimen-card-projections.json", import.meta.url), "utf8");
const published = JSON.parse(projectionText);
const catalogText = await readFile(new URL("../data/catalog.json", import.meta.url), "utf8");
const catalog = JSON.parse(catalogText);
const schema = JSON.parse(await readFile(new URL("../data/specimen-card-projections.schema.json", import.meta.url), "utf8"));
const recordById = new Map(catalog.records.map((record) => [record.id, record]));
const modelByCatalog = new Map(catalog.metadata.catalogs.map(({ id, recordModel }) => [id, recordModel]));
const PRIOR_630_ID = "obs-344d0b6d-920e-403f-8fd5-c113fc05291d";
const REEDS_366_ID = "obs-b02789ea-869e-447a-97cc-28c2c6900e88";
const madridIds = new Set(catalog.records.filter(({ catalogId }) => catalogId === "madrid-1923").map(({ id }) => id));
const hamburgIds = new Set(catalog.records.filter(({ catalogId }) => catalogId === "hamburg-1913").map(({ id }) => id));

function clone(value = published) {
  return structuredClone(value);
}

function mutate(label, callback, pattern = /invalid|differs|must|dangling|duplicated|ordered|lock|unsupported|overlap|display units|range|different holding/iu) {
  const changed = clone();
  callback(changed);
  assert.throws(() => validateSpecimenCardProjections(changed, catalog, catalogText), pattern, label);
}

function resolve(record, path) {
  return path.match(/[A-Za-z]+|[0-9]+/gu).reduce((value, key) => value?.[key], record);
}

function cardTuple(card) {
  const massMatch = card.massPath?.match(/weights\[([0-9]+)\]/u);
  return [card.clause.start, card.clause.end, massMatch ? Number(massMatch[1]) : null];
}

test("production manifest is deterministic and validates against the locked catalog", () => {
  assert.deepEqual(validateSpecimenCardProjections(published, catalog, catalogText), {
    projectionCount: 1955,
    atomicCardCount: 6675,
    massBoundCardCount: 6541,
    masslessCardCount: 134,
    sourceContextCardCount: 1657,
  });
  assert.equal(serializeSpecimenCardProjections(published), projectionText);
  assert.equal(createHash("sha256").update(catalogText).digest("hex"), published.metadata.sourceCatalogSha256);
  assert.equal(createHash("sha256").update(JSON.stringify(published.projections)).digest("hex"), "45490022fc876f4df62c07110b3fa40a04c0a1edc6aec26797d616f7c159c263");
  assert.equal(createHash("sha256").update(JSON.stringify(published.projections.filter(({ parentRecordId }) => !hamburgIds.has(parentRecordId)))).digest("hex"), "3edca8ec748beb5b9d2cb74871ad5c56082a5beced28e75c006a85f745999fa3");
  assert.equal(createHash("sha256").update(projectionText).digest("hex"), "7b51a9fcd0395d84b277cd2d183afbc32edb5b2e2c68e5fabca7aaabea80d339");
});

test("schema is a closed schema-3 count-locked atomic projection contract", () => {
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.$id, "urn:hmc:schema:specimen-card-projections:3");
  assert.deepEqual(schema.required, ["metadata", "projections"]);
  assert.equal(schema.properties.projections.minItems, 1955);
  assert.equal(schema.properties.projections.maxItems, 1955);
  assert.equal(schema.$defs.metadata.properties.atomicCardCount.const, 6675);
  assert.equal(schema.$defs.metadata.properties.sourceContextCardCount.const, 1657);
  assert.deepEqual(schema.$defs.projection.required, ["parentRecordId", "cards"]);
  assert.deepEqual(schema.$defs.card.oneOf, [
    { $ref: "#/$defs/clauseCard" },
    { $ref: "#/$defs/componentCard" },
  ]);
  assert.deepEqual(schema.$defs.clauseCard.required, ["holdingPath", "clause", "massPath"]);
  assert.deepEqual(schema.$defs.componentCard.required, ["holdingPath", "componentPath", "massPath"]);
  assert.deepEqual(schema.$defs.componentCard.properties.massPath, { $ref: "#/$defs/componentMassPath" });
  assert.deepEqual(schema.$defs.clause.required, ["textPath", "start", "end"]);
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (value === null || typeof value !== "object") return;
    if (value.type === "object") assert.equal(value.additionalProperties, false);
    Object.values(value).forEach(visit);
  };
  visit(schema);
});

test("embedded audit boundaries reconcile all four reviewed candidate sets", () => {
  assert.deepEqual(REVIEWED_AUDIT_COVERAGE, {
    candidateCount: 1038,
    candidateSetSha256: "b9befbead26b076d3c9c7a80e0da7d685a2a79f35674016d197239004bcae786",
    projectedParentCount: 370,
    contextOnlyExcludedParentCount: 668,
    atomicCardCount: 1056,
    massBoundCardCount: 922,
    masslessCardCount: 134,
    sourceContextCardCount: 370,
    boundaries: [
      { name: "prior", candidates: 226, projected: 223, excluded: 3, cards: 665, candidateSetSha256: "2b2bf8a08e85f756b61180385b8de61632dc4becc23b63160546ebe0785f7f78" },
      { name: "palache-merrill", candidates: 462, projected: 71, excluded: 391, cards: 126, candidateSetSha256: "db490176b7293d4b4ac2d5f6fe79dc7e156682bce800170f034a6b7225161024" },
      { name: "remaining", candidates: 294, projected: 26, excluded: 268, cards: 55, candidateSetSha256: "ac440ebe856454ec4bfcd8f612ced0b62860f11ee6745e171a058a6286faaad3" },
      { name: "multiholding", candidates: 56, projected: 50, excluded: 6, cards: 210, candidateSetSha256: "5591fb03e3b5beb601ba9f5735e760f238b607541edecdad014d402a8ff8f22f" },
    ],
  });
  assert.equal(REVIEWED_AUDIT_COVERAGE.boundaries.reduce((count, boundary) => count + boundary.candidates, 0), REVIEWED_AUDIT_COVERAGE.candidateCount);
  assert.equal(REVIEWED_AUDIT_COVERAGE.boundaries.reduce((count, boundary) => count + boundary.projected, 0), REVIEWED_AUDIT_COVERAGE.projectedParentCount);
  assert.equal(REVIEWED_AUDIT_COVERAGE.boundaries.reduce((count, boundary) => count + boundary.excluded, 0), REVIEWED_AUDIT_COVERAGE.contextOnlyExcludedParentCount);
  assert.equal(REVIEWED_AUDIT_COVERAGE.boundaries.reduce((count, boundary) => count + boundary.cards, 0), REVIEWED_AUDIT_COVERAGE.atomicCardCount);
});

test("Madrid projects exactly 23 multi-holding parents into 54 atomic specimen cards plus five contexts", () => {
  assert.deepEqual(MADRID_AUDIT_COVERAGE, {
    parentObservationCount: 130,
    holdingCount: 168,
    continuationHoldingCount: 38,
    projectedParentCount: 23,
    atomicCardCount: 54,
    groupedSourceContextHoldingCount: 7,
    sourceContextCardCount: 5,
    projectionSetSha256: "6678ff3d2401a92001d0b44a93ed71c322c5b3ecf2d0c512256e00dea8eeb5d9",
  });
  const madridRecords = catalog.records.filter(({ catalogId }) => catalogId === "madrid-1923");
  const projections = published.projections.filter(({ parentRecordId }) => madridIds.has(parentRecordId));
  const projectionById = new Map(projections.map((projection) => [projection.parentRecordId, projection]));
  assert.equal(madridRecords.filter(({ holdings }) => holdings.length > 1).length, 23);
  assert(madridRecords.filter(({ holdings }) => holdings.length === 1).every(({ id }) => !projectionById.has(id)));
  assert.equal(projections.reduce((count, { cards }) => count + cards.length, 0), 54);
  assert.equal(projections.filter((projection) =>
    deriveSourceContext(projection, recordById.get(projection.parentRecordId), "collection-entry")).length, 5);
  for (const projection of projections) {
    const record = recordById.get(projection.parentRecordId);
    assert.deepEqual(projection.cards.map(({ holdingPath }) => holdingPath), record.holdings
      .map((holding, index) => holding.description === "Specimen" ? `holdings[${index}]` : null)
      .filter(Boolean));
    assert(projection.cards.every((card) => resolve(record, card.clause.textPath) === "Specimen"));
  }
});

test("Hamburg projects all 218 typed individual components and retains all source context", () => {
  assert.deepEqual(HAMBURG_AUDIT_COVERAGE, {
    parentObservationCount: 147,
    holdingCount: 151,
    componentWeightCount: 227,
    individualHoldingComponentCount: 218,
    aggregateHoldingComponentCount: 4,
    associatedMaterialComponentCount: 5,
    projectedParentCount: 142,
    contextOnlyObservationCount: 5,
    atomicCardCount: 218,
    multiCardParentCount: 36,
    sourceContextCardCount: 142,
    thinSectionCount: 26,
    projectionSetSha256: "ea3d7d24a95122849f8fdd922dc9318cadd73362926084701d670950eee576b1",
  });
  const projections = published.projections.filter(({ parentRecordId }) => hamburgIds.has(parentRecordId));
  assert.equal(projections.length, 142);
  assert.equal(projections.reduce((count, { cards }) => count + cards.length, 0), 218);
  assert.equal(projections.filter(({ cards }) => cards.length > 1).length, 36);
  assert(projections.every((projection) =>
    deriveSourceContext(projection, recordById.get(projection.parentRecordId), "collection-entry")));
  assert(projections.every((projection) => projection.cards.every((card) =>
    resolve(recordById.get(projection.parentRecordId), card.componentPath).kind === "individual-holding")));
  assert.deepEqual(projections.find(({ parentRecordId }) => recordById.get(parentRecordId).entryOrder === 1).cards.map(({ massPath }) => massPath), [
    "holdings[0].weights[0].grams", "holdings[0].weights[1].grams", "holdings[0].weights[2].grams",
  ]);
  assert.deepEqual(projections.find(({ parentRecordId }) => recordById.get(parentRecordId).entryOrder === 105).cards.map(({ massPath }) => massPath), [
    ...Array.from({ length: 3 }, (_, index) => `holdings[0].weights[${index}].grams`),
    ...Array.from({ length: 11 }, (_, index) => `holdings[1].weights[${index}].grams`),
    "holdings[2].weights[0].grams",
  ]);
  assert(!projections.some(({ parentRecordId }) => recordById.get(parentRecordId).entryOrder === 147));
});

test("every evidence variant and optional mass resolves exactly in canonical source order", () => {
  const sourceOrder = new Map(catalog.records.map(({ id }, index) => [id, index]));
  let priorOrder = -1;
  let cardCount = 0;
  let contextCount = 0;
  for (const projection of published.projections) {
    const record = recordById.get(projection.parentRecordId);
    assert.ok(record);
    assert(sourceOrder.get(record.id) > priorOrder);
    priorOrder = sourceOrder.get(record.id);
    const references = new Set();
    const spansByPath = new Map();
    let previous = [-1, -1, "", -1, -1];
    for (const card of projection.cards) {
      const holdingIndex = Number(card.holdingPath.match(/[0-9]+/u)[0]);
      let order;
      if (card.clause) {
        assert.equal(Object.hasOwn(card, "componentPath"), false);
        const textIndex = Number(card.clause.textPath.match(/[0-9]+/u)[0]);
        assert.equal(holdingIndex, textIndex);
        const text = resolve(record, card.clause.textPath);
        assert.equal(typeof text, "string");
        assert(card.clause.start >= 0 && card.clause.start < card.clause.end && card.clause.end <= text.length);
        assert.match(text.slice(card.clause.start, card.clause.end), /[\p{L}\p{N}]/u);
        for (const boundary of [card.clause.start, card.clause.end]) {
          if (boundary > 0 && boundary < text.length) {
            assert(!(text.charCodeAt(boundary - 1) >= 0xd800 && text.charCodeAt(boundary - 1) <= 0xdbff &&
              text.charCodeAt(boundary) >= 0xdc00 && text.charCodeAt(boundary) <= 0xdfff));
          }
        }
        order = [holdingIndex, -1, card.clause.textPath, card.clause.start, card.clause.end];
        const spans = spansByPath.get(card.clause.textPath) || [];
        assert(spans.every(([start, end]) => card.clause.end <= start || card.clause.start >= end));
        spans.push([card.clause.start, card.clause.end]);
        spansByPath.set(card.clause.textPath, spans);
      } else {
        assert.equal(Object.hasOwn(card, "clause"), false);
        const componentMatch = card.componentPath.match(/^holdings\[([0-9]+)\]\.weights\[([0-9]+)\]$/u);
        assert(componentMatch);
        assert.equal(Number(componentMatch[1]), holdingIndex);
        assert.equal(resolve(record, card.componentPath).kind, "individual-holding");
        assert.equal(card.massPath, `${card.componentPath}.grams`);
        order = [holdingIndex, Number(componentMatch[2]), "", -1, -1];
      }
      assert(order[0] > previous[0] || (order[0] === previous[0] &&
        (order[1] > previous[1] || (order[1] === previous[1] &&
          (order[2] > previous[2] || (order[2] === previous[2] &&
            (order[3] > previous[3] || (order[3] === previous[3] && order[4] > previous[4]))))))));
      previous = order;
      if (card.massPath !== null) {
        assert(Number.isFinite(resolve(record, card.massPath)) && resolve(record, card.massPath) > 0);
        assert.equal(Number(card.massPath.match(/[0-9]+/u)[0]), holdingIndex);
        assert(!references.has(card.massPath));
        references.add(card.massPath);
      }
      cardCount++;
    }
    const hasContext = deriveSourceContext(projection, record, modelByCatalog.get(record.catalogId));
    contextCount += Number(hasContext);
    assert(projection.cards.length + Number(hasContext) >= 2);
  }
  assert.equal(cardCount, 6675);
  assert.equal(contextCount, 1657);
});

test("Prior 630 has exact 17 reviewed clauses plus context; Reeds 366 has ten full holdings and no context", () => {
  const prior = published.projections.find(({ parentRecordId }) => parentRecordId === PRIOR_630_ID);
  assert.deepEqual(prior.cards.map(cardTuple), [
    [77, 123, 0], [126, 163, 1], [165, 201, 2], [203, 239, 3], [241, 259, 4], [261, 279, 5],
    [281, 300, null], [303, 336, null], [338, 356, 6], [358, 376, 7], [378, 415, null], [417, 436, 8],
    [438, 456, 9], [458, 477, null], [479, 497, 10], [499, 516, 11], [518, 536, null],
  ]);
  assert(deriveSourceContext(prior, recordById.get(PRIOR_630_ID), "collection-entry"));
  const priorText = recordById.get(PRIOR_630_ID).holdings[0].description;
  assert.match(priorText.slice(prior.cards.at(-1).clause.end), /27 stones|total weight|12 small stones/iu);

  const reeds = published.projections.find(({ parentRecordId }) => parentRecordId === REEDS_366_ID);
  assert.equal(reeds.cards.length, 10);
  for (const [index, card] of reeds.cards.entries()) {
    const holding = recordById.get(REEDS_366_ID).holdings[index];
    assert.deepEqual(card, {
      holdingPath: `holdings[${index}]`,
      clause: { textPath: `holdings[${index}].description`, start: 0, end: holding.description.length },
      massPath: `holdings[${index}].weights[0].grams`,
    });
  }
  assert.equal(deriveSourceContext(reeds, recordById.get(REEDS_366_ID), "collection-entry"), false);
});

test("manifest exposes only identifiers, paths, and numeric boundaries without copied prose or private fields", () => {
  const allowedKeys = new Set([
    "metadata", "projections", "schemaVersion", "scope", "catalogSchemaVersion", "sourceRecordCount",
    "sourceCatalogSha256", "projectionCount", "atomicCardCount", "sourceContextCardCount", "parentRecordId",
    "cards", "holdingPath", "clause", "componentPath", "textPath", "start", "end", "massPath",
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
  assert.doesNotMatch(projectionText, /(?:label|source(?:File|Path)|notes?|urls?|images?|private|\/Users\/|\/private\/|\.pdf|\.png|\.webp|reason|evidence|disposition)/iu);
});

test("rejects wrong metadata, extra fields, free text, and altered source bytes", () => {
  for (const key of ["schemaVersion", "scope", "catalogSchemaVersion", "sourceRecordCount", "sourceCatalogSha256", "projectionCount", "atomicCardCount", "sourceContextCardCount"]) {
    mutate(`wrong ${key}`, (value) => { value.metadata[key] = key === "scope" ? "other" : 0; });
  }
  mutate("extra root key", (value) => { value.description = "private prose"; }, /exactly keys/iu);
  mutate("extra metadata key", (value) => { value.metadata.sourcePath = "/private/catalog.json"; }, /exactly keys/iu);
  mutate("extra projection key", (value) => { value.projections[0].retainParentContext = true; }, /exactly keys/iu);
  mutate("extra card key", (value) => { value.projections[0].cards[0].note = "review note"; }, /exactly keys/iu);
  mutate("extra clause key", (value) => { value.projections[0].cards[0].clause.text = "copied prose"; }, /exactly keys/iu);
  assert.throws(() => validateSpecimenCardProjections(published, catalog, `${catalogText} `), /SHA-256/iu);
});

test("rejects duplicate, dangling, reordered, malformed, mismatched, and overlapping references", () => {
  mutate("duplicate parent", (value) => { value.projections[1].parentRecordId = value.projections[0].parentRecordId; });
  mutate("dangling parent", (value) => { value.projections[0].parentRecordId = "obs-00000000-0000-4000-8000-000000000000"; });
  mutate("reordered parents", (value) => { [value.projections[0], value.projections[1]] = [value.projections[1], value.projections[0]]; });
  mutate("reordered cards", (value) => { value.projections.find(({ cards }) => cards.length > 1).cards.reverse(); });
  mutate("dangling holding", (value) => { const card = value.projections[0].cards[0]; card.holdingPath = "holdings[999]"; card.clause.textPath = "holdings[999].description"; });
  mutate("malformed holding path", (value) => { value.projections[0].cards[0].holdingPath = "/holdings/0"; });
  mutate("mismatched text holding", (value) => { value.projections[0].cards[0].clause.textPath = "holdings[1].designation"; });
  mutate("unsupported text field", (value) => { value.projections[0].cards[0].clause.textPath = "holdings[0].provenance"; });
  mutate("empty range", (value) => { value.projections[0].cards[0].clause.end = value.projections[0].cards[0].clause.start; });
  mutate("out of bounds range", (value) => { value.projections[0].cards[0].clause.end = 999999; });
  mutate("overlapping clauses", (value) => {
    const prior = value.projections.find(({ parentRecordId }) => parentRecordId === PRIOR_630_ID);
    prior.cards[1].clause.start = prior.cards[0].clause.end - 1;
  }, /overlap|canonical/iu);
});

test("rejects invalid, duplicate, mismatched, and non-specimen mass bindings", () => {
  mutate("duplicate mass", (value) => {
    const prior = value.projections.find(({ parentRecordId }) => parentRecordId === PRIOR_630_ID);
    prior.cards[1].massPath = prior.cards[0].massPath;
  }, /duplicated|canonical/iu);
  mutate("mismatched mass holding", (value) => {
    const reeds = value.projections.find(({ parentRecordId }) => parentRecordId === REEDS_366_ID);
    reeds.cards[0].massPath = "holdings[1].weights[0].grams";
  });
  mutate("dangling mass", (value) => {
    const prior = value.projections.find(({ parentRecordId }) => parentRecordId === PRIOR_630_ID);
    prior.cards[0].massPath = "holdings[0].weights[999].grams";
  }, /positive numeric mass/iu);
  mutate("wrong model path", (value) => { value.projections[0].cards[0].massPath = "holdings[0].weights[0].grams"; }, /unsupported/iu);
  mutate("cast catalog item", (value) => {
    const projection = value.projections.find(({ parentRecordId }) => parentRecordId === "obs-11bc479c-55f1-43c6-a7d6-f55931c6b4ca");
    const holding = recordById.get(projection.parentRecordId).holdings[2];
    projection.cards[0] = {
      holdingPath: "holdings[2]",
      clause: { textPath: "holdings[2].designation", start: 0, end: holding.designation.length },
      massPath: "holdings[2].weight.grams",
    };
  }, /non-specimen/iu);
});

test("rejects every malformed Hamburg component evidence mutation", () => {
  const byEntryOrder = (value, entryOrder) => value.projections.find(({ parentRecordId }) =>
    recordById.get(parentRecordId)?.catalogId === "hamburg-1913" && recordById.get(parentRecordId).entryOrder === entryOrder);
  mutate("malformed component path", (value) => {
    byEntryOrder(value, 1).cards[0].componentPath = "/holdings/0/weights/0";
  }, /componentPath.*malformed/iu);
  mutate("dangling component path", (value) => {
    const card = byEntryOrder(value, 1).cards[0];
    card.componentPath = "holdings[0].weights[999]";
    card.massPath = `${card.componentPath}.grams`;
  }, /individual-holding/iu);
  mutate("component path uses a different holding", (value) => {
    const card = byEntryOrder(value, 105).cards[0];
    card.componentPath = "holdings[1].weights[0]";
    card.massPath = `${card.componentPath}.grams`;
  }, /different holding/iu);
  mutate("aggregate component projected", (value) => {
    const card = byEntryOrder(value, 37).cards[2];
    card.componentPath = "holdings[0].weights[3]";
    card.massPath = `${card.componentPath}.grams`;
  }, /individual-holding/iu);
  mutate("component mass does not match component path", (value) => {
    byEntryOrder(value, 1).cards[0].massPath = "holdings[0].weights[1].grams";
  }, /exact componentPath/iu);
  mutate("component mass is null", (value) => {
    byEntryOrder(value, 1).cards[0].massPath = null;
  }, /exact componentPath|non-null/iu);
  mutate("component cards reordered", (value) => {
    byEntryOrder(value, 1).cards.reverse();
  }, /source order/iu);
  mutate("component card duplicated", (value) => {
    const cards = byEntryOrder(value, 1).cards;
    cards[1] = structuredClone(cards[0]);
  }, /duplicated|source order/iu);
  mutate("both evidence variants present", (value) => {
    byEntryOrder(value, 1).cards[0].clause = { textPath: "holdings[0].description", start: 0, end: 15 };
  }, /exactly one/iu);
  mutate("no evidence variant present", (value) => {
    delete byEntryOrder(value, 1).cards[0].componentPath;
  }, /exactly one/iu);
  mutate("generic clause substituted for Hamburg component evidence", (value) => {
    byEntryOrder(value, 1).cards[0] = {
      holdingPath: "holdings[0]",
      clause: { textPath: "holdings[0].description", start: 0, end: 15 },
      massPath: "holdings[0].weights[0].grams",
    };
  }, /Hamburg cards must use componentPath/iu);
  mutate("component evidence used outside Hamburg", (value) => {
    const reeds = value.projections.find(({ parentRecordId }) => parentRecordId === REEDS_366_ID);
    reeds.cards[0] = {
      holdingPath: "holdings[0]",
      componentPath: "holdings[0].weights[0]",
      massPath: "holdings[0].weights[0].grams",
    };
  }, /restricted to Hamburg/iu);
});

test("rejects Prior, Reeds, context-count, card-count, and reviewed-set drift", () => {
  mutate("Prior massless clause removed", (value) => {
    value.projections.find(({ parentRecordId }) => parentRecordId === PRIOR_630_ID).cards.splice(6, 1);
    value.metadata.atomicCardCount--;
  }, /Prior entry 630|production lock|atomic card count/iu);
  mutate("Prior group endpoint selected", (value) => {
    const prior = value.projections.find(({ parentRecordId }) => parentRecordId === PRIOR_630_ID);
    prior.cards[16].massPath = "holdings[0].weights[12].grams";
  }, /Prior entry 630/iu);
  mutate("Reeds span shortened", (value) => {
    value.projections.find(({ parentRecordId }) => parentRecordId === REEDS_366_ID).cards[0].clause.end--;
  }, /Reeds entry 366/iu);
  mutate("Reeds card removed", (value) => {
    value.projections.find(({ parentRecordId }) => parentRecordId === REEDS_366_ID).cards.pop();
    value.metadata.atomicCardCount--;
  }, /Reeds entry 366|atomic.?card.?count/iu);
  mutate("derived context changed", (value) => { value.metadata.sourceContextCardCount--; });
  mutate("reviewed span changed", (value) => {
    const projection = value.projections.find((candidate) => candidate.cards.length > 2 &&
      ![PRIOR_630_ID, REEDS_366_ID].includes(candidate.parentRecordId) &&
      deriveSourceContext(candidate, recordById.get(candidate.parentRecordId), modelByCatalog.get(recordById.get(candidate.parentRecordId).catalogId)));
    projection.cards[0].clause.end--;
  }, /reviewed production lock|schema-2 production lock/iu);
  mutate("Madrid grouped holding projected atomically", (value) => {
    const madrid = value.projections.find(({ parentRecordId }) => parentRecordId === "obs-ffa86dbe-b5f3-413b-913c-deb60966c05d");
    madrid.cards[1].holdingPath = "holdings[2]";
    madrid.cards[1].clause.textPath = "holdings[2].description";
    madrid.cards[1].clause.end = "Specimen group".length;
    madrid.cards[1].massPath = "holdings[2].weights[0].grams";
  }, /Madrid atomic paths/iu);
  mutate("Madrid multi-holding parent omitted", (value) => {
    const index = value.projections.findIndex(({ parentRecordId }) => madridIds.has(parentRecordId));
    value.projections.splice(index, 1);
  }, /projection array count|production lock|Madrid multi-holding parent/iu);
});
