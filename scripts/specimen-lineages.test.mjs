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
const reviewSource = JSON.parse(await readFile(new URL("../data/specimen-lineage-reviews.json", import.meta.url), "utf8"));
const reviewSchema = JSON.parse(await readFile(new URL("../data/specimen-lineage-reviews.schema.json", import.meta.url), "utf8"));
const folios = JSON.parse(await readFile(new URL("../data/folios.json", import.meta.url), "utf8"));
const folioReleaseLock = JSON.parse(await readFile(new URL("./folio-release-lock.json", import.meta.url), "utf8"));

function clone(value) {
  return structuredClone(value);
}

function sameInventory(seriesId, inventoryId) {
  return published.relationships.find((relationship) => relationship.relationship === "same-inventory" &&
    relationship.collectionSeries.id === seriesId && relationship.collectionSeries.inventoryId === inventoryId);
}

function possibleRelationships(document = published) {
  return document.relationships.filter(({ relationship }) => relationship === "possible-match");
}

function mutate(label, callback, pattern = /invalid|must|differs|private|unsupported|unsafe/iu) {
  const value = clone(published);
  callback(value);
  assert.throws(() => validateSpecimenLineages(value, catalog, reviewSource), pattern, label);
}

test("build is deterministic, canonical, and identical to the published file", () => {
  const first = serializeSpecimenLineages(buildSpecimenLineages(catalog, reviewSource));
  const second = serializeSpecimenLineages(buildSpecimenLineages(clone(catalog), clone(reviewSource)));
  const reorderedCatalog = clone(catalog);
  reorderedCatalog.records.reverse();
  const reordered = serializeSpecimenLineages(buildSpecimenLineages(reorderedCatalog, reviewSource));

  assert.equal(first, second);
  assert.equal(first, reordered);
  assert.equal(first, publishedText);
  assert.ok(first.endsWith("\n"));
  assert.deepEqual(published.relationships.map(({ id }) => id), published.relationships.map(({ id }) => id).toSorted());
  for (const relationship of published.relationships) {
    assert.deepEqual(relationship.observations.map(({ id }) => id), relationship.observations.map(({ id }) => id).toSorted());
  }
  assert.deepEqual(
    published.metadata.counts.catalogPairs.map(({ catalogPair }) => catalogPair),
    published.metadata.counts.catalogPairs.map(({ catalogPair }) => catalogPair).toSorted(),
  );
  assert.equal(JSON.stringify(catalog), JSON.stringify(JSON.parse(catalogText)));
});

test("publishes locked source and relationship counts", () => {
  assert.equal(flattenMassObservations(catalog).length, 14092);
  assert.equal(flattenInventoryObservations(catalog).length, 3627);
  assert.deepEqual(published.metadata.source, {
    catalogSchemaVersion: 8,
    recordCount: 14176,
    catalogCount: 37,
    flattenedMassObservationCount: 14092,
    inventoryObservationCount: 3627,
  });
  const { catalogPairs, ...counts } = published.metadata.counts;
  assert.deepEqual(counts, {
    relationshipCount: 1489,
    sameInventoryRelationshipCount: 195,
    possibleMatchRelationshipCount: 1294,
    unreviewedPossibleMatchCount: 1290,
    exactMassPossibleMatchCount: 1071,
    nearMassPossibleMatchCount: 223,
    metbullIdentityPossibleMatchCount: 1294,
    normalizedNameIdentityPossibleMatchCount: 0,
    sameDesignationPossibleMatchCount: 0,
    designationFamilyPossibleMatchCount: 0,
    aggregateOrMultiplePossibleMatchCount: 41,
    castPossibleMatchCount: 0,
    identityResolvedInventoryCollisionCount: 1,
    omittedAmbiguousInventoryKeyCount: 0,
    possibleMatchEvidenceStrength: {
      "multiple-matching-facts": 0,
      "two-matching-facts": 1071,
      "limited-matching-evidence": 223,
    },
  });
  assert.equal(catalogPairs.length, 94);
  assert.equal(
    createHash("sha256").update(JSON.stringify(catalogPairs)).digest("hex"),
    "5f408f7598bc13393407dc150708531bdba937694b2edadbebbed72f26090e33",
  );
  assert.equal(createHash("sha256").update(publishedText).digest("hex"),
    "45cf8f37dc8d28f1094bc7b15ce4ac74b55ca92e4213d126331660b959d15cd1");
  assert.equal(createHash("sha256").update(JSON.stringify(published.relationships)).digest("hex"),
    "50143b2be98d9b5bbd00ee678fb98dedfcf15998f5fb5da82f695df2a7592cbe");
});

test("Hodge-Smith census facts and unmapped Victoria specimens add no physical-lineage assertion", () => {
  const hodge = catalog.records.filter(({ catalogId }) => catalogId === "hodge-smith-1939");
  const victoria = catalog.records.filter(({ catalogId }) => catalogId === "victoria-land-1982");
  assert.equal(hodge.length, 84);
  assert.equal(hodge.filter((record) => Object.hasOwn(record, "metbull")).length, 58);
  assert.equal(victoria.length, 273);
  assert.equal(victoria.filter((record) => Object.hasOwn(record, "metbull")).length, 0);
  assert.equal(victoria.reduce((sum, record) => sum + record.weight.grams, 0), 969562.2);
  assert.equal(createHash("sha256").update(JSON.stringify(hodge)).digest("hex"),
    "7ca605ed679a55b21cae9574f9f33665a3d4665db7a40eceb2017e57781980b5");
  assert.equal(createHash("sha256").update(JSON.stringify(victoria)).digest("hex"),
    "b81e441cb9a672f487ff4c9fe0b8315d1c932dced461e23bf3b9f41d5f2e5595");
  for (const catalogId of ["hodge-smith-1939", "victoria-land-1982"]) {
    assert.deepEqual(folios.catalogs[catalogId], {
      displayPolicy: "blocked", rightsStatus: "undetermined", pages: [],
    });
    assert.deepEqual(folioReleaseLock.catalogs[catalogId], {
      displayPolicy: "blocked", rightsStatus: "undetermined", basis: null, basisUrl: null, pageIds: [],
    });
    assert(!folioReleaseLock.assets.some(({ path }) => path.includes(catalogId)));
    const relationships = published.relationships.filter(({ observations }) =>
      observations.some((observation) => observation.catalogId === catalogId));
    assert(relationships.every(({ relationship, status }) => relationship === "possible-match" && status === "possible"));
    assert(!relationships.some(({ relationship }) => relationship === "same-inventory"));
  }
});

test("ASU September 2024 retains source facts while reviewed mappings enable lineage candidates", () => {
  const asu = catalog.records.filter(({ catalogId }) => catalogId === "asu-2024-09");
  const designationCounts = new Map();
  asu.forEach(({ designation }) => designationCounts.set(designation, (designationCounts.get(designation) || 0) + 1));

  assert.equal(asu.length, 2169);
  assert.equal(designationCounts.size, 2166);
  assert.deepEqual([...designationCounts].filter(([, count]) => count > 1), [["91", 2], ["157", 2], ["607", 2]]);
  assert.equal(asu.filter((record) => Object.hasOwn(record, "metbull")).length, 2088);
  assert.equal(published.relationships.filter(({ observations }) =>
    observations.some(({ catalogId }) => catalogId === "asu-2024-09")).length, 14);
});

