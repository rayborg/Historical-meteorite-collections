import { createHash } from "node:crypto";

export const ACCEPTED_SOURCE_CLAIMS_CONTENT_SHA256 = "141ed60b9560596ac8ab392babfc4af6e1d22921bacbf979d3b975e0fc2f20c2";
export const EMPTY_SOURCE_CLAIMS = Object.freeze({ schemaVersion: 1, scope: "source-claims", claims: Object.freeze([]) });

const ROOT_KEYS = ["schemaVersion", "scope", "claims"];
const CLAIM_KEYS = ["id", "catalogId", "sourceSection", "claimType", "classification", "members", "reference", "printedPage"];
const SPECIMEN_ID = /^(?:ALHA|BTNA|DRPA|EETA|META|MBRA|PGPA|RKPA)[0-9]{5}$/u;
const PRIVATE_KEY = /^(?:rawRowText|rawContinuationText|pairedSpecimensText|memberCountText|pageId|pdfPage|sourceImage|sourceFile|sourcePath)$/u;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertExactKeys(value, expected, path) {
  assert(value !== null && typeof value === "object" && !Array.isArray(value), `${path} must be an object`);
  const actual = Object.keys(value);
  assert(actual.length === expected.length && expected.every((key) => Object.hasOwn(value, key)),
    `${path} keys must be exactly: ${expected.join(", ")}`);
}

function assertPublicText(value, path) {
  assert(typeof value === "string" && value.length > 0, `${path} must be a nonempty string`);
  assert(value === value.normalize("NFC") && value.trim() === value && !/[\p{Cc}\p{Cf}]/u.test(value),
    `${path} must be normalized public text`);
  assert(!/(?:\/private\/|\/Users\/|file:\/\/|assets\/|\.(?:pdf|png|webp|tiff?))/iu.test(value),
    `${path} contains a private path or asset reference`);
}

function inspectPrivateKeys(value, path = "source claims") {
  if (Array.isArray(value)) return value.forEach((item, index) => inspectPrivateKeys(item, `${path}[${index}]`));
  if (value === null || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert(!PRIVATE_KEY.test(key), `${path}.${key} is a private field`);
    inspectPrivateKeys(child, `${path}.${key}`);
  }
}

export function sourceClaimsContentSha256(sourceClaims) {
  return createHash("sha256").update(JSON.stringify(sourceClaims.claims)).digest("hex");
}

export function validateSourceClaims(sourceClaims, catalog = null) {
  assertExactKeys(sourceClaims, ROOT_KEYS, "source claims");
  assert(sourceClaims.schemaVersion === 1, "source claims schemaVersion must be 1");
  assert(sourceClaims.scope === "source-claims", "source claims scope must be source-claims");
  assert(Array.isArray(sourceClaims.claims), "source claims claims must be an array");
  const claimIds = new Set();
  const uniqueMembers = new Set();
  sourceClaims.claims.forEach((claim, index) => {
    const path = `source claims claims[${index}]`;
    assertExactKeys(claim, CLAIM_KEYS, path);
    const expectedId = `victoria-land-1982-table-c-${String(index + 1).padStart(3, "0")}`;
    assert(claim.id === expectedId, `${path}.id must be ${expectedId}`);
    assert(!claimIds.has(claim.id), `${path}.id is duplicated`);
    claimIds.add(claim.id);
    assert(claim.catalogId === "victoria-land-1982", `${path}.catalogId is invalid`);
    assert(claim.sourceSection === "Appendix Table C", `${path}.sourceSection is invalid`);
    assert(claim.claimType === "tentative-n-ary-group", `${path}.claimType must preserve tentative n-ary semantics`);
    assertPublicText(claim.classification, `${path}.classification`);
    assertPublicText(claim.reference, `${path}.reference`);
    assert(claim.printedPage === 94, `${path}.printedPage must be 94`);
    assert(Array.isArray(claim.members) && claim.members.length > 0 && new Set(claim.members).size === claim.members.length,
      `${path}.members must be a nonempty unique exact-ID array`);
    claim.members.forEach((member, memberIndex) => {
      assert(SPECIMEN_ID.test(member), `${path}.members[${memberIndex}] is malformed or suffix-derived`);
      uniqueMembers.add(member);
    });
  });
  assert(sourceClaims.claims.length === 21, "source claims must contain exactly 21 groups");
  assert(uniqueMembers.size === 87, "source claims must contain exactly 87 unique member IDs");
  assert(sourceClaimsContentSha256(sourceClaims) === ACCEPTED_SOURCE_CLAIMS_CONTENT_SHA256,
    "source claims content or order differs from the accepted Table C projection");
  if (catalog !== null) {
    assert(catalog?.metadata?.schemaVersion === 11, "source claims require catalog schemaVersion 11");
    const victoria = new Map(catalog.records
      .filter(({ catalogId }) => catalogId === "victoria-land-1982")
      .map((record) => [record.specimenId, record]));
    assert(victoria.size === 273, "source claims require exactly 273 Victoria catalog records");
    assert([...victoria.values()].every((record) => record.name === record.specimenId),
      "Victoria catalog names must preserve their exact specimen IDs");
  }
  inspectPrivateKeys(sourceClaims);
  return { claimCount: sourceClaims.claims.length, uniqueMemberCount: uniqueMembers.size };
}

export function serializeSourceClaims(sourceClaims) {
  return `${JSON.stringify(sourceClaims, null, 2)}\n`;
}
