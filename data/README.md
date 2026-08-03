# Public Catalog Data

<!-- release-summary:data-overview:start -->
`catalog.json` is a schema-6 facts-only dataset containing 9,120 source observations from 21 historical meteorite catalogs. `folios.json` is a separate schema-2, deny-by-default display manifest with 49 reviewed page entries.
<!-- release-summary:data-overview:end -->

A searchable transcription of the 1976 Huss Meteorite Collection catalog, compiled and published by Glenn Huss.

The other configured descriptors identify their compilers without inferring a publisher: Jean Andre Henri Lucas for 1813; E. F. F. Chladni, with a Vienna appendix by Karl von Schreibers, for 1819; E. F. F. Chladni for 1825; Wilhelm Haidinger for 1859; Otto Buchner for 1863; A. E. Nordenskiöld for 1870; Valentine Ball for 1882; F. W. Clarke for 1886; Edmund Otis Hovey for 1896; Henry S. Washington for 1897; Wirt Tassin for 1902; A. G. Högbom for 1902; Oliver Cummings Farrington for 1903; R. Schreiter for 1912; H. H. Nininger for 1933; Virgil E. Barnes for 1940; H. H. Nininger and Addie D. Nininger for 1950; Brian Mason for 1964; Glenn I. Huss for 1986; and the Buseck Center for Meteorite Studies, Arizona State University, for the September 2024 ASU dataset.

<!-- release-summary:data-catalog-table:start -->
| `catalogId` | Record model | Records | Metadata source pages | Pages cited by records |
| --- | --- | ---: | ---: | ---: |
| `asu-2024-09` | `specimen` | 2,169 | 53 | 53 |
| `ball-1882` | `collection-entry` | 44 | 4 | 2 |
| `barnes-1940` | `collection-entry` | 70 | 30 | 16 |
| `buchner-1863` | `collection-entry` | 185 | 5 | 5 |
| `chladni-1819` | `collection-entry` | 74 | 12 | 12 |
| `chladni-1825` | `collection-entry` | 42 | 41 | 33 |
| `farrington-1903` | `collection-entry` | 251 | 38 | 38 |
| `haidinger-1859` | `collection-entry` | 137 | 6 | 5 |
| `hogbom-1902` | `collection-entry` | 86 | 3 | 2 |
| `hovey-1896` | `catalog-number` | 25 | 7 | 7 |
| `huss-1976` | `specimen` | 1,078 | 46 | 46 |
| `huss-1986` | `specimen` | 544 | 21 | 21 |
| `lucas-1813` | `collection-entry` | 13 | 3 | 3 |
| `mason-1964` | `catalog-number` | 1,374 | 40 | 33 |
| `nininger-1933` | `catalog-item` | 171 | 20 | 11 |
| `nininger-1950` | `specimen` | 1,678 | 79 | 79 |
| `nordenskiold-1870` | `collection-entry` | 127 | 10 | 10 |
| `schreiter-1912` | `collection-entry` | 162 | 18 | 8 |
| `tassin-1902` | `collection-entry` | 340 | 26 | 24 |
| `usnm-1886` | `collection-entry` | 349 | 11 | 11 |
| `washington-1897` | `collection-entry` | 201 | 4 | 4 |
| **Total** |  | **9,120** | **477** | **423** |
<!-- release-summary:data-catalog-table:end -->

Metadata source-page coverage is not a count of pages cited by records. Some covered pages are introductory or narrative-only.

Chladni 1825 pages 200-207 are introductory folios. `haidinger-1859` page 21 introduces the holdings list, whose entries begin on page 22. `buchner-1863` covers the Vienna register on Roman pages XIII-XVII, from Alais through Hemalga. `tassin-1902` metadata includes plate page 671 and introductory page 673; its 340 entries cite pages 675-698. `schreiter-1912` metadata spans pages 58-75; its 162 entries cite pages 66-73. `barnes-1940` spans pages 583-612 and contributes 70 facts-only collection entries, including 48 reviewed exact-name MetBull mappings and 22 pending observations without canonical identity. `mason-1964` metadata spans pages 1-40; its 1,374 entries cite 33 of those pages. `asu-2024-09` contributes 2,169 facts-only records citing all 53 dataset pages, with 2,166 unique designations and only `91`, `157`, and `607` duplicated. `nininger-1933` includes printed pages 1-20; pages 12-20 are narrative-only, and the printed catalog numbering skips item 139.

