import { createHash } from "node:crypto";
import { isIP } from "node:net";

export const UUID_NAMESPACE = "65b19e0b-1f86-5ca5-a65b-81c38ec53040";
export const COLLECTION_SERIES = Object.freeze([
  Object.freeze({ id: "huss", catalogIds: Object.freeze(["huss-1976", "huss-1986"]) }),
  Object.freeze({ id: "nininger", catalogIds: Object.freeze(["nininger-1933", "nininger-1950"]) }),
]);
export const FACT_CODE_ORDER = [
  "shared-metbull-code",
  "shared-normalized-source-name",
  "exact-reported-mass",
  "near-reported-mass",
  "same-designation",
  "designation-family",
];
export const CAUTION_CODE_ORDER = [
  "normalized-name-identity",
  "near-reported-mass",
  "designation-differs-or-missing",
  "aggregate-or-multiple",
  "cast",
];
export const EVIDENCE_STRENGTH_ORDER = [
  "multiple-matching-facts",
  "two-matching-facts",
  "limited-matching-evidence",
];
export const EMPTY_REVIEW_SOURCE = Object.freeze({ schemaVersion: 1, reviews: Object.freeze([]) });

const ROOT_KEYS = ["metadata", "relationships"];
const METADATA_KEYS = ["schemaVersion", "scope", "source", "collectionSeries", "methodology", "counts"];
const SOURCE_KEYS = ["catalogSchemaVersion", "recordCount", "catalogCount", "flattenedMassObservationCount", "inventoryObservationCount"];
const SERIES_KEYS = ["id", "catalogIds"];
const METHODOLOGY_KEYS = ["inventoryNormalization", "possibleMatchIdentity", "massThresholds", "ambiguityPolicy", "evidenceStrengthOrder", "nonAssertions"];
const INVENTORY_NORMALIZATION_KEYS = ["unicode", "case", "whitespace", "hussEditionMarker"];
const POSSIBLE_IDENTITY_KEYS = ["resolved", "unresolved"];
const MASS_THRESHOLD_KEYS = ["exactDifferenceGrams", "nearMinimumMassGrams", "nearMaximumRelativeDifference", "nearMaximumAbsoluteDifferenceGrams"];
const COUNT_KEYS = [
  "relationshipCount", "sameInventoryRelationshipCount", "possibleMatchRelationshipCount", "unreviewedPossibleMatchCount",
  "exactMassPossibleMatchCount", "nearMassPossibleMatchCount", "metbullIdentityPossibleMatchCount", "normalizedNameIdentityPossibleMatchCount",
  "sameDesignationPossibleMatchCount", "designationFamilyPossibleMatchCount", "aggregateOrMultiplePossibleMatchCount", "castPossibleMatchCount",
  "identityResolvedInventoryCollisionCount", "omittedAmbiguousInventoryKeyCount", "possibleMatchEvidenceStrength", "catalogPairs",
];
const STRENGTH_COUNT_KEYS = EVIDENCE_STRENGTH_ORDER;
const PAIR_COUNT_KEYS = ["catalogPair", "sameInventoryCount", "possibleMatchCount"];
const RELATIONSHIP_KEYS = ["id", "relationship", "basis", "status", "displayName", "catalogPair", "collectionSeries", "identity", "evidence", "review", "observations"];
const COLLECTION_SERIES_KEYS = ["id", "inventoryId"];
const IDENTITY_KEYS = ["method", "key", "canonicalName"];
const EVIDENCE_KEYS = [
  "strength", "massMatch", "absoluteDifferenceGrams", "relativeDifference", "sameDesignation", "designationFamily", "factCodes", "cautionCodes",
];
const REVIEW_KEYS = ["status", "outcome", "reviewedOn", "publicNote", "citations"];
const REVIEW_SOURCE_ROOT_KEYS = ["schemaVersion", "reviews"];
const REVIEW_SOURCE_RECORD_KEYS = ["candidateId", "outcome", "reviewedOn", "publicNote", "citations"];
const CITATION_KEYS = ["label", "url"];
const OBSERVATION_KEYS = [
  "id", "recordId", "catalogId", "catalogLabel", "catalogYear", "recordModel", "designationPath", "massPath", "sourceRecordLabel",
  "sourceName", "canonicalName", "meteoriteCode", "designation", "massGrams", "kind", "count", "catalogSearchUrl",
];
const PRIVATE_MARKER = /\b(?:reviewer|checksum|raw\s+ocr|private\s+(?:path|note)|source\s+(?:path|file(?:name)?))\b/iu;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const UUID_V5_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function namespaceBytes(uuid) {
  assert(UUID_PATTERN.test(uuid), `invalid UUID namespace: ${uuid}`);
  return Buffer.from(uuid.replaceAll("-", ""), "hex");
}

