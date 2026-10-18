import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTable, quorum, renderTable, loadRows } from '../src/score.mjs';
import { readFileSync } from 'node:fs';
import { validateRow } from '../src/schema.mjs';

const row = (over = {}) => ({
  id: 'r', task: 't', subject: 's', claim: 'CERTIFIED', verdict: 'PASS',
  tolerance: { x: 0 },
  denominator: { records: 10, participants: 2, corpus: 'c' },
  receipt: { at: '2026-10-18T00:00:00Z', command: 'x', source: 's', sha: 'a' },
  ...over,
});

const PR = { t: { minRecords: 5, minParticipants: 2, tolerance: { x: 0 }, corpus: 'c' } };

test('an underpowered row is demoted to NOT_MEASURED whatever it claims', () => {
  const t = buildTable([row({ denominator: { records: 2, participants: 2, corpus: 'c' } })], PR);
  assert.equal(t[0]._effectiveVerdict, 'NOT_MEASURED');
  assert.ok(t[0]._flags.some((f) => /UNDERPOWERED/.test(f)));
});

test('a row under the participants floor is NOT_MEASURED', () => {
  const t = buildTable([row({ denominator: { records: 10, participants: 1, corpus: 'c' } })], PR);
  assert.equal(t[0]._effectiveVerdict, 'NOT_MEASURED');
});

test('a row whose tolerance drifted from its pre-registration is FLAGGED', () => {
  const t = buildTable([row({ tolerance: { x: 99 } })], PR);
  assert.ok(t[0]._flags.some((f) => /METER_DRIFT/.test(f)));
});

test('an identical tolerance is NOT flagged as drift', () => {
  // A reference comparison reports drift on two structurally identical
  // tolerances, and a table that cries drift on every row is one nobody
  // reads.
  const t = buildTable([row()], PR);
  assert.ok(!t[0]._flags.some((f) => /METER_DRIFT/.test(f)));
});

test('a row over a different corpus than pre-registered is FLAGGED', () => {
  const t = buildTable([row({ denominator: { records: 10, participants: 2, corpus: 'other' } })], PR);
  assert.ok(t[0]._flags.some((f) => /CORPUS_DRIFT/.test(f)));
});

test('a NOT_MEASURED row does not pollute a quorum over the same task', () => {
  // THE COUNTEREXAMPLE, as a test. The not-measured row is on the same
  // task but a different denominator, so it must not be counted in the
  // quorum that says the task passed.
  const rows = [
    row({ id: 'pass', verdict: 'PASS' }),
    row({ id: 'nm', verdict: 'NOT_MEASURED', denominator: { records: 10, participants: 1, corpus: 'c' } }),
  ];
  const t = buildTable(rows, PR);
  const q = quorum(t);
  assert.equal(q.length, 1);
  assert.equal(q[0].pass, 1);
  assert.equal(q[0].notMeasured, 0);
});

test('a quorum never mixes claim kinds', () => {
  const t = buildTable([
    row({ id: 'c', claim: 'CERTIFIED' }),
    row({ id: 'a', claim: 'ASSERTED' }),
  ], PR);
  const q = quorum(t, { claim: 'CERTIFIED' });
  assert.equal(q.length, 1);
  assert.equal(q[0].rows, 1);
});

test('the render says how many were not measured', () => {
  const t = buildTable([row({ verdict: 'NOT_MEASURED', denominator: { records: 10, participants: 1, corpus: 'c' } })], PR);
  assert.match(renderTable(t), /1 not-measured/);
});

test('the shipped data loads and every row is schema-valid', () => {
  const rows = loadRows(readFileSync(new URL('../data/rows.jsonl', import.meta.url), 'utf8'));
  assert.ok(rows.length >= 3);
  for (const r of rows) assert.deepEqual(validateRow(r), [], `row ${r.id} must be schema-valid`);
});

test('the shipped data contains the counterexample: a NOT_MEASURED fold row', () => {
  const rows = loadRows(readFileSync(new URL('../data/rows.jsonl', import.meta.url), 'utf8'));
  const nm = rows.find((r) => r.verdict === 'NOT_MEASURED');
  assert.ok(nm, 'the table must ship the row that proves NOT_MEASURED is needed');
  assert.match(nm.note, /participants missing/);
});
