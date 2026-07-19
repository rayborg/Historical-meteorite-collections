# Historical Meteorite Collection

A dependency-free, facts-only public index derived from pages 3-48 of the 1976 Huss Meteorite Collection catalog. The source catalog is associated with Glenn Huss; this project does not make a broader claim about who compiled or published every part of it.

The site supports segment-aware H-designation search, full-text factual search, numeric gram ranges, six deterministic sort orders, URL-persisted filters, and incremental rendering for the 1,079-entry register. A separate, default-deny rights manifest can enable folio viewing for future catalogs whose source pages have a documented public-domain determination.

## Local Preview

The site uses `fetch`, so serve the repository through a local HTTP server:

```sh
python3 -m http.server 8000
```

Visit `http://localhost:8000/`. No installation or build step is required.

## GitHub Pages

1. Push the repository to GitHub.
2. Open **Settings > Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the publishing branch, normally `main`, and the root (`/`) folder.

All runtime URLs are relative, so the site works at a GitHub Pages project subpath without configuration.

## Public Data Scope

The browser loads factual records only from `./data/catalog.json`. Its root contract is `{ metadata, records }`. Every public record contains exactly:

```text
id, catalogId, designation, name, weight: { grams }, classification,
locality, year, catalogPage, confidence
```

The index presents structured specimen facts: designation, name, normalized mass, classification, locality, recorded year, 1976 catalog page, and transcription confidence. Null weights are excluded whenever a numeric weight filter is active.

## Rights-Gated Folios

The client may also request optional `./data/folios.json`. This file contains display authorization and paths, not catalog facts. Its contract is:

```text
{ schemaVersion: 1, catalogs: {
  [catalogId]: { displayPolicy, rightsStatus, pages }
} }
```

A folio control is created only when all of these conditions hold:

- The entire manifest is present and valid with `schemaVersion: 1` and a nonempty `catalogs` object.
- The record's `catalogId` has `displayPolicy: "display"`, which is structurally valid only with `rightsStatus: "public-domain"` based on a documented determination.
- The record's catalog page contains exactly required `image` and `alt` keys, with an optional `thumbnail` key and no others.
- `image` and any `thumbnail` are plain relative paths rooted exactly under `assets/folios/`, contain a filename, use only ASCII letters, digits, dots, underscores, and hyphens in each segment, and end in lowercase `.webp`, `.png`, `.jpg`, `.jpeg`, or `.avif`.
- Paths contain no whitespace, scheme, leading slash, backslash, query, fragment, percent encoding, empty segment, duplicate slash, `.` segment, or `..` segment.
- `alt` is nonempty NFC-normalized plain text with normalized whitespace, no HTML, backticks, Markdown link/image syntax, control characters, or invisible format characters, and no more than 160 Unicode characters.

Every other condition denies display. An empty, missing, or malformed manifest, missing catalog or page, blocked policy with pages, `display` without `public-domain`, unsafe path, invalid alt text, wrong key, or extra key leaves the factual catalog working without a folio control. The folio button opens `image` directly; the interface does not need to request or render `thumbnail`. The client never infers eligibility from a catalog's publication year or apparent age.

The 1976 Huss catalog is blocked by policy. Its scans remain private, no Huss folio controls or image requests are produced, and this project does not claim that source is in the public domain.

## Private Local Archive

Huss page scans, raw OCR, verbatim notes, page-layout reproductions, source filenames, and working transcription material are intentionally excluded from the public edition. Any such material retained in a private local research archive is not a runtime dependency and should not be committed or deployed with the site.

The public client has no fallback loader for private material. If `catalog.json` is missing or does not match the facts-only schema, the interface shows an accessible error state. Failure of the optional folio manifest does not prevent factual records from loading.

## Limitations

- This is an independently structured factual index, not a facsimile or page-layout reproduction.
- Transcription confidence describes the project transcription, not the scientific certainty of a classification or historical statement.
- Historical names, classifications, localities, years, and masses may be incomplete, outdated, or erroneous in the source or transcription.
- Source rights status is unresolved. No public-domain, copyright-ownership, endorsement, or comprehensive publication-history claim is made.
- Folio display authorization is catalog-specific and page-specific. It is not a general legal conclusion or an automatic consequence of publication date.
- Corrections and takedown requests may be submitted through the repository's GitHub issues.

See [`NOTICE.md`](./NOTICE.md) for attribution and rights information.
