# Work-order template: Epic and Task

> The reusable structure for PM-tool work items handed to the build agent. Governed by the
> division-of-labour rule the OS is built on: specify *decisions*, delegate *mechanism*.
> (Record that rule as a decision in your own instance; it is the one every line below
> assumes.) Treat any implementation detail below as **illustrative (a
> suggestion the agent may improve)** unless it is marked a **decision or invariant**.
>
> **Evidence base.** This structure is not invented. It comes from direct accounts by a
> real build agent of how it actually reads a ticket: one general, one concrete and
> grounded in two shipped builds, and one on what works well in live prompting. **The
> accounts disagree in places**; where they do, this template takes the safer assumption
> and says so. When you adopt a different build tool, re-run that exercise and snapshot
> its answers to `raw/` rather than assuming they match.
>
> House style: **no em dashes.** Use a period, a comma, or parentheses. Expand every
> acronym on first use. Terms are defined once in `meta/glossary.md`.

---

## The hierarchy

**Epic** is the parent: one coherent chunk of a Product Requirements Document (PRD),
holding the Tasks that deliver it.

**Task** is the child: scoped so it is exactly **one planning pass, one branch, one pull
request** (DEC-0006). If a Task cannot be built and reviewed in one pass, split it into
two Tasks.

A Task is not the same thing as the pull request that closes it. The Task is the brief;
the pull request is the artifact. Acceptance criteria enforce the one-to-one relationship.

---

## The four rules this template exists to enforce

**1. Write the Task as if it will be read alone.** The two accounts conflict here. The
general one says the agent works only from what is pasted in and does not chase links; the
concrete one says it scans sibling tickets, reads its own standing-instructions file, and
opens named files first. **Design for the pessimistic case.** Self-containment costs some duplication but
never fails; relying on the agent to go and find context fails *silently* when it does
not. Any context it does pick up is a bonus, not a dependency.

The duplication is only acceptable because `/work-order` **generates** the Task from the
PRD. When the spec moves you **regenerate**, never hand-patch. No human maintains the copy.

**2. Behaviour first, paths second, but paths still earn their place.** The agent called
explicit file references *"genuinely useful"* while also warning that a stale path *"sends
me somewhere stale."* Those are not opposed: **paths are useful, stale paths are harmful.**
So keep them, and **verify them at authoring time** (the read-only `ask_question` tool
makes this possible) rather than writing them from memory.

**3. Say why the existing structure exists before asking for it to change.** From the
concrete account: *"when a ticket says 'rewrite X to do Y' without explaining why the
current structure exists, I sometimes bulldoze a defensible pattern."* This qualifies the
rule of thumb that rationale gets skimmed: rationale about **the business** is skimmed;
rationale about **the code being changed** is used.

**4. Every binding constraint gets an acceptance criterion.** If a constraint is worth
writing down, it is worth checking. A Task that names a threshold and never tests it is
the most likely place for a defect to ship, because the rule was stated, believed, and
never verified.

---

## How the OS knows codebase-specific facts

Three sections describe the codebase: **Where in the product**, the "must stay unchanged"
half of **Out of scope**, and **Pointers**. The OS cannot see the codebase. Every line in
those sections comes from exactly one of three places, and a Task must never blur them:

| Source | What to do |
|---|---|
| **Told to it** by the PRD, a decision record, or the user | Write it down as stated. |
| **Cheaply verifiable** via the read-only `ask_question` tool at authoring time | Ask, then include the answer, quoted as `external` provenance (INT-1). Never assert it as OS fact, and never paste code back. |
| **Neither** (blast radius, who else imports this, what a change would ripple into) | **Do not guess.** Turn it into a verify-and-report acceptance criterion the agent executes and answers in its Build Record. |

The third row is the important one. It reuses the pattern already working in the "If this
replaces or renames something" checkbox rather than inventing new machinery: the OS states
what it wants confirmed, and the agent (which *can* see the codebase) confirms it and
reports back.

---

## Two tiers

