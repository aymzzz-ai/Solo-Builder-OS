#!/usr/bin/env node
// command-center — the local, read-only, zero-dependency dashboard over the OS brain.
//
// A browser window onto THIS one instance's markdown store so the operator can SEE where
// things stand at a glance, without an LLM turn. It renders the structural truth the
// skills read; the synthesis stays with /brief.
//
// Information architecture (one question per view):
//   sidebar   — the single navigation surface: views + the store's page tree + filter
//   /         — Today: what changed since you were here, what needs attention, up next
//   /roadmap  — the horizon view (roadmap.md)
//   /queue    — the ranked next actions (queue.md)
//   /page/*   — any store page: badges, TOC, rendered body, walkable chains
//
// Prime directives it obeys (os-core/schema/operating-contract.md, via CLAUDE.md):
//   CAR-1  zero paid deps — Node http/fs/path built-ins only, no install, no build step.
//   CAR-2  local source of truth — reads the markdown DIRECTLY off disk on every request.
//   CAR-6/INT-1  renders frontmatter faithfully; superseded/retracted hidden by default.
//   INT-2  read-only — NO write endpoints, no outward comms, no autonomous action.
//   SAF-1  read-scope guard — serves ONLY the business knowledge tree; anything else → 404.
//   ARC-2  pure Node — runs in any conforming clone.
//
// Run:  node scripts/command-center.js [--port 4317] [--open]
//       binds 127.0.0.1 only · Ctrl-C to stop · pure pull, no daemon.

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const HOST = '127.0.0.1';

// Branding is derived from config/businesses.md, never hardcoded: scripts/ ships in the
// shareable bundle, so a business name baked in here would be an ARC-4 leak.
function businessName() {
  const reg = path.join(ROOT, 'config', 'businesses.md');
  if (!fs.existsSync(reg)) return '';
  // Accepts em dash, en dash, hyphen or colon as the slug/name separator: config/ is not
  // authored content, so it is exempt from the no-em-dash house style and may use either.
  const m = fs.readFileSync(reg, 'utf8').match(/^\s*[-*]\s*`?[a-z0-9-]+`?\s*[—–:-]\s*([^;]+)/m);
  const name = m && m[1].trim();
  return name && !/^<.*>$/.test(name) ? name : '';
}

const BRAND = businessName();

// ---- args --------------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { port: 4317, open: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port') out.port = Number(argv[++i]) || out.port;
    else if (argv[i] === '--open') out.open = true;
  }
  return out;
}

// ---- read-scope guard (SAF-1) ------------------------------------------------------------
// The ONLY paths the server will read/serve — the business knowledge tree from CLAUDE.md §2.
// Everything else in the repo is machinery/history and must 404.

const ALLOWED_FILES = new Set([
  'index.md', 'log.md', 'strategy.md', 'roadmap.md', 'queue.md', 'feedback.md',
]);
const ALLOWED_DIRS = ['wiki', 'decisions', 'council', 'prds', 'raw', 'meta'];

// Resolve a requested store-relative path to an absolute path IF it is inside the knowledge
// tree and is a .md file; otherwise null (caller → 404). Defeats traversal: the resolved
// path must stay under ROOT *and* its first segment must be allow-listed.
function resolveScoped(relRaw) {
  if (!relRaw) return null;
  const rel = decodeURIComponent(relRaw).replace(/\\/g, '/').replace(/^\/+/, '');
  if (!rel.toLowerCase().endsWith('.md')) return null;
  const abs = path.resolve(ROOT, rel);
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return null; // escaped the repo
  const norm = path.relative(ROOT, abs).replace(/\\/g, '/');
  if (norm.startsWith('..')) return null;
  const top = norm.split('/')[0];
  const inScope = norm.includes('/') ? ALLOWED_DIRS.includes(top) : ALLOWED_FILES.has(norm);
  if (!inScope) return null;
  return fs.existsSync(abs) ? abs : null;
}

const readRel = (rel) => {
  try {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
  } catch {
    return '';
  }
};

// ---- generic helpers ---------------------------------------------------------------------

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// heading text → anchor slug (strip markdown/emoji, kebab-case)
const slugify = (s) =>
  plainText(s).toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-') || 'section';
