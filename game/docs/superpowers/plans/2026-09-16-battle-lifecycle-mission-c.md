# Mission C — Battle Lifecycle Constitution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One authority owns the battle lifecycle; a repeat cycle is provably a fresh battle; all combat rolls consume one injectable session RNG; cultivation-path integration goes through one interface; the verified skill-semantic bugs are fixed with regression tests.

**Architecture:** `GameManagerTurnBattleOps.beginBattleCycle(policy)` becomes the ONE lifecycle owner; `startBattle` / `startBattleWithPlayer` / `startStage` / `restartTurnBattleCycle` all delegate to it and keep no private reset lists. Repeat = **FRESH BATTLE** (locked decision — spec C1): the player side is rebuilt through the same bootstrap as `startStage`, not carried. One session RNG minted per cycle reaches `CombatSystem`, `BuffSystem`, `TurnBattleSystem`, enemy placement, and spawn-tag rolls. `CultivationPathRuntime` absorbs the path-id branches out of `buildTurnBattle`.

**Tech Stack:** TypeScript, Vitest. No Vue/Phaser in `core/`.

**Spec:** `docs/specs/2026-09-16-audit-remediation-spec.md` Mission C (C1–C5; decisions locked: repeat = fresh battle). Audit: `docs/qa/2026-09-16-full-project-scout-audit.md` rows T1-4, T3-19, T3-22, T5-41..44.

## Global Constraints

- **Dev-stage rule:** no live players — no compat shims, no dual paths. Repeat stops carrying battle-scoped state outright; there is no "legacy carry mode" to preserve.
- **Locked decision (spec C1):** each auto-repeat cycle is a FRESH BATTLE — full reset of HP / MP / Ward / buffs / debuffs / cooldowns / action gauge / survive charges+sources / path runtime / proc counters / dynamic basic / `currentThe` — equivalent to a new `startStage`. The ONLY things a repeat preserves are stage aggregate state: the stage binding (`activeStageForTurnBattle`, `StageManager.active`), the repeat arm (`turnBattleRepeatContinuously`), the player identity (`playerDataForTurnBattle`), the accumulated loot session (`BattleLootSystem` summary — per-kill drops already paid at kill time), and the run timer (`turnBattleStartedAtMs`, feeds perfect-clear `clearSeconds` which measures the whole farming run).
- **Audit corrections already verified against code (read before planning edits):**
  - T3-19 cites `src/data/buff/ThuanHeBuffs.ts` for `thach_hoa` — the definition actually lives in `src/data/buff/LegacyBuffs.ts:229-247`. `ThuanHeBuffs.ts` only mentions it in a comment.
  - T3-19's `thach_hoa` "enemy stuns the player" claim is DISPUTED, not confirmed: `docs/systems/buffs.md:18` documents `onHitProc` = "khi chủ buff đánh trúng → chance áp buff khác" (holder's landed hit procs onto the victim), and `TurnBuffIdentity.test.ts:141` explicitly labels holder→victim the "authored direction". Task 10 resolves this with a decision record — do NOT flip the data blindly.
  - T3-22's "manual mode discards queued reactive-turn choices" is STALE: `GameManagerTurnBattleOps.stepTurnBattle` already detects `isPendingQueuedExecution(readyActor.id)` and claims with `manualMode: false` (`GameManagerTurnBattleOps.ts:478-483`). Task 6 locks the contract with tests; no behavior change expected.
  - T1-4 is REAL and worse than the summary suggests: on natural defeat with repeat armed, `GameManagerBattleRewardOps.ts:135-137` skips `stageWaves.stopRepeat()` — so `StageManager.active` stays set and `repeatStageContinuously` stays armed with no battle running. Every later `StageManager.start()` no-ops for the session.
  - T5-43 is only partially stale: `TurnBattleSystem` does take an injectable `rng` (`TurnBattleSystem.ts:478`) but `CombatSystem` (:213/:272/:283/:297) and `BuffSystem` (:488/:514) still call global `Math.random`, and orchestration placement (`GameManagerTurnBattleOps.ts:967`, `:1110`) plus spawn selection (`StageSystem.ts:9`, `StageWaveSystem.ts:168/185`, `HiddenBeastSystem.ts:27` via `DropRoll.ts`) never see it.
- P8: no `any` — narrow with `unknown` + guards. P15: English ASCII comments in `.ts`. A2/A5: one authority per rule; ops orchestrate. A8: no `if path === ...` content branches in generic mechanisms.
- P17: this mission changes combat contracts → update the `docs/roadmap.md` combat-chain section (the "Primary combat chain" block at ~:1843 and the Phase R5 contract at ~:708) inside the repeat-policy task (Task 3), in the same change.
- Worktree: `.agent-worktrees/battle-lifecycle` (branch `refactor/battle-lifecycle`).
- Verification per task (P3 quick): `npm run type-check` + `npx vitest run <task scope>`.

## Current-state evidence (verified — read-first map)

### Reset inventory per entry path (what each resets TODAY)

