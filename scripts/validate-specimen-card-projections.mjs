import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const LOCKS = Object.freeze({
  catalogSchemaVersion: 8,
  sourceRecordCount: 14176,
  sourceCatalogSha256: "46d8ea050f428cfd4ab633c7e29da1493aaef413cd6da0dc1054ec6275823584",
  projectionCount: 1955,
  atomicCardCount: 6675,
  sourceContextCardCount: 1657,
  projectionSetSha256: "45490022fc876f4df62c07110b3fa40a04c0a1edc6aec26797d616f7c159c263",
  nonHamburgProjectionSetSha256: "3edca8ec748beb5b9d2cb74871ad5c56082a5beced28e75c006a85f745999fa3",
});
export const REVIEWED_AUDIT_COVERAGE = Object.freeze({
  candidateCount: 1038,
  candidateSetSha256: "b9befbead26b076d3c9c7a80e0da7d685a2a79f35674016d197239004bcae786",
  projectedParentCount: 370,
  contextOnlyExcludedParentCount: 668,
  atomicCardCount: 1056,
  massBoundCardCount: 922,
  masslessCardCount: 134,
  sourceContextCardCount: 370,
  boundaries: Object.freeze([
    Object.freeze({ name: "prior", candidates: 226, projected: 223, excluded: 3, cards: 665, candidateSetSha256: "2b2bf8a08e85f756b61180385b8de61632dc4becc23b63160546ebe0785f7f78" }),
    Object.freeze({ name: "palache-merrill", candidates: 462, projected: 71, excluded: 391, cards: 126, candidateSetSha256: "db490176b7293d4b4ac2d5f6fe79dc7e156682bce800170f034a6b7225161024" }),
    Object.freeze({ name: "remaining", candidates: 294, projected: 26, excluded: 268, cards: 55, candidateSetSha256: "ac440ebe856454ec4bfcd8f612ced0b62860f11ee6745e171a058a6286faaad3" }),
    Object.freeze({ name: "multiholding", candidates: 56, projected: 50, excluded: 6, cards: 210, candidateSetSha256: "5591fb03e3b5beb601ba9f5735e760f238b607541edecdad014d402a8ff8f22f" }),
  ]),
});
export const MADRID_AUDIT_COVERAGE = Object.freeze({
  parentObservationCount: 130,
  holdingCount: 168,
  continuationHoldingCount: 38,
  projectedParentCount: 23,
  atomicCardCount: 54,
  groupedSourceContextHoldingCount: 7,
  sourceContextCardCount: 5,
  projectionSetSha256: "6678ff3d2401a92001d0b44a93ed71c322c5b3ecf2d0c512256e00dea8eeb5d9",
});
export const HAMBURG_AUDIT_COVERAGE = Object.freeze({
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
const PRIOR_630_ID = "obs-344d0b6d-920e-403f-8fd5-c113fc05291d";
const PRIOR_630_CARDS_SHA256 = "839f6cb10b69c5fff3418ed5d0b17143442b18384b3084a5479435ba3077f9c7";
const REEDS_366_ID = "obs-b02789ea-869e-447a-97cc-28c2c6900e88";
const ROOT_KEYS = ["metadata", "projections"];
const METADATA_KEYS = [
  "schemaVersion", "scope", "catalogSchemaVersion", "sourceRecordCount", "sourceCatalogSha256",
  "projectionCount", "atomicCardCount", "sourceContextCardCount",
];
const PROJECTION_KEYS = ["parentRecordId", "cards"];
const CLAUSE_CARD_KEYS = ["holdingPath", "clause", "massPath"];
const COMPONENT_CARD_KEYS = ["holdingPath", "componentPath", "massPath"];
const CLAUSE_KEYS = ["textPath", "start", "end"];
const HOLDING_PATH = /^holdings\[(0|[1-9][0-9]*)\]$/u;
const TEXT_PATH = /^holdings\[(0|[1-9][0-9]*)\]\.(description|designation)$/u;
const ARRAY_MASS_PATH = /^holdings\[(0|[1-9][0-9]*)\]\.weights\[(0|[1-9][0-9]*)\]\.grams$/u;
const SCALAR_MASS_PATH = /^holdings\[(0|[1-9][0-9]*)\]\.weight\.grams$/u;
const COMPONENT_PATH = /^holdings\[(0|[1-9][0-9]*)\]\.weights\[(0|[1-9][0-9]*)\]$/u;
const RECORD_ID = /^obs-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const MEANINGFUL_TEXT = /[\p{L}\p{N}]/u;

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

function resolvePath(value, path) {
  return path.match(/[A-Za-z]+|[0-9]+/gu).reduce((current, key) => current?.[key], value);
}

function splitsSurrogatePair(text, index) {
  if (index <= 0 || index >= text.length) return false;
  const before = text.charCodeAt(index - 1);
  const after = text.charCodeAt(index);
  return before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff;
}

function compareCards(left, right) {
  const leftHolding = Number(left.holdingPath.match(HOLDING_PATH)[1]);
  const rightHolding = Number(right.holdingPath.match(HOLDING_PATH)[1]);
  if (leftHolding !== rightHolding) return leftHolding - rightHolding;
  if (left.componentPath || right.componentPath) {
    if (!left.componentPath) return -1;
    if (!right.componentPath) return 1;
    return Number(left.componentPath.match(COMPONENT_PATH)[2]) - Number(right.componentPath.match(COMPONENT_PATH)[2]);
  }
  if (left.clause.textPath !== right.clause.textPath) return left.clause.textPath < right.clause.textPath ? -1 : 1;
  if (left.clause.start !== right.clause.start) return left.clause.start - right.clause.start;
  if (left.clause.end !== right.clause.end) return left.clause.end - right.clause.end;
  const leftMass = left.massPath || "";
  const rightMass = right.massPath || "";
  return leftMass < rightMass ? -1 : leftMass > rightMass ? 1 : 0;
}

function numericMassPaths(holding, holdingPath, recordModel) {
  if (recordModel === "catalog-item") {
    return Number.isFinite(holding.weight?.grams) ? [`${holdingPath}.weight.grams`] : [];
  }
  return (holding.weights || []).flatMap((weight, index) =>
    Number.isFinite(weight.grams) ? [`${holdingPath}.weights[${index}].grams`] : []);
}

export function deriveSourceContext(projection, record, recordModel) {
  const selectedHoldings = new Set(projection.cards.map(({ holdingPath }) => holdingPath));
  const selectedMasses = new Set(projection.cards.flatMap(({ massPath }) => massPath === null ? [] : [massPath]));
  const spansByTextPath = new Map();
  if (Object.hasOwn(record, "publicationState") || (record.amendments?.length ?? 0) > 0) return true;
  for (const card of projection.cards) {
    if (!card.clause) continue;
    const spans = spansByTextPath.get(card.clause.textPath) || [];
    spans.push([card.clause.start, card.clause.end]);
    spansByTextPath.set(card.clause.textPath, spans);
  }

  for (const [holdingIndex, holding] of record.holdings.entries()) {
    const holdingPath = `holdings[${holdingIndex}]`;
    if (!selectedHoldings.has(holdingPath)) return true;
    for (const field of ["designation", "description", "provenance"]) {
      const text = holding[field];
      if (typeof text !== "string" || !MEANINGFUL_TEXT.test(text)) continue;
      const spans = spansByTextPath.get(`${holdingPath}.${field}`) || [];
      if (spans.length === 0) return true;
      let offset = 0;
      for (const [start, end] of spans) {
        if (MEANINGFUL_TEXT.test(text.slice(offset, start))) return true;
        offset = end;
      }
      if (MEANINGFUL_TEXT.test(text.slice(offset))) return true;
    }
    if (Number.isInteger(holding.count) && holding.count > 1) return true;
    if (numericMassPaths(holding, holdingPath, recordModel).some((path) => !selectedMasses.has(path))) return true;
  }
  return false;
}

function parseCard(card, record, recordModel, location) {
  const hasClause = card !== null && typeof card === "object" && Object.hasOwn(card, "clause");
  const hasComponent = card !== null && typeof card === "object" && Object.hasOwn(card, "componentPath");
  if (hasClause === hasComponent) fail(`${location} must have exactly one clause or componentPath evidence variant`);
  assertExactKeys(card, hasClause ? CLAUSE_CARD_KEYS : COMPONENT_CARD_KEYS, location);
  if (hasClause) assertExactKeys(card.clause, CLAUSE_KEYS, `${location}.clause`);
  if (typeof card.holdingPath !== "string") fail(`${location}.holdingPath must be a string`);
  const holdingMatch = card.holdingPath.match(HOLDING_PATH);
  if (!holdingMatch) fail(`${location}.holdingPath is malformed`);
  const holdingIndex = Number(holdingMatch[1]);
  const holding = record.holdings[holdingIndex];
  if (!holding) fail(`${location}.holdingPath is dangling`);
  if (recordModel === "catalog-item" && holding.kind !== "specimen") fail(`${location} resolves to a non-specimen catalog item`);

  let text = null;
  if (hasClause) {
    if (record.catalogId === "hamburg-1913") fail(`${location} Hamburg cards must use componentPath evidence`);
    const textMatch = typeof card.clause.textPath === "string" ? card.clause.textPath.match(TEXT_PATH) : null;
    if (!textMatch) fail(`${location}.clause.textPath is malformed or unsupported`);
    if (Number(textMatch[1]) !== holdingIndex) fail(`${location}.clause.textPath refers to a different holding`);
    text = resolvePath(record, card.clause.textPath);
    if (typeof text !== "string") fail(`${location}.clause.textPath does not resolve to text`);
    const { start, end } = card.clause;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > text.length) {
      fail(`${location}.clause must be a nonempty UTF-16 half-open range within its source text`);
    }
    if (splitsSurrogatePair(text, start) || splitsSurrogatePair(text, end)) fail(`${location}.clause splits a UTF-16 surrogate pair`);
    if (!MEANINGFUL_TEXT.test(text.slice(start, end))) fail(`${location}.clause has no alphanumeric source content`);
  } else {
    if (record.catalogId !== "hamburg-1913") fail(`${location}.componentPath evidence is restricted to Hamburg cards`);
    const componentMatch = typeof card.componentPath === "string" ? card.componentPath.match(COMPONENT_PATH) : null;
    if (!componentMatch) fail(`${location}.componentPath is malformed or unsupported`);
    if (Number(componentMatch[1]) !== holdingIndex) fail(`${location}.componentPath refers to a different holding`);
    const component = resolvePath(record, card.componentPath);
    if (!component || component.kind !== "individual-holding") fail(`${location}.componentPath does not resolve to an individual-holding component`);
    if (card.massPath !== `${card.componentPath}.grams`) fail(`${location}.massPath must bind the exact componentPath grams field`);
  }

  if (card.massPath === null) {
    if (hasComponent) fail(`${location}.massPath must be non-null for componentPath evidence`);
    return { holdingIndex, text, mass: null };
  }
  if (typeof card.massPath !== "string") fail(`${location}.massPath must be a string or null`);
  const massMatch = card.massPath.match(recordModel === "catalog-item" ? SCALAR_MASS_PATH : ARRAY_MASS_PATH);
  if (!massMatch) fail(`${location}.massPath is unsupported for ${recordModel}`);
  if (Number(massMatch[1]) !== holdingIndex) fail(`${location}.massPath refers to a different holding`);
  const mass = resolvePath(record, card.massPath);
  if (!Number.isFinite(mass) || mass <= 0) fail(`${location}.massPath does not resolve to a positive numeric mass`);
  if (recordModel === "collection-entry" && holding.weights?.[Number(massMatch[2])]?.kind !== undefined &&
      holding.weights[Number(massMatch[2])].kind !== "individual-holding") {
    fail(`${location}.massPath resolves to a non-individual component`);
  }
  return { holdingIndex, text, mass };
}

export function serializeSpecimenCardProjections(document) {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function validateSpecimenCardProjections(document, catalog, catalogText) {
  assertExactKeys(document, ROOT_KEYS, "root");
  assertExactKeys(document.metadata, METADATA_KEYS, "metadata");
  const expectedMetadata = {
    schemaVersion: 3,
    scope: "reviewed-atomic-specimen-card-display-projections",
    catalogSchemaVersion: LOCKS.catalogSchemaVersion,
    sourceRecordCount: LOCKS.sourceRecordCount,
    sourceCatalogSha256: LOCKS.sourceCatalogSha256,
    projectionCount: LOCKS.projectionCount,
    atomicCardCount: LOCKS.atomicCardCount,
    sourceContextCardCount: LOCKS.sourceContextCardCount,
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
  let previousRecordIndex = -1;
  let atomicCardCount = 0;
  let massBoundCardCount = 0;
  let masslessCardCount = 0;
  let sourceContextCardCount = 0;

  for (const [projectionIndex, projection] of document.projections.entries()) {
    const location = `projections[${projectionIndex}]`;
    assertExactKeys(projection, PROJECTION_KEYS, location);
    if (typeof projection.parentRecordId !== "string" || !RECORD_ID.test(projection.parentRecordId)) fail(`${location}.parentRecordId is invalid`);
    if (seenParents.has(projection.parentRecordId)) fail(`${location}.parentRecordId is duplicated`);
    seenParents.add(projection.parentRecordId);
    const source = records.get(projection.parentRecordId);
    if (!source) fail(`${location}.parentRecordId is dangling`);
    if (source.index <= previousRecordIndex) fail("projections are not ordered by canonical parent order");
    previousRecordIndex = source.index;
    if (!Array.isArray(projection.cards) || projection.cards.length === 0) fail(`${location}.cards must be nonempty`);
    const recordModel = catalogModels.get(source.record.catalogId);
    if (!new Set(["catalog-item", "catalog-number", "collection-entry"]).has(recordModel)) fail(`${location} has unsupported record model ${recordModel}`);

    const seenMassPaths = new Set();
    const seenComponentPaths = new Set();
    const priorSpansByTextPath = new Map();
    let previousCard = null;
    for (const [cardIndex, card] of projection.cards.entries()) {
      const cardLocation = `${location}.cards[${cardIndex}]`;
      parseCard(card, source.record, recordModel, cardLocation);
      if (previousCard && compareCards(previousCard, card) >= 0) fail(`${location}.cards are not in canonical holding and evidence source order`);
      previousCard = card;
      if (card.clause) {
        const priorEnd = priorSpansByTextPath.get(card.clause.textPath);
        if (priorEnd !== undefined && card.clause.start < priorEnd) fail(`${cardLocation}.clause overlaps another card clause`);
        priorSpansByTextPath.set(card.clause.textPath, card.clause.end);
      } else {
        if (seenComponentPaths.has(card.componentPath)) fail(`${cardLocation}.componentPath is duplicated`);
        seenComponentPaths.add(card.componentPath);
      }
      if (card.massPath === null) {
        masslessCardCount++;
      } else {
        if (seenMassPaths.has(card.massPath)) fail(`${cardLocation}.massPath is duplicated`);
        seenMassPaths.add(card.massPath);
        massBoundCardCount++;
      }
    }
    atomicCardCount += projection.cards.length;
    const hasSourceContext = deriveSourceContext(projection, source.record, recordModel);
    if (hasSourceContext) sourceContextCardCount++;
    if (projection.cards.length + Number(hasSourceContext) < 2) fail(`${location} would produce fewer than two display units`);
  }

  if (atomicCardCount !== LOCKS.atomicCardCount) fail("atomic card count differs from metadata");
  if (sourceContextCardCount !== LOCKS.sourceContextCardCount) fail("derived source context count differs from metadata");
  const prior = document.projections.find(({ parentRecordId }) => parentRecordId === PRIOR_630_ID);
  const priorSource = records.get(PRIOR_630_ID);
  if (!prior || prior.cards.length !== 17 || prior.cards.filter(({ massPath }) => massPath !== null).length !== 12 ||
      prior.cards.filter(({ massPath }) => massPath === null).length !== 5 ||
      !deriveSourceContext(prior, priorSource.record, catalogModels.get(priorSource.record.catalogId)) ||
      sha256(JSON.stringify(prior.cards)) !== PRIOR_630_CARDS_SHA256) {
    fail("Prior entry 630 exact 17-card plus context lock is missing or malformed");
  }
  const reeds = document.projections.find(({ parentRecordId }) => parentRecordId === REEDS_366_ID);
  const reedsSource = records.get(REEDS_366_ID);
  if (!reeds || reeds.cards.length !== 10 || deriveSourceContext(reeds, reedsSource.record, catalogModels.get(reedsSource.record.catalogId))) {
    fail("Reeds entry 366 ten-card no-context lock is missing or malformed");
  }
  for (const [index, card] of reeds.cards.entries()) {
    const text = reedsSource.record.holdings[index]?.description;
    if (card.holdingPath !== `holdings[${index}]` || card.clause.textPath !== `holdings[${index}].description` ||
        card.clause.start !== 0 || card.clause.end !== text?.length || card.massPath !== `holdings[${index}].weights[0].grams`) {
      fail("Reeds entry 366 cards are not full ordered holding clauses");
    }
  }
  const madridRecords = catalog.records.filter(({ catalogId }) => catalogId === "madrid-1923");
  const madridIds = new Set(madridRecords.map(({ id }) => id));
  const madridProjections = document.projections.filter(({ parentRecordId }) => madridIds.has(parentRecordId));
  const madridProjectionById = new Map(madridProjections.map((projection) => [projection.parentRecordId, projection]));
  let madridHoldingCount = 0;
  let madridAtomicCardCount = 0;
  let madridGroupedContextHoldingCount = 0;
  let madridSourceContextCardCount = 0;
  for (const record of madridRecords) {
    madridHoldingCount += record.holdings.length;
    const projection = madridProjectionById.get(record.id);
    if (record.holdings.length === 1) {
      if (projection) fail(`Madrid one-holding parent ${record.id} must remain an unprojected parent card`);
      continue;
    }
    if (!projection) fail(`Madrid multi-holding parent ${record.id} is missing its atomic projection`);
    const expectedCards = [];
    for (const [holdingIndex, holding] of record.holdings.entries()) {
      if (holding.description === "Specimen") {
        if (holding.count !== 1 || holding.weights.length !== 1 || !Number.isFinite(holding.weights[0]?.grams)) {
          fail(`Madrid controlled specimen holding ${record.id}:${holdingIndex} is malformed`);
        }
        expectedCards.push({
          holdingPath: `holdings[${holdingIndex}]`,
          clause: { textPath: `holdings[${holdingIndex}].description`, start: 0, end: holding.description.length },
          massPath: `holdings[${holdingIndex}].weights[0].grams`,
        });
      } else if (holding.description === "Specimen group") {
        madridGroupedContextHoldingCount++;
      } else {
        fail(`Madrid holding ${record.id}:${holdingIndex} is outside the controlled specimen vocabulary`);
      }
    }
    if (JSON.stringify(projection.cards) !== JSON.stringify(expectedCards)) {
      fail(`Madrid atomic paths differ from the controlled specimen holdings for ${record.id}`);
    }
    madridAtomicCardCount += projection.cards.length;
    madridSourceContextCardCount += Number(deriveSourceContext(projection, record, "collection-entry"));
  }
  const madridActual = {
    parentObservationCount: madridRecords.length,
    holdingCount: madridHoldingCount,
    continuationHoldingCount: madridHoldingCount - madridRecords.length,
    projectedParentCount: madridProjections.length,
    atomicCardCount: madridAtomicCardCount,
    groupedSourceContextHoldingCount: madridGroupedContextHoldingCount,
    sourceContextCardCount: madridSourceContextCardCount,
    projectionSetSha256: sha256(JSON.stringify(madridProjections)),
  };
  for (const [key, expected] of Object.entries(MADRID_AUDIT_COVERAGE)) {
    if (madridActual[key] !== expected) fail(`Madrid ${key} differs from the reviewed audit lock`);
  }
  const hamburgRecords = catalog.records.filter(({ catalogId }) => catalogId === "hamburg-1913");
  const hamburgIds = new Set(hamburgRecords.map(({ id }) => id));
  const hamburgProjections = document.projections.filter(({ parentRecordId }) => hamburgIds.has(parentRecordId));
  const hamburgProjectionById = new Map(hamburgProjections.map((projection) => [projection.parentRecordId, projection]));
  let hamburgHoldingCount = 0;
  let hamburgComponentWeightCount = 0;
  let hamburgIndividualHoldingComponentCount = 0;
  let hamburgAggregateHoldingComponentCount = 0;
  let hamburgAssociatedMaterialComponentCount = 0;
  let hamburgAtomicCardCount = 0;
  let hamburgContextOnlyObservationCount = 0;
  let hamburgMultiCardParentCount = 0;
  let hamburgSourceContextCardCount = 0;
  let hamburgThinSectionCount = 0;
  for (const record of hamburgRecords) {
    hamburgHoldingCount += record.holdings.length;
    hamburgComponentWeightCount += record.holdings.reduce((count, holding) => count + holding.weights.length, 0);
    hamburgThinSectionCount += record.holdings.flatMap(({ representations }) => representations)
      .reduce((count, representation) => count + representation.count, 0);
    const projection = hamburgProjectionById.get(record.id);
    const expectedCards = [];
    for (const [holdingIndex, holding] of record.holdings.entries()) {
      for (const [componentIndex, component] of holding.weights.entries()) {
        if (component.kind === "individual-holding") {
          hamburgIndividualHoldingComponentCount++;
          expectedCards.push({
            holdingPath: `holdings[${holdingIndex}]`,
            componentPath: `holdings[${holdingIndex}].weights[${componentIndex}]`,
            massPath: `holdings[${holdingIndex}].weights[${componentIndex}].grams`,
          });
        } else if (component.kind === "aggregate-holding") {
          hamburgAggregateHoldingComponentCount++;
        } else if (component.kind === "associated-material") {
          hamburgAssociatedMaterialComponentCount++;
        } else {
          fail(`Hamburg component ${record.id}:${holdingIndex}:${componentIndex} has an unsupported kind`);
        }
      }
    }
    if (expectedCards.length === 0) {
      hamburgContextOnlyObservationCount++;
      if (projection) fail(`Hamburg context-only parent ${record.id} must not have an atomic projection`);
      continue;
    }
    if (!projection) fail(`Hamburg audited component parent ${record.id} is missing its projection`);
    if (JSON.stringify(projection.cards) !== JSON.stringify(expectedCards)) {
      fail(`Hamburg atomic component paths differ from the reviewed public holdings for ${record.id}`);
    }
    if (!deriveSourceContext(projection, record, "collection-entry")) {
      fail(`Hamburg component parent ${record.id} must retain its source context`);
    }
    hamburgAtomicCardCount += expectedCards.length;
    hamburgMultiCardParentCount += Number(expectedCards.length > 1);
    hamburgSourceContextCardCount++;
  }
  const hamburgActual = {
    parentObservationCount: hamburgRecords.length,
    holdingCount: hamburgHoldingCount,
    componentWeightCount: hamburgComponentWeightCount,
    individualHoldingComponentCount: hamburgIndividualHoldingComponentCount,
    aggregateHoldingComponentCount: hamburgAggregateHoldingComponentCount,
    associatedMaterialComponentCount: hamburgAssociatedMaterialComponentCount,
    projectedParentCount: hamburgProjections.length,
    contextOnlyObservationCount: hamburgContextOnlyObservationCount,
    atomicCardCount: hamburgAtomicCardCount,
    multiCardParentCount: hamburgMultiCardParentCount,
    sourceContextCardCount: hamburgSourceContextCardCount,
    thinSectionCount: hamburgThinSectionCount,
    projectionSetSha256: sha256(JSON.stringify(hamburgProjections)),
  };
  for (const [key, expected] of Object.entries(HAMBURG_AUDIT_COVERAGE)) {
    if (hamburgActual[key] !== expected) fail(`Hamburg ${key} differs from the reviewed audit lock`);
  }
  const nonHamburgProjections = document.projections.filter(({ parentRecordId }) => !hamburgIds.has(parentRecordId));
  if (sha256(JSON.stringify(nonHamburgProjections)) !== LOCKS.nonHamburgProjectionSetSha256) {
    fail("non-Hamburg projection set differs from the schema-2 production lock");
  }
  if (sha256(JSON.stringify(document.projections)) !== LOCKS.projectionSetSha256) fail("projection set differs from the reviewed production lock");

  return {
    projectionCount: document.projections.length,
    atomicCardCount,
    massBoundCardCount,
    masslessCardCount,
    sourceContextCardCount,
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
  console.log(`validated ${result.projectionCount} atomic specimen-card projections (${result.atomicCardCount} atomic cards, ${result.sourceContextCardCount} non-displayed context audit partitions)`);
}
