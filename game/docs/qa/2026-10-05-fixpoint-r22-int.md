# QA Review: fixpoint r22 INT — integration coherence of the r21 timestamp-magnitude batch

- Date: 2026-10-05
- Mode: quick (scoped INT audit)
- Verdict: **PASS WITH EVIDENCE** (dispatch PASS/FAIL frame: **PASS** — no Medium+, no demonstrated incoherence against honest saves)
- Audit commit: `bf3b44a1` ("fixpoint r21: magnitude bound on every persisted timestamp cursor")
- Task-owned paths: `game/src/services/save/auditR22Int.probe.test.ts` (new), `game/docs/qa/2026-10-05-fixpoint-r22-int.md` (this file)

## Scope and Risk Map

Audited surfaces (the r21 batch and every seam it tightens):

- `game/src/services/save/saveShapeValidation.ts` — `isBoundedTimestamp`/`isNonNegativeBoundedTimestamp` pins on: `player.lastSavedAt` (:2310), `persistentTimedEffects[].appliedAtMs/expiresAtMs` (:1518-1523), `autoFarmStage.lastCheckedMs` (:2406-2411), `quests.lastDailyResetAtMs` (:3237), `buildings[].lastCollectedAt` (:3272), `workerCycles[].startedAtMs/completesAtMs` (:3355-3356), `alchemyJobs[].startedAtMs/completesAtMs` (:3590-3594), `decompose.nextCycleAt` (:4452), `tribulation.cooldownUntil` (:4473-4477).
- `game/src/core/production/WorkerLaneAdvance.ts` — `nowMs` magnitude pin + bounded-integer `slots` (:144-171).
- `game/src/core/production/DecomposeSystem.ts` — O(1) fast-forward (:302-307) + 5000-cycle cap (:313).
- Consumers at the seams: `GameManagerSaveRestore.ts` (offline window math :384-429), `ProductionOffline.ts` (settleWorkersOffline :157-170, seededPending field-epoch re-stamp :184-194), `ProductionSystem.ts` (restoreStates :129-153, tickWorkers :414-426), `stores/player.ts` (boundTimedEffectClocks :111-145), `GameManagerAutoFarmOps.ts` (anchor repair :270-276, :345-350), `QuestManager.restore` (:181-192), `BuildingManager.restore` (:39-54), `saveVersion.ts` / `SaveSystem.inspectLocalSave` (:512-518) / `importSaveRaw` (:730+).

Escalation decision: none — dispatch explicitly scopes this to integration coherence; no deep-mode trigger (no save/cloud protocol change, no new economy surface).

