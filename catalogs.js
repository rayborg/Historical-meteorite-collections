"use strict";

const catalogDirectoryRuntime = typeof module !== "undefined" && module.exports
  ? require("./app.js")
  : window.HMCPublicRuntime;

async function fetchCatalogDirectoryJson(url, fetcher) {
  const response = await fetcher(url, { cache: "no-cache" });
  if (!response?.ok) throw new Error("The public catalog directory request failed.");
  return response.json();
}

async function loadCatalogDirectoryData(fetcher = fetch, runtime = catalogDirectoryRuntime) {
  if (!runtime) throw new Error("The public catalog runtime is unavailable.");
  const [catalog, folios] = await Promise.all([
    fetchCatalogDirectoryJson("./data/catalog.json", fetcher),
    fetchCatalogDirectoryJson("./data/folios.json", fetcher)
  ]);
  const validatedCatalog = runtime.validateCatalog(catalog);
  const registry = runtime.normalizeCatalogRegistry(validatedCatalog.metadata);
  if (!runtime.validateFolioManifest(folios, registry)) {
    throw new Error("The public folio data does not match its display policy.");
  }
  const entries = runtime.catalogSummaryEntries(registry).map((summary) => ({
    ...summary,
    folios: runtime.getAuthorizedFolioPages(folios, summary.id, registry)
  }));
  return { entries, registry };
}

function appendCatalogDetail(details, term, description) {
  const row = document.createElement("div");
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = term;
  dd.textContent = description;
  row.append(dt, dd);
  details.append(row);
}

function initializeCatalogDirectory() {
  const elements = {
    list: document.querySelector("#catalog-directory-list"),
    status: document.querySelector("#catalog-directory-status"),
    error: document.querySelector("#catalog-directory-error"),
    errorHeading: document.querySelector("#catalog-directory-error-heading"),
    retry: document.querySelector("#catalog-directory-retry"),
    dialog: document.querySelector("#folio-dialog"),
    dialogClose: document.querySelector("#folio-dialog-close"),
    dialogCatalog: document.querySelector("#folio-dialog-catalog"),
    dialogTitle: document.querySelector("#folio-dialog-title"),
    dialogImage: document.querySelector("#folio-dialog-image"),
    dialogImageStatus: document.querySelector("#folio-image-status"),
    dialogCaption: document.querySelector("#folio-dialog-caption"),
    previousFolio: document.querySelector("#previous-folio"),
    nextFolio: document.querySelector("#next-folio"),
    folioPosition: document.querySelector("#folio-position")
  };
  if (!elements.list) return;

  let registry = {};
  let activeFolios = [];
  let activeIndex = -1;
  let folioOpener = null;

  function folioLabel(folio, index) {
    if (folio.pageLabel) return folio.pageLabel;
    if (folio.catalogPage !== null) return `Page ${folio.catalogPage}`;
    return `Source image ${index + 1}`;
  }

  function updateDialog() {
    const folio = activeFolios[activeIndex];
    if (!folio) return;
    const sourceLabel = catalogDirectoryRuntime.catalogLabel(registry[folio.catalogId], folio.catalogId);
    const pageLabel = folioLabel(folio, activeIndex);
    elements.dialogCatalog.textContent = sourceLabel;
    elements.dialogTitle.textContent = folio.pageLabel ||
      (folio.catalogPage !== null ? `Catalog page ${folio.catalogPage}` : pageLabel);
    elements.dialogCaption.textContent = `Catalog folio: ${sourceLabel}, ${pageLabel}`;
    elements.dialogImageStatus.textContent = "Loading folio...";
    elements.dialogImage.hidden = false;
    elements.dialogImage.alt = folio.alt;
    elements.dialogImage.src = folio.image;
    elements.folioPosition.textContent = `${pageLabel} · ${activeIndex + 1} of ${activeFolios.length}`;
    elements.previousFolio.disabled = activeIndex === 0;
    elements.nextFolio.disabled = activeIndex === activeFolios.length - 1;
  }

  function openDialog(folios, opener) {
    if (!folios.length) return;
    activeFolios = folios;
    activeIndex = 0;
    folioOpener = opener;
    updateDialog();
    elements.dialog.showModal();
  }

  function moveDialog(direction) {
    const next = activeIndex + direction;
    if (next < 0 || next >= activeFolios.length) return;
    activeIndex = next;
    updateDialog();
  }

  function renderDirectory(entries) {
    const list = document.createElement("ul");
    list.className = "catalog-summary-list";
    entries.forEach((summary) => {
      const item = document.createElement("li");
      item.className = "catalog-summary-card";
      const heading = document.createElement("h3");
      heading.textContent = summary.label;
      const details = document.createElement("dl");
      appendCatalogDetail(details, "Year", String(summary.year));
      appendCatalogDetail(details, "Compiler", summary.compiler);
      appendCatalogDetail(details, "Page coverage", summary.pageCoverage);
      appendCatalogDetail(details, "Source observations", new Intl.NumberFormat("en-US").format(summary.observationCount));
      item.append(heading, details);
      if (summary.folios.length) {
        const button = document.createElement("button");
        button.className = "folio-button";
        button.type = "button";
        button.textContent = "Browse all source images";
        button.setAttribute("aria-label", `Browse all source images for ${summary.label}`);
        button.addEventListener("click", () => openDialog(summary.folios, button));
        item.append(button);
      }
      list.append(item);
    });
    elements.list.replaceChildren(list);
    elements.list.setAttribute("aria-busy", "false");
    elements.status.textContent = `${entries.length} catalogs are included in this edition.`;
    elements.error.hidden = true;
  }

  async function load() {
    elements.list.replaceChildren();
    elements.list.setAttribute("aria-busy", "true");
    elements.status.textContent = "Reading catalog metadata...";
    elements.error.hidden = true;
    try {
      const directory = await loadCatalogDirectoryData();
      registry = directory.registry;
      renderDirectory(directory.entries);
    } catch {
      registry = {};
      elements.list.replaceChildren();
      elements.list.setAttribute("aria-busy", "false");
      elements.status.textContent = "The public catalog directory is unavailable.";
      elements.error.hidden = false;
      elements.errorHeading.focus();
    }
  }

  elements.retry.addEventListener("click", load);
  elements.dialogClose.addEventListener("click", () => elements.dialog.close());
  elements.previousFolio.addEventListener("click", () => moveDialog(-1));
  elements.nextFolio.addEventListener("click", () => moveDialog(1));
  elements.dialogImage.addEventListener("load", () => { elements.dialogImageStatus.textContent = ""; });
  elements.dialogImage.addEventListener("error", () => {
    elements.dialogImage.hidden = true;
    elements.dialogImageStatus.textContent = "The authorized folio image could not be loaded.";
  });
  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) elements.dialog.close();
  });
  elements.dialog.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === "Escape") {
      event.preventDefault();
      elements.dialog.close();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveDialog(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      moveDialog(1);
    }
  });
  elements.dialog.addEventListener("close", () => {
    elements.dialogImage.removeAttribute("src");
    elements.dialogImage.alt = "";
    elements.dialogImageStatus.textContent = "";
    activeFolios = [];
    activeIndex = -1;
    if (folioOpener?.isConnected) folioOpener.focus();
    folioOpener = null;
  });

  load();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { fetchCatalogDirectoryJson, loadCatalogDirectoryData };
} else {
  initializeCatalogDirectory();
}
