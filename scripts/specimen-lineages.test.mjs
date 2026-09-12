import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildSpecimenLineages,
  flattenInventoryObservations,
  flattenMassObservations,
  normalizeInventoryId,
  serializeSpecimenLineages,
  uuidV5,
  validateLineageShape,
  validateReviewSource,
  validateSpecimenLineages,
} from "./specimen-lineages-lib.mjs";

const catalogText = await readFile(new URL("../data/catalog.json", import.meta.url), "utf8");
const catalog = JSON.parse(catalogText);
const publishedText = await readFile(new URL("../data/specimen-lineages.json", import.meta.url), "utf8");
const published = JSON.parse(publishedText);
const schema = JSON.parse(await readFile(new URL("../data/specimen-lineages.schema.json", import.meta.url), "utf8"));
const reviewText = await readFile(new URL("../data/specimen-comparison-reviews.json", import.meta.url), "utf8");
const reviewSource = JSON.parse(reviewText);
const reviewSchema = JSON.parse(await readFile(new URL("../data/specimen-comparison-reviews.schema.json", import.meta.url), "utf8"));
const sourceClaims = JSON.parse(await readFile(new URL("../data/source-claims.json", import.meta.url), "utf8"));
const folios = JSON.parse(await readFile(new URL("../data/folios.json", import.meta.url), "utf8"));
const folioReleaseLock = JSON.parse(await readFile(new URL("./folio-release-lock.json", import.meta.url), "utf8"));
const WAVE1_CATALOG_IDS = new Set(["brown-1916", "minnesota-1892"]);
const WAVE2_CATALOG_IDS = new Set(["berlin-1903", "berlin-1904", "greifswald-1895", "greifswald-1901"]);
const MUSEUM3_CATALOG_IDS = new Set(["story-maskelyne-1872", "prior-guide-1926", "brauns-bonn-1926"]);

function clone(value) {
  return structuredClone(value);
}

function candidates(document = published) {
  return document.comparisonGroups.flatMap(({ candidates: values }) => values);
}

function comparisonEntries(document = published) {
  return document.comparisonGroups.flatMap((group) => group.candidates.map((candidate) => ({
    ...candidate,
    groupId: group.id,
    type: group.type,
    basis: group.basis,
    displayName: group.displayName,
    catalogPair: group.catalogPair,
    identity: group.identity,
    massPair: group.massPair,
  })));
}

function catalogComparisons(catalogId, document = published) {
  return comparisonEntries(document).filter(({ observations }) => observations.some((observation) => observation.catalogId === catalogId));
}

function sameInventory(seriesId, inventoryId, document = published) {
  return document.relationships.find(({ collectionSeries }) =>
    collectionSeries.id === seriesId && collectionSeries.inventoryId === inventoryId);
}

function current37Comparisons(document = published) {
  return comparisonEntries(document).filter(({ observations }) => observations.every(({ catalogId }) =>
    !WAVE1_CATALOG_IDS.has(catalogId) && !WAVE2_CATALOG_IDS.has(catalogId) && !MUSEUM3_CATALOG_IDS.has(catalogId)));
}

function mutate(label, callback, pattern = /invalid|must|differ|duplicated|private|canonical|unsupported|unsafe/iu) {
  const value = clone(published);
  callback(value);
  assert.throws(() => validateSpecimenLineages(value, catalog, reviewSource, sourceClaims), pattern, label);
}

test("schema-v4 build is byte deterministic and independent of catalog record order", () => {
  const first = serializeSpecimenLineages(buildSpecimenLineages(catalog, reviewSource, sourceClaims));
  const second = serializeSpecimenLineages(buildSpecimenLineages(clone(catalog), clone(reviewSource), clone(sourceClaims)));
  const reorderedCatalog = clone(catalog);
  reorderedCatalog.records.reverse();
  const reordered = serializeSpecimenLineages(buildSpecimenLineages(reorderedCatalog, reviewSource, sourceClaims));

  assert.equal(first, second);
  assert.equal(first, reordered);
  assert.equal(first, publishedText);
  assert.ok(first.endsWith("\n"));
  assert.deepEqual(published.relationships.map(({ id }) => id), published.relationships.map(({ id }) => id).toSorted());
  assert.deepEqual(published.comparisonGroups.map(({ id }) => id), published.comparisonGroups.map(({ id }) => id).toSorted());
  for (const group of published.comparisonGroups) {
    assert.deepEqual(group.candidates.map(({ id }) => id), group.candidates.map(({ id }) => id).toSorted());
    for (const candidate of group.candidates) {
      assert.deepEqual(candidate.observations.map(({ id }) => id), candidate.observations.map(({ id }) => id).toSorted());
    }
  }
  assert.equal(JSON.stringify(catalog), JSON.stringify(JSON.parse(catalogText)));
});

test("publishes the locked schema-v4 source, lineage, comparison, and cardinality counts", () => {
  assert.equal(published.metadata.schemaVersion, 4);
  assert.equal(published.metadata.scope, "attested-lineage-and-cross-catalog-comparisons");
  assert.equal(flattenMassObservations(catalog).length, 17160);
  assert.equal(flattenInventoryObservations(catalog).length, 3627);
  assert.deepEqual(published.metadata.source, {
    catalogSchemaVersion: 12,
    recordCount: 19553,
    catalogCount: 52,
    flattenedMassObservationCount: 17160,
    inventoryObservationCount: 3627,
    sourceClaimsSchemaVersion: 1,
    sourceClaimsContentSha256: "141ed60b9560596ac8ab392babfc4af6e1d22921bacbf979d3b975e0fc2f20c2",
  });
  const { catalogPairs, ...counts } = published.metadata.counts;
  assert.deepEqual(counts, {
    relationshipCount: 194,
    sameInventoryRelationshipCount: 194,
    comparisonGroupCount: 1541,
    singletonComparisonGroupCount: 1323,
    ambiguousComparisonGroupCount: 218,
    comparisonCandidateCount: 2245,
    reviewedComparisonCandidateCount: 906,
    unreviewedComparisonCandidateCount: 1339,
    exactMassComparisonCandidateCount: 2014,
    nearMassComparisonCandidateCount: 231,
    metbullIdentityComparisonCandidateCount: 2245,
    normalizedNameIdentityComparisonCandidateCount: 0,
    sameDesignationComparisonCandidateCount: 0,
    designationFamilyComparisonCandidateCount: 0,
    aggregateOrMultipleComparisonCandidateCount: 57,
    castComparisonCandidateCount: 0,
    identityResolvedInventoryCollisionCount: 1,
    omittedAmbiguousInventoryKeyCount: 1,
    comparisonCandidateEvidenceStrength: {
      "multiple-matching-facts": 0,
      "two-matching-facts": 2014,
      "limited-matching-evidence": 231,
    },
    comparisonGroupCardinalityDistribution: [
      { candidateCount: 1, groupCount: 1323 },
      { candidateCount: 2, groupCount: 90 },
      { candidateCount: 3, groupCount: 4 },
      { candidateCount: 4, groupCount: 116 },
      { candidateCount: 5, groupCount: 1 },
      { candidateCount: 6, groupCount: 2 },
      { candidateCount: 9, groupCount: 1 },
      { candidateCount: 25, groupCount: 1 },
      { candidateCount: 36, groupCount: 1 },
      { candidateCount: 81, groupCount: 1 },
      { candidateCount: 98, groupCount: 1 },
    ],
    sourceAttestedGroupCount: 21,
    sourceAttestedMemberOccurrenceCount: 89,
    sourceAttestedUniqueMemberCount: 87,
  });
  assert.equal(catalogPairs.length, 152);
  assert.equal(catalogPairs.reduce((sum, item) => sum + item.sameInventoryCount, 0), 194);
  assert.equal(catalogPairs.reduce((sum, item) => sum + item.comparisonGroupCount, 0), 1541);
  assert.equal(catalogPairs.reduce((sum, item) => sum + item.comparisonCandidateCount, 0), 2245);
});

