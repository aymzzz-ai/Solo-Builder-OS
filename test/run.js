// Acceptance suite — script-level tests. Exercises the built machinery and asserts
// behaviour. The LLM-native skill guarantees (cite/abstain/ternary/quarantine/lint) are
// behavioural and were validated by running the reference implementation on a real store —
// see docs/user-guide.md for what the OS guarantees and how it behaves.
//
// Run:  node test/run.js   (or: npm test)
// Exit: 0 = all passed · 1 = a test failed.

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const node = process.execPath;
let pass = 0, fail = 0;
const tmps = [];

function mktmp(name) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `ostest-${name}-`));
  tmps.push(d);
  return d;
}
function run(script, args, opts = {}) {
  return spawnSync(node, [path.join(ROOT, script), ...args], { encoding: 'utf8', cwd: ROOT, ...opts });
}
function t(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    fail++;
    console.error(`  ❌ ${name}\n     ${e.message}`);
  }
}

console.log('Acceptance suite — script level\n');

// ── export-check ──────────────────────────────────────────────────────────────
t('export-check: os-core passes the secret scan (exit 0)', () => {
  const r = run('scripts/export-check.js', ['os-core']);
  assert.strictEqual(r.status, 0, `expected 0, got ${r.status}\n${r.stdout}${r.stderr}`);
});

// The verdict must never speak for a scan that did not run. This repo has no
// config/businesses.md, so the slug half cannot run here and the output has to say so
// rather than reporting a clean bill of health for both.
t('export-check: says so when the slug scan cannot run', () => {
  const r = run('scripts/export-check.js', ['os-core']);
  assert.ok(/slugs:\s+NOT CHECKED/.test(r.stdout), `no NOT CHECKED line:\n${r.stdout}`);
  assert.ok(/PARTIAL/.test(r.stdout), `claimed a full pass:\n${r.stdout}`);
  assert.ok(!/no secrets or private slugs found/.test(r.stdout),
    `asserted slugs were checked when they were not:\n${r.stdout}`);
});

// Assembled at runtime, never written as a literal: a committed key-shaped string
// trips third-party credential scanners and reads as a real leak to anyone skimming
// the repo. The value is synthetic — it only has to satisfy export-check's
// Anthropic pattern (/\bsk-ant-[A-Za-z0-9_-]{20,}\b/).
const PLANTED_SECRET = ['sk', 'ant', 'A'.repeat(24)].join('-');

t('export-check: detects a planted secret (exit 1)', () => {
  const bundle = mktmp('leak');
  fs.writeFileSync(path.join(bundle, 'oops.md'), `token leak: ${PLANTED_SECRET}\n`);
  const r = run('scripts/export-check.js', [bundle]);
  assert.strictEqual(r.status, 1, `expected 1, got ${r.status}\n${r.stdout}${r.stderr}`);
});

// ── project-contract (scaffolder) ───────────────────────────────────────────────
const inst = mktmp('inst');
t('project-contract: scaffolds an instance (exit 0)', () => {
  const r = run('scripts/project-contract.js', ['demo-co', '--target', inst]);
  assert.strictEqual(r.status, 0, `exit ${r.status}\n${r.stdout}${r.stderr}`);
  const must = [
    'CLAUDE.md', 'index.md', 'log.md', 'queue.md', 'roadmap.md', 'feedback.md',
    'strategy.md', 'raw', 'wiki/concepts', 'wiki/entities', 'wiki/qa', 'decisions', 'council',
    'prds', 'drafts', 'meta/feedback-log.md', 'meta/lessons.md', 'meta/routines-state.md',
    'config/businesses.md', 'config/preferences.md', 'config/mcp.json', '.secrets/.env.example',
    '.claude/settings.json',
  ];
  for (const p of must) assert.ok(fs.existsSync(path.join(inst, p)), `missing ${p}`);
});

t('project-contract: settings.json wires the SessionEnd harvest hook', () => {
  const s = JSON.parse(fs.readFileSync(path.join(inst, '.claude', 'settings.json'), 'utf8'));
  assert.ok(s.hooks && s.hooks.SessionEnd, 'missing SessionEnd');
  assert.ok(JSON.stringify(s.hooks).includes('session-end-harvest.js'), 'no session-end-harvest hook');
  // The mirror pipeline is retired: there must be no SessionStart hook at all.
  assert.ok(!s.hooks.SessionStart, 'unexpected SessionStart hook (mirror is retired)');
});

