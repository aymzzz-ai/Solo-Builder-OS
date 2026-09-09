# PM adapter: GitHub Issues — verified behaviour

> Companion to `scripts/adapters/pm/github-issues.js`. Everything here was established by
> **live testing against a real private repository**, not by reading documentation.
>
> Contract: `os-core/schema/adapters.md`. Content shape: `os-core/schema/pm-content-standard.md`.
>
> Round-trip fidelity, both body surfaces, the Epic/Task sub-issue model, and the update
> path were each exercised end to end against a real repository.

---

## Reached directly, not delegated

GitHub is reachable from a script through the `gh` command-line tool, which carries the
user's existing OAuth login. So unlike Linear (MCP-only, therefore delegated to the model),
this adapter performs its own writes via `node scripts/pm-push.js push`. **No API key is
introduced**; `gh auth status` is the whole credential story, and `repo` scope is enough.

## The gap this adapter fills: no document object

GitHub has nothing equivalent to a Linear document. Its **wiki is unavailable on private
repositories on the free plan**, which CAR-1 rules out for a solo builder whose product
repo is almost certainly private. So artifact bodies go to one of two surfaces, chosen at
onboarding and recorded in `pm_config.doc_surface`:

| Surface | What it is | Chosen when |
|---|---|---|
| `discussions` **(default)** | A discussion per artifact, in a category | You want a browsable, commentable surface separate from the code, readable in the mobile app |
| `repo-files` | Markdown under `docs/os/` in the product repo | You want the bodies versioned with the code and directly readable by the build agent |

Discussions is the default because it preserves the property that motivated pushing bodies
out of local markdown in the first place: being able to read a PRD on a phone, away from
the machine. `repo-files` is closer to "local markdown in a second repository", which is
simpler but buys less.

Discussions must be **enabled per repository** (`PATCH /repos/{owner}/{repo}`,
`has_discussions=true`) and the target **category must already exist**. The adapter fails
loudly with the list of available categories rather than inventing one.

## Round-trip fidelity: byte-identical

**Verified on both surfaces, on create and on update: GitHub stores exactly what it is
given. Zero rewrites.** A body exercising headings, tables, ordered and nested lists,
checked and unchecked checkboxes, fenced code, blockquotes, and inline links came back
byte-for-byte identical.

This is a real difference from Linear, which silently rewrites bullets, checkboxes, link
URLs and table rules. Consequences:

- `normalizeStored()` is the **identity function** here. It is written out explicitly
  rather than omitted, so the contrast is visible rather than looking like an oversight.
- There is no phantom-edit problem to design around.
- The content standard's one-line-link rule still applies for readability, but on GitHub it
  is a preference rather than a correctness requirement.

## No partial update

Neither surface offers a patch operation:

- `updateDiscussion` (GraphQL) replaces the whole body.
- The Contents API replaces the whole file.

So `meta.supportsPatch` is **false** and `pm-push.js` falls back to a wholesale replace.
Nothing is lost safety-wise. What is lost is granular *history*, and GitHub keeps its own
version of that anyway: a discussion carries an edit history, and a file write is a real
commit with a real diff. On Linear, patching existed precisely because a whole-body replace
destroyed the only history there was; here that reasoning does not apply.

The Contents API **requires the current blob `sha`** to overwrite, which is GitHub's own
version of fetch-before-write: without it the call is rejected rather than silently
clobbering someone's edit.

## Drift detection

`updatedAt` **does move on edit** (verified), unlike Linear's. The adapter still relies on
the content hash in `pushed_sha`, because it is uniform across adapters and costs nothing,
but `updatedAtIsReliable` is set to `true` so a future check can use it as a cheap
pre-filter.

## Work items: Epic and Task

Sub-issues are a stable API (REST and GraphQL). Verified live:

```
POST /repos/{owner}/{repo}/issues/{parent_number}/sub_issues   { sub_issue_id }
GET  /repos/{owner}/{repo}/issues/{parent_number}/sub_issues
```

> **The trap, and it is a real one: `sub_issue_id` is the issue's numeric DATABASE id, not
> its issue number.** Passing the number is the obvious mistake and fails confusingly. The
> adapter captures both fields at create time and uses the right one deliberately.

Constraint: a sub-issue must belong to the **same repository owner** as its parent.
Secondary rate limits apply to rapid creation, so a large Epic should not be fired off in a
tight loop.

## Routing shape

There is no team/project hierarchy to mirror. **The repository is the container**, and the
category (or folder) is the shelf:

```json
{
  "defaults": { "repo": "<owner>/<name>", "category": "General" },
  "routes": {
    "prds/auth-rebuild.md":          { "repo": "<owner>/<name>", "category": "PRDs" },
    "decisions/DEC-0007-....md":     { "repo": "<owner>/<name>", "category": "Decisions" },
    "council/2026-06-18-idea.md":    { "local-only": "pre-bet review, no bet exists yet" }
  }
}
```

With `doc_surface: repo-files`, a route uses `folder` instead of `category`, and the
document's identifier is its **path**, which is what gets stored in `pm_doc_id`.

## Status display

Like Linear, a discussion has no status field the OS can use, so display is the mechanism:
a title suffix (` [SUPERSEDED to DEC-XXXX]`, ` [RETRACTED]`) plus a banner at the top of
the body. Discussions can also be **locked**, which is a reasonable additional signal for a
retracted record, but it is not currently used: locking is a moderation action and would be
an outward-looking change the OS has not been asked to make.
