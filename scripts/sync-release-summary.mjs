import { readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const CATALOG_URL = new URL("../data/catalog.json", import.meta.url);
const FOLIOS_URL = new URL("../data/folios.json", import.meta.url);
const REPO_ROOT_URL = new URL("../", import.meta.url);
const START_MARKER = (id) => `<!-- release-summary:${id}:start -->`;
const END_MARKER = (id) => `<!-- release-summary:${id}:end -->`;

const DOCUMENTS = [
  {
    path: "README.md",
    blocks: {
      "readme-overview": renderOverview,
      "readme-catalog-table": renderCatalogTable,
      "readme-nininger-coverage": renderNiningerCoverage,
      "readme-metbull": renderMetbull,
      "readme-folio-table": (summary) => renderFolioTable(summary, "Policy", "Public folios"),
      "readme-public-folios": renderPublicFolioCount,
    },
  },
  {
    path: "data/README.md",
    blocks: {
      "data-overview": renderDataOverview,
      "data-catalog-table": renderCatalogTable,
      "data-nininger-coverage": renderNiningerCoverage,
      "data-folio-table": (summary) => renderFolioTable(summary, "Display policy", "Pages"),
    },
  },
  {
    path: "NOTICE.md",
    blocks: {
      "notice-facts": renderNoticeFacts,
      "notice-coverage": renderNoticeCoverage,
      "notice-folios": renderNoticeFolios,
    },
  },
  {
    path: "SESSION.md",
    blocks: {
      "session-current-state": renderSessionState,
    },
  },
  {
    path: "scripts/test-multicatalog-notes.md",
    blocks: {
      "test-notes-folio-lock": renderTestNotesFolioLock,
      "test-notes-real-release": renderTestNotesRealRelease,
    },
  },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function formatInteger(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
}

function pageRange(pages) {
  if (pages.length === 0) return null;
  return { min: Math.min(...pages), max: Math.max(...pages) };
}

function rangeText(range) {
  if (range === null) return "none";
  if (range.min === range.max) return String(range.min);
  return `${range.min}-${range.max}`;
}

function plural(value, singular, pluralForm = `${singular}s`) {
  return value === 1 ? singular : pluralForm;
}

function recordPages(record) {
  if (Array.isArray(record.catalogPages)) return record.catalogPages;
  if (Object.hasOwn(record, "catalogPage")) return [record.catalogPage];
  return [];
}

export function buildReleaseSummary(catalog, folios) {
  assert(catalog && typeof catalog === "object", "catalog must be an object");
  assert(catalog.metadata && typeof catalog.metadata === "object", "catalog.metadata must be an object");
  assert(Array.isArray(catalog.metadata.catalogs), "catalog.metadata.catalogs must be an array");
  assert(Array.isArray(catalog.records), "catalog.records must be an array");
  assert(folios && typeof folios === "object", "folios must be an object");
  assert(folios.catalogs && typeof folios.catalogs === "object", "folios.catalogs must be an object");

  const descriptors = [...catalog.metadata.catalogs].sort((left, right) => compareText(left.id, right.id));
  const recordsByCatalog = new Map(descriptors.map(({ id }) => [id, []]));
  assert(recordsByCatalog.size === descriptors.length, "catalog descriptor IDs must be unique");
  for (const record of catalog.records) {
    const records = recordsByCatalog.get(record.catalogId);
    assert(records, `record ${record.id ?? "(unknown)"} uses an unknown catalogId: ${record.catalogId}`);
    records.push(record);
  }

  const catalogs = descriptors.map((descriptor) => {
    assert(typeof descriptor.id === "string", "every catalog descriptor must have an id");
    assert(Array.isArray(descriptor.sourcePages), `${descriptor.id}.sourcePages must be an array`);
    const records = recordsByCatalog.get(descriptor.id);
    const sourcePages = [...new Set(descriptor.sourcePages)];
    const citedPages = [...new Set(records.flatMap(recordPages))];
    assert(sourcePages.every(Number.isInteger), `${descriptor.id}.sourcePages must contain integers`);
    assert(citedPages.every(Number.isInteger), `${descriptor.id} record citations must contain integers`);

    return {
      catalogId: descriptor.id,
      label: descriptor.label,
      year: descriptor.year,
      recordModel: descriptor.recordModel,
      recordCount: records.length,
      sourcePageCount: sourcePages.length,
      sourcePageRange: pageRange(sourcePages),
      citedPageCount: citedPages.length,
      citedPageRange: pageRange(citedPages),
    };
  });

  const folioCatalogs = catalogs.map(({ catalogId }) => {
    const manifestCatalog = folios.catalogs[catalogId];
    assert(manifestCatalog && typeof manifestCatalog === "object", `folios.catalogs is missing ${catalogId}`);
    assert(Array.isArray(manifestCatalog.pages), `folios.catalogs.${catalogId}.pages must be an array`);
    return {
      catalogId,
      displayPolicy: manifestCatalog.displayPolicy,
      rightsStatus: manifestCatalog.rightsStatus,
      pageCount: manifestCatalog.pages.length,
    };
  });
  const extraFolioCatalogs = Object.keys(folios.catalogs).filter((id) => !recordsByCatalog.has(id));
  assert(extraFolioCatalogs.length === 0, `folios.catalogs has unknown catalogs: ${extraFolioCatalogs.join(", ")}`);

  const metbullReviewed = catalog.records.filter((record) => record.metbull && typeof record.metbull === "object");
  const metbullUnresolved = metbullReviewed.filter((record) => record.metbull.matchType === "unresolved");
  const recordModels = [...new Set(descriptors.map(({ recordModel }) => recordModel))].sort(compareText);

  return {
    schemaVersion: catalog.metadata.schemaVersion,
    recordCount: catalog.records.length,
    catalogCount: catalogs.length,
    recordModels,
    sourcePageCount: catalogs.reduce((sum, item) => sum + item.sourcePageCount, 0),
    citedPageCount: catalogs.reduce((sum, item) => sum + item.citedPageCount, 0),
    recordsWithNullName: catalog.records.filter((record) => record.name === null).length,
    metbull: {
      reviewed: metbullReviewed.length,
      resolved: metbullReviewed.length - metbullUnresolved.length,
      unresolved: metbullUnresolved.length,
    },
    catalogs,
    folios: {
      schemaVersion: folios.schemaVersion,
      pageCount: folioCatalogs.reduce((sum, item) => sum + item.pageCount, 0),
      displayCatalogCount: folioCatalogs.filter((item) => item.displayPolicy === "display").length,
      catalogs: folioCatalogs,
    },
  };
}

export function renderOverview(summary) {
  const models = summary.recordModels.map((model) => `\`${model}\``).join(", ");
  return `This repository is a dependency-free, facts-only index of ${formatInteger(summary.recordCount)} source observations from ${formatInteger(summary.catalogCount)} historical meteorite catalogs. The coordinated catalog uses public metadata schema ${summary.schemaVersion} and supports ${formatInteger(summary.recordModels.length)} source-specific record models: ${models}.`;
}

function renderDataOverview(summary) {
  return `\`catalog.json\` is a schema-${summary.schemaVersion} facts-only dataset containing ${formatInteger(summary.recordCount)} source observations from ${formatInteger(summary.catalogCount)} historical meteorite catalogs. \`folios.json\` is a separate schema-${summary.folios.schemaVersion}, deny-by-default display manifest with ${formatInteger(summary.folios.pageCount)} reviewed page entries.`;
}

export function renderCatalogTable(summary) {
  const rows = summary.catalogs.map((catalog) =>
    `| \`${catalog.catalogId}\` | \`${catalog.recordModel}\` | ${formatInteger(catalog.recordCount)} | ${formatInteger(catalog.sourcePageCount)} | ${formatInteger(catalog.citedPageCount)} |`,
  );
  rows.push(`| **Total** |  | **${formatInteger(summary.recordCount)}** | **${formatInteger(summary.sourcePageCount)}** | **${formatInteger(summary.citedPageCount)}** |`);
  return [
    "| `catalogId` | Record model | Records | Metadata source pages | Pages cited by records |",
    "| --- | --- | ---: | ---: | ---: |",
    ...rows,
  ].join("\n");
}

export function renderNiningerCoverage(summary) {
  const entries = summary.catalogs.filter(({ catalogId }) => catalogId.startsWith("nininger-"));
  assert(entries.length > 0, "no Nininger catalogs were found");
  return entries.map((catalog) =>
    `\`${catalog.catalogId}\` has ${formatInteger(catalog.recordCount)} ${plural(catalog.recordCount, "record")}; its metadata source pages span ${rangeText(catalog.sourcePageRange)}, and its record citations span ${rangeText(catalog.citedPageRange)}.`,
  ).join(" ");
}

function renderMetbull(summary) {
  return `The current release includes reviewed MetBull harmonization for ${formatInteger(summary.metbull.reviewed)} of ${formatInteger(summary.recordCount)} records: ${formatInteger(summary.metbull.resolved)} have a resolved current identity and ${formatInteger(summary.metbull.unresolved)} remain explicitly unresolved. ${formatInteger(summary.recordsWithNullName)} records currently have a null \`name\` value.`;
}

function renderFolioTable(summary, policyHeading, countHeading) {
  const rows = summary.folios.catalogs.map((catalog) =>
    `| \`${catalog.catalogId}\` | ${catalog.displayPolicy} | ${catalog.rightsStatus} | ${formatInteger(catalog.pageCount)} |`,
  );
  rows.push(`| **Total** |  |  | **${formatInteger(summary.folios.pageCount)}** |`);
  return [
    `| \`catalogId\` | ${policyHeading} | Rights status | ${countHeading} |`,
    "| --- | --- | --- | ---: |",
    ...rows,
  ].join("\n");
}

function renderPublicFolioCount(summary) {
  return `Reviewed folio \`pageId\` values are intentionally public in \`folios.json\`, and the public repository contains only the ${formatInteger(summary.folios.pageCount)} selected, manifest-verified folio derivatives under \`assets/folios/\`.`;
}

function renderNoticeFacts(summary) {
  return `The current repository edition distributes ${formatInteger(summary.recordCount)} structured, facts-only source observations from ${formatInteger(summary.catalogCount)} catalogs under metadata schema version ${summary.schemaVersion}. It supports ${formatInteger(summary.recordModels.length)} source-specific record models: ${summary.recordModels.map((model) => `\`${model}\``).join(", ")}. Records are source observations rather than canonical meteorites or inferred physical specimens, and \`catalogId\` identifies each source.`;
}

