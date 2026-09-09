---
name: decision-doc
description: >-
  The canonical minter of decision records (DEC-XXXX) — the ONE place a decision page is
  created, so sequence numbers, schema, filing, and supersession stay consistent. Use this
  skill WHENEVER the user wants to record/log a decision, capture why a choice was made, mint
  an ADR, supersede a prior decision, or says any of: "decision doc", "log this decision",
  "record the decision", "ADR", "DEC", "capture why we decided". Other commands (`/gate`,
  `/council`, `/harvest`, `/prd`) produce decision CONTENT and delegate the minting here. It
  captures the WHY + the rejected alternatives — that's the whole point. On approval it pushes
  the decision body to the PM tool and reduces the local file to a summary-stub.
  Solo-rescoped: no DACI roles, no sign-off routing, no announce step. Always drafts for
  approval before writing.
---

# Decision-doc — the canonical DEC-XXXX minter

The single source of decision records. Owns the `DEC-XXXX` sequence, the §3.3 schema, filing,
index/log, and supersession chains — so every decision in the wiki is shaped and numbered the
same way (A2.0 Q6). Adapted from PM-OS `decision-doc`. Authority:
`os-core/schema/operating-contract.md`. **OS drafts, you approve.**

The decision **body lives in the PM tool**; the local file keeps frontmatter, the TL;DR
paragraph, and a link out. **The `DEC-XXXX` sequence stays local**, derived from
`decisions/` and `index.md`. The PM tool must never own the numbering.

## What this is — and is NOT

- The **only** skill that creates a `decision` page. `/gate`, `/council`, `/harvest`, and
  `/prd` generate decision *content* and **delegate minting here** so numbering/schema stay
  consistent.
- It captures the **WHY (rationale) + the rejected alternatives** — the reason a decision
  record exists (§3.3).
- **Solo-rescoped:** **no** DACI roles, **no** approval/sign-off routing, **no**
  announce/Slack step (INT-2).
- Handles **supersession**: superseding a prior `DEC` sets the chain (§5); nothing is deleted.

## Inputs

- `<decision | pasted content>`, or content handed in from `/gate` / `/council` / `/harvest`
  / `/prd`.
- `[--supersedes DEC-XXXX]` · `[--discipline product|design|engineering|architecture]` ·
  `[--review <date>]`.
- The single business instance (this repo root).

## Workflow

1. **Read first.** `index.md` → `decisions/` (find the **next sequence number**; check for a
   decision this **supersedes** or **conflicts with**) → relevant `prds/` / `strategy.md`.
2. **Assemble the §3.3 content** (elicit with `grill-me` if handed a thin decision):
   - **the decision** — one line;
   - **rationale** — the WHY, in prose;
   - **alternatives_rejected** — each `option` + `why_not`;
   - **discipline** — product | design | engineering | architecture;
   - optional **`review:`** date (a kill/continue gate — `/gate` sets this).
3. **Supersession / conflict.** `--supersedes` → old `DEC` gets `status: superseded` +
   `superseded_by`; new `DEC` gets `supersedes: [old]` (§5). If two current decisions
   disagree, set `conflicts_with` both ways (§6) rather than silently overriding.
4. **Recall-trust (CAR-6):** any fact the rationale leans on is **cited** or flagged
   **"not logged."**

## Draft the writes (then get approval)

1. **`decisions/DEC-XXXX-<slug>.md`** — `DEC-` + zero-padded next sequence; full §3.1 + §3.3
   frontmatter; TL;DR-first body (the decision, then rationale, then alternatives).

   **The TL;DR is written to a formula:** We decided to `<X>`, because `<the one dominant
   reason>`. Rejected: `<strongest alternative>`, `<why not>`. Two to four sentences,
   byte-identical to the PM-tool document. The strongest rejected alternative belongs in
   the TL;DR itself, not only in the section below: *"why did we rule out X"* is the most
   common follow-up to *"why did we do Y"*, and putting it here means answering that
   never costs a live PM-tool call.

   **Title:** `DEC-XXXX: <title>`, with a colon. **House style: no em dashes**, acronyms
   expanded on first use (`os-core/schema/pm-content-standard.md`). `scripts/pm-push.js`
   refuses a body containing one, including text arriving from `rationale` and
   `alternatives_rejected` in frontmatter.
2. **`index.md`** — under the **Decisions** group, one line `[status]`.
3. **`log.md`** — `## [<date>] decision | DEC-XXXX <title>`.
4. **Link back.** If the content came from a PRD / council / gate, **append** a ≤3-line
   summary + link into that hub, and ensure the hub's `links[]` points to the new `DEC`
   (summarize-and-link, §3.4).
5. **Supersession writes.** Update the superseded `DEC`'s frontmatter + its `index.md` status.

Show the full draft. Apply only what's approved.

## Push to the PM tool (after approval)

Follow **`os-core/patterns/pm-push.md`** — the shared procedure. Do not hand-roll it.

```
node scripts/pm-push.js prepare --page decisions/DEC-XXXX-<slug>.md --json
```

Decision-specific notes:

- **Routing** is already settled in `meta/pm-routing.md`: bet-scoped → that bet's
  project · product-foundation → the **product team** · OS/architecture → the **OS team**
  (the actual team keys live in `meta/pm-routing.md`). A **new**
  decision won't have a route yet, so `prepare` exits `UNMAPPED` — **ask the user which of
  those three it is**, add the one line, re-run. That question is the routing decision, and
  it deserves to be asked rather than guessed.
- **Materiality:** minting is always `--material`. So is a supersede or retract.
- **`rationale` and `alternatives_rejected` live in frontmatter** and are re-rendered into
  the pushed body as `## Rationale` / `## Alternatives rejected`. Don't duplicate them in
  the body — you'd get them twice.

## Supersession, with a PM-tool side

When `--supersedes` applies, the superseded decision needs its PM-tool document updated too,
not just its local frontmatter: its **title gains ` [SUPERSEDED to DEC-XXXX]`** and its body
gains the status banner. Both are produced automatically by re-running the push on the
*old* page once its frontmatter is updated: re-push it so its title suffix and status
banner reflect the supersession (`os-core/patterns/pm-push.md`).
Skipping this leaves a document that reads as current when it isn't.

## Files this skill touches

- **Reads:** `index.md`, `decisions/`, relevant `prds/` / `strategy.md` / `council/`,
  `meta/pm-routing.md`.
- **Writes (on approval):** `decisions/DEC-XXXX-<slug>.md`, `index.md`, `log.md`,
  `meta/feedback-log.md`, `meta/pm-routing.md` (a new route line for a first push);
  **append** the linking hub; update any superseded `DEC`. In the PM tool: the decision document.
- **Never writes:** secrets, `os-core/`, or any other business.

Then **commit** (SAF-2) and record the accept/edit/reject signal to `meta/feedback-log.md`.

## Reused tools / plug-in points

- **`grill-me`** (`.claude/skills/grill-me`) — elicit rationale + rejected alternatives when
  the handed-in decision is thin.
- **Fed by** `/gate`, `/council`, `/harvest`, `/prd`. Schema authority:
  `os-core/schema/operating-contract.md` (§3.3 decision records, §5 supersession, §6
  conflict, §7 `decision` op + index/log formats, §9 DEC id convention).
