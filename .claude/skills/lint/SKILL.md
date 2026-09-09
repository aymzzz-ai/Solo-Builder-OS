---
name: lint
description: >-
  Run a MECHANICAL health check over the memory store and report issues with their
  location and fix: broken links, orphan pages, stale claims, missing pages, frontmatter
  errors, and supersession/conflict integrity. Use this skill WHENEVER the user wants a
  structural health pass: "lint", "health check", "any broken links", "what's stale",
  "check the wiki integrity", or as the weekly curate/lint routine. Reports
  mechanically (and may apply trivial fixes on approval); for SEMANTIC judgment —
  debt, lock-in, drift — use conscience instead. Never edits without approval.
---

# Lint — mechanical health of the store

The compiler's checklist (Karpathy lint + claude-memory-compiler's 7 checks). Where
`conscience` judges meaning, `lint` checks **mechanics**: does the store hold together
structurally. Reports issues; trivial fixes only on approval. Authority:
`os-core/schema/operating-contract.md`.

## Inputs

- `[scope]` — a folder/type/tag to limit the check (defaults to the whole store).
- The single business instance (this repo root).

## Checks (mechanical)

1. **Broken links** — relative markdown links that don't resolve to a file.
2. **Orphans** — pages nothing links to and that aren't in `index.md`.
3. **Missing pages** — `links[]`/`index.md`/`log.md` references with no page behind
   them; important concepts mentioned repeatedly but lacking their own page.
4. **Stale claims** — pages with old `updated:` dates, or whose `sources[]` have been
   superseded by newer raw snapshots.
5. **Frontmatter integrity** — required fields present and valid: `id`, `title`,
   `type` (in taxonomy), `status` (one of `current|superseded|retracted`),
   `provenance`, `confidence`, `sources[]`.
6. **Supersession integrity** — every `superseded` page has a valid `superseded_by`
   and a reciprocal `supersedes`; no `current` page is also pointed at by a
   `superseded_by`; retracted pages carry `retracted_reason`.
7. **Conflict integrity** — `conflicts_with` links are reciprocal and resolve;
   flag unresolved conflicts between two `current` pages for the user's attention.
8. **Index/log sync** — `index.md` reflects actual pages, titles, summaries, and
   status; `log.md` prefixes are well-formed (`## [date] <op> | <id> <title>`).

### PM-tool sync checks (the home-of-record rule: `prd` / `decision` / `council` pages)

9. **Unpushed stub** — a page whose type says its body belongs in the PM tool but which has no
   `pm_doc_id`. Either it was never pushed, or a push failed partway.
10. **Stale sync** — `updated:` is newer than `synced:`. The local page moved on and was
    never re-pushed, so the PM tool is showing an older truth.
11. **Content drift** — someone edited the document **in the PM tool**. Detect with:
    ```
    fetch the live document by pm_doc_id  ->  write its body to a file
    node scripts/pm-push.js verify --page <path> --fetched <file>
    ```
    `verify` exits 1 on drift. **Never use the PM tool's `updatedAt`** — it is unreliable
    (verified: unchanged across two confirmed edits); `pushed_sha` is the only sound
    signal. Drift is a **flag, never an auto-fix**: local owns lifecycle, but silently
    re-pushing would destroy whatever the human wrote in the PM tool.
12. **Missing or moved document** — `pm_doc_id` no longer resolves.
13. **Unroutable page** — a pushable page with no entry in `meta/pm-routing.md`
    (`pm-push.js prepare` exits `UNMAPPED`). `local-only` entries are correct, not
    faults — don't flag those.
14. **TL;DR mismatch**. The stub's TL;DR paragraph must be byte-identical to the
    PM-tool document's. This is the contract `/ask` relies on to answer for free; if it
    breaks, recall quietly starts citing something the reader won't see.
15. **Un-ship signal** — a **Canceled** PM-tool work item in a project whose PRD says nothing
    about it. Something was built and backed out, or dropped, and the record doesn't know.
    Flag it for `/harvest` to classify (retract vs supersede vs a Results note).

Checks 11–15 need PM-tool reads, so they run **only when the user asks for a PM tool pass**
or as part of `/update-OS`. A bare `/lint` stays local and free.

## Workflow

1. **Scan** the scope (`ripgrep` over frontmatter, links, dates).
2. **Produce a health report** — each issue as **what · where (page + line) · fix**.
3. **Trivial fixes only, on approval** — e.g. repair a broken relative link, correct
   an index line, add a missing reciprocal `links[]`. Anything requiring judgment
   (merging, rewriting, resolving a conflict, deciding supersession) is **handed to
   `curate`/`conscience`/the user**, not auto-fixed.
4. **Commit** approved fixes (SAF-2), append a `log.md` `lint` entry, and **stamp the
   `lint` line in `meta/routines-state.md`** with today's date (so `/brief` knows it ran).

## Hard rules from the contract

- **Mechanical only.** No semantic judgment, no content rewriting — that's
  `conscience` (judgment) and `curate` (restructure).
- **Never delete; never auto-resolve a conflict or supersession.** Flag it.
- `raw/` is immutable — lint reads it for integrity but never edits it.
- **Never auto-reconcile PM-tool drift.** Report it and let the user decide. There is
  deliberately no automatic reconciler: an edit in the PM tool is a human acting, and
  overwriting it unasked would be the OS destroying someone's work to satisfy a hash.

## Files this skill touches

- **Reads:** all pages in scope (frontmatter/links/dates), `index.md`, `log.md`,
  `raw/` (read-only integrity).
- **Writes (on approval):** trivial structural fixes + `log.md` entry, git-committed;
  stamps the `lint` line in `meta/routines-state.md`.
- **Never:** secrets, `raw/` bodies, `os-core/`, or any other business.

## Reused tools

- `ripgrep` for fast frontmatter/link scanning. Reuses the
  **claude-memory-compiler lint checklist as a design reference** (not its Python).
