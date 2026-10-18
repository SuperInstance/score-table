// The scorer. It reads rows, refuses the ones that lie, and prints a table.
//
// It does NOT average across claim kinds (CERTIFIED/ASSERTED/OBSERVED are
// different kinds of number) and it does NOT average across denominators
// (a run over 200 records and a run over 20,043 are different
// measurements). A score is a model against a TASK, over a declared
// denominator, against a tolerance fixed in advance.

import { validateRow, comparable, VERDICTS, CLAIM_KINDS } from './schema.mjs';
import { checkPreRegistration, isUnderpowered } from './pre-registration.mjs';

export function loadRows(text) {
  return text.split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

// Partition by task, because a task is what a score is ABOUT. Two rows on
// different tasks are two rows.
export function groupByTask(rows) {
  const m = new Map();
  for (const r of rows) {
    if (!m.has(r.task)) m.set(r.task, []);
    m.get(r.task).push(r);
  }
  return m;
}

// The table is honest about absence. A task with no row is NOT PASS and
// NOT FAIL: it is a task nobody measured, and the table says so.
export function buildTable(rows, prs = {}) {
  const out = [];
  for (const [task, rs] of groupByTask(rows)) {
    for (const row of rs) {
      const errors = validateRow(row);
      const flags = checkPreRegistration(row, prs[task]);
      out.push({
        ...row,
        _valid: errors.length === 0,
        _errors: errors,
        _flags: flags,
        _underpowered: isUnderpowered(row, prs[task]),
        // A row that is underpowered is, whatever it claims, NOT_MEASURED
        // for the purposes of a quorum: the measurement did not meet the
        // bar that was set for it in advance.
        _effectiveVerdict: isUnderpowered(row, prs[task]) ? VERDICTS.NOT_MEASURED : row.verdict,
      });
    }
  }
  return out;
}

// A quorum needs rows that (a) are valid, (b) share a denominator, and
// (c) are the same claim kind. Mixing a CERTIFIED row with an ASSERTED
// one to reach a quorum is how a quorum is faked.
export function quorum(table, { claim } = {}) {
  const usable = table.filter((r) => r._valid && !r._underpowered && (!claim || r.claim === claim));
  const buckets = new Map();
  for (const r of usable) {
    const k = `${r.task}|${r.denominator.records}|${r.denominator.participants}|${r.denominator.corpus}`;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(r);
  }
  const out = [];
  for (const [k, rs] of buckets) {
    const kinds = new Set(rs.map((r) => r.claim));
    out.push({
      task: rs[0].task,
      claim: claim || [...kinds].join('+'),
      rows: rs.length,
      mixedClaimKinds: kinds.size > 1,
      denominator: rs[0].denominator,
      pass: rs.filter((r) => r.verdict === VERDICTS.PASS).length,
      fail: rs.filter((r) => r.verdict === VERDICTS.FAIL).length,
      notMeasured: rs.filter((r) => r.verdict === VERDICTS.NOT_MEASURED).length,
      comparable: rs.every((r) => comparable(r, rs[0])),
    });
  }
  return out;
}

export function renderTable(table) {
  const w = (s, n) => String(s ?? '').padEnd(n).slice(0, n);
  const L = [];
  L.push('TASK                         CLAIM       VERDICT         RECORDS  PARTS  FLAGS');
  L.push('-' + '-'.repeat(84));
  for (const r of table) {
    const flags = [...r._flags, ...r._errors].join('; ');
    L.push(
      `${w(r.task, 28)} ${w(r.claim, 11)} ${w(r._effectiveVerdict, 15)} ` +
      `${String(r.denominator.records ?? '?').padStart(7)} ${String(r.denominator.participants ?? '?').padStart(5)}  ${flags}`
    );
  }
  const measured = table.filter((r) => r._effectiveVerdict === VERDICTS.PASS).length;
  const failed = table.filter((r) => r._effectiveVerdict === VERDICTS.FAIL).length;
  const notMeasured = table.filter((r) => r._effectiveVerdict === VERDICTS.NOT_MEASURED).length;
  L.push('-'.repeat(84));
  L.push(`${measured} pass, ${failed} fail, ${notMeasured} not-measured  (of ${table.length} row(s))`);
  const invalid = table.filter((r) => !r._valid).length;
  if (invalid) L.push(`${invalid} row(s) REFUSED by the schema -- a row that does not declare its denominator, tolerance and receipt is not a row.`);
  return L.join('\n');
}
