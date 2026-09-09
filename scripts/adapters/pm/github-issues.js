'use strict';
// PM adapter — GitHub Issues (+ Discussions or repo files for artifact bodies).
//
// Contract: os-core/schema/adapters.md. Verified behaviour: ./github-issues.md.
//
// DIRECT, not delegated: unlike Linear (reachable only over MCP, which scripts cannot
// call), GitHub is reachable from a script through the `gh` CLI, which carries the user's
// existing OAuth login. So this adapter performs its own writes and no API key is
// introduced (SAF-1).
//
// THE GAP THIS ADAPTER FILLS: GitHub has no document object. Its wiki is unavailable on
// private repositories on the free plan, which CAR-1 rules out. So artifact bodies go to
// one of two surfaces, chosen at onboarding and recorded in pm_config.doc_surface:
//   discussions (default) — free on private repos, categories map onto artifact types,
//                           renders in the mobile app
//   repo-files            — markdown under docs/os/ in the product repo
//
// VERIFIED LIVE (see github-issues.md): both surfaces store markdown BYTE-IDENTICALLY.
// No rewrites at all, on create or update. That is why normalizeStored is the identity
// function here rather than Linear's rewrite table, and it is a real difference between
// the two tools rather than an untested assumption.

const { execFileSync } = require('child_process');

const meta = {
  name: 'github-issues',
  label: 'GitHub',
  delegated: false,
  hasNativeDocuments: false,
  docSurfaces: ['discussions', 'repo-files'],
  defaultDocSurface: 'discussions',
  statusMechanism: 'title-suffix+banner',
  // Neither surface offers a partial-update operation: updateDiscussion replaces the whole
  // body, and the Contents API replaces the whole file. Section-level patching is therefore
  // not available, and pm-push.js falls back to a wholesale replace. Nothing is lost
  // safety-wise; what is lost is granular history, which GitHub keeps its own way (a
  // discussion edit history, and a real commit per file write).
  supportsPatch: false,
  routingFile: 'meta/pm-routing.md',
  snapshot: { originType: 'github', fetchedVia: 'gh-cli' },
  denyTools: [],
};

function gh(args, input) {
  try {
    return execFileSync('gh', args, {
      encoding: 'utf8', input, maxBuffer: 32 * 1024 * 1024,
    });
  } catch (e) {
    const detail = (e.stderr || e.message || '').trim();
    throw new Error(`gh ${args.slice(0, 3).join(' ')} failed: ${detail}`);
  }
}

const api = (args, input) => JSON.parse(gh(['api', ...args], input) || 'null');

// ---- routing -------------------------------------------------------------------------
//
// A GitHub route entry is `{ repo: "<owner>/<name>", category: "<discussion category>" }`,
// `{ repo, folder: "docs/os" }`, or `{ "local-only": <reason> }`. There is no team/project
// hierarchy to mirror: the repo IS the container, and the category or folder is the shelf.
function decorate(route, routing) {
  if (route['local-only']) return { kind: 'local-only', reason: route['local-only'] };

  const repo = route.repo || (routing.defaults && routing.defaults.repo);
  if (!repo) return { kind: 'error', message: 'route names no repo and no defaults.repo' };
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    return { kind: 'error', message: `repo "${repo}" is not in <owner>/<name> form` };
  }

  return {
    kind: 'container',
    containerKind: route.folder ? 'folder' : 'category',
    key: repo,
    id: repo,
    name: route.folder || route.category || (routing.defaults && routing.defaults.category) || 'General',
    teamName: repo,
    repo,
    category: route.category || (routing.defaults && routing.defaults.category) || 'General',
    folder: route.folder || (routing.defaults && routing.defaults.folder) || 'docs/os',
    via: route.via,
  };
}

// GitHub stores exactly what it is given, so there is nothing to adjust on the way out.
function render(fm, body) {
  return body;
}

function documentTitle(fm) {
  const base = (() => {
    switch (fm.type) {
      case 'decision': return `${String(fm.id).split('-').slice(0, 2).join('-')}: ${fm.title}`;
      case 'prd': return `PRD: ${fm.title}`;
      case 'council': {
        const t = String(fm.title).replace(/^council(\s+review)?\s*[:—-]\s*/i, '');
        return `Council ${fm.created || ''}: ${t}`.replace(/\s{2,}/g, ' ');
      }
      case 'strategy': return `Strategy: ${fm.title}`;
      default: return String(fm.title);
    }
  })();

  if (fm.status === 'superseded') {
    const to = fm.superseded_by
      ? ` to ${String(fm.superseded_by).split('-').slice(0, 2).join('-')}` : '';
    return `${base} [SUPERSEDED${to}]`;
  }
  if (fm.status === 'retracted') return `${base} [RETRACTED]`;
  return base;
}

// Verified live: both surfaces round-trip byte-identically, so change detection needs no
// canonicalisation. Kept as an explicit identity function rather than omitted, so the
// contrast with Linear's rewrite table is visible rather than looking like an oversight.
function normalizeStored(s) {
  return String(s).replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
}

// ---- the write ------------------------------------------------------------------------

function surfaceOf(config) {
  const s = (config && config.doc_surface) || meta.defaultDocSurface;
  if (!meta.docSurfaces.includes(s)) {
    throw new Error(`pm_config.doc_surface "${s}" is not one of: ${meta.docSurfaces.join(', ')}`);
  }
  return s;
}