Ceremony should match stakes. A heavy template on small work discourages proposing ideas
quickly and pruning freely, which the agent's own feedback named as a healthy pattern.

| Tier | When | Sections |
|---|---|---|
| **Light** | Small, reversible, and invisible to users. Copy tweaks, config, refactors behind existing behaviour. | Where in the product · Current problem · Outcome · Acceptance criteria · Plan-back and build |
| **Full** | User-visible, **or** stateful/data-touching, **or** replaces existing code. | All of the below. |

When unsure, use Full. The cost of an unnecessary section is a few lines; the cost of a
missing one is a rebuild.

---

## Titles

**Epic:** `EPIC: <the chunk of work>`. All caps prefix, so it reads at the same visual
weight as `PRD:` and `DEC-XXXX:` in a sidebar. Noun phrase, scannable in a project list.

**Task:** `<the outcome, 70 characters or fewer>`. Phrased as what becomes true for the
user, not as an instruction to the developer.

| Write this | Not this |
|---|---|
| `Player sees empty-state prompt before first session` | `Update onboarding flow` |
| `Coach join code survives a page refresh` | `Fix bug in roster` |
| `Session below verified threshold no longer counts` | `Threshold changes` |

The title is the only thing visible in a board column, so it carries the outcome.

---

## Issue fields (metadata, not body)

Confirmed against a live workspace, not assumed. `/work-order` sets all five in one write
per work item. Field names below are the Linear adapter's; another adapter maps the same
five concepts onto its own field names (`os-core/schema/adapters.md`).

| Field | PM-tool field | Value |
|---|---|---|
| Status | `state` | **Todo**. The work item is approved and build-ready the moment it is created. |
| Priority | `priority` | the PM tool's native scale (`0 None · 1 Urgent · 2 High · 3 Medium · 4 Low`). Set from the PRD's stated urgency; default **No priority** rather than guess. |
| Size | `estimate` | T-shirt scale (1=XS · 2=S · 3=M · 4=L · 5=XL), set workspace-wide across every team, so it can be relied on without a per-team check. |
| Label | `labels` | Exactly one of **Feature · Improvement · Bug**. **Never invent a fourth label.** If a work item fits none of the three, stop and ask. |
| Assignee | `assignee` | The founder, the workspace's sole human user. |

Children attach to their Epic via `parentId`.

---

## Epic body

```markdown
## Outcome
<ONE line: the user outcome this whole chunk produces.>

## Scope
- <Task title>
- <Task title>

## Out of scope
**Not in this Epic:** <adjacent work that belongs to another Epic or another bet.>

## Governs
<The decision records this Epic must not violate, by identifier.>
```

---

## Task body (Full tier)

Section order follows the agent's own stated reading order: orient to location, understand
the failure state, understand the goal, understand the motivation, then bound the scope.

