# Public Catalog Data

<!-- release-summary:data-overview:start -->
`catalog.json` is a schema-6 facts-only dataset containing 3,625 source observations from 8 historical meteorite catalogs. `folios.json` is a separate schema-2, deny-by-default display manifest with 43 reviewed page entries.
<!-- release-summary:data-overview:end -->

A searchable transcription of the 1976 Huss Meteorite Collection catalog, compiled and published by Glenn Huss.

The other configured descriptors identify their compilers without inferring a publisher: Jean Andre Henri Lucas for 1813; E. F. F. Chladni, with a Vienna appendix by Karl von Schreibers, for 1819; E. F. F. Chladni for 1825; Edmund Otis Hovey for 1896; H. H. Nininger for 1933; H. H. Nininger and Addie D. Nininger for 1950; and Glenn I. Huss for 1986.

<!-- release-summary:data-catalog-table:start -->
| `catalogId` | Record model | Records | Metadata source pages | Pages cited by records |
| --- | --- | ---: | ---: | ---: |
| `chladni-1819` | `collection-entry` | 74 | 12 | 12 |
| `chladni-1825` | `collection-entry` | 42 | 41 | 33 |
| `hovey-1896` | `catalog-number` | 25 | 7 | 7 |
| `huss-1976` | `specimen` | 1,078 | 46 | 46 |
| `huss-1986` | `specimen` | 544 | 21 | 21 |
| `lucas-1813` | `collection-entry` | 13 | 3 | 3 |
| `nininger-1933` | `catalog-item` | 171 | 20 | 11 |
| `nininger-1950` | `specimen` | 1,678 | 79 | 79 |
| **Total** |  | **3,625** | **229** | **212** |
<!-- release-summary:data-catalog-table:end -->

Metadata source-page coverage is not a count of pages cited by records. Some covered pages are introductory or narrative-only.

Chladni 1825 pages 200-207 are introductory folios. `nininger-1933` includes printed pages 1-20; pages 12-20 are narrative-only, and the printed catalog numbering skips item 139.

<!-- release-summary:data-nininger-coverage:start -->
`nininger-1933` has 171 records; its metadata source pages span 1-20, and its record citations span 1-11. `nininger-1950` has 1,678 records; its metadata source pages span 26-104, and its record citations span 26-104.
<!-- release-summary:data-nininger-coverage:end -->

`nininger-1933` covers printed pages 1-20, and the reviewed `nininger-1950` collection-catalog range covers printed pages 26-104 through its terminal entry. These ranges summarize current metadata and citations without merging source observations.

## Catalog Contract

The root contains exactly `metadata` and `records`. `metadata.schemaVersion` is 6 and each catalog descriptor declares one of four `recordModel` values.

### Specimen

Used by both Huss catalogs and Nininger 1950:

```text
id, catalogId, designation, name, weight: { grams }, classification,
locality, year, catalogPage, confidence
```

### Catalog Item

Used by Nininger:

```text
id, catalogId, catalogItem, holdings, name, classification, locality,
year, catalogPage, confidence
```

Each holding has exactly `designation`, `kind`, `description`, `count`, and `weight: { grams }`. `kind` is `specimen`, `cast`, or `aggregate`. Catalog-item numbers are positive, unique, and increasing within their catalog; gaps are retained.

### Catalog Number

Used by Hovey:

```text
id, catalogId, catalogNumber, holdings, name, classification, locality,
dateOfDiscovery, catalogPages, confidence
```

Each holding has exactly `description`, `provenance`, `count`, and `weights`; each weight is `{ grams }`. Catalog numbers are unique opaque strings, not arithmetic fractions. `catalogPages` is nonempty, ordered, unique, and descriptor-scoped.

### Collection Entry

Used by Lucas and both Chladni catalogs:

```text
id, catalogId, entryOrder, reportedNumber, catalogPages, section,
holdings, name, classification, locality, eventDate, confidence
```

Each holding has exactly `description`, `provenance`, `count`, and `weights`; numeric weights are `{ grams }`. The array may be empty when a historical or ambiguous mass has no supported numeric conversion; independently structured factual description prose may still retain the source-reported mass statement. `entryOrder` preserves source order. `reportedNumber` is nullable opaque text and need not be unique.

