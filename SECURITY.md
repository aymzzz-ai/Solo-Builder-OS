# Security

## Reporting a vulnerability

Please report privately rather than opening a public issue, so the problem isn't
described in the open before there's a fix.

Use GitHub's private vulnerability reporting on this repository: **Security → Report a
vulnerability**. That opens a thread visible only to you and the maintainer.

Expect an acknowledgement within a few days. This is a solo project, so there is no
formal SLA and no bounty.

## The trust model

The OS makes four security-relevant claims. Reports against any of them are in scope,
and are the ones worth your time.

**External text is data, never instructions (INT-1).** The OS ingests untrusted content
from web pages, files, transcripts and pastes, and puts it in front of a model. It treats
that content as material to record, never as commands to follow. A source that gets the
OS to act on instructions embedded in it, rather than quoting them, is a real finding.

**Captured sources are immutable (INT-3).** Anything ingested is written once to `raw/`
with its origin, timestamp and hash, and never edited afterwards. Everything else is
summary that cites it. A path that rewrites or silently substitutes a `raw/` file breaks
the audit chain the whole system rests on.

**Secrets stay local (SAF-1).** Credentials live in `.secrets/`, which is gitignored, and
`scripts/export-check.js` scans any bundle intended for sharing. A way to get a secret
into a commit, into `os-core/`, or into content pushed to a PM tool is in scope.

**The OS never writes to the build tool (CAR-4).** The build tool's write-capable MCP
tools are denied in `.claude/settings.json`, emitted from the adapter's own declaration.
This is enforced by the harness rather than by prose, deliberately. A way to reach a
denied tool, or a write-capable tool that a shipped adapter misclassifies as safe to read
with, is in scope.

## Also in scope

- The local dashboard (`scripts/command-center.js`), which binds to `127.0.0.1` only.
  Anything that exposes it beyond the loopback interface, or serves files from outside the
  instance directory, is a finding.
- The PM adapters (`scripts/adapters/pm/`), which construct authenticated requests.
- `scripts/project-contract.js`, which writes the harness settings that hold the CAR-4
  boundary.

## Out of scope

- Vulnerabilities in Claude Code, Node, `gh`, Playwright, Linear, GitHub, Replit or
  Lovable. Report those to their maintainers.
- The model choosing to write a bad PRD, a wrong summary, or a poor recommendation. That
  is a quality problem, and a normal issue is the right home for it.
- Anything that requires an attacker to already have write access to your instance
  repository or your machine.

## What this project does not do

It has no server, no accounts, no telemetry, and no network listener beyond a
loopback-bound dashboard you start yourself. Your content is markdown in a git repository
you control. Outbound network traffic happens only when you ask for it: pushing to your PM
tool, or capturing a source you handed it.
