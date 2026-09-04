# Historical Meteorite Collection

<!-- release-summary:readme-overview:start -->
This repository is a dependency-free, facts-only index of 14,477 source observations from 40 historical meteorite catalogs. The coordinated catalog uses public metadata schema 11 and supports 7 source-specific record models: `catalog-item`, `catalog-number`, `collection-entry`, `dealer-offer-fact`, `regional-census-fact`, `specimen`, `table-a-specimen`. Reviewed projection metadata expands 2,224 parent observations into 7,224 atomic specimen cards, producing 19,477 searchable display descriptors: 12,966 specimen cards and 6,511 observations.
<!-- release-summary:readme-overview:end -->

The repository also publishes [`data/specimen-lineages.json`](./data/specimen-lineages.json), a deterministic index that distinguishes same collection inventory IDs across consecutive editions from possible matches across separate collection sources. Same-inventory continuity is series-scoped and does not infer custody or ownership. Cross-source candidates retain public review decisions from [`data/specimen-lineage-reviews.json`](./data/specimen-lineage-reviews.json) and do not assert physical identity, custody, or ownership transfer. The separate [`data/specimen-card-projections.json`](./data/specimen-card-projections.json) manifest identifies reviewed source holdings that may be displayed as individual specimen cards without splitting or replacing their parent observations.

A searchable transcription of the 1976 Huss Meteorite Collection catalog, compiled and published by Glenn Huss.

The other configured sources identify their compilers without inferring a publisher: Jean Andre Henri Lucas for 1813; E. F. F. Chladni, with a Vienna appendix by Karl von Schreibers, for 1819; E. F. F. Chladni for 1825; Wilhelm Haidinger for 1859; Otto Buchner for 1863; A. E. Nordenskiöld for 1870; Henry A. Ward for 1881; Valentine Ball for 1882; F. W. Clarke for 1886; Edmund Otis Hovey for 1896; Henry S. Washington for 1897; Wirt Tassin for 1902; A. G. Högbom for 1902; Oliver Cummings Farrington for 1903; Henry A. Ward for 1904; R. Schreiter for 1912; Warren M. Foote for 1912; C. Anderson and E. Horn for their respective 1913 catalogs; Oliver Cummings Farrington for 1916; George P. Merrill for 1916; M. Kantor for 1920; G. T. Prior for 1923; Lucas Fernández Navarro for the Madrid catalog of 1923; Charles Palache for 1926; H. H. Nininger for 1933; Chester A. Reeds for 1937; I. S. Astapowitsch for 1938; T. Hodge-Smith for 1939; Virgil E. Barnes for 1940; H. H. Nininger and Addie D. Nininger for 1950; Brian Mason for 1964; Ursula B. Marvin and Brian Mason for 1982; Glenn I. Huss for 1986; the Kanagawa Prefectural Museum of Natural History for 1996; and the Buseck Center for Meteorite Studies, Arizona State University, for the September 2024 ASU dataset.

This public facts-only release was generated from the accepted canonical source integrations and retains their reviewed identity and source-name decisions.

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

The validator checks both synthetic rejection fixtures and the real catalog, manifest, and folio files. The standalone runtime harness contains 119 tests.

After changing either public data file, run `node scripts/sync-release-summary.mjs --write`; use `--json` to inspect the derived release summary without changing documentation.

## GitHub Pages

1. Run all validation commands above.
2. Push the repository to GitHub; the same checks run in `.github/workflows/validate.yml`.
3. Open **Settings > Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the publishing branch, normally `main`, and the root (`/`) folder.

All runtime URLs are relative, so the site works at a GitHub Pages project subpath without configuration.

## Public Data Scope

The browser loads factual records from `./data/catalog.json` and reviewed card boundaries from `./data/specimen-card-projections.json`. The schema-11 root contract is `{ metadata, records }`. Every descriptor declares one of the seven record models below.

A `specimen` record contains exactly:

```text
id, catalogId, designation, name, weight: { grams }, classification,
locality, [individualFindLocation], year, catalogPage, confidence
```

`individualFindLocation` is optional and is permitted only on `specimen` records. Its 111 current values are source facts tied to individual specimens; locality, coordinates, names, and prose cannot substitute for it.

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

