import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = require(path.join(repoRoot, "app.js"));

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

export async function validateMetbullCurrentContextFiles(root = repoRoot) {
  const [sidecarText, catalogText, projectionText, lineageText] = await Promise.all([
    readFile(path.join(root, "data", "metbull-current-context.json"), "utf8"),
    readFile(path.join(root, "data", "catalog.json"), "utf8"),
    readFile(path.join(root, "data", "specimen-card-projections.json"), "utf8"),
    readFile(path.join(root, "data", "specimen-lineages.json"), "utf8")
  ]);
  assert.equal(Buffer.byteLength(sidecarText), 487436, "sidecar byte count changed");
  assert.equal(sha256(sidecarText), app.METBULL_CURRENT_CONTEXT_DATA_SHA256, "sidecar SHA-256 changed");
  assert.equal(sha256(catalogText), app.CATALOG_SHA256, "catalog SHA-256 changed");
  assert.equal(sha256(projectionText), app.PROJECTION_SHA256, "projection SHA-256 changed");
  assert.equal(sha256(lineageText), app.LINEAGE_SHA256, "lineage SHA-256 changed");

  const catalog = app.validateCatalog(JSON.parse(catalogText));
  const registry = app.normalizeCatalogRegistry(catalog.metadata);
  const records = catalog.records.map((record, index) => app.prepareRecord(record, index, registry));
  const projectionIndex = app.deriveSpecimenCardProjectionIndex(JSON.parse(projectionText), records, {
    sourceCatalogSha256: app.CATALOG_SHA256
  });
  assert.equal(projectionIndex.size, 3407, "projection index is incomplete");
  const descriptors = app.expandSpecimenCardDescriptors(records, projectionIndex);
  const context = JSON.parse(sidecarText);
  assert.equal(app.validateMetbullCurrentContext(context, descriptors, {
    catalogSha256: sha256(catalogText),
    projectionSha256: sha256(projectionText),
    lineageSha256: sha256(lineageText)
  }), true, "current MetBull context failed its closed runtime contract");

  const assignments = app.reconstructMetbullCardAssignments(context, descriptors);
  const mapped = assignments.filter(({ status }) => status === "mapped");
  const direct = assignments.filter(({ route }) => route === "direct");
  const projected = assignments.filter(({ route }) => route === "projected");
  const currentIndex = app.deriveMetbullCurrentContextIndex(context, descriptors);
  const attached = app.attachMetbullCurrentContext(descriptors, currentIndex);
  const specimenCards = attached.filter((descriptor) => ["direct-specimen", "projected-atomic-specimen"]
    .includes(app.classifyHarmonizedCard(descriptor)));
  assert.equal(assignments.length, 14149);
  assert.equal(new Set(assignments.map(({ cardKey }) => cardKey)).size, 14149);
  assert.equal(direct.length, 5739);
  assert.equal(direct.filter(({ status }) => status === "mapped").length, 5568);
  assert.equal(projected.length, 8410);
  assert.equal(projected.filter(({ status }) => status === "mapped").length, 6206);
  assert.equal(mapped.length, 11774);
  assert.equal(currentIndex.size, 11774);
  assert.equal(specimenCards.filter(({ currentMetbull }) => currentMetbull).length, 11774);
  assert.equal(specimenCards.filter(({ currentMetbull }) => !currentMetbull).length, 2375);
  assert.equal(specimenCards.filter(({ currentMetbull }) => currentMetbull?.year).length, 11765);
  assert.equal(new Set(mapped.map(({ parentRecordId }) => parentRecordId)).size, 7651);
  assert.equal(new Set(mapped.map(({ meteoriteCode }) => meteoriteCode)).size, 2548);
  assert.equal(context.metadata.cardAssignmentsSha256, app.METBULL_CARD_ASSIGNMENTS_SHA256);
  assert.equal(app.metbullPublicCardBindingsSha256(descriptors), app.METBULL_PUBLIC_CARD_BINDINGS_SHA256);
  return { context, records, descriptors: attached, assignments };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  const unexpected = process.argv.slice(2).filter((argument) => argument !== "--check");
  assert.deepEqual(unexpected, [], `Unexpected arguments: ${unexpected.join(" ")}`);
  const { assignments } = await validateMetbullCurrentContextFiles();
  const mapped = assignments.filter(({ status }) => status === "mapped").length;
  console.log(`Validated ${assignments.length} specimen-card assignments: ${mapped} mapped, ${assignments.length - mapped} unmapped; assignment lock ${app.METBULL_CARD_ASSIGNMENTS_SHA256}.`);
}