test("relationships contain only unchanged same-inventory continuity", () => {
  assert.equal(published.relationships.length, 194);
  assert(published.relationships.every(({ relationship, basis, status, identity, evidence, review }) =>
    relationship === "same-inventory" && basis === "series-scoped-normalized-inventory-id" && status === "established" &&
    identity === null && evidence === null && review === null));
  assert(!publishedText.includes('"relationship": "possible-match"'));
  assert.deepEqual(published.metadata.collectionSeries, [
    { id: "huss", catalogIds: ["huss-1976", "huss-1986"] },
    { id: "nininger", catalogIds: ["nininger-1933", "nininger-1950"] },
  ]);
  assert.equal(createHash("sha256").update(JSON.stringify(published.relationships)).digest("hex"),
    "48eb6add50f2c78159e801c6d032641265786e87b73aa9330b70c70804feb4bc");
});

test("source-attested groups are unchanged", () => {
  assert.deepEqual(published.sourceAttestedGroups, sourceClaims.claims);
  assert.equal(published.sourceAttestedGroups.length, 21);
  assert.equal(createHash("sha256").update(JSON.stringify(published.sourceAttestedGroups)).digest("hex"),
    "141ed60b9560596ac8ab392babfc4af6e1d22921bacbf979d3b975e0fc2f20c2");
});

test("every comparison candidate is in exactly one canonical mass-pair group", () => {
  const allCandidates = candidates();
  assert.equal(allCandidates.length, 2245);
  assert.equal(new Set(allCandidates.map(({ id }) => id)).size, 2245);
  assert.equal(new Set(allCandidates.map(({ v3CandidateId }) => v3CandidateId)).size, 2245);
  assert.equal(createHash("sha256").update(JSON.stringify(allCandidates.toSorted((left, right) => left.id.localeCompare(right.id)))).digest("hex"),
    "c67ef2a5c9dd9e9bb5668bbb82d97dccd141179efeb1238dface0c750cd50986");
  for (const group of published.comparisonGroups) {
    assert.equal(group.type, "comparison-only");
    assert.equal(group.basis, "reviewed-identity-and-reported-mass");
    assert.equal(group.candidateCount, group.candidates.length);
    assert.equal(group.catalogPair, group.massPair.map(({ catalogId }) => catalogId).join("|"));
    const reference = ["comparison-group", group.identity.method, group.identity.key,
      ...group.massPair.flatMap(({ catalogId, massGrams }) => [catalogId, JSON.stringify(massGrams)])].join("\u0000");
    assert.equal(group.id, `comparison-group-${uuidV5(reference)}`);
    for (const candidate of group.candidates) {
      assert.equal(candidate.id.replace("comparison-candidate-", ""), candidate.v3CandidateId.replace("possible-lineage-", ""));
      assert.deepEqual(candidate.observations.map(({ catalogId, massGrams }) => ({ catalogId, massGrams })).toSorted((a, b) => a.catalogId.localeCompare(b.catalogId)), group.massPair);
      assert.equal(candidate.observations.length, 2);
    }
  }
});