Its holdings contain `description`, `provenance`, `count`, and `weights`; every numeric weight contains `grams`. The weights array may be empty when a historical or ambiguous mass has no supported numeric conversion; independently structured factual description prose may still retain the source-reported mass statement. `entryOrder` preserves source order. `reportedNumber` may be null or repeated because the source may omit, restart, or duplicate printed numbering.

Schema 11 also permits reviewed collection-entry weight semantics used by Hamburg: a weight may add `kind`; a holding may add `reportedTotalWeight` and `representations`; and a record may add `reportedTotalWeight`, `publicationState`, and `amendments`. These fields preserve whether a figure is an individual or aggregate holding, distinguish the printed base register from a supplement, and record a source-reported amendment without replacing the base observation.

A `regional-census-fact` record contains exactly:

```text
id, catalogId, entryOrder, reportedNumber, section, name, classification,
eventDate, australianMuseumRepresentation, catalogPages, confidence
```

Hodge-Smith's 84 records are regional census/catalog observations, not specimen cards, holdings, custody records, or claims about physical objects. `australianMuseumRepresentation` contains only the controlled `status` values `represented`, `not-represented`, or `mixed` and the source occurrence counts `representedOccurrences` and `notRepresentedOccurrences`. These records have no mass or holdings. Harmonized cards show the source number, source name, classification, event, representation status and counts, a differing reviewed current name where present, and the catalog-page citation. The section remains searchable source context rather than a card field.

A `table-a-specimen` record contains exactly:

```text
id, catalogId, entryOrder, specimenId, weight: { grams }, classification,
name, olivineFa, pyroxeneFs, weathering,
locality: { code, name, areaReferenceCoordinate }, catalogPage,
sourceEvidence: { primary, tableA, tableB, conflicts }, confidence, metbull
```

The 273 Victoria Land records retain Table A as the exact top-level primary facts and carry accepted `official-abbreviation` mappings. Their closed normalized `sourceEvidence` objects retain 270 Table B cross-views, including classification on 268 records, weathering on 249, fracturing on 250, and two `Unclassified` contexts. Conflict arrays are deterministically derived from the two tables and identify 40 mass, 2 classification, and 8 weathering conflicts. Raw rows, private page IDs, source files, and media remain excluded. The 40 mass-conflict records do not participate in computed lineage candidates; Table C groups remain separate n-ary source claims and are never pairwise-expanded.

A `dealer-offer-fact` contains exactly `id`, `catalogId`, `typeNumber`, `name`, `description`, `catalogPage`, and `confidence`. The six Foote 1909 records are dealer catalog observations, not specimens or holdings, and contain no mass, price, MetBull identity, or lineage assertion.

The current catalog contains:

<!-- release-summary:readme-catalog-table:start -->
| `catalogId` | Record model | Records | Metadata source pages | Pages cited by records |
| --- | --- | ---: | ---: | ---: |
| `anderson-1913` | `collection-entry` | 57 | 26 | 13 |
| `astapovich-1938` | `collection-entry` | 90 | 3 | 2 |
| `asu-2024-09` | `specimen` | 2,169 | 53 | 53 |
| `ball-1882` | `collection-entry` | 44 | 4 | 2 |
| `barnes-1940` | `collection-entry` | 70 | 30 | 16 |
| `brown-1916` | `collection-entry` | 237 | 78 | 78 |
| `buchner-1863` | `collection-entry` | 185 | 5 | 5 |
| `chladni-1819` | `collection-entry` | 74 | 12 | 12 |
| `chladni-1825` | `collection-entry` | 42 | 41 | 33 |
| `farrington-1903` | `collection-entry` | 251 | 38 | 38 |
| `farrington-1916` | `collection-entry` | 738 | 82 | 78 |
| `foote-1909` | `dealer-offer-fact` | 6 | 2 | 2 |
| `foote-1912` | `collection-entry` | 205 | 35 | 25 |
| `haidinger-1859` | `collection-entry` | 137 | 6 | 5 |
| `hamburg-1913` | `collection-entry` | 147 | 27 | 11 |
| `hodge-smith-1939` | `regional-census-fact` | 84 | 25 | 19 |
| `hogbom-1902` | `collection-entry` | 86 | 3 | 2 |
| `hovey-1896` | `catalog-number` | 25 | 7 | 7 |
| `huss-1976` | `specimen` | 1,078 | 46 | 46 |
| `huss-1986` | `specimen` | 544 | 21 | 21 |
| `kanagawa-1996` | `collection-entry` | 232 | 20 | 20 |
| `kantor-1920` | `collection-entry` | 30 | 35 | 16 |
| `lucas-1813` | `collection-entry` | 13 | 3 | 3 |
| `madrid-1923` | `collection-entry` | 130 | 10 | 8 |
| `mason-1964` | `catalog-number` | 1,374 | 40 | 33 |
| `merrill-1916` | `collection-entry` | 560 | 170 | 170 |
| `minnesota-1892` | `collection-entry` | 58 | 23 | 23 |
| `nininger-1933` | `catalog-item` | 171 | 20 | 11 |
| `nininger-1950` | `specimen` | 1,678 | 79 | 79 |
| `nordenskiold-1870` | `collection-entry` | 127 | 10 | 10 |
| `palache-1926` | `collection-entry` | 361 | 9 | 8 |
| `prior-1923` | `collection-entry` | 949 | 196 | 196 |
| `reeds-1937` | `collection-entry` | 500 | 156 | 111 |
| `schreiter-1912` | `collection-entry` | 162 | 18 | 8 |
| `tassin-1902` | `collection-entry` | 340 | 26 | 24 |
| `usnm-1886` | `collection-entry` | 349 | 11 | 11 |
| `victoria-land-1982` | `table-a-specimen` | 273 | 4 | 4 |
| `ward-1881` | `collection-entry` | 3 | 1 | 1 |
| `ward-1904` | `collection-entry` | 697 | 74 | 74 |
| `washington-1897` | `collection-entry` | 201 | 4 | 4 |
| **Total** |  | **14,477** | **1,453** | **1,282** |
<!-- release-summary:readme-catalog-table:end -->