export function uuidV5(name, namespace = UUID_NAMESPACE) {
  const bytes = createHash("sha1").update(namespaceBytes(namespace)).update(String(name), "utf8").digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function normalizeSourceName(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

export function normalizeInventoryId(value, seriesId) {
  let normalized = String(value).normalize("NFKC").toLocaleLowerCase("en-US").replace(/\s+/gu, "");
  if (seriesId === "huss") normalized = normalized.replace(/^\(2\)/u, "");
  return normalized;
}

function normalizeDesignation(value) {
  return value === null ? null : value.toLowerCase();
}

function normalizeDesignationFamily(value) {
  return value === null ? null : value.replace(/^\(2\)/u, "").toLowerCase();
}

function normalizeCollisionName(value) {
  return normalizeSourceName(value)
    .replace(/\b(?:mt|mts)\b/gu, "mountains")
    .replace(/\bco\b/gu, "county");
}

function sourceRecordLabel(record, model) {
  if (model === "catalog-item") return `Catalog item ${record.catalogItem}`;
  if (model === "catalog-number") return `Catalog no. ${record.catalogNumber}`;
  if (model === "collection-entry") return `Collection entry ${record.entryOrder}`;
  return record.designation ?? record.name;
}

function catalogSearchUrl(catalogId, recordId) {
  return `./index.html?catalog=${encodeURIComponent(catalogId)}&q=${encodeURIComponent(`record id ${recordId}`)}#catalog`;
}

function endpointReference(recordId, path) {
  return `${recordId}\u0000${path}`;
}

function identityFields(record) {
  assert(record.metbull !== null && typeof record.metbull === "object", `${record.id} must have a reviewed MetBull mapping`);
  const unresolved = record.metbull.matchType === "unresolved";
  if (!unresolved) {
    assert(typeof record.metbull.meteoriteCode === "string" && record.metbull.meteoriteCode.length > 0, `${record.id} resolved MetBull mapping must have a code`);
    assert(typeof record.metbull.canonicalName === "string" && record.metbull.canonicalName.length > 0, `${record.id} resolved MetBull mapping must have a canonical name`);
  }
  const normalizedName = record.name === null ? null : normalizeSourceName(record.name);
  return {
    identityMethod: unresolved ? "normalized-source-name" : "metbull-code",
    identityKey: unresolved ? (normalizedName || null) : record.metbull.meteoriteCode,
    canonicalName: unresolved ? null : record.metbull.canonicalName,
    meteoriteCode: unresolved ? null : record.metbull.meteoriteCode,
  };
}

function makeObservation(record, descriptor, { designation, designationPath, massGrams, massPath, kind = null, count = null }) {
  const identity = identityFields(record);
  const label = sourceRecordLabel(record, descriptor.recordModel);
  assert(typeof label === "string" && label.length > 0, `${record.id} cannot produce a source record label`);
  return {
    ...identity,
    sourceReference: endpointReference(record.id, massPath ?? designationPath),
    public: {
      recordId: record.id,
      catalogId: record.catalogId,
      catalogLabel: descriptor.label,
      catalogYear: descriptor.year,
      recordModel: descriptor.recordModel,
      designationPath,
      massPath,
      sourceRecordLabel: label,
      sourceName: record.name,
      canonicalName: identity.canonicalName,
      meteoriteCode: identity.meteoriteCode,
      designation,
      massGrams,
      kind,
      count,
      catalogSearchUrl: catalogSearchUrl(record.catalogId, record.id),
    },
  };
}

function catalogDescriptors(catalog) {
  assert(catalog?.metadata?.schemaVersion === 7, "catalog metadata schemaVersion must be 7");
  assert(Array.isArray(catalog.metadata.catalogs), "catalog metadata catalogs must be an array");
  assert(Array.isArray(catalog.records), "catalog records must be an array");
  const descriptors = new Map(catalog.metadata.catalogs.map((descriptor) => [descriptor.id, descriptor]));
  assert(descriptors.size === catalog.metadata.catalogs.length, "catalog descriptor IDs must be unique");
  return descriptors;
}

export function flattenMassObservations(catalog) {
  const descriptors = catalogDescriptors(catalog);
  const observations = [];
  const add = (record, descriptor, details) => {
    if (Number.isFinite(details.massGrams)) observations.push(makeObservation(record, descriptor, details));
  };
  for (const record of catalog.records) {
    const descriptor = descriptors.get(record.catalogId);
    assert(descriptor, `record ${record.id} refers to unknown catalog ${record.catalogId}`);
    if (!record.metbull || typeof record.metbull !== "object") continue;
    if (descriptor.recordModel === "specimen") {
      add(record, descriptor, { designation: record.designation ?? null, designationPath: record.designation === null ? null : "designation", massGrams: record.weight?.grams, massPath: "weight.grams" });
    } else if (descriptor.recordModel === "catalog-item") {
      record.holdings.forEach((holding, index) => add(record, descriptor, {
        designation: holding.designation,
        designationPath: holding.designation === null ? null : `holdings[${index}].designation`,
        massGrams: holding.weight?.grams,
        massPath: `holdings[${index}].weight.grams`,
        kind: holding.kind,
        count: holding.count,
      }));
    } else if (descriptor.recordModel === "catalog-number" || descriptor.recordModel === "collection-entry") {
      record.holdings.forEach((holding, holdingIndex) => holding.weights.forEach((weight, weightIndex) => {
        if (weight.kind !== undefined && weight.kind !== "individual-holding") return;
        add(record, descriptor, {
          designation: null,
          designationPath: null,
          massGrams: weight.grams,
          massPath: `holdings[${holdingIndex}].weights[${weightIndex}].grams`,
          count: holding.count,
        });
      }));
    } else {
      throw new Error(`unknown record model for ${record.id}: ${descriptor.recordModel}`);
    }
  }
  return observations;
}

export function flattenInventoryObservations(catalog, collectionSeries = COLLECTION_SERIES) {
  const descriptors = catalogDescriptors(catalog);
  const seriesByCatalog = new Map();
  for (const series of collectionSeries) {
    for (const catalogId of series.catalogIds) {
      assert(!seriesByCatalog.has(catalogId), `catalog ${catalogId} belongs to more than one collection series`);
      assert(descriptors.has(catalogId), `collection series ${series.id} refers to unknown catalog ${catalogId}`);
      seriesByCatalog.set(catalogId, series.id);
    }
  }
  const observations = [];
  for (const record of catalog.records) {
    const seriesId = seriesByCatalog.get(record.catalogId);
    if (!seriesId) continue;
    const descriptor = descriptors.get(record.catalogId);
    const add = (details) => {
      if (typeof details.designation !== "string" || details.designation.length === 0) return;
      const observation = makeObservation(record, descriptor, details);
      observation.sourceReference = endpointReference(record.id, details.designationPath);
      observation.seriesId = seriesId;
      observation.inventoryId = normalizeInventoryId(details.designation, seriesId);
      observations.push(observation);
    };
    if (descriptor.recordModel === "specimen") {
      add({ designation: record.designation, designationPath: "designation", massGrams: record.weight?.grams ?? null, massPath: "weight.grams" });
    } else if (descriptor.recordModel === "catalog-item") {
      record.holdings.forEach((holding, index) => add({
        designation: holding.designation,
        designationPath: `holdings[${index}].designation`,
        massGrams: holding.weight?.grams ?? null,
        massPath: `holdings[${index}].weight.grams`,
        kind: holding.kind,
        count: holding.count,
      }));
    }
  }
  return observations;
}

function identityGroupKey(observation) {
  return observation.identityKey === null ? null : `${observation.identityMethod}:${observation.identityKey}`;
}

function candidateStrength(sameDesignation, designationFamily, massMatch) {
  if (sameDesignation || designationFamily) return "multiple-matching-facts";
  if (massMatch === "exact") return "two-matching-facts";
  return "limited-matching-evidence";
}

function orderedCodes(codes, order) {
  return order.filter((code) => codes.has(code));
}

function publicObservations(observations, candidateReference, type) {
  const prefix = type === "possible" ? "mass-observation" : "inventory-observation";
  return observations.map((observation) => ({
    id: `${prefix}-${uuidV5(`${prefix}\u0000${candidateReference}\u0000${observation.sourceReference}`)}`,
    ...observation.public,
  })).sort((left, right) => compareText(left.id, right.id));
}

function possibleRelationship(left, right) {
  const observations = [left, right].sort((a, b) => compareText(a.sourceReference, b.sourceReference));
  const [a, b] = observations;
  const absoluteDifferenceGrams = Math.abs(a.public.massGrams - b.public.massGrams);
  const maximumMass = Math.max(a.public.massGrams, b.public.massGrams);
  const relativeDifference = maximumMass === 0 ? 0 : absoluteDifferenceGrams / maximumMass;
  const massMatch = absoluteDifferenceGrams === 0 ? "exact" : "near";
  const aDesignation = normalizeDesignation(a.public.designation);
  const bDesignation = normalizeDesignation(b.public.designation);
  const sameDesignation = aDesignation !== null && bDesignation !== null && aDesignation === bDesignation;
  const aFamily = normalizeDesignationFamily(a.public.designation);
  const bFamily = normalizeDesignationFamily(b.public.designation);
  const designationFamily = aFamily !== null && bFamily !== null && aFamily === bFamily;
  const aggregateOrMultiple = observations.some(({ public: item }) => item.kind === "aggregate" || (item.count ?? 1) > 1);
  const cast = observations.some(({ public: item }) => item.kind === "cast");
  const facts = new Set([
    a.identityMethod === "metbull-code" ? "shared-metbull-code" : "shared-normalized-source-name",
    massMatch === "exact" ? "exact-reported-mass" : "near-reported-mass",
  ]);
  if (sameDesignation) facts.add("same-designation");
  if (designationFamily) facts.add("designation-family");
  const cautions = new Set();
  if (a.identityMethod === "normalized-source-name") cautions.add("normalized-name-identity");
  if (massMatch === "near") cautions.add("near-reported-mass");
  if (!sameDesignation) cautions.add("designation-differs-or-missing");
  if (aggregateOrMultiple) cautions.add("aggregate-or-multiple");
  if (cast) cautions.add("cast");
  const catalogPair = [a.public.catalogId, b.public.catalogId].sort(compareText).join("|");
  const candidateReference = observations.map(({ sourceReference }) => sourceReference).sort(compareText).join("\u0001");
  const canonicalName = a.public.canonicalName ?? b.public.canonicalName;
  return {
    id: `possible-lineage-${uuidV5(`possible-lineage\u0000${candidateReference}`)}`,
    relationship: "possible-match",
    basis: "reviewed-identity-and-reported-mass",
    status: "possible",
    displayName: canonicalName ?? [a.public.sourceName, b.public.sourceName].filter(Boolean).sort(compareText)[0],
    catalogPair,
    collectionSeries: null,
    identity: { method: a.identityMethod, key: a.identityKey, canonicalName },
    evidence: {
      strength: candidateStrength(sameDesignation, designationFamily, massMatch),
      massMatch,
      absoluteDifferenceGrams,
      relativeDifference,
      sameDesignation,
      designationFamily,
      factCodes: orderedCodes(facts, FACT_CODE_ORDER),
      cautionCodes: orderedCodes(cautions, CAUTION_CODE_ORDER),
    },
    review: { status: "unreviewed", outcome: null, reviewedOn: null, publicNote: null, citations: [] },
    observations: publicObservations(observations, candidateReference, "possible"),
  };
}

function collisionNames(observation) {
  return new Set([observation.public.sourceName, observation.public.canonicalName].filter(Boolean).map(normalizeCollisionName));
}

function collisionIdentityConsistent(left, right) {
  if (left.public.meteoriteCode !== null && right.public.meteoriteCode !== null) {
    return left.public.meteoriteCode === right.public.meteoriteCode;
  }
  const leftNames = collisionNames(left);
  return [...collisionNames(right)].some((name) => leftNames.has(name));
}

function sameInventoryRelationship(left, right, seriesId, inventoryId) {
  const observations = [left, right].sort((a, b) => compareText(a.sourceReference, b.sourceReference));
  const candidateReference = observations.map(({ sourceReference }) => sourceReference).sort(compareText).join("\u0001");
  const canonicalName = observations.map(({ public: item }) => item.canonicalName).find(Boolean);
  return {
    id: `same-inventory-lineage-${uuidV5(`same-inventory-lineage\u0000${seriesId}\u0000${inventoryId}\u0000${candidateReference}`)}`,
    relationship: "same-inventory",
    basis: "series-scoped-normalized-inventory-id",
    status: "established",
    displayName: canonicalName ?? observations.map(({ public: item }) => item.sourceName).filter(Boolean).sort(compareText)[0],
    catalogPair: observations.map(({ public: item }) => item.catalogId).sort(compareText).join("|"),
    collectionSeries: { id: seriesId, inventoryId },
    identity: null,
    evidence: null,
    review: null,
    observations: publicObservations(observations, candidateReference, "inventory"),
  };
}

function buildSameInventoryRelationships(inventoryObservations, collectionSeries) {
  const byCatalog = Map.groupBy(inventoryObservations, (observation) => observation.public.catalogId);
  const relationships = [];
  let identityResolvedInventoryCollisionCount = 0;
  let omittedAmbiguousInventoryKeyCount = 0;
  for (const series of collectionSeries) {
    for (let index = 1; index < series.catalogIds.length; index += 1) {
      const earlier = Map.groupBy(byCatalog.get(series.catalogIds[index - 1]) ?? [], (observation) => observation.inventoryId);
      const later = Map.groupBy(byCatalog.get(series.catalogIds[index]) ?? [], (observation) => observation.inventoryId);
      for (const [inventoryId, earlierEndpoints] of earlier) {
        const laterEndpoints = later.get(inventoryId);
        if (!laterEndpoints) continue;
        let pair;
        if (earlierEndpoints.length === 1 && laterEndpoints.length === 1) {
          pair = [earlierEndpoints[0], laterEndpoints[0]];
        } else {
          const consistentPairs = earlierEndpoints.flatMap((left) => laterEndpoints
            .filter((right) => collisionIdentityConsistent(left, right))
            .map((right) => [left, right]));
          if (consistentPairs.length === 1) {
            pair = consistentPairs[0];
            identityResolvedInventoryCollisionCount += 1;
          } else {
            omittedAmbiguousInventoryKeyCount += 1;
            continue;
          }
        }
        relationships.push(sameInventoryRelationship(pair[0], pair[1], series.id, inventoryId));
      }
    }
  }
  return { relationships, identityResolvedInventoryCollisionCount, omittedAmbiguousInventoryKeyCount };
}

function countBy(items, keyFunction) {
  const result = new Map();
  for (const item of items) {
    const key = keyFunction(item);
    result.set(key, (result.get(key) ?? 0) + 1);
  }
  return result;
}

export function isRealCalendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1000) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.getUTCFullYear() === year && parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === day;
}

