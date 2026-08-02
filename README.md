# Historical Meteorite Collection

<!-- release-summary:readme-overview:start -->
This repository is a dependency-free, facts-only index of 6,881 source observations from 19 historical meteorite catalogs. The coordinated catalog uses public metadata schema 6 and supports 4 source-specific record models: `catalog-item`, `catalog-number`, `collection-entry`, `specimen`.
<!-- release-summary:readme-overview:end -->

The repository also publishes [`data/specimen-lineages.json`](./data/specimen-lineages.json), a deterministic index that distinguishes same collection inventory IDs across consecutive editions from possible matches across separate collection sources. Same-inventory continuity is series-scoped and does not infer custody or ownership. Cross-source candidates retain public review decisions from [`data/specimen-lineage-reviews.json`](./data/specimen-lineage-reviews.json) and do not assert physical identity, custody, or ownership transfer.

A searchable transcription of the 1976 Huss Meteorite Collection catalog, compiled and published by Glenn Huss.

The other configured sources identify their compilers without inferring a publisher: Jean Andre Henri Lucas for 1813; E. F. F. Chladni, with a Vienna appendix by Karl von Schreibers, for 1819; E. F. F. Chladni for 1825; Wilhelm Haidinger for 1859; Otto Buchner for 1863; A. E. Nordenskiöld for 1870; Valentine Ball for 1882; F. W. Clarke for 1886; Edmund Otis Hovey for 1896; Henry S. Washington for 1897; Wirt Tassin for 1902; A. G. Högbom for 1902; Oliver Cummings Farrington for 1903; R. Schreiter for 1912; H. H. Nininger for 1933; H. H. Nininger and Addie D. Nininger for 1950; Brian Mason for 1964; and Glenn I. Huss for 1986.

The site supports catalog filtering, model-aware search, segment-aware H-designation search, numeric gram ranges across scalar and nested masses, six deterministic sort orders, URL-persisted filters, incremental rendering, and rights-gated source folios. Catalog facts and folio authorization are validated separately.

## Local Preview

The site uses `fetch`, so serve the repository through a local HTTP server:

```sh
python3 -m http.server 8000
```

Visit `http://localhost:8000/`. No installation or application build is required.

Validate the complete public package with:

```sh
node scripts/sync-release-summary.mjs --check
node scripts/build-specimen-lineages.mjs --check
node scripts/validate-specimen-lineages.mjs
node scripts/validate-public-catalog.mjs
node scripts/test-multicatalog.cjs
node --test scripts/*.test.mjs
```

The validator checks both synthetic rejection fixtures and the real catalog, manifest, and folio files. The runtime harness contains 110 tests.

After changing either public data file, run `node scripts/sync-release-summary.mjs --write`; use `--json` to inspect the derived release summary without changing documentation.

## GitHub Pages

1. Run all validation commands above.
2. Push the repository to GitHub; the same checks run in `.github/workflows/validate.yml`.
3. Open **Settings > Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the publishing branch, normally `main`, and the root (`/`) folder.

All runtime URLs are relative, so the site works at a GitHub Pages project subpath without configuration.

## Public Data Scope

The browser loads factual records only from `./data/catalog.json`. The schema-6 root contract is `{ metadata, records }`. Every descriptor declares one of the four record models below.

A `specimen` record contains exactly:

```text
id, catalogId, designation, name, weight: { grams }, classification,
locality, year, catalogPage, confidence
```

A `catalog-item` record contains exactly:

```text
id, catalogId, catalogItem, holdings, name, classification, locality,
year, catalogPage, confidence
```

Its holdings contain exactly `designation`, `kind`, `description`, `count`, and `weight: { grams }`. `kind` is `specimen`, `cast`, or `aggregate`. Counts remain reported source facts and are never used to infer a physical-specimen total.

A `catalog-number` record contains exactly:

```text
id, catalogId, catalogNumber, holdings, name, classification, locality,
dateOfDiscovery, catalogPages, confidence
```

Its holdings contain exactly `description`, `provenance`, `count`, and `weights`; each weight contains exactly `{ grams }`. Catalog numbers are opaque source identifiers, including fraction-like strings, rather than arithmetic values. `catalogPages` is a nonempty ordered array because a printed entry may continue across pages.

A `collection-entry` record contains exactly:

```text
id, catalogId, entryOrder, reportedNumber, catalogPages, section,
holdings, name, classification, locality, eventDate, confidence
```

Its holdings contain exactly `description`, `provenance`, `count`, and `weights`; numeric weights contain exactly `{ grams }`. The weights array may be empty when a historical or ambiguous mass has no supported numeric conversion; independently structured factual description prose may still retain the source-reported mass statement. `entryOrder` preserves source order. `reportedNumber` may be null or repeated because the source may omit, restart, or duplicate printed numbering.

The current catalog contains:

<!-- release-summary:readme-catalog-table:start -->
| `catalogId` | Record model | Records | Metadata source pages | Pages cited by records |
| --- | --- | ---: | ---: | ---: |
| `ball-1882` | `collection-entry` | 44 | 4 | 2 |
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
| **Total** |  | **6,881** | **394** | **354** |
<!-- release-summary:readme-catalog-table:end -->

Metadata source-page coverage is not a claim that every covered page contains a record. Some covered pages are introductory or narrative-only.

Chladni 1825 pages 200-207 are introductory folios. Haidinger 1859 page 21 introduces the holdings list, whose entries begin on page 22. Buchner 1863 covers the Vienna register on Roman pages XIII-XVII, from Alais through Hemalga. Tassin 1902 metadata includes plate page 671 and introductory page 673; its 340 entries cite pages 675-698. Schreiter 1912 metadata spans pages 58-75; its 162 entries cite pages 66-73. Mason 1964 metadata spans pages 1-40; its 1,374 entries cite 33 of those pages. Nininger 1933 includes printed pages 1-20; pages 12-20 are narrative-only, and the printed catalog numbering skips item 139.