test("Barnes participates only in unreviewed reviewed-identity-and-mass candidates", () => {
  const relationships = published.relationships.filter(({ observations }) =>
    observations.some(({ catalogId }) => catalogId === "barnes-1940"));
  assert.equal(relationships.length, 127);
  assert(relationships.every(({ relationship, basis, status, review, identity }) =>
    relationship === "possible-match" && basis === "reviewed-identity-and-reported-mass" &&
    status === "possible" && review.status === "unreviewed" && identity.method === "metbull-code"));
  assert.deepEqual(
    relationships.reduce((counts, { evidence }) => {
      counts[evidence.massMatch] += 1;
      return counts;
    }, { exact: 0, near: 0 }),
    { exact: 119, near: 8 },
  );
  assert.deepEqual(
    relationships.reduce((counts, { catalogPair }) => {
      counts[catalogPair] = (counts[catalogPair] || 0) + 1;
      return counts;
    }, {}),
    {
      "barnes-1940|farrington-1903": 8,
      "barnes-1940|farrington-1916": 26,
      "barnes-1940|mason-1964": 16,
      "barnes-1940|nininger-1933": 7,
      "barnes-1940|nininger-1950": 9,
      "barnes-1940|palache-1926": 15,
      "barnes-1940|prior-1923": 15,
      "barnes-1940|reeds-1937": 29,
      "barnes-1940|tassin-1902": 1,
      "barnes-1940|usnm-1886": 1,
    },
  );
  assert(!published.relationships.some(({ relationship, observations }) =>
    relationship === "same-inventory" && observations.some(({ catalogId }) => catalogId === "barnes-1940")));
});

test("Palache publishes only locked facts and blocked folios", () => {
  const descriptor = catalog.metadata.catalogs.find(({ id }) => id === "palache-1926");
  const records = catalog.records.filter(({ catalogId }) => catalogId === "palache-1926");
  const reviewed = records.filter((record) => Object.hasOwn(record, "metbull"));
  const weights = records.flatMap(({ holdings }) => holdings.flatMap(({ weights: values }) => values));
  const baseRecordKeys = [
    "catalogId", "catalogPages", "classification", "confidence", "entryOrder", "eventDate", "holdings",
    "id", "locality", "name", "reportedNumber", "section",
  ].sort();

  assert.equal(catalog.metadata.catalogs.length, 37);
  assert.equal(catalog.records.length, 14176);
  assert.deepEqual(descriptor.sourcePages, [151, 152, 153, 154, 155, 156, 157, 158, 159]);
  assert.equal(descriptor.sourcePageCount, 9);
  assert.equal(descriptor.recordCount, 361);
  assert.equal(descriptor.compiler, "Charles Palache");
  assert.equal(descriptor.folioDisplayPolicy, "blocked");
  assert.equal(descriptor.rightsStatus, "undetermined");
  assert.equal(records.length, 361);
  assert.equal(records[0].name, "Adargas");
  assert.equal(records.at(-1).name, "Zavid");
  assert.deepEqual([...new Set(records.flatMap(({ catalogPages }) => catalogPages))], [152, 153, 154, 155, 156, 157, 158, 159]);
  assert.equal(records.reduce((sum, { holdings }) => sum + holdings.length, 0), 361);
  assert.equal(weights.length, 717);
  assert.equal(weights.reduce((sum, { grams }) => sum + grams, 0), 2695373.57);
  assert.equal(reviewed.length, 285);
  assert(reviewed.every(({ metbull }) => metbull.matchType === "exact"));
  assert.equal(records.length - reviewed.length, 76);
  assert.deepEqual(folios.catalogs["palache-1926"], {
    displayPolicy: "blocked",
    rightsStatus: "undetermined",
    pages: [],
  });

  for (const record of records) {
    const expectedKeys = Object.hasOwn(record, "metbull") ? [...baseRecordKeys, "metbull"].sort() : baseRecordKeys;
    assert.deepEqual(Object.keys(record).sort(), expectedKeys);
    for (const holding of record.holdings) {
      assert.deepEqual(Object.keys(holding).sort(), ["count", "description", "provenance", "weights"]);
      holding.weights.forEach((weight) => assert.deepEqual(Object.keys(weight), ["grams"]));
    }
  }

  const allReviewed = catalog.records.filter((record) => Object.hasOwn(record, "metbull"));
  assert.equal(allReviewed.length, 10537);
  assert.equal(allReviewed.filter(({ metbull }) => metbull.matchType === "unresolved").length, 241);
  assert.equal(allReviewed.filter(({ metbull }) => metbull.matchType !== "unresolved").length, 10296);
  assert.equal(catalog.records.length - allReviewed.length, 3639);
});

test("Madrid publishes the accepted facts, blocked folios, atomic holdings, and only new unreviewed candidates", () => {
  const catalogId = "madrid-1923";
  const descriptor = catalog.metadata.catalogs.find(({ id }) => id === catalogId);
  const records = catalog.records.filter((record) => record.catalogId === catalogId);
  const holdings = records.flatMap((record) => record.holdings);
  const weights = holdings.flatMap((holding) => holding.weights);
  const relationships = published.relationships.filter(({ observations }) =>
    observations.some(({ catalogId: observationCatalogId }) => observationCatalogId === catalogId));

  assert.deepEqual(descriptor, {
    id: catalogId,
    recordModel: "collection-entry",
    label: "Los Meteoritos del Museo de Madrid (1923)",
    compiler: "Lucas Fernández Navarro",
    year: 1923,
    sourcePages: [224, 225, 226, 227, 228, 229, 230, 231, 232, 233],
    sourcePageCount: 10,
    recordCount: 130,
    recordsWithDesignation: 0,
    recordsWithWeight: 130,
    confidenceCounts: { high: 125, medium: 5, low: 0 },
    folioDisplayPolicy: "blocked",
    rightsStatus: "undetermined",
  });
  assert.equal(records.length, 130);
  assert.equal(holdings.length, 168);
  assert.equal(holdings.length - records.length, 38);
  assert.equal(records.filter(({ holdings: values }) => values.length > 1).length, 23);
  assert.equal(weights.length, 168);
  assert.equal(Math.round(weights.reduce((sum, { grams }) => sum + grams, 0) * 100) / 100, 190083.41);
  assert.deepEqual(
    holdings.reduce((counts, { description }) => ({ ...counts, [description]: (counts[description] || 0) + 1 }), {}),
    { Specimen: 151, "Specimen group": 17 },
  );
  assert.equal(records.filter(({ metbull }) => metbull.matchType !== "unresolved").length, 84);
  assert.equal(records.filter(({ metbull }) => metbull.matchType === "unresolved").length, 46);
  assert.equal(createHash("sha256").update(JSON.stringify(records)).digest("hex"),
    "261dfbb110b03c55964da0a193547732689d259c0d8c4eb996e1e4039ae575e0");
  assert.equal(createHash("sha256").update(JSON.stringify(records.map(({ id }) => id))).digest("hex"),
    "4db21953aa7bba881c8a1a5c940a0dd82425e9262687f54cd2d270ad8ae45eba");
  assert.deepEqual(folios.catalogs[catalogId], {
    displayPolicy: "blocked", rightsStatus: "undetermined", pages: [],
  });
  assert.deepEqual(folioReleaseLock.catalogs[catalogId], {
    displayPolicy: "blocked", rightsStatus: "undetermined", basis: null, basisUrl: null, pageIds: [],
  });
  assert(!folioReleaseLock.assets.some(({ path }) => path.includes(catalogId)));
  assert(!published.metadata.collectionSeries.some(({ catalogIds }) => catalogIds.includes(catalogId)));
  assert.equal(relationships.length, 3);
  assert(relationships.every(({ relationship, status, review }) =>
    relationship === "possible-match" && status === "possible" && review.status === "unreviewed"));
  assert.deepEqual(relationships.map(({ catalogPair }) => catalogPair).toSorted(), [
    "madrid-1923|nininger-1950", "madrid-1923|prior-1923", "madrid-1923|reeds-1937",
  ]);
  assert(!published.relationships.some(({ relationship, observations }) =>
    relationship === "same-inventory" && observations.some(({ catalogId: id }) => id === catalogId)));
  assert.doesNotMatch(JSON.stringify(records),
    /(?:\/private\/|\/Users\/|source-images|data\/ocr|assets\/|file:\/\/|\.(?:pdf|png|webp|tiff?|txt|csv))/iu);
});

