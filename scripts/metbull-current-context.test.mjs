import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { validateMetbullCurrentContextFiles } from "./validate-metbull-current-context.mjs";

const require = createRequire(import.meta.url);
const app = require("../app.js");
const [sidecarText, catalogText, projectionText, lineageText, schemaText, html, styles, source] = await Promise.all([
  readFile(new URL("../data/metbull-current-context.json", import.meta.url), "utf8"),
  readFile(new URL("../data/catalog.json", import.meta.url), "utf8"),
  readFile(new URL("../data/specimen-card-projections.json", import.meta.url), "utf8"),
  readFile(new URL("../data/specimen-lineages.json", import.meta.url), "utf8"),
  readFile(new URL("../data/metbull-current-context.schema.json", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8"),
  readFile(new URL("../app.js", import.meta.url), "utf8"),
]);
const sidecar = JSON.parse(sidecarText);
const catalog = JSON.parse(catalogText);
const projections = JSON.parse(projectionText);
const lineages = JSON.parse(lineageText);
const schema = JSON.parse(schemaText);
const registry = app.normalizeCatalogRegistry(catalog.metadata);
const records = catalog.records.map((record, index) => app.prepareRecord(record, index, registry));
const projectionIndex = app.deriveSpecimenCardProjectionIndex(projections, records, { sourceCatalogSha256: app.CATALOG_SHA256 });
const rawDescriptors = app.expandSpecimenCardDescriptors(records, projectionIndex);
const contextIndex = app.deriveMetbullCurrentContextIndex(sidecar, rawDescriptors);
const descriptors = app.attachMetbullCurrentContext(rawDescriptors, contextIndex);
const specimenDescriptors = descriptors.filter((descriptor) => ["direct-specimen", "projected-atomic-specimen"]
  .includes(app.classifyHarmonizedCard(descriptor)));
const lineageIndex = app.deriveEarlierRecordIndex(lineages, records, registry);
const comparisonIndex = app.deriveComparisonGroupIndex(lineages, records, registry);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const jsonSha256 = (value) => sha256(JSON.stringify(value));
const response = (text = sidecarText, ok = true) => ({ ok, text: async () => text });

test("standalone and runtime validators reconstruct the locked complete assignment partition", async () => {
  const validated = await validateMetbullCurrentContextFiles();
  const assignments = app.reconstructMetbullCardAssignments(sidecar, rawDescriptors);
  assert.equal(validated.assignments.length, 14234);
  assert.equal(app.validateMetbullCurrentContext(sidecar, rawDescriptors, {
    catalogSha256: sha256(catalogText), projectionSha256: sha256(projectionText), lineageSha256: sha256(lineageText),
  }), true);
  assert.equal(assignments.length, 14234);
  assert.equal(new Set(assignments.map(({ cardKey }) => cardKey)).size, 14234);
  assert.deepEqual({
    direct: assignments.filter(({ route }) => route === "direct").length,
    mappedDirect: assignments.filter(({ route, status }) => route === "direct" && status === "mapped").length,
    projected: assignments.filter(({ route }) => route === "projected").length,
    mappedProjected: assignments.filter(({ route, status }) => route === "projected" && status === "mapped").length,
    mapped: assignments.filter(({ status }) => status === "mapped").length,
    unmapped: assignments.filter(({ status }) => status === "unmapped").length,
    mappedParents: new Set(assignments.filter(({ status }) => status === "mapped").map(({ parentRecordId }) => parentRecordId)).size,
    codes: new Set(assignments.filter(({ status }) => status === "mapped").map(({ meteoriteCode }) => meteoriteCode)).size,
  }, { direct: 5824, mappedDirect: 5653, projected: 8410, mappedProjected: 6206,
    mapped: 11859, unmapped: 2375, mappedParents: 7736, codes: 2548 });
  assert.equal(sidecar.metadata.cardAssignmentsSha256, "131daf40b44e07e71de896ad9d6e375e03931e33af4a2e8e7a152d8ebbff8150");
  assert.equal(app.metbullPublicCardBindingsSha256(rawDescriptors),
    "cd49c34ca0539ca94e95d1677c724bf8ebe7ce635c92f080fc8cea0f6eefe48d");
  assert.equal(jsonSha256(assignments), "353acee9c5b38e6c65a0f531746d9616db98fa17b27cd4e7673065181be1e2cb");
});

test("assignment digest rejects valid-looking direct and projection identity swaps", () => {
  for (const projected of [false, true]) {
    const changed = structuredClone(rawDescriptors);
    const candidates = changed.filter((descriptor) => descriptor.projected === projected &&
      ["direct-specimen", "projected-atomic-specimen"].includes(app.classifyHarmonizedCard(descriptor)) &&
      descriptor.parentRecord.metbull?.matchType !== "unresolved" && descriptor.parentRecord.metbull?.meteoriteCode);
    const first = candidates[0];
    const second = candidates.find((descriptor) => descriptor.parentRecord.id !== first.parentRecord.id &&
      descriptor.parentRecord.metbull.meteoriteCode !== first.parentRecord.metbull.meteoriteCode);
    assert(first && second);
    [first.parentRecord.metbull, second.parentRecord.metbull] = [second.parentRecord.metbull, first.parentRecord.metbull];
    assert.notEqual(app.metbullPublicCardBindingsSha256(changed), app.METBULL_PUBLIC_CARD_BINDINGS_SHA256);
    assert.equal(app.validateMetbullCurrentContext(sidecar, changed), false);
  }
});

test("schema and runtime contracts are closed against extras, unsafe text, stale locks, and code/name drift", () => {
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$defs.metadata.additionalProperties, false);
  assert.equal(schema.$defs.meteorite.additionalProperties, false);
  assert.equal(schema.properties.meteorites.minProperties, 2548);
  assert.equal(schema.properties.meteorites.maxProperties, 2548);
  const mutations = [
    (value) => { value.extra = true; },
    (value) => { value.metadata.extra = true; },
    (value) => { value.metadata.catalogSha256 = "0".repeat(64); },
    (value) => { value.metadata.mappedCardCount += 1; },
    (value) => { value.metadata.cardAssignmentsSha256 = "0".repeat(64); },
    (value) => { value.meteorites["5"].extra = "forged"; },
    (value) => { value.meteorites["5"].name = "<img src=x onerror=alert(1)>"; },
    (value) => { value.meteorites["5"].place = "/private/source.json"; },
    (value) => { value.meteorites["5"].fall = "N"; },
    (value) => { value.meteorites["5"].name = "Not Abbott"; },
    (value) => { delete value.meteorites["5"]; },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(sidecar);
    mutate(changed);
    assert.equal(app.validateMetbullCurrentContext(changed, rawDescriptors), false);
  }
  assert.equal(app.validateMetbullCurrentContext(sidecar, rawDescriptors, { projectionSha256: "0".repeat(64) }), false);
  assert.equal(app.validateMetbullCurrentContext(sidecar, app.expandSpecimenCardDescriptors(records, new Map())), false);
});

test("loader applies all current context or returns one complete source-only fallback", async () => {
  const valid = await app.loadMetbullCurrentContext(rawDescriptors, async (url, options) => {
    assert.equal(url, "./data/metbull-current-context.json?v=20260913-four-card-grid-1");
    assert.deepEqual(options, { cache: "no-cache" });
    return response();
  }, { sha256: async (text) => sha256(text), catalogSha256: app.CATALOG_SHA256,
    projectionSha256: app.PROJECTION_SHA256, lineageSha256: app.LINEAGE_SHA256 });
  assert.equal(valid.valid, true);
  assert.equal(valid.index.size, 11859);
  assert.equal(valid.assignments.length, 14234);

  const malformed = structuredClone(sidecar);
  malformed.meteorites["5"].classification = "<script>alert(1)</script>";
  for (const loaded of [
    await app.loadMetbullCurrentContext(rawDescriptors, async () => response("{}"), { sha256: async () => app.METBULL_CURRENT_CONTEXT_DATA_SHA256 }),
    await app.loadMetbullCurrentContext(rawDescriptors, async () => response(JSON.stringify(malformed)), { sha256: async () => app.METBULL_CURRENT_CONTEXT_DATA_SHA256 }),
    await app.loadMetbullCurrentContext(rawDescriptors, async () => response("", false), { sha256: async () => app.METBULL_CURRENT_CONTEXT_DATA_SHA256 }),
    await app.loadMetbullCurrentContext(rawDescriptors, async () => { throw new Error("missing"); }),
  ]) {
    assert.deepEqual({ valid: loaded.valid, index: loaded.index.size, assignments: loaded.assignments.length },
      { valid: false, index: 0, assignments: 0 });
  }
});

test("presenter applies official headings and exact ordered catalog notes only to matched specimens", () => {
  const presentation = specimenDescriptors.map((descriptor) => {
    const dto = app.presentHarmonizedCard(descriptor, {
      lineageEntries: lineageIndex.get(descriptor.parentRecord.id) || [],
      comparisonEntries: comparisonIndex.get(descriptor.parentRecord.id) || [], registry,
    });
    return [app.metbullCardKey(descriptor), dto.headingName, dto.headingLabel, dto.headingUrl, dto.facts, dto.catalogNotes];
  });
  const notes = presentation.map((entry) => [entry[0], entry[5]]).filter((entry) => entry[1].length);
  assert.equal(specimenDescriptors.filter(({ currentMetbull }) => currentMetbull).length, 11859);
  assert.equal(specimenDescriptors.filter(({ currentMetbull }) => !currentMetbull).length, 2375);
  assert.equal(specimenDescriptors.filter(({ currentMetbull }) => currentMetbull?.year).length, 11850);
  assert.equal(presentation.reduce((count, entry) => count + entry[4].length, 0), 79715);
  assert.equal(notes.length, 11798);
  assert.equal(notes.reduce((count, entry) => count + entry[1].length, 0), 29984);
  assert.equal(jsonSha256(presentation), "85e57daf678517ca601d5de08107e80cd56e026b00af0070ad80fa60861be565");
  assert.equal(jsonSha256(notes), "69aeac90864fac796b1994e514e7cf4883d2ee9f519355e45681918a851b3a62");

  const allende = specimenDescriptors.find(({ parentRecord }) => parentRecord.designation === "H103.11");
  const dto = app.presentHarmonizedCard(allende);
  assert.equal(dto.headingName, "Allende");
  assert.equal(dto.headingLabel, "Current MetBull meteorite name");
  assert.equal(dto.headingUrl, "https://www.lpi.usra.edu/meteor/metbull.cfm?code=2278");
  assert.deepEqual(dto.facts.slice(0, 4), [
    { label: "Current MetBull classification", value: "CV3" },
    { label: "Current MetBull place", value: "Chihuahua, Mexico" },
    { label: "Current MetBull fall/find", value: "Fall" },
    { label: "Current MetBull year", value: "1969" },
  ]);
  assert.deepEqual(dto.catalogNotes, [{ label: "Catalog classification", value: "Stone. Carbonaceous chondrite, Type III" }]);
  assert.equal(sha256(catalogText), "8458ae9dfee5136014af4e68202880830e17fde92f4ebd664f3a1cdd6092d349");
});

test("fall/find codes are never inferred and current fields contain no mass or coordinate claims", () => {
  const codeCounts = {};
  for (const descriptor of specimenDescriptors.filter(({ currentMetbull }) => currentMetbull)) {
    const { currentMetbull } = descriptor;
    codeCounts[currentMetbull.fall] = (codeCounts[currentMetbull.fall] || 0) + 1;
    const dto = app.presentHarmonizedCard(descriptor);
    assert.equal(dto.facts.find(({ label }) => label === "Current MetBull fall/find").value,
      currentMetbull.fall === "Y" ? "Fall" : currentMetbull.fall === "" ? "Find" : `Code ${currentMetbull.fall}`);
    assert.equal(dto.facts.some(({ label }) => /^Current MetBull (?:mass|latitude|longitude|coordinates?)$/iu.test(label)), false);
  }
  assert.deepEqual(codeCounts, { Y: 5050, "": 6761, Yp: 9, Yc: 37, Np: 2 });
  assert.deepEqual(Object.keys(sidecar.meteorites["5"]), ["name", "status", "fall", "year", "place", "classification"]);
});

test("current and historical terms search together only after valid attachment", () => {
  const arispe = specimenDescriptors.find(({ currentMetbull, parentRecord }) =>
    currentMetbull?.name === "Arispe" && parentRecord.name !== "Arispe");
  assert(arispe);
  assert.equal(app.matchesSpecimenCardSearch(arispe, "Arispe"), true);
  assert.equal(app.matchesSpecimenCardSearch(arispe, arispe.parentRecord.name), true);
  const fallback = structuredClone(arispe);
  fallback.currentMetbull = null;
  assert.equal(app.matchesSpecimenCardSearch(fallback, "Arispe"), false);
  assert.equal(app.matchesSpecimenCardSearch(fallback, fallback.parentRecord.name), true);

  const searches = specimenDescriptors.filter(({ currentMetbull }) => currentMetbull).map((descriptor) => {
    const currentValues = [descriptor.currentMetbull.name, descriptor.currentMetbull.classification,
      descriptor.currentMetbull.place, app.metbullFallDisplay(descriptor.currentMetbull.fall),
      descriptor.currentMetbull.year].filter(Boolean);
    return [app.metbullCardKey(descriptor), ...currentValues.map((value) =>
      app.matchesSpecimenCardSearch(descriptor, value))];
  });
  assert.equal(searches.length, 11859);
  assert.equal(searches.reduce((count, entry) => count + entry.length - 1, 0), 59286);
  assert(searches.every((entry) => entry.slice(1).every(Boolean)));
  assert.equal(jsonSha256(searches), "5257dcbe91820381f992cbb20e294b96c49f330e2492ae83795eb384578401dc");
});

test("every catalog-note value is searchable without weakening numeric holding-code boundaries", () => {
  let noteCount = 0;
  const reportedValues = new Set();
  for (const descriptor of specimenDescriptors) {
    for (const { value } of app.presentHarmonizedCard(descriptor).catalogNotes) {
      noteCount += 1;
      assert.equal(app.matchesSpecimenCardSearch(descriptor, value), true,
        `${descriptor.parentRecord.id}: ${value}`);
      if (["1834 Gefallen", "1876 1896 beschr"].includes(value)) reportedValues.add(value);
    }
  }
  assert.equal(noteCount, 29984);
  assert.deepEqual([...reportedValues].sort(), ["1834 Gefallen", "1876 1896 beschr"]);
  const fallback = structuredClone(specimenDescriptors.find(({ parentRecord }) =>
    parentRecord.id === "obs-5dea7247-414e-425e-9484-02988fe91a18"));
  fallback.currentMetbull = null;
  assert.equal(app.matchesSpecimenCardSearch(fallback, "1834 Gefallen"), false);
  assert.equal(app.numericLeadingHoldingCode("1834 Gefallen"), "1834gefallen");
});

test("official heading links are complete and remain absent from fallback and observation cards", () => {
  const mapped = specimenDescriptors.filter(({ currentMetbull }) => currentMetbull);
  const unmatched = specimenDescriptors.filter(({ currentMetbull }) => !currentMetbull);
  const observations = descriptors.filter((descriptor) => !["direct-specimen", "projected-atomic-specimen"]
    .includes(app.classifyHarmonizedCard(descriptor)));
  assert.equal(mapped.filter((descriptor) => app.presentHarmonizedCard(descriptor).headingUrl ===
    app.metbullUrlForCode(descriptor.currentMetbull.meteoriteCode)).length, 11859);
  assert.equal(unmatched.filter((descriptor) => app.presentHarmonizedCard(descriptor).headingUrl === null).length, 2375);
  assert.equal(observations.filter((descriptor) => app.presentHarmonizedCard(descriptor).headingUrl === null).length, 10760);
  assert.match(source, /officialLink\.href = dto\.headingUrl;/u);
  assert.match(source, /officialLink\.textContent = dto\.headingName;/u);
  assert.doesNotMatch(source, /officialLink\.innerHTML/u);
});

test("observation cards stay source-only and static rendering is accessible, responsive, and text-only", () => {
  const observations = descriptors.filter((descriptor) => !["direct-specimen", "projected-atomic-specimen"]
    .includes(app.classifyHarmonizedCard(descriptor)));
  assert.equal(observations.length, 10760);
  assert(observations.every(({ currentMetbull }) => currentMetbull === null));
  assert(observations.every((descriptor) => {
    const dto = app.presentHarmonizedCard(descriptor, { currentMetbull: sidecar.meteorites["5"] });
    return dto.headingName === descriptor.parentRecord.name && dto.catalogNotes.length === 0 &&
      dto.facts.every(({ label }) => !label.startsWith("Current MetBull"));
  }));
  assert.match(html, /id="current-context-status"[^>]*role="status"[^>]*aria-live="polite"[^>]*hidden/u);
  assert.equal((html.match(/id="current-context-status"/gu) || []).length, 1);
  assert.match(source, /summary\.textContent = "Show catalog notes"/u);
  assert.match(source, /document\.createElement\("details"\)/u);
  assert.doesNotMatch(source, /\.innerHTML\b/u);
  assert.match(styles, /\.catalog-notes summary \{/u);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*\.observation-card \.catalog-notes dl div \{ grid-template-columns: minmax\(0, 1fr\)/u);
  assert.match(styles, /@media \(max-width: 350px\)[\s\S]*\.specimen-card \.catalog-notes dl div \{ grid-template-columns: minmax\(0, 1fr\)/u);
  assert.match(styles, /@media \(max-width: 320px\)[\s\S]*\.observation-card \{ padding-inline: \.8rem; \}/u);
});
