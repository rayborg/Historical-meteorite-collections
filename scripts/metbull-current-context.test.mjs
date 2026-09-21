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
    assert.equal(url, "./data/metbull-current-context.json?v=20260920-haag-2003-1");
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

test("presenter applies current values through neutral fields and moves source differences to specimen notes", () => {
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
  assert.equal(presentation.reduce((count, entry) => count + entry[4].length, 0), 82575);
  assert.equal(notes.length, 11798);
  assert.equal(notes.reduce((count, entry) => count + entry[1].length, 0), 32102);
  assert.equal(jsonSha256(presentation), "0d5e9b3fe67f419826c90d9b140be7b3276197ef9b60e228b533f0c948d914b7");
  assert.equal(jsonSha256(notes), "99adbc9db7753f560548964d78bb241b9fb265f409e846aa1be59f350843b5a1");

  const allende = specimenDescriptors.find(({ parentRecord }) => parentRecord.designation === "H103.11");
  const dto = app.presentHarmonizedCard(allende);
  assert.equal(dto.headingName, "Allende");
  assert.equal(dto.headingLabel, "Name");
  assert.equal(dto.headingUrl, "https://www.lpi.usra.edu/meteor/metbull.cfm?code=2278");
  assert.deepEqual(dto.facts.slice(0, 4), [
    { label: "Class", value: "CV3" },
    { label: "Place", value: "Chihuahua, Mexico" },
    { label: "Fall / find", value: "Fall" },
    { label: "Year / date", value: "1969" },
  ]);
  assert.deepEqual(dto.catalogNotes, [{ label: "Source class", value: "Stone. Carbonaceous chondrite, Type III" }]);
  assert.equal(sha256(catalogText), "3c23d1c2653bc893819a605c7c0e5e6db7b63a17cd3ab66ab104c2772391dbe7");
});

test("fall/find codes use documented MetBull categories and current fields contain no mass or coordinate claims", () => {
  const labels = {
    "": "Find",
    Y: "Fall",
    Yc: "Confirmed fall (Yc)",
    Yp: "Probable fall (Yp)",
    Np: "Find, possible fall (Np)",
  };
  assert.deepEqual(Object.fromEntries(Object.keys(labels).map((code) => [code, app.metbullFallDisplay(code)])), labels);
  assert.equal(app.metbullFallDisplay("Nd"), null);
  assert.equal(app.metbullFallDisplay("unknown"), null);
  const codeCounts = {};
  for (const descriptor of specimenDescriptors.filter(({ currentMetbull }) => currentMetbull)) {
    const { currentMetbull } = descriptor;
    codeCounts[currentMetbull.fall] = (codeCounts[currentMetbull.fall] || 0) + 1;
    const dto = app.presentHarmonizedCard(descriptor);
    assert.equal(dto.facts.find(({ label }) => label === "Fall / find").value,
      labels[currentMetbull.fall]);
    assert.equal(dto.facts.some(({ label }) => /^(?:mass|latitude|longitude|coordinates?)$/iu.test(label)), false);
  }
  assert.deepEqual(codeCounts, { Y: 5050, "": 6761, Yp: 9, Yc: 37, Np: 2 });
  assert.deepEqual(Object.keys(sidecar.meteorites["5"]), ["name", "status", "fall", "year", "place", "classification"]);
});

test("an unavailable current year uses only an available source date fallback", () => {
  const withoutCurrentYear = specimenDescriptors.filter(({ currentMetbull }) => currentMetbull?.year === "");
  assert.equal(withoutCurrentYear.length, 9);
  const fallbackValues = new Map([
    ["obs-7b0ead6e-bbdc-452c-abd4-b36b868ab2ce", "found (unreported)"],
    ["obs-7f745dcf-88bd-4fe3-8427-f55525c9a9ab", "1980"],
  ]);
  for (const descriptor of withoutCurrentYear) {
    const dto = app.presentHarmonizedCard(descriptor);
    assert.equal(dto.facts.find(({ label }) => label === "Year / date")?.value,
      fallbackValues.get(descriptor.parentRecord.id), descriptor.parentRecord.id);
    assert.equal(dto.catalogNotes.some(({ label }) => label === "Source date"), false, descriptor.parentRecord.id);
  }
});

