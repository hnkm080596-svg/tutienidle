# Fixpoint audit r33 — AUT (adversarial exploit)

Auditor: r33-AUT worker (Devin session). Base: `codex/hoa-cau-fireball-vfx`
@ `a014b7fb` (the full r32 adjudication). Role: assume every r32 fix is
exploitable — mint/wedge/self-brick paths through the ordering-parity
drop-vs-park changes, the `mintedSpanMs` denominator switch, the
field-epoch re-stamp skip arm, the `2**52 - 1` cap clamps, the
`applyTimedEffect` per-group `expiresCeiling` + NaN coercions, and
`bootGame`'s `resumeCombat('authority-pause')`; then siblings of each
class (adjacent stamps, adjacent collections, adjacent seams, adjacent
throw-paths).

In-place audit on the audit commit (test+doc writes only — P1/P2
read-only on production code). Every claim below carries an EXECUTED
deterministic repro in `src/services/save/auditR33Aut.probe.test.ts`
(16 tests, all passing — `npx vitest run <file> --pool=threads`,
`@vitest-environment node`, `Date.now` mocked where the save clock
matters). Report branch: `devin/audit-r33-AUT-a014b7fb`.

Verification executed:
- `npx vitest run src/services/save/auditR33Aut.probe.test.ts --pool=threads`
  — 16/16 green.
- Full read of the r32 surfaces at the audit commit:
  `useAppLifecycle.ts` (:261-305 pause/resume gates, :335-360 bootGame
  resume placement, :793-814 stopAll), `CombatClock.ts` (:72-113
  reason-set semantics), `GameManagerTurnBattleOps.ts` (:395-416
  freeze/resume, :480-486 syncOffScreenFreeze, :488-502 advanceCombat
  drop-rule, all `combatClock.stop()` sites), `App.vue` (:595-635
  r30-INT-1 terminal-card freeze rationale, :693-737 onPause/onResume,
  :806-809 acknowledgeAuthority, :981-1093 bootGame callers),
  `WorkerLaneAdvance.ts` (:121-353 mintedSpanMs + guards + due-walk),
  `ProductionSystem.ts` (:129-190 restoreStates park/shift, :400-475
  tickWorkers), `ProductionOffline.ts` (:176-200 field-epoch re-stamp),
  `AlchemySystem.ts` (:376-475 restoreJobs drop/shift/normalize arms,
  :684-797 tick, :800-813 settleOffline), `DecomposeSystem.ts` (:250-301
  restore + cap), `TribulationDirector.ts` (:813-881 serializeRuntime +
  restoreRuntime cap), `GameManagerPersistentEffectOps.ts` (:307-412
  per-group expiresCeiling + NaN coercions), `Player.ts` :119-196
  `boundTimedEffectClocks`, `GameManagerSaveRestore.ts` (:349-475
  restore clocks), `SaveSystem.ts` (:345-435 buildGameSave /
  writeGameSave — unvalidated write), `CloudSaveCoordinator.save`
  (wire-form validateGameSaveShape → SAVE_INVALID refuse),
  `saveShapeValidation.ts` (:3533/:3763 ordering pins, :3581/:3816
  startedAtMs<=lastSavedAt pins, :4623/:4644 decompose/tribulation
  bounds, :1661-1680 TLT writer bound).
- Caller census for `freezeCombat`/`resumeCombat` (useAppLifecycle,
  useCombatPause, CombatTopBar — one owner per reason) and
  `restoreStates`/`restoreJobs` (GameManagerSaveRestore only — every
  feed is admission-validated upstream).

---

## Verdict: FAIL (0 Critical / 0 High / 1 Medium / 1 Low / 2 Nit)

One production-reachable defect: the r32 `resumeCombat('authority-pause')`
in `bootGame` runs at boot START, before the outcome is known — a boot
that fails leaves a latched battle running behind the terminal card
with no seam able to re-freeze it, and a boot that succeeds lets the
combat clock step across the load await on pre-restore state. The rest
of the batch holds: the mintedSpanMs max() denominates both incoherent
directions, the re-stamp skip arm is arithmetically dead, the cap
clamps stay in-domain by construction, and the TLT ceiling asymmetry is
absorbed by the writer's +7d skew slack.

