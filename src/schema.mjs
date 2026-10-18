// A score-table row. The schema is the product: everything the fleet's
// scoreboards have historically been missing is a REQUIRED field, not an
// optional one.
//
//   "a number without a denominator is a slogan"
//   "a scoreboard that moves its yardstick is the fleet's own trick with new clothes"
//   "a row that cannot be re-derived is a story, not a measurement"
//
// So: a row that does not declare what it was measured OVER, what tolerance
// was fixed IN ADVANCE, and how to re-derive it, is not a row. It is refused.

// The three kinds of claim the fleet already separates elsewhere
// (gitpp-sheet's ledger, AI-Writings' dispatch ledger). They are not the
// same kind of number and are never averaged together.
export const CLAIM_KINDS = Object.freeze({
  CERTIFIED: 'CERTIFIED', // measured against a real artifact
  ASSERTED: 'ASSERTED',   // an edge nobody checked
  OBSERVED: 'OBSERVED',   // seen, not re-checkable
});

// The three verdicts a measurement can have. The third is the one every
// scoreboard in this fleet has been missing, and it is the whole point:
//
//   PASS     the measurement happened and met its tolerance
//   FAIL     the measurement happened and did not meet its tolerance
//   NOT_MEASURED
//            the measurement did NOT happen. A participant was absent, a
//            corpus was empty, a tool errored. This is NOT a failure of
//            the subject and it is NOT a disagreement between subjects.
//
// Conflating NOT_MEASURED with FAIL is how a harness ends up reporting
// "the ports disagree" when two of them were never run. It is the
// difference between a measurement and a rumour.
export const VERDICTS = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_MEASURED: 'NOT_MEASURED',
});

// A denominator is REQUIRED and must be non-empty. There is no way to
// express "a score over an unknown number of things".
export function validateDenominator(d) {
  const e = [];
  if (!d || typeof d !== 'object') return ['denominator: missing (a score without a denominator is a slogan)'];
  for (const k of ['records', 'participants', 'corpus']) {
    if (d[k] === undefined || d[k] === null) e.push(`denominator.${k}: missing`);
  }
  if (d.records !== undefined && d.records !== null && !(Number.isInteger(d.records) && d.records > 0))
    e.push('denominator.records: must be a positive integer');
  if (d.participants !== undefined && d.participants !== null && !(Number.isInteger(d.participants) && d.participants > 0))
    e.push('denominator.participants: must be a positive integer');
  if (d.corpus !== undefined && d.corpus !== null && typeof d.corpus !== 'string')
    e.push('denominator.corpus: must be a string identifying the corpus version');
  return e;
}

export function validateReceipt(r) {
  const e = [];
  if (!r || typeof r !== 'object') return ['receipt: missing (a row that cannot be re-derived is a story)'];
  for (const k of ['at', 'command', 'source']) {
    if (!r[k]) e.push(`receipt.${k}: missing`);
  }
  if (r.at && !/^\d{4}-\d{2}-\d{2}T/.test(String(r.at))) e.push('receipt.at: not an ISO-8601 timestamp');
  if (!r.sha && !r.runId) e.push('receipt: needs at least one of sha or runId');
  return e;
}

export function validateRow(row) {
  const e = [];
  if (!row || typeof row !== 'object') return ['row: not an object'];
  for (const k of ['id', 'task', 'subject', 'claim', 'verdict', 'denominator', 'receipt']) {
    if (row[k] === undefined || row[k] === null) e.push(`${k}: missing`);
  }
  if (row.claim && !CLAIM_KINDS[row.claim]) e.push(`claim: must be one of ${Object.keys(CLAIM_KINDS).join('/')}`);
  if (row.verdict && !VERDICTS[row.verdict]) e.push(`verdict: must be one of ${Object.keys(VERDICTS).join('/')}`);
  e.push(...validateDenominator(row.denominator));
  e.push(...validateReceipt(row.receipt));
  if (row.verdict === VERDICTS.PASS && row.tolerance === undefined)
    e.push('tolerance: missing (a PASS without a declared tolerance is an opinion)');
  return e;
}

// Two rows are comparable only if they were measured over the SAME THING.
// A leaf run over 20,043 records and one over 200 records are not two
// scores; they are two different measurements, and averaging them is the
// trick.
export function comparable(a, b) {
  return a.denominator.records === b.denominator.records
    && a.denominator.participants === b.denominator.participants
    && a.denominator.corpus === b.denominator.corpus
    && a.task === b.task;
}
