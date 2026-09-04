import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const issueFormPath = path.join(projectRoot, ".github", "ISSUE_TEMPLATE", "data-error.yml");
const configPath = path.join(projectRoot, ".github", "ISSUE_TEMPLATE", "config.yml");
const issueFormUrl = "https://github.com/rayborg/Historical-meteorite-collections/issues/new?template=data-error.yml";
const app = await import(path.join(projectRoot, "app.js")).then(({ default: runtime }) => runtime);

function fieldBlock(form, id) {
  const match = form.match(new RegExp(`  - type: [^\\n]+\\n    id: ${id}\\n([\\s\\S]*?)(?=\\n  - type:|$)`));
  assert.ok(match, `Missing issue-form field: ${id}`);
  return match[0];
}

test("footer button remains visible in the viewport and opens an accessible dialog with a noscript fallback", async () => {
  const [html, styles] = await Promise.all([
    readFile(path.join(projectRoot, "index.html"), "utf8"),
    readFile(path.join(projectRoot, "styles.css"), "utf8"),
  ]);
  assert.match(html, /<button id="issue-report-open"[^>]*type="button">Report a website issue<\/button>/);
  assert.match(html, /<dialog id="issue-report-dialog" aria-labelledby="issue-report-title" aria-describedby="issue-report-description">/);
  assert.match(html, /id="issue-report-error"[^>]*role="alert" aria-live="assertive" hidden/);
  assert.match(html, /<form id="issue-report-form" class="issue-report-form" novalidate>/);
  assert.match(html, /<noscript>[\s\S]*href="https:\/\/github\.com\/rayborg\/Historical-meteorite-collections\/issues\/new\?template=data-error\.yml" target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /GitHub account and login are required/);
  assert.match(html, /Reports are stored as public GitHub issues/);
  assert.match(styles, /body > footer \.issue-report-action \{[^}]*position: fixed;[^}]*z-index: 50;[^}]*right: [^;]+;[^}]*bottom: [^;]+;/);
  assert.match(styles, /body > footer \.issue-report-button:focus-visible \{ outline: 2px solid #e2c997; outline-offset: 3px; \}/);
  assert.match(styles, /body:has\(dialog\[open\]\) > footer \.issue-report-action \{ visibility: hidden; \}/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*body > footer \.issue-report-action \{[^}]*width: min\(9\.75rem, calc\(100vw - 1\.3rem\)\);/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*body > footer \.issue-report-button \{[^}]*width: 100%;[^}]*font-size: \.72rem;/);
  assert.match(html, /styles\.css\?v=20260904-victoria-public-1/);
  assert.match(html, /app\.js\?v=20260904-victoria-public-1/);
  assert.equal(app.ASSET_CACHE_VERSION, "20260904-victoria-public-1");
});

test("anti-spam gate accepts only a correct, human-paced, empty-honeypot submission", () => {
  const base = { answer: "11", expectedAnswer: 11, honeypot: "", openedAt: 1000, now: 4000 };
  assert.deepEqual(app.evaluateIssueReportGate(base), { ok: true, reason: "success" });
  assert.deepEqual(app.evaluateIssueReportGate({ ...base, answer: "10" }), { ok: false, reason: "wrong-answer" });
  assert.deepEqual(app.evaluateIssueReportGate({ ...base, answer: "11e0" }), { ok: false, reason: "wrong-answer" });
  assert.deepEqual(app.evaluateIssueReportGate({ ...base, honeypot: "bot" }), { ok: false, reason: "honeypot" });
  assert.deepEqual(app.evaluateIssueReportGate({ ...base, now: 3999 }), { ok: false, reason: "too-fast" });
});

test("addition challenge has injectable deterministic randomness and bounded operands", () => {
  const requestedBounds = [];
  const challenge = app.createIssueReportChallenge((minimum, maximum) => {
    requestedBounds.push([minimum, maximum]);
    return requestedBounds.length === 1 ? minimum : maximum;
  });
  assert.deepEqual(requestedBounds, [[2, 12], [2, 12]]);
  assert.deepEqual(challenge, { left: 2, right: 12, answer: 14 });
  assert.equal(app.secureRandomInteger(4, 8, (values) => { values[0] = 0; }), 4);
  assert.equal(app.secureRandomInteger(4, 8, (values) => { values[0] = 4; }), 8);
});

test("successful browser path uses only the exact safe GitHub issue-form URL", async () => {
  const source = await readFile(path.join(projectRoot, "app.js"), "utf8");
  assert.equal(app.ISSUE_FORM_URL, issueFormUrl);
  assert.match(source, /globalThis\.crypto\.getRandomValues\(values\)/);
  assert.match(source, /window\.open\(ISSUE_FORM_URL, "_blank", "noopener,noreferrer"\)/);
  assert.doesNotMatch(source, /(?:recaptcha|hcaptcha|turnstile|captcha\.js|captcha\.com)/i);
  assert.match(source, /setIssueReportChallenge\(\);[\s\S]*showModal\(\);[\s\S]*issueReportAnswer\.focus\(\)/);
  assert.match(source, /reason === "wrong-answer"[\s\S]*setIssueReportChallenge\(\)/);
  assert.match(source, /issueReportForm\.addEventListener\("submit", submitIssueReport\)/);
  assert.match(source, /issueReportOpener\?\.isConnected[\s\S]*issueReportOpener\.focus\(\)/);
});

test("issue form assigns actionable structured correction reports to the owner", async () => {
  const form = await readFile(issueFormPath, "utf8");
  assert.match(form, /^name: Catalog, search, or website issue$/m);
  assert.match(form, /^assignees:\n  - rayborg$/m);
  assert.match(fieldBlock(form, "issue-type"), /Catalog record or transcription[\s\S]*Canonical meteorite name[\s\S]*Search result or discoverability[\s\S]*Website behavior or accessibility[\s\S]*General website issue/);

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

test("website intake does not collect contact or private data", async () => {
  const [html, source] = await Promise.all([
    readFile(path.join(projectRoot, "index.html"), "utf8"),
    readFile(path.join(projectRoot, "app.js"), "utf8"),
  ]);
  assert.doesNotMatch(html, /<input[^>]+type="email"/i);
  assert.doesNotMatch(html, /<input[^>]+name="(?:email|contact|contact-email)"/i);
  assert.match(html, /Do not include email addresses, contact details, private correspondence, credentials/);
  assert.doesNotMatch(source, /fetch\([^)]*ISSUE_FORM_URL|XMLHttpRequest|sendBeacon/);
});
