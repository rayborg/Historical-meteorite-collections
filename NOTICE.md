# Notice

## Source Attribution

A searchable transcription of the 1976 Huss Meteorite Collection catalog, compiled and published by Glenn Huss.

The live release also indexes *The Second Huss Collection of Meteorites* (1986), configured as compiled by Glenn I. Huss, and *The Nininger Collection of Meteorites with Descriptions of the Huizopa and Pojoaque Meteorites* (1933), configured as compiled by H. H. Nininger. The coordinated local schema-4 data additionally indexes *Catalogue of meteorites in the collection of the American Museum of Natural History, to July 1, 1896* (1896), configured as compiled by Edmund Otis Hovey. No publisher is inferred for those three catalogs, and attribution does not assert ownership of source rights.

## Facts-Only Scope

The live public edition distributes 1,758 structured source observations only. Schema version 3 represents the 1,078 `huss-1976` and 544 `huss-1986` observations as specimen records with scalar designation and mass fields. It represents the 136 `nininger-1933` observations as numbered catalog items with source-order holdings, including factual holding designation, kind, concise description, count, and normalized mass. Parent observations cite pages 3-48, 3-23, and 1-7 plus 10-11 respectively, for 76 distinct catalog-scoped pages cited by records. The metadata source-page coverage is 85 catalog-scoped pages; this is not a claim that all 85 are cited. Nininger pages 12-20 are included in that source coverage but are narrative-only, contain no observations, and are not cited by records. `catalogId` identifies each source; printed page ranges vary by catalog.

The coordinated local schema-4 files contain 1,783 observations from four catalogs, adding 25 `hovey-1896` catalog-number records. Local metadata covers 92 catalog-scoped pages and records cite 83: Hovey covers and cites pages 149-155, while the three live catalogs retain the coverage described above. This local state has not been deployed and is not a deployment claim. The `catalog-number` model treats catalog numbers as opaque source identifiers and holding counts as reported group facts, not as arithmetic fractions or inferred counts of distinct physical specimens. Hovey folio eligibility remains blocked and undetermined; no Hovey images or page entries are public.

No source images, image or source filenames, raw OCR, verbatim notes, or reproductions of catalog page layout are publicly distributed for any catalog. No Hovey images are public. Such material remains private and blocked from folio display. Private local research or transcription archives are outside the public site and repository distribution.

The site includes a technical capability for displaying folios from future catalogs. That capability is controlled by a separate rights manifest with at least one catalog and creates a folio control only for a catalog structurally marked both `display` and `public-domain`; blocked catalogs must have no pages. Each authorized page requires an `image` path and normalized plain-text `alt`, may include `thumbnail`, and may include no other keys. Image paths must be approved lowercase-extension raster files with plain ASCII segments rooted under `assets/folios/<catalogId>/` for the authorized catalog, and alt text must contain no HTML, backticks, Markdown link/image syntax, controls, or invisible format characters. Missing, malformed, incomplete, unsafe, blocked, or differently classified entries deny display. The viewer opens `image` directly and does not require a thumbnail.

## Rights Status

Rights in the four locally configured source catalogs and their contents have not been conclusively determined. No claim is made that a source is in the public domain, that this project owns source rights, or that factual indexing resolves any rights held by others. No legal license for source material is granted by this notice.

All four entries in the local folio manifest have `displayPolicy: "blocked"`, `rightsStatus: "undetermined"`, and no page entries. The live three-catalog manifest is likewise blocked and undetermined. Future folios require a documented, catalog-specific public-domain determination before their manifest policy can permit display. Eligibility is never inferred automatically from publication year, apparent age, catalog metadata, or the presence of local files.

Repository code and site styling may have authorship and rights separate from the historical source facts. Their presence does not change the rights status of the source catalogs.

## No Endorsement

Reference to the catalogs, their configured compilers, institutions, localities, or other named parties is for identification and attribution only. It does not imply sponsorship, affiliation, or endorsement of this project.

## Corrections And Takedown Requests

Please use the repository's GitHub issues for factual corrections, attribution concerns, or takedown requests. Include the relevant `catalogId`, designation or catalog item, catalog page, and a concise explanation where possible so the request can be reviewed.
