---
name: onboard
description: >-
  Prime a brand-new, empty OS instance: connect its PM tool and build tool, then run the
  cold-start interview that turns "not logged" into a working knowledge base. Run this
  ONCE, right after a fresh instance is scaffolded (Step 9 onboarding), or again when a
  business pivots hard enough to re-found. It is a LEAN orchestrator: it wires the two
  tool connections every other command depends on, elicits only the bootstrap context no
  other command owns (business identity, the product thesis, current stage, what already
  exists, decisions already made in your head), seeds the minimum to make /brief useful,
  and then RECOMMENDS + SEQUENCES the existing seed commands (/ingest, /strategy,
  /define-north-star, /decision-doc, /prioritize). It never auto-runs them. Use this
  skill WHENEVER the user says: "onboard", "set up this business", "get started", "the
  store is empty, what now", "seed the OS", "first run", or stands up a new instance and
  asks where to begin. Always drafts before writing; never auto-runs another command
  (INT-2).
---

# Onboard — prime the empty store, then hand off

A freshly scaffolded instance is **empty**: `/brief` and `/ask` honestly answer
*"not logged,"* because nothing has been captured yet. This skill is the **cold-start
interview** that fixes that — it pulls the founding context out of your head and into the
wiki so the rest of the OS has something to stand on. Authority:
`os-core/schema/operating-contract.md`. **OS drafts, you approve** — never a silent write.

## What this is — and is NOT

- A **bootstrap orchestrator**: it elicits the founding context, seeds the **minimum**
  that makes `/brief` useful (the business identity + a single overview page), then
  **recommends and sequences** the existing seed commands to go deep.
- It **never re-implements** a sibling. Strategy depth is `/strategy`'s job; the
  north-star is `/define-north-star`'s; importing docs is `/ingest`'s; past decisions are
  `/decision-doc`'s; the first ranked backlog is `/prioritize`'s. Onboard **prompts**
  each and **links** the result — it does **not** author their content (INT-2,
  summarize-and-link).
- It is **not** inside the build (CAR-4) and sends nothing outward (INT-2).
- It runs **once per founding** (idempotent on re-run: it updates the overview page and
  registry line, never duplicates them).

## Inputs

- *(none required)* — it interviews you. Optional: a `[name | one-liner | pasted brief]`
  to seed the first questions.
- The single business instance (this repo root). The slug was already set by
  `scripts/project-contract.js`; onboard fills in the human details around it.

## Read first (so it doesn't re-ask what's already known)

`index.md` (likely near-empty) → `config/businesses.md` (the slug + any `<…TBD…>` fields
to fill) → `strategy.md` / `roadmap.md` / `queue.md` (stubs at this point). If any already
have content (a re-run, or a partial setup), **build on it** — update, don't duplicate.

## Connect your tools (before the interview)

Two connections this OS depends on, done once. Mechanical setup rather than reflection, so
get both live **before** the interview below: nothing that follows can push anywhere or
verify anything about the codebase until this is done. If `config/tools.md` already names
real tools (a re-run), confirm rather than re-ask.

**Each role is a picker, then a dispatch.** Offer the adapters that already exist, take
"something else" as a real answer, and write the choice to `config/tools.md`. The contract
both roles answer to is `os-core/schema/adapters.md`.

### PM tool (where artifact bodies and work items live)

Ask which project-management tool the business runs on. Recommend one, do not decide:

| Choice | What happens next |
|---|---|
| **Linear** (recommended if starting fresh) | Run the Linear setup below. Proven, and it has a real document object. |
| **GitHub Issues** | Run the GitHub setup below. No new account if the code is already there. |
| **Something else** | Take the "register your own" path below. |

Write the answer to `config/tools.md` as `pm_tool`, then run that adapter's setup:

