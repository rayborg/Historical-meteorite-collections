import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { validateSpecimenLineages } from "./specimen-lineages-lib.mjs";

const args = process.argv.slice(2);
if (args.length > 4) throw new Error("usage: node scripts/validate-specimen-lineages.mjs [lineage-json] [catalog-json] [review-json] [source-claims-json]");
const lineageUrl = args[0] ? pathToFileURL(args[0]) : new URL("../data/specimen-lineages.json", import.meta.url);
const catalogUrl = args[1] ? pathToFileURL(args[1]) : new URL("../data/catalog.json", import.meta.url);
const reviewUrl = args[2] ? pathToFileURL(args[2]) : new URL("../data/specimen-lineage-reviews.json", import.meta.url);
const sourceClaimsUrl = args[3] ? pathToFileURL(args[3]) : new URL("../data/source-claims.json", import.meta.url);
const [document, catalog, reviews, sourceClaims] = await Promise.all([
  readFile(lineageUrl, "utf8").then(JSON.parse),
  readFile(catalogUrl, "utf8").then(JSON.parse),
  readFile(reviewUrl, "utf8").then(JSON.parse),
  readFile(sourceClaimsUrl, "utf8").then(JSON.parse),
]);
const result = validateSpecimenLineages(document, catalog, reviews, sourceClaims);
console.log(`validated ${result.relationshipCount} specimen-lineage relationships (${result.sameInventoryRelationshipCount} same inventory, ${result.possibleMatchRelationshipCount} possible matches)`);
