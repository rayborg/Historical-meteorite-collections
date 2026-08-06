import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const issueFormPath = path.join(projectRoot, ".github", "ISSUE_TEMPLATE", "data-error.yml");
const configPath = path.join(projectRoot, ".github", "ISSUE_TEMPLATE", "config.yml");

function fieldBlock(form, id) {
  const match = form.match(new RegExp(`  - type: [^\\n]+\\n    id: ${id}\\n([\\s\\S]*?)(?=\\n  - type:|$)`));
  assert.ok(match, `Missing issue-form field: ${id}`);
  return match[0];
}

test("footer links directly to the correction form in a safe new tab", async () => {
  const html = await readFile(path.join(projectRoot, "index.html"), "utf8");
  assert.match(html, /<a class="issue-report-link" href="https:\/\/github\.com\/rayborg\/Historical-meteorite-collections\/issues\/new\?template=data-error\.yml" target="_blank" rel="noopener noreferrer" aria-label="[^"]+\(opens in a new tab\)">Report a catalog or search correction<\/a>/);
  assert.match(html, /styles\.css\?v=20260806-1/);
});

test("issue form assigns actionable structured correction reports to the owner", async () => {
  const form = await readFile(issueFormPath, "utf8");
  assert.match(form, /^name: Catalog or search correction$/m);
  assert.match(form, /^assignees:\n  - rayborg$/m);
  assert.match(fieldBlock(form, "issue-type"), /Catalog record or transcription[\s\S]*Canonical meteorite name[\s\S]*Search result or discoverability/);

  for (const id of ["issue-type", "affected-url", "record-identifier", "observed-problem", "expected-correction", "supporting-evidence"]) {
    assert.match(fieldBlock(form, id), /\n    validations:\n      required: true$/);
  }
});

test("issue intake requires both anti-spam and privacy confirmations", async () => {
  const [form, config] = await Promise.all([
    readFile(issueFormPath, "utf8"),
    readFile(configPath, "utf8"),
  ]);
  const confirmations = fieldBlock(form, "confirmations");
  assert.match(confirmations, /checked existing issues[\s\S]*required: true/);
  assert.match(confirmations, /sensitive\/private data[\s\S]*required: true/);
  assert.equal((confirmations.match(/required: true/g) || []).length, 2);
  assert.doesNotMatch(form, /^    id: (?:email|contact-email)$/m);
  assert.doesNotMatch(form, /^      label: (?:Your )?(?:contact )?email(?: address)?$/mi);
  assert.match(config, /^blank_issues_enabled: false\s*$/);
});
