# Project Session Memory

Last updated: 2026-09-20

## Mission

Build a durable, searchable historical meteorite catalog and, over time, reconstruct the ancestry/provenance of individual meteorite specimens across multiple historical collection catalogs. Each catalog record is a dated source observation, not automatically a unique canonical specimen. Keep the public static site suitable for GitHub Pages.

## Current State

<!-- release-summary:session-current-state:start -->
- Schema 15 contains 20,241 facts-only records across 56 catalogs.
- Reviewed display projections replace 3,407 parents with 8,410 atomic cards: 25,244 descriptors comprise 14,234 specimens and 11,010 observations; weighted-only display excludes 172 unknown-mass specimens.

| `catalogId` | Record model | Records | Metadata source pages | Pages cited by records |
| --- | --- | ---: | ---: | ---: |
| `anderson-1913` | `collection-entry` | 57 | 26 | 13 |
| `antarctic-1980` | `appendix-specimen` | 85 | 2 | 2 |
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
| `farrington-north-america-1915` | `regional-event-fact` | 247 | 5 | 5 |
| `fletcher-1886` | `collection-representation-fact` | 375 | 26 | 26 |
| `fletcher-1894` | `collection-representation-fact` | 461 | 30 | 30 |
| `fletcher-1896` | `collection-representation-fact` | 481 | 31 | 31 |
| `fletcher-1904` | `collection-representation-fact` | 562 | 38 | 38 |
| `fletcher-1908` | `collection-representation-fact` | 585 | 41 | 41 |
| `foote-1909` | `dealer-offer-fact` | 6 | 2 | 2 |
| `foote-1912` | `collection-entry` | 205 | 35 | 25 |
| `greifswald-1895` | `collection-entry` | 145 | 11 | 11 |
| `greifswald-1901` | `collection-entry` | 281 | 21 | 21 |
| `haag-2003` | `caption-observation-fact` | 250 | 146 | 134 |
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
| `silberrad-1932` | `regional-event-fact` | 106 | 13 | 13 |
| `story-maskelyne-1872` | `collection-representation-fact` | 303 | 8 | 8 |
| `tassin-1902` | `collection-entry` | 340 | 26 | 24 |
| `usnm-1886` | `collection-entry` | 349 | 11 | 11 |
| `victoria-land-1982` | `table-a-specimen` | 273 | 10 | 4 |
| `ward-1881` | `collection-entry` | 3 | 1 | 1 |
| `ward-1904` | `collection-entry` | 697 | 74 | 74 |
| `washington-1897` | `collection-entry` | 201 | 4 | 4 |
| **Total** |  | **20,241** | **1,899** | **1,710** |

