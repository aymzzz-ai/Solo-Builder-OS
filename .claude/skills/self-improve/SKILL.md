---
name: self-improve
description: >-
  The OS's reflection loop: read the accept/edit/reject signals the maintainer has been
  leaving and turn repeated corrections into PROPOSED improvements to the OS's own
  scaffolding — skills, the operating contract, or promoted reusable patterns. Use this skill
  WHENEVER the user wants the OS to improve itself, review its own performance, learn from how
  it's been corrected, or says any of: "self-improve", "improve yourself", "what have you
  learned", "tune the OS", "review your own skills", "promote lessons". It PROPOSES diffs and
  never self-modifies (ARC-3) — every change is drafted for explicit approval. It improves the
  machinery, never touches business wiki content, and sanitizes anything bound for the
  shareable `os-core/` (SAF-1/ARC-4). Always drafts for approval before writing.
---

# Self-improve — propose, never self-modify

Closes the OS's own learning loop. It mines the feedback signals left by every approve step
and the candidate lessons file, then **proposes** concrete improvements to its own skills,
schema, and patterns. It **never** edits itself unilaterally (ARC-3). Authority:
`os-core/schema/operating-contract.md`. **OS drafts, you approve.**

## What this is — and is NOT

- The **reflection loop**: repeated correction signals → proposed improvements to the OS's
  **scaffolding** (`os-core/`), not the business's data.
- **Proposes only (ARC-3).** It never auto-applies a change to `.claude/skills`, the
  contract, or `os-core/patterns/`. You approve every diff.
- It reads **signals**, not wiki content — it tunes the machinery, never rewrites business
  knowledge or decisions.
- It **sanitizes** anything headed for the shareable `os-core/` (no business slugs, names, or
  secrets leak into reusable scaffolding — SAF-1/ARC-4).

## Inputs

- `[scope]` — defaults to all signals since the last self-improve pass.
- The single business instance (whose signal files it reads — but its proposed writes
  target `os-core/`, the shared layer).

## Workflow

1. **Read the signals.** `meta/feedback-log.md` (what drafts were edited or rejected, and
   *how*), `meta/lessons.md` (candidate portable lessons), and recent `log.md` (what the OS
   has actually been doing).
2. **Detect patterns:**
   - a skill whose drafts are **consistently edited the same way** → propose a change to that
     `SKILL.md`;
   - a schema rule that keeps being **worked around** → propose a contract amendment (flag it
     loudly — the contract is the authority);
   - a recurring, **generalizable** lesson → propose promoting it to `os-core/patterns/`.
3. **Draft each as a concrete diff + rationale**, ranked by signal strength (how many times,
   how recently). Weak/one-off signals are noted, not acted on.
4. **Sanitize** anything bound for `os-core/`: strip business slugs, names, and any secret;
   **run `export-check` before proposing any `os-core/` write** (ARC-4 leak gate).

## Recall-trust (CAR-6)

Ground each proposal in the **specific** signals that justify it (cite the feedback-log /
lessons lines). Don't propose a change on a hunch; if the signal is thin, say so.

## Draft the writes (on approval only)

1. **`.claude/skills/<name>/SKILL.md`** or **`os-core/schema/operating-contract.md`** — the
   proposed diff (shown in full, with rationale). A contract change propagates to every host
   via `project-contract`, so flag it as higher-impact.
2. **`os-core/patterns/<slug>.md`** — a promoted, **sanitized** lesson; mark the source line
   in `meta/lessons.md` as promoted.
3. **Record** via git commit (SAF-2) — `os-core/` edits live in the repo history, not a
   business `log.md` (self-improve operates on the shared scaffolding, not on business data).

Show every proposed diff. Apply only what's approved; then **commit** (SAF-2). Either
way the pass ran, so **stamp the `self-improve` line in the instance's
`meta/routines-state.md`** with today's date (so `/brief` knows the reflection loop ran).

## Files this skill touches

- **Reads:** `meta/feedback-log.md`, `meta/lessons.md`, recent `log.md`.
- **Writes (on approval):** `.claude/skills/*`, `os-core/schema/operating-contract.md`,
  `os-core/patterns/*`; marks promoted lessons in `meta/lessons.md`; stamps the
  `self-improve` line in `meta/routines-state.md`.
- **Never writes:** business wiki content, secrets, or anything **without approval** —
  and never modifies itself silently (ARC-3).

## Reused tools / plug-in points

- **`export-check`** (`scripts/export-check.js`) — run before any `os-core/` write to catch
  a slug/secret leak (ARC-4).
- **`git`** — the record + rollback path (SAF-2). Schema authority:
  `os-core/schema/operating-contract.md` (directive 4 propose-never-act, directive 6 secrets,
  directive 7 reversible; ARC-2 host-agnostic core; ARC-3 self-improvement proposes only).
