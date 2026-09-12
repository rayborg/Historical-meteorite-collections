import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const CATALOG_SHA256 = "cf429e6660f00272f2f81fe69bac81c891f41574bbfff6e6bb46499d2d0672b4";
const STRUCTURAL_PROJECTION_SET_SHA256 = "c4ac216d619ee08210bb43cb5a284280d807b35694ece4105b9611680478f1e0";
const FARRINGTON_CATALOG_ID = "farrington-1903";
const SOURCE_NUMBER = /\bCat\.?\s+Nos?\.,?\s+([^.]+)\./giu;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function structuralProjections(projections) {
  return projections.map((projection) => ({
    ...projection,
    cards: projection.cards.map(({ sourceCatalogNumber, ...card }) => card),
  }));
}

function sourceNumberForHolding(holding, location) {
  const matches = ["designation", "description", "provenance"].flatMap((field) => {
    const text = holding[field];
    if (typeof text !== "string") return [];
    return [...text.matchAll(SOURCE_NUMBER)].map((match) => {
      const value = match[1];
      const start = match.index + match[0].indexOf(value);
      return { value, textPathField: field, start, end: start + value.length };
    });
  });
  assert.equal(matches.length, 1, `${location} must contain exactly one printed catalog-number expression.`);
  return matches[0];
}

const catalogUrl = new URL("../data/catalog.json", import.meta.url);
const projectionUrl = new URL("../data/specimen-card-projections.json", import.meta.url);
const [catalogText, projectionText] = await Promise.all([
  readFile(catalogUrl, "utf8"),
  readFile(projectionUrl, "utf8"),
]);
assert.equal(sha256(catalogText), CATALOG_SHA256, "The accepted public catalog bytes changed.");

const catalog = JSON.parse(catalogText);
const document = JSON.parse(projectionText);
assert([5, 6].includes(document.metadata.schemaVersion), "Expected the schema-5 baseline or schema-6 output.");
assert.equal(sha256(JSON.stringify(structuralProjections(document.projections))), STRUCTURAL_PROJECTION_SET_SHA256,
  "Projection paths, clauses, masses, or ordering changed from the accepted baseline.");

const recordsById = new Map(catalog.records.map((record) => [record.id, record]));
const farringtonRecords = catalog.records.filter(({ catalogId }) => catalogId === FARRINGTON_CATALOG_ID);
const evidenceByHolding = new Map();
let scalarHoldingCount = 0;
let ambiguousHoldingCount = 0;
for (const record of farringtonRecords) {
  for (const [holdingIndex, holding] of record.holdings.entries()) {
    const location = `${record.id}:holdings[${holdingIndex}]`;
    const evidence = sourceNumberForHolding(holding, location);
    evidenceByHolding.set(location, evidence);
    if (/^[0-9]+$/u.test(evidence.value)) scalarHoldingCount += 1;
    else ambiguousHoldingCount += 1;
  }
}
assert.equal(farringtonRecords.length, 251);
assert.equal(evidenceByHolding.size, 424);
assert.equal(scalarHoldingCount, 420);
assert.equal(ambiguousHoldingCount, 4);

let projectedParentCount = 0;
let sourceCatalogNumberCount = 0;
const projections = document.projections.map((projection) => {
  const record = recordsById.get(projection.parentRecordId);
  assert(record, `Dangling projection parent ${projection.parentRecordId}.`);
  const isFarrington = record.catalogId === FARRINGTON_CATALOG_ID;
  if (isFarrington) projectedParentCount += 1;
  return {
    ...projection,
    cards: projection.cards.map(({ sourceCatalogNumber, ...card }) => {
      if (!isFarrington) return card;
      const holdingIndex = Number(card.holdingPath.match(/^holdings\[([0-9]+)\]$/u)?.[1]);
      const holding = record.holdings[holdingIndex];
      assert(holding, `${record.id}:${card.holdingPath} is dangling.`);
      assert.deepEqual(card.clause, {
        textPath: `${card.holdingPath}.description`,
        start: 0,
        end: holding.description.length,
      }, `${record.id}:${card.holdingPath} must remain a complete reviewed holding-description clause.`);
      const evidence = evidenceByHolding.get(`${record.id}:${card.holdingPath}`);
      assert(evidence && /^[0-9]+$/u.test(evidence.value),
        `${record.id}:${card.holdingPath} does not have one exact scalar printed number.`);
      sourceCatalogNumberCount += 1;
      return {
        ...card,
        sourceCatalogNumber: {
          value: evidence.value,
          textPath: `${card.holdingPath}.${evidence.textPathField}`,
          start: evidence.start,
          end: evidence.end,
        },
      };
    }),
  };
});
assert.equal(projectedParentCount, 81);
assert.equal(sourceCatalogNumberCount, 232);

const output = {
  metadata: {
    ...document.metadata,
    schemaVersion: 6,
    sourceCatalogNumberCount,
  },
  projections,
};
await writeFile(projectionUrl, `${JSON.stringify(output, null, 2)}\n`);
console.log(`annotated ${sourceCatalogNumberCount} Farrington 1903 projected cards across ${projectedParentCount} parents`);