- Metadata covers 1,899 catalog-scoped source pages; records cite 1,710 of them.
- Nininger coverage is derived without page-boundary assumptions: `nininger-1933` has 171 records; its metadata source pages span 1-20, and its record citations span 1-11. `nininger-1950` has 1,678 records; its metadata source pages span 26-104, and its record citations span 26-104.
- Public folios use schema 2 and expose 49 display pages across 5 catalogs: `chladni-1819` (12 pages, `public-domain`); `haidinger-1859` (6 pages, `public-domain`); `hovey-1896` (7 pages, `public-domain`); `lucas-1813` (3 pages, `public-domain`); `nininger-1933` (21 pages, `no-copyright-us`).
- Blocked folio catalogs are: `anderson-1913` (0 pages, `undetermined`); `antarctic-1980` (0 pages, `undetermined`); `astapovich-1938` (0 pages, `undetermined`); `asu-2024-09` (0 pages, `undetermined`); `ball-1882` (0 pages, `undetermined`); `barnes-1940` (0 pages, `undetermined`); `berlin-1903` (0 pages, `undetermined`); `berlin-1904` (0 pages, `undetermined`); `brauns-bonn-1926` (0 pages, `undetermined`); `brown-1916` (0 pages, `undetermined`); `buchner-1863` (0 pages, `undetermined`); `chladni-1825` (0 pages, `undetermined`); `farrington-1903` (0 pages, `undetermined`); `farrington-1916` (0 pages, `undetermined`); `farrington-north-america-1915` (0 pages, `undetermined`); `fletcher-1886` (0 pages, `undetermined`); `fletcher-1894` (0 pages, `undetermined`); `fletcher-1896` (0 pages, `undetermined`); `fletcher-1904` (0 pages, `undetermined`); `fletcher-1908` (0 pages, `undetermined`); `foote-1909` (0 pages, `undetermined`); `foote-1912` (0 pages, `undetermined`); `greifswald-1895` (0 pages, `undetermined`); `greifswald-1901` (0 pages, `undetermined`); `haag-2003` (0 pages, `undetermined`); `hamburg-1913` (0 pages, `undetermined`); `hodge-smith-1939` (0 pages, `undetermined`); `hogbom-1902` (0 pages, `undetermined`); `huss-1976` (0 pages, `undetermined`); `huss-1986` (0 pages, `undetermined`); `kanagawa-1996` (0 pages, `undetermined`); `kantor-1920` (0 pages, `undetermined`); `madrid-1923` (0 pages, `undetermined`); `mason-1964` (0 pages, `undetermined`); `merrill-1916` (0 pages, `undetermined`); `minnesota-1892` (0 pages, `undetermined`); `nininger-1950` (0 pages, `undetermined`); `nordenskiold-1870` (0 pages, `undetermined`); `palache-1926` (0 pages, `undetermined`); `prior-1923` (0 pages, `undetermined`); `prior-guide-1926` (0 pages, `undetermined`); `reeds-1937` (0 pages, `undetermined`); `schreiter-1912` (0 pages, `undetermined`); `silberrad-1932` (0 pages, `undetermined`); `story-maskelyne-1872` (0 pages, `undetermined`); `tassin-1902` (0 pages, `undetermined`); `usnm-1886` (0 pages, `undetermined`); `victoria-land-1982` (0 pages, `undetermined`); `ward-1881` (0 pages, `undetermined`); `ward-1904` (0 pages, `undetermined`); `washington-1897` (0 pages, `undetermined`).
- Reviewed MetBull harmonization covers 15,299 of 20,241 records: 14,606 resolved and 693 explicitly unresolved.
- Records currently having a null `name` value: 82.
<!-- release-summary:session-current-state:end -->

