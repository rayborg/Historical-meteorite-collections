import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = path.join(projectRoot, "index.html");
const bibliographyPath = path.join(projectRoot, "data", "bibliography-master-list.html");

test("keeps the published bibliography available without linking it from the homepage", async () => {
  const [index, bibliography] = await Promise.all([
    readFile(indexPath, "utf8"),
    readFile(bibliographyPath, "utf8"),
  ]);
  assert.doesNotMatch(index, /href="\.\/data\/bibliography-master-list\.html"/);
  assert.match(bibliography, /href="\.\.\/index\.html">← Back to The Meteorite Cabinet<\/a>/);
});

test("publishes a safe and accessible bibliography table", async () => {
  const bibliography = await readFile(bibliographyPath, "utf8");
  const rowFor = (controlId) => {
    const row = bibliography.match(new RegExp(`<tr[^>]*><td data-control="${controlId}"[^\\n]*</tr>`))?.[0];
    assert.ok(row, `Missing bibliography row ${controlId}`);
    return row;
  };

  assert.equal((bibliography.match(/<tr(?: |>)/g) || []).length, 265);
  assert.equal((bibliography.match(/data-control="MCB-\d+"/g) || []).length, 264);
  assert.equal((bibliography.match(/<li class="project complete/g) || []).length, 40);
  assert.equal((bibliography.match(/<tr class="worked-row">/g) || []).length, 39);
  assert.equal((bibliography.match(/class="processing-cell complete"/g) || []).length, 39);
  assert.match(bibliography, /<strong>264<\/strong><span>Total controls<\/span>/);
  assert.match(bibliography, /<strong>40<\/strong><span>Catalog projects done<\/span>/);
  assert.match(bibliography, /<strong>39<\/strong><span>Integrated controls<\/span>/);
  assert.match(bibliography, /<strong>36<\/strong><span>Remaining acquired backlog<\/span>/);
  assert.match(bibliography, /Acquisition-to-integration backlog: 36 remaining/);
  assert.match(bibliography, /class="table-wrap" role="region" aria-label="Bibliography master list; scroll horizontally to see all columns" tabindex="0"/);
  assert.match(bibliography, /\.table-wrap:focus-visible \{[^}]*outline:/);
  for (const controlId of ["MCB-80", "MCB-86", "MCB-93", "MCB-94", "MCB-117", "MCB-141", "MCB-165", "MCB-175", "MCB-197", "MCB-204"]) {
    assert.match(rowFor(controlId), /processing-cell complete/);
  }
  assert.match(rowFor("MCB-141"), /Catalogue of the collection of meteorites in the Mineralogical Museum of Harvard University[^]*SP1949-0125/);
  assert.match(rowFor("MCB-197"), /1996-01-31[^]*Meteorite Catalogue of the Kanagawa Prefectural Museum of Natural History \/ 隕石目録/);
  assert.match(rowFor("MCB-204"), /2024-09[^]*Arizona State University Meteorite Collection Catalog/);
  assert.match(rowFor("MCB-130"), /A descriptive catalogue of the meteorites comprised in the collection of the Geological Survey of India[^]*processing-cell complete[^]*Catalogue of Meteorites, with Special Reference/);
  assert.match(rowFor("MCB-69"), /Catalogue of the meteorites in the university collection[^]*processing-cell complete[^]*Catalogue of the Meteorites in the University Collection/);
  assert.match(rowFor("MCB-113"), /Complete Mineral Catalog[^]*processing-cell complete[^]*Complete Mineral Catalog \(1909\)/);

  const morelliRow = rowFor("MCB-203");
  assert.doesNotMatch(morelliRow, /worked-row|processing-cell complete/);
  assert.match(morelliRow, /class="processing-cell"><span class="blank">—<\/span>/);
  assert.match(bibliography, /MCB-203, ACQ-20260723-025[^]*supplemental Tables S1\/S2 have not been acquired/);
  assert.doesNotMatch(bibliography, /Catalogue of Meteorites in the American Museum of Natural History/);
  assert.doesNotMatch(bibliography, /<title>Arizona State University Meteorite Collection Catalog<\/title>/);

  const sourceLinks = bibliography.match(/<a href="https:\/\//g) || [];
  const namedSourceLinks = bibliography.match(/target="_blank" rel="noreferrer" aria-label="Open(?: \d+)? source for MCB-\d+:/g) || [];
  assert.ok(sourceLinks.length > 0);
  assert.equal(namedSourceLinks.length, sourceLinks.length);

  for (const privateMarker of ["ML-CONFIRMED-027", "/private/", "/Users/", "/Volumes/", "file://", "source-images/", "localPath", "sha256", "data/ocr/", "reviewEvidence", "reviewNotes"]) {
    assert.ok(!bibliography.includes(privateMarker), `Published bibliography contains private marker ${privateMarker}`);
  }
  assert.doesNotMatch(bibliography, /\b(?:ML|AUDIT|REVIEW)-[A-Z0-9-]+\b/);
  assert.doesNotMatch(bibliography, /\b(?:price|purchase price|audit details?)\b/i);
});