function repoNodeId(repo) {
  const [owner, name] = repo.split('/');
  const q = 'query($o:String!,$n:String!){repository(owner:$o,name:$n){id}}';
  return api(['graphql', '-f', `query=${q}`, '-f', `o=${owner}`, '-f', `n=${name}`])
    .data.repository.id;
}

function categoryNodeId(repo, category) {
  const [owner, name] = repo.split('/');
  const q = 'query($o:String!,$n:String!){repository(owner:$o,name:$n)' +
            '{discussionCategories(first:50){nodes{id name}}}}';
  const nodes = api(['graphql', '-f', `query=${q}`, '-f', `o=${owner}`, '-f', `n=${name}`])
    .data.repository.discussionCategories.nodes;
  const hit = nodes.find((c) => c.name.toLowerCase() === String(category).toLowerCase());
  if (!hit) {
    throw new Error(
      `discussion category "${category}" not found in ${repo}. ` +
      `Available: ${nodes.map((c) => c.name).join(', ')}. ` +
      'Create it in the repo settings, or point the route at one that exists.');
  }
  return hit.id;
}

function push({ title, body, destination, existingId, config }) {
  const surface = surfaceOf(config);
  return surface === 'repo-files'
    ? pushFile({ title, body, destination, existingId })
    : pushDiscussion({ title, body, destination, existingId });
}

function pushDiscussion({ title, body, destination, existingId }) {
  if (existingId) {
    // No partial update exists: this replaces the whole body. GitHub keeps its own edit
    // history for the discussion, so nothing is lost that we could have preserved.
    const m = 'mutation($id:ID!,$t:String!,$b:String!){updateDiscussion(' +
              'input:{discussionId:$id,title:$t,body:$b}){discussion{id url}}}';
    const d = api(['graphql', '-f', `query=${m}`, '-f', `id=${existingId}`,
                   '-f', `t=${title}`, '-f', `b=${body}`]).data.updateDiscussion.discussion;
    return { id: d.id, url: d.url, storedBody: readDiscussion(d.id) };
  }

  const m = 'mutation($r:ID!,$c:ID!,$t:String!,$b:String!){createDiscussion(' +
            'input:{repositoryId:$r,categoryId:$c,title:$t,body:$b}){discussion{id url}}}';
  const d = api(['graphql', '-f', `query=${m}`,
                 '-f', `r=${repoNodeId(destination.repo)}`,
                 '-f', `c=${categoryNodeId(destination.repo, destination.category)}`,
                 '-f', `t=${title}`, '-f', `b=${body}`]).data.createDiscussion.discussion;
  return { id: d.id, url: d.url, storedBody: readDiscussion(d.id) };
}

function readDiscussion(id) {
  const q = 'query($id:ID!){node(id:$id){... on Discussion{body}}}';
  return api(['graphql', '-f', `query=${q}`, '-f', `id=${id}`]).data.node.body;
}

// The Contents API needs the CURRENT blob sha to overwrite, which is GitHub's own version
// of fetch-before-write: without it the call is rejected rather than silently clobbering.
function pushFile({ title, body, destination, existingId }) {
  const repo = destination.repo;
  const filePath = existingId || `${destination.folder}/${slugFromTitle(title)}.md`;
  let sha = null;
  try {
    sha = api(['repos/' + repo + '/contents/' + filePath, '--jq', '.sha']);
  } catch (e) { /* absent: a create */ }

  const args = [
    '-X', 'PUT', `repos/${repo}/contents/${filePath}`,
    '-f', `message=OS push: ${title}`,
    '-f', `content=${Buffer.from(body, 'utf8').toString('base64')}`,
  ];
  if (sha) args.push('-f', `sha=${sha}`);
  const res = api(args);

  return {
    id: filePath,                       // the path IS the stable identifier here
    url: res.content.html_url,
    storedBody: Buffer.from(
      api([`repos/${repo}/contents/${filePath}`, '--jq', '.content']).replace(/\n/g, ''),
      'base64').toString('utf8'),
  };
}

const slugFromTitle = (t) => String(t).toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

// ---- work items -----------------------------------------------------------------------

// VERIFIED LIVE: `sub_issue_id` is the issue's numeric DATABASE id, NOT its issue number.
// Passing the number is the obvious mistake and it fails confusingly, so both are captured
// and the right one is used deliberately.
function createEpicAndTasks({ epic, tasks, destination }) {
  const repo = destination.repo;
  const mk = (it) => {
    const args = ['repos/' + repo + '/issues', '-f', `title=${it.title}`, '-f', `body=${it.body || ''}`];
    for (const l of it.labels || []) args.push('-f', `labels[]=${l}`);
    if (it.assignee) args.push('-f', `assignees[]=${it.assignee}`);
    const r = api(args);
    return { number: r.number, id: r.id, url: r.html_url, title: it.title };
  };

  const parent = mk(epic);
  const children = [];
  for (const t of tasks) {
    const child = mk(t);
    api(['repos/' + repo + `/issues/${parent.number}/sub_issues`,
         '-F', `sub_issue_id=${child.id}`]);
    children.push(child);
  }
  return { epic: parent, tasks: children };
}

const patchRequiresFetch = false;   // no patch operation exists on either surface
const updatedAtIsReliable = true;   // verified: it moves on edit (Linear's did not)

module.exports = {
  meta, decorate, render, documentTitle, normalizeStored, push,
  createEpicAndTasks, patchRequiresFetch, updatedAtIsReliable,
};