- The remaining 4,942 records are pending observations without reviewed MetBull mappings.
- The schema-1 current MetBull specimen-context sidecar is SHA-256 `18ee18a7396c06d928a30580efc1dfa2c585c0446ae85796b42ce85e44b0ac0e`. Its exhaustive 14,234-card assignment maps 11,859 cards from 7,736 parents to 2,548 Official codes and leaves 2,375 cards unmapped. The direct partition is 5,653 mapped/171 unmapped; the projected partition is 6,206 mapped/2,204 unmapped.
- Public card-binding SHA-256 `cd49c34ca0539ca94e95d1677c724bf8ebe7ce635c92f080fc8cea0f6eefe48d` covers all 14,234 ordered card keys, routes, parents, projected positions, mapping statuses, codes, and canonical names and fails closed on public mapping drift. Distinct sidecar provenance digest `131daf40b44e07e71de896ad9d6e375e03931e33af4a2e8e7a152d8ebbff8150` additionally includes full Official-row hashes in the private audit; only the digest value is public.
- Current Official name, classification, place, year, and fall/find are meteorite-event context only. All 14,234 specimens use the neutral primary contract `Name`, `Class`, `Place`, `Fall / find`, `Year / date`, `Form`, `Find location`, and `Weight`, omitting unavailable values. Current values take precedence and recorded source values are fallbacks without inference. Differing source context and all other specimen details remain under collapsed `Show specimen notes`; observations retain `Show catalog notes` and all existing labels. Current class is not match likelihood because reviewed code identity is already established. Official mass, coordinates, comments, and the raw CSV are excluded.
- Following MetBull Database Note 4, fall code `Y` displays as `Fall`, empty as `Find`, `Yc` as `Confirmed fall (Yc)`, `Yp` as `Probable fall (Yp)`, and `Np` as `Find, possible fall (Np)`; these are event categories, not mapping confidence. `Nd` exists in the 80,224-row acquired CSV but is unused, unsupported by the public sidecar, and requires explicit handling before any future use.
- Private provenance remains at `data/private/metbull-current-context-2026-09-12/acquisition.json` and `data/private/metbull-current-context-2026-09-12/specimen-card-audit.json`. The CSV SHA-256 is `1e22fb5cac0e46628e73e74f2ad3dac15240fd247ccffa621bf89539c5b18d68`; the audit SHA-256 is `f705358e9d80a08cd09194f7d0cd3e68c2ded3540a073796fb5d99b1269e8d41`.
- Fletcher 1886/1894/1896/1904/1908 contribute 2,464 `collection-representation-fact` observations. List and pane values are not inventory identifiers; represented weights are context, not specimen masses. They create no projection cards or lineage endpoints, expose no private source UUIDs, and remain folio-blocked/undetermined.
- Hodge-Smith 1939 contributes 84 `regional-census-fact` observations: 77 numbered Australian falls and 7 additional falls, with 58 resolved reviews and 26 pending records. Controlled Australian Museum representation facts remain searchable source data but are omitted from harmonized cards; no specimen, holding, mass, custody, or ownership claim is made.
- Antarctic 1980 contributes 85 independent `appendix-specimen` observations bounded to Appendix 1: 54 rows cite printed page 47 and 31 cite page 48; Appendix 2 is excluded. All 85 preserve unique `ALHA77` IDs, positive source masses totaling 89,891.1 g, source classifications and Allan Hills locality facts, with 9 null olivine Fa, 7 null pyroxene Fs, and 6 null weathering values retained as unavailable rather than zero or inferred. Its folio is blocked/undetermined with no public pages or media.
- Victoria Land 1982 contributes 273 individual `table-a-specimen` observations from Table A on cited pages 85-88 within descriptor pages 85-94. Every Table A, Table B, and Table C reference is descriptor-scoped. Exact specimen IDs, one primary mass per specimen, classifications, localities, mineral chemistry, weathering, citations, and accepted `official-abbreviation` mappings are public. Closed normalized evidence retains 270 Table B cross-views and deterministic labels for 40 mass, 2 classification, and 8 weathering conflicts; raw rows remain private. The primary masses total 969,562.2 g and are counted once each, while the 40 mass-conflict records are excluded from comparison candidate generation.
- Chladni 1825 pages 200-207 are introductory folios.
- Tassin 1902 metadata includes plate page 671 and introductory page 673; its 340 entries cite pages 675-698.
- Schreiter 1912 metadata spans pages 58-75; its 162 entries cite pages 66-73.
- Mason 1964 metadata spans pages 1-40; its 1,374 catalog-number observations cite 33 of those pages.
- ASU September 2024 has 2,169 facts-only specimen observations across 53 pages, 2,166 unique designations, and only the designations `91`, `157`, and `607` duplicated.
- ASU has 2,088 reviewed exact-name MetBull mappings and 81 pending observations that carry no canonical identity. It has no public image assets and remains folio-blocked with undetermined rights.
- Barnes 1940 has 70 facts-only collection entries across metadata pages 583-612, with 48 reviewed exact-name MetBull mappings and 22 pending observations that carry no canonical identity. Its source material, OCR, notes, and assets remain private; it has no public folios and remains blocked with undetermined rights.
- Palache 1926 has 361 facts-only collection entries and holdings across nine metadata pages, 151-159. Introduction-only page 151 has no records; records cite pages 152-159. Its holdings contain 717 numeric gram values totaling 2,695,373.57 g, with 285 reviewed exact-name MetBull mappings and 76 pending observations. Its source PDF and images, OCR/transcription, raw text, notes, source typography, filenames, page IDs, derivatives, manifests, and uncertainty internals remain private; it has no public media and remains folio-blocked with undetermined rights.
- Kanagawa 1996 has 232 facts-only collection entries and holdings on all 20 pages 4-22 and 24: 80 meteorite and 152 tektite/natural-glass observations. Its 243 gram values total 2,688,123.61 g across 213 weighted records. Controlled descriptions comprise 212 `Specimen`, 19 `Thin section`, and 1 `Specimen group`; 68 entries have reviewed exact MetBull mappings and 164 remain pending. Source PDF and images, OCR, source prose, dimensions, notes, derivatives, manifest, paths, QA page, private page IDs, folios, and media remain excluded, and its folio is blocked/undetermined.
- Merrill 1916 has 560 facts-only collection entries citing 170 pages; El Capitan now retains only 66 g, 753 g, and 4,000 g, and all 560 observations remain pending mapping review. Prior 1923 has 949 facts-only collection entries citing all 196 metadata pages, with 758 reviewed exact-name mappings and 191 pending observations. Reeds 1937 has 500 facts-only collection entries citing 111 of 156 metadata pages, with 390 reviewed exact-name mappings and 110 pending observations; Mantos Blancos is exactly `Siderite: Fine octahedrite, Of.`. All three are blocked/undetermined with empty folios and no public images.
- Ward 1881 has 3 facts-only collection entries citing its single metadata page; all 3 remain pending mapping review. Ward 1904 has 697 facts-only collection entries citing all 74 metadata pages, with 49 reviewed exact-name mappings and 648 pending observations. Farrington 1916 has 738 facts-only collection entries citing 78 of 82 metadata pages, with 469 reviewed exact-name mappings and 269 pending observations. All three are blocked/undetermined with empty folios and no public images.
- Foote 1912 has 205 facts-only collection entries across 35 metadata pages, with records citing 25 pages, 227 holdings and numeric gram values, 132 reviewed exact-name mappings, and 73 pending observations. Its source material and media remain private, and its folio is blocked/undetermined with zero pages.
- Anderson 1913 has 57 fully reviewed facts-only entries (52 resolved and 5 unresolved); Kantor 1920 has 30 fully reviewed entries (27 resolved and 3 unresolved); Astapovich 1938 has 90 fully reviewed entries (81 resolved and 9 unresolved). All three are blocked/undetermined with empty folios and no public images.
- Madrid 1923 has 130 fully reviewed facts-only collection entries citing pages 226-233 within metadata pages 224-233. Its 168 holdings comprise 151 `Specimen` and 17 `Specimen group` descriptions with 168 normalized masses totaling 190,083.41 g; this detailed-entry sum remains distinct from the source's narrative collection-total claim. The reviews are 84 resolved and 46 unresolved. Madrid has no public media or private evidence, remains folio-blocked/undetermined, and projects 23 multi-holding parents into 54 atomic specimen cards; its 5 context partitions are audit-only and are not rendered as specimens.
- The schema-6 projection manifest contains 3,407 projected parents, 8,410 atomic cards, 2,877 non-displayed context audit partitions, and 5,058 exact source catalog numbers: Farrington 1903 (232), Farrington 1916 (1,100), Reeds 1937 (2,988), Prior 1923 (653), Tassin 1902 (84), and Merrill 1916 (1). Ensisheim remains 207 and 208. Parent-row, ambiguous/multiple, external, private-only, and absent values remain unannotated; the six catalogs have blocked or undetermined public folios, so source comparison relies on citations rather than in-app facsimiles. Existing paths, clauses, masses, card order, parent IDs, and lineage data remain unchanged.
- Every one of the 25,244 card identifiers starts with its concise catalog shortname. Typed specimen and projection identifiers remain unchanged; Haag caption observations remain source-scoped and do not acquire specimen identifiers. Internal entry order is never used as a specimen fallback.
- The harmonized presenter derives 25,244 cards from 20,241 parent observations: 5,824 direct specimens, 8,410 projected atomic specimens, 6,867 collection observations, 3,447 collection-representation observations, 250 caption observations, 84 regional observations, 353 regional-event observations, 6 dealer observations, and 3 not-individual source observations. The 14,234 specimen cards expose only the eight approved primary labels; source differences, descriptions, Victoria/Antarctic details, and full lineage/comparison UI are contained by specimen notes. Story, Prior, Farrington 1915, Silberrad, and Haag context cards preserve source facts without specimen claims.
- The unchecked default is strict: it shows 14,062 source-listed specimen cards, partitioned as 14,051 numeric and 11 qualitative; it excludes all 11,010 observations and 172 source-unlisted specimen cards. The inclusive 25,244-card state is explicit and uses `weighted=0`; omitted, malformed, duplicate, and legacy `weighted=1` states remain strict.
- The schema-4 lineage artifact has SHA-256 `834b766339614485513d50e5efdcfac0c66b3a9871de73b8533f1978f459fbd2`. It contains 279 identity-consistent same-inventory relationships, including 85 Antarctic-to-Victoria links, and 21 source-attested groups with 89 occurrences covering 87 unique exact source IDs. True lineage routing exposes 303 cards and 358 claims: 279 known inventory-designation continuity claims and 79 tentative source-attested group occurrences.
- The 85 Antarctic-to-Victoria links preserve exact identifier continuity between independent observations only. They do not merge records or assert unchanged physical specimens or masses, custody, ownership, or transfer. Antarctic masses are excluded from comparison generation, and current Official context is code-bound display context rather than continuity evidence or a replacement for either catalog's source facts.
- `scripts/metbull-lineage-isolation.test.mjs` proves the current-context sidecar is not a lineage input: accepted, absent, and adversarially changed sidecars reproduce exact lineage bytes plus identical relationship/candidate IDs, evidence strengths, grouping, and counts. It also rejects public Official mass and coordinate keys.
- The separate cross-catalog comparison layer has 1,541 groups containing 2,245 candidates: 1,323 singleton and 218 ambiguous groups; 2,014 exact-mass and 231 near-mass candidates; 906 reviewed `retain-as-possible` and 1,339 unreviewed. Comparison routing exposes 1,717 cards and 1,889 top-level group occurrences. Comparisons never enter lineage-only. A MetBull code identifies a meteorite event rather than a physical specimen, and mass is comparison evidence only; grouped alternatives such as Holbrook 98 avoid pairwise false precision. No comparison asserts lineage, physical identity, custody, ownership, transfer, or merge.
- Nininger 1933 includes printed pages 1-20; pages 12-20 are narrative-only, and the printed catalog numbering skips item 139.
- The latest release candidate passes the runtime suite and integrated public validator; both must continue to pass before release.
- Wide desktop result grids use four fluid columns only when the complete non-single filtered result set contains direct or projected specimen cards exclusively. Mixed and observation sets remain three columns, and the existing 1200 px and 700 px responsive reductions remain two and one columns.
- Validated continuation evidence recovers formerly blank source names where supported, without inferring modern identity. Reviewed historical entries that genuinely print no separate proper source name retain null names and unresolved reviews.
- `scripts/folio-release-lock.json` pins the reviewed rights evidence, ordered page IDs, and SHA-256 digest of every public folio.

