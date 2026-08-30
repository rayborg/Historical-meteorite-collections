import assert from "node:assert/strict";
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
  buildReleaseSummary,
  parseArgs,
  renderCatalogTable,
  renderNiningerCoverage,
  renderNoticeFolios,
  renderOverview,
  replaceGeneratedBlock,
  syncDocuments,
} from "./sync-release-summary.mjs";

const [productionCatalog, productionFolios] = await Promise.all([
  readFile(new URL("../data/catalog.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/folios.json", import.meta.url), "utf8").then(JSON.parse),
]);

function fixture() {
  return {
    catalog: {
      metadata: {
        schemaVersion: 6,
        catalogs: [
          {
            id: "nininger-beta",
            label: "Beta catalog",
            year: 1950,
            recordModel: "collection-entry",
            sourcePages: [20, 10, 12],
          },
          {
            id: "nininger-alpha",
            label: "Alpha catalog",
            year: 1933,
            recordModel: "specimen",
            sourcePages: [7, 1, 3],
          },
        ],
      },
      records: [
        {
          id: "beta-1",
          catalogId: "nininger-beta",
          name: "Beta",
          catalogPages: [20, 10],
          metbull: { matchType: "unresolved" },
        },
        {
          id: "alpha-1",
          catalogId: "nininger-alpha",
          name: "Alpha",
          catalogPage: 1,
          metbull: { matchType: "exact" },
        },
        {
          id: "alpha-2",
          catalogId: "nininger-alpha",
          name: null,
          catalogPage: 7,
        },
      ],
    },
    folios: {
      schemaVersion: 2,
      catalogs: {
        "nininger-beta": {
          displayPolicy: "blocked",
          rightsStatus: "undetermined",
          pages: [],
        },
        "nininger-alpha": {
          displayPolicy: "display",
          rightsStatus: "public-domain",
          pages: [{ pageId: "title" }, { pageId: "page-1" }],
        },
      },
    },
  };
}

test("derives release counts, page spans, MetBull status, and folios from records", () => {
  const { catalog, folios } = fixture();
  const summary = buildReleaseSummary(catalog, folios);

  assert.equal(summary.recordCount, catalog.records.length);
  assert.equal(summary.catalogCount, catalog.metadata.catalogs.length);
  assert.equal(summary.sourcePageCount, 6);
  assert.equal(summary.citedPageCount, 4);
  assert.equal(summary.recordsWithNullName, 1);
  assert.deepEqual(summary.metbull, { reviewed: 2, resolved: 1, unresolved: 1 });
  assert.deepEqual(summary.catalogs.map((item) => ({
    catalogId: item.catalogId,
    records: item.recordCount,
    sourceRange: item.sourcePageRange,
    citedRange: item.citedPageRange,
  })), [
    { catalogId: "nininger-alpha", records: 2, sourceRange: { min: 1, max: 7 }, citedRange: { min: 1, max: 7 } },
    { catalogId: "nininger-beta", records: 1, sourceRange: { min: 10, max: 20 }, citedRange: { min: 10, max: 20 } },
  ]);
  assert.deepEqual(summary.recordModels, ["collection-entry", "specimen"]);
  assert.deepEqual(summary.folios.catalogs.map(({ catalogId }) => catalogId), ["nininger-alpha", "nininger-beta"]);
  assert.equal(summary.folios.pageCount, folios.catalogs["nininger-alpha"].pages.length);
  assert.equal(summary.folios.displayCatalogCount, 1);
});

