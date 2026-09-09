// pm-push: the deterministic half of an OS → PM-tool document push.
//
// The PM tool is the home of record for PRD / decision / council BODIES; the content
// standard fixes their shape. Six skills need the same mechanical steps, and doing them
// by hand six times guarantees six subtly different behaviours. This script owns
// everything deterministic; the SKILL owns the judgment (which destination when unmapped,
// what the summary says, whether a change is material).
//
// TOOL-SPECIFIC BEHAVIOUR LIVES IN AN ADAPTER, not here.
// `config/tools.md` names the active `pm_tool`; that resolves to
// scripts/adapters/pm/<name>.js. The contract is os-core/schema/adapters.md. Everything in
// this file is true of every PM tool: frontmatter parsing, summary extraction, the em-dash
// check, stub rendering, hashing, raw/ snapshots, and the index.md / log.md writes.
//
// WHY SOME ADAPTERS ARE "DELEGATED"
// A Node script cannot call an MCP server: MCP tools are exposed to the model, not to
// scripts. An adapter whose tool is only reachable over MCP (Linear) therefore sets
// `meta.delegated` and this script describes the call instead of making it. An adapter
// with a real CLI or HTTP surface (GitHub via `gh`) performs its own writes. No API key is
// introduced either way; the OAuth-only posture stands (SAF-1).
//
// THE PUSH SEQUENCE (the skill drives it)
//   1. node scripts/pm-push.js prepare --page <path>
//        -> destination + the rendered body + whether the page is already pushed
//   2a. NEW      -> create the document (adapter tells you how)
//   2b. EXISTING -> fetch the live document FIRST, write it to a file, then:
//        node scripts/pm-push.js patch-ops --page <path> --fetched <file>
//        -> patch ops JSON -> apply them
//   3. fetch the document AGAIN and write the result to a file   <- REQUIRED
//   4. node scripts/pm-push.js commit --page <path> --doc-id <id> --url <url> \
//        --stored <that file> [--material]
//        -> raw/ snapshot (if material), stub frontmatter, index.md, log.md
//
// WHY THE FETCH-AFTER-PUSH (step 3) IS NOT OPTIONAL:
// PM tools REWRITE what you send as they store it. Hashing the body we SENT therefore
// makes every document look drifted the instant it is pushed, and /lint would cry wolf on
// all of them, permanently. `pushed_sha` must hash what the tool STORES, which means
// reading it back. The raw/ snapshot gets the stored body too, so an INT-3 citation
// resolves to what is really there rather than to what we intended to send.
//
// FAIL-SAFE BY SEQUENCING: `commit` is the ONLY writer of `synced` / `pushed_sha`, and it
// runs AFTER the write returns. A failed push means commit never runs, so a stub can never
// claim it synced. Structural, not disciplinary.
//
// FETCH-BEFORE-PATCH IS ENFORCED: `patch-ops` requires --fetched and refuses to run
// without it. Anchors taken from the local file DO NOT MATCH what the tool stores and,
// because patches are atomic, one stale anchor aborts the entire save.
//
// Usage:
//   node scripts/pm-push.js prepare   --page <path> [--json]
//   node scripts/pm-push.js patch-ops --page <path> --fetched <file> [--desired <file>]
//        --desired is REQUIRED once a page has been stubbed by a previous push: the local
//        body is a stub by then, so re-rendering it would push the stub over the real one.
//   node scripts/pm-push.js commit    --page <path> --doc-id <id> --url <url>
//                                      --stored <file> [--material]
//   node scripts/pm-push.js verify    --page <path> --fetched <file>
//
// Exit codes: 0 = ok · 1 = drift detected (verify) · 2 = usage / IO / unresolvable route ·
//             3 = em dash in the rendered body (house style, see assertNoEmDash).
//
// Zero external deps: Node built-ins only (matches the rest of scripts/).

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const INSTANCE = path.resolve(__dirname, '..');
const INDEX = path.join(INSTANCE, 'index.md');
const LOG = path.join(INSTANCE, 'log.md');
const TOOLS = path.join(INSTANCE, 'config', 'tools.md');

// ---- small utils --------------------------------------------------------------------

const today = () => new Date().toISOString().slice(0, 10);
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const rel = (p) => path.relative(INSTANCE, p).replace(/\\/g, '/');
const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const tidy = (s) => String(s).replace(/\s+/g, ' ').trim();
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const logOp = (type) => (['prd', 'decision', 'council', 'strategy'].includes(type) ? type : 'file');