export function isSafeHttpsUrl(value) {
  if (typeof value !== "string" || value.length > 1000 || !value.startsWith("https://") || /[\s\u0000-\u001f\u007f]/u.test(value)) return false;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" || parsed.username !== "" || parsed.password !== "" || parsed.hostname === "") return false;
  const canonicalHostname = parsed.hostname.startsWith("[") && parsed.hostname.endsWith("]") ? parsed.hostname.slice(1, -1) : parsed.hostname;
  if (isIP(canonicalHostname) !== 0) return false;
  const labels = parsed.hostname.split(".");
  return labels.length >= 2 && labels.every((label) => label.length >= 1 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/iu.test(label));
}

function isPublicNote(value) {
  return value === null || (typeof value === "string" && value.length <= 1000 && value === value.normalize("NFC") && !/[\p{Cc}\p{Cf}]/u.test(value));
}

function validateCitation(citation, path) {
  assertExactKeys(citation, CITATION_KEYS, path);
  assert(typeof citation.label === "string" && citation.label.length <= 200 && citation.label.trim().length > 0 && citation.label === citation.label.normalize("NFC") && !/[\p{Cc}\p{Cf}]/u.test(citation.label), `${path}.label must be nonempty safe public text`);
  assert(isSafeHttpsUrl(citation.url), `${path}.url must be a safe HTTPS URL with a real hostname and no credentials`);
}

