# Methodology

This document explains how a historical meteorite catalog becomes part of the
public Historical Meteorite Collection. It is the public counterpart to the
source-linked research workflow. The data contracts and current release state
are documented in [`README.md`](./README.md) and
[`data/README.md`](./data/README.md).

The central rule is simple: a catalog record is a dated source observation. It
is not automatically a canonical meteorite, physical specimen, or custody
event. Source observations are never merged.

## 1. Evidence Classes

The project keeps these claims distinct:

| Class | Meaning | Does not mean |
| --- | --- | --- |
| Source observation | One source row or explicitly modeled source unit | Unique meteorite or physical specimen |
| Source fact | A structured value reported by that source | Modern scientific correctness |
| Reviewed MetBull identity | A reviewed current meteorite/fall identity | Same physical fragment |
| Specimen card | A reviewed display projection of one atomic holding/component | A replacement for its parent observation |
| Same inventory | Continuity of a source-attested persistent inventory ID within one collection series | Unchanged piece, mass, custody, or ownership |
| Possible match | A candidate based on reviewed identity and reported mass | Proven physical identity or authorization to merge |
| Source-attested group | An n-ary grouping printed by a source | Pairwise specimen equivalence |
| Amendment | A later source statement about an earlier observation or component | Permission to rewrite historical base facts |

Collection continuity can persist while a physical object is cut, sampled,
divided, reweighed, relabeled, moved, or transferred. Even an established
inventory-ID relationship therefore does not prove that the physical piece was
unchanged or that custody was continuous.

## 2. Source Selection And Scope

A candidate source is accepted only after the exact edition, compiler, date,
collection, and catalog-bearing scope are established. A citation, index,
review, bibliography, narrative mention, or repository landing page is not
itself a catalog row.

Before transcription, the source-linked workflow classifies every relevant page
as catalog table, continuation, narrative, bibliography, index, plate,
appendix, errata, supplement, or other typed evidence. It records the first and
last catalog row, source ordering, numbering behavior, heading carry, page
continuations, and exclusions. Unresolved boundaries block integration.

Digital sequence and printed pagination are separate. Public records cite
printed pages through `catalogPage` or ordered `catalogPages`; those citations
are not record identity and need not be contiguous. Introductory or narrative
pages can belong to a descriptor's scope without producing observations.

## 3. Acquisition, Rights, And Folios

Acquisition is receipt-based. The research workflow binds the exact acquired
object to its media type, byte count, SHA-256 digest, source landing page,
attribution, and rights basis. If one digital volume contains several catalog
editions or supplements, the byte artifact can support several documentary
controls without collapsing those controls into one publication.

Three decisions remain independent:

1. Acquisition permission allows preservation and research use under the
   recorded basis.
2. Facts-only publication allows independently structured source facts.
3. Folio display allows selected page derivatives.

No decision implies another. Every new folio policy begins blocked with
undetermined rights and zero pages. Public page display requires a separate,
copy-specific and jurisdiction-specific review, an exact ordered page set, safe
public asset names, verified derivative bytes, and a matching release lock.
Age, online availability, physical ownership, or absence of a visible notice is
not sufficient.

The public manifest is [`data/folios.json`](./data/folios.json). A missing,
blocked, incomplete, contradictory, malformed, or unsafe policy denies folio
display while leaving a valid factual catalog available.

## 4. Row And Record Model

One genuine source row remains one immutable observation. Repeated or
content-identical rows remain separate. Corrections preserve the observation's
ID. New public IDs are opaque and do not expose source storage or mutable fact
values.

The public catalog supports seven closed models:

- `specimen` for a row that explicitly describes one source-identified
  specimen.
- `catalog-item` for one numbered item with ordered physical holdings.
- `catalog-number` for an opaque catalog identifier with ordered holdings and
  possibly multiple page citations.
- `collection-entry` for a source-order collection observation with ordered
  holdings and a nullable or repeated printed number.
- `regional-census-fact` for occurrence and representation facts that are not
  physical holdings.
- `table-a-specimen` for a source's primary specimen table with separately
  retained cross-view evidence.
- `dealer-offer-fact` for a dealer type/offer observation that is not modeled as
  a specimen or holding.

A source-specific private representation may be necessary when these public
models would erase material distinctions. Public projection then uses exact
catalog dispatch and a closed factual allowlist. Unsupported combinations fail
rather than being coerced into a similar model.

## 5. Independent Transcription And Adjudication

Every complex catalog requires two independent structured readings of the
complete accepted scope. The second reading is not a cleanup of the first. Each
reading records rows, nested holdings, printed values, punctuation, blanks,
ditto marks, qualifiers, uncertainty, source order, and page boundaries.

