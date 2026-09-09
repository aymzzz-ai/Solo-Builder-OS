// session-end-harvest — Claude Code SessionEnd hook adapter (ARC-2).
//
// A hook runs a shell command, NOT a model turn, so it cannot itself produce the
// approve-gated harvest draft. Instead it MARKS the session pending in the cadence ledger
// (meta/routines-state.md); /brief then surfaces "unharvested session since <date> — run
// /harvest?" and the draft is produced when the user next runs /harvest (its normal
// draft→approve flow). This preserves the "never a silent write" guarantee (INT-2).
//
// The manual /harvest command is the portable fallback, so core behaviour never depends on
// this hook existing. Wired per-instance via .claude/settings.json (emitted by
// project-contract.js). Robust + non-fatal by design: it must never disrupt a session.

const fs = require('fs');
const path = require('path');

const INSTANCE = path.resolve(__dirname, '..', '..'); // <instance>/scripts/hooks → instance root
const LEDGER = path.join(INSTANCE, 'meta', 'routines-state.md');
const PENDING = '  ← PENDING: unharvested session since';

function today() {
  return new Date().toISOString().slice(0, 10);
}

try {
  if (!fs.existsSync(LEDGER)) {
    // Not a conforming instance (no ledger) — nothing to mark.
    process.exit(0);
  }
  const d = today();
  const lines = fs.readFileSync(LEDGER, 'utf8').split('\n');
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^- harvest\s*\|/.test(lines[i])) {
      const last = (lines[i].match(/last:\s*(\d{4}-\d{2}-\d{2})/) || [, d])[1];
      lines[i] = `- harvest      | weekly    | last: ${last}${PENDING} ${d}`;
      found = true;
      break;
    }
  }
  if (!found) {
    // No harvest line yet — append one in a pending state.
    lines.push(`- harvest      | weekly    | last: ${d}${PENDING} ${d}`);
  }
  fs.writeFileSync(LEDGER, lines.join('\n'), 'utf8');
  console.log(`session-end-harvest: marked harvest pending (${d}).`);
} catch (e) {
  // Never fail a session over a bookkeeping stamp.
  console.error(`session-end-harvest: skipped (${e.message}).`);
}
process.exit(0);
