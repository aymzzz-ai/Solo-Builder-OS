# PM content standard — titles, skeletons, formatting, the TL;DR contract

> **What this file is.** The shape of every document the OS pushes to the PM tool, and the
> house style all authored content follows. Tool-agnostic: *where* a document goes is
> `os-core/schema/adapters.md` plus the instance's routing table; *what it looks like* is
> here.
>
> Per-type skeletons are also written out as templates in `os-core/templates/`
> (`pm-decision-doc.md`, `pm-prd-doc.md`, `pm-council-doc.md`) and, for work items, in
> `os-core/templates/work-order-template.md`. **A skill renders from the template. This
> file is why the template is shaped the way it is.** Where the two ever disagree, the
> template is wrong and gets fixed, not worked around.
>
> Authority: `os-core/schema/operating-contract.md` wins if they disagree.

---

## House style

**No em dashes, anywhere.** Not in a title, not in a body, not in a comment, not in a
local stub. Replace each one with:

| The dash was doing this | Use instead |
|---|---|
| Joining two complete thoughts | A period. Two shorter sentences. |
| A subordinate clause | A comma. |
| A genuine aside | Parentheses. |
| Introducing a list or a definition | A colon. |

Prefer splitting into two sentences over any of the others. Long dash-joined sentences are
the main reason dense documents read as dense, and the split is almost always an
improvement on its own.

This is enforced, not merely documented: `scripts/pm-push.js` refuses to push a body
containing an em dash. A prose-only style rule does not survive context pressure.

**Other standing rules.** Expand every acronym on first use in each document, with the
short form in parentheses. Plain English over machine vocabulary in anything a human
reads. Terms with a fixed meaning are defined once in the glossary.

## Document titles

One convention per type, chosen so the local identifier is visible in the title. A human
scanning a sidebar, or an agent matching by name, lands on the right thing without
searching. **The separator is a colon.**

| Type | Title pattern | Example |
|---|---|---|
| Decision | `DEC-XXXX: <title>` | `DEC-0016: PM tool becomes home of record for artifact bodies` |
| PRD | `PRD: <bet name>` | `PRD: Analytics Integration` |
| Council | `Council <YYYY-MM-DD>: <bet name>` | `Council 2026-07-31: Analytics Integration` |
| Strategy | `Strategy: <business>` | `Strategy: Acme Widgets` |
| Glossary | `Glossary: <business>` | `Glossary: Acme Widgets` |

**Status suffix.** A document whose status is not `current` gets ` [SUPERSEDED to
DEC-XXXX]` or ` [RETRACTED]` appended to the title, so it is visible in every list view
without opening the document. Some PM tools have no tags or status field on a document, so
display is the whole mechanism; an adapter whose tool *does* have a real status field
should use that instead of imitating this workaround (`adapters.md`, `statusMechanism`).

**Work item titles** are covered by `os-core/templates/work-order-template.md`, since they
follow a different rule: the outcome, not the identifier.

## The TL;DR contract

Every page opens with a paragraph labelled `**TL;DR.**`, and it is **byte-identical
between the local file and the pushed document**. That single property is what lets `/ask`
answer the common case from local files with zero PM-tool calls, and it is verifiable with
a plain string compare.

Because byte-identity is the point, **the label itself must match on both sides.** Do not
write `**Summary.**` locally and `**TL;DR.**` in the pushed copy: that breaks the contract
at the first character. (`scripts/pm-push.js` still accepts `**Summary.**` as a legacy
alias when reading, so older pages keep working, but new content uses `**TL;DR.**`.)

**There is one TL;DR, and it is written for the human reader.** There is no second,
machine-oriented summary. The agent-facing precision layer is already Requirements,
Constraints and Acceptance criteria, and build agents report that they skim narrative
summaries and rely on those sections instead. A second summary would be a worse copy of
work already done elsewhere.

**Write to the formula.** A checklist of facts to include produces technically compliant
mush. A sentence shape does not.