test("Hamburg adds exactly four reviewed possible matches without mutating prior relationships", () => {
  const hamburg = published.relationships.filter(({ observations }) =>
    observations.some(({ catalogId }) => catalogId === "hamburg-1913"));
  assert.equal(hamburg.length, 4);
  assert(hamburg.every(({ relationship, status, review }) =>
    relationship === "possible-match" && status === "possible" &&
    review.status === "reviewed" && review.outcome === "retain-as-possible"));
  assert(!hamburg.some(({ relationship }) => relationship === "same-inventory"));
  assert.deepEqual(hamburg.map(({ id }) => id).toSorted(), [
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
  assert.equal(createHash("sha256").update(JSON.stringify(published.relationships.filter(({ observations }) =>
    observations.every(({ catalogId }) => catalogId !== "hamburg-1913")))).digest("hex"),
  "ecb5eb2384a85094e06b9b3230094f5fc20de2c7e805ee98b0b743887423e1a3");
});

test("Palache has no same-inventory continuity and only unreviewed possible candidates", () => {
  const relationships = published.relationships.filter(({ observations }) =>
    observations.some(({ catalogId }) => catalogId === "palache-1926"));
  assert.equal(relationships.length, 70);
  assert(!published.metadata.collectionSeries.some(({ catalogIds }) => catalogIds.includes("palache-1926")));
  assert(relationships.every(({ relationship, basis, status, review, identity }) =>
    relationship === "possible-match" && basis === "reviewed-identity-and-reported-mass" &&
    status === "possible" && review.status === "unreviewed" && identity.method === "metbull-code"));
  assert.deepEqual(
    relationships.reduce((counts, { evidence }) => {
      counts[evidence.massMatch] += 1;
      return counts;
    }, { exact: 0, near: 0 }),
    { exact: 68, near: 2 },
  );
  assert(!published.relationships.some(({ relationship, observations }) =>
    relationship === "same-inventory" && observations.some(({ catalogId }) => catalogId === "palache-1926")));
});

test("Kanagawa publishes only the approved controlled facts with no glass mappings, folios, or lineages", () => {
  const descriptor = catalog.metadata.catalogs.find(({ id }) => id === "kanagawa-1996");
  const records = catalog.records.filter(({ catalogId }) => catalogId === "kanagawa-1996");
  const meteorites = records.filter(({ entryOrder }) => entryOrder <= 80);
  const glass = records.filter(({ entryOrder }) => entryOrder >= 81);
  const holdings = records.flatMap(({ holdings: values }) => values);
  const weights = holdings.flatMap(({ weights: values }) => values);
  const reviewed = records.filter((record) => Object.hasOwn(record, "metbull"));
  const baseRecordKeys = [
    "catalogId", "catalogPages", "classification", "confidence", "entryOrder", "eventDate", "holdings",
    "id", "locality", "name", "reportedNumber", "section",
  ].sort();

  assert.deepEqual(Object.keys(descriptor).sort(), [
    "compiler", "confidenceCounts", "folioDisplayPolicy", "id", "label", "recordCount", "recordModel",
    "recordsWithDesignation", "recordsWithWeight", "rightsStatus", "sourcePageCount", "sourcePages", "year",
  ]);
  assert.equal(descriptor.compiler, "Kanagawa Prefectural Museum of Natural History");
  assert.equal(descriptor.label, "Meteorite Catalogue of the Kanagawa Prefectural Museum of Natural History (1996)");
  assert.equal(descriptor.recordModel, "collection-entry");
  assert.deepEqual(descriptor.sourcePages, [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24]);
  assert.equal(descriptor.recordCount, 232);
  assert.equal(descriptor.recordsWithWeight, 213);
  assert.equal(records.length, 232);
  assert.equal(meteorites.length, 80);
  assert.equal(glass.length, 152);
  assert.equal(records[0].name, "Orgueil");
  assert.equal(records.at(-1).name, "Philippinite");
  assert.deepEqual([...new Set(records.flatMap(({ catalogPages }) => catalogPages))], descriptor.sourcePages);
  assert(meteorites.every(({ section }) => section.split(" | ").length === 2));
  assert(glass.every(({ section }) => section === "IV. テクタイト目録"));
  assert.deepEqual(
    holdings.reduce((counts, { description }) => ({ ...counts, [description]: (counts[description] || 0) + 1 }), {}),
    { Specimen: 212, "Thin section": 19, "Specimen group": 1 },
  );
  assert.equal(holdings.length, 232);
  assert.equal(weights.length, 243);
  assert.equal(Math.round(weights.reduce((sum, { grams }) => sum + grams, 0) * 100) / 100, 2688123.61);
  assert.equal(reviewed.length, 68);
  assert(reviewed.every(({ entryOrder, metbull }) => entryOrder <= 80 && metbull.matchType === "exact"));
  assert.equal(records.length - reviewed.length, 164);
  assert(glass.every((record) => !Object.hasOwn(record, "metbull")));

  for (const record of records) {
    const expectedKeys = Object.hasOwn(record, "metbull") ? [...baseRecordKeys, "metbull"].sort() : baseRecordKeys;
    assert.deepEqual(Object.keys(record).sort(), expectedKeys);
    assert.equal(record.holdings.length, 1);
    assert.deepEqual(Object.keys(record.holdings[0]).sort(), ["count", "description", "provenance", "weights"]);
    record.holdings[0].weights.forEach((weight) => assert.deepEqual(Object.keys(weight), ["grams"]));
  }

  const abbott = records.find(({ reportedNumber }) => reportedNumber === "NLM000042");
  assert.equal(abbott.eventDate, "951年～1960年に発見");
  assert.equal(records.find(({ reportedNumber }) => reportedNumber === "NLM001147").name, "Australia (tektite)");
  assert.equal(records.find(({ reportedNumber }) => reportedNumber === "NLM001148").name, "Australia (tektite)");

  const forbiddenKeys = new Set([
    "dimensions", "displayWeight", "image", "images", "manifest", "media", "note", "notes", "ocr",
    "pageId", "pageIds", "path", "qa", "sourceDescription", "sourceFile", "sourcePath", "weightText",
  ]);
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (value === null || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert(!forbiddenKeys.has(key), `Kanagawa public record contains blocked key ${key}`);
      visit(child);
    }
  };
  records.forEach(visit);
  assert.doesNotMatch(JSON.stringify(records), /(?:\/private\/|\/Users\/|data\/ocr\/|assets\/kanagawa-1996|assets\/folios\/kanagawa-1996|\.pdf|\.png|\.webp)/iu);

  assert.deepEqual(folios.catalogs["kanagawa-1996"], {
    displayPolicy: "blocked",
    rightsStatus: "undetermined",
    pages: [],
  });
  assert.deepEqual(folioReleaseLock.catalogs["kanagawa-1996"], {
    displayPolicy: "blocked",
    rightsStatus: "undetermined",
    basis: null,
    basisUrl: null,
    pageIds: [],
  });
  assert(!folioReleaseLock.assets.some(({ path }) => path.includes("kanagawa-1996")));
  assert(!published.metadata.collectionSeries.some(({ catalogIds }) => catalogIds.includes("kanagawa-1996")));
  assert(!published.relationships.some(({ observations }) =>
    observations.some(({ catalogId }) => catalogId === "kanagawa-1996")));
  assert.equal(catalog.records.filter(({ catalogId }) => catalogId !== "kanagawa-1996").length, 13944);
});

test("Merrill, Prior, and Reeds publish locked facts with blocked folios and derived lineages", () => {
  const expected = {
    "merrill-1916": { records: 560, reviewed: 0, pending: 560, relationships: 0 },
    "prior-1923": { records: 949, reviewed: 758, pending: 191, relationships: 69 },
    "reeds-1937": { records: 500, reviewed: 390, pending: 110, relationships: 711 },
  };

  for (const [catalogId, counts] of Object.entries(expected)) {
    const descriptor = catalog.metadata.catalogs.find(({ id }) => id === catalogId);
    const records = catalog.records.filter((record) => record.catalogId === catalogId);
    const reviewed = records.filter((record) => Object.hasOwn(record, "metbull"));
    const relationships = published.relationships.filter(({ observations }) =>
      observations.some((observation) => observation.catalogId === catalogId) &&
      observations.every((observation) => observation.catalogId !== "hamburg-1913"));

    assert.equal(descriptor.recordModel, "collection-entry");
    assert.equal(descriptor.recordCount, counts.records);
    assert.equal(records.length, counts.records);
    assert.equal(reviewed.length, counts.reviewed);
    assert.equal(records.length - reviewed.length, counts.pending);
    assert(reviewed.every(({ metbull }) => metbull.matchType !== "unresolved"));
    assert.equal(relationships.length, counts.relationships);
    assert(relationships.every(({ relationship, review }) =>
      relationship === "possible-match" && review.status === "unreviewed"));
    assert.deepEqual(folios.catalogs[catalogId], {
      displayPolicy: "blocked",
      rightsStatus: "undetermined",
      pages: [],
    });
    assert.deepEqual(folioReleaseLock.catalogs[catalogId], {
      displayPolicy: "blocked",
      rightsStatus: "undetermined",
      basis: null,
      basisUrl: null,
      pageIds: [],
    });
    assert(!folioReleaseLock.assets.some(({ path }) => path.includes(catalogId)));
  }
});

test("publishes the corrected Tassin, Reeds, and distinct Merrill observations", () => {
  const recordById = new Map(catalog.records.map((record) => [record.id, record]));
  const tassin = recordById.get("obs-15cdc5bc-ea7d-4585-a49a-c341e9e8f465");
  assert.equal(tassin.catalogId, "tassin-1902");
  assert.equal(tassin.entryOrder, 334);
  assert.equal(tassin.name, "Wichita County");
  assert.deepEqual(tassin.catalogPages, [698]);
  assert.deepEqual(tassin.holdings[1], {
    description: "Weight, 212.4 grams. (a) Section with original and etched surface; weight, 143 grams; (b) section as above; weight, 69.40 grams. Both show coarse Widmannstättian figures, with nodules of troilite and flakes of schreibersite.",
    provenance: "The Shepard Collection, No. 26.",
    count: 2,
    weights: [{ grams: 212.4 }, { grams: 143 }, { grams: 69.4 }],
  });

  const reeds = recordById.get("obs-54b330c6-ef57-4899-bbe4-d952fa024fa9");
  assert.deepEqual({
    catalogId: reeds.catalogId,
    entryOrder: reeds.entryOrder,
    catalogPages: reeds.catalogPages,
    name: reeds.name,
    classification: reeds.classification,
    locality: reeds.locality,
    eventDate: reeds.eventDate,
    holding: reeds.holdings[0],
  }, {
    catalogId: "reeds-1937",
    entryOrder: 203,
    catalogPages: [579],
    name: "Ibbenbühren",
    classification: "Aerolite: Diogenite (hypersthene-achondrite) Chl.",
    locality: "Westphalia, Prussia, Germany",
    eventDate: "Fell: 1870, June 17, 2 P.M.",
    holding: {
      description: "(461) 0.18 gm.",
      provenance: null,
      count: null,
      weights: [{ grams: 0.18 }],
    },
  });

  const merrillIds = [
    "obs-a0e7dd8b-7e93-4348-82c9-6e43f04c328f",
    "obs-34a0884f-e8e1-48da-908c-a670851b8821",
  ];
  const merrill = merrillIds.map((id) => recordById.get(id));
  assert.equal(new Set(merrill.map(({ id }) => id)).size, 2);
  assert.deepEqual(merrill.map(({ id, entryOrder, catalogPages, section, name, classification, locality, eventDate, holdings }) => ({
    id,
    entryOrder,
    catalogPages,
    section,
    name,
    classification,
    locality,
    eventDate,
    count: holdings[0].count,
    weights: holdings[0].weights,
  })), [
    {
      id: merrillIds[0],
      entryOrder: 316,
      catalogPages: [170],
      section: "A. Museum Collection",
      name: "WICHITA COUNTY (BRAZOS RIVER)",
      classification: "Iron, Og",
      locality: "TEXAS",
      eventDate: "Date of fall uncertain; first known in 1836.",
      count: 2,
      weights: [{ grams: 20.8 }, { grams: 143 }],
    },
    {
      id: merrillIds[1],
      entryOrder: 556,
      catalogPages: [198],
      section: "B. The C. U. Shepard Collection",
      name: "WICHITA COUNTY (BRAZOS RIVER)",
      classification: "Iron, Og",
      locality: "TEXAS",
      eventDate: "Found in 1836.",
      count: 2,
      weights: [{ grams: 143 }, { grams: 69.4 }],
    },
  ]);
  assert.match(merrill[0].holdings[0].description, /^Iron, Og\..*first known in 1836\..*Red River.*p\. 285\.$/u);
  assert.match(merrill[1].holdings[0].description, /Widmanstätten/u);
});

test("Ward 1881 publishes only priced offerings with blocked folios and no lineage claims", () => {
  const catalogId = "ward-1881";
  const descriptor = catalog.metadata.catalogs.find(({ id }) => id === catalogId);
  const records = catalog.records.filter((record) => record.catalogId === catalogId);
  const holdings = records.flatMap((record) => record.holdings);
  const relationships = published.relationships.filter(({ observations }) =>
    observations.some((observation) => observation.catalogId === catalogId));
  const recordIds = [
    "obs-ba4b83e0-f5cd-499d-aec2-ceb8b8285b0a",
    "obs-b1be1364-10b5-4695-9053-743e6e4d6852",
    "obs-d3754743-885c-4a80-a57d-e44af0011d20",
  ];

  assert.deepEqual(descriptor, {
    id: catalogId,
    recordModel: "collection-entry",
    label: "Meteorites, in Ward's Natural Science Bulletin, volume 1 number 1 (1881)",
    compiler: "Henry A. Ward",
    year: 1881,
    sourcePages: [4],
    sourcePageCount: 1,
    recordCount: 3,
    recordsWithDesignation: 0,
    recordsWithWeight: 0,
    confidenceCounts: { high: 3, medium: 0, low: 0 },
    folioDisplayPolicy: "blocked",
    rightsStatus: "undetermined",
  });
  assert.deepEqual(records.map(({ id }) => id), recordIds);
  assert.deepEqual(records.map(({ entryOrder }) => entryOrder), [1, 2, 3]);
  assert(records.every(({ catalogPages, reportedNumber, section, confidence, metbull }) =>
    JSON.stringify(catalogPages) === "[4]" && reportedNumber === null && section === "IRONS." &&
    confidence === "high" && metbull === undefined));
  assert.equal(holdings.length, 5);
  assert(holdings.every(({ provenance, count, weights, description }) =>
    provenance === null && count === null && weights.length === 0 && /(?:\$|cts\.)/u.test(description)));
  assert.deepEqual(folios.catalogs[catalogId], {
    displayPolicy: "blocked",
    rightsStatus: "undetermined",
    pages: [],
  });
  assert.deepEqual(folioReleaseLock.catalogs[catalogId], {
    displayPolicy: "blocked",
    rightsStatus: "undetermined",
    basis: null,
    basisUrl: null,
    pageIds: [],
  });
  assert(!folioReleaseLock.assets.some(({ path }) => path.includes(catalogId)));
  assert(!published.metadata.collectionSeries.some(({ catalogIds }) => catalogIds.includes(catalogId)));
  assert.equal(relationships.length, 0);
  assert.doesNotMatch(JSON.stringify(records), /(?:ocr|raw(?:Text|Record)|source(?:File|Path|Image)|imageId|acquisition|review|manifest|\/private\/|\/Users\/|\.(?:pdf|png|webp))/iu);
});

test("Ward and Farrington 1916 publish exact facts with blocked folios and no same-inventory claims", () => {
  const expected = {
    "ward-1904": {
      records: 697,
      reviewed: 49,
      pending: 648,
      sourcePages: 74,
      citedPages: 74,
      recordsWithWeight: 608,
      relationships: 0,
      recordsHash: "49d4e0838397ec89eb78aff4d501079ba89e53769d15fd7bc9ea69578a8639b9",
      idsHash: "4613f97ab8fabbd19e071a083e5ef2fed9c2619b1e8b456e4597ac072b6b4609",
    },
    "farrington-1916": {
      records: 738,
      reviewed: 469,
      pending: 269,
      sourcePages: 82,
      citedPages: 78,
      recordsWithWeight: 723,
      relationships: 216,
      recordsHash: "e98ce3ee6af094bdd0708ad1eae0eb8d2e1b6857ed7f1c5158154649ae8392df",
      idsHash: "45ec57f34d7baff5aab5edeb19f85e977b6fddf975e1ebd63c9e74fc93db9f37",
    },
  };

  for (const [catalogId, counts] of Object.entries(expected)) {
    const descriptor = catalog.metadata.catalogs.find(({ id }) => id === catalogId);
    const records = catalog.records.filter((record) => record.catalogId === catalogId);
    const reviewed = records.filter((record) => Object.hasOwn(record, "metbull"));
    const relationships = published.relationships.filter(({ observations }) =>
      observations.some((observation) => observation.catalogId === catalogId) &&
      observations.every((observation) => observation.catalogId !== "hamburg-1913"));

    assert.equal(descriptor.recordModel, "collection-entry");
    assert.equal(descriptor.recordCount, counts.records);
    assert.equal(descriptor.sourcePageCount, counts.sourcePages);
    assert.equal(new Set(records.flatMap(({ catalogPages }) => catalogPages)).size, counts.citedPages);
    assert.equal(descriptor.recordsWithWeight, counts.recordsWithWeight);
    assert.equal(reviewed.length, counts.reviewed);
    assert(reviewed.every(({ metbull }) => metbull.matchType === "exact"));
    assert.equal(records.length - reviewed.length, counts.pending);
    assert.equal(createHash("sha256").update(JSON.stringify(records)).digest("hex"), counts.recordsHash);
    assert.equal(createHash("sha256").update(JSON.stringify(records.map(({ id }) => id))).digest("hex"), counts.idsHash);
    assert.deepEqual(folios.catalogs[catalogId], {
      displayPolicy: "blocked",
      rightsStatus: "undetermined",
      pages: [],
    });
    assert.deepEqual(folioReleaseLock.catalogs[catalogId], {
      displayPolicy: "blocked",
      rightsStatus: "undetermined",
      basis: null,
      basisUrl: null,
      pageIds: [],
    });
    assert(!folioReleaseLock.assets.some(({ path }) => path.includes(catalogId)));
    assert(!published.metadata.collectionSeries.some(({ catalogIds }) => catalogIds.includes(catalogId)));
    assert.equal(relationships.length, counts.relationships);
    assert(relationships.every(({ relationship }) => relationship === "possible-match"));
  }
});

test("Foote 1912 publishes only accepted facts, exact mappings, blocked folios, and deterministic candidates", () => {
  const catalogId = "foote-1912";
  const descriptor = catalog.metadata.catalogs.find(({ id }) => id === catalogId);
  const records = catalog.records.filter((record) => record.catalogId === catalogId);
  const holdings = records.flatMap((record) => record.holdings);
  const weights = holdings.flatMap((holding) => holding.weights);
  const reviewed = records.filter((record) => Object.hasOwn(record, "metbull"));
  const relationships = published.relationships.filter(({ observations }) =>
    observations.some((observation) => observation.catalogId === catalogId));

  assert.deepEqual(descriptor, {
    id: catalogId,
    recordModel: "collection-entry",
    label: "The Foote Collection of Meteorites (1912)",
    compiler: "Warren M. Foote",
    year: 1912,
    sourcePages: Array.from({ length: 35 }, (_, index) => index + 27),
    sourcePageCount: 35,
    recordCount: 205,
    recordsWithDesignation: 0,
    recordsWithWeight: 205,
    confidenceCounts: { high: 205, medium: 0, low: 0 },
    folioDisplayPolicy: "blocked",
    rightsStatus: "undetermined",
  });
  assert.equal(records.length, 205);
  assert.deepEqual(records.map(({ entryOrder }) => entryOrder), Array.from({ length: 205 }, (_, index) => index + 1));
  assert.equal(holdings.length, 227);
  assert.equal(weights.length, 227);
  assert.equal(Math.round(weights.reduce((sum, { grams }) => sum + grams, 0) * 10) / 10, 36111.9);
  assert.equal(reviewed.length, 132);
  assert(reviewed.every(({ metbull }) => metbull.matchType === "exact"));
  assert.equal(records.length - reviewed.length, 73);
  assert.equal(createHash("sha256").update(JSON.stringify(records)).digest("hex"),
    "e1644d64ed608c2fd43f4e70d9d16a7ffbd4349d8fbafce864048fd560d18d20");
  assert.equal(createHash("sha256").update(JSON.stringify(records.map(({ id }) => id))).digest("hex"),
    "f9a132049c177873564708bd1a3d5f72a628ab2726c7081a74f5d7e96542568b");

  assert.deepEqual(folios.catalogs[catalogId], {
    displayPolicy: "blocked",
    rightsStatus: "undetermined",
    pages: [],
  });
  assert.deepEqual(folioReleaseLock.catalogs[catalogId], {
    displayPolicy: "blocked",
    rightsStatus: "undetermined",
    basis: null,
    basisUrl: null,
    pageIds: [],
  });
  assert(!folioReleaseLock.assets.some(({ path }) => path.includes(catalogId)));
  assert(!published.metadata.collectionSeries.some(({ catalogIds }) => catalogIds.includes(catalogId)));
  assert.equal(relationships.length, 16);
  assert(relationships.every(({ relationship, basis, status, review, identity }) =>
    relationship === "possible-match" && basis === "reviewed-identity-and-reported-mass" &&
    status === "possible" && review.status === "unreviewed" && identity.method === "metbull-code"));
  assert.deepEqual(relationships.reduce((counts, { evidence }) => {
    counts[evidence.massMatch] += 1;
    return counts;
  }, { exact: 0, near: 0 }), { exact: 15, near: 1 });
  assert(!published.relationships.some(({ relationship, observations }) =>
    relationship === "same-inventory" && observations.some(({ catalogId: id }) => id === catalogId)));

  const forbiddenKeys = new Set([
    "acquisition", "asset", "auditRationale", "display", "file", "image", "manifest", "media", "note", "notes",
    "ocr", "pageId", "pageIds", "path", "rawText", "sourceFile", "sourceImage", "sourcePath", "uncertainFields",
    "weightText",
  ]);
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (value === null || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert(!forbiddenKeys.has(key), `Foote public record contains blocked key ${key}`);
      visit(child);
    }
  };
  records.forEach(visit);
  assert.doesNotMatch(JSON.stringify(records), /(?:\/private\/|\/Users\/|source-images|assets\/foote-1912|assets\/folios\/foote-1912|\.(?:pdf|png|webp|txt|csv))/iu);
});

