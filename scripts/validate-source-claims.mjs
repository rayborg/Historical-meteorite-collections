import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { serializeSourceClaims, validateSourceClaims } from "./source-claims-lib.mjs";

const args = process.argv.slice(2);
if (args.length > 2) throw new Error("usage: node scripts/validate-source-claims.mjs [source-claims-json] [catalog-json]");
const sourceClaimsUrl = args[0] ? pathToFileURL(args[0]) : new URL("../data/source-claims.json", import.meta.url);
const catalogUrl = args[1] ? pathToFileURL(args[1]) : new URL("../data/catalog.json", import.meta.url);
const [sourceClaimsText, catalog] = await Promise.all([
  readFile(sourceClaimsUrl, "utf8"),
  readFile(catalogUrl, "utf8").then(JSON.parse),
]);
const sourceClaims = JSON.parse(sourceClaimsText);
const result = validateSourceClaims(sourceClaims, catalog);
if (sourceClaimsText !== serializeSourceClaims(sourceClaims)) throw new Error("source claims JSON is not deterministically serialized");
console.log(`validated ${result.claimCount} source-attested n-ary groups covering ${result.uniqueMemberCount} unique Victoria specimen IDs`);
