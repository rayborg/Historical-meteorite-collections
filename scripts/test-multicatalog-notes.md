# Multi-catalog test harness

Run from the repository root:

```sh
node scripts/test-multicatalog.cjs
```

The harness uses only Node built-ins and the CommonJS exports from `app.js`. Its schema-6 fixture covers all four record models with two `specimen` Huss descriptors, one `catalog-item` Nininger descriptor, one synthetic `catalog-number` Hovey descriptor, and one synthetic `collection-entry` museum-register descriptor. The 15 records include three collection entries with duplicate or absent reported numbers, ordered entry identities, normalized holding masses, and single- or cross-page citations. The Hovey records include a cross-page `[149, 150]` citation, a count-22 group with one 212.6 g mass, and a count-2 group with ordered 24.7 g and 11.4 g masses. Every synthetic descriptor is blocked/undetermined for folio display. Optional MetBull fixtures verify exact reviewed fields, search behavior, and fail-closed unresolved identities. The real release includes one designation-bearing specimen with a source-omitted mass: Appley Bridge `199.1` remains `weight.grams: null`.

The 108 named runtime tests retain all former concerns: canonical counts and ordering, privacy and metadata leakage, summary failures, malformed IDs and text, substantive-fact requirements, duplicate-label disambiguation, selector ordering, preparation and catalog-scoped page identity, search boundaries, filtering, URL behavior, statistics, stable sort ties, and the full folio fail-closed matrix. Catalog-number cases cover exact record/holding/weight shapes, opaque fraction-like and decreasing identifiers, scoped uniqueness, normalized text, provenance privacy, source-reported mass prose without private display fields, positive nullable counts, nonempty ordered finite nonnegative weights, ordered unique descriptor-scoped pages, cross-page statistics, all required search fields, flattened mass filtering/sorting/statistics without count multiplication, reported-group-count display wording, and generic rejection of private labels and OCR batch identifiers. Collection-entry cases cover exact shapes, optional opaque non-unique reported numbers, unique strictly increasing entry ordering per catalog, holding facts and masses, pages, sections, event dates, provenance, search, sorting, and rejection of dedicated private historical-mass fields while allowing factual source-reported prose.

Explicit ordering regressions preserve Nininger catalog items in numeric order, then literal Huss forms, then catalog-number records in source-page order, with collection entries last in increasing `entryOrder`. The runtime rejects collection entries placed before any existing model group. Catalog-number ties use opaque text, nullable name, and ID after the first cited page; no independent monotonic-number rule is applied. Existing parenthesized Huss search and all Nininger behavior remain covered unchanged.

Runtime schema tests intentionally reject schemas 5, 4, 3, and 2 as well as legacy metadata. They also reject model/shape disagreements, invalid identities, holdings, counts, masses, pages, MetBull identities, unexpected fields, incorrect summaries, and recursive private leakage. Static UI checks cover the accessible ordered holdings template, source and current-name labels, `Catalog item N`, `Catalog no. N`, `Unnumbered`, reported group count and all-mass wording, all page citations, removal of top-level multi-holding mass, revised sort wording, and cache version `20260726-3`.

Folio authorization tests pass the normalized catalog registry to manifest validation, `getAuthorizedFolio`, and `getAuthorizedFolioPages`. They cover matching public-domain policy, blocked policy, malformed manifests, missing or extra catalogs, out-of-range pages, exact `assets/folios/<catalogId>/<pageId>.webp` paths, and independently valid metadata/manifest policies that disagree and therefore deny display.

The validator reports exactly 2 baseline catalog allows, 57 baseline catalog/leakage rejections, 1 model-aware catalog allow, 1 model-ordering/catalog-scope allow, 1 holding-privacy boundary allow, 38 model/holding rejections, 23 catalog-number rejections, 15 collection-entry/schema-6 rejections, 3 MetBull allows, 7 MetBull rejections, 5 folio allows, 51 folio rejections, 2 folio-file allows, and 17 folio-file rejections.

<!-- release-summary:test-notes-folio-lock:start -->
Real-release checks additionally lock reviewed rights evidence, ordered page IDs, and all 41 asset hashes.
<!-- release-summary:test-notes-folio-lock:end -->

The runtime harness does not import `data/catalog.json`, so run the integrated validator separately.

<!-- release-summary:test-notes-real-release:start -->
The default `node scripts/validate-public-catalog.mjs` command reads and passes the real schema-6 `data/catalog.json` and `data/folios.json`: 2,418 records across 8 catalogs with 41 displayable folio pages.
<!-- release-summary:test-notes-real-release:end -->

Real Hovey metadata is `display/public-domain`; Hovey catalog numbers remain searchable but are excluded from `recordsWithDesignation`, matching the descriptor. `--synthetic-only` checks the strict schema-6 fixtures without reading those real files and also passes.
