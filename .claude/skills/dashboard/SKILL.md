---
name: dashboard
description: >-
  Launch the local command center — the read-only browser dashboard over this OS
  instance's markdown store — and open it in Chrome. Use this skill WHENEVER the user
  wants to SEE where things stand at a glance rather than ask: "dashboard", "open the
  dashboard", "launch the dashboard", "command center", "show me the dashboard", "open
  the brain in the browser". It starts the zero-dependency local server
  (scripts/command-center.js, bound to 127.0.0.1 only) if it isn't already running, then
  opens the URL in Chrome. Pure pull: read-only, local-only, no routine, no hook, nothing
  exposed off the machine. It renders structural state; for the synthesized "what's next
  and why", point the user to /brief.
---

# Dashboard — launch the command center in Chrome

The visual front-end over the brain. `scripts/command-center.js` serves a **local,
read-only** view of the markdown store (home brief, roadmap & queue, wiki browser) on
`127.0.0.1`. This skill just **starts it (if needed) and opens Chrome at the URL** — it
is a launcher, nothing more. Authority: `os-core/schema/operating-contract.md`.

## Inputs

- *(none required.)*
- Optional `[port]` — defaults to **4317**. Use another port only if 4317 is taken.

## Workflow

1. **Pick the port** — default `4317` unless the user named one.
2. **Check if it's already up** (so we never double-launch):
   ```
   curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4317/
   ```
   - `200` → already running; skip to step 4.
   - anything else → go to step 3.
3. **Start the server in the background** (it runs for the session; Ctrl-C / session end
   stops it):
   ```
   node scripts/command-center.js --port 4317
   ```
   Launch it with `run_in_background: true`, then poll the curl in step 2 once until it
   returns `200` before opening the browser.
4. **Open Chrome at the URL** (Windows):
   ```
   start chrome "http://127.0.0.1:4317"
   ```
   If `start chrome` fails (Chrome not on PATH / not registered), fall back to the
   default browser via the server's own flag — re-launch with `--open` — and tell the
   user the URL so they can open it manually.
5. **Tell the user the URL** (`http://127.0.0.1:4317`) and that it's running, read-only,
   and local-only. Mention that for a server that persists beyond this session they can
   run `npm run dashboard` in their own terminal and leave it open.

## Hard rules from the contract

- **Read-only (INT-2).** This skill only *launches a viewer*. It never writes to the
  store, never edits `wiki/`/`raw/`/`index.md`, and the server itself has no write
  endpoints. Do not stamp `meta/routines-state.md` — the dashboard is **not** a routine.
- **Local-only (INT-2 / SAF-1).** The server binds `127.0.0.1` only and serves **only**
  the business knowledge tree (the read-scope guard 404s anything outside it). Never
  expose it off the machine, add auth, or tunnel it as part of this skill.
- **No synthesis.** The dashboard renders **structural** truth mechanically; it is not
  `/brief`. If the user wants judgment ("what's next and why"), point them to `/brief`.
- **Don't rebuild.** This skill launches `scripts/command-center.js` as-is; it does not
  modify the server. Changes to the dashboard go through the spec, not this launcher.

## Files this skill touches

- **Reads:** nothing in the store directly (the server reads it at request time).
- **Runs:** `node scripts/command-center.js` (local server) + opens Chrome.
- **Writes:** **nothing.** No wiki writes, no `meta/` stamp, no git commit.

## Reused tools

- `scripts/command-center.js` — the zero-dependency Node server (Node built-ins only,
  CAR-1). The `npm run dashboard` alias points at the same file.