test("reported synonym cards retain exact source names inside specimen notes", () => {
  const cases = [
    ["obs-bc3edcf5-25d8-4921-8ace-ceedd6882e3b", 1, "Aba Panu", "Aba Panu", "67799", "Confirmed fall (Yc)"],
    ["obs-9371315d-81bd-4b7e-afba-1396df86df34", 1, "Addison", "Addison", "83275", "Confirmed fall (Yc)"],
    ["obs-47bef700-eb27-4908-b683-91a388b33f0b", 2, "Adargas", "Chupaderos", "5363", "Find"],
    ["obs-232aa803-5538-4d5c-8a6b-de9014ae4ddb", 1, "Agram", "Hraschina", "11916", "Fall"],
  ];
  for (const [recordId, count, sourceName, officialName, meteoriteCode, fallDisplay] of cases) {
    const cards = specimenDescriptors.filter(({ parentRecord }) => parentRecord.id === recordId);
    assert.equal(cards.length, count, recordId);
    for (const descriptor of cards) {
      const dto = app.presentHarmonizedCard(descriptor);
      assert.equal(dto.sourceName, sourceName, recordId);
      assert.equal(dto.headingName, officialName, recordId);
      assert.equal(descriptor.currentMetbull.meteoriteCode, meteoriteCode, recordId);
      assert.equal(dto.facts.find(({ label }) => label === "Fall / find").value, fallDisplay, recordId);
      assert.equal(dto.catalogNotes.find(({ label }) => label === "Source name")?.value,
        sourceName !== officialName ? sourceName : undefined, recordId);
      assert.equal(dto.facts.some(({ label }) => label === "Source name"), false, recordId);
    }
  }
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

test("every differing source-context note remains searchable without weakening numeric holding-code boundaries", () => {
  let noteCount = 0;
  const reportedValues = new Set();
  for (const descriptor of specimenDescriptors) {
    for (const { label, value } of app.presentHarmonizedCard(descriptor).catalogNotes
      .filter(({ label }) => ["Source name", "Source class", "Source place", "Source date"].includes(label))) {
      noteCount += 1;
      assert.equal(app.matchesSpecimenCardSearch(descriptor, value), true,
        `${descriptor.parentRecord.id}: ${value}`);
      if (["1834 Gefallen", "1876 1896 beschr"].includes(value)) reportedValues.add(value);
    }
  }
  assert.equal(noteCount, 29982);
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
  assert.equal(observations.filter((descriptor) => app.presentHarmonizedCard(descriptor).headingUrl === null).length, 11010);
  assert.match(source, /officialLink\.href = dto\.headingUrl;/u);
  assert.match(source, /officialLink\.textContent = dto\.headingName;/u);
  assert.doesNotMatch(source, /officialLink\.innerHTML/u);
});

test("observation cards stay source-only and static rendering is accessible, responsive, and text-only", () => {
  const observations = descriptors.filter((descriptor) => !["direct-specimen", "projected-atomic-specimen"]
    .includes(app.classifyHarmonizedCard(descriptor)));
  assert.equal(observations.length, 11010);
  assert(observations.every(({ currentMetbull }) => currentMetbull === null));
  assert(observations.every((descriptor) => {
    const dto = app.presentHarmonizedCard(descriptor, { currentMetbull: sidecar.meteorites["5"] });
    return dto.headingName === descriptor.parentRecord.name && dto.catalogNotes.length === 0 &&
      dto.facts.every(({ label }) => !label.startsWith("Current MetBull"));
  }));
  assert.match(html, /id="current-context-status"[^>]*role="status"[^>]*aria-live="polite"[^>]*hidden/u);
  assert.equal((html.match(/id="current-context-status"/gu) || []).length, 1);
  assert.match(source, /summary\.textContent = "Show catalog notes"/u);
  assert.match(source, /summary\.textContent = "Show specimen notes"/u);
  assert.match(source, /list\.setAttribute\("aria-label", "Specimen notes"\)/u);
  assert.match(source, /document\.createElement\("details"\)/u);
  assert.doesNotMatch(source, /\.innerHTML\b/u);
  assert.match(styles, /\.catalog-notes summary \{/u);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*\.observation-card \.catalog-notes dl div \{ grid-template-columns: minmax\(0, 1fr\)/u);
  assert.match(styles, /@media \(max-width: 350px\)[\s\S]*\.specimen-card \.catalog-notes dl div \{ grid-template-columns: minmax\(0, 1fr\)/u);
  assert.match(styles, /@media \(max-width: 320px\)[\s\S]*\.observation-card \{ padding-inline: \.8rem; \}/u);
});