export function validateReviewSource(reviewSource, candidateIds = null) {
  assertExactKeys(reviewSource, REVIEW_SOURCE_ROOT_KEYS, "review source");
  assert(reviewSource.schemaVersion === 1, "review source schemaVersion must be 1");
  assert(Array.isArray(reviewSource.reviews), "review source reviews must be an array");
  const seen = new Set();
  for (const [index, review] of reviewSource.reviews.entries()) {
    const path = `review source reviews[${index}]`;
    assertExactKeys(review, REVIEW_SOURCE_RECORD_KEYS, path);
    assert(review.candidateId.startsWith("possible-lineage-") && UUID_V5_PATTERN.test(review.candidateId.slice("possible-lineage-".length)), `${path}.candidateId is invalid`);
    assert(!seen.has(review.candidateId), `${path}.candidateId is duplicated: ${review.candidateId}`);
    seen.add(review.candidateId);
    if (candidateIds !== null) assert(candidateIds.has(review.candidateId), `${path}.candidateId is dangling: ${review.candidateId}`);
    assertEnum(review.outcome, ["retain-as-possible", "not-supported"], `${path}.outcome`);
    assert(isRealCalendarDate(review.reviewedOn), `${path}.reviewedOn must be a real ISO calendar date`);
    assert(isPublicNote(review.publicNote), `${path}.publicNote must be null or safe public text`);
    assert(Array.isArray(review.citations), `${path}.citations must be an array`);
    review.citations.forEach((citation, citationIndex) => validateCitation(citation, `${path}.citations[${citationIndex}]`));
  }
  inspectPrivateMarkers(reviewSource, "review source");
  return true;
}

