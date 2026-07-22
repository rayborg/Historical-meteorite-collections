# Historical Meteorite Collection

A dependency-free, facts-only public index of 1,758 observations from three historical meteorite catalogs, built from 90 locally held original images.

A searchable transcription of the 1976 Huss Meteorite Collection catalog, compiled and published by Glenn Huss.

The other configured source attributions identify compilers only: Glenn I. Huss for the 1986 catalog and H. H. Nininger for the 1933 catalog. No publisher is inferred for either source.

The site supports catalog filtering, segment-aware H-designation search, catalog-item and holding search, numeric gram ranges across specimen and holding masses, six deterministic sort orders, URL-persisted filters, and incremental rendering. A separate, default-deny rights manifest can enable folio viewing for future catalogs whose source pages have a documented public-domain determination.

## Local Preview

The site uses `fetch`, so serve the repository through a local HTTP server:

```sh
python3 -m http.server 8000
```

Visit `http://localhost:8000/`. No installation or build step is required.

## GitHub Pages

1. Run `node scripts/validate-public-catalog.mjs`.
2. Run `node scripts/test-multicatalog.cjs`.
3. Push the repository to GitHub; the same checks run in `.github/workflows/validate.yml`.
4. Open **Settings > Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select the publishing branch, normally `main`, and the root (`/`) folder.

All runtime URLs are relative, so the site works at a GitHub Pages project subpath without configuration.

## Public Data Scope

The browser loads factual records only from `./data/catalog.json`. Schema version 3 has root contract `{ metadata, records }`; every catalog descriptor includes `recordModel`, either `specimen` or `catalog-item`.

A `specimen` record contains exactly:

```text
id, catalogId, designation, name, weight: { grams }, classification,
locality, year, catalogPage, confidence
```

A `catalog-item` record contains exactly:

```text
id, catalogId, catalogItem, holdings, name, classification, locality,
year, catalogPage, confidence
```

Each holding contains exactly:

```text
designation, kind, description, count, weight: { grams }
```

`designation` and `description` are strings or `null`; `kind` is `specimen`, `cast`, or `aggregate`; `count` is a positive integer or `null`; and `weight.grams` is a finite nonnegative number or `null`. A specimen holding requires designation and mass and has no count. A cast requires designation and has neither count nor mass. An aggregate requires a description and at least a count or mass. Counts are displayed generically as `Count: N`, without inferring the counted object. Huss descriptors use `specimen`. The Nininger descriptor uses `catalog-item`, preserving one parent observation per numbered item and its holdings in source order.

The release contains:

| `catalogId` | Configured source | Observations | Original images | Import batches | Metadata source-page coverage | Pages cited by records |
| --- | --- | ---: | ---: | ---: | --- | --- |
| `huss-1976` | Huss Meteorite Collection catalog (1976) | 1,078 | 46 | 12 | 3-48 | 3-48 |
| `huss-1986` | The Second Huss Collection of Meteorites (1986) | 544 | 25 | 7 | 3-23 | 3-23 |
| `nininger-1933` | The Nininger Collection of Meteorites (1933) | 136 | 19 | 5 | 1-7 and 10-20 | 1-7 and 10-11 |
| **Total** |  | **1,758** | **90** | **24** | **85 catalog-scoped pages** | **76 catalog-scoped pages** |

`catalogId` identifies the source catalog for each record. The 85-page figure is metadata source-page coverage, not a claim that every covered page is cited. `catalogPage` is a printed-page citation within that source; records cite 76 distinct catalog-scoped pages, and the same page number in different catalogs denotes different pages. Catalog-item numbers are unique and strictly increasing within each catalog, but may contain gaps and restart in another catalog. A mass range matches a catalog item when any one holding mass satisfies the entire range. Weight ascending uses a catalog item's minimum holding mass, weight descending uses its maximum, and statistics sum every holding mass once while counting the parent item as one observation.

For `nininger-1933`, pages 8-9 are absent from the local source set. Pages 12-20 are included in metadata source-page coverage but are narrative-only, contain no observations, and are not cited by records. One Nininger observation represents one numbered catalog item, not each visible row or holding. Its structured holding facts are public in schema 3; verbatim `weightText`, transcription notes, and page-layout data remain private.

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
- `image` and any `thumbnail` are plain relative paths rooted exactly under `assets/folios/<catalogId>/` for the authorized catalog, contain a filename, use only ASCII letters, digits, dots, underscores, and hyphens in each segment, and end in lowercase `.webp`, `.png`, `.jpg`, `.jpeg`, or `.avif`.
- Paths contain no whitespace, scheme, leading slash, backslash, query, fragment, percent encoding, empty segment, duplicate slash, `.` segment, or `..` segment.
- `alt` is nonempty NFC-normalized plain text with normalized whitespace, no HTML, backticks, Markdown link/image syntax, control characters, or invisible format characters, and no more than 160 Unicode characters.

Every other condition denies display. An empty, missing, or malformed manifest, missing catalog or page, blocked policy with pages, `display` without `public-domain`, unsafe path, invalid alt text, wrong key, or extra key leaves the factual catalog working without a folio control. The folio button opens `image` directly; the interface does not need to request or render `thumbnail`. The client never infers eligibility from a catalog's publication year or apparent age.

All three current catalogs are blocked by policy with `rightsStatus: "undetermined"` and no page entries. All public source-image and display-derivative exports are blocked, no folio controls or image requests are produced, and this project does not claim that any source is in the public domain.

## Private Local Archive

Original source images for all three catalogs are held locally and ignored by Git. Image filenames, raw OCR, verbatim notes, holding-level source text such as `weightText`, page-layout reproductions, and working transcription material are intentionally excluded from the public edition. Display derivatives may be tracked only in private history; none are part of the public repository or deployment while export remains blocked.

The public client has no fallback loader for private material. If `catalog.json` is missing or does not match the facts-only schema, the interface shows an accessible error state. Failure of the optional folio manifest does not prevent factual records from loading.

## Limitations

- This is an independently structured factual index, not a facsimile or page-layout reproduction.
- Transcription confidence describes the project transcription, not the scientific certainty of a classification or historical statement.
- Historical names, classifications, localities, years, and masses may be incomplete, outdated, or erroneous in the source or transcription.
- Source rights statuses are undetermined. No public-domain, copyright-ownership, endorsement, or comprehensive publication-history claim is made beyond the stated 1976 Huss attribution.
- Folio display authorization is catalog-specific and page-specific. It is not a general legal conclusion or an automatic consequence of publication date.
- Corrections and takedown requests may be submitted through the repository's GitHub issues.

See [`NOTICE.md`](./NOTICE.md) for attribution and rights information.
