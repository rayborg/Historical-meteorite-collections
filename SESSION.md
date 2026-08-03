# Project Session Memory

Last updated: 2026-08-02

## Mission

Build a durable, searchable historical meteorite catalog and, over time, reconstruct the ancestry/provenance of individual meteorite specimens across multiple historical collection catalogs. Each catalog record is a dated source observation, not automatically a unique canonical specimen. Keep the public static site suitable for GitHub Pages.

## Current State

<!-- release-summary:session-current-state:start -->
- Schema 6 contains 9,481 facts-only records across 22 catalogs.

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
| `palache-1926` | `collection-entry` | 361 | 9 | 8 |
| `schreiter-1912` | `collection-entry` | 162 | 18 | 8 |
| `tassin-1902` | `collection-entry` | 340 | 26 | 24 |
| `usnm-1886` | `collection-entry` | 349 | 11 | 11 |
| `washington-1897` | `collection-entry` | 201 | 4 | 4 |
| **Total** |  | **9,481** | **486** | **431** |

- Metadata covers 486 catalog-scoped source pages; records cite 431 of them.
- Nininger coverage is derived without page-boundary assumptions: `nininger-1933` has 171 records; its metadata source pages span 1-20, and its record citations span 1-11. `nininger-1950` has 1,678 records; its metadata source pages span 26-104, and its record citations span 26-104.
- Public folios use schema 2 and expose 49 display pages across 5 catalogs: `chladni-1819` (12 pages, `public-domain`); `haidinger-1859` (6 pages, `public-domain`); `hovey-1896` (7 pages, `public-domain`); `lucas-1813` (3 pages, `public-domain`); `nininger-1933` (21 pages, `no-copyright-us`).
- Blocked folio catalogs are: `asu-2024-09` (0 pages, `undetermined`); `ball-1882` (0 pages, `undetermined`); `barnes-1940` (0 pages, `undetermined`); `buchner-1863` (0 pages, `undetermined`); `chladni-1825` (0 pages, `undetermined`); `farrington-1903` (0 pages, `undetermined`); `hogbom-1902` (0 pages, `undetermined`); `huss-1976` (0 pages, `undetermined`); `huss-1986` (0 pages, `undetermined`); `mason-1964` (0 pages, `undetermined`); `nininger-1950` (0 pages, `undetermined`); `nordenskiold-1870` (0 pages, `undetermined`); `palache-1926` (0 pages, `undetermined`); `schreiter-1912` (0 pages, `undetermined`); `tassin-1902` (0 pages, `undetermined`); `usnm-1886` (0 pages, `undetermined`); `washington-1897` (0 pages, `undetermined`).
- Reviewed MetBull harmonization covers 8,159 of 9,481 records: 8,030 resolved and 129 explicitly unresolved.
- Records currently having a null `name` value: 13.
<!-- release-summary:session-current-state:end -->

- The remaining 1,322 records are pending observations without reviewed MetBull mappings.
- Chladni 1825 pages 200-207 are introductory folios.
- Tassin 1902 metadata includes plate page 671 and introductory page 673; its 340 entries cite pages 675-698.
- Schreiter 1912 metadata spans pages 58-75; its 162 entries cite pages 66-73.
- Mason 1964 metadata spans pages 1-40; its 1,374 catalog-number observations cite 33 of those pages.
- ASU September 2024 has 2,169 facts-only specimen observations across 53 pages, 2,166 unique designations, and only the designations `91`, `157`, and `607` duplicated.
- ASU has 2,088 reviewed exact-name MetBull mappings and 81 pending observations that carry no canonical identity. It has no public image assets and remains folio-blocked with undetermined rights.
- Barnes 1940 has 70 facts-only collection entries across metadata pages 583-612, with 48 reviewed exact-name MetBull mappings and 22 pending observations that carry no canonical identity. Its source material, OCR, notes, and assets remain private; it has no public folios and remains blocked with undetermined rights.
- Palache 1926 has 361 facts-only collection entries and holdings across nine metadata pages, 151-159. Introduction-only page 151 has no records; records cite pages 152-159. Its holdings contain 717 numeric gram values totaling 2,695,373.57 g, with 285 reviewed exact-name MetBull mappings and 76 pending observations. Its source PDF and images, OCR/transcription, raw text, notes, source typography, filenames, page IDs, derivatives, manifests, and uncertainty internals remain private; it has no public media and remains folio-blocked with undetermined rights.
- The regenerated lineage index contains 503 relationships: 195 same-inventory relationships and 308 unreviewed possible cross-source matches. Palache participates in 39 possible matches (38 exact mass and 1 near mass), Barnes participates in 57, and ASU participates in 10. None is a registered edition series, and Palache has no same-inventory relationships.
- Nininger 1933 includes printed pages 1-20; pages 12-20 are narrative-only, and the printed catalog numbering skips item 139.
- The latest release candidate passes the runtime suite and integrated public validator; both must continue to pass before release.
- Validated continuation evidence recovers formerly blank source names where supported, without inferring modern identity. Reviewed historical entries that genuinely print no separate proper source name retain null names and unresolved reviews.
- `scripts/folio-release-lock.json` pins the reviewed rights evidence, ordered page IDs, and SHA-256 digest of every public folio.