function die(msg) {
  console.error(`pm-push: ${msg}`);
  process.exit(2);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

// Extract the single fenced json block from a markdown file. The same trick
// scripts/project-contract.js uses, so config and routing stay human-readable in place.
function fencedJson(file, what) {
  if (!fs.existsSync(file)) die(`${what} not found at ${rel(file)}`);
  const m = fs.readFileSync(file, 'utf8').match(/```json\s*([\s\S]*?)```/);
  if (!m) die(`no fenced json block in ${rel(file)}`);
  try { return JSON.parse(m[1]); } catch (e) { die(`${what} JSON did not parse. ${e.message}`); }
}

// ---- adapter resolution ---------------------------------------------------------------

function loadAdapter() {
  const cfg = fencedJson(TOOLS, 'config/tools.md');
  const name = cfg.pm_tool;
  if (!name) die('config/tools.md names no `pm_tool`. Run /onboard, or add one.');

  const file = path.join(__dirname, 'adapters', 'pm', `${name}.js`);
  if (!fs.existsSync(file)) {
    die(`no PM adapter for "${name}" at ${rel(file)}.\n` +
        '  Either the name is wrong, or this tool has no adapter yet. See\n' +
        '  os-core/schema/adapters.md for how to register one. Never improvise a push.');
  }
  const adapter = require(file);
  adapter.config = cfg.pm_config || {};
  return adapter;
}

// Derived from config/businesses.md, not hardcoded: scripts/ ships in the shareable
// bundle, so a business name baked in here would be an ARC-4 leak.
function businessName() {
  const reg = path.join(INSTANCE, 'config', 'businesses.md');
  if (!fs.existsSync(reg)) return 'the';
  // Accepts em dash, en dash, hyphen or colon as the slug/name separator: config/ is not
  // authored content, so it is exempt from the no-em-dash house style and may use either.
  const m = fs.readFileSync(reg, 'utf8').match(/^\s*[-*]\s*`?[a-z0-9-]+`?\s*[—–:-]\s*([^;]+)/m);
  const name = m && m[1].trim();
  return name && !/^<.*>$/.test(name) ? name : 'the';
}

const osHeader = () => `> Authored by the ${businessName()} OS. Edit in the OS, not here.`;

// ---- frontmatter (same YAML subset scripts/command-center.js reads) -------------------

function splitFrontmatter(text) {
  if (!text.startsWith('---')) return { fm: {}, fmRaw: '', body: text };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { fm: {}, fmRaw: '', body: text };
  const fmRaw = text.slice(4, end);
  const body = text.slice(end + 4).replace(/^\r?\n/, '');
  return { fm: parseYaml(fmRaw), fmRaw, body };
}

// Deliberately a SUBSET: scalars, `key: >`-folded blocks, and `- ` lists. Enough for the
// page schema (operating-contract §3.1) and nothing more. We never round-trip YAML here,
// we only read it, so a full parser would be dead weight.
function parseYaml(raw) {
  const out = {};
  const lines = raw.split(/\r?\n/);
  let key = null;
  let mode = null; // 'list' | 'fold'
  for (const line of lines) {
    if (!line.trim()) continue;
    const top = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (top && !line.startsWith(' ') && !line.startsWith('\t')) {
      key = top[1];
      const val = top[2].trim();
      if (val === '') { out[key] = []; mode = 'list'; }
      else if (val === '>' || val === '|' || val === '>-' || val === '|-') { out[key] = ''; mode = 'fold'; }
      else { out[key] = stripQuotes(val); mode = null; }
      continue;
    }
    if (!key) continue;
    if (mode === 'fold') {
      out[key] = (out[key] ? out[key] + ' ' : '') + line.trim();
    } else if (mode === 'list') {
      const item = line.match(/^\s*-\s+(.*)$/);
      if (item) (out[key] = out[key] || []).push(stripQuotes(item[1].trim()));
    }
  }
  return out;
}

function stripQuotes(v) {
  const s = String(v).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    return inner ? inner.split(',').map((x) => stripQuotes(x)) : [];
  }
  return s;
}

// ---- routing --------------------------------------------------------------------------

function loadRouting(adapter) {
  return fencedJson(path.join(INSTANCE, adapter.meta.routingFile), 'routing table');
}

// GENERIC policy, tool-specific shape. The lookup and the council-inheritance rule are the
// same for every PM tool; what a route entry MEANS is the adapter's business.
//
// A council carries no route of its own: it inherits the container of the PRD it reviewed.
// Everything else needs an explicit entry.
function resolveRoute(adapter, pageRel, fm, routing) {
  const routes = routing.routes || {};
  const direct = routes[pageRel.replace(/\\/g, '/')];
  if (direct) return finish(adapter, direct, routing);

  if (fm.type === 'council') {
    for (const reviewed of asList(fm.reviewed)) {
      const target = path.posix.normalize(
        path.posix.join(path.posix.dirname(pageRel.replace(/\\/g, '/')), reviewed));
      const inherited = routes[target];
      if (inherited) return finish(adapter, { ...inherited, via: target }, routing);
    }
  }
  return null;
}

function finish(adapter, route, routing) {
  const d = adapter.decorate(route, routing);
  if (d && d.kind === 'error') die(d.message);
  return d;
}

// ---- body rendering: body = f(local page) ---------------------------------------------

// The pushed body is DERIVED, never hand-authored. That is what makes the byte-identical
// summary-paragraph contract automatic rather than something each skill has to remember,
// and it means a skill cannot push a body that disagrees with its own stub.
function renderBody(adapter, fm, localBody, fmRaw) {
  const parts = [osHeader(), ''];

  const banner = statusBanner(fm);
  if (banner) parts.push(banner, '');

  const body = stripSourcesFooter(localBody).trim();

  // A decision's rationale and rejected alternatives live in FRONTMATTER (schema §3.3),
  // which we strip, so they must be re-rendered as sections or the pushed document loses
  // "the whole point of a decision record". Order matches
  // os-core/templates/pm-decision-doc.md: Summary -> Rationale -> Alternatives -> Detail.
  if (fm.type === 'decision') {
    const { summary, rest } = splitSummary(body);
    const sections = [];

    if (fm.rationale) sections.push('## Rationale', '', String(fm.rationale).trim(), '');

    const alts = parseAlternatives(fmRaw);
    if (alts.length) {
      sections.push('## Alternatives rejected', '');
      for (const a of alts) sections.push(`- **${a.option}**: ${a.why_not}`);
    }

    parts.push(summary || '', '', sections.join('\n'), '', dewrap(rest));
  } else {
    parts.push(dewrap(body));
  }

  parts.push('', metadataFooter(fm));
  let out = parts.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';

  // Adapter gets the last word, for tool-specific rendering quirks only.
  if (typeof adapter.render === 'function') out = adapter.render(fm, out);

  assertNoEmDash(out, fm.__pageRel);
  return out;
}

