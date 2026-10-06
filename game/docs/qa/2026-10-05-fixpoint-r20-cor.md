# Fixpoint r20 — COR audit (blind) of commit 060826af (the r19 adjudication batch)

Auditor role: COR (correctness/regression). Blind to other waves' findings.
Attacked: the `WorkerLaneAdvance.ts` non-finite input guard (rejects
non-finite `nowMs`/`budgetMs`/`emptyLaneStartMs` and any pending cycle
with non-finite `startedAtMs`/`completesAtMs`, zero-advance preserving
lanes), the r18 batch re-verified at the new tip (TLT bound re-anchor,
`LaneCursor.seeded`/`seededPending` re-stamp, widened jump guard, forfeit
parity), the two r19-COR deny pins, and sibling surfaces
(`settleWorkersOffline` budget drain, `GameManagerSaveRestore` restore
order, validator probes, decompose/autofarm/alchemy settles).

Verdict: **FAIL WITH REASON** — 1 High (crafted save wedges every boot in
an infinite zero-cost completion loop inside `advanceWorkerLanes`), 1 Low
(`slots` unchecked by the same guard class — `+Infinity` hangs the seed
loop; not client-reachable today). Everything else verified clean.

Repro evidence: `game/src/services/save/fixpointR20Cor.qa.test.ts` —
4 deterministic probes, all green on 060826af in the *red* direction the
audit cares about (they prove reachability + hang; they fail once the
defect class is fixed). Helper spec
`fixpointR20CorSlotsHang.probe.test.ts` is env-gated
(`R20_SLOTS_HANG_PROBE`) so the hang spec can never stall a normal run.
Scoped run `npx vitest run src/services/save/fixpointR20Cor.qa.test.ts
src/services/save/fixpointR19Cor.qa.test.ts src/core/production/
ProductionOffline.test.ts`: **24 pass.** `npm run type-check` clean.

## Confirmed findings

### R20-COR-1 — finite-but-FP-absorbing `emptyLaneStartMs` mints an infinite zero-cost completion loop; reachable from a crafted save, wedges every boot — High

The r19 guard (WorkerLaneAdvance.ts:123-138) checks *finiteness*, not
*magnitude*. The empty-lane seed arm computes

```
dueMs = emptyLaneStartMs + cycleMs      // WorkerLaneAdvance.ts:162
headCostMs = max(0, dueMs - startMs)    // WorkerLaneAdvance.ts:200
```

For `|emptyLaneStartMs|` large enough that `ulp(|start|) > 2 * cycleMs`,
the addition rounds back to `startMs` exactly — FP absorption. Threshold
for a 100s cycle: `|start| >= ~1.2e21` (ulp(2^70) = 262144 > 2e5); any
crafted marker like `-1e308` trivially qualifies. Then `headCostMs = 0`,
and on every while-loop iteration:

- `costMs = 0 <= budgetLeftMs` → the head *completes*, consuming 0 budget;
- `budgetLeftMs` never drains → the budget-exhaustion jump arm
  (`headCostMs > budgetLeftMs && cycleMs > budgetLeftMs`) can never arm;
- the deadline-mode respawn pushes the identical cursor
  (`startMs = dueMs = -1e308`, `dueMs = -1e308 + cycleMs = -1e308`) →
  `dueMs <= nowMs` forever → **the loop never exits**.

`buildProductionCycle` is invoked once per iteration, so `completed`
grows unboundedly in memory until OOM; `settleWorkersOffline` never
returns, so no rewards are actually granted — the practical effect is a
**hang**, not a mint. Deterministic probe: the rng stream (called only
by `buildProductionCycle`) is still being invoked after 2000
completions, then throws `STILL_LOOPING`. Control: `-1e15` / `-1e18` /
`-1e21` terminate correctly (360 completions then the jump arm covers
the remainder — at `-1e21` the addition rounds *up* to a +131072 head
cost, not zero).

**Reachability (crafted save → boot wedge):** the only writer of
`emptyLaneStartMs` is the offline settle chain
`GameManagerSaveRestore.restoreFromSave` → `ProductionSystem
.settleOffline` → `settleProductionOffline` → `settleWorkersOffline` →
`advanceWorkerLanes`. On the local-restore arm (no `timeAuthority`),
`elapsedOfflineSeconds` is computed uncapped
(`calculateOfflineTime(..., Number.POSITIVE_INFINITY)`,
GameManagerSaveRestore.ts:393-396) and

```
offlineSinceMs = min(lastSavedAt, authorityNowMs - elapsed*1000)
```

so `lastSavedAt = -1e308` yields `elapsed ≈ 1e305` and
`offlineSinceMs ≈ -1e308` — a finite value the guard admits. The
validator pins `player.lastSavedAt` to `isFiniteNumber` only
(saveShapeValidation.ts:2297) — no epoch sanity floor exists anywhere;
the probe's crafted save (`realmId: 'mortal'`, site `thanh_van_lam`
level 1 `autoRestart: true`, `workerCycles: []`) is accepted verbatim.
Once the save lands, **every subsequent boot re-derives the same
`-1e308` window and hangs inside settle** — unrecoverable without wiping
the save. (A legitimate save can never produce this: honest
`lastSavedAt` values come from `Date.now()`. This is the
malformed-input DoS class the r19-AUT note set out to close.)