Strings are NFC-normalized and whitespace-collapsed. Numeric grams are finite and nonnegative. Confidence is `high`, `medium`, or `low`. Model-specific ordering is deterministic. Statistics count parent records as observations, flatten nested masses, and never multiply a reported mass by holding count.

Every model permits an optional reviewed `metbull` object with exactly `matchType`, `canonicalName`, `meteoriteCode`, `metbullUrl`, and `alternateNameNote`. Resolved mappings require a canonical name, positive decimal code string, and exact `https://www.lpi.usra.edu/meteor/metbull.cfm?code=<code>` URL. Unresolved mappings cannot claim any canonical identity. This additive layer does not alter source names, catalog identifiers, holdings, or weights and is never populated by fuzzy matching.

Validated continuation evidence recovers formerly blank source names only where supported. Reviewed historical entries that genuinely print no separate proper source name retain null names and unresolved reviews without an inferred modern identity.

The canonical `metadata.factualFields` union is:

```text
id
catalogId
designation
name
weight.grams
catalogItem
catalogNumber
entryOrder
reportedNumber
holdings[].designation
holdings[].kind
holdings[].description
holdings[].provenance
holdings[].count
holdings[].weight.grams
holdings[].weights[].grams
classification
locality
year
dateOfDiscovery
eventDate
catalogPage
catalogPages[]
section
confidence
metbull.matchType
metbull.canonicalName
metbull.meteoriteCode
metbull.metbullUrl
metbull.alternateNameNote
```

Raw OCR, private notes, source filenames, private record page IDs, dedicated display-weight and `weightText` fields, uncertainty fields, acquisition metadata, and private paths are excluded from `catalog.json`. Independently structured factual description prose may retain source-reported historical mass statements. Reviewed `pageId` values are intentionally public in `folios.json`.

## Specimen Lineages

`specimen-lineages.json` is a generated public relationship layer. Schema version 2 explicitly distinguishes `same-inventory` relationships from `possible-match` relationships. `specimen-lineages.schema.json` is its machine-readable JSON Schema 2020-12 contract, while the dependency-free custom validator is authoritative for exact keys, cross-field coherence, source derivation, namespace separation, ambiguity handling, and canonical ordering. Every displayed observation is derived from `catalog.json`; source designations, names, masses, and other source facts remain unchanged.

The collection-series registry currently defines two ordered edition series: Huss (`huss-1976`, `huss-1986`) and Nininger (`nininger-1933`, `nininger-1950`). Registry membership is separate from source observations, so future edition series can be added without rewriting historical catalog records. Within consecutive catalogs of one series, `same-inventory` continuity requires equal canonical inventory IDs. Canonicalization applies NFKC, lowercases, removes all whitespace, and, for Huss only, removes one leading `(2)` edition marker. Printed designations remain exact in `catalog.json` and relationship observations. Inventory continuity does not require matching or available mass.

Collection series are separate namespaces. Equal IDs in Huss and Nininger do not create continuity. If either edition reuses one normalized key for multiple endpoints, the generator emits a relationship only when exactly one endpoint pair is identity-consistent; otherwise it omits the ambiguous key deterministically. This resolves the Nininger `108b` collision from 1933 Sandia only to 1950 Sandia Mountains, not Rosebud. Same-inventory relationships establish collection inventory continuity but do not infer custody chain or ownership transfer.

Across different collection namespaces, `possible-match` retains the reviewed identity-plus-mass method. Endpoints must share a reviewed MetBull code or, only when both are unresolved, the same normalized source name. Source-name normalization applies NFKD, removes diacritics, lowercases, replaces non-alphanumeric runs with spaces, and trims. Exact masses have zero difference. Non-exact near masses require a minimum endpoint mass of 10 g, relative difference at most 0.0025, and absolute difference at most 2 g. These candidates remain `possible` and do not prove physical identity, custody, or ownership.

`specimen-lineage-reviews.json` is the formal public review source for possible matches only, and `specimen-lineage-reviews.schema.json` is its machine-readable contract. Each review is keyed by a stable `possible-lineage-...` ID. Outcomes are limited to `retain-as-possible` and `not-supported`; unlisted possible matches remain unreviewed. Same-inventory relationships do not use candidate reviews.

