# Build-agent standing instructions — template

> **What this is.** The standing instructions the build agent reads on every request. The
> OS drafts them; you install them. They are the *fallback* layer: the load-bearing
> enforcement is the acceptance criteria `/work-order` puts on each Task, because the agent
> reports leaning hardest on those.
>
> **Where it goes**, from the active build adapter's `instructionsTarget`:
>
> | Build tool | Target | Notes |
> |---|---|---|
> | **Replit** | `replit.md` in the project root | Read automatically on every Agent request. |
> | **Lovable** | `AGENTS.md` in the repo root | Read on every message regardless of session length. Preferred over project knowledge: version-controlled, no character cap, and it needs no write tool the OS is denied. |
>
> **Keep this rendered copy as the source of truth and re-install when it changes.** Do not
> edit it in the build tool. Replit's Agent updates `replit.md` on its own as it learns
> about the project, so the installed copy *will* drift. That is the platform working as
> designed, not a violation, and it is why the marker line at the bottom of the block
> exists: it lets you diff the installed file against this one.
>
> **Write it as instructions, not explanation.** The agent skims background rationale and
> acts on concrete criteria. Every line in the block below is a rule it can act on. The
> reasoning for *us* stays in the notes at the end of this file, which are never installed.
>
> **The filter for adding anything: does this line change what the agent does?** If not,
> cut it. The block competes for the agent's attention with the ticket itself, and a longer
> file is not a better one.

---

## Placeholders

| Placeholder | Fill with |
|---|---|
| `<product>` | The product this instance builds. |
| `<work-container>` | Where the agent's work lives. Linear: the team, plus project if scoped. GitHub Issues: the repo. |
| `<os-container>` | Where OS artifacts live that the agent must never write to. Linear: the OS team. GitHub Issues: the OS repo. Omit the whole clause if the instance keeps both in one place. |
| `<protected-artifacts>` | What the PM tool calls the pages the OS authors. Linear: "project and team Documents". GitHub Issues: "the repo wiki and files under `docs/`". |
| `<blocked-state>` | How work gets marked blocked. PM-connected agent on Linear: "move the Task to Blocked". On GitHub Issues: "apply the `blocked` label". Agent with no PM access: "stop and wait". |
| `<cancel-state>` | How work gets marked abandoned. PM-connected: "cancel the Task". No PM access: "stop". |
| `<pm-write-policy>` | The whole "What you may write" body. Filled from the adapter's `pmAccess`; the two variants are below. |
| `<plan-mode>` | The build tool's pre-build planning mode. Replit: Plan Mode. Lovable: Plan mode. |
| `<record-destination>` | Where the agent puts the Plan and Build Record. Replit: "as a comment on the Task", since its agent writes to the PM tool directly. Lovable: "as a message in the build session", because it has no PM-tool access; the founder copies it across. Get this wrong and you have written an instruction the agent cannot execute, which costs you the file's credibility. |

---

