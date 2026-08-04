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
  assert.equal(flattenMassObservations(catalog).length, 13522);
  assert.equal(flattenInventoryObservations(catalog).length, 3627);
  assert.deepEqual(published.metadata.source, {
    catalogSchemaVersion: 6,
    recordCount: 13157,
    catalogCount: 28,
    flattenedMassObservationCount: 13522,
    inventoryObservationCount: 3627,
  });
  const { catalogPairs, ...counts } = published.metadata.counts;
  assert.deepEqual(counts, {
    relationshipCount: 1466,
    sameInventoryRelationshipCount: 195,
    possibleMatchRelationshipCount: 1271,
    unreviewedPossibleMatchCount: 1271,
    exactMassPossibleMatchCount: 1050,
    nearMassPossibleMatchCount: 221,
    metbullIdentityPossibleMatchCount: 1271,
    normalizedNameIdentityPossibleMatchCount: 0,
    sameDesignationPossibleMatchCount: 0,
    designationFamilyPossibleMatchCount: 0,
    aggregateOrMultiplePossibleMatchCount: 38,
    castPossibleMatchCount: 0,
    identityResolvedInventoryCollisionCount: 1,
    omittedAmbiguousInventoryKeyCount: 0,
    possibleMatchEvidenceStrength: {
      "multiple-matching-facts": 0,
      "two-matching-facts": 1050,
      "limited-matching-evidence": 221,
    },
  });
  assert.equal(catalogPairs.length, 79);
  assert.equal(
    createHash("sha256").update(JSON.stringify(catalogPairs)).digest("hex"),
    "70fd220c0b8d90050ab2e0e769fe87cb07ba3c3538433c1c3f6aa7c04ec16653",
  );
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
    observations.some(({ catalogId }) => catalogId === "asu-2024-09")).length, 13);
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

  assert.equal(catalog.metadata.catalogs.length, 28);
  assert.equal(catalog.records.length, 13157);
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
  assert.equal(allReviewed.length, 9893);
  assert.equal(allReviewed.filter(({ metbull }) => metbull.matchType === "unresolved").length, 129);
  assert.equal(allReviewed.filter(({ metbull }) => metbull.matchType !== "unresolved").length, 9764);
  assert.equal(catalog.records.length - allReviewed.length, 3264);
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
  assert.equal(catalog.records.filter(({ catalogId }) => catalogId !== "kanagawa-1996").length, 12925);
});

test("Merrill, Prior, and Reeds publish locked facts with blocked folios and derived lineages", () => {
  const expected = {
    "merrill-1916": { records: 560, reviewed: 0, pending: 560, relationships: 0 },
    "prior-1923": { records: 949, reviewed: 758, pending: 191, relationships: 66 },
    "reeds-1937": { records: 500, reviewed: 390, pending: 110, relationships: 705 },
  };

  for (const [catalogId, counts] of Object.entries(expected)) {
    const descriptor = catalog.metadata.catalogs.find(({ id }) => id === catalogId);
    const records = catalog.records.filter((record) => record.catalogId === catalogId);
    const reviewed = records.filter((record) => Object.hasOwn(record, "metbull"));
    const relationships = published.relationships.filter(({ observations }) =>
      observations.some((observation) => observation.catalogId === catalogId));

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
      recordsHash: "67fed1ddc30204a2cb338727a1d4a9d349e24b95976edcf11835cebbf0df362b",
      idsHash: "4613f97ab8fabbd19e071a083e5ef2fed9c2619b1e8b456e4597ac072b6b4609",
    },
    "farrington-1916": {
      records: 738,
      reviewed: 469,
      pending: 269,
      sourcePages: 82,
      citedPages: 78,
      recordsWithWeight: 723,
      relationships: 214,
      recordsHash: "0088e7f9005c9e22345596a47228a7d699684fc297bf3d25e6daafc985907e19",
      idsHash: "45ec57f34d7baff5aab5edeb19f85e977b6fddf975e1ebd63c9e74fc93db9f37",
    },
  };

  for (const [catalogId, counts] of Object.entries(expected)) {
    const descriptor = catalog.metadata.catalogs.find(({ id }) => id === catalogId);
    const records = catalog.records.filter((record) => record.catalogId === catalogId);
    const reviewed = records.filter((record) => Object.hasOwn(record, "metbull"));
    const relationships = published.relationships.filter(({ observations }) =>
      observations.some((observation) => observation.catalogId === catalogId));

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
  assert.equal(rebuilt.metadata.source.flattenedMassObservationCount, 13521);

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
  assert.equal(possibleRelationships().length, 1271);
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
  assert.equal(rebuilt.metadata.counts.unreviewedPossibleMatchCount, 1270);
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