| ID | Severity | Class | Surface |
|---|---|---|---|
| R33-AUT-1 | Medium | lifecycle / over-release | `useAppLifecycle.bootGame` :346-355 — `simPaused = false` then `gameManager.resumeCombat('authority-pause')` execute BEFORE `authority.beginChecking()`, `await coordinator.load()` (:399), and every failure branch (:411-456 `unavailable`/`deleted`/`incompatible`/`corrupted`/`pending-*`, :490-501 restore-rejected, :576-599 commit-refuse). PRECONDITIONS: a live battle frozen only under 'authority-pause' (terminal pause → `pauseSimulation` latched at entryStage 'game' → `freezeCombat`) plus any subsequent boot — the honest chain is terminal-pause → `acknowledgeAuthority` → re-auth → `onAuthenticated` → `bootGame`. FAILURE LEG (executed): real `GameManager` + `ManualClockSource` + `startAStage`, `freezeCombat('authority-pause')` → 'frozen'; `bootGame` with `coordinator.load` → 'unavailable' → `{status:'failed'}` → `getFreezeReasons()` no longer contains 'authority-pause', `getCombatClockState() === 'running'`; `pauseSimulation()` early-returns (entryStage 'error' ≠ 'game') so NOTHING re-freezes; `clock.advance(1)` emits steps (`getElapsedCombatSteps() > 0`) — the exact "combat channel (CombatClock, outside the tick gate) keeps resolving turns behind the terminal card" class the r30-INT-1 comment at App.vue:604-612 documents as needing a pre-mount freeze. SUCCESS LEG (executed): same setup with `load` resolving 'ok' after a simulated mid-await frame → `outcome 'entered'` with `getElapsedCombatSteps() > 0` — steps consumed during the `await coordinator.load()` window against PRE-restore objects; a battle settling inside that window mutates bags/state that `restoreGameSession` then replaces (earned outcome silently rolled back) or lands between restore and the durability commit (desynced result persisted). Expected: the clear should fire only once the boot outcome is assured (e.g. alongside `clock.start()`/`boot.enterGame()` at :727-742) — identical semantics for the intended re-entry, no early release. Reachability: honest-path (no crafted payload); impact bounded — error-surface combat is in-memory only (persistProgress is entryStage-gated) and a later successful boot's restore wipes it — but turns resolve invisibly and the mid-boot settle window is real. |
| R33-AUT-2 | Low | parity gap / wedge | `ProductionSystem.restoreStates` (:170-188) has NO drop arm — it parks every invalid cycle verbatim, while sibling `AlchemySystem.restoreJobs` (:401-411) now DROPS the identical shapes (non-finite / `<0` / `>=2^52` / inverted). Consequence of the park (executed): a crafted inverted `workerCycle` (`completesAtMs <= startedAtMs`) restored verbatim → `advanceWorkerLanes`'s `pending.some` guard denies the ENTIRE site advance — sibling honest due lanes never settle and no empty lane is seeded (tickWorkers on `{inverted, due}` leaves both cycles and pays nothing, while a control `{due}` site settles `good`); AND `buildGameSave` writes the pair verbatim → `validateGameSaveShape` F-A11-4 ordering pin fires → every subsequent write refuses SAVE_INVALID (retryable:false → DATA_REFUSE surface arms) — a permanent wedge vs alchemy's self-heal. Reachability: bypass-admission feeds only — every real load path runs shape+acceptance (`inspectLocalSave`/`importSaveRaw`/remote download/`adoptCommittedPending`), and caller census shows `GameManagerSaveRestore` is the only feed. Also identical to the pre-r32 shifted-pair outcome (same deny+wedge), so the site-poison itself is a previously-adjudicated residual — the new content is the production/alchemy divergence on identical input. Low per the r30/r31 bypass-reachability precedent. |
| R33-AUT-3 | Nit | caller-contract / mint | `advanceWorkerLanes` trusts caller coherence between `cycleMs` and the authored span. A hypothetical caller passing `cycleMs << authored` mints instant completions: seeded lanes get `dueMs = emptyLaneStartMs + cycleMs` (already past) and each completes a FULL authored-span cycle on the first call (executed: `cycleMs=1, slots=2` → `completed.length === 2`, each carrying `completes - started === authoredMs`). Persisted stamps stay in-domain via `mintedSpanMs` — the hole is only the completion rate. Both live callers pass the coherent `computeCycleSeconds`-derived pair (tickWorkers :449-450, settleWorkersOffline) → no reachable defect; Nit hardening note (the unit could assert `cycleMs === authored` like it asserts the pending ordering). |
| R33-AUT-4 | Nit | ungated-input / crash-path | `advanceWorkerLanes`'s `params.pending.some(cycle => cycle.completesAtMs …)` (:185-194) dereferences entry fields without a null/object check — a bypassed `workerCycles` carrying `null`/`5` throws TypeError out of `tickWorkers` (restoreStates spreads them verbatim, so `5` parks as `{}` which fails the ordering check cleanly, but `null` parks as `{...null}` = `{}` too — only a raw `pending` array handed directly to the pure function hits it). Admission pins every entry `isObject`; ungated-feed only. Nit. |

## Attack log — rejected candidates (verified held)

- **`mintedSpanMs` denominator direction** — PROBED both ways: with
  `cycleMs=1000 << authored`, a seed that parks carries the AUTHORED
  span (`pending[0].completes - started === authoredMs`, `< 2^52`); at
  `nowMs = 2^52 - authored + 1` the whole advance denies (persisted
  mint cannot exceed `nowMs + max(cycleMs, authored)`); with
  `cycleMs = 4*authored` the larger `cycleMs` denominates (deny at
  `2^52 - cycleMs + 1`). Cursor dues use `cycleMs` but are never
  persisted beyond lane heads — over-deny margin only, no under-guard.