// The CAR-4 deny block is emitted from the ACTIVE BUILD ADAPTER, so a fresh instance with
// no build tool chosen yet must still HAVE the key (empty), and choosing one must fill it.
// An empty-but-present block is what makes the gap visible instead of silent.
t('project-contract: emits permissions.deny from the active build adapter', () => {
  const p = path.join(inst, '.claude', 'settings.json');
  let s = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.ok(s.permissions && Array.isArray(s.permissions.deny), 'no permissions.deny array');
  assert.strictEqual(s.permissions.deny.length, 0, 'deny should be empty before a build tool is chosen');

  const toolsFile = path.join(inst, 'config', 'tools.md');
  fs.writeFileSync(toolsFile, fs.readFileSync(toolsFile, 'utf8').replace('"build_tool": null', '"build_tool": "replit"'));

  // A hand-added rule must survive the re-run (union, not overwrite).
  s.permissions.deny.push('mcp__handadded__tool');
  fs.writeFileSync(p, JSON.stringify(s, null, 2));

  run('scripts/project-contract.js', ['demo-co', '--target', inst]);
  s = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.ok(s.permissions.deny.includes('mcp__handadded__tool'), 'hand-added deny rule was dropped');
  assert.ok(s.permissions.deny.some((d) => d.startsWith('mcp__replit__')), 'adapter deny tools not emitted');
});

t('project-contract: routines ledger has the 5 routine lines', () => {
  const led = fs.readFileSync(path.join(inst, 'meta', 'routines-state.md'), 'utf8');
  const lines = led.split('\n').filter((l) => /^- \w[\w-]*\s*\|\s*(weekly|monthly|on-change)\s*\|\s*last:\s*\d{4}-\d{2}-\d{2}/.test(l));
  assert.strictEqual(lines.length, 5, `expected 5 ledger lines, got ${lines.length}`);
});

t('project-contract: CLAUDE.md carries the generated header + contract body', () => {
  const c = fs.readFileSync(path.join(inst, 'CLAUDE.md'), 'utf8');
  assert.ok(c.includes('AUTO-GENERATED by scripts/project-contract.js'), 'no generated header');
  assert.ok(c.includes('operating-contract') || c.includes('prime directive') || c.length > 2000, 'contract body not embedded');
});

t('project-contract: idempotent — re-run does not clobber instance data', () => {
  const idx = path.join(inst, 'index.md');
  fs.writeFileSync(idx, '# MY EDITED INDEX\n');           // user content
  const r = run('scripts/project-contract.js', ['demo-co', '--target', inst]);
  assert.strictEqual(r.status, 0, `exit ${r.status}`);
  assert.strictEqual(fs.readFileSync(idx, 'utf8'), '# MY EDITED INDEX\n', 'index.md was clobbered');
  // slug registered exactly once
  const reg = fs.readFileSync(path.join(inst, 'config', 'businesses.md'), 'utf8');
  assert.strictEqual((reg.match(/`demo-co`/g) || []).length, 1, 'slug registered more than once');
});

t('project-contract: refuses when .os-build-workspace sentinel present (exit 2)', () => {
  const tpl = mktmp('tpl');
  fs.writeFileSync(path.join(tpl, '.os-build-workspace'), 'template\n');
  const r = run('scripts/project-contract.js', ['demo-co', '--target', tpl]);
  assert.strictEqual(r.status, 2, `expected 2, got ${r.status}\n${r.stdout}${r.stderr}`);
});

// ── canonical skills location ───────────────────────────────────────────────────
// Replaces the old install-skills test. The skills ARE .claude/skills/ now — there is no
// copy step to verify. What needs guarding instead is that the relocation did not drop
// them out of the ARC-4 leak gate, which used to scan os-core/ only.
t('skills: canonical tree is .claude/skills/, and export-check covers it', () => {
  const skills = path.join(ROOT, '.claude', 'skills');
  assert.ok(fs.existsSync(path.join(skills, 'ask', 'SKILL.md')), '.claude/skills/ask/SKILL.md missing');
  assert.ok(!fs.existsSync(path.join(ROOT, 'os-core', 'skills')), 'os-core/skills/ should no longer exist');

  // The gate must scan strictly more than os-core/ alone, or the skills are ungated.
  const full = run('scripts/export-check.js', []);
  const osCoreOnly = run('scripts/export-check.js', ['os-core']);
  assert.strictEqual(full.status, 0, `export-check exit ${full.status}\n${full.stdout}${full.stderr}`);
  const count = (out) => Number((out.match(/scanned (\d+) text file/) || [])[1]);
  assert.ok(count(full.stdout) > count(osCoreOnly.stdout),
    `default bundle scanned ${count(full.stdout)} file(s), os-core alone ${count(osCoreOnly.stdout)} — skills not covered`);
});

