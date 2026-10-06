# Fixpoint r31 — COR audit of r30 adjudication (commit `e90f46a2`)

- **Scope:** commit `e90f46a2` on `codex/hoa-cau-fireball-vfx` (r30 batch = `b6c7410d` COR adjudication + `e90f46a2` AUT+INT adjudication).
- **Role:** correctness — wrong conditions, boundary errors, off-by-one, broken ordering, validator/denial asymmetries.
- **Method:** every claim below was verified against the code at `e90f46a2` and pinned by a deterministic probe in `src/services/save/auditR31Cor.probe.test.ts` (`npx vitest run src/services/save/auditR31Cor.probe.test.ts --pool=threads` → **74/74 pass**). Tests run with the repo's `unlockAllFeaturesForTests()` scope: `manualWorkforce`/`equipmentOreDecompose` are LIVE in the probe env, so lane ceilings read the claimed pool and decompose ticks actually run.
- **Verdict: FAIL — 1 Medium, 3 Low** (fixpoint not reached).

---

## F-NEG-MINT — Medium (CONFIRMED, full chain probe)

**What:** The r30 batch unified *clock inputs* to `[0, 2^52)` at every seam, but the *persisted-stamp gate* (`isBoundedTimestamp`, `saveShapeValidation.ts:421`) is `Math.abs(x) < 2^52` — it still admits **all negative stamps**. For the two collections whose stamps are *deadlines that mint on restore* — `productionSites[].workerCycles` (`:3492-3493`) and `alchemyJobs` (`:3727-3728`) — a crafted save carrying a negative `{startedAtMs, completesAtMs}` pair passes every forgery pin:

- exact authored span (`completesAtMs - startedAtMs === authored` — `:3563-3574`, `:3794-3804`),
- ordering pin `completesAtMs > startedAtMs` — two negatives satisfy it,
- `startedAtMs <= lastSavedAt` — negative ≤ honest positive,
- `siteLevelAtStart ∈ [1, level]`, producible `collectionRealmId`, int `rollSeed`, lane cap `<= betaEffectiveWorkerCapacity(claimed)`,
- alchemy job: real recipe/herb/roomLevel + self-consistent reservation digest (replay of public fields).

Then `restoreStates`/`restoreJobs` take the pair **verbatim** (the shift arm only fires on `startedAtMs > restoreNowMs` — negatives never post-date a sane clock), and the first honest `tickWorkers`/`tick` sees `due <= now` → completes → `grantCycleRewards` mints materials / the settle mints pills.

**This is exactly the exploit class the r30 seam comments name** ("a negative clock would mint an already-due job") — the guard closed the *clock feed* but not the *persisted stamp*.

**Repro (probe A):**
- `workerCycles:[{startedAtMs: -2_000_000, completesAtMs: -2_000_000 + span, ...}]` + `player.autoWorkerCapacity = 3` + a `chi_hien_quan` building → `validateGameSaveShape` → `ok: true`, zero `workerCycles` issues → `restoreStates` verbatim → `tickWorkers(currentMs)` → `drainSettlementEvents().length > 0` (grant minted).
- `alchemyJobs:[{startedAtMs: -1_000_000, completesAtMs: -1_000_000 + authoredSpan, ...digest-valid}]` + `pill_room` level 1 → `ok: true`, zero issues → `restoreJobs` verbatim → `tick(currentMs)` → settle event `success: true`, `delivered >= 1` pill.

