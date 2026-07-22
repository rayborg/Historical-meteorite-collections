import { readFile } from "node:fs/promises";

const CATALOG_URL = new URL("../data/catalog.json", import.meta.url);
const FOLIOS_URL = new URL("../data/folios.json", import.meta.url);
const FIXTURE_URL = new URL("./test-multicatalog-fixture.json", import.meta.url);
const SYNTHETIC_ONLY = process.argv.includes("--synthetic-only");
const SPECIMEN_KEYS = [
  "id", "catalogId", "designation", "name", "weight", "classification", "locality", "year", "catalogPage", "confidence",
];
const CATALOG_ITEM_KEYS = [
  "id", "catalogId", "catalogItem", "holdings", "name", "classification", "locality", "year", "catalogPage", "confidence",
];
const HOLDING_KEYS = ["designation", "kind", "description", "count", "weight"];
const HOLDING_KINDS = ["specimen", "cast", "aggregate"];
const RECORD_MODELS = ["specimen", "catalog-item"];
const FACTUAL_FIELDS = [
  "id",
  "catalogId",
  "designation",
  "name",
  "weight.grams",
  "catalogItem",
  "holdings[].designation",
  "holdings[].kind",
  "holdings[].description",
  "holdings[].count",
  "holdings[].weight.grams",
  "classification",
  "locality",
  "year",
  "catalogPage",
  "confidence",
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
const RIGHTS_STATUSES = ["undetermined", "public-domain"];
const PAGE_ENTRY_KEYS = ["thumbnail", "image", "alt"];
const MAX_ALT_LENGTH = 160;
const MAX_CATALOG_ID_LENGTH = 80;
const MAX_CATALOG_TEXT_LENGTH = 160;
const FOLIO_PATH_ROOT = "assets/folios/";
const APPROVED_FOLIO_EXTENSION = /\.(?:webp|png|jpe?g|avif)$/u;
const LEAKAGE_MARKER =
  /\b(?:raw[\s_-]*ocr|raw[\s_-]*text|ocr[\s_-]*(?:output|text)|source[\s_-]*(?:image|file)(?:[\s_-]*name)?s?|scan(?:ned)?[\s_-]*(?:image|file|path|name)s?|verbatim[\s_-]*notes?|transcription[\s_-]*notes?)\b/iu;
const IMAGE_OR_SOURCE_FILE =
  /\.(?:avif|bmp|gif|heic|heif|hocr|jpe?g|ocr|pdf|png|svg|tiff?|webp)(?=$|[^A-Za-z0-9])|\b(?:dscn?|img|pxl)[_-]?\d{3,}\b/iu;
const PATH_LIKE_STRING =
  /(?:^|[\s"'(])(?:[A-Za-z][A-Za-z\d+.-]*:\/\/|\/{1,2}|\.{1,2}[\\/]|~[\\/]|[A-Za-z]:[\\/]|(?:assets?|files?|folios?|images?|scans?|source[\s_-]*images?)[\\/])|\\/iu;
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

function assertHoldingText(value, path) {
  if (value === null) return;
  assert(!HOLDING_PRIVATE_LANGUAGE.test(value), `${path} contains private holding language`);
  assert(!HOLDING_PRIVATE_DOCUMENT.test(value), `${path} contains a private path or document extension`);
  assert(!HOLDING_WEIGHT_DISPLAY.test(value), `${path} contains a private weight-display string`);
}

function rejectCatalogExcludedContent(value, path = "catalog") {
  if (typeof value === "string") {
    assert(value === normalizeString(value), `${path} is not NFC/whitespace normalized`);
    assert(!/[\p{Cc}\p{Cf}]/u.test(value), `${path} contains a control or format character`);
    assert(!LEAKAGE_MARKER.test(value), `${path} contains raw OCR, scan, note, or source-file language`);
    assert(!IMAGE_OR_SOURCE_FILE.test(value), `${path} contains an image or source-document filename`);
    assert(!PATH_LIKE_STRING.test(value), `${path} contains a file path`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectCatalogExcludedContent(item, `${path}[${index}]`));
    return;
  }
  if (!isObject(value)) return;
  Object.entries(value).forEach(([key, child]) => rejectCatalogExcludedContent(child, `${path}.${key}`));
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
  assert(metadata.schemaVersion === 3, `${path}.schemaVersion must be 3`);
  assert(metadata.scope === "facts-only", `${path}.scope must be facts-only`);
  assert(
    Array.isArray(metadata.factualFields) && metadata.factualFields.length === FACTUAL_FIELDS.length &&
      metadata.factualFields.every((field, index) => field === FACTUAL_FIELDS[index]),
    `${path}.factualFields does not match the schema 3 public record models`,
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
    assert(descriptor.folioDisplayPolicy !== "display" || descriptor.rightsStatus === "public-domain",
      `${descriptorPath} may display folios only with public-domain status`);
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
  return recordModel === "specimen"
    ? (record.designation === null ? [] : [record.designation])
    : record.holdings.map((holding) => holding.designation).filter((value) => value !== null);
}

function recordMasses(record, recordModel) {
  return recordModel === "specimen"
    ? (record.weight.grams === null ? [] : [record.weight.grams])
    : record.holdings.map((holding) => holding.weight.grams).filter((value) => value !== null);
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
  const modelOrder = RECORD_MODELS.indexOf(rightModel) - RECORD_MODELS.indexOf(leftModel);
  if (modelOrder) return modelOrder;
  if (leftModel === "catalog-item") {
    return left.catalogItem - right.catalogItem || compareText(left.name, right.name) || compareText(left.id, right.id);
  }
  const identityOrder = compareDesignation(left.designation, right.designation);
  const leftMasses = recordMasses(left, leftModel);
  const rightMasses = recordMasses(right, rightModel);
  return identityOrder || compareText(left.name, right.name) ||
    compareNullableNumber(leftMasses.length ? Math.min(...leftMasses) : null, rightMasses.length ? Math.min(...rightMasses) : null) ||
    compareText(left.id, right.id);
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

function validatePublicCatalog(data, folios, path = "catalog") {
  rejectCatalogExcludedContent(data, path);
  assertExactKeys(data, ["metadata", "records"], path);
  const metadataByCatalog = validateMetadata(data.metadata, `${path}.metadata`);
  assert(Array.isArray(data.records) && data.records.length > 0, `${path}.records must be a nonempty array`);
  const folioStats = validateFolioManifest(folios, `${path} folios`);
  const ids = new Set();
  const catalogItemNumbers = new Map();
  const previousCatalogItems = new Map();
  const representedCatalogs = new Set();
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
    assertExactKeys(record, recordModel === "specimen" ? SPECIMEN_KEYS : CATALOG_ITEM_KEYS, recordPath);
    assertString(record.id, `${recordPath}.id`);
    assert(!ids.has(record.id), `${recordPath}.id is duplicated: ${record.id}`);
    ids.add(record.id);
    representedCatalogs.add(record.catalogId);
    for (const field of ["name", "classification", "locality", "year"]) {
      assertString(record[field], `${recordPath}.${field}`, true);
    }
    if (recordModel === "specimen") {
      assertString(record.designation, `${recordPath}.designation`, true);
      assertExactKeys(record.weight, ["grams"], `${recordPath}.weight`);
      assert(record.weight.grams === null || (Number.isFinite(record.weight.grams) && record.weight.grams >= 0),
        `${recordPath}.weight.grams must be a finite nonnegative number or null`);
      assert(record.designation !== null || record.name !== null || record.weight.grams !== null ||
        record.classification !== null || record.locality !== null || record.year !== null,
      `${recordPath} must contain a substantive public fact`);
    } else {
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
    }
    assert(Number.isInteger(record.catalogPage) && catalog.sourcePages.has(record.catalogPage),
      `${recordPath}.catalogPage is outside its descriptor sourcePages`);
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
    Object.keys(policy.pages).forEach((page) => assert(sourcePages.has(Number(page)),
      `folios.catalogs.${catalogId}.pages.${page} is outside sourcePages`));
  }
  return { catalogCount: metadataByCatalog.size, recordCount: data.records.length, statsByCatalog, metadataByCatalog, folioStats };
}

function assertSafeFolioPath(value, catalogId, path) {
  assertString(value, path);
  assert(!/\s/u.test(value), `${path} must not contain whitespace`);
  assert(!value.startsWith("/") && !/^[A-Za-z][A-Za-z\d+.-]*:/u.test(value), `${path} must be relative`);
  assert(!/[\\?#%]/u.test(value) && !value.includes("//"), `${path} contains an unsafe URL or path form`);
  const root = `${FOLIO_PATH_ROOT}${catalogId}/`;
  assert(value.startsWith(root), `${path} must be rooted under ${root}`);
  const segments = value.slice(root.length).split("/");
  assert(segments.length && segments.every((segment) => segment && segment !== "." && segment !== ".."),
    `${path} contains an unsafe segment`);
  assert(segments.every((segment) => /^[A-Za-z0-9._-]+$/u.test(segment)), `${path} must use plain ASCII segments`);
  assert(APPROVED_FOLIO_EXTENSION.test(segments.at(-1)), `${path} has an unapproved extension`);
}

function assertPlainAlt(value, path) {
  assertString(value, path);
  assert([...value].length <= MAX_ALT_LENGTH, `${path} must be at most ${MAX_ALT_LENGTH} characters`);
  assert(!/[\p{Cc}\p{Cf}<>]/u.test(value) && !/`|!?\[[^\]]*\]\([^)]*\)/u.test(value), `${path} must be plain text`);
}

function validateFolioManifest(manifest, path) {
  assertExactKeys(manifest, ["schemaVersion", "catalogs"], path);
  assert(manifest.schemaVersion === 1, `${path}.schemaVersion must be 1`);
  assert(isObject(manifest.catalogs) && Object.keys(manifest.catalogs).length > 0, `${path}.catalogs must be nonempty`);
  let pageEntryCount = 0;
  for (const [catalogId, policy] of Object.entries(manifest.catalogs)) {
    const policyPath = `${path}.catalogs.${catalogId}`;
    assertCatalogId(catalogId, `${policyPath} ID`);
    assertExactKeys(policy, ["displayPolicy", "rightsStatus", "pages"], policyPath);
    assert(DISPLAY_POLICIES.includes(policy.displayPolicy), `${policyPath}.displayPolicy is invalid`);
    assert(RIGHTS_STATUSES.includes(policy.rightsStatus), `${policyPath}.rightsStatus is invalid`);
    assert(isObject(policy.pages), `${policyPath}.pages must be an object`);
    if (policy.displayPolicy === "display") assert(policy.rightsStatus === "public-domain",
      `${policyPath} may display only with public-domain status`);
    else assert(Object.keys(policy.pages).length === 0, `${policyPath}.pages must be empty while blocked`);
    for (const [page, entry] of Object.entries(policy.pages)) {
      const entryPath = `${policyPath}.pages.${page}`;
      assert(/^[1-9]\d*$/u.test(page), `${entryPath} must use a positive page number`);
      assertAllowedKeys(entry, PAGE_ENTRY_KEYS, ["image", "alt"], entryPath);
      assertSafeFolioPath(entry.image, catalogId, `${entryPath}.image`);
      if (Object.hasOwn(entry, "thumbnail")) assertSafeFolioPath(entry.thumbnail, catalogId, `${entryPath}.thumbnail`);
      assertPlainAlt(entry.alt, `${entryPath}.alt`);
      pageEntryCount += 1;
    }
  }
  return { catalogCount: Object.keys(manifest.catalogs).length, pageEntryCount };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function blockedFolios(metadata) {
  return {
    schemaVersion: 1,
    catalogs: Object.fromEntries(metadata.catalogs.map(({ id }) => [id, {
      displayPolicy: "blocked", rightsStatus: "undetermined", pages: {},
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
        schemaVersion: 3,
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
      schemaVersion: 1,
      catalogs: {
        "alpha-1901": { displayPolicy: "blocked", rightsStatus: "undetermined", pages: {} },
        "beta-1888": {
          displayPolicy: "display",
          rightsStatus: "public-domain",
          pages: {
            7: {
              image: "assets/folios/beta-1888/page-7.webp",
              thumbnail: "assets/folios/beta-1888/page-7-thumbnail.webp",
              alt: "Beta catalog page 7",
            },
          },
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
  boundary.data.records[0].name = "scan";
  boundary.data.records[0].classification = "image";
  boundary.data.records[0].locality = "notes";
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
    folios.catalogs["extra-1900"] = { displayPolicy: "blocked", rightsStatus: "undetermined", pages: {} };
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
  assertCatalogRejection(({ data }) => { data.metadata.schemaVersion = 2; }, "wrong canonical metadata schema version");
  assertCatalogRejection(({ data }) => { data.metadata.generatedAt = "2026-07-19"; }, "extra canonical metadata root key");
  assertCatalogRejection(({ data }) => { data.metadata.catalogs[0].edition = "First"; }, "extra catalog descriptor key");
  assertCatalogRejection(({ data }) => { data.metadata.catalogs[0].sourcePageCount = 2; }, "sourcePageCount mismatch");
  assertCatalogRejection(({ data }) => { data.metadata.catalogs[0].label = "../private/catalog-scan.pdf"; }, "catalog label leakage");
  assertCatalogRejection(({ folios }) => {
    folios.catalogs["beta-1888"].pages[8] = {
      image: "assets/folios/beta-1888/page-8.webp", alt: "Beta catalog page 8",
    };
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
  ]) assertCatalogRejection(({ data }) => { data.records[0].locality = value; }, description);
  assertCatalogRejection(({ data }) => { data.records[0].rawOcr = "unpublished text"; }, "raw OCR key");
  assertCatalogRejection(({ data }) => { data.metadata.catalogs[0].sourceFilename = "page-1.dat"; }, "source filename key");
  assert(baselineAllowCount === 2, `expected 2 baseline catalog allows, got ${baselineAllowCount}`);
  assert(baselineRejectionCount === 55, `expected 55 baseline catalog rejections, got ${baselineRejectionCount}`);

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
  ];
  validatePublicCatalog(independentNumbering, modelFolios,
    "synthetic independent numbering and catalog-item ID tie breaker");
  modelOrderingAllowCount += 1;

  const holdingPrivacyBoundary = clone(modelFixture);
  holdingPrivacyBoundary.records.find(({ id }) => id === "nininger-item-1").holdings[0].description = "found in 1932";
  holdingPrivacyBoundary.records.find(({ id }) => id === "nininger-item-1").holdings[0].designation = "134g";
  holdingPrivacyBoundary.records.find(({ id }) => id === "nininger-item-2").holdings[0].description = "M1 to M15";
  const boundaryAggregate = holdingPrivacyBoundary.records.find(({ id }) => id === "nininger-item-2").holdings[1];
  boundaryAggregate.designation = "128 s";
  boundaryAggregate.description = "a series of 15 individuals";
  validatePublicCatalog(holdingPrivacyBoundary, modelFolios, "synthetic legitimate holding privacy boundaries");
  holdingPrivacyAllowCount += 1;

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

  return {
    baselineAllowCount,
    baselineRejectionCount,
    modelAllowCount,
    modelOrderingAllowCount,
    holdingPrivacyAllowCount,
    modelRejectionCount,
  };
}

function syntheticManifest({
  rightsStatus = "public-domain",
  image = "assets/folios/reviewed-example/page-3.webp",
  thumbnail = "assets/folios/reviewed-example/page-3-thumbnail.webp",
  alt = "Reviewed catalog page 3",
  pageEntry,
} = {}) {
  const entry = pageEntry ?? { image, alt, ...(thumbnail === null ? {} : { thumbnail }) };
  return {
    schemaVersion: 1,
    catalogs: {
      "reviewed-example": { displayPolicy: "display", rightsStatus, pages: { 3: entry } },
    },
  };
}

function runSyntheticFolioTests() {
  let allowCount = 0;
  let rejectionCount = 0;
  const allow = (manifest, description) => {
    const stats = validateFolioManifest(manifest, `synthetic ${description}`);
    assert(stats.pageEntryCount === 1, `synthetic ${description} must contain one page`);
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

  for (const extension of ["webp", "png", "jpg", "jpeg", "avif"]) {
    allow(syntheticManifest({
      image: `assets/folios/reviewed-example/page-3.${extension}`,
      thumbnail: `assets/folios/reviewed-example/page-3-thumbnail.${extension}`,
    }), `approved .${extension} paths`);
  }
  allow(syntheticManifest({ thumbnail: null }), "optional thumbnail omission");
  reject(syntheticManifest({ rightsStatus: "undetermined" }), "display with undetermined rights");
  reject(syntheticManifest({ rightsStatus: "unknown" }), "unknown rights status");
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
  const malformedPaths = [
    ["empty path", ""],
    ["whitespace", "assets/folios/reviewed-example/page 3.webp"],
    ["slash-rooted", "/assets/folios/reviewed-example/page-3.webp"],
    ["scheme", "https://example.test/page-3.webp"],
    ["protocol-relative", "//example.test/page-3.webp"],
    ["backslash", "assets\\folios\\reviewed-example\\page-3.webp"],
    ["query suffix", "assets/folios/reviewed-example/page-3.webp?download=1"],
    ["query-only", "?download=1"],
    ["fragment suffix", "assets/folios/reviewed-example/page-3.webp#page"],
    ["fragment-only", "#page"],
    ["current segment", "assets/folios/reviewed-example/./page-3.webp"],
    ["parent segment", "assets/folios/reviewed-example/../page-3.webp"],
    ["missing filename segment", "assets/folios/reviewed-example/"],
    ["duplicate slash empty segment", "assets/folios/reviewed-example//page-3.webp"],
    ["outside root", "assets/images/reviewed-example/page-3.webp"],
    ["lookalike root", "assets/folios-other/reviewed-example/page-3.webp"],
    ["wrong catalog directory", "assets/folios/other-catalog/page-3.webp"],
    ["percent-encoded whitespace", "assets/folios/reviewed-example/page%203.webp"],
    ["encoded traversal", "assets/folios/reviewed-example/%2e%2e/page-3.webp"],
    ["repeated-encoded traversal", "assets/folios/reviewed-example/%252e%252e/page-3.webp"],
    ["encoded external form", "assets/folios/reviewed-example/https%3A%2F%2Fevil.test/page-3.webp"],
    ["repeated-encoded external form", "assets/folios/reviewed-example/https%253A%252F%252Fevil.test/page-3.webp"],
    ["unsafe .svg extension", "assets/folios/reviewed-example/page-3.svg"],
    ["unsafe .gif extension", "assets/folios/reviewed-example/page-3.gif"],
    ["unsafe .pdf extension", "assets/folios/reviewed-example/page-3.pdf"],
    ["missing extension", "assets/folios/reviewed-example/page-3"],
    ["unapproved uppercase extension", "assets/folios/reviewed-example/page-3.WEBP"],
  ];
  for (const field of ["image", "thumbnail"]) {
    for (const [description, value] of malformedPaths) reject(syntheticManifest({ [field]: value }), `${field} ${description}`);
  }
  reject(syntheticManifest({ pageEntry: {
    full: "assets/folios/reviewed-example/page-3.webp", alt: "Reviewed catalog page 3",
  } }), "wrong full key");
  reject(syntheticManifest({ pageEntry: {
    image: "assets/folios/reviewed-example/page-3.webp", alt: "Reviewed catalog page 3", caption: "Unexpected field",
  } }), "extra page-entry key");
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
  assert(allowCount === 6, `expected 6 folio allows, got ${allowCount}`);
  assert(rejectionCount === 71, `expected 71 folio rejections, got ${rejectionCount}`);
  return { allowCount, rejectionCount };
}

const fixture = JSON.parse(await readFile(FIXTURE_URL, "utf8"));
const catalogFixtureStats = runSyntheticCatalogTests(fixture);
const folioFixtureStats = runSyntheticFolioTests();
console.log(
  `Synthetic fixtures: ${catalogFixtureStats.baselineAllowCount} baseline catalog allows, ` +
  `${catalogFixtureStats.baselineRejectionCount} baseline catalog/leakage rejections, ` +
  `${catalogFixtureStats.modelAllowCount} model-aware catalog allow, ` +
  `${catalogFixtureStats.modelOrderingAllowCount} model-ordering/catalog-scope allow, ` +
  `${catalogFixtureStats.holdingPrivacyAllowCount} holding-privacy boundary allow, ` +
  `${catalogFixtureStats.modelRejectionCount} model/holding rejections, ` +
  `${folioFixtureStats.allowCount} folio allows, ${folioFixtureStats.rejectionCount} folio rejections passed.`,
);

if (!SYNTHETIC_ONLY) {
  const [data, folios] = await Promise.all(
    [CATALOG_URL, FOLIOS_URL].map(async (url) => JSON.parse(await readFile(url, "utf8"))),
  );
  const deployedStats = validatePublicCatalog(data, folios, "root");
  const totalPageCount = [...deployedStats.metadataByCatalog.values()].reduce(
    (sum, { descriptor }) => sum + descriptor.sourcePageCount,
    0,
  );
  console.log(
    `Validated data/catalog.json and data/folios.json: ${deployedStats.recordCount} records across ` +
    `${deployedStats.catalogCount} schema 3 facts-only catalogs, ${totalPageCount} metadata source pages, ` +
    `${deployedStats.folioStats.pageEntryCount} displayable folio pages.`,
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

export { rejectCatalogExcludedContent, validateFolioManifest, validatePublicCatalog };