test("Anderson, Astapovich, and Kantor publish complete reviewed mappings without media or lineage additions", () => {
  const expected = {
    "anderson-1913": {
      records: 57,
      resolved: 52,
      unresolved: 5,
      sourcePages: 26,
      citedPages: 13,
      holdings: 57,
      weights: 0,
      recordsHash: "420a21059cbc5d451acbe1c405aaf92c5ca4583fa0a56f59ed67c39a850550a9",
      nonMappingHash: "198ce66e2916b185429f0396a1a10e425469e4e52c0e30877e5912c2563e03c5",
      mappingsHash: "e038837b2765ac0461d8a1705197df3eca6bef173a3b6b4488aff43e14ae41e9",
      idsHash: "38d3a837c8057c6a0f246d7f4deeed43a05a4ab7acc6f68f525788606cdf853c",
    },
    "astapovich-1938": {
      records: 90,
      resolved: 81,
      unresolved: 9,
      sourcePages: 3,
      citedPages: 2,
      holdings: 90,
      weights: 0,
      recordsHash: "d7131106981cd98b11220559ac314bb624f095648aa9411fd67b2a2d8feefdaf",
      nonMappingHash: "2635eac5edb9d283724a2122a734ced3bb72c83190829acb7672027f94dad9ba",
      mappingsHash: "b7e6c4d1a104246a8d67fea30207a4e7c08fb1f7face39194cc3c5cc831715c9",
      idsHash: "0797dd7e5cf66d3df763baf54774bf5ab750043e1e196469200b801554a3545b",
    },
    "kantor-1920": {
      records: 30,
      resolved: 27,
      unresolved: 3,
      sourcePages: 35,
      citedPages: 16,
      holdings: 34,
      weights: 34,
      recordsHash: "219ac98d8a68faaa6f9741958c4f8ac28d002f2d3615400becc285e83bb46b80",
      nonMappingHash: "3b0afddc30a1f4f87e55c1dfba828be802ee5311c3b49c4b4338688686c2c11f",
      mappingsHash: "ec3cc0e6cc7956b460ca9db43d9d81a778e2a34784126b9b69fce672c08f6890",
      idsHash: "31a86211b4ce6dafd97bbcf3d7229b2bc3a12c438948d707353fce7e25464755",
    },
  };
  const newCatalogIds = new Set(Object.keys(expected));
  const preservationExcludedCatalogIds = new Set([
    ...newCatalogIds, "madrid-1923", "hamburg-1913", "hodge-smith-1939", "victoria-land-1982",
  ]);

  for (const [catalogId, counts] of Object.entries(expected)) {
    const descriptor = catalog.metadata.catalogs.find(({ id }) => id === catalogId);
    const records = catalog.records.filter((record) => record.catalogId === catalogId);
    const reviewed = records.filter((record) => Object.hasOwn(record, "metbull"));
    const holdings = records.flatMap((record) => record.holdings);
    const weights = holdings.flatMap((holding) => holding.weights);

    assert.equal(descriptor.recordModel, "collection-entry");
    assert.equal(descriptor.recordCount, counts.records);
    assert.equal(descriptor.sourcePageCount, counts.sourcePages);
    assert.equal(records.length, counts.records);
    assert.equal(new Set(records.flatMap(({ catalogPages }) => catalogPages)).size, counts.citedPages);
    assert.equal(reviewed.length, counts.resolved + counts.unresolved);
    assert.equal(reviewed.filter(({ metbull }) => metbull.matchType === "unresolved").length, counts.unresolved);
    assert.equal(reviewed.filter(({ metbull }) => metbull.matchType !== "unresolved").length, counts.resolved);
    assert.equal(records.length - reviewed.length, 0);
    assert.equal(holdings.length, counts.holdings);
    assert.equal(weights.length, counts.weights);
    assert.equal(createHash("sha256").update(JSON.stringify(records)).digest("hex"), counts.recordsHash);
    assert.equal(
      createHash("sha256").update(JSON.stringify(records.map(({ metbull: _metbull, ...record }) => record))).digest("hex"),
      counts.nonMappingHash,
    );
    assert.equal(createHash("sha256").update(JSON.stringify(records.map(({ metbull }) => metbull))).digest("hex"), counts.mappingsHash);
    assert.equal(createHash("sha256").update(JSON.stringify(records.map(({ id }) => id))).digest("hex"), counts.idsHash);
    assert.deepEqual(folios.catalogs[catalogId], {
      displayPolicy: "blocked",
      rightsStatus: "undetermined",
      pages: [],
    });
    assert.deepEqual(folioReleaseLock.catalogs[catalogId], {
      displayPolicy: "blocked",
      rightsStatus: "undetermined",
      basis: null,
      basisUrl: null,
      pageIds: [],
    });
    assert(!folioReleaseLock.assets.some(({ path }) => path.includes(catalogId)));
    assert(!published.relationships.some(({ observations }) =>
      observations.some((observation) => observation.catalogId === catalogId)));
  }

  assert.equal(
    createHash("sha256").update(JSON.stringify(catalog.metadata.catalogs.filter(({ id }) => !preservationExcludedCatalogIds.has(id)))).digest("hex"),
    "e9e3eb1a8612408ff4bb8d953db2cb6a51abef19298f0d7aa7318132199dae27",
  );
  assert.equal(
    createHash("sha256").update(JSON.stringify(catalog.records.filter(({ catalogId }) => !preservationExcludedCatalogIds.has(catalogId)))).digest("hex"),
    "78c0a7003a020e9ef1853732f2026a636183e27a163ab29b58373132a62aa9e9",
  );
  assert.equal(
    createHash("sha256").update(JSON.stringify(published.relationships.filter(({ observations }) =>
      observations.every(({ catalogId }) => !["madrid-1923", "hamburg-1913"].includes(catalogId))))).digest("hex"),
    "269e43c29c66d9ead0f5c528f38cf0a2c1ab78037409b36a1c9edfd890d457ad",
  );

  const serialized = JSON.stringify(catalog.records.filter(({ catalogId }) => newCatalogIds.has(catalogId)));
  assert.doesNotMatch(serialized, /(?:\/private\/|\/Users\/|source-images|data\/ocr|assets\/|file:\/\/|\.(?:pdf|png|webp|tiff?|txt|csv))/iu);
});

