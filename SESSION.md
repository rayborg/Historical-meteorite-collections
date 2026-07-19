# Project Session Memory

Last updated: 2026-07-19

## Mission

Build a durable, searchable historical meteorite catalog and, over time, reconstruct the ancestry/provenance of individual meteorite specimens across multiple historical collection catalogs. Each catalog row is a dated source observation, not automatically a unique canonical specimen. The public static site belongs at `https://github.com/rayborg/Historical-meteorite-collections` and should remain suitable for GitHub Pages.

## Source Scope

- The user owns the physical 1976 Glenn Huss Meteorite Collection catalog; ownership of the physical book does not establish copyright status.
- Pages 3-48 were digitized as 46 photographed folios.
- No rights notice was visible in those interior pages, but the front matter was absent. No public-domain determination was made, so the user chose a conservative facts-only public site.
- Glenn Huss published Huss collection catalogs in 1976 and 1986.
- The 1986 catalog is a future source and is **not represented anywhere in the current image set**.
- The originals are 46 JPEG photographs in the ignored `source-images/`, imported on 2026-07-19. They total approximately 433 MB; four earlier same-day photographs were intentionally excluded from the source set.

## Current State

- GitHub repository: `https://github.com/rayborg/Historical-meteorite-collections`
- Pages 3-48 are OCR-complete.
- Normalization currently yields 1,079 catalog records.
- A separate local-only preservation archive and server retain the full scans, raw OCR, verbatim notes, and scan-linked site materials; operational coordinates are intentionally kept outside public history.
- The original approximately 433 MB of source photographs remain in the ignored `source-images/`.
- The GitHub repository was temporarily made private. Its single history is being replaced with a scan-free orphan history before the repository is made public and deployed.
- The current `huss-1976` public data is facts-only: it supports discovery from independently structured factual records without publishing scans, source filenames, raw OCR, or verbatim notes.
- The separate local-only preservation archive and server remain unchanged.

## Preservation And Data Rules

- Never edit, recompress, rename, or delete files in `source-images/`.
- `source-images/` remains excluded from Git because the originals total approximately 433 MB; do not publish those Huss images or derivatives on the public branch.
- Preserve scans, raw OCR, verbatim notes, filenames, and other source observations in the local-only archive so corrections and future research remain auditable.
- Public records retain only independently structured factual fields, a 1976 catalog page citation, and confidence. Do not publish images, source filenames, raw text, or verbatim notes, and do not infer illegible facts.
- Reconcile overlapping or duplicate photographs without discarding source provenance.
- Weight filtering uses normalized numeric grams, while the printed value remains preserved.

## Publication Policy

- The public site should retain technical folio-display capability for older books whose copyright/public-domain status has been affirmatively established.
- Public folio access is opt-in through a separate manifest and is never inferred from a source's age or publication year.
- Each source enabled for public folio display requires an explicit display policy, affirmative public-domain status, safe asset paths, and source-specific review.
- `huss-1976` is not opted in: its rights remain unresolved, so its scans and filenames must remain blocked from public output even though the site can technically display approved folios from other sources.
- Current `huss-1976` public content is limited to independently structured factual fields, with a 1976 catalog page citation and confidence for each record. Its scans, image derivatives, source filenames, raw OCR, and verbatim notes are local-only and must not enter public git history, site assets, data, or metadata.
- Keep the GitHub repository private until its existing single history has been replaced by the scan-free orphan history and the resulting public tree has been checked for restricted source material.
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
- Retain case-insensitive text/designation search, numeric weight ranges, deterministic sorting, result counts, clear empty states, page-cited factual records, keyboard usability, and reduced-motion support.
- Retain folio-display infrastructure, but render public folios only for sources explicitly enabled by the separate reviewed manifest; `huss-1976` must remain facts-only.
- Avoid remote runtime dependencies where practical.

## Immediate Next Steps

1. Complete and validate the scan-free orphan history, checking all tracked files and history for Huss scans, derivatives, source filenames, raw OCR, and verbatim notes.
2. Replace the private repository history, then make the repository public and deploy the facts-only GitHub Pages site.
3. Verify all 1,079 public records contain only independently structured facts, the correct 1976 catalog page citation, and confidence.
4. Test search, weight filtering, responsive layouts, accessibility, and project-subpath asset paths on the public candidate build; verify `huss-1976` cannot expose folios or filenames when absent from the opt-in manifest.
5. Preserve the local-only archive and ignored originals, and keep public wording from implying that catalog entries are canonical physical specimens.
6. Design a small, reviewable candidate-matching workflow before ingesting the future 1986 catalog; allow private observations to support review but do not expose them publicly or auto-merge records.
7. For any future folio source, document affirmative public-domain status, explicit display policy, safe asset paths, and completed source-specific review before adding it to the public manifest.
8. Record the deployed public site URL here after publication.

## Maintenance Rule

Update this file whenever project scope, data assumptions, architecture, provenance, deployment state, or next steps materially change. It is the first file a future session should read.
