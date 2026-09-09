---
name: prioritize
description: >-
  Rank a backlog by impact × effort × confidence so the next build is the highest-leverage
  one — a transparent, auditable ranking over queue.md / roadmap.md, not a black box and not
  a personal time-management tool. Use this skill WHENEVER the user wants to decide what to
  build next, sequence the roadmap, sort the backlog, or says any of: "prioritize", "what
  should I work on", "what's next to build", "rank these", "is this worth doing before X".
  Run with `--deep <bet|prd-slug>` to size a single bet instead (folded-in impact-sizing:
  opportunity size + assumptions + cheap de-risking steps), with the summary linked back
  into that PRD. Pre-launch: impact and confidence are explicit hypotheses + confidence,
  never measured data. Always drafts the re-ranking for approval before writing.
---

# Prioritize — rank by impact × effort × confidence

Decides sequence so effort lands on the highest-leverage bet. A **BUILD** (not adapted): the
old personal-time-management `prioritize` was dropped; this ranks the product backlog.
Authority: `os-core/schema/operating-contract.md`. **OS drafts, you approve.**

## What this is — and is NOT

- A **backlog ranker** over `queue.md` / `roadmap.md`, scoring each item on three axes and
  showing the scores so the ranking is auditable.
- **NOT** a personal to-do / time-blocking tool (that LNO skill was dropped at A1).
- **Pre-launch mode:** impact and confidence are **hypotheses + a confidence level**, not
  measured numbers. State them as such.
- It **proposes** a ranking; it never silently reorders the backlog.

## Inputs

- `[scope]` — defaults to the whole `queue.md`; may narrow to a roadmap area.
- `--deep <bet | prd-slug>` — switch to **single-bet impact-sizing** (the folded-in
  `impact-sizing`).
- The single business instance (this repo root).

## Workflow (ranking mode)

1. **Read first.** `index.md` → `queue.md`, `roadmap.md`, the relevant `prds/`, and
   `strategy.md` — the north-star defines what **impact** even means here.
2. **Score each item** on three axes, transparently:
   - **Impact** — how much it moves the north-star / serves the strategy.
   - **Effort** — build cost for a solo operator working through AI tools.
   - **Confidence** — how sure you are of the impact *and* the effort (CAR-6: cite the
     evidence, or flag the number as an assumption).
3. **Rank** by a simple, stated formula (**impact × confidence ÷ effort**). Show the
   per-item scores and a one-line rationale — never a bare ordered list.
4. **Pre-launch:** mark impact/confidence as hypotheses; don't dress assumptions as data.

## Workflow (`--deep` single-bet sizing)

Size one bet instead of ranking many: **who is affected, how often, and the magnitude** of
the pain/gain → the **assumptions** the size rests on → the **cheapest way to de-risk** the
biggest assumption before committing. Output a sizing summary (qualitative + confidence,
pre-launch). This is what `/prd` calls to fill a PRD's sizing.

## Recall-trust (CAR-6)

Any impact/effort claim leans on a **cited** logged page, or is flagged **"not logged"** /
an assumption. External benchmarks are quarantined to `raw/` and cited (the planning-skill
recall rule). Surface conflicting evidence rather than averaging it (§6).

## Writing style — the queue is read by the founder, not the machine

`queue.md` is operator-facing (the dashboard renders it verbatim). Author it in plain
English (maintainer feedback, 2026-07-16):

- **Action = an imperative task** the founder could start today ("Hire a UK
  data-protection solicitor…", "Build the cookie consent banner"), never a ledger label.
- **Why = why this matters to the founder now**, in a full sentence. Expand every acronym
  on first use ("Privacy and Electronic Communications Regulations, PECR"); say "flagged
  red in the legal roadmap", not a bare "RED". No OS-internal shorthand (RUR, CAW-as-jargon,
  council arrows) without translation.
- **Sequencing facts live in the rows** they gate (e.g. "can't ship until access control
  (#4) is done") — do not accumulate a separate "Notes & sequencing" section.
- OS bookkeeping (re-rank provenance, formula caveats) stays in blockquotes — the dashboard
  de-emphasizes those automatically; real warnings carry **⚠**.

## Draft the writes (then get approval)

1. **`queue.md`** — the proposed re-ranked order, each item with its scores + one-line why.
2. **`roadmap.md`** — only if the ranking changes how bets are sequenced.
3. **(`--deep`)** — append a 2–3 line sizing summary **+ link** into the PRD's *Strategic
   context* section (summarize-and-link; **append**, never rewrite — §3.4).
4. **`log.md`** — `## [<date>] prioritize | <scope> <summary>`.

Show the full draft. Apply only what's approved; then **commit** (SAF-2). Record the
accept/edit/reject signal to `meta/feedback-log.md`.

## Files this skill touches

- **Reads:** `index.md`, `queue.md`, `roadmap.md`, relevant `prds/`, `strategy.md`.
- **Writes (on approval):** `queue.md`, `roadmap.md`; (`--deep`) **append** the PRD;
  `log.md`, `meta/feedback-log.md`.
- **Never writes:** secrets, `os-core/`, or any other business.

## Reused tools / plug-in points

- **`grill-me`** (`.claude/skills/grill-me`) — optional, to elicit effort/confidence when an
  item is vague.
- Called by **`/prd`** for sizing (`--deep`). Schema authority:
  `os-core/schema/operating-contract.md` (§3.4 summarize-and-link, §6 conflict, §7 `prioritize`
  op + index/log formats).