test("excludes weighted observations without reviewed MetBull mappings", () => {
  const changed = clone(catalog);
  const weighted = changed.records.find((record) => record.metbull && record.weight?.grams !== null);
  delete weighted.metbull;
  assert.equal(flattenMassObservations(changed).length, flattenMassObservations(catalog).length - 1);
});

test("inventory IDs apply Unicode, case, whitespace, and Huss marker normalization without changing source designations", () => {
  assert.equal(normalizeInventoryId(" Ｈ １５ ", "nininger"), "h15");
  assert.equal(normalizeInventoryId("(2)H39.417", "huss"), "h39.417");
  assert.equal(normalizeInventoryId("(2)H39.417", "nininger"), "(2)h39.417");
  for (const [left, right] of [["70 a", "70a"], ["128 s", "128s"], ["H15", "H 15"], ["H52", "H 52"]]) {
    assert.equal(normalizeInventoryId(left, "nininger"), normalizeInventoryId(right, "nininger"));
    const relationship = sameInventory("nininger", normalizeInventoryId(left, "nininger"));
    assert.ok(relationship, `${left}/${right}`);
    assert.deepEqual(new Set(relationship.observations.map(({ designation }) => designation)), new Set([left, right]));
  }
  const printed = catalog.records.find(({ designation }) => designation === "(2)H39.417");
  assert.equal(printed.designation, "(2)H39.417");
  assert(!publishedText.includes('"designation": "H39.417"'));
});

