# Fixpoint r21 — COR audit (blind) of commit be30c152 (the r20 adjudication batch)

Auditor role: COR (correctness/regression). Blind to other waves' findings.
Attacked: the widened `WorkerLaneAdvance.ts` guard (magnitude pins
`|stamp| >= 2^53` on `emptyLaneStartMs` and pending dues, ordering pin
`completesAtMs <= startedAtMs`, non-finite `nowMs`/`slots`/`budgetMs`;
zero-advance preserves lanes verbatim), the r18+r19 surface at the new
tip (seeded re-stamp, jump arm, forfeit parity, TLT bounds, per-site
isolation under the widened deny), the flipped r20 pins in
`fixpointR20Cor.qa.test.ts` / `auditR20Aut.probe.test.ts` (pin-strength
check), and sibling settle loops in the same `stamp + span` class
(DecomposeSystem fast-forward, alchemy jobs, autofarm tick, daily
reset, player timed-effects).

Verdict: **FAIL WITH REASON** — 1 Medium (validator/mechanism seam: a
pending pair with `|stamps| >= 2^53` but span-exact ulp-multiple is
admitted by `validateGameSaveShape`, then zero-advances forever in BOTH
drivers — a permanent silent site freeze with no eviction path), 2 Low
(`nowMs` is the one guard input without a magnitude pin — the same
absorbing hang, mechanism-level only; and deny-preserve writes a
next-boot-invalid save for crafted near-`2^53` stamps), 3 Nit
(decompose fast-forward ~150ms stall on crafted `nextCycleAt = 0`; the
r20 `pkill -f <spec-name>` cleanup can kill its own run when both
files are listed; the flipped `ProductionOffline.test.ts` deny specs
never assert `consumedBudgetMs === 0` while carrying a budget). The
widened guard itself verifies correct on every questioned axis —
`2^53` is the tight boundary for integer-ms arithmetic, no honest
shape breaks, `.some()` is union-deny and order-independent, per-site
isolation confirmed.

Repro evidence: `game/src/services/save/auditR21Cor.probe.test.ts` —
7 deterministic probes, all green on be30c152 (the two defect probes
assert the deny/absence state the audit found, and flip red the moment
a fix lands). Helper spec `auditR21CorNowMsHang.probe.test.ts` is
env-gated (`R21_NOWMS_HANG_PROBE`) so the hang child can never stall a
normal run. Scoped run `npx vitest run src/services/save/auditR21Cor.
probe.test.ts src/services/save/fixpointR20Cor.qa.test.ts src/services/
save/auditR20Aut.probe.test.ts src/core/production/ProductionOffline.
test.ts`: **all pass**. `npm run type-check` clean.

## Boundary verdict — is 2^53 right? (scope 1)

Measured directly on this runtime:

```
(2**53) + 1      === 2**53   // ulp(2^53) = 2, +1ms rounds to even -> absorbs
(2**53 - 1) + 1  === 2**53   // one ulp inside: still exact
4500000000000000 + 100000    // < 2^53: exact
22000ms absorbs only at ~1.18e21 (probe loop, see spec)
```

For integer-ms arithmetic the pin is exactly tight: the smallest
integer delta (+1) absorbs at exactly `2^53`, and every integer-ms
`stamp +/- delta` below `2^53` is exact. For the authored minimum
`cycleMs` (mortal base 100s at lvl 9 -> 22,000ms) the true absorb
threshold is ~`1.18e21` — so the pin errs strictly on the deny side
for that input, never admits an absorbing stamp, and honest stamps
(`Date.now()` ~ `1.7e12`; re-stamp shifts bounded by
`Date.now() - nowMs` -> ~ `3.5e12` worst case) sit ~4 orders of
magnitude inside. **No legit path to a >2^53 stamp exists**: the only
stamp writer is `buildProductionCycle` (`nowMs + authored span <=
656_100_000ms`), the seeded re-stamp adds `max(0, Date.now() - nowMs)`
(bounded by wall clock), and no migration mints raw stamps.

**Honest-shape fallout from the pending magnitude pin: none found.**
Authored spans are integer seconds * 1000 (all < `2^53` by ~15 orders);
migrated/legacy payloads flow through the same validator pins
(ordering + exact span + `startedAtMs <= lastSavedAt`); a legacy save
carrying stamps >= `2^53` was already corrupt under the ordering/span
pins. The `.some()` scan is a union-deny: ANY bad entry rejects the
whole call — order-independent by construction, and per-site isolation
(`settleWorkersOffline` maps over `advanceableStates` independently,
`consumedBudgetMs` is per-call) means one crafted site cannot starve
its siblings (verified by probe below).

## Confirmed findings

### R21-COR-1 — validator admits the >=2^53 shape the mechanism then freezes permanently: silent site death with no eviction path — Medium

