import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = require(path.join(projectRoot, "app.js"));
const catalogPage = require(path.join(projectRoot, "catalogs.js"));
const [catalog, folios] = await Promise.all([
  readFile(path.join(projectRoot, "data", "catalog.json"), "utf8").then(JSON.parse),
  readFile(path.join(projectRoot, "data", "folios.json"), "utf8").then(JSON.parse)
]);

function clone(value) {
  return structuredClone(value);
}

function fetchFixture(catalogPayload = catalog, folioPayload = folios) {
  return async (url) => ({
    ok: true,
    json: async () => url.endsWith("catalog.json") ? catalogPayload : folioPayload
  });
}

test("reviewed cards suppress display-equivalent names while retaining aliases and unresolved reviews", () => {
  assert.equal(app.namesAreDisplayEquivalent("Aba Panu", "Aba Panu"), true);
  assert.equal(app.namesAreDisplayEquivalent("ABA PANU", "aba panu"), true);
  assert.equal(app.namesAreDisplayEquivalent("  Aba\t\nPanu  ", "Aba Panu"), true);
  assert.equal(app.namesAreDisplayEquivalent("Can\u0303on Diablo", "Cañon Diablo"), true);
  assert.equal(app.namesAreDisplayEquivalent("Aba Panu", "Aba Panu II"), false);
  assert.equal(app.namesAreDisplayEquivalent(null, "Aba Panu"), false);

  const exact = app.metbullPanelDetails({
    name: "Allende",
    metbull: {
      matchType: "exact",
      canonicalName: "Allende",
      metbullUrl: "https://www.lpi.usra.edu/meteor/metbull.cfm?code=2278",
      alternateNameNote: null
    }
  });
  assert.equal(exact, null);

  const alias = app.metbullPanelDetails({
    name: "Canyon Diablo (Cañon Diablo)",
    metbull: {
      matchType: "historical-alias",
      canonicalName: "Canyon Diablo",
      metbullUrl: "https://www.lpi.usra.edu/meteor/metbull.cfm?code=5257",
      alternateNameNote: "Historical source form."
    }
  });
  assert.equal(alias.canonicalName, "Canyon Diablo");
  assert.equal(alias.url, "https://www.lpi.usra.edu/meteor/metbull.cfm?code=5257");
  assert.equal(alias.note, "Historical source form.");

  const unresolved = app.metbullPanelDetails({
    name: "Unknown source name",
    metbull: { matchType: "unresolved", canonicalName: null, metbullUrl: null, alternateNameNote: null }
  });
  assert.deepEqual(unresolved, {
    label: "Meteoritical Bulletin review",
    canonicalName: null,
    url: null,
    note: "No current Meteoritical Bulletin name was resolved in this review."
  });
  assert.equal(app.metbullPanelDetails({ name: "Unreviewed" }), null);
});

test("production cards suppress equal canonical names, including Aba Panu, while retaining other reviews", () => {
  const reviewed = catalog.records.filter((record) => record.metbull);
  const targetIds = new Set(["anderson-1913", "astapovich-1938", "kantor-1920"]);
  const target = reviewed.filter((record) => targetIds.has(record.catalogId));
  const resolved = reviewed.filter(({ metbull }) => metbull.matchType !== "unresolved");
  const unresolved = reviewed.filter(({ metbull }) => metbull.matchType === "unresolved");
  const equivalent = resolved.filter((record) => app.namesAreDisplayEquivalent(record.name, record.metbull.canonicalName));

  assert.deepEqual(
    { reviewed: reviewed.length, resolved: resolved.length, unresolved: unresolved.length, pending: catalog.records.length - reviewed.length },
    { reviewed: 10537, resolved: 10296, unresolved: 241, pending: 3639 }
  );
  assert.deepEqual({ equivalent: equivalent.length, substantive: resolved.length - equivalent.length }, { equivalent: 9180, substantive: 1116 });
  const abaPanu = catalog.records.find(({ id }) => id === "obs-bc3edcf5-25d8-4921-8ace-ceedd6882e3b");
  assert.equal(abaPanu.name, "Aba Panu");
  assert.equal(abaPanu.metbull.canonicalName, "Aba Panu");
  assert.equal(app.metbullPanelDetails(abaPanu), null);
  assert.deepEqual(
    {
      reviewed: target.length,
      resolved: target.filter(({ metbull }) => metbull.matchType !== "unresolved").length,
      unresolved: target.filter(({ metbull }) => metbull.matchType === "unresolved").length
    },
    { reviewed: 177, resolved: 160, unresolved: 17 }
  );
  for (const record of reviewed) {
    const details = app.metbullPanelDetails(record);
    if (record.metbull.matchType === "unresolved") {
      assert.ok(details, record.id);
      assert.equal(details.canonicalName, null, record.id);
      assert.equal(details.url, null, record.id);
      assert.ok(details.note, record.id);
    } else if (app.namesAreDisplayEquivalent(record.name, record.metbull.canonicalName)) {
      assert.equal(details, null, record.id);
    } else {
      assert.ok(details, record.id);
      assert.equal(details.canonicalName, record.metbull.canonicalName, record.id);
      assert.equal(details.url, record.metbull.metbullUrl, record.id);
    }
  }
});

