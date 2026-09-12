# Historical Meteorite Collection

<!-- release-summary:readme-overview:start -->
This repository is a dependency-free, facts-only index of 19,553 source observations from 52 historical meteorite catalogs. The coordinated catalog uses public metadata schema 12 and supports 8 source-specific record models: `catalog-item`, `catalog-number`, `collection-entry`, `collection-representation-fact`, `dealer-offer-fact`, `regional-census-fact`, `specimen`, `table-a-specimen`. Reviewed projection metadata expands 3,407 parent observations into 8,410 atomic specimen cards, producing 24,556 searchable display descriptors: 14,149 specimen cards and 10,407 observations.
<!-- release-summary:readme-overview:end -->

The repository also publishes [`data/specimen-lineages.json`](./data/specimen-lineages.json), a deterministic index that distinguishes same collection inventory IDs across consecutive editions from possible matches across separate collection sources. Same-inventory continuity is series-scoped and does not infer custody or ownership. Cross-source candidates retain public review decisions from [`data/specimen-lineage-reviews.json`](./data/specimen-lineage-reviews.json) and do not assert physical identity, custody, or ownership transfer. The separate [`data/specimen-card-projections.json`](./data/specimen-card-projections.json) manifest identifies reviewed source holdings that may be displayed as individual specimen cards without splitting or replacing their parent observations. Schema 6 binds exact same-card public evidence for 5,058 source-reviewed projected catalog numbers across six catalogs while excluding ambiguous, external, parent-only, private-only, and absent values.

A searchable transcription of the 1976 Huss Meteorite Collection catalog, compiled and published by Glenn Huss.

The other configured sources identify their compilers without inferring a publisher: Jean Andre Henri Lucas for 1813; E. F. F. Chladni, with a Vienna appendix by Karl von Schreibers, for 1819; E. F. F. Chladni for 1825; Wilhelm Haidinger for 1859; Otto Buchner for 1863; A. E. Nordenskiöld for 1870; Henry A. Ward for 1881; Valentine Ball for 1882; F. W. Clarke for 1886; Edmund Otis Hovey for 1896; Henry S. Washington for 1897; Wirt Tassin for 1902; A. G. Högbom for 1902; Oliver Cummings Farrington for 1903; Henry A. Ward for 1904; R. Schreiter for 1912; Warren M. Foote for 1912; C. Anderson and E. Horn for their respective 1913 catalogs; Oliver Cummings Farrington for 1916; George P. Merrill for 1916; M. Kantor for 1920; G. T. Prior for 1923; Lucas Fernández Navarro for the Madrid catalog of 1923; Charles Palache for 1926; H. H. Nininger for 1933; Chester A. Reeds for 1937; I. S. Astapowitsch for 1938; T. Hodge-Smith for 1939; Virgil E. Barnes for 1940; H. H. Nininger and Addie D. Nininger for 1950; Brian Mason for 1964; Ursula B. Marvin and Brian Mason for 1982; Glenn I. Huss for 1986; the Kanagawa Prefectural Museum of Natural History for 1996; and the Buseck Center for Meteorite Studies, Arizona State University, for the September 2024 ASU dataset.

Lazarus Fletcher compiled the five included British Museum editions of 1886, 1894, 1896, 1904, and 1908.

This public facts-only release was generated from the accepted canonical source integrations and retains their reviewed identity and source-name decisions. E. Cohen compiled the 1895 and 1901 Greifswald catalogs, and Carl Klein compiled the 1903 and 1904 Berlin catalogs. The research and publication rules are summarized in [`METHODOLOGY.md`](./METHODOLOGY.md).

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

The validator checks both synthetic rejection fixtures and the real catalog, manifest, and folio files, including exactly 22 catalog-number rejection cases. The standalone runtime harness contains 124 tests, and the complete MJS suite contains 192 tests.

After changing either public data file, run `node scripts/sync-release-summary.mjs --write`; use `--json` to inspect the derived release summary without changing documentation.

## GitHub Pages

1. Run all validation commands above.
2. Push the repository to GitHub; the same checks run in `.github/workflows/validate.yml`.
3. Open **Settings > Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the publishing branch, normally `main`, and the root (`/`) folder.

All runtime URLs are relative, so the site works at a GitHub Pages project subpath without configuration.

## Public Data Scope

The browser loads factual records from `./data/catalog.json` and reviewed card boundaries from `./data/specimen-card-projections.json`. The schema-12 root contract is `{ metadata, records }`. Every descriptor declares one of the eight record models below.

