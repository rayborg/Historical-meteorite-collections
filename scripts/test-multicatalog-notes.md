# Multi-catalog test harness

Run from the repository root:

```sh
node scripts/test-multicatalog.cjs
```

The harness uses only Node built-ins and the CommonJS exports from `app.js`. Its schema-version-3 fixture has two `specimen` Huss descriptors and one `catalog-item` Nininger descriptor. It covers normal and multi-holding items, cast, count-only, aggregate, and unnumbered holdings. Exact specimen, catalog-item, holding, metadata, and descriptor shapes are asserted, including `recordModel`.

The 84 named runtime tests retain the former 40-test concerns individually: canonical counts and ordering, specimen privacy and metadata leakage, global and per-catalog count failures, malformed IDs and public text, substantive-fact requirements, duplicate-label disambiguation, chronological selector ordering and ties, preparation and catalog-scoped page identity, H-designation parsing and all search boundary cases, catalog filtering, URL round trips and invalid ranges, catalog-scoped page statistics, stable sort ties, and the full folio fail-closed matrix. Added cases cover every invalid holding-kind combination, scoped item uniqueness, decreasing numbers, intentional gaps, independent catalog numbering, exact numeric-leading holding-code search without superstring leakage, strict holding-field privacy with factual boundary allows, runtime/deployment ordering parity, and single-result grid behavior.

Explicit ordering and search regressions prove Nininger catalog items deploy first in numeric order, literal exporter ordering places `(2)H399.1` and `(2)H400` before `H27.3` and `H42`, and parenthesized forms still use semantic H-designation search. All Huss forms remain scalar specimen designations with scalar masses. Nininger tests cover exact numeric catalog-item search, every rendered holding designation, description, cast/aggregate kind, and labeled count, source-order holding preparation, any-holding range matching, minimum/maximum holding-mass sorting, numeric catalog-item sorting, and mass statistics that retain parent observation counts.

Runtime schema tests reject schema 2, model/shape disagreements, invalid catalog-item numbers, invalid holding kinds/counts/masses, empty holdings, unexpected fields, incorrect summaries, and recursive private leakage in holding fields. Static UI checks cover the accessible ordered holdings template, `Catalog item N`, `Unnumbered`, source-order iteration, removal of top-level catalog-item mass, revised sort wording, and cache version.

Folio authorization tests pass the normalized catalog registry to manifest validation, `getAuthorizedFolio`, and `getAuthorizedFolioPages`. They cover matching public-domain policy, blocked policy, malformed manifests, missing or extra catalogs, out-of-range pages, and independently valid metadata/manifest policies that disagree and therefore deny display.

The deployment validator preserves its 2 baseline catalog allows, 55 baseline catalog/leakage rejections, 6 folio allows, and 71 folio rejections. Schema 3 adds 1 model-aware catalog allow, 1 model-ordering/catalog-scope allow, 1 holding-privacy boundary allow, and 38 model/holding rejections without replacing those baseline fixtures. The ordering allow also proves catalog-item ties use nullable name then ID rather than holding mass.

The runtime harness does not import `data/catalog.json`, so run the integrated deployment validator separately. Use `node scripts/validate-public-catalog.mjs --synthetic-only` for schema/privacy fixtures alone; the default command also verifies the current `data/catalog.json` and `data/folios.json`.
