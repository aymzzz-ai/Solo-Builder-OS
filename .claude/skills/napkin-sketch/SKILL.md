---
name: napkin-sketch
description: >-
  A fast ASCII-wireframe THINKING tool — sketch a screen or flow in plain text so you can
  react to a layout before committing to it. Use this skill WHENEVER the user wants to rough
  out a UI, think through a screen or flow, visualize a layout quickly, or says any of:
  "napkin sketch", "sketch this", "wireframe", "rough out the screen", "what could this look
  like". It renders low-fidelity ASCII boxes and annotations inline and iterates with you. It
  is NOT a prototyper and does NOT hand off to v0 / Lovable / Figma or capture a browser —
  the OS is never inside the build (CAR-4). It writes nothing by default; on request it can
  file the sketch into a PRD or wiki page.
---

# Napkin-sketch — think in ASCII, don't build

A thinking aid: externalize a screen or flow as a low-fi ASCII wireframe so a layout idea
becomes something you can point at and argue with. Adapted (stripped) from PM-OS
`napkin-sketch`. Authority: `os-core/schema/operating-contract.md`.

## What this is — and is NOT

- A **thinking tool**: rapid ASCII wireframes (boxes, labels, annotations) you iterate on to
  reason about structure and flow.
- **NOT** a prototyper, design tool, or build step. **No** browser-capture, **no** prototype
  handoff to v0 / Lovable / Figma (dropped per CAR-4 + A1 — the OS never enters the build).
- **Low-fidelity on purpose** — the value is the thinking, not the pixels.
- **Writes nothing by default.** It's ephemeral unless you ask to save it.

## Inputs

- `<screen | flow | feature to sketch>`.
- `--save [prd-slug | page]` — optional; file the sketch into a PRD or wiki page.

## Workflow

1. **Clarify** the screen/flow and its key elements (a light `grill-me` pass only if the
   ask is vague — what's the primary action, what data shows, what's the state).
2. **Render** one or more ASCII wireframes. Annotate regions and interactions in text.
3. **Iterate** with the user — try alternative layouts cheaply; that's the point.
4. **Only if `--save` (or the user asks):** file the chosen sketch into the target PRD's
   *Requirements + the thinking* section or a `wiki/` concept page.

## Recall-trust (CAR-6)

A thinking tool — design opinions are free. But don't assert a **logged fact** (what was
decided, what a user said) without citing it; if it's not logged, say so.

## Draft the writes (only when saving)

If saving, append the ASCII block to the target PRD/wiki page and update that page's normal
`index.md` / `log.md` lines (the sketch rides its target page — there is **no standalone
log op**). Show the draft; apply on approval; **commit** (SAF-2). By default this skill
produces **no writes** at all.

## Files this skill touches

- **Reads (only when saving):** `index.md`, the target `prds/` or `wiki/` page.
- **Writes (only on `--save` + approval):** appends to the target page; updates its
  `index.md` / `log.md` lines; `meta/feedback-log.md`.
- **Never writes:** secrets, `os-core/`, any other business, or anything by default.

## Reused tools / plug-in points

- **No external tools** — browser-capture was deliberately dropped (CAR-4). Pure inline
  reasoning. Schema authority: `os-core/schema/operating-contract.md` (§3.4 summarize-and-link
  when filing into a hub).