Metadata source-page coverage is not a claim that every covered page contains a record. Some covered pages are introductory or narrative-only.

Ward 1904 contributes 697 facts-only collection entries citing all 74 metadata pages, with 49 reviewed exact-name mappings and 648 pending observations. Farrington 1916 contributes 738 facts-only collection entries citing 78 of 82 metadata pages, with 469 reviewed exact-name mappings and 269 pending observations. Both remain blocked/undetermined with empty folios and no public media.

Foote 1912 contributes 205 facts-only collection entries across 35 metadata pages, with records citing 25 pages. Its 227 holdings contain 227 numeric gram values, 132 records have reviewed exact-name MetBull mappings, and 73 remain pending. Its folio is blocked/undetermined with zero pages and no public media.

Anderson 1913 contributes 57 facts-only collection entries citing pages 54-66, all reviewed: 52 resolved and 5 unresolved. Kantor 1920 contributes 30 facts-only collection entries citing pages 107-122, all reviewed: 27 resolved and 3 unresolved, with 34 numeric gram values. Astapovich 1938 contributes 90 facts-only collection entries citing pages 195-196, all reviewed: 81 resolved and 9 unresolved. All three have blocked/undetermined zero-page folio policies and no public media.

Hamburg 1913 contributes 147 fully reviewed facts-only observations from E. Horn's *Die Meteoritensammlung des Mineralogisch-Geologischen Instituts zu Hamburg*: 98 resolved and 49 unresolved. Its 151 holdings describe 227 components, including 26 thin sections. The calculated base-component sum is 748,304.8 g, distinct from the printed 748,304.9 g total. Applying the source-reported August 1913 disposal of one 14,500 g Gibeon component and adding the separately printed Holbrook supplement of 51 stones totaling 490.6 g gives a revised calculated total of 734,295.4 g, distinct from the printed revised total of 734,295.5 g. The base observation remains published rather than being rewritten by the amendment.

Hamburg contributes four reviewed cross-source relationships retained only as possible lineages. They document matching public facts for review and do not establish specimen identity, custody, ownership, or transfer.

Madrid 1923 contributes 130 fully reviewed facts-only collection entries citing pages 226-233 within the ten-page metadata range 224-233. Its 168 holdings comprise 151 `Specimen` and 17 `Specimen group` descriptions; all 168 have one normalized mass, totaling 190,083.41 g. This detailed-entry sum is a derived total and remains distinct from the source's separate narrative collection-total claim; neither is used to infer additional holdings. The review resolves 84 records and leaves 46 explicitly unresolved. Madrid remains blocked/undetermined with an empty folio, no public media, and no published private evidence.

