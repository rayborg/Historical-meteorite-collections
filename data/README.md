# Public Catalog Data

<!-- release-summary:data-overview:start -->
`catalog.json` is a schema-6 facts-only dataset containing 3,565 source observations from 8 historical meteorite catalogs. `folios.json` is a separate schema-2, deny-by-default display manifest with 41 reviewed page entries.
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
| `nininger-1933` | `catalog-item` | 136 | 18 | 9 |
| `nininger-1950` | `specimen` | 1,653 | 78 | 78 |
| **Total** |  | **3,565** | **226** | **209** |
<!-- release-summary:data-catalog-table:end -->

Metadata source-page coverage is not a count of pages cited by records. Some covered pages are introductory or narrative-only.

Chladni 1825 pages 200-207 are introductory folios. For `nininger-1933`, printed pages 8-9 and catalog items 106-141 are missing from the available source set, and pages 12-20 are narrative-only.

<!-- release-summary:data-nininger-coverage:start -->
`nininger-1933` has 136 records; its metadata source pages span 1-20, and its record citations span 1-11. `nininger-1950` has 1,653 records; its metadata source pages span 26-103, and its record citations span 26-103.
<!-- release-summary:data-nininger-coverage:end -->

Both Nininger catalogs are partial digital editions. These ranges summarize current metadata and citations without asserting page-boundary continuity.

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
| `nininger-1933` | display | no-copyright-us | 19 |
| `nininger-1950` | blocked | undetermined | 0 |
| **Total** |  |  | **41** |
<!-- release-summary:data-folio-table:end -->

Hovey pages come from [BHL item 335869](https://www.biodiversitylibrary.org/item/335869), contributed by Smithsonian Libraries and Archives and marked public domain. Nininger display follows a documented United States renewal search for the exact 1933 offprint. Rights status is copy- and jurisdiction-specific and is never inferred from age.

## Validation

Run from the repository root:

```sh
node scripts/sync-release-summary.mjs --check
node --test scripts/sync-release-summary.test.mjs
node scripts/validate-public-catalog.mjs
node scripts/test-multicatalog.cjs
```

Use `node scripts/validate-public-catalog.mjs --synthetic-only` to run the strict schema and rejection fixtures without reading the real catalog, manifest, or folio files.
