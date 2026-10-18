// Pre-registration: the yardstick, fixed BEFORE the run.
//
// The fleet's own observation: a scoreboard that silently changes its
// yardstick after seeing the result is the fleet's old trick with new
// clothes. So the denominator floor and the tolerance are recorded in
// their own file, and a row that does not match its pre-registration is
// FLAGGED rather than quietly accepted.
//
// A pre-registration is not a promise that the row will pass. It is a
// statement of what would count as a pass, made before the answer was
// known.

// Deep equality for the tolerance objects. A reference comparison reports
// METER_DRIFT on two structurally identical tolerances, and a table that
// cries drift on every row is a table nobody reads.
export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual(a[k], b[k]));
}

export function checkPreRegistration(row, pr) {
  const flags = [];
  if (!pr) return ['pre-registration: none found for this task'];
  if (pr.minRecords !== undefined && row.denominator.records < pr.minRecords)
    flags.push(`UNDERPOWERED: ${row.denominator.records} record(s) measured against a declared floor of ${pr.minRecords}`);
  if (pr.tolerance !== undefined && !deepEqual(pr.tolerance, row.tolerance))
    flags.push(`METER_DRIFT: tolerance is ${JSON.stringify(row.tolerance)}, pre-registered as ${JSON.stringify(pr.tolerance)}`);
  if (pr.corpus !== undefined && row.denominator.corpus !== pr.corpus)
    flags.push(`CORPUS_DRIFT: corpus is ${row.denominator.corpus}, pre-registered as ${pr.corpus}`);
  return flags;
}

// A row measured with fewer participants than the pre-registration requires
// has not met the bar, whatever the verdict says.
export function isUnderpowered(row, pr) {
  if (!pr) return false;
  if (pr.minParticipants !== undefined && row.denominator.participants < pr.minParticipants) return true;
  if (pr.minRecords !== undefined && row.denominator.records < pr.minRecords) return true;
  return false;
}