test("the 98-candidate Holbrook group follows the universal grouping rule", async () => {
  const group = published.comparisonGroups.find(({ candidateCount }) => candidateCount === 98);
  assert.equal(group.displayName, "Holbrook");
  assert.equal(group.identity.method, "metbull-code");
  assert.equal(group.candidates.length, 98);
  const implementation = await readFile(new URL("./specimen-lineages-lib.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(implementation, /Holbrook/u);
});

test("migrated reviews form a bijection and preserve explicit v3 IDs", () => {
  const allCandidates = candidates();
  const reviewed = allCandidates.filter(({ review }) => review.status === "reviewed");
  const reviewsById = new Map(reviewSource.reviews.map((review) => [review.candidateId, review]));
  assert.equal(reviewSource.reviews.length, 906);
  assert.equal(reviewed.length, 906);
  assert.equal(reviewsById.size, 906);
  assert.equal(createHash("sha256").update(JSON.stringify(reviewSource.reviews.map(({ candidateId, ...review }) => review))).digest("hex"),
    "d83ed9b7a6b60652aa6a65067c103276d8a9acee768d295f5872ecf5d87f37ee");
  for (const candidate of reviewed) {
    const source = reviewsById.get(candidate.id);
    assert.ok(source);
    assert.equal(candidate.v3CandidateId, candidate.id.replace("comparison-candidate-", "possible-lineage-"));
    assert.deepEqual(candidate.review, {
      status: "reviewed",
      outcome: source.outcome,
      reviewedOn: source.reviewedOn,
      publicNote: source.publicNote,
      citations: source.citations,
    });
  }
  assert.equal(validateReviewSource(reviewSource, new Set(allCandidates.map(({ id }) => id))), true);
});

test("review gating continues to use neutral comparison candidate IDs", () => {
  const withoutReviews = buildSpecimenLineages(catalog, undefined, sourceClaims);
  assert.equal(candidates(withoutReviews).length, 1343);
  const review = reviewSource.reviews[0];
  const oneReview = { schemaVersion: 1, reviews: [review] };
  const rebuilt = buildSpecimenLineages(catalog, oneReview, sourceClaims);
  assert.equal(candidates(rebuilt).find(({ id }) => id === review.candidateId).review.status, "reviewed");
  assert.throws(() => buildSpecimenLineages(catalog, {
    schemaVersion: 1,
    reviews: [{ ...review, candidateId: review.candidateId.replace("comparison-candidate-", "possible-lineage-") }],
  }, sourceClaims), /candidateId is invalid/iu);
});

test("inventory normalization and continuity behavior remain stable", () => {
  assert.equal(normalizeInventoryId(" \uFF28 \uFF11\uFF15 ", "nininger"), "h15");
  assert.equal(normalizeInventoryId("(2)H39.417", "huss"), "h39.417");
  assert.equal(normalizeInventoryId("(2)H39.417", "nininger"), "(2)h39.417");
  const huss = published.relationships.filter(({ collectionSeries }) => collectionSeries.id === "huss");
  assert.deepEqual(huss.map(({ collectionSeries }) => collectionSeries.inventoryId).toSorted(), ["h160.1", "h160.2"]);
});

test("schemas are closed draft 2020-12 contracts", () => {
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.$id, "urn:hmc:schema:specimen-lineages:4");
  assert.equal(reviewSchema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(reviewSchema.$id, "urn:hmc:schema:specimen-comparison-reviews:1");
  assert.equal(reviewSchema.properties.reviews.minItems, 906);
  assert.equal(reviewSchema.properties.reviews.maxItems, 906);
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (value === null || typeof value !== "object") return;
    if (value.type === "object") assert.equal(value.additionalProperties, false);
    Object.values(value).forEach(visit);
  };
  visit(schema);
  visit(reviewSchema);
  assert.match(JSON.stringify(schema), /comparison-only/u);
  assert.doesNotMatch(JSON.stringify(schema.$defs.relationship), /possible-match/u);
  assert.equal(validateLineageShape(published), true);
});

test("validator rejects malformed groups, IDs, counts, partitions, reviews, and private markers", () => {
  mutate("extra root field", (value) => { value.private = true; }, /exactly keys|private/iu);
  mutate("possible relationship", (value) => { value.relationships[0].relationship = "possible-match"; });
  mutate("group type", (value) => { value.comparisonGroups[0].type = "lineage"; });
  mutate("group id", (value) => { value.comparisonGroups[0].id = value.comparisonGroups[1].id; });
  mutate("candidate id", (value) => { value.comparisonGroups[0].candidates[0].id = "comparison-candidate-00000000-0000-5000-8000-000000000000"; });
  mutate("v3 suffix", (value) => { value.comparisonGroups[0].candidates[0].v3CandidateId = "possible-lineage-00000000-0000-5000-8000-000000000000"; });
  mutate("group candidate count", (value) => { value.comparisonGroups[0].candidateCount += 1; });
  mutate("metadata count", (value) => { value.metadata.counts.comparisonCandidateCount += 1; });
  mutate("cardinality", (value) => { value.metadata.counts.comparisonGroupCardinalityDistribution[0].groupCount += 1; });
  mutate("mass partition", (value) => { value.comparisonGroups[0].massPair[0].massGrams += 1; });
  mutate("duplicate candidate partition", (value) => { value.comparisonGroups[0].candidates[0] = clone(value.comparisonGroups[1].candidates[0]); });
  mutate("review semantic", (value) => { value.comparisonGroups.flatMap(({ candidates: values }) => values).find(({ review }) => review.status === "reviewed").review.outcome = null; });
  mutate("private group field", (value) => { value.comparisonGroups[0].reviewer = "private"; }, /exactly keys|private/iu);
  mutate("private note marker", (value) => { value.comparisonGroups[0].displayName = "private note"; }, /private/iu);
});

test("Brown and Minnesota contribute only their 22 reviewed comparison candidates", () => {
  const additions = comparisonEntries().filter(({ observations }) =>
    observations.some(({ catalogId }) => WAVE1_CATALOG_IDS.has(catalogId)));
  assert.equal(additions.length, 22);
  assert.equal(additions.filter(({ observations }) => observations.some(({ catalogId }) => catalogId === "brown-1916")).length, 7);
  assert.equal(additions.filter(({ observations }) => observations.some(({ catalogId }) => catalogId === "minnesota-1892")).length, 15);
  assert(additions.every(({ type, basis, review, evidence }) =>
    type === "comparison-only" && basis === "reviewed-identity-and-reported-mass" &&
    review.status === "reviewed" && review.outcome === "retain-as-possible" && evidence.massMatch === "exact"));
  assert.equal(additions.filter(({ review }) => review.publicNote.includes("alternatives")).length, 8);
  assert(additions.every(({ review }) =>
    /No same-inventory, custody, ownership-transfer, or merge relationship is asserted\.$/u.test(review.publicNote)));
  assert(!published.relationships.some(({ observations }) =>
    observations.some(({ catalogId }) => WAVE1_CATALOG_IDS.has(catalogId))));
  assert.equal(catalogComparisons("foote-1909").length, 0);

  const missingReview = clone(reviewSource);
  missingReview.reviews.splice(missingReview.reviews.findIndex(({ candidateId }) =>
    additions.some(({ id }) => id === candidateId)), 1);
  assert.equal(candidates(buildSpecimenLineages(catalog, missingReview, sourceClaims)).length, 2244);
  assert.throws(() => validateSpecimenLineages(published, catalog, missingReview, sourceClaims), /dangling|differs/iu);
});

test("Hodge-Smith and Victoria retain facts without pairwise lineage or comparison output", () => {
  const hodge = catalog.records.filter(({ catalogId }) => catalogId === "hodge-smith-1939");
  const victoria = catalog.records.filter(({ catalogId }) => catalogId === "victoria-land-1982");
  assert.equal(hodge.length, 84);
  assert.equal(hodge.filter((record) => Object.hasOwn(record, "metbull")).length, 58);
  assert.equal(victoria.length, 273);
  assert.equal(victoria.filter((record) => record.metbull?.matchType === "official-abbreviation").length, 273);
  assert.equal(victoria.reduce((sum, record) => sum + record.weight.grams, 0), 969562.2);
  assert.equal(createHash("sha256").update(JSON.stringify(hodge)).digest("hex"),
    "7ca605ed679a55b21cae9574f9f33665a3d4665db7a40eceb2017e57781980b5");
  assert.equal(createHash("sha256").update(JSON.stringify(victoria)).digest("hex"),
    "c427fa0bf07a8ce57c01d4520fc3b2eb2c2aa7483f1d8bf5d7f8bce483f96806");
  for (const catalogId of ["hodge-smith-1939", "victoria-land-1982"]) {
    assert.deepEqual(folios.catalogs[catalogId], { displayPolicy: "blocked", rightsStatus: "undetermined", pages: [] });
    assert.deepEqual(folioReleaseLock.catalogs[catalogId], {
      displayPolicy: "blocked", rightsStatus: "undetermined", basis: null, basisUrl: null, pageIds: [],
    });
    assert(!folioReleaseLock.assets.some(({ path }) => path.includes(catalogId)));
    assert.equal(catalogComparisons(catalogId).length, 0);
    assert(!published.relationships.some(({ observations }) => observations.some((observation) => observation.catalogId === catalogId)));
  }
});

test("Victoria admits 233 conflict-free Table A masses and keeps Table C n-ary", () => {
  const massConflicts = new Set(catalog.records.filter(({ catalogId, sourceEvidence }) =>
    catalogId === "victoria-land-1982" && sourceEvidence.conflicts.includes("mass")).map(({ specimenId }) => specimenId));
  const observations = flattenMassObservations(catalog).filter(({ public: observation }) =>
    observation.catalogId === "victoria-land-1982");
  assert.equal(massConflicts.size, 40);
  assert.equal(observations.length, 233);
  assert(observations.every(({ public: observation }) => !massConflicts.has(observation.designation)));
  assert(!observations.some(({ public: observation }) => observation.designation === "ALHA76009"));

  const admitted = clone(catalog);
  admitted.records.find(({ specimenId }) => specimenId === "ALHA76009").sourceEvidence.conflicts = [];
  assert.equal(flattenMassObservations(admitted).length, 17161);
  const excluded = clone(catalog);
  excluded.records.find(({ catalogId, sourceEvidence }) =>
    catalogId === "victoria-land-1982" && sourceEvidence.conflicts.length === 0).sourceEvidence.conflicts = ["mass"];
  assert.equal(flattenMassObservations(excluded).length, 17159);
  assert.equal(published.sourceAttestedGroups.length, 21);
  assert.equal(new Set(published.sourceAttestedGroups.flatMap(({ members }) => members)).size, 87);
  assert(published.sourceAttestedGroups.every(({ claimType }) => claimType === "tentative-n-ary-group"));
});

test("ASU September 2024 retains duplicate designations and enables 16 comparisons", () => {
  const asu = catalog.records.filter(({ catalogId }) => catalogId === "asu-2024-09");
  const designationCounts = new Map();
  asu.forEach(({ designation }) => designationCounts.set(designation, (designationCounts.get(designation) || 0) + 1));
  assert.equal(asu.length, 2169);
  assert.equal(designationCounts.size, 2166);
  assert.deepEqual([...designationCounts].filter(([, count]) => count > 1), [["91", 2], ["157", 2], ["607", 2]]);
  assert.equal(asu.filter((record) => Object.hasOwn(record, "metbull")).length, 2091);
  assert.equal(catalogComparisons("asu-2024-09").length, 16);
  assert(!published.relationships.some(({ observations }) => observations.some(({ catalogId }) => catalogId === "asu-2024-09")));
});

test("Barnes participates only in unreviewed identity-and-mass comparisons", () => {
  const entries = catalogComparisons("barnes-1940");
  assert.equal(entries.length, 128);
  assert(entries.every(({ type, basis, review, identity }) =>
    type === "comparison-only" && basis === "reviewed-identity-and-reported-mass" &&
    review.status === "unreviewed" && identity.method === "metbull-code"));
  assert.deepEqual(entries.reduce((counts, { evidence }) => {
    counts[evidence.massMatch] += 1;
    return counts;
  }, { exact: 0, near: 0 }), { exact: 120, near: 8 });
  assert.deepEqual(entries.reduce((counts, { catalogPair }) => {
    counts[catalogPair] = (counts[catalogPair] || 0) + 1;
    return counts;
  }, {}), {
    "barnes-1940|farrington-1903": 8,
    "barnes-1940|farrington-1916": 26,
    "barnes-1940|mason-1964": 16,
    "barnes-1940|nininger-1933": 7,
    "barnes-1940|nininger-1950": 9,
    "barnes-1940|palache-1926": 15,
    "barnes-1940|prior-1923": 16,
    "barnes-1940|reeds-1937": 29,
    "barnes-1940|tassin-1902": 1,
    "barnes-1940|usnm-1886": 1,
  });
  assert(!published.relationships.some(({ observations }) => observations.some(({ catalogId }) => catalogId === "barnes-1940")));
});

test("Palache retains locked records and only grouped comparison candidates", () => {
  const descriptor = catalog.metadata.catalogs.find(({ id }) => id === "palache-1926");
  const records = catalog.records.filter(({ catalogId }) => catalogId === "palache-1926");
  const reviewed = records.filter((record) => Object.hasOwn(record, "metbull"));
  const weights = records.flatMap(({ holdings }) => holdings.flatMap(({ weights: values }) => values));
  assert.equal(descriptor.recordCount, 361);
  assert.equal(descriptor.compiler, "Charles Palache");
  assert.equal(descriptor.folioDisplayPolicy, "blocked");
  assert.deepEqual(descriptor.sourcePages, [151, 152, 153, 154, 155, 156, 157, 158, 159]);
  assert.equal(records.length, 361);
  assert.equal(records[0].name, "Adargas");
  assert.equal(records.at(-1).name, "Zavid");
  assert.equal(weights.length, 717);
  assert.equal(weights.reduce((sum, { grams }) => sum + grams, 0), 2695373.57);
  assert.equal(reviewed.length, 285);
  assert(reviewed.every(({ metbull }) => metbull.matchType === "exact"));
  assert.deepEqual(folios.catalogs["palache-1926"], { displayPolicy: "blocked", rightsStatus: "undetermined", pages: [] });
  const entries = catalogComparisons("palache-1926");
  assert.equal(entries.length, 82);
  assert(entries.every(({ type, basis, identity }) =>
    type === "comparison-only" && basis === "reviewed-identity-and-reported-mass" && identity.method === "metbull-code"));
  assert.deepEqual(Object.fromEntries(Map.groupBy(entries, ({ review }) => review.status).entries()
    .map(([status, values]) => [status, values.length])), { unreviewed: 74, reviewed: 8 });
  assert.deepEqual(entries.reduce((counts, { evidence }) => {
    counts[evidence.massMatch] += 1;
    return counts;
  }, { exact: 0, near: 0 }), { exact: 80, near: 2 });
  assert(!published.relationships.some(({ observations }) => observations.some(({ catalogId }) => catalogId === "palache-1926")));
});

test("Madrid retains accepted atomic facts and four unreviewed comparisons", () => {
  const catalogId = "madrid-1923";
  const descriptor = catalog.metadata.catalogs.find(({ id }) => id === catalogId);
  const records = catalog.records.filter((record) => record.catalogId === catalogId);
  const holdings = records.flatMap((record) => record.holdings);
  const weights = holdings.flatMap((holding) => holding.weights);
  assert.equal(descriptor.recordCount, 130);
  assert.equal(descriptor.recordsWithWeight, 130);
  assert.equal(records.length, 130);
  assert.equal(holdings.length, 168);
  assert.equal(records.filter(({ holdings: values }) => values.length > 1).length, 23);
  assert.equal(weights.length, 168);
  assert.equal(Math.round(weights.reduce((sum, { grams }) => sum + grams, 0) * 100) / 100, 190083.41);
  assert.deepEqual(holdings.reduce((counts, { description }) => ({ ...counts, [description]: (counts[description] || 0) + 1 }), {}),
    { Specimen: 151, "Specimen group": 17 });
  assert.equal(records.filter(({ metbull }) => metbull.matchType !== "unresolved").length, 84);
  assert.equal(records.filter(({ metbull }) => metbull.matchType === "unresolved").length, 46);
  assert.equal(createHash("sha256").update(JSON.stringify(records)).digest("hex"),
    "f8d2ce55629ce9f97cb61e53a0e042bbf87a44825b5dfea270261a5612f84cef");
  assert.deepEqual(folios.catalogs[catalogId], { displayPolicy: "blocked", rightsStatus: "undetermined", pages: [] });
  const entries = catalogComparisons(catalogId);
  assert.equal(entries.length, 4);
  assert(entries.every(({ type, review }) => type === "comparison-only" && review.status === "unreviewed"));
  assert.deepEqual(entries.map(({ catalogPair }) => catalogPair).toSorted(), [
    "madrid-1923|nininger-1950", "madrid-1923|prior-1923", "madrid-1923|prior-1923", "madrid-1923|reeds-1937",
  ]);
  assert.doesNotMatch(JSON.stringify(records),
    /(?:\/private\/|\/Users\/|source-images|data\/ocr|assets\/|file:\/\/|\.(?:pdf|png|webp|tiff?|txt|csv))/iu);
});

test("Hamburg retains four reviewed candidates and immutable endpoint facts", () => {
  const hamburg = current37Comparisons().filter(({ observations }) =>
    observations.some(({ catalogId }) => catalogId === "hamburg-1913"));
  assert.equal(hamburg.length, 4);
  assert(hamburg.every(({ type, review }) =>
    type === "comparison-only" && review.status === "reviewed" && review.outcome === "retain-as-possible"));
  assert.deepEqual(hamburg.map(({ v3CandidateId }) => v3CandidateId).toSorted(), [
    "possible-lineage-608f7f25-dcbd-50b0-a8cd-1f3f6a587c60",
    "possible-lineage-823b0536-7cef-5d01-9243-9a5941a0ac1e",
    "possible-lineage-a680d0c9-1a24-56a6-ad79-53871ad78f08",
    "possible-lineage-c1b3af31-9650-5b33-937c-3903cc5d09aa",
  ]);
  assert.deepEqual(hamburg.map(({ observations }) => observations.map(({ recordId, massPath, massGrams }) =>
    ({ recordId, massPath, massGrams }))).toSorted((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))), [
    [
      { recordId: "obs-4ecacb0a-2949-4b1f-a8be-1872d5426a24", massPath: "holdings[2].weights[0].grams", massGrams: 1850 },
      { recordId: "obs-8ee67c26-4bc2-4989-8e72-41424adf0818", massPath: "holdings[0].weights[0].grams", massGrams: 1850 },
    ],
    [
      { recordId: "obs-92db624b-6c1d-4e71-82c6-888c2dc0c34e", massPath: "holdings[0].weights[0].grams", massGrams: 0.5 },
      { recordId: "obs-dcbfe54c-edf7-410a-9d8c-1fa1ebecd85e", massPath: "holdings[0].weights[0].grams", massGrams: 0.5 },
    ],
    [
      { recordId: "obs-c4fed780-a62e-4606-9c19-5d35f4e7d7db", massPath: "holdings[0].weights[0].grams", massGrams: 882 },
      { recordId: "obs-e3d600c1-c7c8-4099-a430-5256370c25f3", massPath: "holdings[0].weights[0].grams", massGrams: 882 },
    ],
    [
      { recordId: "obs-ca99288b-b47a-4f57-ad42-ceaca60b9856", massPath: "holdings[0].weights[0].grams", massGrams: 0.4 },
      { recordId: "obs-304c57cd-b41c-4ae4-83f1-9dfdb1471c43", massPath: "holdings[0].weights[1].grams", massGrams: 0.4 },
    ],
  ].toSorted((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))));
});

