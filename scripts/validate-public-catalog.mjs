import { readFile } from "node:fs/promises";

const CATALOG_URL = new URL("../data/catalog.json", import.meta.url);
const FOLIOS_URL = new URL("../data/folios.json", import.meta.url);
const RECORD_KEYS = [
  "id",
  "catalogId",
  "designation",
  "name",
  "weight",
  "classification",
  "locality",
  "year",
  "catalogPage",
  "confidence",
];
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
  "confidence",
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
const LEGACY_METADATA_KEYS = [
  "catalog",
  "scope",
  "sourcePageRange",
  "sourcePageCount",
  "recordCount",
  "factualFields",
  "recordsWithDesignation",
  "recordsWithWeight",
  "confidenceCounts",
];
const LEGACY_CATALOG_METADATA_KEYS = ["id", "compiler", "year", "folioDisplayPolicy", "rightsStatus"];
const METADATA_V2_KEYS = [
  "schemaVersion",
  "scope",
  "factualFields",
  "catalogs",
  "recordCount",
  "recordsWithDesignation",
  "recordsWithWeight",
  "confidenceCounts",
];
const CATALOG_V2_KEYS = [
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
  "rightsStatus",
];
const LEAKAGE_MARKER =
  /\b(?:raw[\s_-]*ocr|raw[\s_-]*text|ocr[\s_-]*(?:output|text)|source[\s_-]*(?:image|file)(?:[\s_-]*name)?s?|scan(?:ned)?[\s_-]*(?:image|file|path|name)s?|verbatim[\s_-]*notes?|transcription[\s_-]*notes?)\b/iu;
const IMAGE_OR_SOURCE_FILE =
  /\.(?:avif|bmp|gif|heic|heif|hocr|jpe?g|ocr|pdf|png|svg|tiff?|webp)(?=$|[^A-Za-z0-9])|\b(?:dscn?|img|pxl)[_-]?\d{3,}\b/iu;
const PATH_LIKE_STRING =
  /(?:^|[\s"'(])(?:[A-Za-z][A-Za-z\d+.-]*:\/\/|\/{1,2}|\.{1,2}[\\/]|~[\\/]|[A-Za-z]:[\\/]|(?:assets?|files?|folios?|images?|scans?|source[\s_-]*images?)[\\/])|\\/iu;

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
    actualValues.length === expectedValues.length &&
      actualValues.every((value, index) => value === expectedValues[index]),
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
    typeof value === "string" &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value) &&
      value.length <= MAX_CATALOG_ID_LENGTH,
    `${path} must be a lowercase catalog slug of at most ${MAX_CATALOG_ID_LENGTH} characters`,
  );
}

function assertCatalogText(value, path) {
  assertString(value, path);
  assert(value.length <= MAX_CATALOG_TEXT_LENGTH, `${path} must be at most ${MAX_CATALOG_TEXT_LENGTH} characters`);
}

function compareText(left, right) {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left < right ? -1 : 1;
}

function designationParts(value) {
  if (value === null) return null;
  const prefix = value.match(/^[A-Za-z]*/u)?.[0];
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
  if (prefixOrder !== 0) return prefixOrder;

  const commonLength = Math.min(leftParts.numbers.length, rightParts.numbers.length);
  for (let index = 0; index < commonLength; index += 1) {
    const difference = leftParts.numbers[index] - rightParts.numbers[index];
    if (difference !== 0) return difference;
  }
  return leftParts.numbers.length - rightParts.numbers.length;
}

function compareNumber(left, right) {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}

function compareRecords(left, right) {
  return (
    compareDesignation(left.designation, right.designation) ||
    compareText(left.name, right.name) ||
    compareNumber(left.weight.grams, right.weight.grams) ||
    compareText(left.id, right.id)
  );
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

  for (const [key, child] of Object.entries(value)) {
    rejectCatalogExcludedContent(child, `${path}.${key}`);
  }
}