test("production catalog directory preserves all canonical cards and authorized actions", async () => {
  const directory = await catalogPage.loadCatalogDirectoryData(fetchFixture());
  const expected = app.catalogSummaryEntries(app.normalizeCatalogRegistry(catalog.metadata));
  assert.equal(directory.entries.length, 37);
  assert.deepEqual(directory.entries.map(({ folios: _pages, ...summary }) => summary), expected);
  assert.deepEqual(directory.entries.map(({ id }) => id), [
    "lucas-1813", "chladni-1819", "chladni-1825", "haidinger-1859", "buchner-1863",
    "nordenskiold-1870", "ward-1881", "ball-1882", "usnm-1886", "hovey-1896", "washington-1897",
    "tassin-1902", "hogbom-1902", "farrington-1903", "ward-1904", "schreiter-1912", "foote-1912",
    "anderson-1913", "hamburg-1913", "farrington-1916", "merrill-1916", "kantor-1920", "prior-1923", "madrid-1923", "palache-1926",
    "nininger-1933", "reeds-1937", "astapovich-1938", "hodge-smith-1939", "barnes-1940", "nininger-1950", "mason-1964",
    "huss-1976", "victoria-land-1982", "huss-1986", "kanagawa-1996", "asu-2024-09"
  ]);
  const browseable = directory.entries.filter(({ folios: pages }) => pages.length);
  assert.deepEqual(Object.fromEntries(browseable.map(({ id, folios: pages }) => [id, pages.length])), {
    "lucas-1813": 3,
    "chladni-1819": 12,
    "haidinger-1859": 6,
    "hovey-1896": 7,
    "nininger-1933": 21
  });
  assert.equal(browseable.reduce((sum, { folios: pages }) => sum + pages.length, 0), 49);
  const madrid = directory.entries.find(({ id }) => id === "madrid-1923");
  assert.deepEqual(madrid, {
    id: "madrid-1923",
    label: "Los Meteoritos del Museo de Madrid (1923)",
    year: 1923,
    compiler: "Lucas Fernández Navarro",
    pageCoverage: "224–233 (10 pages)",
    observationCount: 130,
    folios: []
  });
  assert(browseable.every(({ folios: pages }) => pages.every(({ image, catalogId, pageId }) =>
    image === `assets/folios/${catalogId}/${pageId}.webp`
  )));
  assert.doesNotMatch(JSON.stringify(directory.entries), /(?:\/private\/|\/Users\/|source-images\/|data\/ocr\/)/iu);
});