test("Kanagawa publishes controlled meteorite and glass facts without lineages", () => {
  const catalogId = "kanagawa-1996";
  const descriptor = catalog.metadata.catalogs.find(({ id }) => id === catalogId);
  const records = catalog.records.filter((record) => record.catalogId === catalogId);
  const meteorites = records.filter(({ entryOrder }) => entryOrder <= 80);
  const glass = records.filter(({ entryOrder }) => entryOrder >= 81);
  const holdings = records.flatMap(({ holdings: values }) => values);
  const weights = holdings.flatMap(({ weights: values }) => values);
  assert.equal(descriptor.recordModel, "collection-entry");
  assert.equal(descriptor.recordCount, 232);
  assert.equal(descriptor.recordsWithWeight, 213);
  assert.deepEqual(descriptor.sourcePages, [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24]);
  assert.equal(records.length, 232);
  assert.equal(meteorites.length, 80);
  assert.equal(glass.length, 152);
  assert.equal(records[0].name, "Orgueil");
  assert.equal(records.at(-1).name, "Philippinite");
  assert.deepEqual(holdings.reduce((counts, { description }) => ({ ...counts, [description]: (counts[description] || 0) + 1 }), {}),
    { Specimen: 212, "Thin section": 19, "Specimen group": 1 });
  assert.equal(weights.length, 243);
  assert.equal(Math.round(weights.reduce((sum, { grams }) => sum + grams, 0) * 100) / 100, 2688123.61);
  assert.equal(records.filter((record) => Object.hasOwn(record, "metbull")).length, 68);
  assert(glass.every((record) => !Object.hasOwn(record, "metbull")));
  assert.deepEqual(folios.catalogs[catalogId], { displayPolicy: "blocked", rightsStatus: "undetermined", pages: [] });
  assert.deepEqual(folioReleaseLock.catalogs[catalogId], {
    displayPolicy: "blocked", rightsStatus: "undetermined", basis: null, basisUrl: null, pageIds: [],
  });
  assert.equal(catalogComparisons(catalogId).length, 0);
  assert(!published.relationships.some(({ observations }) => observations.some(({ catalogId: id }) => id === catalogId)));
  assert.doesNotMatch(JSON.stringify(records),
    /(?:\/private\/|\/Users\/|data\/ocr\/|assets\/kanagawa-1996|assets\/folios\/kanagawa-1996|\.pdf|\.png|\.webp)/iu);
});

