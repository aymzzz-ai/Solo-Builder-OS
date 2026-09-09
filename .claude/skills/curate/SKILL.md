---
name: curate
description: >-
  Run a periodic consistency and restructure pass over the wiki and propose a
  change-set: merge duplicates, fix drift, tighten summaries, repair cross-links, and
  keep the information architecture coherent and human-readable. Use this skill
  WHENEVER the user wants to tidy or consolidate memory: "curate", "clean up the wiki",
  "consolidate", "this is getting messy", "tighten things up", or as the weekly
  curate/lint routine. Proposes a reviewable change-set; edits are applied only on
  approval and committed to git so they're reversible. Distinct from lint (which is a
  mechanical health report) — curate restructures for coherence and shareability.
---

# Curate — keep the wiki coherent over time

The gardener pass: the wiki compounds, so it needs periodic tending to stay coherent,
tight, and shareable (Pillar 5). Curate **proposes a change-set**; you approve; git
makes it reversible (SAF-2). Authority: `os-core/schema/operating-contract.md`.

## Inputs

- `[scope]` — a folder, type, tag, or topic to curate (defaults to a sensible recent
  or whole-store scope).
- The single business instance (this repo root).

## What it looks for

- **Duplicates / overlap** — two pages covering the same thing → propose a merge
  (keep one, supersede the other, chain it).
- **Drift** — summaries that no longer match their `## Detail` or their sources →
  propose a tightened, source-faithful rewrite.
- **Weak structure** — pages that should split, mis-typed pages (→ hand to `file`),
  thin pages that belong merged, missing cross-links between clearly related pages.
- **Index hygiene** — `index.md` lines out of sync with page titles/summaries/status.
- **Readability / shareability** — summary-first discipline, plain language, so a page
  reads well to an outside viewer.
- **Summary drift between local and the PM tool** — for a `prd` / `decision` / `council` page
  whose body lives in the PM tool (the home-of-record rule), the TL;DR paragraph must stay **byte-identical**
  on both sides. If curation rewrites a summary, that page **must be re-pushed**
  (`os-core/patterns/pm-push.md`) — a tightened local summary that never reaches the PM tool
  silently breaks the contract `/ask` depends on.

## Workflow

1. **Read `index.md`** + the pages in scope (frontmatter, summaries, links, dates).
2. **Assemble a change-set proposal** — grouped edits, each with a one-line rationale:
   merges, rewrites, splits, link fixes, index corrections. Note any supersede/retract
   chains the change implies.
3. **Present for approval.** Show before/after for non-trivial edits.
4. **Apply on approval**, update `index.md` + reciprocal `links[]`, append a `log.md`
   `curate` entry, **stamp the `curate` line in `meta/routines-state.md`**, and
   **commit** (SAF-2).

## Hard rules from the contract

- **Supersede/retract, never delete** — consolidation chains old pages, never erases
  them; `raw/` is untouched.
- **Recall-trust** — rewrites stay faithful to `sources[]`; never "improve" a summary
  into a claim the sources don't support. Lower `confidence` rather than overstate.
- **Conflicts** — if curation surfaces two live pages that disagree, don't quietly
  resolve it; record `conflicts_with` and leave the resolution to the user (or `/gate`).

## Files this skill touches

- **Reads:** `index.md`, pages in scope, their `sources[]`.
- **Writes (on approval):** edit/merge/split `wiki/` pages, update `index.md` +
  `links[]`, append `log.md`, stamp the `curate` line in `meta/routines-state.md`.
  Edits are git-committed and reversible.
- **Never:** secrets, `raw/` (immutable), `os-core/`, or any other business.
