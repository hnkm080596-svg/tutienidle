# Fixpoint r17 — INT audit (integration-coherence, blind)

Audit commit: `5feb1270` (the r16 batch). Worktree: `.agent-worktrees/audit-r17-int`.
Scope: every consumer/writer of persisted timestamp fields vs the field-epoch
invariant — persisted stamp fields live in the payload/client epoch (read
against `Date.now()`); server-epoch values (`sinceMs`/`untilMs`/`settleNowMs`/
`authorityNowMs`) may only bound authorized widths.

Verdict: **FAIL WITH REASON — 1 Medium (deterministic mis-stamp in the r16
re-stamp itself) + 1 Nit (stale comment prescribing the reverted convention)**.

## Confirmed findings

### r17-INT-01 — spawned-lane re-stamp is chain-origin blind (Medium)

`ProductionOffline.ts:183-191` re-stamps EVERY non-persisted pending lane by
`fieldEpochShiftMs = max(0, Date.now() - nowMs)`, on the premise that all
spawned deadlines are stamped "in the settle window's epoch (authority
untilMs)". That premise only holds for lanes seeded from a **server-anchored**
`emptyLaneStartMs`. Two spawned subsets carry field-epoch stamps already and
get mis-shifted:

**(a) Saved-lane chain successors.** `WorkerLaneAdvance.ts:173` spawns the next
lane as `{ startMs: lane.dueMs, dueMs: lane.dueMs + cycleMs }` — a saved lane's
chain root is its own `completesAtMs`, a client-epoch stamp by contract. Under
a fast clock (`settleNowMs = untilMs`), a saved lane due within `cycleMs` of
the window end leaves a pending successor stamped `C + cycleMs` (client epoch);
the re-stamp pushes it to `C + cycleMs + skew` — tickWorkers pays it `skew`
later than honest (**deny ≈ skew**, bounded, once per such lane). Repro:
`docs/qa/r17-int-repro/fixpointR17Int.qa.test.ts` test 1 — pending
`completesAtMs` lands at `honestDeadline + 1h` exactly. Corollary: under a
slow→fast clock swing between the save-time stamp and restore, the same lane
fires up to `|s_hist|` EARLY (mint direction, requires two clock
manipulations).

**(b) Client-anchored settle windows.** The caller's window anchors are
`min(lastSavedAt, authorityNowMs - elapsed)` /
`min(lastSavedAt + elapsed, authorityNowMs)` — whenever `lastSavedAt <
untilMs - elapsed` (clock was **slow at save**, `s0 < 0`), BOTH anchors take
the payload marker: `offlineSinceMs = lastSavedAt` is itself a client-epoch
stamp, so every empty-seed chain is already field-epoch. `fieldEpochShiftMs`
then equals `Date.now() - (lastSavedAt + elapsed)` = the skew CHANGE since the
save (`s1 - s0`), and it is applied to every spawned pending lane — each
leftover lane freezes by that amount. Device 1h slow at save, honest at
restore: every spawned lane waits +1h (deny; test 2 pins the exact shifted
value). Magnitude is the skew change, not the current skew — a corrected
device clock freezes lanes by the whole old offset.

Root: `!persistedLanes.has(cycle)` distinguishes *restored vs spawned* but the
real discriminator is the chain's **root epoch** (window-seeded vs
saved-deadline, server-anchored vs client-anchored) — invisible at the re-stamp
site. A sound fix needs `advanceWorkerLanes` to tag spawned lanes' origin, or
the shift gated on the window being server-anchored AND the lane descending
from a window seed.

### r17-INT-02 — comment prescribes the reverted authority-anchor convention (Nit)

`QuestManager.ts:185-189` still says *"r14-INT-6: callers under a remote time
authority pass their approved anchor as nowMs so the clamp measures the same
clock the restore window was authorized on"* — the exact convention r16-INT-04
reverted (`GameManagerSaveRestore.ts:354` now passes `Date.now()`). A future
caller following the comment reintroduces the fast-clock daily-reset replay.

Sibling drift: `WorkerLaneAdvance.ts:48-51` and the `settleWorkersOffline`
comment (*"empty lanes produce only from the save instant (offlineSinceMs)"*)
still call `offlineSinceMs` "the save timestamp" — under remote authority it
is the authorized window start (`sinceMs` server stamp under a fast-clock
save), not the save's own marker.

## Clean surfaces (checked, evidence)

- **reconcileBuildings callers — 2 total, both field-epoch.**
  `SaveSystem.ts:312` passes `Date.now()/1000`; `initializeCharacter.ts:71`
  passes `GameClock.nowSeconds()` = `currentTime/1000` where `currentTime` is
  `Date.now()`-driven (`GameClock.ts:164-190`). Readers
  `getStoredAmount`/`claim`/`isStorageFull` all default
  `currentTime = Date.now()/1000` (`GameManagerBuildingOps.ts:247,288,331`);
  `BuildingManager.restore` future-clamps at the same `Date.now()/1000`
  (`BuildingManager.ts:43-50`). No cross-epoch caller.
- **lastDailyResetAtMs writers/readers — uniform field epoch.** Writers:
  `resetDaily` (called from `checkAndResetDaily` with `now = Date.now()`
  default, `QuestSystem.ts:470-485`) and the restore clamp
  `min(stamp, Date.now())`. Reader: `dayBucket(now)` same clock. Consistent.
- **Settle siblings share the authorized-end convention.** production
  `settleNowMs`, decompose `settleNowMs`+`offlineSinceMs`, alchemy
  `settleNowMs`, auto-farm `elapsed` bound + `Date.now()` anchor — authority
  bounds width, no field gets a server stamp (post-r16). Decompose
  `nextCycleAt` and alchemy `completesAtMs` read vs the settle bound
  cross-epoch under fast clock: pays only honestly-due items, leftovers pay
  online on the first `Date.now()` tick — bounded, no mint.
- **percentAtSave vs liveTltPercent — same stamp, same semantics.**
  `player.ts:430-435` reads raw `save.player.persistentTimedEffects` at
  `lastSavedAt`; `saveShapeValidation.ts:817-838` probes raw payload stamps at
  `player.lastSavedAt`. Field-by-field equivalent for every field the read
  touches (`effectGroup`, `sourceItemId`, `expiresAtMs`,
  `cultivationSpeedPercent` — non-finite/non-string defaults exclude
  identically in both paths).
- **workerCycles constructors — one factory, no bypass.**
  `buildProductionCycle` is the only cycle mint; every persisted pending lane
  in the offline path flows through the re-stamp map; `observe`-mode lanes
  stamp `Date.now()`; restored lanes keep identity through the settle
  (`persistedLanes` Set holds — `restoreStates` clones before the Set is
  built and `lane.saved` returns the same references).
- **Cross-epoch settle compare of SAVED lanes — bounded.** Saved
  client-epoch deadlines vs server-epoch `nowMs`: lanes with real deadline ≤
  `untilMs - skew` pay inside the window; nearer-tail lanes read future there
  but are already past-due vs `Date.now()` and pay online immediately. No
  honest cycle is skipped and none pays outside a field read.
- Cultivation payload window vs production/decompose authorized window:
  same authorized WIDTH, different anchor epoch — already adjudicated clean
  (r16 doc, INT-16 note).

## Repro

`docs/qa/r17-int-repro/` — `vitest.r17.config.ts` +
`fixpointR17Int.qa.test.ts` (2 tests, both pass: they assert the *actual*
shifted values, which are the defect). Run:
`npx vitest run --config docs/qa/r17-int-repro/vitest.r17.config.ts`