test("Merrill, Prior, and Reeds retain locked facts and expected comparison counts", () => {
  const expected = {
    "merrill-1916": { records: 560, reviewed: 2, pending: 558, comparisons: 2 },
    "prior-1923": { records: 949, reviewed: 762, pending: 187, comparisons: 72 },
    "reeds-1937": { records: 500, reviewed: 397, pending: 103, comparisons: 713 },
  };
  for (const [catalogId, counts] of Object.entries(expected)) {
    const descriptor = catalog.metadata.catalogs.find(({ id }) => id === catalogId);
    const records = catalog.records.filter((record) => record.catalogId === catalogId);
    const reviewed = records.filter((record) => Object.hasOwn(record, "metbull"));
    const entries = current37Comparisons().filter(({ observations }) =>
      observations.some((observation) => observation.catalogId === catalogId) &&
      observations.every((observation) => observation.catalogId !== "hamburg-1913"));
    assert.equal(descriptor.recordModel, "collection-entry");
    assert.equal(records.length, counts.records);
    assert.equal(reviewed.length, counts.reviewed);
    assert.equal(records.length - reviewed.length, counts.pending);
    assert(reviewed.every(({ metbull }) => metbull.matchType !== "unresolved"));
    assert.equal(entries.length, counts.comparisons);
    assert(entries.every(({ type, review }) => type === "comparison-only" && review.status === "unreviewed"));
    assert.deepEqual(folios.catalogs[catalogId], { displayPolicy: "blocked", rightsStatus: "undetermined", pages: [] });
    assert.deepEqual(folioReleaseLock.catalogs[catalogId], {
      displayPolicy: "blocked", rightsStatus: "undetermined", basis: null, basisUrl: null, pageIds: [],
    });
  }
});