// The advisory half of the em-dash check, for a body the OS did not author from scratch.
// Same signal, no refusal. See the --desired call sites for why.
function warnEmDash(text, pageRel) {
  const hits = text.split('\n').filter((l) => l.includes('—')).length;
  if (!hits) return;
  console.error(
    `pm-push: note. ${hits} line(s) in the --desired body contain an em dash.\n` +
    `  Not blocking: this body is largely pre-existing content from ${pageRel}'s document.\n` +
    '  Fix any line YOU wrote.');
}

// House style: no em dashes in authored content, ever. Enforced here rather than left as
// prose because a style rule that only lives in a document does not survive context
// pressure: it is exactly the class of thing a model does unreliably, which is the same
// reasoning that put hashing and stub-writing in this script instead of in the skills.
//
// Checked on the RENDERED body, so it also catches text arriving from frontmatter
// (a decision's `rationale` and `alternatives_rejected`), not just the markdown body.
// U+2014 only. En dashes are left alone because they are legitimate in numeric ranges.
function assertNoEmDash(text, pageRel) {
  const hits = [];
  text.split('\n').forEach((line, i) => {
    if (line.includes('—')) hits.push({ n: i + 1, line });
  });
  if (!hits.length) return;

  console.error(
    `pm-push: EM DASH. Refusing to push ${pageRel || '(page)'}.\n` +
    `House style forbids em dashes in authored content. Replace each one with a period\n` +
    `(split the sentence, usually the best fix), a comma (subordinate clause), or\n` +
    `parentheses (a true aside). Fix the LOCAL page, then re-run.\n`);
  for (const h of hits) {
    console.error(`  line ${h.n}: ${h.line.trim()}`);
    console.error(`  ${' '.repeat(String(h.n).length + 7)}${' '.repeat(Math.max(0, h.line.trim().indexOf('—')))}^`);
  }
  console.error(`\n${hits.length} line(s) to fix.`);
  process.exit(3);
}

// `alternatives_rejected` is a list of {option, why_not}, the one nested structure in the
// page schema. Parsed here rather than in parseYaml() so the general reader stays a flat
// subset; this shape is fixed by the contract, so a purpose-built reader is safer than a
// half-built YAML engine.
function parseAlternatives(fmRaw) {
  if (!fmRaw) return [];

  // Line-based, not a regex block capture: with the `m` flag `$` means end-of-LINE, so a
  // lazy `[\s\S]*?` block match silently truncates at the first newline. Walk the lines.
  const all = fmRaw.split(/\r?\n/);
  const start = all.findIndex((l) => /^alternatives_rejected:\s*$/.test(l));
  if (start === -1) return [];
  const lines = [];
  for (let i = start + 1; i < all.length; i++) {
    if (/^[A-Za-z_][\w-]*:/.test(all[i])) break; // next top-level key
    lines.push(all[i]);
  }

  const out = [];
  let cur = null;
  let field = null;
  for (const line of lines) {
    if (!line.trim()) continue;
    const item = line.match(/^\s*-\s+option:\s*(.*)$/);
    if (item) {
      if (cur) out.push(cur);
      cur = { option: item[1].trim().replace(/^[>|]-?\s*/, ''), why_not: '' };
      field = 'option';
      continue;
    }
    if (!cur) continue;
    const why = line.match(/^\s*why_not:\s*(.*)$/);
    if (why) {
      cur.why_not = why[1].trim().replace(/^[>|]-?\s*/, '');
      field = 'why_not';
      continue;
    }
    cur[field] = `${cur[field]} ${line.trim()}`.trim(); // continuation of a folded scalar
  }
  if (cur) out.push(cur);
  return out.map((a) => ({ option: tidy(a.option), why_not: tidy(a.why_not) }));
}

function statusBanner(fm) {
  if (fm.status === 'superseded') {
    return `**⚠ SUPERSEDED${fm.superseded_by ? ` by ${fm.superseded_by}` : ''}.**`;
  }
  if (fm.status === 'retracted') {
    const why = fm.retracted_reason ? `: ${fm.retracted_reason}` : '';
    return `**⚠ RETRACTED${why}.**`;
  }
  return null;
}

