import { readFile } from "node:fs/promises";

const CATALOG_URL = new URL("../data/catalog.json", import.meta.url);
const FOLIOS_URL = new URL("../data/folios.json", import.meta.url);
const RECORD_COUNT = 1079;
const FIRST_PAGE = 3;
const LAST_PAGE = 48;
const PAGE_COUNT = 46;
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
const FOLIO_PATH_ROOT = "assets/folios/";
const APPROVED_FOLIO_EXTENSION = /\.(?:webp|png|jpe?g|avif)$/u;
const CATALOG_FORBIDDEN_KEYS = new Set([
  "notes",
  "sourceimage",
  "sourceimages",
  "rawtext",
  "scan",
  "scans",
  "scanpath",
  "image",
  "imagepath",
  "thumbnail",
  "display",
]);
const FORBIDDEN_STRING = /^(?:notes?|sourceimages?|rawtext|image|weight(?:\s+|\.)display)$/iu;
const IMAGE_PATH = /\.(?:avif|gif|jpe?g|png|svg|tiff?|webp)(?:$|[?#/\\\s])/iu;
const HUSS_FORBIDDEN_IMAGE_PATH = /\.(?:jpe?g|webp)(?:$|[?#/\\\s])/iu;

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

function normalizeString(value) {
  return value.normalize("NFC").replace(/\s+/gu, " ").trim();
}

function assertString(value, path, nullable = false) {
  if (nullable && value === null) return;
  assert(typeof value === "string" && value.length > 0, `${path} must be a nonempty string${nullable ? " or null" : ""}`);
  assert(value === normalizeString(value), `${path} is not NFC/whitespace normalized`);
}

function compareText(left, right) {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left < right ? -1 : 1;
}

function designationParts(value) {
  if (value === null) return null;
  const prefix = value.match(/^[A-Za-z]+/u)?.[0];
  const numbers = value.match(/\d+/gu)?.map(Number);
  assert(prefix && numbers?.length, `designation cannot be structurally sorted: ${value}`);
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
    assert(!FORBIDDEN_STRING.test(value), `${path} contains a forbidden string`);
    assert(!IMAGE_PATH.test(value), `${path} contains an image filename or path`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectCatalogExcludedContent(item, `${path}[${index}]`));
    return;
  }
  if (!isObject(value)) return;

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[-_]/gu, "");
    assert(!CATALOG_FORBIDDEN_KEYS.has(normalizedKey), `${path}.${key} is forbidden`);
    rejectCatalogExcludedContent(child, `${path}.${key}`);
  }
}

function assertSafeFolioPath(value, path) {
  assertString(value, path);
  assert(!/\s/u.test(value), `${path} must not contain whitespace`);
  assert(!value.startsWith("/"), `${path} must not be slash-rooted or protocol-relative`);
  assert(!/^[A-Za-z][A-Za-z\d+.-]*:/u.test(value), `${path} must not use a URL scheme`);
  assert(!value.includes("\\"), `${path} must not contain backslashes`);
  assert(!/[?#]/u.test(value), `${path} must not contain a query or fragment`);
  assert(!value.includes("%"), `${path} must not contain percent encoding`);
  assert(!value.includes("//"), `${path} must not contain duplicate slashes`);
  assert(value.startsWith(FOLIO_PATH_ROOT), `${path} must be rooted under ${FOLIO_PATH_ROOT}`);

  const relativePath = value.slice(FOLIO_PATH_ROOT.length);
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
    assertString(catalogId, `${policyPath} catalog ID`);
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
      assertSafeFolioPath(entry.image, `${entryPath}.image`);
      if (Object.hasOwn(entry, "thumbnail")) assertSafeFolioPath(entry.thumbnail, `${entryPath}.thumbnail`);
      assertPlainAlt(entry.alt, `${entryPath}.alt`);
      pageEntryCount += 1;
    }
  }

  return { catalogCount: Object.keys(manifest.catalogs).length, pageEntryCount };
}

function rejectMatchingStrings(value, expression, path) {
  if (typeof value === "string") {
    assert(!expression.test(value), `${path} contains a forbidden image filename or path`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectMatchingStrings(item, expression, `${path}[${index}]`));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    rejectMatchingStrings(child, expression, `${path}.${key}`);
  }
}

function syntheticManifest({
  rightsStatus = "public-domain",
  image = "assets/folios/example/page-3.webp",
  thumbnail = "assets/folios/example/page-3-thumbnail.webp",
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
      image: `assets/folios/example/page-3.${extension}`,
      thumbnail: `assets/folios/example/page-3-thumbnail.${extension}`,
    }),
    `approved .${extension} paths`,
  );
}
assertSyntheticAllow(syntheticManifest({ thumbnail: null }), "optional thumbnail omission");

