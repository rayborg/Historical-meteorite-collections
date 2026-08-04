import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = require(path.join(projectRoot, "app.js"));
const [lineageData, catalog] = await Promise.all([
  readFile(path.join(projectRoot, "data", "specimen-lineages.json"), "utf8").then(JSON.parse),
  readFile(path.join(projectRoot, "data", "catalog.json"), "utf8").then(JSON.parse),
]);
const registry = app.normalizeCatalogRegistry(catalog.metadata);
const records = catalog.records.map((record, index) => app.prepareRecord(record, index, registry));

function clone(value) {
  return structuredClone(value);
}

function entryCount(index) {
  return [...index.values()].reduce((sum, entries) => sum + entries.length, 0);
}

function possible(data) {
  return data.relationships.find(({ relationship }) => relationship === "possible-match");
}

function sameInventory(data, inventoryId = "h160.1") {
  return data.relationships.find((relationship) => relationship.relationship === "same-inventory" && relationship.collectionSeries.inventoryId === inventoryId);
}

function recomputeCounts(data) {
  const calculated = app.calculateLineageCounts(data.relationships, {
    identityResolvedInventoryCollisionCount: data.metadata.counts.identityResolvedInventoryCollisionCount,
    omittedAmbiguousInventoryKeyCount: data.metadata.counts.omittedAmbiguousInventoryKeyCount,
  });
  data.metadata.counts = {
    ...calculated,
    catalogPairs: [...calculated.catalogPairs]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([catalogPair, counts]) => ({ catalogPair, ...counts })),
  };
}

const forgedFactMutations = [
  (data) => { data.relationships[0].observations[0].sourceName = "Forged source name"; },
  (data) => {
    const observation = data.relationships[0].observations[0];
    observation.sourceRecordLabel = "Forged record label";
    observation.catalogSearchUrl = `./index.html?catalog=${encodeURIComponent(observation.catalogId)}&q=${encodeURIComponent(observation.sourceRecordLabel)}#catalog`;
  },
  (data) => { data.relationships[0].observations[0].catalogLabel = "Forged catalog"; },
  (data) => { data.relationships[0].observations[0].catalogYear += 1; },
  (data) => { possible(data).evidence.factCodes[0] = "unknown-fact"; },
  (data) => { possible(data).evidence.factCodes.push(possible(data).evidence.factCodes[0]); },
  (data) => { possible(data).evidence.strength = "multiple-matching-facts"; },
  (data) => { sameInventory(data).collectionSeries.inventoryId = "forged"; },
];

