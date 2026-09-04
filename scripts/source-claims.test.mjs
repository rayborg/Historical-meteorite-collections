import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ACCEPTED_SOURCE_CLAIMS_CONTENT_SHA256,
  serializeSourceClaims,
  sourceClaimsContentSha256,
  validateSourceClaims,
} from "./source-claims-lib.mjs";

const sourceClaimsText = await readFile(new URL("../data/source-claims.json", import.meta.url), "utf8");
const sourceClaims = JSON.parse(sourceClaimsText);
const catalog = JSON.parse(await readFile(new URL("../data/catalog.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../data/source-claims.schema.json", import.meta.url), "utf8"));

test("publishes the exact accepted deterministic source-claims package", () => {
  assert.equal(createHash("sha256").update(sourceClaimsText).digest("hex"),
    "edb201339e9e1068ac45d3333a9224959b4dcdbf8e317afcbb0657c6635b85fb");
  assert.equal(serializeSourceClaims(sourceClaims), sourceClaimsText);
  assert.equal(sourceClaimsContentSha256(sourceClaims), ACCEPTED_SOURCE_CLAIMS_CONTENT_SHA256);
  assert.deepEqual(validateSourceClaims(sourceClaims, catalog), { claimCount: 21, uniqueMemberCount: 87 });
  assert.equal(sourceClaims.claims.reduce((count, claim) => count + claim.members.length, 0), 89);
  assert.equal(sourceClaims.claims.filter(({ members }) => members.length === 1).length, 2);
});

test("schema is a closed count-locked schema-1 n-ary contract", () => {
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.$id, "urn:hmc:schema:source-claims:1");
  assert.equal(schema.properties.claims.minItems, 21);
  assert.equal(schema.properties.claims.maxItems, 21);
  assert.equal(schema.$defs.claim.properties.claimType.const, "tentative-n-ary-group");
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (value === null || typeof value !== "object") return;
    if (value.type === "object") assert.equal(value.additionalProperties, false);
    Object.values(value).forEach(visit);
  };
  visit(schema);
});

test("rejects pairwise expansion, suffix derivation, content drift, catalog drift, and private fields", () => {
  const cases = [
    ["pairwise claim type", (value) => { value.claims[0].claimType = "pair"; }, /n-ary/u],
    ["suffix-derived member", (value) => { value.claims[0].members[0] += "-1"; }, /suffix-derived/u],
    ["member order drift", (value) => { value.claims[0].members.reverse(); }, /accepted Table C/u],
    ["group order drift", (value) => { [value.claims[0], value.claims[1]] = [value.claims[1], value.claims[0]]; }, /must be|accepted Table C/u],
    ["classification drift", (value) => { value.claims[0].classification = "Howardite"; }, /accepted Table C/u],
    ["private page ID", (value) => { value.claims[0].pageId = "private-page-94"; }, /keys must be exactly/u],
  ];
  for (const [label, mutate, pattern] of cases) {
    const changed = structuredClone(sourceClaims);
    mutate(changed);
    assert.throws(() => validateSourceClaims(changed, catalog), pattern, label);
  }
  const changedCatalog = structuredClone(catalog);
  changedCatalog.records.splice(changedCatalog.records.findIndex(({ catalogId }) => catalogId === "victoria-land-1982"), 1);
  assert.throws(() => validateSourceClaims(sourceClaims, changedCatalog), /exactly 273/u);
});

test("contains only exact full IDs and no private evidence or asset references", () => {
  assert(sourceClaims.claims.every(({ members }) => members.every((member) =>
    /^(?:ALHA|BTNA|DRPA|EETA|META|MBRA|PGPA|RKPA)[0-9]{5}$/u.test(member))));
  assert.doesNotMatch(sourceClaimsText,
    /(?:rawRowText|rawContinuationText|pairedSpecimensText|memberCountText|pageId|pdfPage|sourceImage|sourceFile|sourcePath|\/private\/|\/Users\/|assets\/|\.(?:pdf|png|webp|tiff?))/iu);
});