The readings are compared field by field. Every disagreement is adjudicated
against the rendered source and recorded as agreement, typographic difference,
omission, row-boundary difference, numeric/unit difference, source ambiguity,
source inconsistency, or blocker. OCR can assist discovery but cannot decide a
reading. An unresolved discrepancy blocks that scope.

The accepted Hamburg workflow illustrates the distinction between source facts
and project calculations: printed totals remain separate from sums recomputed
from components, and later source amendments do not rewrite the base register.

## 6. Source Facts, Missing Values, Masses, And Groups

Historical names, classifications, localities, dates, identifiers, counts,
weights, units, sections, and descriptions are preserved as source facts. A
modern identity review cannot silently correct them.

Missing or ambiguous is not zero. Blank, illegible, absent, ditto, dash,
question-mark, range, inequality, compound-unit, or unsupported values remain
null or explicitly uncertain under the applicable model. The project emits
numeric grams only when the source value and conversion are unambiguous.

The following inferences are prohibited:

- Dividing a total by a count to invent per-piece mass.
- Multiplying a per-piece mass by a count to invent a source total.
- Treating an aggregate total as an individual specimen mass.
- Turning a missing weight into zero.
- Treating a close mass as proof of physical identity.
- Treating a count as a physical-specimen total without source support.

Calculated sums are audit results, not printed facts. Both are retained when
they differ. Zero can be retained as a catalog fact only when affirmatively
reported, and zero is never a lineage mass endpoint.

Brown and Minnesota show how nested source clauses are reviewed: atomic
components can become cards, while grouped context and excluded non-meteorite
context do not become specimens. Hamburg types individual, aggregate, and
associated components separately. Victoria Land keeps its primary table at the
top level, preserves normalized secondary-table conflicts, and excludes
mass-conflict records from computed candidates.

Fletcher's British Museum lists use `collection-representation-fact`. Each
principal numbered or suffixed row remains one edition-local observation. List
numbers and pane/case labels are finding context, not inventory; represented
weights are source context, not atomic holdings or specimen masses. Multiple
printed values remain ordered text components with no scalar grams value. The
model therefore has no holdings and is excluded from specimen-card projection,
mass-range filtering, same-inventory continuity, and lineage generation.

Fletcher corrections begin in the private accepted source-first evidence, not
in this public repository. A corrected release must re-adjudicate exact source
evidence, regenerate the canonical catalog and crosswalk, export twice
byte-identically, and repeat suffix, adjunct-exclusion, pane, multiweight, page,
privacy, projection, lineage, and folio-denial checks. Public IDs intentionally
do not reveal private source UUIDs. The unavailable 1886 historical manifest
and the 1908 TXT/HTML page-binding evidence remain private provenance rather
than public folios or claims about scan media.

The Fletcher heading, date or report of find, and bibliographic reference are
separate semantic fields. Combined OCR text is never a fallback name. A blank
grouped continuation may inherit only its immediately preceding source-proven
locality heading and never its MetBull identity. Release validation requires
every name to be nonempty and free of narrative or citation contamination,
complete event/reference accounting, exact continuation controls, and search
coverage for all three public fields.

## 7. Reviewed MetBull Identity

MetBull harmonization is additive. The historical source name and every other
source fact remain unchanged. A resolved review requires an allowed match type,
the current canonical name, a positive decimal Meteoritical Bulletin code, and
the canonical HTTPS detail URL. An unresolved review has no canonical identity
fields.

Exact spelling can still conflict by date, jurisdiction, object type, or source
scope. Similar spelling, normalized spelling, shared mass, or fuzzy search does
not authorize a mapping. Pending observations remain pending; ambiguous
observations are explicitly unresolved rather than guessed.

The public validator checks the exact `metbull` shape and source-name/match-type
coherence. The browser never performs fuzzy identity matching.

## 8. Specimen Cards

[`data/specimen-card-projections.json`](./data/specimen-card-projections.json)
is a display-only positive allowlist. It binds an immutable parent observation
to an exact public holding and either a reviewed UTF-16 clause range or an exact
typed component path. It copies no source-layout transcription into the
manifest.

Projection can change the number of display cards, but it does not split,
delete, replace, or merge source observations. Search result counts,
statistics, page citations, and folio authorization remain parent-observation
based. Group totals, casts, aggregates, associated material, counts, ranges,
dealer offers, and unreviewed clauses remain observation or audit context.

Every lineage route from a projected card uses an exact non-null mass path.
Repeated display masses and massless cards do not become lineage endpoints.

## 9. Lineage Semantics

The generated relationship layer is
[`data/specimen-lineages.json`](./data/specimen-lineages.json). Its schemas and
review source are published beside it. Relationships preserve both endpoint
observations.