// The local `## Sources` footer points at raw/ paths that mean nothing to a reader in the
// PM tool; provenance travels in the Metadata footer's `Local record:` line instead.
function stripSourcesFooter(body) {
  const i = body.search(/^## Sources\s*$/m);
  return i === -1 ? body : body.slice(0, i);
}

// Replaces the stripped frontmatter for a human reading in the PM tool. A FOOTER, not a
// header: the summary earns the first ten seconds.
function metadataFooter(fm) {
  const rows = [];
  const add = (label, val) => { if (val) rows.push(`- ${label}: ${val}`); };

  if (fm.status && fm.status !== 'current') add('Status', fm.status);
  add('Discipline', fm.discipline);
  add('Stage', fm.stage);
  add('Verdict', fm.verdict);
  if (fm.created || fm.updated) {
    add('Dates', [fm.created && `Created: ${fm.created}`, fm.updated && `Updated: ${fm.updated}`]
      .filter(Boolean).join(' · '));
  }
  add('Review', fm.review);
  const supersedes = asList(fm.supersedes);
  if (supersedes.length) add('Supersedes', supersedes.join(', '));
  add('Superseded by', fm.superseded_by && fm.superseded_by !== 'null' ? fm.superseded_by : null);
  const reviewed = asList(fm.reviewed);
  if (reviewed.length) add('Reviewed', reviewed.map((r) => path.basename(r, '.md')).join(', '));
  add('Personas', asList(fm.personas).join(', '));
  add('Local record', `\`${fm.__pageRel}\``);

  return ['## Metadata', '', ...rows].join('\n');
}

// The summary paragraph must be byte-identical local vs pushed, the single rule that lets
// /ask answer the common case with zero PM-tool calls. DEWRAPPED (see dewrap() below) so
// that identity holds in both places even though the source `.md` is hard-wrapped: when
// renderStub() writes this back to the local file, both copies end up matching.
function summaryParagraph(body) {
  return splitSummary(body).summary;
}

// Shared by renderBody (needs summary + rest) and summaryParagraph (needs summary only).
// `rest` is returned RAW: callers dewrap it themselves, since renderStub never needs it.
// `**TL;DR.**` is the current label (pm-content-standard). `**Summary.**` is accepted as a
// legacy alias so pages written before the rename keep working. The LABEL travels with the
// paragraph either way, which is what keeps local and pushed byte-identical: writing one
// label locally and a different one in the pushed copy would break the contract at the
// first character.
function splitSummary(body) {
  const m = body.match(/\*\*(?:TL;DR|Summary)\.\*\*[\s\S]*?(?=\n\s*\n)/);
  if (!m) return { summary: null, rest: body };
  return { summary: dewrap(m[0].trim()), rest: body.slice(m.index + m[0].length).trim() };
}

// Collapse HARD-WRAPPED prose (single newlines at ~80 cols, this repo's editing
// convention, good for diffs) into flowing paragraphs before anything is pushed. PM-tool
// editors tend to render a bare `\n` as a visible line break rather than folding it into
// the paragraph the way CommonMark-to-HTML normally would, so hard-wrapped source text
// arrives looking broken mid-sentence. Structural lines (headings, list items, table rows,
// blockquotes, code fences) are left exactly as written; a WRAPPED list item's indented
// continuation lines are joined into it (still one item), but list items are never joined
// to each other. Frontmatter-derived text (rationale, alternatives) doesn't need this: the
// YAML `>` fold already joins those lines during parsing.
function dewrap(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let inFence = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line.trim())) { inFence = !inFence; out.push(line); i++; continue; }
    if (inFence || line.trim() === '') { out.push(line); i++; continue; }

    if (isStructuralLine(line)) {
      let joined = line;
      let j = i + 1;
      while (j < lines.length && isIndentedContinuation(lines[j])) {
        joined += ` ${lines[j].trim()}`;
        j++;
      }
      out.push(joined);
      i = j;
      continue;
    }

    // Prose: absorb consecutive plain lines into one, until blank or a structural line.
    let joined = line.trim();
    let j = i + 1;
    while (j < lines.length && lines[j].trim() !== '' && !isStructuralLine(lines[j])) {
      joined += ` ${lines[j].trim()}`;
      j++;
    }
    out.push(joined);
    i = j;
  }
  return out.join('\n');
}

function isStructuralLine(line) {
  const t = line.trim();
  return /^#{1,6}\s/.test(t) || /^[-*]\s/.test(t) || /^\d+\.\s/.test(t)
      || /^>/.test(t) || /^\|/.test(t) || /^```/.test(t);
}

function isIndentedContinuation(line) {
  return line.trim() !== '' && !isStructuralLine(line) && /^\s/.test(line);
}

// The LOCAL summary-stub a pushed page is reduced to ("thin-plus"). Keeps: the summary
// paragraph (byte-identical to what's pushed), the `## Sources` footer (original evidence
// per contract §3.1, still cited regardless of where the body now lives), and, decisions
// only, a one-line digest of what was rejected, since that's "the whole point of a decision
// record" (§3.3) and the one thing a bare summary can't carry. Drops everything else:
// `## Detail`, `## Rationale`, per-persona critique, requirements. That's now the PM tool's
// job, backed by the raw/ snapshot (INT-3).
function renderStub(adapter, fm, localBody, fmRaw, url) {
  const parts = [];
  const summary = summaryParagraph(localBody);
  if (summary) parts.push(summary);

  if (fm.type === 'decision') {
    const alts = parseAlternatives(fmRaw);
    if (alts.length) {
      // Truncate BOTH sides. Real options are often full sentences, and a digest line that
      // repeats them in full stops being a digest. Full text is one click away.
      const digest = alts
        .map((a) => `**${shortWhy(a.option, 8)}** (${shortWhy(a.why_not, 14)})`)
        .join(', ');
      parts.push(`Rejected: ${digest}.`);
    }
  }

  const sources = extractSection(localBody, 'Sources');
  if (sources) parts.push(sources);

  parts.push([`## ${adapter.meta.label} record`, '', `Full body: [${fm.title}](${url}).`].join('\n'));

  return parts.join('\n\n').trim() + '\n';
}

// First clause, truncated to `maxWords`: enough to place the point, not restate it.
function shortWhy(text, maxWords) {
  const clause = tidy(text).split(/[.;]/)[0];
  const words = clause.split(/\s+/);
  return words.length <= maxWords ? clause : `${words.slice(0, maxWords).join(' ')}…`;
}

// Pull one `## <name>` section (heading + body) verbatim out of a page body, or null.
function extractSection(body, name) {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => new RegExp(`^##\\s+${name}\\s*$`, 'i').test(l));
  if (start === -1) return null;
  const out = [lines[start]];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join('\n').trim();
}