Chladni 1825 pages 200-207 are introductory folios. Haidinger 1859 page 21 introduces the holdings list, whose entries begin on page 22. Buchner 1863 covers the Vienna register on Roman pages XIII-XVII, from Alais through Hemalga. Tassin 1902 metadata includes plate page 671 and introductory page 673; its 340 entries cite pages 675-698. Schreiter 1912 metadata spans pages 58-75; its 162 entries cite pages 66-73. Merrill 1916 contributes 560 facts-only collection entries citing 170 pages, with 560 pending observations and no reviewed mappings. Prior 1923 contributes 949 facts-only collection entries citing all 196 metadata pages, with 758 reviewed exact-name mappings and 191 pending observations. Reeds 1937 contributes 500 facts-only collection entries across 156 metadata pages; records cite 111 pages, with 390 reviewed exact-name mappings and 110 pending observations. Palache 1926 contributes 361 facts-only collection entries across nine metadata pages, 151-159; page 151 is introduction-only, so records cite the remaining eight pages, 152-159. Its records contain 361 holdings and 717 numeric gram values totaling 2,695,373.57 g, with 285 reviewed exact-name MetBull mappings and 76 pending observations. Barnes 1940 metadata spans pages 583-612 and contributes 70 facts-only collection entries, including 48 reviewed exact-name MetBull mappings and 22 pending observations without canonical identity. *Meteorite Catalogue of the Kanagawa Prefectural Museum of Natural History / 隕石目録*, issued 1996-01-31, contributes 232 facts-only collection entries on pages 4-22 and 24: 80 meteorite and 152 tektite/natural-glass observations. It retains only the controlled descriptions `Specimen`, `Thin section`, and `Specimen group`, with 68 reviewed exact MetBull mappings and 164 pending observations. Mason 1964 metadata spans pages 1-40; its 1,374 entries cite 33 of those pages. ASU September 2024 contributes 2,169 facts-only records citing all 53 dataset pages, with 2,166 unique designations and only `91`, `157`, and `607` duplicated. Nininger 1933 includes printed pages 1-20; pages 12-20 are narrative-only, and the printed catalog numbering skips item 139.

<!-- release-summary:readme-nininger-coverage:start -->
`nininger-1933` has 171 records; its metadata source pages span 1-20, and its record citations span 1-11. `nininger-1950` has 1,678 records; its metadata source pages span 26-104, and its record citations span 26-104.
<!-- release-summary:readme-nininger-coverage:end -->

Nininger 1933 covers printed pages 1-20, and the reviewed Nininger 1950 collection-catalog range covers printed pages 26-104 through its terminal entry. These ranges summarize current metadata and citations without merging source observations.

Records are source observations, not canonical meteorites. A `table-a-specimen` observation explicitly describes one source-identified individual specimen; a `regional-census-fact` explicitly does not. Equal names, designations, masses, or page numbers do not merge observations across catalogs. Statistics count each parent record once, count every Victoria Land mass once, include no Hodge-Smith mass, and never multiply a reported mass by holding count.

### Harmonized Public Cards

The public presenter derives 19,477 display cards from 14,477 parent observations and the reviewed projection manifest: 5,742 direct specimens, 7,224 projected atomic specimens, 6,421 collection observations, 84 regional observations, and 6 dealer observations. Projection changes display-card multiplicity only; search result counts, statistics, citations, folio authorization, and source data remain parent-observation based.

Every specimen card uses one closed standard vocabulary. After the specimen identifier, semantic type, and source catalog meteorite name, every specimen displays these fact rows in order: **Current Meteoritical Bulletin name**, **Class**, **Specimen form**, **Source locality**, **Individual find location**, **Event**, **Lineage**, and **Specimen weight**. Unavailable values read **Unknown**. A resolved display-equivalent current name reads **Same as source catalog name** rather than repeating it. No catalog-specific holdings, provenance, coordinate, mineral-chemistry, amendment, total, representation, occurrence-count, or section labels are inserted into cards. Those public source facts remain searchable.

The checked-by-default **Include specimens without weight** filter preserves the complete register. Clearing it removes exactly 173 unknown-mass specimen cards. Brown's 385 and Minnesota's 164 reviewed cards remain under the accepted harmonized rule even though 11 lack a specific mass path; collection, regional, and dealer observations remain listed.