<!-- release-summary:data-nininger-coverage:start -->
`nininger-1933` has 171 records; its metadata source pages span 1-20, and its record citations span 1-11. `nininger-1950` has 1,678 records; its metadata source pages span 26-104, and its record citations span 26-104.
<!-- release-summary:data-nininger-coverage:end -->

`nininger-1933` covers printed pages 1-20, and the reviewed `nininger-1950` collection-catalog range covers printed pages 26-104 through its terminal entry. These ranges summarize current metadata and citations without merging source observations.

`bibliography-master-list.html` is the public browser view of the canonical bibliography controls. Its single `Historical source mentions` column lists every applicable Buchner 1863, Wülfing 1897, and Spencer 1949 locator as compact labeled lines in that order. A blank means no qualifying direct mention was established.

## Catalog Contract

The root contains exactly `metadata` and `records`. `metadata.schemaVersion` is 6 and each catalog descriptor declares one of four `recordModel` values.

### Specimen

Used by ASU September 2024, both Huss catalogs, and Nininger 1950:

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

Used by Hovey and Mason:

```text
id, catalogId, catalogNumber, holdings, name, classification, locality,
dateOfDiscovery, catalogPages, confidence
```

Each holding has exactly `description`, `provenance`, `count`, and `weights`; each weight is `{ grams }`. Catalog numbers are unique opaque strings, not arithmetic fractions. `catalogPages` is nonempty, ordered, unique, and descriptor-scoped.

### Collection Entry

Used by Lucas, both Chladni catalogs, Haidinger, Buchner, Nordenskiöld, Ball, Clarke, Washington, Tassin, Högbom, Farrington, Schreiter, and Barnes:

```text
id, catalogId, entryOrder, reportedNumber, catalogPages, section,
holdings, name, classification, locality, eventDate, confidence
```

Each holding has exactly `description`, `provenance`, `count`, and `weights`; numeric weights are `{ grams }`. The array may be empty when a historical or ambiguous mass has no supported numeric conversion; independently structured factual description prose may still retain the source-reported mass statement. `entryOrder` preserves source order. `reportedNumber` is nullable opaque text and need not be unique.

Strings are NFC-normalized and whitespace-collapsed. Numeric grams are finite and nonnegative. Confidence is `high`, `medium`, or `low`. Model-specific ordering is deterministic. Statistics count parent records as observations, flatten nested masses, and never multiply a reported mass by holding count.

Every model permits an optional reviewed `metbull` object with exactly `matchType`, `canonicalName`, `meteoriteCode`, `metbullUrl`, and `alternateNameNote`. Resolved mappings require a canonical name, positive decimal code string, and exact `https://www.lpi.usra.edu/meteor/metbull.cfm?code=<code>` URL. Unresolved mappings cannot claim any canonical identity. This additive layer does not alter source names, catalog identifiers, holdings, or weights and is never populated by fuzzy matching.

The current release contains 7,874 reviewed mappings: 7,745 resolved and 129 unresolved. The remaining 1,246 records are pending observations without reviewed mappings.

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

Raw OCR, private notes, source filenames, private record page IDs, dedicated display-weight and `weightText` fields, uncertainty fields, acquisition metadata, and private paths are excluded from `catalog.json`. Barnes source material, OCR, notes, and assets remain private, with zero public Barnes folios. Independently structured factual description prose may retain source-reported historical mass statements. Reviewed `pageId` values are intentionally public in `folios.json`.

## Specimen Lineages

`specimen-lineages.json` is a generated public relationship layer. Schema version 2 explicitly distinguishes `same-inventory` relationships from `possible-match` relationships. `specimen-lineages.schema.json` is its machine-readable JSON Schema 2020-12 contract, while the dependency-free custom validator is authoritative for exact keys, cross-field coherence, source derivation, namespace separation, ambiguity handling, and canonical ordering. Every displayed observation is derived from `catalog.json`; source designations, names, masses, and other source facts remain unchanged.

The collection-series registry currently defines two ordered edition series: Huss (`huss-1976`, `huss-1986`) and Nininger (`nininger-1933`, `nininger-1950`). Registry membership is separate from source observations, so future edition series can be added without rewriting historical catalog records. Within consecutive catalogs of one series, `same-inventory` continuity requires equal canonical inventory IDs. Canonicalization applies NFKC, lowercases, removes all whitespace, and, for Huss only, removes one leading `(2)` edition marker. Printed designations remain exact in `catalog.json` and relationship observations. Inventory continuity does not require matching or available mass.