- **ProductionOffline re-stamp skip arm** (`completesAtMs + shift >= 2^52`
  → keep settle-epoch) — arithmetically dead: `seededPending` exists
  only when `nowMs + mintedSpanMs < 2^52` holds, and every seeded head
  carries `completes <= nowMs + authored`, so the skip needs
  `Date.now() - nowMs >= 2^52 - completes` i.e. `Date.now()` at
  ~`2^52` (year ~142,758). PROBED: `advanceWorkerLanes` at
  `nowMs = 2^52 - authored + 1` returns `seededPending: []` — the arm's
  only feeder cannot exist near the bound. Provably-dead over-guard —
  same class the batch itself keeps for `restoreJobs` headroom.
- **Cap clamps at restoreNow near `2^52`** — `clockOk` bounds
  `restoreNowMs < 2^52`, so `min(restoreNow + span, 2^52-1)` is
  in-domain by construction; PROBED: `DecomposeSystem.restore`
  (`nextCycleAt = 2^52+1`, `restoreNow = 2^52-1`) yields `2^52-1` and
  `TribulationDirector.restoreRuntime` same — both serialize in-domain.
- **TLT `expiresCeiling` apply-vs-write skew** — apply clamps at
  `Date.now() + TU_LINH_TRAN + 7d`; the write pin allows
  `lastSavedAt + TU_LINH_TRAN + 7d` with `lastSavedAt >= applyNow` on
  any monotonic clock — strictly looser. A write only self-refuses
  after a >7d backward wall-clock jump between apply and write — the
  +7d slack IS the documented skew rescue. Dead-on-arrival
  (`expires = applied`) mints at most `86400·K` on the TLT payout read —
  the accepted bounded-payout residual.
- **`resumeCombat` reason hygiene** — PROBED: deletes only the named
  reason (`user-pause` survives a boot resume), cannot unstop a
  'stopped' clock (early return), cannot reach reasons nobody latched
  — the failing case is the placement (R33-AUT-1), not the operation.
- **Parked post-dated pairs** (`started > lastSavedAt` write pin) —
  pre-existing class, symmetric across alchemy/production: a job or
  cycle restored with `started > restoreNow` parks and wedges the same
  way; `restoreJobs`'s drop only covers invalid-domain/inverted shapes,
  not post-dated valid ones — parity there, no new asymmetry.
- **`restoreJobs` drop arm vs honest jobs** — the drop only fires on
  `completes <= started` / out-of-domain; honest authored spans are
  `> 0` so nothing honest is dropped (truth table pinned in r30 probe,
  re-verified by reading).
- **`settleWorkersOffline` `offlineSinceMs > settleNowMs` inverted
  window** — `offlineSince = min(lastSaved, until - elapsed, now)` vs
  `settleNow = min(lastSaved + elapsed, until, now)` can invert when
  `elapsed < (until - lastSaved)/2`, seeding lanes post-dated past
  `nowMs` — but `startedAtMs <= Date.now()` still holds (min-clamped),
  so the seeds are write-legal future dues that simply park — deny-lean
  at most, bounded by the same clamps; pre-existing shape, unchanged by
  r32.
- **`advanceWorkerLanes` `emptyLaneStartMs < 0`** — the guard requires
  `emptyLaneStartMs >= 0` (:179-182) and both callers clamp their
  window starts at `>= 0` (settle entry gate :176-177, tick entry
  `nowMs >= 0`) — rejected.
- **`DecomposeSystem.restore` bad-clock arm verbatim park** — a crafted
  `nextCycleAt >= 2^52` under a deny clock parks verbatim and wedges
  the write UNTIL the next honest tick rebases it
  (`nextCycleAt - nowMs > cycleMs` re-anchor :195-199) — transient,
  self-healing, bypass-only; unchanged by r32 (the r32 change only
  bounded the good-clock cap).
- **`TribulationDirector.restoreRuntime` bad-clock arm** — same class:
  verbatim park of a crafted `>= 2^52` `cooldownUntil` wedges writes
  until a new tribulation attempt rewrites it — the channel idles
  (deny) meanwhile. Bypass-only, pre-existing.
- **`applyTimedEffect` NaN on `existing.expiresAtMs`** — `Math.max(x,
  NaN)` propagates NaN to persisted expires → write wedge, but a NaN
  `existing` can only enter through a bypassed payload (admission pins
  finite) — the r32 coercions cover caller-side non-finite inputs, and
  every arm self-bounds at `expiresCeiling` for finite inputs.
- **`hiddenChannelCycles` verbatim ride** — non-negative-int map
  pinned at admission; parked verbatim on the same terms as
  `workerCycles` heads — no new surface.

## What this wave confirms

The r32 timestamp-domain batch is closed on every crafted-payload
surface — the only surviving stamp attacks need a bypassed payload or
an ungated clock, same as every prior wave. The one new actionable
defect is orthogonal to the domain work: `bootGame`'s
`resumeCombat('authority-pause')` releases the latch before the boot
outcome exists, re-opening the "combat runs behind the terminal card"
class r30 closed — the fix is placement (move the clear into the
success tail), not semantics.
