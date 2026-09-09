# PM adapter: Linear — verified behaviour

> Companion to `scripts/adapters/pm/linear.js`. Everything here was established by **live
> testing against a real Linear workspace**, not by reading documentation. Each finding is
> recorded because getting it wrong failed *silently*, which is the expensive kind.
>
> Contract: `os-core/schema/adapters.md`. Content shape: `os-core/schema/pm-content-standard.md`.
>
> When you register a different PM tool, run the same exercise and write its own version of
> this file. Do not assume another tool behaves like this one.

---

## Plan and cost

Documents are not gated or capped on any Linear plan, not by count and not by tier.
Verified against the pricing page and Linear's own documentation; every documented gate
(private teams, guests, Loops, Insights, service level agreements, sub-initiatives,
initiative views) is elsewhere. Free plan limits are 2 teams, 250 issues, and 10MB
uploads. A solo builder stays on Free comfortably.

Authentication is OAuth through the Linear MCP server. **No API key is introduced**, which
is why the SAF-1 posture holds without a token in `.secrets/`.

## Round-trip fidelity

**Survives unchanged:** headings, tables, nested lists, ordered sub-lists, checkboxes,
fenced code blocks, blockquotes, horizontal rules, inline formatting, smart punctuation.

**Silently rewritten** (looks identical on screen, breaks patch anchors):

| You send | Linear stores |
|---|---|
| `- bullet` | `* bullet` |
| `- [x]` | `- [X]` |
| `](url)` | `](<url>)` |
| table rule variants | `\|---\|` |

`normalizeStored()` in the adapter undoes exactly these, and is used **only** for change
detection, never for what gets sent.

**Actually broken, the one thing never to do:** a markdown link whose text wraps across a
source newline is split into two separate links. Keep every `[text](url)` on one line,
however long. This is why that rule is in the content standard as a hard formatting rule
rather than a preference.

**Bare newlines render as visible line breaks.** Linear's editor does not fold a single
newline into the paragraph the way CommonMark-to-HTML normally does, so hard-wrapped
source prose arrives looking broken mid-sentence. `pm-push.js` handles this generically
with `dewrap()`; local files stay hard-wrapped, which is better for diffs.

## Patching

Multi-operation atomic patches work, including multi-line anchors. Two rules follow:

1. **Anchors must come from a fresh `get_document`, never from the local source.** Patching
   with the exact text that had just been pushed *failed*, because Linear had already
   rewritten it. Patches are atomic, so one stale anchor aborts the whole save.
2. **Patch per section, compare normalized.** A whole-body replace is functionally
   identical to sending full `content` and destroys the document history that is the entire
   reason for patching. Sections are diffed **normalized** (undoing the rewrites above) but
   patched with **raw** anchors. Without normalization a one-word edit produced 3
   operations; with it, 1.

## Drift detection

**`updatedAt` is not usable.** It did not change across two confirmed content edits. Drift
detection therefore compares a content hash (`pushed_sha`) against a fresh fetch, which is
why `commit` hashes the body Linear *stores* rather than the body that was sent. Hashing
the sent body made a freshly-pushed document report drift immediately, which would have
made `/lint`'s drift check worthless from day one.

Linear documents do have **UI-level version history**, which is a useful human-browsable
safety net, but it is **not exposed over the MCP surface** (no history or revisions field
on `get_document` / `list_documents`). So it cannot be read back mechanically and does not
replace the `raw/` snapshot, which INT-3 requires to resolve locally anyway.

## Display and status

Linear documents support **no tags and no status field**, so display is the whole
mechanism for showing a non-current document:

- a title suffix (` [SUPERSEDED to DEC-XXXX]`, ` [RETRACTED]`), visible in every list view
- a status banner as the first line of the body, after the authored-by header

An adapter for a tool that *has* a real status field should use it rather than copying this
workaround.

## Containers

| Artifact | Destination |
|---|---|
| PRD | the bet's **project**, one PRD document per project |
| Decision, bet-scoped | that bet's project |
| Decision, product foundation or OS architecture | the owning **team**, not a project |
| Council | derived by following the review's `reviewed:` frontmatter to the PRD it reviewed, then using that PRD's route |
| Strategy | the product team, as a read-only copy |

Cross-cutting decisions go to **team level** rather than a project, because a Linear
project is a bet with a progress bar and decision records never complete.

## Deleting

There is **no delete-document tool** on the MCP surface. Archiving from the user interface
is as final as it gets; an archived document no longer appears in normal listings. Plan
test documents accordingly: a throwaway document is a permanent resident.

## Work items

Epic and Task map to a parent issue and its children, linked with `parentId` at create
time. The five fields `/work-order` sets are `state`, `priority`, `estimate`, `labels`,
`assignee`. Confirmed live: T-shirt sizing on `estimate` is a workspace-wide setting, so it
can be relied on without a per-team check.
