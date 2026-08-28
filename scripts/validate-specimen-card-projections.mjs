import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const LOCKS = Object.freeze({
  catalogSchemaVersion: 6,
  sourceRecordCount: 13542,
  sourceCatalogSha256: "3928a876a73c3ae74e9a822df0c2bded3f0cdfeb506874ebec4fc3877017a811",
  projectionCount: 1699,
  projectedCardCount: 6316,
  projectionSetSha256: "25203ba07c606acfa9d128916ccd3cec0ea349db92a09602076d61d51fbb3aef",
});
const PRIOR_630_ID = "obs-344d0b6d-920e-403f-8fd5-c113fc05291d";
const REEDS_366_ID = "obs-b02789ea-869e-447a-97cc-28c2c6900e88";
const REEDS_366_MASSES = [28.9, 310.1, 142, 30, 9.6, 124.5, 2.3, 128.5, 658.7, 51.2];
const ROOT_KEYS = ["metadata", "projections"];
const METADATA_KEYS = [
  "schemaVersion", "scope", "catalogSchemaVersion", "sourceRecordCount", "sourceCatalogSha256",
  "projectionCount", "projectedCardCount",
];
const PROJECTION_KEYS = ["parentRecordId", "retainParentContext", "cards"];
const CARD_KEYS = ["holdingPath", "massPath"];
const HOLDING_PATH = /^holdings\[(0|[1-9][0-9]*)\]$/u;
const ARRAY_MASS_PATH = /^holdings\[(0|[1-9][0-9]*)\]\.weights\[(0|[1-9][0-9]*)\]\.grams$/u;
const SCALAR_MASS_PATH = /^holdings\[(0|[1-9][0-9]*)\]\.weight\.grams$/u;
const RECORD_ID = /^obs-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

function fail(message) {
  throw new Error(`specimen-card projections invalid: ${message}`);
}