test("Huss continuity is strict inventory equality and ignores mass change", () => {
  const huss = published.relationships.filter((relationship) => relationship.relationship === "same-inventory" && relationship.collectionSeries.id === "huss");
  assert.deepEqual(huss.map(({ collectionSeries }) => collectionSeries.inventoryId).toSorted(), ["h160.1", "h160.2"]);
  assert.deepEqual(sameInventory("huss", "h160.1").observations.map(({ designation, massGrams }) => [designation, massGrams]).toSorted(), [
    ["(2)H160.1", 4.3],
    ["H160.1", 3.4],
  ]);
  assert.deepEqual(sameInventory("huss", "h160.2").observations.map(({ designation, massGrams }) => [designation, massGrams]).toSorted(), [
    ["(2)H160.2", 0.8],
    ["H160.2", 7.1],
  ]);

  const wellmanIds = new Set([
    catalog.records.find(({ catalogId, designation }) => catalogId === "huss-1976" && designation === "H39.116").id,
    catalog.records.find(({ catalogId, designation }) => catalogId === "huss-1986" && designation === "(2)H39.417").id,
  ]);
  assert(!published.relationships.some((relationship) => relationship.observations.every(({ recordId }) => wellmanIds.has(recordId))));
  assert.equal(published.metadata.counts.catalogPairs.find(({ catalogPair }) => catalogPair === "huss-1976|huss-1986").possibleMatchCount, 0);
});

