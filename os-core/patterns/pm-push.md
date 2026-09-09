# Pattern — pushing an artifact to the PM tool

> The shared procedure every push-capable skill follows (`/decision-doc`, `/prd`,
> `/council`, `/strategy`, `/harvest`, `/gate`). Written once here so six skills can't
> drift into six subtly different behaviours. Authority for *shape*:
> `os-core/schema/pm-content-standard.md`. Authority for *rules*:
> `os-core/schema/operating-contract.md`. Authority for *which tool and how it behaves*:
> `os-core/schema/adapters.md` plus the active adapter's own doc.
>
> **`scripts/pm-push.js` owns the mechanics; you own the judgment.** Never hand-roll these
> steps. The script exists because they are exactly the steps a model does unreliably under
> context pressure.

---

## What you decide vs what the script decides

| You (the skill) | The script |
|---|---|
| Which destination, when the route is unmapped | Resolving a mapped route |
| What the TL;DR paragraph says | Rendering the body from the page |
| Whether a change is **material** | Hashing, snapshotting, stub/index/log writes |
| Whether to push at all | Refusing to push a `local-only` page |
| **What the new body is, when updating a stubbed page** | Refusing to guess it |

## The sequence

Run **after** the user has approved the local page, never before.

```
1. node scripts/pm-push.js prepare --page <path> --json
```

Gives you the destination, the document title, the rendered body, whether the page is
already pushed, and (for a delegated adapter) the exact call to make. Write the `body`
field to a temp file.

- **Exit 2 `UNMAPPED`** → the route isn't in the routing table. **Ask the user where it
  belongs**, add one line, re-run. Never guess a destination.
- **Exit 2 `LOCAL-ONLY`** → this page is deliberately never pushed. Stop; say so.
- **Exit 3 `EM DASH`** → fix the local page, then re-run. Do not work around it.

**Delegated vs direct.** `prepare --json` reports `delegated`. A *delegated* adapter
(Linear) is reachable only over MCP, which scripts cannot call, so **you** make the tool
call using the `instruction` block. A *direct* adapter (GitHub via `gh`) performs its own
write and hands you back the id and URL.

```
2a. NEW (no pm_doc_id):
    create the document with the full body

2b. EXISTING (has pm_doc_id):
    fetch the live document                            <- FIRST, always
    write its content straight to a file
    build the NEW body from THAT file plus your change  <- see below
    node scripts/pm-push.js patch-ops --page <path> --fetched <file> --desired <file>
    apply the returned ops   (skip entirely if upToDate: true)
```

**Never send a full body to a document that already exists.** It wipes that document's
history, which is the whole reason patching exists.

### The update path, stated plainly

Once a page has been pushed, `commit` reduces its local body to a **summary-stub**. The
full document now lives in the PM tool and in `raw/`. So on an update:

> **The local page is no longer the body.** The new body is the **fetched** document plus
> whatever you are changing (a Results section appended by `/harvest`, a verdict appended
> by `/council`, a tightened TL;DR from `/curate`).

`patch-ops` detects a stubbed page and **refuses** unless you pass `--desired`. That guard
exists because the alternative is silent: re-rendering the stub would push the stub *over*
the real document and destroy it, on the first update of every migrated page.

```
3. fetch the document AGAIN, after the write. Not optional.
   write its content to a file
4. node scripts/pm-push.js commit --page <path> --doc-id <id> --url <url> \
     --stored <that file> [--material]
```

Step 3 is not optional because **PM tools rewrite markdown as they store it**. Hashing what
you *sent* makes the document report drift the instant it is pushed, which would make
`/lint`'s drift check worthless. `commit` records the hash of what the tool actually holds.

**Write a fetched body straight to the target file. Never wrap it in JSON or any other
intermediate encoding first.** `Write`'s content is literal text; a fetched result
containing quote marks needs no escaping to land in a `.md` file. Round-tripping through
JSON to "safely" handle those quotes adds real escaping overhead for no fidelity gain, and
it recurs on every single push.

`commit` is the only writer of `synced` / `pushed_sha`, and it runs last, so if any step
above fails, **stop**: the stub will correctly show the page as un-synced. Do not
hand-patch frontmatter to paper over a failed push.

## When is a change "material"?

Pass `--material` when the change is worth a permanent `raw/` snapshot (INT-3):

- **Material:** creation · supersede or retract · a stage change · a substantive rewrite of
  the body or the TL;DR.
- **Not material:** a typo, a link fix, re-rendered metadata, a date bump.

When genuinely unsure, prefer `--material`. An extra snapshot costs a file; a missing one
breaks a citation chain that INT-3 says must always resolve locally.

## After the push

- Report to the user: the document URL, the destination, and whether a snapshot was taken.
- `commit` already handled `index.md` and `log.md`. Don't duplicate those writes.
- Git-commit the approved change (SAF-2), specific files only.

## Hard rules

- **Draft → user approves → push.** There is no autonomous write to the PM tool. INT-2 has
  no carve-out.
- **Frontmatter never leaves the instance.** The script strips it and renders a
  `## Metadata` footer instead. Lifecycle (`status`, supersession, conflicts) stays local;
  PM tools have no model for it.
- **The TL;DR paragraph is byte-identical**, label included, local and pushed. It is what
  lets `/ask` answer from local files with zero PM-tool calls. Never reword one side only.
- **Never store the document URL as an identifier.** Renaming changes the slug. `pm_doc_id`
  is the identity; `pm_url` is a convenience, regenerated each push.
