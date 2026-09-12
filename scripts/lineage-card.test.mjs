import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const app = require("../app.js");
const [lineageText, catalogText, projectionText, html, css, source] = await Promise.all([
  readFile(new URL("../data/specimen-lineages.json", import.meta.url), "utf8"),
  readFile(new URL("../data/catalog.json", import.meta.url), "utf8"),
  readFile(new URL("../data/specimen-card-projections.json", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8"),
  readFile(new URL("../app.js", import.meta.url), "utf8"),
]);
const catalog = JSON.parse(catalogText);
const lineageData = JSON.parse(lineageText);
const registry = app.normalizeCatalogRegistry(catalog.metadata);
const records = catalog.records.map((record, index) => app.prepareRecord(record, index, registry));
const projectionIndex = app.deriveSpecimenCardProjectionIndex(JSON.parse(projectionText), records, {
  sourceCatalogSha256: createHash("sha256").update(catalogText).digest("hex"),
});
const descriptors = app.expandSpecimenCardDescriptors(records, projectionIndex);
const lineageIndex = app.deriveEarlierRecordIndex(lineageData, records, registry);
const comparisonIndex = app.deriveComparisonGroupIndex(lineageData, records, registry);

const clone = structuredClone;
const flattenIndex = (index) => [...index.values()].flat();
const sameInventory = (data, inventoryId = "h160.1") => data.relationships.find((relationship) =>
  relationship.collectionSeries.inventoryId === inventoryId);

test("main template presents lineage and comparisons through separate harmonized card contracts", async () => {
  assert.doesNotMatch(html, /possible-specimen-lineages\.html/u);
  assert.match(html, /<p class="record-semantic-label"><\/p>/u);
  assert.match(html, /<dl class="record-meta" aria-label="Catalog record details"><\/dl>/u);
  assert.doesNotMatch(html, /lineage-row|earlier-records/u);
  const record = records.find(({ catalogId, designation }) =>
    catalogId === "huss-1986" && designation === "(2)H160.1");
  const dto = app.presentHarmonizedCard(record, {
    lineageEntries: lineageIndex.get(record.id),
    comparisonEntries: comparisonIndex.get(record.id),
    registry,
  });
  assert.deepEqual(dto.facts.find(({ label }) => label === "Lineage"), {
    label: "Lineage",
    value: "Known same-inventory continuity: 1 | Source-attested tentative groups: 0",
  });
  assert(dto.comparison === null || dto.comparison.groups.every(({ groupId }) => groupId.startsWith("comparison-group-")));
  assert.doesNotMatch(source, /\.innerHTML\b/u);
  assert.doesNotMatch(css, /\.earlier-records \{/u);
  for (const file of ["possible-specimen-lineages.html", "possible-specimen-lineages.css", "possible-specimen-lineages.js"]) {
    await assert.rejects(access(new URL(`../${file}`, import.meta.url)));
  }
});

test("lineage filter markup and asynchronous settlement remain fail-closed", () => {
  assert.match(html, /<label class="filter-toggle lineage-field">\s*<input id="lineage-only" name="lineage" type="checkbox" value="1">\s*<span>Source-complete lineage claims only<\/span>\s*<\/label>/u);
  assert.match(html, /<input id="include-unknown-weight" name="include-unknown-weight" type="checkbox">/u);
  assert.match(source, /filterSpecimenCardDescriptors\([\s\S]*earlierRecordsByLaterId/u);
  assert.match(source, /if \(lineageIndex\.size \|\| comparisonIndex\.size \|\| elements\.lineageOnly\.checked\) render\(\);/u);
  assert.match(source, /filters\.lineageOnly \|\| filters\.includeUnknownWeight === true \|\| filters\.sort !== DEFAULT_SORT/u);
  assert.match(source, /function clearFilters\(\) \{\s*elements\.form\.reset\(\);/u);
  assert.doesNotMatch(source, /\.innerHTML\b/u);
});

test("concise lineage summaries retain zero, singular, plural, and tentative behavior", () => {
  assert.equal(app.formatLineageSummary(0), "No lineage known");
  assert.equal(app.formatLineageSummary(1), "1 earlier lineage record");
  assert.equal(app.formatLineageSummary(98), "98 earlier lineage records");
  assert.equal(app.formatLineageSummary([{ presentationStatus: "tentative" }]),
    "Known same-inventory continuity: 0 | Source-attested tentative groups: 1");
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
  const expectedLabels = {
    "anderson-1913": "Anderson (1913)", "kantor-1920": "Kantor (1920)",
    "astapovich-1938": "Astapovich (1938)", "merrill-1916": "Merrill (1916)",
    "ward-1881": "Ward (1881)", "ward-1904": "Ward (1904)",
    "farrington-1916": "Farrington (1916)", "foote-1912": "Foote (1912)",
    "fletcher-1904": "Fletcher (1904)", "prior-1923": "Prior (1923)",
    "madrid-1923": "Madrid (1923)", "palache-1926": "Palache (1926)",
    "reeds-1937": "Reeds (1937)", "kanagawa-1996": "Kanagawa (1996)",
  };
  for (const [catalogId, label] of Object.entries(expectedLabels)) {
    assert.equal(app.catalogDropdownLabel(registry[catalogId], catalogId), label);
  }
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
    query: "", catalog: "kantor-1920", min: null, max: null, sort: "weight-desc",
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

test("schema v4 artifact is independently validated and reconstructed", () => {
  assert.equal(app.validateLineageCandidates(lineageData, records, registry), lineageData);
  assert.deepEqual({
    schema: lineageData.metadata.schemaVersion,
    relationships: lineageData.relationships.length,
    sourceGroups: lineageData.sourceAttestedGroups.length,
    comparisonGroups: lineageData.comparisonGroups.length,
    candidates: lineageData.comparisonGroups.reduce((sum, group) => sum + group.candidates.length, 0),
  }, { schema: 4, relationships: 194, sourceGroups: 21, comparisonGroups: 1541, candidates: 2245 });
  assert.equal(createHash("sha256").update(lineageText).digest("hex"), app.SPECIMEN_LINEAGE_DATA_SHA256);
  assert.equal(app.SPECIMEN_LINEAGE_DATA_SHA256, "b592065b07412b8d09d955f9276b2de0790a56f1649c7987a8b10bcc62c32199");
});

test("strict v4 validation rejects schema, partition, source, fact, review, and count mutations", () => {
  const mutations = [
    (data) => { data.metadata.schemaVersion = 3; },
    (data) => { data.metadata.scope = "series-inventory-and-cross-source-candidates"; },
    (data) => { data.metadata.methodology.possibleMatchIdentity = data.metadata.methodology.comparisonIdentity; },
    (data) => { data.metadata.counts.comparisonCandidateCount += 1; },
    (data) => { data.metadata.source.sourceClaimsContentSha256 = "0".repeat(64); },
    (data) => { data.relationships[0].relationship = "possible-match"; },
    (data) => { data.relationships[0].observations[0].sourceName = "Forged"; },
    (data) => { data.comparisonGroups[0].type = "possible-lineage"; },
    (data) => { data.comparisonGroups[0].massPair[0].massGrams += 1; },
    (data) => { data.comparisonGroups[0].candidateCount += 1; },
    (data) => { data.comparisonGroups[0].candidates[0].id = "comparison-candidate-00000000-0000-5000-8000-000000000000"; },
    (data) => { data.comparisonGroups[0].candidates[0].observations[0].massGrams += 1; },
    (data) => { data.comparisonGroups[0].candidates[0].evidence.factCodes.reverse(); },
    (data) => { data.comparisonGroups.flatMap(({ candidates }) => candidates).find(({ review }) => review.status === "reviewed").review.reviewedOn = "2026-02-30"; },
    (data) => { data.comparisonGroups.pop(); },
  ];
  for (const mutate of mutations) {
    const changed = clone(lineageData);
    mutate(changed);
    assert.throws(() => app.validateLineageCandidates(changed, records, registry), /specimen-lineage data/u);
  }
});

test("runtime collision validation rejects Rosebud as the Nininger 108b endpoint", () => {
  const forged = clone(lineageData);
  const relationship = sameInventory(forged, "108b");
  const observation = relationship.observations.find(({ catalogId }) => catalogId === "nininger-1950");
  const rosebud = records.find(({ catalogId, designation, name }) =>
    catalogId === "nininger-1950" && designation === "108b" && name === "Rosebud");
  observation.recordId = rosebud.id;
  observation.sourceName = rosebud.name;
  observation.canonicalName = rosebud.metbull.canonicalName;
  observation.meteoriteCode = rosebud.metbull.meteoriteCode;
  observation.massGrams = null;
  assert.throws(() => app.validateLineageCandidates(forged, records, registry), /specimen-lineage data/u);
});

test("Sandia receives 108b continuity while Rosebud receives none", () => {
  const sandia = records.find(({ catalogId, designation, name }) =>
    catalogId === "nininger-1950" && designation === "108b" && name === "Sandia Mountains");
  const rosebud = records.find(({ catalogId, designation, name }) =>
    catalogId === "nininger-1950" && designation === "108b" && name === "Rosebud");
  assert.equal(lineageIndex.get(sandia.id)[0].claim.earlierEndpoint.sourceName, "Sandia Mts.");
  assert.equal(lineageIndex.get(sandia.id)[0].claim.collectionSeries.inventoryId, "108b");
  assert.equal(lineageIndex.has(rosebud.id), false);
});

test("review outcomes remain comparison-only and the accepted review partition is fail-closed", () => {
  const gatedCatalogs = new Set([
    "brown-1916", "minnesota-1892", "greifswald-1895", "greifswald-1901",
    "berlin-1903", "berlin-1904", "brauns-bonn-1926",
  ]);
  const reviewedGroup = lineageData.comparisonGroups.find(({ candidates }) => candidates.some(({ review, observations }) =>
    review.status === "reviewed" && observations.some(({ catalogId }) => gatedCatalogs.has(catalogId))));
  const reviewed = reviewedGroup.candidates.find(({ review, observations }) =>
    review.status === "reviewed" && observations.some(({ catalogId }) => gatedCatalogs.has(catalogId)));
  const unreviewedGroup = lineageData.comparisonGroups.find(({ candidates }) =>
    candidates.some(({ review }) => review.status === "unreviewed"));
  const unreviewed = unreviewedGroup.candidates.find(({ review }) => review.status === "unreviewed");
  assert.equal(reviewed.review.outcome, "retain-as-possible");
  assert(Number.isInteger(Date.parse(`${reviewed.review.reviewedOn}T00:00:00Z`)));
  assert.deepEqual(unreviewed.review, {
    status: "unreviewed", outcome: null, reviewedOn: null, publicNote: null, citations: [],
  });
  assert(flattenIndex(comparisonIndex).some(({ groupId }) => groupId === reviewedGroup.id));
  assert(flattenIndex(comparisonIndex).some(({ groupId }) => groupId === unreviewedGroup.id));
  assert(flattenIndex(lineageIndex).every(({ claim }) => claim.presentationStatus !== "suspected"));
  const rejectedDecision = {
    review: { status: "reviewed", outcome: "not-supported", reviewedOn: "2026-09-12", publicNote: null, citations: [] },
  };
  assert.equal(app.hasRequiredComparisonReview(reviewed, true), true);
  assert.equal(app.hasRequiredComparisonReview(rejectedDecision, true), true);
  assert.equal(app.hasRequiredComparisonReview(unreviewed, true), false);
  assert.equal(app.hasRequiredComparisonReview({ review: { ...rejectedDecision.review, outcome: "confirmed" } }, true), false);
  assert.equal(app.hasRequiredComparisonReview(unreviewed, false), true);
  assert.equal(app.isRenderableComparisonCandidate(reviewed), true);
  assert.equal(app.isRenderableComparisonCandidate(rejectedDecision), false);

  for (const outcome of ["not-supported", "confirmed"]) {
    const changed = clone(lineageData);
    const target = changed.comparisonGroups.flatMap(({ candidates }) => candidates)
      .find(({ id }) => id === reviewed.id);
    target.review.outcome = outcome;
    assert.throws(() => app.validateLineageCandidates(changed, records, registry), /specimen-lineage data/u);
  }
});

test("not-supported comparison candidates remain in source data but never enter DTOs or routes", () => {
  const endpointKey = ({ recordId, massPath }) => `${recordId}\u0000${massPath}`;
  const sourceGroup = lineageData.comparisonGroups.find(({ candidates }) => {
    if (candidates.length < 2) return false;
    const otherEndpoints = new Set(candidates.slice(1).flatMap(({ observations }) => observations.map(endpointKey)));
    return candidates[0].observations.some((observation) => !otherEndpoints.has(endpointKey(observation)));
  });
  assert(sourceGroup);
  const mixedGroup = clone(sourceGroup);
  const rejected = mixedGroup.candidates[0];
  rejected.review = {
    status: "reviewed", outcome: "not-supported", reviewedOn: "2026-09-12",
    publicNote: "The reviewed comparison is not supported.", citations: [],
  };
  const sourceDocument = { comparisonGroups: [mixedGroup] };
  const sourceBeforeBuild = JSON.stringify(sourceDocument);
  const mixedIndex = app.buildComparisonGroupIndex(sourceDocument, records);
  const routes = flattenIndex(mixedIndex);
  const expectedRouteKeys = new Set(mixedGroup.candidates.slice(1)
    .flatMap(({ observations }) => observations.map(endpointKey)));
  assert.equal(mixedGroup.candidateCount, sourceGroup.candidateCount);
  assert.equal(mixedGroup.candidates.length, sourceGroup.candidates.length);
  assert.equal(mixedGroup.candidates[0].review.outcome, "not-supported");
  assert.equal(JSON.stringify(sourceDocument), sourceBeforeBuild);
  assert.deepEqual(new Set(routes.map(({ currentObservation }) => endpointKey(currentObservation))), expectedRouteKeys);
  assert(routes.every(({ comparison }) => comparison.candidateCount === mixedGroup.candidates.length - 1 &&
    comparison.candidates.length === mixedGroup.candidates.length - 1));
  assert(routes.every(({ comparison }) => !JSON.stringify(comparison).includes("The reviewed comparison is not supported.")));

  const rejectedOnly = clone(sourceGroup);
  rejectedOnly.candidates = [clone(sourceGroup.candidates[0])];
  rejectedOnly.candidateCount = 1;
  rejectedOnly.candidates[0].review = clone(rejected.review);
  const rejectedOnlySource = { comparisonGroups: [rejectedOnly] };
  assert.equal(app.buildComparisonGroupIndex(rejectedOnlySource, records).size, 0);
  assert.equal(rejectedOnlySource.comparisonGroups[0].candidates.length, 1);
  assert.equal(rejectedOnlySource.comparisonGroups[0].candidates[0].review.outcome, "not-supported");
});

test("lineage and comparison disclosures hide stable IDs and unavailable placeholders", () => {
  const dalgaranga = records.find(({ catalogId, designation }) =>
    catalogId === "huss-1986" && designation === "(2)H160.1");
  const known = lineageIndex.get(dalgaranga.id)[0].claim;
  assert.equal(app.lineageClaimDisclosureText(known),
    "Known same-inventory continuity · Earlier catalog: Huss Meteorite Collection catalog (1976)");
  assert.doesNotMatch(app.lineageClaimDisclosureText(known), /same-inventory-lineage|[0-9a-f]{8}-[0-9a-f-]{27}/u);

  const groupEntry = flattenIndex(lineageIndex).find(({ kind }) => kind === "group-route");
  assert.equal(app.lineageClaimDisclosureText(groupEntry.claim),
    `${app.lineageDisplayLabel("presentationStatus", groupEntry.claim.presentationStatus)} · Source catalog: ${groupEntry.claim.source.catalogLabel}`);
  assert.doesNotMatch(app.lineageClaimDisclosureText(groupEntry.claim), /victoria-land-1982-table-c-\d{3}/u);

  const comparisonRenderer = source.slice(source.indexOf("function renderComparisonGroups"),
    source.indexOf("function lineageClaimDisclosureText"));
  assert.doesNotMatch(comparisonRenderer, /(?:Group|Candidate) ID|comparison-group-[0-9a-f]/u);
  assert.doesNotMatch(source, /appendLineageText\([^\n]+(?:Not recorded|No public (?:note|citations) supplied)/u);
  assert.match(source, /if \(endpoint\.sourceName\) appendLineageText\(section, "Source name", endpoint\.sourceName\)/u);
  assert.match(source, /if \(Number\.isFinite\(endpoint\.massGrams\)\) appendLineageText/u);
  assert.match(comparisonRenderer, /if \(group\.identity\.canonicalName\) appendLineageText/u);
  assert.match(comparisonRenderer, /if \(candidate\.review\.publicNote\) appendLineageText/u);
});

test("source-attested Table C groups retain exact n-ary membership without pair expansion", () => {
  const groups = lineageData.sourceAttestedGroups;
  const members = groups.flatMap(({ members: groupMembers }) => groupMembers);
  const exactMemberIndex = app.deriveSourceAttestedGroupIndex(groups);
  const entries = flattenIndex(lineageIndex).filter(({ kind }) => kind === "group-route");
  assert.deepEqual({ groups: groups.length, occurrences: members.length, uniqueMembers: new Set(members).size },
    { groups: 21, occurrences: 89, uniqueMembers: 87 });
  assert.equal(exactMemberIndex.size, 87);
  assert.equal(flattenIndex(exactMemberIndex).length, 89);
  assert.equal(exactMemberIndex.has("ALHA77034"), true);
  assert.equal(exactMemberIndex.has("BTNA77034"), false);
  assert.deepEqual({ indexedRecords: new Set(entries.map(({ currentMember }) => currentMember)).size, indexedEntries: entries.length },
    { indexedRecords: 77, indexedEntries: 79 });
  for (const entry of entries) {
    const sourceGroup = groups.find(({ id }) => id === entry.claim.groupId);
    assert.deepEqual(entry.claim.members, sourceGroup.members);
    assert.equal(entry.claim.source.sourceSection, "Appendix Table C");
    assert.equal(entry.claim.source.printedPage, 94);
    assert.equal(Object.hasOwn(entry.claim, "recordId"), false);
  }
  const alha76005 = records.find(({ specimenId }) => specimenId === "ALHA76005");
  assert.equal(app.presentHarmonizedCard(alha76005, {
    lineageEntries: lineageIndex.get(alha76005.id), registry,
  }).facts.find(({ label }) => label === "Lineage").value,
  "Known same-inventory continuity: 0 | Source-attested tentative groups: 1");
  const victoriaDescriptors = app.expandSpecimenCardDescriptors(
    records.filter(({ catalogId }) => catalogId === "victoria-land-1982"), new Map());
  assert.equal(app.filterSpecimenCardDescriptors(victoriaDescriptors, {
    query: "", catalog: "victoria-land-1982", min: null, max: null, lineageOnly: true,
    includeUnknownWeight: true, sort: app.DEFAULT_SORT,
  }, lineageIndex).length, 77);
});

test("lineage index contains only established and source-attested claims", () => {
  const claims = flattenIndex(lineageIndex).map(({ claim }) => claim);
  assert.deepEqual({ records: lineageIndex.size, claims: claims.length }, { records: 271, claims: 273 });
  assert.deepEqual(Object.fromEntries(["known", "tentative"].map((status) => [
    status, claims.filter(({ presentationStatus }) => presentationStatus === status).length,
  ])), { known: 194, tentative: 79 });
  assert(claims.every(({ presentationStatus }) => presentationStatus !== "suspected"));

  const routed = descriptors.map((descriptor) => app.lineageEntriesForSpecimenCard(
    descriptor, lineageIndex.get(descriptor.parentRecord.id) || []
  )).filter((claimsForCard) => claimsForCard.length > 0);
  assert.deepEqual({ cards: routed.length, claims: routed.flat().length }, { cards: 271, claims: 273 });
  assert.equal(app.filterSpecimenCardDescriptors(descriptors, {
    min: null, max: null, lineageOnly: true, includeUnknownWeight: true,
  }, lineageIndex).length, 271);
});

test("comparison index is symmetric, grouped, and deduplicated per exact endpoint path", () => {
  const routes = flattenIndex(comparisonIndex);
  assert.deepEqual({ records: comparisonIndex.size, routes: routes.length }, { records: 2069, routes: 3668 });
  const routeKeys = routes.map(({ groupId, currentObservation, massPath }) =>
    `${groupId}\u0000${currentObservation.recordId}\u0000${massPath}`);
  assert.equal(new Set(routeKeys).size, routes.length);

  for (const group of lineageData.comparisonGroups) {
    const expected = new Set(group.candidates.flatMap(({ observations }) => observations.map(({ recordId, massPath }) =>
      `${group.id}\u0000${recordId}\u0000${massPath}`)));
    const actual = new Set(routes.filter(({ groupId }) => groupId === group.id).map(({ currentObservation, massPath }) =>
      `${group.id}\u0000${currentObservation.recordId}\u0000${massPath}`));
    assert.deepEqual(actual, expected, group.id);
  }
});

test("comparison routing selects exact atomic mass paths and never sibling cards", () => {
  const prior = records.find((record) => record.catalogId === "prior-1923" && record.entryOrder === 630);
  const cards = descriptors.filter(({ parentRecord }) => parentRecord.id === prior.id);
  const entries = comparisonIndex.get(prior.id) || [];
  const routedPaths = cards.filter((descriptor) => app.comparisonGroupsForSpecimenCard(descriptor, entries).length)
    .map(({ massPath }) => massPath);
  const expectedPaths = new Set(entries.map(({ massPath }) => massPath));
  assert(routedPaths.every((massPath) => expectedPaths.has(massPath)));
  for (const descriptor of cards) {
    const groups = app.comparisonGroupsForSpecimenCard(descriptor, entries);
    assert(groups.every((group) => entries.some(({ groupId, massPath }) =>
      groupId === group.groupId && massPath === descriptor.massPath)));
  }
});

test("Holbrook 98 is one top-level group with candidate audit rows", () => {
  const holbrook = lineageData.comparisonGroups.find(({ displayName, candidateCount }) =>
    displayName === "Holbrook" && candidateCount === 98);
  assert(holbrook);
  const route = flattenIndex(comparisonIndex).find(({ groupId }) => groupId === holbrook.id);
  const descriptor = descriptors.find((item) => item.parentRecord.id === route.currentObservation.recordId &&
    item.massPath === route.massPath);
  assert(descriptor);
  const dto = app.comparisonCardDto(descriptor, comparisonIndex.get(descriptor.parentRecord.id));
  assert.equal(dto.groups.filter(({ groupId }) => groupId === holbrook.id).length, 1);
  const group = dto.groups.find(({ groupId }) => groupId === holbrook.id);
  assert.equal(group.candidateCount, 98);
  assert.equal(group.candidates.length, 98);
  assert.match(dto.warning, /same physical specimen, lineage, custody, ownership, transfer, or merge/u);
  assert.doesNotMatch(JSON.stringify(dto), /suspected|possible lineage|relationship/iu);
});

test("comparison facts and details remain separate from the Lineage fact", () => {
  let comparisonCards = 0;
  let routedGroups = 0;
  let routedCandidates = 0;
  for (const descriptor of descriptors) {
    const comparisonEntries = comparisonIndex.get(descriptor.parentRecord.id) || [];
    const comparisonGroups = app.comparisonGroupsForSpecimenCard(descriptor, comparisonEntries);
    if (!comparisonGroups.length) continue;
    comparisonCards += 1;
    routedGroups += comparisonGroups.length;
    routedCandidates += comparisonGroups.reduce((sum, group) => sum + group.candidateCount, 0);
    const dto = app.presentHarmonizedCard(descriptor, {
      lineageEntries: lineageIndex.get(descriptor.parentRecord.id) || [],
      comparisonEntries,
      registry,
    });
    assert(dto.facts.some(({ label }) => label === "Cross-catalog comparisons"));
    assert.equal(dto.facts.some(({ label, value }) => label === "Lineage" && /comparison|suspected/iu.test(value)), false);
  }
  assert.deepEqual({ comparisonCards, routedGroups, routedCandidates }, {
    comparisonCards: 1717, routedGroups: 1889, routedCandidates: 20972,
  });
});

test("all published observation links resolve to exact public source records", () => {
  const observations = [
    ...lineageData.relationships.flatMap(({ observations: items }) => items),
    ...lineageData.comparisonGroups.flatMap(({ candidates }) => candidates.flatMap(({ observations: items }) => items)),
  ];
  assert.equal(observations.length, 4878);
  for (const observation of observations) {
    const url = new URL(observation.catalogSearchUrl, "https://example.test/");
    assert.equal(url.pathname, "/index.html");
    assert.equal(url.hash, "#catalog");
    assert.equal(url.searchParams.get("q"), `record id ${observation.recordId}`);
    assert.deepEqual(records.filter((record) => record.catalogId === url.searchParams.get("catalog") &&
      app.matchesSearch(record, url.searchParams.get("q"))).map(({ id }) => id), [observation.recordId]);
  }
  const earlierEntries = flattenIndex(lineageIndex).filter(({ kind }) => kind === "relationship-route");
  assert.equal(earlierEntries.length, 194);
  for (const { claim } of earlierEntries) {
    const url = new URL(claim.earlierEndpoint.catalogSearchUrl, "https://example.test/");
    assert.deepEqual(records.filter((record) => record.catalogId === url.searchParams.get("catalog") &&
      app.matchesSearch(record, url.searchParams.get("q"))).map(({ id }) => id), [claim.earlierEndpoint.recordId]);
  }
});

test("hash mismatch, malformed input, and fetch failure fail closed for both indexes", async () => {
  const sha256 = async (value) => createHash("sha256").update(value).digest("hex");
  const response = (value) => ({ ok: true, text: async () => value });
  for (const fetcher of [
    async () => { throw new Error("offline"); },
    async () => ({ ok: false }),
    async () => response(JSON.stringify({ metadata: {}, relationships: [] })),
    async () => response(`${lineageText} `),
  ]) {
    const loaded = await app.loadLineageAndComparisonIndexes(records, registry, fetcher, { sha256 });
    assert.equal(loaded.lineageIndex.size, 0);
    assert.equal(loaded.comparisonIndex.size, 0);
  }
  const loaded = await app.loadLineageAndComparisonIndexes(records, registry, async () => response(lineageText), { sha256 });
  assert.deepEqual({ lineage: loaded.lineageIndex.size, comparison: loaded.comparisonIndex.size }, { lineage: 271, comparison: 2069 });
});

test("accessible static contracts, warning language, and cache keys are synchronized", () => {
  assert.match(html, /<dl class="record-meta" aria-label="Catalog record details"><\/dl>/u);
  assert.match(source, /aria-label", "Cross-catalog comparison candidates"/u);
  assert.match(source, /Shared identity and reported mass do not establish the same physical specimen, lineage, custody, ownership, transfer, or merge\./u);
  assert.doesNotMatch(source, /Suspected cross-catalog|POSSIBLE_MATCH_CAUTION/u);
  assert.match(css, /\.comparison-warning/u);
  assert.match(css, /\.comparison-candidates/u);
  assert.equal(app.CACHE_VERSION, "20260912-comparison-groups-1");
  assert.equal(app.ASSET_CACHE_VERSION, "20260912-comparison-groups-1");
  assert.match(html, /styles\.css\?v=20260912-comparison-groups-1/u);
  assert.match(html, /app\.js\?v=20260912-comparison-groups-1/u);
  assert.doesNotMatch(source, /\.innerHTML\b/u);
});
