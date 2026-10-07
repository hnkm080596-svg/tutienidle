# Fixpoint audit r35 — INT (integration coherence)

Auditor: r35-INT worker (Devin session). Base: `codex/hoa-cau-fireball-vfx`
@ `b1ffef6c` (the full r34 adjudication). Role: verify the r34 pieces agree
with each other and their consumers — `discardInFlightBattle`'s clear-set vs
every post-boot reader (statusVfx/reaction/proc bindings, stageWaves lease,
surviveLethal session, activeStageForTurnBattle, playerDataForTurnBattle,
turnBattleStartedAtMs), `session.end` side-effects (phantom 'battle ended'
on a clean boot), the 'stopped' vs 'frozen' contract for UI/store consumers
(sibling-latch doctrine on re-auth), the flipped pins vs the doctrine they
now assert, and discard-before-markReady ordering vs the authority gate.
Then siblings of the fix: every OTHER rebind-then-unlatch seam.

Isolated worktree `.agent-worktrees/audit-r35-int` on
`devin/audit-r35-INT-b1ffef6c` (test+doc writes only — P1/P2 read-only on
production). Every claim below carries an EXECUTED deterministic repro in
`src/services/save/auditR35INT.probe.test.ts` (7 tests, all green —
`npx vitest run <file> --pool=threads`, `@vitest-environment node`,
`Date.now` mocked).

Verification executed:
- `npx vitest run src/services/save/auditR35INT.probe.test.ts --pool=threads`
  — 7/7 green.
- Full read of the r34 surfaces at the audit commit:
  `useAppLifecycle.ts` (:261-305 pause/resume gates, :335-781 bootGame —
  beginChecking inside try :370, discardStaleBattle :740, markReady :744,
  tail try/catch :755-775, finally :778-781),
  `GameManagerTurnBattleOps.ts` (:1544-1654 clearCycleEntryState +
  discardFailedCycle/discardStaleBattle/discardInFlightBattle, :2026-2304
  spawn factory + startStage + mintCombatSessionForLaunch, :2416-2481
  getStageProgress + abandonBattle),
  `OnlineSessionController.ts` (:183-191 canMutate, :240-255 pause,
  :470-540 attemptReconnect -> onResume -> markReady),
  `reconnectPipeline.ts` (:39-77 'replaced' = revision moved, carries save),
  `App.vue` (:666-749 bindOnlineAuthority onPause/onResume/onStateChange,
  :981-1122 bootGame callers),
  `SaveSystem.ts` (:273-343 restoreGameSession — preflight, in-place
  player restore, setActivePlayer($state), zero combat touch),
  `stores/player.ts` (:369+ restoreFromSave — Reflect.deleteProperty
  sweep + Object.assign IN PLACE at :669-677; $state identity survives),
  `CombatClock.ts` (stop clears every reason + carry; freeze/resume no-op
  when 'stopped'),
  `PresentationSession.ts` (:168-180 end — zero events),
  `EnemyManager.clear`/`EnemySystem.despawn`/`StageManager.release`/
  `StageWaveSystem.stopRepeat` — all silent, identity-checked,
  `combatAudioBinding.ts` (:221-238 — listens to session_started +
  battle_end only; NO session-end consumer exists anywhere),
  `CombatTopBar.vue` (:95-125 user-pause latch + unmount release),
  `ProductionSystem.ts` (:143-208 — F3 comment verified against code order:
  the `<=` drop test :171 runs before the domain/headroom check :190).
- Consumer census of the discard clear-set: every cleared binding is
  either re-read only behind `turnBattle !== null`/`session` gates, or
  reads a known-idle value (stageWaves lease released -> getStageProgress
  null; surviveLethal null until next cycle's step-5 rewiring;
  statusVfx/reaction/proc cursors identity-gated by battle object).
- Prior-report sweep (r29-r34 adjudications + learned-defects): the
  onResume 'replaced' arm was READ by r34-AUT (:693-737 in the read list)
  but never probed or adjudicated — not an accepted residual.
- Refactor faithfulness: `discardInFlightBattle` is the pre-refactor
  `discardFailedCycle` body verbatim (verified against `db694183`);
  `abandonBattle` is byte-identical to its pre-refactor form (its own
  terminal path — retains the defeated battle + banks carry by design).

---

## Verdict: FAIL (0 Critical / 0 High / 1 Medium / 0 Low / 1 Nit)

The r34 discard contract — identity-rebind + unlatch implies discard first —
is coherent *on the boot seam it fixed* and fails on the sibling seam it did
not touch: `App.vue`'s `onResume` 'replaced' arm performs the same
`restoreGameSession` wholesale rebind of `player.$state`, then unlatches
combat via `resumeSimulation()` with no `discardStaleBattle()`. Executed
repro: a frozen mid-stage battle resumes and steps on the replacement
character's state while still carrying the dead owner's entity snapshot —
the exact ghost-resolution mechanism r34-COR-F1 closed.

