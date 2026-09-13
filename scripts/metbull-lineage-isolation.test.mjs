import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { fileURLToPath } from "node:url";

const execute = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lineageSha256 = "b592065b07412b8d09d955f9276b2de0790a56f1649c7987a8b10bcc62c32199";
const sidecarSha256 = "9ac2997e1386cc9c2bf3b134f742aa30e5c4bdd23ac9233d18f57900d741d3f3";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function lineageSnapshot(document) {
  return {
    counts: document.metadata.counts,
    relationshipIds: document.relationships.map(({ id }) => id),
    sourceAttestedGroupIds: document.sourceAttestedGroups.map(({ id }) => id),
    comparisonGroups: document.comparisonGroups.map((group) => ({
      id: group.id,
      candidateCount: group.candidateCount,
      candidateIds: group.candidates.map(({ id }) => id),
      strengths: group.candidates.map(({ evidence }) => evidence.strength),
    })),
  };
}

async function prepareIsolatedBuilder(t) {
  const root = await mkdtemp(path.join(tmpdir(), "hmc-metbull-lineage-isolation-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await Promise.all([
    mkdir(path.join(root, "scripts")),
    mkdir(path.join(root, "data")),
  ]);
  await Promise.all([
    "build-specimen-lineages.mjs",
    "specimen-lineages-lib.mjs",
    "source-claims-lib.mjs",
  ].map((name) => copyFile(path.join(projectRoot, "scripts", name), path.join(root, "scripts", name))));
  await Promise.all([
    "catalog.json",
    "source-claims.json",
    "specimen-comparison-reviews.json",
    "specimen-lineages.json",
  ].map((name) => symlink(path.join(projectRoot, "data", name), path.join(root, "data", name))));
  return root;
}

async function runBuildCheck(root) {
  const { stdout } = await execute(process.execPath, [path.join(root, "scripts", "build-specimen-lineages.mjs"), "--check"]);
  assert.match(stdout, /specimen lineage build check passed/u);
  const lineageText = await readFile(path.join(root, "data", "specimen-lineages.json"), "utf8");
  assert.equal(sha256(lineageText), lineageSha256);
  return lineageSnapshot(JSON.parse(lineageText));
}

test("lineage build, IDs, strengths, grouping, and counts ignore current MetBull context", async (t) => {
  const root = await prepareIsolatedBuilder(t);
  const contextPath = path.join(root, "data", "metbull-current-context.json");
  const acceptedContext = await readFile(path.join(projectRoot, "data", "metbull-current-context.json"), "utf8");

  await writeFile(contextPath, acceptedContext);
  const withAcceptedContext = await runBuildCheck(root);

  await unlink(contextPath);
  const withoutContext = await runBuildCheck(root);

  await writeFile(contextPath, JSON.stringify({
    metadata: { changed: true },
    meteorites: {
      "11894": {
        name: "Changed event",
        classification: "Changed class",
        place: "Changed place",
        year: "9999",
        fall: "Yp",
        Mass: "999999",
        Lat: "90",
        Long: "180",
      },
    },
  }));
  const withChangedContext = await runBuildCheck(root);

  assert.deepEqual(withoutContext, withAcceptedContext);
  assert.deepEqual(withChangedContext, withAcceptedContext);
});

test("public current context is card-complete and cannot supply official mass or coordinates", async () => {
  const sidecarText = await readFile(path.join(projectRoot, "data", "metbull-current-context.json"), "utf8");
  const sidecar = JSON.parse(sidecarText);
  assert.equal(sha256(sidecarText), sidecarSha256);
  assert.equal(sidecar.metadata.cardCount, 14149);
  assert.equal(sidecar.metadata.mappedCardCount, 11774);
  assert.equal(sidecar.metadata.unmappedCardCount, 2375);
  assert.equal(sidecar.metadata.usedMeteoriteCodeCount, 2548);
  assert.equal(sidecar.metadata.mappedParentCount, 7651);
  assert.equal(sidecar.metadata.cardAssignmentsSha256, "a732537ef524872ec7bce3340a04db1eb0694453cc158b6497cfd363a973bb44");

  const facts = Object.values(sidecar.meteorites);
  assert.equal(facts.length, 2548);
  assert(facts.every((fact) =>
    JSON.stringify(Object.keys(fact)) === JSON.stringify(["name", "status", "fall", "year", "place", "classification"])));
  assert.deepEqual([...new Set(facts.map(({ fall }) => fall))].toSorted(), ["", "Np", "Y", "Yc", "Yp"]);

  const forbidden = new Set(["mass", "lat", "long", "latitude", "longitude", "coordinates", "comment"]);
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert(!forbidden.has(key.toLowerCase()), `public current context contains forbidden official field ${key}`);
      visit(child);
    }
  };
  visit(sidecar);
});