function assertExactKeys(value, expected, location) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${location} must be an object`);
  const actual = Object.keys(value);
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(`${location} must have exactly keys ${expected.join(", ")} in canonical order; got ${actual.join(", ")}`);
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function massEntries(record, recordModel) {
  return record.holdings.flatMap((holding, holdingIndex) => {
    if (recordModel === "catalog-item") {
      return Number.isFinite(holding.weight?.grams)
        ? [[`holdings[${holdingIndex}].weight.grams`, holding.weight.grams]]
        : [];
    }
    return (holding.weights || []).flatMap((weight, weightIndex) => Number.isFinite(weight.grams)
      ? [[`holdings[${holdingIndex}].weights[${weightIndex}].grams`, weight.grams]]
      : []);
  });
}

function parseCard(card, record, recordModel, location) {
  assertExactKeys(card, CARD_KEYS, location);
  if (typeof card.holdingPath !== "string" || typeof card.massPath !== "string") fail(`${location} paths must be strings`);
  const holdingMatch = card.holdingPath.match(HOLDING_PATH);
  if (!holdingMatch) fail(`${location}.holdingPath is malformed`);
  const massMatch = card.massPath.match(recordModel === "catalog-item" ? SCALAR_MASS_PATH : ARRAY_MASS_PATH);
  if (!massMatch) fail(`${location}.massPath is unsupported for ${recordModel}`);
  const holdingIndex = Number(holdingMatch[1]);
  const massHoldingIndex = Number(massMatch[1]);
  if (holdingIndex !== massHoldingIndex) fail(`${location} holdingPath and massPath refer to different holdings`);
  const holding = record.holdings[holdingIndex];
  if (!holding) fail(`${location}.holdingPath is dangling`);
  if (recordModel === "catalog-item" && holding.kind !== "specimen") fail(`${location} resolves to a non-specimen catalog item`);
  const weightIndex = recordModel === "catalog-item" ? -1 : Number(massMatch[2]);
  const mass = recordModel === "catalog-item" ? holding.weight?.grams : holding.weights?.[weightIndex]?.grams;
  if (!Number.isFinite(mass) || mass <= 0) fail(`${location}.massPath does not resolve to a positive numeric mass`);
  return { holdingIndex, weightIndex, mass };
}

export function serializeSpecimenCardProjections(document) {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function validateSpecimenCardProjections(document, catalog, catalogText) {
  assertExactKeys(document, ROOT_KEYS, "root");
  assertExactKeys(document.metadata, METADATA_KEYS, "metadata");
  const expectedMetadata = {
    schemaVersion: 1,
    scope: "reviewed-specimen-card-display-projections",
    catalogSchemaVersion: LOCKS.catalogSchemaVersion,
    sourceRecordCount: LOCKS.sourceRecordCount,
    sourceCatalogSha256: LOCKS.sourceCatalogSha256,
    projectionCount: LOCKS.projectionCount,
    projectedCardCount: LOCKS.projectedCardCount,
  };
  for (const key of METADATA_KEYS) {
    if (document.metadata[key] !== expectedMetadata[key]) fail(`metadata.${key} differs from the production lock`);
  }
  if (catalog?.metadata?.schemaVersion !== LOCKS.catalogSchemaVersion) fail("catalog schemaVersion differs from the production lock");
  if (!Array.isArray(catalog.records) || catalog.records.length !== LOCKS.sourceRecordCount) fail("catalog record count differs from the production lock");
  if (typeof catalogText !== "string" || sha256(catalogText) !== LOCKS.sourceCatalogSha256) fail("catalog SHA-256 differs from the production lock");
  if (!Array.isArray(document.projections) || document.projections.length !== LOCKS.projectionCount) fail("projection array count differs from metadata");

  const catalogModels = new Map(catalog.metadata.catalogs.map(({ id, recordModel }) => [id, recordModel]));
  const records = new Map(catalog.records.map((record, index) => [record.id, { record, index }]));
  const seenParents = new Set();
  const seenMassPaths = new Set();
  let previousRecordIndex = -1;
  let projectedCardCount = 0;

  for (const [projectionIndex, projection] of document.projections.entries()) {
    const location = `projections[${projectionIndex}]`;
    assertExactKeys(projection, PROJECTION_KEYS, location);
    if (typeof projection.parentRecordId !== "string" || !RECORD_ID.test(projection.parentRecordId)) fail(`${location}.parentRecordId is invalid`);
    if (projection.parentRecordId === PRIOR_630_ID) fail("Prior entry 630 is explicitly excluded from projections");
    if (seenParents.has(projection.parentRecordId)) fail(`${location}.parentRecordId is duplicated`);
    seenParents.add(projection.parentRecordId);
    const source = records.get(projection.parentRecordId);
    if (!source) fail(`${location}.parentRecordId is dangling`);
    if (source.index <= previousRecordIndex) fail("projections are not ordered by canonical parent order");
    previousRecordIndex = source.index;
    if (typeof projection.retainParentContext !== "boolean") fail(`${location}.retainParentContext must be boolean`);
    if (!Array.isArray(projection.cards) || projection.cards.length === 0) fail(`${location}.cards must be nonempty`);
    if (!projection.retainParentContext && projection.cards.length === 1) fail(`${location} would produce one display unit with no residual`);
    const recordModel = catalogModels.get(source.record.catalogId);
    if (!new Set(["catalog-item", "catalog-number", "collection-entry"]).has(recordModel)) fail(`${location} has unsupported record model ${recordModel}`);

    let previousHoldingIndex = -1;
    let previousWeightIndex = -1;
    const selectedHoldingIndexes = new Set();
    const selectedMassPaths = new Set();
    for (const [cardIndex, card] of projection.cards.entries()) {
      const cardLocation = `${location}.cards[${cardIndex}]`;
      const parsed = parseCard(card, source.record, recordModel, cardLocation);
      if (parsed.holdingIndex < previousHoldingIndex ||
          (parsed.holdingIndex === previousHoldingIndex && parsed.weightIndex <= previousWeightIndex)) {
        fail(`${location}.cards are not ordered by holding then weight index`);
      }
      previousHoldingIndex = parsed.holdingIndex;
      previousWeightIndex = parsed.weightIndex;
      selectedHoldingIndexes.add(parsed.holdingIndex);
      if (selectedMassPaths.has(card.massPath) || seenMassPaths.has(`${projection.parentRecordId}\0${card.massPath}`)) {
        fail(`${cardLocation}.massPath is duplicated`);
      }
      selectedMassPaths.add(card.massPath);
      seenMassPaths.add(`${projection.parentRecordId}\0${card.massPath}`);
    }
    projectedCardCount += projection.cards.length;

    if (!projection.retainParentContext) {
      const numericMassPaths = massEntries(source.record, recordModel).map(([path]) => path);
      if (selectedHoldingIndexes.size !== source.record.holdings.length ||
          numericMassPaths.length !== selectedMassPaths.size ||
          numericMassPaths.some((path) => !selectedMassPaths.has(path))) {
        fail(`${location} may omit parent context only when every holding and numeric mass is exhausted`);
      }
    }
  }

  if (projectedCardCount !== LOCKS.projectedCardCount) fail("projected card count differs from metadata");
  const reeds = document.projections.find(({ parentRecordId }) => parentRecordId === REEDS_366_ID);
  if (!reeds || reeds.retainParentContext || reeds.cards.length !== REEDS_366_MASSES.length) fail("Reeds entry 366 lock is missing or malformed");
  const reedsRecord = records.get(REEDS_366_ID).record;
  const reedsMasses = reeds.cards.map((card, index) => parseCard(card, reedsRecord, "collection-entry", `Reeds 366 cards[${index}]`).mass);
  if (reedsMasses.some((mass, index) => mass !== REEDS_366_MASSES[index])) fail("Reeds entry 366 ordered masses differ from the production lock");
  if (sha256(JSON.stringify(document.projections)) !== LOCKS.projectionSetSha256) fail("projection set differs from the reviewed production lock");

  return {
    projectionCount: document.projections.length,
    projectedCardCount,
    retainedParentContextCount: document.projections.filter(({ retainParentContext }) => retainParentContext).length,
  };
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const args = process.argv.slice(2);
  if (args.length > 2) throw new Error("usage: node scripts/validate-specimen-card-projections.mjs [projection-json] [catalog-json]");
  const projectionUrl = args[0] ? pathToFileURL(args[0]) : new URL("../data/specimen-card-projections.json", import.meta.url);
  const catalogUrl = args[1] ? pathToFileURL(args[1]) : new URL("../data/catalog.json", import.meta.url);
  const [projectionText, sourceCatalogText] = await Promise.all([readFile(projectionUrl, "utf8"), readFile(catalogUrl, "utf8")]);
  const document = JSON.parse(projectionText);
  const result = validateSpecimenCardProjections(document, JSON.parse(sourceCatalogText), sourceCatalogText);
  if (projectionText !== serializeSpecimenCardProjections(document)) fail("projection JSON is not deterministically serialized");
  console.log(`validated ${result.projectionCount} specimen-card projections (${result.projectedCardCount} cards, ${result.retainedParentContextCount} retaining parent context)`);
}
