# Public catalog data

`catalog.json` is the coordinated local schema-4 facts-only dataset of 1,783 observations from four historical meteorite catalogs. It is staged locally and has not been deployed; the live site remains the earlier schema-3 release of 1,758 observations from three catalogs.

A searchable transcription of the 1976 Huss Meteorite Collection catalog, compiled and published by Glenn Huss.

The configured compilers are Edmund Otis Hovey for `hovey-1896`, Glenn I. Huss for `huss-1986`, and H. H. Nininger for `nininger-1933`; no publisher is inferred for those catalogs.

| `catalogId` | Observations | Metadata source-page coverage | Pages cited by records |
| --- | ---: | --- | --- |
| `hovey-1896` | 25 | 149-155 | 149-155 |
| `huss-1976` | 1,078 | 3-48 | 3-48 |
| `huss-1986` | 544 | 3-23 | 3-23 |
| `nininger-1933` | 136 | 1-7 and 10-20 | 1-7 and 10-11 |
| **Total** | **1,783** | **92 catalog-scoped pages** | **83 catalog-scoped pages** |

The 92-page figure is metadata source-page coverage, not a count of pages cited by records. Records cite 83 distinct catalog-scoped pages. Hovey records cite all seven covered pages, 149-155, and three records span two pages. For `nininger-1933`, pages 8-9 are absent from the local source set; pages 12-20 are included in source coverage but are narrative-only, contain no observations, and are not cited by records. Its observation unit is one numbered catalog item, not each visible row or holding. Multiple holdings listed under one item remain one observation; structured holding facts remain in schema 4, while verbatim `weightText` and notes remain private.

The 90 original images documented for the two Huss catalogs and Nininger catalog are held locally and ignored by Git. Image and source filenames, raw OCR, verbatim notes, private fields such as `weightText`, and page-layout reproductions are excluded from the public release. No Hovey images are public. Display derivatives may be tracked only in private history. No copyright status determination is made for the source catalogs or excluded material.

`folios.json` is a separate, deny-by-default display gate. All four catalog entries, including Hovey, have `displayPolicy: "blocked"`, `rightsStatus: "undetermined"`, and no page entries, so all public source-image and display-derivative exports are blocked. Matching policy values are repeated in `catalog.json` metadata to make each block explicit to catalog consumers; records never contain image fields.

## Data model

The JSON root contains `metadata` and `records`. The local runtime, validator, and data require schema version 4 and descriptor `recordModel` values `specimen`, `catalog-item`, or `catalog-number`.

`specimen` records, used by both Huss catalogs, have exactly these fields:

- `id`: stable unique identifier for this observation.
- `catalogId`: source catalog identifier: `huss-1976`, `huss-1986`, or `nininger-1933`.
- `designation`: designation reported for the observation, or `null`. The printed `(2)` prefix in Huss 1986 identifies the Second Huss Collection namespace; it is part of the designation, not a quantity.
- `name`: reported meteorite name, or `null`.
- `weight.grams`: reported weight normalized to a numeric gram value, or `null` when no unambiguous numeric value is available.
- `classification`: reported classification, or `null`.
- `locality`: reported locality, or `null`.
- `year`: reported year text, including any factual qualifier or range, or `null`.
- `catalogPage`: printed page number in the source identified by `catalogId`. Ranges vary by catalog as listed above; this is a catalog-scoped citation only and does not reproduce page layout or identify a scan file.
- `confidence`: transcription confidence category: `high`, `medium`, or `low`.

`catalog-item` records, used by Nininger, have exactly `id`, `catalogId`, `catalogItem`, `holdings`, `name`, `classification`, `locality`, `year`, `catalogPage`, and `confidence`. `catalogItem` is a positive integer. Common nullable text, page, and confidence fields have the same meanings as above.

Each holding has exactly `designation`, `kind`, `description`, `count`, and `weight`. The designation and concise description are strings or `null`; kind is `specimen`, `cast`, or `aggregate`; count is a positive integer or `null`; and `weight.grams` is a finite nonnegative number or `null`. A specimen holding requires nonnull designation and mass and has a null count. A cast requires a nonnull designation and has null count and mass. An aggregate requires a nonnull description and at least a nonnull count or mass; its designation may be null or printed. Holdings remain in source order, and the UI labels counts as `Count: N` without guessing what was counted.