| Type | Formula |
|---|---|
| PRD | `<Bet>` helps `<who>` `<do what>` by `<how>`. Status: `<stage>`, `<the one thing that is true right now>`. |
| Decision | We decided to `<X>`, because `<the one dominant reason>`. Rejected: `<strongest alternative>`, `<why not>`. |
| Council | Verdict: `<Expand, Hold or Reduce>`. `<the one biggest reason>`. |
| Strategy | `<Business>` is betting that `<thesis>`. The north-star is `<metric>`. `<the one thing that would change this>`. |

Two to four sentences. No forward references ("see below"). It has to stand alone, because
it is the only part guaranteed to be read.

The decision formula pulls the strongest rejected alternative into the TL;DR itself. That
is deliberate: "why did we rule out X" is a common follow-up to "why did we do Y", and the
rejected options are the reason a decision record exists at all.

## The shared skeleton

Every document type shares this frame:

```
> Authored by the <Business> OS. Edit in the OS, not here.
[STATUS BANNER, only when status is not current]

**TL;DR.** <per the formula above>

<type-specific sections>

## Metadata
```

Headings never go deeper than `###`. Two levels is enough for anything defined here, and it
keeps a document skimmable in one scroll.

### Decision

`## Rationale`, then `## Alternatives rejected` (one bullet per option: the option in bold,
then why not), then `## Detail` (only if there is genuinely more to say than rationale and
alternatives), then `## Metadata`.

Rationale and alternatives live in the page's **frontmatter** (contract §3.3), which is
stripped on push, so `pm-push.js` re-renders them as sections. Without that they would be
lost on the way out, and they are the whole point of a decision record.

### PRD

The pushed rendering of contract §3.4's section order:

`## Problem / Opportunity` → `## Goals and Non-goals` → `## Requirements` →
`## Success Metrics` → `## AI Behavior Contract` (only when `ai_feature: true`) →
`## Risks` → `## Open questions` → `## Key decisions` → `## Council reviews` →
`## Results` (only once `stage: results`) → `## Metadata`.

**Goals and Non-goals is always present.** Stating plainly what a bet will not do is the
single highest-leverage line in a spec: it ends scope questions before they are asked, and
it is the thing a reader most often cannot infer. An always-present heading is what makes
it get written.

**Requirements are user stories, tagged by priority.** `As a <role>, I can <capability>, so
that <outcome>.` grouped under **Must**, **Should**, **Could**. This is the same content a
flat requirement list carried, ordered so the reason sits in the same sentence as the
requirement rather than a section away. It also maps cleanly onto acceptance criteria
later, since role, capability and outcome are each their own clause.

**Success Metrics is a table, not prose hypotheses**, because prose was never checkable
afterwards:

| Metric | Target | Confidence | Actual |
|---|---|---|---|

Pre-launch, `Target` is a hypothesis and `Confidence` is high, medium or low. `Actual` is
empty until `/harvest` fills it after ship, which is what closes the loop between what was
predicted and what happened. Where a metric rolls up to the north-star in `strategy.md`,
the row says so.

**Risks and Open questions are separate sections.** They are different things needing
different follow-up: a risk carries a mitigation, an open question carries whoever or
whatever will resolve it.

### Council

`## Per-persona critique` → `## Cross-persona synthesis` → `## Recommendation` →
`## Metadata`.

**Per-persona critique uses bullets, not a paragraph, and as many as the substance needs.**
One bullet per persona is too thin: a real Architecture critique routinely carries three
distinct and separately actionable points (a strength, a sequencing constraint, a
recommendation), and compressing them into one bullet loses the two that were not chosen.
Each bullet leads with a bold label naming what kind of point it is (Strength, Risk,
Sequencing, Recommendation, Blocker), so the shape of a critique is visible before it is
read.

```
**Architecture**
- Strength: <the specific thing that is genuinely solid, and why>
- Sequencing: <what has to land before what>
- Recommendation: <the concrete move, and what it costs to do later instead>
```

**Cross-persona synthesis has three fixed sub-labels:** **Agreements** (flagged by two or
more personas, the strongest signal in the whole review), **Conflicts** (where lenses
disagree, stating both sides and how it resolves or what must be traded off), and **Blind
spots** (caught by one lens but high-stakes).

