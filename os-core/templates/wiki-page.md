---
id: <kebab-slug>                 # unique within the business
title: <Human Title>
type: concept                    # concept | entity | qa | decision | prd
status: current                  # current | superseded | retracted
provenance: derived              # user-authored | external | derived
confidence: high                 # high | medium | low
sources:                         # pointers to immutable raw/ snapshots (INT-3)
  - raw/<YYYY-MM-DD>-<slug>.md
links:                           # relative md links to related pages
  - ../<type-dir>/<other-slug>.md
supersedes: []                   # ids this page replaces
superseded_by: null              # id that replaced this page
conflicts_with: []               # ids this page disagrees with
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
tags: []
---

**TL;DR.** <One self-contained paragraph that answers the page in plain terms, stated
first so a query gets the point immediately wherever it is read. For a page whose body
is pushed to the PM tool, this paragraph is byte-identical on both sides, label included,
which is what lets /ask answer without a live call. See
os-core/schema/pm-content-standard.md for the per-type formula.>

## Detail

<Fuller explanation. State only what the sources support; mark uncertain claims with
confidence: medium|low above. Do not infer beyond the sources.>

## Sources

<Rendered from sources[] so provenance stays visible wherever the body ends up.>
- <Source label> — `raw/<YYYY-MM-DD>-<slug>.md`
