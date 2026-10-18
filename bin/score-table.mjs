#!/usr/bin/env node
// score-table -- print the fleet's score table.
//
//   node bin/score-table.mjs [--data <file>] [--json] [--quorum]
//
// Exit code is 0 when every row is valid and no row is FAIL or
// underpowered. A refused row is a failure of the TABLE, not of the
// subject, and it is reported as such.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadRows, buildTable, quorum, renderTable } from '../src/score.mjs';
import { VERDICTS } from '../src/schema.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const argv = process.argv.slice(2);
const arg = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : dflt; };
const has = (name) => argv.includes(name);

const dataPath = arg('--data', join(ROOT, 'data', 'rows.jsonl'));
const prPath = arg('--pr', join(ROOT, 'data', 'pre-registration.json'));
if (!existsSync(dataPath)) { console.error(`no rows at ${dataPath}`); process.exit(2); }

const rows = loadRows(readFileSync(dataPath, 'utf8'));
const prs = existsSync(prPath) ? JSON.parse(readFileSync(prPath, 'utf8')) : {};
const table = buildTable(rows, prs);

if (has('--json')) {
  console.log(JSON.stringify({ table, quorum: quorum(table) }, null, 2));
} else {
  console.log(renderTable(table));
  if (has('--quorum')) {
    console.log('\nQUORUM (rows that share a task AND a denominator AND a claim kind):');
    for (const q of quorum(table)) {
      console.log(`  ${q.task} [${q.claim}] ${q.pass} pass / ${q.fail} fail / ${q.notMeasured} not-measured` +
        ` over ${q.denominator.records} records x ${q.denominator.participants} participants` +
        (q.mixedClaimKinds ? '   <-- MIXED CLAIM KINDS, NOT A QUORUM' : '') +
        (q.comparable ? '' : '   <-- NOT COMPARABLE'));
    }
  }
}

const bad = table.filter((r) => !r._valid || r._underpowered || r.verdict === VERDICTS.FAIL);
process.exit(bad.length ? 1 : 0);
