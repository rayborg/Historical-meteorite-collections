# Public catalog data

`catalog.json` is a facts-only dataset of 1,079 observations from Glenn Huss's 1976 catalog, identified as `huss-1976`. It contains independently structured factual fields rather than a transcription or reproduction of the catalog.

Scans, source-image filenames, raw OCR, verbatim notes, and page-layout reproduction are excluded because their rights status is unresolved. No copyright status determination is made for the source catalog or any excluded material.

`folios.json` is a separate, deny-by-default display gate. The `huss-1976` entry has `displayPolicy: "blocked"`, `rightsStatus: "undetermined"`, and no page entries, so no Huss folio image may be displayed. Matching policy values are repeated in `catalog.json` metadata to make the block explicit to catalog consumers; records never contain image fields.

## Data model

The JSON root contains `metadata` and `records`. Each record has only these factual fields:

- `id`: stable unique identifier for this observation.
- `catalogId`: source catalog identifier, always `huss-1976`.
- `designation`: designation reported for the observation, or `null`.
- `name`: reported meteorite name, or `null`.
- `weight.grams`: reported weight normalized to a numeric gram value, or `null` when no unambiguous numeric value is available.
- `classification`: reported classification, or `null`.
- `locality`: reported locality, or `null`.
- `year`: reported year text, including any factual qualifier or range, or `null`.
- `catalogPage`: printed catalog page number from 3 through 48. This is a citation only; it does not reproduce page layout or identify a scan file.
- `confidence`: transcription confidence category: `high`, `medium`, or `low`.

Strings are Unicode NFC-normalized, surrounding whitespace is removed, and internal whitespace is collapsed. Records are deterministically ordered by structural designation, then name, numeric weight, and ID; this order is independent of the source's page arrangement.

## Folio display policy

The folio manifest has schema version 1 and maps each catalog ID to `displayPolicy`, `rightsStatus`, and `pages`. Known display policies are `blocked` and `display`; known rights statuses are `undetermined` and `public-domain`. A blocked catalog has no page entries.

A future catalog may use `displayPolicy: "display"` only after a documented manual rights review determines `rightsStatus: "public-domain"`. Publication year, apparent age, or inclusion in this dataset must never be used to infer public-domain status.

For a reviewed public-domain catalog, each page key is a positive printed page number. A page entry has exactly the required keys `image` and `alt`, plus optional `thumbnail`; `full` and every other key are forbidden. Both image path fields use the same rule: the value must be a nonempty plain relative path rooted exactly under `assets/folios/`, contain at least one filename segment, and end in `.webp`, `.png`, `.jpg`, `.jpeg`, or `.avif`. Plain path segments use only ASCII letters, digits, dots, underscores, and hyphens.

Folio paths reject all whitespace, slash-rooted and protocol-relative values, URL schemes, backslashes, queries, fragments, percent signs and every encoded or repeatedly encoded form, duplicate slashes and empty segments, `.` and `..` segments, paths outside `assets/folios/`, and unapproved or missing extensions. Alt text must be nonempty plain text, NFC/whitespace-normalized, no more than 160 Unicode characters, and free of markup, control characters, and invisible format characters.

This page-entry schema is documented for future reviewed catalogs only. `folios.json` contains no synthetic public-domain catalog, no Huss page entries, and no scan data or image filenames for `huss-1976`.

## Caveats

The data may contain OCR or transcription errors. A `null` means the source did not provide a usable value or that a value could not be stated conservatively from the available transcription.

Records are source observations, not canonical specimens. Multiple observations may concern the same specimen or meteorite, and the dataset does not reconcile identities, editions, corrections, or other catalogs.

Run `node scripts/validate-public-catalog.mjs` from the project root to validate both public files, catalog counts and ordering, policy coverage, folio path safety, and exclusion rules. The validator uses only Node.js built-in modules and tests the future display schema with in-memory synthetic fixtures that are not written to public data.
