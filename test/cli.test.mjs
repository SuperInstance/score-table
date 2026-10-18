import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../bin/score-table.mjs', import.meta.url));

test('the CLI prints a table and exits non-zero while a measurement is missing', () => {
  let out = '', code = 0;
  try { out = execFileSync('node', [CLI], { encoding: 'utf8' }); }
  catch (e) { out = e.stdout || ''; code = e.status; }
  assert.match(out, /TASK/);
  assert.match(out, /gitpp\.leaf\.encoding/);
  assert.match(out, /not-measured/);
  assert.notEqual(code, 0, 'a table with an unmeasured row must not exit 0');
});
