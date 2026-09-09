---
name: define-north-star
description: >-
  Define or refine the one metric that best captures the value the product delivers — the
  north-star — and the few input metrics that drive it. Use this skill WHENEVER the user
  wants to set, sharpen, or pressure-test the north-star, pick the metric that matters, or
  says any of: "north star", "north-star metric", "the one metric", "what should we measure",
  "is this the right metric". It writes the north-star as a SECTION of `strategy.md` (not a
  separate page). Pre-launch: the north-star is a HYPOTHESIS about the value metric plus how
  it'll be instrumented once there are users — never asserted as a measured number. Always
  drafts for approval before writing.
---

# Define north-star — the one metric that proxies real value

The north-star is the single metric that best tracks delivered value; everything else is an
input to it. Per operating-contract §3.4 it lives as a **section of `strategy.md`**, not a
standalone page. Adapted from PM-OS `define-north-star` (pre-launch mode). Authority:
`os-core/schema/operating-contract.md`. **OS drafts, you approve.**

## What this is — and is NOT

- Writes/refines the **north-star section of `strategy.md`** — one metric + 2–4 input
  metrics + an anti-gaming guardrail.
- **NOT** a metrics dashboard or a full measurement framework — it picks and defends *the
  one number* (and its drivers), nothing more.
- **Pre-launch mode:** there are no users yet, so the north-star is a **hypothesis + a
  confidence level** about what proxies value, plus a note on **how/when it'll be
  instrumented** once there is traffic. Never written as a measured figure.

## Inputs

- `[metric idea | pasted notes]` — optional seed.
- The single business instance (this repo root).

## Read first

`index.md` → `strategy.md` (the existing north-star section, if any — refine, don't
duplicate) → `prds/` and `feedback.md` (what value users actually point to). If no
`strategy.md` exists yet, say so and recommend `/strategy` first (this can still seed a
minimal file with just the north-star section).

## Workflow

1. **Elicit** (`grill-me`, one question at a time):
   - *What single number best captures the value a user gets — not activity, value?*
   - *Why does it proxy **real** value rather than vanity (would it still look good if the
     product were failing the user)?*
   - *What 2–4 **input metrics** drive it (the levers you can actually move)?*
   - *What's the **guardrail** that stops the metric being gamed at the user's expense?*
2. **Pre-launch framing:** state the metric as a hypothesis + confidence; note how it will
   be instrumented when users arrive (you can't measure it today).
3. **Recall-trust (CAR-6):** any claim about what users value is **cited** to logged
   feedback/research or flagged **"not logged."**

## Draft the writes (then get approval)

1. **`strategy.md`** — author/refine the **north-star section** (metric · why it proxies
   value · input metrics · guardrail · instrumentation note). On a refine, **append** a
   dated follow-up rather than rewriting the original definition (§3.4 point-in-time rule).
   If creating `strategy.md` fresh, include only the north-star section and flag the rest as
   pending `/strategy`.
2. **`log.md`** — `## [<date>] strategy | north-star <metric>` (the north-star is part of
   the strategy hub, so it logs under the `strategy` op).

Show the full draft. Apply only what's approved; then **commit** (SAF-2). Record the
accept/edit/reject signal to `meta/feedback-log.md`.

## Re-push strategy.md if it's already on the PM tool

The north-star is a section of `strategy.md`, and `strategy.md` is pushed as a read-only
team document (`/strategy`'s "Push to the PM tool" step, `meta/pm-routing.md`). If this
skill edits a `strategy.md` that already has a `pm_doc_id`, **the local edit alone
leaves the PM tool silently stale**. `/lint`'s drift check will eventually flag it, but not
until its next run, and not to the person who just made the edit. So: after the local
write is approved, either run `/strategy`'s push step yourself
(`os-core/patterns/pm-push.md`, `--material`, a north-star change always is), or
tell the user plainly that the PM tool copy is now out of date and offer to push it.
Never leave this unmentioned.

## Files this skill touches

- **Reads:** `index.md`, `strategy.md`, `prds/`, `feedback.md`.
- **Writes (on approval):** the north-star section of `strategy.md`; `log.md`,
  `meta/feedback-log.md`. In the PM tool, if `strategy.md` is already pushed: a re-push of the
  same document (see above).
- **Never writes:** secrets, `os-core/`, or any other business.

## Reused tools / plug-in points

- **`grill-me`** (`.claude/skills/grill-me`) — the elicitation engine.
- Pairs with **`/strategy`** (which embeds this section). Schema authority:
  `os-core/schema/operating-contract.md` (§3.4 strategy hub, §7 `strategy` op).