function renderNoticeCoverage(summary) {
  return `Metadata covers ${formatInteger(summary.sourcePageCount)} catalog-scoped source pages, of which ${formatInteger(summary.citedPageCount)} are cited by records. Source-page coverage is not a claim that every covered page contains an observation. ${renderNiningerCoverage(summary)}`;
}

function folioList(summary, displayPolicy) {
  return summary.folios.catalogs
    .filter((catalog) => catalog.displayPolicy === displayPolicy)
    .map((catalog) => `\`${catalog.catalogId}\` (${formatInteger(catalog.pageCount)} pages, \`${catalog.rightsStatus}\`)`)
    .join("; ");
}

export function renderNoticeFolios(summary) {
  return `The repository publicly provides ${formatInteger(summary.folios.pageCount)} reviewed folio derivatives: ${folioList(summary, "display")}.

Catalogs remaining blocked with undetermined rights and no public folio pages are: ${folioList(summary, "blocked")}.`;
}

function renderSessionState(summary) {
  return [
    `- Schema ${summary.schemaVersion} contains ${formatInteger(summary.recordCount)} facts-only records across ${formatInteger(summary.catalogCount)} catalogs.`,
    "",
    renderCatalogTable(summary),
    "",
    `- Metadata covers ${formatInteger(summary.sourcePageCount)} catalog-scoped source pages; records cite ${formatInteger(summary.citedPageCount)} of them.`,
    `- Nininger coverage is derived without page-boundary assumptions: ${renderNiningerCoverage(summary)}`,
    `- Public folios use schema ${summary.folios.schemaVersion} and expose ${formatInteger(summary.folios.pageCount)} display pages across ${formatInteger(summary.folios.displayCatalogCount)} catalogs: ${folioList(summary, "display")}.`,
    `- Blocked folio catalogs are: ${folioList(summary, "blocked")}.`,
    `- Reviewed MetBull harmonization covers ${formatInteger(summary.metbull.reviewed)} of ${formatInteger(summary.recordCount)} records: ${formatInteger(summary.metbull.resolved)} resolved and ${formatInteger(summary.metbull.unresolved)} explicitly unresolved.`,
    `- Records currently having a null \`name\` value: ${formatInteger(summary.recordsWithNullName)}.`,
  ].join("\n");
}