Note the guard's premise — "upstream pins keep every input finite" — is
true but insufficient here: the absorbing `emptyLaneStartMs` is a
*derived* finite value, not a stamped field any validator could pin.

### R20-COR-2 — `slots` unchecked: `+Infinity` hangs the seed `for` loop — Low

Same guard, uncovered member of the same class: the seed loop
`for (count = lanes.length; count < slots; count += 1)` with
`slots = +Infinity` pushes lane cursors forever (OOM / no return —
proven by child-process probe: the spawned vitest on the env-gated spec
is killed by the 20s timeout; ETIMEDOUT). Not client-reachable today —
`sanitizeWorkerPoolInputs`/`resolveProductionWorkerCapacity` clamp the
pool to a small finite int before any call site — so this is purely the
defensive depth the r19 fix claimed to add, left incomplete. `NaN` and
`-Infinity` slots are benign (`count < NaN` is false → no seeds).

## Clean (audited, no defect)

- **Guard ordering**: the `.some()` scan and the scalar checks run
  *before* `lanes` is constructed (line 149) and before any mutation —
  zero-advance returns `pending: [...params.pending]` intact, so a
  transiently-bad input strands nothing: observe-mode callers write the
  same pending back and retry next tick; settle-mode callers re-derive
  the window per boot. No code path relied on unguarded pass-through.
- **NaN `cycleMs`/`baseSeconds`**: `canSpawn = cycleMs > 0 &&
  baseSeconds > 0` is false for NaN → no seeds; the while loop drains
  the bounded pending set and exits. The jump arm additionally requires
  `cycleMs > 0`, so `skippedDues` is only ever computed with a positive
  finite `cycleMs`. **NaN `slots`**: benign (above). Non-finite stamps
  inside `params.pending`: covered by the `.some()` — and already
  validator-pinned upstream anyway.
- **`skippedDues` = `Infinity` residual**: reachable only with finite
  inputs where `nowMs - dueMs` overflows to `+Inf` (`due ≈ -1.8e308`).
  `lastDueMs` becomes `+Inf` → the jumped head sits past `nowMs` → the
  lane parks in pending; `forfeited += Inf` yields `forfeited =
  Infinity` — informational only (`settleWorkersOffline` consumes
  `consumedBudgetMs`/`completed`/`pending`/`seededPending`, never
  `forfeited`). Terminates correctly; cosmetic. **Same-magnitude
  sibling:** `budgetMs = +Inf` is *rejected* by the finiteness guard
  (silent zero-advance) — arguably correct deny for a nonsense input,
  and no current caller passes it.
- **r18 batch intact at 060826af**: `boundTimedEffectClocks` arms
  unchanged (`expires <= lastSavedAt → min(nowMs, Date.now())`; live
  `min(expires, min(lastSavedAt, authorityNowMs) + TLT_DUR)`);
  `payoutExpiresAtMs` still bounds live claims by `lastSavedAt + dur`
  and keeps dead positions raw; the jump guard and forfeit parity are
  byte-identical; the all-seeded-heads re-stamp still shifts by
  `max(0, Date.now() - nowMs)` in `ProductionOffline.ts:184-194`. The
  r19 diff did not re-break any of these.
- **r19 deny pins are strong, not weak**: (a) asserts
  `stored.expiresAtMs === currentMs` — a mint regression that stored a
  future expiry fails it; (b) asserts payout `=== 1200` = 120s x flat
  10 cps — a mint paying the buffed rate (1500) fails it. Each pins the
  exact deny semantics it was written for.
- **Siblings**: `settleWorkersOffline` drains `budgetMs -=
  result.consumedBudgetMs` sequentially and `consumedBudgetMs` is
  `initial - budgetLeftMs >= 0` (zero-advance contributes 0) — no
  negative-budget leak; restore order in `GameManagerSaveRestore` is
  unchanged (quests before production, decompose/autofarm/alchemy after,
  hash commit last); autofarm settle stays capped at
  `DEFAULT_MAX_OFFLINE_SECONDS` (24h); `DecomposeSystem.restore` clamps
  `nextCycleAt >= max(0, restoredDeadline)` and its settle is
  `settled < 5000`-bounded with a floored `windowStartMs`;
  `AlchemySystem.settleOffline` iterates the restored job list only —
  none inherit the absorbing-window class.
- **Existing suite green at tip**: `fixpointR19Cor.qa.test.ts` (6) +
  `ProductionOffline.test.ts` (14) — 20/20 pass on 060826af,
  confirming the repro file's failures (none — all 4 r20 probes encode
  *admitted-bad-input* evidence, not suite regressions).

## Adjudication note

R20-COR-1's reachable arm requires a crafted save (validator admits
`-1e308` markers) — same trust class as the r17 deep-past comment in the
same function explicitly defends against. If crafted saves are declared
out of threat model, this adjudicates as a defense-in-depth gap (the
guard's stated class is "non-finite OR unsortable" inputs and
absorption is the magnitude sibling); the cheap fix direction is a
magnitude pin on `emptyLaneStartMs` (e.g. `|x| < 2^62` or a save-epoch
floor on `lastSavedAt`) or an explicit `headCostMs === 0 && dueMs <=
nowMs` loop bound — recorded for the coordinator, not applied here (no
production edits per dispatch).
