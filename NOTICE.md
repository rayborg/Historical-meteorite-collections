# Notice

## Source Attribution

A searchable transcription of the 1976 Huss Meteorite Collection catalog, compiled and published by Glenn Huss.

The current repository edition also indexes *Tableau méthodique des espèces minérales, seconde partie* (1813), configured as compiled by Jean André Henri Lucas; *Ueber Feuer-Meteore, und über die mit denselben herabgefallenen Massen* (1819), configured as compiled by E. F. F. Chladni, with a Vienna appendix by Karl von Schreibers; *E. F. F. Chladni’s Beschreibung seiner Sammlung vom Himmel herabgefallener Massen. Nebst einigen allgemeinen Bemerkungen* (1825), configured as compiled by E. F. F. Chladni; *Catalogue of meteorites in the collection of the American Museum of Natural History, to July 1, 1896* (1896), configured as compiled by Edmund Otis Hovey; *The Nininger Collection of Meteorites with Descriptions of the Huizopa and Pojoaque Meteorites* (1933), configured as compiled by H. H. Nininger; *The Nininger Collection of Meteorites* (1950), configured as compiled by H. H. Nininger and Addie D. Nininger; and *The Second Huss Collection of Meteorites* (1986), configured as compiled by Glenn I. Huss. No publisher is inferred for these sources, and attribution does not assert ownership of source rights.

## Facts-Only Scope

The current repository edition distributes 2,018 structured, facts-only source observations from eight catalogs under metadata schema version 6. It supports four source-specific record models: `specimen`, `catalog-item`, `catalog-number`, and `collection-entry`. Records are source observations rather than canonical meteorites or inferred physical specimens, and `catalogId` identifies each source.

Metadata covers 155 catalog-scoped source pages, of which 138 are cited by records. Source-page coverage is not a claim that every covered page contains an observation. In particular, Chladni 1825 pages 200-207 are introductory, and Nininger 1933 pages 12-20 are narrative-only; the available Nininger 1933 source set also omits printed pages 8-9 and catalog items 106-141, while Nininger 1950 currently covers only printed pages 26-32, so both digital editions are partial.

Raw OCR and other private material remain excluded from the public data and repository distribution, including private source scans, source filenames, verbatim notes, private paths, and research or transcription archives. The public repository includes only the separately reviewed folio derivatives described below; their inclusion does not make excluded source or working material public.

Folio display is controlled separately by the schema-version-2 rights manifest. Every displayed page has exactly these keys: `pageId`, `catalogPage`, `pageLabel`, `image`, and `alt`; no omitted or additional page keys are accepted. `catalogPage` may be null for unnumbered front matter, and `image` must be an approved relative `.webp` path rooted under `assets/folios/<catalogId>/` and named for the authorized `pageId`. The manifest is deny by default: any missing, blocked, incomplete, contradictory, malformed, unsafe, or unreviewed value denies folio display without preventing facts-only catalog data from loading. Eligibility is never inferred from publication year, apparent age, metadata, or the presence of local files.

## Rights Status

The repository publicly provides 41 reviewed folio derivatives: 3 Lucas 1813 pages with `public-domain` status; 12 Chladni 1819 pages with `public-domain` status; 7 Hovey 1896 pages with `public-domain` status from Biodiversity Heritage Library item 335869, contributed by Smithsonian Libraries and Archives; and 19 Nininger 1933 pages with `no-copyright-us` status after a documented no-renewal search for the exact 1933 offprint.

Chladni 1825, both Huss catalogs, and Nininger 1950 remain `blocked` with `undetermined` rights status and no public folio pages. Their raw scans, OCR, filenames, and other private source material remain excluded.

Rights reviews and labels are specific to the reviewed catalog, copy, and jurisdiction. They are not legal advice, do not establish ownership of a source, and do not provide a general license for source material. Facts-only indexing does not resolve rights held by others. Repository code and site styling may have separate authorship and rights, and their presence does not change the rights status of historical source material.

## No Endorsement

Reference to the catalogs, their configured compilers, institutions, localities, or other named parties is for identification and attribution only. It does not imply sponsorship, affiliation, or endorsement of this project.

## Corrections And Takedown Requests

Please use the repository's GitHub issues for factual corrections, attribution concerns, or takedown requests. Include the relevant `catalogId`, designation or catalog item, catalog page, and a concise explanation where possible so the request can be reviewed.