### 9.1 Same inventory

`same-inventory` is allowed only inside an explicitly registered collection
series and only for a source-attested persistent inventory identifier. Row
numbers, page numbers, edition-local sequence numbers, and project-generated
IDs are not inventory continuity evidence.

The current Huss series documents normalization of one leading `(2)` edition
marker while preserving the printed designations. Nininger continuity is also
series-scoped and collision checked. Equal identifiers in unrelated collection
namespaces do not link.

When a normalized persistent key has several possible endpoints, the generator
emits a relationship only if exactly one endpoint pair is identity-consistent.
Otherwise the key is omitted and counted as ambiguous. Mass proximity cannot
break the tie automatically.

An emitted relationship means the collection's identifier continued. It does
not mean the specimen was physically unchanged and does not assert custody,
ownership, or transfer.

### 9.2 Possible matches

`possible-match` is a cross-source candidate class. The current generator first
requires either a shared reviewed MetBull code or, only when both endpoints are
unresolved, an equal normalized source name. It then requires:

- exact mass, or
- both masses at least 10 g, absolute difference at most 2 g, and relative
  difference at most 0.0025.

These rules generate review candidates; they do not establish physical
identity. Evidence codes can note shared identity, exact/near mass, and
designation agreement. Caution codes retain normalized-name identity,
near-mass, missing/different designation, aggregate/multiple, and cast risks.

A review outcome of `retain-as-possible` still does not prove identity. An
outcome of `not-supported` rejects the candidate, not either observation.
Possible matches never merge records.

### 9.3 Source-attested groups

Some sources publish n-ary groups rather than pairwise relationships.
[`data/source-claims.json`](./data/source-claims.json) retains those claims in
source order with exact members. They are digest-bound into the lineage output
but are never expanded into pairwise identity edges.

## 10. Supplements, Amendments, And Corrections

A supplement is scoped before modeling. A new listed holding is a new
observation. A correction, disposal, exchange, or revised status is an amendment
event targeting a retained base observation or component. A summary total is a
separate source fact. The project never rewrites history to make a later state
look like the original state.

Corrections to project transcription likewise retain the observation ID and an
auditable prior state. A proved unsupported value is removed rather than
replaced with an inferred value. Any resulting card or lineage changes are
regenerated; stale derived relationships are not retained merely to preserve
counts.

The Berlin 1904 integration applies this rule directly: 450 January base
observations and 20 June additions produce 470 observations, while 20 June
amendments remain separate private evidence and do not create or rewrite public
observations. Berlin's reviewed principal-piece semantics produce 838 specimen
cards. Greifswald's 1895 and 1901 rows remain 145 and 281 source observations
without specimen-card projection. Printed edition and running numbers in both
series are edition-local sequence facts, not persistent inventory identifiers,
so neither series produces `same-inventory` relationships from those numbers.

## 11. Privacy Boundary

The public repository contains independently structured facts, reviewed public
identity decisions, printed-page citations, approved relationship metadata,
and explicitly authorized folio derivatives. It excludes source-layout
transcriptions, raw OCR, verbatim research notes, uncertainty internals,
acquisition storage, source filenames, nonpublic page identities, private
evidence locators, personal reviewer identities, unapproved media, and private
derivative manifests.

Public relationship notes and citations must be safe public text and HTTPS
URLs. A projection may reference only public IDs, paths within public data, and
numeric ranges; it cannot carry copied private rationale.

Privacy validation is allowlist-based and fail-closed. A source can publish
facts while every folio remains blocked.

## 12. Deterministic Public Integration

Public integration begins with an independently reviewed facts-only export from
an exact accepted source state. The candidate must be generated twice and
compared byte for byte before installation. Existing records, IDs, folio
policies, claims, cards, and lineage relationships are compared against the
accepted baseline so a new catalog cannot alter unrelated material silently.

After installing a reviewed candidate, regenerate summaries and lineage, then
run from the public repository root:

```sh
node scripts/sync-release-summary.mjs --write
node scripts/validate-source-claims.mjs
node scripts/build-specimen-lineages.mjs
node scripts/build-specimen-lineages.mjs --check
node scripts/validate-specimen-lineages.mjs
node scripts/validate-specimen-card-projections.mjs
node scripts/validate-public-catalog.mjs
node scripts/test-multicatalog.cjs
node --test scripts/*.test.mjs
git diff --check
```

For a non-writing release check, use:

```sh
node scripts/sync-release-summary.mjs --check
node scripts/build-specimen-lineages.mjs --check
node scripts/validate-source-claims.mjs
node scripts/validate-specimen-lineages.mjs
node scripts/validate-specimen-card-projections.mjs
node scripts/validate-public-catalog.mjs
node scripts/test-multicatalog.cjs
node --test scripts/*.test.mjs
git diff --check
```

