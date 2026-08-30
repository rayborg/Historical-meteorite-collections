# Project Session Memory

Last updated: 2026-08-30

## Mission

Build a durable, searchable historical meteorite catalog and, over time, reconstruct the ancestry/provenance of individual meteorite specimens across multiple historical collection catalogs. Each catalog record is a dated source observation, not automatically a unique canonical specimen. Keep the public static site suitable for GitHub Pages.

## Current State

<!-- release-summary:session-current-state:start -->
- Schema 7 contains 13,819 facts-only records across 35 catalogs.

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
| `hamburg-1913` | `collection-entry` | 147 | 27 | 11 |
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
| **Total** |  | **13,819** | **1,321** | **1,156** |

- Metadata covers 1,321 catalog-scoped source pages; records cite 1,156 of them.
- Nininger coverage is derived without page-boundary assumptions: `nininger-1933` has 171 records; its metadata source pages span 1-20, and its record citations span 1-11. `nininger-1950` has 1,678 records; its metadata source pages span 26-104, and its record citations span 26-104.
- Public folios use schema 2 and expose 49 display pages across 5 catalogs: `chladni-1819` (12 pages, `public-domain`); `haidinger-1859` (6 pages, `public-domain`); `hovey-1896` (7 pages, `public-domain`); `lucas-1813` (3 pages, `public-domain`); `nininger-1933` (21 pages, `no-copyright-us`).
- Blocked folio catalogs are: `anderson-1913` (0 pages, `undetermined`); `astapovich-1938` (0 pages, `undetermined`); `asu-2024-09` (0 pages, `undetermined`); `ball-1882` (0 pages, `undetermined`); `barnes-1940` (0 pages, `undetermined`); `buchner-1863` (0 pages, `undetermined`); `chladni-1825` (0 pages, `undetermined`); `farrington-1903` (0 pages, `undetermined`); `farrington-1916` (0 pages, `undetermined`); `foote-1912` (0 pages, `undetermined`); `hamburg-1913` (0 pages, `undetermined`); `hogbom-1902` (0 pages, `undetermined`); `huss-1976` (0 pages, `undetermined`); `huss-1986` (0 pages, `undetermined`); `kanagawa-1996` (0 pages, `undetermined`); `kantor-1920` (0 pages, `undetermined`); `madrid-1923` (0 pages, `undetermined`); `mason-1964` (0 pages, `undetermined`); `merrill-1916` (0 pages, `undetermined`); `nininger-1950` (0 pages, `undetermined`); `nordenskiold-1870` (0 pages, `undetermined`); `palache-1926` (0 pages, `undetermined`); `prior-1923` (0 pages, `undetermined`); `reeds-1937` (0 pages, `undetermined`); `schreiter-1912` (0 pages, `undetermined`); `tassin-1902` (0 pages, `undetermined`); `usnm-1886` (0 pages, `undetermined`); `ward-1881` (0 pages, `undetermined`); `ward-1904` (0 pages, `undetermined`); `washington-1897` (0 pages, `undetermined`).
- Reviewed MetBull harmonization covers 10,479 of 13,819 records: 10,238 resolved and 241 explicitly unresolved.
- Records currently having a null `name` value: 13.
<!-- release-summary:session-current-state:end -->

