import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const CATALOG_SHA256 = "cf429e6660f00272f2f81fe69bac81c891f41574bbfff6e6bb46499d2d0672b4";
const STRUCTURAL_PROJECTION_SET_SHA256 = "c4ac216d619ee08210bb43cb5a284280d807b35694ece4105b9611680478f1e0";
const FARRINGTON_1903_SOURCE_NUMBER = /\bCat\.?\s+Nos?\.,?\s+([^.]+)\./giu;
const FARRINGTON_1916_SOURCE_NUMBER = /\bCat\.?\s+No\.?,?\s+(\d+)/giu;
const PRIOR_SOURCE_NUMBER = /\[[^\]]+\]/gu;
const REEDS_SOURCE_NUMBER = /^\*?\((\d+)\)/u;
const TASSIN_SOURCE_NUMBER = /Catalogue number(?!s),?\s*(\d+)/giu;
const SOURCE_TEXT_FIELDS = ["designation", "description", "provenance"];
const MERRILL_RECORD_ID = "obs-bc046387-49aa-469f-b9cb-2d68f42193b8";
const REVIEWED_CATALOGS = Object.freeze({
  "farrington-1903": { count: 232, tupleSha256: "85645d87b5c7a8677996ab4bd36dcc54e3d95ef1bb9fbb544ea6d8aaf26bb5d3" },
  "farrington-1916": { count: 1100, tupleSha256: "63dc034acf89a41c9c4d95427ccd881548df8c97dc31f23502899bfd661681bd" },
  "merrill-1916": { count: 1, tupleSha256: "f83cbe4c22d8683b522c9987f027b64a88d24c538c0748cc0cea70a56c923bb5" },
  "prior-1923": { count: 653, tupleSha256: "236fd52dbd0667f536d64c7ef4874af912a5bbd75ee1bd09582c415672a241af" },
  "reeds-1937": { count: 2988, tupleSha256: "eb39b8057da35cfb94d6d30ab484f68b67e78ab189f1871aed74f4af1bde7555" },
  "tassin-1902": { count: 84, tupleSha256: "a4355c92c19d4faac40948122e587a7cae8772426edb46b2447db78e7d250ead" },
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function structuralProjections(projections) {
  return projections.map((projection) => ({
    ...projection,
    cards: projection.cards.map(({ sourceCatalogNumber, ...card }) => card),
  }));
}

function sourceNumberMatches(holding, expression) {
  return SOURCE_TEXT_FIELDS.flatMap((field) => {
    const text = holding[field];
    if (typeof text !== "string") return [];
    return [...text.matchAll(expression)].map((match) => {
      const value = match[1];
      const start = match.index + match[0].indexOf(value);
      return { value, field, start, end: start + value.length };
    });
  });
}

function withTextPath(card, evidence) {
  return { value: evidence.value, textPath: `${card.holdingPath}.${evidence.field}`, start: evidence.start, end: evidence.end };
}

function sourceNumberForCard(record, projection, card, cardIndex, existingEvidence) {
  const holdingIndex = Number(card.holdingPath.match(/^holdings\[([0-9]+)\]$/u)?.[1]);
  const holding = record.holdings[holdingIndex];
  assert(holding, `${record.id}:${card.holdingPath} is dangling.`);

  if (record.catalogId === "farrington-1903") {
    const matches = sourceNumberMatches(holding, FARRINGTON_1903_SOURCE_NUMBER);
    assert.equal(matches.length, 1, `${record.id}:${card.holdingPath} must contain one Farrington 1903 number.`);
    assert.match(matches[0].value, /^[0-9]+$/u);
    const evidence = withTextPath(card, matches[0]);
    if (existingEvidence !== undefined) {
      assert.deepEqual(existingEvidence, evidence, `${record.id}:${cardIndex} Farrington 1903 evidence changed.`);
    }
    return evidence;
  }

  if (record.catalogId === "farrington-1916") {
    const matches = typeof holding.provenance === "string"
      ? [...holding.provenance.matchAll(FARRINGTON_1916_SOURCE_NUMBER)] : [];
    assert.equal(matches.length, 1, `${record.id}:${card.holdingPath} must contain one Farrington 1916 provenance number.`);
    const match = matches[0];
    const start = match.index + match[0].indexOf(match[1]);
    return { value: match[1], textPath: `${card.holdingPath}.provenance`, start, end: start + match[1].length };
  }

  if (record.catalogId === "reeds-1937") {
    const match = holding.description.match(REEDS_SOURCE_NUMBER);
    assert(match, `${record.id}:${card.holdingPath} must begin with one Reeds catalog number.`);
    const start = match[0].indexOf(match[1]);
    return { value: match[1], textPath: `${card.holdingPath}.description`, start, end: start + match[1].length };
  }

  if (record.catalogId === "prior-1923") {
    const sourceText = card.clause && card.clause.textPath.startsWith(`${card.holdingPath}.`)
      ? holding[card.clause.textPath.split(".").at(-1)] : null;
    assert.equal(typeof sourceText, "string", `${record.id}:${cardIndex} Prior clause source is invalid.`);
    const clauseText = sourceText.slice(card.clause.start, card.clause.end);
    const matches = [...clauseText.matchAll(PRIOR_SOURCE_NUMBER)];
    if (matches.length !== 1) return null;
    const match = matches[0];
    const start = card.clause.start + match.index;
    return { value: match[0], textPath: card.clause.textPath, start, end: start + match[0].length };
  }

  if (record.catalogId === "tassin-1902") {
    const sameHoldingCards = projection.cards.filter((candidate) => candidate.holdingPath === card.holdingPath);
    const matches = sourceNumberMatches(holding, TASSIN_SOURCE_NUMBER);
    if (sameHoldingCards.length !== 1 || matches.length !== 1) return null;
    return withTextPath(card, matches[0]);
  }

  if (record.catalogId === "merrill-1916" && record.id === MERRILL_RECORD_ID && cardIndex === 0) {
    assert.equal(card.massPath, "holdings[0].weights[1].grams");
    assert.equal(holding.weights[1].grams, 82);
    assert(card.clause.start <= 92 && card.clause.end >= 94);
    assert.equal(holding.description.slice(92, 94), "13");
    return { value: "13", textPath: "holdings[0].description", start: 92, end: 94 };
  }

  return null;
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
assert.equal(document.metadata.schemaVersion, 6, "Expected the committed schema-6 projection.");
assert.equal(sha256(JSON.stringify(structuralProjections(document.projections))), STRUCTURAL_PROJECTION_SET_SHA256,
  "Projection paths, clauses, masses, or ordering changed from the accepted baseline.");

const recordsById = new Map(catalog.records.map((record) => [record.id, record]));
let sourceCatalogNumberCount = 0;
const tuplesByCatalog = new Map(Object.keys(REVIEWED_CATALOGS).map((catalogId) => [catalogId, []]));
const projections = document.projections.map((projection) => {
  const record = recordsById.get(projection.parentRecordId);
  assert(record, `Dangling projection parent ${projection.parentRecordId}.`);
  return {
    ...projection,
    cards: projection.cards.map(({ sourceCatalogNumber: existingEvidence, ...card }, cardIndex) => {
      const evidence = sourceNumberForCard(record, projection, card, cardIndex, existingEvidence);
      if (!evidence) return card;
      sourceCatalogNumberCount += 1;
      tuplesByCatalog.get(record.catalogId).push([
        projection.parentRecordId, cardIndex, evidence.value, evidence.textPath, evidence.start, evidence.end,
      ]);
      return {
        ...card,
        sourceCatalogNumber: evidence,
      };
    }),
  };
});
assert.equal(sourceCatalogNumberCount, 5058);
for (const [catalogId, expected] of Object.entries(REVIEWED_CATALOGS)) {
  const tuples = tuplesByCatalog.get(catalogId);
  assert.equal(tuples.length, expected.count, `${catalogId} reviewed source-number count changed.`);
  assert.equal(sha256(JSON.stringify(tuples)), expected.tupleSha256, `${catalogId} reviewed source-number tuples changed.`);
}

const output = {
  metadata: {
    ...document.metadata,
    schemaVersion: 6,
    sourceCatalogNumberCount,
  },
  projections,
};
await writeFile(projectionUrl, `${JSON.stringify(output, null, 2)}\n`);
console.log(`annotated ${sourceCatalogNumberCount} reviewed projected cards across ${Object.keys(REVIEWED_CATALOGS).length} catalogs`);
