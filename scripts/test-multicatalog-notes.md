# Multi-catalog test harness

Run from the repository root:

```sh
node scripts/test-multicatalog.cjs
```

The harness uses only Node built-ins and the CommonJS exports from `app.js`. Its synthetic fixture has one canonical schema-version-2 metadata object with `scope`, `factualFields`, a three-entry `catalogs` array, and global record counts. Every catalog descriptor has exactly `id`, `label`, `compiler`, `year`, `sourcePages`, `sourcePageCount`, per-catalog counts, `folioDisplayPolicy`, and `rightsStatus`. Records follow the deterministic deployment order: structural designation, name, numeric weight, and ID, with null designations last. The complete expected ID sequence is asserted.

H-designation tests preserve segment-prefix behavior: `H27` matches `H27` and descendants such as `H27.1`, but not `H270` or `H2.7`. Compound `H27 stone` coverage gives both `H27` and `H270` records the remaining term so only designation-aware matching can exclude the lookalike. Bare class-like queries such as `L6` and `H5` also retain exact-token factual-text matches. Catalog filtering is tested directly through exported `filterRecords`, including isolation of equal page numbers in different catalogs. Selector tests order catalogs by publication year with deterministic label/ID ties without changing source-summary or data order.

`parseUrlFilters` and `serializeUrlFilters` are exercised directly for valid round trips, defaults, malformed weights and sorts, crossed ranges, unknown catalogs, and catalog IDs whose descriptors intentionally share a label. Runtime schema tests reject metadata leakage, malformed and empty catalog IDs, empty record IDs, records without substantive public facts, overlong descriptor text, control characters, incorrect counts, and private fields. Catalog registry normalization, duplicate-label display disambiguation, catalog-aware page statistics, record preparation, sorting, search, and folio authorization remain covered through exports.

Folio authorization tests pass the normalized catalog registry to manifest validation, `getAuthorizedFolio`, and `getAuthorizedFolioPages`. They cover matching public-domain policy, blocked policy, malformed manifests, missing or extra catalogs, out-of-range pages, and independently valid metadata/manifest policies that disagree and therefore deny display.

The runner does not copy browser URL logic or authorization logic and does not modify `app.js`.
