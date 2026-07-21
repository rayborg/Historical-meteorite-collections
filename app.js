"use strict";

const CACHE_VERSION = "20260721-4";
const PAGE_SIZE = 120;
const DEFAULT_SORT = "designation-asc";
const VALID_SORTS = new Set([
  "designation-asc",
  "designation-desc",
  "name-asc",
  "name-desc",
  "weight-asc",
  "weight-desc"
]);
const RECORD_FIELDS = new Set([
  "id",
  "catalogId",
  "designation",
  "name",
  "weight",
  "classification",
  "locality",
  "year",
  "catalogPage",
  "confidence"
]);
const FACTUAL_FIELDS = [
  "id",
  "catalogId",
  "designation",
  "name",
  "weight.grams",
  "classification",
  "locality",
  "year",
  "catalogPage",
  "confidence"
];
const CONFIDENCE_LEVELS = ["high", "medium", "low"];
const CONFIDENCE_FIELDS = new Set(CONFIDENCE_LEVELS);
const LEGACY_METADATA_FIELDS = new Set([
  "catalog",
  "scope",
  "sourcePageRange",
  "sourcePageCount",
  "recordCount",
  "factualFields",
  "recordsWithDesignation",
  "recordsWithWeight",
  "confidenceCounts"
]);
const DEPLOYED_CATALOG_FIELDS = new Set(["id", "compiler", "year", "folioDisplayPolicy", "rightsStatus"]);
const CANONICAL_METADATA_FIELDS = new Set([
  "schemaVersion",
  "scope",
  "factualFields",
  "catalogs",
  "recordCount",
  "recordsWithDesignation",
  "recordsWithWeight",
  "confidenceCounts"
]);
const CANONICAL_CATALOG_FIELDS = new Set([
  "id",
  "label",
  "compiler",
  "year",
  "sourcePages",
  "sourcePageCount",
  "recordCount",
  "recordsWithDesignation",
  "recordsWithWeight",
  "confidenceCounts",
  "folioDisplayPolicy",
  "rightsStatus"
]);
const FOLIO_ROOT_FIELDS = new Set(["schemaVersion", "catalogs"]);
const FOLIO_CATALOG_FIELDS = new Set(["displayPolicy", "rightsStatus", "pages"]);
const FOLIO_PAGE_FIELDS = new Set(["image", "alt", "thumbnail"]);
const FOLIO_DISPLAY_POLICIES = new Set(["blocked", "display"]);
const FOLIO_RIGHTS_STATUSES = new Set(["undetermined", "public-domain"]);
const MAX_CATALOG_ID_LENGTH = 80;
const MAX_DESCRIPTOR_TEXT_LENGTH = 160;
const LEAKAGE_MARKER = /\b(?:raw[\s_-]*ocr|raw[\s_-]*text|ocr[\s_-]*(?:output|text)|source[\s_-]*(?:image|file)(?:[\s_-]*name)?s?|scan(?:ned)?[\s_-]*(?:image|file|path|name)s?|verbatim[\s_-]*notes?|transcription[\s_-]*notes?)\b/iu;
const IMAGE_OR_SOURCE_FILE = /\.(?:avif|bmp|gif|heic|heif|hocr|jpe?g|ocr|pdf|png|svg|tiff?|webp)(?=$|[^A-Za-z0-9])|\b(?:dscn?|img|pxl)[_-]?\d{3,}\b/iu;
const PATH_LIKE_STRING = /(?:^|[\s"'(])(?:[A-Za-z][A-Za-z\d+.-]*:\/\/|\/{1,2}|\.{1,2}[\\/]|~[\\/]|[A-Za-z]:[\\/]|(?:assets?|files?|folios?|images?|scans?|source[\s_-]*images?)[\\/])|\\/iu;
const integerFormat = new Intl.NumberFormat("en-US");
const massFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });
const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

const elements = typeof document === "undefined" ? null : {
  form: document.querySelector("#filter-form"),
  catalogSummary: document.querySelector("#catalog-summary"),
  search: document.querySelector("#search"),
  catalog: document.querySelector("#catalog-filter"),
  min: document.querySelector("#min-weight"),
  max: document.querySelector("#max-weight"),
  sort: document.querySelector("#sort"),
  results: document.querySelector("#results"),
  count: document.querySelector("#result-count"),
  countUnit: document.querySelector("#result-unit"),
  status: document.querySelector("#status"),
  clear: document.querySelector("#clear-filters"),
  showMore: document.querySelector("#show-more"),
  empty: document.querySelector("#empty-state"),
  error: document.querySelector("#error-state"),
  errorHeading: document.querySelector("#error-heading"),
  errorMessage: document.querySelector("#error-message"),
  retry: document.querySelector("#retry"),
  template: document.querySelector("#record-template"),
  dialog: document.querySelector("#folio-dialog"),
  dialogClose: document.querySelector("#folio-dialog-close"),
  dialogCatalog: document.querySelector("#folio-dialog-catalog"),
  dialogTitle: document.querySelector("#folio-dialog-title"),
  dialogImage: document.querySelector("#folio-dialog-image"),
  dialogImageStatus: document.querySelector("#folio-image-status"),
  dialogCaption: document.querySelector("#folio-dialog-caption"),
  previousFolio: document.querySelector("#previous-folio"),
  nextFolio: document.querySelector("#next-folio"),
  folioPosition: document.querySelector("#folio-position"),
  stats: {
    specimens: document.querySelector("#stat-specimens"),
    names: document.querySelector("#stat-names"),
    pages: document.querySelector("#stat-pages"),
    mass: document.querySelector("#stat-mass")
  }
};

let records = [];
let catalogRegistry = {};
let folioManifest = null;
let activeFolioPages = [];
let activeFolioIndex = -1;
let folioOpener = null;
let visibleLimit = PAGE_SIZE;
let renderTimer;
let loadToken = 0;

