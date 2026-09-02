# Multi-catalog test harness

Run from the repository root:

```sh
node scripts/test-multicatalog.cjs
```

The real release includes 205 Foote 1912, 697 Ward 1904, and 738 Farrington 1916 facts-only collection entries. Foote has 132 reviewed exact-name mappings and 73 pending observations; Ward has 49 reviewed exact-name mappings and 648 pending observations; Farrington has 469 reviewed exact-name mappings and 269 pending observations. All three use blocked/undetermined zero-page folio policies. The release also includes 560 Merrill 1916, 949 Prior 1923, and 500 Reeds 1937 facts-only collection entries. Merrill has 560 pending observations, Prior has 758 reviewed exact-name mappings and 191 pending observations, and Reeds has 390 reviewed exact-name mappings and 110 pending observations. Runtime dropdown coverage includes the concise labels `Anderson (1913)`, `Kantor (1920)`, and `Astapovich (1938)` alongside the existing catalog labels.

The release also includes 232 Kanagawa 1996 facts-only collection entries from pages 4-22 and 24: 80 meteorite and 152 tektite/natural-glass observations, with controlled descriptions only, 68 reviewed exact-name MetBull mappings, 164 pending observations, and a blocked/undetermined zero-page folio policy. It retains 361 Palache 1926 facts-only collection entries across nine metadata pages, 151-159, with introduction-only page 151 excluded from the eight record-cited pages, 285 reviewed exact-name MetBull mappings, 76 pending observations, and the same blocked folio boundary. It includes 70 Barnes 1940 facts-only collection entries from pages 583-612, with 48 reviewed exact-name MetBull mappings, 22 pending observations without canonical identity, and 2,169 ASU September 2024 facts-only records with 2,166 unique designations, only `91`, `157`, and `607` duplicated, 2,088 reviewed exact-name MetBull mappings, and 81 pending observations without canonical identity.

The current 40-catalog, 14,477-record schema-10 facts-only candidate contains 10,904 reviewed mappings (10,600 resolved and 304 unresolved), 3,573 pending records, and 111 optional specimen-only individual find locations. The schema-4 display manifest declares 2,224 projected parents, 7,224 atomic cards, and 1,694 non-displayed context partitions. Brown contributes 385 cards, Minnesota 164, and Foote contributes six dealer observations that carry no specimen, mass, MetBull, or lineage claim.

The harness uses only Node built-ins and the CommonJS exports from `app.js`. Its schema-10 fixture covers all seven record models, including regional census facts, Table A specimens, and dealer offers. Mutations reject model widening, malformed dealer facts, invalid locations, and unresolved identity claims. The real release includes one designation-bearing specimen with a source-omitted mass: Appley Bridge `199.1` remains `weight.grams: null`.

The standalone runtime harness has 119 passing tests, and the complete Node suite has 136 passing tests. The suites cover schema-10 and schema-4 mutations, all-record presentation, exact display totals, Brown/Minnesota weighted-only behavior, Foote dealer semantics, all 22 Wave 1 lineage routes, search, statistics, privacy, responsive layout, accessibility, issue intake, Hamburg behavior, and the full folio fail-closed matrix.

Explicit ordering regressions preserve Nininger catalog items in numeric order, then literal Huss forms, then catalog-number records in source-page order, with collection entries last in increasing `entryOrder`. The runtime rejects collection entries placed before any existing model group. Catalog-number ties use opaque text, nullable name, and ID after the first cited page; no independent monotonic-number rule is applied. Existing parenthesized Huss search and all Nininger behavior remain covered unchanged. Numeric-leading designation search checks both a specimen's top-level designation and catalog-item holdings, including the `26a` public-link regression. The `record id <public-record-id>` mode performs an exact, case-sensitive record lookup without changing ordinary search behavior.

Runtime schema tests intentionally reject pre-10 metadata and malformed schema-10 models. Presenter coverage sweeps all 19,477 display descriptors and all 12,966 specimen cards, locks the closed harmonized DTO and fact order, verifies exact citations, atomic/repeated mass resolution, and lineage routing, and reconciles weighted-only results to 19,304 descriptors. Static checks cover dealer wording, responsive breakpoints, overflow safety, and cache version `20260902-backlog39-wave1-1`.

Folio authorization tests pass the normalized catalog registry to manifest validation, `getAuthorizedFolio`, and `getAuthorizedFolioPages`. They cover matching public-domain policy, blocked policy, malformed manifests, missing or extra catalogs, out-of-range pages, exact `assets/folios/<catalogId>/<pageId>.webp` paths, and independently valid metadata/manifest policies that disagree and therefore deny display.

The validator reports exactly 2 baseline catalog allows, 302 baseline catalog/leakage rejections, 1 model-aware catalog allow, 1 model-ordering/catalog-scope allow, 125 holding-privacy boundary allows, 47 model/holding rejections, 23 catalog-number rejections, 15 collection-entry/schema-10 rejections, 3 MetBull allows, 7 MetBull rejections, 5 folio allows, 51 folio rejections, 2 folio-file allows, and 17 folio-file rejections.

<!-- release-summary:test-notes-folio-lock:start -->
Real-release checks additionally lock reviewed rights evidence, ordered page IDs, and all 49 asset hashes.
<!-- release-summary:test-notes-folio-lock:end -->

The runtime harness checks synthetic behavior; the Node suites and integrated validators additionally inspect the deployed catalog, projection, lineage, and folio files.

<!-- release-summary:test-notes-real-release:start -->
The default `node scripts/validate-public-catalog.mjs` command validates the real schema-10 `data/catalog.json` and `data/folios.json`: 14,477 records across 40 catalogs with 49 displayable folio pages. Runtime projection checks reconcile 19,477 display descriptors and 173 unknown-mass specimen exclusions.
<!-- release-summary:test-notes-real-release:end -->

Real Hovey metadata is `display/public-domain`; Hovey catalog numbers remain searchable but are excluded from `recordsWithDesignation`, matching the descriptor. `--synthetic-only` checks strict schema-10 fixtures without reading deployed files.