A `specimen` record contains exactly:

```text
id, catalogId, designation, name, weight: { grams }, classification,
locality, [individualFindLocation], year, catalogPage, confidence,
[description], [weightEvidence], [associatedMaterial], [specimenDisposition]
```

`individualFindLocation` is optional and is permitted only on `specimen` records. Its 111 current values are source facts tied to individual specimens; locality, coordinates, names, and prose cannot substitute for it.

Schema 12 adds three closed, optional specimen evidence objects. `weightEvidence: { type: "qualitative", statement }` retains a reviewed nonnumeric source weight without inventing grams. `associatedMaterial: { type: "aggregate-context", description, grams, count }` keeps Lakewood's 1,813.3 g fragment box separate from its 5,265.8 g main mass. `specimenDisposition: { type: "not-individual", reason }` reclassifies three plural terrestrial-material rows as observations rather than specimens. These fields are exact allowlists, not general prose extension points.

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

Schema 12 also permits reviewed collection-entry weight semantics used by Hamburg: a weight may add `kind`; a holding may add `reportedTotalWeight` and `representations`; and a record may add `reportedTotalWeight`, `publicationState`, and `amendments`. These fields preserve whether a figure is an individual or aggregate holding, distinguish the printed base register from a supplement, and record a source-reported amendment without replacing the base observation.

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

The 273 Victoria Land records retain Table A as the exact top-level primary facts and carry accepted `official-abbreviation` mappings. The descriptor covers printed pages 85-94: Table A records cite pages 85-88, and every normalized Table A, Table B, and Table C reference is scoped to that ten-page range. Their closed normalized `sourceEvidence` objects retain 270 Table B cross-views, including classification on 268 records, weathering on 249, fracturing on 250, and two `Unclassified` contexts. Conflict arrays are deterministically derived from the two tables and identify 40 mass, 2 classification, and 8 weathering conflicts. Raw rows, private page IDs, source files, and media remain excluded. The 40 mass-conflict records do not participate in computed lineage candidates; Table C groups remain separate n-ary source claims and are never pairwise-expanded.

A `dealer-offer-fact` contains exactly `id`, `catalogId`, `typeNumber`, `name`, `description`, `catalogPage`, and `confidence`. The six Foote 1909 records are dealer catalog observations, not specimens or holdings, and contain no mass, price, MetBull identity, or lineage assertion.

A `collection-representation-fact` contains exactly:

```text
id, catalogId, entryOrder, reportedNumber, pane, name, eventDate, reference,
representedWeight: { valueText, componentTexts, grams, semantics },
section, catalogPages, confidence, [metbull]
```

The five Lazarus Fletcher British Museum editions contribute 2,464 edition-local observations: 375, 461, 481, 562, and 585 in edition order. Their source heading, date or report of find, and bibliographic reference are independently reviewed fields; all 2,464 source names are nonempty, while 2,440 event/report fields and 939 references are populated. Nine source-blank grouped continuations inherit only the exact preceding source-proven locality heading and remain unresolved rather than inheriting a MetBull identity. List numbers and pane/case labels are source finding context, not inventory identifiers. `representedWeight` describes collection representation, never an atomic holding or specimen mass; multiple printed values remain ordered in `componentTexts` with `grams: null`. These observations create no atomic cards, lineage endpoints, same-inventory links, or merges. Their deterministic public IDs do not expose private source UUIDs. All five folio policies are blocked with rights undetermined and no pages or media.

The current catalog contains:

<!-- release-summary:readme-catalog-table:start -->
| `catalogId` | Record model | Records | Metadata source pages | Pages cited by records |
| --- | --- | ---: | ---: | ---: |
| `anderson-1913` | `collection-entry` | 57 | 26 | 13 |
| `astapovich-1938` | `collection-entry` | 90 | 3 | 2 |
| `asu-2024-09` | `specimen` | 2,169 | 53 | 53 |
| `ball-1882` | `collection-entry` | 44 | 4 | 2 |
| `barnes-1940` | `collection-entry` | 70 | 30 | 16 |
| `berlin-1903` | `collection-entry` | 380 | 13 | 13 |
| `berlin-1904` | `collection-entry` | 470 | 17 | 17 |
| `brauns-bonn-1926` | `collection-entry` | 353 | 23 | 23 |
| `brown-1916` | `collection-entry` | 237 | 78 | 78 |
| `buchner-1863` | `collection-entry` | 185 | 5 | 5 |
| `chladni-1819` | `collection-entry` | 74 | 12 | 12 |
| `chladni-1825` | `collection-entry` | 42 | 41 | 33 |
| `farrington-1903` | `collection-entry` | 251 | 38 | 38 |
| `farrington-1916` | `collection-entry` | 738 | 82 | 78 |
| `fletcher-1886` | `collection-representation-fact` | 375 | 26 | 26 |
| `fletcher-1894` | `collection-representation-fact` | 461 | 30 | 30 |
| `fletcher-1896` | `collection-representation-fact` | 481 | 31 | 31 |
| `fletcher-1904` | `collection-representation-fact` | 562 | 38 | 38 |
| `fletcher-1908` | `collection-representation-fact` | 585 | 41 | 41 |
| `foote-1909` | `dealer-offer-fact` | 6 | 2 | 2 |
| `foote-1912` | `collection-entry` | 205 | 35 | 25 |
| `greifswald-1895` | `collection-entry` | 145 | 11 | 11 |
| `greifswald-1901` | `collection-entry` | 281 | 21 | 21 |
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
| `prior-guide-1926` | `collection-representation-fact` | 680 | 15 | 15 |
| `reeds-1937` | `collection-entry` | 500 | 156 | 111 |
| `schreiter-1912` | `collection-entry` | 162 | 18 | 8 |
| `story-maskelyne-1872` | `collection-representation-fact` | 303 | 8 | 8 |
| `tassin-1902` | `collection-entry` | 340 | 26 | 24 |
| `usnm-1886` | `collection-entry` | 349 | 11 | 11 |
| `victoria-land-1982` | `table-a-specimen` | 273 | 10 | 4 |
| `ward-1881` | `collection-entry` | 3 | 1 | 1 |
| `ward-1904` | `collection-entry` | 697 | 74 | 74 |
| `washington-1897` | `collection-entry` | 201 | 4 | 4 |
| **Total** |  | **19,553** | **1,733** | **1,556** |
<!-- release-summary:readme-catalog-table:end -->

Metadata source-page coverage is not a claim that every covered page contains a record. Some covered pages are introductory or narrative-only.

Ward 1904 contributes 697 facts-only collection entries citing all 74 metadata pages, with 49 reviewed exact-name mappings and 648 pending observations. Farrington 1916 contributes 738 facts-only collection entries citing 78 of 82 metadata pages, with 469 reviewed exact-name mappings and 269 pending observations. Both remain blocked/undetermined with empty folios and no public media.

Foote 1912 contributes 205 facts-only collection entries across 35 metadata pages, with records citing 25 pages. Its 227 holdings contain 227 numeric gram values, 132 records have reviewed exact-name MetBull mappings, and 73 remain pending. Its folio is blocked/undetermined with zero pages and no public media.

Anderson 1913 contributes 57 facts-only collection entries citing pages 54-66, all reviewed: 52 resolved and 5 unresolved. Kantor 1920 contributes 30 facts-only collection entries citing pages 107-122, all reviewed: 27 resolved and 3 unresolved, with 34 numeric gram values. Astapovich 1938 contributes 90 facts-only collection entries citing pages 195-196, all reviewed: 81 resolved and 9 unresolved. All three have blocked/undetermined zero-page folio policies and no public media.

Hamburg 1913 contributes 147 fully reviewed facts-only observations from E. Horn's *Die Meteoritensammlung des Mineralogisch-Geologischen Instituts zu Hamburg*: 98 resolved and 49 unresolved. Its 151 holdings describe 227 components, including 26 thin sections. The calculated base-component sum is 748,304.8 g, distinct from the printed 748,304.9 g total. Applying the source-reported August 1913 disposal of one 14,500 g Gibeon component and adding the separately printed Holbrook supplement of 51 stones totaling 490.6 g gives a revised calculated total of 734,295.4 g, distinct from the printed revised total of 734,295.5 g. The base observation remains published rather than being rewritten by the amendment.

Hamburg contributes four reviewed cross-source relationships retained only as possible lineages. They document matching public facts for review and do not establish specimen identity, custody, ownership, or transfer.