function cleanText(value) {
  return value === null || value === undefined || value === "" ? null : String(value).trim();
}

function searchable(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function designationComponents(value) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase();

  const match = normalized.match(/^(?:\(\d+\)\s*)?h\s*(\d+(?:[^a-z0-9]+\d+)*)[^a-z0-9]*$/);
  return match ? match[1].match(/\d+/g) : null;
}

function genericDesignation(value) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase();
  const match = normalized.match(/^(?:\(\d+\)\s*)?([a-z]+)\s*(\d+(?:[^a-z0-9]+\d+)*)[^a-z0-9]*$/);
  if (!match) return null;
  return { prefix: match[1], segments: match[2].match(/\d+/g) };
}

function normalizeDesignation(value) {
  const components = designationComponents(value);
  if (components) return `h${components.join(".")}`;
  return searchable(value).replace(/ /g, ".");
}

function isDesignationQuery(value) {
  return designationComponents(value) !== null;
}

function matchesSearch(record, rawQuery) {
  const query = searchable(rawQuery);
  if (!query) return true;

  const numericQuery = String(rawQuery || "").trim();
  if (/^\d+$/.test(numericQuery)) {
    const yearTokens = searchable(record.year).split(/\s+/).filter(Boolean);
    return String(record.designation || "").trim() === numericQuery || yearTokens.includes(numericQuery);
  }

  const parsedQuery = parseSearchQuery(rawQuery);
  if (parsedQuery.designations.length) {
    const recordSegments = record.designationSegments || designationComponents(record.designation);
    const designationMatches = Boolean(recordSegments) && parsedQuery.designations.every((querySegments) =>
      querySegments.every((segment, index) => recordSegments[index] === segment)
    );
    const haystack = record.searchText || searchable([
      record.designation,
      record.name,
      record.classification,
      record.locality,
      record.year
    ].filter(Boolean).join(" "));
    if (!designationMatches) {
      const haystackTerms = new Set(haystack.split(/\s+/));
      return parsedQuery.designations.length === 1 &&
        parsedQuery.textTerms.length === 0 &&
        query.split(/\s+/).every((term) => haystackTerms.has(term));
    }
    return parsedQuery.textTerms.every((term) => haystack.includes(term));
  }

  const queryDesignation = genericDesignation(rawQuery);
  if (queryDesignation) {
    const recordDesignation = record.designationKey || genericDesignation(record.designation);
    const designationMatches = Boolean(recordDesignation) &&
      queryDesignation.prefix === recordDesignation.prefix &&
      queryDesignation.segments.every((segment, index) => recordDesignation.segments[index] === segment);
    if (designationMatches) return true;
    const haystack = record.searchText || searchable([
      record.designation,
      record.name,
      record.classification,
      record.locality,
      record.year
    ].filter(Boolean).join(" "));
    const haystackTerms = new Set(haystack.split(/\s+/));
    return query.split(/\s+/).every((term) => haystackTerms.has(term));
  }

  const haystack = record.searchText || searchable([
    record.designation,
    record.name,
    record.classification,
    record.locality,
    record.year
  ].filter(Boolean).join(" "));
  return query.split(/\s+/).every((term) => haystack.includes(term));
}

function parseSearchQuery(value) {
  const tokens = String(value || "").trim().split(/\s+/).filter(Boolean);
  const designations = [];
  const textTokens = [];
  for (let index = 0; index < tokens.length; index += 1) {
    let components = designationComponents(tokens[index]);
    if (!components && /^h$/i.test(tokens[index]) && index + 1 < tokens.length) {
      components = designationComponents(`h${tokens[index + 1]}`);
      if (components) index += 1;
    }
    if (components) designations.push(components);
    else textTokens.push(tokens[index]);
  }
  const text = searchable(textTokens.join(" "));
  return { designations, textTerms: text ? text.split(/\s+/) : [] };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactFields(value, expectedFields) {
  if (!isPlainObject(value)) return false;
  const fields = Object.keys(value);
  return fields.length === expectedFields.size && fields.every((field) => expectedFields.has(field));
}

function schemaError() {
  return new Error("The catalog data does not match the public facts-only schema.");
}

function requireSchema(condition) {
  if (!condition) throw schemaError();
}

function normalizedText(value) {
  return typeof value === "string" ? value.normalize("NFC").replace(/\s+/gu, " ").trim() : null;
}

function isLeakageSafeText(value) {
  return typeof value === "string" && value === normalizedText(value) &&
    !/[\p{Cc}\p{Cf}]/u.test(value) && !LEAKAGE_MARKER.test(value) &&
    !IMAGE_OR_SOURCE_FILE.test(value) && !PATH_LIKE_STRING.test(value);
}

function isLeakageSafeTree(value) {
  if (typeof value === "string") return isLeakageSafeText(value);
  if (Array.isArray(value)) return value.every(isLeakageSafeTree);
  if (!isPlainObject(value)) return true;
  return Object.values(value).every(isLeakageSafeTree);
}

function hasFactualFields(value) {
  return Array.isArray(value) && value.length === FACTUAL_FIELDS.length &&
    value.every((field, index) => field === FACTUAL_FIELDS[index]);
}

function hasValidConfidenceCounts(value, recordCount) {
  return hasExactFields(value, CONFIDENCE_FIELDS) && CONFIDENCE_LEVELS.every((level) =>
    Number.isInteger(value[level]) && value[level] >= 0
  ) && CONFIDENCE_LEVELS.reduce((sum, level) => sum + value[level], 0) === recordCount;
}

function hasValidSummary(value) {
  return Number.isInteger(value.recordCount) && value.recordCount > 0 &&
    Number.isInteger(value.recordsWithDesignation) && value.recordsWithDesignation >= 0 && value.recordsWithDesignation <= value.recordCount &&
    Number.isInteger(value.recordsWithWeight) && value.recordsWithWeight >= 0 && value.recordsWithWeight <= value.recordCount &&
    hasValidConfidenceCounts(value.confidenceCounts, value.recordCount);
}

function hasValidCatalogPolicy(descriptor) {
  return FOLIO_DISPLAY_POLICIES.has(descriptor.folioDisplayPolicy) &&
    FOLIO_RIGHTS_STATUSES.has(descriptor.rightsStatus) &&
    (descriptor.folioDisplayPolicy !== "display" || descriptor.rightsStatus === "public-domain");
}

function hasValidCatalogId(value) {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) &&
    Array.from(value).length <= MAX_CATALOG_ID_LENGTH;
}