Exclusions: fixes (audit-only wave); cloud-sync transport; the r21-COR/AUT findings already adjudicated (r21 adjudication doc's residual ledger stands: sub-pin far-future stamps admitted → deny-direction self-park).

## Invariant Ledger

| # | Hypothesis | Check | Result |
|---|------------|-------|--------|
| H1 | A save that passed the OLD finite gate but fails the new bound can arise from an honest prior-version write or migration | `saveVersion.ts` header + history: every version ≠ CURRENT (87) returns `'incompatible'` wholesale; **no migration code exists**. Writer census: every stamp writer emits `Date.now()` + bounded authored offsets (TLT ≤24h, cycle spans ~minutes, cooldown 300s, `Date.now()/1000` seconds) — none can emit |x| ≥ 2^53 (~9.007e15, i.e. ±285k-year clock) | **Coherent** — old-pass/new-fail saves are crafted-only, never honest |
| H2 | A consumer divides/exponentiates/mis-domains a pinned stamp | Per-field consumer census (below): all reads are bounded arithmetic or ordering compares; `lastCollectedAt` is seconds-domain end-to-end (writer `BuildingSystem:132`, accrual `elapsedSeconds = min(currentTime - lastCollectedAt, CAP)` :330, restore clamp `nowSeconds` `BuildingManager:49`) — pin bound is unit-correct (2^53 is the exact-integer edge for any float unit) | **Coherent** |
| H3 | Pins reject an honest save under clock repair/skew allowance | Skew allowances unchanged: TLT `appliedAtMs ≤ lastSavedAt` ordering + `expiresAtMs ≤ lastSavedAt + duration + 7d` provenance allowance (r15-COR-D, :1584-1604); autofarm anchor repair intersects elapsed with own-epoch gap (:270-278); seededPending one-way `fieldEpochShiftMs` re-stamp (:184-194); quest `min(stamp, now)` (:181-192). Pins only reject crafted magnitudes (|x| ≥ 2^53) — no honest clock-repair shape sits there | **Coherent** |
| H4 | A restore path applies a different domain than the gate (wedge/reject asymmetry) | `normalizedSave` (:4925-4944) does NOT rewrite timestamps — gate verdict is final. Restores are verbatim-or-stricter, all deny-direction: quest `min(stamp,now)`, autofarm re-anchor, TLT `boundTimedEffectClocks`, decompose `max(0, max(existing, restored))`, buildings future→now clamp | **Coherent, with one Low edge** — see Finding 01 |
| H5 | Persisted timestamp cursors exist that the pin missed | Regex census over `saveTypes.ts`/`Player.ts`/validators: all `*At`/`*AtMs`/`*Until` persisted number fields are pinned; `siteLevelAtStart`/`roomLevelAtStart` are levels, `perfectClearSeconds` are durations, `turnBattleStartedAtMs` is runtime-only | **Coherent — complete coverage** |
| H6 | Comments still describe the pre-pin contract | Found two (Finding 02, Nit): pin docblock "honest stamps are epoch-ms" vs seconds-domain `lastCollectedAt`; `WorkerLaneAdvance:127-128` "upstream pins keep every input finite" | **Nit drift only** |
| H7 | `autoWorkerCapacity` (finite-pin only) can smuggle unbounded `slots` | Gate admits huge finite capacity, BUT `refreshAutoWorkerCapacity` recomputes from the chi_hien_quan formula before any consumer (F-W-16, `GameManagerSaveRestore:334-341`); persisted value is dead state. `slots` producers ≤19 + `sanitizeWorkerPoolInputs` clamps — 65536 guard is a non-save-feed ceiling | **Coherent** |
| H8 | Admitted save can still reach the mechanism wedge via a derived feed | `offlineSinceMs = min(lastSavedAt, authorityNowMs - elapsed*1000)`: algebraically ≡ lastSavedAt ± float64 round-trip ε. For the single outermost admitted value `lastSavedAt = -(2^53 - 1)` the derived value lands exactly at -2^53 → `emptyLaneStartMs` trips the guard → permanent verbatim per-site wedge | **Low edge — demonstrated (probe)** |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| `npx vitest run src/services/save src/core/production src/stores` | 1088 passed / 3 skipped | Baseline green at bf3b44a1 |
| `npx vitest run src/services/save/auditR22Int.probe.test.ts` | 3 passed | Executed repro of Finding 01 edge + controls |
| Source trace: `GameManagerSaveRestore:426-429` → `ProductionOffline:166` → `WorkerLaneAdvance:152-154` | derived-feed crossing confirmed | float64: `1.76e12 - fl(fl((1.76e12 + 9007199254740991)/1000)*1000) = -9007199254740992` exactly |
| Census greps over persisted types | no unpinned `*At*`-domain field | see H5 |

## Findings

### QA-2026-10-05-r22-int-01: outermost admitted marker derives an out-of-domain window start → mechanism wedge

- Severity: **Low**
- Status: **Confirmed** (executed probe; source trace)
- Invariant: admission domain should compose with the mechanism guard's domain (r21 rationale: gate rejection beats "a permanent silent wedge ... worse than save rejection").
- Preconditions: crafted save (a clock ~285k years in the past cannot mint this honestly).
- Reproduction: `lastSavedAt = -(2^53 - 1)` — the outermost value the pin admits. `elapsed = (authorityNow - lastSavedAt)/1000` round-trips to `9.008958955e12 s`; `authorityNowMs - elapsed*1000 = -9007199254740992` = exactly `-2^53`; `min(lastSavedAt, -2^53) = -2^53` → `offlineSinceMs` fails `Math.abs(emptyLaneStartMs) >= 2**53` → `advanceWorkerLanes` returns zero-advance → lanes re-persist verbatim → every boot re-trips.
- Expected: admitted saves never reach the mechanism wedge the wave's rationale describes.
- Actual: a one-value sliver of the admitted domain still produces the wedge through a derived (unpersisted) feed.
- Evidence: `auditR22Int.probe.test.ts` (all 3 cases executed and passing); the sliver is exactly one integer — `-(2^53 - 2)` derives in-domain and settles normally.
- Test file: `game/src/services/save/auditR22Int.probe.test.ts`
- Owner subsystem: save/restore window derivation (`GameManagerSaveRestore`) ↔ production settle guard (`WorkerLaneAdvance`).
- Blast radius: crafted-save only; deny-direction (zero mint, zero hang, lanes preserved); harms only the crafter; bounded per boot (O(1) zero-advance). Consistent with the r21 adjudication's accepted sub-pin residual — recorded because the wedge class survives through a derived feed the gate's source-stamp pin cannot see. A literal fix would be `|x| < 2^53 - 2` or a check on the derived value at the window seam, but the deny-direction outcome already equals the adjudicated intent.

### QA-2026-10-05-r22-int-02: pin docblock says "epoch-ms"; `lastCollectedAt` is seconds-domain

- Severity: **Nit**
- Status: **Confirmed** (source)
- Invariant: comments describe the current contract.
- Actual: `saveShapeValidation.ts:402` — "honest stamps are epoch-ms (~1e12)". `buildings[].lastCollectedAt` (pinned by the same helper) is a seconds-domain stamp (~1.7e9): writer `BuildingSystem:132` (`lastCollectedAt: currentTime`), accrual `min(currentTime - lastCollectedAt, PRODUCTION_OFFLINE_CAP_SECONDS)` :330, restore clamp vs `nowSeconds` `BuildingManager:49-50`. The 2^53 bound is still unit-correct (exact-integer edge for any float unit), only the doc claim is wrong. Sibling: `WorkerLaneAdvance.ts:127-128` — "upstream pins keep every input finite" describes the pre-pin finite contract on the block that now documents the 2^53 bound.
- Test file: none (comment-only).
- Owner subsystem: save validator docs.
- Blast radius: none — documentation accuracy only.

## New or Changed QA Tests

- `game/src/services/save/auditR22Int.probe.test.ts`:
  - A) proves Finding 01 end-to-end: gate admission of `-(2^53-1)` + exact derived `-2^53` + `advanceWorkerLanes` zero-advance.
  - B) positive control: `-(2^53-2)` derives in-domain and settles (proves the sliver is the single boundary value).
  - C) mechanism control: a direct `|emptyLaneStartMs| ≥ 2^53` feed still zero-advances verbatim (defense-in-depth holds for non-save feeds).

