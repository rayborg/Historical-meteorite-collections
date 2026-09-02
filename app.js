"use strict";

const CACHE_VERSION = "20260902-backlog39-wave1-1";
const ASSET_CACHE_VERSION = CACHE_VERSION;
const CATALOG_SCHEMA_VERSION = 10;
const CATALOG_RECORD_COUNT = 14477;
const DISPLAY_DESCRIPTOR_COUNT = 19477;
const SPECIMEN_DESCRIPTOR_COUNT = 12966;
const OBSERVATION_DESCRIPTOR_COUNT = 6511;
const WEIGHTED_DESCRIPTOR_COUNT = 19304;
const UNKNOWN_WEIGHT_EXCLUSION_COUNT = 173;
const WAVE1_PROJECTED_CATALOGS = new Set(["brown-1916", "minnesota-1892"]);
const WAVE1_LINEAGE_RELATIONSHIP_IDS = new Set([
  "possible-lineage-015140ad-87ce-5595-a68e-afb9f85836b2",
  "possible-lineage-20ef2648-5722-529f-8b8f-21c07bd64607",
  "possible-lineage-27533024-d8f9-5335-a0b8-e538b1d5726f",
  "possible-lineage-28cad19f-e42d-5837-9ca0-43346b04f9fb",
  "possible-lineage-2ae3f247-8b02-5082-8fe8-725c409d0380",
  "possible-lineage-4f695b8c-0b48-56f6-85cc-a171d3bda5ed",
  "possible-lineage-61d9e034-e89e-5dcb-bc0e-4de6035654bb",
  "possible-lineage-6569e465-c2c3-5ce2-b46f-fe8cc177d4c0",
  "possible-lineage-97817b5e-85ff-5191-8f4c-767236146f4d",
  "possible-lineage-9be1fe18-4367-5d2c-ab06-bd76f8193430",
  "possible-lineage-ae993216-9d2d-5794-80a3-b164e7759cd9",
  "possible-lineage-affd5c82-515b-5cdd-83c8-6f908c4f37d5",
  "possible-lineage-b1f5088c-e065-5c51-b5dc-1c00a4c0904f",
  "possible-lineage-b890eaa7-df2f-599c-b16a-2fab57708500",
  "possible-lineage-b8cdd278-99aa-5729-9fca-d1b451bdfa30",
  "possible-lineage-ce67e96f-8984-58ea-893f-489130ab6994",
  "possible-lineage-d894b254-a96b-563e-8f37-f363cf31b835",
  "possible-lineage-df7aa936-8c6d-5ec0-a1ac-4a18ca2e6856",
  "possible-lineage-e8169766-7ea4-5ca2-871b-da0a1e4c4cd9",
  "possible-lineage-eb0022b1-5b35-5d6a-9b6d-cfabb5ef29a0",
  "possible-lineage-f994b310-4343-5ad4-9ed1-a97d79b61eec",
  "possible-lineage-fe3fdb26-c81e-501c-829b-c0995ef4081a"
]);
const PAGE_SIZE = 120;
const DEFAULT_SORT = "name-asc";
const ISSUE_FORM_URL = "https://github.com/rayborg/Historical-meteorite-collections/issues/new?template=data-error.yml";
const ISSUE_REPORT_MINIMUM_ELAPSED_MS = 3000;
const VALID_SORTS = new Set([
  "designation-asc",
  "designation-desc",
  "name-asc",
  "name-desc",
  "weight-asc",
  "weight-desc"
]);
const SPECIMEN_RECORD_FIELDS = new Set([
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
const CATALOG_ITEM_RECORD_FIELDS = new Set([
  "id",
  "catalogId",
  "catalogItem",
  "holdings",
  "name",
  "classification",
  "locality",
  "year",
  "catalogPage",
  "confidence"
]);
const CATALOG_NUMBER_RECORD_FIELDS = new Set([
  "id",
  "catalogId",
  "catalogNumber",
  "holdings",
  "name",
  "classification",
  "locality",
  "dateOfDiscovery",
  "catalogPages",
  "confidence"
]);
const COLLECTION_ENTRY_RECORD_FIELDS = new Set([
  "id",
  "catalogId",
  "entryOrder",
  "reportedNumber",
  "catalogPages",
  "section",
  "holdings",
  "name",
  "classification",
  "locality",
  "eventDate",
  "confidence"
]);
const REGIONAL_CENSUS_FACT_RECORD_FIELDS = new Set([
  "id",
  "catalogId",
  "entryOrder",
  "reportedNumber",
  "section",
  "name",
  "classification",
  "eventDate",
  "australianMuseumRepresentation",
  "catalogPages",
  "confidence"
]);
const TABLE_A_SPECIMEN_RECORD_FIELDS = new Set([
  "id",
  "catalogId",
  "entryOrder",
  "specimenId",
  "weight",
  "classification",
  "olivineFa",
  "pyroxeneFs",
  "weathering",
  "locality",
  "catalogPage",
  "confidence"
]);
const DEALER_OFFER_FACT_RECORD_FIELDS = new Set([
  "id",
  "catalogId",
  "typeNumber",
  "name",
  "description",
  "catalogPage",
  "confidence"
]);
const HAMBURG_COLLECTION_ENTRY_RECORD_FIELDS = new Set([
  ...COLLECTION_ENTRY_RECORD_FIELDS,
  "reportedTotalWeight",
  "publicationState",
  "amendments"
]);
const METBULL_FIELDS = new Set(["matchType", "canonicalName", "meteoriteCode", "metbullUrl", "alternateNameNote"]);
const METBULL_MATCH_TYPES = new Set(["exact", "case-normalized-exact", "source-heading-exact", "historical-alias", "corrected-spelling", "translated-or-older-name", "unresolved"]);
const HOLDING_FIELDS = new Set(["designation", "kind", "description", "count", "weight"]);
const CATALOG_NUMBER_HOLDING_FIELDS = new Set(["description", "provenance", "count", "weights"]);
const HAMBURG_HOLDING_FIELDS = new Set([
  "description", "provenance", "count", "weights", "reportedTotalWeight", "representations"
]);
const HOLDING_KINDS = new Set(["specimen", "cast", "aggregate"]);
const HAMBURG_WEIGHT_KINDS = new Set(["individual-holding", "aggregate-holding", "associated-material"]);
const HAMBURG_PUBLICATION_STATES = new Set(["base-register", "supplement"]);
const RECORD_MODELS = new Set([
  "catalog-item", "specimen", "catalog-number", "collection-entry", "regional-census-fact", "table-a-specimen", "dealer-offer-fact"
]);
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
  "metbull.alternateNameNote"
];
const CONFIDENCE_LEVELS = ["high", "medium", "low"];
const CONFIDENCE_FIELDS = new Set(CONFIDENCE_LEVELS);
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
  "recordModel",
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
const FOLIO_PAGE_FIELDS = new Set(["pageId", "catalogPage", "pageLabel", "image", "alt"]);
const FOLIO_DISPLAY_POLICIES = new Set(["blocked", "display"]);
const FOLIO_RIGHTS_STATUSES = new Set(["undetermined", "public-domain", "no-copyright-us"]);
const FOLIO_DISPLAY_RIGHTS_STATUSES = new Set(["public-domain", "no-copyright-us"]);
const SPECIMEN_CARD_ROOT_FIELDS = new Set(["metadata", "projections"]);
const SPECIMEN_CARD_METADATA_FIELDS = new Set([
  "schemaVersion", "scope", "catalogSchemaVersion", "sourceRecordCount", "sourceCatalogSha256", "projectionCount", "atomicCardCount", "sourceContextCardCount"
]);
const SPECIMEN_CARD_PROJECTION_FIELDS = new Set(["parentRecordId", "cards"]);
const SPECIMEN_CARD_CLAUSE_CARD_FIELDS = new Set(["holdingPath", "clause", "massPath"]);
const SPECIMEN_CARD_REPEATED_CLAUSE_CARD_FIELDS = new Set(["holdingPath", "clause", "massPath", "repeatedMass"]);
const SPECIMEN_CARD_COMPONENT_FIELDS = new Set(["holdingPath", "componentPath", "massPath"]);
const SPECIMEN_CARD_CLAUSE_FIELDS = new Set(["textPath", "start", "end"]);
const SPECIMEN_CARD_REPEATED_MASS_FIELDS = new Set(["valuePath", "countPath", "totalPath", "occurrence", "occurrenceCount"]);
const SHA256_HEX = /^[0-9a-f]{64}$/u;
const SPECIMEN_CARD_SOURCE_CATALOG_SHA256 = "9a921861c782abe1218e2d3b33bc2fc0b229908ce0a3c08e93bdc2596b91c536";
const SPECIMEN_CARD_PROJECTION_DATA_SHA256 = "c8d705ac6b41ec9cbd16d67229efb454b9610e374e37c8b6f7b5eadd62109986";
const SPECIMEN_CARD_PROJECTION_SET_SHA256 = "8e7c185771d0a4bb135b0966416cc93dedfb0d8d09ede6f1c5c3a8dd0bba41cf";
const SPECIMEN_LINEAGE_DATA_SHA256 = "4c1bc76827dcbf9673d6c78d65ee00a768dec8dde0fd2cb10b628c6fc9636233";
const LINEAGE_ROOT_FIELDS = new Set(["metadata", "relationships"]);
const LINEAGE_METADATA_FIELDS = new Set(["schemaVersion", "scope", "source", "collectionSeries", "methodology", "counts"]);
const LINEAGE_SOURCE_FIELDS = new Set(["catalogSchemaVersion", "recordCount", "catalogCount", "flattenedMassObservationCount", "inventoryObservationCount"]);
const LINEAGE_SERIES_FIELDS = new Set(["id", "catalogIds"]);
const LINEAGE_METHODOLOGY_FIELDS = new Set(["inventoryNormalization", "possibleMatchIdentity", "massThresholds", "ambiguityPolicy", "evidenceStrengthOrder", "nonAssertions"]);
const LINEAGE_INVENTORY_NORMALIZATION_FIELDS = new Set(["unicode", "case", "whitespace", "hussEditionMarker"]);
const LINEAGE_POSSIBLE_IDENTITY_FIELDS = new Set(["resolved", "unresolved"]);
const LINEAGE_MASS_THRESHOLD_FIELDS = new Set(["exactDifferenceGrams", "nearMinimumMassGrams", "nearMaximumRelativeDifference", "nearMaximumAbsoluteDifferenceGrams"]);
const LINEAGE_COUNT_FIELDS = new Set([
  "relationshipCount", "sameInventoryRelationshipCount", "possibleMatchRelationshipCount", "unreviewedPossibleMatchCount",
  "exactMassPossibleMatchCount", "nearMassPossibleMatchCount", "metbullIdentityPossibleMatchCount", "normalizedNameIdentityPossibleMatchCount",
  "sameDesignationPossibleMatchCount", "designationFamilyPossibleMatchCount", "aggregateOrMultiplePossibleMatchCount", "castPossibleMatchCount",
  "identityResolvedInventoryCollisionCount", "omittedAmbiguousInventoryKeyCount", "possibleMatchEvidenceStrength", "catalogPairs"
]);
const LINEAGE_STRENGTHS = ["multiple-matching-facts", "two-matching-facts", "limited-matching-evidence"];
const LINEAGE_STRENGTH_FIELDS = new Set(LINEAGE_STRENGTHS);
const LINEAGE_PAIR_COUNT_FIELDS = new Set(["catalogPair", "sameInventoryCount", "possibleMatchCount"]);
const LINEAGE_RELATIONSHIP_FIELDS = new Set(["id", "relationship", "basis", "status", "displayName", "catalogPair", "collectionSeries", "identity", "evidence", "review", "observations"]);
const LINEAGE_COLLECTION_SERIES_FIELDS = new Set(["id", "inventoryId"]);
const LINEAGE_IDENTITY_FIELDS = new Set(["method", "key", "canonicalName"]);
const LINEAGE_EVIDENCE_FIELDS = new Set(["strength", "massMatch", "absoluteDifferenceGrams", "relativeDifference", "sameDesignation", "designationFamily", "factCodes", "cautionCodes"]);
const LINEAGE_REVIEW_FIELDS = new Set(["status", "outcome", "reviewedOn", "publicNote", "citations"]);
const LINEAGE_OBSERVATION_FIELDS = new Set([
  "id", "recordId", "catalogId", "catalogLabel", "catalogYear", "recordModel", "designationPath", "massPath", "sourceRecordLabel",
  "sourceName", "canonicalName", "meteoriteCode", "designation", "massGrams", "kind", "count", "catalogSearchUrl"
]);
const LINEAGE_RELATIONSHIP_ID = /^(?:same-inventory-lineage|possible-lineage)-[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const LINEAGE_OBSERVATION_ID = /^(?:inventory|mass)-observation-[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const LINEAGE_RECORD_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const LINEAGE_IDENTITY_METHODS = new Set(["metbull-code", "normalized-source-name"]);
const LINEAGE_MASS_MATCHES = new Set(["exact", "near"]);
const LINEAGE_CAUTION_CODES = new Set(["normalized-name-identity", "near-reported-mass", "designation-differs-or-missing", "aggregate-or-multiple", "cast"]);
const LINEAGE_FACT_CODE_ORDER = ["shared-metbull-code", "shared-normalized-source-name", "exact-reported-mass", "near-reported-mass", "same-designation", "designation-family"];
const LINEAGE_CAUTION_CODE_ORDER = ["normalized-name-identity", "near-reported-mass", "designation-differs-or-missing", "aggregate-or-multiple", "cast"];
const LINEAGE_FACT_CODES = new Set(LINEAGE_FACT_CODE_ORDER);
const LINEAGE_COLLECTION_SERIES = [
  { id: "huss", catalogIds: ["huss-1976", "huss-1986"] },
  { id: "nininger", catalogIds: ["nininger-1933", "nininger-1950"] }
];
const LINEAGE_UUID_NAMESPACE = "65b19e0b-1f86-5ca5-a65b-81c38ec53040";
const LINEAGE_STRENGTH_LABELS = {
  "multiple-matching-facts": "Multiple matching facts",
  "two-matching-facts": "Two matching facts",
  "limited-matching-evidence": "Limited matching evidence"
};
const MAX_CATALOG_ID_LENGTH = 80;
const MAX_DESCRIPTOR_TEXT_LENGTH = 160;
const PRIVATE_LANGUAGE =
  /\b(?:raw[\s_-]*(?:ocr|text|transcript(?:ion)?)|ocr[\s_-]*(?:batch|output|text)|source[\s_-]*(?:image|file)(?:[\s_-]*name)?s?|scan(?:ned)?[\s_-]*(?:image|file|path|name)s?|(?:private|research|transcription|verbatim|working)[\s_-]*notes?|(?:private|working)[\s_-]*(?:text|transcript(?:ion)?)|image[\s_-]*derivatives?)\b/iu;
const PRIVATE_LABEL =
  /^(?:notes?|verbatim\s+notes?|ocr|ocr\s+text|raw\s*(?:ocr|text)|source\s*(?:images?|files?|filenames?)|scans?|images?|paths?|weight(?:\s+|\.)display)$/iu;
const IMAGE_LIKE_STRING =
  /\.(?:arw|avif|bmp|cr2|cr3|csv|dat|dng|docx?|gif|heic|heif|hocr|jpe?g|jsonl?|log|md|nef|ocr|orf|pdf|pef|png|raf|rtf|rw2|srw|svg|text|tiff?|tsv|txt|webp|xml|ya?ml)(?=$|[^A-Za-z0-9])|\b(?:dscn?|img|pxl)[_-]?\d{3,}\b/iu;
const OCR_BATCH_OR_CAMERA_TIMESTAMP =
  /\b(?:ocr[\s_-]*)?batch[\s_-]*\d{1,5}(?:\.[A-Za-z0-9]{2,5})?\b|\b(?:19|20)\d{6}[_-]\d{6}(?:[_-]\d+)?(?:\.[A-Za-z0-9]{2,5})?\b/iu;
const FACTUAL_FORMULA_TOKENS = Object.freeze([
  "/Tii-vJatllO", "/-I", "/Nickel iron", "/?e/ermces", "(.\\l2O3)", "\\ 1.753",
  "D?i\\\\hvQQ", "\\i.", "\\N.", "\\N\\\\\\\\^m", "\\\\.", "\\iin.",
]);
const FACTUAL_FORMULA_UNSAFE_PREFIXES = Object.freeze([
  "C:", "file:", "https:", "ftp:", "scheme:",
]);
const FACTUAL_FORMULA_VALID_SUFFIXES = Object.freeze([
  "", " factual", ",", ";", ".", "!", "?", "—", ".—", ", factual",
]);
const FACTUAL_FORMULA_INVALID_SUFFIXES = Object.freeze([
  "/private", "\\private", ".private", ",/private", ",\\private", ";/private", ";\\private",
  "./private", ".\\private", " /private", " \\private", ",.private",
]);
const PATH_TOKEN_LEADING_CHAR = /[A-Za-z0-9._~\\/-]/u;
const TERMINAL_PUNCTUATION = /\p{P}/u;
const STRICT_PATH_LIKE_STRING =
  /[A-Za-z][A-Za-z\d+.-]*:\/\/|(?:^|[^A-Za-z0-9._~-])(?:(?:[\\/]{2}(?=\S)|[\\/](?![\\/])(?=\S))|\.{1,2}[\\/](?=\S)|~[\\/]|[A-Za-z]:[\\/]|(?:assets?|files?|folios?|images?|scans?|source[\s_-]*images?)[\\/])/iu;
const HOLDING_PRIVATE_LANGUAGE = /\bocr\b|\b(?:review(?:er)?|research|transcript(?:ion)?|verbatim|working|private)[\s_-]+notes?\b|\bpage[\s_-]*(?:id|identifier)\b|\bpage[_-]\d+\b|\b(?:private[\s_-]*source|source[\s_-]*page)\b/iu;
const HOLDING_PRIVATE_DOCUMENT = /(?:^|[\s"'(])(?:source|private|data)[\\/][^\s"')]+|\.(?:dat|csv|docx?|json|md|odt|rtf|txt|xlsx?|xml)(?=$|[^A-Za-z0-9])/iu;
const HOLDING_WEIGHT_DISPLAY = /\b\d[\d,.]*\s+(?:g|grs?|grams?|kg|kgs?|kilograms?)\.?(?![A-Za-z0-9])/iu;
const integerFormat = new Intl.NumberFormat("en-US");
const massFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });
const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

function secureRandomInteger(minimum, maximum, fillRandomValues = (values) => globalThis.crypto.getRandomValues(values)) {
  if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum > maximum) {
    throw new RangeError("Random integer bounds must be ordered integers.");
  }
  const range = maximum - minimum + 1;
  if (range < 1 || range > 0x100000000) throw new RangeError("Random integer range is too large.");
  const upperLimit = Math.floor(0x100000000 / range) * range;
  const values = new Uint32Array(1);
  do fillRandomValues(values); while (values[0] >= upperLimit);
  return minimum + (values[0] % range);
}

function createIssueReportChallenge(randomInteger = secureRandomInteger) {
  const left = randomInteger(2, 12);
  const right = randomInteger(2, 12);
  return { left, right, answer: left + right };
}

function evaluateIssueReportGate({
  answer,
  expectedAnswer,
  honeypot = "",
  openedAt,
  now,
  minimumElapsedMs = ISSUE_REPORT_MINIMUM_ELAPSED_MS
}) {
  if (String(honeypot).trim()) return { ok: false, reason: "honeypot" };
  if (!Number.isFinite(openedAt) || !Number.isFinite(now) || now - openedAt < minimumElapsedMs) {
    return { ok: false, reason: "too-fast" };
  }
  const submittedAnswer = String(answer ?? "").trim();
  if (!/^\d+$/u.test(submittedAnswer) || !Number.isInteger(expectedAnswer) || Number(submittedAnswer) !== expectedAnswer) {
    return { ok: false, reason: "wrong-answer" };
  }
  return { ok: true, reason: "success" };
}

const elements = typeof document === "undefined" || !document.querySelector("#filter-form") ? null : {
  form: document.querySelector("#filter-form"),
  catalogSummary: document.querySelector("#catalog-summary"),
  search: document.querySelector("#search"),
  catalog: document.querySelector("#catalog-filter"),
  min: document.querySelector("#min-weight"),
  max: document.querySelector("#max-weight"),
  lineageOnly: document.querySelector("#lineage-only"),
  includeUnknownWeight: document.querySelector("#include-unknown-weight"),
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
  issueReportOpen: document.querySelector("#issue-report-open"),
  issueReportDialog: document.querySelector("#issue-report-dialog"),
  issueReportClose: document.querySelector("#issue-report-close"),
  issueReportCancel: document.querySelector("#issue-report-cancel"),
  issueReportForm: document.querySelector("#issue-report-form"),
  issueReportQuestion: document.querySelector("#issue-report-question"),
  issueReportAnswer: document.querySelector("#issue-report-answer"),
  issueReportHoneypot: document.querySelector("#issue-report-website"),
  issueReportError: document.querySelector("#issue-report-error"),
  stats: {
    specimens: document.querySelector("#stat-specimens"),
    names: document.querySelector("#stat-names"),
    pages: document.querySelector("#stat-pages"),
    mass: document.querySelector("#stat-mass"),
    catalogs: document.querySelector("#stat-catalogs")
  }
};

let records = [];
let catalogRegistry = {};
let folioManifest = null;
let earlierRecordsByLaterId = new Map();
let specimenCardProjectionsByParentId = new Map();
let activeFolioPages = [];
let activeFolioIndex = -1;
let folioOpener = null;
let issueReportOpener = null;
let issueReportChallenge = null;
let issueReportOpenedAt = 0;
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

function numericLeadingHoldingCode(value) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/\s+/g, "");
  return /^\d+[a-z]+$/.test(normalized) ? normalized : null;
}