test("same-series continuity survives missing mass while possible matches require mass thresholds", () => {
  const changed = clone(catalog);
  changed.records.find(({ catalogId, designation }) => catalogId === "huss-1986" && designation === "(2)H160.1").weight.grams = null;
  const rebuilt = buildSpecimenLineages(changed);
  const relationship = rebuilt.relationships.find((item) => item.relationship === "same-inventory" && item.collectionSeries.inventoryId === "h160.1");
  assert.ok(relationship);
  assert(relationship.observations.some(({ massGrams }) => massGrams === null));
  assert.equal(rebuilt.metadata.source.flattenedMassObservationCount, 14091);

  for (const possible of possibleRelationships()) {
    const [left, right] = possible.observations;
    assert(Number.isFinite(left.massGrams) && Number.isFinite(right.massGrams));
    const difference = Math.abs(left.massGrams - right.massGrams);
    const relative = difference / Math.max(left.massGrams, right.massGrams);
    assert(difference === 0 || (Math.min(left.massGrams, right.massGrams) >= 10 && difference <= 2 && relative <= 0.0025));
  }
});

test("collection series are separate namespaces and same-series differing IDs do not become candidates", () => {
  assert.deepEqual(published.metadata.collectionSeries, [
    { id: "huss", catalogIds: ["huss-1976", "huss-1986"] },
    { id: "nininger", catalogIds: ["nininger-1933", "nininger-1950"] },
  ]);
  for (const relationship of published.relationships.filter(({ relationship }) => relationship === "same-inventory")) {
    const expectedCatalogs = published.metadata.collectionSeries.find(({ id }) => id === relationship.collectionSeries.id).catalogIds;
    assert(relationship.observations.every(({ catalogId }) => expectedCatalogs.includes(catalogId)));
  }
  for (const possible of possibleRelationships()) {
    const namespaces = possible.observations.map(({ catalogId }) =>
      published.metadata.collectionSeries.find(({ catalogIds }) => catalogIds.includes(catalogId))?.id || catalogId);
    assert.notEqual(namespaces[0], namespaces[1]);
  }

  const sameKeyInAnotherSeries = clone(catalog);
  const rosebud = sameKeyInAnotherSeries.records.find(({ catalogId, name }) => catalogId === "nininger-1950" && name === "Rosebud");
  rosebud.designation = "H160.1";
  const rebuilt = buildSpecimenLineages(sameKeyInAnotherSeries);
  assert(!rebuilt.relationships.some((relationship) => relationship.relationship === "same-inventory" &&
    relationship.observations.some(({ recordId }) => recordId === rosebud.id)));
});