assertSyntheticRejection(syntheticManifest({ rightsStatus: "undetermined" }), "display with undetermined rights");
assertSyntheticRejection(syntheticManifest({ rightsStatus: "unknown" }), "unknown rights status");

const malformedPaths = [
  ["empty path", ""],
  ["whitespace", "assets/folios/example/page 3.webp"],
  ["slash-rooted", "/assets/folios/example/page-3.webp"],
  ["scheme", "https://example.test/page-3.webp"],
  ["protocol-relative", "//example.test/page-3.webp"],
  ["backslash", "assets\\folios\\example\\page-3.webp"],
  ["query suffix", "assets/folios/example/page-3.webp?download=1"],
  ["query-only", "?download=1"],
  ["fragment suffix", "assets/folios/example/page-3.webp#page"],
  ["fragment-only", "#page"],
  ["current segment", "assets/folios/./page-3.webp"],
  ["parent segment", "assets/folios/example/../page-3.webp"],
  ["missing filename segment", "assets/folios/"],
  ["duplicate slash empty segment", "assets/folios/example//page-3.webp"],
  ["outside root", "assets/images/example/page-3.webp"],
  ["lookalike root", "assets/folios-other/example/page-3.webp"],
  ["percent-encoded whitespace", "assets/folios/example/page%203.webp"],
  ["encoded traversal", "assets/folios/%2e%2e/page-3.webp"],
  ["repeated-encoded traversal", "assets/folios/%252e%252e/page-3.webp"],
  ["encoded external form", "assets/folios/https%3A%2F%2Fevil.test/page-3.webp"],
  ["repeated-encoded external form", "assets/folios/https%253A%252F%252Fevil.test/page-3.webp"],
  ["unsafe .svg extension", "assets/folios/example/page-3.svg"],
  ["unsafe .gif extension", "assets/folios/example/page-3.gif"],
  ["unsafe .pdf extension", "assets/folios/example/page-3.pdf"],
  ["missing extension", "assets/folios/example/page-3"],
  ["unapproved uppercase extension", "assets/folios/example/page-3.WEBP"],
];

for (const field of ["image", "thumbnail"]) {
  for (const [description, value] of malformedPaths) {
    assertSyntheticRejection(syntheticManifest({ [field]: value }), `${field} ${description}`);
  }
}

