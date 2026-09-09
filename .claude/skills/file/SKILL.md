---
name: file
description: >-
  Propose the right home and structure for already-captured but loose or misfiled
  content — without re-ingesting it. Reads index.md and the taxonomy, then proposes a
  folder/type, title/id, cross-links, and any split or merge, as a draft for approval.
  Use this skill WHENEVER content exists but isn't well-placed: "where should this
  live", "file this properly", "organize this page", "this is in the wrong place",
  "split/merge these", or after a quick capture that needs a proper home. This is the
  information-architect job (placement & structure), distinct from ingest (which brings
  a NEW source in). Proposes only; never moves or edits until the user approves.
---

# File — give loose content a proper home

The librarian move: take content that's already in the store (or just captured) and
propose **where it belongs and how it's structured**, so the wiki stays coherent and
human-navigable. No new source capture (that's `ingest`). Proposes only — you approve.
Authority: `os-core/schema/operating-contract.md`.

## Inputs

- `[page | topic | path]` — the loose content to place (defaults to the most recently
  touched unfiled page/note).
- The single business instance (this repo root).

## Workflow

1. **Read `index.md` and the taxonomy** (`type` values + folder map in the contract,
   §3.2). Understand what already exists so you place, not duplicate.
2. **Diagnose placement.** Decide the right `type` (`concept | entity | qa | decision |
   prd`, extensible) and therefore the right folder + id convention. Check for an
   existing page this should **merge into** rather than sit beside, or content that
   should **split** into more than one page.
3. **Propose the structure**, as a draft:
   - target folder + `type`, final `title`/`id`;
   - frontmatter to set/fix (provenance, sources, status, tags);
   - reciprocal `links[]` to related pages;
   - any split/merge, with the rationale.
4. **Update navigation in the proposal** — the `index.md` line(s) and a `log.md`
   `file` entry that the move will produce.
5. **Apply on approval.** Move/create the page, fix frontmatter, update `index.md` +
   reciprocal `links[]`, append `log.md`, and **commit** (SAF-2).

## Rules from the contract

- **Supersede/retract, never delete** — if filing reveals a duplicate or an outdated
  page, propose superseding (chain it) or retracting, not deletion.
- **Links are relative markdown links**, not `[[wikilinks]]`.
- **Recall-trust** — don't invent content while filing; structure only what's there.
  If placement is genuinely ambiguous, ask rather than guess.

## Files this skill touches

- **Reads:** `index.md`, the taxonomy in the contract, the target content + nearby
  pages.
- **Writes (on approval):** move/create a `wiki/`|`decisions/`|`prds/` page, update
  `index.md` + `links[]`, append `log.md`.
- **Never:** secrets, `raw/` (immutable), `os-core/`, or any other business.