function renderTestNotesFolioLock(summary) {
  return `Real-release checks additionally lock reviewed rights evidence, ordered page IDs, and all ${formatInteger(summary.folios.pageCount)} asset hashes.`;
}

function renderTestNotesRealRelease(summary) {
  return `The default \`node scripts/validate-public-catalog.mjs\` command reads and passes the real schema-${summary.schemaVersion} \`data/catalog.json\` and \`data/folios.json\`: ${formatInteger(summary.recordCount)} records across ${formatInteger(summary.catalogCount)} catalogs with ${formatInteger(summary.folios.pageCount)} displayable folio pages.`;
}

export function replaceGeneratedBlock(source, id, content) {
  const start = START_MARKER(id);
  const end = END_MARKER(id);
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end);
  assert(startIndex !== -1, `missing generated block start marker: ${id}`);
  assert(endIndex !== -1 && endIndex > startIndex, `missing or misplaced generated block end marker: ${id}`);
  assert(source.indexOf(start, startIndex + start.length) === -1, `duplicate generated block start marker: ${id}`);
  assert(source.indexOf(end, endIndex + end.length) === -1, `duplicate generated block end marker: ${id}`);
  return `${source.slice(0, startIndex)}${start}\n${content}\n${end}${source.slice(endIndex + end.length)}`;
}