test("catalog directory rejects fetch, schema, private text, policy, and path attacks", async () => {
  await assert.rejects(catalogPage.loadCatalogDirectoryData(async () => ({ ok: false, status: 503 })));
  await assert.rejects(catalogPage.loadCatalogDirectoryData(async () => { throw new Error("offline"); }));

  const malformed = clone(catalog);
  malformed.metadata.schemaVersion = 5;
  await assert.rejects(catalogPage.loadCatalogDirectoryData(fetchFixture(malformed, folios)), /facts-only schema/);

  const privateText = clone(catalog);
  privateText.metadata.catalogs[0].label = "/private/source-images/catalog.png";
  await assert.rejects(catalogPage.loadCatalogDirectoryData(fetchFixture(privateText, folios)), /facts-only schema/);

  const mismatchedPolicy = clone(folios);
  mismatchedPolicy.catalogs["chladni-1819"].displayPolicy = "blocked";
  await assert.rejects(catalogPage.loadCatalogDirectoryData(fetchFixture(catalog, mismatchedPolicy)), /display policy/);

  const pathAttack = clone(folios);
  pathAttack.catalogs["chladni-1819"].pages[0].image = "../private/chladni-1819-page-0090.webp";
  await assert.rejects(catalogPage.loadCatalogDirectoryData(fetchFixture(catalog, pathAttack)), /display policy/);

  const privateAlt = clone(folios);
  privateAlt.catalogs["chladni-1819"].pages[0].alt = "/Users/reviewer/private/source image";
  await assert.rejects(catalogPage.loadCatalogDirectoryData(fetchFixture(catalog, privateAlt)), /display policy/);
});

test("homepage and catalog page markup keep navigation and UI states accessible", async () => {
  const [index, html, source, appSource, styles] = await Promise.all([
    readFile(path.join(projectRoot, "index.html"), "utf8"),
    readFile(path.join(projectRoot, "catalogs.html"), "utf8"),
    readFile(path.join(projectRoot, "catalogs.js"), "utf8"),
    readFile(path.join(projectRoot, "app.js"), "utf8"),
    readFile(path.join(projectRoot, "styles.css"), "utf8")
  ]);
  assert.equal((index.match(/class="master-list-link"/g) || []).length, 1);
  assert.match(index, /href="\.\/catalogs\.html"/);
  assert.match(index, /<p class="eyebrow">Source register<\/p>/);
  assert.match(index, /<h2 id="source-summary-heading">Catalogs in this edition<\/h2>/);
  assert.match(index, /<p>Index Rerum<\/p>\s*<h2 id="catalog-heading">Search the register<\/h2>/);
  assert.doesNotMatch(index, /Catalog observations remain attributed/);
  assert.doesNotMatch(index, /Catalog descriptions, source coverage/);
  assert.doesNotMatch(index, /href="\.\/data\/bibliography-master-list\.html"/);
  assert.doesNotMatch(index, /id="catalog-summary"/);
  assert.match(appSource, /if \(elements\.catalogSummary\) renderCatalogSummary/);

  assert.match(html, /id="catalog-directory-status"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="catalog-directory-list" aria-busy="true"/);
  assert.match(html, /id="catalog-directory-error"[^>]*role="alert"[^>]*hidden/);
  assert.match(html, /<noscript><p class="empty-state">/);
  assert.match(html, /catalogs\.js\?v=20260831-schema8-2/);
  assert.match(html, /app\.js\?v=20260831-schema8-2/);
  assert.match(html, /styles\.css\?v=20260831-schema8-2/);
  assert.doesNotMatch(source, /\.innerHTML\b/);
  assert.match(source, /\.textContent = summary\.label/);
  assert.doesNotMatch(source, /error\.message/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.catalog-summary-list \{ grid-template-columns: 1fr; \}/);
  assert.match(styles, /\.catalog-directory-shell \{ padding: 1\.5rem \.8rem; \}/);
  assert.match(styles, /\.homepage-source-summary \{ margin-top: 1\.5rem; padding-bottom: 1rem;/);
  assert.match(styles, /\.catalog-tools \{ margin-top: 1rem; padding-bottom: 1\.5rem;/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.homepage-source-summary \{ margin-top: 1rem; padding-bottom: \.75rem; \}/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.catalog-tools \{ margin-top: \.75rem; padding-bottom: 1\.25rem; \}/);
});
