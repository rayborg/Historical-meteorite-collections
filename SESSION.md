# Project Session Memory

Last updated: 2026-07-26

## Mission

Build a durable, searchable historical meteorite catalog and, over time, reconstruct the ancestry/provenance of individual meteorite specimens across multiple historical collection catalogs. Each catalog record is a dated source observation, not automatically a unique canonical specimen. Keep the public static site suitable for GitHub Pages.

## Current State

- Schema 6 contains 2,034 facts-only records across eight catalogs:
  - Lucas 1813: 13 `collection-entry` records.
  - Chladni 1819: 74 `collection-entry` records.
  - Chladni 1825: 42 `collection-entry` records.
  - Hovey 1896: 25 `catalog-number` records.
  - Huss 1976: 1,078 `specimen` records.
  - Huss 1986: 544 `specimen` records.
  - Nininger 1933: 136 `catalog-item` records.
  - Nininger 1950: 122 `specimen` records from printed pages 26-33; page 33 begins Bennett County after Bendego closes on page 32 and closes Bishopville after four designated weighted fragments plus one undesignated, unweighed Small vial of fragments observation, with no boundary continuation.
- Metadata covers 156 source pages; records cite 139 of them.
- Public folios use schema 2 and expose 41 display pages: Lucas 1813 has 3 public-domain pages, Chladni 1819 has 12 public-domain pages, Hovey 1896 has 7 public-domain pages from BHL item 335869, and Nininger 1933 has 19 `no-copyright-us` pages.
- Chladni 1825, Huss 1976, Huss 1986, and Nininger 1950 remain blocked/undetermined for folio display.
- Nininger 1933 is incomplete: source pages 8-9 and catalog items 106-141 are missing.
- Reviewed MetBull harmonization covers all 2,034 records: 1,941 resolved and 93 explicitly unresolved. Validated continuation evidence recovers 218 formerly blank source names; seven historical entries genuinely print no separate proper source name and retain null names with unresolved reviews.
- The runtime suite passes 108 tests. The validator passes all 2,034 records, eight catalogs, and 41 public display pages.
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
- Lucas 1813, Chladni 1819, Hovey 1896, and Nininger 1933 are enabled only for the reviewed pages listed above.
- Chladni 1825 and both Huss catalogs remain facts-only until rights review supports a different policy. Ownership of a physical catalog and absence of a visible notice do not establish public-domain status.
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