The generator flattens every numeric mass without multiplying by holding count. Scalar specimen masses use `weight.grams`; catalog-item masses use `holdings[i].weight.grams`; catalog-number and collection-entry masses use `holdings[i].weights[j].grams`. Inventory observations additionally retain the exact `designationPath`, including observations whose source mass is null. Every generated observation and runtime card link uses the project-relative `record id <recordId>` query, so duplicate source labels or designations still resolve to exactly one public record.

The current public input produces 3,636 flattened mass observations and 3,627 inventory observations. It publishes 240 relationships: 195 same-inventory relationships and 45 possible cross-source matches. The same-inventory total comprises 2 Huss and 193 Nininger relationships; one duplicated key is identity-resolved and none are omitted as ambiguous. The 45 possible matches include 18 exact-mass and 27 near-mass candidates, all currently unreviewed and based on reviewed MetBull identity.

Relationship and observation IDs are UUIDv5 values under the fixed namespace `65b19e0b-1f86-5ca5-a65b-81c38ec53040`. They use only public record IDs, exact designation or mass paths, series IDs, and normalized inventory IDs as applicable, not names, masses, evidence, review state, score, or output order. The browser validator independently reconstructs the complete inventory and possible-match endpoint sets and rederives every relationship and observation UUID before displaying this optional enhancement. Regenerate with `node scripts/build-specimen-lineages.mjs`; use `--check` to detect byte drift. Validate independently with `node scripts/validate-specimen-lineages.mjs`.

## Folio Manifest

`folios.json` has schema version 2. Every catalog has exactly `displayPolicy`, `rightsStatus`, and `pages`. A blocked catalog has `rightsStatus: "undetermined"` and `pages: []`. A displayed catalog must have reviewed `public-domain` or `no-copyright-us` status and an ordered page array exactly matching its approved source set.

Each displayed page has exactly:

```text
pageId, catalogPage, pageLabel, image, alt
```

`catalogPage` may be null for unnumbered front matter. `image` must be a plain `.webp` path rooted beneath `assets/folios/<catalogId>/` and named by `pageId`. The validator rejects unsafe paths, malformed text, missing or extra pages, cross-catalog references, policy disagreements, symlinks, and extra files.

The deployment-specific `scripts/folio-release-lock.json` pins every catalog policy, rights-evidence basis and URL, ordered page ID, and SHA-256 asset digest. Changing a reviewed policy, page set, or binary therefore requires an explicit lock update as well as a valid manifest.

<!-- release-summary:data-folio-table:start -->
| `catalogId` | Display policy | Rights status | Pages |
| --- | --- | --- | ---: |
| `chladni-1819` | display | public-domain | 12 |
| `chladni-1825` | blocked | undetermined | 0 |
| `hovey-1896` | display | public-domain | 7 |
| `huss-1976` | blocked | undetermined | 0 |
| `huss-1986` | blocked | undetermined | 0 |
| `lucas-1813` | display | public-domain | 3 |
| `nininger-1933` | display | no-copyright-us | 21 |
| `nininger-1950` | blocked | undetermined | 0 |
| **Total** |  |  | **43** |
<!-- release-summary:data-folio-table:end -->

Hovey pages come from [BHL item 335869](https://www.biodiversitylibrary.org/item/335869), contributed by Smithsonian Libraries and Archives and marked public domain. Nininger display follows a documented United States renewal search for the exact 1933 offprint. Rights status is copy- and jurisdiction-specific and is never inferred from age.

## Validation

Run from the repository root:

```sh
node scripts/sync-release-summary.mjs --check
node --test scripts/sync-release-summary.test.mjs
node scripts/build-specimen-lineages.mjs --check
node scripts/validate-specimen-lineages.mjs
node --test scripts/specimen-lineages.test.mjs
node scripts/validate-public-catalog.mjs
node scripts/test-multicatalog.cjs
```

Use `node scripts/validate-public-catalog.mjs --synthetic-only` to run the strict schema and rejection fixtures without reading the real catalog, manifest, or folio files.