function applyReviewSource(relationships, reviewSource) {
  const possible = relationships.filter(({ relationship }) => relationship === "possible-match");
  const candidateIds = new Set(possible.map(({ id }) => id));
  validateReviewSource(reviewSource, candidateIds);
  const candidatesById = new Map(possible.map((candidate) => [candidate.id, candidate]));
  for (const review of reviewSource.reviews) {
    candidatesById.get(review.candidateId).review = {
      status: "reviewed",
      outcome: review.outcome,
      reviewedOn: review.reviewedOn,
      publicNote: review.publicNote,
      citations: review.citations.map(({ label, url }) => ({ label, url })),
    };
  }
}

export function buildSpecimenLineages(catalog, reviewSource = EMPTY_REVIEW_SOURCE, collectionSeries = COLLECTION_SERIES) {
  const massObservations = flattenMassObservations(catalog);
  const inventoryObservations = flattenInventoryObservations(catalog, collectionSeries);
  const catalogNamespace = new Map(catalog.metadata.catalogs.map(({ id }) => [id, id]));
  collectionSeries.forEach((series) => series.catalogIds.forEach((catalogId) => catalogNamespace.set(catalogId, `series:${series.id}`)));
  const grouped = Map.groupBy(massObservations.filter((item) => identityGroupKey(item) !== null), identityGroupKey);
  const possibleRelationships = [];
  for (const group of grouped.values()) {
    for (let leftIndex = 0; leftIndex < group.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < group.length; rightIndex += 1) {
        const left = group[leftIndex];
        const right = group[rightIndex];
        if (left.public.catalogId === right.public.catalogId || catalogNamespace.get(left.public.catalogId) === catalogNamespace.get(right.public.catalogId)) continue;
        const absoluteDifference = Math.abs(left.public.massGrams - right.public.massGrams);
        const maximumMass = Math.max(left.public.massGrams, right.public.massGrams);
        const relativeDifference = maximumMass === 0 ? 0 : absoluteDifference / maximumMass;
        const exact = absoluteDifference === 0;
        const near = Math.min(left.public.massGrams, right.public.massGrams) >= 10 && absoluteDifference <= 2 && relativeDifference <= 0.0025;
        if (exact || near) possibleRelationships.push(possibleRelationship(left, right));
      }
    }
  }
  const inventoryResult = buildSameInventoryRelationships(inventoryObservations, collectionSeries);
  const relationships = [...possibleRelationships, ...inventoryResult.relationships].sort((a, b) => compareText(a.id, b.id));
  assert(new Set(relationships.map(({ id }) => id)).size === relationships.length, "generated relationship IDs must be unique");
  applyReviewSource(relationships, reviewSource);
  const possible = relationships.filter(({ relationship }) => relationship === "possible-match");
  const sameInventory = relationships.filter(({ relationship }) => relationship === "same-inventory");
  const strengthCounts = countBy(possible, (relationship) => relationship.evidence.strength);
  const pairCounts = new Map();
  relationships.forEach((relationship) => {
    const counts = pairCounts.get(relationship.catalogPair) ?? { sameInventoryCount: 0, possibleMatchCount: 0 };
    counts[relationship.relationship === "same-inventory" ? "sameInventoryCount" : "possibleMatchCount"] += 1;
    pairCounts.set(relationship.catalogPair, counts);
  });
  const count = (items, predicate) => items.filter(predicate).length;
  return {
    metadata: {
      schemaVersion: 2,
      scope: "series-inventory-and-cross-source-candidates",
      source: {
        catalogSchemaVersion: catalog.metadata.schemaVersion,
        recordCount: catalog.records.length,
        catalogCount: catalog.metadata.catalogs.length,
        flattenedMassObservationCount: massObservations.length,
        inventoryObservationCount: inventoryObservations.length,
      },
      collectionSeries: collectionSeries.map(({ id, catalogIds }) => ({ id, catalogIds: [...catalogIds] })),
      methodology: {
        inventoryNormalization: { unicode: "NFKC", case: "lowercase", whitespace: "removed", hussEditionMarker: "one leading (2) removed" },
        possibleMatchIdentity: {
          resolved: "Records in different collection namespaces share the same reviewed Meteoritical Bulletin meteorite code.",
          unresolved: "Only unresolved records in different collection namespaces share an NFKD, diacritic-free, lowercase source name with non-alphanumeric runs collapsed to spaces.",
        },
        massThresholds: { exactDifferenceGrams: 0, nearMinimumMassGrams: 10, nearMaximumRelativeDifference: 0.0025, nearMaximumAbsoluteDifferenceGrams: 2 },
        ambiguityPolicy: "A duplicated normalized inventory key is linked only when exactly one endpoint pair is identity-consistent; otherwise the key is omitted.",
        evidenceStrengthOrder: EVIDENCE_STRENGTH_ORDER,
        nonAssertions: ["custody-chain", "ownership-transfer"],
      },
      counts: {
        relationshipCount: relationships.length,
        sameInventoryRelationshipCount: sameInventory.length,
        possibleMatchRelationshipCount: possible.length,
        unreviewedPossibleMatchCount: count(possible, (item) => item.review.status === "unreviewed"),
        exactMassPossibleMatchCount: count(possible, (item) => item.evidence.massMatch === "exact"),
        nearMassPossibleMatchCount: count(possible, (item) => item.evidence.massMatch === "near"),
        metbullIdentityPossibleMatchCount: count(possible, (item) => item.identity.method === "metbull-code"),
        normalizedNameIdentityPossibleMatchCount: count(possible, (item) => item.identity.method === "normalized-source-name"),
        sameDesignationPossibleMatchCount: count(possible, (item) => item.evidence.sameDesignation),
        designationFamilyPossibleMatchCount: count(possible, (item) => item.evidence.designationFamily),
        aggregateOrMultiplePossibleMatchCount: count(possible, (item) => item.evidence.cautionCodes.includes("aggregate-or-multiple")),
        castPossibleMatchCount: count(possible, (item) => item.evidence.cautionCodes.includes("cast")),
        identityResolvedInventoryCollisionCount: inventoryResult.identityResolvedInventoryCollisionCount,
        omittedAmbiguousInventoryKeyCount: inventoryResult.omittedAmbiguousInventoryKeyCount,
        possibleMatchEvidenceStrength: Object.fromEntries(EVIDENCE_STRENGTH_ORDER.map((strength) => [strength, strengthCounts.get(strength) ?? 0])),
        catalogPairs: [...pairCounts].sort(([a], [b]) => compareText(a, b)).map(([catalogPair, counts]) => ({ catalogPair, ...counts })),
      },
    },
    relationships,
  };
}