// Has this page already been reduced to a summary-stub by a previous `commit`? The stub's
// signature is the trailing `## <Tool> record` section renderStub() always writes, which no
// hand-authored page has.
function isStub(adapter, body) {
  return new RegExp(`^##\\s+${adapter.meta.label}\\s+record\\s*$`, 'im').test(body || '');
}

// Replace the body (everything after the closing `---`), preserving frontmatter exactly.
function updateBody(page, newBody) {
  const text = fs.readFileSync(page.abs, 'utf8');
  const end = text.indexOf('\n---', 3);
  const fmBlock = text.slice(0, end + 4);
  fs.writeFileSync(page.abs, `${fmBlock}\n\n${newBody.trim()}\n`, 'utf8');
}

// ---- page loading ---------------------------------------------------------------------

function loadPage(pageArg) {
  if (!pageArg || pageArg === true) die('--page <path> is required');
  const abs = path.resolve(INSTANCE, pageArg);
  if (!fs.existsSync(abs)) die(`page not found: ${pageArg}`);
  const pageRel = path.relative(INSTANCE, abs).replace(/\\/g, '/');
  const raw = fs.readFileSync(abs, 'utf8');
  const { fm, fmRaw, body } = splitFrontmatter(raw);
  if (!fm.id) die(`page has no frontmatter id: ${pageRel}`);
  fm.__pageRel = pageRel;
  return { abs, pageRel, raw, fm, fmRaw, body };
}

// ---- commands -------------------------------------------------------------------------

function cmdPrepare(args) {
  const adapter = loadAdapter();
  const page = loadPage(args.page);
  const route = resolveRoute(adapter, page.pageRel, page.fm, loadRouting(adapter));

  if (!route) {
    console.error(
      `pm-push: UNMAPPED. no route for ${page.pageRel}.\n` +
      `The skill must ASK the user where this belongs, then add one line to\n` +
      `${adapter.meta.routingFile}. Never guess a destination.`);
    process.exit(2);
  }
  if (route.kind === 'local-only') {
    console.error(`pm-push: LOCAL-ONLY. ${page.pageRel} is deliberately not pushed.\n` +
                  `Reason: ${route.reason}`);
    process.exit(2);
  }

  const body = renderBody(adapter, page.fm, page.body, page.fmRaw);
  const title = adapter.documentTitle(page.fm);
  const existingId = page.fm.pm_doc_id || null;

  if (args.json) {
    console.log(JSON.stringify({
      tool: adapter.meta.name, delegated: Boolean(adapter.meta.delegated),
      page: page.pageRel, title, destination: route,
      alreadyPushed: Boolean(existingId), pm_doc_id: existingId,
      instruction: adapter.pushInstruction
        ? adapter.pushInstruction({ title, body, destination: route, existingId })
        : null,
      bodySha: sha256(body), body,
    }, null, 2));
    return;
  }

  console.log(`tool        : ${adapter.meta.label}${adapter.meta.delegated ? ' (delegated: the MODEL makes the call)' : ''}`);
  console.log(`page        : ${page.pageRel}  (type: ${page.fm.type}, status: ${page.fm.status})`);
  console.log(`title       : ${title}`);
  console.log(`destination : ${route.containerKind} "${route.name}"${route.via ? `  (inherited via ${route.via})` : ''}`);
  console.log(`             id ${route.id}`);
  console.log(existingId
    ? `mode        : UPDATE (pm_doc_id ${existingId}). Fetch the live document FIRST, then patch-ops`
    : `mode        : CREATE (no pm_doc_id yet). Push the full body`);
  console.log(`body sha    : ${sha256(body)}`);
  console.log(`\n--- BODY (${body.split('\n').length} lines) ---\n`);
  console.log(body);
}

