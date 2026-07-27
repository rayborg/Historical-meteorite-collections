# Project Session Memory

Last updated: 2026-07-26

## Mission

Build a durable, searchable historical meteorite catalog and, over time, reconstruct the ancestry/provenance of individual meteorite specimens across multiple historical collection catalogs. Each catalog record is a dated source observation, not automatically a unique canonical specimen. Keep the public static site suitable for GitHub Pages.

## Current State

<!-- release-summary:session-current-state:start -->
- Schema 6 contains 2,276 facts-only records across 8 catalogs.

| `catalogId` | Record model | Records | Metadata source pages | Pages cited by records |
| --- | --- | ---: | ---: | ---: |
| `chladni-1819` | `collection-entry` | 74 | 12 | 12 |
| `chladni-1825` | `collection-entry` | 42 | 41 | 33 |
| `hovey-1896` | `catalog-number` | 25 | 7 | 7 |
| `huss-1976` | `specimen` | 1,078 | 46 | 46 |
| `huss-1986` | `specimen` | 544 | 21 | 21 |
| `lucas-1813` | `collection-entry` | 13 | 3 | 3 |
| `nininger-1933` | `catalog-item` | 136 | 18 | 9 |
| `nininger-1950` | `specimen` | 364 | 15 | 15 |
| **Total** |  | **2,276** | **163** | **146** |

- Metadata covers 163 catalog-scoped source pages; records cite 146 of them.
- Nininger coverage is derived without page-boundary assumptions: `nininger-1933` has 136 records; its metadata source pages span 1-20, and its record citations span 1-11. `nininger-1950` has 364 records; its metadata source pages span 26-40, and its record citations span 26-40.
- Public folios use schema 2 and expose 41 display pages across 4 catalogs: `chladni-1819` (12 pages, `public-domain`); `hovey-1896` (7 pages, `public-domain`); `lucas-1813` (3 pages, `public-domain`); `nininger-1933` (19 pages, `no-copyright-us`).
- Blocked folio catalogs are: `chladni-1825` (0 pages, `undetermined`); `huss-1976` (0 pages, `undetermined`); `huss-1986` (0 pages, `undetermined`); `nininger-1950` (0 pages, `undetermined`).
- Reviewed MetBull harmonization covers 2,276 of 2,276 records: 2,183 resolved and 93 explicitly unresolved.
- Records currently having a null `name` value: 7.
<!-- release-summary:session-current-state:end -->

- Chladni 1825 pages 200-207 are introductory folios.
- Nininger 1933 is incomplete: printed pages 8-9 and catalog items 106-141 are missing, and pages 12-20 are narrative-only.
- The runtime suite and integrated public validator must pass before release.
- Validated continuation evidence recovers formerly blank source names where supported, without inferring modern identity. Reviewed historical entries that genuinely print no separate proper source name retain null names and unresolved reviews.
- `scripts/folio-release-lock.json` pins the reviewed rights evidence, ordered page IDs, and SHA-256 digest of every public folio.

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

1. Locate and process Nininger 1933 pages 8-9 to recover missing catalog items 106-141.
2. Resolve the missing scan for MCB-104.
3. Correct the source evidence for MCB-4 and MCB-5.
4. Continue catalog-specific rights review, keeping unresolved sources blocked.
5. Keep the schema 6 validator and runtime suite green while preserving the facts-only boundary.

## Maintenance Rule

Update this file whenever project scope, data assumptions, architecture, provenance, deployment state, or next steps materially change. It is the first file a future session should read.
