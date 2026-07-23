# Project Session Memory

Last updated: 2026-07-23

## Mission

Build a durable, searchable historical meteorite catalog and, over time, reconstruct the ancestry/provenance of individual meteorite specimens across multiple historical collection catalogs. Each catalog row is a dated source observation, not automatically a unique canonical specimen. The public static site belongs at `https://github.com/rayborg/Historical-meteorite-collections` and should remain suitable for GitHub Pages.

## Source Scope

- The user owns the physical 1976 Glenn Huss Meteorite Collection catalog; ownership of the physical book does not establish copyright status.
- Pages 3-48 were digitized as 46 photographed folios.
- No rights notice was visible in those interior pages, but the front matter was absent. No public-domain determination was made, so the user chose a conservative facts-only public site.
- Glenn Huss published Huss collection catalogs in 1976 and 1986.
- The coordinated local schema-4 dataset covers Hovey 1896, Huss 1976, Huss 1986, and Nininger 1933. The 90 original images documented for the two Huss catalogs and Nininger catalog, and their OCR, remain private. No Hovey images are public.

## Current State

- GitHub repository: `https://github.com/rayborg/Historical-meteorite-collections`
- The coordinated local schema-4 dataset contains 1,783 facts-only observations: 25 Hovey 1896, 1,078 Huss 1976, 544 Huss 1986, and 136 Nininger 1933. It has not been deployed.
- A separate private preservation archive retains the full scans, raw OCR, verbatim notes, and scan-linked site materials; operational coordinates are intentionally kept outside public history.
- The original approximately 433 MB of source photographs remain in the ignored `source-images/`.
- All four local catalogs remain blocked/undetermined for folio display. Public output contains no scans, source filenames, raw OCR, verbatim notes, or private image paths; no Hovey images are public.
- Local metadata schema version 4 keeps both Huss catalogs as scalar `specimen` records, represents each numbered Nininger entry as one `catalog-item` parent with ordered holdings, and represents Hovey as `catalog-number` records with ordered holding groups. The 136 Nininger items contain 310 reviewed holdings: 298 designated, 12 anonymous, 304 gram-bearing, 4 casts, and 2 count-only.
- The runtime, validator, `data/catalog.json`, and `data/folios.json` are validation-green for strict schema 4. Hovey catalog numbers remain searchable but are excluded from records-with-designation summaries, matching the private exporter and the descriptor's zero count. Both integrated and synthetic-only validation pass.
- Schema 4 catalog-number records use opaque catalog-scoped identifiers, ordered holding groups with provenance and nested weights, discovery-date text, and one or more catalog pages. Counts are reported group facts and must not be interpreted as counts of physical specimens; nested masses are never multiplied by count.
- Hovey contributes 25 records, 33 holding groups, 55 reported pieces, 34 reported weights, and 36,534.7 reported grams across pages 149-155. Three Hovey records span two pages. Its descriptor and runtime both report 0 records with specimen designations and 25 records with weights; catalog numbers remain independently searchable.
- Local metadata covers 92 catalog-scoped pages and records cite 83. Hovey folios remain `blocked`/`undetermined`; the real local manifest and schema-4 fixture contain no Hovey folio pages, and no Hovey images are public.
- The schema-4 release preserves the previous 1,758-record public prefix byte-for-byte at the record level and appends the 25 Hovey observations. It remains facts-only: no private registry, OCR, manifest, scan filename, or source-image path is a runtime dependency.
- The tracked runtime harness passes 93 tests. Integrated validation accepts all 1,783 records across four catalogs and confirms that all folio policies remain blocked/undetermined with no displayable pages.

## Preservation And Data Rules

- Never edit, recompress, rename, or delete files in `source-images/`.
- `source-images/` remains excluded from Git because the originals total approximately 433 MB; do not publish those Huss images or derivatives on the public branch.
- Preserve scans, raw OCR, verbatim notes, filenames, and other source observations in the local-only archive so corrections and future research remain auditable.
- Public records retain only independently structured factual fields, a catalog-scoped printed-page citation, and confidence. Do not publish images, source filenames, raw text, or verbatim notes, and do not infer illegible facts.
- Reconcile overlapping or duplicate photographs without discarding source provenance.
- Weight filtering uses normalized numeric grams, while the printed value remains preserved privately.

## Publication Policy

- The public site should retain technical folio-display capability for older books whose copyright/public-domain status has been affirmatively established.
- Public folio access is opt-in through a separate manifest and is never inferred from a source's age or publication year.
- Each source enabled for public folio display requires an explicit display policy, affirmative public-domain status, safe asset paths, and source-specific review.
- `huss-1976` is not opted in: its rights remain unresolved, so its scans and filenames must remain blocked from public output even though the site can technically display approved folios from other sources.
- Current `huss-1976` public content is limited to independently structured factual fields, with a 1976 catalog page citation and confidence for each record. Its scans, image derivatives, source filenames, raw OCR, and verbatim notes are local-only and must not enter public git history, site assets, data, or metadata.
- Keep the public Git history scan-free and validate every release for restricted source material before deployment.
- The absence of a visible rights notice on pages 3-48 is not a public-domain determination because the front matter was not available.

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
- Retain folio-display infrastructure, but render public folios only for sources explicitly enabled by the separate reviewed manifest; `huss-1976` must remain facts-only.
- Avoid remote runtime dependencies where practical.

## Immediate Next Steps

1. Keep the public validator and runtime harness green for every release.
2. Preserve the facts-only boundary and verify private paths remain unavailable after deployment.
3. Require a separate catalog-specific rights review before enabling any folio display.

## Maintenance Rule

Update this file whenever project scope, data assumptions, architecture, provenance, deployment state, or next steps materially change. It is the first file a future session should read.
