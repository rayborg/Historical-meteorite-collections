# Historical Meteorite Collection

<!-- release-summary:readme-overview:start -->
This repository is a dependency-free, facts-only index of 13,542 source observations from 33 historical meteorite catalogs. The coordinated catalog uses public metadata schema 6 and supports 4 source-specific record models: `catalog-item`, `catalog-number`, `collection-entry`, `specimen`.
<!-- release-summary:readme-overview:end -->

The repository also publishes [`data/specimen-lineages.json`](./data/specimen-lineages.json), a deterministic index that distinguishes same collection inventory IDs across consecutive editions from possible matches across separate collection sources. Same-inventory continuity is series-scoped and does not infer custody or ownership. Cross-source candidates retain public review decisions from [`data/specimen-lineage-reviews.json`](./data/specimen-lineage-reviews.json) and do not assert physical identity, custody, or ownership transfer. The separate [`data/specimen-card-projections.json`](./data/specimen-card-projections.json) manifest identifies reviewed source holdings that may be displayed as individual specimen cards without splitting or replacing their parent observations.

A searchable transcription of the 1976 Huss Meteorite Collection catalog, compiled and published by Glenn Huss.

The other configured sources identify their compilers without inferring a publisher: Jean Andre Henri Lucas for 1813; E. F. F. Chladni, with a Vienna appendix by Karl von Schreibers, for 1819; E. F. F. Chladni for 1825; Wilhelm Haidinger for 1859; Otto Buchner for 1863; A. E. Nordenskiöld for 1870; Henry A. Ward for 1881; Valentine Ball for 1882; F. W. Clarke for 1886; Edmund Otis Hovey for 1896; Henry S. Washington for 1897; Wirt Tassin for 1902; A. G. Högbom for 1902; Oliver Cummings Farrington for 1903; Henry A. Ward for 1904; R. Schreiter for 1912; Warren M. Foote for 1912; C. Anderson for 1913; Oliver Cummings Farrington for 1916; George P. Merrill for 1916; M. Kantor for 1920; G. T. Prior for 1923; Charles Palache for 1926; H. H. Nininger for 1933; Chester A. Reeds for 1937; I. S. Astapowitsch for 1938; Virgil E. Barnes for 1940; H. H. Nininger and Addie D. Nininger for 1950; Brian Mason for 1964; Glenn I. Huss for 1986; the Kanagawa Prefectural Museum of Natural History for 1996; and the Buseck Center for Meteorite Studies, Arizona State University, for the September 2024 ASU dataset.

This public facts-only release was generated from accepted private source commit `0ce726a`, which retains the identity review accepted at `1180719` and adds the source-name audit corrections.

