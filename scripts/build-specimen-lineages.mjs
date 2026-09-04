import { readFile, writeFile } from "node:fs/promises";

import { buildSpecimenLineages, serializeSpecimenLineages } from "./specimen-lineages-lib.mjs";

const CATALOG_URL = new URL("../data/catalog.json", import.meta.url);
const REVIEWS_URL = new URL("../data/specimen-lineage-reviews.json", import.meta.url);
const SOURCE_CLAIMS_URL = new URL("../data/source-claims.json", import.meta.url);
const OUTPUT_URL = new URL("../data/specimen-lineages.json", import.meta.url);

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--check") || args.filter((arg) => arg === "--check").length > 1) {
    throw new Error("usage: node scripts/build-specimen-lineages.mjs [--check]");
  }
  const [catalog, reviews, sourceClaims] = await Promise.all([
    readFile(CATALOG_URL, "utf8").then(JSON.parse),
    readFile(REVIEWS_URL, "utf8").then(JSON.parse),
    readFile(SOURCE_CLAIMS_URL, "utf8").then(JSON.parse),
  ]);
  const output = serializeSpecimenLineages(buildSpecimenLineages(catalog, reviews, sourceClaims));
  if (args.includes("--check")) {
    const current = await readFile(OUTPUT_URL, "utf8");
    if (current !== output) throw new Error("data/specimen-lineages.json is out of date; run node scripts/build-specimen-lineages.mjs");
    console.log("specimen lineage build check passed");
    return;
  }
  await writeFile(OUTPUT_URL, output);
  console.log("wrote data/specimen-lineages.json");
}

await main();
