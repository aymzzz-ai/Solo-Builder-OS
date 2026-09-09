#!/usr/bin/env node
//
// render-agent-instructions — fill the build-agent standing-instructions template for THIS
// instance and write it to drafts/ for the founder to install by hand.
//
// CAR-4: this never writes to the build tool. The install target lives inside the build
// tool's workspace, and putting it there is a write the OS is denied. So the OS drafts and
// the founder installs, the same as every other outbound artifact.
//
// What it fills comes from three places, and it never invents the rest:
//   - config/tools.md          → the active pm_tool and build_tool
//   - the build adapter        → instructionsTarget, and the tool-shaped placeholders
//   - config/businesses.md     → the product name
// Anything it cannot resolve is LEFT AS ITS PLACEHOLDER and reported, because a silently
// half-filled working agreement is worse than one that says which lines still need you.
//
// Usage:
//   node scripts/render-agent-instructions.js [--target <dir>] [--stdout]

const fs = require('fs');
const path = require('path');

const SCRIPT_ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(SCRIPT_ROOT, 'os-core', 'templates', 'build-agent-instructions-template.md');

const args = process.argv.slice(2);
const targetIdx = args.indexOf('--target');
const INSTANCE = targetIdx !== -1 ? path.resolve(args[targetIdx + 1]) : process.cwd();
const TO_STDOUT = args.includes('--stdout');

function fencedJson(file) {
  if (!fs.existsSync(file)) return null;
  const m = fs.readFileSync(file, 'utf8').match(/```json\s*([\s\S]*?)```/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) { return { __error: e.message }; }
}

// The agent-facing block is the first ```markdown fence in the template. Everything around
// it is guidance for us and must never reach the build tool.
function agentBlock(templateText) {
  const m = templateText.match(/```markdown\s*\n([\s\S]*?)\n```/);
  return m ? m[1] : null;
}

// Placeholders whose value is a property of the TOOL, not of the business. Keeping the
// mapping next to the adapters rather than in prose is what stops the two drifting.
const TOOL_SHAPED = {
  replit: { '<plan-mode>': 'Plan Mode' },
  lovable: { '<plan-mode>': 'Plan mode' },
};

// What the PM tool calls the pages the OS authors. Only meaningful when the agent can
// reach the PM tool at all.
const PM_SHAPED = {
  linear: { '<protected-artifacts>': 'Project and team Documents' },
  'github-issues': { '<protected-artifacts>': 'The repo wiki, and files under `docs/`' },
};

// Whether the build agent can reach the PM tool changes what it can be ASKED to do. Getting
// this wrong ships instructions the agent has no way to carry out, which costs the whole
// file its credibility.
const PM_ACCESS_SHAPED = {
  true: {
    '<record-destination>': 'as a comment on the Task',
    '<cancel-state>': 'cancel the Task',
  },
  false: {
    '<record-destination>': 'as a message in this session, for the founder to carry back',
    '<blocked-state>': 'stop and wait',
    '<cancel-state>': 'stop',
  },
};

const BLOCKED_BY_PM = {
  linear: 'move the Task to Blocked',
  'github-issues': 'apply the `blocked` label',
};

// The two <pm-write-policy> bodies live in the TEMPLATE, not here, so the prose the agent
// reads has exactly one home.
function pmWritePolicy(templateText, pmAccess) {
  const heading = pmAccess
    ? /### `pmAccess: true`[^\n]*\n+```text\s*\n([\s\S]*?)\n```/
    : /### `pmAccess: false`[^\n]*\n+```text\s*\n([\s\S]*?)\n```/;
  const m = templateText.match(heading);
  return m ? m[1] : null;
}