test("Nininger 108b collision resolves only Sandia and ambiguous collisions are omitted", () => {
  const relationship = sameInventory("nininger", "108b");
  assert.deepEqual(relationship.observations.map(({ sourceName }) => sourceName).toSorted(), ["Sandia Mountains", "Sandia Mts."]);
  assert(!relationship.observations.some(({ sourceName }) => sourceName === "Rosebud"));
  assert.equal(published.metadata.counts.identityResolvedInventoryCollisionCount, 1);

  const ambiguous = clone(catalog);
  const duplicate = clone(ambiguous.records.find(({ catalogId, name }) => catalogId === "nininger-1950" && name === "Sandia Mountains"));
  duplicate.id = "synthetic-duplicate-sandia-108b";
  ambiguous.records.push(duplicate);
  const rebuilt = buildSpecimenLineages(ambiguous);
  assert(!rebuilt.relationships.some((item) => item.relationship === "same-inventory" && item.collectionSeries.inventoryId === "108b"));
  assert.equal(rebuilt.metadata.counts.omittedAmbiguousInventoryKeyCount, 1);
});

test("cross-series possible matching retains reviewed identity plus exact or near mass", () => {
  assert.equal(possibleRelationships().length, 1294);
  assert(possibleRelationships().every(({ basis, status }) => basis === "reviewed-identity-and-reported-mass" && status === "possible"));
  assert(possibleRelationships().some(({ evidence }) => evidence.massMatch === "exact"));
  assert(possibleRelationships().some(({ evidence }) => evidence.massMatch === "near"));
  assert(possibleRelationships().every(({ identity }) => identity.method === "metbull-code"));
  assert(possibleRelationships().some(({ catalogPair }) => catalogPair === "huss-1976|nininger-1950"));

  const unresolved = clone(catalog);
  const left = unresolved.records.find(({ catalogId }) => catalogId === "huss-1976");
  const right = unresolved.records.find(({ catalogId }) => catalogId === "nininger-1950");
  for (const record of [left, right]) {
    record.name = "Synthetic unresolved name";
    record.weight.grams = 123;
    record.metbull = { matchType: "unresolved", canonicalName: null, meteoriteCode: null, metbullUrl: null, alternateNameNote: null };
  }
  const endpointIds = new Set([left.id, right.id]);
  const exact = buildSpecimenLineages(unresolved).relationships.find((relationship) =>
    relationship.observations.every(({ recordId }) => endpointIds.has(recordId)));
  assert.equal(exact.relationship, "possible-match");
  assert.equal(exact.identity.method, "normalized-source-name");
  assert.equal(exact.evidence.massMatch, "exact");

  right.weight.grams = 130;
  assert(!buildSpecimenLineages(unresolved).relationships.some((relationship) =>
    relationship.observations.every(({ recordId }) => endpointIds.has(recordId))));
});

test("stable UUIDs use immutable endpoint references", () => {
  const ids = new Set();
  const observationIds = new Set();
  for (const relationship of published.relationships) {
    assert(!ids.has(relationship.id));
    ids.add(relationship.id);
    const references = relationship.observations.map((observation) =>
      `${observation.recordId}\u0000${relationship.relationship === "same-inventory" ? observation.designationPath : observation.massPath}`).toSorted();
    const candidateReference = references.join("\u0001");
    if (relationship.relationship === "possible-match") {
      assert.equal(relationship.id, `possible-lineage-${uuidV5(`possible-lineage\u0000${candidateReference}`)}`);
    } else {
      assert.equal(relationship.id, `same-inventory-lineage-${uuidV5(`same-inventory-lineage\u0000${relationship.collectionSeries.id}\u0000${relationship.collectionSeries.inventoryId}\u0000${candidateReference}`)}`);
    }
    for (const observation of relationship.observations) {
      assert(!observationIds.has(observation.id));
      observationIds.add(observation.id);
      const prefix = relationship.relationship === "same-inventory" ? "inventory-observation" : "mass-observation";
      const reference = `${observation.recordId}\u0000${relationship.relationship === "same-inventory" ? observation.designationPath : observation.massPath}`;
      assert.equal(observation.id, `${prefix}-${uuidV5(`${prefix}\u0000${candidateReference}\u0000${reference}`)}`);
    }
  }
});

test("reviews apply only to possible candidates", () => {
  const target = possibleRelationships()[0];
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
  assert.equal(rebuilt.relationships.find(({ id }) => id === target.id).review.status, "reviewed");
  assert.equal(rebuilt.metadata.counts.unreviewedPossibleMatchCount, 1293);
  assert.throws(() => buildSpecimenLineages(catalog, {
    schemaVersion: 1,
    reviews: [{ ...reviews.reviews[0], candidateId: sameInventory("huss", "h160.1").id }],
  }), /candidateId is invalid|dangling/iu);
});

test("schemas are closed draft 2020-12 contracts with relationship-specific review rules", () => {
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.$id, "urn:hmc:schema:specimen-lineages:2");
  assert.equal(reviewSchema.$schema, "https://json-schema.org/draft/2020-12/schema");
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (value === null || typeof value !== "object") return;
    if (value.type === "object") assert.equal(value.additionalProperties, false);
    Object.values(value).forEach(visit);
  };
  visit(schema);
  visit(reviewSchema);
  const text = JSON.stringify(schema);
  assert.match(text, /same-inventory/u);
  assert.match(text, /possible-match/u);
  assert.match(text, /series-scoped-normalized-inventory-id/u);
  assert.equal(validateLineageShape(published), true);
  assert.equal(validateReviewSource(reviewSource, new Set(possibleRelationships().map(({ id }) => id))), true);
});

test("validator rejects relationship, endpoint, evidence, count, and privacy mutations", () => {
  mutate("extra root field", (value) => { value.private = true; }, /exactly keys|private/iu);
  mutate("relationship status", (value) => { value.relationships[0].status = "confirmed"; });
  mutate("same inventory key", (value) => {
    value.relationships.find(({ relationship }) => relationship === "same-inventory").collectionSeries.inventoryId = "forged";
  });
  mutate("Rosebud collision endpoint", (value) => {
    const relationship = value.relationships.find((item) => item.relationship === "same-inventory" && item.collectionSeries.inventoryId === "108b");
    const rosebud = catalog.records.find(({ catalogId, name }) => catalogId === "nininger-1950" && name === "Rosebud");
    const endpoint = relationship.observations.find(({ catalogId }) => catalogId === "nininger-1950");
    endpoint.recordId = rosebud.id;
    endpoint.sourceName = rosebud.name;
    endpoint.canonicalName = rosebud.metbull.canonicalName;
    endpoint.meteoriteCode = rosebud.metbull.meteoriteCode;
    endpoint.massGrams = null;
  });
  mutate("possible mass", (value) => {
    value.relationships.find(({ relationship }) => relationship === "possible-match").observations[0].massGrams += 1;
  });
  mutate("evidence", (value) => {
    value.relationships.find(({ relationship }) => relationship === "possible-match").evidence.factCodes.reverse();
  }, /canonically ordered|differs/iu);
  mutate("count", (value) => { value.metadata.counts.relationshipCount += 1; });
  mutate("unsafe URL", (value) => { value.relationships[0].observations[0].catalogSearchUrl = "https://evil.example/"; }, /unsafe|differs/iu);
  mutate("private field", (value) => { value.relationships[0].private = true; }, /exactly keys|private/iu);
});
