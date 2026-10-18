import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRow, validateDenominator, comparable, VERDICTS, CLAIM_KINDS } from '../src/schema.mjs';

const goodRow = () => ({
  id: 'r1', task: 't', subject: 's', claim: 'CERTIFIED', verdict: 'PASS',
  tolerance: { disagreements: 0 },
  denominator: { records: 100, participants: 3, corpus: 'c@v1' },
  receipt: { at: '2026-10-18T00:00:00Z', command: 'node x.mjs', source: 'repo', sha: 'abc1234' },
});

test('a row with a denominator, a tolerance and a receipt is valid', () => {
  assert.deepEqual(validateRow(goodRow()), []);
});

test('THE ROW WITHOUT A DENOMINATOR IS REFUSED', () => {
  // "a number without a denominator is a slogan"
  const r = goodRow(); delete r.denominator;
  const e = validateRow(r);
  assert.ok(e.length > 0);
  assert.match(e.join(' '), /denominator/);
});

test('a denominator missing one of its three parts is refused', () => {
  const e = validateDenominator({ records: 10, participants: 2 });
  assert.ok(e.some((x) => /corpus/.test(x)));
});

test('a denominator of zero records is refused -- a score over nothing is not a score', () => {
  const e = validateDenominator({ records: 0, participants: 2, corpus: 'c' });
  assert.ok(e.some((x) => /records/.test(x)));
});

test('a PASS without a declared tolerance is refused', () => {
  const r = goodRow(); delete r.tolerance;
  assert.ok(validateRow(r).some((x) => /tolerance/.test(x)));
});

test('a row without a receipt is refused -- a row that cannot be re-derived is a story', () => {
  const r = goodRow(); delete r.receipt;
  assert.ok(validateRow(r).some((x) => /receipt/.test(x)));
});

test('a receipt with no sha and no runId is refused', () => {
  const r = goodRow(); delete r.receipt.sha;
  assert.ok(validateRow(r).some((x) => /sha or runId/.test(x)));
});

test('an unknown claim kind is refused', () => {
  const r = goodRow(); r.claim = 'PROBABLY';
  assert.ok(validateRow(r).some((x) => /claim/.test(x)));
});

test('NOT_MEASURED is a verdict, and it is distinct from FAIL', () => {
  // The whole point. A measurement that did not happen is not a failure
  // of the subject and not a disagreement between subjects.
  assert.notEqual(VERDICTS.NOT_MEASURED, VERDICTS.FAIL);
  assert.ok(VERDICTS.NOT_MEASURED);
});

test('the three claim kinds are the ones the fleet already uses', () => {
  assert.deepEqual(Object.keys(CLAIM_KINDS).sort(), ['ASSERTED', 'CERTIFIED', 'OBSERVED']);
});

test('rows over different denominators are NOT comparable', () => {
  const a = goodRow(); const b = goodRow();
  b.denominator.records = 200;
  assert.equal(comparable(a, b), false);
});

test('rows over the same denominator and task ARE comparable', () => {
  assert.equal(comparable(goodRow(), goodRow()), true);
});
