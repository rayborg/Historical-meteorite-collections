"use strict";

const CACHE_VERSION = "20260719-9";
const PAGE_SIZE = 120;
const DEFAULT_SORT = "designation-asc";
const VALID_SORTS = new Set([
  "designation-asc",
  "designation-desc",
  "name-asc",
  "name-desc",
  "weight-asc",
  "weight-desc"
]);
const RECORD_FIELDS = new Set([
  "id",
  "catalogId",
  "designation",
  "name",
  "weight",
  "classification",
  "locality",
  "year",
  "catalogPage",
  "confidence"
]);
const FOLIO_ROOT_FIELDS = new Set(["schemaVersion", "catalogs"]);
const FOLIO_CATALOG_FIELDS = new Set(["displayPolicy", "rightsStatus", "pages"]);
const FOLIO_PAGE_FIELDS = new Set(["image", "alt", "thumbnail"]);
const FOLIO_DISPLAY_POLICIES = new Set(["blocked", "display"]);
const FOLIO_RIGHTS_STATUSES = new Set(["undetermined", "public-domain"]);
const integerFormat = new Intl.NumberFormat("en-US");
const massFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });
const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

const elements = typeof document === "undefined" ? null : {
  form: document.querySelector("#filter-form"),
  search: document.querySelector("#search"),
  min: document.querySelector("#min-weight"),
  max: document.querySelector("#max-weight"),
  sort: document.querySelector("#sort"),
  results: document.querySelector("#results"),
  count: document.querySelector("#result-count"),
  status: document.querySelector("#status"),
  clear: document.querySelector("#clear-filters"),
  showMore: document.querySelector("#show-more"),
  empty: document.querySelector("#empty-state"),
  error: document.querySelector("#error-state"),
  errorHeading: document.querySelector("#error-heading"),
  errorMessage: document.querySelector("#error-message"),
  retry: document.querySelector("#retry"),
  template: document.querySelector("#record-template"),
  dialog: document.querySelector("#folio-dialog"),
  dialogClose: document.querySelector("#folio-dialog-close"),
  dialogCatalog: document.querySelector("#folio-dialog-catalog"),
  dialogTitle: document.querySelector("#folio-dialog-title"),
  dialogImage: document.querySelector("#folio-dialog-image"),
  dialogImageStatus: document.querySelector("#folio-image-status"),
  dialogCaption: document.querySelector("#folio-dialog-caption"),
  previousFolio: document.querySelector("#previous-folio"),
  nextFolio: document.querySelector("#next-folio"),
  folioPosition: document.querySelector("#folio-position"),
  stats: {
    specimens: document.querySelector("#stat-specimens"),
    names: document.querySelector("#stat-names"),
    pages: document.querySelector("#stat-pages"),
    mass: document.querySelector("#stat-mass")
  }
};

let records = [];
let folioManifest = null;
let activeFolioPages = [];
let activeFolioIndex = -1;
let folioOpener = null;
let visibleLimit = PAGE_SIZE;
let renderTimer;
let loadToken = 0;

function cleanText(value) {
  return value === null || value === undefined || value === "" ? null : String(value).trim();
}

function searchable(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function designationComponents(value) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase();

  if (!normalized.startsWith("h")) return null;
  const body = normalized.slice(1).trim();
  if (!/^\d+(?:[^a-z0-9]+\d+)*[^a-z0-9]*$/.test(body)) return null;
  return body.match(/\d+/g);
}

function normalizeDesignation(value) {
  const components = designationComponents(value);
  if (components) return `h${components.join(".")}`;
  return searchable(value).replace(/ /g, ".");
}

function isDesignationQuery(value) {
  return designationComponents(value) !== null;
}