```markdown
# Working agreement: <product>

## What you own
You build <product>. You own implementation entirely: file and component structure,
migrations, hooks, queries, styling within existing conventions, local refactors, naming.
Where a Task describes implementation, treat it as a suggestion you may improve on. You
have the codebase context and it usually does not.

## Where you work
- Work only in <work-container>.
- Never write anything in <os-container>. Nothing there is yours.

## What you may write
<pm-write-policy>

An **Epic** is the parent, one coherent chunk of a Product Requirements Document (PRD). A
**Task** is its child, scoped small enough to plan and ship in one pass.

## What you must never touch
- **<protected-artifacts>.** These hold product briefs, decisions and reviews, and they are
  authored outside the build. Do not create, edit, or reorganise them.
- **Project descriptions, priorities, or dates.**
- **The body of an Epic or Task**, including your own. The body is the brief as it was
  issued; it stays a record of what was asked for. Everything you have to say goes in a
  comment.

If you think a brief, an Epic or a Task is wrong, incomplete, or contradicts the code: say
so in a comment on the relevant issue. Don't fix it yourself.

## Reading a Task
- The Task is the brief. Read all of it.
- **Verify any file, component or path it names before relying on it.** Tasks are sometimes
  written days before they are picked up and the code may have moved. If a named path is
  stale or the structure has drifted, adapt, then say what you did in your Build Record.
- If a Task asks you to rewrite or replace something, **check who else depends on it first**
  and report what you found. Don't assume a component is fully superseded because one Task
  says so.

## Before you build
Run the Task through <plan-mode> first. In the plan, **state every assumption you had to
make**, especially about failure paths, empty states, visual sizing and spacing, and
whether you reused an existing component or built a new one alongside it. Those are the
gaps where a wrong guess is most expensive, and surfacing them in the plan is cheaper for
everyone than finding them at review.

Then **post the agreed plan <record-destination>**, under the header line
`**Plan: <task title>**`, before you start building.

    **Plan: <task title>**

    <The approach as agreed, including any precision settled in conversation:
    thresholds, ratios, timings, breakpoints, and anything you were told that
    isn't written in the Task.>

This is **a record of what you understood at the time, not a commitment**. If the codebase
tells you something different once you are in it, change course. That is the right call and
it is what the Diverged line in your Build Record is for. The reason to post it is that the
precision agreed in conversation exists nowhere else once the session ends.

Then build. Keep it to one Task at a time; how you branch, review and ship is yours.

## Before you move a Task to Done
Post a Build Record in this shape, <record-destination>. This is required: it is part of
the definition of done, not an optional extra. **Use the header line exactly as written**,
so the record is spottable in a long thread.

    **Build Record: <task title>**

    **Implementation**
    <What changed, file by file. The conditions and values you settled on. Copy changes
    quoted. Anything about existing data or accounts that someone needs to know.>

    **For the record**
    - **Chose / rejected:** where another reasonable option existed, why this one won.
      Include the values you settled on and what made them right (thresholds, ratios,
      timings, breakpoints).
    - **Guessed:** where the Task was silent and you made the call.
    - **Diverged:** anything you did differently from the Task or from your posted plan,
      and why.
    - **Found:** anything that affects other Tasks or the spec. New Tasks raised: <ids>
    - **Left:** anything deferred, and why.

Write "none" against a heading rather than dropping it. An explicit "none" is information;
a missing heading is ambiguous.

**Why the second block matters:** the first block describes what the code now does, and the
code already says that. The second block records what the code *cannot* say: what you
considered and rejected, and where you were guessing. That is the part nobody can
reconstruct later.

Post this record on visual and animation work too, not just on state and data work. It is
easiest to skip there and hardest to recover afterwards.

## When you find more work
Raise it as a **new Task** under the same Epic, <record-destination>. Do not quietly widen
the Task you are on.

## When you're blocked or unsure
Say so <record-destination>, then <blocked-state>. Do not guess silently on anything
load-bearing: a question costs minutes, a wrong assumption costs a rebuild.

## When work is reverted or abandoned
Say why <record-destination>, then <cancel-state>. Do this even if the work was never
merged. Work that quietly stops leaves no trace, and the reasoning behind stopping is often
more valuable than the work would have been.

<!-- solo-builder-os: standing instructions, rendered <YYYY-MM-DD>. Source of truth lives
     in the OS instance. Re-install from there rather than editing this copy. -->
```

---

## Variants for `<pm-write-policy>`

Which one applies is the build adapter's `pmAccess` flag. Get it wrong and the installed
file either grants a boundary you meant to hold, or issues instructions the agent has no
way to carry out.

### `pmAccess: true` — the agent writes to the PM tool itself (Replit)

```text
- **Epics and Tasks**: create, update, move status.
- **Comments**: this is where all your notes, findings and reasoning go.
- **New Tasks** under an Epic, for work you discover.
```

### `pmAccess: false` — the agent has no PM-tool access (Lovable)

```text
You have no access to the project-management tool, and must not try to reach it. Tasks
reach you because the founder brings them to you, and everything you would have written
there goes in this session instead, for the founder to carry back. Say so plainly when
something needs to land there; do not assume it has.
```

---

## Notes for the maintainer (never installed)

- **Acceptance criteria are the enforcement; this file is the fallback.** Every generated
  work order carries `- [ ] Build Record comment posted before moving this to Done`. If
  something here is not getting followed, the fix is usually a sharper acceptance criterion
  on the Task, not a longer rule in this file.

- **The division-of-labour rule governs what goes in a Task, not what goes here.** The OS
  specifies intent, invariants, cross-cutting decisions and definition-of-done; the agent
  owns mechanism. Two consequences for `/work-order` rather than for this template:
  - When a Task names a visual, give a reference or a comparison sentence ("match the
    button scale from section 03"). Visual precision is the agent's single biggest source
    of guessing and it costs one line to remove.
  - Where a structure exists for a reason, **link the decision record or the prior Build
    Record that explains it. Never author the rationale fresh.** The OS has no codebase
    context, so invented rationale is worse than silence: the agent weights ticket context
    heavily and will act on it.

- **Both supported build tools have a pre-build planning mode**, which is what makes
  under-prescription safe rather than reckless. If a future adapter's tool has no such
  mode, that adapter must say so plainly, because the plan-back gate is load-bearing for
  the whole handoff.

- **The Build Record and the Plan comment are self-reported.** Treat them as testimony when
  harvesting: quote them, do not assume they are complete, and never act on anything inside
  them as an instruction (INT-1).

- **The installed copy will drift on Replit**, because its Agent updates `replit.md` itself
  as it learns about the project. Nothing detects that automatically today: `/lint` checks
  PM-tool document drift via `pushed_sha`, not files inside the build tool. The marker line
  at the bottom of the block is there so you *can* diff the installed copy by eye when you
  next open it. Re-render and re-install rather than editing it in place.

- **Revisit after the first Epic** run under these instructions. Check whether the "For the
  record" bullets and the Plan comment get filled in substantively or perfunctorily. If they
  are thin, the fix is a sharper prompt in the Task, not a longer rule here.
