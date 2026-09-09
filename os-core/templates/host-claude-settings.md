# Host adapter — Claude Code `.claude/settings.json` (template)

> **What this is.** The Claude Code *host adapter* (ARC-2) for a **business instance**.
> It wires the only routine that needs a host event rather than a pull from `/brief`: the
> **session-end harvest**. It also carries the CAR-4 deny block. It is a **template /
> spec** — it does **not** fire here in the OS-build workspace (which is not a conforming
> business instance). `scripts/project-contract.js` emits it into the instance's
> `.claude/settings.json` (at the repo root — one business per clone) when it scaffolds
> the instance at onboarding, alongside the projected `CLAUDE.md` and a
> seeded `meta/routines-state.md`.
>
> Authority: `os-core/schema/operating-contract.md`. The other routines
> (`lint`, `curate`, `conscience`, `self-improve`) have **no hook** — they surface only
> as overdue nudges in `/brief` (pure pull, zero idle cost), per the cadence ledger
> `meta/routines-state.md` (contract §7).

---

## Why only this one gets a hook

**Session-end harvest** is *event-shaped*, not overdue-shaped: the point is to catch the
work boundary before context is lost. `/brief` runs at the *start* of a session and can't
harvest a session that hasn't happened, so this one needs a `SessionEnd` event.

Everything else is a manual command surfaced by `/brief`. Nothing outward runs silently,
and there is no autonomous-write carve-out at all: the retired mirror sync was the only
one, and it is gone.

## Realistic hook semantics (honest about what a hook can do)

A Claude Code hook runs a **shell command** at the event; it does **not** run a model
turn, so it cannot itself produce an approve-gated draft. Therefore:

- **`SessionEnd` → mark pending, don't draft.** The hook stamps the `harvest` line in
  `meta/routines-state.md` to *pending since <date>*. `/brief` then surfaces
  *"unharvested session from <date> — run `/harvest`?"* and the **draft is produced when
  the user next runs `/harvest`** (the skill's normal draft→approve flow). This keeps the
  "never a silent write" guarantee intact.
The helper script referenced below (`scripts/hooks/session-end-harvest.js`) is **emitted
per-instance** (this `settings.json` is written by `project-contract.js` at onboarding) and
does **not** fire in the OS-build workspace.

## The config to emit (per instance)

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "hooks": [
          { "type": "command", "command": "node scripts/hooks/session-end-harvest.js" }
        ]
      }
    ]
  },
  "permissions": {
    "deny": []
  }
}
```

- `session-end-harvest.js` — appends a `← PENDING: unharvested session since <date>` suffix
  to the `harvest` line in `meta/routines-state.md` (mark-only; the draft happens on the next
  `/harvest`, which clears the suffix).
- `permissions.deny` — **left empty in this template on purpose.** It is filled at scaffold
  time by `project-contract.js` from the **active build adapter's** declared `denyTools`
  (`config/tools.md` names the adapter; `scripts/adapters/build/<name>.md` declares the
  list). Hardcoding one tool's names here would mean a business on a different build tool
  got a deny block naming tools it does not have, which is worse than none: it looks
  enforced and is not.

This is the CAR-4 boundary (the OS is never inside the build) enforced at the harness level
rather than left as a rule a future session has to remember. Confirming the block landed in
the instance's real `.claude/settings.json`, with the right tool names in it, is part of
onboarding's "Connect your tools: build tool" step, not optional.

The hook is a thin adapter (ARC-2): the manual `/harvest` command is the portable fallback,
so core behavior never depends on it existing. **The deny rule has no fallback**, because a
harness boundary that could be skipped is not a boundary.

`project-contract.js`'s `emitSettings()` **merges** this template's keys into whatever is
already on disk rather than overwriting, so re-running it on an instance that has
hand-added permissions is safe.