assertSyntheticRejection(
  syntheticManifest({
    pageEntry: {
      full: "assets/folios/example/page-3.webp",
      alt: "Reviewed catalog page 3",
    },
  }),
  "wrong full key",
);
assertSyntheticRejection(
  syntheticManifest({
    pageEntry: {
      image: "assets/folios/example/page-3.webp",
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

assertExactKeys(data, ["metadata", "records"], "root");
assertExactKeys(
  data.metadata,
  [
    "catalog",
    "scope",
    "sourcePageRange",
    "sourcePageCount",
    "recordCount",
    "factualFields",
    "recordsWithDesignation",
    "recordsWithWeight",
    "confidenceCounts",
  ],
  "metadata",
);
assertExactKeys(
  data.metadata.catalog,
  ["id", "compiler", "year", "folioDisplayPolicy", "rightsStatus"],
  "metadata.catalog",
);
assertExactKeys(data.metadata.sourcePageRange, ["start", "end"], "metadata.sourcePageRange");
assertExactKeys(data.metadata.confidenceCounts, CONFIDENCE_LEVELS, "metadata.confidenceCounts");

assert(data.metadata.catalog.id === "huss-1976", "metadata.catalog.id must be huss-1976");
assert(data.metadata.catalog.compiler === "Glenn Huss", "metadata.catalog.compiler must be Glenn Huss");
assert(data.metadata.catalog.year === 1976, "metadata.catalog.year must be 1976");
assert(data.metadata.catalog.folioDisplayPolicy === "blocked", "Huss folio display policy must be blocked");
assert(data.metadata.catalog.rightsStatus === "undetermined", "Huss rights status must be undetermined");
assert(data.metadata.scope === "facts-only", "metadata.scope must be facts-only");
assert(data.metadata.sourcePageRange.start === FIRST_PAGE, `source page range must start at ${FIRST_PAGE}`);
assert(data.metadata.sourcePageRange.end === LAST_PAGE, `source page range must end at ${LAST_PAGE}`);
assert(data.metadata.sourcePageCount === PAGE_COUNT, `metadata.sourcePageCount must be ${PAGE_COUNT}`);
assert(data.metadata.recordCount === RECORD_COUNT, `metadata.recordCount must be ${RECORD_COUNT}`);
assert(
  Array.isArray(data.metadata.factualFields) &&
    data.metadata.factualFields.length === FACTUAL_FIELDS.length &&
    data.metadata.factualFields.every((field, index) => field === FACTUAL_FIELDS[index]),
  "metadata.factualFields does not match the public record schema",
);
assert(Array.isArray(data.records), "records must be an array");
assert(data.records.length === RECORD_COUNT, `records must contain ${RECORD_COUNT} observations`);

assert(folioStats.catalogCount === 1, "folios must currently contain only huss-1976");
const hussPolicy = folios.catalogs["huss-1976"];
assert(isObject(hussPolicy), "folios must contain a huss-1976 policy");
assert(hussPolicy.displayPolicy === "blocked", "huss-1976 displayPolicy must be blocked");
assert(hussPolicy.rightsStatus === "undetermined", "huss-1976 rightsStatus must be undetermined");
assert(Object.keys(hussPolicy.pages).length === 0, "huss-1976 pages must be empty");
assert(
  data.metadata.catalog.folioDisplayPolicy === hussPolicy.displayPolicy,
  "catalog metadata folio policy must match the manifest",
);
assert(
  data.metadata.catalog.rightsStatus === hussPolicy.rightsStatus,
  "catalog metadata rights status must match the manifest",
);
rejectMatchingStrings(data, HUSS_FORBIDDEN_IMAGE_PATH, "huss-1976 catalog data");
rejectMatchingStrings(hussPolicy, HUSS_FORBIDDEN_IMAGE_PATH, "folios.catalogs.huss-1976");

const ids = new Set();
const pages = new Set();
const confidenceCounts = Object.fromEntries(CONFIDENCE_LEVELS.map((level) => [level, 0]));
let recordsWithDesignation = 0;
let recordsWithWeight = 0;

data.records.forEach((record, index) => {
  const path = `records[${index}]`;
  assertExactKeys(record, RECORD_KEYS, path);
  assertString(record.id, `${path}.id`);
  assert(!ids.has(record.id), `${path}.id is duplicated: ${record.id}`);
  ids.add(record.id);

  assert(record.catalogId === "huss-1976", `${path}.catalogId must be huss-1976`);
  assertString(record.catalogId, `${path}.catalogId`);
  assert(Object.hasOwn(folios.catalogs, record.catalogId), `${path}.catalogId has no folio display policy`);
  for (const field of ["designation", "name", "classification", "locality", "year"]) {
    assertString(record[field], `${path}.${field}`, true);
  }

  assertExactKeys(record.weight, ["grams"], `${path}.weight`);
  assert(
    record.weight.grams === null || (Number.isFinite(record.weight.grams) && record.weight.grams >= 0),
    `${path}.weight.grams must be a finite nonnegative number or null`,
  );
  assert(
    Number.isInteger(record.catalogPage) && record.catalogPage >= FIRST_PAGE && record.catalogPage <= LAST_PAGE,
    `${path}.catalogPage must be an integer from ${FIRST_PAGE} through ${LAST_PAGE}`,
  );
  pages.add(record.catalogPage);

  assert(CONFIDENCE_LEVELS.includes(record.confidence), `${path}.confidence is invalid`);
  confidenceCounts[record.confidence] += 1;
  if (record.designation !== null) recordsWithDesignation += 1;
  if (record.weight.grams !== null) recordsWithWeight += 1;

  if (index > 0) {
    assert(compareRecords(data.records[index - 1], record) < 0, `${path} violates deterministic independent sort order`);
  }
});

assert(ids.size === RECORD_COUNT, `expected ${RECORD_COUNT} unique IDs`);
assert(pages.size === PAGE_COUNT, `all ${PAGE_COUNT} catalog pages must be represented`);
for (let page = FIRST_PAGE; page <= LAST_PAGE; page += 1) {
  assert(pages.has(page), `catalog page ${page} is not represented`);
}
assert(
  data.metadata.recordsWithDesignation === recordsWithDesignation,
  "metadata.recordsWithDesignation does not match records",
);
assert(data.metadata.recordsWithWeight === recordsWithWeight, "metadata.recordsWithWeight does not match records");
for (const level of CONFIDENCE_LEVELS) {
  assert(
    data.metadata.confidenceCounts[level] === confidenceCounts[level],
    `metadata.confidenceCounts.${level} does not match records`,
  );
}

console.log(
  `Validated data/catalog.json and data/folios.json: ${RECORD_COUNT} records, ` +
    `${PAGE_COUNT} cited pages (${FIRST_PAGE}-${LAST_PAGE}), ${folioStats.catalogCount} catalog policy, ` +
    `huss-1976 blocked/undetermined with ${folioStats.pageEntryCount} folio pages.`,
);
console.log(
  `Counts: ${recordsWithDesignation} designations, ${recordsWithWeight} weights, ` +
    `confidence high=${confidenceCounts.high} medium=${confidenceCounts.medium} low=${confidenceCounts.low}; ` +
    `${syntheticAllowCount} synthetic allow fixtures and ${syntheticRejectionCount} rejection fixtures passed.`,
);