`node scripts/validate-public-catalog.mjs --synthetic-only` runs schema and
rejection fixtures without validating the deployed data and therefore cannot
replace the complete check.

The validators fail closed on exact keys, unsupported models, stale counts,
unsafe paths, private markers, invalid rights states, missing assets, checksum
drift, nondeterministic order, dangling IDs or paths, incoherent reviews,
ambiguous inventory collisions, and derived-output drift.

## 13. Release And Deployment

No commit or push is part of data generation itself. After independent
validation and explicit release approval, inspect and stage exact files only:

```sh
git status --short
git diff --check
git diff --stat
git diff -- <reviewed-files>
git add <exact-reviewed-files>
git commit -m "Publish <catalog label>"
git push origin <branch>
```

GitHub Actions runs the repository validation workflow on pushes and pull
requests. GitHub Pages deploys the static branch-root site. Watch both runs for
the exact pushed commit:

```sh
SHA="$(git rev-parse HEAD)"
gh run list --commit "$SHA" --limit 20 --json databaseId,name,status,conclusion,url
gh run watch <validation-run-id> --exit-status
gh run watch <pages-run-id> --exit-status
```

Queued or running checks are not acceptance. After both complete, compare local
and live bytes:

```sh
LIVE_BASE="https://rayborg.github.io/Historical-meteorite-collections"
LIVE_DIR="$(mktemp -d -t hmc-live.XXXXXX)"
curl -fsSL "$LIVE_BASE/data/catalog.json" -o "$LIVE_DIR/catalog.json"
curl -fsSL "$LIVE_BASE/data/folios.json" -o "$LIVE_DIR/folios.json"
curl -fsSL "$LIVE_BASE/data/source-claims.json" -o "$LIVE_DIR/source-claims.json"
curl -fsSL "$LIVE_BASE/data/specimen-lineages.json" -o "$LIVE_DIR/specimen-lineages.json"
shasum -a 256 data/catalog.json data/folios.json data/source-claims.json data/specimen-lineages.json
shasum -a 256 "$LIVE_DIR"/*.json
cmp data/catalog.json "$LIVE_DIR/catalog.json"
cmp data/folios.json "$LIVE_DIR/folios.json"
cmp data/source-claims.json "$LIVE_DIR/source-claims.json"
cmp data/specimen-lineages.json "$LIVE_DIR/specimen-lineages.json"
```

Record the public commit, validation and Pages run IDs, local/live SHA-256
values, catalog and observation counts, relationship-class counts, source-claim
count, folio count, and new catalog policy.

## 14. Rollback

An unreleased candidate that fails any gate is corrected and completely
revalidated; it is not partially published. If a published release is unsafe,
create a normal revert commit, push it, watch validation and Pages, and verify
the reverted live hashes:

```sh
git revert <unsafe-public-commit>
git push origin <branch>
```

Do not force-push, rewrite public history, reuse retired observation IDs, or
delete research evidence. Prepare a corrected release from the last accepted
source state.

## 15. Release Checklist

- [ ] Exact source edition and catalog scope are accepted.
- [ ] Acquisition receipt and rights basis are complete.
- [ ] Facts publication and folio display were decided separately.
- [ ] Complete page and row census is reconciled.
- [ ] Two independent transcriptions and discrepancy adjudication are complete.
- [ ] Every genuine row remains one immutable observation.
- [ ] No duplicate-looking observation was removed or merged.
- [ ] No missing or ambiguous value became zero.
- [ ] Counts, masses, aggregates, representations, and totals retain distinct
  meanings.
- [ ] Source facts are separate from MetBull identity review.
- [ ] Card projections are positive allowlists over retained parents.
- [ ] Same-inventory links use source-attested persistent IDs only.
- [ ] Established inventory continuity is not described as unchanged piece or
  custody.
- [ ] Possible matches remain possible and never merge observations.
- [ ] Ambiguous collisions are omitted and reported, not guessed.
- [ ] Supplements preserve base observations and type later events separately.
- [ ] Two public exports are byte-identical.
- [ ] Public privacy scan has no source or reviewer disclosure.
- [ ] Blocked folios have no public pages or assets.
- [ ] Public schema, claims, lineage, projection, runtime, and full tests pass.
- [ ] Generated summaries are current and `git diff --check` passes.
- [ ] Independent public validation passes.
- [ ] Approved commit is pushed without history rewriting.
- [ ] Validation and Pages runs complete successfully.
- [ ] Live files equal local bytes and the release receipt is complete.

An unchecked requirement blocks release unless it has a documented,
independently reviewed not-applicable disposition.
