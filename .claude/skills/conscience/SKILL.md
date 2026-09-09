---
name: conscience
description: >-
  Audit logged decisions and pages for SEMANTIC trouble — accumulating technical debt,
  vendor/architecture lock-in, contradictions with prior decisions, drift from stated
  intent, and decisions that newer reality has quietly superseded — across product,
  design, and engineering. Produces a flags report (type, where, why, suggested
  action); it FLAGS only, never edits. Use this skill WHENEVER the user wants a
  judgment pass over the record: "any debt building up", "are we contradicting
  ourselves", "what's drifting", "conscience check", "review my decisions", or as the
  weekly + on-write conscience health-check routine. The technical conscience for an
  operator who delegates engineering to AI tools.
---

# Conscience — active stewardship of the decision record

The differentiator. The user delegates engineering to build tools that make
consequential choices silently on his behalf; conscience surfaces those consequences
so invisible debt and lock-in don't accumulate. It **judges semantically** and
**flags only** — proposes, never modifies (ARC-3). Authority:
`os-core/schema/operating-contract.md`.

## Inputs

- `[scope]` — a discipline (`product | design | engineering | architecture`), a topic,
  a PRD, or a date range (defaults to a recent or whole-record scope).
- The single business instance (this repo root).

## What it judges (semantic, not mechanical)

- **Technical / product debt** — shortcuts and "we'll fix it later" that are now
  overdue or compounding.
- **Lock-in** — vendor, framework, or architecture choices that are getting expensive
  to reverse; flag while reversal is still cheap.
- **Contradiction** — a recent decision that conflicts with a prior logged one →
  propose a `conflicts_with` link and surface both, do not pick a winner.
- **Drift from intent** — execution or roadmap diverging from the stated north-star /
  PRD intent.
- **Quiet supersession** — a logged decision that newer reality has overtaken but that
  was never marked `superseded` (so `/ask` may still cite it as live).

## Workflow

1. **Read** the relevant `decisions/`, `prds/`, `roadmap.md`, north-star, and
   `index.md`/`log.md`; cross-check against repo state via `git`/`gh` where it bears on
   debt or drift (read-only).
2. **Produce a flags report.** For each flag: **type · where (page + cite) · why it
   matters · suggested action** (e.g. "mark superseded", "open a `/gate` review",
   "record `conflicts_with`", "pull back the build-tool decision and log it").
3. **Seed proposals, don't apply them.** May draft a supersession or `conflicts_with`
   proposal for the user to approve — but makes **no autonomous wiki edits** (ARC-3).
4. **Log the run.** Append a `log.md` `conscience` entry summarizing the flags raised,
   and **stamp the `conscience` line in `meta/routines-state.md`** (bookkeeping only —
   not a wiki edit, so it stays within the flags-only rule).

## Hard rules from the contract

- **Flags only.** Conscience never modifies the record itself; it hands the user
  judgments + suggested actions. Acting on them goes through `harvest`/`file`/`gate`.
- **Recall-trust.** Every flag cites the specific logged pages it's reasoning from.
  Don't flag on a hunch with no logged basis — if the basis isn't logged, say the gap
  is the problem.

## Files this skill touches

- **Reads:** `decisions/`, `prds/`, `roadmap.md`, north-star, `index.md`/`log.md`,
  repo state via `git`/`gh`.
- **Writes:** a report + a `log.md` entry; stamps the `conscience` line in
  `meta/routines-state.md`; optional **draft** supersession/conflict proposals. **No
  autonomous wiki edits.**
- **Never:** secrets, `raw/` (immutable), `os-core/`, or any other business.

## Cadence note

Runs on demand and as the weekly **+ on-write-after-`/harvest`** conscience
health-check routine (a thin wrapper over this command); the routine only ever
produces a flags report to triage — it never modifies (ARC-3).