function matchesTokenPrefixes(haystack, queryTerms) {
  const haystackTerms = haystack.split(/\s+/);
  return queryTerms.every((term) => haystackTerms.some((candidate) => candidate.startsWith(term)));
}

function matchesSearch(record, rawQuery) {
  const query = searchable(rawQuery);
  if (!query) return true;

  const recordIdQuery = String(rawQuery || "").trim().match(/^record\s+id\s+(.+)$/iu);
  if (recordIdQuery) return record.id === recordIdQuery[1].trim();

  const catalogNumberQuery = query.match(/^catalog no (.+)$/);
  if (catalogNumberQuery && record.catalogNumber !== undefined) {
    return searchable(record.catalogNumber) === catalogNumberQuery[1];
  }
  const reportedNumberQuery = query.match(/^reported no (.+)$/);
  if (reportedNumberQuery && record.reportedNumber !== undefined) {
    return searchable(record.reportedNumber) === reportedNumberQuery[1];
  }
  const catalogItemQuery = query.match(/^catalog item (\d+)$/);
  if (catalogItemQuery) return record.catalogItem === Number(catalogItemQuery[1]);
  const collectionEntryQuery = query.match(/^collection entry (\d+)$/);
  if (collectionEntryQuery) return record.entryOrder === Number(collectionEntryQuery[1]);
  const typeNumberQuery = query.match(/^type number (\d+)$/);
  if (typeNumberQuery) return record.typeNumber === Number(typeNumberQuery[1]);
  const holdingCodeQuery = numericLeadingHoldingCode(rawQuery);
  if (holdingCodeQuery) {
    return numericLeadingHoldingCode(record.designation) === holdingCodeQuery ||
      (Array.isArray(record.holdings) && record.holdings.some(
        (holding) => numericLeadingHoldingCode(holding.designation) === holdingCodeQuery
      ));
  }
  const compactQuery = query.replace(/ /g, "");
  if (!designationComponents(rawQuery) && recordDesignations(record).some(
    (designation) => searchable(designation).replace(/ /g, "") === compactQuery
  )) return true;

  const numericQuery = String(rawQuery || "").trim();
  if (/^\d+$/.test(numericQuery)) {
    if (record.recordModel === "table-a-specimen" && String(record.weight?.grams) === numericQuery) return true;
    if (record.catalogNumber !== undefined && searchable(record.catalogNumber).split(/\s+/).includes(numericQuery)) return true;
    if (record.reportedNumber !== undefined && searchable(record.reportedNumber).split(/\s+/).includes(numericQuery)) return true;
    const yearTokens = searchable([record.year, record.dateOfDiscovery, record.eventDate].filter(Boolean).join(" ")).split(/\s+/).filter(Boolean);
    const holdingTokens = new Set(searchable((record.holdings || []).flatMap((holding) => [
      holding.designation,
      holding.description,
      holding.provenance
    ]).filter(Boolean).join(" ")).split(/\s+/).filter(Boolean));
    return String(record.catalogItem || "") === numericQuery || String(record.entryOrder || "") === numericQuery ||
      String(record.typeNumber || "") === numericQuery ||
      recordDesignations(record).some((designation) => String(designation).trim() === numericQuery) ||
      yearTokens.includes(numericQuery) || holdingTokens.has(numericQuery);
  }

  const parsedQuery = parseSearchQuery(rawQuery);
  if (parsedQuery.designations.length) {
    const recordSegments = record.designationSegmentsList || recordDesignations(record)
      .map(designationComponents)
      .filter(Boolean);
    const designationMatches = parsedQuery.designations.every((querySegments) => recordSegments.some((segments) =>
      querySegments.every((segment, index) => segments[index] === segment)
    ));
    const haystack = record.searchText || searchable([
      ...recordDesignations(record),
      record.catalogItem,
      record.catalogNumber,
      record.entryOrder,
      record.reportedNumber,
      record.section,
      record.name,
      record.classification,
      record.locality,
      record.year,
      record.dateOfDiscovery,
      record.eventDate
    ].filter(Boolean).join(" "));
    if (!designationMatches) {
      const haystackTerms = new Set(haystack.split(/\s+/));
      return parsedQuery.designations.length === 1 &&
        parsedQuery.textTerms.length === 0 &&
        query.split(/\s+/).every((term) => haystackTerms.has(term));
    }
    return matchesTokenPrefixes(haystack, parsedQuery.textTerms);
  }

  const queryDesignation = genericDesignation(rawQuery);
  if (queryDesignation) {
    const recordDesignationKeys = record.designationKeys || recordDesignations(record)
      .map(genericDesignation)
      .filter(Boolean);
    const designationMatches = recordDesignationKeys.some((recordDesignation) =>
      queryDesignation.prefix === recordDesignation.prefix &&
      queryDesignation.segments.every((segment, index) => recordDesignation.segments[index] === segment)
    );
    if (designationMatches) return true;
    const haystack = record.searchText || searchable([
      ...recordDesignations(record),
      record.catalogItem,
      record.catalogNumber,
      record.entryOrder,
      record.reportedNumber,
      record.section,
      record.name,
      record.classification,
      record.locality,
      record.year,
      record.dateOfDiscovery,
      record.eventDate
    ].filter(Boolean).join(" "));
    const haystackTerms = new Set(haystack.split(/\s+/));
    return query.split(/\s+/).every((term) => haystackTerms.has(term));
  }

  const haystack = record.searchText || searchable([
    ...recordDesignations(record),
    record.catalogItem,
    record.catalogNumber,
    record.entryOrder,
    record.reportedNumber,
    record.section,
    record.name,
    record.classification,
    record.locality,
    record.year,
    record.dateOfDiscovery,
    record.eventDate
  ].filter(Boolean).join(" "));
  return matchesTokenPrefixes(haystack, query.split(/\s+/));
}