The audited correction release removes the unsupported zero from Merrill's El Capitan observation, leaving exact masses 66 g, 753 g, and 4,000 g; corrects Reeds's Mantos Blancos classification to `Siderite: Fine octahedrite, Of.`; and removes the incompatible Nininger `139b` same-inventory relationship. The accepted weight census additionally assigns Lakewood's 5,265.8 g main mass, retains its separate 1,813.3 g aggregate context, restores Waterville 453.1 at 26.4 g and 453.2 at 286 g, corrects Orgueil's second mass from 8 g to 98 g, and retains Pavlograd's `less than a gram` statement. No record or catalog was added or removed.

Madrid 1923 contributes 130 fully reviewed facts-only collection entries citing pages 226-233 within the ten-page metadata range 224-233. Its 168 holdings comprise 151 `Specimen` and 17 `Specimen group` descriptions; all 168 have one normalized mass, totaling 190,083.41 g. This detailed-entry sum is a derived total and remains distinct from the source's separate narrative collection-total claim; neither is used to infer additional holdings. The review resolves 84 records and leaves 46 explicitly unresolved. Madrid remains blocked/undetermined with an empty folio, no public media, and no published private evidence.

Chladni 1825 pages 200-207 are introductory folios. Haidinger 1859 page 21 introduces the holdings list, whose entries begin on page 22. Buchner 1863 covers the Vienna register on Roman pages XIII-XVII, from Alais through Hemalga. Tassin 1902 metadata includes plate page 671 and introductory page 673; its 340 entries cite pages 675-698. Schreiter 1912 metadata spans pages 58-75; its 162 entries cite pages 66-73. Merrill 1916 contributes 560 facts-only collection entries citing 170 pages, with 560 pending observations and no reviewed mappings. Prior 1923 contributes 949 facts-only collection entries citing all 196 metadata pages, with 758 reviewed exact-name mappings and 191 pending observations. Reeds 1937 contributes 500 facts-only collection entries across 156 metadata pages; records cite 111 pages, with 390 reviewed exact-name mappings and 110 pending observations. Palache 1926 contributes 361 facts-only collection entries across nine metadata pages, 151-159; page 151 is introduction-only, so records cite the remaining eight pages, 152-159. Its records contain 361 holdings and 717 numeric gram values totaling 2,695,373.57 g, with 285 reviewed exact-name MetBull mappings and 76 pending observations. Barnes 1940 metadata spans pages 583-612 and contributes 70 facts-only collection entries, including 48 reviewed exact-name MetBull mappings and 22 pending observations without canonical identity. *Meteorite Catalogue of the Kanagawa Prefectural Museum of Natural History / 隕石目録*, issued 1996-01-31, contributes 232 facts-only collection entries on pages 4-22 and 24: 80 meteorite and 152 tektite/natural-glass observations. It retains only the controlled descriptions `Specimen`, `Thin section`, and `Specimen group`, with 68 reviewed exact MetBull mappings and 164 pending observations. Mason 1964 metadata spans pages 1-40; its 1,374 entries cite 33 of those pages. ASU September 2024 contributes 2,169 facts-only records citing all 53 dataset pages, with 2,166 unique designations and only `91`, `157`, and `607` duplicated. Nininger 1933 includes printed pages 1-20; pages 12-20 are narrative-only, and the printed catalog numbering skips item 139.

<!-- release-summary:readme-nininger-coverage:start -->
`nininger-1933` has 171 records; its metadata source pages span 1-20, and its record citations span 1-11. `nininger-1950` has 1,678 records; its metadata source pages span 26-104, and its record citations span 26-104.
<!-- release-summary:readme-nininger-coverage:end -->

Nininger 1933 covers printed pages 1-20, and the reviewed Nininger 1950 collection-catalog range covers printed pages 26-104 through its terminal entry. These ranges summarize current metadata and citations without merging source observations.

Records are source observations, not canonical meteorites. A `table-a-specimen` observation explicitly describes one source-identified individual specimen; a `regional-census-fact` explicitly does not. Equal names, designations, masses, or page numbers do not merge observations across catalogs. Statistics count each parent record once, count every Victoria Land mass once, include no Hodge-Smith mass, and never multiply a reported mass by holding count.

### Harmonized Public Cards

The public presenter derives 24,556 display cards from 19,553 parent observations and the reviewed projection manifest: 5,739 direct specimens, 8,410 projected atomic specimens, 6,867 collection observations, 3,447 collection-representation observations, 84 regional observations, 6 dealer observations, and 3 source observations explicitly classified as not individual specimens. Projection changes display-card multiplicity only; statistics, citations, folio authorization, and source data remain parent-observation based. The default result count reports filtered specimen cards, while the explicit inclusive view reports its display-card and parent-observation totals.