test("corrected Tassin, Reeds, and distinct Merrill observations stay locked", () => {
  const recordById = new Map(catalog.records.map((record) => [record.id, record]));
  const tassin = recordById.get("obs-15cdc5bc-ea7d-4585-a49a-c341e9e8f465");
  assert.deepEqual([tassin.catalogId, tassin.entryOrder, tassin.name, tassin.catalogPages],
    ["tassin-1902", 334, "Wichita County", [698]]);
  assert.deepEqual(tassin.holdings[1], {
    description: "Weight, 212.4 grams. (a) Section with original and etched surface; weight, 143 grams; (b) section as above; weight, 69.40 grams. Both show coarse Widmannstättian figures, with nodules of troilite and flakes of schreibersite.",
    provenance: "The Shepard Collection, No. 26.",
    count: 2,
    weights: [{ grams: 212.4 }, { grams: 143 }, { grams: 69.4 }],
  });
  const reeds = recordById.get("obs-54b330c6-ef57-4899-bbe4-d952fa024fa9");
  assert.deepEqual({
    catalogId: reeds.catalogId, entryOrder: reeds.entryOrder, catalogPages: reeds.catalogPages,
    name: reeds.name, classification: reeds.classification, locality: reeds.locality,
    eventDate: reeds.eventDate, holding: reeds.holdings[0],
  }, {
    catalogId: "reeds-1937", entryOrder: 203, catalogPages: [579], name: "Ibbenbühren",
    classification: "Aerolite: Diogenite (hypersthene-achondrite) Chl.", locality: "Westphalia, Prussia, Germany",
    eventDate: "Fell: 1870, June 17, 2 P.M.",
    holding: { description: "(461) 0.18 gm.", provenance: null, count: null, weights: [{ grams: 0.18 }] },
  });
  const merrillIds = ["obs-a0e7dd8b-7e93-4348-82c9-6e43f04c328f", "obs-34a0884f-e8e1-48da-908c-a670851b8821"];
  const merrill = merrillIds.map((id) => recordById.get(id));
  assert.deepEqual(merrill.map(({ id, entryOrder, catalogPages, section, name, count, holdings }) =>
    ({ id, entryOrder, catalogPages, section, name, count: holdings[0].count, weights: holdings[0].weights })), [
    { id: merrillIds[0], entryOrder: 316, catalogPages: [170], section: "A. Museum Collection", name: "WICHITA COUNTY (BRAZOS RIVER)", count: 2, weights: [{ grams: 20.8 }, { grams: 143 }] },
    { id: merrillIds[1], entryOrder: 556, catalogPages: [198], section: "B. The C. U. Shepard Collection", name: "WICHITA COUNTY (BRAZOS RIVER)", count: 2, weights: [{ grams: 143 }, { grams: 69.4 }] },
  ]);
  assert.match(merrill[0].holdings[0].description, /^Iron, Og\..*first known in 1836\..*Red River.*p\. 285\.$/u);
  assert.match(merrill[1].holdings[0].description, /Widmanstätten/u);
});

test("Ward 1881 remains priced context with no lineage or comparison output", () => {
  const catalogId = "ward-1881";
  const descriptor = catalog.metadata.catalogs.find(({ id }) => id === catalogId);
  const records = catalog.records.filter((record) => record.catalogId === catalogId);
  const holdings = records.flatMap((record) => record.holdings);
  assert.equal(descriptor.recordModel, "collection-entry");
  assert.equal(descriptor.recordCount, 3);
  assert.equal(descriptor.recordsWithWeight, 0);
  assert.deepEqual(records.map(({ id }) => id), [
    "obs-ba4b83e0-f5cd-499d-aec2-ceb8b8285b0a",
    "obs-b1be1364-10b5-4695-9053-743e6e4d6852",
    "obs-d3754743-885c-4a80-a57d-e44af0011d20",
  ]);
  assert.equal(holdings.length, 5);
  assert(holdings.every(({ provenance, count, weights, description }) =>
    provenance === null && count === null && weights.length === 0 && /(?:\$|cts\.)/u.test(description)));
  assert.deepEqual(folios.catalogs[catalogId], { displayPolicy: "blocked", rightsStatus: "undetermined", pages: [] });
  assert.equal(catalogComparisons(catalogId).length, 0);
  assert(!published.relationships.some(({ observations }) => observations.some(({ catalogId: id }) => id === catalogId)));
});

test("Ward 1904 and Farrington 1916 retain locked facts and comparison-only output", () => {
  const expected = {
    "ward-1904": {
      records: 697, reviewed: 72, pending: 625, sourcePages: 74, citedPages: 74, recordsWithWeight: 608, comparisons: 12,
      recordsHash: "026b144da17bf95a56836315f3109ff4c8e917b806302c89c2cf36f19a864aad",
      idsHash: "4613f97ab8fabbd19e071a083e5ef2fed9c2619b1e8b456e4597ac072b6b4609",
    },
    "farrington-1916": {
      records: 738, reviewed: 488, pending: 250, sourcePages: 82, citedPages: 78, recordsWithWeight: 723, comparisons: 249,
      recordsHash: "bf1c3b9ff5112b4b85d28eb04c1235ab12ad1f342d641595c3998df09dea272e",
      idsHash: "45ec57f34d7baff5aab5edeb19f85e977b6fddf975e1ebd63c9e74fc93db9f37",
    },
  };
  for (const [catalogId, counts] of Object.entries(expected)) {
    const descriptor = catalog.metadata.catalogs.find(({ id }) => id === catalogId);
    const records = catalog.records.filter((record) => record.catalogId === catalogId);
    const reviewed = records.filter((record) => Object.hasOwn(record, "metbull"));
    const entries = current37Comparisons().filter(({ observations }) =>
      observations.some((observation) => observation.catalogId === catalogId) &&
      observations.every((observation) => observation.catalogId !== "hamburg-1913"));
    assert.equal(descriptor.recordModel, "collection-entry");
    assert.equal(descriptor.sourcePageCount, counts.sourcePages);
    assert.equal(new Set(records.flatMap(({ catalogPages }) => catalogPages)).size, counts.citedPages);
    assert.equal(descriptor.recordsWithWeight, counts.recordsWithWeight);
    assert.equal(records.length, counts.records);
    assert.equal(reviewed.length, counts.reviewed);
    assert.equal(records.length - reviewed.length, counts.pending);
    assert.equal(createHash("sha256").update(JSON.stringify(records)).digest("hex"), counts.recordsHash);
    assert.equal(createHash("sha256").update(JSON.stringify(records.map(({ id }) => id))).digest("hex"), counts.idsHash);
    assert.equal(entries.length, counts.comparisons);
    assert(entries.every(({ type }) => type === "comparison-only"));
    assert(!published.relationships.some(({ observations }) => observations.some(({ catalogId: id }) => id === catalogId)));
  }
});

