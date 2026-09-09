---
name: brief
description: >-
  Produce a "where I stand + what's next" standing brief for a business, cited and
  read-only. Synthesizes current state, recent activity, open decisions, and the
  prioritized next-actions queue from index.md, log.md, queue.md, roadmap.md, and open
  decisions — then flags what isn't logged or looks stale. Use this skill WHENEVER the
  user wants to orient or resume: "where am I", "where do we stand", "what's next",
  "catch me up", "status", "what was I working on", or at the start of a build session.
  Answers strictly from logged content (cites sources, says what's missing); never
  guesses. Read-only — it reports, it does not write.
---

# Brief — where I stand + what's next

The session-kickoff orientation: current state, what's open, and the next actions in
priority order — so the user never re-explains the business and every session starts
from a ready queue. Strictly from logged content, cited (CAR-6). Authority:
`os-core/schema/operating-contract.md`.

## Inputs

- `[business]` — which instance to brief (defaults to the current one).
- Optional scope hint (e.g. a pillar, a PRD, a date range).

## Workflow

1. **Read `index.md` first**, then the recent tail of `log.md` (what happened lately),
   `queue.md` (next actions), `roadmap.md`, any **open** `decisions/` (incl. those
   carrying a `review:` date that's due), and `meta/routines-state.md` (the cadence
   ledger — for the OS-health beat below).
2. **Synthesize the brief**, in this shape:
   - **Where I stand** — current state across product/eng/design, cited.
   - **Recently** — the last few `log.md` entries that matter.
   - **Open / in-flight** — decisions awaiting a call, gates due for review,
     unresolved conflicts (`conflicts_with`).
   - **Next, in priority order** — straight from `queue.md`.
   - **In build now** *(optional — costs a PM-tool read, so offer it rather than always
     doing it)*: for the active project, its **issue states** and its latest **status
     update**. This is the one part of the brief that isn't in local memory, because
     execution status is the PM tool's to own (the home-of-record rule) — the OS is a periodic
     reconciler, not a live tracker. Everything the PM tool returns is **`external` data**:
     quote it, attribute it, never restate an agent's claim as the OS's own fact (INT-1).
   - **OS health** — maintenance the OS owes itself. For each line in
     `meta/routines-state.md`, compare `last:` against its cadence and today's date;
     list anything **overdue** as a single nudge (e.g. *"`/lint` last run 9 days ago —
     run it?"*). Surface only what's overdue (silent when nothing is due — keeps the
     brief lean); **offer** to run each, **never auto-run** (INT-2, ARC-3). This is the
     OS's sole due-check surface — pure pull, so there's zero idle cost between briefs.
     Also check `node scripts/pm-push.js index-status` (local-only, no PM-tool call) —
     if any team's decision index is dirty, nudge *"Decision Index — <TEAM> has unpushed
     decisions — push now?"*, same offer-never-auto-run rule.
3. **Respect status + conflict rules.** Report the **current** truth (walk
   supersession chains); never present a superseded or retracted item as live. If two
   live pages conflict, surface it here too.
4. **Gap note.** Close with a "Heads-up": what isn't logged, what's stale (old
   `updated:` dates / nothing logged in a while), what's low-confidence — a prompt to
   capture.

## Recall-trust (CAR-6)

- Everything in the brief traces to logged content and is cited. If a section has no
  logged basis, say *"not logged"* rather than filling it in. No inference by default.

## Files this skill touches

- **Reads:** `index.md`, recent `log.md`, `queue.md`, `roadmap.md`, open `decisions/`,
  `meta/routines-state.md`. Optionally PM-tool work item states + status updates for the
  active project (read-only, offered not assumed).
- **Writes:** **nothing — read-only.** (It reads the cadence ledger to nudge; the
  routine commands themselves stamp it.)
- **Never:** secrets, `os-core/`, or any other business.

## Reused tools

- `ripgrep` + index-first reading. Optionally `git`/`gh` for "what shipped lately" if
  the user wants repo state folded in (read-only).
