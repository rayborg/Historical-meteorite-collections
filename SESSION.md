# Project Session Memory

Last updated: 2026-07-29

## Mission

Build a durable, searchable historical meteorite catalog and, over time, reconstruct the ancestry/provenance of individual meteorite specimens across multiple historical collection catalogs. Each catalog record is a dated source observation, not automatically a unique canonical specimen. Keep the public static site suitable for GitHub Pages.

## Current State

<!-- release-summary:session-current-state:start -->
- Schema 6 contains 4,467 facts-only records across 13 catalogs.

| `catalogId` | Record model | Records | Metadata source pages | Pages cited by records |
| --- | --- | ---: | ---: | ---: |
| `ball-1882` | `collection-entry` | 44 | 4 | 2 |
| `buchner-1863` | `collection-entry` | 185 | 5 | 5 |
| `chladni-1819` | `collection-entry` | 74 | 12 | 12 |
| `chladni-1825` | `collection-entry` | 42 | 41 | 33 |
| `haidinger-1859` | `collection-entry` | 137 | 6 | 5 |
| `hovey-1896` | `catalog-number` | 25 | 7 | 7 |
| `huss-1976` | `specimen` | 1,078 | 46 | 46 |
| `huss-1986` | `specimen` | 544 | 21 | 21 |
| `lucas-1813` | `collection-entry` | 13 | 3 | 3 |
| `nininger-1933` | `catalog-item` | 171 | 20 | 11 |
| `nininger-1950` | `specimen` | 1,678 | 79 | 79 |
| `nordenskiold-1870` | `collection-entry` | 127 | 10 | 10 |
| `usnm-1886` | `collection-entry` | 349 | 11 | 11 |
| **Total** |  | **4,467** | **265** | **245** |

- Metadata covers 265 catalog-scoped source pages; records cite 245 of them.
- Nininger coverage is derived without page-boundary assumptions: `nininger-1933` has 171 records; its metadata source pages span 1-20, and its record citations span 1-11. `nininger-1950` has 1,678 records; its metadata source pages span 26-104, and its record citations span 26-104.
- Public folios use schema 2 and expose 49 display pages across 5 catalogs: `chladni-1819` (12 pages, `public-domain`); `haidinger-1859` (6 pages, `public-domain`); `hovey-1896` (7 pages, `public-domain`); `lucas-1813` (3 pages, `public-domain`); `nininger-1933` (21 pages, `no-copyright-us`).
- Blocked folio catalogs are: `ball-1882` (0 pages, `undetermined`); `buchner-1863` (0 pages, `undetermined`); `chladni-1825` (0 pages, `undetermined`); `huss-1976` (0 pages, `undetermined`); `huss-1986` (0 pages, `undetermined`); `nininger-1950` (0 pages, `undetermined`); `nordenskiold-1870` (0 pages, `undetermined`); `usnm-1886` (0 pages, `undetermined`).
- Reviewed MetBull harmonization covers 3,625 of 4,467 records: 3,496 resolved and 129 explicitly unresolved.
- Records currently having a null `name` value: 9.
<!-- release-summary:session-current-state:end -->

- Chladni 1825 pages 200-207 are introductory folios.
- Nininger 1933 includes printed pages 1-20; pages 12-20 are narrative-only, and the printed catalog numbering skips item 139.
- The latest release candidate passes the runtime suite and integrated public validator; both must continue to pass before release.
- Validated continuation evidence recovers formerly blank source names where supported, without inferring modern identity. Reviewed historical entries that genuinely print no separate proper source name retain null names and unresolved reviews.
- `scripts/folio-release-lock.json` pins the reviewed rights evidence, ordered page IDs, and SHA-256 digest of every public folio.

## Latest Completed Catalog

- `MCB-20` is integrated as `buchner-1863`: Otto Buchner, *Die Meteoriten in Sammlungen, ihre Geschichte, mineralogische und chemische Beschaffenheit* (1863), specifically the embedded Vienna register under "System von P. Partsch" on Roman pages XIII-XVII.
- The public catalog contains 185 ordered `collection-entry` records: 22, 52, 48, 52, and 11 by page. It begins at Alais and ends at Hemalga before "System von G. Rose." Section counts are I.A.a 3, I.A.b 2, I.B.a 11, I.B.b 101, II.A 5, and II.B 63.
- `reportedNumber` remains null because the right-margin integers are monograph page locators, not row numbers. Dates, source sections, and Vienna holding status are retained without modern class, locality, weight, piece-count, provenance, or MetBull inference. Seven source-marked date uncertainties occur at orders 26, 40, 45, 76, 92, 114, and 117.
- The preface's statement of 194 Vienna fall localities is not reconciled by a row-level key; the bounded register visibly contains 185 rows, so no nine missing entries were invented.
- Buchner folios remain blocked with undetermined rights and no public images. Only independently structured facts were exported; private images, raw text, source filenames, notes, locators, and uncertainty details remain private.

## Active Work State

- The MCB-20 facts-only integration remains uncommitted and unpushed on branch `publish-nininger-pages-public` in `/private/var/folders/wp/r0y6_l7x6bz_0md8jcfjtsgr0000gp/T/opencode/hmc-public-publish`; its private source counterpart remains in the sibling `hmc-private-publish` worktree on branch `publish-nininger-pages`. Preserve both dirty worktrees before rebasing or regeneration.
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

1. Preserve the current uncommitted private/public catalog diffs. Commit or push only when explicitly requested.
2. Keep MCB-20 folios blocked unless a separate catalog-specific rights review explicitly authorizes an exact ordered page set; source age or Internet Archive availability alone is insufficient.
3. Select the next processable bibliography control only after preserving and validating the current 13-catalog release candidate.
4. Resolve the missing scan for `SP1949-0039` (currently MCB-107) and correct the source evidence for MCB-4 and MCB-5 when primary evidence is available.
5. Keep schema 6 validation, deterministic private/public equality, release summaries, lineage checks, folio hashes, Node tests, runtime checks, and the facts-only privacy boundary green for every future release.

## Maintenance Rule

Update this file whenever project scope, data assumptions, architecture, provenance, deployment state, or next steps materially change. It is the first file a future session should read.