// ── hook adapters (run from inside the scaffolded instance) ───────────────────────
function installHook(instanceDir, hookFile) {
  const dst = path.join(instanceDir, 'scripts', 'hooks', hookFile);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'scripts', 'hooks', hookFile), dst);
  return dst;
}

t('session-end-harvest: marks harvest PENDING (idempotently)', () => {
  const hook = installHook(inst, 'session-end-harvest.js');
  let r = spawnSync(node, [hook], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, `exit ${r.status}\n${r.stderr}`);
  let led = fs.readFileSync(path.join(inst, 'meta', 'routines-state.md'), 'utf8');
  assert.ok(/^- harvest\b.*PENDING/m.test(led), 'harvest line not marked PENDING');
  r = spawnSync(node, [hook], { encoding: 'utf8' });        // re-run
  led = fs.readFileSync(path.join(inst, 'meta', 'routines-state.md'), 'utf8');
  assert.strictEqual((led.match(/PENDING/g) || []).length, 1, 'PENDING marker stacked on re-run');
});

// ── render-agent-instructions ─────────────────────────────────────────────────
// The whole point of pmAccess is that an agent which cannot reach the PM tool must never
// be handed instructions that assume it can. That is the property worth testing.
function renderInto(instanceDir, buildTool, pmTool) {
  fs.writeFileSync(path.join(instanceDir, 'config', 'tools.md'),
    '# Active tools\n\n```json\n' +
    JSON.stringify({ pm_tool: pmTool, build_tool: buildTool }, null, 2) + '\n```\n');
  const r = run('scripts/render-agent-instructions.js', ['--target', instanceDir, '--stdout']);
  assert.strictEqual(r.status, 0, `exit ${r.status}\n${r.stderr}`);
  return r.stdout;
}

t('render-agent-instructions: PM-capable agent gets the PM write policy', () => {
  const out = renderInto(inst, 'replit', 'linear');
  assert.ok(/create, update, move status/.test(out), 'Epic/Task write grant missing');
  assert.ok(/as a comment on the Task/.test(out), 'record destination not resolved');
  assert.ok(!/<pm-write-policy>|<record-destination>/.test(out), 'placeholders left unfilled');
});

t('render-agent-instructions: PM-isolated agent is never told to write to the PM tool', () => {
  const out = renderInto(inst, 'lovable', 'github-issues');
  assert.ok(/no access to the project-management tool/.test(out), 'isolation policy missing');
  assert.ok(!/create, update, move status/.test(out), 'granted PM writes it cannot perform');
  assert.ok(!/comment on the Task/.test(out), 'told to comment on a Task it cannot reach');
});

t('render-agent-instructions: never leaks the maintainer-only guidance', () => {
  const out = renderInto(inst, 'replit', 'linear');
  assert.ok(!/Notes for the maintainer/.test(out), 'maintainer notes reached the agent block');
  assert.ok(!/instructionsTarget/.test(out), 'adapter internals reached the agent block');
});

t('render-agent-instructions: refuses a build adapter with no pmAccess declared', () => {
  const bogus = path.join(ROOT, 'scripts', 'adapters', 'build', 'ostest-nopm.md');
  fs.writeFileSync(bogus, '# test\n\n```json\n{"name":"ostest-nopm","instructionsTarget":"X.md"}\n```\n');
  try {
    fs.writeFileSync(path.join(inst, 'config', 'tools.md'),
      '# Active tools\n\n```json\n{"pm_tool":"linear","build_tool":"ostest-nopm"}\n```\n');
    const r = run('scripts/render-agent-instructions.js', ['--target', inst, '--stdout']);
    assert.strictEqual(r.status, 2, `expected exit 2, got ${r.status}`);
    assert.ok(/declares no pmAccess/.test(r.stderr), 'did not name the missing declaration');
  } finally {
    fs.rmSync(bogus, { force: true });
  }
});

// ── cleanup + summary ─────────────────────────────────────────────────────────
for (const d of tmps) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} }
console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