| ID | Severity | Class | Surface |
|---|---|---|---|
| R35-INT-1 | Medium | integration seam asymmetry | `App.vue:704-737` onResume 'replaced' arm |
| R35-INT-2 | Nit | stale-but-gated read | `turnRuntime`/`battleBuffRegistry` not cleared by discard (pre-existing; unreachable in practice) |

---

## R35-INT-1 (Medium, confirmed) — 'replaced' reconnect-resume resumes the ghost battle onto the rebound character

**Mechanism chain (every link verified in code, the end state executed by
probe A):**

1. Live battle, `entryStage === 'game'`, combat clock 'running'
   (a revealed stage farm — 'not-revealed' already released).
2. Authority pauses (heartbeat/save failure) → `OnlineSessionController`
   'reconnecting' → `App.vue:702` `onPause` → `lifecycle.pauseSimulation()`
   → `simPaused = true` + `freezeCombat('authority-pause')` — the battle
   freezes **but stays bound**: `turnBattle` non-null,
   `playerDataForTurnBattle === player.$state`, stage lease armed,
   auto-repeat flag live.
3. The remote head revision moves while paused (second device wrote, or
   the journal reconcile commits a different head — the designed
   'replaced' trigger, `reconnectPipeline.ts:58`).
4. `attemptReconnect` (:513-531) gets `{status:'resumed', lineage:
   'replaced', save}` → `onResume('replaced', save, serverAuthority)`:
   - `App.vue:718` — `restoreGameSession(player, gameManager, save,
     {kind:'live-replacement'})` → `player.restoreFromSave` mutates
     `$state` **in place** (deleteProperty sweep + Object.assign,
     `stores/player.ts:669-677`) and re-runs
     `setActivePlayer(player.$state)` — *the same object*. Every stale
     battle binding now reads the replacement character.
   - `App.vue:736` — `lifecycle.resumeSimulation()` → gates pass
     (`!stopped && simPaused && entryStage==='game'`) →
     `resumeCombat('authority-pause')` → CombatClock 'running'.
   - `attemptReconnect` then `markReady()`.
5. `advanceCombat` steps the ghost battle. Its entity snapshot is the dead
   owner's; its data channel is the new character's `$state`. Carry
   banking, loot sessions, and the auto-repeat stage lease keep writing
   into the rebound character — silent divergence on a live admitted
   session.

