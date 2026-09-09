---
name: ask
description: >-
  Answer a question STRICTLY from the business's logged memory, with citations — or
  say "not logged" and name the gap. Reads index.md first, opens the candidate pages,
  and synthesizes a cited answer. If logged sources disagree, it surfaces BOTH sides
  and flags the conflict instead of silently picking one. Use this skill WHENEVER the
  user asks anything about the business's state, history, decisions, or the reasoning
  behind them — "what did we decide about…", "why did we…", "where are we on…", "what
  do we know about…", "remind me…", or any factual question that should be answered
  from memory rather than guessed. Never guesses or infers by default; never invents
  sources. Read-only unless the user asks to file the answer back.
---

# Ask — cited recall, or an honest "not logged"

Answer **strictly from logged content** (CAR-6). Provenance over fluency: a surfaced
gap is a feature, not a failure. Authority for all rules below:
`os-core/schema/operating-contract.md`.

## Inputs

- `<question>` — what the user wants to know.
- `[--infer]` — explicit opt-in to reason beyond logged content for *this* answer
  only. Without it, **zero inference**.
- The single business instance (this repo root).

## Workflow

1. **Read `index.md` first.** It is the catalog. Identify the candidate pages whose
   one-line summaries bear on the question.
2. **Open the candidate pages.** Read them and their cited `raw/` sources. Walk
   supersession chains so you answer with the **current** truth, not a superseded one.
   Skip `retracted` pages unless the user asks about them directly.

   **For a `prd` / `decision` / `council` page, the body lives in the PM tool (the home-of-record rule) and
   the local file is a summary-stub.** Read in this order, and stop as soon as you can
   answer:

   | Depth | Read | Cost |
   |---|---|---|
   | 1 | The local stub's **TL;DR paragraph**, a standalone answer by contract | free |
   | 2 | Its **`raw/` snapshot** — the full body as pushed, cited locally per INT-3 | free |
   | 3 | The **live PM-tool document**, fetched by `pm_doc_id` via the adapter | a network call |

   **Depth 3 only when the user explicitly asks for current live detail**, or when depths
   1–2 genuinely can't answer and you say so first. This ordering is the whole reason the
   stub exists: the common question costs nothing. Never open the PM tool reflexively "to be
   sure" — the `raw/` snapshot *is* the citable record, and a live fetch that merely
   confirms it has bought nothing.
3. **Determine the recall outcome (exactly one of three):**
   - **Knows + cites** — the logged pages give one consistent answer. State it, then
     cite the specific page(s) **and** their `raw/` source(s).
   - **Not logged** — nothing in the index/pages covers it. Lead with *"Not logged"* /
     *"I don't know"* and name precisely what's missing. Do **not** guess.
   - **Conflicted** — candidate pages disagree (whether or not a `conflicts_with`
     link already exists). Present **both sides**, each cited, and flag the conflict
     for resolution (supersede / retract / reconcile). Never silently pick a winner.
4. **Append a gap note.** A short "Heads-up" on what isn't logged, what looks stale
   (old `updated:` dates), or what's low-confidence — so the user can choose to
   capture it.
5. **Offer to file the answer back (optional).** A good, reusable answer can become a
   `wiki/qa/<slug>.md` page so explorations compound. Only on the user's approval;
   then update `index.md` + `log.md` and commit (SAF-2).

## Recall-trust (CAR-6) — the hard line

- Answer only from logged content. If it isn't logged, say so. **No guessing, no
  inference by default.** Inference happens only under `--infer`, and is clearly
  labelled as inference, not fact.
- **Always cite** when you know — page + `raw/` snapshot, with line ranges
  (`path#Lstart-end`) where useful. For a page whose body lives in the PM tool, cite the
  **local stub + its `raw/` snapshot**, and add the `pm_url` as a convenience link for
  the user to click. The citation must always resolve **locally** (INT-3) — a PM-tool URL
  alone is not a citation, because it can rot, be renamed, or be edited out from under you.
- **If a stub's `synced` is older than its `updated`**, the local page has moved on since
  it was last pushed. Answer from local (it's the newer truth) and flag the drift.
- State only what the sources support; flag uncertain claims as such. Never invent or
  paraphrase a citation you can't point to.

## Files this skill touches

- **Reads:** `index.md` (first), candidate `wiki/` pages, `decisions/`, `raw/`,
  `queue.md`/`roadmap.md` when relevant. **the PM tool, only on explicit request** (depth 3).
- **Writes:** nothing by default (read-only). Only on approval: a new `wiki/qa/` page
  + `index.md`/`log.md` lines.
- **Never:** secrets, `os-core/`, or any other business.

## Reused tools

- `ripgrep` + index-first reading for retrieval (no embeddings/RAG in V1).