export function serializeSpecimenLineages(document) {
  return `${JSON.stringify(document, null, 2)}\n`;
}

function assertExactKeys(value, expected, path) {
  assert(value !== null && typeof value === "object" && !Array.isArray(value), `${path} must be an object`);
  const actual = Object.keys(value);
  assert(actual.length === expected.length && expected.every((key) => Object.hasOwn(value, key)), `${path} must have exactly keys: ${expected.join(", ")}`);
}

function assertEnum(value, values, path) {
  assert(values.includes(value), `${path} must be one of: ${values.join(", ")}`);
}

function assertFiniteNonnegative(value, path, nullable = false) {
  if (nullable && value === null) return;
  assert(Number.isFinite(value) && value >= 0, `${path} must be a finite nonnegative number${nullable ? " or null" : ""}`);
}

function assertCanonicalSubset(values, order, path) {
  assert(Array.isArray(values) && new Set(values).size === values.length, `${path} must be a unique array`);
  assert(values.every((value) => order.includes(value)), `${path} has an unsupported code`);
  assert(values.every((value, index) => index === 0 || order.indexOf(values[index - 1]) < order.indexOf(value)), `${path} is not canonically ordered`);
}

function inspectPrivateMarkers(value, path = "root") {
  if (typeof value === "string") assert(!PRIVATE_MARKER.test(value), `${path} contains a private marker`);
  if (Array.isArray(value)) value.forEach((item, index) => inspectPrivateMarkers(item, `${path}[${index}]`));
  else if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      assert(!/^(?:reviewer|checksum|private|sourcePath|sourceFile)$/iu.test(key), `${path}.${key} is a private field`);
      inspectPrivateMarkers(item, `${path}.${key}`);
    }
  }
}