`direct-specimen` and `projected-atomic-specimen` cards are specimen presentations. `collection-observation`, `regional-observation`, and `dealer-observation` cards are explicitly observations and omit specimen-only fields. **Specimen form** is controlled only by reviewed card kind; it is not inferred from locality, coordinates, names, MetBull data, or descriptive prose. **Source locality** preserves the catalog's locality scope and is not an individual find-location field. The 111 typed specimen locations display exactly; the other 12,855 specimen cards display **Individual find location: Unknown**.

### Reviewed Specimen Cards

`specimen-card-projections.json` is a schema-4 display-only positive allowlist whose metadata binds the schema-11 catalog, its 14,477 records, and its exact source hash. Every card references an immutable parent observation and exact public holding, then uses one evidence variant: a reviewed UTF-16 clause span in an already-public description or designation, or an exact typed Hamburg `componentPath`. Schema 4 also permits a closed `repeatedMass` object on a clause card with `massPath: null`; it binds one per-item value, count, aggregate total, occurrence, and occurrence count in the same holding. It does not create observation or canonical-specimen IDs or copy source prose into the manifest. Grouped holdings, aggregate components, associated material, representations, counts, ranges, totals, dealer offers, and otherwise unprojected material remain observation or audit context and are not promoted into specimen claims.

The manifest covers 2,224 parent observations and 7,224 atomic specimen cards: 7,194 ordinary cards bind an exact `massPath`, 2 Kuleschowka cards bind the same 2.7 g per-item value through distinct `repeatedMass` occurrences, and 28 cards have no normalized display mass. It retains 1,694 source-context audit partitions that are not rendered as specimens. Brown contributes 385 reviewed cards and Minnesota 164; group context and excluded non-meteorite context remain unrendered. Hamburg contributes 218 component cards across 142 parents, Madrid contributes 54 cards across 23 parents, Reeds entry 366 produces ten cards, and Prior entry 630 produces seventeen. The allowlist does not project dealer, regional-census, or Table A observations. Search results and statistics remain based on all 14,477 parents across 40 catalogs. Lineage is routed only by exact non-null `massPath`; the 22 reviewed Brown/Minnesota relationships remain possible matches rather than identity, custody, ownership-transfer, or merge claims.

### Reviewed MetBull Harmonization

Records with a reviewed source-name identity may additionally carry one optional `metbull` object:

```text
matchType, canonicalName, meteoriteCode, metbullUrl, alternateNameNote
```

`matchType` is exactly one of `exact`, `case-normalized-exact`, `source-heading-exact`, `historical-alias`, `corrected-spelling`, `translated-or-older-name`, or `unresolved`. `case-normalized-exact` is limited to names that differ only by Unicode letter case. Resolved reviews require a normalized current Meteoritical Bulletin name, a positive decimal code string, and the exact canonical HTTPS URL for that code. An `unresolved` review must keep all three canonical identity fields null. `alternateNameNote` is nullable explanatory text.

The historical `name`, designation/catalog identifier fields, printed private weight strings, and numeric source weights are never replaced by this object. Every specimen displays a **Current Meteoritical Bulletin name** row: a substantively different resolved name, **Same as source catalog name** for a display-equivalent resolved name, or **Unknown** when no canonical identity is reviewed. Comparison uses Unicode NFC, collapsed whitespace, and locale-aware lowercase. No client, build, or export path fuzzy-matches names or infers identity.

<!-- release-summary:readme-metbull:start -->
The current release includes reviewed MetBull harmonization for 11,177 of 14,477 records: 10,873 have a resolved current identity and 304 remain explicitly unresolved. 13 records currently have a null `name` value.
<!-- release-summary:readme-metbull:end -->