// For a DIRECT adapter (one whose tool a script can actually reach, e.g. GitHub via `gh`),
// this performs the write and writes the stored body to a file so `commit` can hash it.
// A delegated adapter (Linear) refuses here: the model has to make the call itself.
function cmdPush(args) {
  const adapter = loadAdapter();
  if (adapter.meta.delegated) {
    die(`"${adapter.meta.name}" is a DELEGATED adapter: a script cannot call its tool.\n` +
        '  Run `prepare --json` and make the call yourself using the `instruction` block,\n' +
        '  per os-core/patterns/pm-push.md.');
  }
  if (!args.out || args.out === true) die('--out <file> is required: where to write the stored body');

  const page = loadPage(args.page);
  const route = resolveRoute(adapter, page.pageRel, page.fm, loadRouting(adapter));
  if (!route) die(`UNMAPPED: no route for ${page.pageRel}. Ask the user; never guess.`);
  if (route.kind === 'local-only') die(`LOCAL-ONLY: ${page.pageRel} is deliberately not pushed.`);

  const existingId = page.fm.pm_doc_id || null;

  // Same rule as the delegated path: once a page is stubbed its local body is no longer
  // the document, so re-rendering it would push the stub over the real body.
  let body;
  if (args.desired && args.desired !== true) {
    const p = path.resolve(INSTANCE, args.desired);
    if (!fs.existsSync(p)) die(`desired-body file not found: ${args.desired}`);
    body = fs.readFileSync(p, 'utf8');
    warnEmDash(body, page.pageRel);   // advisory on a --desired body; see cmdPatchOps
  } else if (existingId && isStub(adapter, page.body)) {
    die(`STUBBED PAGE. ${page.pageRel} was already pushed and reduced to a stub, so its\n` +
        '  local body is no longer the full document. Build the new body from the live\n' +
        '  document plus your change and pass it as --desired <file>.');
  } else {
    body = renderBody(adapter, page.fm, page.body, page.fmRaw);
  }

  const title = adapter.documentTitle(page.fm);
  let res;
  try {
    res = adapter.push({ title, body, destination: route, existingId, config: adapter.config });
  } catch (e) {
    die(`push failed: ${e.message}\n  Nothing was committed, so the stub still reads as un-synced.`);
  }

  fs.writeFileSync(path.resolve(INSTANCE, args.out), res.storedBody, 'utf8');
  console.log(JSON.stringify({
    ok: true, tool: adapter.meta.name, mode: existingId ? 'update' : 'create',
    id: res.id, url: res.url, storedBody: args.out, storedSha: sha256(res.storedBody),
    next: `node scripts/pm-push.js commit --page ${page.pageRel} --doc-id ${res.id} ` +
          `--url ${res.url} --stored ${args.out} [--material]`,
  }, null, 2));
}

function cmdPatchOps(args) {
  const adapter = loadAdapter();
  if (adapter.patchRequiresFetch !== false && (!args.fetched || args.fetched === true)) {
    console.error(
      'pm-push: --fetched <file> is REQUIRED.\n' +
      'Patch anchors must come from a fresh read of the LIVE document, never from the\n' +
      'local file: the PM tool silently rewrites what you push, so local text does not\n' +
      'match, and patches are atomic. One stale anchor aborts the whole save. Fetch the\n' +
      'document, write its content to a file, then re-run.');
    process.exit(2);
  }
  const page = loadPage(args.page);
  const fetchedPath = path.resolve(INSTANCE, args.fetched);
  if (!fs.existsSync(fetchedPath)) die(`fetched file not found: ${args.fetched}`);

  const fetched = fs.readFileSync(fetchedPath, 'utf8');

  // WHERE THE DESIRED BODY COMES FROM, and why this guard exists.
  //
  // Before the first push, the local page holds the full body, so re-rendering it is
  // correct. AFTER a push, `commit` has reduced that page to a summary-stub: the full body
  // now lives in the PM tool and in raw/. Re-rendering the stub therefore produces a body
  // that is missing every dropped section, and pushing it would OVERWRITE the real document
  // with its own stub. Silently. On the first update of every migrated page.
  //
  // So on an already-stubbed page the script refuses to guess and requires --desired: the
  // full intended body, which the skill builds from the FETCHED document plus whatever it
  // means to change (a Results section appended by /harvest, a verdict by /council, a
  // tightened summary by /curate). That is judgment, which belongs to the skill; merging
  // is not something this script can do correctly on its own.
  let desired;
  if (args.desired && args.desired !== true) {
    const desiredPath = path.resolve(INSTANCE, args.desired);
    if (!fs.existsSync(desiredPath)) die(`desired-body file not found: ${args.desired}`);
    desired = fs.readFileSync(desiredPath, 'utf8');
    // WARN, don't refuse. A --desired body is mostly text FETCHED BACK from the PM tool
    // plus a small change, so it carries whatever prose is already published, including
    // anything written before the no-em-dash house style applied. Refusing here would make
    // the update path unusable on legacy documents: you could not append a Results section
    // without first rewriting published prose. The gate exists to stop the OS AUTHORING new
    // em dashes, which renderBody still enforces strictly on the paths that author.
    warnEmDash(desired, page.pageRel);
  } else if (isStub(adapter, page.body)) {
    console.error(
      `pm-push: STUBBED PAGE. ${page.pageRel} was already pushed and reduced to a stub,\n` +
      'so its local body is no longer the full document. Re-rendering it here would push\n' +
      'the stub OVER the real body in ' + adapter.meta.label + ' and destroy it.\n\n' +
      'Build the new body from the FETCHED document plus your change, write it to a file,\n' +
      'and pass it as --desired <file>. The full previous body is also in raw/ if you need\n' +
      'to reconstruct it.');
    process.exit(2);
  } else {
    desired = renderBody(adapter, page.fm, page.body, page.fmRaw);
  }

  // Compare with the ADAPTER's normalizer, not the plain one: the tool rewrites markdown as
  // it stores it, so a page that has not changed at all still differs byte-for-byte from
  // what came back. Using the plain comparison here reports a change every time and falls
  // through to a wholesale replace, which is precisely the phantom-edit churn that patching
  // exists to avoid.
  const norm = typeof adapter.normalizeStored === 'function'
    ? adapter.normalizeStored : normalize;

  if (norm(fetched) === norm(desired)) {
    console.log(JSON.stringify({ upToDate: true, ops: [] }, null, 2));
    return;
  }

  // SECTION-LEVEL ops, anchored on the CURRENT content.
  //
  // A whole-body replace would be simpler and equally safe, but it is functionally
  // identical to sending full `content`: the tool's document history would show one giant
  // change every time, which defeats the entire reason for patching. So we diff per `##`
  // section and emit one op per changed section. Anchors still come from the fetched body,
  // so they match by construction; patches remain atomic, so a bad anchor aborts cleanly
  // rather than half-applying.
  const ops = sectionOps(adapter, fetched, desired);

  // Fallback: if the section structure itself changed so much that we cannot express it
  // safely, replace wholesale rather than emit ops we can't guarantee.
  if (!ops.length) {
    ops.push({ op: 'replace', old_string: fetched.trim(), new_string: desired.trim() });
  }
  console.log(JSON.stringify({ upToDate: false, ops }, null, 2));
}