test("Foote 1912 retains accepted facts and deterministic unreviewed comparisons", () => {
  const catalogId = "foote-1912";
  const descriptor = catalog.metadata.catalogs.find(({ id }) => id === catalogId);
  const records = catalog.records.filter((record) => record.catalogId === catalogId);
  const holdings = records.flatMap((record) => record.holdings);
  const weights = holdings.flatMap((holding) => holding.weights);
  const reviewed = records.filter((record) => Object.hasOwn(record, "metbull"));
  assert.equal(descriptor.recordCount, 205);
  assert.deepEqual(descriptor.sourcePages, Array.from({ length: 35 }, (_, index) => index + 27));
  assert.equal(records.length, 205);
  assert.deepEqual(records.map(({ entryOrder }) => entryOrder), Array.from({ length: 205 }, (_, index) => index + 1));
  assert.equal(holdings.length, 227);
  assert.equal(weights.length, 227);
  assert.equal(Math.round(weights.reduce((sum, { grams }) => sum + grams, 0) * 10) / 10, 36111.9);
  assert.equal(reviewed.length, 133);
  assert.equal(records.length - reviewed.length, 72);
  assert.equal(createHash("sha256").update(JSON.stringify(records)).digest("hex"),
    "dbb41d1ed89058656a6804b298da5d8dd2077381375d5af58e1ae7c71f8b3f5e");
  assert.deepEqual(folios.catalogs[catalogId], { displayPolicy: "blocked", rightsStatus: "undetermined", pages: [] });
  const entries = current37Comparisons().filter(({ observations }) =>
    observations.some((observation) => observation.catalogId === catalogId));
  assert.equal(entries.length, 17);
  assert(entries.every(({ type, basis, review, identity }) =>
    type === "comparison-only" && basis === "reviewed-identity-and-reported-mass" &&
    review.status === "unreviewed" && identity.method === "metbull-code"));
  assert.deepEqual(entries.reduce((counts, { evidence }) => {
    counts[evidence.massMatch] += 1;
    return counts;
  }, { exact: 0, near: 0 }), { exact: 15, near: 2 });
  assert.doesNotMatch(JSON.stringify(records),
    /(?:\/private\/|\/Users\/|source-images|assets\/foote-1912|assets\/folios\/foote-1912|\.(?:pdf|png|webp|txt|csv))/iu);
});

test("Anderson, Astapovich, and Kantor mappings remain complete without lineage output", () => {
  const expected = {
    "anderson-1913": { records: 57, resolved: 52, unresolved: 5, sourcePages: 26, citedPages: 13, holdings: 57, weights: 0, recordsHash: "420a21059cbc5d451acbe1c405aaf92c5ca4583fa0a56f59ed67c39a850550a9" },
    "astapovich-1938": { records: 90, resolved: 81, unresolved: 9, sourcePages: 3, citedPages: 2, holdings: 90, weights: 0, recordsHash: "d7131106981cd98b11220559ac314bb624f095648aa9411fd67b2a2d8feefdaf" },
    "kantor-1920": { records: 30, resolved: 27, unresolved: 3, sourcePages: 35, citedPages: 16, holdings: 34, weights: 34, recordsHash: "576dc3060705c1f20f3826051d37540d2e6e8216f469c58ee01c5ba2726d739c" },
  };
  for (const [catalogId, counts] of Object.entries(expected)) {
    const descriptor = catalog.metadata.catalogs.find(({ id }) => id === catalogId);
    const records = catalog.records.filter((record) => record.catalogId === catalogId);
    const reviewed = records.filter((record) => Object.hasOwn(record, "metbull"));
    const holdings = records.flatMap((record) => record.holdings);
    const weights = holdings.flatMap((holding) => holding.weights);
    assert.equal(descriptor.recordModel, "collection-entry");
    assert.equal(descriptor.sourcePageCount, counts.sourcePages);
    assert.equal(new Set(records.flatMap(({ catalogPages }) => catalogPages)).size, counts.citedPages);
    assert.equal(records.length, counts.records);
    assert.equal(reviewed.filter(({ metbull }) => metbull.matchType !== "unresolved").length, counts.resolved);
    assert.equal(reviewed.filter(({ metbull }) => metbull.matchType === "unresolved").length, counts.unresolved);
    assert.equal(records.length - reviewed.length, 0);
    assert.equal(holdings.length, counts.holdings);
    assert.equal(weights.length, counts.weights);
    assert.equal(createHash("sha256").update(JSON.stringify(records)).digest("hex"), counts.recordsHash);
    assert.deepEqual(folios.catalogs[catalogId], { displayPolicy: "blocked", rightsStatus: "undetermined", pages: [] });
    assert.equal(catalogComparisons(catalogId).length, 0);
    assert(!published.relationships.some(({ observations }) => observations.some(({ catalogId: id }) => id === catalogId)));
  }
  assert.doesNotMatch(JSON.stringify(catalog.records.filter(({ catalogId }) => Object.hasOwn(expected, catalogId))),
    /(?:\/private\/|\/Users\/|source-images|data\/ocr|assets\/|file:\/\/|\.(?:pdf|png|webp|tiff?|txt|csv))/iu);
});

test("weighted observations without reviewed MetBull mappings remain excluded", () => {
  const changed = clone(catalog);
  const weighted = changed.records.find((record) => record.metbull && record.weight?.grams !== null);
  delete weighted.metbull;
  assert.equal(flattenMassObservations(changed).length, flattenMassObservations(catalog).length - 1);
});

test("Huss continuity remains strict inventory equality and ignores mass change", () => {
  const huss = published.relationships.filter(({ collectionSeries }) => collectionSeries.id === "huss");
  assert.deepEqual(huss.map(({ collectionSeries }) => collectionSeries.inventoryId).toSorted(), ["h160.1", "h160.2"]);
  assert.deepEqual(sameInventory("huss", "h160.1").observations.map(({ designation, massGrams }) => [designation, massGrams]).toSorted(), [
    ["(2)H160.1", 4.3], ["H160.1", 3.4],
  ]);
  assert.deepEqual(sameInventory("huss", "h160.2").observations.map(({ designation, massGrams }) => [designation, massGrams]).toSorted(), [
    ["(2)H160.2", 0.8], ["H160.2", 7.1],
  ]);
  const wellmanIds = new Set([
    catalog.records.find(({ catalogId, designation }) => catalogId === "huss-1976" && designation === "H39.116").id,
    catalog.records.find(({ catalogId, designation }) => catalogId === "huss-1986" && designation === "(2)H39.417").id,
  ]);
  assert(!published.relationships.some(({ observations }) => observations.every(({ recordId }) => wellmanIds.has(recordId))));
  const pair = published.metadata.counts.catalogPairs.find(({ catalogPair }) => catalogPair === "huss-1976|huss-1986");
  assert.deepEqual(pair, {
    catalogPair: "huss-1976|huss-1986", sameInventoryCount: 2, comparisonGroupCount: 0, comparisonCandidateCount: 0,
  });
});

test("same-series continuity survives missing mass while comparisons require masses", () => {
  const changed = clone(catalog);
  changed.records.find(({ catalogId, designation }) =>
    catalogId === "huss-1986" && designation === "(2)H160.1").weight.grams = null;
  const rebuilt = buildSpecimenLineages(changed);
  const relationship = sameInventory("huss", "h160.1", rebuilt);
  assert.ok(relationship);
  assert(relationship.observations.some(({ massGrams }) => massGrams === null));
  assert.equal(rebuilt.metadata.source.flattenedMassObservationCount, 17159);
  for (const candidate of candidates()) {
    const [left, right] = candidate.observations;
    assert(Number.isFinite(left.massGrams) && Number.isFinite(right.massGrams));
  }
});

test("collection series remain separate namespaces and differing IDs do not link", () => {
  for (const relationship of published.relationships) {
    const expectedCatalogs = published.metadata.collectionSeries.find(({ id }) => id === relationship.collectionSeries.id).catalogIds;
    assert(relationship.observations.every(({ catalogId }) => expectedCatalogs.includes(catalogId)));
  }
  for (const candidate of candidates()) {
    const namespaces = candidate.observations.map(({ catalogId }) =>
      published.metadata.collectionSeries.find(({ catalogIds }) => catalogIds.includes(catalogId))?.id || catalogId);
    assert.notEqual(namespaces[0], namespaces[1]);
  }
  const sameKeyInAnotherSeries = clone(catalog);
  const rosebud = sameKeyInAnotherSeries.records.find(({ catalogId, name }) => catalogId === "nininger-1950" && name === "Rosebud");
  rosebud.designation = "H160.1";
  const rebuilt = buildSpecimenLineages(sameKeyInAnotherSeries);
  assert(!rebuilt.relationships.some(({ observations }) => observations.some(({ recordId }) => recordId === rosebud.id)));
});