test("main template presents relationship-specific compact lineage copy", async () => {
  const [html, css, source] = await Promise.all([
    readFile(path.join(projectRoot, "index.html"), "utf8"),
    readFile(path.join(projectRoot, "styles.css"), "utf8"),
    readFile(path.join(projectRoot, "app.js"), "utf8"),
  ]);
  assert.doesNotMatch(html, /possible-specimen-lineages\.html/);
  assert.match(html, /<section class="earlier-records" hidden>/);
  assert.match(html, /Same-inventory links identify collection inventory continuity\./);
  assert.match(html, /Possible matches do not prove physical identity\./);
  assert.match(html, /Neither establishes custody or ownership\./);
  assert.match(source, /Earlier specimen-lineage records/);
  assert.match(source, /Same collection inventory ID:/);
  assert.match(source, /Possible match · Reported mass:/);
  assert.doesNotMatch(source, /\.innerHTML\b/);
  assert.match(css, /\.earlier-records \{/);
  assert.equal(app.CACHE_VERSION, "20260803-1");
  assert.match(html, /styles\.css\?v=20260803-1/);
  assert.match(html, /app\.js\?v=20260803-1/);
  for (const file of ["possible-specimen-lineages.html", "possible-specimen-lineages.css", "possible-specimen-lineages.js"]) {
    await assert.rejects(access(path.join(projectRoot, file)));
  }
});

test("real catalog Allende search retains reviewed names and synonyms without Alais infix matches", () => {
  const matchingIds = records.filter((record) => app.matchesSearch(record, "Allende")).map(({ id }) => id);
  assert.deepEqual(matchingIds, [
    "obs-5346df67-1886-4d25-8be0-c598f0a06f4a",
    "obs-34b0eb76-c9d6-455d-90eb-68ed797d3f7c",
    "obs-e4e7bb92-45a3-4b4e-8359-339ffe83aa2e",
    "obs-9bc17c10-3a0c-439e-b84f-ff811601bd02",
    "obs-089f2273-8fbd-4c6a-a41f-c74a2ca01cdb",
    "h103-9-79db393f7a76",
    "h103-11-29b257683337",
    "h103-12-26606a4e8d5f",
    "h103-15-6030c933b127",
    "h103-17-cb961468f9f6",
    "h103-22-d78f7e67779d",
    "h103-47-ee11bee3d660",
    "obs-10e6e6ad-97b3-48d2-b149-52b7b29058da",
    "obs-125ad40d-286a-4ca2-b3be-829da898df97",
    "obs-3a77f20d-b292-4da2-a28a-4fbdb6620717",
    "obs-6b74d083-3119-4899-8f8b-4ee40c6bcb67",
  ]);
  assert(!matchingIds.includes("obs-abc02f34-6bbf-48de-8486-8d1ec3b6e43e"));
  assert(!matchingIds.includes("obs-0e1dcf64-48f0-43d7-b39b-b6325a07c16e"));
});

test("real release locks all catalogs and chronological dropdown entries", () => {
  const entries = app.catalogSelectorEntries(registry);
  assert.equal(entries.length, 26);
  assert.deepEqual(entries.map(([id]) => id), [
    "lucas-1813", "chladni-1819", "chladni-1825", "haidinger-1859", "buchner-1863",
    "nordenskiold-1870", "ball-1882", "usnm-1886", "hovey-1896", "washington-1897",
    "tassin-1902", "hogbom-1902", "farrington-1903", "schreiter-1912", "merrill-1916",
    "prior-1923", "palache-1926", "nininger-1933", "reeds-1937", "barnes-1940", "nininger-1950", "mason-1964", "huss-1976",
    "huss-1986", "kanagawa-1996", "asu-2024-09",
  ]);
  assert.equal(app.catalogDropdownLabel(registry["merrill-1916"], "merrill-1916"), "Merrill (1916)");
  assert.equal(app.catalogDropdownLabel(registry["prior-1923"], "prior-1923"), "Prior (1923)");
  assert.equal(app.catalogDropdownLabel(registry["palache-1926"], "palache-1926"), "Palache (1926)");
  assert.equal(app.catalogDropdownLabel(registry["reeds-1937"], "reeds-1937"), "Reeds (1937)");
  assert.equal(app.catalogDropdownLabel(registry["kanagawa-1996"], "kanagawa-1996"), "Kanagawa (1996)");
});

test("chronological mapping copies pairs and excludes equal-year comparisons", () => {
  const later = { id: "later", catalogId: "later-1950", catalogYear: 1950 };
  const earlier = { id: "earlier", catalogId: "earlier-1933", catalogYear: 1933 };
  const observations = [later, earlier];
  const original = [...observations];
  assert.deepEqual(app.chronologicalEarlierPair(observations), { earlier, later });
  assert.deepEqual(observations, original);
  assert.equal(app.chronologicalEarlierPair([
    { id: "a", catalogId: "a-1933", catalogYear: 1933 },
    { id: "b", catalogId: "b-1933", catalogYear: 1933 },
  ]), null);
});

test("strict runtime validation rejects malformed or forged enhancement data", () => {
  const mutations = [
    (data) => { data.metadata.schemaVersion = 1; },
    (data) => { data.metadata.scope = "candidate-only"; },
    (data) => { data.metadata.collectionSeries[0].id = "forged"; },
    (data) => { data.metadata.counts.relationshipCount += 1; },
    (data) => { data.relationships[1].id = data.relationships[0].id; },
    (data) => { data.relationships[1].observations[0].id = data.relationships[0].observations[0].id; },
    (data) => { data.relationships[0].observations.pop(); },
    (data) => { data.relationships[0].observations[0].recordId = "missing-record"; },
    (data) => { data.relationships[0].observations[0].catalogSearchUrl = "https://example.org/"; },
    (data) => { possible(data).status = "confirmed"; },
    (data) => { sameInventory(data).relationship = "possible-match"; },
    ...forgedFactMutations,
  ];
  for (const mutate of mutations) {
    const candidate = clone(lineageData);
    mutate(candidate);
    assert.throws(() => app.validateLineageCandidates(candidate, records, registry), /specimen-lineage data/);
  }
});

test("runtime rederives IDs and requires complete possible relationships", () => {
  const forgedRelationship = clone(lineageData);
  possible(forgedRelationship).id = "possible-lineage-00000000-0000-5000-8000-000000000000";
  assert.throws(() => app.validateLineageCandidates(forgedRelationship, records, registry), /specimen-lineage data/);

  const forgedObservation = clone(lineageData);
  possible(forgedObservation).observations[0].id = "mass-observation-00000000-0000-5000-8000-000000000000";
  assert.throws(() => app.validateLineageCandidates(forgedObservation, records, registry), /specimen-lineage data/);

  const incomplete = clone(lineageData);
  incomplete.relationships.splice(incomplete.relationships.findIndex(({ relationship }) => relationship === "possible-match"), 1);
  recomputeCounts(incomplete);
  assert.throws(() => app.validateLineageCandidates(incomplete, records, registry), /specimen-lineage data/);
});

test("runtime collision validation rejects Rosebud as the Nininger 108b endpoint", () => {
  const forged = clone(lineageData);
  const relationship = sameInventory(forged, "108b");
  const observation = relationship.observations.find(({ catalogId }) => catalogId === "nininger-1950");
  const rosebud = records.find(({ catalogId, designation, name }) => catalogId === "nininger-1950" && designation === "108b" && name === "Rosebud");
  observation.recordId = rosebud.id;
  observation.sourceName = rosebud.name;
  observation.canonicalName = rosebud.metbull.canonicalName;
  observation.meteoriteCode = rosebud.metbull.meteoriteCode;
  observation.massGrams = null;
  assert.throws(() => app.validateLineageCandidates(forged, records, registry), /specimen-lineage data/);
});

test("review outcomes apply only to possible matches and not-supported entries are omitted", () => {
  const retained = clone(lineageData);
  const target = possible(retained);
  target.review = {
    status: "reviewed",
    outcome: "retain-as-possible",
    reviewedOn: "2026-07-28",
    publicNote: "Retained as a possible comparison.",
    citations: [{ label: "Public evidence", url: "https://dead.beef/evidence" }],
  };
  retained.metadata.counts.unreviewedPossibleMatchCount -= 1;
  assert.equal(app.validateLineageCandidates(retained, records, registry), retained);

  const notSupported = clone(retained);
  possible(notSupported).review.outcome = "not-supported";
  assert.equal(entryCount(app.deriveEarlierRecordIndex(notSupported, records, registry)), 1251);

  const confirmed = clone(retained);
  possible(confirmed).review.outcome = "confirmed";
  assert.throws(() => app.validateLineageCandidates(confirmed, records, registry), /specimen-lineage data/);
});

test("real data maps only later records without mutation and matches the locked distribution", () => {
  const before = JSON.stringify(lineageData);
  const index = app.deriveEarlierRecordIndex(lineageData, records, registry);
  assert.equal(JSON.stringify(lineageData), before);
  assert.equal(index.size, 803);
  assert.equal(entryCount(index), 1252);
  assert.equal(Math.max(...[...index.values()].map((entries) => entries.length)), 98);
  const distribution = [...index.values()].reduce((counts, entries) => {
    counts[entries.length] = (counts[entries.length] || 0) + 1;
    return counts;
  }, {});
  assert.deepEqual(distribution, { 1: 668, 2: 100, 3: 13, 4: 6, 5: 5, 6: 5, 12: 1, 14: 1, 25: 1, 36: 1, 81: 1, 98: 1 });
  assert.ok(records.some((record) => !index.has(record.id)));
});

test("cards distinguish same inventory continuity from possible matching", () => {
  const index = app.deriveEarlierRecordIndex(lineageData, records, registry);
  const dalgaranga = records.find((record) => record.catalogId === "huss-1986" && record.designation === "(2)H160.1");
  assert.deepEqual(index.get(dalgaranga.id), [{
    relationshipId: sameInventory(lineageData, "h160.1").id,
    relationship: "same-inventory",
    recordId: "h160-1-585a63ba5ded",
    catalogYear: 1976,
    catalogLabel: "Huss Meteorite Collection catalog (1976)",
    sourceName: "Dalgaranga",
    massGrams: 3.4,
    seriesId: "huss",
    inventoryId: "h160.1",
    strength: null,
    catalogSearchUrl: "./index.html?catalog=huss-1976&q=record%20id%20h160-1-585a63ba5ded#catalog",
  }]);
  const possibleEntry = [...index.values()].flat().find(({ relationship }) => relationship === "possible-match");
  assert.equal(possibleEntry.seriesId, null);
  assert.equal(possibleEntry.inventoryId, null);
  assert(LINEAGE_STRENGTH_VALUES.has(possibleEntry.strength));
  assert.equal(app.formatEarlierRecordMass(null), "Not recorded");
});

const LINEAGE_STRENGTH_VALUES = new Set(["multiple-matching-facts", "two-matching-facts", "limited-matching-evidence"]);

test("Sandia receives 108b continuity while Rosebud receives none", () => {
  const index = app.deriveEarlierRecordIndex(lineageData, records, registry);
  const sandia = records.find((record) => record.catalogId === "nininger-1950" && record.designation === "108b" && record.name === "Sandia Mountains");
  const rosebud = records.find((record) => record.catalogId === "nininger-1950" && record.designation === "108b" && record.name === "Rosebud");
  assert.equal(index.get(sandia.id)[0].sourceName, "Sandia Mts.");
  assert.equal(index.get(sandia.id)[0].inventoryId, "108b");
  assert.equal(index.has(rosebud.id), false);
});

test("all 1252 earlier links resolve to exact public source records", () => {
  const index = app.deriveEarlierRecordIndex(lineageData, records, registry);
  for (const entries of index.values()) {
    for (const entry of entries) {
      const url = new URL(entry.catalogSearchUrl, "https://example.test/");
      assert.equal(url.pathname, "/index.html");
      assert.equal(url.hash, "#catalog");
      const destinationIds = records.filter((record) =>
        record.catalogId === url.searchParams.get("catalog") && app.matchesSearch(record, url.searchParams.get("q"))
      ).map(({ id }) => id);
      assert.deepEqual(destinationIds, [entry.recordId], `${entry.catalogSearchUrl} did not resolve exactly to ${entry.recordId}`);
    }
  }
  assert.equal(entryCount(index), 1252);
});

test("all 2504 published observation links resolve to exact public source records", () => {
  let count = 0;
  for (const relationship of lineageData.relationships) {
    for (const observation of relationship.observations) {
      count += 1;
      const url = new URL(observation.catalogSearchUrl, "https://example.test/");
      assert.equal(url.pathname, "/index.html");
      assert.equal(url.hash, "#catalog");
      assert.equal(url.searchParams.get("q"), `record id ${observation.recordId}`);
      const destinationIds = records.filter((record) =>
        record.catalogId === url.searchParams.get("catalog") && app.matchesSearch(record, url.searchParams.get("q"))
      ).map(({ id }) => id);
      assert.deepEqual(destinationIds, [observation.recordId], `${observation.catalogSearchUrl} did not resolve exactly`);
    }
  }
  assert.equal(count, 2504);
});

test("optional fetch failures and malformed payloads return an empty enhancement", async () => {
  const failed = await app.loadEarlierRecordIndex(records, registry, async () => { throw new Error("offline"); });
  assert.equal(failed.size, 0);
  const missing = await app.loadEarlierRecordIndex(records, registry, async () => ({ ok: false }));
  assert.equal(missing.size, 0);
  const malformed = await app.loadEarlierRecordIndex(records, registry, async () => ({ ok: true, json: async () => ({ metadata: {}, relationships: [] }) }));
  assert.equal(malformed.size, 0);
  for (const mutate of forgedFactMutations) {
    const forged = clone(lineageData);
    mutate(forged);
    const rejected = await app.loadEarlierRecordIndex(records, registry, async () => ({ ok: true, json: async () => forged }));
    assert.equal(rejected.size, 0);
  }
});
