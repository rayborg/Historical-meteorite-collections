# Public catalog data

`catalog.json` is a facts-only dataset of 1,758 observations from three historical meteorite catalogs. It contains independently structured factual fields rather than facsimiles or page-layout reproductions.

A searchable transcription of the 1976 Huss Meteorite Collection catalog, compiled and published by Glenn Huss.

The configured compiler is Glenn I. Huss for `huss-1986` and H. H. Nininger for `nininger-1933`; no publisher is inferred for either catalog.

| `catalogId` | Observations | Original images | Import batches | Metadata source-page coverage | Pages cited by records |
| --- | ---: | ---: | ---: | --- | --- |
| `huss-1976` | 1,078 | 46 | 12 | 3-48 | 3-48 |
| `huss-1986` | 544 | 25 | 7 | 3-23 | 3-23 |
| `nininger-1933` | 136 | 19 | 5 | 1-7 and 10-20 | 1-7 and 10-11 |
| **Total** | **1,758** | **90** | **24** | **85 catalog-scoped pages** | **76 catalog-scoped pages** |

The 85-page figure is metadata source-page coverage, not a count of pages cited by records. Records cite 76 distinct catalog-scoped pages. For `nininger-1933`, pages 8-9 are absent from the local source set; pages 12-20 are included in source coverage but are narrative-only, contain no observations, and are not cited by records. Its observation unit is one numbered catalog item, not each visible row or holding. Multiple holdings listed under one item remain one public observation; their complete `weightText` and notes are preserved only in private transcription data.

Original images are held locally and ignored by Git. Image and source filenames, raw OCR, verbatim notes, private fields such as `weightText`, and page-layout reproductions are excluded from the public release. Display derivatives may be tracked only in private history. No copyright status determination is made for the source catalogs or excluded material.

`folios.json` is a separate, deny-by-default display gate. All three catalog entries have `displayPolicy: "blocked"`, `rightsStatus: "undetermined"`, and no page entries, so all public source-image and display-derivative exports are blocked. Matching policy values are repeated in `catalog.json` metadata to make each block explicit to catalog consumers; records never contain image fields.

## Data model

The JSON root contains `metadata` and `records`. Each record has only these factual fields:

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

Strings are Unicode NFC-normalized, surrounding whitespace is removed, and internal whitespace is collapsed. Records are deterministically ordered by structural designation, then name, numeric weight, and ID; this order is independent of the source's page arrangement.

## Folio display policy

The folio manifest has schema version 1 and maps each catalog ID to `displayPolicy`, `rightsStatus`, and `pages`. Known display policies are `blocked` and `display`; known rights statuses are `undetermined` and `public-domain`. A blocked catalog has no page entries.

A future catalog may use `displayPolicy: "display"` only after a documented manual rights review determines `rightsStatus: "public-domain"`. Publication year, apparent age, or inclusion in this dataset must never be used to infer public-domain status.

For a reviewed public-domain catalog, each page key is a positive printed page number. A page entry has exactly the required keys `image` and `alt`, plus optional `thumbnail`; `full` and every other key are forbidden. Both image path fields use the same rule: the value must be a nonempty plain relative path rooted exactly under `assets/folios/<catalogId>/` for the authorized catalog, contain at least one filename segment, and end in `.webp`, `.png`, `.jpg`, `.jpeg`, or `.avif`. Plain path segments use only ASCII letters, digits, dots, underscores, and hyphens.

Folio paths reject all whitespace, slash-rooted and protocol-relative values, URL schemes, backslashes, queries, fragments, percent signs and every encoded or repeatedly encoded form, duplicate slashes and empty segments, `.` and `..` segments, paths outside the matching `assets/folios/<catalogId>/` directory, and unapproved or missing extensions. Alt text must be nonempty plain text, NFC/whitespace-normalized, no more than 160 Unicode characters, and free of markup, control characters, and invisible format characters.

This page-entry schema is documented for future reviewed catalogs only. `folios.json` contains no synthetic public-domain catalog, page entries, scan data, or image filenames for any current catalog.

## Caveats

The data may contain OCR or transcription errors. A `null` means the source did not provide a usable value or that a value could not be stated conservatively from the available transcription.

Records are source observations, not canonical specimens. Multiple observations may concern the same specimen or meteorite, and the dataset does not reconcile identities, editions, or corrections across catalogs. Observation boundaries follow each catalog's structure; specifically, one Nininger observation is one numbered item even when that item lists multiple holdings.

Run `node scripts/validate-public-catalog.mjs` from the project root to validate both public files, catalog counts and ordering, policy coverage, folio path safety, and exclusion rules. The validator uses only Node.js built-in modules and tests the future display schema with in-memory synthetic fixtures that are not written to public data.