Schema 4 adds `catalog-number` without changing either older record model. Its exact record keys are `id`, `catalogId`, `catalogNumber`, `holdings`, `name`, `classification`, `locality`, `dateOfDiscovery`, `catalogPages`, and `confidence`. Each holding has exactly `description`, `provenance`, `count`, and `weights`; every weight has exactly `{ grams }`. Description is required normalized nonempty text, provenance is normalized nonempty text or `null`, count is a positive integer or `null`, and weights is a nonempty ordered array of finite nonnegative gram values. Catalog numbers are unique opaque strings within each catalog, including fraction-like strings, and need not increase. `catalogPages` is nonempty, positive, ordered, unique, and confined to descriptor source pages.

The Hovey descriptor reports zero records with designations because its required catalog numbers are separate searchable identifiers. `recordsWithWeight` counts a record with any nested weight, which is all 25 Hovey records. Search includes catalog number, name, locality, classification, date of discovery, description, and provenance. Filtering, sorting, and statistics flatten nested weights without multiplying by count. The interface displays `Catalog no.`, descriptions, provenance, reported group counts, every mass, and every cited page. A holding count describes the cataloged group only and is not a claim about distinct physical specimens.

Strings are Unicode NFC-normalized, surrounding whitespace is removed, and internal whitespace is collapsed. Catalog-item numbers are unique and strictly increasing within each catalog; gaps are allowed, and distinct catalog-item catalogs have independent number spaces. Catalog-item deployment order is numeric item, nullable name, then ID, with no holding-mass tie breaker. Specimen order remains literal structural designation, nullable name, numeric mass, then ID. `recordsWithDesignation` counts a specimen with a designation or a catalog item when any holding has a designation; catalog-number identifiers are excluded. `recordsWithWeight` counts a record when it has any scalar or nested mass.

## Folio display policy

The folio manifest has schema version 1 and maps each catalog ID to `displayPolicy`, `rightsStatus`, and `pages`. Known display policies are `blocked` and `display`; known rights statuses are `undetermined` and `public-domain`. A blocked catalog has no page entries.

A future catalog may use `displayPolicy: "display"` only after a documented manual rights review determines `rightsStatus: "public-domain"`. Publication year, apparent age, or inclusion in this dataset must never be used to infer public-domain status.

For a reviewed public-domain catalog, each page key is a positive printed page number. A page entry has exactly the required keys `image` and `alt`, plus optional `thumbnail`; `full` and every other key are forbidden. Both image path fields use the same rule: the value must be a nonempty plain relative path rooted exactly under `assets/folios/<catalogId>/` for the authorized catalog, contain at least one filename segment, and end in `.webp`, `.png`, `.jpg`, `.jpeg`, or `.avif`. Plain path segments use only ASCII letters, digits, dots, underscores, and hyphens.

Folio paths reject all whitespace, slash-rooted and protocol-relative values, URL schemes, backslashes, queries, fragments, percent signs and every encoded or repeatedly encoded form, duplicate slashes and empty segments, `.` and `..` segments, paths outside the matching `assets/folios/<catalogId>/` directory, and unapproved or missing extensions. Alt text must be nonempty plain text, NFC/whitespace-normalized, no more than 160 Unicode characters, and free of markup, control characters, and invisible format characters.

This page-entry schema is documented for future reviewed catalogs only. `folios.json` contains no synthetic public-domain catalog, page entries, scan data, or image filenames for any current catalog.

## Caveats

The data may contain OCR or transcription errors. A `null` means the source did not provide a usable value or that a value could not be stated conservatively from the available transcription.

Records are source observations, not canonical specimens. Multiple observations may concern the same specimen or meteorite, and the dataset does not reconcile identities, editions, or corrections across catalogs. Observation boundaries follow each catalog's structure; specifically, one Nininger observation is one numbered item even when that item lists multiple holdings. Statistics count parent records as observations but sum every non-null holding mass once.

Run `node scripts/validate-public-catalog.mjs` from the project root to validate the local files, catalog counts and ordering, policy coverage, folio path safety, and exclusion rules. The integrated schema-4 validation passes. `--synthetic-only` validates the schema-4 model and future display fixtures without reading the local catalog and folio files. Hovey folio policy remains blocked/undetermined and has no page entries.
