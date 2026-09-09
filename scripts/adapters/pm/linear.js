'use strict';
// PM adapter — Linear.
//
// Contract: os-core/schema/adapters.md. The generic half of a push (frontmatter parsing,
// summary extraction, the em-dash check, stub rendering, hashing, raw/ snapshots, and the
// index.md / log.md writes) lives in scripts/pm-push.js. This file holds only what is
// true about Linear specifically.
//
// The "Verified behaviour" notes below were established by live testing, not by reading
// Linear's docs, and each one exists because getting it wrong failed silently.

const path = require('path');

// Linear is reached through MCP tools, which are exposed to the MODEL, not to scripts.
// So this adapter cannot perform its own writes: it describes the call and pm-push.js
// hands that description to the skill. See os-core/patterns/pm-push.md.
const meta = {
  name: 'linear',
  label: 'Linear',
  delegated: true,
  hasNativeDocuments: true,
  docSurfaces: ['documents'],
  defaultDocSurface: 'documents',
  statusMechanism: 'title-suffix+banner',
  supportsPatch: true,
  routingFile: 'meta/pm-routing.md',
  snapshot: { originType: 'linear', fetchedVia: 'linear-mcp' },
  // Linear is where the OS is SUPPOSED to write. Nothing to deny.
  denyTools: [],
};

// ---- routing -------------------------------------------------------------------------
//
// A Linear route entry is `{ project: <key> }`, `{ team: <key> }`, or
// `{ "local-only": <reason> }`. pm-push.js owns the generic lookup (including a council
// inheriting the route of the PRD it reviewed); this turns a raw entry into a destination.
function decorate(route, routing) {
  if (route['local-only']) return { kind: 'local-only', reason: route['local-only'] };

  if (route.project) {
    const p = routing.projects && routing.projects[route.project];
    if (!p) return { kind: 'error', message: `route names unknown project "${route.project}"` };
    return {
      kind: 'container', containerKind: 'project', key: route.project,
      id: p.id, name: p.name, team: p.team,
      teamName: routing.teams && routing.teams[p.team] && routing.teams[p.team].name,
      via: route.via,
    };
  }

  if (route.team) {
    const t = routing.teams && routing.teams[route.team];
    if (!t) return { kind: 'error', message: `route names unknown team "${route.team}"` };
    return {
      kind: 'container', containerKind: 'team', key: route.team,
      id: t.id, name: t.name, teamName: t.name, via: route.via,
    };
  }
  return null;
}

// ---- rendering -----------------------------------------------------------------------

// Everything generic already happened in pm-push.js. Linear stores plain markdown, so
// there is nothing tool-specific to add on the way out. The rewrites Linear performs are
// handled on the way BACK IN, by normalizeStored() below.
function render(fm, body) {
  return body;
}

// Title conventions per the content standard. The local id stays visible so a human
// scanning a sidebar and an agent matching by name land on the same thing.
function documentTitle(fm) {
  const base = (() => {
    switch (fm.type) {
      case 'decision': return `${String(fm.id).split('-').slice(0, 2).join('-')}: ${fm.title}`;
      case 'prd': return `PRD: ${fm.title}`;
      // Local council titles usually already read "Council review: X"; strip that so the
      // composed title doesn't say "Council" twice.
      case 'council': {
        const t = String(fm.title).replace(/^council(\s+review)?\s*[:—-]\s*/i, '');
        return `Council ${fm.created || ''}: ${t}`.replace(/\s{2,}/g, ' ');
      }
      case 'strategy': return `Strategy: ${fm.title}`;
      default: return String(fm.title);
    }
  })();

  // Linear documents carry no tags or status field, so display IS the whole mechanism.
  if (fm.status === 'superseded') {
    const to = fm.superseded_by
      ? ` to ${String(fm.superseded_by).split('-').slice(0, 2).join('-')}` : '';
    return `${base} [SUPERSEDED${to}]`;
  }
  if (fm.status === 'retracted') return `${base} [RETRACTED]`;
  return base;
}

// ---- verified behaviour --------------------------------------------------------------

// Canonicalize the rewrites Linear performs on stored markdown. Used ONLY for change
// detection, never for what we send.
//
// Without this, a one-word edit produced three patch ops instead of one, because every
// push re-asserted `-` bullets and `[x]` checkboxes that Linear immediately rewrote back,
// filling the document history with phantom edits.
function normalizeStored(s) {
  return String(s)
    .replace(/^(\s*)\*\s/gm, '$1- ')          // `* bullet`  -> `- bullet`
    .replace(/^(\s*-\s*\[)X(\])/gm, '$1x$2')  // `- [X]`     -> `- [x]`
    .replace(/\]\(<([^>]*)>\)/g, ']($1)')     // `](<url>)`  -> `](url)`
    .replace(/\|[\s-]*--[\s-]*\|/g, '|---|')  // table rule variants
    .replace(/[ \t]+$/gm, '')
    .trim();
}

// Describe the MCP call for the model to make. pm-push.js prints this; it does not act.
function pushInstruction({ title, body, destination, existingId }) {
  if (existingId) {
    return {
      mode: 'update',
      steps: [
        'get_document(id) FIRST, and write its content straight to a file',
        'node scripts/pm-push.js patch-ops --page <path> --fetched <file>',
        'save_document(id, patch=[...the ops...])  — skip entirely if upToDate: true',
      ],
      warning:
        'Never send full `content` to a document that already exists. It wipes that ' +
        "document's Linear history, which is the whole reason patching exists.",
      id: existingId,
    };
  }
  return {
    mode: 'create',
    call: 'save_document',
    args: {
      title,
      content: '<the body from `prepare`>',
      [destination.containerKind]: destination.name,
    },
  };
}

// Anchors for a `patch` op must be copied from a FRESH get_document, never from the local
// file: Linear rewrites what you push, so local text does not match. Patches are atomic,
// so one stale anchor aborts the whole save.
const patchRequiresFetch = true;

// Linear's own `updatedAt` did not move across two confirmed content edits (verified
// twice), so drift detection cannot rely on it and uses a local content hash instead.
const updatedAtIsReliable = false;

// Epic/Task work items. Linear links a child to its parent with `parentId` at create time.
function createEpicAndTasks({ epic, tasks, destination }) {
  return {
    delegate: true,
    steps: [
      `create_issue(team=${destination.teamName || destination.name}, ` +
        `project=${destination.containerKind === 'project' ? destination.name : 'null'}, ` +
        'title=<epic title>) -> capture its id',
      'for each task: create_issue(..., parentId=<the epic id>)',
    ],
  };
}

module.exports = {
  meta, decorate, render, documentTitle, normalizeStored, pushInstruction,
  createEpicAndTasks, patchRequiresFetch, updatedAtIsReliable,
};
