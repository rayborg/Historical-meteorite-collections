import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = require(path.join(projectRoot, "app.js"));
const [lineageText, catalogText, projectionText] = await Promise.all([
  readFile(path.join(projectRoot, "data", "specimen-lineages.json"), "utf8"),
  readFile(path.join(projectRoot, "data", "catalog.json"), "utf8"),
  readFile(path.join(projectRoot, "data", "specimen-card-projections.json"), "utf8"),
]);
const catalog = JSON.parse(catalogText);
const lineageData = JSON.parse(lineageText);
const registry = app.normalizeCatalogRegistry(catalog.metadata);
const records = catalog.records.map((record, index) => app.prepareRecord(record, index, registry));

function clone(value) {
  return structuredClone(value);
}

function entryCount(index) {
  return [...index.values()].reduce((sum, entries) => sum + entries.length, 0);
}

function possible(data) {
  return data.relationships.find(({ relationship, review }) => relationship === "possible-match" && review.status === "unreviewed");
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

test("main template presents lineage through the harmonized specimen contract", async () => {
  const [html, css, source] = await Promise.all([
    readFile(path.join(projectRoot, "index.html"), "utf8"),
    readFile(path.join(projectRoot, "styles.css"), "utf8"),
    readFile(path.join(projectRoot, "app.js"), "utf8"),
  ]);
  assert.doesNotMatch(html, /possible-specimen-lineages\.html/);
  assert.match(html, /<p class="record-semantic-label"><\/p>/);
  assert.match(html, /<dl class="record-meta" aria-label="Catalog record details"><\/dl>/);
  assert.doesNotMatch(html, /lineage-row|earlier-records/);
  const index = app.deriveEarlierRecordIndex(lineageData, records, registry);
  const record = records.find(({ catalogId, designation }) => catalogId === "huss-1986" && designation === "(2)H160.1");
  const dto = app.presentHarmonizedCard(record, { lineageEntries: index.get(record.id) });
  assert.deepEqual(dto.facts.find(({ label }) => label === "Lineage"), {
    label: "Lineage", value: "Known same-inventory continuity: 1 | Suspected cross-catalog matches: 0 | Source-attested tentative groups: 0"
  });
  assert.doesNotMatch(source, /\.innerHTML\b/);
  assert.doesNotMatch(css, /\.earlier-records \{/);
  assert.equal(app.CACHE_VERSION, "20260911-known-facts-1");
  assert.equal(app.ASSET_CACHE_VERSION, "20260911-known-facts-1");
  assert.match(html, /styles\.css\?v=20260911-known-facts-1/);
  assert.match(html, /app\.js\?v=20260911-known-facts-1/);
  for (const file of ["possible-specimen-lineages.html", "possible-specimen-lineages.css", "possible-specimen-lineages.js"]) {
    await assert.rejects(access(path.join(projectRoot, file)));
  }
});

test("lineage filter markup and asynchronous settlement remain fail-closed", async () => {
  const [html, source] = await Promise.all([
    readFile(path.join(projectRoot, "index.html"), "utf8"),
    readFile(path.join(projectRoot, "app.js"), "utf8"),
  ]);
  assert.match(html, /<label class="filter-toggle lineage-field">\s*<input id="lineage-only" name="lineage" type="checkbox" value="1">\s*<span>Source-complete lineage claims only<\/span>\s*<\/label>/);
  assert.match(html, /<input id="include-unknown-weight" name="include-unknown-weight" type="checkbox">/);
  assert.match(source, /filterSpecimenCardDescriptors\([\s\S]*earlierRecordsByLaterId/);
  assert.match(source, /if \(index\.size \|\| elements\.lineageOnly\.checked\) render\(\);/);
  assert.match(source, /filters\.lineageOnly \|\| filters\.includeUnknownWeight === true \|\| filters\.sort !== DEFAULT_SORT/);
  assert.match(source, /function clearFilters\(\) \{\s*elements\.form\.reset\(\);/);
  assert.doesNotMatch(source, /\.innerHTML\b/);
});

test("every card receives a concise lineage summary", () => {
  assert.equal(app.formatLineageSummary(0), "No lineage known");
  assert.equal(app.formatLineageSummary(1), "1 earlier lineage record");
  assert.equal(app.formatLineageSummary(98), "98 earlier lineage records");
  assert.equal(app.formatLineageSummary([{ presentationStatus: "tentative" }]),
    "Known same-inventory continuity: 0 | Suspected cross-catalog matches: 0 | Source-attested tentative groups: 1");
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
  assert.equal(entries.length, 52);
  assert.deepEqual(entries.map(([id]) => id), [
    "lucas-1813", "chladni-1819", "chladni-1825", "haidinger-1859", "buchner-1863",
    "nordenskiold-1870", "story-maskelyne-1872", "ward-1881", "ball-1882", "fletcher-1886", "usnm-1886", "minnesota-1892", "fletcher-1894", "greifswald-1895", "fletcher-1896", "hovey-1896", "washington-1897",
    "greifswald-1901", "tassin-1902", "hogbom-1902", "farrington-1903", "berlin-1903", "fletcher-1904", "ward-1904", "berlin-1904", "fletcher-1908", "foote-1909", "schreiter-1912", "foote-1912",
    "anderson-1913", "hamburg-1913", "brown-1916", "farrington-1916", "merrill-1916", "kantor-1920", "prior-1923", "madrid-1923", "prior-guide-1926", "palache-1926", "brauns-bonn-1926",
    "nininger-1933", "reeds-1937", "astapovich-1938", "hodge-smith-1939", "barnes-1940", "nininger-1950", "mason-1964",
    "huss-1976", "victoria-land-1982", "huss-1986", "kanagawa-1996", "asu-2024-09",
  ]);
  assert.equal(app.catalogDropdownLabel(registry["anderson-1913"], "anderson-1913"), "Anderson (1913)");
  assert.equal(app.catalogDropdownLabel(registry["kantor-1920"], "kantor-1920"), "Kantor (1920)");
  assert.equal(app.catalogDropdownLabel(registry["astapovich-1938"], "astapovich-1938"), "Astapovich (1938)");
  assert.equal(app.catalogDropdownLabel(registry["merrill-1916"], "merrill-1916"), "Merrill (1916)");
  assert.equal(app.catalogDropdownLabel(registry["ward-1881"], "ward-1881"), "Ward (1881)");
  assert.equal(app.catalogDropdownLabel(registry["ward-1904"], "ward-1904"), "Ward (1904)");
  assert.equal(app.catalogDropdownLabel(registry["farrington-1916"], "farrington-1916"), "Farrington (1916)");
  assert.equal(app.catalogDropdownLabel(registry["foote-1912"], "foote-1912"), "Foote (1912)");
  assert.equal(app.catalogDropdownLabel(registry["fletcher-1904"], "fletcher-1904"), "Fletcher (1904)");
  assert.equal(app.catalogDropdownLabel(registry["prior-1923"], "prior-1923"), "Prior (1923)");
  assert.equal(app.catalogDropdownLabel(registry["madrid-1923"], "madrid-1923"), "Madrid (1923)");
  assert.equal(app.catalogDropdownLabel(registry["palache-1926"], "palache-1926"), "Palache (1926)");
  assert.equal(app.catalogDropdownLabel(registry["reeds-1937"], "reeds-1937"), "Reeds (1937)");
  assert.equal(app.catalogDropdownLabel(registry["kanagawa-1996"], "kanagawa-1996"), "Kanagawa (1996)");
});

test("new facts-only catalogs filter, search, sort, and retain catalog-scoped pages", () => {
  const expected = {
    "anderson-1913": { count: 57, query: "Arltunga", id: "obs-725eab11-ce66-43fb-be5b-8158faeb20a6", pages: [54] },
    "astapovich-1938": { count: 90, query: "Laurentjewka", id: "obs-e4ea64d7-83e5-4cd3-bcbd-f6dcb3e475ff", pages: [196] },
    "kantor-1920": { count: 30, query: "Caperr Aiken", id: "obs-8a2c7865-6048-4576-b52f-17bc489d3506", pages: [107, 108, 109] },
    "madrid-1923": { count: 130, query: "Agen", id: "obs-a6a576fb-4a5c-42b0-ad4d-b71a78632453", pages: [226] },
  };

  for (const [catalogId, item] of Object.entries(expected)) {
    const filtered = app.filterRecords(records, { query: "", catalog: catalogId, min: null, max: null, sort: app.DEFAULT_SORT });
    assert.equal(filtered.length, item.count);
    const searched = app.filterRecords(records, { query: item.query, catalog: catalogId, min: null, max: null, sort: app.DEFAULT_SORT });
    assert.deepEqual(searched.map(({ id }) => id), [item.id]);
    assert.deepEqual(app.recordCatalogPages(searched[0]), item.pages);
  }

  const weighted = app.filterRecords(records, {
    query: "",
    catalog: "kantor-1920",
    min: null,
    max: null,
    sort: "weight-desc",
  });
  assert.equal(weighted[0].id, expected["kantor-1920"].id);
  assert.deepEqual(app.recordMasses(weighted[0]), [114000]);
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
    (data) => { data.sourceAttestedGroups[0].members[0] = "ALHA76006"; },
    (data) => { data.metadata.source.sourceClaimsContentSha256 = "0".repeat(64); },
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
  notSupported.relationships.find(({ id }) => id === target.id).review.outcome = "not-supported";
  assert.equal(entryCount(app.deriveEarlierRecordIndex(notSupported, records, registry)), 2508);

  const confirmed = clone(retained);
  confirmed.relationships.find(({ id }) => id === target.id).review.outcome = "confirmed";
  assert.throws(() => app.validateLineageCandidates(confirmed, records, registry), /specimen-lineage data/);
});

test("real data maps only later records without mutation and matches the locked distribution", () => {
  const before = JSON.stringify(lineageData);
  const index = app.deriveEarlierRecordIndex(lineageData, records, registry);
  assert.equal(JSON.stringify(lineageData), before);
  assert.equal(index.size, 1405);
  assert.equal(entryCount(index), 2509);
  assert.equal(Math.max(...[...index.values()].map((entries) => entries.length)), 98);
  const distribution = [...index.values()].reduce((counts, entries) => {
    counts[entries.length] = (counts[entries.length] || 0) + 1;
    return counts;
  }, {});
  assert.deepEqual(distribution, { 1: 973, 2: 245, 3: 31, 4: 124, 5: 5, 6: 10, 7: 1, 8: 5, 9: 2, 10: 1, 11: 1, 13: 1, 15: 1, 18: 1, 25: 1, 36: 1, 81: 1, 98: 1 });
  assert.ok(records.some((record) => !index.has(record.id)));
});

test("source-attested Table C groups retain exact n-ary membership and feed card lineage without pair expansion", () => {
  const index = app.deriveEarlierRecordIndex(lineageData, records, registry);
  const groups = lineageData.sourceAttestedGroups;
  const members = groups.flatMap(({ members: groupMembers }) => groupMembers);
  const exactMemberIndex = app.deriveSourceAttestedGroupIndex(groups);
  const entries = [...index.values()].flat().filter(({ kind }) => kind === "group-route");
  assert.deepEqual({ groups: groups.length, occurrences: members.length, uniqueMembers: new Set(members).size },
    { groups: 21, occurrences: 89, uniqueMembers: 87 });
  assert.equal(exactMemberIndex.size, 87);
  assert.equal([...exactMemberIndex.values()].flat().length, 89);
  assert.equal(exactMemberIndex.has("ALHA77034"), true);
  assert.equal(exactMemberIndex.has("BTNA77034"), false);
  assert.deepEqual({ indexedRecords: new Set(entries.map(({ currentMember }) => currentMember)).size, indexedEntries: entries.length },
  { indexedRecords: 77, indexedEntries: 79 });
  for (const entry of entries) {
    const source = groups.find(({ id }) => id === entry.claim.groupId);
    assert.deepEqual(entry.claim.members, source.members);
    assert.equal(entry.claim.source.sourceSection, "Appendix Table C");
    assert.equal(entry.claim.source.printedPage, 94);
    assert.equal(Object.hasOwn(entry.claim, "recordId"), false);
  }
  const alha76005 = records.find(({ specimenId }) => specimenId === "ALHA76005");
  assert.equal(app.presentHarmonizedCard(alha76005, { lineageEntries: index.get(alha76005.id) })
    .facts.find(({ label }) => label === "Lineage").value,
  "Known same-inventory continuity: 0 | Suspected cross-catalog matches: 0 | Source-attested tentative groups: 1");
  const descriptors = app.expandSpecimenCardDescriptors(
    records.filter(({ catalogId }) => catalogId === "victoria-land-1982"), new Map());
  const lineageOnly = app.filterSpecimenCardDescriptors(descriptors, {
    query: "", catalog: "victoria-land-1982", min: null, max: null, lineageOnly: true, sort: app.DEFAULT_SORT
  }, index);
  assert.equal(lineageOnly.length, 77);
});

test("source-complete lineage routing exposes exactly 963 cards and 1,451 closed claims", () => {
  const index = app.deriveEarlierRecordIndex(lineageData, records, registry);
  const projectionData = JSON.parse(projectionText);
  const projectionIndex = app.deriveSpecimenCardProjectionIndex(projectionData, records, {
    sourceCatalogSha256: createHash("sha256").update(catalogText).digest("hex"),
  });
  const descriptors = app.expandSpecimenCardDescriptors(records, projectionIndex);
  const routed = descriptors.map((descriptor) => ({
    descriptor,
    claims: app.renderableLineageClaimsForCard(descriptor, index.get(descriptor.parentRecord.id) || []),
  })).filter(({ claims }) => claims.length > 0);
  const claims = routed.flatMap(({ claims: cardClaims }) => cardClaims);
  assert.deepEqual({ cards: routed.length, claims: claims.length }, { cards: 963, claims: 1451 });
  assert.deepEqual(Object.fromEntries(["known", "suspected", "tentative"].map((status) =>
    [status, claims.filter(({ presentationStatus }) => presentationStatus === status).length])),
  { known: 194, suspected: 1178, tentative: 79 });
  assert(claims.every((claim) => ["known", "suspected", "tentative"].includes(claim.presentationStatus)));
  for (const claim of claims) {
    assert.match(claim.caution, /does not (?:establish|create)|Suspected match only/u);
    if (claim.kind === "source-attested-tentative-group") {
      assert.equal(claim.rawClaimType, "tentative-n-ary-group");
      assert.equal(claim.source.printedPage, 94);
      assert(claim.members.includes(claim.currentMember));
      continue;
    }
    for (const endpoint of [claim.earlierEndpoint, claim.laterEndpoint]) {
      assert(endpoint.catalogLabel && Number.isInteger(endpoint.catalogYear));
      assert(endpoint.sourceRecordLabel && endpoint.sourcePages.length > 0);
      assert.equal(typeof endpoint.catalogSearchUrl, "string");
      assert(endpoint.massGrams === null || Number.isFinite(endpoint.massGrams));
    }
    if (claim.kind === "same-inventory") {
      assert.equal(claim.basis.code, "series-scoped-normalized-inventory-id");
    } else {
      assert(claim.evidence.factCodes.length >= 2);
      assert(["reviewed", "unreviewed"].includes(claim.review.status));
      assert(Array.isArray(claim.review.citations));
      if (claim.review.status === "reviewed") assert.equal(claim.review.outcome, "retain-as-possible");
    }
  }
  assert.equal(app.filterSpecimenCardDescriptors(descriptors, {
    min: null, max: null, lineageOnly: true, includeUnknownWeight: true,
  }, index).length, 963);
});

test("cards distinguish same inventory continuity from possible matching", () => {
  const index = app.deriveEarlierRecordIndex(lineageData, records, registry);
  const dalgaranga = records.find((record) => record.catalogId === "huss-1986" && record.designation === "(2)H160.1");
  const [dalgarangaEntry] = index.get(dalgaranga.id);
  assert.equal(dalgarangaEntry.kind, "relationship-route");
  assert.equal(dalgarangaEntry.claim.relationshipId, sameInventory(lineageData, "h160.1").id);
  assert.equal(dalgarangaEntry.claim.presentationStatus, "known");
  assert.deepEqual(dalgarangaEntry.claim.collectionSeries, { id: "huss", inventoryId: "h160.1" });
  assert.deepEqual(dalgarangaEntry.claim.earlierEndpoint, {
    recordId: "h160-1-585a63ba5ded",
    catalogId: "huss-1976",
    catalogLabel: "Huss Meteorite Collection catalog (1976)",
    catalogYear: 1976,
    sourceRecordLabel: "H160.1",
    sourceName: "Dalgaranga",
    designation: "H160.1",
    massGrams: 3.4,
    sourcePages: [12],
    catalogSearchUrl: "./index.html?catalog=huss-1976&q=record%20id%20h160-1-585a63ba5ded#catalog",
  });
  const possibleEntry = [...index.values()].flat().find(({ claim }) => claim?.kind === "possible-match");
  assert.equal(possibleEntry.claim.presentationStatus, "suspected");
  assert(LINEAGE_STRENGTH_VALUES.has(possibleEntry.claim.evidence.strength));
  assert.equal(app.formatEarlierRecordMass(null), "Not recorded");
});

test("lineage disclosures name source catalogs while stable IDs remain audit details", async () => {
  const index = app.deriveEarlierRecordIndex(lineageData, records, registry);
  const relationship = lineageData.relationships.find(({ id }) =>
    id === "possible-lineage-9c24421a-5be6-577b-b380-18451834c2ed");
  const laterRecordId = relationship.observations.find(({ catalogId }) => catalogId === "farrington-1916").recordId;
  const entry = index.get(laterRecordId).find(({ claim }) => claim.relationshipId === relationship.id);
  assert.equal(app.lineageClaimDisclosureText(entry.claim),
    "Suspected cross-catalog match · Earlier catalog: Catalogue of the Meteorite Collection of the Field Columbian Museum, May 1, 1903 (1903)");
  assert.doesNotMatch(app.lineageClaimDisclosureText(entry.claim), /possible-lineage|[0-9a-f]{8}-[0-9a-f-]{27}/u);

  const groupEntry = [...index.values()].flat().find(({ kind }) => kind === "group-route");
  assert.equal(app.lineageClaimDisclosureText(groupEntry.claim),
    `${app.lineageDisplayLabel("presentationStatus", groupEntry.claim.presentationStatus)} · Source catalog: ${groupEntry.claim.source.catalogLabel}`);
  const source = await readFile(path.join(projectRoot, "app.js"), "utf8");
  assert.match(source, /appendLineageText\(details, "Relationship ID", claim\.relationshipId\)/u);
  assert.match(source, /appendLineageText\(details, "Group ID", claim\.groupId\)/u);
});

const LINEAGE_STRENGTH_VALUES = new Set(["multiple-matching-facts", "two-matching-facts", "limited-matching-evidence"]);

test("Sandia receives 108b continuity while Rosebud receives none", () => {
  const index = app.deriveEarlierRecordIndex(lineageData, records, registry);
  const sandia = records.find((record) => record.catalogId === "nininger-1950" && record.designation === "108b" && record.name === "Sandia Mountains");
  const rosebud = records.find((record) => record.catalogId === "nininger-1950" && record.designation === "108b" && record.name === "Rosebud");
  assert.equal(index.get(sandia.id)[0].claim.earlierEndpoint.sourceName, "Sandia Mts.");
  assert.equal(index.get(sandia.id)[0].claim.collectionSeries.inventoryId, "108b");
  assert.equal(index.has(rosebud.id), false);
});

test("all 2430 earlier links resolve to exact public source records", () => {
  const index = app.deriveEarlierRecordIndex(lineageData, records, registry);
  const earlierEntries = [...index.values()].flat().filter(({ kind }) => kind === "relationship-route");
  for (const entry of earlierEntries) {
      const endpoint = entry.claim.earlierEndpoint;
      const url = new URL(endpoint.catalogSearchUrl, "https://example.test/");
      assert.equal(url.pathname, "/index.html");
      assert.equal(url.hash, "#catalog");
      const destinationIds = records.filter((record) =>
        record.catalogId === url.searchParams.get("catalog") && app.matchesSearch(record, url.searchParams.get("q"))
      ).map(({ id }) => id);
      assert.deepEqual(destinationIds, [endpoint.recordId], `${endpoint.catalogSearchUrl} did not resolve exactly to ${endpoint.recordId}`);
  }
  assert.equal(earlierEntries.length, 2430);
});

test("all 4878 published observation links resolve to exact public source records", () => {
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
  assert.equal(count, 4878);
});

test("optional fetch failures and malformed payloads return an empty enhancement", async () => {
  const failed = await app.loadEarlierRecordIndex(records, registry, async () => { throw new Error("offline"); });
  assert.equal(failed.size, 0);
  const missing = await app.loadEarlierRecordIndex(records, registry, async () => ({ ok: false }));
  assert.equal(missing.size, 0);
  const sha256 = async (value) => createHash("sha256").update(value).digest("hex");
  const malformed = await app.loadEarlierRecordIndex(records, registry, async () => ({
    ok: true, text: async () => JSON.stringify({ metadata: {}, relationships: [] }),
  }), { sha256 });
  assert.equal(malformed.size, 0);
  const loaded = await app.loadEarlierRecordIndex(records, registry, async () => ({
    ok: true, text: async () => lineageText,
  }), { sha256 });
  assert.equal(entryCount(loaded), 2509);
  assert.equal(app.SPECIMEN_LINEAGE_DATA_SHA256,
    "3f1d63db2effbe497e328ac99831c22d661fd72a2fba2fd1ec74a83186a523a9");
  for (const mutate of forgedFactMutations) {
    const forged = clone(lineageData);
    mutate(forged);
    const rejected = await app.loadEarlierRecordIndex(records, registry, async () => ({
      ok: true, text: async () => JSON.stringify(forged),
    }), { sha256 });
    assert.equal(rejected.size, 0);
  }
});