- **Linear.** The OS expects two teams: one for the **product**, one for the **OS itself**
  (the dividing line: *would a customer ever notice this?*). Confirm both exist, or prompt
  the user to create them (a team is theirs to make, not the OS's), then write
  `meta/pm-routing.md` with their keys and ids. Until that file exists, no push-capable
  skill can resolve a destination, so this is a hard prerequisite rather than a nicety.
  Do **not** create projects here: a project is a bet, and bets arrive via `/prd`.
- **GitHub Issues.** Confirm the repository, and ask **where artifact bodies should live**,
  since GitHub has no document object (and its wiki is unavailable on private repos on the
  free plan). Recommend **Discussions**: free on private repos, categories map onto the
  artifact types, and it renders in the mobile app, so reading a PRD on a phone still
  works. The alternative is **repo files** under `docs/os/`, which is simpler and directly
  readable by the build agent but closer to plain markdown in a second repo. Record the
  answer as `pm_config.doc_surface`, then create the categories or the folder, plus the
  labels, and write `meta/pm-routing.md`.
- **Something else.** See "Registering a tool that has no adapter" below.

### Build tool (where code actually gets written)

Ask which tool builds the product. The OS is **never inside the build** (CAR-4); it reads
the codebase to verify file paths at authoring time, and that is all.

| Choice | What happens next |
|---|---|
| **Replit** | Ask for the app's `replId` (from the workspace URL, or resolved by name if the app exists). |
| **Lovable** | Ask for the project identifier. |
| **Something else** | Take the "register your own" path below. |

Write the answer to `config/tools.md` as `build_tool`, note the app identifier for the
registry write below, then:

**Confirm the harness actually enforces the boundary.** Do not trust prose to hold it.
`.claude/settings.json`'s `permissions.deny` must list the chosen adapter's write-capable
tools. `node scripts/project-contract.js <slug>` emits them from the adapter's own
declaration on every scaffold (merged in, never overwriting hand-added keys), and prints a
loud warning if the list came out empty. Re-run it after choosing the build tool, since a
scaffold that ran before the choice was made will have emitted an empty block.

If that warning is still showing when the interview is over, **onboarding is not complete**,
and say so plainly rather than moving on.

**Then offer the build agent's standing instructions — as an option, not a step.** Ask
whether the user wants them. Put the trade honestly and let them decline without friction:

- **Take them** and the build agent gets a written working agreement: a consistent Build
  Record shape for `/harvest` to read, and stated boundaries about what it must not touch.
- **Skip them** and steer the agent conversationally instead, which many people prefer. The
  Task's acceptance criteria still carry the Build Record requirement, so this is a
  convenience layer, not a load-bearing one.
- **One caveat worth stating** if the adapter declares `pmAccess: true`: that agent has real
  write access to PM-tool documents under the user's own account, so the never-touch rule is
  the only *preventive* control. Without it, `/lint` still detects document drift, but only
  after the fact. Say this once; do not push.

If they want them: run `node scripts/render-agent-instructions.js`, which fills the template
from the active adapter, writes `drafts/build-agent-instructions-<tool>.md`, names the file
to install it as, and lists what it could not derive. **The OS does not install it** — the
target lives inside the build tool and writing there is denied (CAR-4). Walk them through it
and confirm it landed. If they decline, record that in the overview page so a later session
does not read the absence as an oversight.

**Then tell the user to restart Claude Code.** `permissions.deny` is read when a session
starts, so rules written during this session are on disk but not yet enforcing. Until the
restart the boundary exists only as prose, which is the exact failure mode the harness rule
was written to avoid. End onboarding by saying so in one line: the deny rules are in place
and take effect next time you start Claude Code.

### Registering a tool that has no adapter

Walk `os-core/schema/adapters.md` with the user and draft the adapter file with them, as a
proposal for approval like everything else. For a PM tool that means the routing shape, the
title convention, and how its stored markdown differs from what was sent. Flag clearly that
its round-trip behaviour is **unverified** until it has been tested live, and that the
content standard's guarantees cannot be trusted for it until then.

For a **build tool the requirement is harder, and it is not negotiable**: you need the
names of its write-capable tools for the deny list. If the user cannot name them, **say so
plainly and record the gap** in the overview page's Open questions. Do not scaffold as
though the boundary were enforced. CAR-4 does not get to be partially enforced: a harness
boundary that can be skipped is not a boundary.

## The interview (grill-me, one question at a time)

Elicit only the **bootstrap context no other command owns**. Tailor depth to the answers;
stop when each branch is resolved (don't pad). Cover:

| Theme | What you're pulling out | Where it lands |
|---|---|---|
| **Identity** | Business name, one-line description, stage (idea / building / shipped) | `config/businesses.md` + overview page |
| **Thesis** | What it is · who it's for · why now · the core bet (in the user's words) | overview page (→ deepen via `/strategy`) |
| **Existing assets** | Repos, existing docs, key URLs, tools in play | registry fields + a `/ingest` worklist |
| **Decisions already made** | Calls made in your head with their *why* + rejected options | a `/decision-doc` worklist |
| **Where it stands today** | Current focus, what's blocking, what's next | overview page + a `/prioritize` worklist |

Capture the user's **own framing**, verbatim where it matters — this is the one moment
content enters as **`provenance: user-authored`** (the trusted live source, INT-1). Don't
infer beyond what's said; an unanswered branch becomes an **open question**, not a guess.

## Seed the minimum (draft → approve)

Onboard writes only what makes `/brief` immediately useful — everything deeper is
delegated. Produce, as a reviewable draft:

1. **`config/businesses.md`**: fill the registry line's `name`, `github repo`, `pm_tool`,
   `build_tool` and `build app id` (replace the `<…TBD…>` placeholders the scaffolder left;
   both tools were already confirmed live in "Connect your tools" above, so this is
   recording them, not discovering them). The authoritative tool names live in
   `config/tools.md`; the registry line is the human-readable summary. Also seed the
   **`private-terms`** block with anything else business-identifying that isn't the slug or
   display name: PM-tool team keys, people's names, workspace handles. `export-check.js` reads that block to
   keep `os-core/` shareable (ARC-4); a term that isn't declared there is a term the leak
   gate cannot catch.
2. **`wiki/entities/<slug>.md`** — ONE business-overview page: §3.1 frontmatter
   (`type: entity`, `status: current`, `provenance: user-authored`, `confidence` per how
   settled each claim is), a **summary-first** body (identity · thesis · who-it's-for ·
   stage · where-it-stands-today), and an **Open questions** list for the unanswered
   branches. This is the page `/brief` reads first to know what the business *is*.
3. **`index.md`** line under **Entities**: `- [<Title>](wiki/entities/<slug>.md) — <one-line>. [current]`.
4. **`log.md`** line: `## [<date>] file | <slug> <title>` (onboard **rides the `file` op**
   — it introduces no new contract op; the registry/overview are placed content).

Show the full proposed draft + index/log lines; apply only what's approved; then **commit**
(SAF-2). Record the accept/edit/reject signal to `meta/feedback-log.md`.

## Then hand off (recommend + sequence — never auto-run)

After the seed lands, present the **seed sequence** as a recommended next-steps list, in
order, each as an *offer* the user triggers (INT-2 — you suggest, they run):

1. **`/ingest`** the existing docs/URLs from the assets worklist → cited `wiki/` pages.
2. **`/strategy`** → author `strategy.md` (the thesis, deepened to real strategy).
3. **`/define-north-star`** → set the north-star metric (a section of `strategy.md`).
4. **`/decision-doc`** → log each in-your-head decision from the worklist, with its *why*.
5. **`/prioritize`** → stand up the first `queue.md` so the next build session has a ready
   list of next actions.

Frame it as: *"Founding context captured. Here's the order I'd seed the rest — say the
word and I'll start with `/ingest`."* You never launch these yourself.

## Recall-trust (CAR-6)

At cold start almost nothing is logged — that is **expected**, and the interview is the
remedy. Everything you write here is grounded in what the **user just told you**
(`user-authored`); do not import outside claims as fact (those go through `/ingest` as
`external`, snapshotted to `raw/` first, INT-1/INT-3). Mark anything the user is unsure of
`confidence: medium|low` and list it under **Open questions** rather than asserting it.

## Files this skill touches

- **Reads:** `index.md`, `config/businesses.md`, `strategy.md`/`roadmap.md`/`queue.md`
  stubs (to build on, not duplicate), `.claude/settings.json` (to confirm the harness deny
  rule landed).
- **Writes (on approval):** `meta/pm-routing.md` (the two team keys and ids, "Connect
  your tools"), `config/tools.md` (the two adapter names), `config/businesses.md` (registry line, including the build app id),
  `wiki/entities/<slug>.md` (overview), append `index.md` (Entities) + `log.md` (`file`
  op), `meta/feedback-log.md`.
- **Runs (not a write this skill owns):** `node scripts/project-contract.js <slug>` if the
  harness deny rule needs (re-)emitting, the same scaffolding command from Step 2 of the
  runbook, safe to re-run.
- **Delegates, never writes directly:** doc import (`/ingest`), strategy (`/strategy`,
  `/define-north-star`), decisions (`/decision-doc`), the first backlog (`/prioritize`).
- **Never writes:** secrets, `raw/` content from unsnapshotted external sources,
  `os-core/` (data-free), or any other business.

## Reused tools / plug-in points

- **`grill-me`** (installed at `.claude/skills/grill-me`) — the one-at-a-time elicitation
  engine for the interview.
- **the build tool's MCP surface `resolve_app_by_name` / `search_apps`**: optional, to look up a `replId`
  the user doesn't have to hand. Read-only, same as everywhere else this OS touches
  the build tool (CAR-4).
- **Sibling commands** — `/ingest`, `/strategy`, `/define-north-star`, `/decision-doc`,
  `/prioritize` (recommended + sequenced, never embedded or auto-run).
- Schema authority: `os-core/schema/operating-contract.md` (§3.1 frontmatter, §3.2 entity
  location, §7 index/log formats, §1 directive 4 propose-don't-act); `decisions/the home-of-record decision`
  (the PM tool teams), `decisions/the build-tool boundary rule` (the harness deny rule).