function hasValidDescriptorText(value) {
  const length = typeof value === "string" ? value.length : 0;
  return length > 0 && length <= MAX_DESCRIPTOR_TEXT_LENGTH && isLeakageSafeText(value);
}

function hasValidRecordId(value) {
  return typeof value === "string" && Array.from(value).length > 0 && isLeakageSafeText(value);
}

function hasValidSourcePages(value) {
  return Array.isArray(value) && value.length > 0 && value.every((page, index) =>
    Number.isInteger(page) && page > 0 && (index === 0 || page > value[index - 1])
  );
}

function validateCanonicalDescriptor(descriptor) {
  requireSchema(hasExactFields(descriptor, CANONICAL_CATALOG_FIELDS));
  requireSchema(hasValidCatalogId(descriptor.id));
  requireSchema(hasValidDescriptorText(descriptor.label));
  requireSchema(hasValidDescriptorText(descriptor.compiler));
  requireSchema(Number.isInteger(descriptor.year) && descriptor.year > 0);
  requireSchema(hasValidSourcePages(descriptor.sourcePages));
  requireSchema(descriptor.sourcePageCount === descriptor.sourcePages.length);
  requireSchema(hasValidSummary(descriptor));
  requireSchema(hasValidCatalogPolicy(descriptor));
}

function catalogLabel(descriptor, catalogId = "") {
  if (cleanText(descriptor?.displayLabel)) return descriptor.displayLabel;
  if (cleanText(descriptor?.label)) return descriptor.label;
  const compiler = cleanText(descriptor?.compiler);
  const year = Number.isInteger(descriptor?.year) ? String(descriptor.year) : null;
  return compiler && year ? `${compiler} (${year})` : compiler || year || cleanText(catalogId) || "Catalog";
}

function formatSourcePageCoverage(sourcePages) {
  if (!Array.isArray(sourcePages) || !sourcePages.length) return "No pages recorded";
  const ranges = [];
  let start = sourcePages[0];
  let end = start;

  sourcePages.slice(1).forEach((page) => {
    if (page === end + 1) {
      end = page;
      return;
    }
    ranges.push(start === end ? String(start) : `${start}\u2013${end}`);
    start = page;
    end = page;
  });
  ranges.push(start === end ? String(start) : `${start}\u2013${end}`);
  const unit = sourcePages.length === 1 ? "page" : "pages";
  return `${ranges.join(", ")} (${integerFormat.format(sourcePages.length)} ${unit})`;
}

function catalogSummaryEntries(catalogs) {
  const descriptors = Array.isArray(catalogs) ? catalogs : Object.values(catalogs || {});
  return descriptors.map((descriptor) => ({
    id: descriptor.id,
    label: cleanText(descriptor.label) || catalogLabel(descriptor, descriptor.id),
    year: descriptor.year,
    compiler: descriptor.compiler,
    pageCoverage: formatSourcePageCoverage(descriptor.sourcePages),
    observationCount: descriptor.recordCount
  }));
}

function renderCatalogSummary(catalogs) {
  const list = document.createElement("ul");
  list.className = "catalog-summary-list";

  catalogSummaryEntries(catalogs).forEach((summary) => {
    const item = document.createElement("li");
    item.className = "catalog-summary-card";
    const heading = document.createElement("h3");
    heading.textContent = summary.label;
    const details = document.createElement("dl");
    [
      ["Year", String(summary.year)],
      ["Compiler", summary.compiler],
      ["Page coverage", summary.pageCoverage],
      ["Source observations", integerFormat.format(summary.observationCount)]
    ].forEach(([term, description]) => {
      const row = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = term;
      dd.textContent = description;
      row.append(dt, dd);
      details.append(row);
    });
    item.append(heading, details);
    list.append(item);
  });

  elements.catalogSummary.replaceChildren(list);
  elements.catalogSummary.setAttribute("aria-busy", "false");
}

function createCatalogRegistry(descriptors) {
  const registry = {};
  const labels = new Map();
  descriptors.forEach((descriptor) => {
    const key = searchable(descriptor.label);
    labels.set(key, (labels.get(key) || 0) + 1);
  });
  descriptors.forEach((descriptor) => {
    const duplicate = labels.get(searchable(descriptor.label)) > 1;
    registry[descriptor.id] = {
      ...descriptor,
      sourcePages: [...descriptor.sourcePages],
      displayLabel: duplicate ? `${descriptor.label} (${descriptor.year}; ${descriptor.id})` : descriptor.label
    };
  });
  return registry;
}