function recordDesignations(record) {
  if (record?.specimenId !== undefined) return record.specimenId ? [record.specimenId] : [];
  if (record?.catalogNumber !== undefined || record?.entryOrder !== undefined) return [];
  if (Array.isArray(record?.holdings)) {
    return record.holdings.map((holding) => holding.designation).filter(Boolean);
  }
  return record?.designation ? [record.designation] : [];
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

function hasFormulaLeadingBoundary(value, index) {
  return index === 0 || (value[index - 1] !== ":" && !PATH_TOKEN_LEADING_CHAR.test(value[index - 1]));
}

function hasFormulaTrailingBoundary(value, index) {
  if (index === value.length) return true;
  if (/\s/u.test(value[index])) return true;
  if (!TERMINAL_PUNCTUATION.test(value[index])) return false;
  let cursor = index;
  while (cursor < value.length && TERMINAL_PUNCTUATION.test(value[cursor])) {
    if (value[cursor] === "/" || value[cursor] === "\\") return false;
    cursor += 1;
  }
  return cursor === value.length || /\s/u.test(value[cursor]);
}

function maskFactualFormulaTokens(value) {
  const intervals = [];
  for (const token of FACTUAL_FORMULA_TOKENS) {
    let index = -1;
    while ((index = value.indexOf(token, index + 1)) !== -1) {
      if (!hasFormulaLeadingBoundary(value, index)) {
        if (value[index - 1] === ":") return null;
        continue;
      }
      const end = index + token.length;
      if (!hasFormulaTrailingBoundary(value, end)) return null;
      intervals.push([index, end]);
    }
  }
  if (intervals.length === 0) return value;
  intervals.sort(([left], [right]) => left - right);
  let cursor = 0;
  let masked = "";
  for (const [start, end] of intervals) {
    if (start < cursor) continue;
    masked += value.slice(cursor, start) + " ".repeat(end - start);
    cursor = end;
  }
  return masked + value.slice(cursor);
}

function containsUnsafePath(value) {
  const masked = maskFactualFormulaTokens(value);
  return masked === null || STRICT_PATH_LIKE_STRING.test(masked);
}

function isLeakageSafeText(value) {
  return typeof value === "string" && value === normalizedText(value) &&
    !/[\p{Cc}\p{Cf}]/u.test(value) && !PRIVATE_LABEL.test(value) &&
    !PRIVATE_LANGUAGE.test(value) && !IMAGE_LIKE_STRING.test(value) &&
    !OCR_BATCH_OR_CAMERA_TIMESTAMP.test(value) && !containsUnsafePath(value);
}

function isLeakageSafeHoldingText(value, allowWeightDisplay = false) {
  return isLeakageSafeText(value) && !HOLDING_PRIVATE_LANGUAGE.test(value) &&
    !HOLDING_PRIVATE_DOCUMENT.test(value) && (allowWeightDisplay || !HOLDING_WEIGHT_DISPLAY.test(value));
}

function isLeakageSafeTree(value) {
  if (typeof value === "string") return isLeakageSafeText(value);
  if (Array.isArray(value)) return value.every(isLeakageSafeTree);
  if (!isPlainObject(value)) return true;
  return Object.entries(value).every(([key, child]) => key === "metbullUrl" || isLeakageSafeTree(child));
}

function metbullUrlForCode(code) {
  return `https://www.lpi.usra.edu/meteor/metbull.cfm?code=${code}`;
}

function differsOnlyByCase(sourceName, canonicalName) {
  return typeof sourceName === "string" && typeof canonicalName === "string" && sourceName !== canonicalName &&
    sourceName.toLocaleLowerCase("en-US") === canonicalName.toLocaleLowerCase("en-US");
}

function hasValidMetbull(value, sourceName) {
  if (!hasExactFields(value, METBULL_FIELDS) || !METBULL_MATCH_TYPES.has(value.matchType)) return false;
  if (value.alternateNameNote !== null &&
      (!isLeakageSafeText(value.alternateNameNote) || value.alternateNameNote.length > 500)) return false;
  if (value.matchType === "unresolved") {
    return value.canonicalName === null && value.meteoriteCode === null && value.metbullUrl === null;
  }
  const namesAgree = value.matchType === "case-normalized-exact"
    ? differsOnlyByCase(sourceName, value.canonicalName)
    : value.matchType === "exact" ? sourceName === value.canonicalName : sourceName !== value.canonicalName;
  return isLeakageSafeText(value.canonicalName) && value.canonicalName.length <= 200 &&
    typeof value.meteoriteCode === "string" && /^[1-9][0-9]{0,9}$/.test(value.meteoriteCode) &&
    value.metbullUrl === metbullUrlForCode(value.meteoriteCode) &&
    namesAgree;
}

function hasValidHamburgHolding(holding) {
  if (!hasExactFields(holding, HAMBURG_HOLDING_FIELDS) || holding.description === "" ||
      !isLeakageSafeHoldingText(holding.description, true) || holding.provenance !== null ||
      (holding.count !== null && (!Number.isInteger(holding.count) || holding.count <= 0)) ||
      !Array.isArray(holding.weights) || !Array.isArray(holding.representations)) return false;
  if (!holding.weights.every((weight) => hasExactFields(weight, new Set(["grams", "kind"])) &&
      Number.isFinite(weight.grams) && weight.grams >= 0 && HAMBURG_WEIGHT_KINDS.has(weight.kind))) return false;
  if (holding.reportedTotalWeight !== null && (!hasExactFields(holding.reportedTotalWeight, new Set(["grams"])) ||
      !Number.isFinite(holding.reportedTotalWeight.grams) || holding.reportedTotalWeight.grams < 0)) return false;
  return holding.representations.every((representation) =>
    hasExactFields(representation, new Set(["kind", "count"])) && representation.kind === "thin-section" &&
    Number.isInteger(representation.count) && representation.count > 0
  );
}

function hasValidHamburgAmendments(record) {
  if (!Array.isArray(record.amendments) || record.amendments.length !== (record.entryOrder === 105 ? 1 : 0)) return false;
  if (!record.amendments.length) return true;
  const amendment = record.amendments[0];
  if (!(hasExactFields(amendment, new Set([
    "kind", "effectiveDate", "targetHolding", "targetComponentOrder", "targetWeight", "resultingState",
    "destination", "baseObservationRetained"
  ])) && amendment.kind === "disposal-by-exchange" && amendment.effectiveDate === "1913-08" &&
    amendment.targetHolding === "Gibeon, Deutsch-Südwestafrika" && amendment.targetComponentOrder === 5 &&
    hasExactFields(amendment.targetWeight, new Set(["grams"])) && amendment.targetWeight.grams === 14500 &&
    amendment.resultingState === "disposed" && amendment.destination === null && amendment.baseObservationRetained === true)) return false;
  const targetComponent = record.holdings?.[1]?.weights?.[amendment.targetComponentOrder - 1];
  return targetComponent?.kind === "individual-holding" && targetComponent.grams === amendment.targetWeight.grams;
}

function hasValidAustralianMuseumRepresentation(value) {
  if (!hasExactFields(value, new Set(["status", "representedOccurrences", "notRepresentedOccurrences"]))) return false;
  const represented = value.representedOccurrences;
  const notRepresented = value.notRepresentedOccurrences;
  if (!Number.isInteger(represented) || represented < 0 || !Number.isInteger(notRepresented) || notRepresented < 0 ||
      represented + notRepresented === 0) return false;
  const expectedStatus = represented === 0 ? "not-represented" : notRepresented === 0 ? "represented" : "mixed";
  return value.status === expectedStatus;
}

function hasValidTableALocality(value) {
  return hasExactFields(value, new Set(["code", "name", "coordinate"])) &&
    typeof value.code === "string" && /^[A-Z]{3}$/u.test(value.code) &&
    isLeakageSafeText(value.name) && value.name !== "" &&
    (value.coordinate === null || (value.coordinate !== "" && isLeakageSafeText(value.coordinate)));
}

function recordFields(record, baseFields, allowIndividualFindLocation = false) {
  const fields = new Set(baseFields);
  if (allowIndividualFindLocation && Object.hasOwn(record, "individualFindLocation")) fields.add("individualFindLocation");
  if (Object.hasOwn(record, "metbull")) fields.add("metbull");
  return fields;
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

function compareCanonicalText(left, right) {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left < right ? -1 : 1;
}

function canonicalDesignationParts(value) {
  if (value === null) return null;
  const prefix = value.match(/^[A-Za-z]*/u)?.[0] ?? "";
  const numbers = value.match(/\d+/gu)?.map(Number);
  requireSchema(numbers?.length);
  return { prefix, numbers };
}

function compareCanonicalDesignation(left, right) {
  const leftParts = canonicalDesignationParts(left);
  const rightParts = canonicalDesignationParts(right);
  if (leftParts === null || rightParts === null) {
    if (leftParts === rightParts) return 0;
    return leftParts === null ? 1 : -1;
  }
  const prefixOrder = compareCanonicalText(leftParts.prefix, rightParts.prefix);
  if (prefixOrder) return prefixOrder;
  const length = Math.min(leftParts.numbers.length, rightParts.numbers.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftParts.numbers[index] - rightParts.numbers[index];
    if (difference) return difference;
  }
  return leftParts.numbers.length - rightParts.numbers.length;
}

function compareCanonicalNullableNumber(left, right) {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}

function canonicalModelSortOrder(recordModel) {
  if (recordModel === "catalog-item") return 0;
  if (recordModel === "specimen") return 1;
  if (recordModel === "catalog-number") return 2;
  if (recordModel === "dealer-offer-fact") return 4;
  return 3;
}

function compareCanonicalRecords(left, right, registry) {
  const leftModel = registry[left.catalogId].recordModel;
  const rightModel = registry[right.catalogId].recordModel;
  const modelOrder = canonicalModelSortOrder(leftModel) - canonicalModelSortOrder(rightModel);
  if (modelOrder) return modelOrder;
  if (leftModel === "catalog-item") {
    return left.catalogItem - right.catalogItem ||
      compareCanonicalText(left.name, right.name) || compareCanonicalText(left.id, right.id);
  }
  if (leftModel === "catalog-number") {
    return left.catalogPages[0] - right.catalogPages[0] ||
      compareCanonicalText(left.catalogNumber, right.catalogNumber) ||
      compareCanonicalText(left.name, right.name) || compareCanonicalText(left.id, right.id);
  }
  if (["collection-entry", "regional-census-fact", "table-a-specimen"].includes(leftModel)) {
    return compareCanonicalText(left.catalogId, right.catalogId) ||
      left.entryOrder - right.entryOrder || compareCanonicalText(left.id, right.id);
  }
  if (leftModel === "dealer-offer-fact") {
    return compareCanonicalText(left.catalogId, right.catalogId) ||
      left.typeNumber - right.typeNumber || compareCanonicalText(left.id, right.id);
  }
  const identityOrder = compareCanonicalDesignation(left.designation, right.designation);
  const leftMasses = recordMasses(left);
  const rightMasses = recordMasses(right);
  return identityOrder || compareCanonicalText(left.name, right.name) ||
    compareCanonicalNullableNumber(leftMasses.length ? Math.min(...leftMasses) : null,
      rightMasses.length ? Math.min(...rightMasses) : null) ||
    compareCanonicalText(left.id, right.id);
}

function hasValidCatalogPolicy(descriptor) {
  return FOLIO_DISPLAY_POLICIES.has(descriptor.folioDisplayPolicy) &&
    FOLIO_RIGHTS_STATUSES.has(descriptor.rightsStatus) &&
    (descriptor.folioDisplayPolicy === "display"
      ? FOLIO_DISPLAY_RIGHTS_STATUSES.has(descriptor.rightsStatus)
      : descriptor.rightsStatus === "undetermined");
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
  requireSchema(RECORD_MODELS.has(descriptor.recordModel));
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

function catalogDropdownLabel(descriptor, catalogId = "") {
  const id = cleanText(catalogId || descriptor?.id);
  const idMatch = id?.match(/^(.+?)-(\d{4})(?:-\d{2})?$/u);
  const sourceId = idMatch?.[1] || id;
  const sourceAliases = {
    "asu": "ASU",
    "hogbom": "Högbom",
    "nordenskiold": "Nordenskiöld",
    "usnm": "USNM"
  };
  const source = sourceAliases[sourceId] || sourceId
    ?.split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toLocaleUpperCase()}${part.slice(1)}`)
    .join(" ");
  const year = Number.isInteger(descriptor?.year)
    ? String(descriptor.year)
    : cleanText(descriptor?.year) || idMatch?.[2];
  if (source && year) return `${source} (${year})`;
  return source || catalogLabel(descriptor, id || "");
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
  const entries = Array.isArray(catalogs)
    ? catalogs.map((descriptor) => [descriptor.id, descriptor])
    : Object.entries(catalogs || {});
  return entries.sort(compareCatalogEntries).map(([, descriptor]) => ({
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
    const folios = getAuthorizedFolioPages(folioManifest, summary.id, catalogRegistry);
    if (folios.length) {
      const button = document.createElement("button");
      button.className = "folio-button";
      button.type = "button";
      button.textContent = "Browse all source images";
      button.setAttribute("aria-label", `Browse all source images for ${summary.label}`);
      button.addEventListener("click", () => openFolioDialog(summary.id, folios[0].pageId, button));
      item.append(button);
    }
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
  requireSchema(hasExactFields(metadata, CANONICAL_METADATA_FIELDS));
  requireSchema(metadata.schemaVersion === CATALOG_SCHEMA_VERSION && metadata.scope === "facts-only" && hasFactualFields(metadata.factualFields));
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
  const catalogItemNumbers = {};
  const previousCatalogItems = {};
  const catalogNumbers = {};
  const dealerTypeNumbers = {};
  const collectionEntryOrders = {};
  const previousCollectionEntries = {};
  const statistics = Object.fromEntries(Object.keys(registry).map((catalogId) => [catalogId, emptyCatalogStatistics()]));

  catalog.records.forEach((record, index) => {
    requireSchema(hasValidRecordId(record.id) && !ids.has(record.id));
    ids.add(record.id);
    requireSchema(hasValidCatalogId(record.catalogId) && Object.hasOwn(registry, record.catalogId));
    const recordModel = registry[record.catalogId].recordModel;
    requireSchema(recordModel === "specimen"
      ? hasExactFields(record, recordFields(record, SPECIMEN_RECORD_FIELDS, true)) && hasExactFields(record.weight, new Set(["grams"]))
      : recordModel === "catalog-item"
        ? hasExactFields(record, recordFields(record, CATALOG_ITEM_RECORD_FIELDS))
        : recordModel === "catalog-number"
          ? hasExactFields(record, recordFields(record, CATALOG_NUMBER_RECORD_FIELDS))
          : recordModel === "regional-census-fact"
            ? hasExactFields(record, recordFields(record, REGIONAL_CENSUS_FACT_RECORD_FIELDS))
            : recordModel === "table-a-specimen"
              ? hasExactFields(record, recordFields(record, TABLE_A_SPECIMEN_RECORD_FIELDS)) &&
                hasExactFields(record.weight, new Set(["grams"]))
              : recordModel === "dealer-offer-fact"
                ? hasExactFields(record, DEALER_OFFER_FACT_RECORD_FIELDS)
                : hasExactFields(record, recordFields(record, record.catalogId === "hamburg-1913"
                  ? HAMBURG_COLLECTION_ENTRY_RECORD_FIELDS : COLLECTION_ENTRY_RECORD_FIELDS)));
    if (!["table-a-specimen", "dealer-offer-fact"].includes(recordModel)) {
      const dateField = recordModel === "catalog-number" ? "dateOfDiscovery" :
        ["collection-entry", "regional-census-fact"].includes(recordModel) ? "eventDate" : "year";
      ["name", "classification", dateField].forEach((field) =>
        requireSchema(record[field] === null || (record[field] !== "" && isLeakageSafeText(record[field])))
      );
      if (recordModel !== "regional-census-fact") {
        requireSchema(record.locality === null || (record.locality !== "" && isLeakageSafeText(record.locality)));
      }
    }
    if (Object.hasOwn(record, "metbull")) requireSchema(hasValidMetbull(record.metbull, record.name));
    if (recordModel === "specimen") {
      requireSchema(record.designation === null || (record.designation !== "" && isLeakageSafeText(record.designation)));
      requireSchema(record.weight.grams === null || (Number.isFinite(record.weight.grams) && record.weight.grams >= 0));
      if (Object.hasOwn(record, "individualFindLocation")) {
        requireSchema(record.individualFindLocation !== "" && record.individualFindLocation.length <= 200 &&
          isLeakageSafeText(record.individualFindLocation));
      }
      requireSchema(record.designation !== null || record.name !== null || record.weight.grams !== null ||
        record.classification !== null || record.locality !== null || record.year !== null);
    } else if (recordModel === "catalog-item") {
      requireSchema(Number.isInteger(record.catalogItem) && record.catalogItem > 0);
      const itemNumbers = catalogItemNumbers[record.catalogId] || new Set();
      requireSchema(!itemNumbers.has(record.catalogItem));
      requireSchema(previousCatalogItems[record.catalogId] === undefined ||
        record.catalogItem > previousCatalogItems[record.catalogId]);
      itemNumbers.add(record.catalogItem);
      catalogItemNumbers[record.catalogId] = itemNumbers;
      previousCatalogItems[record.catalogId] = record.catalogItem;
      requireSchema(Array.isArray(record.holdings) && record.holdings.length > 0);
      record.holdings.forEach((holding) => {
        requireSchema(hasExactFields(holding, HOLDING_FIELDS) && hasExactFields(holding.weight, new Set(["grams"])));
        requireSchema(holding.designation === null || (holding.designation !== "" && isLeakageSafeHoldingText(holding.designation)));
        requireSchema(HOLDING_KINDS.has(holding.kind));
        requireSchema(holding.description === null || (holding.description !== "" && isLeakageSafeHoldingText(holding.description)));
        requireSchema(holding.count === null || (Number.isInteger(holding.count) && holding.count > 0));
        requireSchema(holding.weight.grams === null || (Number.isFinite(holding.weight.grams) && holding.weight.grams >= 0));
        if (holding.kind === "specimen") {
          requireSchema(holding.designation !== null && holding.count === null && holding.weight.grams !== null);
        } else if (holding.kind === "cast") {
          requireSchema(holding.designation !== null && holding.count === null && holding.weight.grams === null);
        } else {
          requireSchema(holding.description !== null && (holding.count !== null || holding.weight.grams !== null));
        }
      });
    } else if (recordModel === "dealer-offer-fact") {
      requireSchema(Number.isInteger(record.typeNumber) && record.typeNumber > 0);
      const typeNumbers = dealerTypeNumbers[record.catalogId] || [];
      requireSchema(!typeNumbers.includes(record.typeNumber) &&
        (!typeNumbers.length || record.typeNumber > typeNumbers[typeNumbers.length - 1]));
      typeNumbers.push(record.typeNumber);
      dealerTypeNumbers[record.catalogId] = typeNumbers;
      requireSchema(record.name !== "" && isLeakageSafeText(record.name));
      requireSchema(record.description !== "" && isLeakageSafeText(record.description));
    } else if (recordModel === "regional-census-fact") {
      requireSchema(Number.isInteger(record.entryOrder) && record.entryOrder > 0);
      const entryOrders = collectionEntryOrders[record.catalogId] || new Set();
      requireSchema(!entryOrders.has(record.entryOrder));
      entryOrders.add(record.entryOrder);
      collectionEntryOrders[record.catalogId] = entryOrders;
      requireSchema(record.reportedNumber === null || (record.reportedNumber !== "" && isLeakageSafeText(record.reportedNumber)));
      requireSchema(record.section !== "" && isLeakageSafeText(record.section));
      requireSchema(record.name !== "" && isLeakageSafeText(record.name));
      requireSchema(hasValidAustralianMuseumRepresentation(record.australianMuseumRepresentation));
    } else if (recordModel === "table-a-specimen") {
      requireSchema(Number.isInteger(record.entryOrder) && record.entryOrder > 0);
      const entryOrders = collectionEntryOrders[record.catalogId] || new Set();
      requireSchema(!entryOrders.has(record.entryOrder));
      entryOrders.add(record.entryOrder);
      collectionEntryOrders[record.catalogId] = entryOrders;
      const specimenIds = catalogNumbers[record.catalogId] || new Set();
      requireSchema(typeof record.specimenId === "string" && /^[A-Z]{3,4}[0-9]{5}$/u.test(record.specimenId) &&
        !specimenIds.has(record.specimenId));
      specimenIds.add(record.specimenId);
      catalogNumbers[record.catalogId] = specimenIds;
      requireSchema(Number.isFinite(record.weight.grams) && record.weight.grams > 0);
      requireSchema(record.classification !== "" && isLeakageSafeText(record.classification));
      ["olivineFa", "pyroxeneFs", "weathering"].forEach((field) => requireSchema(
        record[field] === null || (record[field] !== "" && isLeakageSafeText(record[field]))
      ));
      requireSchema(hasValidTableALocality(record.locality));
    } else {
      if (recordModel === "catalog-number") {
        requireSchema(record.catalogNumber !== "" && isLeakageSafeText(record.catalogNumber));
        const numbers = catalogNumbers[record.catalogId] || new Set();
        requireSchema(!numbers.has(record.catalogNumber));
        numbers.add(record.catalogNumber);
        catalogNumbers[record.catalogId] = numbers;
      } else {
        requireSchema(Number.isInteger(record.entryOrder) && record.entryOrder > 0);
        const entryOrders = collectionEntryOrders[record.catalogId] || new Set();
        requireSchema(!entryOrders.has(record.entryOrder));
        requireSchema(previousCollectionEntries[record.catalogId] === undefined ||
          record.entryOrder > previousCollectionEntries[record.catalogId]);
        entryOrders.add(record.entryOrder);
        collectionEntryOrders[record.catalogId] = entryOrders;
        previousCollectionEntries[record.catalogId] = record.entryOrder;
        requireSchema(record.reportedNumber === null ||
          (record.reportedNumber !== "" && isLeakageSafeText(record.reportedNumber)));
        requireSchema(record.section === null || (record.section !== "" && isLeakageSafeText(record.section)));
      }
      requireSchema(Array.isArray(record.holdings) && record.holdings.length > 0);
      record.holdings.forEach((holding) => {
        if (record.catalogId === "hamburg-1913") {
          requireSchema(hasValidHamburgHolding(holding));
          return;
        }
        requireSchema(hasExactFields(holding, CATALOG_NUMBER_HOLDING_FIELDS));
        requireSchema(holding.description !== "" && isLeakageSafeHoldingText(holding.description, true));
        requireSchema(holding.provenance === null || (holding.provenance !== "" && isLeakageSafeHoldingText(holding.provenance, true)));
        requireSchema(holding.count === null || (Number.isInteger(holding.count) && holding.count > 0));
        requireSchema(Array.isArray(holding.weights) && (recordModel !== "catalog-number" || holding.weights.length > 0));
        holding.weights.forEach((weight) => requireSchema(
          hasExactFields(weight, new Set(["grams"])) && Number.isFinite(weight.grams) && weight.grams >= 0
        ));
      });
      if (record.catalogId === "hamburg-1913") {
        requireSchema(record.reportedTotalWeight === null ||
          (hasExactFields(record.reportedTotalWeight, new Set(["grams"])) &&
            Number.isFinite(record.reportedTotalWeight.grams) && record.reportedTotalWeight.grams >= 0));
        requireSchema(HAMBURG_PUBLICATION_STATES.has(record.publicationState));
        requireSchema(hasValidHamburgAmendments(record));
      }
    }
    if (["catalog-number", "collection-entry", "regional-census-fact"].includes(recordModel)) {
      requireSchema(Array.isArray(record.catalogPages) && record.catalogPages.length > 0 && record.catalogPages.every((page, pageIndex) =>
        Number.isInteger(page) && page > 0 && registry[record.catalogId].sourcePages.includes(page) &&
        (pageIndex === 0 || page > record.catalogPages[pageIndex - 1])
      ));
    } else {
      requireSchema(Number.isInteger(record.catalogPage) && registry[record.catalogId].sourcePages.includes(record.catalogPage));
    }
    requireSchema(CONFIDENCE_LEVELS.includes(record.confidence));
    if (index) requireSchema(compareCanonicalRecords(catalog.records[index - 1], record, registry) < 0);

    const summary = statistics[record.catalogId];
    summary.recordCount += 1;
    summary.confidenceCounts[record.confidence] += 1;
    if (recordDesignations(record).length) summary.recordsWithDesignation += 1;
    if (recordSchemaMasses(record).length) summary.recordsWithWeight += 1;
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

function lineageSchemaError() {
  return new Error("The specimen-lineage data does not match its public contract.");
}

function requireLineage(condition) {
  if (!condition) throw lineageSchemaError();
}

function isLineageText(value, nullable = false) {
  if (nullable && value === null) return true;
  return typeof value === "string" && value.length > 0 && value.length <= 1000 &&
    value === value.normalize("NFC").trim() && !/[\p{Cc}\p{Cf}]/u.test(value);
}

function isSafeLineageSearchUrl(value, observation) {
  if (typeof value !== "string" || !/^\.\/index\.html\?catalog=[^&#]+&q=[^&#]+#catalog$/u.test(value)) return false;
  const expectedQuery = `record id ${observation.recordId}`;
  const expected = `./index.html?catalog=${encodeURIComponent(observation.catalogId)}&q=${encodeURIComponent(expectedQuery)}#catalog`;
  if (value !== expected) return false;
  try {
    const url = new URL(value, "https://lineages.invalid/");
    return url.origin === "https://lineages.invalid" && url.pathname === "/index.html" && url.hash === "#catalog" &&
      !url.username && !url.password && [...url.searchParams.keys()].join(",") === "catalog,q" &&
      url.searchParams.get("catalog") === observation.catalogId && url.searchParams.get("q") === expectedQuery;
  } catch {
    return false;
  }
}

function isRealLineageDate(value) {
  if (typeof value !== "string" || !/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/u.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function lineageRecordLabel(record) {
  if (record.recordModel === "catalog-item") return `Catalog item ${record.catalogItem}`;
  if (record.recordModel === "catalog-number") return `Catalog no. ${record.catalogNumber}`;
  if (record.recordModel === "collection-entry") return `Collection entry ${record.entryOrder}`;
  return record.designation ?? record.name;
}

function resolveLineageObservation(record, designationPath, massPath) {
  if (record.recordModel === "specimen") {
    return massPath === "weight.grams" && (designationPath === null || designationPath === "designation") ? {
      massGrams: record.weight.grams,
      designation: designationPath === null ? null : record.designation,
      kind: null,
      count: null
    } : null;
  }
  if (record.recordModel === "catalog-item") {
    const match = massPath.match(/^holdings\[([0-9]+)\]\.weight\.grams$/u);
    const holding = match ? record.holdings[Number(match[1])] : null;
    const expectedDesignationPath = match ? `holdings[${match[1]}].designation` : null;
    if (designationPath !== null && designationPath !== expectedDesignationPath) return null;
    return holding ? {
      massGrams: holding.weight.grams,
      designation: designationPath === null ? null : holding.designation,
      kind: holding.kind,
      count: holding.count
    } : null;
  }
  if (record.recordModel !== "catalog-number" && record.recordModel !== "collection-entry") return null;
  const match = massPath.match(/^holdings\[([0-9]+)\]\.weights\[([0-9]+)\]\.grams$/u);
  const holding = match ? record.holdings[Number(match[1])] : null;
  const weight = holding && match ? holding.weights[Number(match[2])] : null;
  return weight && (!weight.kind || weight.kind === "individual-holding") ? {
    massGrams: weight.grams,
    designation: null,
    kind: null,
    count: holding.count
  } : null;
}

function normalizeLineageName(value) {
  return String(value).normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/gu, " ").trim();
}

function normalizeLineageInventoryId(value, seriesId) {
  let normalized = String(value).normalize("NFKC").toLocaleLowerCase("en-US").replace(/\s+/gu, "");
  if (seriesId === "huss") normalized = normalized.replace(/^\(2\)/u, "");
  return normalized;
}

function normalizeLineageCollisionName(value) {
  return normalizeLineageName(value).replace(/\b(?:mt|mts)\b/gu, "mountains").replace(/\bco\b/gu, "county");
}

function lineageRotateLeft(value, bits) {
  return (value << bits) | (value >>> (32 - bits));
}

function lineageSha1(bytes) {
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);
  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const words = new Uint32Array(80);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4);
    for (let index = 16; index < 80; index += 1) {
      words[index] = lineageRotateLeft(words[index - 3] ^ words[index - 8] ^ words[index - 14] ^ words[index - 16], 1) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let index = 0; index < 80; index += 1) {
      let f;
      let k;
      if (index < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (index < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (index < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const next = (lineageRotateLeft(a, 5) + f + e + k + words[index]) >>> 0;
      e = d;
      d = c;
      c = lineageRotateLeft(b, 30) >>> 0;
      b = a;
      a = next;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }
  const digest = new Uint8Array(20);
  const digestView = new DataView(digest.buffer);
  [h0, h1, h2, h3, h4].forEach((value, index) => digestView.setUint32(index * 4, value));
  return digest;
}

function lineageUuidV5(name) {
  const namespace = Uint8Array.from(LINEAGE_UUID_NAMESPACE.replaceAll("-", "").match(/../gu), (byte) => Number.parseInt(byte, 16));
  const nameBytes = new TextEncoder().encode(String(name));
  const input = new Uint8Array(namespace.length + nameBytes.length);
  input.set(namespace);
  input.set(nameBytes, namespace.length);
  const bytes = lineageSha1(input).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function expectedLineageIds(type, candidateReference, seriesId = null, inventoryId = null, endpointReferences = []) {
  const observationPrefix = type === "same-inventory" ? "inventory-observation" : "mass-observation";
  const relationshipPrefix = type === "same-inventory" ? "same-inventory-lineage" : "possible-lineage";
  const relationshipName = type === "same-inventory"
    ? `${relationshipPrefix}\u0000${seriesId}\u0000${inventoryId}\u0000${candidateReference}`
    : `${relationshipPrefix}\u0000${candidateReference}`;
  return {
    relationshipId: `${relationshipPrefix}-${lineageUuidV5(relationshipName)}`,
    observationIds: new Map(endpointReferences.map((reference) => [
      reference,
      `${observationPrefix}-${lineageUuidV5(`${observationPrefix}\u0000${candidateReference}\u0000${reference}`)}`
    ]))
  };
}

function equalLineageCodes(actual, expected, order, allowed) {
  return Array.isArray(actual) && actual.length === expected.length && new Set(actual).size === actual.length &&
    actual.every((code, index) => allowed.has(code) && code === expected[index] &&
      (index === 0 || order.indexOf(actual[index - 1]) < order.indexOf(code)));
}

function validateLineageReview(review) {
  requireLineage(hasExactFields(review, LINEAGE_REVIEW_FIELDS) && Array.isArray(review.citations));
  if (review.status === "unreviewed") {
    requireLineage(review.outcome === null && review.reviewedOn === null && review.publicNote === null && review.citations.length === 0);
    return;
  }
  requireLineage(review.status === "reviewed" && ["retain-as-possible", "not-supported"].includes(review.outcome));
  requireLineage(isRealLineageDate(review.reviewedOn));
  requireLineage(review.publicNote === null || (typeof review.publicNote === "string" && review.publicNote.length <= 1000));
  review.citations.forEach((citation) => {
    requireLineage(hasExactFields(citation, new Set(["label", "url"])) && isLineageText(citation.label));
    try {
      const url = new URL(citation.url);
      const numericHost = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/u.test(url.hostname) || url.hostname.startsWith("[");
      requireLineage(url.protocol === "https:" && !url.username && !url.password && url.hostname.includes(".") && !numericHost);
    } catch {
      throw lineageSchemaError();
    }
  });
}

function calculateLineageCounts(relationships, inventorySummary = {}) {
  const possible = relationships.filter(({ relationship }) => relationship === "possible-match");
  const sameInventory = relationships.filter(({ relationship }) => relationship === "same-inventory");
  const count = (items, predicate) => items.filter(predicate).length;
  const evidenceStrength = Object.fromEntries(LINEAGE_STRENGTHS.map((strength) => [
    strength,
    count(possible, (relationship) => relationship.evidence.strength === strength)
  ]));
  const catalogPairs = new Map();
  relationships.forEach((relationship) => {
    const counts = catalogPairs.get(relationship.catalogPair) || { sameInventoryCount: 0, possibleMatchCount: 0 };
    counts[relationship.relationship === "same-inventory" ? "sameInventoryCount" : "possibleMatchCount"] += 1;
    catalogPairs.set(relationship.catalogPair, counts);
  });
  return {
    relationshipCount: relationships.length,
    sameInventoryRelationshipCount: sameInventory.length,
    possibleMatchRelationshipCount: possible.length,
    unreviewedPossibleMatchCount: count(possible, (relationship) => relationship.review.status === "unreviewed"),
    exactMassPossibleMatchCount: count(possible, (relationship) => relationship.evidence.massMatch === "exact"),
    nearMassPossibleMatchCount: count(possible, (relationship) => relationship.evidence.massMatch === "near"),
    metbullIdentityPossibleMatchCount: count(possible, (relationship) => relationship.identity.method === "metbull-code"),
    normalizedNameIdentityPossibleMatchCount: count(possible, (relationship) => relationship.identity.method === "normalized-source-name"),
    sameDesignationPossibleMatchCount: count(possible, (relationship) => relationship.evidence.sameDesignation),
    designationFamilyPossibleMatchCount: count(possible, (relationship) => relationship.evidence.designationFamily),
    aggregateOrMultiplePossibleMatchCount: count(possible, (relationship) => relationship.evidence.cautionCodes.includes("aggregate-or-multiple")),
    castPossibleMatchCount: count(possible, (relationship) => relationship.evidence.cautionCodes.includes("cast")),
    identityResolvedInventoryCollisionCount: inventorySummary.identityResolvedInventoryCollisionCount || 0,
    omittedAmbiguousInventoryKeyCount: inventorySummary.omittedAmbiguousInventoryKeyCount || 0,
    possibleMatchEvidenceStrength: evidenceStrength,
    catalogPairs
  };
}

function lineageSeriesByCatalog() {
  return new Map(LINEAGE_COLLECTION_SERIES.flatMap((series) => series.catalogIds.map((catalogId) => [catalogId, series.id])));
}

function lineageInventoryEndpoints(sourceRecords) {
  const seriesByCatalog = lineageSeriesByCatalog();
  const endpoints = [];
  sourceRecords.forEach((record) => {
    const seriesId = seriesByCatalog.get(record.catalogId);
    if (!seriesId) return;
    const add = (designation, designationPath, massGrams, massPath, kind = null, count = null) => {
      if (!designation) return;
      endpoints.push({ record, seriesId, inventoryId: normalizeLineageInventoryId(designation, seriesId), designation, designationPath, massGrams, massPath, kind, count });
    };
    if (record.recordModel === "specimen") {
      add(record.designation, "designation", record.weight.grams, "weight.grams");
    } else if (record.recordModel === "catalog-item") {
      record.holdings.forEach((holding, index) => add(
        holding.designation,
        `holdings[${index}].designation`,
        holding.weight.grams,
        `holdings[${index}].weight.grams`,
        holding.kind,
        holding.count
      ));
    }
  });
  return endpoints;
}

function lineageCollisionNames(endpoint) {
  return new Set([endpoint.record.sourceName || endpoint.record.name, endpoint.record.metbull?.canonicalName]
    .filter(Boolean).map(normalizeLineageCollisionName));
}

function lineageCollisionIdentityConsistent(left, right) {
  const leftCode = left.record.metbull?.meteoriteCode;
  const rightCode = right.record.metbull?.meteoriteCode;
  if (leftCode && rightCode) return leftCode === rightCode;
  const leftNames = lineageCollisionNames(left);
  return [...lineageCollisionNames(right)].some((name) => leftNames.has(name));
}

function lineageEndpointKey(endpoint) {
  return `${endpoint.record.id}\u0000${endpoint.designationPath}`;
}

function expectedSameInventoryRelationships(sourceRecords) {
  const byCatalog = Map.groupBy(lineageInventoryEndpoints(sourceRecords), (endpoint) => endpoint.record.catalogId);
  const expected = new Map();
  let identityResolvedInventoryCollisionCount = 0;
  let omittedAmbiguousInventoryKeyCount = 0;
  LINEAGE_COLLECTION_SERIES.forEach((series) => {
    for (let index = 1; index < series.catalogIds.length; index += 1) {
      const earlier = Map.groupBy(byCatalog.get(series.catalogIds[index - 1]) || [], (endpoint) => endpoint.inventoryId);
      const later = Map.groupBy(byCatalog.get(series.catalogIds[index]) || [], (endpoint) => endpoint.inventoryId);
      earlier.forEach((earlierEndpoints, inventoryId) => {
        const laterEndpoints = later.get(inventoryId);
        if (!laterEndpoints) return;
        let pair;
        if (earlierEndpoints.length === 1 && laterEndpoints.length === 1) {
          pair = [earlierEndpoints[0], laterEndpoints[0]];
        } else {
          const consistent = earlierEndpoints.flatMap((left) => laterEndpoints
            .filter((right) => lineageCollisionIdentityConsistent(left, right)).map((right) => [left, right]));
          if (consistent.length !== 1) {
            omittedAmbiguousInventoryKeyCount += 1;
            return;
          }
          pair = consistent[0];
          identityResolvedInventoryCollisionCount += 1;
        }
        const endpointReferences = pair.map(lineageEndpointKey).sort();
        const key = endpointReferences.join("\u0001");
        expected.set(key, {
          seriesId: series.id,
          inventoryId,
          endpoints: pair,
          ...expectedLineageIds("same-inventory", key, series.id, inventoryId, endpointReferences)
        });
      });
    }
  });
  return { expected, identityResolvedInventoryCollisionCount, omittedAmbiguousInventoryKeyCount };
}

function lineageMassEndpoints(sourceRecords) {
  const endpoints = [];
  const add = (record, massGrams, massPath) => {
    if (!Number.isFinite(massGrams)) return;
    const unresolved = record.metbull?.matchType === "unresolved";
    const identityKey = unresolved ? (record.name ? normalizeLineageName(record.name) : null) : record.metbull?.meteoriteCode;
    if (!identityKey) return;
    endpoints.push({
      record,
      massGrams,
      massPath,
      sourceReference: `${record.id}\u0000${massPath}`,
      identityMethod: unresolved ? "normalized-source-name" : "metbull-code",
      identityKey
    });
  };
  sourceRecords.forEach((record) => {
    if (record.recordModel === "specimen") {
      add(record, record.weight.grams, "weight.grams");
    } else if (record.recordModel === "catalog-item") {
      record.holdings.forEach((holding, index) => add(record, holding.weight.grams, `holdings[${index}].weight.grams`));
    } else if (record.recordModel === "catalog-number" || record.recordModel === "collection-entry") {
      record.holdings.forEach((holding, holdingIndex) => holding.weights.forEach((weight, weightIndex) => {
        if (WAVE1_PROJECTED_CATALOGS.has(record.catalogId) && !holding.description.startsWith("Specimen:")) return;
        if (weight.kind && weight.kind !== "individual-holding") return;
        add(record, weight.grams, `holdings[${holdingIndex}].weights[${weightIndex}].grams`);
      }));
    }
  });
  return endpoints;
}

function expectedPossibleRelationships(sourceRecords) {
  const seriesByCatalog = lineageSeriesByCatalog();
  const grouped = Map.groupBy(lineageMassEndpoints(sourceRecords), (endpoint) => `${endpoint.identityMethod}:${endpoint.identityKey}`);
  const expected = new Map();
  grouped.forEach((group) => {
    for (let leftIndex = 0; leftIndex < group.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < group.length; rightIndex += 1) {
        const left = group[leftIndex];
        const right = group[rightIndex];
        if (left.record.catalogId === right.record.catalogId) continue;
        const leftNamespace = seriesByCatalog.get(left.record.catalogId) || left.record.catalogId;
        const rightNamespace = seriesByCatalog.get(right.record.catalogId) || right.record.catalogId;
        if (leftNamespace === rightNamespace) continue;
        const difference = Math.abs(left.massGrams - right.massGrams);
        const maximumMass = Math.max(left.massGrams, right.massGrams);
        const relativeDifference = maximumMass === 0 ? 0 : difference / maximumMass;
        const exact = difference === 0;
        const near = Math.min(left.massGrams, right.massGrams) >= 10 && difference <= 2 && relativeDifference <= 0.0025;
        if (!exact && !near) continue;
        const endpointReferences = [left.sourceReference, right.sourceReference].sort();
        const key = endpointReferences.join("\u0001");
        expected.set(key, {
          endpoints: [left, right],
          ...expectedLineageIds("possible-match", key, null, null, endpointReferences)
        });
      }
    }
  });
  return expected;
}

function lineageMassObservationCount(sourceRecords) {
  let count = 0;
  sourceRecords.forEach((record) => {
    if (!record.metbull || typeof record.metbull !== "object") return;
    if (record.recordModel === "specimen") count += Number.isFinite(record.weight.grams) ? 1 : 0;
    else if (record.recordModel === "catalog-item") count += record.holdings.filter((holding) => Number.isFinite(holding.weight.grams)).length;
    else if (record.recordModel === "catalog-number" || record.recordModel === "collection-entry") count += record.holdings.reduce((sum, holding) =>
      WAVE1_PROJECTED_CATALOGS.has(record.catalogId) && !holding.description.startsWith("Specimen:") ? sum : sum + holding.weights.filter((weight) =>
        Number.isFinite(weight.grams) && (!weight.kind || weight.kind === "individual-holding")).length, 0);
  });
  return count;
}

function validateLineageCandidates(lineageData, sourceRecords, registry) {
  requireLineage(hasExactFields(lineageData, LINEAGE_ROOT_FIELDS) && Array.isArray(lineageData.relationships));
  requireLineage(hasExactFields(lineageData.metadata, LINEAGE_METADATA_FIELDS));
  const metadata = lineageData.metadata;
  requireLineage(metadata.schemaVersion === 2 && metadata.scope === "series-inventory-and-cross-source-candidates");
  requireLineage(hasExactFields(metadata.source, LINEAGE_SOURCE_FIELDS) && hasExactFields(metadata.methodology, LINEAGE_METHODOLOGY_FIELDS));
  requireLineage(hasExactFields(metadata.methodology.inventoryNormalization, LINEAGE_INVENTORY_NORMALIZATION_FIELDS));
  requireLineage(hasExactFields(metadata.methodology.possibleMatchIdentity, LINEAGE_POSSIBLE_IDENTITY_FIELDS));
  requireLineage(hasExactFields(metadata.methodology.massThresholds, LINEAGE_MASS_THRESHOLD_FIELDS));
  requireLineage(metadata.methodology.inventoryNormalization.unicode === "NFKC" && metadata.methodology.inventoryNormalization.case === "lowercase" &&
    metadata.methodology.inventoryNormalization.whitespace === "removed" && metadata.methodology.inventoryNormalization.hussEditionMarker === "one leading (2) removed");
  requireLineage(metadata.methodology.massThresholds.exactDifferenceGrams === 0 && metadata.methodology.massThresholds.nearMinimumMassGrams === 10 &&
    metadata.methodology.massThresholds.nearMaximumRelativeDifference === 0.0025 && metadata.methodology.massThresholds.nearMaximumAbsoluteDifferenceGrams === 2);
  requireLineage(isLineageText(metadata.methodology.possibleMatchIdentity.resolved) && isLineageText(metadata.methodology.possibleMatchIdentity.unresolved) &&
    isLineageText(metadata.methodology.ambiguityPolicy));
  requireLineage(JSON.stringify(metadata.methodology.evidenceStrengthOrder) === JSON.stringify(LINEAGE_STRENGTHS) &&
    JSON.stringify(metadata.methodology.nonAssertions) === JSON.stringify(["custody-chain", "ownership-transfer"]));
  requireLineage(Array.isArray(metadata.collectionSeries) && JSON.stringify(metadata.collectionSeries) === JSON.stringify(LINEAGE_COLLECTION_SERIES) &&
    metadata.collectionSeries.every((series) => hasExactFields(series, LINEAGE_SERIES_FIELDS)));
  requireLineage(hasExactFields(metadata.counts, LINEAGE_COUNT_FIELDS) && hasExactFields(metadata.counts.possibleMatchEvidenceStrength, LINEAGE_STRENGTH_FIELDS));
  requireLineage(Array.isArray(metadata.counts.catalogPairs));

  const sourceRecordsById = new Map(sourceRecords.map((record) => [record.id, record]));
  requireLineage(sourceRecordsById.size === sourceRecords.length && isPlainObject(registry) && Object.keys(registry).length > 0);
  const inventorySummary = expectedSameInventoryRelationships(sourceRecords);
  const expectedPossible = new Map([...expectedPossibleRelationships(sourceRecords)].filter(([, candidate]) =>
    !candidate.endpoints.some(({ record }) => WAVE1_PROJECTED_CATALOGS.has(record.catalogId)) ||
    WAVE1_LINEAGE_RELATIONSHIP_IDS.has(candidate.relationshipId)
  ));
  const inventoryObservationCount = lineageInventoryEndpoints(sourceRecords).length;
  requireLineage(metadata.source.catalogSchemaVersion === CATALOG_SCHEMA_VERSION && metadata.source.recordCount === sourceRecords.length &&
    metadata.source.catalogCount === Object.keys(registry).length && metadata.source.flattenedMassObservationCount === lineageMassObservationCount(sourceRecords) &&
    metadata.source.inventoryObservationCount === inventoryObservationCount);
  const relationshipIds = new Set();
  const observationIds = new Set();
  const seenInventoryRelationships = new Set();
  const seenPossibleRelationships = new Set();
  const seriesByCatalog = lineageSeriesByCatalog();

  lineageData.relationships.forEach((relationship) => {
    requireLineage(hasExactFields(relationship, LINEAGE_RELATIONSHIP_FIELDS) && LINEAGE_RELATIONSHIP_ID.test(relationship.id) && !relationshipIds.has(relationship.id));
    relationshipIds.add(relationship.id);
    const sameInventory = relationship.relationship === "same-inventory";
    requireLineage(["same-inventory", "possible-match"].includes(relationship.relationship) && isLineageText(relationship.displayName));
    requireLineage(relationship.basis === (sameInventory ? "series-scoped-normalized-inventory-id" : "reviewed-identity-and-reported-mass") &&
      relationship.status === (sameInventory ? "established" : "possible"));
    requireLineage(Array.isArray(relationship.observations) && relationship.observations.length === 2);

    relationship.observations.forEach((observation) => {
      requireLineage(hasExactFields(observation, LINEAGE_OBSERVATION_FIELDS));
      requireLineage(LINEAGE_OBSERVATION_ID.test(observation.id) && !observationIds.has(observation.id));
      observationIds.add(observation.id);
      requireLineage(LINEAGE_RECORD_ID.test(observation.recordId) && sourceRecordsById.has(observation.recordId));
      requireLineage(isLineageText(observation.catalogId) && Object.hasOwn(registry, observation.catalogId));
      const descriptor = registry[observation.catalogId];
      const sourceRecord = sourceRecordsById.get(observation.recordId);
      requireLineage(sourceRecord.catalogId === observation.catalogId && sourceRecord.recordModel === observation.recordModel);
      requireLineage(observation.catalogYear === descriptor.year && observation.catalogLabel === descriptor.label);
      requireLineage(isLineageText(observation.sourceRecordLabel) && observation.sourceRecordLabel === lineageRecordLabel(sourceRecord));
      requireLineage(isLineageText(observation.sourceName, true) && observation.sourceName === sourceRecord.name);
      requireLineage(isLineageText(observation.canonicalName, true) &&
        (observation.meteoriteCode === null || (typeof observation.meteoriteCode === "string" && /^[1-9][0-9]{0,9}$/u.test(observation.meteoriteCode))));
      const resolved = resolveLineageObservation(sourceRecord, observation.designationPath, observation.massPath);
      requireLineage(resolved && (sameInventory ? observation.massGrams === null || (Number.isFinite(observation.massGrams) && observation.massGrams >= 0) : Number.isFinite(observation.massGrams) && observation.massGrams >= 0));
      requireLineage(resolved.massGrams === observation.massGrams);
      requireLineage(observation.designation === resolved.designation && observation.kind === resolved.kind && observation.count === resolved.count);
      requireLineage(sourceRecord.metbull && (sourceRecord.metbull.matchType === "unresolved"
        ? observation.canonicalName === null && observation.meteoriteCode === null
        : observation.canonicalName === sourceRecord.metbull.canonicalName && observation.meteoriteCode === sourceRecord.metbull.meteoriteCode));
      requireLineage(isSafeLineageSearchUrl(observation.catalogSearchUrl, observation));
    });
    requireLineage(relationship.observations[0].catalogId !== relationship.observations[1].catalogId);
    const pair = relationship.observations.map(({ catalogId }) => catalogId).sort().join("|");
    requireLineage(relationship.catalogPair === pair);
    const sourceOrdered = [...relationship.observations].sort((left, right) =>
      `${left.recordId}\u0000${left.designationPath || left.massPath}`.localeCompare(`${right.recordId}\u0000${right.designationPath || right.massPath}`));
    const displayName = sourceOrdered.map((observation) => observation.canonicalName).find(Boolean) ||
      sourceOrdered.map((observation) => observation.sourceName).filter(Boolean).sort()[0];
    requireLineage(relationship.displayName === displayName);

    if (sameInventory) {
      requireLineage(relationship.id.startsWith("same-inventory-lineage-") && hasExactFields(relationship.collectionSeries, LINEAGE_COLLECTION_SERIES_FIELDS));
      requireLineage(relationship.identity === null && relationship.evidence === null && relationship.review === null);
      const endpointKey = relationship.observations.map((observation) => `${observation.recordId}\u0000${observation.designationPath}`).sort().join("\u0001");
      const expected = inventorySummary.expected.get(endpointKey);
      requireLineage(expected && !seenInventoryRelationships.has(endpointKey));
      seenInventoryRelationships.add(endpointKey);
      requireLineage(relationship.id === expected.relationshipId);
      relationship.observations.forEach((observation) => requireLineage(
        observation.id === expected.observationIds.get(`${observation.recordId}\u0000${observation.designationPath}`)
      ));
      requireLineage(relationship.collectionSeries.id === expected.seriesId && relationship.collectionSeries.inventoryId === expected.inventoryId);
      requireLineage(relationship.observations.every((observation) => observation.designation !== null &&
        normalizeLineageInventoryId(observation.designation, expected.seriesId) === expected.inventoryId));
      return;
    }

    requireLineage(relationship.id.startsWith("possible-lineage-") && relationship.collectionSeries === null);
    const endpointKey = relationship.observations.map((observation) => `${observation.recordId}\u0000${observation.massPath}`).sort().join("\u0001");
    const expected = expectedPossible.get(endpointKey);
    requireLineage(expected && !seenPossibleRelationships.has(endpointKey) && relationship.id === expected.relationshipId);
    seenPossibleRelationships.add(endpointKey);
    relationship.observations.forEach((observation) => requireLineage(
      observation.id === expected.observationIds.get(`${observation.recordId}\u0000${observation.massPath}`)
    ));
    requireLineage((seriesByCatalog.get(relationship.observations[0].catalogId) || relationship.observations[0].catalogId) !==
      (seriesByCatalog.get(relationship.observations[1].catalogId) || relationship.observations[1].catalogId));
    requireLineage(hasExactFields(relationship.identity, LINEAGE_IDENTITY_FIELDS) && LINEAGE_IDENTITY_METHODS.has(relationship.identity.method) && isLineageText(relationship.identity.key));
    requireLineage(relationship.identity.canonicalName === null || isLineageText(relationship.identity.canonicalName));
    requireLineage(hasExactFields(relationship.evidence, LINEAGE_EVIDENCE_FIELDS) && LINEAGE_STRENGTHS.includes(relationship.evidence.strength));
    requireLineage(LINEAGE_MASS_MATCHES.has(relationship.evidence.massMatch) && Number.isFinite(relationship.evidence.absoluteDifferenceGrams) && relationship.evidence.absoluteDifferenceGrams >= 0);
    requireLineage(Number.isFinite(relationship.evidence.relativeDifference) && relationship.evidence.relativeDifference >= 0 &&
      typeof relationship.evidence.sameDesignation === "boolean" && typeof relationship.evidence.designationFamily === "boolean");
    requireLineage(Array.isArray(relationship.evidence.factCodes) && Array.isArray(relationship.evidence.cautionCodes));
    validateLineageReview(relationship.review);

    const [left, right] = relationship.observations;
    const difference = Math.abs(left.massGrams - right.massGrams);
    const maximumMass = Math.max(left.massGrams, right.massGrams);
    const relativeDifference = maximumMass === 0 ? 0 : difference / maximumMass;
    const massMatch = difference === 0 ? "exact" : "near";
    requireLineage(relationship.evidence.absoluteDifferenceGrams === difference && relationship.evidence.relativeDifference === relativeDifference &&
      relationship.evidence.massMatch === massMatch);
    requireLineage(massMatch === "exact" || (Math.min(left.massGrams, right.massGrams) >= 10 && difference <= 2 && relativeDifference <= 0.0025));
    const leftDesignation = left.designation === null ? null : left.designation.toLowerCase();
    const rightDesignation = right.designation === null ? null : right.designation.toLowerCase();
    const sameDesignation = leftDesignation !== null && rightDesignation !== null && leftDesignation === rightDesignation;
    const leftFamily = left.designation === null ? null : left.designation.replace(/^\(2\)/u, "").toLowerCase();
    const rightFamily = right.designation === null ? null : right.designation.replace(/^\(2\)/u, "").toLowerCase();
    const designationFamily = leftFamily !== null && rightFamily !== null && leftFamily === rightFamily;
    requireLineage(relationship.evidence.sameDesignation === sameDesignation && relationship.evidence.designationFamily === designationFamily);
    if (relationship.identity.method === "metbull-code") {
      requireLineage(relationship.observations.every((observation) => observation.meteoriteCode === relationship.identity.key &&
        observation.canonicalName === relationship.identity.canonicalName));
    } else {
      requireLineage(relationship.identity.canonicalName === null && relationship.observations.every((observation) =>
        observation.canonicalName === null && observation.meteoriteCode === null && isLineageText(observation.sourceName) &&
        normalizeLineageName(observation.sourceName) === relationship.identity.key));
    }
    const aggregateOrMultiple = relationship.observations.some((observation) => observation.kind === "aggregate" || (observation.count ?? 1) > 1);
    const cast = relationship.observations.some((observation) => observation.kind === "cast");
    const expectedFacts = [
      relationship.identity.method === "metbull-code" ? "shared-metbull-code" : "shared-normalized-source-name",
      massMatch === "exact" ? "exact-reported-mass" : "near-reported-mass",
      ...(sameDesignation ? ["same-designation"] : []),
      ...(designationFamily ? ["designation-family"] : [])
    ];
    const expectedCautions = [
      ...(relationship.identity.method === "normalized-source-name" ? ["normalized-name-identity"] : []),
      ...(massMatch === "near" ? ["near-reported-mass"] : []),
      ...(!sameDesignation ? ["designation-differs-or-missing"] : []),
      ...(aggregateOrMultiple ? ["aggregate-or-multiple"] : []),
      ...(cast ? ["cast"] : [])
    ];
    requireLineage(equalLineageCodes(relationship.evidence.factCodes, expectedFacts, LINEAGE_FACT_CODE_ORDER, LINEAGE_FACT_CODES));
    requireLineage(equalLineageCodes(relationship.evidence.cautionCodes, expectedCautions, LINEAGE_CAUTION_CODE_ORDER, LINEAGE_CAUTION_CODES));
    const expectedStrength = sameDesignation || designationFamily
      ? "multiple-matching-facts" : massMatch === "exact" ? "two-matching-facts" : "limited-matching-evidence";
    requireLineage(relationship.evidence.strength === expectedStrength);
  });

  requireLineage(seenInventoryRelationships.size === inventorySummary.expected.size);
  requireLineage(seenPossibleRelationships.size === expectedPossible.size);

  const calculated = calculateLineageCounts(lineageData.relationships, inventorySummary);
  const scalarFields = [...LINEAGE_COUNT_FIELDS].filter((field) => !["possibleMatchEvidenceStrength", "catalogPairs"].includes(field));
  scalarFields.forEach((field) => requireLineage(Number.isInteger(metadata.counts[field]) && metadata.counts[field] === calculated[field]));
  LINEAGE_STRENGTHS.forEach((strength) => requireLineage(metadata.counts.possibleMatchEvidenceStrength[strength] === calculated.possibleMatchEvidenceStrength[strength]));
  requireLineage(metadata.counts.catalogPairs.length === calculated.catalogPairs.size);
  const seenPairs = new Set();
  metadata.counts.catalogPairs.forEach((item) => {
    requireLineage(hasExactFields(item, LINEAGE_PAIR_COUNT_FIELDS) && !seenPairs.has(item.catalogPair));
    const counts = calculated.catalogPairs.get(item.catalogPair);
    requireLineage(counts && counts.sameInventoryCount === item.sameInventoryCount && counts.possibleMatchCount === item.possibleMatchCount);
    seenPairs.add(item.catalogPair);
  });
  return lineageData;
}

function chronologicalEarlierPair(observations) {
  const chronological = [...observations].sort((left, right) =>
    left.catalogYear - right.catalogYear || left.catalogId.localeCompare(right.catalogId) || left.id.localeCompare(right.id)
  );
  return chronological[0].catalogYear < chronological[1].catalogYear
    ? { earlier: chronological[0], later: chronological[1] }
    : null;
}

function deriveEarlierRecordIndex(lineageData, sourceRecords, registry) {
  validateLineageCandidates(lineageData, sourceRecords, registry);
  const index = new Map();
  lineageData.relationships.forEach((relationship) => {
    if (relationship.review?.outcome === "not-supported") return;
    const pair = chronologicalEarlierPair(relationship.observations);
    if (!pair) return;
    const { earlier, later } = pair;
    const entries = index.get(later.recordId) || [];
    const entry = {
      relationshipId: relationship.id,
      relationship: relationship.relationship,
      recordId: earlier.recordId,
      catalogYear: earlier.catalogYear,
      catalogLabel: earlier.catalogLabel,
      sourceName: earlier.sourceName,
      massGrams: earlier.massGrams,
      seriesId: relationship.collectionSeries?.id || null,
      inventoryId: relationship.collectionSeries?.inventoryId || null,
      strength: relationship.evidence?.strength || null,
      catalogSearchUrl: `./index.html?catalog=${encodeURIComponent(earlier.catalogId)}&q=${encodeURIComponent(`record id ${earlier.recordId}`)}#catalog`
    };
    // Keep the established enumerable entry shape while retaining the exact later endpoint for card routing.
    Object.defineProperty(entry, "massPath", { value: later.massPath, enumerable: false });
    entries.push(entry);
    index.set(later.recordId, entries);
  });
  index.forEach((entries) => entries.sort((left, right) =>
    left.catalogYear - right.catalogYear || collator.compare(left.catalogLabel, right.catalogLabel) ||
    collator.compare(left.sourceName || "", right.sourceName || "") || left.relationshipId.localeCompare(right.relationshipId)
  ));
  return index;
}

async function loadEarlierRecordIndex(sourceRecords = records, registry = catalogRegistry, fetcher = fetch, options = {}) {
  try {
    const response = await fetcher(`./data/specimen-lineages.json?v=${CACHE_VERSION}`, { cache: "no-cache" });
    if (!response.ok) return new Map();
    const text = await response.text();
    const digest = await (options.sha256 || sha256Text)(text);
    if (digest !== SPECIMEN_LINEAGE_DATA_SHA256) return new Map();
    return deriveEarlierRecordIndex(JSON.parse(text), sourceRecords, registry);
  } catch {
    return new Map();
  }
}

function specimenCardSourceMasses(record) {
  if (!Array.isArray(record?.holdings)) return [];
  return record.holdings.flatMap((holding, holdingIndex) => {
    const holdingPath = `holdings[${holdingIndex}]`;
    if (record.recordModel === "catalog-item") {
      return Number.isFinite(holding.weight?.grams)
        ? [{ holdingPath, massPath: `${holdingPath}.weight.grams`, grams: holding.weight.grams, holdingIndex, weightIndex: 0 }]
        : [];
    }
    return Array.isArray(holding.weights) ? holding.weights.map((weight, weightIndex) => ({
      holdingPath,
      massPath: `${holdingPath}.weights[${weightIndex}].grams`,
      grams: weight.grams,
      kind: weight.kind || null,
      holdingIndex,
      weightIndex
    })).filter(({ grams }) => Number.isFinite(grams)) : [];
  });
}

function resolveSpecimenCardSelection(record, holdingPath, massPath) {
  if (!Array.isArray(record?.holdings) || typeof holdingPath !== "string" || typeof massPath !== "string") return null;
  const holdingMatch = holdingPath.match(/^holdings\[([0-9]+)\]$/u);
  if (!holdingMatch) return null;
  const holdingIndex = Number(holdingMatch[1]);
  const holding = record.holdings[holdingIndex];
  if (!holding) return null;
  if (record.recordModel === "catalog-item") {
    if (holding.kind !== "specimen" || massPath !== `${holdingPath}.weight.grams` || !Number.isFinite(holding.weight?.grams)) return null;
    return { holding, holdingIndex, weightIndex: 0, grams: holding.weight.grams };
  }
  if (record.recordModel !== "catalog-number" && record.recordModel !== "collection-entry") return null;
  const massMatch = massPath.match(/^holdings\[([0-9]+)\]\.weights\[([0-9]+)\]\.grams$/u);
  if (!massMatch || Number(massMatch[1]) !== holdingIndex) return null;
  const weightIndex = Number(massMatch[2]);
  const weight = holding.weights?.[weightIndex];
  const grams = weight?.grams;
  if (record.catalogId === "hamburg-1913" && weight?.kind !== "individual-holding") return null;
  return Number.isFinite(grams) ? { holding, holdingIndex, weightIndex, grams, kind: weight.kind || null } : null;
}

function resolveSpecimenCardRepeatedMass(record, holdingPath, repeatedMass) {
  if (!hasExactFields(repeatedMass, SPECIMEN_CARD_REPEATED_MASS_FIELDS)) return null;
  const holdingMatch = typeof holdingPath === "string" ? holdingPath.match(/^holdings\[([0-9]+)\]$/u) : null;
  const valueMatch = typeof repeatedMass.valuePath === "string"
    ? repeatedMass.valuePath.match(/^holdings\[([0-9]+)\]\.weights\[([0-9]+)\]\.grams$/u) : null;
  const countMatch = typeof repeatedMass.countPath === "string"
    ? repeatedMass.countPath.match(/^holdings\[([0-9]+)\]\.count$/u) : null;
  const totalMatch = typeof repeatedMass.totalPath === "string"
    ? repeatedMass.totalPath.match(/^holdings\[([0-9]+)\]\.weights\[([0-9]+)\]\.grams$/u) : null;
  if (!holdingMatch || !valueMatch || !countMatch || !totalMatch ||
      [valueMatch[1], countMatch[1], totalMatch[1]].some((index) => index !== holdingMatch[1])) return null;
  const holdingIndex = Number(holdingMatch[1]);
  const holding = record?.holdings?.[holdingIndex];
  const grams = holding?.weights?.[Number(valueMatch[2])]?.grams;
  const totalGrams = holding?.weights?.[Number(totalMatch[2])]?.grams;
  const count = holding?.count;
  const expectedTotal = grams * count;
  const tolerance = Math.max(1, Math.abs(totalGrams), Math.abs(expectedTotal)) * 1e-12;
  if (!Number.isFinite(grams) || grams <= 0 || !Number.isFinite(totalGrams) || totalGrams <= 0 ||
      !Number.isInteger(count) || count < 2 || repeatedMass.occurrenceCount !== count ||
      !Number.isInteger(repeatedMass.occurrence) || repeatedMass.occurrence < 1 || repeatedMass.occurrence > count ||
      Math.abs(totalGrams - expectedTotal) > tolerance) return null;
  return { holding, holdingIndex, grams, totalGrams, count, occurrence: repeatedMass.occurrence };
}

function specimenCardHolding(record, holdingPath) {
  if (!Array.isArray(record?.holdings) || typeof holdingPath !== "string") return null;
  const match = holdingPath.match(/^holdings\[([0-9]+)\]$/u);
  if (!match) return null;
  const holdingIndex = Number(match[1]);
  const holding = record.holdings[holdingIndex];
  return holding ? { holding, holdingIndex } : null;
}

function splitsSurrogatePair(text, offset) {
  if (offset <= 0 || offset >= text.length) return false;
  const left = text.charCodeAt(offset - 1);
  const right = text.charCodeAt(offset);
  return left >= 0xd800 && left <= 0xdbff && right >= 0xdc00 && right <= 0xdfff;
}

function resolveSpecimenCardClause(record, card) {
  const resolved = specimenCardHolding(record, card?.holdingPath);
  const textMatch = typeof card?.clause?.textPath === "string"
    ? card.clause.textPath.match(/^holdings\[([0-9]+)\]\.(description|designation)$/u)
    : null;
  if (!resolved || !hasExactFields(card.clause, SPECIMEN_CARD_CLAUSE_FIELDS) || !textMatch ||
      Number(textMatch[1]) !== resolved.holdingIndex) return null;
  const sourceText = resolved.holding[textMatch[2]];
  const { start, end } = card.clause;
  if (typeof sourceText !== "string" || !Number.isInteger(start) || !Number.isInteger(end) ||
      start < 0 || start >= end || end > sourceText.length || splitsSurrogatePair(sourceText, start) ||
      splitsSurrogatePair(sourceText, end)) return null;
  const text = sourceText.slice(start, end);
  return /[\p{L}\p{N}]/u.test(text) ? { ...resolved, sourceText, text } : null;
}

function resolveSpecimenCardComponent(record, card) {
  const resolved = specimenCardHolding(record, card?.holdingPath);
  const componentMatch = typeof card?.componentPath === "string"
    ? card.componentPath.match(/^holdings\[([0-9]+)\]\.weights\[([0-9]+)\]$/u)
    : null;
  if (record?.catalogId !== "hamburg-1913" || !resolved || !componentMatch ||
      Number(componentMatch[1]) !== resolved.holdingIndex || card.massPath !== `${card.componentPath}.grams`) return null;
  const weightIndex = Number(componentMatch[2]);
  const component = resolved.holding.weights?.[weightIndex];
  return component?.kind === "individual-holding" && Number.isFinite(component.grams) && component.grams > 0
    ? { ...resolved, component, weightIndex, grams: component.grams }
    : null;
}

function compareSpecimenCards(left, right) {
  const leftHolding = Number(left.holdingPath.match(/^holdings\[([0-9]+)\]$/u)[1]);
  const rightHolding = Number(right.holdingPath.match(/^holdings\[([0-9]+)\]$/u)[1]);
  if (leftHolding !== rightHolding) return leftHolding - rightHolding;
  if (left.componentPath || right.componentPath) {
    if (!left.componentPath) return -1;
    if (!right.componentPath) return 1;
    const leftComponent = Number(left.componentPath.match(/^holdings\[[0-9]+\]\.weights\[([0-9]+)\]$/u)[1]);
    const rightComponent = Number(right.componentPath.match(/^holdings\[[0-9]+\]\.weights\[([0-9]+)\]$/u)[1]);
    return leftComponent - rightComponent;
  }
  if (left.clause.textPath !== right.clause.textPath) return left.clause.textPath < right.clause.textPath ? -1 : 1;
  return left.clause.start - right.clause.start || left.clause.end - right.clause.end ||
    String(left.massPath || "").localeCompare(String(right.massPath || ""));
}

function validateSpecimenCardManifest(manifest, sourceRecords, options = {}) {
  if (!hasExactFields(manifest, SPECIMEN_CARD_ROOT_FIELDS) || !Array.isArray(manifest.projections) ||
      !hasExactFields(manifest.metadata, SPECIMEN_CARD_METADATA_FIELDS) || !Array.isArray(sourceRecords)) return false;
  const metadata = manifest.metadata;
  if (metadata.schemaVersion !== 4 || metadata.scope !== "reviewed-atomic-specimen-card-display-projections" ||
      metadata.catalogSchemaVersion !== CATALOG_SCHEMA_VERSION || metadata.sourceRecordCount !== sourceRecords.length ||
      !SHA256_HEX.test(metadata.sourceCatalogSha256) || !Number.isInteger(metadata.projectionCount) ||
      metadata.projectionCount !== manifest.projections.length || !Number.isInteger(metadata.atomicCardCount) ||
      metadata.atomicCardCount < 0 || !Number.isInteger(metadata.sourceContextCardCount) ||
      metadata.sourceContextCardCount < 0 || metadata.sourceContextCardCount > manifest.projections.length) return false;
  if (options.sourceCatalogSha256 !== undefined && metadata.sourceCatalogSha256 !== options.sourceCatalogSha256) return false;

  const recordsById = new Map(sourceRecords.map((record, index) => [record.id, { record, index }]));
  if (recordsById.size !== sourceRecords.length) return false;
  const parentIds = new Set();
  let previousParentIndex = -1;
  let atomicCardCount = 0;
  let sourceContextCardCount = 0;
  for (const projection of manifest.projections) {
    if (!hasExactFields(projection, SPECIMEN_CARD_PROJECTION_FIELDS) || !LINEAGE_RECORD_ID.test(projection.parentRecordId) ||
        parentIds.has(projection.parentRecordId) ||
        !Array.isArray(projection.cards) || projection.cards.length === 0) return false;
    const source = recordsById.get(projection.parentRecordId);
    if (!source || source.index <= previousParentIndex || !["catalog-item", "catalog-number", "collection-entry"].includes(source.record.recordModel)) return false;
    previousParentIndex = source.index;
    parentIds.add(projection.parentRecordId);
    const selectedMassPaths = new Set();
    const selectedComponentPaths = new Set();
    const repeatedMassGroups = new Map();
    let previousCard = null;
    const previousEndsByTextPath = new Map();
    for (const card of projection.cards) {
      const hasClause = isPlainObject(card) && Object.hasOwn(card, "clause");
      const hasComponent = isPlainObject(card) && Object.hasOwn(card, "componentPath");
      const hasRepeatedMass = hasClause && Object.hasOwn(card, "repeatedMass");
      if (hasClause === hasComponent || !hasExactFields(card,
        hasClause
          ? hasRepeatedMass ? SPECIMEN_CARD_REPEATED_CLAUSE_CARD_FIELDS : SPECIMEN_CARD_CLAUSE_CARD_FIELDS
          : SPECIMEN_CARD_COMPONENT_FIELDS) ||
        (card.massPath !== null && selectedMassPaths.has(card.massPath))) return false;
      if (hasClause) {
        const clause = resolveSpecimenCardClause(source.record, card);
        if (!clause || source.record.catalogId === "hamburg-1913" ||
            (source.record.recordModel === "catalog-item" && clause.holding.kind !== "specimen")) return false;
        const selection = card.massPath === null ? null : resolveSpecimenCardSelection(source.record, card.holdingPath, card.massPath);
        if (card.massPath !== null && (!selection || selection.grams <= 0)) return false;
        if (hasRepeatedMass) {
          const repeated = card.massPath === null
            ? resolveSpecimenCardRepeatedMass(source.record, card.holdingPath, card.repeatedMass) : null;
          if (!repeated) return false;
          const groupKey = [card.holdingPath, card.repeatedMass.valuePath, card.repeatedMass.countPath,
            card.repeatedMass.totalPath, card.repeatedMass.occurrenceCount].join("\u0000");
          const occurrences = repeatedMassGroups.get(groupKey) || new Set();
          if (occurrences.has(repeated.occurrence)) return false;
          occurrences.add(repeated.occurrence);
          repeatedMassGroups.set(groupKey, occurrences);
        }
        const previousEnd = previousEndsByTextPath.get(card.clause.textPath);
        if (previousEnd !== undefined && card.clause.start < previousEnd) return false;
        previousEndsByTextPath.set(card.clause.textPath, card.clause.end);
      } else {
        if (selectedComponentPaths.has(card.componentPath) || !resolveSpecimenCardComponent(source.record, card)) return false;
        selectedComponentPaths.add(card.componentPath);
      }
      if (previousCard && compareSpecimenCards(previousCard, card) >= 0) return false;
      previousCard = card;
      if (card.massPath !== null) selectedMassPaths.add(card.massPath);
    }
    for (const [groupKey, occurrences] of repeatedMassGroups) {
      const occurrenceCount = Number(groupKey.slice(groupKey.lastIndexOf("\u0000") + 1));
      if (occurrences.size !== occurrenceCount ||
          !Array.from({ length: occurrenceCount }, (_, index) => index + 1).every((value) => occurrences.has(value))) return false;
    }
    const hasSourceContext = specimenCardContextEntries(source.record, projection).length > 0;
    if (!WAVE1_PROJECTED_CATALOGS.has(source.record.catalogId) &&
        projection.cards.length + Number(hasSourceContext) < 2) return false;
    atomicCardCount += projection.cards.length;
    if (hasSourceContext) sourceContextCardCount += 1;
  }
  return atomicCardCount === metadata.atomicCardCount && sourceContextCardCount === metadata.sourceContextCardCount;
}

function deriveSpecimenCardProjectionIndex(manifest, sourceRecords, options = {}) {
  if (!validateSpecimenCardManifest(manifest, sourceRecords, options)) return new Map();
  return new Map(manifest.projections.map((projection) => [projection.parentRecordId, projection]));
}

async function loadSpecimenCardProjectionIndex(sourceRecords = records, fetcher = fetch, options = {}) {
  try {
    if (options.sourceCatalogSha256 !== SPECIMEN_CARD_SOURCE_CATALOG_SHA256) return new Map();
    const response = await fetcher(`./data/specimen-card-projections.json?v=${CACHE_VERSION}`, { cache: "no-cache" });
    if (!response.ok) return new Map();
    const text = await response.text();
    const hash = options.sha256 || sha256Text;
    if (await hash(text) !== SPECIMEN_CARD_PROJECTION_DATA_SHA256) return new Map();
    const manifest = JSON.parse(text);
    if (manifest?.metadata?.sourceCatalogSha256 !== SPECIMEN_CARD_SOURCE_CATALOG_SHA256) return new Map();
    const projectionSetSha256 = await hash(JSON.stringify(manifest.projections));
    if (projectionSetSha256 !== SPECIMEN_CARD_PROJECTION_SET_SHA256) return new Map();
    return deriveSpecimenCardProjectionIndex(manifest, sourceRecords, options);
  } catch {
    return new Map();
  }
}

async function sha256Text(value, cryptoObject = globalThis.crypto) {
  if (typeof value !== "string" || !cryptoObject?.subtle || typeof TextEncoder === "undefined") return null;
  const digest = await cryptoObject.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parentSpecimenCardDescriptor(parentRecord) {
  return {
    parentRecord,
    kind: "parent",
    holdingPath: null,
    componentPath: null,
    massPath: null,
    repeatedMass: null,
    clause: null,
    clauseText: null,
    sourcePosition: 0,
    projected: false,
    specimenCount: 1,
    projectedMassPaths: [],
    contextEntries: []
  };
}

function meaningfulContextSegment(text) {
  return typeof text === "string" && /[\p{L}\p{N}]/u.test(text);
}

function specimenCardContextEntries(record, projection) {
  const spansByTextPath = new Map();
  projection.cards.forEach((card) => {
    if (!card.clause) return;
    const spans = spansByTextPath.get(card.clause.textPath) || [];
    spans.push([card.clause.start, card.clause.end]);
    spansByTextPath.set(card.clause.textPath, spans);
  });
  const selectedHoldings = new Set(projection.cards.map(({ holdingPath }) => holdingPath));
  const projectedMassPaths = new Set(projection.cards.map(({ massPath }) => massPath).filter(Boolean));
  const sourceMassesByHolding = new Map();
  specimenCardSourceMasses(record).forEach((mass) => {
    const entries = sourceMassesByHolding.get(mass.holdingPath) || [];
    entries.push(mass);
    sourceMassesByHolding.set(mass.holdingPath, entries);
  });
  return record.holdings.flatMap((holding, holdingIndex) => {
    const holdingPath = `holdings[${holdingIndex}]`;
    const entries = [];
    for (const field of ["designation", "description", "provenance"]) {
      const sourceText = holding[field];
      if (!meaningfulContextSegment(sourceText)) continue;
      const spans = spansByTextPath.get(`${holdingPath}.${field}`) || [];
      let offset = 0;
      spans.forEach(([start, end]) => {
        const text = sourceText.slice(offset, start);
        if (meaningfulContextSegment(text)) entries.push({ type: "segment", holdingPath, textPath: `${holdingPath}.${field}`, text });
        offset = end;
      });
      const text = sourceText.slice(offset);
      if (meaningfulContextSegment(text)) entries.push({ type: "segment", holdingPath, textPath: `${holdingPath}.${field}`, text });
    }
    if (!selectedHoldings.has(holdingPath) && holding.kind && holding.kind !== "specimen") {
      entries.push({ type: "fact", holdingPath, label: "Holding type", text: capitalize(holding.kind) });
    }
    if (Number.isInteger(holding.count) && (holding.count > 1 || record.catalogId === "hamburg-1913")) {
      entries.push({ type: "fact", holdingPath, label: "Reported count", text: String(holding.count) });
    }
    (sourceMassesByHolding.get(holdingPath) || []).forEach((mass) => {
      if (!projectedMassPaths.has(mass.massPath)) entries.push({ type: "mass", ...mass });
    });
    if (record.catalogId === "hamburg-1913") {
      if (holding.reportedTotalWeight) entries.push({
        type: "fact", holdingPath, label: "Holding reported total", text: formatMass(holding.reportedTotalWeight.grams)
      });
      holding.representations.forEach((representation) => entries.push({
        type: "fact", holdingPath, label: "Representation",
        text: `${integerFormat.format(representation.count)} ${representation.count === 1 ? "thin section" : "thin sections"}`
      }));
    }
    return entries;
  }).concat(record.catalogId === "hamburg-1913" ? hamburgRecordFacts(record).map(({ label, value }) => ({
    type: "fact", holdingPath: null, label, text: value
  })) : []);
}

function expandSpecimenCardDescriptors(sourceRecords, projectionIndex = new Map()) {
  return sourceRecords.flatMap((parentRecord) => {
    const projection = projectionIndex.get(parentRecord.id);
    if (!projection) return [parentSpecimenCardDescriptor(parentRecord)];
    const projectedMassPaths = projection.cards.map(({ massPath }) => massPath).filter(Boolean);
    const cards = projection.cards.map((card, sourcePosition) => ({
      parentRecord,
      kind: "atomic",
      holdingPath: card.holdingPath,
      componentPath: card.componentPath || null,
      massPath: card.massPath,
      repeatedMass: card.repeatedMass || null,
      clause: card.clause || null,
      clauseText: card.clause ? resolveSpecimenCardClause(parentRecord, card).text : null,
      sourcePosition,
      projected: true,
      specimenCount: projection.cards.length,
      projectedMassPaths,
      contextEntries: [],
      duplicateMassPosition: null,
      duplicateMassCount: 1
    }));
    const cardsByMass = new Map();
    cards.forEach((descriptor) => {
      const [grams] = specimenCardDescriptorMasses(descriptor);
      if (!Number.isFinite(grams)) return;
      const matchingCards = cardsByMass.get(grams) || [];
      matchingCards.push(descriptor);
      cardsByMass.set(grams, matchingCards);
    });
    cardsByMass.forEach((matchingCards) => {
      if (matchingCards.length < 2) return;
      matchingCards.forEach((descriptor, index) => {
        descriptor.duplicateMassPosition = index + 1;
        descriptor.duplicateMassCount = matchingCards.length;
      });
    });
    return cards;
  });
}

function specimenCardPositionLabel(descriptor) {
  if (descriptor?.kind !== "atomic" || descriptor.duplicateMassCount < 2 || descriptor.duplicateMassPosition === null) return null;
  return `Specimen ${descriptor.duplicateMassPosition} of ${descriptor.duplicateMassCount} with this reported mass`;
}

function specimenCardDescriptorMasses(descriptor) {
  if (!descriptor?.parentRecord) return [];
  if (descriptor.kind === "atomic") {
    if (descriptor.repeatedMass) {
      const repeated = resolveSpecimenCardRepeatedMass(
        descriptor.parentRecord, descriptor.holdingPath, descriptor.repeatedMass
      );
      return repeated ? [repeated.grams] : [];
    }
    if (descriptor.massPath === null) return [];
    const selection = resolveSpecimenCardSelection(descriptor.parentRecord, descriptor.holdingPath, descriptor.massPath);
    return selection ? [selection.grams] : [];
  }
  return recordMasses(descriptor.parentRecord);
}

function specimenCardDescriptorHasKnownWeight(descriptor) {
  return specimenCardDescriptorMasses(descriptor).length > 0 ||
    (descriptor?.kind === "atomic" && WAVE1_PROJECTED_CATALOGS.has(descriptor.parentRecord?.catalogId));
}

function lineageEntriesForSpecimenCard(descriptor, entries) {
  if (!descriptor?.projected) return entries;
  if (descriptor.kind === "atomic") return descriptor.massPath === null ? [] : entries.filter((entry) => entry.massPath === descriptor.massPath);
  return [];
}

function filterSpecimenCardDescriptors(descriptors, filters, lineageIndex = new Map()) {
  return descriptors.filter((descriptor) => {
    const masses = specimenCardDescriptorMasses(descriptor);
    const specimen = [HARMONIZED_CARD_KINDS.specimen, HARMONIZED_CARD_KINDS.atomic].includes(
      classifyHarmonizedCard(descriptor)
    );
    const unknownWeightMatches = filters.includeUnknownWeight !== false || !specimen || specimenCardDescriptorHasKnownWeight(descriptor);
    const weightMatches = (filters.min === null && filters.max === null) || masses.some((grams) =>
      (filters.min === null || grams >= filters.min) && (filters.max === null || grams <= filters.max));
    const lineageMatches = filters.lineageOnly !== true || lineageEntriesForSpecimenCard(
      descriptor, lineageIndex.get(descriptor.parentRecord.id) || []
    ).length > 0;
    return unknownWeightMatches && weightMatches && lineageMatches;
  });
}

function paginateSpecimenCardDescriptors(descriptors, limit = PAGE_SIZE) {
  return descriptors.slice(0, Math.max(0, Number.isInteger(limit) ? limit : PAGE_SIZE));
}

function specimenCardDescriptorHoldings(descriptor) {
  if (!descriptor.projected) return descriptor.parentRecord.holdings;
  if (descriptor.kind === "atomic") {
    const [grams] = specimenCardDescriptorMasses(descriptor);
    return Number.isFinite(grams)
      ? [{ type: "weight", grams }]
      : [{ type: "detail", text: descriptor.clauseText }];
  }
  return [];
}

function isSafeFolioPath(value, catalogId, pageId) {
  return typeof value === "string" && value === `assets/folios/${catalogId}/${pageId}.webp`;
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
  return normalized !== null && value === normalized && isLeakageSafeText(value);
}

function isValidFolioPageId(value) {
  return typeof value === "string" && value.length <= MAX_CATALOG_ID_LENGTH &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function validateFolioManifest(manifest, registry = catalogRegistry) {
  if (!hasExactFields(manifest, FOLIO_ROOT_FIELDS) || manifest.schemaVersion !== 2 || !isPlainObject(manifest.catalogs)) return false;
  if (!isPlainObject(registry) || !Object.keys(registry).length) return false;
  const manifestCatalogIds = Object.keys(manifest.catalogs);
  const registryCatalogIds = Object.keys(registry);
  if (
    manifestCatalogIds.length !== registryCatalogIds.length ||
    manifestCatalogIds.some((catalogId) => !Object.hasOwn(registry, catalogId))
  ) return false;

  return Object.entries(manifest.catalogs).every(([catalogId, catalog]) => {
    const descriptor = registry[catalogId];
    if (!hasValidCatalogId(catalogId) || !hasExactFields(catalog, FOLIO_CATALOG_FIELDS) || !Array.isArray(catalog.pages)) return false;
    if (!FOLIO_DISPLAY_POLICIES.has(catalog.displayPolicy) || !FOLIO_RIGHTS_STATUSES.has(catalog.rightsStatus)) return false;
    if (catalog.displayPolicy === "display" &&
      (!FOLIO_DISPLAY_RIGHTS_STATUSES.has(catalog.rightsStatus) || !catalog.pages.length)) return false;
    if (catalog.displayPolicy === "blocked" && (catalog.rightsStatus !== "undetermined" || catalog.pages.length)) return false;
    if (catalog.displayPolicy !== descriptor.folioDisplayPolicy || catalog.rightsStatus !== descriptor.rightsStatus) return false;
    const sourcePages = new Set(descriptor.sourcePages);
    const pageIds = new Set();
    return catalog.pages.every((page) => {
      if (!hasExactFields(page, FOLIO_PAGE_FIELDS) || !isValidFolioPageId(page.pageId) || pageIds.has(page.pageId)) return false;
      pageIds.add(page.pageId);
      if (page.catalogPage !== null) {
        if (!Number.isInteger(page.catalogPage) || page.catalogPage <= 0 ||
          !sourcePages.has(page.catalogPage)) return false;
      }
      if (page.pageLabel !== null && !isValidFolioAlt(page.pageLabel)) return false;
      return isSafeFolioPath(page.image, catalogId, page.pageId) && isValidFolioAlt(page.alt);
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
    FOLIO_DISPLAY_RIGHTS_STATUSES.has(descriptor.rightsStatus);
}

function authorizedFolio(page, catalogId) {
  return {
    catalogId,
    pageId: page.pageId,
    catalogPage: page.catalogPage,
    pageLabel: page.pageLabel,
    image: page.image,
    alt: page.alt
  };
}

function getAuthorizedFolio(manifest, catalogId, catalogPage, registry = catalogRegistry) {
  const pageNumber = Number(catalogPage);
  if (!validateFolioManifest(manifest, registry) || !cleanText(catalogId) || catalogPage === null || catalogPage === "" || !Number.isInteger(pageNumber)) return null;
  if (!hasMatchingFolioPolicy(manifest, catalogId, registry) || !registry[catalogId].sourcePages.includes(pageNumber)) return null;
  const page = manifest.catalogs[catalogId].pages.find((candidate) => candidate.catalogPage === pageNumber);
  return page ? authorizedFolio(page, catalogId) : null;
}

function getAuthorizedFolioPages(manifest, catalogId, registry = catalogRegistry) {
  if (!validateFolioManifest(manifest, registry) || !hasMatchingFolioPolicy(manifest, catalogId, registry)) return [];
  return manifest.catalogs[catalogId].pages.map((page) => authorizedFolio(page, catalogId));
}

function normalizeConfidence(value) {
  const normalized = searchable(value);
  return ["high", "medium", "low"].includes(normalized) ? normalized : "medium";
}

function prepareRecord(source, index, registry = catalogRegistry) {
  const recordModel = registry[cleanText(source.catalogId)]?.recordModel;
  const record = {
    id: cleanText(source.id),
    catalogId: cleanText(source.catalogId),
    name: cleanText(source.name),
    classification: cleanText(source.classification),
    locality: recordModel === "table-a-specimen" ? null : cleanText(source.locality),
    confidence: normalizeConfidence(source.confidence),
    recordModel,
    catalogLabel: catalogLabel(registry[cleanText(source.catalogId)], cleanText(source.catalogId)),
    order: index
  };
  if (recordModel === "catalog-item") {
    record.year = cleanText(source.year);
    record.catalogPage = source.catalogPage === null || source.catalogPage === "" ? null : Number(source.catalogPage);
    record.catalogItem = Number(source.catalogItem);
    record.holdings = source.holdings.map((holding) => ({
      designation: cleanText(holding.designation),
      kind: holding.kind,
      description: cleanText(holding.description),
      count: holding.count,
      weight: { grams: holding.weight.grams === null ? null : Number(holding.weight.grams) }
    }));
  } else if (recordModel === "catalog-number" || recordModel === "collection-entry") {
    record.catalogPages = source.catalogPages.map(Number);
    record.holdings = source.holdings.map((holding) => ({
      description: cleanText(holding.description),
      provenance: cleanText(holding.provenance),
      count: holding.count,
      weights: holding.weights.map((weight) => ({
        grams: Number(weight.grams),
        ...(weight.kind ? { kind: weight.kind } : {})
      })),
      ...(record.catalogId === "hamburg-1913" ? {
        reportedTotalWeight: holding.reportedTotalWeight === null ? null : { grams: Number(holding.reportedTotalWeight.grams) },
        representations: holding.representations.map((representation) => ({
          kind: representation.kind,
          count: representation.count
        }))
      } : {})
    }));
    if (recordModel === "catalog-number") {
      record.catalogNumber = cleanText(source.catalogNumber);
      record.dateOfDiscovery = cleanText(source.dateOfDiscovery);
    } else {
      record.entryOrder = Number(source.entryOrder);
      record.reportedNumber = cleanText(source.reportedNumber);
      record.section = cleanText(source.section);
      record.eventDate = cleanText(source.eventDate);
      if (record.catalogId === "hamburg-1913") {
        record.reportedTotalWeight = source.reportedTotalWeight === null ? null : { grams: Number(source.reportedTotalWeight.grams) };
        record.publicationState = source.publicationState;
        record.amendments = source.amendments.map((amendment) => ({
          ...amendment,
          targetWeight: { grams: Number(amendment.targetWeight.grams) }
        }));
      }
    }
  } else if (recordModel === "regional-census-fact") {
    record.entryOrder = Number(source.entryOrder);
    record.reportedNumber = cleanText(source.reportedNumber);
    record.section = cleanText(source.section);
    record.eventDate = cleanText(source.eventDate);
    record.catalogPages = source.catalogPages.map(Number);
    record.australianMuseumRepresentation = {
      status: source.australianMuseumRepresentation.status,
      representedOccurrences: source.australianMuseumRepresentation.representedOccurrences,
      notRepresentedOccurrences: source.australianMuseumRepresentation.notRepresentedOccurrences
    };
  } else if (recordModel === "table-a-specimen") {
    record.entryOrder = Number(source.entryOrder);
    record.specimenId = cleanText(source.specimenId);
    record.weight = { grams: Number(source.weight.grams) };
    record.olivineFa = cleanText(source.olivineFa);
    record.pyroxeneFs = cleanText(source.pyroxeneFs);
    record.weathering = cleanText(source.weathering);
    record.locality = {
      code: cleanText(source.locality.code),
      name: cleanText(source.locality.name),
      coordinate: cleanText(source.locality.coordinate)
    };
    record.catalogPage = Number(source.catalogPage);
  } else if (recordModel === "dealer-offer-fact") {
    record.typeNumber = Number(source.typeNumber);
    record.description = cleanText(source.description);
    record.catalogPage = Number(source.catalogPage);
  } else {
    record.year = cleanText(source.year);
    record.catalogPage = source.catalogPage === null || source.catalogPage === "" ? null : Number(source.catalogPage);
    record.designation = cleanText(source.designation);
    record.weight = { grams: source.weight.grams === null ? null : Number(source.weight.grams) };
    if (Object.hasOwn(source, "individualFindLocation")) {
      record.individualFindLocation = cleanText(source.individualFindLocation);
    }
  }
  if (source.metbull) {
    record.metbull = {
      matchType: source.metbull.matchType,
      canonicalName: cleanText(source.metbull.canonicalName),
      meteoriteCode: cleanText(source.metbull.meteoriteCode),
      metbullUrl: cleanText(source.metbull.metbullUrl),
      alternateNameNote: cleanText(source.metbull.alternateNameNote)
    };
  }
  record.searchText = searchable([
    record.catalogItem === undefined ? null : `catalog item ${record.catalogItem}`,
    record.catalogNumber === undefined ? null : `catalog no ${record.catalogNumber}`,
    record.entryOrder === undefined ? null : `collection entry ${record.entryOrder}`,
    record.reportedNumber === undefined ? null : `reported no ${record.reportedNumber}`,
    record.specimenId === undefined ? null : `specimen id ${record.specimenId}`,
    record.typeNumber === undefined ? null : `type number ${record.typeNumber}`,
    record.recordModel === "table-a-specimen" ? `reported mass ${record.weight.grams} grams` : null,
    ...recordDesignations(record),
    ...(record.holdings || []).flatMap((holding) => [
      holding.description,
      holding.provenance,
      holding.kind === "specimen" ? null : holding.kind,
      holding.count === null ? null : `count ${holding.count}`,
      ...(holding.weights || []).map((weight) => weight.kind),
      ...(holding.representations || []).flatMap((representation) => [representation.kind, representation.count])
    ]),
    record.name,
    record.description,
    record.metbull?.canonicalName,
    record.metbull?.alternateNameNote,
    record.classification,
    typeof record.locality === "string" ? record.locality : null,
    record.individualFindLocation,
    record.locality?.code,
    record.locality?.name,
    record.locality?.coordinate,
    record.year,
    record.dateOfDiscovery,
    record.eventDate,
    record.section,
    record.olivineFa === undefined ? null : `olivine fa ${record.olivineFa}`,
    record.pyroxeneFs === undefined ? null : `pyroxene fs ${record.pyroxeneFs}`,
    record.weathering === undefined ? null : `weathering ${record.weathering}`,
    ...(record.australianMuseumRepresentation ? regionalCensusFacts(record).flatMap(({ label, value }) => [label, value]) : []),
    record.recordModel === "regional-census-fact" ? "regional census catalog observation" : null,
    record.recordModel === "table-a-specimen" ? "table a individual specimen" : null,
    record.recordModel === "dealer-offer-fact" ? "dealer catalog observation not a specimen or holding" : null,
    record.publicationState,
    ...(record.amendments || []).flatMap((amendment) => [
      amendment.kind, amendment.effectiveDate, amendment.targetHolding, amendment.resultingState
    ]),
    ...(record.catalogId === "hamburg-1913" ? [
      ...record.holdings.flatMap(hamburgHoldingDetails),
      ...hamburgRecordFacts(record).flatMap(({ label, value }) => [label, value])
    ] : []),
    record.catalogId,
    record.catalogLabel
  ].filter(Boolean).join(" "));
  record.designationSegmentsList = recordDesignations(record).map(designationComponents).filter(Boolean);
  record.designationKeys = recordDesignations(record).map(genericDesignation).filter(Boolean);
  return record;
}

async function loadData() {
  const currentLoadToken = ++loadToken;
  folioManifest = null;
  earlierRecordsByLaterId = new Map();
  specimenCardProjectionsByParentId = new Map();
  setLoadingState();
  try {
    const response = await fetch(`./data/catalog.json?v=${CACHE_VERSION}`, { cache: "no-cache" });
    if (!response.ok) throw new Error(`The public catalog request returned status ${response.status}.`);
    const catalogText = await response.text();
    const sourceCatalogSha256 = await sha256Text(catalogText);
    requireSchema(sourceCatalogSha256 === SPECIMEN_CARD_SOURCE_CATALOG_SHA256);
    const catalog = validateCatalog(JSON.parse(catalogText));
    catalogRegistry = normalizeCatalogRegistry(catalog.metadata);
    if (elements.catalogSummary) renderCatalogSummary(catalogRegistry);
    records = catalog.records.map((record, index) => prepareRecord(record, index, catalogRegistry));
    if (!records.length) throw new Error("The public catalog contains no source observations.");
    populateCatalogFilter();
    updateStatistics();
    applyUrlState();
    visibleLimit = PAGE_SIZE;
    render();
    loadSpecimenCardProjectionIndex(records, fetch, { sourceCatalogSha256 }).then((index) => {
      if (currentLoadToken !== loadToken) return;
      specimenCardProjectionsByParentId = index;
      if (index.size) render();
    });
    loadEarlierRecordIndex(records, catalogRegistry).then((index) => {
      if (currentLoadToken !== loadToken) return;
      earlierRecordsByLaterId = index;
      if (index.size || elements.lineageOnly.checked) render();
    });
    loadFolioManifest().then((manifest) => {
      if (currentLoadToken !== loadToken) return;
      folioManifest = manifest;
      if (manifest) {
        if (elements.catalogSummary) renderCatalogSummary(catalogRegistry);
        render();
      }
    });
  } catch (error) {
    showError(error);
  }
}

async function loadFolioManifest() {
  try {
    const response = await fetch(`./data/folios.json?v=${CACHE_VERSION}`, { cache: "no-cache" });
    if (!response.ok) return null;
    const manifest = await response.json();
    return validateFolioManifest(manifest, catalogRegistry) ? manifest : null;
  } catch {
    return null;
  }
}

function setLoadingState() {
  elements.results.replaceChildren();
  elements.results.classList.remove("single-result");
  elements.results.setAttribute("aria-busy", "true");
  elements.status.textContent = "Opening the factual index...";
  elements.count.textContent = "Loading";
  elements.countUnit.textContent = "observations";
  elements.showMore.hidden = true;
  elements.empty.hidden = true;
  elements.error.hidden = true;
  if (elements.catalogSummary) {
    const summaryStatus = document.createElement("p");
    summaryStatus.className = "catalog-summary-status";
    summaryStatus.setAttribute("role", "status");
    summaryStatus.textContent = "Reading catalog metadata...";
    elements.catalogSummary.replaceChildren(summaryStatus);
    elements.catalogSummary.setAttribute("aria-busy", "true");
  }
}

function showError(error) {
  elements.results.replaceChildren();
  elements.results.classList.remove("single-result");
  elements.results.setAttribute("aria-busy", "false");
  elements.status.textContent = "The public catalog is unavailable.";
  elements.count.textContent = "0";
  elements.countUnit.textContent = "observations";
  elements.showMore.hidden = true;
  elements.empty.hidden = true;
  elements.errorMessage.textContent = error.message || "The public catalog data is presently unavailable.";
  elements.error.hidden = false;
  if (elements.catalogSummary) {
    const summaryStatus = document.createElement("p");
    summaryStatus.className = "catalog-summary-status";
    summaryStatus.setAttribute("role", "status");
    summaryStatus.textContent = "Catalog source details are unavailable.";
    elements.catalogSummary.replaceChildren(summaryStatus);
    elements.catalogSummary.setAttribute("aria-busy", "false");
  }
  elements.errorHeading.focus();
}

function updateStatistics() {
  const statistics = calculateStatistics(records);
  elements.stats.specimens.textContent = integerFormat.format(statistics.observations);
  elements.stats.names.textContent = integerFormat.format(statistics.names);
  elements.stats.pages.textContent = integerFormat.format(statistics.pages);
  elements.stats.mass.textContent = formatMass(statistics.grams);
  elements.stats.catalogs.textContent = integerFormat.format(statistics.catalogs);
}

function calculateStatistics(sourceRecords) {
  const catalogs = new Set(sourceRecords.map((record) => cleanText(record.catalogId)).filter(Boolean));
  const names = new Set(sourceRecords.map((record) => searchable(record.name)).filter(Boolean));
  const pages = new Set(sourceRecords.flatMap((record) => cleanText(record.catalogId)
    ? recordCatalogPages(record).map((page) => `${record.catalogId}\u0000${page}`)
    : []));
  const masses = sourceRecords.flatMap(recordMasses).sort((left, right) => left - right);
  return {
    observations: sourceRecords.length,
    specimens: sourceRecords.length,
    catalogs: catalogs.size,
    names: names.size,
    pages: pages.size,
    grams: masses.reduce((sum, grams) => sum + grams, 0)
  };
}

function recordMasses(record) {
  if (Array.isArray(record?.holdings)) {
    return record.holdings.flatMap((holding) => Array.isArray(holding.weights)
      ? holding.weights.filter((weight) => weight.kind !== "associated-material").map((weight) => weight.grams).filter(Number.isFinite)
      : [holding.weight?.grams].filter(Number.isFinite));
  }
  return Number.isFinite(record?.weight?.grams) ? [record.weight.grams] : [];
}

function recordSchemaMasses(record) {
  if (Array.isArray(record?.holdings)) {
    return record.holdings.flatMap((holding) => Array.isArray(holding.weights)
      ? holding.weights.map((weight) => weight.grams).filter(Number.isFinite)
      : [holding.weight?.grams].filter(Number.isFinite));
  }
  return Number.isFinite(record?.weight?.grams) ? [record.weight.grams] : [];
}

function recordCatalogPages(record) {
  if (Array.isArray(record?.catalogPages)) return record.catalogPages.filter(Number.isInteger);
  return Number.isInteger(record?.catalogPage) ? [record.catalogPage] : [];
}

function designationSortValue(record) {
  if (record.recordModel === "dealer-offer-fact" || Number.isInteger(record.typeNumber)) return record.typeNumber;
  if (record.recordModel === "catalog-item" || Number.isInteger(record.catalogItem)) return record.catalogItem;
  if (record.recordModel === "catalog-number" || record.catalogNumber !== undefined) return record.catalogNumber;
  if (record.recordModel === "table-a-specimen" || record.specimenId !== undefined) return record.specimenId;
  if (record.recordModel === "regional-census-fact") return record.reportedNumber || record.entryOrder;
  if (record.recordModel === "collection-entry" || record.entryOrder !== undefined) return record.reportedNumber || record.entryOrder;
  return record.designation;
}

function weightSortValue(record, descending) {
  const masses = recordMasses(record);
  return masses.length ? (descending ? Math.max(...masses) : Math.min(...masses)) : null;
}

function catalogSelectorEntries(catalogs) {
  return Object.entries(catalogs || {}).sort(compareCatalogEntries);
}

function compareCatalogEntries([leftId, left], [rightId, right]) {
  return (
    left.year - right.year ||
    collator.compare(catalogLabel(left, leftId), catalogLabel(right, rightId)) ||
    collator.compare(leftId, rightId)
  );
}

function populateCatalogFilter() {
  const options = catalogSelectorEntries(catalogRegistry)
    .map(([catalogId, descriptor]) => {
      const option = document.createElement("option");
      option.value = catalogId;
      option.textContent = catalogDropdownLabel(descriptor, catalogId);
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

function formatEarlierRecordMass(grams) {
  return grams === null ? "Not recorded" : `${massFormat.format(grams)} g`;
}

function currentFilters() {
  const min = elements.min.value === "" ? null : Number(elements.min.value);
  const max = elements.max.value === "" ? null : Number(elements.max.value);
  return {
    query: elements.search.value.trim(),
    catalog: elements.catalog.value && Object.hasOwn(catalogRegistry, elements.catalog.value) ? elements.catalog.value : null,
    min: Number.isFinite(min) ? min : null,
    max: Number.isFinite(max) ? max : null,
    lineageOnly: elements.lineageOnly.checked,
    includeUnknownWeight: elements.includeUnknownWeight.checked,
    sort: VALID_SORTS.has(elements.sort.value) ? elements.sort.value : DEFAULT_SORT
  };
}

function filterRecords(sourceRecords, filters, lineageIndex = new Map()) {
  return sourceRecords.filter((record) => {
    const weightMatches = (filters.min === null && filters.max === null) || recordMasses(record).some((grams) =>
      (filters.min === null || grams >= filters.min) && (filters.max === null || grams <= filters.max)
    );
    const catalogMatches = !filters.catalog || record.catalogId === filters.catalog;
    const lineageMatches = filters.lineageOnly !== true || (lineageIndex.get(record.id)?.length || 0) > 0;
    return catalogMatches && weightMatches && lineageMatches && matchesSearch(record, filters.query);
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

  if (sort.startsWith("designation")) {
    const aValue = designationSortValue(a);
    const bValue = designationSortValue(b);
    if ((aValue === null || aValue === undefined) && bValue !== null && bValue !== undefined) return 1;
    if (aValue !== null && aValue !== undefined && (bValue === null || bValue === undefined)) return -1;
    if (Number.isInteger(aValue) && Number.isInteger(bValue)) comparison = descending * (aValue - bValue);
    else comparison = descending * collator.compare(String(aValue || ""), String(bValue || ""));
  }
  if (sort.startsWith("name")) comparison = compareNullableText(a, b, "name", descending);
  if (sort.startsWith("weight")) {
    const aWeight = weightSortValue(a, descending === -1);
    const bWeight = weightSortValue(b, descending === -1);
    if (aWeight === null && bWeight !== null) return 1;
    if (aWeight !== null && bWeight === null) return -1;
    comparison = descending * ((aWeight || 0) - (bWeight || 0));
  }

  return comparison || collator.compare(String(designationSortValue(a) || ""), String(designationSortValue(b) || "")) || a.order - b.order;
}

function render() {
  const filters = currentFilters();
  const parentMatches = filterRecords(records, currentFilters(), earlierRecordsByLaterId);
  const displayCards = filterSpecimenCardDescriptors(
    expandSpecimenCardDescriptors(parentMatches, specimenCardProjectionsByParentId), filters, earlierRecordsByLaterId
  );
  const matches = displayCards;
  const visibleCards = paginateSpecimenCardDescriptors(displayCards, visibleLimit);
  const matchingObservationCount = new Set(displayCards.map(({ parentRecord }) => parentRecord.id)).size;
  const fragment = document.createDocumentFragment();
  visibleCards.forEach((descriptor) => fragment.append(createRecordCard(descriptor)));
  elements.results.replaceChildren(fragment);
  elements.results.classList.toggle("single-result", isSingleResultCount(matches.length));
  elements.results.setAttribute("aria-busy", "false");
  elements.count.textContent = integerFormat.format(matchingObservationCount);
  elements.countUnit.textContent = matchingObservationCount === 1 ? "observation" : "observations";
  const observationLabel = matchingObservationCount === 1 ? "source observation" : "source observations";
  if (displayCards.length !== matchingObservationCount) {
    elements.status.textContent = displayCards.length > visibleCards.length
      ? `Showing ${integerFormat.format(visibleCards.length)} of ${integerFormat.format(displayCards.length)} display cards from ${integerFormat.format(matchingObservationCount)} matching ${observationLabel}.`
      : displayCards.length ? `Showing all ${integerFormat.format(displayCards.length)} display cards from ${integerFormat.format(matchingObservationCount)} matching ${observationLabel}.` : "No matching source observations.";
  } else {
    elements.status.textContent = displayCards.length > visibleCards.length
      ? `Showing ${integerFormat.format(visibleCards.length)} of ${integerFormat.format(matchingObservationCount)} matching ${observationLabel}.`
      : matchingObservationCount ? `Showing all ${integerFormat.format(matchingObservationCount)} matching ${observationLabel}.` : "No matching source observations.";
  }
  elements.showMore.hidden = visibleCards.length >= displayCards.length;
  elements.empty.hidden = matchingObservationCount !== 0;
  elements.error.hidden = true;
  elements.clear.hidden = !hasActiveFilters();
  updateUrl();
}

function isSingleResultCount(count) {
  return count === 1;
}

function namesAreDisplayEquivalent(sourceName, canonicalName) {
  if (typeof sourceName !== "string" || typeof canonicalName !== "string") return false;
  const normalizedDisplayName = (value) => value.normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
  return normalizedDisplayName(sourceName) === normalizedDisplayName(canonicalName);
}

function metbullPanelDetails(record) {
  if (!record?.metbull) return null;
  if (record.metbull.matchType === "unresolved") {
    return {
      label: "Meteoritical Bulletin review",
      canonicalName: null,
      url: null,
      note: record.metbull.alternateNameNote || "No current Meteoritical Bulletin name was resolved in this review."
    };
  }
  if (namesAreDisplayEquivalent(record.name, record.metbull.canonicalName)) return null;
  return {
    label: "Current Meteoritical Bulletin name",
    canonicalName: record.metbull.canonicalName,
    url: record.metbull.metbullUrl,
    note: record.metbull.alternateNameNote
  };
}

function australianMuseumRepresentationLabel(status) {
  return {
    represented: "Represented in the Australian Museum",
    "not-represented": "Not represented in the Australian Museum",
    mixed: "Mixed representation in the Australian Museum"
  }[status] || null;
}

function regionalCensusFacts(record) {
  const representation = record?.australianMuseumRepresentation;
  if (!representation) return [];
  return [
    { label: "Australian Museum representation", value: australianMuseumRepresentationLabel(representation.status) },
    { label: "Represented occurrences", value: integerFormat.format(representation.representedOccurrences) },
    { label: "Not represented occurrences", value: integerFormat.format(representation.notRepresentedOccurrences) }
  ];
}

function tableASpecimenFacts(record) {
  if (record?.recordModel !== "table-a-specimen") return [];
  return [
    { label: "Locality code", value: record.locality.code },
    { label: "Coordinate", value: record.locality.coordinate },
    { label: "Olivine Fa", value: record.olivineFa },
    { label: "Pyroxene Fs", value: record.pyroxeneFs },
    { label: "Weathering", value: record.weathering },
    { label: "Source section", value: "Table A" }
  ];
}

const HARMONIZED_CARD_KINDS = Object.freeze({
  specimen: "direct-specimen",
  atomic: "projected-atomic-specimen",
  collection: "collection-observation",
  regional: "regional-observation",
  dealer: "dealer-observation"
});

const HARMONIZED_SEMANTIC_LABELS = Object.freeze({
  [HARMONIZED_CARD_KINDS.specimen]: "Specimen.",
  [HARMONIZED_CARD_KINDS.atomic]: "Individual specimen.",
  [HARMONIZED_CARD_KINDS.collection]: "Collection catalog observation; not asserted here as one individual specimen.",
  [HARMONIZED_CARD_KINDS.regional]: "Regional census/catalog observation, not a specimen or holding.",
  [HARMONIZED_CARD_KINDS.dealer]: "Dealer catalog observation, not a specimen or holding"
});

function classifyHarmonizedCard(recordOrDescriptor) {
  const descriptor = recordOrDescriptor?.parentRecord ? recordOrDescriptor : null;
  const record = descriptor?.parentRecord || recordOrDescriptor;
  if (!isPlainObject(record)) return null;
  if (descriptor) {
    if (descriptor.kind === "atomic" && descriptor.projected === true &&
        ["catalog-item", "catalog-number", "collection-entry"].includes(record.recordModel) &&
        typeof descriptor.holdingPath === "string" &&
        (descriptor.repeatedMass
          ? descriptor.massPath === null && resolveSpecimenCardRepeatedMass(
            record, descriptor.holdingPath, descriptor.repeatedMass
          )
          : descriptor.massPath === null || resolveSpecimenCardSelection(
            record, descriptor.holdingPath, descriptor.massPath
          ))) {
      return HARMONIZED_CARD_KINDS.atomic;
    }
    if (descriptor.kind !== "parent" || descriptor.projected !== false) return null;
  }
  if (record.recordModel === "specimen" || record.recordModel === "table-a-specimen") {
    return HARMONIZED_CARD_KINDS.specimen;
  }
  if (["catalog-item", "catalog-number", "collection-entry"].includes(record.recordModel)) {
    return HARMONIZED_CARD_KINDS.collection;
  }
  if (record.recordModel === "regional-census-fact") return HARMONIZED_CARD_KINDS.regional;
  return record.recordModel === "dealer-offer-fact" ? HARMONIZED_CARD_KINDS.dealer : null;
}

function harmonizedCardIdentifier(record, kind, descriptor = null) {
  if (kind === HARMONIZED_CARD_KINDS.atomic) {
    return specimenCardHolding(record, descriptor?.holdingPath)?.holding?.designation || "Unknown";
  }
  if (record.recordModel === "catalog-item") return `Catalog item ${record.catalogItem}`;
  if (record.recordModel === "catalog-number") return `Catalog no. ${record.catalogNumber}`;
  if (record.recordModel === "collection-entry") {
    return record.reportedNumber ? `Reported no. ${record.reportedNumber}` : `Collection entry ${record.entryOrder}`;
  }
  if (record.recordModel === "regional-census-fact") {
    return record.reportedNumber ? `Source number ${record.reportedNumber}` : `Regional census entry ${record.entryOrder}`;
  }
  if (record.recordModel === "table-a-specimen") return record.specimenId || "Unknown";
  if (record.recordModel === "dealer-offer-fact") return `Type number ${record.typeNumber}`;
  return record.designation || "Unknown";
}

function harmonizedCardEvent(record) {
  if (record.recordModel === "catalog-number") return record.dateOfDiscovery;
  if (record.recordModel === "collection-entry" || record.recordModel === "regional-census-fact") return record.eventDate;
  if (record.recordModel === "specimen" || record.recordModel === "catalog-item") return record.year;
  return null;
}

function harmonizedSourceCitation(record) {
  const sourceLabel = record.catalogLabel || record.catalogId;
  const pages = recordCatalogPages(record);
  return pages.length
    ? `${sourceLabel} \u00b7 ${pages.length === 1 ? "p." : "pp."} ${pages.join(", ")}`
    : `${sourceLabel} \u00b7 page not recorded`;
}

function presentHarmonizedCard(recordOrDescriptor, options = {}) {
  const descriptor = recordOrDescriptor?.parentRecord
    ? recordOrDescriptor
    : parentSpecimenCardDescriptor(recordOrDescriptor);
  const record = descriptor.parentRecord;
  const kind = classifyHarmonizedCard(descriptor);
  if (!kind) throw new Error("The record cannot be presented as a public card.");

  const specimen = kind === HARMONIZED_CARD_KINDS.specimen || kind === HARMONIZED_CARD_KINDS.atomic;
  const sourceName = record.name;
  const canonicalName = record.metbull?.canonicalName &&
    !namesAreDisplayEquivalent(sourceName, record.metbull.canonicalName)
    ? record.metbull.canonicalName
    : null;
  const facts = [];
  if (specimen) {
    facts.push({
      label: "Current Meteoritical Bulletin name",
      value: record.metbull?.canonicalName
        ? namesAreDisplayEquivalent(sourceName, record.metbull.canonicalName)
          ? "Same as source catalog name"
          : record.metbull.canonicalName
        : "Unknown"
    });
  } else if (canonicalName) {
    facts.push({ label: "Current Meteoritical Bulletin name", value: canonicalName });
  }
  facts.push({ label: "Class", value: record.classification || "Unknown" });
  if (specimen) {
    facts.push({
      label: "Specimen form",
      value: kind === HARMONIZED_CARD_KINDS.atomic || record.recordModel === "table-a-specimen"
        ? "Individual specimen"
        : "Specimen"
    });
  }
  facts.push({
    label: "Source locality",
    value: (record.recordModel === "table-a-specimen" ? record.locality?.name : record.locality) || "Unknown"
  });
  if (specimen) facts.push({ label: "Individual find location", value: record.individualFindLocation || "Unknown" });
  facts.push({ label: "Event", value: harmonizedCardEvent(record) || "Unknown" });

  if (specimen) {
    const sourceLineage = Array.isArray(options.lineageEntries) ? options.lineageEntries : [];
    const lineageEntries = kind === HARMONIZED_CARD_KINDS.atomic
      ? descriptor.massPath === null ? [] : sourceLineage.filter((entry) => entry.massPath === descriptor.massPath)
      : sourceLineage;
    const grams = kind === HARMONIZED_CARD_KINDS.atomic
      ? descriptor.repeatedMass
        ? resolveSpecimenCardRepeatedMass(record, descriptor.holdingPath, descriptor.repeatedMass)?.grams
        : descriptor.massPath === null ? null : resolveSpecimenCardSelection(
          record, descriptor.holdingPath, descriptor.massPath
        )?.grams
      : record.weight?.grams;
    facts.push({
      label: "Lineage",
      value: lineageEntries.length ? formatLineageSummary(lineageEntries.length) : "Unknown"
    });
    facts.push({ label: "Specimen weight", value: Number.isFinite(grams) ? formatMass(grams) : "Unknown" });
  }

  return {
    kind,
    identifier: harmonizedCardIdentifier(record, kind, descriptor),
    semanticLabel: HARMONIZED_SEMANTIC_LABELS[kind],
    sourceName: sourceName || "Unknown",
    description: record.description || null,
    facts,
    sourceCitation: harmonizedSourceCitation(record),
    sourceLabel: record.catalogLabel || record.catalogId,
    catalogId: record.catalogId,
    catalogPages: recordCatalogPages(record)
  };
}

function appendMetaRow(meta, label, value) {
  const row = document.createElement("div");
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  term.textContent = label;
  description.textContent = displayText(value);
  if (value === "Unknown") row.classList.add("unknown");
  row.append(term, description);
  meta.append(row);
}

function createRecordCard(recordOrDescriptor) {
  const descriptor = recordOrDescriptor?.parentRecord ? recordOrDescriptor : parentSpecimenCardDescriptor(recordOrDescriptor);
  const record = descriptor.parentRecord;
  const dto = presentHarmonizedCard(descriptor, {
    lineageEntries: earlierRecordsByLaterId.get(record.id) || []
  });
  const card = elements.template.content.firstElementChild.cloneNode(true);
  card.dataset.cardKind = dto.kind;
  card.classList.toggle("specimen-card", dto.kind === HARMONIZED_CARD_KINDS.specimen || dto.kind === HARMONIZED_CARD_KINDS.atomic);
  card.classList.toggle("observation-card", [HARMONIZED_CARD_KINDS.collection, HARMONIZED_CARD_KINDS.regional, HARMONIZED_CARD_KINDS.dealer].includes(dto.kind));
  card.querySelector(".designation").textContent = displayText(dto.identifier);
  const semanticLabel = card.querySelector(".record-semantic-label, .record-model-label");
  semanticLabel.textContent = dto.semanticLabel;
  semanticLabel.hidden = false;
  card.querySelector(".source-name-label").textContent = dto.kind === HARMONIZED_CARD_KINDS.dealer
    ? "Source catalog name" : "Source catalog meteorite name";
  card.querySelector(".record-name").textContent = displayText(dto.sourceName);
  const description = card.querySelector(".record-description");
  if (dto.description) {
    description.querySelector("p").textContent = displayText(dto.description);
    description.hidden = false;
  } else {
    description.remove();
  }
  const meta = card.querySelector(".record-meta");
  meta.replaceChildren();
  dto.facts.forEach(({ label, value }) => appendMetaRow(meta, label, value));

  [".metbull-name", ".specimen-position", ".record-weight", ".record-holdings", ".earlier-records"]
    .forEach((selector) => card.querySelector(selector)?.remove());
  card.querySelector(".confidence")?.remove();
  const source = card.querySelector(".record-source, .catalog-reference");
  source.textContent = `Source citation: ${displayText(dto.sourceCitation)}`;
  dto.catalogPages.forEach((catalogPage) => {
    const folio = getAuthorizedFolio(folioManifest, record.catalogId, catalogPage, catalogRegistry);
    if (!folio) return;
    const button = document.createElement("button");
    button.className = "folio-button";
    button.type = "button";
    button.textContent = dto.catalogPages.length === 1 ? "View folio" : `View folio ${catalogPage}`;
    button.setAttribute("aria-label", `View catalog folio for ${dto.sourceLabel}, page ${catalogPage}`);
    button.addEventListener("click", () => openFolioDialog(record.catalogId, folio.pageId, button));
    card.querySelector(".record-footer").append(button);
  });
  return card;
}

function renderEarlierRecords(card, entries) {
  const lineageRow = card.querySelector(".lineage-row");
  lineageRow.querySelector("dd").textContent = formatLineageSummary(entries.length);
  lineageRow.classList.toggle("unknown", !entries.length);
  const section = card.querySelector(".earlier-records");
  if (!entries.length) {
    section.remove();
    return;
  }
  section.querySelector(".earlier-records-title").textContent = `Earlier specimen-lineage records (${integerFormat.format(entries.length)})`;
  const list = section.querySelector(".earlier-records-list");
  entries.forEach((entry) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.className = "earlier-record-link";
    link.href = entry.catalogSearchUrl;
    link.textContent = `${entry.catalogYear} · ${displayText(entry.catalogLabel)}`;
    const name = document.createElement("p");
    name.textContent = `Source name: ${entry.sourceName ? displayText(entry.sourceName) : "Not recorded"}`;
    const facts = document.createElement("p");
    facts.className = "earlier-record-facts";
    facts.textContent = entry.relationship === "same-inventory"
      ? `Same collection inventory ID: ${entry.seriesId}:${entry.inventoryId} · Reported mass: ${formatEarlierRecordMass(entry.massGrams)}`
      : `Possible match · Reported mass: ${formatEarlierRecordMass(entry.massGrams)} · ${LINEAGE_STRENGTH_LABELS[entry.strength]}`;
    item.append(link, name, facts);
    list.append(item);
  });
  section.hidden = false;
}

function formatLineageSummary(count) {
  if (!count) return "No lineage known";
  return `${integerFormat.format(count)} earlier lineage ${count === 1 ? "record" : "records"}`;
}

function holdingDetails(holding) {
  const details = [];
  if (holding.description) details.push(displayText(holding.description));
  if (holding.count !== null) details.push(`Count: ${integerFormat.format(holding.count)}`);
  if (holding.kind === "cast") details.push("Cast");
  if (holding.kind === "aggregate") details.push("Aggregate");
  return details;
}

function catalogNumberHoldingDetails(holding) {
  if (Array.isArray(holding.representations)) return hamburgHoldingDetails(holding);
  const details = [];
  if (holding.provenance) details.push(`Provenance: ${displayText(holding.provenance)}`);
  if (holding.count !== null) details.push(`Reported count: ${integerFormat.format(holding.count)}`);
  if (holding.weights.length) details.push(`Masses: ${holding.weights.map(({ grams }) => formatMass(grams)).join(", ")}`);
  return details;
}

function hamburgWeightKindLabel(kind) {
  return {
    "individual-holding": "Individual holding",
    "aggregate-holding": "Aggregate holding",
    "associated-material": "Associated material"
  }[kind] || kind;
}

function hamburgHoldingDetails(holding) {
  const details = [];
  if (holding.count !== null) details.push(`Reported count: ${integerFormat.format(holding.count)}`);
  if (holding.weights.length) details.push(`Components: ${holding.weights.map((weight) =>
    `${hamburgWeightKindLabel(weight.kind)}: ${formatMass(weight.grams)}`).join("; ")}`);
  if (holding.reportedTotalWeight) details.push(`Reported total: ${formatMass(holding.reportedTotalWeight.grams)}`);
  if (holding.representations.length) details.push(`Representations: ${holding.representations.map((representation) =>
    `${integerFormat.format(representation.count)} ${representation.count === 1 ? "thin section" : "thin sections"}`).join(", ")}`);
  return details;
}

function hamburgRecordFacts(record) {
  const facts = [{
    label: "Publication",
    value: record.publicationState === "supplement" ? "August 1913 supplement" : "Base register"
  }];
  if (record.reportedTotalWeight) facts.push({
    label: "Observation reported total",
    value: formatMass(record.reportedTotalWeight.grams)
  });
  record.amendments.forEach((amendment) => facts.push({
    label: amendment.baseObservationRetained ? "Amendment (base observation retained)" : "Amendment",
    value: `August 1913: ${formatMass(amendment.targetWeight.grams)} component identified as ${displayText(amendment.targetHolding)} disposed by exchange; destination not recorded.`
  }));
  return facts;
}

function hamburgAmendmentComponentPath(record, amendment) {
  const weightIndex = amendment.targetComponentOrder - 1;
  const candidates = record.holdings.flatMap((holding, holdingIndex) => {
    const component = holding.weights?.[weightIndex];
    return component?.kind === "individual-holding" && component.grams === amendment.targetWeight.grams
      ? [`holdings[${holdingIndex}].weights[${weightIndex}]`]
      : [];
  });
  return candidates.length === 1 ? candidates[0] : null;
}

function specimenCardHamburgFacts(descriptor) {
  const record = descriptor.parentRecord;
  if (record?.catalogId !== "hamburg-1913") return [];
  if (!descriptor.projected) return hamburgRecordFacts(record);
  return hamburgRecordFacts(record).filter(({ label }, index) => {
    if (index === 0) return true;
    if (!label.startsWith("Amendment")) return false;
    return record.amendments.some((amendment) =>
      hamburgAmendmentComponentPath(record, amendment) === descriptor.componentPath);
  });
}

function renderHoldings(card, holdings, recordModel = "catalog-item", headingText = "Holdings") {
  const section = card.querySelector(".record-holdings");
  section.querySelector("h4").textContent = headingText;
  const list = section.querySelector(".holdings-list");
  holdings.forEach((holding) => {
    const item = document.createElement("li");
    const heading = document.createElement("div");
    const designation = document.createElement("strong");
    const weightedHolding = recordModel === "catalog-number" || recordModel === "collection-entry";
    designation.textContent = weightedHolding
      ? displayText(holding.description)
      : holding.designation ? displayText(holding.designation) : "Unnumbered";
    heading.append(designation);
    if (!weightedHolding && holding.weight.grams !== null) {
      const mass = document.createElement("span");
      mass.className = "holding-mass";
      mass.textContent = formatMass(holding.weight.grams);
      heading.append(mass);
    }
    item.append(heading);
    const details = weightedHolding ? catalogNumberHoldingDetails(holding) : holdingDetails(holding);
    if (details.length) {
      const description = document.createElement("p");
      description.textContent = details.join(" · ");
      item.append(description);
    }
    list.append(item);
  });
  section.hidden = false;
}

function renderProjectedSpecimenCardContent(card, entries) {
  const section = card.querySelector(".record-holdings");
  const weighted = entries.every(({ type }) => type === "weight");
  const heading = weighted ? "Specimen weight" : "Specimen details";
  section.setAttribute("aria-label", heading);
  section.querySelector("h4").textContent = heading;
  const list = section.querySelector(".holdings-list");
  entries.forEach((entry) => {
    const item = document.createElement("li");
    item.className = `projected-content-${entry.type}`;
    const value = document.createElement("p");
    value.className = entry.type === "weight" ? "specimen-weight" : "specimen-details";
    value.textContent = entry.type === "weight" ? formatMass(entry.grams) : entry.text;
    item.append(value);
    list.append(item);
  });
  section.hidden = false;
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

function openFolioDialog(catalogId, pageReference, opener) {
  activeFolioPages = getAuthorizedFolioPages(folioManifest, catalogId, catalogRegistry);
  activeFolioIndex = activeFolioPages.findIndex((folio) => folio.pageId === pageReference);
  if (activeFolioIndex < 0 && pageReference !== null && pageReference !== "") {
    activeFolioIndex = activeFolioPages.findIndex((folio) => folio.catalogPage === Number(pageReference));
  }
  if (activeFolioIndex < 0) return;
  folioOpener = opener;
  updateFolioDialog();
  elements.dialog.showModal();
}

function setIssueReportChallenge() {
  issueReportChallenge = createIssueReportChallenge();
  issueReportOpenedAt = Date.now();
  elements.issueReportQuestion.textContent = `Anti-spam check: What is ${issueReportChallenge.left} + ${issueReportChallenge.right}?`;
}

function openIssueReportDialog(opener) {
  issueReportOpener = opener;
  elements.issueReportForm.reset();
  elements.issueReportAnswer.removeAttribute("aria-invalid");
  elements.issueReportError.hidden = true;
  elements.issueReportError.textContent = "";
  setIssueReportChallenge();
  elements.issueReportDialog.showModal();
  elements.issueReportAnswer.focus();
}

function showIssueReportError(message, answerIsInvalid = false) {
  elements.issueReportError.textContent = message;
  elements.issueReportError.hidden = false;
  if (answerIsInvalid) elements.issueReportAnswer.setAttribute("aria-invalid", "true");
  else elements.issueReportAnswer.removeAttribute("aria-invalid");
  elements.issueReportAnswer.focus();
}

function submitIssueReport(event) {
  event.preventDefault();
  const result = evaluateIssueReportGate({
    answer: elements.issueReportAnswer.value,
    expectedAnswer: issueReportChallenge?.answer,
    honeypot: elements.issueReportHoneypot.value,
    openedAt: issueReportOpenedAt,
    now: Date.now()
  });
  if (result.reason === "honeypot") {
    showIssueReportError("The anti-spam check could not be completed.");
    return;
  }
  if (result.reason === "too-fast") {
    showIssueReportError("Please take at least three seconds to complete the anti-spam check.");
    return;
  }
  if (result.reason === "wrong-answer") {
    elements.issueReportAnswer.value = "";
    setIssueReportChallenge();
    showIssueReportError("That answer was not correct. Try the new addition question.", true);
    return;
  }
  window.open(ISSUE_FORM_URL, "_blank", "noopener,noreferrer");
  elements.issueReportDialog.close();
}

function folioPageLabel(folio, index) {
  if (folio.pageLabel) return folio.pageLabel;
  if (folio.catalogPage !== null) return `Page ${folio.catalogPage}`;
  return `Source image ${index + 1}`;
}

function updateFolioDialog() {
  const folio = activeFolioPages[activeFolioIndex];
  if (!folio) return;
  const sourceLabel = catalogLabel(catalogRegistry[folio.catalogId], folio.catalogId);
  const pageLabel = folioPageLabel(folio, activeFolioIndex);
  const safeLabel = `${sourceLabel}, ${pageLabel}`;
  elements.dialogCatalog.textContent = sourceLabel;
  elements.dialogTitle.textContent = folio.pageLabel ||
    (folio.catalogPage !== null ? `Catalog page ${folio.catalogPage}` : pageLabel);
  elements.dialogCaption.textContent = `Catalog folio: ${safeLabel}`;
  elements.dialogImageStatus.textContent = "Loading folio...";
  elements.dialogImage.hidden = false;
  elements.dialogImage.alt = folio.alt;
  elements.dialogImage.src = folio.image;
  elements.folioPosition.textContent = `${pageLabel} · ${activeFolioIndex + 1} of ${activeFolioPages.length}`;
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
  return Boolean(filters.query || filters.catalog || filters.min !== null || filters.max !== null || filters.lineageOnly || filters.includeUnknownWeight === false || filters.sort !== DEFAULT_SORT);
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
  if (filters.lineageOnly === true) params.set("lineage", "1");
  if (filters.includeUnknownWeight === false) params.set("weighted", "1");
  if (VALID_SORTS.has(filters.sort) && filters.sort !== DEFAULT_SORT) params.set("sort", filters.sort);
  return params;
}

function parseUrlFilters(search, registry = {}) {
  const params = new URLSearchParams(search);
  const catalog = params.get("catalog") || "";
  const lineage = params.getAll("lineage");
  const weighted = params.getAll("weighted");
  const { min, max } = normalizeWeightRange(params.get("min"), params.get("max"));
  const sort = params.get("sort") || DEFAULT_SORT;
  return {
    query: params.get("q") || "",
    catalog: Object.hasOwn(registry, catalog) ? catalog : "",
    min,
    max,
    lineageOnly: lineage.length === 1 && lineage[0] === "1",
    includeUnknownWeight: !(weighted.length === 1 && weighted[0] === "1"),
    sort: VALID_SORTS.has(sort) ? sort : DEFAULT_SORT
  };
}

function applyUrlState() {
  const filters = parseUrlFilters(window.location.search, catalogRegistry);
  elements.search.value = filters.query;
  elements.catalog.value = filters.catalog;
  elements.min.value = filters.min;
  elements.max.value = filters.max;
  elements.lineageOnly.checked = filters.lineageOnly;
  elements.includeUnknownWeight.checked = filters.includeUnknownWeight;
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
  elements.issueReportOpen.addEventListener("click", () => openIssueReportDialog(elements.issueReportOpen));
  elements.issueReportClose.addEventListener("click", () => elements.issueReportDialog.close());
  elements.issueReportCancel.addEventListener("click", () => elements.issueReportDialog.close());
  elements.issueReportForm.addEventListener("submit", submitIssueReport);
  elements.issueReportDialog.addEventListener("click", (event) => {
    if (event.target === elements.issueReportDialog) elements.issueReportDialog.close();
  });
  elements.issueReportDialog.addEventListener("close", () => {
    elements.issueReportForm.reset();
    elements.issueReportError.hidden = true;
    issueReportChallenge = null;
    issueReportOpenedAt = 0;
    if (issueReportOpener?.isConnected) issueReportOpener.focus();
    issueReportOpener = null;
  });
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
  elements.lineageOnly.addEventListener("change", () => {
    if (validateWeights()) {
      visibleLimit = PAGE_SIZE;
      render();
    }
  });
  elements.includeUnknownWeight.addEventListener("change", () => {
    if (validateWeights()) {
      visibleLimit = PAGE_SIZE;
      render();
    }
  });
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

const publicRuntime = {
  CACHE_VERSION,
  catalogLabel,
  catalogSummaryEntries,
  classifyHarmonizedCard,
  createIssueReportChallenge,
  evaluateIssueReportGate,
  getAuthorizedFolioPages,
  normalizeCatalogRegistry,
  presentHarmonizedCard,
  validateSpecimenCardManifest,
  validateCatalog,
  validateFolioManifest
};

if (typeof window !== "undefined") window.HMCPublicRuntime = Object.freeze(publicRuntime);

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    ASSET_CACHE_VERSION,
    CACHE_VERSION,
    CATALOG_RECORD_COUNT,
    CATALOG_SCHEMA_VERSION,
    CATALOG_SHA256: SPECIMEN_CARD_SOURCE_CATALOG_SHA256,
    DEFAULT_SORT,
    DISPLAY_DESCRIPTOR_COUNT,
    ISSUE_FORM_URL,
    ISSUE_REPORT_MINIMUM_ELAPSED_MS,
    SPECIMEN_CARD_PROJECTION_DATA_SHA256,
    SPECIMEN_CARD_PROJECTION_SET_SHA256,
    SPECIMEN_CARD_SOURCE_CATALOG_SHA256,
    SPECIMEN_LINEAGE_DATA_SHA256,
    LINEAGE_SHA256: SPECIMEN_LINEAGE_DATA_SHA256,
    OBSERVATION_DESCRIPTOR_COUNT,
    PROJECTION_SHA256: SPECIMEN_CARD_PROJECTION_DATA_SHA256,
    SPECIMEN_DESCRIPTOR_COUNT,
    UNKNOWN_WEIGHT_EXCLUSION_COUNT,
    WEIGHTED_DESCRIPTOR_COUNT,
    FACTUAL_FORMULA_INVALID_SUFFIXES,
    FACTUAL_FORMULA_TOKENS,
    FACTUAL_FORMULA_UNSAFE_PREFIXES,
    FACTUAL_FORMULA_VALID_SUFFIXES,
    calculateStatistics,
    calculateLineageCounts,
    createIssueReportChallenge,
    chronologicalEarlierPair,
    catalogDropdownLabel,
    catalogLabel,
    catalogSelectorEntries,
    catalogSummaryEntries,
    catalogNumberHoldingDetails,
    classifyHarmonizedCard,
    compareRecords,
    containsUnsafePath,
    designationComponents,
    deriveEarlierRecordIndex,
    deriveSpecimenCardProjectionIndex,
    expandSpecimenCardDescriptors,
    evaluateIssueReportGate,
    filterRecords,
    filterSpecimenCardDescriptors,
    formatLineageSummary,
    formatMass,
    formatEarlierRecordMass,
    formatSourcePageCoverage,
    getAuthorizedFolio,
    getAuthorizedFolioPages,
    genericDesignation,
    hamburgHoldingDetails,
    hamburgRecordFacts,
    specimenCardHamburgFacts,
    holdingDetails,
    hasMatchingFolioPolicy,
    isDesignationQuery,
    isSingleResultCount,
    isSafeLineageSearchUrl,
    isSafeFolioPath,
    isValidFolioAlt,
    matchesSearch,
    metbullPanelDetails,
    namesAreDisplayEquivalent,
    loadEarlierRecordIndex,
    loadSpecimenCardProjectionIndex,
    normalizeWeightRange,
    normalizeFolioAlt,
    normalizeDesignation,
    numericLeadingHoldingCode,
    normalizeCatalogRegistry,
    hasValidMetbull,
    metbullUrlForCode,
    parseUrlFilters,
    parseSearchQuery,
    prepareRecord,
    presentHarmonizedCard,
    regionalCensusFacts,
    recordDesignations,
    recordCatalogPages,
    recordMasses,
    recordSchemaMasses,
    resolveSpecimenCardSelection,
    resolveSpecimenCardRepeatedMass,
    resolveSpecimenCardClause,
    resolveSpecimenCardComponent,
    searchable,
    secureRandomInteger,
    sha256Text,
    serializeUrlFilters,
    lineageEntriesForSpecimenCard,
    paginateSpecimenCardDescriptors,
    specimenCardDescriptorHoldings,
    specimenCardDescriptorMasses,
    specimenCardDescriptorHasKnownWeight,
    specimenCardHolding,
    specimenCardPositionLabel,
    specimenCardContextEntries,
    specimenCardSourceMasses,
    tableASpecimenFacts,
    weightSortValue,
    validateCatalog,
    validateFolioManifest,
    validateLineageCandidates,
    validateSpecimenCardManifest
  };
}