| State | `startBattle` (:817) | `startBattleWithPlayer` (:881) | `startStage` (:1212) | `restartTurnBattleCycle` (:1137) |
|---|---|---|---|---|
| `turnBattle` object | rebuilt via `buildTurnBattle` | via `startBattle` | via `stageWaves.start` → `launchBattle` → `startBattleWithPlayer` | rebuilt literal (:1162) — **players carried wholesale** |
| Player entity vitals (HP/MP/Ward/`externalWard`) | fresh entity passed in | fresh via `playerToCombatEntity` | fresh via same | **CARRIED — HP/MP/Ward/`externalWard` leak into cycle 2** |
| `entity.currentThe` | fresh entity (0) | fresh | `resetBattleScopedResources` (:1254-1256) | `resetBattleScopedResources` (:1157-1159) |
| `participant.buffs` pool | fresh participant | fresh | fresh | **CARRIED — debuffs/cc/marks persist** |
| `actionGauge` / `specialAttackCounter` / `consecutiveHardCcTurns` / `baTheTriggeredAtTurn` | fresh | fresh | fresh | **CARRIED** |
| `special`/`ultimate.remainingCooldownTurns` | fresh | fresh | fresh | **CARRIED — cooldowns persist** |
| `chargingTurnsRemaining` / `pendingChargedSkillId` | fresh | fresh | fresh | **CARRIED — a mid-charge leaks** |
| `dynamicBasic` provider (Kiem Pho/Ngu Kiem Dao state) | rebuilt in `buildTurnBattle` | rebuilt | rebuilt | `resetForBattle?.()` called (:1159) |
| `reactivePayloads` (The Tu An clones) | rebuilt | rebuilt | rebuilt | **CARRIED on the reused participant** |
| `bossTrigger.firedAlready` | fresh enemy participants | fresh | fresh | new `TurnBattleSystem`, but enemy participants respawn fresh anyway |
| `queuedFollowUps` / `queuedExecutions` / `followUpChainDepth` | new object literal (absent) | same | same | new object literal (absent) — OK |
| `TurnBattleSystem` private pending (`pendingReactiveEntry` :493, `pendingQueuedExecution` :501, `pendingGaugeDelta*` :485-486, `manualOptionsByActor`, `nextReactiveActionId`) | `turnBattleSystem` field — NOT rebuilt here | same | rebuilt inside `stageWaves` flow? NO — rebuilt only in `restartTurnBattleCycle` (:1181) and initial construction | **new instance (:1181) — OK** |
| `rewardOps` (`rewardsGranted`, `battleEndEmitted`) | `resetRewardState()` :834 | same | `resetRewardState()` :1247 | `resetRewardState()` :1146 |
| `presentationOps.runtime` pending (ready/declared/impact/manual, `playbackToken`) | `resetPendingState()` inside `resetTurnEngine`? NO — only `clearPendingSteps`+pipeline+token (:766-770); `resetPendingState` NOT called in `startBattle` | same | `resetPendingState()` :1248 | `resetPendingState()` :1147 |
| `boundaryQueue` | cleared :871 | same | cleared at COMBAT_OVER (:725) + :871 via startBattle | cleared at COMBAT_OVER (:725) before restart — OK |
| `combatClock` | stop+start :876-877 | same | same via startBattle | NOT stopped — kept running into cycle 2 |
| `battleLoot` session/summary | `beginBattle()` :823 (clears summary+receiver) | + `setSession` :927 | same | **NOT re-run — summary accumulates (KEEP: per-stage haul)** |
| `surviveLethalGuard` talent charge | `setSurviveLethalSession(null)` :825 | `beginBattle` :933 + `setSurviveLethalSession` :941-953 | same | **CARRIED — spent Bat Tu The charge / Bat Tu source state leaks** |
| `resetPassiveStacks` / `seedPassiveCarry` ordering | `resetPassiveStacks` :824 | reset BEFORE snapshot :893, seed AFTER build :918 | same | **NEITHER runs — banked carry neither cleared nor re-seeded** |
| `turnBattleStartedAtMs` | untouched | untouched | `= Date.now()` :1249 | untouched (KEEP: run timer) |
| `activeStageForTurnBattle` | nulled for non-stage :847 | same | set :1235 | preserved (KEEP) |
| `turnBattleRepeatContinuously` | untouched | untouched | set :1234 | preserved (KEEP) |

Canonical reset list (locked): every row marked **CARRIED** above must reset on repeat; the KEEP rows are the deliberate stage-aggregate exceptions encoded in the repeat policy.

### Production combat `Math.random` inventory (Task 8 scope)

| Site | Roll | In session RNG? |
|---|---|---|
| `CombatSystem.ts:213` | `chanceToIgnoreResistance` | YES (target) |
| `CombatSystem.ts:272` | hit vs evasion | YES |
| `CombatSystem.ts:283` | block | YES |
| `CombatSystem.ts:297` | critical | YES |
| `BuffSystem.ts:488` | `onHitProc` chance | YES |
| `BuffSystem.ts:514` | `reactiveTrigger` chance | YES |
| `TurnBattleSystem.ts:478` | injectable `rng` — composite picks (:1313, :2105), multicast (:2237), reactive chanceStat (:2391), ailment application (:2941) | already — feed it the session rng |
| `GameManagerTurnBattleOps.ts:967` | mid-battle enemy placement (`resolveEnemySpawnPosition`) | YES |
| `GameManagerTurnBattleOps.ts:1110` | initial enemy placement | YES |
| `StageWaveSystem.ts:168,185` | `rollChance(eliteChance)` boss/elite tag | YES |
| `StageSystem.ts:9` | `weightedRandom` enemy-pool pick | YES |
| `HiddenBeastSystem.ts:27` | `rollChance(0.05)` hidden-beast substitution | YES |
| `DropRoll.ts:12/16/33` | `randomInt`/`rollChance`/`weightedRandom` primitives | gain optional `rng` param |
| `BattleLootSystem.ts:454` | `randomInt` loot-table pick | **OUT** — reward economy, not combat outcome; a seeded battle does not pin drops |
| `GameManagerTickOps.ts:209` | alchemy tick random | **OUT** — not combat |
| `GameManagerPillOps.ts:37` | pill randomness | **OUT** — not combat |
| `EquipmentRolling`/`dropSampling`/`DropTable` | equipment/drop economy | **OUT** |

---

### Task 1: `BattleCyclePolicy` — codify the fresh-battle contract (spec C1, audit T5-42)

**Files:**
- Create: `src/core/battle/BattleCyclePolicy.ts`
- Test: `src/core/battle/BattleCyclePolicy.test.ts`

**Interfaces:**