Collection series are separate namespaces. Equal IDs in Huss and Nininger do not create continuity. If either edition reuses one normalized key for multiple endpoints, the generator emits a relationship only when exactly one endpoint pair is identity-consistent; otherwise it omits the ambiguous key deterministically. This resolves the Nininger `108b` collision from 1933 Sandia only to 1950 Sandia Mountains, not Rosebud. Same-inventory relationships establish collection inventory continuity but do not infer custody chain or ownership transfer.

Across different collection namespaces, `possible-match` retains the reviewed identity-plus-mass method. Endpoints must share a reviewed MetBull code or, only when both are unresolved, the same normalized source name. Source-name normalization applies NFKD, removes diacritics, lowercases, replaces non-alphanumeric runs with spaces, and trims. Exact masses have zero difference. Non-exact near masses require a minimum endpoint mass of 10 g, relative difference at most 0.0025, and absolute difference at most 2 g. These candidates remain `possible` and do not prove physical identity, custody, or ownership.

`specimen-lineage-reviews.json` is the formal public review source for possible matches only, and `specimen-lineage-reviews.schema.json` is its machine-readable contract. Each review is keyed by a stable `possible-lineage-...` ID. Outcomes are limited to `retain-as-possible` and `not-supported`; unlisted possible matches remain unreviewed. Same-inventory relationships do not use candidate reviews.

The generator flattens every numeric mass without multiplying by holding count. Scalar specimen masses use `weight.grams`; catalog-item masses use `holdings[i].weight.grams`; catalog-number and collection-entry masses use `holdings[i].weights[j].grams`. Inventory observations additionally retain the exact `designationPath`, including observations whose source mass is null. Every generated observation and runtime card link uses the project-relative `record id <recordId>` query, so duplicate source labels or designations still resolve to exactly one public record.

The current public input produces 8,179 flattened mass observations and 3,627 inventory observations. It publishes 464 relationships: 195 same-inventory relationships and 269 possible cross-source matches. The same-inventory total comprises 2 Huss and 193 Nininger relationships; one duplicated key is identity-resolved and none are omitted as ambiguous. The 269 possible matches include 218 exact-mass and 51 near-mass candidates, all currently unreviewed and based on reviewed MetBull identity. Barnes 1940 participates in 42 possible matches and ASU September 2024 participates in 8; neither is a registered edition series.

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
| `asu-2024-09` | blocked | undetermined | 0 |
| `ball-1882` | blocked | undetermined | 0 |
| `barnes-1940` | blocked | undetermined | 0 |
| `buchner-1863` | blocked | undetermined | 0 |
| `chladni-1819` | display | public-domain | 12 |
| `chladni-1825` | blocked | undetermined | 0 |
| `farrington-1903` | blocked | undetermined | 0 |
| `haidinger-1859` | display | public-domain | 6 |
| `hogbom-1902` | blocked | undetermined | 0 |
| `hovey-1896` | display | public-domain | 7 |
| `huss-1976` | blocked | undetermined | 0 |
| `huss-1986` | blocked | undetermined | 0 |
| `lucas-1813` | display | public-domain | 3 |
| `mason-1964` | blocked | undetermined | 0 |
| `nininger-1933` | display | no-copyright-us | 21 |
| `nininger-1950` | blocked | undetermined | 0 |
| `nordenskiold-1870` | blocked | undetermined | 0 |
| `schreiter-1912` | blocked | undetermined | 0 |
| `tassin-1902` | blocked | undetermined | 0 |
| `usnm-1886` | blocked | undetermined | 0 |
| `washington-1897` | blocked | undetermined | 0 |
| **Total** |  |  | **49** |
<!-- release-summary:data-folio-table:end -->

Haidinger pages come from [Internet Archive item sitzungsberichte34kais](https://archive.org/details/sitzungsberichte34kais), whose metadata states `NOT_IN_COPYRIGHT`. Hovey pages come from [BHL item 335869](https://www.biodiversitylibrary.org/item/335869), contributed by Smithsonian Libraries and Archives and marked public domain. Nininger display follows a documented United States renewal search for the exact 1933 offprint. Rights status is copy- and jurisdiction-specific and is never inferred from age.

## Validation

Run from the repository root:

```sh
node scripts/sync-release-summary.mjs --check
node scripts/build-specimen-lineages.mjs --check
node scripts/validate-specimen-lineages.mjs
node scripts/validate-public-catalog.mjs
node scripts/test-multicatalog.cjs
node --test scripts/*.test.mjs
```

Use `node scripts/validate-public-catalog.mjs --synthetic-only` to run the strict schema and rejection fixtures without reading the real catalog, manifest, or folio files.
