# Adapter contract — PM tools and build tools

> **What this file is.** The contract a tool integration must satisfy to plug into this
> OS. Two roles exist: the **PM tool** (where artifact bodies and execution status live)
> and the **build tool** (where code actually gets written). Each role has one or more
> **adapters**; exactly one of each is active per business instance, named in
> `config/tools.md`.
>
> Audience: *you*, the LLM, when you are wiring up a new tool or reading how the active
> one behaves. Authority: `os-core/schema/operating-contract.md` wins if they disagree.

---

## Why adapters exist

The OS keeps synthesis and lifecycle in local markdown, and pushes artifact **bodies**
(PRDs, decision records, council reviews) out to a project-management tool where they
are browsable, linkable, and readable on a phone. That push is real work: resolving a
destination, rendering a body, patching an existing document without destroying its
history, and hashing what came back so drift can be detected later.

None of that is tool-specific in *shape*. All of it is tool-specific in *detail*. The
adapter is the seam: **the generic half lives in `scripts/pm-push.js` and the skills;
the tool-specific half lives in one adapter file.**

This is a **hybrid registry**, deliberately. Pre-built reference adapters cover the
common cases; the contract below plus the guided path in `/onboard` covers everything
else. It is not a closed set, and it is not a full runtime abstraction.

## The two roles

| Role | Config key | What it owns | Reference adapters |
|---|---|---|---|
| **PM tool** | `pm_tool` | Artifact bodies, work items (Epic/Task), execution status | `linear`, `github-issues` |
| **build tool** | `build_tool` | Writing code. The OS is **never** inside this (CAR-4). | `replit`, `lovable` |

The asymmetry is intentional. A PM adapter is **code**, because the OS writes to the PM
tool constantly and those writes must be deterministic. A build adapter is mostly
**documentation**, because the OS never writes to the build tool at all: it only needs to
know which tools are safe to read with and which must be denied.

---

## `config/tools.md` — the active selection

One file per instance, at the instance root. Prose for you, a fenced `json` block for
the scripts (same parsing trick `scripts/project-contract.js` already uses).

````markdown
# Active tools

Chosen at onboarding. Changing either of these is a decision: record it with
`/decision-doc` before editing this file.

```json
{
  "pm_tool": "linear",
  "build_tool": "replit",
  "pm_config": {},
  "build_config": {}
}
```
````

- `pm_tool` resolves to `scripts/adapters/pm/<name>.js`.
- `build_tool` resolves to `scripts/adapters/build/<name>.md`.
- `pm_config` / `build_config` carry adapter-specific settings. Each adapter documents
  its own keys and validates them. An adapter that needs no settings leaves it empty.
- **Secrets never go here** (SAF-1). This file is committed. Tokens live in `.secrets/`
  or, better, in an OAuth grant the host already holds.

---

## PM adapter contract

A PM adapter is a Node module at `scripts/adapters/pm/<name>.js` exporting the
following. `scripts/pm-push.js` calls these and owns everything else: frontmatter
parsing, summary extraction, the em-dash check, stub rendering, hashing, `raw/`
snapshots, and the `index.md` / `log.md` writes.

### Required exports

**`meta`** — a plain object describing the adapter to the rest of the OS.

```js
export const meta = {
  name: 'linear',
  label: 'Linear',
  // Does this tool have a first-class document object separate from work items?
  hasNativeDocuments: true,
  // Which body surfaces this adapter supports. Single-entry means no choice to make.
  docSurfaces: ['documents'],
  defaultDocSurface: 'documents',
  // How a non-current page is shown, since not every tool has a status field.
  statusMechanism: 'title-suffix+banner',
  // Can an existing body be patched section-by-section, preserving tool-side history?
  supportsPatch: true,
};
```

**`resolveRoute(pageRel, fm, routing)`** — given a page path relative to the instance
root, its parsed frontmatter, and the parsed routing table, return the destination.

Return one of:
- `{ kind: 'container', ...adapterFields }` — a resolved destination.
- `{ kind: 'local-only', reason }` — this page is deliberately never pushed.
- `{ kind: 'unmapped' }` — no route. **`pm-push.js` exits non-zero on this and the
  calling skill must ask the user.** Never invent a destination.

**`render(fm, localBody, fmRaw)`** — apply tool-specific rendering only. The generic
transformations (frontmatter strip, the authored-by header, de-wrapping hard-wrapped
prose, re-rendering a decision's rationale and rejected alternatives, the metadata
footer) already happened in `pm-push.js` before this is called. An adapter whose tool
stores markdown faithfully can return its input unchanged.

**`documentTitle(fm)`** — the title convention for this tool, per type. Must be stable
and sortable so a human scanning a sidebar and a script matching by name land on the
same thing.

**`push({ title, body, destination, existingId })`** — describe the write. Two shapes
are allowed, and which one an adapter uses depends on how its tool is reached:

- **Direct** (the tool has a CLI or HTTP API the script can call, for example
  `github-issues` via `gh`): perform the write and return
  `{ id, url, storedBody }`.
- **Delegated** (the tool is only reachable through MCP tools exposed to the model, not
  to scripts, for example `linear`): return
  `{ delegate: true, instruction: {...} }` describing the exact call for the model to
  make. `os-core/patterns/pm-push.md` documents the handshake.

Adapters declare which they are via `meta.delegated`.