<!-- release-summary:readme-nininger-coverage:start -->
`nininger-1933` has 171 records; its metadata source pages span 1-20, and its record citations span 1-11. `nininger-1950` has 1,678 records; its metadata source pages span 26-104, and its record citations span 26-104.
<!-- release-summary:readme-nininger-coverage:end -->

Nininger 1933 covers printed pages 1-20, and the reviewed Nininger 1950 collection-catalog range covers printed pages 26-104 through its terminal entry. These ranges summarize current metadata and citations without merging source observations.

Records are source observations, not canonical meteorites or physical specimens. Equal names, designations, masses, or page numbers do not merge observations across catalogs. Statistics count each parent record once and sum every reported numeric mass once without multiplying by holding count.

### Reviewed MetBull Harmonization

Any of the four record models may additionally carry one optional `metbull` object:

```text
matchType, canonicalName, meteoriteCode, metbullUrl, alternateNameNote
```

`matchType` is exactly one of `exact`, `case-normalized-exact`, `historical-alias`, `corrected-spelling`, `translated-or-older-name`, or `unresolved`. `case-normalized-exact` is limited to names that differ only by Unicode letter case. Resolved reviews require a normalized current Meteoritical Bulletin name, a positive decimal code string, and the exact canonical HTTPS URL for that code. An `unresolved` review must keep all three canonical identity fields null. `alternateNameNote` is nullable explanatory text.

The historical `name`, designation/catalog identifier fields, printed private weight strings, and numeric source weights are never replaced by this object. The website labels the source catalog name and shows a separate linked **Current Meteoritical Bulletin name** only when a reviewed canonical name differs. No client, build, or export path fuzzy-matches names or infers identity.

<!-- release-summary:readme-metbull:start -->
The current release includes reviewed MetBull harmonization for 4,059 of 6,881 records: 3,930 have a resolved current identity and 129 remain explicitly unresolved. 13 records currently have a null `name` value.
<!-- release-summary:readme-metbull:end -->

Validated continuation evidence recovers formerly blank source names where supported; it does not infer modern identity.

Reviewed historical entries that genuinely print no separate proper source name retain null names and unresolved reviews without an inferred modern identity.

## Rights-Gated Folios

The client also requests `./data/folios.json`. This schema-2 manifest contains display authorization and public paths, not catalog facts:

```text
{ schemaVersion: 2, catalogs: {
  [catalogId]: { displayPolicy, rightsStatus, pages: [
    { pageId, catalogPage, pageLabel, image, alt }
  ] }
} } }
```

A folio is authorized only when the entire manifest is valid, its catalog policy agrees with `catalog.json`, and all of these conditions hold:

- `displayPolicy` is `display` with reviewed `rightsStatus` equal to `public-domain` or `no-copyright-us`.
- Every page has exactly `pageId`, nullable `catalogPage`, `pageLabel`, `image`, and `alt`.
- The ordered page list exactly matches the reviewed catalog page set.
- `image` is a plain relative `.webp` path rooted under `assets/folios/<catalogId>/` and named by the authorized page ID.
- Identifiers, paths, labels, and alt text satisfy the validator's normalization, length, and safety rules.

Any missing, blocked, incomplete, contradictory, malformed, or unsafe value denies display without preventing the factual catalog from loading. Eligibility is never inferred from publication year or apparent age.

`scripts/folio-release-lock.json` separately pins the reviewed rights basis, exact ordered page IDs, and SHA-256 digest of every public folio. Default validation requires both the generic schema and this release lock to pass; synthetic-only validation remains generic for future reviewed releases.

<!-- release-summary:readme-folio-table:start -->
| `catalogId` | Policy | Rights status | Public folios |
| --- | --- | --- | ---: |
| `ball-1882` | blocked | undetermined | 0 |
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
<!-- release-summary:readme-folio-table:end -->

Haidinger folios use the exact 1859 volume at [Internet Archive item sitzungsberichte34kais](https://archive.org/details/sitzungsberichte34kais), whose metadata states `NOT_IN_COPYRIGHT`. Hovey folios use the exact Smithsonian-contributed volume at [Biodiversity Heritage Library item 335869](https://www.biodiversitylibrary.org/item/335869), whose metadata marks the volume public domain. Nininger display is based on a documented search that found no renewal for the exact 1933 offprint; its status is specific to United States copyright review and is not a general ownership claim.

## Private Material

Raw OCR, verbatim notes, uncertainty details, source filenames, private record page IDs, dedicated display-weight and `weightText` fields, acquisition files, unreviewed scans, and private derivative manifests are excluded from `catalog.json`. Independently structured factual description prose may retain source-reported historical mass statements.

<!-- release-summary:readme-public-folios:start -->
Reviewed folio `pageId` values are intentionally public in `folios.json`, and the public repository contains only the 49 selected, manifest-verified folio derivatives under `assets/folios/`.
<!-- release-summary:readme-public-folios:end -->

The public client has no fallback loader for private data. If `catalog.json` is missing or invalid, the interface shows an accessible error state. Failure of the optional folio manifest leaves factual records available without folio controls.

## Limitations

- This is an independently structured factual index, not a page-layout transcription or canonical specimen registry.
- Transcription confidence describes the project transcription, not scientific certainty.
- Historical names, classifications, localities, dates, and masses may be incomplete, outdated, or erroneous in the source or transcription.
- Rights reviews are catalog- and copy-specific; current display policies and statuses are listed in the generated folio table above.
- Corrections, attribution concerns, and takedown requests may be submitted through GitHub issues.

See [`NOTICE.md`](./NOTICE.md) for attribution and rights information.