## Latest Completed Catalogs

- `story-maskelyne-1872` and `prior-guide-1926` add 303 and 680 source-local collection-representation observations with zero specimen cards or lineage endpoints. `brauns-bonn-1926` adds 353 collection entries, 348 reviewed atomic cards, and 10 reviewed comparison candidates retained as possible without lineage, same-inventory, or merge claims. All three folios and source media remain blocked.
- `fletcher-1886`, `fletcher-1894`, `fletcher-1896`, `fletcher-1904`, and `fletcher-1908` integrate the five Lazarus Fletcher British Museum editions with 375, 461, 481, 562, and 585 principal-list observations. Together they have 1,632 resolved mappings and 832 explicit unresolved reviews.
- `hodge-smith-1939` integrates T. Hodge-Smith, *Australian Meteorites* (1939), with 84 regional census/catalog observations that are explicitly not specimen cards or holdings.
- `antarctic-1980` integrates Ursula B. Marvin and Brian Mason, *Catalog of Antarctic Meteorites, 1977-1978* (1980), with 85 independent Appendix 1 specimens from printed pages 47-48, 85 positive source masses totaling 89,891.1 g, exact retained nulls, blocked folios, and 85 identifier-continuity links to the later Victoria Land observations without merges or custody claims.
- `victoria-land-1982` integrates Ursula B. Marvin and Brian Mason, *Catalog of Meteorites from Victoria Land, Antarctica, 1978-1980* (1982), with 273 individual Table A specimens.
- `hamburg-1913` integrates E. Horn, *Die Meteoritensammlung des Mineralogisch-Geologischen Instituts zu Hamburg* (1913), with 147 fully reviewed `collection-entry` observations: 98 resolved and 49 unresolved.
- `madrid-1923` integrates Lucas Fernández Navarro, *Los Meteoritos del Museo de Madrid* (1923), with 130 fully reviewed facts-only `collection-entry` observations, 168 holdings, 84 resolved MetBull mappings, and 46 unresolved reviews.
- `anderson-1913` integrates C. Anderson, *A Catalogue and Bibliography of Australian Meteorites, with Census and Taxonomy* (1913), with 57 fully reviewed facts-only `collection-entry` observations: 52 resolved and 5 unresolved.
- `kantor-1920` integrates M. Kantor, *Guía y catálogo de la colección de meteoritos existentes en el Museo de La Plata, con especial mención de los meteoritos argentinos* (1920), with 30 fully reviewed facts-only `collection-entry` observations: 27 resolved and 3 unresolved.
- `astapovich-1938` integrates I. S. Astapowitsch, *A List of the Meteorites of the Soviet Union* (1938), with 90 fully reviewed facts-only `collection-entry` observations: 81 resolved and 9 unresolved.
- `foote-1912` integrates Warren M. Foote, *The Foote Collection of Meteorites* (1912), with 205 facts-only `collection-entry` observations, 132 reviewed exact-name MetBull mappings, and 73 pending observations.
- `ward-1881` integrates Henry A. Ward, *Meteorites, in Ward's Natural Science Bulletin, volume 1 number 1* (1881), with 3 facts-only `collection-entry` observations on page 4, all pending MetBull mapping review.
- `ward-1904` integrates Henry A. Ward, *Catalogue of the Ward-Coonley Collection of Meteorites* (1904), with 697 facts-only `collection-entry` observations, 49 reviewed exact-name MetBull mappings, and 648 pending observations.
- `farrington-1916` integrates Oliver Cummings Farrington, *Catalogue of the Collection of Meteorites* (1916), with 738 facts-only `collection-entry` observations, 469 reviewed exact-name MetBull mappings, and 269 pending observations.
- `merrill-1916` integrates George P. Merrill, *Handbook and Descriptive Catalogue of the Meteorite Collections in the United States National Museum* (1916), with 560 facts-only `collection-entry` observations citing 170 pages.
- `prior-1923` integrates G. T. Prior, *Catalogue of Meteorites* (1923), with 949 facts-only `collection-entry` observations citing all 196 metadata pages, 758 reviewed exact-name MetBull mappings, and 191 pending observations.
- `reeds-1937` integrates Chester A. Reeds, *Catalogue of the Meteorites in the American Museum of Natural History as of October 1, 1935* (1937), with 500 facts-only `collection-entry` observations, 390 reviewed exact-name MetBull mappings, and 110 pending observations.
- `MCB-141` is integrated as `palache-1926`: Charles Palache, *Catalogue of the collection of meteorites in the Mineralogical Museum of Harvard University* (1926), with 361 facts-only `collection-entry` observations across metadata pages 151-159 and record citations on pages 152-159.
- `MCB-165` is integrated as `barnes-1940`: Virgil E. Barnes, *Catalogue of Texas Meteorites* (1940), with 70 facts-only `collection-entry` observations across metadata pages 583-612, 48 reviewed exact-name MetBull mappings, and 22 pending observations without canonical identity.
- `MCB-197` is integrated as `kanagawa-1996`: the Kanagawa Prefectural Museum of Natural History, *Meteorite Catalogue of the Kanagawa Prefectural Museum of Natural History / 隕石目録* (issued 1996-01-31), with 232 facts-only `collection-entry` observations on pages 4-22 and 24.
- `MCB-204` is integrated as `asu-2024-09`: the September 2024 Arizona State University dataset, configured as compiled by the Buseck Center for Meteorite Studies, Arizona State University, with 2,169 facts-only `specimen` observations across 53 pages.
- `MCB-175` is integrated as `mason-1964`: Brian Mason, *The Meteorite and Tektite Collection of the American Museum of Natural History* (1964), with 1,374 `catalog-number` observations across printed pages 1-40.
- `MCB-199` is integrated as `haag-2003`: Robert Haag, *Robert Haag Meteorite Catalog 2003*, with 250 `caption-observation-fact` records across 134 cited pages and no specimen, MetBull, projection, lineage, or comparison effects.
- `MCB-117` is integrated as `schreiter-1912`: R. Schreiter, *Die Meteoriten des Kgl. Mineralogischen Museums in Dresden* (1912), with 162 ordered `collection-entry` records citing printed pages 66-73.
- `MCB-86` is integrated as `tassin-1902`: Wirt Tassin, *Descriptive Catalogue of the Meteorite Collection in the United States National Museum to January 1, 1902* (1902), with 340 ordered `collection-entry` records citing printed pages 675-698.
- `MCB-94` is integrated as `farrington-1903`: Oliver Cummings Farrington, *Catalogue of the Collection of Meteorites, May 1, 1903* (1903), with 251 ordered `collection-entry` records citing printed pages 83-120.
- All eighteen catalogs are facts-only and retain blocked folio policies with undetermined rights and no public images. Anderson, Kantor, and Astapovich are now fully reviewed with 160 resolved and 17 unresolved observations; unresolved reviews carry no canonical identity.