**Magnitude:** bounded per import (≤ maxLanes per site × #sites grants, ≤ maxJobs pills), re-importable. Same severity class as previous crafted-mint findings.

**Fix direction:** promote `workerCycles.startedAtMs/completesAtMs` and `alchemyJobs.startedAtMs/completesAtMs` to `isNonNegativeBoundedTimestamp` (the non-neg gate `buildings.lastCollectedAt`/`quests.lastDailyResetAtMs`/`decompose.nextCycleAt`/`tribulation.cooldownUntil` already use), or deny `x < 0` inside those two field checks. No honest writer emits negative stamps, so the deny direction is safe.

**Why not a pinned residual:** the pinned items cover `lastSavedAt` (window-start, deep-past class) and verbatim-*parked* stamps (never settle = self-harm). A negative *due* is not parked — it settles and mints.

---

## F-HEADROOM — Low (CONFIRMED, probes C1–C5)

**What:** The headroom check `!(nowMs + Math.max(0, cycleMs) < 2^52)` exists **only** in `advanceWorkerLanes`' `nowMs` arm (`WorkerLaneAdvance.ts:146-157`). Sibling `clock + delta` mint paths still stamp ≥ 2^52 when their input sits in `[2^52 - delta, 2^52)`:

| Site | Mint | Bound |
|---|---|---|
| `AlchemySystem.startJob:563` | `completesAtMs = nowMs + alchemySecondsFor(...) * 1000` | `nowMs ∈ [2^52 - span, 2^52)` → ≥ 2^52 |
| `DecomposeSystem.tick:178/:188/:200` | `nextCycleAt = nowMs + cycleMs` (3 writes) | `nowMs ∈ [2^52 - cycleMs, 2^52)` → ≥ 2^52 |
| `DecomposeSystem.settleOffline` fast-forward/settle loop | `nextCycleAt += skipped*cycleMs` / `+= cycleMs` | `nowMs` near bound → lands `> 2^52` |
| `WorkerLaneAdvance` seeds (`:205`) | `dueMs = emptyLaneStartMs + cycleMs` | `emptyLaneStartMs` guarded by `\|x\|` only — **never compared to `nowMs`** — a caller value `∈ (nowMs, 2^52)` mints `≥ 2^52` dues |

Every one of these minted stamps is then **refused by the persisted gate on the next `buildGameSave` write** → the self-wedge class the batch explicitly targeted (probe C1 shows `startJob(BOUND-1)` → `completesAtMs ≥ 2^52` → `validateGameSaveShape` refuses the save carrying it; C2/C3 same for `DecomposeSystem.tick`; C5 shows `emptyLaneStartMs = 2^52 - 10_000` mints `due ≥ 2^52`).

**Reachability (why Low, not Medium):** all four need a crafted *in-process* clock/caller argument — every in-app feed is `Date.now()`/`restoreClockMs`/`settleNowMs` (~1.8e12, nowhere near 4.5e15). Gate-passing *payloads* can't reach the restore-seam arms (see Rejected below). This is a defense-in-depth consistency gap: the batch declared the pattern ("+cycleMs headroom keeps every minted due inside the domain") and applied it to one arm only.

**Rejected sub-candidates (verified safe, no finding):**
- `AlchemySystem.restoreJobs` / `ProductionSystem.restoreStates` shift arms mint `restoreNowMs + span` — but `startedAtMs > restoreNowMs` is required to shift AND the gate pins `span` to the authored duration, so a gate-admitted payload cannot overstep; only a mechanism-level caller could feed a free span.
- `DecomposeSystem.restore` `mergedDeadline = min(restoredDeadline, restoreNowMs + cycleMs)` — `restoredDeadline < 2^52` always (non-neg gate) → merged `< 2^52`. Same for `TribulationDirector.restoreRuntime` `min(cooldownUntil, restoreNowMs + CD*1000)` — `< 2^52`.
- `advanceWorkerLanes` deadline-mode successor dues: `lastDue ≤ nowMs` for every completed lane → successors mint `≤ nowMs + cycleMs < 2^52` — the headroom covers them (probe C6 asserts `pending[i].completesAtMs < 2^52`).

---

## F-WIN-ASYM — Low (CONFIRMED, probes B1–B4)

**What:** `DecomposeSystem.settleOffline` (`:311-323`) now denies `offlineSinceMs < 0 || >= 2^52` — but the sibling production settle feeds the same window start into `advanceWorkerLanes.emptyLaneStartMs`, which still admits negatives via `Math.abs(x) >= 2^52` (`:160-162`). One crafted `lastSavedAt < 0` (admitted by `isBoundedTimestamp` — the pinned deep-past residual) yields `offlineSinceMs < 0` → **decompose pays 0, autofarm re-anchors to now (pays 0), but production settles deep-past work** (bounded by the cap budget).

The comment at `:321-323` claims "Parity with the workerLane/auto-farm window guards" — **factually wrong**: workerLane admits negatives (|x| form), autofarm re-anchors rather than denies. Three verdicts on the same crafted input.

**Repro:** `advanceWorkerLanes({emptyLaneStartMs: -1_000_000})` seeds+settles a cycle (`completed ≥ 1`); `settleOffline(now, -1_000_000)` returns `0`; `settleOffline(now, 2^52)` returns `0`.

**Direction:** self-harm for decompose/autofarm (underpay), bounded-pay for production — inconsistent doctrine on one crafted field rather than a mint escalation. **Low.**

---

## F-APPLIEDAT -- Low (CONFIRMED, probe D1)

**What:** `GameManagerPersistentEffectOps.applyTimedEffect` (`:328-375`) clamps `expiresAtMs` into `|x| ≤ 2^52 - 1` on all three arms, but the push arm still writes `appliedAtMs` **verbatim** from the caller's `effect`. A crafted caller value `appliedAtMs = 1e16` persists → `buildGameSave` writes it → the next `validateGameSaveShape` refuses (`isBoundedTimestamp` + `appliedAtMs > lastSavedAt` pins) → write-blocked wedge — the same class the expiresAtMs clamp closed.

**Reachability:** in-process crafted caller only; honest writers stamp `Date.now()`. Sibling-field half-fix. **Low.**

---

## Verified-correct / rejected candidates (evidence, not findings)

- **`App.vue:597-617` refuse arm ordering — CORRECT.** `pauseSimulation()` before `saveIssue.report`/`bootFlow.fail()`: the pause self-guards on `entryStage === 'game'` (`useAppLifecycle.ts:265`), so calling it after `fail()` flips the stage would be a no-op — the ordering is load-bearing and right (probes G1/G2). Boot-time sibling arms run pre-`'game'` stage → no-op is correct; the `onResume` live-reject arm already runs under authority pause. `observeSaveResult` under remote authority enters terminal (`canMutate` false); under local it can't — the explicit pause is exactly the missing local-mode freeze.
- **`locked`/`favorite` optional-boolean — CORRECT.** `undefined`/boolean admit; `'yes'`/`1`/`0`/`null`/`'true'`/`{}`/`[]` refuse (probe E). `equipped`/`autoRestart`/`started`/`claimed`/`durationStackable` siblings are already strict; protection-cap counting (`=== true`) is consistent with the gate.
- **Deny semantics uniform:** every seam denies → zero-advance / verbatim-park, never mutate — including `advanceWorkerLanes` returning `pending: [...params.pending]` untouched (probe F boundary tests).
- **Domain edges:** `-1`, `NaN`, `±Infinity`, `2^52`, `2^53` denied at all touched seams; `-0`/`+0` admitted (stamps land tiny-past — pinned residual); `2^52 - 1` admitted (probe H).
- **`advanceWorkerLanes` slots/domain pins:** `slots` int ∈ [0, 65536]; `cycleMs ≤ 0` not spawnable; `budgetMs` non-finite denied (probe F).
- **Cap-gated walks (`b6c7410d`):** `requireArray`/`optionalArray` return `[]` at >1024 — zero per-index reads; `persistentTimedEffects`/`selectedTalentIds` element walks gated; legacy equipment entries discarded before counters and `normalizedEntries` is what restore consumes — ordering consistent.
- **`buildings.lastCollectedAt`, `quests.lastDailyResetAtMs`, `decompose.nextCycleAt`, `tribulation.cooldownUntil`** already use `isNonNegativeBoundedTimestamp` — consistent with the F-NEG-MINT fix direction (the two mint-bearing collections are the odd ones out).
- **`autoFarm.lastCheckedMs`** negative → re-anchored to `now` (`GameManagerAutoFarmOps.ts:271-275`) — deny-consistent, pays 0.
- **`saveIssue.report` multi-write idempotent**, refuse arm `'local'` scope on both refuse paths — pinned residuals, re-verified consistent.

## Files

- Probe: `game/src/services/save/auditR31Cor.probe.test.ts` — 74 tests, all green.