```ts
// 'tribulation' from spec C2 maps onto 'fresh': tribulation battles are
// run by TribulationDirector (GameManager.startTribulation :1564-1576),
// a separate lifecycle that never enters the turn-battle ops — the
// non-stage branch of startBattle (:843-862) is the only tribulation-
// adjacent path this owner covers. Do NOT add a 'tribulation' kind
// until a real consumer exists.
export type BattleCycleKind = 'fresh' | 'stage' | 'repeat' | 'test'

// Canonical battle-scoped state that a fresh battle must NOT inherit.
// One entry per inventory row (see plan header table); the repeat test
// in Task 3 asserts each field by name.
export const BATTLE_CYCLE_RESET_FIELDS = [
  'entityVitals',        // currentHp/currentMp/currentWard/alive back to build values
  'entityExternalWard',  // externalWard source-tagged pool
  'entityTurnsSinceLastHitLanded',
  'entityCurrentThe',
  'participantBuffs',    // BuffPool — buffs, debuffs, cc, marks
  'participantGauge',    // actionGauge
  'participantCounters', // specialAttackCounter, consecutiveHardCcTurns, baTheTriggeredAtTurn
  'participantCooldowns',// special/ultimate.remainingCooldownTurns
  'participantCharge',   // chargingTurnsRemaining, pendingChargedSkillId
  'participantDynamicBasic', // provider resetForBattle or rebuild
  'participantReactivePayloads',
  'battleQueues',        // queuedFollowUps, queuedExecutions, followUpChainDepth
  'battleRoundState',    // actedThisRound, totalTurnsElapsed, roundsElapsed
  'turnSystemPending',   // pendingReactiveEntry/pendingQueuedExecution/gaugeDelta/manualOptions — new instance
  'rewardOnceGuards',    // rewardsGranted, battleEndEmitted
  'presentationPending', // runtime.resetPendingState: ready/declared/impact/manual + playbackToken
  'enginePipeline',      // clearPendingSteps + pipeline.reset + turnToken.reset
  'boundaryQueue',       // ops-level command queue
  'surviveSession',      // guard.beginBattle + extraSources rebuilt + setSurviveLethalSession
  'passiveStacks',       // resetPassiveStacks then seedPassiveCarry (banked carry)
] as const
export type BattleCycleResetField = (typeof BATTLE_CYCLE_RESET_FIELDS)[number]

export interface BattleCyclePolicy {
  kind: BattleCycleKind
  /** Subset of BATTLE_CYCLE_RESET_FIELDS this kind resets. */
  reset: ReadonlySet<BattleCycleResetField>
  /** 'repeat' skips intro/countdown and enters 'fighting' directly. */
  entryState: 'intro' | 'fighting'
  /** Stage binding to keep/write (repeat keeps the launching stage). */
  preserveStageBinding: boolean
  /** Loot summary accumulates across repeat cycles within one stage. */
  preserveLootSession: boolean
}

export const FRESH_BATTLE_RESET: ReadonlySet<BattleCycleResetField> =
  new Set(BATTLE_CYCLE_RESET_FIELDS)

export const BATTLE_CYCLE_POLICIES: Record<BattleCycleKind, BattleCyclePolicy> = {
  fresh:       { kind: 'fresh',       reset: FRESH_BATTLE_RESET, entryState: 'intro',    preserveStageBinding: false, preserveLootSession: false },
  stage:       { kind: 'stage',       reset: FRESH_BATTLE_RESET, entryState: 'intro',    preserveStageBinding: false, preserveLootSession: false },
  repeat:      { kind: 'repeat',      reset: FRESH_BATTLE_RESET, entryState: 'fighting', preserveStageBinding: true,  preserveLootSession: true  },
  test:        { kind: 'test',        reset: FRESH_BATTLE_RESET, entryState: 'fighting', preserveStageBinding: false, preserveLootSession: true  },
}
```

- [ ] **Step 1: Failing test** — `BattleCyclePolicy.test.ts`:
  - `repeat.reset` equals `FRESH_BATTLE_RESET` (the locked decision encoded — a future "carry" edit fails loudly).
  - `repeat` is the only kind with `entryState: 'fighting'` + `preserveStageBinding/preserveLootSession: true`.
  - every `BattleCyclePolicy.reset` is a subset of `BATTLE_CYCLE_RESET_FIELDS` (typo guard).
- [ ] **Step 2: FAIL** — `npx vitest run src/core/battle/BattleCyclePolicy` (module does not exist).
- [ ] **Step 3: Implement** `BattleCyclePolicy.ts` exactly as above; adjust field names ONLY if the Step-4 inventory diff demands it.
- [ ] **Step 4: Inventory diff** — re-open `GameManagerTurnBattleOps.ts` and confirm every row of the header table maps to exactly one field name; add/remove fields so the list is complete (e.g. if `lastStageEnemyTemplate` or `manualOptionsByActor` need names). Update the header table in THIS plan only if the code disagrees — the plan must not lag the truth.
- [ ] **Step 5: PASS + type-check.**
- [ ] **Step 6: Commit** `feat(battle): codify fresh-battle repeat policy`

---

### Task 2: `beginBattleCycle(policy)` — single lifecycle owner (spec C2, audit T5-41)

**Files:**
- Modify: `src/core/game/GameManagerTurnBattleOps.ts`
- Modify: `src/core/game/GameManager.ts` (delegate surface only — `startBattle` :874, `startBattleWithPlayer` :1536, `startStage`)
- Test: `src/core/game/GameManager.battleCycle.test.ts` (new)

**Interfaces:**

```ts
// In GameManagerTurnBattleOps:
private beginBattleCycle(
  policy: BattleCyclePolicy,
  request: {
    player?: PlayerData            // required for 'stage'/'repeat'/'fresh' player battles
    playerEntity?: CombatEntity    // raw entity for 'test'/devtools paths
    initialEnemy?: Enemy           // bootstrap enemy template (non-stage starts)
  },
): void
```

Ordered canonical sequence inside `beginBattleCycle` (this IS the merged reset list — every line names the existing mechanism it consolidates):

```ts
// 1. Session/pending teardown — BEFORE any new state is built:
this.clearPendingSteps()                        // stale fallback timers
this.pipeline.reset(); this.turnToken.reset()   // = resetTurnEngine()
this.presentationOps.runtime.resetPendingState()// ready/declared/impact/manual + token
this.boundaryQueue = []
this.battleGeneration += 1                      // NEW: monotonic cycle id (Task 5)

// 2. Per-policy domain resets:
this.rewardOps.resetRewardState()
if (!policy.preserveLootSession) this.deps.battleLoot.beginBattle()
this.deps.combatSystem.setSurviveLethalSession(null)

// 3. Player side (fresh/stage/repeat): the SAME bootstrap as
//    startBattleWithPlayer — resetPassiveStacks → resolvePlayerStats →
//    playerToCombatEntity → resolvePlayerMaxThe → buildTurnBattle →
//    seedPassiveCarry → refreshEffectiveStats → setSession →
//    surviveLethalGuard.beginBattle → buildTheTuBatTuSurvival →
//    setSurviveLethalSession. Extract it once; both callers consume it.

// 4. Battle assembly: this.turnBattle = buildTurnBattle(entity, enemies)
//    + policy.entryState override ('repeat' → 'fighting', wave rebuilt
//    from activeStageForTurnBattle exactly as :1162-1179 does today).

// 5. Engine + clock: this.turnBattleSystem = new TurnBattleSystem(...)
//    this.combatRng = this.deps.createBattleRng() (Task 8)
//    this.combatClock.stop(); this.combatClock.start(); this.syncOffScreenFreeze()
```