## Active Work State

- The accepted canonical integrations are the source for the current 56-catalog, 20,241-record schema-15 facts-only public candidate, which retains 49 reviewed public folios.
- Cards display only known, nonredundant facts and source identifiers; complete field-aware unavailability statements are omitted while compound evidence remains. Every card starts with a concise catalog shortname: 13,881 typed source identifiers retain their suffixes, including 250 Haag `Caption observation <entryOrder>` identifiers; 5,058 reviewed projected cards append an evidence-bound catalog number; and 6,305 cards use the shortname alone. The 3,153 internal entry-order values on other record models never become display identifiers. Mapped specimens use current values and unmapped specimens use recorded source fallbacks under the same neutral eight-field contract. Generic direct cards show `Form: Specimen`; projected, Appendix, and Table A cards show `Form: Individual specimen`. Specimen notes contain source differences and non-contract facts, with lineage/comparison disclosures nested inside rather than rendered as standalone card sections. Observations retain their original labels and layout. Specimen facts use 4.5-5.75 rem aligned label columns through 520 px and stack below 350 px without smaller typography. The homepage links to the dedicated catalog directory and separately to the bibliography master list.
- No release-blocking validation issue remains. Any future public change must still be produced from the private canonical data and pass deterministic byte comparison and the facts-only privacy checks.

