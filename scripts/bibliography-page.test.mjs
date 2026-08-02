import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = path.join(projectRoot, "index.html");
const bibliographyPath = path.join(projectRoot, "data", "bibliography-master-list.html");

test("links the cabinet homepage to the published bibliography", async () => {
  const [index, bibliography] = await Promise.all([
    readFile(indexPath, "utf8"),
    readFile(bibliographyPath, "utf8"),
  ]);
  assert.match(index, /href="\.\/data\/bibliography-master-list\.html"/);
  assert.match(bibliography, /href="\.\.\/index\.html">← Back to The Meteorite Cabinet<\/a>/);
});

test("publishes a safe and accessible bibliography table", async () => {
  const bibliography = await readFile(bibliographyPath, "utf8");
  assert.equal((bibliography.match(/data-control="MCB-\d+"/g) || []).length, 264);
  assert.match(bibliography, /<strong>264<\/strong><span>Total controls<\/span>/);
  assert.match(bibliography, /class="table-wrap" role="region" aria-label="Bibliography master list; scroll horizontally to see all columns" tabindex="0"/);
  assert.match(bibliography, /\.table-wrap:focus-visible \{[^}]*outline:/);
  assert.match(bibliography, /data-control="MCB-80"[^\n]*processing-cell complete[^\n]*Washington 1897/);
  assert.match(bibliography, /data-control="MCB-86"[^\n]*processing-cell complete[^\n]*Tassin 1902/);
  assert.match(bibliography, /data-control="MCB-93"[^\n]*processing-cell complete[^\n]*Högbom 1902/);
  assert.match(bibliography, /data-control="MCB-94"[^\n]*processing-cell complete[^\n]*Farrington 1903/);
  assert.match(bibliography, /data-control="MCB-117"[^\n]*processing-cell complete[^\n]*Schreiter 1912/);
  assert.match(bibliography, /data-control="MCB-175"[^\n]*The Meteorite and Tektite Collection of the American Museum of Natural History[^\n]*processing-cell complete[^\n]*Mason 1964/);
  assert.match(bibliography, /data-control="MCB-204"[^\n]*2024-09[^\n]*Arizona State University Meteorite Collection Catalog[^\n]*processing-cell complete[^\n]*ASU September 2024/);
  assert.doesNotMatch(bibliography, /Catalogue of Meteorites in the American Museum of Natural History/);
  assert.doesNotMatch(bibliography, /<title>Arizona State University Meteorite Collection Catalog<\/title>/);

  const sourceLinks = bibliography.match(/<a href="https:\/\//g) || [];
  const namedSourceLinks = bibliography.match(/target="_blank" rel="noreferrer" aria-label="Open(?: \d+)? source for MCB-\d+:/g) || [];
  assert.ok(sourceLinks.length > 0);
  assert.equal(namedSourceLinks.length, sourceLinks.length);

  for (const privateMarker of ["/private/", "/Users/", "source-images/", "localPath", "sha256", "data/ocr/"]) {
    assert.ok(!bibliography.includes(privateMarker), `Published bibliography contains private marker ${privateMarker}`);
  }
});