The site supports catalog filtering, model-aware search, segment-aware H-designation search, numeric gram ranges across scalar and nested masses, six deterministic sort orders, URL-persisted filters, incremental rendering, and rights-gated source folios. The homepage links to a dedicated catalog directory that presents every catalog card and its authorized folio actions; the bibliography master list remains a separate resource. Catalog facts and folio authorization are validated separately.

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
node scripts/validate-specimen-card-projections.mjs
node scripts/validate-public-catalog.mjs
node scripts/test-multicatalog.cjs
node --test scripts/*.test.mjs
```

The validator checks both synthetic rejection fixtures and the real catalog, manifest, and folio files. The runtime harness contains 117 tests.

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
| `anderson-1913` | `collection-entry` | 57 | 26 | 13 |
| `astapovich-1938` | `collection-entry` | 90 | 3 | 2 |
| `asu-2024-09` | `specimen` | 2,169 | 53 | 53 |
| `ball-1882` | `collection-entry` | 44 | 4 | 2 |
| `barnes-1940` | `collection-entry` | 70 | 30 | 16 |
| `buchner-1863` | `collection-entry` | 185 | 5 | 5 |
| `chladni-1819` | `collection-entry` | 74 | 12 | 12 |
| `chladni-1825` | `collection-entry` | 42 | 41 | 33 |
| `farrington-1903` | `collection-entry` | 251 | 38 | 38 |
| `farrington-1916` | `collection-entry` | 738 | 82 | 78 |
| `foote-1912` | `collection-entry` | 205 | 35 | 25 |
| `haidinger-1859` | `collection-entry` | 137 | 6 | 5 |
| `hogbom-1902` | `collection-entry` | 86 | 3 | 2 |
| `hovey-1896` | `catalog-number` | 25 | 7 | 7 |
| `huss-1976` | `specimen` | 1,078 | 46 | 46 |
| `huss-1986` | `specimen` | 544 | 21 | 21 |
| `kanagawa-1996` | `collection-entry` | 232 | 20 | 20 |
| `kantor-1920` | `collection-entry` | 30 | 35 | 16 |
| `lucas-1813` | `collection-entry` | 13 | 3 | 3 |
| `mason-1964` | `catalog-number` | 1,374 | 40 | 33 |
| `merrill-1916` | `collection-entry` | 560 | 170 | 170 |
| `nininger-1933` | `catalog-item` | 171 | 20 | 11 |
| `nininger-1950` | `specimen` | 1,678 | 79 | 79 |
| `nordenskiold-1870` | `collection-entry` | 127 | 10 | 10 |
| `palache-1926` | `collection-entry` | 361 | 9 | 8 |
| `prior-1923` | `collection-entry` | 949 | 196 | 196 |
| `reeds-1937` | `collection-entry` | 500 | 156 | 111 |
| `schreiter-1912` | `collection-entry` | 162 | 18 | 8 |
| `tassin-1902` | `collection-entry` | 340 | 26 | 24 |
| `usnm-1886` | `collection-entry` | 349 | 11 | 11 |
| `ward-1881` | `collection-entry` | 3 | 1 | 1 |
| `ward-1904` | `collection-entry` | 697 | 74 | 74 |
| `washington-1897` | `collection-entry` | 201 | 4 | 4 |
| **Total** |  | **13,542** | **1,284** | **1,137** |
<!-- release-summary:readme-catalog-table:end -->

Metadata source-page coverage is not a claim that every covered page contains a record. Some covered pages are introductory or narrative-only.

Ward 1904 contributes 697 facts-only collection entries citing all 74 metadata pages, with 49 reviewed exact-name mappings and 648 pending observations. Farrington 1916 contributes 738 facts-only collection entries citing 78 of 82 metadata pages, with 469 reviewed exact-name mappings and 269 pending observations. Both remain blocked/undetermined with empty folios and no public media.

Foote 1912 contributes 205 facts-only collection entries across 35 metadata pages, with records citing 25 pages. Its 227 holdings contain 227 numeric gram values, 132 records have reviewed exact-name MetBull mappings, and 73 remain pending. Its folio is blocked/undetermined with zero pages and no public media.

Anderson 1913 contributes 57 facts-only collection entries citing pages 54-66, all reviewed: 52 resolved and 5 unresolved. Kantor 1920 contributes 30 facts-only collection entries citing pages 107-122, all reviewed: 27 resolved and 3 unresolved, with 34 numeric gram values. Astapovich 1938 contributes 90 facts-only collection entries citing pages 195-196, all reviewed: 81 resolved and 9 unresolved. All three have blocked/undetermined zero-page folio policies and no public media.

Chladni 1825 pages 200-207 are introductory folios. Haidinger 1859 page 21 introduces the holdings list, whose entries begin on page 22. Buchner 1863 covers the Vienna register on Roman pages XIII-XVII, from Alais through Hemalga. Tassin 1902 metadata includes plate page 671 and introductory page 673; its 340 entries cite pages 675-698. Schreiter 1912 metadata spans pages 58-75; its 162 entries cite pages 66-73. Merrill 1916 contributes 560 facts-only collection entries citing 170 pages, with 560 pending observations and no reviewed mappings. Prior 1923 contributes 949 facts-only collection entries citing all 196 metadata pages, with 758 reviewed exact-name mappings and 191 pending observations. Reeds 1937 contributes 500 facts-only collection entries across 156 metadata pages; records cite 111 pages, with 390 reviewed exact-name mappings and 110 pending observations. Palache 1926 contributes 361 facts-only collection entries across nine metadata pages, 151-159; page 151 is introduction-only, so records cite the remaining eight pages, 152-159. Its records contain 361 holdings and 717 numeric gram values totaling 2,695,373.57 g, with 285 reviewed exact-name MetBull mappings and 76 pending observations. Barnes 1940 metadata spans pages 583-612 and contributes 70 facts-only collection entries, including 48 reviewed exact-name MetBull mappings and 22 pending observations without canonical identity. *Meteorite Catalogue of the Kanagawa Prefectural Museum of Natural History / 隕石目録*, issued 1996-01-31, contributes 232 facts-only collection entries on pages 4-22 and 24: 80 meteorite and 152 tektite/natural-glass observations. It retains only the controlled descriptions `Specimen`, `Thin section`, and `Specimen group`, with 68 reviewed exact MetBull mappings and 164 pending observations. Mason 1964 metadata spans pages 1-40; its 1,374 entries cite 33 of those pages. ASU September 2024 contributes 2,169 facts-only records citing all 53 dataset pages, with 2,166 unique designations and only `91`, `157`, and `607` duplicated. Nininger 1933 includes printed pages 1-20; pages 12-20 are narrative-only, and the printed catalog numbering skips item 139.

<!-- release-summary:readme-nininger-coverage:start -->
`nininger-1933` has 171 records; its metadata source pages span 1-20, and its record citations span 1-11. `nininger-1950` has 1,678 records; its metadata source pages span 26-104, and its record citations span 26-104.
<!-- release-summary:readme-nininger-coverage:end -->

Nininger 1933 covers printed pages 1-20, and the reviewed Nininger 1950 collection-catalog range covers printed pages 26-104 through its terminal entry. These ranges summarize current metadata and citations without merging source observations.

Records are source observations, not canonical meteorites or physical specimens. Equal names, designations, masses, or page numbers do not merge observations across catalogs. Statistics count each parent record once and sum every reported numeric mass once without multiplying by holding count.

### Reviewed Specimen Cards

`specimen-card-projections.json` is a display-only, positive allowlist. Its schema-1 entries reference an immutable parent observation and exact public holding and mass paths; they do not create observation or canonical-specimen IDs. Reviewed individual masses render as adjacent cards in source order. When a parent also contains grouped, aggregate, cast, range, total, uncertain, or otherwise unprojected material, one residual context card preserves that material without treating it as an individual specimen.

The manifest currently covers 1,699 parent observations and 6,316 reviewed mass cards. Reeds 1937 entry 366 renders ten ordered holding cards. Prior 1923 entry 630 remains a single parent card because its normalized values mix direct specimens with uncertain values, ranges, grouped counts, and aggregate totals. Search results continue to count distinct parent observations, homepage statistics remain based on all 13,542 parent observations, citations remain parent-scoped, and lineage is routed only by an exact mass path.

### Reviewed MetBull Harmonization

Any of the four record models may additionally carry one optional `metbull` object:

```text
matchType, canonicalName, meteoriteCode, metbullUrl, alternateNameNote
```

`matchType` is exactly one of `exact`, `case-normalized-exact`, `historical-alias`, `corrected-spelling`, `translated-or-older-name`, or `unresolved`. `case-normalized-exact` is limited to names that differ only by Unicode letter case. Resolved reviews require a normalized current Meteoritical Bulletin name, a positive decimal code string, and the exact canonical HTTPS URL for that code. An `unresolved` review must keep all three canonical identity fields null. `alternateNameNote` is nullable explanatory text.

The historical `name`, designation/catalog identifier fields, printed private weight strings, and numeric source weights are never replaced by this object. Every reviewed record gets a separate MetBull panel: resolved reviews show a linked **Current Meteoritical Bulletin name**, including when it equals the source name, while unresolved reviews show a non-linked review status. No client, build, or export path fuzzy-matches names or infers identity.

<!-- release-summary:readme-metbull:start -->
The current release includes reviewed MetBull harmonization for 10,202 of 13,542 records: 10,056 have a resolved current identity and 146 remain explicitly unresolved. 13 records currently have a null `name` value.
<!-- release-summary:readme-metbull:end -->

The remaining 3,340 records are pending observations without reviewed MetBull mappings.

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
| `anderson-1913` | blocked | undetermined | 0 |
| `astapovich-1938` | blocked | undetermined | 0 |
| `asu-2024-09` | blocked | undetermined | 0 |
| `ball-1882` | blocked | undetermined | 0 |
| `barnes-1940` | blocked | undetermined | 0 |
| `buchner-1863` | blocked | undetermined | 0 |
| `chladni-1819` | display | public-domain | 12 |
| `chladni-1825` | blocked | undetermined | 0 |
| `farrington-1903` | blocked | undetermined | 0 |
| `farrington-1916` | blocked | undetermined | 0 |
| `foote-1912` | blocked | undetermined | 0 |
| `haidinger-1859` | display | public-domain | 6 |
| `hogbom-1902` | blocked | undetermined | 0 |
| `hovey-1896` | display | public-domain | 7 |
| `huss-1976` | blocked | undetermined | 0 |
| `huss-1986` | blocked | undetermined | 0 |
| `kanagawa-1996` | blocked | undetermined | 0 |
| `kantor-1920` | blocked | undetermined | 0 |
| `lucas-1813` | display | public-domain | 3 |
| `mason-1964` | blocked | undetermined | 0 |
| `merrill-1916` | blocked | undetermined | 0 |
| `nininger-1933` | display | no-copyright-us | 21 |
| `nininger-1950` | blocked | undetermined | 0 |
| `nordenskiold-1870` | blocked | undetermined | 0 |
| `palache-1926` | blocked | undetermined | 0 |
| `prior-1923` | blocked | undetermined | 0 |
| `reeds-1937` | blocked | undetermined | 0 |
| `schreiter-1912` | blocked | undetermined | 0 |
| `tassin-1902` | blocked | undetermined | 0 |
| `usnm-1886` | blocked | undetermined | 0 |
| `ward-1881` | blocked | undetermined | 0 |
| `ward-1904` | blocked | undetermined | 0 |
| `washington-1897` | blocked | undetermined | 0 |
| **Total** |  |  | **49** |
<!-- release-summary:readme-folio-table:end -->

Haidinger folios use the exact 1859 volume at [Internet Archive item sitzungsberichte34kais](https://archive.org/details/sitzungsberichte34kais), whose metadata states `NOT_IN_COPYRIGHT`. Hovey folios use the exact Smithsonian-contributed volume at [Biodiversity Heritage Library item 335869](https://www.biodiversitylibrary.org/item/335869), whose metadata marks the volume public domain. Nininger display is based on a documented search that found no renewal for the exact 1933 offprint; its status is specific to United States copyright review and is not a general ownership claim.

## Private Material

Raw OCR, verbatim notes, uncertainty details, source filenames, private record page IDs, dedicated display-weight and `weightText` fields, acquisition files, unreviewed scans, and private derivative manifests are excluded from `catalog.json`. The Merrill, Prior, and Reeds releases contain structured facts only; their source files, OCR, private notes, paths, folios, and media remain excluded, and all three folio policies are blocked with undetermined rights. The Barnes source material, OCR, notes, and assets remain private; Barnes has no public folios or image assets. Palache is likewise a facts-only release from a private source workflow: its source PDF, page images, OCR, transcription, notes, source typography, filenames, page IDs, derivatives, manifests, and uncertainty internals remain private, and its folio is blocked with undetermined rights and no public media assets. Kanagawa publishes only structured facts with controlled holding descriptions: its source PDF and images, OCR, source prose, dimensions, notes, derivatives, manifest, paths, QA page, private page IDs, folios, and media remain excluded; its folio is blocked with undetermined rights. Independently structured factual description prose may retain source-reported historical mass statements.

Foote 1912, Ward 1904, and Farrington 1916 are likewise facts-only releases. Their source images, OCR batches, source filenames, private notes, paths, acquisition material, folios, and media remain excluded. Foote publishes no dedicated historical-weight text field; numeric masses are represented as grams.

Anderson 1913, Kantor 1920, and Astapovich 1938 are also facts-only releases. Their source images, OCR, source filenames, private notes, paths, folios, and media remain excluded; all three are blocked with undetermined rights and publish no media URLs.

<!-- release-summary:readme-public-folios:start -->
Reviewed folio `pageId` values are intentionally public in `folios.json`, and the public repository contains only the 49 selected, manifest-verified folio derivatives under `assets/folios/`.
<!-- release-summary:readme-public-folios:end -->

The public client has no fallback loader for private data. If `catalog.json` is missing or invalid, the interface shows an accessible error state. Failure of the optional folio or specimen-card projection manifest leaves factual parent records available without that enhancement.

## Limitations

- This is an independently structured factual index, not a page-layout transcription or canonical specimen registry.
- Transcription confidence describes the project transcription, not scientific certainty.
- Historical names, classifications, localities, dates, and masses may be incomplete, outdated, or erroneous in the source or transcription.
- Rights reviews are catalog- and copy-specific; current display policies and statuses are listed in the generated folio table above.
- Corrections, attribution concerns, and takedown requests may be submitted through GitHub issues.

See [`NOTICE.md`](./NOTICE.md) for attribution and rights information.
