# Historical Meteorite Collection

The repository's coordinated local schema-4 data is a dependency-free, facts-only index of 1,783 observations from four historical meteorite catalogs. It is staged locally and has not been deployed.

A searchable transcription of the 1976 Huss Meteorite Collection catalog, compiled and published by Glenn Huss.

The other configured source attributions identify compilers only: Edmund Otis Hovey for the 1896 catalog, Glenn I. Huss for the 1986 catalog, and H. H. Nininger for the 1933 catalog. No publisher is inferred for those sources.

The site supports catalog filtering, segment-aware H-designation search, catalog-item, catalog-number, and holding search, numeric gram ranges across specimen and nested holding masses, six deterministic sort orders, URL-persisted filters, and incremental rendering. A separate, default-deny rights manifest can enable folio viewing for future catalogs whose source pages have a documented public-domain determination.

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

The runtime, validator, `data/catalog.json`, and `data/folios.json` are all locally staged and validation-green for schema 4. The live GitHub Pages deployment remains the earlier schema-3 release with 1,758 observations from three catalogs. The local files are not deployed, and this documentation makes no deployment claim for schema 4. Hovey catalog numbers remain searchable identifiers but are not designations, so its descriptor correctly reports zero `recordsWithDesignation`.

## Public Data Scope

The browser loads factual records only from `./data/catalog.json`. The local schema-version-4 data has root contract `{ metadata, records }`; every catalog descriptor includes `recordModel`, one of `specimen`, `catalog-item`, or `catalog-number`. The first two record shapes are unchanged from schema 3.

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

A `catalog-number` record contains exactly:

```text
id, catalogId, catalogNumber, holdings, name, classification, locality,
dateOfDiscovery, catalogPages, confidence
```

Its holdings contain exactly `description`, `provenance`, `count`, and `weights`; each weight contains exactly `{ grams }`. Description is required normalized nonempty text, provenance is normalized nonempty text or `null`, count is a positive integer or `null`, and weights is a nonempty source-order array of finite nonnegative gram values. Catalog numbers are normalized, nonempty, opaque strings. They are unique within a catalog but are not parsed as arithmetic fractions and need not increase. `catalogPages` is a nonempty ordered unique array of positive descriptor-scoped page numbers. The runtime searches the catalog number, common facts, date of discovery, holding descriptions, and provenance; displays `Catalog no.`, every holding fact and mass, and every source-page citation; and labels count as a reported group count rather than a physical-specimen total.

The coordinated local schema-4 data contains:

| `catalogId` | Configured source | Observations | Metadata source-page coverage | Pages cited by records |
| --- | --- | ---: | --- | --- |
| `hovey-1896` | Catalogue of meteorites in the collection of the American Museum of Natural History, to July 1, 1896 (1896) | 25 | 149-155 | 149-155 |
| `huss-1976` | Huss Meteorite Collection catalog (1976) | 1,078 | 3-48 | 3-48 |
| `huss-1986` | The Second Huss Collection of Meteorites (1986) | 544 | 3-23 | 3-23 |
| `nininger-1933` | The Nininger Collection of Meteorites (1933) | 136 | 1-7 and 10-20 | 1-7 and 10-11 |
| **Total** |  | **1,783** | **92 catalog-scoped pages** | **83 catalog-scoped pages** |

`catalogId` identifies the source catalog for each record. The 92-page figure is metadata source-page coverage, not a claim that every covered page is cited. Records cite 83 distinct catalog-scoped pages, and the same page number in different catalogs denotes different pages. The 25 Hovey records cite every page from 149 through 155; three records cite two pages. Catalog-item numbers are unique and strictly increasing within each catalog, but may contain gaps and restart in another catalog. A mass range matches a multi-holding record when any one holding mass satisfies the entire range. Weight ascending uses the minimum nested mass, weight descending uses the maximum, and statistics flatten and sum every reported mass once without multiplying by holding count while counting the parent record as one observation.

For `nininger-1933`, pages 8-9 are absent from the local source set. Pages 12-20 are included in metadata source-page coverage but are narrative-only, contain no observations, and are not cited by records. One Nininger observation represents one numbered catalog item, not each visible row or holding. Its structured holding facts remain in schema 4; verbatim `weightText`, transcription notes, and page-layout data remain private.

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

All four catalogs in the local coordinated data are blocked by policy with `rightsStatus: "undetermined"` and no page entries. Hovey remains `blocked`/`undetermined`, and no Hovey images are public. All source-image and display-derivative exports remain blocked, and this project does not claim that any source is in the public domain.

## Private Local Archive

The 90 original source images documented for the two Huss catalogs and Nininger catalog are held locally and ignored by Git. Image filenames, raw OCR, verbatim notes, holding-level source text such as `weightText`, page-layout reproductions, and working transcription material are intentionally excluded from the public edition. No Hovey images are public. Display derivatives may be tracked only in private history; none are part of the public repository or deployment while export remains blocked.

The public client has no fallback loader for private material. If `catalog.json` is missing or does not match the facts-only schema, the interface shows an accessible error state. Failure of the optional folio manifest does not prevent factual records from loading.

## Limitations

- This is an independently structured factual index, not a facsimile or page-layout reproduction.
- Transcription confidence describes the project transcription, not the scientific certainty of a classification or historical statement.
- Historical names, classifications, localities, years, and masses may be incomplete, outdated, or erroneous in the source or transcription.
- Source rights statuses are undetermined. No public-domain, copyright-ownership, endorsement, or comprehensive publication-history claim is made beyond the stated 1976 Huss attribution.
- Folio display authorization is catalog-specific and page-specific. It is not a general legal conclusion or an automatic consequence of publication date.
- Corrections and takedown requests may be submitted through the repository's GitHub issues.

See [`NOTICE.md`](./NOTICE.md) for attribution and rights information.