export function parseArgs(args) {
  const valid = new Set(["--check", "--write", "--json"]);
  const unknown = args.filter((arg) => !valid.has(arg));
  assert(unknown.length === 0, `unknown option: ${unknown.join(", ")}`);
  assert(new Set(args).size === args.length, "options may not be repeated");
  assert(args.length <= 1, "use only one of --check, --write, or --json");
  return args[0]?.slice(2) ?? "check";
}

async function writeChangesAtomically(changes, fileOperations = {}) {
  const renameFile = fileOperations.rename ?? rename;
  const removeFile = fileOperations.rm ?? rm;
  const statFile = fileOperations.stat ?? stat;
  const writeTextFile = fileOperations.writeFile ?? writeFile;
  const transactionId = `${process.pid}-${Date.now()}`;
  const staged = [];
  const rollbackErrors = [];

  try {
    for (const [index, change] of changes.entries()) {
      const temporaryUrl = pathToFileURL(`${fileURLToPath(change.url)}.${transactionId}-${index}.tmp`);
      const { mode } = await statFile(change.url);
      const stagedChange = { ...change, temporaryUrl, mode };
      staged.push(stagedChange);
      await writeTextFile(temporaryUrl, change.expected, {
        encoding: "utf8",
        flag: "wx",
        mode: mode & 0o777,
      });
    }

    const committed = [];
    try {
      for (const change of staged) {
        await renameFile(change.temporaryUrl, change.url);
        committed.push(change);
      }
    } catch (error) {
      for (const change of committed.reverse()) {
        try {
          await writeTextFile(change.temporaryUrl, change.source, {
            encoding: "utf8",
            flag: "wx",
            mode: change.mode & 0o777,
          });
          await renameFile(change.temporaryUrl, change.url);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      if (rollbackErrors.length > 0) {
        throw new AggregateError([error, ...rollbackErrors], "release-summary write failed and rollback was incomplete");
      }
      throw error;
    }
  } finally {
    await Promise.all(staged.map(({ temporaryUrl }) => removeFile(temporaryUrl, { force: true })));
  }
}

async function readJson(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

export async function syncDocuments(
  summary,
  { write = false, rootUrl = REPO_ROOT_URL, documents = DOCUMENTS, fileOperations } = {},
) {
  const changes = [];
  for (const document of documents) {
    const url = new URL(document.path, rootUrl);
    const source = await readFile(url, "utf8");
    let expected = source;
    for (const [id, render] of Object.entries(document.blocks)) {
      expected = replaceGeneratedBlock(expected, id, render(summary));
    }
    if (expected !== source) {
      changes.push({ path: document.path, url, source, expected });
    }
  }
  if (write && changes.length > 0) await writeChangesAtomically(changes, fileOperations);
  return changes.map(({ path }) => path);
}

export async function main(args = process.argv.slice(2)) {
  const mode = parseArgs(args);
  const summary = buildReleaseSummary(await readJson(CATALOG_URL), await readJson(FOLIOS_URL));
  if (mode === "json") {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return;
  }

  const stale = await syncDocuments(summary, { write: mode === "write" });
  if (stale.length > 0 && mode === "check") {
    throw new Error(`release summaries are stale; run node scripts/sync-release-summary.mjs --write\n${stale.join("\n")}`);
  }
  const action = mode === "write" ? "Updated" : "Checked";
  const detail = stale.length === 0 ? "all generated release summaries" : stale.join(", ");
  console.log(`${action} ${detail}.`);
}

const isMain = process.argv[1] && pathToFileURL(fileURLToPath(new URL(process.argv[1], "file:"))).href === import.meta.url;
if (isMain) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