**`patchOps(fetchedBody, desiredBody)`** — only if `meta.supportsPatch`. Return the
minimal set of section-level operations that turn the fetched body into the desired one.

**`createEpicAndTasks({ epic, tasks, destination })`** — create one parent work item and
its children, linked. **Do not assume this maps identically across tools.** Linear uses
`parentId`; GitHub uses a separate sub-issues endpoint with its own constraints (a
sub-issue must belong to the same owner as its parent). Each adapter verifies its own
model against the live tool before it is trusted.

**`denyTools`** — array of MCP tool name patterns for this PM tool that the harness must
deny, if any. Usually empty: the OS is *supposed* to write to the PM tool.

### Two safety behaviours every PM adapter must preserve

Both were found by live testing against Linear and would silently break if
re-derived from first principles. They are contract-level, not Linear trivia.

1. **Fetch before you patch.** Patch anchors must be copied from a **fresh read** of the
   live document, never from the local source. Tools rewrite markdown as they store it,
   so the text you pushed is not the text they hold. Patches are atomic, so one stale
   anchor aborts the entire save.
2. **Hash what the tool stores, not what you sent.** After the write, read the document
   back and hash *that*. Hashing the sent body makes a freshly-pushed document report
   drift immediately, which would make the drift check worthless from day one. The
   `raw/` snapshot stores the read-back body too, which is also the honest thing to
   snapshot under INT-3.

### When a tool has no document object

Not every PM tool has a first-class document. When `meta.hasNativeDocuments` is false,
the adapter must offer at least one **body surface** in `docSurfaces` and let the user
pick at onboarding, with the adapter recommending a default.

`github-issues` is the worked example: GitHub has no document object, and its wiki is
unavailable on private repositories on the free plan, so it offers

- `discussions` (recommended) — free on private repos, categories map to the artifact
  types, renders in the mobile app, so the read-it-on-your-phone property survives.
- `repo-files` — markdown under `docs/os/` in the product repo. Simplest and
  git-versioned, and directly readable by the build agent, but closer to plain local
  markdown in a second repo.

The choice lands in `pm_config.doc_surface`.

---

## Build adapter contract

A build adapter is a markdown file at `scripts/adapters/build/<name>.md`: prose for you,
plus one fenced `json` block that `scripts/project-contract.js` parses when it emits the
harness settings.

```json
{
  "name": "replit",
  "label": "Replit",
  "readTools": ["ask_question", "list_apps", "search_apps", "resolve_app_by_name", "get_publish_status"],
  "denyTools": ["mcp__replit__create_app_from_prompt", "mcp__replit__update_app_using_prompt"],
  "codebaseQuery": "ask_question",
  "instructionsTarget": "replit.md",
  "pmAccess": true
}
```

| Field | Meaning |
|---|---|
| `readTools` | Safe to call. Reading the codebase is how `/work-order` verifies file paths before writing them into a ticket. |
| `denyTools` | **Fully-qualified** tool names emitted into `.claude/settings.json` under `permissions.deny`. This is the CAR-4 boundary enforced by the harness rather than left as a rule a future session has to remember. |
| `codebaseQuery` | The one read tool `/work-order` uses to check that a file path it is about to write down actually exists. |
| `instructionsTarget` | Where the build agent's standing instructions get installed, rendered from `os-core/templates/build-agent-instructions-template.md` by `scripts/render-agent-instructions.js`. The OS drafts into `drafts/`; **the founder installs**, because the target sits inside the build tool and writing there is denied. Replit reads `replit.md`; Lovable reads a root-level `AGENTS.md`. |
| `pmAccess` | Whether the build agent can reach the PM tool itself. Replit's agent posts comments and moves Tasks; Lovable's has no PM access at all, so the founder carries everything across. It selects which `<pm-write-policy>` variant is rendered. **Required**: the renderer refuses rather than guess, because guessing wrong either grants a boundary you meant to hold or issues instructions the agent cannot carry out. |

### Classifying a tool as read or write

Judge by **effect, not by name.** Lovable's `query_database` executes arbitrary SQL,
including writes and schema changes, so it is a write tool despite reading like a query.
When a tool's effect is unclear, it goes in `denyTools`. A denied read tool costs one
conversation; an allowed write tool costs a boundary.

### The "other tool" path is a hard requirement, not best effort

If a user picks a build tool with no adapter, `/onboard` walks them through this file and
drafts one. If they cannot name the tool's write-capable MCP tools, **say so plainly and
record the gap**. Do not scaffold the instance as though the boundary were enforced.
CAR-4 does not get to be partially enforced: a harness boundary that can be skipped is
not a boundary.

---

## Registering a new adapter

1. Copy the closest reference adapter for that role.
2. Fill in `meta` (PM) or the json block (build) honestly, including what you have *not*
   verified.
3. **Verify against the live tool before trusting it.** For a PM adapter that means at
   minimum: a round-trip fidelity test (push a body with headings, tables, nested lists,
   checkboxes, code fences and links; read it back; diff), the patch-anchor behaviour,
   and the parent/child work-item model. Assumptions carried over from another tool are
   the failure mode here, not missing features.
4. Record what you found in the adapter's own file, the way the Linear adapter documents
   its verified behaviour. The next person to touch it should not have to rediscover it.
5. Mint a decision record for the choice (`/decision-doc`). Which tools a business runs
   on is exactly the kind of call future-you will want the reasoning for.