// Split on `## ` headings; the text before the first heading is the "" (preamble) section.
function sections(text) {
  const out = [];
  let name = '';
  let buf = [];
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const h = line.match(/^##\s+(.*)$/);
    if (h) {
      out.push({ name, text: buf.join('\n').trim() });
      name = h[1].trim();
      buf = [line];
    } else buf.push(line);
  }
  out.push({ name, text: buf.join('\n').trim() });
  return out.filter((s) => s.text);
}

function sectionOps(adapter, fetched, desired) {
  const a = sections(fetched);
  const b = sections(desired);
  const aByName = new Map(a.map((s) => [s.name, s]));
  const bByName = new Map(b.map((s) => [s.name, s]));

  // Structural change (a section added or removed): the ordering rules get fiddly and a
  // wrong guess aborts the whole save, so hand back to the wholesale path.
  if (a.length !== b.length || a.some((s) => !bByName.has(s.name))) return [];

  // Compare NORMALIZED, but patch with the raw texts: the anchor must match the tool's
  // stored bytes exactly, while the decision "did this actually change?" must ignore the
  // tool's own rewrites. Otherwise every push re-asserts formatting the tool immediately
  // rewrites back, and the document history fills with phantom edits.
  const norm = typeof adapter.normalizeStored === 'function'
    ? adapter.normalizeStored : normalize;

  const ops = [];
  for (const s of b) {
    const before = aByName.get(s.name);
    if (before && norm(before.text) !== norm(s.text)) {
      ops.push({ op: 'replace', old_string: before.text, new_string: s.text });
    }
  }
  return ops;
}

const normalize = (s) => String(s).replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();

function cmdCommit(args) {
  const adapter = loadAdapter();
  for (const req of ['doc-id', 'url', 'stored']) {
    if (!args[req] || args[req] === true) {
      die(req === 'stored'
        ? '--stored <file> is required: the body as READ BACK from the PM tool after the\n' +
          '  push. Hashing what we SENT gives a false drift on every document, because PM\n' +
          '  tools rewrite markdown as they store it.'
        : `--${req} is required for commit`);
    }
  }
  const page = loadPage(args.page);
  const bodyPath = path.resolve(INSTANCE, args.stored);
  if (!fs.existsSync(bodyPath)) die(`stored-body file not found: ${args.stored}`);
  const pushedBody = fs.readFileSync(bodyPath, 'utf8');

  const route = resolveRoute(adapter, page.pageRel, page.fm, loadRouting(adapter));
  if (!route || route.kind === 'local-only') die('cannot commit a page with no resolvable route');

  const written = [];
  const snapMeta = adapter.meta.snapshot || { originType: 'pm-tool', fetchedVia: adapter.meta.name };

  // 1. raw/ snapshot, material change only. INT-3: the citation chain must resolve locally
  //    even if the PM tool vanishes.
  if (args.material) {
    const snap = path.join(INSTANCE, 'raw', `${today()}-${adapter.meta.name}-doc-${slug(page.fm.id)}.md`);
    if (!fs.existsSync(snap)) {
      fs.writeFileSync(snap, [
        '---',
        `id: raw-${today()}-${adapter.meta.name}-doc-${slug(page.fm.id)}`,
        `captured: ${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}`,
        `origin: ${args.url}`,
        `origin_type: ${snapMeta.originType}`,
        `fetched_via: ${snapMeta.fetchedVia}`,
        `sha: ${sha256(pushedBody)}`,
        'provenance: derived',
        `note: snapshot of the body ${adapter.meta.label} STORES for ${page.pageRel} (read back after push)`,
        '---',
        pushedBody.trimEnd(),
        '',
      ].join('\n'), 'utf8');
      written.push(rel(snap));
    }
  }

  // 2. stub frontmatter: the bookkeeping the PM tool has no model for.
  updateFrontmatter(page, {
    pm_tool: adapter.meta.name,
    pm_team: route.containerKind === 'team' ? route.name : route.teamName,
    pm_container: route.containerKind === 'team' ? 'null' : route.name,
    pm_doc_id: args['doc-id'],
    pm_url: args.url,
    synced: today(),
    pushed_sha: sha256(pushedBody),
  });

  // 2b. Reduce the local BODY to a summary-stub. Without this a "push" leaves the full body
  // sitting in BOTH places, defeating the entire point (cheap local recall, one place to
  // edit). Idempotent by construction: it only ever extracts Summary + Sources + (for a
  // decision) the rejected-alternatives digest, so re-running on an already-stubbed page is
  // a no-op.
  if (['decision', 'prd', 'council'].includes(page.fm.type)) {
    updateBody(page, renderStub(adapter, page.fm, page.body, page.fmRaw, args.url));
  }
  written.push(page.pageRel);

  // 3. index.md: append the document link to this page's line, if it has one.
  if (touchIndex(adapter, page, args.url)) written.push('index.md');

  // 4. log.md
  fs.appendFileSync(LOG,
    `## [${today()}] ${logOp(page.fm.type)} | ${page.fm.id} pushed to ${adapter.meta.label} ` +
    `(${route.containerKind}: ${route.name})\n`, 'utf8');
  written.push('log.md');

  console.log(`pm-push: committed ${page.pageRel}`);
  console.log(`  tool     : ${adapter.meta.label}`);
  console.log(`  doc      : ${args['doc-id']}`);
  console.log(`  sha      : ${sha256(pushedBody)}`);
  console.log(`  snapshot : ${args.material ? 'yes (material change)' : 'no (trivial patch)'}`);
  console.log(`  written  : ${written.join(', ')}`);
}

