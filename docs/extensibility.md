# Extensibility

The base install is deliberately thin: Claude Code, Node 18+, and `git`. Everything on
this page is optional, needed only for a specific capability, and safe to skip until you
want that capability.

The pattern is the same in each case. The OS never silently substitutes a different
mechanism when an optional piece is missing, because what captured a source is part of
that source's provenance. It tells you what is missing and what to run.

---

## Playwright — capturing web sources

**What it unlocks.** Handing the OS a URL. Playwright renders the page and captures its
text into an immutable `raw/` snapshot with an origin URL, a timestamp, and a hash, which
is what lets you reopen the original months later and check what it actually said.

**What depends on it.**

| Command | Dependency |
|:--|:--|
| `/competitor-analysis` | Required. Every finding cites a captured page, so without capture there is nothing to cite. |
| `/ingest` with a URL | Required for the web path only. Files, pasted text, screenshots and transcripts all work without it. |
| `/council` | Optional. The Business/Strategy and Skeptic lenses can do live market checks when it is available. |

**Install.**

```bash
npm install playwright
npx playwright install chromium --only-shell
```

The `--only-shell` flag matters. Plain `npx playwright install` fetches Chromium, Firefox
and WebKit, which is roughly 900MB and more than this OS ever uses. The headless shell is
about 270MB and is all that a text capture needs.

The browser binaries land in a shared cache outside the project (`~/.cache/ms-playwright`
on Linux and macOS, `~/AppData/Local/ms-playwright` on Windows), so the cost is once per
machine rather than once per product instance. If you have used Playwright before, you may
already have it.

**Without it.** `/ingest` offers to take the content as a paste, recorded as
`fetched_via: manual-paste` so the record stays honest about how it was captured.
`/competitor-analysis` stops rather than analyzing competitors from memory.

---

## yt-dlp — YouTube transcripts

**What it unlocks.** `/ingest` on a YouTube URL, which stores the transcript and the URL
rather than the media.

**Install.** See [yt-dlp's own instructions](https://github.com/yt-dlp/yt-dlp#installation);
it is a standalone binary, not an npm package.

**Without it.** Paste the transcript yourself. YouTube's own transcript panel will give you
the text, and it ingests like any other pasted source.

---

## Registering a tool that has no adapter

PM tools and build tools are a hybrid registry rather than a closed set. Reference adapters
ship for Linear, GitHub Issues, Replit and Lovable; anything else is a documented path
rather than a code change.

The contract lives in
[`os-core/schema/adapters.md`](../os-core/schema/adapters.md), and `/onboard` walks you
through it interactively if you pick a tool with no adapter. Two things are worth knowing
before you start:

- **A PM adapter is code**, because the OS writes to the PM tool constantly and those
  writes have to be deterministic.
- **A build adapter is mostly documentation**, because the OS never writes to the build
  tool at all. What it does need is the names of that tool's write-capable tools, so they
  can be denied at the harness level. If you cannot name them, the boundary is not
  enforceable and `/onboard` will say so rather than pretend otherwise.
- **Two fields decide what the standing instructions say.** `instructionsTarget` is the
  file the agent reads on every request, and `pmAccess` says whether that agent can reach
  your PM tool at all. The second one matters more than it looks: an agent with no PM
  access must never be handed instructions telling it to comment on a ticket, so
  `scripts/render-agent-instructions.js` refuses to render until the adapter declares it.

---

## Adding a council persona

The `/council` roster is data, not code. Drop a new persona file into `os-core/prompts/`
and it is summonable by name from that moment. See that folder's
[README](../os-core/prompts/README.md) for the shape of one.