Every card's top identifier starts with the established concise catalog label. The 13,440 available typed source identifiers are appended unchanged, for example **Nininger (1933) · 9b**, so equal source numbers from different catalogs remain distinguishable. Another 5,058 projected cards append an exact evidence-bound **Catalog no.** value; the remaining 6,058 cards show the concise catalog shortname alone. Projected cards divide into 241 typed, 5,058 numbered, and 3,111 shortname-only identifiers; direct cards remain 5,701 typed and 38 shortname-only. The 2,906 internal entry-order values are never presented as source identifiers. Stored source identifiers, internal order, searching, and sorting remain unchanged. Populated names use **Meteorite name** for direct and projected specimens plus collection and regional observations, **Source name** for source observations, **Meteorite or locality name** for Fletcher collection-representation observations, and **Catalog name** for dealer observations. Null names retain the **Source catalog identifier** or **Source catalog record** fallback. Known specimen facts appear in this order: **Class**, **Specimen form**, **Source locality**, **Individual find location**, **Event**, **Lineage**, and **Specimen weight**. Complete field-aware unavailability statements are omitted, while compound statements that retain evidence remain verbatim. **Specimen form** appears only as **Individual specimen** when that narrower form is established; the tautological **Specimen form: Specimen** row is omitted. **Current Meteoritical Bulletin name** is inserted before those rows only when a reviewed current name differs substantively from the source-catalog name. Equivalent and unresolved current names omit the row. Fact labels and values share compact aligned columns at usable widths and stack below 520 px; typography and whole-word labels remain unchanged. General cards do not insert catalog-specific holdings, provenance, coordinate, mineral-chemistry, amendment, total, or occurrence-count labels. Fletcher context cards label event text **Date or report of find**, show **Reference** separately, and retain section, pane/case, and represented-weight text while stating that the observation is not a specimen, holding, or inventory identity.

The default unchecked filter shows exactly 13,977 source-listed specimen cards: 13,966 with finite numeric weight and 11 with reviewed qualitative weight evidence. It excludes all 10,407 observations and 172 source-unlisted specimen cards. Selecting **Include observations and specimens without weight** explicitly restores the complete 24,556-card register. Brown and Minnesota contribute 538 source-listed cards to the default view; their 11 former catalog-wide fallback cards are no longer treated as weighted without card-specific evidence.

`direct-specimen` and `projected-atomic-specimen` cards are specimen presentations. `source-observation`, `collection-observation`, `collection-representation-observation`, `regional-observation`, and `dealer-observation` cards are explicitly observations and omit specimen-only fields. **Specimen form** is controlled only by reviewed card kind; 8,683 projected atomic or Table A cards display **Individual specimen**, while 5,466 generic specimen cards omit the redundant form row. It is not inferred from locality, coordinates, names, MetBull data, or descriptive prose. **Source locality** preserves the catalog's locality scope and is not an individual find-location field. The 111 typed specimen locations display exactly; the other 14,038 specimen cards omit the unavailable **Individual find location** row.

### Reviewed Specimen Cards

`specimen-card-projections.json` is a schema-6 display-only positive allowlist whose metadata binds the schema-12 catalog, its 19,553 records, and its exact source hash. Every card references an immutable parent observation and exact public holding, then uses one closed evidence variant: a reviewed UTF-16 clause span, a qualitative clause span, or an exact typed Hamburg `componentPath`. Any variant may additionally carry closed `sourceCatalogNumber` evidence containing only the exact public value, same-holding text path, and UTF-16 half-open span. A clause card may carry a closed `repeatedMass` object with `massPath: null`; a qualitative clause card carries an affirmative source statement but no numeric mass. The manifest does not create observation or canonical-specimen IDs or copy unrestricted source prose. Grouped holdings, aggregate components, associated material, representations, counts, ranges, totals, dealer offers, and otherwise unprojected material remain observation or audit context.