The remaining 3,300 records are pending observations without reviewed MetBull mappings. Victoria Land's 273 Table A specimens have accepted `official-abbreviation` mappings; Foote's six dealer observations intentionally have no MetBull mapping or current-name panel.

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
| `brown-1916` | blocked | undetermined | 0 |
| `buchner-1863` | blocked | undetermined | 0 |
| `chladni-1819` | display | public-domain | 12 |
| `chladni-1825` | blocked | undetermined | 0 |
| `farrington-1903` | blocked | undetermined | 0 |
| `farrington-1916` | blocked | undetermined | 0 |
| `foote-1909` | blocked | undetermined | 0 |
| `foote-1912` | blocked | undetermined | 0 |
| `haidinger-1859` | display | public-domain | 6 |
| `hamburg-1913` | blocked | undetermined | 0 |
| `hodge-smith-1939` | blocked | undetermined | 0 |
| `hogbom-1902` | blocked | undetermined | 0 |
| `hovey-1896` | display | public-domain | 7 |
| `huss-1976` | blocked | undetermined | 0 |
| `huss-1986` | blocked | undetermined | 0 |
| `kanagawa-1996` | blocked | undetermined | 0 |
| `kantor-1920` | blocked | undetermined | 0 |
| `lucas-1813` | display | public-domain | 3 |
| `madrid-1923` | blocked | undetermined | 0 |
| `mason-1964` | blocked | undetermined | 0 |
| `merrill-1916` | blocked | undetermined | 0 |
| `minnesota-1892` | blocked | undetermined | 0 |
| `nininger-1933` | display | no-copyright-us | 21 |
| `nininger-1950` | blocked | undetermined | 0 |
| `nordenskiold-1870` | blocked | undetermined | 0 |
| `palache-1926` | blocked | undetermined | 0 |
| `prior-1923` | blocked | undetermined | 0 |
| `reeds-1937` | blocked | undetermined | 0 |
| `schreiter-1912` | blocked | undetermined | 0 |
| `tassin-1902` | blocked | undetermined | 0 |
| `usnm-1886` | blocked | undetermined | 0 |
| `victoria-land-1982` | blocked | undetermined | 0 |
| `ward-1881` | blocked | undetermined | 0 |
| `ward-1904` | blocked | undetermined | 0 |
| `washington-1897` | blocked | undetermined | 0 |
| **Total** |  |  | **49** |
<!-- release-summary:readme-folio-table:end -->

Haidinger folios use the exact 1859 volume at [Internet Archive item sitzungsberichte34kais](https://archive.org/details/sitzungsberichte34kais), whose metadata states `NOT_IN_COPYRIGHT`. Hovey folios use the exact Smithsonian-contributed volume at [Biodiversity Heritage Library item 335869](https://www.biodiversitylibrary.org/item/335869), whose metadata marks the volume public domain. Nininger display is based on a documented search that found no renewal for the exact 1933 offprint; its status is specific to United States copyright review and is not a general ownership claim.

## Private Material

Raw OCR, verbatim notes, uncertainty details, source filenames, private record page IDs, dedicated display-weight and `weightText` fields, acquisition files, unreviewed scans, and private derivative manifests are excluded from `catalog.json`. The Merrill, Prior, Madrid, and Reeds releases contain structured facts only; their source files, OCR, private notes or evidence, paths, folios, and media remain excluded, and all four folio policies are blocked with undetermined rights. The Barnes source material, OCR, notes, and assets remain private; Barnes has no public folios or image assets. Palache is likewise a facts-only release from a private source workflow: its source PDF, page images, OCR, transcription, notes, source typography, filenames, page IDs, derivatives, manifests, and uncertainty internals remain private, and its folio is blocked with undetermined rights and no public media assets. Kanagawa publishes only structured facts with controlled holding descriptions: its source PDF and images, OCR, source prose, dimensions, notes, derivatives, manifest, paths, QA page, private page IDs, folios, and media remain excluded; its folio is blocked with undetermined rights. Independently structured factual description prose may retain source-reported historical mass statements.

Foote 1912, Ward 1904, and Farrington 1916 are likewise facts-only releases. Their source images, OCR batches, source filenames, private notes, paths, acquisition material, folios, and media remain excluded. Foote publishes no dedicated historical-weight text field; numeric masses are represented as grams.

Anderson 1913, Kantor 1920, and Astapovich 1938 are also facts-only releases. Their source images, OCR, source filenames, private notes, paths, folios, and media remain excluded; all three are blocked with undetermined rights and publish no media URLs.

Hamburg 1913 is also facts-only. Its source scans, OCR, transcription files, private notes and evidence, filenames, paths, folios, and media remain excluded. It is blocked with undetermined rights, has no public folio pages or assets, and publishes only the structured facts and citations described above.

Hodge-Smith 1939 and Victoria Land 1982 are facts-only and blocked/undetermined with no public folios or media. Their source scans or PDFs, OCR/transcriptions, filenames, notes, private review material, paths, derivatives, and working files remain excluded. The public payload contains only the structured regional census facts, Table A specimen facts, and closed normalized Table A/Table B evidence described above.

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