- [ ] **Step 1: Read first** — `startBattle` (:817-879), `startBattleWithPlayer` (:881-954), `startStage` (:1212-1330), `restartTurnBattleCycle` (:1137-1208), `resetTurnEngine` (:766-770), `abandonBattle` (~:1360-1390). List which statements each keeps after delegation — the answer should be "only validate + call + post-entry glue".
- [ ] **Step 2: Failing test** — `GameManager.battleCycle.test.ts`: instrument the four entry paths (a stage start, a `startBattleWithPlayer` non-stage start, a repeat victory, an abandon→restart) and assert each runs the FULL reset list — concretely: after a battle with a debuffed/on-cooldown/charged player, each entry leaves `participant.buffs` empty, cooldowns 0, gauge 0, `entity.currentThe === 0`, `rewardOps` guards cleared (observable: a second `battle_end` publishes).
- [ ] **Step 3: FAIL** — today `startBattle` never calls `runtime.resetPendingState()` (see inventory row) and `restartTurnBattleCycle` never touches `battleLoot`/survive/passive ordering.
- [ ] **Step 4: Implement** — extract the player bootstrap from `startBattleWithPlayer` (:893-953) into a private `buildPlayerBattleSide(player)`; write `beginBattleCycle`; make `startBattle`, `startBattleWithPlayer`, `restartTurnBattleCycle`, and the `startStage` post-`launchBattle` block all call it. `abandonBattle` keeps its own teardown (it ENDS a cycle, doesn't begin one) but routes its `runtime.resetPendingState()` + `stopRepeat()` through the same helper block so the pending-clear can't drift.
- [ ] **Step 5: PASS** — `npx vitest run src/core/game/GameManager.battleCycle src/core/game/GameManager.bossRepeatCycle src/core/game/GameManagerTurnBattleOps.commandBoundary` + type-check.
- [ ] **Step 6: Commit** `refactor(battle): single beginBattleCycle lifecycle owner`

---

### Task 3: Repeat cycle = fresh battle (spec C1, audit T5-42) + roadmap (P17)

**Files:**
- Modify: `src/core/game/GameManagerTurnBattleOps.ts` (`restartTurnBattleCycle` :1137-1208 → `beginBattleCycle(BATTLE_CYCLE_POLICIES.repeat, { player })`)
- Modify: `docs/roadmap.md` (combat-chain section — document `beginBattleCycle` ownership + fresh-battle repeat)
- Test: `src/core/game/GameManager.bossRepeatCycle.test.ts` (extend), `src/core/game/GameManager.battleCycle.test.ts`

- [ ] **Step 1: Failing tests** — one per leaked field, using the repeat flow (`startStage(player, stage, true)` → force victory → auto-restart):
  - Player at 30% HP with `currentWard=0`, an active debuff (`apply` `choang` or `thach_hoa` into `participant.buffs`), `special.remainingCooldownTurns=3`, `actionGauge=partial`, `entity.currentThe=40`, a spent `SurviveLethalGuard` charge, and a pending `chargingTurnsRemaining>0` → after the repeat tick: `entity.currentHp === entity.stats.maxHp`, `currentWard` back to build value, `participant.buffs` empty, cooldowns 0, gauge 0, `currentThe === 0`, survive charge re-armed (a lethal hit in cycle 2 survives again), `chargingTurnsRemaining` cleared, `externalWard` cleared.
  - `turnBattle.state === 'fighting'` (no re-countdown) AND `totalTurnsElapsed === 0`, `roundsElapsed === 0`, `actedThisRound` empty, `queuedFollowUps`/`queuedExecutions` absent.
  - `getBattleRewardSummary()` still contains cycle-1 loot rows (preserveLootSession) — lock the deliberate exception.
  - `turnBattleStartedAtMs` unchanged (run timer preserved).
- [ ] **Step 2: FAIL** — every carry assertion fails today (`restartTurnBattleCycle` carries `previous.players` wholesale :1163).
- [ ] **Step 3: Implement** — `restartTurnBattleCycle` delegates: rebuild the player side via Task-2's `buildPlayerBattleSide(playerDataForTurnBattle)`, assign a fresh `TurnBattle` with `state: 'fighting'` + rebuilt `wave` (keep the :1172-1178 logic), new `TurnBattleSystem`/`TurnReactionManager`, then `resetTurnEngine()` — all inside `beginBattleCycle`. Delete the carry-over comment (:1149-1156) and replace with the fresh-battle contract citation.
- [ ] **Step 4: Roadmap** — `docs/roadmap.md`: in the combat-chain documentation (the "Primary combat chain" block ~:1843 and/or the turn-engine notes in section 9 ~:2845), record: "`beginBattleCycle(policy)` is the ONE battle-lifecycle owner (fresh/stage/repeat/test); auto-repeat = fresh battle, no carried battle-scoped state; session RNG injected per cycle." P17 requires this in the same commit.
- [ ] **Step 5: PASS** — `npx vitest run src/core/game` + type-check.
- [ ] **Step 6: Commit** `feat(battle): fresh-battle auto-repeat cycle`

---

### Task 4: Defeat terminal releases the stage slot under repeat (audit T1-4) — **DEFERRED TO MISSION B TASK 3**

> **Cross-plan ownership note:** Mission B Task 3 owns the single edit to `GameManagerBattleRewardOps.ts:135-137` (`defeat || !repeat → stopRepeat()`) plus its failing test in `GameManager.repeatStage.test.ts` — spec order runs A→B→C, so by the time this mission executes the fix is already merged. Do NOT re-apply the change here: two worktrees editing the same hunk with the same commit message produce a guaranteed merge conflict.
>
> What this mission still owes around that fix:
>
> - [ ] **Step 1: Regression net** — after `git merge`/rebase onto post-B master, confirm `GameManager.repeatStage.test.ts` contains the T1-4 defeat-releases-slot test and it passes; if the merge dropped it, restore it here.
> - [ ] **Step 2: Contract check inside `beginBattleCycle`** — Task 2/3's canonical reset must preserve the post-B behavior: a defeat terminal ALWAYS releases the stage slot (repeat only survives victory). Add one assertion to the Task-3 repeat-cycle test that a defeat inside a repeat-armed cycle leaves `stageWaves` disarmed — guards the fix against the lifecycle refactor regressing it.

---

### Task 5: Pending-state generation guard (spec C2, R5 contract)

**Files:**
- Modify: `src/core/game/GameManagerTurnBattleOps.ts` (`battleGeneration` counter; include in `getTurnTokenState`/debug surface if useful)
- Modify: `src/core/battle/turn/CombatAnimationRuntime.ts` (only if Step-3 evidence demands — see below)
- Test: `src/core/game/GameManagerTurnBattleOps.commandBoundary.test.ts` (extend), `src/core/battle/turn/CombatAnimationRuntime.test.ts` (extend)

Current protection (verified): every ack requires `token === this.playbackToken` (`CombatAnimationRuntime.ts:215/248/334`), `playbackTokenSeq` is monotonic and never reset (:118-126), `resetPendingState` clears `playbackToken` (:453), `awaitStep` fallback timers are cleared by `clearPendingSteps` (:654-661) which `resetTurnEngine` runs (:767). The remaining gap is WIRING: `startBattle` never calls `runtime.resetPendingState()` — a pending manual await or mid-flight phase from a prior non-stage battle can survive into the next one.

- [ ] **Step 1: Failing tests:**
  - Pending-manual leak: manual mode ON, a player turn parks in `awaitedManualActor`; begin a NEW battle via `startBattle`/`startBattleWithPlayer` → `getAwaitedManualActor()` is `null` (today it survives — `startBattle` lacks `resetPendingState`).
  - Stale ack: capture `getPendingPlaybackToken()` in battle 1, run a full cycle restart, call `acknowledgeActionImpact(staleToken)` → no state change in battle 2 (already token-guarded — this test LOCKS it).
  - `playbackTokenSeq` monotonic: token minted in battle 2 must differ from any battle-1 token even after `resetPendingState` (guard against a future seq reset).
  - Boundary queue: a command enqueued mid-battle never drains into the next battle (already cleared at COMBAT_OVER :725 and `startBattle` :871 — lock for the repeat path).
- [ ] **Step 2: FAIL** on the pending-manual leak only.
- [ ] **Step 3: Implement** — the fix lands inside `beginBattleCycle` step 1 (Task 2 already routes every entry through it); add `this.battleGeneration += 1` and expose it for diagnostics. Only if a test shows a real mutation path, add a generation check to the runtime's acks — do not preemptively re-engineer the token guard.
- [ ] **Step 4: PASS** — `npx vitest run src/core/battle/turn/CombatAnimationRuntime src/core/game/GameManagerTurnBattleOps` + type-check.
- [ ] **Step 5: Commit** `fix(battle): clear pending playback state on every cycle entry`

---

### Task 6: Manual-mode queued reactive execution — contract lock-in (audit T3-22a, STALE claim)

**Files:**
- Test: `src/core/battle/turn/TurnBattleSystem` queued-execution test file (check for an existing `queuedExecution`/`multicast` spec first — `TurnBattleSystem.hoIntercept.test.ts` and `theTuAnRiders.test.ts` are the neighbors) or new `src/core/game/GameManagerTurnBattleOps.manualMode.test.ts`
- Modify: `GameManagerTurnBattleOps.ts` ONLY if a test exposes a real gap.

- [ ] **Step 1: Read first** — `stepTurnBattle` (:470-500): `isPendingQueuedExecution(readyActor.id)` → `manualMode: false` claim; `TurnBattleSystem.dequeueQueuedExecution`/`isPendingQueuedExecution` (:576-590, :903-915, :2255-2256); `TurnReactionManager` queuing for multicast/repeat (`queuedExecutions` :237, :2220-2238).
- [ ] **Step 2: Failing/new regression tests** (expected to PASS already — they lock the contract):
  - Manual mode ON + a successful counter/multicast queues `queuedExecutions` → the queued actor's turn resolves WITHOUT `submitTurnChoice` (claim runs with `manualMode: false`).
  - Manual mode ON + a genuinely fresh player turn → token routes to `AWAITING_INPUT`, `pauseForManualActor` runs, clock stays frozen until `submitTurnChoice` — manual gating still applies to REAL turns.
  - Queued execution discarded on battle end: queue an execution, force victory before it drains → next cycle's `isPendingQueuedExecution` is false and no phantom action fires.
- [ ] **Step 3: Implement only if a test fails** — the seam is the claim-site branch (:483); do not touch `TurnReactionManager`.
- [ ] **Step 4: PASS** + type-check.
- [ ] **Step 5: Commit** `test(battle): lock manual-mode queued-execution contract`

---

### Task 7: Actor-death-mid-impact guard (audit T3-22b)

**Files:**
- Modify: `src/core/battle/turn/TurnBattleSystem.ts` (`applyActionImpact` hit loop ~:1560-1660, charge-resolve branch :1450-1500, `applyExtraImpact` :2042-2061)
- Test: `src/core/battle/turn/TurnBattleSystem.midImpactDeath.test.ts` (new)

Evidence: `applyActionImpact` (:1417) checks `actor` exists (:1431) but never re-checks `actor.entity.alive` — the per-target loops guard only the TARGET (:1465, :1569, :1602, :1639, :2051). A reflect/`phan_chinh` payload (`reflectsDamage`, `BuffTypes.ts:73`) or a follow-up proc can kill the actor mid-AoE; the loop keeps hitting remaining targets.

- [ ] **Step 1: Failing tests:**
  - Player AoE skill vs two enemies both carrying a `reflectsDamage` reactive trigger with lethal `takenRatio` → actor dies on target 1 → target 2 takes **no** damage and no on-hit/ailment/reaction side-effects run for it.
  - Same for the charge-resolve branch (charged hit into a reflecting target kills the charger → remaining `chargeTargetIds` skipped).
  - Same for `applyExtraImpact` (provider-returned combo impact).
  - A non-lethal reflection still lets the AoE finish (no over-guard).
- [ ] **Step 2: FAIL** — today all targets are hit.
- [ ] **Step 3: Implement** — minimal guard inside each hit loop, before the per-target iteration continues:

```ts
// Mid-impact death: a reflect/proc kill on the actor stops the rest of
// the action — the dead cannot finish their swing.
if (!actor.entity.alive) break
```

Apply at: the `for (const target of ...)` loops in `applyActionImpact` (both the charged branch ~:1462 and the normal lane ~:1560+), and `applyExtraImpact` (:2047). If a loop iterates instances per target, the break must sit at the TARGET level too (dead actor = no remaining instances).
- [ ] **Step 4: PASS** — `npx vitest run src/core/battle/turn` + type-check.
- [ ] **Step 5: Commit** `fix(battle): stop mid-impact resolution when the actor dies`

---

### Task 8: Unified session RNG (spec C3, audit T5-43)

**Files:**
- Create: `src/core/battle/SeededRandom.ts` (`mulberry32` or equivalent tiny PRNG — pure, seeded, no deps)
- Modify: `src/core/combat/CombatSystem.ts` (add `setRandomSource(rng)` or a 4th ctor param; replace :213/:272/:283/:297 `Math.random`)
- Modify: `src/core/buff/BuffSystem.ts` (`rollOnHitEffects`/`rollReactiveTrigger` gain a trailing `rng: () => number = Math.random` param; :488/:514 consume it)
- Modify: `src/core/battle/turn/TurnBattleSystem.ts` (pass `this.rng` into both BuffSystem roll calls — :1816/:1826/:1032 call sites; keep the lazy default at :478)
- Modify: `src/core/reward/DropRoll.ts` (`randomInt`/`rollChance`/`weightedRandom` gain optional trailing `rng` param, default `Math.random`)
- Modify: `src/core/stage/StageSystem.ts` (`pickNextEnemyEntry(stage, rng?)`)
- Modify: `src/core/game/StageWaveSystem.ts` (`pickEnemyForSpawn`/`pickEnemyForTurnSpawn` options gain `random?: () => number`; thread into `rollChance`, `pickNextEnemyEntry`, `hiddenBeast.maybeReplaceSpawn`)
- Modify: `src/core/game/HiddenBeastSystem.ts` (`maybeReplaceSpawn(player, realmId, rng?)`)
- Modify: `src/core/game/GameManagerTurnBattleOps.ts` (mint `this.combatRng` per cycle in `beginBattleCycle` from a new optional dep `createBattleRng?: () => () => number` defaulting to `() => Math.random`; feed `new TurnBattleSystem(..., this.combatRng)`, `combat.setRandomSource(this.combatRng)`, both `resolveEnemySpawnPosition` calls (:967/:1110), and the `pickEnemyForTurnSpawn` calls (:1189, :1285))
- Test: `src/core/battle/SeededRandom.test.ts` + a determinism spec in `src/core/game/GameManager.battleCycle.test.ts` or `src/core/battle/turn/TurnBattleSystem.determinism.test.ts`

- [ ] **Step 1: Read first** — every call site in the header inventory table; confirm `CombatSystem` is shared per-GameManager (constructed once) → the session rng must be SETTABLE per cycle (`setRandomSource`), not constructor-frozen.
- [ ] **Step 2: Failing tests:**
  - `SeededRandom`: same seed → identical sequence; different seeds → different; output ∈ [0,1).
  - `CombatSystem`: injected `() => 0.99` forces every roll to fail (no ignore-resist, no crit above cap, hit blocked vs high evasion — pick assertions that isolate each roll site); `() => 0` forces all succeed.
  - `BuffSystem`: on-hit proc with `chance 0.5` fires under `() => 0.2`, not under `() => 0.9` — passed via the new param, no `vi.spyOn(Math, 'random')` needed.
  - Determinism end-to-end: `createBattleRng = () => mulberry32(1234)`; run the same `startStage` + scripted ticks twice → identical battle log (enemy ids, spawn positions, damage numbers, ailment outcomes). Assert `Math.random` is never hit: `vi.spyOn(Math, 'random')` + `expect(spy).not.toHaveBeenCalled()` during the battle tick.
- [ ] **Step 3: FAIL** — today the spy is called (hit/block/crit/placement).
- [ ] **Step 4: Implement** — threading order: `DropRoll` params → `StageSystem`/`HiddenBeastSystem` → `StageWaveSystem` options → `BuffSystem` params → `CombatSystem.setRandomSource` → ops wiring. `TurnBattleSystem` already accepts `rng` as ctor param 8 — pass `this.combatRng` at both construction sites (:1181 and the `startStage`/`startBattle` construction site).
- [ ] **Step 5: Scope guard** — `BattleLootSystem.randomInt` (:454), `GameManagerTickOps` alchemy (:209), `GameManagerPillOps` (:37) stay on global `Math.random` — they are economy/pill randomness, not combat outcome; leave a comment at the `createBattleRng` dep stating the boundary.
- [ ] **Step 6: PASS** — `npx vitest run src/core` + type-check.
- [ ] **Step 7: Commit** `refactor(combat): unify battle RNG under one session authority`

---

### Task 9: `CultivationPathRuntime` boundary (spec C4, audit T5-44)

**Files:**
- Create: `src/core/player/CultivationPathRuntime.ts` (interface) + `src/core/player/CultivationPathRegistry.ts` (path-id → factory map — the ONLY place `isKiemTuHien`/`isKiemTuNgu`/`isPhapTu*`/`isTheTu*` dispatch happens)
- Modify: `src/core/game/GameManager.ts` (the existing private resolvers :896-1274 become the path factories' bodies — move, don't rewrite)
- Modify: `src/core/game/GameManagerTurnBattleOps.ts` (`buildTurnBattle` :994-1023 consumes the runtime; delete the `isKiemTuHien`/`isKiemTuNgu` imports + branches)
- Test: `src/core/player/CultivationPathRuntime.test.ts` + branch-absence guard

**Interface** (grounded in the real seams — every member maps to an existing call):

```ts
export interface CultivationPathRuntime {
  /** resolvePlayerBasicAttack — incl. An-kit composite wrap, route post-conversion. */
  resolveBasic(player: PlayerData): TurnSkillDefinition
  /** resolvePlayerSpecialUltimate — kit slots or emblem markers (Ngu). */
  resolveSpecialUltimate(player: PlayerData): { special?: TurnSkillDefinition; ultimate?: TurnSkillDefinition } | undefined
  /** resolvePlayerMaxThe — The cap snapshot (kiem_tu/phap_tu_an; else MAX_THE). */
  resolveMaxThe(player: PlayerData): number
  /** resolveActiveWayStatDomains — domain gate for stat derivation. */
  resolveStatDomains(player: PlayerData): ReadonlySet<StatDomain>
  /** Kiem Tu hien/ngu dynamic-basic provider — undefined for other paths. */
  buildDynamicBasic?(player: PlayerData, nodes: ProgressionNodes): DynamicBasicProvider | undefined
  /** The Tu — Bat Tu Ba The survive source(s); empty/undefined elsewhere. */
  buildSurviveSources?(player: PlayerData, participant: TurnBattleParticipant): SurviveLethalSource[]
  /** Emblem/marker slot overrides (Ngu Kiem Dao special/ultimate emblems). */
  emblemSlots?(): { special?: TurnSkillSlot; ultimate?: TurnSkillSlot }
}
```

Migration map (what moves where):
- `buildTurnBattle` :994-1000 → `runtime.resolveBasic` / `runtime.resolveSpecialUltimate` / `runtime.resolveStatDomains`.
- :1005-1010 (KiemPho provider) and :1016-1023 (Ngu provider + emblem slots) → `runtime.buildDynamicBasic` + `runtime.emblemSlots`.
- `GameManager.resolvePlayerBasicAttack`/`resolvePlayerSpecialUltimate`/`resolvePlayerMaxThe`/`buildTheTuBatTuSurvival`/`authoredBasicSkillId`/`assertNgoDaoKitLearned`/`applyPhapTuTheGains`/`applyPhapTuEmpowerment`/`resolveTheTuKit`/`resolveTheTuAnKit` → become the per-path factory internals; `GameManager` keeps only `resolvePathRuntime(player)` as a dep injected into the ops.
- `surviveLethalGuard.beginBattle` + `setSurviveLethalSession` wiring (:933-953) stays in the ops (it's session orchestration), but the `extraSources` come from `runtime.buildSurviveSources`.

- [ ] **Step 1: Read first** — `GameManager.ts` :890-1300 in full; `buildTurnBattle` :979-1130; `src/core/kiem-tu/` providers (`buildKiemPhoProvider`, `buildNguKiemDaoProvider`, `collectKiemPhoComboModifiers`, `collectKiemDaoCascadeUnlocks`); `src/core/the-tu/TheTuBatTuSurvival`; `src/core/phap-tu/` route/An-kit seams (`applyRouteToTurnSkill`, `applyAnKitToBasic`, `applyAnKitToSpecial`).
- [ ] **Step 2: Failing tests:**
  - Contract test: a `fake_path` factory registered in a test registry produces a runtime; a battle built through `beginBattleCycle` uses its basic/special without ANY path-id branch in the ops.
  - Guard test: `GameManagerTurnBattleOps.ts` no longer imports `isKiemTuHien`/`isKiemTuNgu`/`isTheTuHien`/`isPhapTu*` (assert via source scan or import-graph guard consistent with `tests/architecture` conventions).
  - Parity: a kiem_tu_hien player still gets `dynamicBasic` set; a kiem_tu_ngu player gets the provider + `TU_KIEM_Y_EMBLEM`/`KIEM_DAO_CASCADE_EMBLEM` slots; a the_tu player gets `buildSurviveSources` wired into `setSurviveLethalSession.extraSources` — pin with existing-suite assertions, don't rewrite them.
- [ ] **Step 3: FAIL** — guard test fails (ops imports the path predicates today).
- [ ] **Step 4: Implement** — registry map `pathId → factory`; `resolveCultivationPathRuntime(player, deps)` is the single dispatcher (A8: branches live in the registry/content modules, never in `buildTurnBattle`). Migrate one path at a time: the_tu (smallest surface) → phap_tu → kiem_tu → mortal fallback.
- [ ] **Step 5: PASS** — `npx vitest run src/core/player src/core/game src/core/kiem-tu src/core/phap-tu src/core/the-tu` + type-check.
- [ ] **Step 6: Commit** `refactor(battle): route path integration through CultivationPathRuntime`

---

### Task 10: Skill-semantic correctness batch (spec C5, audit T3-19)

**Files:**
- Modify: `src/data/skill/PhapTuEmpoweredUlts.ts` (`EARTH_PAYLOAD.appliesBuff` :111)
- Modify: `src/core/battle/turn/TurnSkillAction.ts` (`TurnSkillBuffApplication` + `stacksPerAffectedTarget?: boolean`)
- Modify: `src/core/battle/turn/TurnBattleSystem.ts` (`applyDeclaredBuff` :1908 + `applySkillAilments` :2941)
- Create: `src/core/battle/turn/AilmentChance.ts` (`resolveAilmentApplicationChance` pure helper)
- Modify: `src/core/phap-tu/PhapTuRoutes.ts` (:195 — `(application.stacks ?? 1)`)
- Modify: `src/core/game/SkillToTurnSkillConverter.ts` (`UNSUPPORTED_EFFECT_FIELDS` :36-50)
- Test: one failing spec per fix — `PhapTuEmpoweredUlts` test (check for an existing `*.test.ts` in `src/data/skill`), `AilmentChance.test.ts`, `PhapTuRoutes.test.ts` (extend), `SkillToTurnSkillConverter.test.ts` (extend), `TurnBuffIdentity.test.ts` (decision-record comment only)

**10a — `thanh_luy` empowered ult buffs the caster**

- [ ] **Step 1: Failing test** — cast `hau_tho_thanh_luy` (`PHAP_TU_EMPOWERED_ULTS`'s earth payload via whichever detonate/nuke variant is resolvable in the test harness — reuse the existing empowered-ult test if present) vs N enemies: the CASTER's `participant.buffs` holds `thanh_luy` with `stacks === N` (capped 8); NO enemy holds `thanh_luy`.
- [ ] **Step 2: FAIL** — today `target: 'target'` (:111) lands the buff on `declared.affected` (the enemies) with 1 stack each.
- [ ] **Step 3: Implement** — port the authored `stacksPerAffectedTarget` semantics (`SkillEffect.ts:113-118`: stacks = số target còn sống trúng đòn, capped by buff `maxStacks`):
  - `TurnSkillBuffApplication` gains `stacksPerAffectedTarget?: boolean`.
  - `applyDeclaredBuff` computes `stacks = buffSpec.stacksPerAffectedTarget ? Math.max(1, actionTargets.filter(t => t.entity.alive).length) : Math.max(1, buffSpec.stacks ?? 1)` — document the alive-filter decision (dead enemies are not "imprisoned"; minimum 1 so a whiffed-into-corpse edge still grants the base stack consistent with `stacks ?? 1` behavior).
  - Payload: `appliesBuff: { definitionId: 'thanh_luy', target: 'self', stacksPerAffectedTarget: true }`.

**10b — `elementApplicationPercent` applies in turn combat**

- [ ] **Step 4: Failing tests** — `AilmentChance.test.ts`: `resolveAilmentApplicationChance(0.4, 0.04) === 0.44`; clamps at 1 (`(0.9, 0.5) → 1`); `undefined`/0 percent = base chance. Engine-level: actor with `stats.elementApplicationPercent = 0.5` casting a `chance: 0.6` ailment lands it 100% of the time under a scripted rng — assert via `applySkillAilments` behavior (a `thach_hoa`/`bong` application test through `resolveActorTurn` with rng `() => 0.9`).
- [ ] **Step 5: FAIL** — today :2941 rolls `this.rng() < ailment.chance` only.
- [ ] **Step 6: Implement** — `AilmentChance.ts` exports `resolveAilmentApplicationChance(baseChance: number, applicationPercent: number | undefined): number` = `Math.min(1, baseChance + (applicationPercent ?? 0))`; `applySkillAilments` uses `resolveAilmentApplicationChance(ailment.chance, actor.entity.stats.elementApplicationPercent)`. Note in the file: the legacy formula lives in dormant `SkillEffectSystem.ts:294`/`SkillActionRegistry.ts:99` (Mission G deletes them) — this helper is the surviving authority.

**10c — `ailmentStackBonus` treats omitted stacks as 1**

- [ ] **Step 7: Failing test** — `PhapTuRoutes.test.ts`: a route profile with `ailmentStackBonus: 1` (the `dot` route :84) applied via `applyRouteToTurnSkill` to a def whose `appliesAilments` entry omits `stacks` → result `stacks === 2` (implicit 1 + bonus 1), not 1.
- [ ] **Step 8: FAIL** — today `:195` uses `(application.stacks ?? 0) + bonus` → 1.
- [ ] **Step 9: Implement** — change `:195` to `(application.stacks ?? 1) + profile.ailmentStackBonus` with a comment citing the engine default (`TurnBattleSystem.ts:2953` `ailment.stacks ?? 1`).

**10d — Converter reports `scope` + `refresh`**

- [ ] **Step 10: Failing test** — `SkillToTurnSkillConverter.test.ts`: build an `EffectiveSkill` whose effects carry `scope: 'primary_target'` and an `add_stack` with `refresh: true` (mirror the authored usages at `PhapTuChainSkills.ts:475/496/514` and `:655/672/687`); `collectUnsupportedSkillSemantics` must return `['effect.scope', 'effect.refresh']` (order per Set insertion — assert with `expect.arrayContaining` + `toHaveLength`).
- [ ] **Step 11: FAIL** — today both fields are absent from `UNSUPPORTED_EFFECT_FIELDS` :36-50, so they're silently dropped.
- [ ] **Step 12: Implement** — add `'scope'` and `'refresh'` to `UNSUPPORTED_EFFECT_FIELDS`. (These fields are real: `SkillEffect.ts:11,28`; authored in `PhapTuChainSkills.ts`.)

**10e — `thach_hoa` proc ownership: DECISION RECORD (audit claim disputed)**

- [ ] **Step 13: Verify, don't flip** — evidence: `docs/systems/buffs.md:18` documents `onHitProc` = "holder's landed hit applies to the victim"; `TurnBuffIdentity.test.ts:141` calls the enemy-holds-it direction the "authored direction"; `LegacyBuffs.ts:225-228` says the port is "đúng brief mục Step 3". The audit's premise (proc attached to the debuffed enemy is a bug) contradicts the maintained contract. Deliverable: add a decision-record comment block in `TurnBuffIdentity.test.ts` stating: **DECIDED (Mission C, 2026-09-16 audit T3-19): `onHitProc` = holder-attacks→victim-applies is the authored contract; `thach_hoa` on an enemy intentionally lets that enemy's hits stun. The audit claim is recorded as stale. If a future design review wants struck-direction semantics, the mechanism is a NEW `onStruckProc` effect type — not a data flip.**
- [ ] **Step 14: PASS** — `npx vitest run src/core/skill src/core/phap-tu src/core/battle src/data` + type-check.
- [ ] **Step 15: Commit** `fix(skill): empowered-ult self-buff, ailment application stat, stack default, converter reports`

---

### Task 11: Mission verification gates

- [ ] **Step 1** — `npm run type-check` + `npx vitest run src/core` green.
- [ ] **Step 2** — P4: `tutienidle-adversarial-qa` (deep — combat chain + lifecycle boundary are the audit's own top-risk clusters). Focus prompts: repeat-cycle state leaks, stale-ack cross-battle mutation, RNG coverage gaps (any `Math.random` left on the combat path), path-runtime parity per path.
- [ ] **Step 3** — P5: three-lens review round (A/B/C) on the aggregate diff — zero unresolved Medium+ before done.
- [ ] **Step 4** — P13/P14: repeat-cycle and manual-mode wiring are runtime-critical — run the `turn-combat-hud`/`create-to-combat` e2e specs (or the closest existing combat spec) inside the implementation worktree before merge-ready; document what was visually confirmed. The old P14 worktree deferral is retired — a genuine environment failure is an explicit blocker, not a deferral.
- [ ] **Step 5** — Final commit + summary with evidence.

---

## Mission C done-criteria

- `beginBattleCycle(policy)` is the only place battle-scoped reset decisions live; `startBattle`/`startBattleWithPlayer`/`startStage`/`restartTurnBattleCycle` all delegate (verified: no entry path keeps a private reset list).
- Repeat cycle provably fresh: every `BATTLE_CYCLE_RESET_FIELDS` entry has a passing regression test on the repeat path.
- Defeat during repeat releases `StageManager.active` and disarms repeat (T1-4 closed; spec B3 coordinated).
- Stale acks and pending manual/presentation state cannot cross a cycle boundary (token guard locked + `resetPendingState` wired into every entry).
- Manual-mode queued executions auto-resolve; genuinely new player turns still pause (T3-22a contract locked).
- A dead actor's in-flight action stops resolving (T3-22b fixed).
- One session RNG reaches every combat roll in the Task-8 inventory; seeded battles replay identically.
- No path-id branches remain in `GameManagerTurnBattleOps` (T5-44): all path integration goes through `CultivationPathRuntime`.
- Five skill-semantic items resolved with tests: `thanh_luy` self-buff w/ per-target stacks, `elementApplicationPercent` applied+clamped, `ailmentStackBonus` implicit-1 base, `scope`/`refresh` reported unsupported, `thach_hoa` decision recorded (audit claim stale — documented contract kept).
- `docs/roadmap.md` combat-chain section updated in the same change (P17).
- `npm run type-check` + `npx vitest run src/core` green; P4 deep QA + P5 review evidence recorded.