test("locks the production schema7 release summary", () => {
  const summary = buildReleaseSummary(productionCatalog, productionFolios);

  assert.deepEqual({
    schemaVersion: summary.schemaVersion,
    catalogCount: summary.catalogCount,
    recordCount: summary.recordCount,
    sourcePageCount: summary.sourcePageCount,
    citedPageCount: summary.citedPageCount,
    metbull: summary.metbull,
    pending: summary.recordCount - summary.metbull.reviewed,
    folioCatalogCount: summary.folios.catalogs.length,
    folioPageCount: summary.folios.pageCount,
  }, {
    schemaVersion: 7,
    catalogCount: 35,
    recordCount: 13819,
    sourcePageCount: 1321,
    citedPageCount: 1156,
    metbull: { reviewed: 10479, resolved: 10238, unresolved: 241 },
    pending: 3340,
    folioCatalogCount: 35,
    folioPageCount: 49,
  });
  assert.deepEqual(
    summary.catalogs
      .filter(({ catalogId }) => ["anderson-1913", "astapovich-1938", "kantor-1920"].includes(catalogId))
      .map(({ catalogId, recordCount, sourcePageCount, citedPageCount }) => ({
        catalogId,
        recordCount,
        sourcePageCount,
        citedPageCount,
      })),
    [
      { catalogId: "anderson-1913", recordCount: 57, sourcePageCount: 26, citedPageCount: 13 },
      { catalogId: "astapovich-1938", recordCount: 90, sourcePageCount: 3, citedPageCount: 2 },
      { catalogId: "kantor-1920", recordCount: 30, sourcePageCount: 35, citedPageCount: 16 },
    ],
  );
  assert.deepEqual(
    summary.catalogs.find(({ catalogId }) => catalogId === "madrid-1923"),
    {
      catalogId: "madrid-1923",
      label: "Los Meteoritos del Museo de Madrid (1923)",
      year: 1923,
      recordModel: "collection-entry",
      recordCount: 130,
      sourcePageCount: 10,
      sourcePageRange: { min: 224, max: 233 },
      citedPageCount: 8,
      citedPageRange: { min: 226, max: 233 },
    },
  );
});

test("does not trust descriptor aggregate counts", () => {
  const { catalog, folios } = fixture();
  catalog.metadata.recordCount = 999;
  catalog.metadata.catalogs[0].recordCount = 999;
  catalog.metadata.catalogs[0].sourcePageCount = 999;

  const summary = buildReleaseSummary(catalog, folios);
  assert.equal(summary.recordCount, catalog.records.length);
  assert.equal(summary.catalogs.find(({ catalogId }) => catalogId === "nininger-alpha").recordCount, 2);
  assert.equal(
    summary.catalogs.find(({ catalogId }) => catalogId === "nininger-beta").sourcePageCount,
    catalog.metadata.catalogs[0].sourcePages.length,
  );
});

test("production renderers preserve non-contiguous ranges and stable sorted order", () => {
  const { catalog, folios } = fixture();
  const summary = buildReleaseSummary(catalog, folios);
  const overview = renderOverview(summary);
  const table = renderCatalogTable(summary);
  const coverage = renderNiningerCoverage(summary);
  const folioNotice = renderNoticeFolios(summary);

  assert.match(overview, /`collection-entry`, `specimen`/u);
  assert.ok(table.indexOf("`nininger-alpha`") < table.indexOf("`nininger-beta`"));
  assert.match(coverage, /`nininger-alpha` has 2 records; its metadata source pages span 1-7, and its record citations span 1-7/u);
  assert.match(coverage, /`nininger-beta` has 1 record; its metadata source pages span 10-20, and its record citations span 10-20/u);
  assert.ok(folioNotice.indexOf("`nininger-alpha`") < folioNotice.indexOf("`nininger-beta`"));
});

test("rejects records and folio entries for unknown catalogs", () => {
  const first = fixture();
  first.catalog.records[0].catalogId = "unknown";
  assert.throws(() => buildReleaseSummary(first.catalog, first.folios), /unknown catalogId/u);

  const second = fixture();
  second.folios.catalogs.unknown = { displayPolicy: "blocked", rightsStatus: "undetermined", pages: [] };
  assert.throws(() => buildReleaseSummary(second.catalog, second.folios), /unknown catalogs/u);
});

test("replaces exactly one delimited block and preserves editorial text", () => {
  const source = "Before\n<!-- release-summary:sample:start -->\nstale\n<!-- release-summary:sample:end -->\nAfter\n";
  const updated = replaceGeneratedBlock(source, "sample", "fresh");

  assert.equal(updated, "Before\n<!-- release-summary:sample:start -->\nfresh\n<!-- release-summary:sample:end -->\nAfter\n");
  assert.equal(replaceGeneratedBlock(updated, "sample", "fresh"), updated);
  assert.throws(() => replaceGeneratedBlock("no markers", "sample", "fresh"), /missing generated block start/u);
  assert.throws(
    () => replaceGeneratedBlock(`${source}<!-- release-summary:sample:start -->`, "sample", "fresh"),
    /duplicate generated block start/u,
  );
});