function validateReview(review, path) {
  assertExactKeys(review, REVIEW_KEYS, path);
  assertEnum(review.status, ["unreviewed", "reviewed"], `${path}.status`);
  assertEnum(review.outcome, [null, "retain-as-possible", "not-supported"], `${path}.outcome`);
  assert(review.reviewedOn === null || /^\d{4}-\d{2}-\d{2}$/u.test(review.reviewedOn), `${path}.reviewedOn is invalid`);
  assert(isPublicNote(review.publicNote), `${path}.publicNote is invalid`);
  assert(Array.isArray(review.citations), `${path}.citations must be an array`);
  if (review.status === "unreviewed") {
    assert(review.outcome === null && review.reviewedOn === null && review.publicNote === null && review.citations.length === 0, `${path} unreviewed fields must be null or empty`);
  } else {
    assertEnum(review.outcome, ["retain-as-possible", "not-supported"], `${path}.outcome`);
    assert(isRealCalendarDate(review.reviewedOn), `${path}.reviewedOn must be a real ISO calendar date when reviewed`);
    review.citations.forEach((citation, index) => validateCitation(citation, `${path}.citations[${index}]`));
  }
}

export function validateLineageShape(document) {
  assertExactKeys(document, ROOT_KEYS, "root");
  assertExactKeys(document.metadata, METADATA_KEYS, "metadata");
  assert(document.metadata.schemaVersion === 2, "metadata.schemaVersion must be 2");
  assert(document.metadata.scope === "series-inventory-and-cross-source-candidates", "metadata.scope is invalid");
  assertExactKeys(document.metadata.source, SOURCE_KEYS, "metadata.source");
  assert(Array.isArray(document.metadata.collectionSeries), "metadata.collectionSeries must be an array");
  document.metadata.collectionSeries.forEach((series, index) => {
    assertExactKeys(series, SERIES_KEYS, `metadata.collectionSeries[${index}]`);
    assert(typeof series.id === "string" && series.id.length > 0 && Array.isArray(series.catalogIds) && series.catalogIds.length >= 2, `metadata.collectionSeries[${index}] is invalid`);
  });
  assertExactKeys(document.metadata.methodology, METHODOLOGY_KEYS, "metadata.methodology");
  assertExactKeys(document.metadata.methodology.inventoryNormalization, INVENTORY_NORMALIZATION_KEYS, "metadata.methodology.inventoryNormalization");
  assertExactKeys(document.metadata.methodology.possibleMatchIdentity, POSSIBLE_IDENTITY_KEYS, "metadata.methodology.possibleMatchIdentity");
  assertExactKeys(document.metadata.methodology.massThresholds, MASS_THRESHOLD_KEYS, "metadata.methodology.massThresholds");
  assertCanonicalSubset(document.metadata.methodology.evidenceStrengthOrder, EVIDENCE_STRENGTH_ORDER, "metadata.methodology.evidenceStrengthOrder");
  assert(document.metadata.methodology.evidenceStrengthOrder.length === 3, "metadata.methodology.evidenceStrengthOrder must include all strengths");
  assert(document.metadata.methodology.nonAssertions.join("|") === "custody-chain|ownership-transfer", "metadata.methodology.nonAssertions is invalid");
  assertExactKeys(document.metadata.counts, COUNT_KEYS, "metadata.counts");
  assertExactKeys(document.metadata.counts.possibleMatchEvidenceStrength, STRENGTH_COUNT_KEYS, "metadata.counts.possibleMatchEvidenceStrength");
  assert(Array.isArray(document.metadata.counts.catalogPairs), "metadata.counts.catalogPairs must be an array");
  document.metadata.counts.catalogPairs.forEach((item, index) => assertExactKeys(item, PAIR_COUNT_KEYS, `metadata.counts.catalogPairs[${index}]`));
  assert(Array.isArray(document.relationships), "relationships must be an array");
  for (const [relationshipIndex, relationship] of document.relationships.entries()) {
    const path = `relationships[${relationshipIndex}]`;
    assertExactKeys(relationship, RELATIONSHIP_KEYS, path);
    const sameInventory = relationship.relationship === "same-inventory";
    const prefix = sameInventory ? "same-inventory-lineage-" : "possible-lineage-";
    assert(["same-inventory", "possible-match"].includes(relationship.relationship), `${path}.relationship is invalid`);
    assert(relationship.id.startsWith(prefix) && UUID_V5_PATTERN.test(relationship.id.slice(prefix.length)), `${path}.id is invalid`);
    assert(relationship.basis === (sameInventory ? "series-scoped-normalized-inventory-id" : "reviewed-identity-and-reported-mass"), `${path}.basis is invalid`);
    assert(relationship.status === (sameInventory ? "established" : "possible"), `${path}.status is invalid`);
    assert(typeof relationship.displayName === "string" && relationship.displayName.length > 0, `${path}.displayName must be nonempty`);
    assert(/^[a-z0-9-]+\|[a-z0-9-]+$/u.test(relationship.catalogPair), `${path}.catalogPair is invalid`);
    if (sameInventory) {
      assertExactKeys(relationship.collectionSeries, COLLECTION_SERIES_KEYS, `${path}.collectionSeries`);
      assert(typeof relationship.collectionSeries.id === "string" && typeof relationship.collectionSeries.inventoryId === "string" && relationship.collectionSeries.inventoryId.length > 0, `${path}.collectionSeries is invalid`);
      assert(relationship.identity === null && relationship.evidence === null && relationship.review === null, `${path} same-inventory optional fields must be null`);
    } else {
      assert(relationship.collectionSeries === null, `${path}.collectionSeries must be null`);
      assertExactKeys(relationship.identity, IDENTITY_KEYS, `${path}.identity`);
      assertEnum(relationship.identity.method, ["metbull-code", "normalized-source-name"], `${path}.identity.method`);
      assert(typeof relationship.identity.key === "string" && relationship.identity.key.length > 0, `${path}.identity.key must be nonempty`);
      assert(relationship.identity.canonicalName === null || typeof relationship.identity.canonicalName === "string", `${path}.identity.canonicalName is invalid`);
      assertExactKeys(relationship.evidence, EVIDENCE_KEYS, `${path}.evidence`);
      assertEnum(relationship.evidence.strength, EVIDENCE_STRENGTH_ORDER, `${path}.evidence.strength`);
      assertEnum(relationship.evidence.massMatch, ["exact", "near"], `${path}.evidence.massMatch`);
      assertFiniteNonnegative(relationship.evidence.absoluteDifferenceGrams, `${path}.evidence.absoluteDifferenceGrams`);
      assertFiniteNonnegative(relationship.evidence.relativeDifference, `${path}.evidence.relativeDifference`);
      assert(typeof relationship.evidence.sameDesignation === "boolean" && typeof relationship.evidence.designationFamily === "boolean", `${path}.evidence designation flags are invalid`);
      assertCanonicalSubset(relationship.evidence.factCodes, FACT_CODE_ORDER, `${path}.evidence.factCodes`);
      assertCanonicalSubset(relationship.evidence.cautionCodes, CAUTION_CODE_ORDER, `${path}.evidence.cautionCodes`);
      validateReview(relationship.review, `${path}.review`);
    }
    assert(Array.isArray(relationship.observations) && relationship.observations.length === 2, `${path}.observations must contain exactly two items`);
    for (const [observationIndex, observation] of relationship.observations.entries()) {
      const observationPath = `${path}.observations[${observationIndex}]`;
      assertExactKeys(observation, OBSERVATION_KEYS, observationPath);
      const observationPrefix = sameInventory ? "inventory-observation-" : "mass-observation-";
      assert(observation.id.startsWith(observationPrefix) && UUID_V5_PATTERN.test(observation.id.slice(observationPrefix.length)), `${observationPath}.id is invalid`);
      assert(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(observation.recordId), `${observationPath}.recordId is invalid`);
      assert(typeof observation.catalogId === "string" && Number.isInteger(observation.catalogYear), `${observationPath} catalog descriptor is invalid`);
      assertEnum(observation.recordModel, ["specimen", "catalog-item", "catalog-number", "collection-entry"], `${observationPath}.recordModel`);
      assert(observation.designationPath === null || /^(?:designation|holdings\[[0-9]+\]\.designation)$/u.test(observation.designationPath), `${observationPath}.designationPath is invalid`);
      assert(typeof observation.massPath === "string" && /^(?:weight\.grams|holdings\[[0-9]+\]\.(?:weight\.grams|weights\[[0-9]+\]\.grams))$/u.test(observation.massPath), `${observationPath}.massPath is invalid`);
      for (const key of ["sourceName", "canonicalName", "meteoriteCode", "designation", "kind"]) assert(observation[key] === null || typeof observation[key] === "string", `${observationPath}.${key} is invalid`);
      assertFiniteNonnegative(observation.massGrams, `${observationPath}.massGrams`, sameInventory);
      assert(observation.count === null || (Number.isInteger(observation.count) && observation.count > 0), `${observationPath}.count is invalid`);
      assert(/^\.\/index\.html\?catalog=[a-z0-9%_-]+&q=[^\s#&]+#catalog$/u.test(observation.catalogSearchUrl), `${observationPath}.catalogSearchUrl is unsafe`);
    }
  }
  inspectPrivateMarkers(document);
  return true;
}

function firstDifference(actual, expected, path = "root") {
  if (Object.is(actual, expected)) return null;
  if (typeof actual !== typeof expected || actual === null || expected === null) return path;
  if (Array.isArray(actual) || Array.isArray(expected)) {
    if (!Array.isArray(actual) || !Array.isArray(expected) || actual.length !== expected.length) return path;
    for (let index = 0; index < actual.length; index += 1) {
      const difference = firstDifference(actual[index], expected[index], `${path}[${index}]`);
      if (difference) return difference;
    }
    return null;
  }
  if (typeof actual === "object") {
    const actualKeys = Object.keys(actual);
    const expectedKeys = Object.keys(expected);
    if (actualKeys.join("|") !== expectedKeys.join("|")) return `${path} keys/order`;
    for (const key of expectedKeys) {
      const difference = firstDifference(actual[key], expected[key], `${path}.${key}`);
      if (difference) return difference;
    }
    return null;
  }
  return path;
}

export function validateSpecimenLineages(document, catalog, reviewSource = EMPTY_REVIEW_SOURCE) {
  validateLineageShape(document);
  const expected = buildSpecimenLineages(catalog, reviewSource);
  const difference = firstDifference(document, expected);
  assert(difference === null, `specimen lineage data differs from public catalog derivation at ${difference}`);
  return {
    relationshipCount: document.relationships.length,
    sameInventoryRelationshipCount: document.metadata.counts.sameInventoryRelationshipCount,
    possibleMatchRelationshipCount: document.metadata.counts.possibleMatchRelationshipCount,
  };
}
