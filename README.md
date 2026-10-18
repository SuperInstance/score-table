# score-table

**A score table for the `SuperInstance` fleet, on the parts that already
work.**

There was no live score table anywhere in the fleet. A measurement pass over
all ~5,300 repositories found: `"score table"` -> 0 hits and `"planned
denominator"` -> 0 hits account-wide; the 23 `score` hits in
`quilt-live-canon/worker.js` are **cosine similarity for search ranking**;
and `quilt-claw/packages/eval/` does not exist on any of its 3 branches.

So this was not generalised from something. It was built, out of the
instruments that do exist.

## What it is

A **schema for a row**, a scorer that refuses rows that lie, a CLI that
prints the table, and a directory of **real measured rows**.

It does not own the measurement. `gitpp-oracle` owns that. This repo
**reads** the oracle's output.

```
$ node bin/score-table.mjs --quorum
TASK                         CLAIM       VERDICT         RECORDS  PARTS  FLAGS
-------------------------------------------------------------------------------------
gitpp.leaf.encoding          CERTIFIED   PASS              20043     5
gitpp.fold.semantics         CERTIFIED   PASS                 29     5
gitpp.fold.semantics         CERTIFIED   NOT_MEASURED         29     3
-------------------------------------------------------------------------------------
2 pass, 0 fail, 1 not-measured  (of 3 row(s))

QUORUM (rows that share a task AND a denominator AND a claim kind):
  gitpp.leaf.encoding [CERTIFIED] 1 pass / 0 fail / 0 not-measured over 20043 records x 5 participants
  gitpp.fold.semantics [CERTIFIED] 1 pass / 0 fail / 0 not-measured over 29 records x 5 participants
```

## The five rules, and why each one is a rule the fleet already believes

| rule | the house sentence behind it |
|---|---|
| **every row declares its denominator** — record count, participant count, corpus version | *a number without a denominator is a slogan* |
| **pre-registered** — tolerance and denominator fixed **before** the run; a row that changes them afterwards is FLAGGED | *a scoreboard that moves its yardstick is the fleet's own trick with new clothes* |
| **a score is model-against-task**, never model-against-itself | *never price a cheaper different answer* |
| **a receipt chain per row** — run id, sha, timestamp, the exact command | *a row that cannot be re-derived is a story, not a measurement* |
| **claim kinds stay separate** — CERTIFIED / ASSERTED / OBSERVED | they are not the same kind of number and are never averaged together |

## The third verdict, which is the reason this repo exists

`PASS`, `FAIL`, and **`NOT_MEASURED`**.

`NOT_MEASURED` means: *the measurement did not happen.* A participant was
absent, a corpus was empty, a tool errored. **It is not a failure of the
subject, and it is not a disagreement between subjects.**

The shipped data contains the counterexample, and it is a real one:

The fold suite was run with the C# and C participants not built. The suite
itself reported the absence correctly —

```
FAIL d29-unlicensed-action-is-orphaned  [participants missing: cs, c]
0 pass, 29 fail, 0 skip (of 29)
```

— and exited 1. **Then `gitpp-oracle` re-labelled it** `status: "divergence"`,
printed `NEW: fold: divergence not in known-limitations.json`, and concluded
`ORACLE: FAIL (new divergence)`.

**Two ports were never run, and the oracle called that a disagreement
between ports** — and put it in the `newDivergences` bucket, which is
exactly the bucket a human reads to decide *which port is wrong*. It would
send someone hunting a C# bug that does not exist.

With `cs` and `c` built, the same suite is **29/29 green**, and the same
oracle run is:

```
leaf: green (20043/20043)
fold: green (29/29)
ORACLE: green
```

**The instrument had the truth and the wrapper threw it away.** So this
table refuses to average a `NOT_MEASURED` row into a quorum, keeps it out
of the `PASS` count, and exits non-zero while a measurement is outstanding.

## What this table does NOT say

Be clear about the limits; a table that oversells is the defect.

- **It has three rows.** One strong measurement, one strong measurement,
  and one counterexample. That is a schema and a proof, not a scoreboard.
- **It measures the fleet's conformance, not the fleet's quality.** A
  cross-port differential says the ports agree. It says nothing about
  whether the spec is right, or whether the ports are useful.
- **`hub` is `unknown` in every row.** The oracle's sixth participant is
  optional and CI never clones it, so the hub row is a claim CI does not
  take. It is recorded honestly as `unknown` rather than as a pass.
- **The denominator is what the row was measured over, not a guarantee of
  coverage.** 20,043 records is the corpus the generator produces; it is
  not 20,043 *independent* things, and the corpus is generated, so a
  systematic generator bias would move every port the same way and agree
  with itself. **A cross-port differential cannot catch a shared
  misunderstanding.**
- **`PASS` means "met its pre-registered tolerance", not "correct".** The
  tolerance is 0 disagreements among the ports. It says the ports agree.

## Re-deriving the rows

The rows in `data/rows.jsonl` were produced by a real local run of the
oracle against a real family of checkouts:

```bash
# the family
for pair in "git.pp-doctor gitpp-doctor" "gitpp-js gitpp-js" "gitpp-cs gitpp-cs" \
            "gitpp-pl gitpp-pl" "gitpp-c gitpp-c" \
            "gitpp-cross-port gitpp-cross-port" \
            "gitpp-fold-conformance gitpp-fold-conformance" "gitpp-oracle gitpp-oracle"; do
  set -- $pair
  git clone --depth 1 https://github.com/SuperInstance/$1.git $2
done

# the corpus -- 20,043 records
mkdir -p /tmp/gitpp-fuzz && cd gitpp-cross-port && python3 generate.py
cp /tmp/gitpp-fuzz/records.json /tmp/corpus.json

# the builds
cd gitpp-cross-port && gcc -O2 -o CLleaf CLleaf.c -lm
cd ../gitpp-c && make
cd ../gitpp-fold-conformance && dotnet build wrappers/CsDerive

# the run
cd ../gitpp-oracle
ORACLE_CORPUS=/tmp/corpus.json GITPP_C_BIN=$PWD/../gitpp-c/gitpp node oracle.mjs run
```

> **One environment trap worth recording:** `dotnet build` fails with
> `NuGet.Config is not valid XML. Path: '/workspace/.home/.nuget/NuGet/NuGet.Config'`
> when `HOME` points at the over-quota `/workspace` NFS. `HOME=/tmp/home`
> fixes it. **A build failure can be a filesystem failure, and the error
> message will not say so.**

## Tests

```bash
node --test "test/*.test.mjs"
```

23 tests. The load-bearing ones:

- **the row without a denominator is refused**
- **a denominator of zero records is refused** — a score over nothing is not a score
- **a PASS without a declared tolerance is refused**
- **a row without a receipt is refused**
- **an underpowered row is demoted to `NOT_MEASURED` whatever it claims**
- **a `NOT_MEASURED` row does not pollute a quorum over the same task**
- **a quorum never mixes claim kinds**
- **the CLI exits non-zero while a measurement is outstanding**

> The test script is `node --test "test/*.test.mjs"` with the glob
> **quoted**. `node --test test/` resolves the directory as a module path
> and runs one broken test; the glob must be quoted so node expands it.

## Layout

```
src/schema.mjs            the row schema; validateRow refuses what lies
src/pre-registration.mjs   the yardstick fixed in advance; drift detection
src/score.mjs              grouping, quorum, rendering
bin/score-table.mjs        the CLI
data/rows.jsonl            real measured rows
data/pre-registration.json the declared floors and tolerances
test/                      23 tests
```

## Licence

MIT.
