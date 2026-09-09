// export-check — the SAF-1 / ARC-4 leak gate. Run BEFORE sharing the exportable bundle.
// Scans every text file in the bundle for (a) secret-shaped strings and (b) private
// business slugs, and HARD-FAILS (exit 1) on any hit so a leak can never be shared.
//
// The bundle is TWO paths, not one: os-core/ (schema, templates, prompts, patterns) and
// .claude/skills/ (the canonical skills — they moved out of os-core/ when install-skills.js
// was retired and .claude/skills/ became the single source of truth). Scanning only
// os-core/ would silently leave the largest body of shareable content ungated.
//
// Usage:
//   node scripts/export-check.js                    # default: the full bundle (both paths)
//   node scripts/export-check.js <bundle-path>      # scan one explicit path instead
//
// Exit codes: 0 = clean (safe to share) · 1 = leak(s) found · 2 = usage/IO error.
// Reads (optional): config/businesses.md — the list of private slugs to forbid in the bundle.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_BUNDLE = ['os-core', path.join('.claude', 'skills')];
const bundleArg = process.argv[2];
const BUNDLES = (bundleArg ? [bundleArg] : DEFAULT_BUNDLE).map((p) => path.resolve(ROOT, p));

const SKIP_DIRS = new Set(['.git', 'node_modules', '.secrets', 'ms-playwright']);
const TEXT_EXT = new Set([
  '.md', '.markdown', '.txt', '.js', '.mjs', '.cjs', '.ts', '.json', '.yml', '.yaml',
  '.toml', '.env', '.sh', '.ps1', '.css', '.html', '.csv', '',
]);

// Secret-shaped patterns. Kept tight to avoid false positives that would block a legit share.
const SECRET_PATTERNS = [
  { name: 'private key block', re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: 'OpenAI key', re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { name: 'Anthropic key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { name: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
  { name: 'Slack token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{30,}\b/ },
  { name: 'generic secret assignment', re: /\b(?:api[_-]?key|secret|token|password|passwd|bearer)\b\s*[:=]\s*['"][^'"\s]{8,}['"]/i },
];

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return out;
  }
  for (const ent of entries) {
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walk(path.join(dir, ent.name), out);
    } else if (ent.isFile()) {
      if (TEXT_EXT.has(path.extname(ent.name).toLowerCase())) {
        out.push(path.join(dir, ent.name));
      }
    }
  }
  return out;
}

// Private slugs to forbid inside the shareable bundle. config/businesses.md is the registry;
// expected format = markdown list items, one slug per line, e.g. "- `acme-app` — ...".
function loadForbiddenSlugs() {
  const reg = path.resolve(ROOT, 'config', 'businesses.md');
  if (!fs.existsSync(reg)) return { slugs: [], note: 'no config/businesses.md to read slugs from.' };
  const text = fs.readFileSync(reg, 'utf8');
  const slugs = new Set();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*[-*]\s*`?([a-z0-9][a-z0-9-]{1,})`?/);
    if (m) slugs.add(m[1]);
  }
  return { slugs: [...slugs], note: null };
}

function scan() {
  const files = BUNDLES.reduce((acc, b) => walk(b, acc), []);
  const { slugs, note } = loadForbiddenSlugs();
  const slugRes = slugs.map((s) => ({ slug: s, re: new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`) }));
  const hits = [];

  for (const file of files) {
    let lines;
    try {
      lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    } catch (e) {
      continue;
    }
    const rel = path.relative(ROOT, file);
    lines.forEach((line, i) => {
      for (const p of SECRET_PATTERNS) {
        if (p.re.test(line)) hits.push({ kind: 'secret', label: p.name, file: rel, line: i + 1 });
      }
      for (const s of slugRes) {
        if (s.re.test(line)) hits.push({ kind: 'slug', label: `business slug "${s.slug}"`, file: rel, line: i + 1 });
      }
    });
  }
  return { files, hits, note, slugsChecked: slugs.length };
}

function main() {
  // Every declared path must exist. A silently-skipped bundle path is exactly the failure
  // this gate exists to prevent, so a missing one is a hard error, not a warning.
  for (const b of BUNDLES) {
    if (!fs.existsSync(b)) {
      console.error(`export-check: bundle path not found: ${b}`);
      process.exit(2);
    }
  }
  console.log(`export-check — scanning: ${BUNDLES.map((b) => path.relative(ROOT, b) || '.').join(' + ')}`);
  const { files, hits, note, slugsChecked } = scan();
  console.log(`  scanned ${files.length} text file(s).`);
  // Two scans run here, and only one of them always can. Reporting a single verdict let the
  // clean result speak for a slug check that never ran — which is how ported-in business
  // content reached the shareable bundle unflagged.
  console.log(`  secrets: scanned`);
  console.log(slugsChecked
    ? `  slugs:   scanned against ${slugsChecked} known slug(s)`
    : `  slugs:   NOT CHECKED — ${note}`);

  if (hits.length === 0) {
    if (slugsChecked) {
      console.log('\n✅ CLEAN — no secrets or private slugs found. Safe to share the bundle.');
    } else {
      console.log('\n⚠️  PARTIAL — no secrets found, but the slug scan did not run.');
      console.log('   Business names ported in from an instance would not be caught here.');
    }
    process.exit(0);
  }

  console.error(`\n❌ LEAK — ${hits.length} potential exposure(s) found:`);
  for (const h of hits) {
    console.error(`  [${h.kind}] ${h.label}  →  ${h.file}:${h.line}`);
  }
  console.error('\nRedact these before sharing the bundle. (SAF-1 / ARC-4)');
  process.exit(1);
}

main();