## Gaps and Residual Risk

- `restoreFromSave` itself was not executed end-to-end (Phaser-bearing path); the window derivation is reproduced verbatim as two arithmetic lines in the probe, and the mechanism is the real one — the composition claim is arithmetic, not runtime-integrated.
- Sub-pin crafted magnitudes (the 9e15 family) remain admitted per the r21 adjudication residual — unchanged by this wave; Finding 01 is a sub-case recorded for the ledger, not a re-litigation.
- `buildings[].lastCollectedAt` seconds-domain means a crafted `lastCollectedAt = 0` yields a ~55-year accrual read — pre-existing behavior, capped by `PRODUCTION_OFFLINE_CAP_SECONDS` in `getStoredAmount`; not introduced by r21.

## Pre-existing Failures

None observed in the audited scope.

## Learned-Defect Loop

| ID | Component | Trigger pattern | Missed invariant | Why prior QA missed it | Regression test | Domain-pack weighting recommendation |
|---|---|---|---|---|---|---|
| QA-2026-10-05-r22-int-01 | GameManagerSaveRestore window math → WorkerLaneAdvance | persisted marker admitted → DERIVED cursor crosses the same bound via seconds round-trip | gate domain must compose with mechanism domain through derived feeds | prior waves pinned persisted stamps only; derived feeds were assumed in-domain by construction | `auditR22Int.probe.test.ts` (boundary sliver) | time-and-offline: add "check derived timestamps against mechanism bounds, not only persisted ones" |