The seam: `validateGameSaveShape` pins a `workerCycles` entry on
ordering (`completesAtMs > startedAtMs`), exact span
(`completes - started === computeCycleSeconds(base, siteLevelAtStart)
* 1000`), `startedAtMs <= lastSavedAt`, realm/level/rollSeed/lane
ceiling — but NO magnitude bound on the stamps themselves
(saveShapeValidation.ts production-cycle checks; `player.lastSavedAt`
is `isFiniteNumber`-only at :2297). A crafted pair
`{ startedAtMs: -9.1e15, completesAtMs: -9.1e15 + 100_000 }` has
`|stamp| >= 2^53` yet keeps the span exactly `100_000` (a multiple of
the representable ulp at that magnitude — verified:
`(-9.1e15 + 100_000) - (-9.1e15) === 100_000`).

Probe (`validator admits ... span-exact pending`, green):
`validateGameSaveShape` returns `ok: true` for the crafted save.

Then the mechanism — the probe (`the admitted shape freezes the site
in BOTH drivers, verbatim, forever`, green):

- `advanceWorkerLanes` (deadline, `budgetMs` provided) zero-advances:
  `completed`/`seededPending` empty, `pending` preserved verbatim.
- `advanceWorkerLanes` (`advanceMode: 'observe'`, the online
  `tickWorkers` path) — the SAME guard — also zero-advances. The site
  produces nothing in live play, not just offline.
- `settleProductionOffline` persists `result.pending` verbatim — the
  same object refs round-trip (`state.workerCycles[0] === crafted`),
  so the freeze survives every later save.

No code path removes a `workerCycles` entry: the only writers are
`state.workerCycles = result.pending` (ProductionOffline.ts:186) and
the cloned restore at ProductionSystem.ts:147 — the preserved lanes
are sticky by the deny design itself. A crafted-but-admitted save
leaves a site silently dead forever (no error, no recovery surface,
no eviction) — strictly worse UX than a validator rejection, which at
least lands the user on the corrupt-save recovery flow. Severity
Medium: reachability requires crafted data (no honest writer emits
these magnitudes), but the admitted-input -> permanent-silent-death
pipeline is a real availability defect in the save/settle contract.

