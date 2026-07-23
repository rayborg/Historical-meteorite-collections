# Multi-catalog test harness

Run from the repository root:

```sh
node scripts/test-multicatalog.cjs
```

The harness uses only Node built-ins and the CommonJS exports from `app.js`. Its schema-version-4 fixture has two `specimen` Huss descriptors, one `catalog-item` Nininger descriptor, and one synthetic `catalog-number` Hovey descriptor. The legacy fixture records remain unchanged. The Hovey records include a cross-page `[149, 150]` citation, a count-22 group with one 212.6 g mass, and a count-2 group with ordered 24.7 g and 11.4 g masses. Hovey folios are blocked/undetermined with no pages.

The 93 named runtime tests retain all former concerns: canonical counts and ordering, privacy and metadata leakage, summary failures, malformed IDs and text, substantive-fact requirements, duplicate-label disambiguation, selector ordering, preparation and catalog-scoped page identity, search boundaries, filtering, URL behavior, statistics, stable sort ties, and the full folio fail-closed matrix. Added catalog-number cases cover exact record/holding/weight shapes, opaque fraction-like and decreasing identifiers, scoped uniqueness, normalized text, provenance privacy, source-reported mass prose without private display fields, positive nullable counts, nonempty ordered finite nonnegative weights, ordered unique descriptor-scoped pages, cross-page statistics, all required search fields, flattened mass filtering/sorting/statistics without count multiplication, reported-group-count display wording, and generic rejection of private labels and OCR batch identifiers.

Explicit ordering regressions preserve Nininger catalog items in numeric order and then literal Huss forms before appending schema-4 catalog-number records in source-page order. Catalog-number ties use opaque text, nullable name, and ID after the first cited page; no independent monotonic-number rule is applied. Existing parenthesized Huss search and all Nininger behavior remain covered unchanged.

Runtime schema tests reject schema 3, schema 2, legacy metadata, model/shape disagreements, invalid identities, holdings, counts, masses, pages, unexpected fields, incorrect summaries, and recursive private leakage. Static UI checks cover the accessible ordered holdings template, `Catalog item N`, `Catalog no. N`, `Unnumbered`, reported group count and all-mass wording, all page citations, removal of top-level multi-holding mass, revised sort wording, and cache version `20260723-1`.

Folio authorization tests pass the normalized catalog registry to manifest validation, `getAuthorizedFolio`, and `getAuthorizedFolioPages`. They cover matching public-domain policy, blocked policy, malformed manifests, missing or extra catalogs, out-of-range pages, and independently valid metadata/manifest policies that disagree and therefore deny display.

The deployment validator preserves its 2 baseline catalog allows, expands baseline catalog/leakage coverage to 57 rejections, and preserves 6 folio allows and 71 folio rejections. It also preserves 1 model-aware allow, 1 model-ordering/catalog-scope allow, 1 holding-privacy boundary allow, and all 38 legacy model/holding rejections. Schema 4 adds a separate 23-case catalog-number/schema rejection group without replacing old coverage.

The runtime harness does not import `data/catalog.json`, so run the integrated validator separately. The default `node scripts/validate-public-catalog.mjs` command reads and passes the local schema-4 `data/catalog.json` and `data/folios.json`; Hovey catalog numbers remain searchable but are excluded from `recordsWithDesignation`, matching the exporter and descriptor. `--synthetic-only` checks the strict schema-4 fixtures without reading those real local files and also passes. The live deployment remains schema 3, the local data has not been deployed, and this note makes no deployment claim.