const plainText = (s) =>
  String(s).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_`]/g, '');

// strip markdown for one-line summaries (nav tooltips, log lines)
const plain = (s) =>
  String(s)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();

// a blockquote is a real warning (stays prominent) if it carries ⚠ or a hard directive
const isWarnQuote = (raw) => raw.includes('⚠') || /\*\*do not\b/i.test(raw);

// ---- frontmatter parser (YAML subset — same shape every wiki page uses) ------------------

function splitFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { fm: {}, body: text };
  const fm = {};
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const li = line.match(/^\s+-\s+(.*)$/);
    if (li && key) {
      (Array.isArray(fm[key]) ? fm[key] : (fm[key] = [])).push(li[1].replace(/^["']|["']$/g, '').trim());
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    key = kv[1];
    const v = kv[2].trim();
    if (v === '' || v === '[]' || v === 'null') fm[key] = v === '' ? [] : v === '[]' ? [] : null;
    else if (v.startsWith('[') && v.endsWith(']'))
      fm[key] = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    else fm[key] = v.replace(/^["']|["']$/g, '');
  }
  return { fm, body: text.slice(m[0].length) };
}

const fmList = (v) => (Array.isArray(v) ? v : v ? [v] : []);

// ---- markdown → HTML (block converter for the local dashboard view) ----------------------

// Inline: escape first, then apply links → code → bold → italic on the escaped string.
function inlineHtml(text, ctx) {
  let s = esc(text);
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const a = resolveLink(href, ctx);
    return a ? `<a href="${a.href}"${a.ext ? ' target="_blank" rel="noopener"' : ''}>${label}</a>` : label;
  });
  // store paths inside backticks (e.g. `raw/2026-06-08-clerk-docs.md#L40-72`) become live links
  s = s.replace(/`([^`]+)`/g, (_, c) => {
    const m = c.match(/^((?:raw|wiki|decisions|council|prds|meta)\/[^\s#]+\.md)(#.*)?$/);
    return m ? `<code><a href="/page/${m[1]}">${c}</a></code>` : `<code>${c}</code>`;
  });
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); // bold first (may wrap nested *italic*)
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');  // then any remaining single-* italics
  s = s.replace(/(^|[^A-Za-z0-9_])_([^_]+)_/g, '$1<em>$2</em>');
  return s;
}

// Relative .md links → dashboard routes; http(s) → external; everything else → plain text.
function resolveLink(href, ctx) {
  if (/^https?:\/\//i.test(href)) return { href, ext: true };
  if (/\.md(#.*)?$/i.test(href)) {
    const clean = href.replace(/#.*$/, '');
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(ctx.rel || ''), clean));
    if (target.startsWith('..')) return null; // escapes the store → don't link
    return { href: '/page/' + target, ext: false }; // dead-but-visible if missing (route 404s)
  }
  return null;
}

// Collect a list starting at `start`. `itemRe` matches a (possibly indented) list marker;
// indented non-marker lines fold into the previous item (wrapped continuation). Returns the
// rendered <li>s + the index to resume from.
function collectList(lines, start, itemRe, markerStrip, ctx) {
  const items = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (itemRe.test(line)) { items.push(line.trim().replace(markerStrip, '').trim()); i++; }
    else if (/^\s+\S/.test(line) && items.length) { items[items.length - 1] += ' ' + line.trim(); i++; }
    else break;
  }
  return { html: items.map((b) => `<li>${inlineHtml(b, ctx)}</li>`).join(''), next: i };
}

function mdToHtml(body, ctx) {
  const lines = body.split(/\r?\n/);
  const out = [];
  let i = 0;
  let para = [];
  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inlineHtml(para.join(' '), ctx)}</p>`);
      para = [];
    }
  };
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    if (t === '') { flushPara(); i++; continue; }

    // fenced code
    const fence = t.match(/^```/);
    if (fence) {
      flushPara();
      const buf = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) { buf.push(lines[i]); i++; }
      i++;
      out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }

    // table
    if (/^\|.*\|$/.test(t)) {
      flushPara();
      const rows = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        rows.push(lines[i].trim().split('|').slice(1, -1).map((c) => c.trim()));
        i++;
      }
      const isSep = (r) => r.every((c) => /^:?-{2,}:?$/.test(c));
      let html = '<div class="tablewrap"><table>';
      rows.forEach((r, idx) => {
        if (isSep(r)) return;
        const head = idx === 0;
        const tag = head ? 'th' : 'td';
        html += '<tr>' + r.map((c) => `<${tag}>${inlineHtml(c, ctx)}</${tag}>`).join('') + '</tr>';
      });
      out.push(html + '</table></div>');
      continue;
    }

    // heading (with a stable slug id so chips / TOC can deep-link)
    const h = t.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flushPara(); const n = h[1].length; out.push(`<h${n} id="${slugify(h[2])}">${inlineHtml(h[2], ctx)}</h${n}>`); i++; continue; }

    // blockquote (group consecutive). Two kinds: a real warning (⚠) stays prominent;
    // everything else is OS bookkeeping (provenance/re-rank breadcrumbs) — collapsed
    // into a quiet "OS note" the operator can expand.
    if (/^>\s?/.test(t)) {
      flushPara();
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) { buf.push(lines[i].trim().replace(/^>\s?/, '')); i++; }
      const raw = buf.join(' ');
      if (isWarnQuote(raw)) {
        out.push(`<blockquote class="warn">${inlineHtml(raw, ctx)}</blockquote>`);
      } else {
        const preview = plain(plainText(raw)).replace(/[^\x20-\x7E]/g, '').trim().slice(0, 72);
        out.push(`<details class="osnote"><summary>OS note — <span class="pv">${esc(preview)}…</span></summary><blockquote>${inlineHtml(raw, ctx)}</blockquote></details>`);
      }
      continue;
    }

    // unordered list (fold wrapped continuation lines into their item)
    if (/^[-*]\s+/.test(t)) {
      flushPara();
      const r = collectList(lines, i, /^\s*[-*]\s+/, /^[-*]/, ctx);
      out.push('<ul>' + r.html + '</ul>'); i = r.next; continue;
    }

    // ordered list
    if (/^\d+\.\s+/.test(t)) {
      flushPara();
      const r = collectList(lines, i, /^\s*\d+\.\s+/, /^\d+\./, ctx);
      out.push('<ol>' + r.html + '</ol>'); i = r.next; continue;
    }

    para.push(t);
    i++;
  }
  flushPara();
  return out.join('\n');
}

// ---- structural parsers (index / routines / log / queue) ----------------------------------

function parseIndex(text) {
  const groups = {};
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) { cur = h[1].trim(); groups[cur] = []; continue; }
    const m = line.match(/^-\s+\[([^\]]+)\]\(([^)]+)\)\s*[—-]\s*(.*?)\s*(?:\[(\w+)\])?\s*$/);
    if (m && cur) groups[cur].push({ title: m[1].trim(), path: m[2].trim(), summary: m[3].trim(), status: (m[4] || 'current').trim() });
  }
  return groups;
}

function parseRoutines(text) {
  const today = new Date();
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^-\s+(\S+)\s*\|\s*(\S+)\s*\|\s*last:\s*(\d{4}-\d{2}-\d{2})(.*)$/);
    if (!m) continue;
    const [, name, cadence, last, tail] = m;
    const days = Math.floor((today - new Date(last)) / 86400000);
    const limit = cadence === 'weekly' ? 7 : cadence === 'monthly' ? 30 : Infinity;
    out.push({ name, cadence, last, days, overdue: days > limit, pending: /PENDING/i.test(tail) });
  }
  return out;
}

function parseLog(text, n = 10) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^##\s+\[(\d{4}-\d{2}-\d{2})\]\s+(\w+)\s*\|\s*(\S+)\s+(.+)$/);
    if (m) rows.push({ date: m[1], op: m[2], id: m[3], title: plain(m[4]) });
  }
  return rows.slice(-n).reverse();
}

// Walk the knowledge tree once, parse frontmatter — feeds "needs attention".
function collectPages() {
  const pages = [];
  const walk = (dir) => {
    let entries = [];
    try { entries = fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const rel = dir + '/' + e.name;
      if (e.isDirectory()) walk(rel);
      else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
        const { fm } = splitFrontmatter(readRel(rel));
        pages.push({ rel, fm });
      }
    }
  };
  for (const d of ['wiki', 'decisions', 'council', 'prds']) walk(d);
  return pages;
}

// best-effort: map a log id to a store path via the index
function linkForLogId(id, indexPaths) {
  const bare = id.replace(/^council-/, '');
  for (const p of indexPaths) {
    const base = path.posix.basename(p).replace(/\.md$/, '');
    if (base === id || base === bare || base.startsWith(id) || base.startsWith(bare)) return '/page/' + p;
  }
  return null;
}

// queue.md table → ranked rows (keeps the first store link so rows can deep-link)
function parseQueueRows(text) {
  const rows = [];
  let inTable = false;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) { inTable = false; continue; }
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.some((c) => /^-{3,}$/.test(c))) { inTable = true; continue; }
    if (/^#$/.test(cells[0]) || /action/i.test(cells[1] || '')) continue;
    if (inTable && cells.length >= 6) {
      const lm = cells[1].match(/\[[^\]]+\]\(([^)]+)\)/);
      const target = lm && resolveLink(lm[1], { rel: 'queue.md' });
      rows.push({
        n: cells[0], action: plain(cells[1]),
        imp: plain(cells[2] || ''), eff: plain(cells[3] || ''), conf: plain(cells[4] || ''),
        score: plain(cells[5]), why: plain(cells[6] || ''),
        href: target && !target.ext ? target.href : null,
      });
    }
  }
  return rows;
}

const stripFm = (text) => splitFrontmatter(text).body;

// ---- HTML shell (one global sidebar, one focused view) ------------------------------------

const CSS = `
:root{
  color-scheme:dark;
  --bg:#0e0f12; --panel:#131519; --panel-2:#17191e; --raise:#1c1f26;
  --border:#24262d; --hair:#1b1d23;
  --text:#e5e7ea; --dim:#9b9ea7; --faint:#6f7380;
  --accent:#ff7a32; --accent-soft:#ff7a321f; --link:#8ab4f8;
  --green:#4cc38a; --amber:#f0b95e; --red:#eb5757; --purple:#b392f0;
  --sb:252px;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;font:13.5px/1.55 ui-sans-serif,-apple-system,"Segoe UI",Roboto,Inter,sans-serif;
  background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased}
a{color:var(--link);text-decoration:none}a:hover{text-decoration:underline;text-underline-offset:2px}
:focus-visible{outline:2px solid var(--accent);outline-offset:1px;border-radius:4px}
hr{border:none;border-top:1px solid var(--border);margin:26px 0}

/* ---- app frame: sidebar + main ---- */
.app{display:flex;min-height:100vh}
.sidebar{width:var(--sb);flex:none;background:var(--panel);border-right:1px solid var(--border);
  position:sticky;top:0;height:100vh;overflow-y:auto;padding:14px 10px 20px;display:flex;flex-direction:column;gap:2px}
.main{flex:1;min-width:0}
.view{max-width:860px;margin:0 auto;padding:34px 36px 80px}
.view.wide{max-width:1160px}

/* sidebar */
.brand{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:700;padding:4px 10px 12px;letter-spacing:-.01em}
.brand .os{color:var(--accent)}
.filter{margin:0 6px 10px;padding:6px 10px;font:inherit;font-size:12.5px;color:var(--text);
  background:var(--bg);border:1px solid var(--border);border-radius:7px;outline:none;width:calc(100% - 12px)}
.filter:focus{border-color:var(--accent)}
.filter::placeholder{color:var(--faint)}
.sb-item{display:flex;align-items:center;gap:9px;padding:6px 10px;border-radius:7px;color:var(--dim);font-weight:500}
.sb-item:hover{background:#ffffff08;color:var(--text);text-decoration:none}
.sb-item.on{background:var(--accent-soft);color:var(--text);font-weight:600}
.sb-item .ic{width:16px;text-align:center;flex:none;font-size:12px;opacity:.85}
.sb-item .ct{margin-left:auto;color:var(--faint);font-size:11px;font-variant-numeric:tabular-nums}
.sb-sec{margin:16px 10px 4px;font-size:10.5px;font-weight:600;color:var(--faint);text-transform:uppercase;letter-spacing:.08em}
.sb-group{margin:0}
.sb-group summary{display:flex;align-items:center;gap:6px;cursor:pointer;list-style:none;user-select:none;
  padding:5px 10px;border-radius:7px;color:var(--dim);font-size:12.5px;font-weight:600}
.sb-group summary:hover{background:#ffffff08;color:var(--text)}
.sb-group summary::-webkit-details-marker{display:none}
.sb-group summary .tw{font-size:9px;color:var(--faint);transition:transform .12s;width:10px}
.sb-group[open] summary .tw{transform:rotate(90deg)}
.sb-group summary .ct{margin-left:auto;color:var(--faint);font-size:11px;font-variant-numeric:tabular-nums}
.sb-group ul{list-style:none;margin:1px 0 4px;padding:0}
.sb-group li a{display:block;padding:4px 10px 4px 26px;border-radius:7px;color:var(--dim);font-size:12.5px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sb-group li a:hover{background:#ffffff08;color:var(--text);text-decoration:none}
.sb-group li a.on{background:var(--accent-soft);color:var(--text);font-weight:600}
.sb-group li a .dot{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:7px;vertical-align:1px;background:var(--green)}
.sb-group li a .dot.superseded{background:var(--amber)}
.sb-group li a .dot.retracted{background:var(--red)}
.sb-foot{margin-top:auto;padding:14px 10px 0;border-top:1px solid var(--hair);color:var(--faint);font-size:11px}
.toggle{display:flex;align-items:center;gap:7px;cursor:pointer;color:var(--dim);font-size:11.5px;margin-bottom:8px}
.toggle input{accent-color:var(--accent);margin:0}
body.hide-archived .archived{display:none}

/* mobile header */
.mob{display:none}

/* ---- view header ---- */
.vh{margin-bottom:20px}
.vh h1{font-size:21px;font-weight:700;letter-spacing:-.02em;margin:0 0 3px}
.vh p{margin:0;color:var(--dim);font-size:13px}
.vh .crumb{font-size:12px;color:var(--faint);margin-bottom:6px}
.vh .crumb a{color:var(--faint)}.vh .crumb a:hover{color:var(--text)}

/* ---- cards / sections ---- */
.card{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:16px 18px;margin-bottom:16px}
.card>h2{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--faint);
  margin:0 0 12px;font-weight:600;display:flex;justify-content:space-between;align-items:baseline}
.card>h2 a{font-size:11.5px;text-transform:none;letter-spacing:0;font-weight:500}
.empty{color:var(--green);font-size:12.5px;display:flex;gap:7px;align-items:center}

/* activity rows */
.row{display:flex;align-items:baseline;gap:10px;padding:7px 0;border-top:1px solid var(--hair)}
.row:first-of-type{border-top:none}
.row .date{flex:none;width:78px;color:var(--faint);font-size:11.5px;font-variant-numeric:tabular-nums}
.row .body{min-width:0}
.op{flex:none;width:74px;text-align:center;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;
  color:var(--dim);background:#ffffff0c;border-radius:5px;padding:2px 0}
.op.decision{color:var(--purple);background:#b392f01a}.op.council{color:var(--amber);background:#f0b95e1a}
.op.ingest{color:#7fd6ff;background:#36b3ff14}.op.prd{color:var(--green);background:#4cc38a1a}
.op.prioritize{color:#ffd166;background:#ffd16614}.op.strategy{color:#ff9bd0;background:#ff5fae14}

/* attention rows */
.att{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--hair)}
.att:first-of-type{border-top:none}
.tag{flex:none;font-size:10px;font-weight:600;padding:2px 8px;border-radius:5px;border:1px solid;letter-spacing:.03em;text-transform:uppercase}
.tag.warn{background:#f0b95e14;color:var(--amber);border-color:#5a4a25}
.tag.bad{background:#eb575714;color:var(--red);border-color:#5a2a2a}
.sub{color:var(--faint);font-size:12px}

/* up-next rows */
.q{display:flex;align-items:flex-start;gap:11px;padding:9px 8px;margin:0 -8px;border-radius:8px;border-top:1px solid var(--hair);color:inherit}
.q:first-of-type{border-top:none}
.q:hover{background:#ffffff07;text-decoration:none}
.q .rank{flex:none;width:22px;height:22px;border-radius:6px;background:#ffffff0c;color:var(--dim);
  font-size:11.5px;font-weight:700;display:grid;place-items:center;margin-top:1px}
.q:hover .rank{background:var(--accent-soft);color:var(--accent)}
.q .body{min-width:0;flex:1}
.q .title{display:block;font-weight:600;color:var(--text);line-height:1.35}
.q .why{display:block;color:var(--faint);font-size:12px;margin-top:1px}
.q .metas{display:block;color:var(--faint);font-size:11px;margin-top:3px;font-variant-numeric:tabular-nums;opacity:.8}
.q .sc{flex:none;font-weight:700;font-size:12px;color:var(--amber);font-variant-numeric:tabular-nums;
  background:#f0b95e12;border:1px solid #f0b95e26;border-radius:6px;padding:2px 7px;margin-top:1px}
.q .sc.hot{color:var(--accent);background:var(--accent-soft);border-color:#ff7a3240}
.legend{color:var(--faint);font-size:11px;margin:10px 0 0;padding-top:9px;border-top:1px solid var(--hair)}
.legend .hotdot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--accent)}

/* ---- document ---- */
.doc h1{font-size:23px;font-weight:700;letter-spacing:-.02em;margin:0 0 6px;line-height:1.25}
.doc h2{font-size:17px;margin:28px 0 9px;letter-spacing:-.01em}
.doc h3{font-size:14.5px;margin:20px 0 7px}
.doc p{color:#c9cdd4}
.doc ul,.doc ol{padding-left:22px}.doc li{margin:3px 0}
.badges{margin:8px 0 16px;display:flex;flex-wrap:wrap;gap:6px}
.badge{font-size:11px;font-weight:500;padding:2px 8px;border-radius:6px;background:#ffffff09;border:1px solid var(--border);color:var(--dim)}
.badge b{color:var(--text);font-weight:600}
.badge.current{color:var(--green);border-color:#2a4a38;background:#4cc38a10}
.badge.superseded{color:var(--amber);border-color:#5a4a25;background:#f0b95e10}
.badge.retracted{color:var(--red);border-color:#5a2a2a;background:#eb575710}
.conflict{background:#eb57570f;border:1px solid #5a2a2a;border-left:3px solid var(--red);border-radius:8px;padding:9px 13px;margin:12px 0;color:#f0a6a6;font-size:13px}
.toc{background:var(--panel);border:1px solid var(--border);border-radius:9px;padding:11px 15px;margin:0 0 20px;
  display:flex;flex-wrap:wrap;gap:3px 15px;font-size:12px}
.toc .toc-t{flex-basis:100%;color:var(--faint);font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:600;margin-bottom:1px}
.toc a{color:var(--dim)}.toc a:hover{color:var(--link)}

/* tables / code / quotes */
.tablewrap{overflow-x:auto;margin:14px 0;border:1px solid var(--border);border-radius:9px}
table{border-collapse:separate;border-spacing:0;font-size:12.5px;width:100%}
th,td{padding:8px 12px;text-align:left;vertical-align:top;border-bottom:1px solid var(--hair)}
th{background:#ffffff06;color:var(--text);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
tr:last-child td{border-bottom:none}
tbody tr:hover td{background:#ffffff04}
pre{white-space:pre-wrap;word-wrap:break-word;background:var(--panel);border:1px solid var(--border);border-radius:9px;padding:14px;font-size:12px;line-height:1.5}
code{background:#ffffff0e;padding:1px 5px;border-radius:4px;font-size:.9em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
pre code{background:none;padding:0}
blockquote{border-left:3px solid var(--border);background:#ffffff05;margin:12px 0;padding:8px 15px;border-radius:0 7px 7px 0;color:var(--dim)}
blockquote.warn{border-left-color:var(--amber);background:#f0b95e12;color:#e8d5ae}
.osnote{margin:10px 0}
.osnote summary{cursor:pointer;list-style:none;user-select:none;color:var(--faint);font-size:11.5px;
  display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border:1px solid var(--hair);border-radius:14px}
.osnote summary::-webkit-details-marker{display:none}
.osnote summary:hover{color:var(--dim);border-color:var(--border)}
.osnote summary .pv{font-style:italic;font-weight:400}
.osnote[open] summary{margin-bottom:4px}
.osnote blockquote{margin-top:4px}

/* jump chips + roadmap horizons */
.chips{display:flex;flex-wrap:wrap;gap:7px;position:sticky;top:0;z-index:5;padding:12px 0 10px;
  background:linear-gradient(var(--bg) 78%,transparent);margin-bottom:6px}
.chip{font-size:11.5px;font-weight:600;color:var(--dim);background:var(--panel);border:1px solid var(--border);
  border-radius:16px;padding:4px 12px}
.chip:hover{color:var(--text);border-color:var(--accent);text-decoration:none}
.hz{scroll-margin-top:56px;border-left:4px solid var(--border);padding:2px 0 2px 13px;margin:32px 0 4px;font-size:18px}
.hz.now{border-color:var(--green)}.hz.next{border-color:var(--amber)}.hz.later{border-color:var(--red)}
h1[id],h2[id],h3[id]{scroll-margin-top:56px}

.note{color:var(--faint);font-size:12px;margin-top:26px;border-top:1px solid var(--border);padding-top:12px}
.note code{color:var(--accent)}

/* ---- responsive ---- */
@media(max-width:880px){
  .app{display:block}
  .sidebar{position:static;width:auto;height:auto;max-height:none;border-right:none;border-bottom:1px solid var(--border);display:none}
  body.nav-open .sidebar{display:flex}
  .sidebar .brand{display:none}
  .mob{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border);
    background:var(--panel);position:sticky;top:0;z-index:10}
  .mob .brand{padding:0;flex:1}
  .mob button{font:inherit;font-size:12.5px;color:var(--dim);background:var(--raise);border:1px solid var(--border);
    border-radius:7px;padding:5px 12px;cursor:pointer}
  .view{padding:22px 16px 60px}
  .chips{top:0}
}
`;

const CLIENT = `
const t=document.getElementById('show-archived');
if(t){t.addEventListener('change',()=>document.body.classList.toggle('hide-archived',!t.checked));}
const mb=document.getElementById('nav-toggle');
if(mb){mb.addEventListener('click',()=>document.body.classList.toggle('nav-open'));}
const f=document.getElementById('nav-filter');
if(f){
  const items=[...document.querySelectorAll('.sb-group li')];
  const groups=[...document.querySelectorAll('.sb-group')];
  f.addEventListener('input',()=>{
    const q=f.value.trim().toLowerCase();
    items.forEach(li=>{li.style.display=!q||li.textContent.toLowerCase().includes(q)?'':'none';});
    groups.forEach(d=>{
      const any=[...d.querySelectorAll('li')].some(li=>li.style.display!=='none');
      d.style.display=any?'':'none';
      if(q&&any)d.open=true;
    });
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='/'&&document.activeElement!==f){e.preventDefault();document.body.classList.add('nav-open');f.focus();}
    if(e.key==='Escape'&&document.activeElement===f){f.value='';f.dispatchEvent(new Event('input'));f.blur();}
  });
}
`;

// The single global sidebar: views on top, then the store's page tree with counts.
// The index's internal page types (concept/entity/qa) are machine taxonomy — the sidebar
// regroups them into plain language (display-only; the filing system is untouched).
function displayGroup(indexGroup) {
  if (/strategy/i.test(indexGroup)) return null; // Strategy is already a top-level view
  if (/concept|entit|q&a|^qa$|q&amp;a/i.test(indexGroup)) return 'Knowledge';
  return indexGroup; // PRDs, Decisions, Council reviews read fine as-is
}

function sidebar(active, activeRel) {
  const index = parseIndex(readRel('index.md'));
  const view = (id, href, icon, label) =>
    `<a class="sb-item ${active === id ? 'on' : ''}" href="${href}"><span class="ic">${icon}</span>${label}</a>`;

  // merge index groups into display groups, preserving order of first appearance
  const groups = new Map();
  for (const [g, items] of Object.entries(index)) {
    const dg = displayGroup(g);
    if (!dg || !items.length) continue;
    if (!groups.has(dg)) groups.set(dg, []);
    groups.get(dg).push(...items);
  }

  let store = '';
  for (const [group, items] of groups) {
    store += `<details class="sb-group" open><summary><span class="tw">▶</span>${esc(group)}<span class="ct">${items.length}</span></summary><ul>`;
    for (const it of items) {
      const archived = it.status !== 'current';
      store += `<li class="${archived ? 'archived' : ''}"><a class="${it.path === activeRel ? 'on' : ''}" href="/page/${it.path}" title="${esc(it.summary)}"><span class="dot ${esc(it.status)}"></span>${esc(it.title)}</a></li>`;
    }
    store += '</ul></details>';
  }

  return `<nav class="sidebar">
    <div class="brand">${esc(BRAND)} <span class="os">OS</span></div>
    <input type="search" id="nav-filter" class="filter" placeholder="Filter pages… ( / )" autocomplete="off">
    ${view('today', '/', '☀', 'Today')}
    ${view('roadmap', '/roadmap', '▤', 'Roadmap')}
    ${view('queue', '/queue', '≡', 'Queue')}
    ${view('strategy', '/page/strategy.md', '◎', 'Strategy')}
    <div class="sb-sec">Store</div>
    ${store}
    <div class="sb-foot">
      <label class="toggle"><input type="checkbox" id="show-archived"> show superseded / retracted</label>
      local · read-only · rendered off disk
    </div>
  </nav>`;
}

function shell(active, inner, opts = {}) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(opts.title || 'Command center')}</title><style>${CSS}</style></head>
<body class="hide-archived">
<div class="mob"><div class="brand">${esc(BRAND)} <span style="color:var(--accent)">OS</span></div><button id="nav-toggle">Menu</button></div>
<div class="app">${sidebar(active, opts.activeRel)}<div class="main">${inner}</div></div>
<script>${CLIENT}</script></body></html>`;
}

// ---- view: Today (home — what changed, what needs attention, up next) ----------------------

function renderToday() {
  const index = parseIndex(readRel('index.md'));
  const routines = parseRoutines(readRel('meta/routines-state.md'));
  const log = parseLog(readRel('log.md'));
  const pages = collectPages();
  const indexPaths = Object.values(index).flat().map((e) => e.path);

  // 1 — since you were here (primary)
  const logHtml = log.map((l) => {
    const href = linkForLogId(l.id, indexPaths);
    const what = href ? `<a href="${href}">${esc(l.title)}</a>` : esc(l.title);
    return `<div class="row"><span class="date">${esc(l.date)}</span><span class="op ${esc(l.op)}">${esc(l.op)}</span><span class="body">${what}</span></div>`;
  }).join('') || '<div class="empty">Nothing logged yet.</div>';

  // 2 — needs attention (compact: aggregate the routine noise into one line)
  const att = [];
  const pending = routines.filter((r) => r.pending);
  for (const r of pending)
    att.push(`<div class="att"><span class="tag warn">pending</span><span>Unharvested session — run <code>/harvest</code></span><span class="sub">since ${esc(r.last)}</span></div>`);
  const overdue = routines.filter((r) => r.overdue && !r.pending);
  if (overdue.length)
    att.push(`<div class="att"><span class="tag warn">overdue</span><span>${overdue.length} routine${overdue.length > 1 ? 's' : ''}: ${overdue.map((r) => `<b>${esc(r.name)}</b>`).join(', ')}</span><span class="sub">oldest ${Math.max(...overdue.map((r) => r.days))}d</span></div>`);
  const today = new Date();
  pages.filter((p) => p.fm.type === 'decision' && p.fm.status === 'current' && p.fm.review && new Date(p.fm.review) <= today)
    .forEach((p) => att.push(`<div class="att"><span class="tag warn">review due</span><a href="/page/${p.rel}">${esc(p.fm.title || p.rel)}</a></div>`));
  pages.filter((p) => p.fm.status === 'current' && fmList(p.fm.conflicts_with).length)
    .forEach((p) => att.push(`<div class="att"><span class="tag bad">conflict</span><a href="/page/${p.rel}">${esc(p.fm.title || p.rel)}</a></div>`));
  const attHtml = att.join('') || '<div class="empty">✓ All clear — no conflicts, nothing overdue</div>';

  // 3 — up next (top 3 only; the full queue is its own view)
  const rows = parseQueueRows(readRel('queue.md'));
  const upNext = rows.slice(0, 3).map((q) => {
    const hot = parseFloat(q.score) >= 10;
    return `<a class="q" href="${q.href || '/queue'}">
      <span class="rank">${esc(q.n)}</span>
      <span class="body"><span class="title">${esc(q.action)}</span><span class="why">${esc(q.why)}</span></span>
      <span class="sc${hot ? ' hot' : ''}">${esc(q.score)}</span></a>`;
  }).join('') || '<div class="empty">Queue is empty.</div>';

  const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const inner = `<div class="view">
    <div class="vh"><h1>Today</h1><p>${esc(dateStr)} — structural state, read off disk. For the judgment view, run <code>/brief</code> in chat.</p></div>
    <section class="card"><h2>Since you were here<a href="/page/log.md">full log →</a></h2>${logHtml}</section>
    <section class="card"><h2>Needs attention</h2>${attHtml}</section>
    <section class="card"><h2>Up next<a href="/queue">full queue (${rows.length}) →</a></h2>${upNext}
      <p class="legend">score = impact × confidence ÷ effort (1–5 each) · <span class="hotdot"></span> ≥ 10 = high leverage</p></section>
  </div>`;
  return shell('today', inner, { title: 'Command center — Today' });
}

// ---- views: roadmap / queue (one question per view) ----------------------------------------

// give NOW / NEXT / LATER headings a coloured accent bar
function horizonAccents(html) {
  return html
    .replace(/<h2 (id="[^"]*")>(\s*🟢[^<]*)<\/h2>/g, '<h2 $1 class="hz now">$2</h2>')
    .replace(/<h2 (id="[^"]*")>(\s*🟡[^<]*)<\/h2>/g, '<h2 $1 class="hz next">$2</h2>')
    .replace(/<h2 (id="[^"]*")>(\s*🔴[^<]*)<\/h2>/g, '<h2 $1 class="hz later">$2</h2>');
}

// sticky jump-chips built from a rendered doc's h1/h2 anchors
function jumpChips(html) {
  const chips = [];
  const re = /<h[12] id="([^"]+)"[^>]*>([\s\S]*?)<\/h[12]>/g;
  let m;
  while ((m = re.exec(html))) {
    const label = m[2].replace(/<[^>]+>/g, '').split('—')[0].replace(/[^\x20-\x7E&;#]/g, '').trim();
    if (label) chips.push(`<a class="chip" href="#${m[1]}">${label}</a>`);
  }
  return chips.length > 1 ? `<div class="chips">${chips.join('')}</div>` : '';
}

function renderRoadmap() {
  const html = horizonAccents(mdToHtml(stripFm(readRel('roadmap.md')), { rel: 'roadmap.md' }));
  const inner = `<div class="view wide">${jumpChips(html)}<div class="doc">${html}</div></div>`;
  return shell('roadmap', inner, { title: 'Command center — roadmap' });
}

// The queue gets a designed list, not a raw markdown-table dump: rank, task, plain-named
// axes, why-line. Real warnings (⚠ blockquotes) from queue.md render above it; the rest
// of the file's prose is OS bookkeeping and stays behind the raw-source link.
function renderQueue() {
  const src = stripFm(readRel('queue.md'));
  const warnings = [];
  const qlines = src.split(/\r?\n/);
  for (let i = 0; i < qlines.length; i++) {
    if (/^>\s?/.test(qlines[i].trim())) {
      const buf = [];
      while (i < qlines.length && /^>\s?/.test(qlines[i].trim())) { buf.push(qlines[i].trim().replace(/^>\s?/, '')); i++; }
      const raw = buf.join(' ');
      if (raw.includes('⚠')) warnings.push(`<blockquote class="warn">${inlineHtml(raw, { rel: 'queue.md' })}</blockquote>`);
    }
  }
  const rows = parseQueueRows(src);
  const list = rows.map((q) => {
    const hot = parseFloat(q.score) >= 10;
    return `<a class="q" href="${q.href || '#'}">
      <span class="rank">${esc(q.n)}</span>
      <span class="body"><span class="title">${esc(q.action)}</span><span class="why">${esc(q.why)}</span>
        <span class="metas">impact ${esc(q.imp)} · effort ${esc(q.eff)} · confidence ${esc(q.conf)}</span></span>
      <span class="sc${hot ? ' hot' : ''}">${esc(q.score)}</span></a>`;
  }).join('') || '<div class="empty">Queue is empty.</div>';

  const inner = `<div class="view">
    <div class="vh"><h1>Queue</h1><p>Your ranked next actions — each row is a task for you, ordered by leverage. Re-ranked by <code>/prioritize</code>.</p></div>
    ${warnings.join('')}
    <section class="card">
      <h2>${rows.length} ranked actions<a href="/page/queue.md">raw source →</a></h2>
      ${list}
      <p class="legend">score = impact × confidence ÷ effort, each 1–5 · impact = how much it moves the north-star · <span class="hotdot"></span> ≥ 10 = cheap and high-leverage — do these first</p>
    </section>
  </div>`;
  return shell('queue', inner, { title: 'Command center — queue' });
}

// ---- view: store page ----------------------------------------------------------------------

function renderBadges(fm) {
  const b = [];
  const kv = (label, val) => `<span class="badge">${label} <b>${esc(val)}</b></span>`;
  if (fm.type) b.push(`<span class="badge"><b>${esc(fm.type)}</b></span>`);
  if (fm.status) b.push(`<span class="badge ${esc(fm.status)}">${esc(fm.status)}</span>`);
  if (fm.provenance) b.push(kv('provenance', fm.provenance));
  if (fm.confidence) b.push(kv('confidence', fm.confidence));
  if (fm.stage) b.push(kv('stage', fm.stage));
  if (fm.updated) b.push(kv('updated', fm.updated));
  return `<div class="badges">${b.join('')}</div>`;
}

function renderChainLinks(fm) {
  const out = [];
  const link = (id) => `<a href="/page/${idToPath(id)}">${esc(id)}</a>`;
  fmList(fm.conflicts_with).forEach((id) => out.push(`<div class="conflict">⚠ conflicts with ${link(id)} — both sides logged; needs resolution.</div>`));
  if (fm.superseded_by) out.push(`<p class="sub">↪ superseded by ${link(fm.superseded_by)}</p>`);
  if (fmList(fm.supersedes).length) out.push(`<p class="sub">↩ supersedes ${fmList(fm.supersedes).map(link).join(', ')}</p>`);
  return out.join('');
}

// resolve a frontmatter id (e.g. DEC-0007-… or a slug) to a store path via the index
let _idIndex = null;
function idToPath(id) {
  if (!_idIndex) {
    _idIndex = {};
    for (const e of Object.values(parseIndex(readRel('index.md'))).flat()) {
      const base = path.posix.basename(e.path).replace(/\.md$/, '');
      _idIndex[base] = e.path;
    }
  }
  if (_idIndex[id]) return _idIndex[id];
  for (const [base, p] of Object.entries(_idIndex)) if (base.startsWith(id)) return p;
  return id + '.md'; // dead-but-visible; route 404s gracefully
}

// "On this page" box for long pages (4+ H2s), linking to the heading slugs
function tocFor(body) {
  const h2s = [];
  let inFence = false;
  for (const line of body.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    const m = !inFence && line.match(/^##\s+(.+)$/);
    if (m) h2s.push(m[1]);
  }
  if (h2s.length < 4) return '';
  return `<nav class="toc"><span class="toc-t">On this page</span>${h2s
    .map((h) => `<a href="#${slugify(h)}">${esc(plainText(h))}</a>`).join('')}</nav>`;
}

function renderPage(rel, abs) {
  const text = fs.readFileSync(abs, 'utf8');
  const isRaw = rel.startsWith('raw/');
  let mainBody;
  if (isRaw) {
    // immutable source — render verbatim, never reinterpreted
    mainBody = `<div class="vh"><div class="crumb"><a href="/">Today</a> / raw</div><h1>${esc(rel)}</h1><p>Immutable raw snapshot — rendered verbatim.</p></div><pre>${esc(text)}</pre>`;
  } else {
    const { fm, body } = splitFrontmatter(text);
    const bodyH1 = (body.match(/^#\s+(.+)$/m) || [])[1];
    const title = fm.title || bodyH1 || rel;
    // drop a leading body H1 — the frontmatter title already renders as the page H1
    const deduped = body.replace(/^(\s*)#\s+.+\r?\n/, '$1');
    const crumb = `<div class="crumb"><a href="/">Today</a> / ${esc(path.posix.dirname(rel) === '.' ? 'store' : path.posix.dirname(rel))}</div>`;
    mainBody = `<div class="vh">${crumb}<h1>${esc(title)}</h1></div>${renderBadges(fm)}${renderChainLinks(fm)}${tocFor(deduped)}${mdToHtml(deduped, { rel })}`;
  }
  const inner = `<div class="view"><div class="doc">${mainBody}</div></div>`;
  return shell('page', inner, { title: `Command center — ${rel}`, activeRel: rel });
}

// ---- server ------------------------------------------------------------------------------

function serve(req, res) {
  // localhost-only (defense in depth against DNS rebinding)
  const host = (req.headers.host || '').split(':')[0];
  if (!['127.0.0.1', 'localhost'].includes(host)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden: localhost only.');
  }
  // read-only: no mutating methods exist
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    return res.end('Read-only.');
  }

  const send = (code, html) => { res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); };
  try {
    _idIndex = null; // rebuilt per request so the sidebar/index never drift from disk
    const url = new URL(req.url, `http://${HOST}`);
    const p = url.pathname;
    if (p === '/') return send(200, renderToday());
    if (p === '/roadmap') return send(200, renderRoadmap());
    if (p === '/queue') return send(200, renderQueue());
    if (p.startsWith('/page/')) {
      const rel = p.slice('/page/'.length);
      const abs = resolveScoped(rel);
      if (!abs) return send(404, shell('page', `<div class="view"><div class="vh"><h1>404</h1><p>Not in the business knowledge tree (or missing): <code>${esc(rel)}</code></p></div></div>`, { title: '404' }));
      return send(200, renderPage(decodeURIComponent(rel).replace(/\\/g, '/').replace(/^\/+/, ''), abs));
    }
    send(404, shell('today', '<div class="view"><div class="vh"><h1>404</h1></div></div>', { title: '404' }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Error: ' + err.message);
  }
}

const args = parseArgs(process.argv.slice(2));
http.createServer(serve).listen(args.port, HOST, () => {
  const url = `http://${HOST}:${args.port}`;
  console.log(`Command center → ${url}  (localhost only; Ctrl-C to stop)`);
  if (args.open) {
    const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]]
      : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
    try { spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' }).unref(); } catch { /* ignore */ }
  }
});