The manifest covers 3,407 parent observations and 8,410 atomic specimen cards: 8,375 cards bind an exact `massPath`, 2 Kuleschowka cards bind the same 2.7 g per-item value through distinct `repeatedMass` occurrences, and 35 cards have no normalized display mass, including 10 qualitative cards. It retains 2,877 source-context audit partitions that are not rendered as specimens. Exact reviewed source-number coverage is Farrington 1903 (232), Farrington 1916 (1,100), Reeds 1937 (2,988), Prior 1923 (653), Tassin 1902 (84), and Merrill 1916 (1). Ensisheim remains 207 and 208; Nininger's 241 projected typed designations are not duplicated. Parent-row, ambiguous/multiple, external, private-only, and absent values receive no annotation. The six reviewed catalogs have blocked or undetermined folio policies, so visual source comparison requires their cited editions rather than in-app facsimiles. Bonn contributes 348 reviewed cards across 345 parents, including seven qualitative `Spl.` cards; its collection totals remain context and never become cards. Berlin contributes 838 reviewed cards; Greifswald, Fletcher, Story, and Prior representation catalogs contribute none. Search matching and statistics begin from all 19,553 parents across 52 catalogs; the default card filter then retains only source-listed specimens. Numeric lineage routing remains bound to exact non-null `massPath` values.

The lineage index retains 2,439 relationships and 21 source-attested n-ary groups, while the card presenter exposes only claims applicable to each exact card. The inclusive lineage-only view contains 963 cards and 1,451 displayed claims: 194 known same-inventory claims, 1,178 suspected cross-catalog claims, and 79 tentative source-group claims. Each closed claim includes typed status and caution text; relationship claims include available earlier/later source endpoint names, designations, masses, printed pages, and exact record-search links. Possible matches also retain available evidence strength and public review details. Stable relationship and group IDs remain in the data, DTOs, and routing but are not rendered as card details. These presentations do not establish physical identity, custody, ownership, transfer, or merge records.

### Reviewed MetBull Harmonization

Records with a reviewed source-name identity may additionally carry one optional `metbull` object:

```text
matchType, canonicalName, meteoriteCode, metbullUrl, alternateNameNote
```

`matchType` is exactly one of `exact`, `case-normalized-exact`, `source-heading-exact`, `historical-alias`, `corrected-spelling`, `translated-or-older-name`, or `unresolved`. `case-normalized-exact` is limited to names that differ only by Unicode letter case. Resolved reviews require a normalized current Meteoritical Bulletin name, a positive decimal code string, and the exact canonical HTTPS URL for that code. An `unresolved` review must keep all three canonical identity fields null. `alternateNameNote` is nullable explanatory text.

The historical `name`, designation/catalog identifier fields, printed private weight strings, and numeric source weights are never replaced by this object. A specimen displays a **Current Meteoritical Bulletin name** row only for a substantively different reviewed name. Display-equivalent and unresolved names omit the row. Comparison uses Unicode NFC, collapsed whitespace, and locale-aware lowercase. No client, build, or export path fuzzy-matches names or infers identity.

<!-- release-summary:readme-metbull:start -->
The current release includes reviewed MetBull harmonization for 14,861 of 19,553 records: 14,521 have a resolved current identity and 340 remain explicitly unresolved. 70 records currently have a null `name` value.
<!-- release-summary:readme-metbull:end -->

The remaining 4,692 records are pending observations without reviewed MetBull mappings. Story-Maskelyne 1872 contributes 132 pending observations, Prior 1926 contributes 47, and all 353 Bonn observations have closed reviews. Foote's six dealer observations intentionally have no MetBull mapping or current-name claim.

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
| `berlin-1903` | blocked | undetermined | 0 |
| `berlin-1904` | blocked | undetermined | 0 |
| `brauns-bonn-1926` | blocked | undetermined | 0 |
| `brown-1916` | blocked | undetermined | 0 |
| `buchner-1863` | blocked | undetermined | 0 |
| `chladni-1819` | display | public-domain | 12 |
| `chladni-1825` | blocked | undetermined | 0 |
| `farrington-1903` | blocked | undetermined | 0 |
| `farrington-1916` | blocked | undetermined | 0 |
| `fletcher-1886` | blocked | undetermined | 0 |
| `fletcher-1894` | blocked | undetermined | 0 |
| `fletcher-1896` | blocked | undetermined | 0 |
| `fletcher-1904` | blocked | undetermined | 0 |
| `fletcher-1908` | blocked | undetermined | 0 |
| `foote-1909` | blocked | undetermined | 0 |
| `foote-1912` | blocked | undetermined | 0 |
| `greifswald-1895` | blocked | undetermined | 0 |
| `greifswald-1901` | blocked | undetermined | 0 |
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
| `prior-guide-1926` | blocked | undetermined | 0 |
| `reeds-1937` | blocked | undetermined | 0 |
| `schreiter-1912` | blocked | undetermined | 0 |
| `story-maskelyne-1872` | blocked | undetermined | 0 |
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