## Preservation And Data Rules

- Never edit, recompress, rename, or delete original source images.
- Keep restricted scans and derivatives out of public history and output.
- Preserve scans, raw OCR, verbatim notes, filenames, and other source observations in the local-only archive so corrections and future research remain auditable.
- Public records retain only independently structured factual fields, catalog-scoped printed-page citations, and confidence. Image fields never enter records; only separately reviewed folio paths enter `folios.json`. Do not publish source filenames, raw text, verbatim notes, or unreviewed images, and do not infer illegible facts.
- Reconcile overlapping or duplicate photographs without discarding source provenance.
- Weight filtering uses normalized numeric grams. Dedicated private `weightText` and display fields are excluded from public records, while independently structured factual description prose may retain source-reported historical mass statements.
- Optional reviewed `metbull` fields preserve current canonical names, stable codes, and alternate-name notes without replacing source names, catalog identifiers, or weights. Unresolved reviews cannot claim a canonical identity.

## Publication Policy

- Public folio access is opt-in through a separate manifest and is never inferred from a source's age or publication year.
- Each displayed source requires an explicit reviewed rights status, display policy, and safe asset path.
- Display is enabled only for the reviewed catalogs and pages in the generated current-state summary above.
- Blocked catalogs remain facts-only until rights review supports a different policy. Ownership of a physical catalog and absence of a visible notice do not establish public-domain status.
- Validate every release against accidental disclosure of restricted scans, filenames, OCR, notes, and private paths.

