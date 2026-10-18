#!/usr/bin/env node
// The test runner.
//
// `node --test "test/*.test.mjs"` works on Node 21+ (node expands the
// glob) and FAILS on Node 20 (node treats the quoted glob as a literal
// path and finds no file). The CI matrix caught exactly that: node 20
// failed, node 22 passed, on the same commit.
//
// So the glob is not the mechanism. The mechanism is: ENUMERATE the
// directory and pass explicit paths. That works on every Node version and
// every platform, and it also means a test file that no script names is
// impossible -- a file dropped into test/ is picked up automatically.

import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(HERE)
  .filter((f) => f.endsWith('.test.mjs'))
  .sort()
  .map((f) => join(HERE, f));

if (!files.length) {
  console.error('no test files found in ' + HERE);
  process.exit(1);
}
console.log(`running ${files.length} test file(s): ${files.map((f) => f.split('/').pop()).join(', ')}`);
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(r.status ?? 1);