test("check is non-mutating and write makes generated documents idempotent", async () => {
  const directory = await mkdtemp(join(tmpdir(), "release-summary-"));
  const path = join(directory, "document.md");
  const source = "Before\n<!-- release-summary:sample:start -->\nstale\n<!-- release-summary:sample:end -->\nAfter\n";
  const documents = [{ path: "document.md", blocks: { sample: () => "fresh" } }];
  const rootUrl = pathToFileURL(`${directory}/`);

  try {
    await writeFile(path, source, "utf8");
    assert.deepEqual(await syncDocuments({}, { rootUrl, documents }), ["document.md"]);
    assert.equal(await readFile(path, "utf8"), source);

    assert.deepEqual(await syncDocuments({}, { write: true, rootUrl, documents }), ["document.md"]);
    assert.match(await readFile(path, "utf8"), /\nfresh\n/u);
    assert.deepEqual(await syncDocuments({}, { rootUrl, documents }), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("write validates every document before changing any document", async () => {
  const directory = await mkdtemp(join(tmpdir(), "release-summary-"));
  const firstPath = join(directory, "first.md");
  const secondPath = join(directory, "second.md");
  const firstSource = "<!-- release-summary:first:start -->\nstale\n<!-- release-summary:first:end -->\n";
  const secondSource = "missing markers\n";
  const documents = [
    { path: "first.md", blocks: { first: () => "fresh" } },
    { path: "second.md", blocks: { second: () => "fresh" } },
  ];
  const rootUrl = pathToFileURL(`${directory}/`);

  try {
    await writeFile(firstPath, firstSource, "utf8");
    await writeFile(secondPath, secondSource, "utf8");
    await assert.rejects(syncDocuments({}, { write: true, rootUrl, documents }), /missing generated block start/u);
    assert.equal(await readFile(firstPath, "utf8"), firstSource);
    assert.equal(await readFile(secondPath, "utf8"), secondSource);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("write rolls back an earlier atomic replacement when a later replacement fails", async () => {
  const directory = await mkdtemp(join(tmpdir(), "release-summary-"));
  const firstPath = join(directory, "first.md");
  const secondPath = join(directory, "second.md");
  const firstSource = "<!-- release-summary:first:start -->\nstale first\n<!-- release-summary:first:end -->\n";
  const secondSource = "<!-- release-summary:second:start -->\nstale second\n<!-- release-summary:second:end -->\n";
  const documents = [
    { path: "first.md", blocks: { first: () => "fresh first" } },
    { path: "second.md", blocks: { second: () => "fresh second" } },
  ];
  const rootUrl = pathToFileURL(`${directory}/`);
  let renameCount = 0;
  const fileOperations = {
    rename: async (from, to) => {
      renameCount += 1;
      if (renameCount === 2) throw new Error("injected replacement failure");
      await rename(from, to);
    },
  };

  try {
    await writeFile(firstPath, firstSource, "utf8");
    await writeFile(secondPath, secondSource, "utf8");
    await assert.rejects(
      syncDocuments({}, { write: true, rootUrl, documents, fileOperations }),
      /injected replacement failure/u,
    );
    assert.equal(await readFile(firstPath, "utf8"), firstSource);
    assert.equal(await readFile(secondPath, "utf8"), secondSource);
    assert.equal(renameCount, 3);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("defaults to check and accepts one explicit mode", () => {
  assert.equal(parseArgs([]), "check");
  assert.equal(parseArgs(["--check"]), "check");
  assert.equal(parseArgs(["--write"]), "write");
  assert.equal(parseArgs(["--json"]), "json");
  assert.throws(() => parseArgs(["--write", "--json"]), /only one/u);
  assert.throws(() => parseArgs(["--unknown"]), /unknown option/u);
});