function main() {
  if (!fs.existsSync(TEMPLATE)) {
    console.error(`render-agent-instructions: template not found at ${TEMPLATE}`);
    process.exit(1);
  }

  const templateText = fs.readFileSync(TEMPLATE, 'utf8');
  const block = agentBlock(templateText);
  if (!block) {
    console.error('render-agent-instructions: template has no ```markdown block to render.');
    process.exit(1);
  }

  const cfg = fencedJson(path.join(INSTANCE, 'config', 'tools.md')) || {};
  if (cfg.__error) {
    console.error(`render-agent-instructions: config/tools.md json is unparseable — ${cfg.__error}`);
    process.exit(1);
  }

  const buildTool = cfg.build_tool || null;
  const pmTool = cfg.pm_tool || null;

  if (!buildTool) {
    console.error('render-agent-instructions: config/tools.md names no build_tool.');
    console.error('  Finish the "Connect your tools: build tool" step in /onboard, then re-run.');
    process.exit(2);
  }

  const adapterFile = path.join(SCRIPT_ROOT, 'scripts', 'adapters', 'build', `${buildTool}.md`);
  const adapter = fencedJson(adapterFile) || {};
  const target = adapter.instructionsTarget || null;

  // pmAccess is load-bearing enough that guessing it is worse than stopping.
  if (typeof adapter.pmAccess !== 'boolean') {
    console.error(`render-agent-instructions: build adapter "${buildTool}" declares no pmAccess.`);
    console.error('  It decides whether the agent can be told to comment on a Task at all.');
    console.error('  Add it to the adapter (os-core/schema/adapters.md), then re-run.');
    process.exit(2);
  }

  const values = Object.assign(
    {},
    TOOL_SHAPED[buildTool] || {},
    PM_SHAPED[pmTool] || {},
    adapter.pmAccess && pmTool ? { '<blocked-state>': BLOCKED_BY_PM[pmTool] } : {},
    PM_ACCESS_SHAPED[String(adapter.pmAccess)] || {}
  );

  const policy = pmWritePolicy(templateText, adapter.pmAccess);
  if (!policy) {
    console.error('render-agent-instructions: template is missing a <pm-write-policy> variant.');
    process.exit(1);
  }
  values['<pm-write-policy>'] = policy;

  // An agent with no PM access has nothing the OS needs to fence off there.
  if (!adapter.pmAccess) {
    values['<protected-artifacts>'] = 'Anything in the project-management tool';
  }

  // The product name comes from the registry's entry line (`- \`slug\` — Name; …`), NOT its
  // heading, which is the boilerplate title "Business registry". Prefer the human name when
  // it has been filled in; fall back to the slug, then to the folder.
  const registry = path.join(INSTANCE, 'config', 'businesses.md');
  if (fs.existsSync(registry)) {
    const m = fs.readFileSync(registry, 'utf8').match(/^-\s+`([^`]+)`\s+—\s+([^;]+)/m);
    if (m) {
      const name = m[2].trim();
      values['<product>'] = /^<.*>$/.test(name) ? m[1].trim() : name;
    }
  }
  if (!values['<product>']) values['<product>'] = path.basename(INSTANCE);

  let out = block;
  for (const [ph, val] of Object.entries(values)) {
    out = out.split(ph).join(val);
  }
  out = out.replace('<YYYY-MM-DD>', new Date().toISOString().slice(0, 10));

  // Report what is still unfilled rather than shipping it silently. `<task title>` and
  // `<ids>` are slots the AGENT fills in at write time, so they are not gaps.
  const AGENT_SLOTS = new Set(['<task title>', '<ids>']);
  // Plenty of solo setups keep OS artifacts and product work in one place, where there is
  // no second container to fence off. Reporting that as a gap tells the user to invent one.
  const OPTIONAL = new Set(['<os-container>']);
  const remaining = [...new Set(out.match(/<[a-z][a-z -]*>/g) || [])]
    .filter(p => !AGENT_SLOTS.has(p));
  const unfilled = remaining.filter(p => !OPTIONAL.has(p));
  const optional = remaining.filter(p => OPTIONAL.has(p));

  if (TO_STDOUT) {
    process.stdout.write(out + '\n');
  } else {
    const draftsDir = path.join(INSTANCE, 'drafts');
    fs.mkdirSync(draftsDir, { recursive: true });
    const outFile = path.join(draftsDir, `build-agent-instructions-${buildTool}.md`);
    fs.writeFileSync(outFile, out + '\n');
    console.log(`render-agent-instructions — ${buildTool} (pm: ${pmTool || 'unset'})`);
    console.log(`  drafted → ${path.relative(INSTANCE, outFile)}`);
    console.log(target
      ? `  install as → ${target}   (you install it; the OS is denied that write, CAR-4)`
      : `  WARNING: build adapter "${buildTool}" declares no instructionsTarget — ask /onboard where this goes.`);
  }

  if (unfilled.length) {
    console.warn('  FILL THESE BY HAND before installing:');
    for (const p of unfilled) console.warn(`    ${p}`);
    console.warn('  They describe your workspace, which the OS cannot derive. See the');
    console.warn('  placeholder table in os-core/templates/build-agent-instructions-template.md.');
  }
  if (optional.length) {
    console.warn('  OPTIONAL, fill or delete the clause:');
    for (const p of optional) console.warn(`    ${p}`);
    console.warn('  Only needed if OS artifacts live somewhere the agent could reach and');
    console.warn('  should not. Keeping everything in one place is a fine answer — delete it.');
  }
}

main();