test("Nininger 108b collision resolves only Sandia and omits ambiguity", () => {
  const relationship = sameInventory("nininger", "108b");
  assert.deepEqual(relationship.observations.map(({ sourceName }) => sourceName).toSorted(), ["Sandia Mountains", "Sandia Mts."]);
  assert(!relationship.observations.some(({ sourceName }) => sourceName === "Rosebud"));
  assert.equal(published.metadata.counts.identityResolvedInventoryCollisionCount, 1);
  const ambiguous = clone(catalog);
  const duplicate = clone(ambiguous.records.find(({ catalogId, name }) =>
    catalogId === "nininger-1950" && name === "Sandia Mountains"));
  duplicate.id = "synthetic-duplicate-sandia-108b";
  ambiguous.records.push(duplicate);
  const rebuilt = buildSpecimenLineages(ambiguous);
  assert.equal(sameInventory("nininger", "108b", rebuilt), undefined);
  assert.equal(rebuilt.metadata.counts.omittedAmbiguousInventoryKeyCount, 2);
});

test("cross-series comparisons enforce exact and near mass thresholds", () => {
  const entries = comparisonEntries();
  assert.equal(entries.length, 2245);
  assert(entries.some(({ evidence }) => evidence.massMatch === "exact"));
  assert(entries.some(({ evidence }) => evidence.massMatch === "near"));
  assert(entries.every(({ identity }) => identity.method === "metbull-code"));
  assert(entries.some(({ catalogPair }) => catalogPair === "huss-1976|nininger-1950"));
  for (const candidate of candidates()) {
    const [left, right] = candidate.observations;
    const difference = Math.abs(left.massGrams - right.massGrams);
    const relative = difference / Math.max(left.massGrams, right.massGrams);
    assert(difference === 0 || (Math.min(left.massGrams, right.massGrams) >= 10 && difference <= 2 && relative <= 0.0025));
  }

  const unresolved = clone(catalog);
  const left = unresolved.records.find(({ catalogId }) => catalogId === "huss-1976");
  const right = unresolved.records.find(({ catalogId }) => catalogId === "nininger-1950");
  for (const record of [left, right]) {
    record.name = "Synthetic unresolved name";
    record.weight.grams = 123;
    record.metbull = { matchType: "unresolved", canonicalName: null, meteoriteCode: null, metbullUrl: null, alternateNameNote: null };
  }
  const endpointIds = new Set([left.id, right.id]);
  const exact = candidates(buildSpecimenLineages(unresolved)).find(({ observations }) =>
    observations.every(({ recordId }) => endpointIds.has(recordId)));
  assert.ok(exact);
  const exactGroup = buildSpecimenLineages(unresolved).comparisonGroups.find(({ candidates: values }) =>
    values.some(({ id }) => id === exact.id));
  assert.equal(exactGroup.identity.method, "normalized-source-name");
  assert.equal(exact.evidence.massMatch, "exact");
  right.weight.grams = 130;
  assert(!candidates(buildSpecimenLineages(unresolved)).some(({ observations }) =>
    observations.every(({ recordId }) => endpointIds.has(recordId))));
});

test("stable relationship, candidate, group, and observation UUIDs use immutable references", () => {
  const observationIds = new Set();
  for (const relationship of published.relationships) {
    const references = relationship.observations.map(({ recordId, designationPath }) => `${recordId}\u0000${designationPath}`).toSorted();
    const candidateReference = references.join("\u0001");
    assert.equal(relationship.id, `same-inventory-lineage-${uuidV5(`same-inventory-lineage\u0000${relationship.collectionSeries.id}\u0000${relationship.collectionSeries.inventoryId}\u0000${candidateReference}`)}`);
    for (const observation of relationship.observations) {
      assert(!observationIds.has(observation.id));
      observationIds.add(observation.id);
      const reference = `${observation.recordId}\u0000${observation.designationPath}`;
      assert.equal(observation.id, `inventory-observation-${uuidV5(`inventory-observation\u0000${candidateReference}\u0000${reference}`)}`);
    }
  }
  for (const group of published.comparisonGroups) {
    const groupReference = ["comparison-group", group.identity.method, group.identity.key,
      ...group.massPair.flatMap(({ catalogId, massGrams }) => [catalogId, JSON.stringify(massGrams)])].join("\u0000");
    assert.equal(group.id, `comparison-group-${uuidV5(groupReference)}`);
    for (const candidate of group.candidates) {
      const references = candidate.observations.map(({ recordId, massPath }) => `${recordId}\u0000${massPath}`).toSorted();
      const candidateReference = references.join("\u0001");
      assert.equal(candidate.v3CandidateId, `possible-lineage-${uuidV5(`possible-lineage\u0000${candidateReference}`)}`);
      assert.equal(candidate.id, candidate.v3CandidateId.replace("possible-lineage-", "comparison-candidate-"));
      for (const observation of candidate.observations) {
        assert(!observationIds.has(observation.id));
        observationIds.add(observation.id);
        const reference = `${observation.recordId}\u0000${observation.massPath}`;
        assert.equal(observation.id, `mass-observation-${uuidV5(`mass-observation\u0000${candidateReference}\u0000${reference}`)}`);
      }
    }
  }
});

test("reviews apply only to neutral comparison candidates with complete semantics", () => {
  const target = current37Comparisons().find(({ review }) => review.status === "unreviewed");
  const reviews = {
    schemaVersion: 1,
    reviews: [{
      candidateId: target.id,
      outcome: "retain-as-possible",
      reviewedOn: "2026-07-28",
      publicNote: "The matching public facts remain suitable for comparison.",
      citations: [{ label: "Meteoritical Bulletin", url: "https://www.lpi.usra.edu/meteor/" }],
    }],
  };
  const rebuilt = buildSpecimenLineages(catalog, reviews);
  const reviewed = candidates(rebuilt).find(({ id }) => id === target.id);
  assert.deepEqual(reviewed.review, {
    status: "reviewed",
    outcome: "retain-as-possible",
    reviewedOn: "2026-07-28",
    publicNote: "The matching public facts remain suitable for comparison.",
    citations: [{ label: "Meteoritical Bulletin", url: "https://www.lpi.usra.edu/meteor/" }],
  });
  assert.equal(rebuilt.metadata.counts.reviewedComparisonCandidateCount, 1);
  assert.equal(rebuilt.metadata.counts.unreviewedComparisonCandidateCount, 1342);
  assert.throws(() => buildSpecimenLineages(catalog, {
    schemaVersion: 1,
    reviews: [{ ...reviews.reviews[0], candidateId: sameInventory("huss", "h160.1").id }],
  }), /candidateId is invalid|dangling/iu);
});