function assertSafeFolioPath(value, catalogId, path) {
  assertString(value, path);
  assert(!/\s/u.test(value), `${path} must not contain whitespace`);
  assert(!value.startsWith("/"), `${path} must not be slash-rooted or protocol-relative`);
  assert(!/^[A-Za-z][A-Za-z\d+.-]*:/u.test(value), `${path} must not use a URL scheme`);
  assert(!value.includes("\\"), `${path} must not contain backslashes`);
  assert(!/[?#]/u.test(value), `${path} must not contain a query or fragment`);
  assert(!value.includes("%"), `${path} must not contain percent encoding`);
  assert(!value.includes("//"), `${path} must not contain duplicate slashes`);
  const catalogPathRoot = `${FOLIO_PATH_ROOT}${catalogId}/`;
  assert(value.startsWith(catalogPathRoot), `${path} must be rooted under ${catalogPathRoot}`);

  const relativePath = value.slice(catalogPathRoot.length);
  assert(relativePath.length > 0, `${path} must contain a filename segment`);
  assert(/^[A-Za-z0-9._/-]+$/u.test(relativePath), `${path} must be a plain relative path`);
  const segments = relativePath.split("/");
  assert(
    segments.every((segment) => segment !== "" && segment !== "." && segment !== ".."),
    `${path} contains an unsafe path segment`,
  );
  assert(APPROVED_FOLIO_EXTENSION.test(segments.at(-1)), `${path} does not use an approved image extension`);
}

function assertPlainAlt(value, path) {
  assertString(value, path);
  assert([...value].length <= MAX_ALT_LENGTH, `${path} must be at most ${MAX_ALT_LENGTH} characters`);
  assert(!/[\p{Cc}\p{Cf}]/u.test(value), `${path} must not contain control or format characters`);
  assert(!/[<>]/u.test(value), `${path} must not contain markup`);
  assert(!/`|!?\[[^\]]*\]\([^)]*\)/u.test(value), `${path} must not contain markup`);
}

function validateFolioManifest(manifest, path) {
  assertExactKeys(manifest, ["schemaVersion", "catalogs"], path);
  assert(manifest.schemaVersion === 1, `${path}.schemaVersion must be 1`);
  assert(isObject(manifest.catalogs), `${path}.catalogs must be an object`);
  assert(Object.keys(manifest.catalogs).length > 0, `${path}.catalogs must not be empty`);

  let pageEntryCount = 0;
  for (const [catalogId, policy] of Object.entries(manifest.catalogs)) {
    const policyPath = `${path}.catalogs.${catalogId}`;
    assertCatalogId(catalogId, `${policyPath} catalog ID`);
    assertExactKeys(policy, ["displayPolicy", "rightsStatus", "pages"], policyPath);
    assert(DISPLAY_POLICIES.includes(policy.displayPolicy), `${policyPath}.displayPolicy is not a known value`);
    assert(RIGHTS_STATUSES.includes(policy.rightsStatus), `${policyPath}.rightsStatus is not a known value`);
    assert(isObject(policy.pages), `${policyPath}.pages must be an object`);

    if (policy.displayPolicy === "display") {
      assert(
        policy.rightsStatus === "public-domain",
        `${policyPath} may use display only after a public-domain determination`,
      );
    } else {
      assert(Object.keys(policy.pages).length === 0, `${policyPath}.pages must be empty while display is blocked`);
    }

    for (const [pageNumber, entry] of Object.entries(policy.pages)) {
      const entryPath = `${policyPath}.pages.${pageNumber}`;
      assert(policy.displayPolicy === "display", `${entryPath} requires displayPolicy display`);
      assert(/^[1-9]\d*$/u.test(pageNumber), `${entryPath} must use a positive printed page number`);
      assertAllowedKeys(entry, PAGE_ENTRY_KEYS, ["image", "alt"], entryPath);
      assertSafeFolioPath(entry.image, catalogId, `${entryPath}.image`);
      if (Object.hasOwn(entry, "thumbnail")) {
        assertSafeFolioPath(entry.thumbnail, catalogId, `${entryPath}.thumbnail`);
      }
      assertPlainAlt(entry.alt, `${entryPath}.alt`);
      pageEntryCount += 1;
    }
  }

  return { catalogCount: Object.keys(manifest.catalogs).length, pageEntryCount };
}

function assertFactualFields(value, path) {
  assert(
    Array.isArray(value) &&
      value.length === FACTUAL_FIELDS.length &&
      value.every((field, index) => field === FACTUAL_FIELDS[index]),
    `${path} does not match the public record schema`,
  );
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
    assert(
      Number.isInteger(value.confidenceCounts[level]) && value.confidenceCounts[level] >= 0,
      `${path}.confidenceCounts.${level} must be a nonnegative integer`,
    );
  }
  assert(
    CONFIDENCE_LEVELS.reduce((sum, level) => sum + value.confidenceCounts[level], 0) === value.recordCount,
    `${path}.confidenceCounts must sum to recordCount`,
  );
}

function validateCanonicalMetadata(metadata, path) {
  assertExactKeys(metadata, METADATA_V2_KEYS, path);
  assert(metadata.schemaVersion === 2, `${path}.schemaVersion must be 2`);
  assert(metadata.scope === "facts-only", `${path}.scope must be facts-only`);
  assertFactualFields(metadata.factualFields, `${path}.factualFields`);
  assertCountSummary(metadata, path);
  assert(Array.isArray(metadata.catalogs) && metadata.catalogs.length > 0, `${path}.catalogs must be a nonempty array`);

  const metadataByCatalog = new Map();
  metadata.catalogs.forEach((entry, index) => {
    const entryPath = `${path}.catalogs[${index}]`;
    assertExactKeys(entry, CATALOG_V2_KEYS, entryPath);
    assertCatalogId(entry.id, `${entryPath}.id`);
    assert(!metadataByCatalog.has(entry.id), `${entryPath}.id is duplicated: ${entry.id}`);
    assertCatalogText(entry.label, `${entryPath}.label`);
    assertCatalogText(entry.compiler, `${entryPath}.compiler`);
    assert(Number.isInteger(entry.year) && entry.year > 0, `${entryPath}.year must be a positive integer`);
    assert(Array.isArray(entry.sourcePages) && entry.sourcePages.length > 0, `${entryPath}.sourcePages must be nonempty`);
    entry.sourcePages.forEach((page, pageIndex) => {
      assert(Number.isInteger(page) && page > 0, `${entryPath}.sourcePages[${pageIndex}] must be a positive integer`);
      if (pageIndex > 0) {
        assert(page > entry.sourcePages[pageIndex - 1], `${entryPath}.sourcePages must be sorted and unique`);
      }
    });
    assert(
      entry.sourcePageCount === entry.sourcePages.length,
      `${entryPath}.sourcePageCount must equal sourcePages.length`,
    );
    assertCountSummary(entry, entryPath);
    assert(
      DISPLAY_POLICIES.includes(entry.folioDisplayPolicy),
      `${entryPath}.folioDisplayPolicy is not a known value`,
    );
    assert(RIGHTS_STATUSES.includes(entry.rightsStatus), `${entryPath}.rightsStatus is not a known value`);
    metadataByCatalog.set(entry.id, {
      entry,
      path: entryPath,
      policyPath: entryPath,
      sourcePageSet: new Set(entry.sourcePages),
    });
  });

  for (const field of ["recordCount", "recordsWithDesignation", "recordsWithWeight"]) {
    const catalogTotal = metadata.catalogs.reduce((sum, entry) => sum + entry[field], 0);
    assert(metadata[field] === catalogTotal, `${path}.${field} must equal the sum of catalog ${field} values`);
  }
  for (const level of CONFIDENCE_LEVELS) {
    const catalogTotal = metadata.catalogs.reduce((sum, entry) => sum + entry.confidenceCounts[level], 0);
    assert(
      metadata.confidenceCounts[level] === catalogTotal,
      `${path}.confidenceCounts.${level} must equal the sum of catalog values`,
    );
  }

  return { metadataByCatalog, totals: metadata, schemaVersion: 2 };
}

function validateLegacyMetadata(metadata, path) {
  assertExactKeys(metadata, LEGACY_METADATA_KEYS, path);
  assertExactKeys(metadata.catalog, LEGACY_CATALOG_METADATA_KEYS, `${path}.catalog`);
  assertExactKeys(metadata.sourcePageRange, ["start", "end"], `${path}.sourcePageRange`);
  assertExactKeys(metadata.confidenceCounts, CONFIDENCE_LEVELS, `${path}.confidenceCounts`);
  assertFactualFields(metadata.factualFields, `${path}.factualFields`);

  assert(metadata.catalog.id === "huss-1976", `${path}.catalog.id must be huss-1976`);
  assert(metadata.catalog.compiler === "Glenn Huss", `${path}.catalog.compiler must be Glenn Huss`);
  assert(metadata.catalog.year === 1976, `${path}.catalog.year must be 1976`);
  assert(metadata.catalog.folioDisplayPolicy === "blocked", `${path}.catalog.folioDisplayPolicy must be blocked`);
  assert(metadata.catalog.rightsStatus === "undetermined", `${path}.catalog.rightsStatus must be undetermined`);
  assert(metadata.scope === "facts-only", `${path}.scope must be facts-only`);
  assert(metadata.sourcePageRange.start === 3, `${path}.sourcePageRange.start must be 3`);
  assert(metadata.sourcePageRange.end === 48, `${path}.sourcePageRange.end must be 48`);
  assert(metadata.sourcePageCount === 46, `${path}.sourcePageCount must be 46`);
  assert(metadata.recordCount === 1078, `${path}.recordCount must be 1078`);
  assert(metadata.recordsWithDesignation === 1074, `${path}.recordsWithDesignation must be 1074`);
  assert(metadata.recordsWithWeight === 1077, `${path}.recordsWithWeight must be 1077`);
  assert(metadata.confidenceCounts.high === 1077, `${path}.confidenceCounts.high must be 1077`);
  assert(metadata.confidenceCounts.medium === 1, `${path}.confidenceCounts.medium must be 1`);
  assert(metadata.confidenceCounts.low === 0, `${path}.confidenceCounts.low must be 0`);

  const sourcePages = Array.from({ length: 46 }, (_, index) => index + 3);
  const entry = {
    ...metadata.catalog,
    label: "Glenn Huss (1976)",
    sourcePages,
    sourcePageCount: metadata.sourcePageCount,
    recordCount: metadata.recordCount,
    recordsWithDesignation: metadata.recordsWithDesignation,
    recordsWithWeight: metadata.recordsWithWeight,
    confidenceCounts: metadata.confidenceCounts,
  };
  return {
    metadataByCatalog: new Map([
      [
        entry.id,
        {
          entry,
          path,
          policyPath: `${path}.catalog`,
          sourcePageSet: new Set(sourcePages),
        },
      ],
    ]),
    totals: metadata,
    schemaVersion: 1,
  };
}

function validateMetadata(metadata, path) {
  assert(isObject(metadata), `${path} must be an object`);
  if (Object.hasOwn(metadata, "schemaVersion") || Object.hasOwn(metadata, "catalogs")) {
    return validateCanonicalMetadata(metadata, path);
  }
  return validateLegacyMetadata(metadata, path);
}

function validatePublicCatalog(data, folios, path = "catalog") {
  rejectCatalogExcludedContent(data, path);
  assertExactKeys(data, ["metadata", "records"], path);
  const metadataValidation = validateMetadata(data.metadata, `${path}.metadata`);
  const { metadataByCatalog } = metadataValidation;
  assert(Array.isArray(data.records), `${path}.records must be an array`);
  assert(data.records.length > 0, `${path}.records must not be empty`);
  const folioStats = validateFolioManifest(folios, `${path} folios`);

  const metadataIds = new Set(metadataByCatalog.keys());
  const manifestIds = new Set(Object.keys(folios.catalogs));
  const recordIds = new Set();
  const ids = new Set();
  const statsByCatalog = new Map(
    [...metadataIds].map((catalogId) => [
      catalogId,
      {
        recordCount: 0,
        recordsWithDesignation: 0,
        recordsWithWeight: 0,
        confidenceCounts: Object.fromEntries(CONFIDENCE_LEVELS.map((level) => [level, 0])),
        pages: new Set(),
      },
    ]),
  );

  data.records.forEach((record, index) => {
    const recordPath = `${path}.records[${index}]`;
    assertExactKeys(record, RECORD_KEYS, recordPath);
    assertString(record.id, `${recordPath}.id`);
    assert(!ids.has(record.id), `${recordPath}.id is duplicated: ${record.id}`);
    ids.add(record.id);

    assertCatalogId(record.catalogId, `${recordPath}.catalogId`);
    recordIds.add(record.catalogId);
    const catalogMetadata = metadataByCatalog.get(record.catalogId);
    assert(catalogMetadata, `${recordPath}.catalogId has no catalog metadata: ${record.catalogId}`);
    assert(Object.hasOwn(folios.catalogs, record.catalogId), `${recordPath}.catalogId has no folio display policy`);
    for (const field of ["designation", "name", "classification", "locality", "year"]) {
      assertString(record[field], `${recordPath}.${field}`, true);
    }

    assertExactKeys(record.weight, ["grams"], `${recordPath}.weight`);
    assert(
      record.weight.grams === null || (Number.isFinite(record.weight.grams) && record.weight.grams >= 0),
      `${recordPath}.weight.grams must be a finite nonnegative number or null`,
    );
    assert(
      record.designation !== null ||
        record.name !== null ||
        record.weight.grams !== null ||
        record.classification !== null ||
        record.locality !== null ||
        record.year !== null,
      `${recordPath} must contain at least one substantive public fact`,
    );
    assert(
      Number.isInteger(record.catalogPage) && catalogMetadata.sourcePageSet.has(record.catalogPage),
      `${recordPath}.catalogPage must be one of the sourcePages for ${record.catalogId}`,
    );
    assert(CONFIDENCE_LEVELS.includes(record.confidence), `${recordPath}.confidence is invalid`);

    const catalogStats = statsByCatalog.get(record.catalogId);
    catalogStats.recordCount += 1;
    catalogStats.pages.add(record.catalogPage);
    catalogStats.confidenceCounts[record.confidence] += 1;
    if (record.designation !== null) catalogStats.recordsWithDesignation += 1;
    if (record.weight.grams !== null) catalogStats.recordsWithWeight += 1;

    if (index > 0) {
      assert(compareRecords(data.records[index - 1], record) < 0, `${recordPath} violates deterministic independent sort order`);
    }
  });

  assertExactSet(recordIds, metadataIds, `${path} record catalog IDs`);
  assertExactSet(manifestIds, metadataIds, `${path} folio manifest catalog IDs`);

  for (const [catalogId, { entry, path: metadataPath, policyPath, sourcePageSet }] of metadataByCatalog) {
    const catalogStats = statsByCatalog.get(catalogId);
    assert(
      catalogStats.recordCount === entry.recordCount,
      `${metadataPath}.recordCount does not match ${catalogId} records`,
    );
    assert(
      catalogStats.recordsWithDesignation === entry.recordsWithDesignation,
      `${metadataPath}.recordsWithDesignation does not match ${catalogId} records`,
    );
    assert(
      catalogStats.recordsWithWeight === entry.recordsWithWeight,
      `${metadataPath}.recordsWithWeight does not match ${catalogId} records`,
    );
    if (metadataValidation.schemaVersion === 1) {
      assertExactSet(catalogStats.pages, sourcePageSet, `${metadataPath} represented page set`);
    }
    for (const level of CONFIDENCE_LEVELS) {
      assert(
        catalogStats.confidenceCounts[level] === entry.confidenceCounts[level],
        `${metadataPath}.confidenceCounts.${level} does not match ${catalogId} records`,
      );
    }

    const policy = folios.catalogs[catalogId];
    assert(
      policy.displayPolicy === entry.folioDisplayPolicy,
      `${policyPath}.folioDisplayPolicy does not match the manifest`,
    );
    assert(
      policy.rightsStatus === entry.rightsStatus,
      `${policyPath}.rightsStatus does not match the manifest`,
    );
    for (const pageNumber of Object.keys(policy.pages)) {
      assert(sourcePageSet.has(Number(pageNumber)), `folios.catalogs.${catalogId}.pages.${pageNumber} is outside sourcePages`);
    }
  }

  const globalStats = {
    recordCount: data.records.length,
    recordsWithDesignation: 0,
    recordsWithWeight: 0,
    confidenceCounts: Object.fromEntries(CONFIDENCE_LEVELS.map((level) => [level, 0])),
  };
  for (const catalogStats of statsByCatalog.values()) {
    globalStats.recordsWithDesignation += catalogStats.recordsWithDesignation;
    globalStats.recordsWithWeight += catalogStats.recordsWithWeight;
    for (const level of CONFIDENCE_LEVELS) {
      globalStats.confidenceCounts[level] += catalogStats.confidenceCounts[level];
    }
  }
  for (const field of ["recordCount", "recordsWithDesignation", "recordsWithWeight"]) {
    assert(
      metadataValidation.totals[field] === globalStats[field],
      `${path}.metadata.${field} does not match all records`,
    );
  }
  for (const level of CONFIDENCE_LEVELS) {
    assert(
      metadataValidation.totals.confidenceCounts[level] === globalStats.confidenceCounts[level],
      `${path}.metadata.confidenceCounts.${level} does not match all records`,
    );
  }

  return {
    catalogCount: metadataByCatalog.size,
    recordCount: data.records.length,
    folioStats,
    metadataByCatalog,
    statsByCatalog,
    schemaVersion: metadataValidation.schemaVersion,
  };
}

function syntheticManifest({
  rightsStatus = "public-domain",
  image = "assets/folios/reviewed-example/page-3.webp",
  thumbnail = "assets/folios/reviewed-example/page-3-thumbnail.webp",
  alt = "Reviewed catalog page 3",
  pageEntry,
} = {}) {
  const entry = pageEntry ?? {
    image,
    alt,
    ...(thumbnail === null ? {} : { thumbnail }),
  };
  return {
    schemaVersion: 1,
    catalogs: {
      "reviewed-example": {
        displayPolicy: "display",
        rightsStatus,
        pages: {
          3: entry,
        },
      },
    },
  };
}

let syntheticAllowCount = 0;
let syntheticRejectionCount = 0;

function assertSyntheticAllow(manifest, description) {
  const stats = validateFolioManifest(manifest, `synthetic ${description}`);
  assert(stats.pageEntryCount === 1, `synthetic ${description} must contain one page`);
  syntheticAllowCount += 1;
}

function assertSyntheticRejection(manifest, description) {
  let rejected = false;
  try {
    validateFolioManifest(manifest, `synthetic ${description}`);
  } catch {
    rejected = true;
  }
  assert(rejected, `synthetic fixture must reject ${description}`);
  syntheticRejectionCount += 1;
}

const [data, folios] = await Promise.all(
  [CATALOG_URL, FOLIOS_URL].map(async (url) => JSON.parse(await readFile(url, "utf8"))),
);
rejectCatalogExcludedContent(data);
const folioStats = validateFolioManifest(folios, "folios");

for (const extension of ["webp", "png", "jpg", "jpeg", "avif"]) {
  assertSyntheticAllow(
    syntheticManifest({
      image: `assets/folios/reviewed-example/page-3.${extension}`,
      thumbnail: `assets/folios/reviewed-example/page-3-thumbnail.${extension}`,
    }),
    `approved .${extension} paths`,
  );
}
assertSyntheticAllow(syntheticManifest({ thumbnail: null }), "optional thumbnail omission");

assertSyntheticRejection(syntheticManifest({ rightsStatus: "undetermined" }), "display with undetermined rights");
assertSyntheticRejection(syntheticManifest({ rightsStatus: "unknown" }), "unknown rights status");

for (const [description, catalogId] of [
  ["uppercase catalog ID", "Reviewed-Example"],
  ["underscore catalog ID", "reviewed_example"],
  ["whitespace catalog ID", "reviewed example"],
  ["overlong catalog ID", "a".repeat(MAX_CATALOG_ID_LENGTH + 1)],
]) {
  const manifest = syntheticManifest();
  manifest.catalogs[catalogId] = manifest.catalogs["reviewed-example"];
  delete manifest.catalogs["reviewed-example"];
  assertSyntheticRejection(manifest, description);
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
  for (const [description, value] of malformedPaths) {
    assertSyntheticRejection(syntheticManifest({ [field]: value }), `${field} ${description}`);
  }
}

assertSyntheticRejection(
  syntheticManifest({
    pageEntry: {
      full: "assets/folios/reviewed-example/page-3.webp",
      alt: "Reviewed catalog page 3",
    },
  }),
  "wrong full key",
);
assertSyntheticRejection(
  syntheticManifest({
    pageEntry: {
      image: "assets/folios/reviewed-example/page-3.webp",
      alt: "Reviewed catalog page 3",
      caption: "Unexpected field",
    },
  }),
  "extra page-entry key",
);

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
]) {
  assertSyntheticRejection(syntheticManifest({ alt }), description);
}

function fixtureCatalog({
  id,
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
        schemaVersion: 2,
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
          id: "alpha-a1",
          catalogId: "alpha-1901",
          designation: "A1",
          name: "Alpha",
          weight: { grams: 1 },
          classification: "Iron",
          locality: "Alpha County",
          year: "1900",
          catalogPage: 1,
          confidence: "high",
        },
        {
          id: "beta-b1",
          catalogId: "beta-1888",
          designation: "B1",
          name: "Beta",
          weight: { grams: 2 },
          classification: "Stone",
          locality: "Beta County",
          year: "1887",
          catalogPage: 7,
          confidence: "low",
        },
        {
          id: "alpha-c1",
          catalogId: "alpha-1901",
          designation: "C1",
          name: "Gamma",
          weight: { grams: null },
          classification: null,
          locality: null,
          year: null,
          catalogPage: 2,
          confidence: "medium",
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

let catalogAllowCount = 0;
let catalogRejectionCount = 0;

function assertCatalogAllow(fixture, description) {
  validatePublicCatalog(fixture.data, fixture.folios, `synthetic ${description}`);
  catalogAllowCount += 1;
}

function assertCatalogRejection(mutate, description) {
  const fixture = multiCatalogFixture();
  mutate(fixture);
  let rejected = false;
  try {
    validatePublicCatalog(fixture.data, fixture.folios, `synthetic ${description}`);
  } catch {
    rejected = true;
  }
  assert(rejected, `synthetic catalog fixture must reject ${description}`);
  catalogRejectionCount += 1;
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

assertCatalogAllow(multiCatalogFixture(), "valid multi-catalog data");
const runtimeBoundaryFixture = multiCatalogFixture();
renameFixtureCatalog(runtimeBoundaryFixture, "alpha-1901", "a".repeat(MAX_CATALOG_ID_LENGTH));
runtimeBoundaryFixture.data.metadata.catalogs[0].label = "L".repeat(MAX_CATALOG_TEXT_LENGTH);
runtimeBoundaryFixture.data.metadata.catalogs[0].compiler = "C".repeat(MAX_CATALOG_TEXT_LENGTH);
runtimeBoundaryFixture.data.records[0].id = "record:alpha";
runtimeBoundaryFixture.data.records[0].name = "scan";
runtimeBoundaryFixture.data.records[0].classification = "image";
runtimeBoundaryFixture.data.records[0].locality = "notes";
assertCatalogAllow(runtimeBoundaryFixture, "runtime boundary and leakage-safe values");

for (const [description, catalogId] of [
  ["empty catalog slug", ""],
  ["uppercase catalog slug", "Alpha-1901"],
  ["underscore catalog slug", "alpha_1901"],
  ["leading-hyphen catalog slug", "-alpha"],
  ["trailing-hyphen catalog slug", "alpha-"],
  ["duplicate-hyphen catalog slug", "alpha--1901"],
  ["overlong catalog slug", "a".repeat(MAX_CATALOG_ID_LENGTH + 1)],
]) {
  assertCatalogRejection(
    (fixture) => renameFixtureCatalog(fixture, "alpha-1901", catalogId),
    description,
  );
}
for (const [description, field, value] of [
  ["empty catalog label", "label", ""],
  ["empty catalog compiler", "compiler", ""],
  ["overlong catalog label", "label", "L".repeat(MAX_CATALOG_TEXT_LENGTH + 1)],
  ["overlong catalog compiler", "compiler", "C".repeat(MAX_CATALOG_TEXT_LENGTH + 1)],
  ["non-normalized catalog label whitespace", "label", "Catalog  label"],
  ["non-NFC catalog compiler", "compiler", "Cafe\u0301"],
  ["catalog label control character", "label", "Catalog\u0000label"],
  ["catalog compiler format character", "compiler", "Catalog\u200Bcompiler"],
]) {
  assertCatalogRejection(
    ({ data: fixtureData }) => {
      fixtureData.metadata.catalogs[0][field] = value;
    },
    description,
  );
}
for (const [description, recordId] of [
  ["empty record ID", ""],
  ["non-normalized record ID whitespace", "record  id"],
  ["non-NFC record ID", "record-e\u0301"],
  ["record ID control character", "record\u0000id"],
  ["record ID format character", "record\u200Bid"],
  ["record ID leakage marker", "raw OCR output"],
  ["record ID path", "../private/record"],
]) {
  assertCatalogRejection(
    ({ data: fixtureData }) => {
      fixtureData.records[0].id = recordId;
    },
    description,
  );
}
assertCatalogRejection(
  ({ data: fixtureData }) => {
    fixtureData.records[0].locality = "Alpha\u0000County";
  },
  "record value control character",
);
assertCatalogRejection(
  ({ data: fixtureData }) => {
    fixtureData.records[0].locality = "Alpha\u200BCounty";
  },
  "record value format character",
);
assertCatalogRejection(
  ({ data: fixtureData }) => {
    Object.assign(fixtureData.records[0], {
      designation: null,
      name: null,
      weight: { grams: null },
      classification: null,
      locality: null,
      year: null,
    });
  },
  "record without substantive public facts",
);
assertCatalogRejection(
  ({ data: fixtureData }) => fixtureData.metadata.catalogs.push({ ...fixtureData.metadata.catalogs[0] }),
  "duplicate metadata catalog ID",
);
assertCatalogRejection(
  ({ data: fixtureData }) => fixtureData.metadata.catalogs.pop(),
  "metadata missing a catalog ID",
);
assertCatalogRejection(
  ({ data: fixtureData }) => fixtureData.records.splice(1, 1),
  "records missing a catalog ID",
);
assertCatalogRejection(({ folios: fixtureFolios }) => delete fixtureFolios.catalogs["beta-1888"], "manifest missing a catalog ID");
assertCatalogRejection(
  ({ folios: fixtureFolios }) => {
    fixtureFolios.catalogs["extra-1900"] = { displayPolicy: "blocked", rightsStatus: "undetermined", pages: {} };
  },
  "manifest with an extra catalog ID",
);
assertCatalogRejection(
  ({ data: fixtureData }) => {
    Object.assign(fixtureData.metadata.catalogs[0], {
      recordCount: 1,
      recordsWithDesignation: 1,
      recordsWithWeight: 0,
      confidenceCounts: { high: 0, medium: 1, low: 0 },
    });
    Object.assign(fixtureData.metadata.catalogs[1], {
      recordCount: 2,
      recordsWithDesignation: 2,
      recordsWithWeight: 2,
      confidenceCounts: { high: 1, medium: 0, low: 1 },
    });
  },
  "per-catalog totals mismatch with unchanged global totals",
);
assertCatalogRejection(
  ({ data: fixtureData }) => {
    fixtureData.records[2].catalogPage = 4;
  },
  "record page outside its catalog sourcePages",
);
assertCatalogRejection(
  ({ data: fixtureData }) => {
    fixtureData.metadata.catalogs[0].confidenceCounts = { high: 1, medium: 0, low: 1 };
    fixtureData.metadata.catalogs[1].confidenceCounts = { high: 0, medium: 1, low: 0 };
  },
  "per-catalog confidence mismatch with unchanged global totals",
);
assertCatalogRejection(
  ({ data: fixtureData }) => {
    fixtureData.metadata.catalogs[0].rightsStatus = "public-domain";
  },
  "metadata and manifest rights mismatch",
);
assertCatalogRejection(
  ({ data: fixtureData }) => {
    fixtureData.metadata.recordsWithDesignation = 2;
  },
  "global designation total mismatch",
);
assertCatalogRejection(
  ({ data: fixtureData }) => {
    fixtureData.metadata.confidenceCounts = { high: 0, medium: 2, low: 1 };
  },
  "global confidence total mismatch",
);
assertCatalogRejection(
  ({ data: fixtureData }) => {
    fixtureData.metadata.catalogs[0].sourcePages = [2, 1, 3];
  },
  "unsorted sourcePages",
);
assertCatalogRejection(
  ({ data: fixtureData }) => {
    fixtureData.metadata.catalogs[0].sourcePages = [1, 2, 2];
  },
  "duplicate sourcePages",
);
assertCatalogRejection(
  ({ data: fixtureData }) => {
    fixtureData.metadata.schemaVersion = 1;
  },
  "wrong canonical metadata schema version",
);
assertCatalogRejection(
  ({ data: fixtureData }) => {
    fixtureData.metadata.generatedAt = "2026-07-19";
  },
  "extra canonical metadata root key",
);
assertCatalogRejection(
  ({ data: fixtureData }) => {
    fixtureData.metadata.catalogs[0].edition = "First";
  },
  "extra catalog descriptor key",
);
assertCatalogRejection(
  ({ data: fixtureData }) => {
    fixtureData.metadata.catalogs[0].sourcePageCount = 2;
  },
  "sourcePageCount mismatch",
);
assertCatalogRejection(
  ({ data: fixtureData }) => {
    fixtureData.metadata.catalogs[0].label = "../private/catalog-scan.pdf";
  },
  "catalog label leakage",
);
assertCatalogRejection(
  ({ folios: fixtureFolios }) => {
    fixtureFolios.catalogs["beta-1888"].pages[8] = {
      image: "assets/folios/beta-1888/page-8.webp",
      alt: "Beta catalog page 8",
    };
  },
  "folio page outside its catalog source page set",
);

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
]) {
  assertCatalogRejection(
    ({ data: fixtureData }) => {
      fixtureData.records[0].locality = value;
    },
    description,
  );
}
assertCatalogRejection(
  ({ data: fixtureData }) => {
    fixtureData.records[0].rawOcr = "unpublished text";
  },
  "raw OCR key",
);
assertCatalogRejection(
  ({ data: fixtureData }) => {
    fixtureData.metadata.catalogs[0].sourceFilename = "page-1.dat";
  },
  "source filename key",
);

const deployedStats = validatePublicCatalog(data, folios, "root");
const totalPageCount = [...deployedStats.metadataByCatalog.values()].reduce(
  (sum, { entry }) => sum + entry.sourcePageCount,
  0,
);
function formatSourcePages(sourcePages) {
  const contiguous = sourcePages.every((page, index) => index === 0 || page === sourcePages[index - 1] + 1);
  return contiguous && sourcePages.length > 1 ? `${sourcePages[0]}-${sourcePages.at(-1)}` : sourcePages.join(",");
}

console.log(
  `Validated data/catalog.json and data/folios.json: ${deployedStats.recordCount} records across ` +
    `${deployedStats.catalogCount} facts-only catalog${deployedStats.catalogCount === 1 ? "" : "s"}, ` +
    `${totalPageCount} metadata source pages, ${deployedStats.folioStats.pageEntryCount} displayable folio pages.`,
);
for (const [catalogId, { entry }] of deployedStats.metadataByCatalog) {
  const catalogStats = deployedStats.statsByCatalog.get(catalogId);
  console.log(
    `${catalogId}: ${catalogStats.recordCount} records, pages ${formatSourcePages(entry.sourcePages)}, ` +
      `${catalogStats.recordsWithDesignation} designations, ${catalogStats.recordsWithWeight} weights, ` +
      `confidence high=${catalogStats.confidenceCounts.high} medium=${catalogStats.confidenceCounts.medium} ` +
      `low=${catalogStats.confidenceCounts.low}, ${entry.folioDisplayPolicy}/${entry.rightsStatus}.`,
  );
}
console.log(
  `Fixtures: ${syntheticAllowCount} folio allows, ${syntheticRejectionCount} folio rejections, ` +
    `${catalogAllowCount} multi-catalog allow, ${catalogRejectionCount} catalog/leakage rejections passed.`,
);