```markdown
**Parent:** EPIC: <name>. **Blocked by:** <none, or identifiers>.

## Where in the product
<Screen, component, or route. One line. See "How the OS knows" above.>

## Current problem
<What is wrong or missing today. One sentence. This is the failure state, distinct
from Outcome, which is the desired state. "Balls get stuck in the hoop on mobile"
is actionable in a way that "improve ball physics" is not.>

## Outcome
<What the user sees or experiences when this is done. One line. This is also the
Task title, tightened.>

## Why this matters
<Motivation. One sentence. It lets the agent resolve ambiguity in your direction
rather than optimising for the literal request. Deliberately not load-bearing:
nothing in Acceptance criteria depends on it.>

## Behavior
<Observable behavior, in terms of what the user sees and does. The happy path,
stated plainly.>

## When things go wrong or there's nothing there
<REQUIRED on any Task with state or data. Cover, explicitly:>
- **Partial failure:** what happens if this fails halfway through, and what the user sees.
- **Empty state:** what is shown when there is no data yet, and who owns that surface.
- **Reuse or build new:** is there an existing component this should reuse, or is a new
  one alongside it correct? If you do not know, say "your call, state it in the plan."

## Looks like
<REQUIRED on any Task that changes something visible. The agent's stated number one
source of guessing is "visual sizing and spacing that isn't in the code yet." One
line here usually kills several rounds of "nudge that down a bit.">
- **Reference:** point at an existing screen or component to inherit scale, spacing and
  rhythm from ("match the button scale from section 03"), or attach a screenshot. An
  external analogy works too, and collapses ambiguity fast: "shot-clock style", "reads
  like a stadium scoreboard".
- **Mobile:** how it stacks or reflows, if not obvious.
- **Motion:** does it animate in, or just appear?

## Instrumentation
<REQUIRED on user-visible work. This is where a Success Metric in the PRD becomes
something that actually gets measured.>
- **Event:** <name> fires on <trigger>, with property <key: value>.
- **Feeds:** <which PRD Success Metric this rolls up to>.
- If the analytics pipeline is not live yet, add the call site dormant rather than
  omitting it.

## Out of scope
**Not in this Task:** <features and behaviour that belong to another Task.>
**Must stay unchanged:** <specific adjacent code, layout, or flows that must not move.
See "How the OS knows" above: state what you were told, and turn anything requiring
real codebase knowledge into an acceptance criterion below rather than guessing.>

## Constraints and decisions (binding)
- <Invariant the build must not violate. State it as behavior, not implementation.>
- <Load-bearing decision plus its identifier, restated in full, because the agent
  cannot open the decision record: "Completion persists server-side and is
  account-scoped, so it survives a device change.">
- <Anything that must NOT change: "must not alter the existing demo-mode flow.">

<!-- Include ONLY when the work is risky, expensive, or hard to undo. Omit entirely
     on small reversible changes, where it is noise. -->
## Reversibility
<How this gets turned off or rolled back if it is wrong, and what that costs. A
feature flag, a single deletion, a data migration that cannot be undone.>

## Acceptance criteria
- [ ] <Testable definition of done. Observable, role-specific and edge-case specific.>
- [ ] <At least one failure-path or empty-state criterion.>
- [ ] <One criterion per binding constraint named above. See rule 4.>
- [ ] <Any verify-and-report item the OS could not determine itself.>
- [ ] One branch off `main`, one pull request (DEC-0006).
- [ ] Plan posted before building.
- [ ] Build Record comment posted before moving this to Done.

## Pointers (verify before trusting, may be stale)
<Optional. Named files and components ONLY where they genuinely save time. The agent
verifies these before use and adapts if they have drifted. That is expected, not a
failure.>

## Plan-back and build
Run this Task through Plan Mode first. **In the plan, surface any assumption you had
to make**, especially about failure paths, empty states, and whether you reused an
existing component. Implementation approach is yours. Flag it if any constraint forces
an unexpected tradeoff.

**Then post the plan before you build**, under the header `**Plan: <task title>**`,
including any precision settled in conversation that isn't written above: thresholds,
ratios, timings, breakpoints. It is a record of what you understood at the time, **not
a commitment** — if the codebase tells you otherwise once you are in it, change course
and note it under Diverged. Then build: one branch, one pull request.
```

---

## Task body (Light tier)

```markdown
**Parent:** EPIC: <name>. **Blocked by:** <none, or identifiers>.

## Where in the product
<Screen, component, or route. One line.>

## Current problem
<What is wrong or missing today. One sentence.>

## Outcome
<What is true when this is done. One line.>

## Acceptance criteria
- [ ] <Testable definition of done.>
- [ ] One branch off `main`, one pull request (DEC-0006).
- [ ] Plan posted before building.
- [ ] Build Record comment posted before moving this to Done.

## Plan-back and build
Run through Plan Mode first, surface any assumption, post the plan as a record (not a
commitment), then build: one branch, one pull request.
```

---

## The altitude rule