## Provenance Model Direction

Likely future concepts, without prematurely implementing a final schema:

- `Catalog`: a named, dated source publication or collection catalog, such as Huss 1976 or Huss 1986.
- `CatalogEntry` / `Observation`: one dated source row recording what a catalog said; it is not inherently a canonical specimen.
- `Meteorite` / `Fall`: canonical meteorite identity independent of any particular physical fragment.
- `CanonicalSpecimen`: a physical specimen inferred or established across observations.
- `NameAlias`: historical names, spelling variants, and aliases that refer to the same meteorite/fall.
- `ProvenanceEvent`: ownership, transfer, division, cutting, sampling, reweighing, or other dated changes.
- `CandidateMatch`: a reviewable proposed link between observations and/or a canonical specimen.

Candidate matching should combine canonical meteorite identity, historical names/aliases, exact or approximate observed weight (an initial tolerance to investigate is about +/- 1 to 2 grams), catalog/collection identity and date, specimen description, and provenance context. Private source observations may support future matching and review, while public data remains limited to independently structured facts, page citation, and confidence. Name or weight similarity may propose links but must never silently assert identity. Preserve match confidence, rationale, alternate candidates, source citations, private evidence references, and human-review status in the appropriate public/private layer.

Distinct specimens with the same meteorite name and similar mass must not be collapsed. Mass can change through cutting, sampling, rounding, unit conventions, or transcription, so a mismatch may be meaningful without disproving identity and a close match does not prove identity.