function matchesSearch(record, rawQuery) {
  const query = searchable(rawQuery);
  if (!query) return true;

  const querySegments = designationComponents(rawQuery);
  if (querySegments) {
    const recordSegments = record.designationSegments || designationComponents(record.designation);
    return Boolean(recordSegments) && querySegments.every((segment, index) => recordSegments[index] === segment);
  }

  const haystack = record.searchText || searchable([
    record.designation,
    record.name,
    record.classification,
    record.locality,
    record.year
  ].filter(Boolean).join(" "));
  return query.split(/\s+/).every((term) => haystack.includes(term));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactFields(value, expectedFields) {
  if (!isPlainObject(value)) return false;
  const fields = Object.keys(value);
  return fields.length === expectedFields.size && fields.every((field) => expectedFields.has(field));
}

function validateCatalog(catalog) {
  const rootFields = new Set(["metadata", "records"]);
  if (!hasExactFields(catalog, rootFields) || !isPlainObject(catalog.metadata) || !Array.isArray(catalog.records)) {
    throw new Error("The catalog data does not match the public facts-only schema.");
  }

  catalog.records.forEach((record) => {
    if (!hasExactFields(record, RECORD_FIELDS) || !hasExactFields(record.weight, new Set(["grams"]))) {
      throw new Error("The catalog data does not match the public facts-only schema.");
    }
  });
  return catalog;
}

function isSafeFolioPath(value) {
  if (typeof value !== "string" || !value || /\s/.test(value)) return false;
  if (value.startsWith("/") || value.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(value)) return false;
  if (/[\\?#%:]/.test(value) || !value.startsWith("assets/folios/")) return false;
  const segments = value.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return false;
  if (segments.length < 3 || segments[0] !== "assets" || segments[1] !== "folios") return false;
  if (!segments.every((segment) => /^[A-Za-z0-9._-]+$/.test(segment))) return false;
  return /\.(?:webp|png|jpe?g|avif)$/.test(segments.at(-1));
}

function normalizeFolioAlt(value) {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (!normalized || Array.from(normalized).length > 160 || /[\p{Cc}\p{Cf}<>]/u.test(normalized)) return null;
  if (/`|!?\[[^\]]*\]\([^)]*\)/u.test(normalized)) return null;
  return normalized;
}

function isValidFolioAlt(value) {
  const normalized = normalizeFolioAlt(value);
  return normalized !== null && value === normalized;
}

function validateFolioManifest(manifest) {
  if (!hasExactFields(manifest, FOLIO_ROOT_FIELDS) || manifest.schemaVersion !== 1 || !isPlainObject(manifest.catalogs)) return false;
  if (!Object.keys(manifest.catalogs).length) return false;

  return Object.entries(manifest.catalogs).every(([catalogId, catalog]) => {
    if (!catalogId || !hasExactFields(catalog, FOLIO_CATALOG_FIELDS) || !isPlainObject(catalog.pages)) return false;
    if (!FOLIO_DISPLAY_POLICIES.has(catalog.displayPolicy) || !FOLIO_RIGHTS_STATUSES.has(catalog.rightsStatus)) return false;
    if (catalog.displayPolicy === "display" && catalog.rightsStatus !== "public-domain") return false;
    if (catalog.displayPolicy === "blocked" && Object.keys(catalog.pages).length) return false;
    return Object.entries(catalog.pages).every(([pageNumber, page]) => {
      if (!/^[1-9]\d*$/.test(pageNumber) || !isPlainObject(page)) return false;
      const fields = Object.keys(page);
      if (!fields.includes("image") || !fields.includes("alt") || !fields.every((field) => FOLIO_PAGE_FIELDS.has(field))) return false;
      if (fields.length < 2 || fields.length > 3 || !isSafeFolioPath(page.image) || !isValidFolioAlt(page.alt)) return false;
      return page.thumbnail === undefined || isSafeFolioPath(page.thumbnail);
    });
  });
}

function getAuthorizedFolio(manifest, catalogId, catalogPage) {
  if (!validateFolioManifest(manifest) || !cleanText(catalogId) || catalogPage === null || catalogPage === "" || !Number.isInteger(Number(catalogPage))) return null;
  const catalog = manifest.catalogs[catalogId];
  if (!catalog || catalog.displayPolicy !== "display" || catalog.rightsStatus !== "public-domain") return null;
  const page = catalog.pages[String(Number(catalogPage))];
  if (!page || !isSafeFolioPath(page.image) || !isValidFolioAlt(page.alt)) return null;
  const folio = { catalogId, catalogPage: Number(catalogPage), image: page.image, alt: page.alt };
  if (page.thumbnail !== undefined) folio.thumbnail = page.thumbnail;
  return folio;
}

function getAuthorizedFolioPages(manifest, catalogId) {
  if (!validateFolioManifest(manifest)) return [];
  const catalog = manifest.catalogs[catalogId];
  if (!catalog || catalog.displayPolicy !== "display" || catalog.rightsStatus !== "public-domain") return [];
  return Object.keys(catalog.pages)
    .map(Number)
    .sort((a, b) => a - b)
    .map((catalogPage) => getAuthorizedFolio(manifest, catalogId, catalogPage))
    .filter(Boolean);
}

function normalizeConfidence(value) {
  const normalized = searchable(value);
  return ["high", "medium", "low"].includes(normalized) ? normalized : "medium";
}

function prepareRecord(source, index) {
  const gramValue = source.weight.grams;
  const grams = gramValue === null || gramValue === "" ? null : Number(gramValue);
  const designation = cleanText(source.designation);
  const record = {
    id: cleanText(source.id),
    catalogId: cleanText(source.catalogId),
    designation,
    name: cleanText(source.name),
    weight: { grams: Number.isFinite(grams) ? grams : null },
    classification: cleanText(source.classification),
    locality: cleanText(source.locality),
    year: cleanText(source.year),
    catalogPage: source.catalogPage === null || source.catalogPage === "" ? null : Number(source.catalogPage),
    confidence: normalizeConfidence(source.confidence),
    order: index
  };
  record.searchText = searchable([
    record.designation,
    record.name,
    record.classification,
    record.locality,
    record.year
  ].filter(Boolean).join(" "));
  record.designationSegments = designationComponents(record.designation);
  return record;
}

async function loadData() {
  const currentLoadToken = ++loadToken;
  folioManifest = null;
  setLoadingState();
  try {
    const response = await fetch("./data/catalog.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`The public catalog request returned status ${response.status}.`);
    const catalog = validateCatalog(await response.json());
    records = catalog.records.map(prepareRecord);
    if (!records.length) throw new Error("The public catalog contains no specimen records.");
    updateStatistics();
    applyUrlState();
    visibleLimit = PAGE_SIZE;
    render();
    loadFolioManifest().then((manifest) => {
      if (currentLoadToken !== loadToken) return;
      folioManifest = manifest;
      if (manifest && records.some((record) => getAuthorizedFolio(manifest, record.catalogId, record.catalogPage))) render();
    });
  } catch (error) {
    showError(error);
  }
}

async function loadFolioManifest() {
  try {
    const response = await fetch("./data/folios.json", { cache: "no-cache" });
    if (!response.ok) return null;
    const manifest = await response.json();
    return validateFolioManifest(manifest) ? manifest : null;
  } catch {
    return null;
  }
}

function setLoadingState() {
  elements.results.replaceChildren();
  elements.results.setAttribute("aria-busy", "true");
  elements.status.textContent = "Opening the factual index...";
  elements.count.textContent = "Loading";
  elements.showMore.hidden = true;
  elements.empty.hidden = true;
  elements.error.hidden = true;
}

function showError(error) {
  elements.results.replaceChildren();
  elements.results.setAttribute("aria-busy", "false");
  elements.status.textContent = "The public catalog is unavailable.";
  elements.count.textContent = "0";
  elements.showMore.hidden = true;
  elements.empty.hidden = true;
  elements.errorMessage.textContent = error.message || "The public catalog data is presently unavailable.";
  elements.error.hidden = false;
  elements.errorHeading.focus();
}

function updateStatistics() {
  const names = new Set(records.map((record) => searchable(record.name)).filter(Boolean));
  const pages = new Set(records.map((record) => record.catalogPage).filter(Number.isFinite));
  const totalGrams = records.reduce((sum, record) => sum + (record.weight.grams || 0), 0);
  elements.stats.specimens.textContent = integerFormat.format(records.length);
  elements.stats.names.textContent = integerFormat.format(names.size);
  elements.stats.pages.textContent = integerFormat.format(pages.size);
  elements.stats.mass.textContent = formatMass(totalGrams);
}

function formatMass(grams) {
  if (!Number.isFinite(grams)) return "Not recorded";
  if (Math.abs(grams) >= 1_000_000) return `${massFormat.format(grams / 1_000_000)} t`;
  if (Math.abs(grams) >= 1_000) return `${massFormat.format(grams / 1_000)} kg`;
  return `${massFormat.format(grams)} g`;
}

function currentFilters() {
  const min = elements.min.value === "" ? null : Number(elements.min.value);
  const max = elements.max.value === "" ? null : Number(elements.max.value);
  return {
    query: elements.search.value.trim(),
    min: Number.isFinite(min) ? min : null,
    max: Number.isFinite(max) ? max : null,
    sort: VALID_SORTS.has(elements.sort.value) ? elements.sort.value : DEFAULT_SORT
  };
}

function filterRecords(sourceRecords, filters) {
  return sourceRecords.filter((record) => {
    const grams = record.weight.grams;
    const weightMatches = (filters.min === null && filters.max === null) || (
      grams !== null &&
      (filters.min === null || grams >= filters.min) &&
      (filters.max === null || grams <= filters.max)
    );
    return weightMatches && matchesSearch(record, filters.query);
  }).sort((a, b) => compareRecords(a, b, filters.sort));
}

function compareNullableText(a, b, field, direction = 1) {
  if (!a[field] && b[field]) return 1;
  if (a[field] && !b[field]) return -1;
  return direction * collator.compare(a[field] || "", b[field] || "");
}

function compareRecords(a, b, sort) {
  const descending = sort.endsWith("-desc") ? -1 : 1;
  let comparison = 0;

  if (sort.startsWith("designation")) comparison = compareNullableText(a, b, "designation", descending);
  if (sort.startsWith("name")) comparison = compareNullableText(a, b, "name", descending);
  if (sort.startsWith("weight")) {
    if (a.weight.grams === null && b.weight.grams !== null) return 1;
    if (a.weight.grams !== null && b.weight.grams === null) return -1;
    comparison = descending * ((a.weight.grams || 0) - (b.weight.grams || 0));
  }

  return comparison || compareNullableText(a, b, "designation") || a.order - b.order;
}

function render() {
  const matches = filterRecords(records, currentFilters());
  const visibleRecords = matches.slice(0, visibleLimit);
  const fragment = document.createDocumentFragment();
  visibleRecords.forEach((record) => fragment.append(createRecordCard(record)));
  elements.results.replaceChildren(fragment);
  elements.results.setAttribute("aria-busy", "false");
  elements.count.textContent = integerFormat.format(matches.length);
  elements.status.textContent = matches.length > visibleRecords.length
    ? `Showing ${integerFormat.format(visibleRecords.length)} of ${integerFormat.format(matches.length)} matching entries.`
    : matches.length ? `Showing all ${integerFormat.format(matches.length)} matching entries.` : "No matching entries.";
  elements.showMore.hidden = visibleRecords.length >= matches.length;
  elements.empty.hidden = matches.length !== 0;
  elements.error.hidden = true;
  elements.clear.hidden = !hasActiveFilters();
  updateUrl();
}

function createRecordCard(record) {
  const card = elements.template.content.firstElementChild.cloneNode(true);
  card.querySelector(".designation").textContent = record.designation || "Designation not recorded";
  card.querySelector(".record-name").textContent = record.name ? displayText(record.name) : "Name not recorded";
  card.querySelector(".record-weight strong").textContent = record.weight.grams === null
    ? "Not recorded"
    : formatMass(record.weight.grams);
  setMetaRow(card, ".classification-row", record.classification);
  setMetaRow(card, ".locality-row", record.locality);
  setMetaRow(card, ".year-row", record.year);
  const catalogLabel = record.catalogId === "huss-1976" ? "1976 catalog" : `${record.catalogId || "Catalog"}`;
  card.querySelector(".catalog-reference").textContent = record.catalogPage === null
    ? `${catalogLabel} · page not recorded`
    : `${catalogLabel} · p. ${record.catalogPage}`;
  const confidence = card.querySelector(".confidence");
  confidence.classList.add(record.confidence);
  confidence.querySelector("span").textContent = `${capitalize(record.confidence)} transcription confidence`;
  const folio = getAuthorizedFolio(folioManifest, record.catalogId, record.catalogPage);
  if (folio) {
    const button = document.createElement("button");
    button.className = "folio-button";
    button.type = "button";
    button.textContent = "View folio";
    button.setAttribute("aria-label", `View catalog folio for ${record.catalogId}, page ${record.catalogPage}`);
    button.addEventListener("click", () => openFolioDialog(record.catalogId, record.catalogPage, button));
    card.querySelector(".record-footer").append(button);
  }
  return card;
}

function setMetaRow(card, selector, value) {
  const row = card.querySelector(selector);
  row.querySelector("dd").textContent = value ? displayText(value) : "Not recorded";
  if (!value) row.classList.add("unknown");
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function displayText(value) {
  return String(value).replace(/(\p{L})-(?=\p{L})/gu, "$1\u2011");
}

function openFolioDialog(catalogId, catalogPage, opener) {
  activeFolioPages = getAuthorizedFolioPages(folioManifest, catalogId);
  activeFolioIndex = activeFolioPages.findIndex((folio) => folio.catalogPage === Number(catalogPage));
  if (activeFolioIndex < 0) return;
  folioOpener = opener;
  updateFolioDialog();
  elements.dialog.showModal();
}

function updateFolioDialog() {
  const folio = activeFolioPages[activeFolioIndex];
  if (!folio) return;
  const safeLabel = `${folio.catalogId}, page ${folio.catalogPage}`;
  elements.dialogCatalog.textContent = folio.catalogId;
  elements.dialogTitle.textContent = `Catalog page ${folio.catalogPage}`;
  elements.dialogCaption.textContent = `Catalog folio: ${safeLabel}`;
  elements.dialogImageStatus.textContent = "Loading folio...";
  elements.dialogImage.hidden = false;
  elements.dialogImage.alt = folio.alt;
  elements.dialogImage.src = folio.image;
  elements.folioPosition.textContent = `Page ${folio.catalogPage} · ${activeFolioIndex + 1} of ${activeFolioPages.length}`;
  elements.previousFolio.disabled = activeFolioIndex === 0;
  elements.nextFolio.disabled = activeFolioIndex === activeFolioPages.length - 1;
}

function moveFolio(direction) {
  const nextIndex = activeFolioIndex + direction;
  if (nextIndex < 0 || nextIndex >= activeFolioPages.length) return;
  activeFolioIndex = nextIndex;
  updateFolioDialog();
}

function hasActiveFilters() {
  const filters = currentFilters();
  return Boolean(filters.query || filters.min !== null || filters.max !== null || filters.sort !== DEFAULT_SORT);
}

function clearFilters() {
  elements.form.reset();
  elements.sort.value = DEFAULT_SORT;
  elements.min.setCustomValidity("");
  elements.max.setCustomValidity("");
  visibleLimit = PAGE_SIZE;
  render();
  elements.search.focus();
}

function validateWeights() {
  const filters = currentFilters();
  const invalidRange = filters.min !== null && filters.max !== null && filters.min > filters.max;
  elements.max.setCustomValidity(invalidRange ? "Maximum weight must be greater than or equal to minimum weight." : "");
  return elements.form.reportValidity();
}

function scheduleRender() {
  window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(() => {
    if (validateWeights()) {
      visibleLimit = PAGE_SIZE;
      render();
    }
  }, 120);
}

function updateUrl() {
  const filters = currentFilters();
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.min !== null) params.set("min", String(filters.min));
  if (filters.max !== null) params.set("max", String(filters.max));
  if (filters.sort !== DEFAULT_SORT) params.set("sort", filters.sort);
  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState(null, "", nextUrl);
}

function applyUrlState() {
  const params = new URLSearchParams(window.location.search);
  elements.search.value = params.get("q") || "";
  elements.min.value = validUrlWeight(params.get("min"));
  elements.max.value = validUrlWeight(params.get("max"));
  const sort = params.get("sort") || DEFAULT_SORT;
  elements.sort.value = VALID_SORTS.has(sort) ? sort : DEFAULT_SORT;
}

function validUrlWeight(value) {
  if (value === null || value === "" || !Number.isFinite(Number(value)) || Number(value) < 0) return "";
  return value;
}

if (elements) {
  elements.dialogImage.addEventListener("load", () => {
    elements.dialogImageStatus.textContent = "";
  });
  elements.dialogImage.addEventListener("error", () => {
    elements.dialogImage.hidden = true;
    elements.dialogImageStatus.textContent = "The authorized folio image could not be loaded.";
  });
  elements.form.addEventListener("submit", (event) => event.preventDefault());
  elements.search.addEventListener("input", scheduleRender);
  elements.min.addEventListener("input", scheduleRender);
  elements.max.addEventListener("input", scheduleRender);
  elements.sort.addEventListener("change", () => {
    visibleLimit = PAGE_SIZE;
    render();
  });
  elements.clear.addEventListener("click", clearFilters);
  document.querySelector("[data-clear-filters]").addEventListener("click", clearFilters);
  elements.retry.addEventListener("click", loadData);
  elements.showMore.addEventListener("click", () => {
    visibleLimit += PAGE_SIZE;
    render();
  });
  elements.dialogClose.addEventListener("click", () => elements.dialog.close());
  elements.previousFolio.addEventListener("click", () => moveFolio(-1));
  elements.nextFolio.addEventListener("click", () => moveFolio(1));
  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) elements.dialog.close();
  });
  elements.dialog.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === "Escape") {
      event.preventDefault();
      elements.dialog.close();
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveFolio(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveFolio(1);
    }
  });
  elements.dialog.addEventListener("close", () => {
    elements.dialogImage.removeAttribute("src");
    elements.dialogImage.alt = "";
    elements.dialogImageStatus.textContent = "";
    activeFolioPages = [];
    activeFolioIndex = -1;
    if (folioOpener?.isConnected) folioOpener.focus();
    folioOpener = null;
  });
  window.addEventListener("popstate", () => {
    applyUrlState();
    visibleLimit = PAGE_SIZE;
    render();
  });
  loadData();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CACHE_VERSION,
    DEFAULT_SORT,
    compareRecords,
    designationComponents,
    filterRecords,
    formatMass,
    getAuthorizedFolio,
    getAuthorizedFolioPages,
    isDesignationQuery,
    isSafeFolioPath,
    isValidFolioAlt,
    matchesSearch,
    normalizeFolioAlt,
    normalizeDesignation,
    prepareRecord,
    searchable,
    validateCatalog,
    validateFolioManifest
  };
}