| Section | You own (specify) | The build agent owns (omit, or suggest only) |
|---|---|---|
| Outcome | always, one line | |
| Current problem | always, one sentence | |
| Why this matters | always, one sentence | |
| Behavior | observable behavior | micro-interactions within convention |
| When things go wrong | **always**, on stateful work | how to implement the handling |
| Looks like | **always**, on visible work. A reference beats a description | the styling |
| Instrumentation | **always**, on user-visible work. Event name, property, metric | where the call site lives |
| Out of scope | always, both halves | |
| Constraints and decisions | invariants and load-bearing decisions, restated in full | how to implement them |
| Reversibility | on risky work only | the mechanism |
| Acceptance criteria | always, testable | |
| Pointers | verified paths. They are useful, so check them, do not guess them | everything else about file structure |
| Plan-back | the requirement to plan, surface assumptions, and post the plan | the plan's actual contents |

**Litmus test before writing any technical line** (DEC-0009): is there a user-visible or
cross-Task difference? Is it expensive or irreversible? Does the agent lack the context?
If yes, specify. Otherwise leave it.

**Second litmus test:** will this still be true in a week? Behaviour survives; paths and
component names often do not. If it will not survive, put it under Pointers and mark it
verify-first, or leave it out.

---

## What the agent actually reads

From its own accounts:

| It relies on | It skims |
|---|---|
| Acceptance criteria | Business rationale, "why we're doing this" |
| Stated constraints ("must not change X") | Anything restating what the code already shows |
| Named files and components (verified first) | Copy it was not told was locked |
| Precision agreed in conversation | |
| Rationale about **the code being changed** | |
| Explicit out-of-scope fences | |

The "why" has not been deleted. It is one line under **Why this matters**, because *you*
need it when reviewing and Plan Mode benefits from it. But nothing load-bearing sits
underneath it.

---

## The Build Record: how a Task closes the loop

A build agent's inputs come from three places, and only two of them persist:

> *"Tickets give me scope and intent; the codebase gives me constraints; conversation gives
> me the precision that neither contains."*

That third one is the problem. Parallax ratios, trigger points, reset conditions, the exact
threshold you agreed out loud: it governs shipped code and it is gone the moment the session
closes. No template can pre-empt it, because it does not exist when the Task is written. So
the Task collects it **on the way out** instead.

Two failure modes to design against.

**Implementation notes lapse exactly where they matter most.** The habit of writing up what
changed holds for methodical state-machine work and evaporates on visual, iterative work,
which is where precision is *most* fragile and hardest to reconstruct. That is the argument
for making the record an acceptance criterion rather than trusting it as a habit.

**Implementation is not decision.** A good note says what the code now does, but the code
already says that. What it omits is what was chosen **instead**, and where the agent was
**guessing**. A note that some step "is intentionally visible" leaves you unable to tell
whether that was a requirement or the agent's call, and in six months that is the difference
between a constraint and a guess worth revisiting.

So: keep the implementation block, add five short bullets after it, under a fixed header so
it is spottable in a long comment thread.

```markdown
**Build Record: <task title>**

**Implementation**
<exactly as you already write it: file by file, with the conditions and values>

**For the record**
- **Chose / rejected:** where another reasonable option existed, and why this one won.
  Include values I settled on and what made them right: thresholds, ratios, timings.
- **Guessed:** where the Task was silent and I made the call.
- **Diverged:** anything done differently from the Task, and why.
- **Found:** anything affecting other Tasks or the spec. New issues raised: <identifiers>
- **Left:** deferred, and why.
```

Each bullet earns its place. *Chose / rejected* captures the precision agreed in
conversation. *Diverged* catches a component replacement that broke consumers nobody
checked for. *Guessed* surfaces an inference that would otherwise only turn up at code
review, or later.

A capable agent already volunteers this when it bothers, explaining *why* a guard is
written the way it is rather than only that it exists. The header formalises an existing
instinct rather than adding a burden.

**The Task body is never rewritten to match what got built.** It is the brief at handoff
and stays that way. The Build Record carries what changed. Same append-do-not-rewrite rule
the operating contract already applies to PRDs and strategy.