**Recommendation closes the document** with the concrete numbered actions, and states
plainly if it recommends a gate. The verdict itself is not restated as its own heading: it
is already the first words of the TL;DR, and repeating it at the bottom teaches readers to
skip to the end for the answer.

### Strategy

The seven components as written locally, then `## How this has changed` (dated one-liners),
then `## Metadata`.

## Metadata footer

Frontmatter is stripped on push, because it is OS bookkeeping and noise to a human reader.
But a reader in the PM tool still needs the lifecycle state, so it goes in a footer rather
than a header. Same placement logic as the local `## Sources` footer: the TL;DR earns the
first ten seconds, metadata is what someone reaches for second.

```
## Metadata
- Status: superseded by DEC-0021        (omitted when current; the banner already said it)
- Discipline: architecture              (decision only)
- Stage: spec                           (PRD only)
- Created: 2026-08-02 · Updated: 2026-08-05
- Review: 2026-11-02                    (decision only, when set)
- Reviewed: [PRD: Analytics Integration](url)  (council only)
- Personas: architecture, design-ux, ...       (council only)
- Local record: `decisions/DEC-0016-....md`
- Glossary: [Glossary: <business>](url)
```

Only fields that apply to the type and have a value are rendered. No empty rows.

## Formatting rules

These follow from live round-trip testing against a real PM tool. They are not preferences.

- **Every `[text](url)` stays on one source line**, however long that makes the line. Link
  text wrapping across a newline is the one defect a tool may not merely rewrite but
  actually break, splitting it into two separate links.
- `-` for bullets, `- [ ]` and `- [x]` for checkboxes. Write them the readable way even
  when the tool rewrites them on storage. That rewrite is cosmetic and is already handled
  by the adapter's `normalizeStored` plus the fetch-before-patch rule.
- **Hard-wrapped prose is collapsed on push** (`dewrap()`), because tool editors tend to
  render a bare newline as a visible line break rather than folding it into the paragraph.
  Keep authoring the local file hard-wrapped: it is better for diffs, and the collapse is
  automatic.
- Cross-document links use **the target document's actual title as link text**, so the
  identifier is visible inline, with the full URL fetched fresh.
- Issue references use the PM tool's **native identifier** where it has one (for example
  `ACME-42`), which auto-links and, unlike a document URL, never goes stale on rename.
- Links to a local file appear only in the `Local record:` line of the Metadata footer.
- The `> Authored by the <Business> OS. Edit in the OS, not here.` line is always the first
  line of the body, before the status banner.

## Length budgets

- **Decision:** TL;DR, rationale in one or two short paragraphs, rejected alternatives at
  one to three sentences each. Past roughly 500 words it is drifting into PRD territory and
  should be split.
- **PRD:** no hard cap, since it is a hub. But each section stays scannable in under a
  minute: bullets over prose, and deep technical reasoning is linked to its decision record
  rather than restated.
- **Council:** TL;DR, the per-persona bullets, and the top three to five cross-persona
  findings. Never a full transcript.
- **Work items:** governed by `os-core/templates/work-order-template.md`, which tiers them
  by size.

## Stub thickness

The local stub stays frontmatter, the TL;DR paragraph, and the link out, for every type,
**plus one extra line for decisions only**: a one-line digest of what was rejected and why.
Now that the decision TL;DR formula carries the strongest rejected alternative, that digest
line covers the remaining ones, so the most citation-worthy part of a decision never costs
a live PM-tool call to recall.

**Once a page is stubbed, its local body is no longer the full document.** Updating it is
therefore not "re-render the local page": the new body is built from the **fetched**
document plus the intended change, and passed to `pm-push.js patch-ops --desired`. The
script refuses to guess here, because guessing means pushing a stub over a real body.

## Snapshot granularity

Material changes only, for every pushed artifact. Creating, superseding, retracting,
changing stage, or substantively rewriting a body is material. A typo, a link fix, or a
re-rendered metadata footer is not. When genuinely unsure, snapshot: an extra file costs
nothing, a missing one breaks a citation chain.
