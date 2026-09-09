# Build adapter: Lovable

> Contract: `os-core/schema/adapters.md`. A build adapter is mostly documentation, because
> the OS **never writes to the build tool** (CAR-4: the OS is never inside the build). It
> only needs to know which tools are safe to read with, and which must be denied at the
> harness level.

---

## The MCP surface

Lovable runs an official MCP server at `https://mcp.lovable.dev`, **OAuth only, no API
keys**, which is exactly the posture SAF-1 wants. It is available on all plans.

**Its read surface is better than Replit's for the OS's purposes.** Replit exposes a single
natural-language `ask_question`, whose answers are a claim about the codebase. Lovable
exposes actual file reads (`read_file`, `list_files`, `get_diff`, `list_edits`), so
`/work-order` can verify a path by **reading it** rather than by asking about it. Where both
are available, prefer `list_files` or `read_file` over an inferred answer, and treat what
comes back as the answer rather than reasoning about what the tool probably returns.

## Tool classification

Judged by **effect, not by name**. Two calls deserve specific mention:

- **`query_database` executes arbitrary SQL, including writes and schema changes.** It is a
  write tool despite reading like a query, and it is denied.
- **`get_file_upload_url`** mints a presigned upload URL. It creates the means to write, so
  it is denied too.

When an effect is unclear, the tool goes in `denyTools`: a denied read tool costs one
conversation, an allowed write tool costs a boundary.

```json
{
  "name": "lovable",
  "label": "Lovable",
  "codebaseQuery": "read_file",
  "readTools": [
    "get_me",
    "list_workspaces",
    "get_workspace",
    "list_projects",
    "get_project",
    "list_template_projects",
    "list_design_systems",
    "get_message",
    "list_messages",
    "get_workspace_knowledge",
    "get_project_knowledge",
    "list_workspace_skills",
    "get_workspace_skill",
    "get_diff",
    "list_files",
    "read_file",
    "list_edits",
    "get_database_status",
    "list_connectors",
    "list_connections",
    "list_custom_connectors",
    "list_available_connectors",
    "get_project_analytics",
    "get_project_analytics_trend"
  ],
  "denyTools": [
    "mcp__lovable__create_project",
    "mcp__lovable__remix_project",
    "mcp__lovable__deploy_project",
    "mcp__lovable__send_message",
    "mcp__lovable__set_project_visibility",
    "mcp__lovable__set_folder_visibility",
    "mcp__lovable__move_projects_to_folder",
    "mcp__lovable__set_workspace_knowledge",
    "mcp__lovable__set_project_knowledge",
    "mcp__lovable__create_workspace_skill",
    "mcp__lovable__update_workspace_skill",
    "mcp__lovable__delete_workspace_skill",
    "mcp__lovable__enable_database",
    "mcp__lovable__query_database",
    "mcp__lovable__add_connector",
    "mcp__lovable__remove_connector",
    "mcp__lovable__get_file_upload_url",
    "mcp__lovable__import-claude-design-from-url"
  ],
  "instructionsTarget": "AGENTS.md",
  "pmAccess": false
}
```

`send_message` is the one that matters most. It submits a prompt to Lovable's own agent,
which then writes code. That **is** the build, and the OS does not do the build. Denying it
is the whole CAR-4 boundary for this tool.

## Setup at onboarding

1. Connect the Lovable MCP server in the host and complete the OAuth flow.
2. Record the project identifier in `config/businesses.md`.
3. Confirm the deny block landed in the instance's real `.claude/settings.json`. Not
   optional: a harness boundary that was never emitted is not a boundary.
4. **Optional.** Draft the standing instructions with
   `node scripts/render-agent-instructions.js` and install the result as **`AGENTS.md` in
   the repo root**. Lovable reads a root-level `AGENTS.md` on every message regardless of
   session length, which makes it the right target: version-controlled, no character cap,
   and no write tool the OS is denied.

   The alternative is **project knowledge**, which Lovable also always injects, but it is
   capped at 10,000 characters and is written through `set_project_knowledge` — a **write
   tool the OS denies**. Use it only for context that genuinely belongs to the project
   rather than the working agreement. Either way the OS drafts and you install.

   Skip it if you would rather steer the agent conversationally. What you give up is a
   consistent Build Record shape, which matters more here than on Replit: see the return
   leg below.

## Plan mode

Lovable provides **Plan mode**, which produces a written plan you can review or edit before
any code changes. The handoff depends on it: `/work-order` specifies intent rather than
implementation, and that is only safe because gaps surface in a plan rather than silently in
the build.

## The return leg is manual

Lovable's agent has **no access to your PM tool** (`pmAccess: false`). Nothing it produces
reaches Linear or GitHub Issues on its own, so the Build Record does not come back the way a
Replit close-out comment does. You carry it: copy the agent's closing summary into the Task
before closing it, or answer for it in `/harvest`'s interview.

That makes `/harvest` carry more of the load on a Lovable-built product than on a Replit
one, and it is worth knowing before a harvest rather than during it.

## Confirm on first run

Three things are worth checking against your own project the first time through, because
each one changes how a command behaves:

- **Tree coverage.** Whether `read_file` and `list_files` reach the whole project or only
  the parts Lovable considers editable. `/work-order`'s path verification scopes to it.
- **`list_edits` output** for a project built largely through chat, and whether it is worth
  feeding to `/harvest` alongside the Build Record.
- **The closing summary's depth**, which decides how much of the Build Record you carry
  across verbatim and how much `/harvest` draws out in the interview.