## Latest Completed Catalogs

- `MCB-141` is integrated as `palache-1926`: Charles Palache, *Catalogue of the collection of meteorites in the Mineralogical Museum of Harvard University* (1926), with 361 facts-only `collection-entry` observations across metadata pages 151-159 and record citations on pages 152-159.
- `MCB-165` is integrated as `barnes-1940`: Virgil E. Barnes, *Catalogue of Texas Meteorites* (1940), with 70 facts-only `collection-entry` observations across metadata pages 583-612, 48 reviewed exact-name MetBull mappings, and 22 pending observations without canonical identity.
- `MCB-204` is integrated as `asu-2024-09`: the September 2024 Arizona State University dataset, configured as compiled by the Buseck Center for Meteorite Studies, Arizona State University, with 2,169 facts-only `specimen` observations across 53 pages.
- `MCB-175` is integrated as `mason-1964`: Brian Mason, *The Meteorite and Tektite Collection of the American Museum of Natural History* (1964), with 1,374 `catalog-number` observations across printed pages 1-40.
- `MCB-117` is integrated as `schreiter-1912`: R. Schreiter, *Die Meteoriten des Kgl. Mineralogischen Museums in Dresden* (1912), with 162 ordered `collection-entry` records citing printed pages 66-73.
- `MCB-86` is integrated as `tassin-1902`: Wirt Tassin, *Descriptive Catalogue of the Meteorite Collection in the United States National Museum to January 1, 1902* (1902), with 340 ordered `collection-entry` records citing printed pages 675-698.
- `MCB-94` is integrated as `farrington-1903`: Oliver Cummings Farrington, *Catalogue of the Collection of Meteorites, May 1, 1903* (1903), with 251 ordered `collection-entry` records citing printed pages 83-120.
- All seven catalogs are facts-only and retain blocked folio policies with undetermined rights and no public images. Reviewed exact-name MetBull coverage resolves Palache 285, Barnes 48, ASU 2,088, Mason 1,099, Schreiter 72, Tassin 192, and Farrington 170 observations; pending observations carry no canonical identity.

## Active Work State

- Private canonical Palache commit `0a19f55` is pushed. The 22-catalog Palache facts-only public release is the current uncommitted release candidate; preserve this dirty worktree before rebasing or regeneration.
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

1. Preserve the current uncommitted 22-catalog Palache public release candidate. Commit or push only when explicitly requested.
2. Keep MCB-86, MCB-94, MCB-117, MCB-141, MCB-165, MCB-175, and MCB-204 folios blocked unless separate catalog-specific rights reviews explicitly authorize exact ordered page sets; source age or online availability alone is insufficient.
3. Select the next processable bibliography control only after preserving and validating the current 22-catalog release candidate.
4. Resolve the missing scan for `SP1949-0039` (currently MCB-107) and correct the source evidence for MCB-4 and MCB-5 when primary evidence is available.
5. Keep schema 6 validation, deterministic private/public equality, release summaries, lineage checks, folio hashes, Node tests, runtime checks, and the facts-only privacy boundary green for every future release.

## Maintenance Rule

Update this file whenever project scope, data assumptions, architecture, provenance, deployment state, or next steps materially change. It is the first file a future session should read.