Direction for the fixpoint (adjudication's call, not mine): either a
validator magnitude pin on the two stamps (aligning with the
mechanism's `2^53`), or per-lane drop instead of whole-call deny.
Note the accepted "preserve-then-persist atomicity" rationale from
the r20 adjudication only covers observation-time honesty — it did
not weigh the permanent-freeze consequence for ADMITTED inputs.

### R21-COR-2 — `nowMs` is the one guard input with finiteness but no magnitude pin: same absorbing loop, mechanism-level — Low

The guard pins magnitude on the two *stamp* inputs
(`emptyLaneStartMs`, pending dues) but checks `nowMs` for
`Number.isFinite` only (WorkerLaneAdvance.ts:135). At `nowMs = 1e300`
the r17 budget-exhaustion jump arm computes
`skippedDues = floor((nowMs - dueMs) / cycleMs) + 1` — finite — then
`lastDueMs = dueMs + (skippedDues - 1) * cycleMs` lands at ~`1e300`
where `ulp(1e300) >> cycleMs`: the reinserted cursor has
`dueMs + cycleMs === dueMs`, `headCost = 0`, `dueMs > nowMs` false —
the deadline loop then completes the identical cursor forever (cost 0,
budget never drains). Identical mechanism to r20-COR-1, reached
through a different unpinned input.

Evidence: env-gated child spec `auditR21CorNowMsHang.probe.test.ts`
never exits; the parent probe (`nowMs = 1e300 hangs the deadline
loop`) asserts the spawn is killed by timeout (status `null` +
SIGTERM or wrapper exit 143) — green on be30c152.

Reachability: NOT save-reachable today — every caller derives `nowMs`
from `Date.now()`/`authorityNowMs`/`settleNowMs` (min-clamped at the
authority window end, GameManagerSaveRestore.ts:410-429). Low: the
guard's stated purpose is future callers, and it bounds every other
input except the observation instant — a future caller passing an
uncapped clock reintroduces the exact hang r20 fixed.
(`budgetMs` is likewise unpinned for magnitude, but that IS semantic:
a 1e300ms budget legitimately authorizes ~1e295 cheap completions —
scale, not absorption. Not flagged as a defect.)

### R21-COR-3 — deny-preserve writes a next-boot-invalid save for crafted stamps inside the pin — Low

A pending pair with stamps inside `[~lastSavedAt_range, 2^53)` — e.g.
`{ startedAtMs: 9e15, completesAtMs: 9e15 + 100_000 }` — needs only a
crafted `player.lastSavedAt >= 9e15` (finite-only pinned, admitted) to
pass `startedAtMs <= lastSavedAt`. Settlement preserves the lane
verbatim (dues > now -> zero completions), the next autosave stamps
`lastSavedAt = Date.now()` (~1.7e12), and the NEXT boot's
`startedAtMs <= lastSavedAt` pin fails — the whole save is flagged
corrupt and drops into the recovery surface. The mechanism writes a
save its own validator will reject on next read. Crafted-input only;
the wedge is the preserve-verbatim choice interacting with an
asymmetric validator pin (upper-bound by `lastSavedAt`, which itself
has no upper bound). Low.

### R21-COR-4 — DecomposeSystem.settleOffline fast-forward: validator-admitted `nextCycleAt = 0` walks ~57M no-op iterations (~156ms) per boot — Nit

Sibling-class sweep result: the only other `stamp += span` loop is
`DecomposeSystem.ts:300` (`while (nextCycleAt <= fastForwardEndMs)
nextCycleAt += cycleMs`). The r12-INT bound caps the loop END
(`min(windowStartMs, nowMs)` — `nowMs - CAP*1000` floor) but not the
START distance: a restore payload `{ started: true, nextCycleAt: 0 }`
(admitted — `nextCycleAt` is non-negative-finite-pinned only) forces a
fast-forward from 0 to ~`nowMs` = ~5.7e7 `+=` iterations, measured
~156ms on this box, every boot. No absorption is possible (the loop
runs only below ~`nowMs` where `ulp << cycleMs`), and the settle phase
is separately capped at 5000 — so this is a finite stall, not the
hang class. Nit; worth a `max(0, min(nextCycleAt, nowMs))`-style floor
only if crafted saves are in scope.

### R21-COR-5 — r20 hang-probe cleanup `pkill -f <spec-name>` can kill the invoking run — Nit

`fixpointR20Cor.qa.test.ts:261` runs
`spawnSync('pkill', ['-f', 'fixpointR20CorSlotsHang'])` in a `finally`
to sweep orphaned hang workers. `-f` matches full cmdlines, and the
invoking vitest process carries the spec filenames on its own cmdline
when both files are listed in one invocation
(`vitest run fixpointR20Cor.qa.test.ts
fixpointR20CorSlotsHang.probe.test.ts`) — the pkill then kills the
parent run itself. Reproduced here: my initial copy of the pattern
made exactly this self-kill (run exits abnormally after listing both
files; works when the parent file runs alone). Bare `vitest run` has
no filename args and is unaffected, so CI is safe — but the pattern is
fragile and propagates via copy-paste. The r21 probe avoids it by
using `--pool=threads` for the child (timeout kill takes the looping
worker thread down with the process) plus a heap cap so the OOM
happens in ~5s instead of a ~4.4GB climb, and drops the name-pattern
pkill entirely.

### R21-COR-6 — flipped r20 deny specs under-assert `consumedBudgetMs` — Nit

The four new deny specs in `ProductionOffline.test.ts` (reversed/zero
span, `|emptyLaneStartMs| >= 2^53`, `|pending stamp| >= 2^53`,
non-finite `slots`) run with `budgetMs: 36_000_000` in `baseParams`
and pin `completed`/`pending`/`forfeited`/`seededPending` — but never
assert `consumedBudgetMs === 0`. The sibling flipped pin in
`auditR20Aut.probe.test.ts` (A2) does assert it. Symmetric coverage
would pin the "deny touches no budget" half of the contract. Nit —
the field is pinned by the literal `consumedBudgetMs: 0` in the
guard's return, so this is a pin-coverage nit, not a behavior hole.

## Verified clean (scope 2 + 3 + 4 summary)

- **r18/r19 surface at tip**: seeded re-stamp re-anchored at
  `fieldEpochShiftMs = max(0, Date.now() - nowMs)` and applies only to
  `seededPending` heads (ProductionOffline.ts:184-194); index-aligned
  (verified `seededHeads` membership by ref — preserved lanes keep the
  same object identity, probe asserts `toBe(crafted)`). Jump arm,
  forfeit parity, TLT bounds: r20-r19 test files all green at
  be30c152; no regression under the widened guard.
- **Per-site isolation** (the scope-2 question): probe proves a
  crafted-pending site zero-advances verbatim while the sibling site
  settles its due head and respawns its successor on the same budget
  — deny is per-call/per-site, `consumedBudgetMs` attribution is
  per-call.
- **Flipped pins are STRONG**: `fixpointR20Cor.qa.test.ts` asserts the
  exact deny state — `lastSavedAt === -1e308` verbatim through
  normalization, `settled === 0 && completions === 0` with an rng
  counter proving the loop never ran, empty `completed`/`pending`
  verbatim, and the child-process probe asserts `status === 0` within
  timeout (flips red on the hang, not just on throw). A2 pin in
  `auditR20Aut.probe.test.ts` asserts `completed`/`forfeited`/
  `consumedBudgetMs === 0` AND `pending toEqual([crafted])` verbatim.
- **Sibling sweep**: alchemy jobs (one-shot per job), autofarm tick
  (cycleSeconds >= 1s floor + 24h cap + anchor re-clamp before
  payout), daily reset (day-bucket compare), `OfflineProgress`
  (multiplication, no loop), `boundTimedEffectClocks`/
  `payoutExpiresAtMs` (`min()` clamps, no loop). Only DecomposeSystem
  shares the class — see R21-COR-4.
- **Ordering pin honest-shape check**: no honest or migrated writer
  emits `completesAtMs <= startedAtMs` (single writer is
  `buildProductionCycle` at `nowMs + seconds*1000`, `seconds > 0`).