function normalizeCatalogRegistry(metadata) {
  requireSchema(isPlainObject(metadata) && isLeakageSafeTree(metadata));

  if (Object.hasOwn(metadata, "schemaVersion")) {
    requireSchema(hasExactFields(metadata, CANONICAL_METADATA_FIELDS));
    requireSchema(metadata.schemaVersion === 2 && metadata.scope === "facts-only" && hasFactualFields(metadata.factualFields));
    requireSchema(Array.isArray(metadata.catalogs) && metadata.catalogs.length > 0 && hasValidSummary(metadata));
    metadata.catalogs.forEach(validateCanonicalDescriptor);
    requireSchema(new Set(metadata.catalogs.map((descriptor) => descriptor.id)).size === metadata.catalogs.length);
    requireSchema(metadata.catalogs.reduce((sum, descriptor) => sum + descriptor.recordCount, 0) === metadata.recordCount);
    requireSchema(metadata.catalogs.reduce((sum, descriptor) => sum + descriptor.recordsWithDesignation, 0) === metadata.recordsWithDesignation);
    requireSchema(metadata.catalogs.reduce((sum, descriptor) => sum + descriptor.recordsWithWeight, 0) === metadata.recordsWithWeight);
    CONFIDENCE_LEVELS.forEach((level) => requireSchema(
      metadata.catalogs.reduce((sum, descriptor) => sum + descriptor.confidenceCounts[level], 0) === metadata.confidenceCounts[level]
    ));
    return createCatalogRegistry(metadata.catalogs);
  }

  requireSchema(hasExactFields(metadata, LEGACY_METADATA_FIELDS));
  requireSchema(metadata.scope === "facts-only" && hasFactualFields(metadata.factualFields) && hasValidSummary(metadata));
  requireSchema(hasExactFields(metadata.catalog, DEPLOYED_CATALOG_FIELDS));
  requireSchema(hasValidCatalogId(metadata.catalog.id) && hasValidDescriptorText(metadata.catalog.compiler));
  requireSchema(Number.isInteger(metadata.catalog.year) && metadata.catalog.year > 0 && hasValidCatalogPolicy(metadata.catalog));
  requireSchema(hasExactFields(metadata.sourcePageRange, new Set(["start", "end"])));
  const { start, end } = metadata.sourcePageRange;
  requireSchema(Number.isInteger(start) && start > 0 && Number.isInteger(end) && end >= start);
  requireSchema(metadata.sourcePageCount === end - start + 1);
  const sourcePages = Array.from({ length: metadata.sourcePageCount }, (_, index) => start + index);
  return createCatalogRegistry([{
    id: metadata.catalog.id,
    label: `${metadata.catalog.compiler} (${metadata.catalog.year})`,
    compiler: metadata.catalog.compiler,
    year: metadata.catalog.year,
    sourcePages,
    sourcePageCount: metadata.sourcePageCount,
    recordCount: metadata.recordCount,
    recordsWithDesignation: metadata.recordsWithDesignation,
    recordsWithWeight: metadata.recordsWithWeight,
    confidenceCounts: { ...metadata.confidenceCounts },
    folioDisplayPolicy: metadata.catalog.folioDisplayPolicy,
    rightsStatus: metadata.catalog.rightsStatus
  }]);
}

function emptyCatalogStatistics() {
  return {
    recordCount: 0,
    recordsWithDesignation: 0,
    recordsWithWeight: 0,
    confidenceCounts: Object.fromEntries(CONFIDENCE_LEVELS.map((level) => [level, 0]))
  };
}

function validateCatalog(catalog) {
  requireSchema(hasExactFields(catalog, new Set(["metadata", "records"])) && Array.isArray(catalog.records));
  requireSchema(isLeakageSafeTree(catalog));
  const registry = normalizeCatalogRegistry(catalog.metadata);
  const ids = new Set();
  const statistics = Object.fromEntries(Object.keys(registry).map((catalogId) => [catalogId, emptyCatalogStatistics()]));

  catalog.records.forEach((record) => {
    requireSchema(hasExactFields(record, RECORD_FIELDS) && hasExactFields(record.weight, new Set(["grams"])));
    requireSchema(hasValidRecordId(record.id) && !ids.has(record.id));
    ids.add(record.id);
    requireSchema(hasValidCatalogId(record.catalogId) && Object.hasOwn(registry, record.catalogId));
    ["designation", "name", "classification", "locality", "year"].forEach((field) =>
      requireSchema(record[field] === null || (record[field] !== "" && isLeakageSafeText(record[field])))
    );
    requireSchema(record.weight.grams === null || (Number.isFinite(record.weight.grams) && record.weight.grams >= 0));
    requireSchema(
      record.designation !== null ||
      record.name !== null ||
      record.weight.grams !== null ||
      record.classification !== null ||
      record.locality !== null ||
      record.year !== null
    );
    requireSchema(Number.isInteger(record.catalogPage) && registry[record.catalogId].sourcePages.includes(record.catalogPage));
    requireSchema(CONFIDENCE_LEVELS.includes(record.confidence));

    const summary = statistics[record.catalogId];
    summary.recordCount += 1;
    summary.confidenceCounts[record.confidence] += 1;
    if (record.designation !== null) summary.recordsWithDesignation += 1;
    if (record.weight.grams !== null) summary.recordsWithWeight += 1;
  });

  requireSchema(catalog.metadata.recordCount === catalog.records.length);
  Object.entries(registry).forEach(([catalogId, descriptor]) => {
    const summary = statistics[catalogId];
    requireSchema(summary.recordCount === descriptor.recordCount);
    requireSchema(summary.recordsWithDesignation === descriptor.recordsWithDesignation);
    requireSchema(summary.recordsWithWeight === descriptor.recordsWithWeight);
    CONFIDENCE_LEVELS.forEach((level) => requireSchema(summary.confidenceCounts[level] === descriptor.confidenceCounts[level]));
  });
  return catalog;
}