**Executed repro** (`auditR35INT.probe.test.ts`, describe A, real
`restoreGameSession` + real `usePlayerStore` + real lifecycle pause/resume):
pre-resume 'frozen' with 'authority-pause' latched → `restoreGameSession`
returns 'ok', `$state.name` flips to the replacement's name →
`resumeSimulation()` → clock 'running', `getTurnBattle()` non-null,
`players[0].entity.name` still the dead owner's name while
`$state` carries the replacement → `combatSource.advance(1)` →
`getElapsedCombatSteps() > 0` → `getStageProgress()` still non-null (the
dead stage's lease stays armed, so auto-repeat keeps farming it).

**Control** (probe A2): 'same' lineage — no rebind — resumes the live
battle correctly. The defect is not the resume; it is the missing discard
on the rebind arm.

**Why it is the same class as r34-COR-F1:** bootGame's doctrine is that a
wholesale `$state` rebind orphans the in-flight battle, so 'entered' pays a
silent discard before unlatch. The 'replaced' arm is a rebind + unlatch on
a different entry — the doctrine covers it, the code does not.

**Reachability bound (honest):** remote-authoritative mode only (the
reconnect dep is bound only when `capability === 'remote-authoritative'`
+ a supabase config exists); requires a mid-battle authority pause *and* a
moved remote revision during the pause — narrow but a designed happy-path,
not an injected fault (multi-device play during a connectivity blip is the
explicit reason the lineage exists). 'not-revealed' bounds only battles
never revealed — a battle the user was watching resumes instantly. Rated
Medium: deterministic once the preconditions hold, real on-state
contamination, narrower trigger than a boot-path equivalent.

**Repair shape for the adjudicator (not applied — INT audits only):**
mirror the boot arm — `gameManager.discardStaleBattle()` on the 'replaced'
branch after a successful `restoreGameSession` and before
`resumeSimulation()`, or inside `resumeSimulation`'s rebind awareness if
the coordinator prefers the lifecycle to own it. The rejection arm
(`restored.status === 'rejected'` → markFailed + bootFlow.fail + return)
already leaves the latch held and never resumes — consistent with the boot
fail arms.

## R35-INT-2 (Nit) — `turnRuntime`/`battleBuffRegistry` outlive the discard

`discardInFlightBattle` does not clear `turnBattleSystem`, `turnRuntime`,
`combatScheduler`, or `battleBuffRegistry` — pre-existing (identical on the
old `discardFailedCycle`, which shared this gap). The only unguarded reader
is `getBattleBuffs` (:1053), which can return the dead battle's buff list
for an entity id — but every caller (`theBarBridge`,
`useTurnBattleInfo`, `BattleMetrics`) iterates entity ids sourced from a
live battle, so post-discard the stale map is unreachable; the next
`beginBattleCycle` rebuilds `turnRuntime` wholesale anyway (:1668-1669
step 4). Cosmetic dead state only — recorded, no action needed.

---

## Verified-coherent surfaces (rejected candidates)

- **`session.end` emits nothing** — `PresentationSession.end()` (:168-180)
  is internal bookkeeping; no `presentation_session_ended` event exists
  anywhere in the codebase. `EnemyManager.clear`, `EnemySystem.despawn`,
  `StageManager.release`, `stageWaves.stopRepeat` are likewise silent. The
  discard can produce no phantom 'battle ended' consumer (the only combat
  audio binding listens to `presentation_session_started`/`battle_end`,
  neither emitted — probe D pins discard silence directly).
- **Discard-before-markReady ordering is safe** — teardown runs while
  `canMutate() === false`, but nothing inside `discardInFlightBattle`
  consults `canMutate` or emits a domain event; all primitives are
  ops-internal state writes. The post-markReady window (markReady :744 →
  tail try :755) is fully synchronous.
- **`clearCycleEntryState` is complete for the seam** — pendingSteps,
  pipeline, turnToken, runtime pending state, boundaryQueue, activeBuild,
  hidden-trial release + resume all cleared. `pendingCycleRng` correctly
  excluded (launch-scoped; `startStage`'s `finally` :2254 owns it).
  `lastStageEnemyTemplate` is pre-existing spawn-factory fallback shared
  with the abandon path.
- **'stopped' vs 'frozen' contract consistent** — sibling freeze reasons
  dying with the battle is coherent: `user-pause`/`tab-hidden`/
  `not-revealed` are per-battle latches owned by the battle's own
  consumers (CombatTopBar unmount release :117-121, visibility listener,
  session hold); a battleless post-discard session has nothing for them
  to freeze. r33Aut-C's sibling-hygiene pin still holds and my probe A3
  re-pins it on the resume seam (user-pause survives authority unlatch).
- **Flipped pins vs doctrine — no contradiction.** r32Int R1/R2, r33Int
  R2/R4, r33Aut-B all now assert discard/'stopped'/null-battle on
  successful re-boot; r33Aut-C pins reason hygiene orthogonal to the
  discard. Executed: B (full clear-set on 'entered'), C1 (failed boot
  keeps zombie + lease), C2 (tail throw → catch's freezeCombat no-ops on
  the stopped clock — deny direction both ways).
- **`discardFailedCycle`/`discardStaleBattle`/`abandonBattle` delegation
  is faithful** — `discardInFlightBattle` is the old `discardFailedCycle`
  body verbatim; `abandonBattle` unchanged: retains the terminal battle,
  banks carry, emits exactly one `battle_end` (probe D).
- **`restoreGameSession` touches no combat state** — its rebind is why the
  discard exists, and it does not partially cover it (verified
  :293-314 — player + saveOps + buildings + equipment modifiers only).
- **ProductionSystem F3** — comment-only change, accurate: the `<=` drop
  test :171 precedes the domain/headroom check :190-194, so inverted
  out-of-domain pairs drop and non-inverted ones park verbatim.
- **`beginChecking` inside the outer try** — a beginChecking throw now
  releases `bootInFlight` in the finally :778-781 (no strand); nothing
  throwable sits between `bootInFlight = true` (:340) and `try` (:369).
- **UI consumers post-discard** — CombatTopBar/CombatResultModal/
  AutoFarmIndicator/`theBarBridge`/`BattleMetrics`/`useTurnBattleInfo`
  all gate on `getTurnBattle()`/`getStageProgress()` or iterate
  battle-sourced entity ids; null-safe on the cleared set.
- **`enterTerminal`/`suspend`/`same`-lineage arms** — terminal pause
  latches and never resumes (teardownToAuth precedes any boot, where the
  discard covers); 'same' lineage carries no rebind, so resume without
  discard is correct (probe A2 control).

## Coverage notes for the coordinator

- The one confirmed defect is a *sibling-seam* asymmetry: same mechanism
  class as r34-COR-F1, different entry point. A symmetric fix
  (`discardStaleBattle` after a successful 'replaced' restore, before
  `resumeSimulation`) would make the doctrine hold on every
  rebind-then-unlatch arm; probe A provides the deterministic before/after
  harness (post-fix, the arm should end 'stopped' + battleless).
- Everything else on the mandated checklist verified coherent with
  executed pins where a pin was cheap (7/7 green).