## Website Direction

- Use this exact public deck wording: `A searchable transcription of Historic Meteorite Collection catalogs`
- Keep the site static, dependency-light, responsive, accessible, and durable under the GitHub Pages project subpath.
- Preserve the antique scientific catalog / old natural-history book visual language rather than using a generic dashboard.
- Retain case-insensitive text/designation/catalog-item/holding search, numeric weight ranges across all holding masses, deterministic sorting, result counts, clear empty states, page-cited factual records, keyboard usability, and reduced-motion support.
- Render public folios only for sources and pages explicitly enabled by the reviewed manifest.
- Avoid remote runtime dependencies where practical.

## Immediate Next Steps

1. Preserve the current 56-catalog facts-only public release candidate. Commit or push only when explicitly requested.
2. Keep all currently blocked catalogs, including Antarctic 1980, Madrid 1923, Anderson 1913, Kantor 1920, Astapovich 1938, Foote 1912, Ward 1904, and Farrington 1916, blocked unless separate catalog-specific rights reviews explicitly authorize exact ordered page sets; source age or online availability alone is insufficient.
3. Select the next processable bibliography control only after preserving and validating the current 56-catalog release candidate.
4. Resolve the missing scan for `SP1949-0039` (currently MCB-107) and correct the source evidence for MCB-4 and MCB-5 when primary evidence is available.
5. Keep schema 15 validation, deterministic private/public equality, release summaries, lineage checks, folio hashes, Node tests, runtime checks, and the facts-only privacy boundary green for every future release.
6. For every future catalog, mapping, or card-projection change, regenerate current MetBull context from a newly acquired SHA-256-pinned Official CSV, audit every resulting specimen card, retain unmapped cards as source-only, and rerun lineage isolation before release.

## Maintenance Rule

Update this file whenever project scope, data assumptions, architecture, provenance, deployment state, or next steps materially change. It is the first file a future session should read.