- The remaining 3,340 records are pending observations without reviewed MetBull mappings.
- Chladni 1825 pages 200-207 are introductory folios.
- Tassin 1902 metadata includes plate page 671 and introductory page 673; its 340 entries cite pages 675-698.
- Schreiter 1912 metadata spans pages 58-75; its 162 entries cite pages 66-73.
- Mason 1964 metadata spans pages 1-40; its 1,374 catalog-number observations cite 33 of those pages.
- ASU September 2024 has 2,169 facts-only specimen observations across 53 pages, 2,166 unique designations, and only the designations `91`, `157`, and `607` duplicated.
- ASU has 2,088 reviewed exact-name MetBull mappings and 81 pending observations that carry no canonical identity. It has no public image assets and remains folio-blocked with undetermined rights.
- Barnes 1940 has 70 facts-only collection entries across metadata pages 583-612, with 48 reviewed exact-name MetBull mappings and 22 pending observations that carry no canonical identity. Its source material, OCR, notes, and assets remain private; it has no public folios and remains blocked with undetermined rights.
- Palache 1926 has 361 facts-only collection entries and holdings across nine metadata pages, 151-159. Introduction-only page 151 has no records; records cite pages 152-159. Its holdings contain 717 numeric gram values totaling 2,695,373.57 g, with 285 reviewed exact-name MetBull mappings and 76 pending observations. Its source PDF and images, OCR/transcription, raw text, notes, source typography, filenames, page IDs, derivatives, manifests, and uncertainty internals remain private; it has no public media and remains folio-blocked with undetermined rights.
- Kanagawa 1996 has 232 facts-only collection entries and holdings on all 20 pages 4-22 and 24: 80 meteorite and 152 tektite/natural-glass observations. Its 243 gram values total 2,688,123.61 g across 213 weighted records. Controlled descriptions comprise 212 `Specimen`, 19 `Thin section`, and 1 `Specimen group`; 68 entries have reviewed exact MetBull mappings and 164 remain pending. Source PDF and images, OCR, source prose, dimensions, notes, derivatives, manifest, paths, QA page, private page IDs, folios, and media remain excluded, and its folio is blocked/undetermined.
- Merrill 1916 has 560 facts-only collection entries citing 170 pages; all 560 observations remain pending mapping review. Prior 1923 has 949 facts-only collection entries citing all 196 metadata pages, with 758 reviewed exact-name mappings and 191 pending observations. Reeds 1937 has 500 facts-only collection entries citing 111 of 156 metadata pages, with 390 reviewed exact-name mappings and 110 pending observations. All three are blocked/undetermined with empty folios and no public images.
- Ward 1881 has 3 facts-only collection entries citing its single metadata page; all 3 remain pending mapping review. Ward 1904 has 697 facts-only collection entries citing all 74 metadata pages, with 49 reviewed exact-name mappings and 648 pending observations. Farrington 1916 has 738 facts-only collection entries citing 78 of 82 metadata pages, with 469 reviewed exact-name mappings and 269 pending observations. All three are blocked/undetermined with empty folios and no public images.
- Foote 1912 has 205 facts-only collection entries across 35 metadata pages, with records citing 25 pages, 227 holdings and numeric gram values, 132 reviewed exact-name mappings, and 73 pending observations. Its source material and media remain private, and its folio is blocked/undetermined with zero pages.
- Anderson 1913 has 57 fully reviewed facts-only entries (52 resolved and 5 unresolved); Kantor 1920 has 30 fully reviewed entries (27 resolved and 3 unresolved); Astapovich 1938 has 90 fully reviewed entries (81 resolved and 9 unresolved). All three are blocked/undetermined with empty folios and no public images.
- Madrid 1923 has 130 fully reviewed facts-only collection entries citing pages 226-233 within metadata pages 224-233. Its 168 holdings comprise 151 `Specimen` and 17 `Specimen group` descriptions with 168 normalized masses totaling 190,083.41 g; this detailed-entry sum remains distinct from the source's narrative collection-total claim. The reviews are 84 resolved and 46 unresolved. Madrid has no public media or private evidence, remains folio-blocked/undetermined, and projects 23 multi-holding parents into 54 atomic specimen cards plus 5 context cards.
- Hamburg 1913 has 147 fully reviewed facts-only observations, 151 holdings, and 227 components, including 26 thin sections; 98 reviews are resolved and 49 unresolved. Its calculated base-component sum is 748,304.8 g versus the printed 748,304.9 g. After the source-reported disposal of one 14,500 g Gibeon component and addition of the 51-stone, 490.6 g Holbrook supplement, the revised calculated total is 734,295.4 g versus the printed 734,295.5 g. Hamburg projects 104 atomic cards and 43 grouped context cards. Its source scans, OCR, transcription files, private notes and evidence, paths, folios, and media remain excluded; it is blocked/undetermined with no public assets.
- The regenerated lineage index contains 1,489 relationships: 195 same-inventory relationships and 1,294 possible cross-source matches. Of these candidates, 1,290 are unreviewed and Hamburg's four reviewed candidates are retained only as possible; none asserts physical identity, custody, ownership, or transfer. The possible matches comprise 1,071 exact-mass and 223 near-mass candidates. Madrid adds exactly three unreviewed possible matches and no same-inventory claim.
- Nininger 1933 includes printed pages 1-20; pages 12-20 are narrative-only, and the printed catalog numbering skips item 139.
- The latest release candidate passes the runtime suite and integrated public validator; both must continue to pass before release.
- Validated continuation evidence recovers formerly blank source names where supported, without inferring modern identity. Reviewed historical entries that genuinely print no separate proper source name retain null names and unresolved reviews.
- `scripts/folio-release-lock.json` pins the reviewed rights evidence, ordered page IDs, and SHA-256 digest of every public folio.

## Latest Completed Catalogs

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
- `MCB-117` is integrated as `schreiter-1912`: R. Schreiter, *Die Meteoriten des Kgl. Mineralogischen Museums in Dresden* (1912), with 162 ordered `collection-entry` records citing printed pages 66-73.
- `MCB-86` is integrated as `tassin-1902`: Wirt Tassin, *Descriptive Catalogue of the Meteorite Collection in the United States National Museum to January 1, 1902* (1902), with 340 ordered `collection-entry` records citing printed pages 675-698.
- `MCB-94` is integrated as `farrington-1903`: Oliver Cummings Farrington, *Catalogue of the Collection of Meteorites, May 1, 1903* (1903), with 251 ordered `collection-entry` records citing printed pages 83-120.
- All eighteen catalogs are facts-only and retain blocked folio policies with undetermined rights and no public images. Anderson, Kantor, and Astapovich are now fully reviewed with 160 resolved and 17 unresolved observations; unresolved reviews carry no canonical identity.

## Active Work State

- The accepted canonical integrations are the source for the current 35-catalog, 13,819-record facts-only public candidate, which retains 49 reviewed public folios.
- Every reviewed record card now exposes its MetBull review: resolved canonical names are linked even when equal to source names, and unresolved reviews are explicitly shown without a link. The homepage links to the dedicated 35-card catalog directory and separately to the bibliography master list.
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

1. Preserve the current 35-catalog facts-only public release candidate. Commit or push only when explicitly requested.
2. Keep all currently blocked catalogs, including Madrid 1923, Anderson 1913, Kantor 1920, Astapovich 1938, Foote 1912, Ward 1904, and Farrington 1916, blocked unless separate catalog-specific rights reviews explicitly authorize exact ordered page sets; source age or online availability alone is insufficient.
3. Select the next processable bibliography control only after preserving and validating the current 35-catalog release candidate.
4. Resolve the missing scan for `SP1949-0039` (currently MCB-107) and correct the source evidence for MCB-4 and MCB-5 when primary evidence is available.
5. Keep schema 7 validation, deterministic private/public equality, release summaries, lineage checks, folio hashes, Node tests, runtime checks, and the facts-only privacy boundary green for every future release.

## Maintenance Rule

Update this file whenever project scope, data assumptions, architecture, provenance, deployment state, or next steps materially change. It is the first file a future session should read.