function isSafeFolioPath(value, catalogId) {
  if (typeof value !== "string" || !value || /\s/.test(value) || !hasValidCatalogId(catalogId)) return false;
  if (value.startsWith("/") || value.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(value)) return false;
  if (/[\\?#%:]/.test(value) || !value.startsWith(`assets/folios/${catalogId}/`)) return false;
  const segments = value.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return false;
  if (segments.length < 4 || segments[0] !== "assets" || segments[1] !== "folios" || segments[2] !== catalogId) return false;
  if (!segments.every((segment) => /^[A-Za-z0-9._-]+$/.test(segment))) return false;
  return /\.(?:webp|png|jpe?g|avif)$/.test(segments.at(-1));
}

function normalizeFolioAlt(value) {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (!normalized || Array.from(normalized).length > 160 || /[\p{Cc}\p{Cf}<>]/u.test(normalized)) return null;
  if (/`|!?\[[^\]]*\]\([^)]*\)/u.test(normalized)) return null;
  return normalized;
}

function isValidFolioAlt(value) {
  const normalized = normalizeFolioAlt(value);
  return normalized !== null && value === normalized;
}

function validateFolioManifest(manifest, registry = catalogRegistry) {
  if (!hasExactFields(manifest, FOLIO_ROOT_FIELDS) || manifest.schemaVersion !== 1 || !isPlainObject(manifest.catalogs)) return false;
  if (!isPlainObject(registry) || !Object.keys(registry).length) return false;
  const manifestCatalogIds = Object.keys(manifest.catalogs);
  const registryCatalogIds = Object.keys(registry);
  if (
    manifestCatalogIds.length !== registryCatalogIds.length ||
    manifestCatalogIds.some((catalogId) => !Object.hasOwn(registry, catalogId))
  ) return false;

  return Object.entries(manifest.catalogs).every(([catalogId, catalog]) => {
    const descriptor = registry[catalogId];
    if (!hasValidCatalogId(catalogId) || !hasExactFields(catalog, FOLIO_CATALOG_FIELDS) || !isPlainObject(catalog.pages)) return false;
    if (!FOLIO_DISPLAY_POLICIES.has(catalog.displayPolicy) || !FOLIO_RIGHTS_STATUSES.has(catalog.rightsStatus)) return false;
    if (catalog.displayPolicy === "display" && catalog.rightsStatus !== "public-domain") return false;
    if (catalog.displayPolicy !== descriptor.folioDisplayPolicy || catalog.rightsStatus !== descriptor.rightsStatus) return false;
    if (catalog.displayPolicy === "blocked" && Object.keys(catalog.pages).length) return false;
    const sourcePages = new Set(descriptor.sourcePages);
    return Object.entries(catalog.pages).every(([pageNumber, page]) => {
      if (!/^[1-9]\d*$/.test(pageNumber) || !sourcePages.has(Number(pageNumber)) || !isPlainObject(page)) return false;
      const fields = Object.keys(page);
      if (!fields.includes("image") || !fields.includes("alt") || !fields.every((field) => FOLIO_PAGE_FIELDS.has(field))) return false;
      if (fields.length < 2 || fields.length > 3 || !isSafeFolioPath(page.image, catalogId) || !isValidFolioAlt(page.alt)) return false;
      return page.thumbnail === undefined || isSafeFolioPath(page.thumbnail, catalogId);
    });
  });
}

function hasMatchingFolioPolicy(manifest, catalogId, registry = catalogRegistry) {
  const descriptor = registry?.[catalogId];
  const policy = manifest?.catalogs?.[catalogId];
  return Boolean(descriptor && policy) &&
    descriptor.folioDisplayPolicy === policy.displayPolicy &&
    descriptor.rightsStatus === policy.rightsStatus &&
    descriptor.folioDisplayPolicy === "display" &&
    descriptor.rightsStatus === "public-domain";
}

function getAuthorizedFolio(manifest, catalogId, catalogPage, registry = catalogRegistry) {
  const pageNumber = Number(catalogPage);
  if (!validateFolioManifest(manifest, registry) || !cleanText(catalogId) || catalogPage === null || catalogPage === "" || !Number.isInteger(pageNumber)) return null;
  if (!hasMatchingFolioPolicy(manifest, catalogId, registry) || !registry[catalogId].sourcePages.includes(pageNumber)) return null;
  const catalog = manifest.catalogs[catalogId];
  const page = catalog.pages[String(pageNumber)];
  if (!page || !isSafeFolioPath(page.image, catalogId) || !isValidFolioAlt(page.alt)) return null;
  const folio = { catalogId, catalogPage: pageNumber, image: page.image, alt: page.alt };
  if (page.thumbnail !== undefined) folio.thumbnail = page.thumbnail;
  return folio;
}

function getAuthorizedFolioPages(manifest, catalogId, registry = catalogRegistry) {
  if (!validateFolioManifest(manifest, registry) || !hasMatchingFolioPolicy(manifest, catalogId, registry)) return [];
  const catalog = manifest.catalogs[catalogId];
  return Object.keys(catalog.pages)
    .map(Number)
    .sort((a, b) => a - b)
    .map((catalogPage) => getAuthorizedFolio(manifest, catalogId, catalogPage, registry))
    .filter(Boolean);
}

function normalizeConfidence(value) {
  const normalized = searchable(value);
  return ["high", "medium", "low"].includes(normalized) ? normalized : "medium";
}

function prepareRecord(source, index, registry = catalogRegistry) {
  const gramValue = source.weight.grams;
  const grams = gramValue === null || gramValue === "" ? null : Number(gramValue);
  const designation = cleanText(source.designation);
  const record = {
    id: cleanText(source.id),
    catalogId: cleanText(source.catalogId),
    designation,
    name: cleanText(source.name),
    weight: { grams: Number.isFinite(grams) ? grams : null },
    classification: cleanText(source.classification),
    locality: cleanText(source.locality),
    year: cleanText(source.year),
    catalogPage: source.catalogPage === null || source.catalogPage === "" ? null : Number(source.catalogPage),
    confidence: normalizeConfidence(source.confidence),
    catalogLabel: catalogLabel(registry[cleanText(source.catalogId)], cleanText(source.catalogId)),
    order: index
  };
  record.searchText = searchable([
    record.designation,
    record.name,
    record.classification,
    record.locality,
    record.year,
    record.catalogId,
    record.catalogLabel
  ].filter(Boolean).join(" "));
  record.designationSegments = designationComponents(record.designation);
  record.designationKey = genericDesignation(record.designation);
  return record;
}

async function loadData() {
  const currentLoadToken = ++loadToken;
  folioManifest = null;
  setLoadingState();
  try {
    const response = await fetch("./data/catalog.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`The public catalog request returned status ${response.status}.`);
    const catalog = validateCatalog(await response.json());
    catalogRegistry = normalizeCatalogRegistry(catalog.metadata);
    renderCatalogSummary(catalogRegistry);
    records = catalog.records.map((record, index) => prepareRecord(record, index, catalogRegistry));
    if (!records.length) throw new Error("The public catalog contains no source observations.");
    populateCatalogFilter();
    updateStatistics();
    applyUrlState();
    visibleLimit = PAGE_SIZE;
    render();
    loadFolioManifest().then((manifest) => {
      if (currentLoadToken !== loadToken) return;
      folioManifest = manifest;
      if (manifest && records.some((record) => getAuthorizedFolio(manifest, record.catalogId, record.catalogPage, catalogRegistry))) render();
    });
  } catch (error) {
    showError(error);
  }
}

async function loadFolioManifest() {
  try {
    const response = await fetch("./data/folios.json", { cache: "no-cache" });
    if (!response.ok) return null;
    const manifest = await response.json();
    return validateFolioManifest(manifest, catalogRegistry) ? manifest : null;
  } catch {
    return null;
  }
}

function setLoadingState() {
  elements.results.replaceChildren();
  elements.results.setAttribute("aria-busy", "true");
  elements.status.textContent = "Opening the factual index...";
  elements.count.textContent = "Loading";
  elements.countUnit.textContent = "observations";
  elements.showMore.hidden = true;
  elements.empty.hidden = true;
  elements.error.hidden = true;
  const summaryStatus = document.createElement("p");
  summaryStatus.className = "catalog-summary-status";
  summaryStatus.setAttribute("role", "status");
  summaryStatus.textContent = "Reading catalog metadata...";
  elements.catalogSummary.replaceChildren(summaryStatus);
  elements.catalogSummary.setAttribute("aria-busy", "true");
}

function showError(error) {
  elements.results.replaceChildren();
  elements.results.setAttribute("aria-busy", "false");
  elements.status.textContent = "The public catalog is unavailable.";
  elements.count.textContent = "0";
  elements.countUnit.textContent = "observations";
  elements.showMore.hidden = true;
  elements.empty.hidden = true;
  elements.errorMessage.textContent = error.message || "The public catalog data is presently unavailable.";
  elements.error.hidden = false;
  const summaryStatus = document.createElement("p");
  summaryStatus.className = "catalog-summary-status";
  summaryStatus.setAttribute("role", "status");
  summaryStatus.textContent = "Catalog source details are unavailable.";
  elements.catalogSummary.replaceChildren(summaryStatus);
  elements.catalogSummary.setAttribute("aria-busy", "false");
  elements.errorHeading.focus();
}

function updateStatistics() {
  const statistics = calculateStatistics(records);
  elements.stats.specimens.textContent = integerFormat.format(statistics.observations);
  elements.stats.names.textContent = integerFormat.format(statistics.names);
  elements.stats.pages.textContent = integerFormat.format(statistics.pages);
  elements.stats.mass.textContent = formatMass(statistics.grams);
}

function calculateStatistics(sourceRecords) {
  const names = new Set(sourceRecords.map((record) => searchable(record.name)).filter(Boolean));
  const pages = new Set(sourceRecords
    .filter((record) => cleanText(record.catalogId) && Number.isFinite(record.catalogPage))
    .map((record) => `${record.catalogId}\u0000${record.catalogPage}`));
  return {
    observations: sourceRecords.length,
    specimens: sourceRecords.length,
    names: names.size,
    pages: pages.size,
    grams: sourceRecords.reduce((sum, record) => sum + (record.weight.grams || 0), 0)
  };
}

function populateCatalogFilter() {
  const options = Object.entries(catalogRegistry)
    .sort(([, left], [, right]) => collator.compare(catalogLabel(left), catalogLabel(right)))
    .map(([catalogId, descriptor]) => {
      const option = document.createElement("option");
      option.value = catalogId;
      option.textContent = catalogLabel(descriptor, catalogId);
      return option;
    });
  elements.catalog.replaceChildren(new Option("All source catalogs", ""), ...options);
}

function formatMass(grams) {
  if (!Number.isFinite(grams)) return "Not recorded";
  if (Math.abs(grams) >= 1_000_000) return `${massFormat.format(grams / 1_000_000)} t`;
  if (Math.abs(grams) >= 1_000) return `${massFormat.format(grams / 1_000)} kg`;
  return `${massFormat.format(grams)} g`;
}

function currentFilters() {
  const min = elements.min.value === "" ? null : Number(elements.min.value);
  const max = elements.max.value === "" ? null : Number(elements.max.value);
  return {
    query: elements.search.value.trim(),
    catalog: elements.catalog.value && Object.hasOwn(catalogRegistry, elements.catalog.value) ? elements.catalog.value : null,
    min: Number.isFinite(min) ? min : null,
    max: Number.isFinite(max) ? max : null,
    sort: VALID_SORTS.has(elements.sort.value) ? elements.sort.value : DEFAULT_SORT
  };
}

function filterRecords(sourceRecords, filters) {
  return sourceRecords.filter((record) => {
    const grams = record.weight.grams;
    const weightMatches = (filters.min === null && filters.max === null) || (
      grams !== null &&
      (filters.min === null || grams >= filters.min) &&
      (filters.max === null || grams <= filters.max)
    );
    const catalogMatches = !filters.catalog || record.catalogId === filters.catalog;
    return catalogMatches && weightMatches && matchesSearch(record, filters.query);
  }).sort((a, b) => compareRecords(a, b, filters.sort));
}

function compareNullableText(a, b, field, direction = 1) {
  if (!a[field] && b[field]) return 1;
  if (a[field] && !b[field]) return -1;
  return direction * collator.compare(a[field] || "", b[field] || "");
}

function compareRecords(a, b, sort) {
  const descending = sort.endsWith("-desc") ? -1 : 1;
  let comparison = 0;

  if (sort.startsWith("designation")) comparison = compareNullableText(a, b, "designation", descending);
  if (sort.startsWith("name")) comparison = compareNullableText(a, b, "name", descending);
  if (sort.startsWith("weight")) {
    if (a.weight.grams === null && b.weight.grams !== null) return 1;
    if (a.weight.grams !== null && b.weight.grams === null) return -1;
    comparison = descending * ((a.weight.grams || 0) - (b.weight.grams || 0));
  }

  return comparison || compareNullableText(a, b, "designation") || a.order - b.order;
}

function render() {
  const matches = filterRecords(records, currentFilters());
  const visibleRecords = matches.slice(0, visibleLimit);
  const fragment = document.createDocumentFragment();
  visibleRecords.forEach((record) => fragment.append(createRecordCard(record)));
  elements.results.replaceChildren(fragment);
  elements.results.setAttribute("aria-busy", "false");
  elements.count.textContent = integerFormat.format(matches.length);
  elements.countUnit.textContent = matches.length === 1 ? "observation" : "observations";
  const observationLabel = matches.length === 1 ? "source observation" : "source observations";
  elements.status.textContent = matches.length > visibleRecords.length
    ? `Showing ${integerFormat.format(visibleRecords.length)} of ${integerFormat.format(matches.length)} matching ${observationLabel}.`
    : matches.length ? `Showing all ${integerFormat.format(matches.length)} matching ${observationLabel}.` : "No matching source observations.";
  elements.showMore.hidden = visibleRecords.length >= matches.length;
  elements.empty.hidden = matches.length !== 0;
  elements.error.hidden = true;
  elements.clear.hidden = !hasActiveFilters();
  updateUrl();
}

function createRecordCard(record) {
  const card = elements.template.content.firstElementChild.cloneNode(true);
  card.querySelector(".designation").textContent = record.designation || "Designation not recorded";
  card.querySelector(".record-name").textContent = record.name ? displayText(record.name) : "Name not recorded";
  card.querySelector(".record-weight strong").textContent = record.weight.grams === null
    ? "Not recorded"
    : formatMass(record.weight.grams);
  setMetaRow(card, ".classification-row", record.classification);
  setMetaRow(card, ".locality-row", record.locality);
  setMetaRow(card, ".year-row", record.year);
  const sourceLabel = record.catalogLabel || catalogLabel(catalogRegistry[record.catalogId], record.catalogId);
  card.querySelector(".catalog-reference").textContent = record.catalogPage === null
    ? `Source: ${sourceLabel} · page not recorded`
    : `Source: ${sourceLabel} · p. ${record.catalogPage}`;
  const confidence = card.querySelector(".confidence");
  if (record.confidence === "high") {
    confidence.remove();
  } else {
    confidence.classList.add(record.confidence);
    confidence.querySelector("span").textContent = `${capitalize(record.confidence)} transcription confidence`;
  }
  const folio = getAuthorizedFolio(folioManifest, record.catalogId, record.catalogPage, catalogRegistry);
  if (folio) {
    const button = document.createElement("button");
    button.className = "folio-button";
    button.type = "button";
    button.textContent = "View folio";
    button.setAttribute("aria-label", `View catalog folio for ${sourceLabel}, page ${record.catalogPage}`);
    button.addEventListener("click", () => openFolioDialog(record.catalogId, record.catalogPage, button));
    card.querySelector(".record-footer").append(button);
  }
  return card;
}

function setMetaRow(card, selector, value) {
  const row = card.querySelector(selector);
  row.querySelector("dd").textContent = value ? displayText(value) : "Not recorded";
  if (!value) row.classList.add("unknown");
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function displayText(value) {
  return String(value).replace(/(\p{L})-(?=\p{L})/gu, "$1\u2011");
}

function openFolioDialog(catalogId, catalogPage, opener) {
  activeFolioPages = getAuthorizedFolioPages(folioManifest, catalogId, catalogRegistry);
  activeFolioIndex = activeFolioPages.findIndex((folio) => folio.catalogPage === Number(catalogPage));
  if (activeFolioIndex < 0) return;
  folioOpener = opener;
  updateFolioDialog();
  elements.dialog.showModal();
}

function updateFolioDialog() {
  const folio = activeFolioPages[activeFolioIndex];
  if (!folio) return;
  const sourceLabel = catalogLabel(catalogRegistry[folio.catalogId], folio.catalogId);
  const safeLabel = `${sourceLabel}, page ${folio.catalogPage}`;
  elements.dialogCatalog.textContent = sourceLabel;
  elements.dialogTitle.textContent = `Catalog page ${folio.catalogPage}`;
  elements.dialogCaption.textContent = `Catalog folio: ${safeLabel}`;
  elements.dialogImageStatus.textContent = "Loading folio...";
  elements.dialogImage.hidden = false;
  elements.dialogImage.alt = folio.alt;
  elements.dialogImage.src = folio.image;
  elements.folioPosition.textContent = `Page ${folio.catalogPage} · ${activeFolioIndex + 1} of ${activeFolioPages.length}`;
  elements.previousFolio.disabled = activeFolioIndex === 0;
  elements.nextFolio.disabled = activeFolioIndex === activeFolioPages.length - 1;
}

function moveFolio(direction) {
  const nextIndex = activeFolioIndex + direction;
  if (nextIndex < 0 || nextIndex >= activeFolioPages.length) return;
  activeFolioIndex = nextIndex;
  updateFolioDialog();
}

function hasActiveFilters() {
  const filters = currentFilters();
  return Boolean(filters.query || filters.catalog || filters.min !== null || filters.max !== null || filters.sort !== DEFAULT_SORT);
}

function clearFilters() {
  elements.form.reset();
  elements.sort.value = DEFAULT_SORT;
  elements.min.setCustomValidity("");
  elements.max.setCustomValidity("");
  visibleLimit = PAGE_SIZE;
  render();
  elements.search.focus();
}

function validateWeights() {
  const filters = currentFilters();
  const invalidRange = filters.min !== null && filters.max !== null && filters.min > filters.max;
  elements.max.setCustomValidity(invalidRange ? "Maximum weight must be greater than or equal to minimum weight." : "");
  return elements.form.reportValidity();
}

function scheduleRender() {
  window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(() => {
    if (validateWeights()) {
      visibleLimit = PAGE_SIZE;
      render();
    }
  }, 120);
}

function updateUrl() {
  const params = serializeUrlFilters(currentFilters());
  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState(null, "", nextUrl);
}

function serializeUrlFilters(filters) {
  const params = new URLSearchParams();
  const { min, max } = normalizeWeightRange(filters.min, filters.max);
  if (filters.query) params.set("q", filters.query);
  if (filters.catalog) params.set("catalog", filters.catalog);
  if (min !== "") params.set("min", String(min));
  if (max !== "") params.set("max", String(max));
  if (VALID_SORTS.has(filters.sort) && filters.sort !== DEFAULT_SORT) params.set("sort", filters.sort);
  return params;
}

function parseUrlFilters(search, registry = {}) {
  const params = new URLSearchParams(search);
  const catalog = params.get("catalog") || "";
  const { min, max } = normalizeWeightRange(params.get("min"), params.get("max"));
  const sort = params.get("sort") || DEFAULT_SORT;
  return {
    query: params.get("q") || "",
    catalog: Object.hasOwn(registry, catalog) ? catalog : "",
    min,
    max,
    sort: VALID_SORTS.has(sort) ? sort : DEFAULT_SORT
  };
}

function applyUrlState() {
  const filters = parseUrlFilters(window.location.search, catalogRegistry);
  elements.search.value = filters.query;
  elements.catalog.value = filters.catalog;
  elements.min.value = filters.min;
  elements.max.value = filters.max;
  elements.sort.value = filters.sort;
}

function validUrlWeight(value) {
  if (value === null || value === "" || !Number.isFinite(Number(value)) || Number(value) < 0) return "";
  return value;
}

function normalizeWeightRange(minimum, maximum) {
  const min = validUrlWeight(minimum);
  const max = validUrlWeight(maximum);
  if (min !== "" && max !== "" && Number(min) > Number(max)) return { min: "", max: "" };
  return { min, max };
}

if (elements) {
  elements.dialogImage.addEventListener("load", () => {
    elements.dialogImageStatus.textContent = "";
  });
  elements.dialogImage.addEventListener("error", () => {
    elements.dialogImage.hidden = true;
    elements.dialogImageStatus.textContent = "The authorized folio image could not be loaded.";
  });
  elements.form.addEventListener("submit", (event) => event.preventDefault());
  elements.search.addEventListener("input", scheduleRender);
  elements.catalog.addEventListener("change", () => {
    if (validateWeights()) {
      visibleLimit = PAGE_SIZE;
      render();
    }
  });
  elements.min.addEventListener("input", scheduleRender);
  elements.max.addEventListener("input", scheduleRender);
  elements.sort.addEventListener("change", () => {
    if (validateWeights()) {
      visibleLimit = PAGE_SIZE;
      render();
    }
  });
  elements.clear.addEventListener("click", clearFilters);
  document.querySelector("[data-clear-filters]").addEventListener("click", clearFilters);
  elements.retry.addEventListener("click", loadData);
  elements.showMore.addEventListener("click", () => {
    visibleLimit += PAGE_SIZE;
    render();
  });
  elements.dialogClose.addEventListener("click", () => elements.dialog.close());
  elements.previousFolio.addEventListener("click", () => moveFolio(-1));
  elements.nextFolio.addEventListener("click", () => moveFolio(1));
  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) elements.dialog.close();
  });
  elements.dialog.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === "Escape") {
      event.preventDefault();
      elements.dialog.close();
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveFolio(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveFolio(1);
    }
  });
  elements.dialog.addEventListener("close", () => {
    elements.dialogImage.removeAttribute("src");
    elements.dialogImage.alt = "";
    elements.dialogImageStatus.textContent = "";
    activeFolioPages = [];
    activeFolioIndex = -1;
    if (folioOpener?.isConnected) folioOpener.focus();
    folioOpener = null;
  });
  window.addEventListener("popstate", () => {
    applyUrlState();
    visibleLimit = PAGE_SIZE;
    render();
  });
  loadData();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CACHE_VERSION,
    DEFAULT_SORT,
    calculateStatistics,
    catalogLabel,
    catalogSummaryEntries,
    compareRecords,
    designationComponents,
    filterRecords,
    formatMass,
    formatSourcePageCoverage,
    getAuthorizedFolio,
    getAuthorizedFolioPages,
    genericDesignation,
    hasMatchingFolioPolicy,
    isDesignationQuery,
    isSafeFolioPath,
    isValidFolioAlt,
    matchesSearch,
    normalizeWeightRange,
    normalizeFolioAlt,
    normalizeDesignation,
    normalizeCatalogRegistry,
    parseUrlFilters,
    parseSearchQuery,
    prepareRecord,
    searchable,
    serializeUrlFilters,
    validateCatalog,
    validateFolioManifest
  };
}