// Rewrite only the keys we own, in place, preserving everything else byte-for-byte.
function updateFrontmatter(page, fields) {
  const text = fs.readFileSync(page.abs, 'utf8');
  const end = text.indexOf('\n---', 3);
  let fmRaw = text.slice(4, end);
  const rest = text.slice(end + 4);

  for (const [k, v] of Object.entries(fields)) {
    const line = `${k}: ${v}`;
    const re = new RegExp(`^${k}:.*$`, 'm');
    if (re.test(fmRaw)) fmRaw = fmRaw.replace(re, line);
    else fmRaw = fmRaw.replace(/\n?$/, `\n${line}`);
  }
  fs.writeFileSync(page.abs, `---\n${fmRaw.replace(/\n+$/, '')}\n---${rest}`, 'utf8');
}

function touchIndex(adapter, page, url) {
  if (!fs.existsSync(INDEX)) return false;
  const marker = `· [${adapter.meta.label}](`;
  const text = fs.readFileSync(INDEX, 'utf8');
  const lines = text.split(/\r?\n/);
  let hit = false;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes(`(${page.pageRel})`)) continue;
    if (lines[i].includes(marker)) { hit = true; break; } // already linked
    lines[i] = `${lines[i].replace(/\s*$/, '')} ${marker}${url})`;
    hit = true;
    break;
  }
  if (hit) fs.writeFileSync(INDEX, lines.join('\n'), 'utf8');
  return hit;
}

// Drift detection for /lint. A PM tool's own `updatedAt` is not reliable enough to trust
// (Linear's did not move across two confirmed content edits), so we compare a content hash.
function cmdVerify(args) {
  const adapter = loadAdapter();
  if (!args.fetched || args.fetched === true) die('--fetched <file> is required for verify');
  const page = loadPage(args.page);
  const fetchedPath = path.resolve(INSTANCE, args.fetched);
  if (!fs.existsSync(fetchedPath)) die(`fetched file not found: ${args.fetched}`);

  const fetchedSha = sha256(fs.readFileSync(fetchedPath, 'utf8'));
  const stored = page.fm.pushed_sha;

  if (!stored) {
    console.log(`UNKNOWN  ${page.pageRel}. no pushed_sha recorded (never pushed?)`);
    process.exit(1);
  }
  if (fetchedSha === stored) {
    console.log(`OK       ${page.pageRel}. ${adapter.meta.label} matches pushed_sha`);
    return;
  }
  console.log(`DRIFT    ${page.pageRel}`);
  console.log(`  pushed_sha : ${stored}`);
  console.log(`  fetched    : ${fetchedSha}`);
  console.log(`  -> someone edited this document in ${adapter.meta.label}. Local is source of`);
  console.log(`     truth for lifecycle; re-push to restore, or reconcile deliberately.`);
  console.log(`     No auto-fix.`);
  process.exit(1);
}

// ---- main -----------------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const args = parseArgs(argv.slice(1));

  switch (cmd) {
    case 'prepare': return cmdPrepare(args);
    case 'push': return cmdPush(args);
    case 'patch-ops': return cmdPatchOps(args);
    case 'commit': return cmdCommit(args);
    case 'verify': return cmdVerify(args);
    default:
      console.error(
        'pm-push: the deterministic half of an OS -> PM-tool document push.\n' +
        'The active tool comes from config/tools.md; see os-core/schema/adapters.md.\n\n' +
        '  node scripts/pm-push.js prepare       --page <path> [--json]\n' +
        '  node scripts/pm-push.js patch-ops     --page <path> --fetched <file> [--desired <file>]\n' +
        '        --desired is required once a page has been stubbed by a previous push\n' +
        '  node scripts/pm-push.js commit        --page <path> --doc-id <id> --url <url> --stored <file> [--material]\n' +
        '        --stored = the body READ BACK from the PM tool after the push, never what we sent\n' +
        '  node scripts/pm-push.js verify        --page <path> --fetched <file>\n');
      process.exit(2);
  }
}

main();
