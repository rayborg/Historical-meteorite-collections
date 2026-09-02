import { createHash } from "node:crypto";
import { lstat, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const FACTUAL_FORMULA_TOKENS = Object.freeze([
  "/Tii-vJatllO", "/-I", "/Nickel iron", "/?e/ermces", "(.\\l2O3)", "\\ 1.753",
  "D?i\\\\hvQQ", "\\i.", "\\N.", "\\N\\\\\\\\^m", "\\\\.", "\\iin.",
]);
const FACTUAL_FORMULA_UNSAFE_PREFIXES = Object.freeze(["C:", "file:", "https:", "ftp:", "scheme:"]);
const FACTUAL_FORMULA_VALID_SUFFIXES = Object.freeze(["", " factual", ",", ";", ".", "!", "?", "—", ".—", ", factual"]);
const FACTUAL_FORMULA_INVALID_SUFFIXES = Object.freeze([
  "/private", "\\private", ".private", ",/private", ",\\private", ";/private", ";\\private",
  "./private", ".\\private", " /private", " \\private", ",.private",
]);
const PATH_TOKEN_LEADING_CHAR = /[A-Za-z0-9._~\\/-]/u;
const TERMINAL_PUNCTUATION = /\p{P}/u;
const STRICT_PATH_LIKE_STRING =
  /[A-Za-z][A-Za-z\d+.-]*:\/\/|(?:^|[^A-Za-z0-9._~-])(?:(?:[\\/]{2}(?=\S)|[\\/](?![\\/])(?=\S))|\.{1,2}[\\/](?=\S)|~[\\/]|[A-Za-z]:[\\/]|(?:assets?|files?|folios?|images?|scans?|source[\s_-]*images?)[\\/])/iu;

function hasFormulaLeadingBoundary(value, index) {
  return index === 0 || (value[index - 1] !== ":" && !PATH_TOKEN_LEADING_CHAR.test(value[index - 1]));
}

function hasFormulaTrailingBoundary(value, index) {
  if (index === value.length || /\s/u.test(value[index])) return true;
  if (!TERMINAL_PUNCTUATION.test(value[index])) return false;
  let cursor = index;
  while (cursor < value.length && TERMINAL_PUNCTUATION.test(value[cursor])) {
    if (value[cursor] === "/" || value[cursor] === "\\") return false;
    cursor += 1;
  }
  return cursor === value.length || /\s/u.test(value[cursor]);
}

function containsUnsafePath(value) {
  const intervals = [];
  for (const token of FACTUAL_FORMULA_TOKENS) {
    let index = -1;
    while ((index = value.indexOf(token, index + 1)) !== -1) {
      if (!hasFormulaLeadingBoundary(value, index)) {
        if (value[index - 1] === ":") return true;
        continue;
      }
      const end = index + token.length;
      if (!hasFormulaTrailingBoundary(value, end)) return true;
      intervals.push([index, end]);
    }
  }
  intervals.sort(([left], [right]) => left - right);
  let cursor = 0;
  let masked = "";
  for (const [start, end] of intervals) {
    if (start < cursor) continue;
    masked += value.slice(cursor, start) + " ".repeat(end - start);
    cursor = end;
  }
  return STRICT_PATH_LIKE_STRING.test(masked + value.slice(cursor));
}

const CATALOG_URL = new URL("../data/catalog.json", import.meta.url);
const FOLIOS_URL = new URL("../data/folios.json", import.meta.url);
const FIXTURE_URL = new URL("./test-multicatalog-fixture.json", import.meta.url);
const RELEASE_LOCK_URL = new URL("./folio-release-lock.json", import.meta.url);
const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const SYNTHETIC_ONLY = process.argv.includes("--synthetic-only");
const SPECIMEN_KEYS = [
  "id", "catalogId", "designation", "name", "weight", "classification", "locality", "year", "catalogPage", "confidence",
];
const CATALOG_ITEM_KEYS = [
  "id", "catalogId", "catalogItem", "holdings", "name", "classification", "locality", "year", "catalogPage", "confidence",
];
const CATALOG_NUMBER_KEYS = [
  "id", "catalogId", "catalogNumber", "holdings", "name", "classification", "locality", "dateOfDiscovery", "catalogPages", "confidence",
];
const COLLECTION_ENTRY_KEYS = [
  "id", "catalogId", "entryOrder", "reportedNumber", "catalogPages", "section", "holdings", "name", "classification", "locality",
  "eventDate", "confidence",
];
const REGIONAL_CENSUS_FACT_KEYS = [
  "id", "catalogId", "entryOrder", "reportedNumber", "section", "name", "classification", "eventDate",
  "australianMuseumRepresentation", "catalogPages", "confidence",
];
const TABLE_A_SPECIMEN_KEYS = [
  "id", "catalogId", "entryOrder", "specimenId", "weight", "classification", "olivineFa", "pyroxeneFs",
  "weathering", "locality", "catalogPage", "confidence",
];
const DEALER_OFFER_FACT_KEYS = [
  "id", "catalogId", "typeNumber", "name", "description", "catalogPage", "confidence",
];
const HAMBURG_COLLECTION_ENTRY_KEYS = [
  ...COLLECTION_ENTRY_KEYS, "reportedTotalWeight", "publicationState", "amendments",
];
const METBULL_KEYS = ["matchType", "canonicalName", "meteoriteCode", "metbullUrl", "alternateNameNote"];
const METBULL_MATCH_TYPES = [
  "exact", "case-normalized-exact", "source-heading-exact", "historical-alias", "corrected-spelling",
  "translated-or-older-name", "unresolved",
];
const HOLDING_KEYS = ["designation", "kind", "description", "count", "weight"];
const CATALOG_NUMBER_HOLDING_KEYS = ["description", "provenance", "count", "weights"];
const HAMBURG_HOLDING_KEYS = [
  "description", "provenance", "count", "weights", "reportedTotalWeight", "representations",
];
const HOLDING_KINDS = ["specimen", "cast", "aggregate"];
const RECORD_MODELS = [
  "catalog-item", "specimen", "catalog-number", "collection-entry", "regional-census-fact", "table-a-specimen",
  "dealer-offer-fact",
];
const FACTUAL_FIELDS = [
  "id",
  "catalogId",
  "designation",
  "name",
  "weight.grams",
  "catalogItem",
  "catalogNumber",
  "entryOrder",
  "reportedNumber",
  "specimenId",
  "typeNumber",
  "description",
  "australianMuseumRepresentation.status",
  "australianMuseumRepresentation.representedOccurrences",
  "australianMuseumRepresentation.notRepresentedOccurrences",
  "holdings[].designation",
  "holdings[].kind",
  "holdings[].description",
  "holdings[].provenance",
  "holdings[].count",
  "holdings[].weight.grams",
  "holdings[].weights[].grams",
  "holdings[].weights[].kind",
  "holdings[].reportedTotalWeight.grams",
  "holdings[].representations[].kind",
  "holdings[].representations[].count",
  "reportedTotalWeight.grams",
  "publicationState",
  "amendments[]",
  "classification",
  "locality",
  "individualFindLocation",
  "year",
  "dateOfDiscovery",
  "eventDate",
  "olivineFa",
  "pyroxeneFs",
  "weathering",
  "locality.code",
  "locality.name",
  "locality.coordinate",
  "catalogPage",
  "catalogPages[]",
  "section",
  "confidence",
  "metbull.matchType",
  "metbull.canonicalName",
  "metbull.meteoriteCode",
  "metbull.metbullUrl",
  "metbull.alternateNameNote",
];
const METADATA_KEYS = [
  "schemaVersion", "scope", "factualFields", "catalogs", "recordCount", "recordsWithDesignation",
  "recordsWithWeight", "confidenceCounts",
];
const DESCRIPTOR_KEYS = [
  "id", "recordModel", "label", "compiler", "year", "sourcePages", "sourcePageCount", "recordCount",
  "recordsWithDesignation", "recordsWithWeight", "confidenceCounts", "folioDisplayPolicy", "rightsStatus",
];
const CONFIDENCE_LEVELS = ["high", "medium", "low"];
const DISPLAY_POLICIES = ["blocked", "display"];
const RIGHTS_STATUSES = ["undetermined", "public-domain", "no-copyright-us"];
const DISPLAY_RIGHTS_STATUSES = ["public-domain", "no-copyright-us"];
const PAGE_ENTRY_KEYS = ["pageId", "catalogPage", "pageLabel", "image", "alt"];
const MAX_ALT_LENGTH = 160;
const MAX_CATALOG_ID_LENGTH = 80;
const MAX_CATALOG_TEXT_LENGTH = 160;
const FOLIO_PATH_ROOT = "assets/folios/";
const PRIVATE_LANGUAGE =
  /\b(?:raw[\s_-]*(?:ocr|text|transcript(?:ion)?)|ocr[\s_-]*(?:batch|output|text)|source[\s_-]*(?:image|file)(?:[\s_-]*name)?s?|scan(?:ned)?[\s_-]*(?:image|file|path|name)s?|(?:private|research|transcription|verbatim|working)[\s_-]*notes?|(?:private|working)[\s_-]*(?:text|transcript(?:ion)?)|image[\s_-]*derivatives?)\b/iu;
const PRIVATE_LABEL =
  /^(?:notes?|verbatim\s+notes?|ocr|ocr\s+text|raw\s*(?:ocr|text)|source\s*(?:images?|files?|filenames?)|scans?|images?|paths?|weight(?:\s+|\.)display)$/iu;
const IMAGE_LIKE_STRING =
  /\.(?:arw|avif|bmp|cr2|cr3|csv|dat|dng|docx?|gif|heic|heif|hocr|jpe?g|jsonl?|log|md|nef|ocr|orf|pdf|pef|png|raf|rtf|rw2|srw|svg|text|tiff?|tsv|txt|webp|xml|ya?ml)(?=$|[^A-Za-z0-9])|\b(?:dscn?|img|pxl)[_-]?\d{3,}\b/iu;
const OCR_BATCH_OR_CAMERA_TIMESTAMP =
  /\b(?:ocr[\s_-]*)?batch[\s_-]*\d{1,5}(?:\.[A-Za-z0-9]{2,5})?\b|\b(?:19|20)\d{6}[_-]\d{6}(?:[_-]\d+)?(?:\.[A-Za-z0-9]{2,5})?\b/iu;
const HOLDING_PRIVATE_LANGUAGE =
  /\bocr\b|\b(?:review(?:er)?|research|transcript(?:ion)?|verbatim|working|private)[\s_-]+notes?\b|\bpage[\s_-]*(?:id|identifier)\b|\bpage[_-]\d+\b|\b(?:private[\s_-]*source|source[\s_-]*page)\b/iu;
const HOLDING_PRIVATE_DOCUMENT =
  /(?:^|[\s"'(])(?:source|private|data)[\\/][^\s"')]+|\.(?:dat|csv|docx?|json|md|odt|rtf|txt|xlsx?|xml)(?=$|[^A-Za-z0-9])/iu;
const HOLDING_WEIGHT_DISPLAY = /\b\d[\d,.]*\s+(?:g|grs?|grams?|kg|kgs?|kilograms?)\.?(?![A-Za-z0-9])/iu;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(value, expected, path) {
  assert(isObject(value), `${path} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  assert(
    actual.length === wanted.length && actual.every((key, index) => key === wanted[index]),
    `${path} keys must be exactly: ${expected.join(", ")}`,
  );
}

function assertAllowedKeys(value, allowed, required, path) {
  assert(isObject(value), `${path} must be an object`);
  const actual = Object.keys(value);
  assert(actual.every((key) => allowed.includes(key)), `${path} may contain only: ${allowed.join(", ")}`);
  assert(required.every((key) => actual.includes(key)), `${path} must contain: ${required.join(", ")}`);
}

function assertExactSet(actual, expected, path) {
  const actualValues = [...actual].sort();
  const expectedValues = [...expected].sort();
  assert(
    actualValues.length === expectedValues.length && actualValues.every((value, index) => value === expectedValues[index]),
    `${path} must match exactly (actual: ${actualValues.join(", ")}; expected: ${expectedValues.join(", ")})`,
  );
}

function normalizeString(value) {
  return value.normalize("NFC").replace(/\s+/gu, " ").trim();
}

function assertString(value, path, nullable = false) {
  if (nullable && value === null) return;
  assert(typeof value === "string" && value.length > 0, `${path} must be a nonempty string${nullable ? " or null" : ""}`);
  assert(value === normalizeString(value), `${path} is not NFC/whitespace normalized`);
}

function assertCatalogId(value, path) {
  assert(
    typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value) && value.length <= MAX_CATALOG_ID_LENGTH,
    `${path} must be a lowercase catalog slug of at most ${MAX_CATALOG_ID_LENGTH} characters`,
  );
}

function assertCatalogText(value, path) {
  assertString(value, path);
  assert(value.length <= MAX_CATALOG_TEXT_LENGTH, `${path} must be at most ${MAX_CATALOG_TEXT_LENGTH} characters`);
}

function assertHoldingText(value, path, allowWeightDisplay = false) {
  if (value === null) return;
  assert(!HOLDING_PRIVATE_LANGUAGE.test(value), `${path} contains private holding language`);
  assert(!HOLDING_PRIVATE_DOCUMENT.test(value), `${path} contains a private path or document extension`);
  assert(allowWeightDisplay || !HOLDING_WEIGHT_DISPLAY.test(value), `${path} contains a private weight-display string`);
}

function rejectCatalogExcludedContent(value, path = "catalog") {
  if (typeof value === "string") {
    assert(value === normalizeString(value), `${path} is not NFC/whitespace normalized`);
    assert(!/[\p{Cc}\p{Cf}]/u.test(value), `${path} contains a control or format character`);
    assert(!PRIVATE_LABEL.test(value), `${path} contains a private-source label`);
    assert(!PRIVATE_LANGUAGE.test(value), `${path} contains private-source language`);
    assert(!IMAGE_LIKE_STRING.test(value), `${path} contains an image-like or source-document filename`);
    assert(!OCR_BATCH_OR_CAMERA_TIMESTAMP.test(value), `${path} contains an OCR batch or camera timestamp filename`);
    assert(!containsUnsafePath(value), `${path} contains a file path`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectCatalogExcludedContent(item, `${path}[${index}]`));
    return;
  }
  if (!isObject(value)) return;
  Object.entries(value).forEach(([key, child]) => {
    if (key !== "metbullUrl") rejectCatalogExcludedContent(child, `${path}.${key}`);
  });
}

function metbullUrlForCode(code) {
  return `https://www.lpi.usra.edu/meteor/metbull.cfm?code=${code}`;
}

function differsOnlyByCase(sourceName, canonicalName) {
  return typeof sourceName === "string" && typeof canonicalName === "string" && sourceName !== canonicalName &&
    sourceName.toLocaleLowerCase("en-US") === canonicalName.toLocaleLowerCase("en-US");
}

function validateMetbull(value, sourceName, path) {
  assertExactKeys(value, METBULL_KEYS, path);
  assert(METBULL_MATCH_TYPES.includes(value.matchType), `${path}.matchType is invalid`);
  assertString(value.alternateNameNote, `${path}.alternateNameNote`, true);
  if (value.alternateNameNote !== null) {
    assert(value.alternateNameNote.length <= 500, `${path}.alternateNameNote must be at most 500 characters`);
  }
  if (value.matchType === "unresolved") {
    assert(value.canonicalName === null && value.meteoriteCode === null && value.metbullUrl === null,
      `${path} unresolved mapping cannot claim a canonical identity`);
    return;
  }
  assertString(value.canonicalName, `${path}.canonicalName`);
  assert(value.canonicalName.length <= 200, `${path}.canonicalName must be at most 200 characters`);
  assert(typeof value.meteoriteCode === "string" && /^[1-9][0-9]{0,9}$/u.test(value.meteoriteCode),
    `${path}.meteoriteCode must be a positive decimal MetBull code string`);
  assert(value.metbullUrl === metbullUrlForCode(value.meteoriteCode),
    `${path}.metbullUrl must be the canonical HTTPS URL for meteoriteCode`);
  if (value.matchType === "case-normalized-exact") {
    assert(differsOnlyByCase(sourceName, value.canonicalName),
      `${path}.matchType requires names that differ only by case`);
  } else {
    assert(value.matchType === "exact" ? sourceName === value.canonicalName : sourceName !== value.canonicalName,
      `${path}.matchType does not agree with the source and canonical names`);
  }
}

function assertCountSummary(value, path) {
  assert(Number.isInteger(value.recordCount) && value.recordCount > 0, `${path}.recordCount must be positive`);
  for (const field of ["recordsWithDesignation", "recordsWithWeight"]) {
    assert(
      Number.isInteger(value[field]) && value[field] >= 0 && value[field] <= value.recordCount,
      `${path}.${field} must be an integer from 0 through recordCount`,
    );
  }
  assertExactKeys(value.confidenceCounts, CONFIDENCE_LEVELS, `${path}.confidenceCounts`);
  for (const level of CONFIDENCE_LEVELS) {
    assert(Number.isInteger(value.confidenceCounts[level]) && value.confidenceCounts[level] >= 0,
      `${path}.confidenceCounts.${level} must be a nonnegative integer`);
  }
  assert(
    CONFIDENCE_LEVELS.reduce((sum, level) => sum + value.confidenceCounts[level], 0) === value.recordCount,
    `${path}.confidenceCounts must sum to recordCount`,
  );
}

function validateMetadata(metadata, path) {
  assertExactKeys(metadata, METADATA_KEYS, path);
  assert(metadata.schemaVersion === 10, `${path}.schemaVersion must be 10`);
  assert(metadata.scope === "facts-only", `${path}.scope must be facts-only`);
  assert(
    Array.isArray(metadata.factualFields) && metadata.factualFields.length === FACTUAL_FIELDS.length &&
      metadata.factualFields.every((field, index) => field === FACTUAL_FIELDS[index]),
    `${path}.factualFields does not match the schema 10 public record models`,
  );
  assertCountSummary(metadata, path);
  assert(Array.isArray(metadata.catalogs) && metadata.catalogs.length > 0, `${path}.catalogs must be a nonempty array`);

  const metadataByCatalog = new Map();
  metadata.catalogs.forEach((descriptor, index) => {
    const descriptorPath = `${path}.catalogs[${index}]`;
    assertExactKeys(descriptor, DESCRIPTOR_KEYS, descriptorPath);
    assertCatalogId(descriptor.id, `${descriptorPath}.id`);
    assert(!metadataByCatalog.has(descriptor.id), `${descriptorPath}.id is duplicated: ${descriptor.id}`);
    assert(RECORD_MODELS.includes(descriptor.recordModel), `${descriptorPath}.recordModel is invalid`);
    assertCatalogText(descriptor.label, `${descriptorPath}.label`);
    assertCatalogText(descriptor.compiler, `${descriptorPath}.compiler`);
    assert(Number.isInteger(descriptor.year) && descriptor.year > 0, `${descriptorPath}.year must be a positive integer`);
    assert(Array.isArray(descriptor.sourcePages) && descriptor.sourcePages.length > 0, `${descriptorPath}.sourcePages must be nonempty`);
    descriptor.sourcePages.forEach((page, pageIndex) => {
      assert(Number.isInteger(page) && page > 0, `${descriptorPath}.sourcePages[${pageIndex}] must be positive`);
      if (pageIndex) assert(page > descriptor.sourcePages[pageIndex - 1], `${descriptorPath}.sourcePages must be sorted and unique`);
    });
    assert(descriptor.sourcePageCount === descriptor.sourcePages.length,
      `${descriptorPath}.sourcePageCount must equal sourcePages.length`);
    assertCountSummary(descriptor, descriptorPath);
    assert(DISPLAY_POLICIES.includes(descriptor.folioDisplayPolicy), `${descriptorPath}.folioDisplayPolicy is invalid`);
    assert(RIGHTS_STATUSES.includes(descriptor.rightsStatus), `${descriptorPath}.rightsStatus is invalid`);
    assert(descriptor.folioDisplayPolicy === "display"
      ? DISPLAY_RIGHTS_STATUSES.includes(descriptor.rightsStatus)
      : descriptor.rightsStatus === "undetermined",
    `${descriptorPath} must use an authorized display right or blocked/undetermined`);
    metadataByCatalog.set(descriptor.id, {
      descriptor,
      path: descriptorPath,
      sourcePages: new Set(descriptor.sourcePages),
    });
  });

  for (const field of ["recordCount", "recordsWithDesignation", "recordsWithWeight"]) {
    assert(metadata[field] === metadata.catalogs.reduce((sum, descriptor) => sum + descriptor[field], 0),
      `${path}.${field} must equal the catalog total`);
  }
  for (const level of CONFIDENCE_LEVELS) {
    assert(metadata.confidenceCounts[level] === metadata.catalogs.reduce(
      (sum, descriptor) => sum + descriptor.confidenceCounts[level], 0,
    ), `${path}.confidenceCounts.${level} must equal the catalog total`);
  }
  return metadataByCatalog;
}

function recordDesignations(record, recordModel) {
  if (recordModel === "specimen") return record.designation === null ? [] : [record.designation];
  if (recordModel === "table-a-specimen") return [record.specimenId];
  if (["catalog-number", "collection-entry", "regional-census-fact", "dealer-offer-fact"].includes(recordModel)) return [];
  return record.holdings.map((holding) => holding.designation).filter((value) => value !== null);
}

function recordMasses(record, recordModel) {
  if (recordModel === "specimen" || recordModel === "table-a-specimen") {
    return record.weight.grams === null ? [] : [record.weight.grams];
  }
  if (["regional-census-fact", "dealer-offer-fact"].includes(recordModel)) return [];
  if (recordModel === "catalog-number" || recordModel === "collection-entry") {
    return record.holdings.flatMap((holding) => holding.weights.map(({ grams }) => grams));
  }
  return record.holdings.map((holding) => holding.weight.grams).filter((value) => value !== null);
}

function compareText(left, right) {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left < right ? -1 : 1;
}

function designationParts(value) {
  if (value === null) return null;
  const prefix = value.match(/^[A-Za-z]*/u)?.[0] ?? "";
  const numbers = value.match(/\d+/gu)?.map(Number);
  assert(numbers?.length, `designation cannot be structurally sorted: ${value}`);
  return { prefix, numbers };
}

function compareDesignation(left, right) {
  const leftParts = designationParts(left);
  const rightParts = designationParts(right);
  if (leftParts === null || rightParts === null) {
    if (leftParts === rightParts) return 0;
    return leftParts === null ? 1 : -1;
  }
  const prefixOrder = compareText(leftParts.prefix, rightParts.prefix);
  if (prefixOrder) return prefixOrder;
  const length = Math.min(leftParts.numbers.length, rightParts.numbers.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftParts.numbers[index] - rightParts.numbers[index];
    if (difference) return difference;
  }
  return leftParts.numbers.length - rightParts.numbers.length;
}

function compareNullableNumber(left, right) {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}

function compareRecords(left, right, metadataByCatalog) {
  const leftModel = metadataByCatalog.get(left.catalogId).descriptor.recordModel;
  const rightModel = metadataByCatalog.get(right.catalogId).descriptor.recordModel;
  const modelOrder = modelSortOrder(leftModel) - modelSortOrder(rightModel);
  if (modelOrder) return modelOrder;
  if (leftModel === "catalog-item") {
    return left.catalogItem - right.catalogItem || compareText(left.name, right.name) || compareText(left.id, right.id);
  }
  if (leftModel === "catalog-number") {
    return left.catalogPages[0] - right.catalogPages[0] || compareText(left.catalogNumber, right.catalogNumber) ||
      compareText(left.name, right.name) || compareText(left.id, right.id);
  }
  if (["collection-entry", "regional-census-fact", "table-a-specimen"].includes(leftModel)) {
    return compareText(left.catalogId, right.catalogId) || left.entryOrder - right.entryOrder || compareText(left.id, right.id);
  }
  if (leftModel === "dealer-offer-fact") {
    return compareText(left.catalogId, right.catalogId) || left.typeNumber - right.typeNumber || compareText(left.id, right.id);
  }
  const identityOrder = compareDesignation(left.designation, right.designation);
  const leftMasses = recordMasses(left, leftModel);
  const rightMasses = recordMasses(right, rightModel);
  return identityOrder || compareText(left.name, right.name) ||
    compareNullableNumber(leftMasses.length ? Math.min(...leftMasses) : null, rightMasses.length ? Math.min(...rightMasses) : null) ||
    compareText(left.id, right.id);
}

function modelSortOrder(recordModel) {
  if (recordModel === "catalog-item") return 0;
  if (recordModel === "specimen") return 1;
  if (recordModel === "catalog-number") return 2;
  if (recordModel === "dealer-offer-fact") return 4;
  return 3;
}

function validateAustralianMuseumRepresentation(value, path) {
  assertExactKeys(value, ["status", "representedOccurrences", "notRepresentedOccurrences"], path);
  assert(["represented", "not-represented", "mixed"].includes(value.status), `${path}.status is invalid`);
  for (const field of ["representedOccurrences", "notRepresentedOccurrences"]) {
    assert(Number.isInteger(value[field]) && value[field] >= 0, `${path}.${field} must be a nonnegative integer`);
  }
  assert(value.representedOccurrences + value.notRepresentedOccurrences > 0,
    `${path} must report at least one occurrence`);
  assert(value.status === (value.representedOccurrences === 0
    ? "not-represented"
    : value.notRepresentedOccurrences === 0 ? "represented" : "mixed"),
  `${path}.status does not match its occurrence counts`);
}

function validateTableALocality(value, path) {
  assertExactKeys(value, ["code", "name", "coordinate"], path);
  assert(typeof value.code === "string" && /^[A-Z]{3}$/u.test(value.code), `${path}.code must be a three-letter code`);
  assertString(value.name, `${path}.name`);
  assertString(value.coordinate, `${path}.coordinate`, true);
}

function validateHolding(holding, path) {
  assertExactKeys(holding, HOLDING_KEYS, path);
  assertString(holding.designation, `${path}.designation`, true);
  assertHoldingText(holding.designation, `${path}.designation`);
  assert(HOLDING_KINDS.includes(holding.kind), `${path}.kind is invalid`);
  assertString(holding.description, `${path}.description`, true);
  assertHoldingText(holding.description, `${path}.description`);
  assert(holding.count === null || (Number.isInteger(holding.count) && holding.count > 0),
    `${path}.count must be a positive integer or null`);
  assertExactKeys(holding.weight, ["grams"], `${path}.weight`);
  assert(holding.weight.grams === null || (Number.isFinite(holding.weight.grams) && holding.weight.grams >= 0),
    `${path}.weight.grams must be a finite nonnegative number or null`);
  if (holding.kind === "specimen") {
    assert(holding.designation !== null, `${path}.designation must be nonnull for specimen holdings`);
    assert(holding.count === null, `${path}.count must be null for specimen holdings`);
    assert(holding.weight.grams !== null, `${path}.weight.grams must be nonnull for specimen holdings`);
  } else if (holding.kind === "cast") {
    assert(holding.designation !== null, `${path}.designation must be nonnull for cast holdings`);
    assert(holding.count === null, `${path}.count must be null for cast holdings`);
    assert(holding.weight.grams === null, `${path}.weight.grams must be null for cast holdings`);
  } else {
    assert(holding.description !== null, `${path}.description must be nonnull for aggregate holdings`);
    assert(holding.count !== null || holding.weight.grams !== null,
      `${path} aggregate must have a count or weight.grams`);
  }
}

function validateCatalogNumberHolding(holding, path, allowEmptyWeights = false) {
  assertExactKeys(holding, CATALOG_NUMBER_HOLDING_KEYS, path);
  assertString(holding.description, `${path}.description`);
  assertHoldingText(holding.description, `${path}.description`, true);
  assertString(holding.provenance, `${path}.provenance`, true);
  assertHoldingText(holding.provenance, `${path}.provenance`, true);
  assert(holding.count === null || (Number.isInteger(holding.count) && holding.count > 0),
    `${path}.count must be a positive integer or null`);
  assert(Array.isArray(holding.weights) && (allowEmptyWeights || holding.weights.length > 0),
    `${path}.weights must be ${allowEmptyWeights ? "an ordered" : "a nonempty ordered"} array`);
  holding.weights.forEach((weight, weightIndex) => {
    const weightPath = `${path}.weights[${weightIndex}]`;
    assertExactKeys(weight, ["grams"], weightPath);
    assert(Number.isFinite(weight.grams) && weight.grams >= 0, `${weightPath}.grams must be a finite nonnegative number`);
  });
}

function validateHamburgHolding(holding, path) {
  assertExactKeys(holding, HAMBURG_HOLDING_KEYS, path);
  assertString(holding.description, `${path}.description`);
  assertHoldingText(holding.description, `${path}.description`, true);
  assert(holding.provenance === null, `${path}.provenance must be null`);
  assert(holding.count === null || (Number.isInteger(holding.count) && holding.count > 0),
    `${path}.count must be a positive integer or null`);
  assert(Array.isArray(holding.weights), `${path}.weights must be an ordered array`);
  holding.weights.forEach((weight, weightIndex) => {
    const weightPath = `${path}.weights[${weightIndex}]`;
    assertExactKeys(weight, ["grams", "kind"], weightPath);
    assert(Number.isFinite(weight.grams) && weight.grams >= 0, `${weightPath}.grams must be finite and nonnegative`);
    assert(["individual-holding", "aggregate-holding", "associated-material"].includes(weight.kind),
      `${weightPath}.kind is invalid`);
  });
  if (holding.reportedTotalWeight !== null) {
    assertExactKeys(holding.reportedTotalWeight, ["grams"], `${path}.reportedTotalWeight`);
    assert(Number.isFinite(holding.reportedTotalWeight.grams) && holding.reportedTotalWeight.grams >= 0,
      `${path}.reportedTotalWeight.grams must be finite and nonnegative`);
  }
  assert(Array.isArray(holding.representations), `${path}.representations must be an array`);
  holding.representations.forEach((representation, representationIndex) => {
    const representationPath = `${path}.representations[${representationIndex}]`;
    assertExactKeys(representation, ["kind", "count"], representationPath);
    assert(representation.kind === "thin-section" && Number.isInteger(representation.count) && representation.count > 0,
      `${representationPath} must be a counted thin section`);
  });
}

function validatePublicCatalog(data, folios, path = "catalog") {
  rejectCatalogExcludedContent(data, path);
  assertExactKeys(data, ["metadata", "records"], path);
  const metadataByCatalog = validateMetadata(data.metadata, `${path}.metadata`);
  assert(Array.isArray(data.records) && data.records.length > 0, `${path}.records must be a nonempty array`);
  const folioStats = validateFolioManifest(folios, `${path} folios`);
  const ids = new Set();
  const catalogItemNumbers = new Map();
  const previousCatalogItems = new Map();
  const catalogNumbers = new Map();
  const dealerTypeNumbers = new Map();
  const specimenIds = new Map();
  const collectionEntryOrders = new Map();
  const previousCollectionEntries = new Map();
  const representedCatalogs = new Set();
  let individualFindLocationCount = 0;
  const statsByCatalog = new Map([...metadataByCatalog].map(([catalogId]) => [catalogId, {
    recordCount: 0,
    recordsWithDesignation: 0,
    recordsWithWeight: 0,
    confidenceCounts: { high: 0, medium: 0, low: 0 },
  }]));

  data.records.forEach((record, index) => {
    const recordPath = `${path}.records[${index}]`;
    assert(isObject(record), `${recordPath} must be an object`);
    assertCatalogId(record.catalogId, `${recordPath}.catalogId`);
    const catalog = metadataByCatalog.get(record.catalogId);
    assert(catalog, `${recordPath}.catalogId has no descriptor`);
    const { recordModel } = catalog.descriptor;
    const expectedRecordKeys = [...(recordModel === "specimen"
      ? SPECIMEN_KEYS
      : recordModel === "catalog-item"
        ? CATALOG_ITEM_KEYS
        : recordModel === "catalog-number" ? CATALOG_NUMBER_KEYS
          : recordModel === "regional-census-fact" ? REGIONAL_CENSUS_FACT_KEYS
            : recordModel === "table-a-specimen" ? TABLE_A_SPECIMEN_KEYS
              : recordModel === "dealer-offer-fact" ? DEALER_OFFER_FACT_KEYS
              : record.catalogId === "hamburg-1913" ? HAMBURG_COLLECTION_ENTRY_KEYS : COLLECTION_ENTRY_KEYS)];
    if (recordModel === "specimen" && Object.hasOwn(record, "individualFindLocation")) {
      expectedRecordKeys.splice(expectedRecordKeys.indexOf("year"), 0, "individualFindLocation");
    }
    if (Object.hasOwn(record, "metbull")) expectedRecordKeys.push("metbull");
    assertExactKeys(record, expectedRecordKeys, recordPath);
    assertString(record.id, `${recordPath}.id`);
    assert(!ids.has(record.id), `${recordPath}.id is duplicated: ${record.id}`);
    ids.add(record.id);
    representedCatalogs.add(record.catalogId);
    if (!["table-a-specimen", "dealer-offer-fact"].includes(recordModel)) {
      const dateField = recordModel === "catalog-number" ? "dateOfDiscovery" :
        ["collection-entry", "regional-census-fact"].includes(recordModel) ? "eventDate" : "year";
      for (const field of ["name", "classification", "locality", dateField]) {
        if (field !== "locality" || recordModel !== "regional-census-fact") {
          assertString(record[field], `${recordPath}.${field}`, true);
        }
      }
    }
    if (Object.hasOwn(record, "metbull")) validateMetbull(record.metbull, record.name, `${recordPath}.metbull`);
    if (recordModel === "specimen") {
      assertString(record.designation, `${recordPath}.designation`, true);
      assertExactKeys(record.weight, ["grams"], `${recordPath}.weight`);
      assert(record.weight.grams === null || (Number.isFinite(record.weight.grams) && record.weight.grams >= 0),
        `${recordPath}.weight.grams must be a finite nonnegative number or null`);
      assert(record.designation !== null || record.name !== null || record.weight.grams !== null ||
        record.classification !== null || record.locality !== null || record.year !== null,
      `${recordPath} must contain a substantive public fact`);
      if (Object.hasOwn(record, "individualFindLocation")) {
        assertString(record.individualFindLocation, `${recordPath}.individualFindLocation`);
        assert(record.individualFindLocation.length <= 200,
          `${recordPath}.individualFindLocation must be at most 200 characters`);
        individualFindLocationCount += 1;
      }
    } else if (recordModel === "catalog-item") {
      assert(Number.isInteger(record.catalogItem) && record.catalogItem > 0,
        `${recordPath}.catalogItem must be a positive integer`);
      const itemNumbers = catalogItemNumbers.get(record.catalogId) ?? new Set();
      assert(!itemNumbers.has(record.catalogItem),
        `${recordPath}.catalogItem is duplicated within ${record.catalogId}: ${record.catalogItem}`);
      const previousCatalogItem = previousCatalogItems.get(record.catalogId);
      assert(previousCatalogItem === undefined || record.catalogItem > previousCatalogItem,
        `${recordPath}.catalogItem must increase within ${record.catalogId}`);
      itemNumbers.add(record.catalogItem);
      catalogItemNumbers.set(record.catalogId, itemNumbers);
      previousCatalogItems.set(record.catalogId, record.catalogItem);
      assert(Array.isArray(record.holdings) && record.holdings.length > 0, `${recordPath}.holdings must be nonempty`);
      record.holdings.forEach((holding, holdingIndex) => validateHolding(holding, `${recordPath}.holdings[${holdingIndex}]`));
    } else if (recordModel === "catalog-number") {
      assertString(record.catalogNumber, `${recordPath}.catalogNumber`);
      const numbers = catalogNumbers.get(record.catalogId) ?? new Set();
      assert(!numbers.has(record.catalogNumber),
        `${recordPath}.catalogNumber is duplicated within ${record.catalogId}: ${record.catalogNumber}`);
      numbers.add(record.catalogNumber);
      catalogNumbers.set(record.catalogId, numbers);
      assert(Array.isArray(record.holdings) && record.holdings.length > 0, `${recordPath}.holdings must be nonempty`);
      record.holdings.forEach((holding, holdingIndex) =>
        validateCatalogNumberHolding(holding, `${recordPath}.holdings[${holdingIndex}]`));
    } else if (recordModel === "regional-census-fact") {
      assert(Number.isInteger(record.entryOrder) && record.entryOrder > 0,
        `${recordPath}.entryOrder must be a positive integer`);
      const entryOrders = collectionEntryOrders.get(record.catalogId) ?? new Set();
      assert(!entryOrders.has(record.entryOrder), `${recordPath}.entryOrder is duplicated within ${record.catalogId}`);
      entryOrders.add(record.entryOrder);
      collectionEntryOrders.set(record.catalogId, entryOrders);
      assertString(record.reportedNumber, `${recordPath}.reportedNumber`, true);
      assertString(record.section, `${recordPath}.section`);
      assertString(record.name, `${recordPath}.name`);
      assertString(record.classification, `${recordPath}.classification`, true);
      assertString(record.eventDate, `${recordPath}.eventDate`, true);
      validateAustralianMuseumRepresentation(record.australianMuseumRepresentation,
        `${recordPath}.australianMuseumRepresentation`);
    } else if (recordModel === "table-a-specimen") {
      assert(Number.isInteger(record.entryOrder) && record.entryOrder > 0,
        `${recordPath}.entryOrder must be a positive integer`);
      const entryOrders = collectionEntryOrders.get(record.catalogId) ?? new Set();
      assert(!entryOrders.has(record.entryOrder), `${recordPath}.entryOrder is duplicated within ${record.catalogId}`);
      entryOrders.add(record.entryOrder);
      collectionEntryOrders.set(record.catalogId, entryOrders);
      assert(typeof record.specimenId === "string" && /^[A-Z]{3,4}[0-9]{5}$/u.test(record.specimenId),
        `${recordPath}.specimenId must be a canonical Victoria Land specimen identifier`);
      const identifiers = specimenIds.get(record.catalogId) ?? new Set();
      assert(!identifiers.has(record.specimenId), `${recordPath}.specimenId is duplicated within ${record.catalogId}`);
      identifiers.add(record.specimenId);
      specimenIds.set(record.catalogId, identifiers);
      assertExactKeys(record.weight, ["grams"], `${recordPath}.weight`);
      assert(Number.isFinite(record.weight.grams) && record.weight.grams > 0,
        `${recordPath}.weight.grams must be a finite positive number`);
      assertString(record.classification, `${recordPath}.classification`);
      for (const field of ["olivineFa", "pyroxeneFs", "weathering"]) {
        assertString(record[field], `${recordPath}.${field}`, true);
      }
      validateTableALocality(record.locality, `${recordPath}.locality`);
    } else if (recordModel === "dealer-offer-fact") {
      assert(Number.isInteger(record.typeNumber) && record.typeNumber > 0,
        `${recordPath}.typeNumber must be a positive integer`);
      const typeNumbers = dealerTypeNumbers.get(record.catalogId) ?? [];
      assert(!typeNumbers.includes(record.typeNumber),
        `${recordPath}.typeNumber is duplicated within ${record.catalogId}: ${record.typeNumber}`);
      assert(typeNumbers.length === 0 || record.typeNumber > typeNumbers.at(-1),
        `${recordPath}.typeNumber must increase within ${record.catalogId}`);
      typeNumbers.push(record.typeNumber);
      dealerTypeNumbers.set(record.catalogId, typeNumbers);
      assertString(record.name, `${recordPath}.name`);
      assertString(record.description, `${recordPath}.description`);
    } else {
      assert(Number.isInteger(record.entryOrder) && record.entryOrder > 0,
        `${recordPath}.entryOrder must be a positive integer`);
      const entryOrders = collectionEntryOrders.get(record.catalogId) ?? new Set();
      assert(!entryOrders.has(record.entryOrder),
        `${recordPath}.entryOrder is duplicated within ${record.catalogId}: ${record.entryOrder}`);
      const previousEntryOrder = previousCollectionEntries.get(record.catalogId);
      assert(previousEntryOrder === undefined || record.entryOrder > previousEntryOrder,
        `${recordPath}.entryOrder must increase within ${record.catalogId}`);
      entryOrders.add(record.entryOrder);
      collectionEntryOrders.set(record.catalogId, entryOrders);
      previousCollectionEntries.set(record.catalogId, record.entryOrder);
      for (const field of ["reportedNumber", "section"]) {
        assertString(record[field], `${recordPath}.${field}`, true);
      }
      assert(Array.isArray(record.holdings) && record.holdings.length > 0, `${recordPath}.holdings must be nonempty`);
      record.holdings.forEach((holding, holdingIndex) => record.catalogId === "hamburg-1913"
        ? validateHamburgHolding(holding, `${recordPath}.holdings[${holdingIndex}]`)
        : validateCatalogNumberHolding(holding, `${recordPath}.holdings[${holdingIndex}]`, true));
      if (record.catalogId === "hamburg-1913") {
        if (record.reportedTotalWeight !== null) {
          assertExactKeys(record.reportedTotalWeight, ["grams"], `${recordPath}.reportedTotalWeight`);
          assert(Number.isFinite(record.reportedTotalWeight.grams) && record.reportedTotalWeight.grams >= 0,
            `${recordPath}.reportedTotalWeight.grams must be finite and nonnegative`);
        }
        assert(["base-register", "supplement"].includes(record.publicationState),
          `${recordPath}.publicationState is invalid`);
        assert(Array.isArray(record.amendments), `${recordPath}.amendments must be an array`);
        assert(record.amendments.length === (record.entryOrder === 105 ? 1 : 0),
          `${recordPath}.amendments has an invalid count`);
        if (record.amendments.length) {
          const amendment = record.amendments[0];
          assertExactKeys(amendment, [
            "kind", "effectiveDate", "targetHolding", "targetComponentOrder", "targetWeight", "resultingState",
            "destination", "baseObservationRetained",
          ], `${recordPath}.amendments[0]`);
          assert(amendment.kind === "disposal-by-exchange" && amendment.effectiveDate === "1913-08" &&
            amendment.targetHolding === "Gibeon, Deutsch-Südwestafrika" && amendment.targetComponentOrder === 5 &&
            amendment.resultingState === "disposed" && amendment.destination === null &&
            amendment.baseObservationRetained === true, `${recordPath}.amendments[0] changed factual state`);
          assertExactKeys(amendment.targetWeight, ["grams"], `${recordPath}.amendments[0].targetWeight`);
          assert(amendment.targetWeight.grams === 14500, `${recordPath}.amendments[0].targetWeight changed`);
          const targetComponent = record.holdings[1]?.weights[amendment.targetComponentOrder - 1];
          assert(targetComponent?.kind === "individual-holding" && targetComponent.grams === amendment.targetWeight.grams,
            `${recordPath}.amendments[0] must target the existing individual component at the reported order and mass`);
        }
      }
    }
    if (["catalog-number", "collection-entry", "regional-census-fact"].includes(recordModel)) {
      assert(Array.isArray(record.catalogPages) && record.catalogPages.length > 0,
        `${recordPath}.catalogPages must be a nonempty ordered unique array`);
      record.catalogPages.forEach((page, pageIndex) => {
        assert(Number.isInteger(page) && page > 0 && catalog.sourcePages.has(page),
          `${recordPath}.catalogPages[${pageIndex}] is outside its descriptor sourcePages`);
        if (pageIndex) assert(page > record.catalogPages[pageIndex - 1],
          `${recordPath}.catalogPages must be sorted and unique`);
      });
    } else {
      assert(Number.isInteger(record.catalogPage) && catalog.sourcePages.has(record.catalogPage),
        `${recordPath}.catalogPage is outside its descriptor sourcePages`);
    }
    assert(CONFIDENCE_LEVELS.includes(record.confidence), `${recordPath}.confidence is invalid`);

    const stats = statsByCatalog.get(record.catalogId);
    stats.recordCount += 1;
    stats.confidenceCounts[record.confidence] += 1;
    if (recordDesignations(record, recordModel).length) stats.recordsWithDesignation += 1;
    if (recordMasses(record, recordModel).length) stats.recordsWithWeight += 1;
    if (index) assert(compareRecords(data.records[index - 1], record, metadataByCatalog) < 0,
      `${recordPath} violates deterministic model-aware order`);
  });

  assertExactSet(representedCatalogs, metadataByCatalog.keys(), `${path} record catalog IDs`);
  assertExactSet(Object.keys(folios.catalogs), metadataByCatalog.keys(), `${path} folio catalog IDs`);
  assert(data.metadata.recordCount === data.records.length, `${path}.metadata.recordCount does not match records`);
  if (data.records.length === 14477 && metadataByCatalog.size === 40) {
    assert(individualFindLocationCount === 111,
      `${path} must contain exactly 111 specimen individualFindLocation values`);
  }
  for (const [catalogId, { descriptor, path: descriptorPath, sourcePages }] of metadataByCatalog) {
    const stats = statsByCatalog.get(catalogId);
    for (const field of ["recordCount", "recordsWithDesignation", "recordsWithWeight"]) {
      assert(stats[field] === descriptor[field], `${descriptorPath}.${field} does not match records`);
    }
    for (const level of CONFIDENCE_LEVELS) {
      assert(stats.confidenceCounts[level] === descriptor.confidenceCounts[level],
        `${descriptorPath}.confidenceCounts.${level} does not match records`);
    }
    const policy = folios.catalogs[catalogId];
    assert(policy.displayPolicy === descriptor.folioDisplayPolicy, `${descriptorPath}.folioDisplayPolicy does not match folios`);
    assert(policy.rightsStatus === descriptor.rightsStatus, `${descriptorPath}.rightsStatus does not match folios`);
    policy.pages.forEach((page, pageIndex) => {
      if (page.catalogPage !== null) assert(sourcePages.has(page.catalogPage),
        `folios.catalogs.${catalogId}.pages[${pageIndex}].catalogPage is outside sourcePages`);
    });
  }
  return {
    catalogCount: metadataByCatalog.size,
    recordCount: data.records.length,
    individualFindLocationCount,
    statsByCatalog,
    metadataByCatalog,
    folioStats,
  };
}

function assertPageId(value, path) {
  assert(
    typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value) && value.length <= MAX_CATALOG_ID_LENGTH,
    `${path} must be a lowercase slug of at most ${MAX_CATALOG_ID_LENGTH} characters`,
  );
}

function assertSafeFolioPath(value, catalogId, pageId, path) {
  assertString(value, path);
  const expected = `${FOLIO_PATH_ROOT}${catalogId}/${pageId}.webp`;
  assert(value === expected, `${path} must be exactly ${expected}`);
}

function assertPlainAlt(value, path) {
  assertString(value, path);
  assert([...value].length <= MAX_ALT_LENGTH, `${path} must be at most ${MAX_ALT_LENGTH} characters`);
  assert(!/[\p{Cc}\p{Cf}<>]/u.test(value) && !/`|!?\[[^\]]*\]\([^)]*\)/u.test(value), `${path} must be plain text`);
}

function validateFolioManifest(manifest, path) {
  assertExactKeys(manifest, ["schemaVersion", "catalogs"], path);
  assert(manifest.schemaVersion === 2, `${path}.schemaVersion must be 2`);
  assert(isObject(manifest.catalogs) && Object.keys(manifest.catalogs).length > 0, `${path}.catalogs must be nonempty`);
  let pageEntryCount = 0;
  const pageIds = new Set();
  for (const [catalogId, policy] of Object.entries(manifest.catalogs)) {
    const policyPath = `${path}.catalogs.${catalogId}`;
    assertCatalogId(catalogId, `${policyPath} ID`);
    assertExactKeys(policy, ["displayPolicy", "rightsStatus", "pages"], policyPath);
    assert(DISPLAY_POLICIES.includes(policy.displayPolicy), `${policyPath}.displayPolicy is invalid`);
    assert(RIGHTS_STATUSES.includes(policy.rightsStatus), `${policyPath}.rightsStatus is invalid`);
    assert(Array.isArray(policy.pages), `${policyPath}.pages must be an ordered array`);
    if (policy.displayPolicy === "display") {
      assert(DISPLAY_RIGHTS_STATUSES.includes(policy.rightsStatus),
        `${policyPath} may display only with public-domain or no-copyright-us status`);
      assert(policy.pages.length > 0, `${policyPath}.pages must be nonempty while displayable`);
    } else {
      assert(policy.rightsStatus === "undetermined", `${policyPath} must be undetermined while blocked`);
      assert(policy.pages.length === 0, `${policyPath}.pages must be empty while blocked`);
    }
    policy.pages.forEach((entry, pageIndex) => {
      const entryPath = `${policyPath}.pages[${pageIndex}]`;
      assertExactKeys(entry, PAGE_ENTRY_KEYS, entryPath);
      assertPageId(entry.pageId, `${entryPath}.pageId`);
      assert(!pageIds.has(entry.pageId), `${entryPath}.pageId is duplicated: ${entry.pageId}`);
      pageIds.add(entry.pageId);
      assert(entry.catalogPage === null || (Number.isInteger(entry.catalogPage) && entry.catalogPage > 0),
        `${entryPath}.catalogPage must be a positive integer or null`);
      if (entry.pageLabel !== null) assertPlainAlt(entry.pageLabel, `${entryPath}.pageLabel`);
      assertSafeFolioPath(entry.image, catalogId, entry.pageId, `${entryPath}.image`);
      assertPlainAlt(entry.alt, `${entryPath}.alt`);
      pageEntryCount += 1;
    });
  }
  return { catalogCount: Object.keys(manifest.catalogs).length, pageEntryCount };
}

function validateWebP(buffer, path) {
  assert(buffer.length >= 20, `${path} is too short to contain a WebP chunk`);
  assert(buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP",
    `${path} does not have RIFF/WEBP magic`);
  assert(buffer.readUInt32LE(4) === buffer.length - 8, `${path} RIFF length does not match the file length`);

  let offset = 12;
  let imageChunkCount = 0;
  while (offset < buffer.length) {
    assert(offset + 8 <= buffer.length, `${path} has a truncated WebP chunk header`);
    const chunkType = buffer.toString("ascii", offset, offset + 4);
    const chunkLength = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    const dataEnd = dataOffset + chunkLength;
    const paddedEnd = dataEnd + (chunkLength % 2);
    assert(dataEnd <= buffer.length && paddedEnd <= buffer.length,
      `${path} ${chunkType} chunk exceeds the RIFF boundary`);
    if (chunkLength % 2) assert(buffer[dataEnd] === 0, `${path} ${chunkType} chunk has a nonzero padding byte`);

    if (chunkType === "VP8 ") {
      assert(imageChunkCount === 0, `${path} must contain exactly one VP8 or VP8L image payload chunk`);
      assert(chunkLength > 10, `${path} VP8 chunk must contain data beyond its frame header`);
      assert((buffer[dataOffset] & 1) === 0, `${path} VP8 dimension header is not a key frame`);
      assert(buffer[dataOffset + 3] === 0x9d && buffer[dataOffset + 4] === 0x01 && buffer[dataOffset + 5] === 0x2a,
        `${path} VP8 dimension header has an invalid start code`);
      const width = buffer.readUInt16LE(dataOffset + 6) & 0x3fff;
      const height = buffer.readUInt16LE(dataOffset + 8) & 0x3fff;
      assert(width > 0 && height > 0, `${path} VP8 dimensions must be nonzero`);
      imageChunkCount += 1;
    } else if (chunkType === "VP8L") {
      assert(imageChunkCount === 0, `${path} must contain exactly one VP8 or VP8L image payload chunk`);
      assert(chunkLength > 5, `${path} VP8L chunk has no compressed image payload`);
      assert(buffer[dataOffset] === 0x2f, `${path} VP8L dimension header has an invalid signature`);
      const dimensions = buffer.readUInt32LE(dataOffset + 1);
      assert((dimensions >>> 29) === 0, `${path} VP8L dimension header has an unsupported version`);
      imageChunkCount += 1;
    } else {
      assert(false, `${path} contains forbidden WebP chunk ${chunkType}`);
    }
    offset = paddedEnd;
  }
  assert(offset === buffer.length, `${path} WebP chunks do not end at the RIFF boundary`);
  assert(imageChunkCount === 1, `${path} must contain exactly one VP8 or VP8L image payload chunk`);
}

function validateFolioReleaseLock(manifest, releaseLock, path = "folio release lock") {
  assertExactKeys(releaseLock, ["schemaVersion", "catalogs", "assets"], path);
  assert(releaseLock.schemaVersion === 1, `${path}.schemaVersion must be 1`);
  assert(isObject(releaseLock.catalogs), `${path}.catalogs must be an object`);
  assertExactSet(Object.keys(releaseLock.catalogs), Object.keys(manifest.catalogs), `${path} catalog IDs`);

  for (const [catalogId, policy] of Object.entries(manifest.catalogs)) {
    const locked = releaseLock.catalogs[catalogId];
    const lockedPath = `${path}.catalogs.${catalogId}`;
    assertExactKeys(locked, ["displayPolicy", "rightsStatus", "basis", "basisUrl", "pageIds"], lockedPath);
    assert(locked.displayPolicy === policy.displayPolicy, `${lockedPath}.displayPolicy does not match folios.json`);
    assert(locked.rightsStatus === policy.rightsStatus, `${lockedPath}.rightsStatus does not match folios.json`);
    assert(Array.isArray(locked.pageIds), `${lockedPath}.pageIds must be an ordered array`);
    locked.pageIds.forEach((pageId, pageIndex) => assertPageId(pageId, `${lockedPath}.pageIds[${pageIndex}]`));
    const pageIds = policy.pages.map(({ pageId }) => pageId);
    assert(locked.pageIds.length === pageIds.length && locked.pageIds.every((pageId, index) => pageId === pageIds[index]),
      `${lockedPath}.pageIds do not exactly match folios.json`);
    if (locked.displayPolicy === "display") {
      assertString(locked.basis, `${lockedPath}.basis`);
      assertString(locked.basisUrl, `${lockedPath}.basisUrl`);
      let basisUrl;
      try {
        basisUrl = new URL(locked.basisUrl);
      } catch {
        assert(false, `${lockedPath}.basisUrl must be a valid HTTPS URL`);
      }
      assert(basisUrl.protocol === "https:", `${lockedPath}.basisUrl must be a valid HTTPS URL`);
    } else {
      assert(locked.basis === null && locked.basisUrl === null,
        `${lockedPath} must not claim rights evidence while blocked`);
    }
  }

  assert(Array.isArray(releaseLock.assets), `${path}.assets must be an ordered array`);
  const declared = Object.values(manifest.catalogs).flatMap((policy) => policy.pages.map(({ image }) => image));
  assert(releaseLock.assets.length === declared.length, `${path}.assets must contain every declared folio exactly once`);
  const hashes = new Map();
  releaseLock.assets.forEach((asset, index) => {
    const assetPath = `${path}.assets[${index}]`;
    assertExactKeys(asset, ["path", "sha256"], assetPath);
    assert(asset.path === declared[index], `${assetPath}.path must be exactly ${declared[index]}`);
    assert(typeof asset.sha256 === "string" && /^[a-f0-9]{64}$/u.test(asset.sha256),
      `${assetPath}.sha256 must be a lowercase SHA-256 digest`);
    hashes.set(asset.path, asset.sha256);
  });
  return hashes;
}

async function validateFolioFiles(manifest, path = "folio files", repoRoot = REPO_ROOT, expectedHashes = null) {
  const declared = new Set(Object.values(manifest.catalogs).flatMap((policy) => policy.pages.map(({ image }) => image)));
  const assetsPath = join(repoRoot, "assets");
  const folioRoot = join(assetsPath, "folios");

  const rootDetails = await lstat(repoRoot);
  assert(!rootDetails.isSymbolicLink() && rootDetails.isDirectory(), `${path} repository root must be a non-symlink directory`);

  for (const [componentPath, componentName] of [[assetsPath, "assets"], [folioRoot, "assets/folios"]]) {
    let details;
    try {
      details = await lstat(componentPath);
    } catch (error) {
      if (error.code === "ENOENT" && !declared.size) return { fileCount: 0 };
      throw error;
    }
    assert(!details.isSymbolicLink() && details.isDirectory(), `${path} ${componentName} must be a non-symlink directory`);
  }

  const files = new Set();
  async function visit(directoryPath, segments) {
    const entries = await readdir(directoryPath);
    for (const name of entries) {
      const childPath = join(directoryPath, name);
      const childSegments = [...segments, name];
      const childManifestPath = ["assets", "folios", ...childSegments].join("/");
      const details = await lstat(childPath);
      assert(!details.isSymbolicLink(), `${path} contains a symlink: ${childManifestPath}`);
      if (details.isDirectory()) {
        await visit(childPath, childSegments);
        continue;
      }
      assert(details.isFile(), `${path} contains a non-regular entry: ${childManifestPath}`);
      const catalogId = childSegments[0];
      const policy = manifest.catalogs[catalogId];
      assert(policy, `${path} contains a file for absent catalog ${catalogId}: ${childManifestPath}`);
      assert(policy.displayPolicy === "display", `${path} contains a file for blocked catalog ${catalogId}: ${childManifestPath}`);
      assert(declared.has(childManifestPath), `${path} contains orphan file ${childManifestPath}`);
      files.add(childManifestPath);
      const contents = await readFile(childPath);
      validateWebP(contents, childManifestPath);
      if (expectedHashes) {
        assert(expectedHashes.has(childManifestPath), `${path} has no locked hash for ${childManifestPath}`);
        const actualHash = createHash("sha256").update(contents).digest("hex");
        assert(actualHash === expectedHashes.get(childManifestPath), `${path} hash does not match release lock: ${childManifestPath}`);
      }
    }
  }
  await visit(folioRoot, []);

  for (const image of declared) {
    assert(files.has(image), `${path} is missing declared image ${image}`);
    const absolutePath = join(repoRoot, ...image.split("/"));
    assert(relative(repoRoot, absolutePath).split(sep)[0] !== "..", `${path} image escapes the repository: ${image}`);
    let currentPath = repoRoot;
    for (const segment of image.split("/")) {
      currentPath = join(currentPath, segment);
      const details = await lstat(currentPath);
      assert(!details.isSymbolicLink(), `${path} path component is a symlink: ${image}`);
    }
    const details = await lstat(absolutePath);
    assert(details.isFile() && !details.isSymbolicLink(), `${path} image must be a regular non-symlink file: ${image}`);
  }
  return { fileCount: files.size };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function blockedFolios(metadata) {
  return {
    schemaVersion: 2,
    catalogs: Object.fromEntries(metadata.catalogs.map(({ id }) => [id, {
      displayPolicy: "blocked", rightsStatus: "undetermined", pages: [],
    }])),
  };
}

function fixtureCatalog({
  id,
  recordModel = "specimen",
  label = "Shared catalog label",
  compiler,
  year,
  sourcePages,
  recordCount,
  recordsWithDesignation,
  recordsWithWeight,
  confidenceCounts,
  folioDisplayPolicy,
  rightsStatus,
}) {
  return {
    id,
    recordModel,
    label,
    compiler,
    year,
    sourcePages,
    sourcePageCount: sourcePages.length,
    recordCount,
    recordsWithDesignation,
    recordsWithWeight,
    confidenceCounts,
    folioDisplayPolicy,
    rightsStatus,
  };
}

function multiCatalogFixture() {
  return {
    data: {
      metadata: {
        schemaVersion: 10,
        scope: "facts-only",
        factualFields: [...FACTUAL_FIELDS],
        catalogs: [
          fixtureCatalog({
            id: "alpha-1901",
            compiler: "A. Compiler",
            year: 1901,
            sourcePages: [1, 2, 3],
            recordCount: 2,
            recordsWithDesignation: 2,
            recordsWithWeight: 1,
            confidenceCounts: { high: 1, medium: 1, low: 0 },
            folioDisplayPolicy: "blocked",
            rightsStatus: "undetermined",
          }),
          fixtureCatalog({
            id: "beta-1888",
            compiler: "B. Compiler",
            year: 1888,
            sourcePages: [7],
            recordCount: 1,
            recordsWithDesignation: 1,
            recordsWithWeight: 1,
            confidenceCounts: { high: 0, medium: 0, low: 1 },
            folioDisplayPolicy: "display",
            rightsStatus: "public-domain",
          }),
        ],
        recordCount: 3,
        recordsWithDesignation: 3,
        recordsWithWeight: 2,
        confidenceCounts: { high: 1, medium: 1, low: 1 },
      },
      records: [
        {
          id: "alpha-a1", catalogId: "alpha-1901", designation: "A1", name: "Alpha",
          weight: { grams: 1 }, classification: "Iron", locality: "Alpha County", year: "1900",
          catalogPage: 1, confidence: "high",
        },
        {
          id: "beta-b1", catalogId: "beta-1888", designation: "B1", name: "Beta",
          weight: { grams: 2 }, classification: "Stone", locality: "Beta County", year: "1887",
          catalogPage: 7, confidence: "low",
        },
        {
          id: "alpha-c1", catalogId: "alpha-1901", designation: "C1", name: "Gamma",
          weight: { grams: null }, classification: null, locality: null, year: null,
          catalogPage: 2, confidence: "medium",
        },
      ],
    },
    folios: {
      schemaVersion: 2,
      catalogs: {
        "alpha-1901": { displayPolicy: "blocked", rightsStatus: "undetermined", pages: [] },
        "beta-1888": {
          displayPolicy: "display",
          rightsStatus: "public-domain",
          pages: [
            {
              pageId: "beta-1888-page-7",
              catalogPage: 7,
              pageLabel: "Page 7",
              image: "assets/folios/beta-1888/beta-1888-page-7.webp",
              alt: "Beta catalog page 7",
            },
          ],
        },
      },
    },
  };
}

function renameFixtureCatalog(fixture, currentId, nextId) {
  const descriptor = fixture.data.metadata.catalogs.find((catalog) => catalog.id === currentId);
  descriptor.id = nextId;
  fixture.data.records.forEach((record) => {
    if (record.catalogId === currentId) record.catalogId = nextId;
  });
  fixture.folios.catalogs[nextId] = fixture.folios.catalogs[currentId];
  delete fixture.folios.catalogs[currentId];
}

function runSyntheticCatalogTests(modelFixture) {
  let baselineAllowCount = 0;
  let baselineRejectionCount = 0;
  let modelAllowCount = 0;
  let modelOrderingAllowCount = 0;
  let holdingPrivacyAllowCount = 0;
  let modelRejectionCount = 0;
  let catalogNumberRejectionCount = 0;
  let collectionEntryRejectionCount = 0;
  const assertCatalogAllow = (fixture, description) => {
    validatePublicCatalog(fixture.data, fixture.folios, `synthetic ${description}`);
    baselineAllowCount += 1;
  };
  const assertCatalogRejection = (mutate, description) => {
    const fixture = multiCatalogFixture();
    mutate(fixture);
    let rejected = false;
    try {
      validatePublicCatalog(fixture.data, fixture.folios, `synthetic ${description}`);
    } catch {
      rejected = true;
    }
    assert(rejected, `synthetic catalog fixture must reject ${description}`);
    baselineRejectionCount += 1;
  };

  assertCatalogAllow(multiCatalogFixture(), "valid multi-catalog data");
  const boundary = multiCatalogFixture();
  renameFixtureCatalog(boundary, "alpha-1901", "a".repeat(MAX_CATALOG_ID_LENGTH));
  boundary.data.metadata.catalogs[0].label = "L".repeat(MAX_CATALOG_TEXT_LENGTH);
  boundary.data.metadata.catalogs[0].compiler = "C".repeat(MAX_CATALOG_TEXT_LENGTH);
  boundary.data.records[0].id = "record:alpha";
  boundary.data.records[0].name = "catalog scan";
  boundary.data.records[0].classification = "meteorite image";
  boundary.data.records[0].locality = "field notes";
  assertCatalogAllow(boundary, "runtime boundary and leakage-safe values");

  for (const [description, catalogId] of [
    ["empty catalog slug", ""],
    ["uppercase catalog slug", "Alpha-1901"],
    ["underscore catalog slug", "alpha_1901"],
    ["leading-hyphen catalog slug", "-alpha"],
    ["trailing-hyphen catalog slug", "alpha-"],
    ["duplicate-hyphen catalog slug", "alpha--1901"],
    ["overlong catalog slug", "a".repeat(MAX_CATALOG_ID_LENGTH + 1)],
  ]) assertCatalogRejection((fixture) => renameFixtureCatalog(fixture, "alpha-1901", catalogId), description);

  for (const [description, field, value] of [
    ["empty catalog label", "label", ""],
    ["empty catalog compiler", "compiler", ""],
    ["overlong catalog label", "label", "L".repeat(MAX_CATALOG_TEXT_LENGTH + 1)],
    ["overlong catalog compiler", "compiler", "C".repeat(MAX_CATALOG_TEXT_LENGTH + 1)],
    ["non-normalized catalog label whitespace", "label", "Catalog  label"],
    ["non-NFC catalog compiler", "compiler", "Cafe\u0301"],
    ["catalog label control character", "label", "Catalog\u0000label"],
    ["catalog compiler format character", "compiler", "Catalog\u200Bcompiler"],
  ]) assertCatalogRejection(({ data }) => { data.metadata.catalogs[0][field] = value; }, description);

  for (const [description, recordId] of [
    ["empty record ID", ""],
    ["non-normalized record ID whitespace", "record  id"],
    ["non-NFC record ID", "record-e\u0301"],
    ["record ID control character", "record\u0000id"],
    ["record ID format character", "record\u200Bid"],
    ["record ID leakage marker", "raw OCR output"],
    ["record ID path", "../private/record"],
  ]) assertCatalogRejection(({ data }) => { data.records[0].id = recordId; }, description);

  assertCatalogRejection(({ data }) => { data.records[0].locality = "Alpha\u0000County"; }, "record value control character");
  assertCatalogRejection(({ data }) => { data.records[0].locality = "Alpha\u200BCounty"; }, "record value format character");
  assertCatalogRejection(({ data }) => Object.assign(data.records[0], {
    designation: null, name: null, weight: { grams: null }, classification: null, locality: null, year: null,
  }), "record without substantive public facts");
  assertCatalogRejection(({ data }) => data.metadata.catalogs.push({ ...data.metadata.catalogs[0] }), "duplicate metadata catalog ID");
  assertCatalogRejection(({ data }) => data.metadata.catalogs.pop(), "metadata missing a catalog ID");
  assertCatalogRejection(({ data }) => data.records.splice(1, 1), "records missing a catalog ID");
  assertCatalogRejection(({ folios }) => delete folios.catalogs["beta-1888"], "manifest missing a catalog ID");
  assertCatalogRejection(({ folios }) => {
    folios.catalogs["extra-1900"] = { displayPolicy: "blocked", rightsStatus: "undetermined", pages: [] };
  }, "manifest with an extra catalog ID");
  assertCatalogRejection(({ data }) => {
    Object.assign(data.metadata.catalogs[0], {
      recordCount: 1, recordsWithDesignation: 1, recordsWithWeight: 0,
      confidenceCounts: { high: 0, medium: 1, low: 0 },
    });
    Object.assign(data.metadata.catalogs[1], {
      recordCount: 2, recordsWithDesignation: 2, recordsWithWeight: 2,
      confidenceCounts: { high: 1, medium: 0, low: 1 },
    });
  }, "per-catalog totals mismatch with unchanged global totals");
  assertCatalogRejection(({ data }) => { data.records[2].catalogPage = 4; }, "record page outside its catalog sourcePages");
  assertCatalogRejection(({ data }) => {
    data.metadata.catalogs[0].confidenceCounts = { high: 1, medium: 0, low: 1 };
    data.metadata.catalogs[1].confidenceCounts = { high: 0, medium: 1, low: 0 };
  }, "per-catalog confidence mismatch with unchanged global totals");
  assertCatalogRejection(({ data }) => { data.metadata.catalogs[0].rightsStatus = "public-domain"; }, "metadata and manifest rights mismatch");
  assertCatalogRejection(({ data }) => { data.metadata.recordsWithDesignation = 2; }, "global designation total mismatch");
  assertCatalogRejection(({ data }) => { data.metadata.confidenceCounts = { high: 0, medium: 2, low: 1 }; }, "global confidence total mismatch");
  assertCatalogRejection(({ data }) => { data.metadata.catalogs[0].sourcePages = [2, 1, 3]; }, "unsorted sourcePages");
  assertCatalogRejection(({ data }) => { data.metadata.catalogs[0].sourcePages = [1, 2, 2]; }, "duplicate sourcePages");
  assertCatalogRejection(({ data }) => { data.metadata.schemaVersion = 4; }, "wrong canonical metadata schema version");
  assertCatalogRejection(({ data }) => { data.metadata.generatedAt = "2026-07-19"; }, "extra canonical metadata root key");
  assertCatalogRejection(({ data }) => { data.metadata.catalogs[0].edition = "First"; }, "extra catalog descriptor key");
  assertCatalogRejection(({ data }) => { data.metadata.catalogs[0].sourcePageCount = 2; }, "sourcePageCount mismatch");
  assertCatalogRejection(({ data }) => { data.metadata.catalogs[0].label = "../private/catalog-scan.pdf"; }, "catalog label leakage");
  assertCatalogRejection(({ folios }) => {
    folios.catalogs["beta-1888"].pages.push({
      pageId: "beta-1888-page-8", catalogPage: 8, pageLabel: "Page 8",
      image: "assets/folios/beta-1888/beta-1888-page-8.webp", alt: "Beta catalog page 8",
    });
  }, "folio page outside its catalog source page set");

  for (const [description, value] of [
    ["raw OCR marker", "Raw OCR output for line 4"],
    ["source filename marker", "Source filename IMG_0042"],
    ["scan marker", "Scan file number 42"],
    ["notes marker", "Transcription notes for review"],
    ["path-like string", "../private/page-0042"],
    ["scheme path without an extension", "https://private.example/source"],
    ["image extension before punctuation", "folio-0042.TIFF,"],
    ["source document filename", "page-0042.PDF"],
    ["camera-style image filename", "DSC_0042"],
    ["private label", "Notes"],
    ["OCR batch identifier", "batch-4"],
  ]) assertCatalogRejection(({ data }) => { data.records[0].locality = value; }, description);
  for (const [description, value] of [
    ["rooted private path", "/private"],
    ["rooted Users path", "/Users"],
    ["arbitrary rooted path", "/secret"],
    ["rooted temporary path", "/tmp"],
    ["rooted configuration path", "/etc"],
    ["rooted home path", "/home"],
    ["rooted variable-data path", "/var"],
    ["rooted administrator path", "/root"],
    ["rooted volume path", "/Volumes"],
    ["network root path", "//server"],
    ["network formula lookalike path", "//Tii-vJatllO"],
    ["parent-relative slash path", "../private"],
    ["parent-relative backslash path", "..\\private"],
    ["parent-relative slash formula lookalike", "../l2O3)"],
    ["parent-relative backslash formula lookalike", "..\\l2O3)"],
    ["current-relative slash path", "./private"],
    ["current-relative backslash path", ".\\private"],
    ["current-relative slash formula lookalike", "./l2O3)"],
    ["UNC server path", "\\\\server"],
    ["UNC share path", "\\\\server\\share"],
    ["Windows root-relative private path", "\\private"],
    ["arbitrary Windows root-relative path", "\\secret"],
    ["Tii formula slash continuation", "/Tii-vJatllO/private"],
    ["Tii formula backslash continuation", "/Tii-vJatllO\\private"],
    ["dash-I formula slash continuation", "/-I/private"],
    ["dash-I formula backslash continuation", "/-I\\private"],
    ["Nickel formula slash continuation", "/Nickel iron/private"],
    ["Nickel formula backslash continuation", "/Nickel iron\\private"],
    ["Nickel formula dotted continuation", "/Nickel iron.private"],
    ["alumina formula slash continuation", "(.\\l2O3)/private"],
    ["alumina formula backslash continuation", "(.\\l2O3)\\private"],
    ["alumina formula dotted continuation", "(.\\l2O3).private"],
    ["citation-i slash continuation", "\\i./private"],
    ["citation-i backslash continuation", "\\i.\\private"],
    ["citation-N slash continuation", "\\N./private"],
    ["citation-N backslash continuation", "\\N.\\private"],
    ["citation-Higgins slash continuation", "\\N\\\\\\\\^m/private"],
    ["citation-Higgins backslash continuation", "\\N\\\\\\\\^m\\private"],
    ["citation-Ward slash continuation", "\\\\./private"],
    ["citation-Ward backslash continuation", "\\\\.\\private"],
    ["UNC citation-i lookalike", "\\\\i."],
    ["UNC citation-N lookalike", "\\\\N."],
    ["UNC citation-Higgins lookalike", "\\\\N\\\\\\\\^m"],
    ["Tii punctuated slash continuation", "/Tii-vJatllO,/private"],
    ["Tii punctuated backslash continuation", "/Tii-vJatllO,\\private"],
    ["dash-I punctuated slash continuation", "/-I,/private"],
    ["dash-I punctuated backslash continuation", "/-I,\\private"],
    ["Nickel punctuated slash continuation", "/Nickel iron,/private"],
    ["Nickel punctuated backslash continuation", "/Nickel iron,\\private"],
    ["alumina punctuated slash continuation", "(.\\l2O3),/private"],
    ["alumina punctuated backslash continuation", "(.\\l2O3),\\private"],
  ]) assertCatalogRejection(({ data }) => { data.records[0].locality = value; }, description);
  for (const token of FACTUAL_FORMULA_TOKENS) {
    for (const suffix of FACTUAL_FORMULA_INVALID_SUFFIXES) {
      assertCatalogRejection(
        ({ data }) => { data.records[0].locality = `${token}${suffix}`; },
        `factual formula path continuation: ${token}${suffix}`,
      );
    }
  }
  for (const token of FACTUAL_FORMULA_TOKENS.filter((value) => /^[\\/]/u.test(value))) {
    for (const prefix of FACTUAL_FORMULA_UNSAFE_PREFIXES) {
      assertCatalogRejection(
        ({ data }) => { data.records[0].locality = `${prefix}${token}`; },
        `drive/scheme-prefixed factual formula: ${prefix}${token}`,
      );
    }
  }
  assertCatalogRejection(({ data }) => { data.records[0].rawOcr = "unpublished text"; }, "raw OCR key");
  assertCatalogRejection(({ data }) => { data.metadata.catalogs[0].sourceFilename = "page-1.dat"; }, "source filename key");
  assert(baselineAllowCount === 2, `expected 2 baseline catalog allows, got ${baselineAllowCount}`);
  assert(baselineRejectionCount === 302, `expected 302 baseline catalog rejections, got ${baselineRejectionCount}`);

  const modelFolios = blockedFolios(modelFixture.metadata);
  validatePublicCatalog(modelFixture, modelFolios, "synthetic valid model-aware fixture");
  modelAllowCount += 1;

  const independentNumbering = clone(modelFixture);
  independentNumbering.metadata.catalogs.find(({ id }) => id === "huss-1986").recordModel = "catalog-item";
  const firstIndependent = independentNumbering.records.find(({ id }) => id === "huss-second-h399-1");
  const secondIndependent = independentNumbering.records.find(({ id }) => id === "huss-second-h400");
  for (const [record, catalogItem] of [[firstIndependent, 1], [secondIndependent, 200]]) {
    const holding = {
      designation: record.designation,
      kind: "specimen",
      description: null,
      count: null,
      weight: record.weight,
    };
    delete record.designation;
    delete record.weight;
    record.catalogItem = catalogItem;
    record.holdings = [holding];
  }
  firstIndependent.name = "Normal stone";
  firstIndependent.holdings[0].weight.grams = 200;
  independentNumbering.records = [
    firstIndependent,
    independentNumbering.records.find(({ id }) => id === "nininger-item-1"),
    ...independentNumbering.records.filter(({ id }) => [
      "nininger-item-2", "nininger-item-3", "nininger-item-4", "nininger-item-5", "nininger-item-6"
    ].includes(id)),
    secondIndependent,
    ...independentNumbering.records.filter(({ catalogId }) => catalogId === "huss-1976"),
    ...independentNumbering.records.filter(({ catalogId }) => catalogId === "hovey-1896"),
    ...independentNumbering.records.filter(({ catalogId }) => catalogId === "hodge-smith-1939"),
    ...independentNumbering.records.filter(({ catalogId }) => catalogId === "museum-1914"),
    ...independentNumbering.records.filter(({ catalogId }) => catalogId === "victoria-land-1982"),
    ...independentNumbering.records.filter(({ catalogId }) => catalogId === "dealer-1909"),
  ];
  validatePublicCatalog(independentNumbering, modelFolios,
    "synthetic independent numbering and catalog-item ID tie breaker");
  modelOrderingAllowCount += 1;

  const holdingPrivacyBoundary = clone(modelFixture);
  holdingPrivacyBoundary.records.find(({ id }) => id === "nininger-item-1").holdings[0].description = "found in 1932";
  holdingPrivacyBoundary.records.find(({ id }) => id === "nininger-item-1").holdings[0].designation = "134g";
  holdingPrivacyBoundary.records.find(({ id }) => id === "nininger-item-2").holdings[0].description = "M1 to M15";
  holdingPrivacyBoundary.records.find(({ id }) => id === "hovey-catalog-z9").holdings[0].description =
    "Twenty-two individuals ranging from 1.5 g. to 26.2 g.";
  const boundaryAggregate = holdingPrivacyBoundary.records.find(({ id }) => id === "nininger-item-2").holdings[1];
  boundaryAggregate.designation = "128 s";
  boundaryAggregate.description = "a series of 15 individuals";
  validatePublicCatalog(holdingPrivacyBoundary, modelFolios, "synthetic legitimate holding privacy boundaries");
  holdingPrivacyAllowCount += 1;
  for (const formula of FACTUAL_FORMULA_TOKENS) {
    for (const suffix of FACTUAL_FORMULA_VALID_SUFFIXES) {
      const formulaBoundary = clone(modelFixture);
      formulaBoundary.records.find(({ id }) => id === "nininger-item-3").holdings[0].description = `${formula}${suffix}`;
      validatePublicCatalog(formulaBoundary, modelFolios, `synthetic factual formula boundary: ${formula}${suffix}`);
      holdingPrivacyAllowCount += 1;
    }
  }
  const calciumFormulaBoundary = clone(modelFixture);
  calciumFormulaBoundary.records.find(({ id }) => id === "nininger-item-3").holdings[0].description = "Calcium \\ 1.753";
  validatePublicCatalog(calciumFormulaBoundary, modelFolios, "synthetic Calcium formula boundary");
  holdingPrivacyAllowCount += 1;
  const escapedWeightBoundary = clone(modelFixture);
  escapedWeightBoundary.records.find(({ id }) => id === "nininger-item-3").holdings[0].description = "Weight \\\\ pounds";
  validatePublicCatalog(escapedWeightBoundary, modelFolios, "synthetic escaped weight boundary");
  holdingPrivacyAllowCount += 1;
  for (const prose of ["Formula: /Tii-vJatllO", "Citation: \\N."]) {
    const colonBoundary = clone(modelFixture);
    colonBoundary.records.find(({ id }) => id === "nininger-item-3").holdings[0].description = prose;
    validatePublicCatalog(colonBoundary, modelFolios, `synthetic formula after colon and whitespace: ${prose}`);
    holdingPrivacyAllowCount += 1;
  }

  const assertModelRejection = (description, mutate) => {
    const candidate = clone(modelFixture);
    mutate(candidate);
    let rejected = false;
    try {
      validatePublicCatalog(candidate, modelFolios, `synthetic ${description}`);
    } catch {
      rejected = true;
    }
    assert(rejected, `synthetic model fixture must reject ${description}`);
    modelRejectionCount += 1;
  };
  assertModelRejection("missing descriptor model", ({ metadata }) => { delete metadata.catalogs[0].recordModel; });
  assertModelRejection("unknown descriptor model", ({ metadata }) => { metadata.catalogs[0].recordModel = "row"; });
  assertModelRejection("catalog item fields under specimen descriptor", ({ records }) => {
    records.find(({ id }) => id === "huss-h27-3").catalogItem = 27;
  });
  assertModelRejection("specimen fields under catalog-item descriptor", ({ records }) => {
    const record = records.find(({ id }) => id === "nininger-item-1");
    delete record.holdings; record.designation = "N1"; record.weight = { grams: 1 };
  });
  assertModelRejection("empty holdings", ({ records }) => {
    records.find(({ id }) => id === "nininger-item-1").holdings = [];
  });
  assertModelRejection("extra holding key", ({ records }) => {
    records.find(({ id }) => id === "nininger-item-1").holdings[0].notes = "Public-looking text";
  });
  assertModelRejection("invalid holding kind", ({ records }) => {
    records.find(({ id }) => id === "nininger-item-1").holdings[0].kind = "replica";
  });
  assertModelRejection("specimen holding without designation", ({ records }) => {
    records.find(({ id }) => id === "nininger-item-1").holdings[0].designation = null;
  });
  assertModelRejection("specimen holding without weight", ({ records }) => {
    records.find(({ id }) => id === "nininger-item-1").holdings[0].weight.grams = null;
  });
  assertModelRejection("specimen holding with count", ({ records }) => {
    records.find(({ id }) => id === "nininger-item-1").holdings[0].count = 1;
  });
  assertModelRejection("cast holding without designation", ({ records }) => {
    records.find(({ id }) => id === "nininger-item-3").holdings[0].designation = null;
  });
  assertModelRejection("cast holding with count", ({ records }) => {
    records.find(({ id }) => id === "nininger-item-3").holdings[0].count = 1;
  });
  assertModelRejection("cast holding with weight", ({ records }) => {
    records.find(({ id }) => id === "nininger-item-3").holdings[0].weight.grams = 1;
  });
  assertModelRejection("aggregate holding without description", ({ records }) => {
    records.find(({ id }) => id === "nininger-item-4").holdings[0].description = null;
  });
  assertModelRejection("aggregate holding without count or weight", ({ records }) => {
    records.find(({ id }) => id === "nininger-item-4").holdings[0].count = null;
  });
  assertModelRejection("zero holding count", ({ records }) => {
    records.find(({ id }) => id === "nininger-item-4").holdings[0].count = 0;
  });
  assertModelRejection("fractional holding count", ({ records }) => {
    records.find(({ id }) => id === "nininger-item-4").holdings[0].count = 1.5;
  });
  assertModelRejection("negative holding mass", ({ records }) => {
    records.find(({ id }) => id === "nininger-item-1").holdings[0].weight.grams = -1;
  });
  assertModelRejection("nonfinite holding mass", ({ records }) => {
    records.find(({ id }) => id === "nininger-item-1").holdings[0].weight.grams = Infinity;
  });
  assertModelRejection("holding raw OCR leakage", ({ records }) => {
    records.find(({ id }) => id === "nininger-item-1").holdings[0].description = "Raw OCR output";
  });
  assertModelRejection("holding source filename leakage", ({ records }) => {
    records.find(({ id }) => id === "nininger-item-1").holdings[0].designation = "IMG_0031.TIFF";
  });
  assertModelRejection("holding path leakage", ({ records }) => {
    records.find(({ id }) => id === "nininger-item-1").holdings[0].description = "../private/holding";
  });
  for (const value of [
    "OCR line 4",
    "Reviewer note: uncertain",
    "review note: uncertain",
    "12 grams",
    "12 g",
    "3 kg",
    "Known Wt. 15.2 Kgs.",
    "transcript.docx",
    "Page ID 0042",
    "page_0042",
    "private-source-0042.dat",
    "source/pages/0042.dat",
  ]) {
    assertModelRejection(`strict holding privacy: ${value}`, ({ records }) => {
      records.find(({ id }) => id === "nininger-item-1").holdings[0].description = value;
    });
  }
  assertModelRejection("catalog-item weight summary mismatch", ({ metadata }) => { metadata.catalogs[2].recordsWithWeight -= 1; });
  assertModelRejection("duplicate catalog item within one catalog", ({ records }) => {
    records.find(({ id }) => id === "nininger-item-2").catalogItem = 1;
  });
  assertModelRejection("decreasing catalog items within one catalog", ({ records }) => {
    records.find(({ id }) => id === "nininger-item-2").catalogItem = 100;
    records.find(({ id }) => id === "nininger-item-3").catalogItem = 50;
  });
  assertModelRejection("model-aware order violation", ({ records }) => { [records[0], records[1]] = [records[1], records[0]]; });
  assertModelRejection("regional census fact with specimen holdings", ({ records }) => {
    records.find(({ catalogId }) => catalogId === "hodge-smith-1939").holdings = [];
  });
  assertModelRejection("regional representation status/count mismatch", ({ records }) => {
    records.find(({ catalogId }) => catalogId === "hodge-smith-1939").australianMuseumRepresentation.status = "represented";
  });
  assertModelRejection("Victoria specimen identifier outside Table A grammar", ({ records }) => {
    records.find(({ catalogId }) => catalogId === "victoria-land-1982").specimenId = "ALH-76001";
  });
  assertModelRejection("Victoria locality with an extra field", ({ records }) => {
    records.find(({ catalogId }) => catalogId === "victoria-land-1982").locality.latitude = -76.75;
  });
  assertModelRejection("Victoria nonpositive mass", ({ records }) => {
    records.find(({ catalogId }) => catalogId === "victoria-land-1982").weight.grams = 0;
  });
  assertModelRejection("dealer offer missing exact description field", ({ records }) => {
    delete records.find(({ id }) => id === "dealer-type-95").description;
  });
  assertModelRejection("dealer offer with specimen classification field", ({ records }) => {
    records.find(({ id }) => id === "dealer-type-95").classification = "Iron";
  });
  assertModelRejection("dealer offer nonpositive type number", ({ records }) => {
    records.find(({ id }) => id === "dealer-type-95").typeNumber = 0;
  });
  assertModelRejection("dealer offer type order drift", ({ records }) => {
    records.find(({ id }) => id === "dealer-type-96").typeNumber = 94;
  });

  const assertCatalogNumberRejection = (description, mutate) => {
    const candidate = clone(modelFixture);
    mutate(candidate);
    let rejected = false;
    try {
      validatePublicCatalog(candidate, modelFolios, `synthetic ${description}`);
    } catch {
      rejected = true;
    }
    assert(rejected, `synthetic catalog-number fixture must reject ${description}`);
    catalogNumberRejectionCount += 1;
  };
  const hoveyRecord = (records, id = "hovey-catalog-z9") => records.find((record) => record.id === id);
  assertCatalogNumberRejection("older metadata under schema 10", ({ metadata }) => { metadata.schemaVersion = 9; });
  assertCatalogNumberRejection("empty catalog number", ({ records }) => { hoveyRecord(records).catalogNumber = ""; });
  assertCatalogNumberRejection("nonnull non-string catalog number", ({ records }) => { hoveyRecord(records).catalogNumber = 9; });
  assertCatalogNumberRejection("duplicate catalog number within one catalog", ({ records }) => {
    hoveyRecord(records, "hovey-catalog-fraction-like").catalogNumber = "Z-9";
  });
  assertCatalogNumberRejection("catalog-number record extra key", ({ records }) => { hoveyRecord(records).year = "1890"; });
  assertCatalogNumberRejection("catalog-number empty holdings", ({ records }) => { hoveyRecord(records).holdings = []; });
  assertCatalogNumberRejection("catalog-number empty description", ({ records }) => { hoveyRecord(records).holdings[0].description = ""; });
  assertCatalogNumberRejection("catalog-number null description", ({ records }) => { hoveyRecord(records).holdings[0].description = null; });
  assertCatalogNumberRejection("catalog-number empty provenance", ({ records }) => { hoveyRecord(records).holdings[0].provenance = ""; });
  assertCatalogNumberRejection("catalog-number private provenance", ({ records }) => {
    hoveyRecord(records).holdings[0].provenance = "Reviewer note: uncertain";
  });
  assertCatalogNumberRejection("catalog-number zero count", ({ records }) => { hoveyRecord(records).holdings[0].count = 0; });
  assertCatalogNumberRejection("catalog-number fractional count", ({ records }) => { hoveyRecord(records).holdings[0].count = 1.5; });
  assertCatalogNumberRejection("catalog-number empty weights", ({ records }) => { hoveyRecord(records).holdings[0].weights = []; });
  assertCatalogNumberRejection("catalog-number negative mass", ({ records }) => { hoveyRecord(records).holdings[0].weights[0].grams = -1; });
  assertCatalogNumberRejection("catalog-number null mass", ({ records }) => { hoveyRecord(records).holdings[0].weights[0].grams = null; });
  assertCatalogNumberRejection("catalog-number nonfinite mass", ({ records }) => { hoveyRecord(records).holdings[0].weights[0].grams = Infinity; });
  assertCatalogNumberRejection("catalog-number extra weight key", ({ records }) => {
    hoveyRecord(records).holdings[0].weights[0].display = "212.6 g";
  });
  assertCatalogNumberRejection("catalog-number empty pages", ({ records }) => { hoveyRecord(records).catalogPages = []; });
  assertCatalogNumberRejection("catalog-number decreasing pages", ({ records }) => { hoveyRecord(records).catalogPages = [150, 149]; });
  assertCatalogNumberRejection("catalog-number duplicate pages", ({ records }) => { hoveyRecord(records).catalogPages = [149, 149]; });
  assertCatalogNumberRejection("catalog-number page outside sourcePages", ({ records }) => { hoveyRecord(records).catalogPages = [151]; });
  assertCatalogNumberRejection("catalog-number empty discovery date", ({ records }) => { hoveyRecord(records).dateOfDiscovery = ""; });
  assertCatalogNumberRejection("catalog-number summary mismatch", ({ metadata }) => {
    metadata.catalogs.find(({ id }) => id === "hovey-1896").recordsWithWeight = 1;
  });

  const assertCollectionEntryRejection = (description, mutate) => {
    const candidate = clone(modelFixture);
    mutate(candidate);
    let rejected = false;
    try {
      validatePublicCatalog(candidate, modelFolios, `synthetic ${description}`);
    } catch {
      rejected = true;
    }
    assert(rejected, `synthetic collection-entry fixture must reject ${description}`);
    collectionEntryRejectionCount += 1;
  };
  const collectionRecord = (records, id = "museum-entry-anonymous") => records.find((record) => record.id === id);
  assertCollectionEntryRejection("collection-entry extra field", ({ records }) => {
    collectionRecord(records).historicalMass = "about two ounces";
  });
  assertCollectionEntryRejection("collection-entry empty reported number", ({ records }) => {
    collectionRecord(records, "museum-entry-duplicate-a").reportedNumber = "";
  });
  for (const field of ["section", "eventDate"]) {
    assertCollectionEntryRejection(`collection-entry empty ${field}`, ({ records }) => { collectionRecord(records)[field] = ""; });
  }
  assertCollectionEntryRejection("collection-entry invalid entry order", ({ records }) => {
    collectionRecord(records).entryOrder = 0;
  });
  assertCollectionEntryRejection("collection-entry duplicate entry order", ({ records }) => {
    collectionRecord(records, "museum-entry-duplicate-b").entryOrder = 1;
  });
  assertCollectionEntryRejection("collection-entry extra weight key", ({ records }) => {
    collectionRecord(records).holdings[0].weights[0].display = "2.25 g";
  });
  assertCollectionEntryRejection("collection-entry negative mass", ({ records }) => {
    collectionRecord(records).holdings[0].weights[0].grams = -1;
  });
  assertCollectionEntryRejection("collection-entry nonfinite mass", ({ records }) => {
    collectionRecord(records).holdings[0].weights[0].grams = Infinity;
  });
  assertCollectionEntryRejection("collection-entry empty holdings", ({ records }) => { collectionRecord(records).holdings = []; });
  assertCollectionEntryRejection("collection-entry empty pages", ({ records }) => { collectionRecord(records).catalogPages = []; });
  assertCollectionEntryRejection("collection-entry decreasing pages", ({ records }) => {
    collectionRecord(records).catalogPages = [203, 202];
  });
  assertCollectionEntryRejection("collection-entry page outside sourcePages", ({ records }) => {
    collectionRecord(records).catalogPages = [204];
  });
  assertCollectionEntryRejection("collection-entry summary mismatch", ({ metadata }) => {
    metadata.catalogs.find(({ id }) => id === "museum-1914").recordsWithWeight = 1;
  });
  assertCollectionEntryRejection("collection-entry canonical order", ({ records }) => {
    const firstIndex = records.findIndex(({ id }) => id === "museum-entry-duplicate-a");
    [records[firstIndex], records[firstIndex + 1]] = [records[firstIndex + 1], records[firstIndex]];
  });

  return {
    baselineAllowCount,
    baselineRejectionCount,
    modelAllowCount,
    modelOrderingAllowCount,
    holdingPrivacyAllowCount,
    modelRejectionCount,
    catalogNumberRejectionCount,
    collectionEntryRejectionCount,
  };
}

function runSyntheticMetbullTests(modelFixture) {
  const makeFixture = () => ({ data: clone(modelFixture), folios: blockedFolios(modelFixture.metadata) });
  const reviewed = {
    matchType: "corrected-spelling",
    canonicalName: "Current Alpha",
    meteoriteCode: "12345",
    metbullUrl: metbullUrlForCode("12345"),
    alternateNameNote: "The source preserves an older spelling.",
  };
  const valid = makeFixture();
  valid.data.records[0].metbull = reviewed;
  validatePublicCatalog(valid.data, valid.folios, "synthetic reviewed MetBull mapping");

  const caseNormalized = makeFixture();
  const caseSourceName = caseNormalized.data.records[0].name;
  caseNormalized.data.records[0].metbull = {
    ...reviewed,
    matchType: "case-normalized-exact",
    canonicalName: caseSourceName.toLocaleUpperCase("en-US"),
  };
  validatePublicCatalog(caseNormalized.data, caseNormalized.folios, "synthetic case-normalized MetBull mapping");

  const unresolved = makeFixture();
  unresolved.data.records[0].metbull = {
    matchType: "unresolved",
    canonicalName: null,
    meteoriteCode: null,
    metbullUrl: null,
    alternateNameNote: "No reviewed identity has been established.",
  };
  validatePublicCatalog(unresolved.data, unresolved.folios, "synthetic unresolved MetBull mapping");

  const cases = [
    ["unknown match type", (value) => { value.matchType = "fuzzy"; }],
    ["malformed code", (value) => { value.meteoriteCode = "012345"; }],
    ["mismatched URL", (value) => { value.metbullUrl = metbullUrlForCode("9"); }],
    ["noncanonical name", (value) => { value.canonicalName = " Current Alpha"; }],
    ["false exact claim", (value) => { value.matchType = "exact"; }],
    ["unresolved identity claim", (value) => {
      value.matchType = "unresolved";
      value.canonicalName = null;
      value.meteoriteCode = null;
    }],
    ["extra field", (value) => { value.confidence = "probable"; }],
  ];
  cases.forEach(([description, mutate]) => {
    const fixture = makeFixture();
    fixture.data.records[0].metbull = clone(reviewed);
    mutate(fixture.data.records[0].metbull);
    let rejected = false;
    try {
      validatePublicCatalog(fixture.data, fixture.folios, `synthetic ${description}`);
    } catch {
      rejected = true;
    }
    assert(rejected, `synthetic catalog fixture must reject ${description}`);
  });
  return { allowCount: 3, rejectionCount: cases.length };
}

function syntheticManifest({
  rightsStatus = "public-domain",
  displayPolicy = "display",
  pageId = "reviewed-example-page-3",
  catalogPage = 3,
  pageLabel = "Page 3",
  image = "assets/folios/reviewed-example/reviewed-example-page-3.webp",
  alt = "Reviewed catalog page 3",
  pageEntry,
} = {}) {
  const entry = pageEntry ?? { pageId, catalogPage, pageLabel, image, alt };
  return {
    schemaVersion: 2,
    catalogs: {
      "reviewed-example": { displayPolicy, rightsStatus, pages: displayPolicy === "blocked" ? [] : [entry] },
    },
  };
}

function syntheticReleaseLock(manifest, sha256) {
  return {
    schemaVersion: 1,
    catalogs: Object.fromEntries(Object.entries(manifest.catalogs).map(([catalogId, policy]) => [catalogId, {
      displayPolicy: policy.displayPolicy,
      rightsStatus: policy.rightsStatus,
      basis: policy.displayPolicy === "display" ? "Synthetic reviewed rights evidence." : null,
      basisUrl: policy.displayPolicy === "display" ? "https://example.test/rights" : null,
      pageIds: policy.pages.map(({ pageId }) => pageId),
    }])),
    assets: Object.values(manifest.catalogs).flatMap((policy) => policy.pages.map(({ image }) => ({ path: image, sha256 }))),
  };
}

function runSyntheticFolioTests() {
  let allowCount = 0;
  let rejectionCount = 0;
  const allow = (manifest, description, expectedPages = 1) => {
    const stats = validateFolioManifest(manifest, `synthetic ${description}`);
    assert(stats.pageEntryCount === expectedPages, `synthetic ${description} has the wrong page count`);
    allowCount += 1;
  };
  const reject = (manifest, description) => {
    let rejected = false;
    try {
      validateFolioManifest(manifest, `synthetic ${description}`);
    } catch {
      rejected = true;
    }
    assert(rejected, `synthetic fixture must reject ${description}`);
    rejectionCount += 1;
  };

  allow(syntheticManifest(), "public-domain display page");
  allow(syntheticManifest({ rightsStatus: "no-copyright-us" }), "no-copyright-us display page");
  allow(syntheticManifest({ catalogPage: null }), "unnumbered page");
  allow(syntheticManifest({ pageLabel: null }), "page without a printed label");
  allow(syntheticManifest({ displayPolicy: "blocked", rightsStatus: "undetermined" }), "blocked catalog", 0);
  const schema1 = syntheticManifest();
  schema1.schemaVersion = 1;
  reject(schema1, "schema 1 manifest");
  reject(syntheticManifest({ rightsStatus: "undetermined" }), "display with undetermined rights");
  reject(syntheticManifest({ rightsStatus: "unknown" }), "unknown rights status");
  reject(syntheticManifest({ displayPolicy: "blocked", rightsStatus: "public-domain" }), "blocked public-domain catalog");
  const blockedPages = syntheticManifest({ displayPolicy: "blocked", rightsStatus: "undetermined" });
  blockedPages.catalogs["reviewed-example"].pages.push(syntheticManifest().catalogs["reviewed-example"].pages[0]);
  reject(blockedPages, "blocked catalog with pages");
  const emptyDisplay = syntheticManifest();
  emptyDisplay.catalogs["reviewed-example"].pages = [];
  reject(emptyDisplay, "display catalog without pages");
  const objectPages = syntheticManifest();
  objectPages.catalogs["reviewed-example"].pages = {};
  reject(objectPages, "object page map");
  for (const [description, catalogId] of [
    ["uppercase catalog ID", "Reviewed-Example"],
    ["underscore catalog ID", "reviewed_example"],
    ["whitespace catalog ID", "reviewed example"],
    ["overlong catalog ID", "a".repeat(MAX_CATALOG_ID_LENGTH + 1)],
  ]) {
    const manifest = syntheticManifest();
    manifest.catalogs[catalogId] = manifest.catalogs["reviewed-example"];
    delete manifest.catalogs["reviewed-example"];
    reject(manifest, description);
  }
  for (const [description, pageId] of [
    ["empty page ID", ""],
    ["uppercase page ID", "Reviewed-page-3"],
    ["underscore page ID", "reviewed_page_3"],
    ["whitespace page ID", "reviewed page 3"],
    ["traversal page ID", ".."],
    ["overlong page ID", "a".repeat(MAX_CATALOG_ID_LENGTH + 1)],
  ]) reject(syntheticManifest({ pageId, image: `assets/folios/reviewed-example/${pageId}.webp` }), description);
  const malformedPaths = [
    ["empty path", ""],
    ["whitespace", "assets/folios/reviewed-example/reviewed example.webp"],
    ["slash-rooted", "/assets/folios/reviewed-example/reviewed-example-page-3.webp"],
    ["scheme", "https://example.test/reviewed-example-page-3.webp"],
    ["backslash", "assets\\folios\\reviewed-example\\reviewed-example-page-3.webp"],
    ["query suffix", "assets/folios/reviewed-example/reviewed-example-page-3.webp?download=1"],
    ["fragment suffix", "assets/folios/reviewed-example/reviewed-example-page-3.webp#page"],
    ["parent segment", "assets/folios/reviewed-example/../reviewed-example-page-3.webp"],
    ["outside root", "assets/images/reviewed-example/reviewed-example-page-3.webp"],
    ["wrong catalog directory", "assets/folios/other-catalog/reviewed-example-page-3.webp"],
    ["unsafe extension", "assets/folios/reviewed-example/reviewed-example-page-3.png"],
    ["wrong filename", "assets/folios/reviewed-example/page-3.webp"],
  ];
  for (const [description, value] of malformedPaths) reject(syntheticManifest({ image: value }), `image ${description}`);
  reject(syntheticManifest({ pageEntry: {
    pageId: "reviewed-example-page-3", catalogPage: 3, pageLabel: "Page 3",
    full: "assets/folios/reviewed-example/reviewed-example-page-3.webp", alt: "Reviewed catalog page 3",
  } }), "wrong full key");
  reject(syntheticManifest({ pageEntry: {
    pageId: "reviewed-example-page-3", catalogPage: 3, pageLabel: "Page 3",
    image: "assets/folios/reviewed-example/reviewed-example-page-3.webp", alt: "Reviewed catalog page 3", caption: "Unexpected field",
  } }), "extra page-entry key");
  reject(syntheticManifest({ pageEntry: {
    pageId: "reviewed-example-page-3", catalogPage: 3, pageLabel: "Page 3",
    image: "assets/folios/reviewed-example/reviewed-example-page-3.webp",
  } }), "missing alt key");
  for (const value of [0, -1, 1.5, "3"]) reject(syntheticManifest({ catalogPage: value }), "invalid catalog page");
  const missingCatalogPage = syntheticManifest();
  delete missingCatalogPage.catalogs["reviewed-example"].pages[0].catalogPage;
  reject(missingCatalogPage, "missing catalog page key");
  for (const value of ["", "   ", "Page  3", "<em>Page 3</em>"]) {
    reject(syntheticManifest({ pageLabel: value }), "invalid page label");
  }
  const duplicatePageId = syntheticManifest();
  duplicatePageId.catalogs["reviewed-example"].pages.push({
    ...duplicatePageId.catalogs["reviewed-example"].pages[0], catalogPage: 4,
  });
  reject(duplicatePageId, "duplicate page ID");
  for (const [description, alt] of [
    ["empty alt", ""],
    ["whitespace-only alt", "   "],
    ["non-NFC alt", "Cafe\u0301 catalog page"],
    ["non-normalized alt whitespace", "Catalog  page 3"],
    ["HTML markup alt", "<em>Catalog page 3</em>"],
    ["Markdown markup alt", "[Catalog page 3](https://example.test)"],
    ["control-character alt", "Catalog page\u0000 3"],
    ["format-character alt", "Catalog page\u200B 3"],
    ["overlong alt", "x".repeat(MAX_ALT_LENGTH + 1)],
  ]) reject(syntheticManifest({ alt }), description);
  assert(allowCount === 5, `expected 5 folio allows, got ${allowCount}`);
  assert(rejectionCount === 51, `expected 51 folio rejections, got ${rejectionCount}`);
  return { allowCount, rejectionCount };
}

async function runSyntheticFolioFileTests() {
  let allowCount = 0;
  let rejectionCount = 0;
  const validWebP = Buffer.from("UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ8pa3vP+BiOh/AAA=", "base64");
  const validHash = createHash("sha256").update(validWebP).digest("hex");
  const run = async (description, mutate, shouldReject = true, withLock = false) => {
    const repoRoot = await mkdtemp(join(tmpdir(), "meteorite-folios-"));
    const manifest = syntheticManifest();
    const releaseLock = syntheticReleaseLock(manifest, validHash);
    const image = manifest.catalogs["reviewed-example"].pages[0].image;
    const imagePath = join(repoRoot, ...image.split("/"));
    await mkdir(dirname(imagePath), { recursive: true });
    await writeFile(imagePath, validWebP);
    try {
      if (mutate) await mutate({ repoRoot, manifest, releaseLock, imagePath });
      let rejected = false;
      try {
        const hashes = withLock
          ? validateFolioReleaseLock(manifest, releaseLock, `synthetic ${description} release lock`)
          : null;
        await validateFolioFiles(manifest, `synthetic ${description}`, repoRoot, hashes);
      } catch {
        rejected = true;
      }
      assert(rejected === shouldReject, `synthetic folio files must ${shouldReject ? "reject" : "allow"} ${description}`);
      if (shouldReject) rejectionCount += 1;
      else allowCount += 1;
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  };

  await run("valid declared WebP", null, false);
  await run("bad WebP magic", async ({ imagePath }) => writeFile(imagePath, Buffer.from("not a WebP")));
  await run("truncated WebP chunk", async ({ imagePath }) => {
    const truncated = Buffer.from(validWebP.subarray(0, -1));
    truncated.writeUInt32LE(truncated.length - 8, 4);
    await writeFile(imagePath, truncated);
  });
  await run("invalid RIFF length", async ({ imagePath }) => {
    const invalidLength = Buffer.from(validWebP);
    invalidLength.writeUInt32LE(invalidLength.length - 9, 4);
    await writeFile(imagePath, invalidLength);
  });
  await run("invalid VP8L chunk data", async ({ imagePath }) => {
    const invalidChunk = Buffer.from(validWebP);
    invalidChunk[20] = 0;
    await writeFile(imagePath, invalidChunk);
  });
  await run("VP8X header without image data", async ({ imagePath }) => {
    const headerOnly = Buffer.alloc(30);
    headerOnly.write("RIFF", 0, "ascii");
    headerOnly.writeUInt32LE(22, 4);
    headerOnly.write("WEBP", 8, "ascii");
    headerOnly.write("VP8X", 12, "ascii");
    headerOnly.writeUInt32LE(10, 16);
    await writeFile(imagePath, headerOnly);
  });
  await run("VP8 frame header without payload data", async ({ imagePath }) => {
    const headerOnly = Buffer.alloc(30);
    headerOnly.write("RIFF", 0, "ascii");
    headerOnly.writeUInt32LE(22, 4);
    headerOnly.write("WEBP", 8, "ascii");
    headerOnly.write("VP8 ", 12, "ascii");
    headerOnly.writeUInt32LE(10, 16);
    headerOnly[23] = 0x9d;
    headerOnly[24] = 0x01;
    headerOnly[25] = 0x2a;
    headerOnly.writeUInt16LE(1, 26);
    headerOnly.writeUInt16LE(1, 28);
    await writeFile(imagePath, headerOnly);
  });
  await run("VP8L frame header without payload data", async ({ imagePath }) => {
    const headerOnly = Buffer.alloc(26);
    headerOnly.write("RIFF", 0, "ascii");
    headerOnly.writeUInt32LE(18, 4);
    headerOnly.write("WEBP", 8, "ascii");
    headerOnly.write("VP8L", 12, "ascii");
    headerOnly.writeUInt32LE(5, 16);
    headerOnly[20] = 0x2f;
    await writeFile(imagePath, headerOnly);
  });
  await run("valid image with EXIF private-path chunk", async ({ imagePath }) => {
    const privatePath = Buffer.from("/private/source/folio.tif", "utf8");
    const exifChunk = Buffer.alloc(8 + privatePath.length + (privatePath.length % 2));
    exifChunk.write("EXIF", 0, "ascii");
    exifChunk.writeUInt32LE(privatePath.length, 4);
    privatePath.copy(exifChunk, 8);
    const withExif = Buffer.concat([validWebP, exifChunk]);
    withExif.writeUInt32LE(withExif.length - 8, 4);
    await writeFile(imagePath, withExif);
  });
  await run("orphan file", async ({ imagePath }) => writeFile(join(dirname(imagePath), "orphan.webp"), validWebP));
  await run("file for blocked catalog", async ({ manifest }) => {
    Object.assign(manifest.catalogs["reviewed-example"], { displayPolicy: "blocked", rightsStatus: "undetermined", pages: [] });
  });
  await run("file for absent catalog", async ({ manifest }) => { delete manifest.catalogs["reviewed-example"]; });
  await run("missing declared image", async ({ imagePath }) => rm(imagePath));
  await run("symlink image", async ({ repoRoot, imagePath }) => {
    const target = join(repoRoot, "target.webp");
    await writeFile(target, validWebP);
    await rm(imagePath);
    await symlink(target, imagePath);
  });
  await run("symlink catalog directory", async ({ repoRoot, imagePath }) => {
    const targetDirectory = join(repoRoot, "outside");
    await mkdir(targetDirectory);
    await writeFile(join(targetDirectory, "reviewed-example-page-3.webp"), validWebP);
    await rm(dirname(imagePath), { recursive: true });
    await symlink(targetDirectory, dirname(imagePath));
  });
  await run("matching synthetic release lock", null, false, true);
  await run("policy lock drift", async ({ manifest }) => {
    manifest.catalogs["reviewed-example"].rightsStatus = "no-copyright-us";
  }, true, true);
  await run("page lock drift", async ({ releaseLock }) => {
    releaseLock.catalogs["reviewed-example"].pageIds = ["reviewed-example-page-4"];
  }, true, true);
  await run("hash lock drift", async ({ releaseLock }) => {
    releaseLock.assets[0].sha256 = "0".repeat(64);
  }, true, true);
  assert(allowCount === 2 && rejectionCount === 17,
    `expected 2 folio-file allows and 17 rejections, got ${allowCount} and ${rejectionCount}`);
  return { allowCount, rejectionCount };
}

const fixture = JSON.parse(await readFile(FIXTURE_URL, "utf8"));
const catalogFixtureStats = runSyntheticCatalogTests(fixture);
const metbullFixtureStats = runSyntheticMetbullTests(fixture);
const folioFixtureStats = runSyntheticFolioTests();
const folioFileFixtureStats = await runSyntheticFolioFileTests();
console.log(
  `Synthetic fixtures: ${catalogFixtureStats.baselineAllowCount} baseline catalog allows, ` +
  `${catalogFixtureStats.baselineRejectionCount} baseline catalog/leakage rejections, ` +
  `${catalogFixtureStats.modelAllowCount} model-aware catalog allow, ` +
  `${catalogFixtureStats.modelOrderingAllowCount} model-ordering/catalog-scope allow, ` +
  `${catalogFixtureStats.holdingPrivacyAllowCount} holding-privacy boundary allow, ` +
  `${catalogFixtureStats.modelRejectionCount} model/holding rejections, ` +
  `${catalogFixtureStats.catalogNumberRejectionCount} catalog-number rejections, ` +
  `${catalogFixtureStats.collectionEntryRejectionCount} collection-entry/schema-10 rejections, ` +
  `${metbullFixtureStats.allowCount} MetBull allows, ${metbullFixtureStats.rejectionCount} MetBull rejections, ` +
  `${folioFixtureStats.allowCount} folio allows, ${folioFixtureStats.rejectionCount} folio rejections, ` +
  `${folioFileFixtureStats.allowCount} folio-file allows, ${folioFileFixtureStats.rejectionCount} folio-file rejections passed.`,
);

if (!SYNTHETIC_ONLY) {
  const [data, folios, releaseLock] = await Promise.all(
    [CATALOG_URL, FOLIOS_URL, RELEASE_LOCK_URL].map(async (url) => JSON.parse(await readFile(url, "utf8"))),
  );
  const deployedStats = validatePublicCatalog(data, folios, "root");
  const assertDeployedRejection = (label, mutate) => {
    const changed = clone(data);
    mutate(changed);
    let rejected = false;
    try {
      validatePublicCatalog(changed, folios, `mutated ${label}`);
    } catch {
      rejected = true;
    }
    assert(rejected, `deployed catalog mutation must reject ${label}`);
  };
  const locationRecord = data.records.find((record) => Object.hasOwn(record, "individualFindLocation"));
  assertDeployedRejection("schema-9 downgrade", ({ metadata }) => { metadata.schemaVersion = 9; });
  assertDeployedRejection("missing one of 111 individual find locations", ({ records }) => {
    delete records.find(({ id }) => id === locationRecord.id).individualFindLocation;
  });
  assertDeployedRejection("empty individual find location", ({ records }) => {
    records.find(({ id }) => id === locationRecord.id).individualFindLocation = "";
  });
  assertDeployedRejection("individual find location on a non-specimen model", ({ records }) => {
    records.find(({ catalogId }) => catalogId === "farrington-1916").individualFindLocation = "Shelf 1";
  });
  const expectedHashes = validateFolioReleaseLock(folios, releaseLock, "root folio release lock");
  await validateFolioFiles(folios, "root folio files", REPO_ROOT, expectedHashes);
  const totalPageCount = [...deployedStats.metadataByCatalog.values()].reduce(
    (sum, { descriptor }) => sum + descriptor.sourcePageCount,
    0,
  );
  console.log(
    `Validated data/catalog.json and data/folios.json: ${deployedStats.recordCount} records across ` +
      `${deployedStats.catalogCount} schema 10 facts-only catalogs, ${deployedStats.individualFindLocationCount} individual find locations, ` +
      `${totalPageCount} metadata source pages, ` +
    `${deployedStats.folioStats.pageEntryCount} displayable folio pages with locked SHA-256 assets.`,
  );
  for (const [catalogId, { descriptor }] of deployedStats.metadataByCatalog) {
    const stats = deployedStats.statsByCatalog.get(catalogId);
    console.log(
      `${catalogId}: ${descriptor.recordModel}, ${stats.recordCount} records, ` +
      `${stats.recordsWithDesignation} with designations, ${stats.recordsWithWeight} with weights, ` +
      `confidence high=${stats.confidenceCounts.high} medium=${stats.confidenceCounts.medium} ` +
      `low=${stats.confidenceCounts.low}, ${descriptor.folioDisplayPolicy}/${descriptor.rightsStatus}.`,
    );
  }
}

export {
  rejectCatalogExcludedContent,
  validateFolioFiles,
  validateFolioManifest,
  validateFolioReleaseLock,
  validatePublicCatalog,
  validateWebP,
};
