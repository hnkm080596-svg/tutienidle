# Combat Contract Inventory — M0 Census Baseline

**Mission:** M0 of `2026-09-17-megaplan-combat-contract` (`.superpowers/sdd/2026-09-17-megaplan-combat-contract/`).
**Baseline commit:** `21ac93cf47fa5e47da55cedee62afc66393a117e` (`refactor(tribulation): use getNextRealm for breakthrough target`).
**Branch / worktree:** `feat/combat-contract` @ `.agent-worktrees/combat-contract`.
**Scope:** read-only census. No production or test code was changed. Every line reference below was re-verified against THIS tree (the brief's line numbers predate the `chore/cleanup` deletions of `SkillEffectSystem.ts`, `SkillActionRegistry.ts`, `SkillTriggerRunner.ts`, `core/buff/Buff.ts`; CombatSystem has no trigger path).

Unless stated otherwise, all paths are under `game/src/` and all line numbers are at the baseline SHA.

---

## 1. Battle RNG graph

### 1.1 Mint and distribution

The cycle RNG is a single `() => number` closure minted per battle cycle by
`GameManagerTurnBattleOps.mintCycleRng()` (`core/game/GameManagerTurnBattleOps.ts:835`):

```ts
// :838 — override hook > deps factory > lazy Math.random factory
this.combatRng = ((this.battleRngFactoryOverride ?? this.deps.createBattleRng) ?? (() => () => Math.random()))()
this.deps.combatSystem.setRandomSource(this.combatRng)   // :839
```

- Storage field: `private combatRng: () => number = () => Math.random()` (`:808`). The
  default is a *lazy closure* so `vi.spyOn(Math, 'random')` interception keeps working
  before the first mint.
- Mint gate: `beginBattleCycle()` calls `if (!this.isStageStarting) this.mintCycleRng()`
  (`:904-905`). Stage launches pre-mint instead: `startStage()` sets
  `this.isStageStarting = true` (`:1335`), calls `this.mintCycleRng()` (`:1340`), then
  clears the flag after `stageWaves.start(...)` returns (`:1347`). The pre-mint exists
  because the launch chain `startStage -> stageWaves.start -> launchBattle ->
  beginBattleCycle` cannot pass the closure through, and `stageWaves.start` performs the
  first enemy pick before the nested `beginBattleCycle` runs.
- Test/dev seam: `setBattleRngFactory(factory)` (`:814`) sets
  `battleRngFactoryOverride` (`:818`); `deps.createBattleRng` (`:261`) is the
  constructor-injected equivalent. Neither is wired in production today — production
  battles mint from the `Math.random` factory fallback. Determinism for the contract
  layer means *one shared stream consumed in a fixed order*, not a fixed seed.
- `mintCycleRng()` also pushes the closure into `CombatSystem` via
  `setRandomSource` (`:839` -> `CombatSystem.ts:113`), so the hit/crit/block/ignore-resist
  rolls and the engine rolls share the SAME closure instance.

Distribution points of `this.combatRng` (all signatures are `() => number`):

| # | Hand-off site | Consumer | Rolls performed downstream |
|---|---|---|---|
| 1 | `GameManagerTurnBattleOps.ts:275` — `new TurnBattleSystem(..., this.combatRng)` (bootstrap engine) | `TurnBattleSystem` ctor `private readonly rng: () => number` (`TurnBattleSystem.ts:479`) | All engine rolls listed in §1.2 |
| 2 | `GameManagerTurnBattleOps.ts:839` — `combatSystem.setRandomSource(this.combatRng)` inside `mintCycleRng` | `CombatSystem.randomSource` (`CombatSystem.ts:111-114`) | `rollHit` (`:268`), `rollBlock` (`:279`), `rollCritical` (`:293`), ignore-resistance (`:209`) |
| 3 | `GameManagerTurnBattleOps.ts:1001` — `new TurnBattleSystem(..., this.combatRng)` inside `beginBattleCycle` | same as #1 — the live per-cycle engine | same as #1 |
| 4 | `GameManagerTurnBattleOps.ts:1096` — `stageWaves.pickEnemyForTurnSpawn(stageRef, isFinalSpawn, { rng: this.combatRng })` | `StageWaveSystem.pickEnemyForTurnSpawn` (`core/game/StageWaveSystem.ts:217`) -> shared pick path (`:148-200`) | `rollChance(bossEntry.eliteChance, rng)` (`:173`), `stageSystem.pickNextEnemyEntry(stage, rng)` (`:181` -> `StageSystem.pickNextEnemyEntry` `core/stage/StageSystem.ts:8` -> `weightedRandom` `core/reward/DropRoll.ts:34`, one `rng()` at `:43`), `rollChance(entry.eliteChance, rng)` (`:190`), `hiddenBeast.maybeReplaceSpawn(player, realmId, rng)` (`:197-200` -> `HiddenBeastSystem.maybeReplaceSpawn` `core/game/HiddenBeastSystem.ts:22`, `rollChance(...)` `:27`) |
| 5 | `GameManagerTurnBattleOps.ts:1143` — `resolveEnemySpawnPosition({ ..., random: this.combatRng })` (mid-wave spawn placement) | `resolveEnemySpawnPosition` (`core/battle/EnemySpawnPlacement.ts:40`) -> `randomIntInclusive` (`:32`) | 1 roll when picking among occupied-slot free keys (`:63`); 2 rolls (row + column) in the standing-slot fallback (`:75-76`) |
| 6 | `GameManagerTurnBattleOps.ts:1189` — `pathRuntime.buildDynamicBasic(player, nodes, this.combatRng)` | `CultivationPathRuntime.buildDynamicBasic` (`core/player/CultivationPathRuntime.ts:45-49`) -> `buildNguKiemDaoProvider(player, unlocks, rng)` (`core/kiem-tu/NguKiemDaoProvider.ts:63-66`) | Ngu cascade crit roll (`:83`, `rng() < CASCADE_CRIT_CHANCE`), cascade armor-pierce roll (`:88`, `rng() < CASCADE_PIERCE_CHANCE`). Kiem Pho provider ignores the param. |
| 7 | `GameManagerTurnBattleOps.ts:1290` — `resolveEnemySpawnPosition({ ..., random: this.combatRng })` (initial/battle-build placement) | same as #5 | same as #5 |
| 8 | `GameManagerTurnBattleOps.ts:1344` — `stageWaves.start(..., { rng: () => this.combatRng() })` | `StageWaveSystem.start` (`core/game/StageWaveSystem.ts:54-58`) -> launch-time enemy pick through the same `pickEnemyForTurnSpawn` internals as #4 | same roll set as #4. The `() => this.combatRng()` wrapper defers the field read so the launch pick consumes the closure that is current at call time. |

Every downstream helper consumes **exactly one `rng()` per logical roll**
(`rollChance` is `rng() < chance`, `weightedRandom` is a single `rng() * totalWeight`,
`randomIntInclusive` is one `rng()` per call). This is the parity the future
`CombatRng.rollChance()` contract encodes ("consumes exactly ONE roll even at
chance <= 0 / >= 1") — any adapter must preserve both the call sites and the
per-call consumption count.

### 1.2 Engine-internal consumers of `this.rng` (`TurnBattleSystem`)

The injected closure reaches these roll sites inside `core/battle/turn/TurnBattleSystem.ts`:

| Line | Call | Roll semantics |
|---|---|---|
| `:1033` | `actorBuffSystem.rollReactiveTrigger(actor.entity, 'onCastBegin', this.registry, undefined, this.rng)` | Per matching reactive-trigger effect: `rng() < effect.chance` inside `BuffSystem.rollReactiveTrigger` (`BuffSystem.ts:505-521`). On success may apply a buff and/or push a `QueuedFollowUp` (`TurnBattleSystem.ts:1843-1844`). |
| `:1314` | `pickCompositePool(composite.pool, composite.count, this.rng)` | Partial Fisher-Yates over `compositePicks.pool`; one `rng()` per pick (`TurnSkillAction.pickCompositePool` `:588`). Natural-declare path. |
| `:1824` | `new BuffSystem(actor.buffs).rollOnHitEffects(actor.entity, target.entity, target.buffs, this.registry, this.rng)` | Per on-hit-proc effect: `rng() < effect.chance` (`BuffSystem.ts:478-497`). |
| `:1834-1837` | `new BuffSystem(target.buffs).rollReactiveTrigger(target.entity, 'onImpactLanded', this.registry, {...}, this.rng)` | Same mechanism as `:1033`, on the TARGET's pool after a landed hit. |
| `:2121` | `pickCompositePool(composite.pool, composite.count, this.rng)` inside `declareQueuedExecution` | Repeat/multicast executions re-roll their composite pick — same helper, second call site. |
| `:2253` | `this.rng() < multicast.chance` inside `enqueueFollowUpExecutions` | Multicast re-roll, bounded by `min(multicast.maxExtraCasts, MAX_MULTICAST)`. |
| `:2407` | `this.rng() < chance` inside `resolveReactiveProcs` | Per paid reactive-proc attempt (The Tu counter/follow-up/intercept economy). |
| `:2959` | `this.rng() < resolveAilmentApplicationChance(ailment.chance, actor.entity.stats.elementApplicationPercent)` inside `applySkillAilments` | Per authored ailment entry on a landed hit. |

### 1.3 `Math.random` audit — `core/battle/turn/**` and `core/buff/**`

Production-code occurrences (everything else in these directories is test-only
comment/spy usage):

| File:line | Form | Production exposure |
|---|---|---|
| `core/battle/turn/TurnBattleSystem.ts:479` | ctor default `rng: () => number = () => Math.random()` | Only fires when the caller omits `rng`. Both production constructions pass `this.combatRng` (ops `:275`, `:1001`); tests that omit it get lazy `Math.random`. |
| `core/buff/BuffSystem.ts:485` | `rollOnHitEffects(..., rng: () => number = () => Math.random())` | Lazy default; the only production caller passes `this.rng` (`TurnBattleSystem.ts:1824`). |
| `core/buff/BuffSystem.ts:510` | `rollReactiveTrigger(..., rng: () => number = () => Math.random())` | Lazy default; both production callers pass `this.rng` (`TurnBattleSystem.ts:1033`, `:1837`). |
| `core/battle/turn/TurnSkillAction.ts` | comment only (states the injected-rng rule for composite picks) | No roll. `pickCompositePool` itself uses the injected `rng`. |
| `core/battle/EnemySpawnPlacement.ts:27` | comment "External RNG (Math.random or seeded)" | No default — `random` is a required field; both production call sites pass `this.combatRng`. |

Adjacent fallbacks in the same consumption graph (outside the two audited
directories but reachable from the cycle RNG distribution list):

| File:line | Form | Production exposure |
|---|---|---|
| `core/game/GameManagerTurnBattleOps.ts:808` | field init `() => Math.random()` | Holds only until the first `mintCycleRng`; stage paths pre-mint before any roll. |
| `core/game/GameManagerTurnBattleOps.ts:838` | factory fallback `(() => () => Math.random())` | Reached when neither `battleRngFactoryOverride` nor `deps.createBattleRng` is set — i.e. ALL production battles today. Determinism is therefore order-based, not seed-based, until a factory is injected. |
| `core/combat/CombatSystem.ts:111` | `private randomSource: () => number = () => Math.random()` | Pre-mint / non-battle calls only; `mintCycleRng` always pushes the cycle closure (`ops:839`). |
| `core/kiem-tu/NguKiemDaoProvider.ts:66` | `rng: () => number = Math.random` | **Bare `Math.random` reference, not a lazy closure** — bypasses `vi.spyOn` and would bypass a seeded wrapper if a caller omitted it. Production wiring always passes the cycle closure (`ops:1189`). Flagged: the default shape is inconsistent with the lazy-closure convention used elsewhere. |
| `core/stage/StageSystem.ts:8` | `pickNextEnemyEntry(stage, rng: () => number = () => Math.random())` | Lazy default; the turn-spawn path passes `options?.rng` (`StageWaveSystem.ts:181`). |
| `core/game/HiddenBeastSystem.ts:22` | `maybeReplaceSpawn(..., rng: () => number = Math.random)` | Bare `Math.random` reference default; production passes the cycle closure (`StageWaveSystem.ts:200`). |
| `core/reward/DropRoll.ts:11,19,34` | `randomInt` / `rollChance` / `weightedRandom` all default `rng = Math.random` | Bare-reference defaults. Combat callers pass the cycle closure; callers that omit it (loot/idle paths) intentionally use `Math.random` — out of the session-RNG boundary by design (file comment `:7-9`). |

`mathRandom` strays verdict: **no production roll inside `core/battle/turn/**` or
`core/buff/**` bypasses the cycle RNG when the battle wiring is used.** The residual
risk is (a) the bare-`Math.random` defaults above, which silently detach any future
caller that forgets to thread `rng`, and (b) `EnemySystem.spawn`
(`core/enemy/EnemySystem.ts:20`) minting enemy ids via `crypto.randomUUID()` — an
identity mint, not a roll, but it means event payloads carrying entity ids are not
byte-stable across same-seed replays (order is stable; id strings are not).

---

## 2. `TurnPipeline` lifecycle boundary (BLOCKING design constraint)

`core/battle/turn/TurnPipeline.ts` (:1-146) is a **serial step queue** and the file's
own header defines its authority: "the sole definition of when a turn is in flight:
as long as it has steps, the turn has not ended" (:4-5).

### 2.1 What `TurnPipeline` owns

- Step kinds (`:17-24`): `awaiting-input`, `animation`, `hit`, `reaction`,
  `death-check`, `semantic-vfx`, `idle-check`. Each step is `{ kind, run: StepRun }`
  where `StepRun = (done) => void` (:15); a step completes by calling `done()` exactly
  once.
- Serial drain with re-entrancy guard (`drain`, `:85-131`; `running` flag `:41`).
- Async parking: a step that does not call `done()` synchronously parks the traversal
  (`parkedOn`, `:42`, `:98-106`); `completeStep` (`:134-145`) is idempotent and resumes
  the drain on late completion.
- Reaction-chain depth: `reactionDepth` (:40) increments per completed
  `kind: 'reaction'` step; at `MAX_CHAIN_DEPTH = 10` (:8, `:108-121`) the queue is
  filtered down to `MECHANICAL_AFTER_LIMIT` kinds (`semantic-vfx`, `idle-check`,
  `:33-36`) so the turn still terminates.
- Turn-end signal: `onDrained` constructor callback (:46), fired at `:126-128` when the
  queue empties with nothing parked.
- `reset()` (:77-83) clears queue/parked/running/reactionDepth/chainDepthLimited — with
  an explicit warning that it is unsafe inside a running step (:69-75).

### 2.2 How production wires it today

- Instance: `GameManagerTurnBattleOps.ts:157` —
  `private readonly pipeline = new TurnPipeline(() => this.onTurnDrained())`.
- Entry point: `beginTurnPipeline(actor, from)` (`:565-603`) — `clearPendingSteps` +
  `pipeline.reset()`, pushes `[animation('ready')?], semantic-vfx('impact'),
  semantic-vfx('complete'), idle-check`, then `pipeline.drain()` (`:602`).
  Callers:
  - `:477` — a ready actor from the fighting-phase pacing loop (`from: 'ready'`).
  - `:1505` — manual-mode stranded rescue in `setBattleManualMode` (`from: 'ready'`).
  - `:1541` — `submitTurnChoice` after the player's manual pick (`from: 'impact'`;
    ready/cast already happened, so the ready step is skipped).
- Step mechanics: `awaitStep` (`:617-630`) parks each async step on either a renderer
  signal (`settleStep` `:632-636`, driven by `CombatAnimationRuntime`'s
  stepCompletionSink via `GameManagerTurnBattlePresentationOps.ts:63-77`) or an
  `ANIMATION_FALLBACK_MS` timer that calls `driveStepWork` (`:658-668`) — which plays
  the renderer's part through `acknowledgeTurnReady` / `acknowledgeActionImpact` /
  `acknowledgeActionComplete`. `settleHeadlessStep` (`:676-682`) short-circuits to
  `driveStepWork` when no presentation is active. **The three `acknowledge*` calls are
  the turn's mechanical work**: they invoke `TurnBattleSystem.declareActorAction`
  (`CombatAnimationRuntime.ts:233`), `applyActionImpact` (`:261`), and
  `completeAction` (`:347`) — the same triple `resolveActorTurn`
  (`TurnBattleSystem.ts:2874-2881`) performs inline for tests.
- Production pushes ONLY `animation`, `semantic-vfx`, and `idle-check` step kinds.
  `awaiting-input`, `hit`, `reaction`, and `death-check` — and therefore the
  `reactionDepth`/`MAX_CHAIN_DEPTH` machinery — are exercised only by
  `TurnPipeline.test.ts`. Wuxing reactions today resolve synchronously inside
  `applySkillAilments -> reactionManager.checkAndTrigger` (`TurnBattleSystem.ts:2977-2986`),
  NOT as pipeline steps.
- Turn end: `onTurnDrained` (`:688-712`) requires token `RESOLVING`, reads
  `battle.state` for both-sides-alive, calls `turnToken.resolve(...)` (`:702`), and on
  `COMBAT_OVER` drops `boundaryQueue` and calls `settleCombatOutcome` (`:709-710`).
- Turn state authority: `TurnToken` (`core/battle/turn/TurnToken.ts:25-69`) — states
  `IDLE | CLAIMED | AWAITING_INPUT | RESOLVING | COMBAT_OVER`; `claim` throws unless
  `IDLE` (:34-35), `resolve` requires `RESOLVING` (:56), `reset` returns to `IDLE` (:69).
- Clock coupling: `attachTurnTokenToClock` (`GameManagerTurnBattleOps.ts:382-392`)
  freezes the `CombatClock` with reason `'turn-in-flight'` while the token is non-IDLE
  (freeze reasons `'tab-hidden' | 'not-revealed' | 'turn-in-flight'`,
  `CombatClock.ts:27`); `combatClock.stop()` on settle (`:743`, `:1078`, `:1456`).
- Boundary commands: `enqueueAtTurnBoundary` (`:516`) runs immediately when the token
  is `IDLE` (`:522`), else queues; `drainBoundaryQueueIfIdle` (`:539`) is invoked at the
  top of the fighting branch (`:450`).

### 2.3 Boundary rule for the contract layer (R-C5)

`CombatScheduler` NEVER owns turn lifecycle. It orders domain mutations **inside one
action's resolution** — i.e. inside the `declareActorAction -> applyActionImpact ->
completeAction` window of a single claimed turn.

It must not own or duplicate: turn-in-flight state (`TurnPipeline` + `TurnToken`),
reaction-step depth (`reactionDepth`/`MAX_CHAIN_DEPTH`), turn end
(`onDrained -> turnToken.resolve`), clock transitions (`CombatClock`
`'turn-in-flight'`), presentation ack lifecycle (`CombatAnimationRuntime` /
`pendingPlaybackToken`), or boundary commands (`boundaryQueue`).

**Overlap risk, named explicitly:** `TurnPipeline` already declares `hit`,
`reaction`, and `death-check` step kinds plus a reaction-chain counter that
*production never pushes*. An implementer could read those kinds as "the settlement
queue" and either (a) route scheduler operations through pipeline steps — duplicating
serialization and breaking the ack-based pacing contract (P17) — or (b) build a
scheduler that re-tracks in-flight turns — a second turn scheduler. Both are
forbidden: pipeline steps pace renderer handshakes only; the scheduler sequences
operations *inside* a step's mechanical work, never the steps themselves.

---

## 3. Damage authority seam

`core/combat/CombatSystem.ts` is the damage/vitals authority. `randomSource` is the
injected cycle RNG (`:111`, `setRandomSource` `:113-114`). `vitals` is an
`EntityVitalsSystem` instance; `VitalsChangeReason`
(`core/combat/EntityVitalsSystem.ts:5`) is
`'damage' | 'dot' | 'ward_break' | 'healing' | 'leech' | 'regen' | 'reaction' |
'reflection' | 'heavenly_tribulation' | 'survive_lethal' | 'ward_spend' | 'stat_refresh'`
— `'reaction'` already exists and is produced by `TurnReactionManager`.

### 3.1 Public surface and channel semantics

| Method | Sig line | Channel semantics |
|---|---|---|
| `applyDirectDamage(target, amount, sourceId, reason = 'damage')` | `:128` | Flat HP removal through `vitals.applyDamage` + `killIfDead`. NO mitigation, NO hit layer. Callers include detonation bursts (`TurnBattleSystem.ts:3043`). |
| `applyModifiedDirectDamage(target, rawAmount, attacker, reason = 'damage')` | `:144` | Applies the HIT-LAYER modifiers `finalDamagePercent` / `finalDamageReductionPercent` (read from `attacker`/`target`), then delegates to `applyDirectDamage` (`:146`). Callers: ward-break kickback (`:498`, reason `'ward_break'`), reflection (`TurnBattleSystem` ~`:1857`), reaction burst (`TurnReactionManager`, reason `'reaction'`). |
| `applyHealing(target, amount, sourceId, reason = 'healing')` | `:149` | `vitals.applyHealing` (`EntityVitalsSystem.ts:87`): dead-entity rejection, `healingEffectiveness` scaling except `'leech'`, `'heal'` event only for `healing`/`leech`. Callers: leech (`:485`), DoT recovery (`:584`), tro-heal, battle loot. |
| `applyTurnRegen(target, deltas, sourceId)` | `:159` | `vitals.applyTurnRegen` (`:137`) — per-turn HP/MP/ward regen. |
| `spendWard(target, amount, reason = 'ward_spend', sourceId?)` | `:172` | `vitals.spendWard` (`:75`) — ward-as-resource spends (NOT absorb). |
| `resolveActionHit(source, target, damage: ActionDamageInfo, options: Partial<HitResolveOptions>)` | `:176` | The full action-hit pipeline: `guaranteedHit` bypass / `rollHit` (`:268`) -> crit (`options.critical` override else `rollCritical` `:290-293`) -> scalingBonus x skillDamagePercent x realmPressure -> `chanceToIgnoreResistance` roll (`:209`, skipped by `options.armorBypass`) -> base damage (elemental `components` vs physical/primordial `kind` + `armorPierceFraction`) -> `applyMultiplierAndCritical` -> `rollBlock` (`:279`) -> blockEffectiveness -> endurance -> resolveAttack: floor-1 after `finalDamageMultiplier` (`:354`), emits `'critical'`/`'block'`/`'hit'` (`:359-378`), resets `turnsSinceLastHitLanded`, absorbs externalWard -> ward -> manaShield (direct writes, `:398-427`), `applyHpDamageFromSnapshot('damage')`, `'damage'` event (`:458`), leech (`:485`), ward-break kickback (`:498`), `killIfDead` target then source (`:501`, `:509`). |
| `rollCritical(source, target)` | `:290` | Public crit roll (consumed by `resolveActionHit`; also reachable directly). |
| `applyDotDamage(params)` | `:528` | **DoT economy ONLY**: `dotResistancePercent` clamped `[-1, 0.75]` (`:543`) is the sole mitigation — no hit-layer modifiers, no ward/MP absorb, no leech. Emits `'damage'` with `effectId` (`:557`), `dotRecovery` -> `applyHealing` (`:584`), `killIfDead` (`:587`). Reason `'dot'`. Sole production caller: `BuffSystem.update` per `dot` effect. **Reaction damage MUST NOT route here** (it takes `applyModifiedDirectDamage` with reason `'reaction'`). |
| `killIfDead(entity, killerId)` | `:595` | Single death-declaration point: survive-lethal session (`extraSources` then talent guard), `entity.alive = false` (`:687`), `'talent_survive_lethal'` (`:661`), `'death'` (`:689`), `'kill'` (`:697`). |

`EntityVitalsSystem` (`core/combat/EntityVitalsSystem.ts`) write methods — all emit
`'entity_vitals_changed'` (`:198`): `applyDamage` (:36), `applyHpDamageFromSnapshot`
(:48), `clampToMaxHp` (:61), `spendWard` (:75), `applyHealing` (:87), `applyTurnRegen`
(:137), `emitCurrent` (:181).

Vitals-authority gaps the contract layer must respect (state written AROUND
`EntityVitalsSystem`, not through it): `CombatSystem.resolveAttack` mutates
`target.externalWard.amount`/clears it (`:398-403`), `target.currentWard` (`:412`) and
`target.currentMp` (`:427`) directly; `TurnBattleSystem` grants `externalWard` at
`:1981`/`:2665`; `consumeResourceFor` (`TurnSkillAction.ts:336`) decrements
`entity.currentMp`/resource fields directly; `TheEconomy`
(`core/the-tu/TheEconomy.ts:30/62/70`) writes `currentThe` directly;
`TheTuExternalWard.reconcileExternalWard` (`core/the-tu/TheTuExternalWard.ts:19-51`)
clears `externalWard` (:51). Tribulation runs a wholly separate lifecycle:
`TribulationDirector` owns its OWN `EntityVitalsSystem` (`:141`) over a ghost
`CombatEntity` (`:195-205`) and applies `'heavenly_tribulation'` damage via
`vitals.applyDamage` (`:523`), mirroring into snapshot fields — it never passes
through `CombatSystem.killIfDead`.

### 3.2 Intent parameters `DealDamageOperation.payload` must carry

The executor is a pure router — it must NOT pick between
`applyDirectDamage` / `applyModifiedDirectDamage` / `applyDotDamage` /
`resolveActionHit`. The `DamageAuthority` adapter selects the channel from intent
fields. The payload therefore needs, per channel:

- **Channel discriminator** derived from `origin.kind` + payload shape (e.g.
  `buff_periodic` + `dot` effect -> DoT economy; `reaction` -> modified-direct with
  reason `'reaction'`; `skill`/`proc` hits -> full `resolveActionHit`).
- **Action-hit intent** (maps onto `ActionDamageInfo` + `HitResolveOptions`,
  `core/battle/ActionImpactSystem.ts:33-110`): damage `kind`
  (`physical`/`primordial`/`elemental` + `components`), `multiplier`, `scaling`,
  missing-HP scalar (`missingHpBonusPerMissingPercent`/`missingHpBonusCap`),
  `critical?`, `guaranteedHit?`, `armorBypass?`, `armorPierceFraction?`,
  `damageMultiplier?`, `isPrimary`, `skillId?`, `knockbackDistance?`, `origin?`
  (`CombatActionOrigin`, `BattleEvents.ts:26-30`).
- **DoT intent** (maps onto `applyDotDamage` params `:528`): `sourceId`, source-entity
  / source-buff resolution, `element`, `effectId`, `rawDamage`.
- **Direct / modified-direct intent**: `amount` vs `rawAmount` + `attacker` entity
  reference + `reason`.
- **Attribution**: `reason` (`VitalsChangeReason`) mapping is owned by the adapter;
  `origin.sourceId` is the canonical attacker identity (no top-level `sourceId` on
  the op per the shared-context contract).

---

## 4. Gauge authority seam

`core/battle/turn/ActionGauge.ts` is the whole gauge authority:

| Export | Line | Semantics |
|---|---|---|
| `GAUGE_MAX = 1000` | `:6` | Ready threshold. |
| `GaugeActor` | `:8-13` | `{ id, speed, actionGauge, alive }` — the minimal shape the functions need. |
| `advanceGauge(actor, stepRate)` | `:15-17` | `actionGauge += speed * stepRate`. **Unclamped** — values may exceed `GAUGE_MAX` until consumption. |
| `isGaugeReady(actor)` | `:19-21` | `actionGauge >= GAUGE_MAX`. |
| `consumeGaugeAfterAction(actor, fractionConsumed = 1)` | `:28-37` | Clamps the FRACTION to `[0,1]`; `>= 1` -> `actionGauge = 0`; else subtracts `GAUGE_MAX * fraction`, floored at 0. |
| `refundGauge(actor, amount)` | `:40-42` | `actionGauge = clamp(actionGauge + amount, 0, GAUGE_MAX)`. Despite the name, the signature accepts any signed `amount` and the clamp already handles both directions — it IS the additive-delta primitive the contract needs. |

Producers / consumers of `actionGauge`:

- `TurnQueue.resolveNextTurn` (`core/battle/turn/TurnQueue.ts:29` `advanceGauge(actor,
  STEP_RATE)`, `:32` `living.filter(isGaugeReady)`) — test/preview queue loop.
- `TurnBattleSystem.tickPacing` (`:823` `advanceGauge(actor, 1)`) — production pacing.
- `TurnBattleSystem.completeAction` (`:2815` `consumeGaugeAfterAction(actor,
  declared.isFollowUpBypass ? 0 : 1)`) — bypass actions consume nothing.
- `TurnBattleSystem.applyGaugeDeltaEffects` (`:54-61`) — buff `gaugeDelta` effects call
  `refundGauge(participant, GAUGE_MAX * (effect.percentOfMax / 100))`; `percentOfMax`
  is authored, so signed deltas are already exercised through this path.
- **Direct writes bypassing the module:** `participant.actionGauge = 0` inter-wave
  reset (`TurnBattleSystem.ts:782`); `actionGauge: 0` initializers in
  `TurnBattleAdapter.ts:42` and `TurnOrderPreview.ts:56` (fresh/clone participants).

**Contract note for `PushGaugeOperation`:** it needs signed additive semantics —
`applyGaugeDelta(entityId, delta)` on the future `GaugeAuthority` adapter, clamped to
`[0, GAUGE_MAX]` in BOTH directions by the adapter (delegating to `refundGauge`'s body
is sufficient). The executor never clamps and never decides readiness; gauge-after-
consume semantics (`consumeGaugeAfterAction`) stay a separate concern from delta push.

---

## 5. Buff authority seam — READ ONLY (no adapter)

Per the ruling, NO `CurrentBuffAuthorityAdapter` is designed here — the buff2 rewrite
is the first real `BuffAuthority`; this section is census only.

`BuffSystem` (`core/buff/BuffSystem.ts`) is a thin method-bundle over a `BuffPool`
(the pool holds the state; the system is cheap to re-wrap, which is why `new
BuffSystem(pool)` sites proliferate). Deterministic core: `apply` (`:78`) performs NO
rng rolls (duration via `ailmentResistPercent`/`ailmentDurationPercent`,
`convertsToId` recursion `:168`); `update` overloads (`:264-279`) tick turn-based
instances — including DoT effects routed to `combat.applyDotDamage` — and `updateTime`
is the wall-clock variant for the persistent pool.

Production `new BuffSystem(` construction sites:

| File:line | Pool | Purpose |
|---|---|---|
| `core/game/GameManagerTurnBattleOps.ts:1046` | `playerParticipant.buffs` | Survive-lethal session `buffSystem` (cleanse+grant policy on lethal save). |
| `core/game/GameManagerTurnBattleOps.ts:1252` | `participant.buffs` | Formation/Tran Phap buff application at battle build. |
| `core/game/GameManagerTurnBattleOps.ts:1276` | `participant.buffs` | `grantsBuffsAtBuild` emblem buffs at battle build. |
| `core/game/GameManager.ts:223` | `this.buffPool` (persistent) | Out-of-battle persistent buffs: ticked via `GameManagerTickOps.ts:250` `updateTime`, applied via `GameManagerPersistentEffectOps.ts:409`, read via `getActiveModifiers` (`:82`, `:138`). |
| `core/game/GameManager.ts:271` | in-battle `player.buffs` | `PassiveSystem` buffApplier — `passiveConvertsTo` burst buff onto the live battle participant. |
| `core/battle/turn/TurnBattleSystem.ts:973` | `actor.buffs` | Per-declare `actorBuffSystem`: `isStunned`/`isFrozen` gates (`:1060`), `rollReactiveTrigger` `'onCastBegin'` (`:1033`), status tick `update` (`:1110`). |
| `core/battle/turn/TurnBattleSystem.ts:1193` | `actor.buffs` | `bossTrigger` buff grant inside declare. |
| `core/battle/turn/TurnBattleSystem.ts:1803,1807` | `target.buffs` | Consume-for-damage: `getStacks` + `removeAllById` on `consumesAilmentId`. |
| `core/battle/turn/TurnBattleSystem.ts:1824` | `actor.buffs` | `rollOnHitEffects` after a landed hit. |
| `core/battle/turn/TurnBattleSystem.ts:1834` | `target.buffs` | `rollReactiveTrigger` `'onImpactLanded'` on the target's pool. |
| `core/battle/turn/TurnBattleSystem.ts:1967` | `target.buffs` | `applyDeclaredBuff` — `appliesBuff`/`appliesBuffs` delivery. |
| `core/battle/turn/TurnBattleSystem.ts:2664` | `original.buffs` | Ho-intercept ward marker grant onto the original target. |
| `core/battle/turn/TurnBattleSystem.ts:2974` | `target.buffs` | `applySkillAilments` per-stack apply (see below). |
| `core/battle/turn/TurnBattleSystem.ts:3053` | `target.buffs` | `applyDetonate` re-seed at fixed 1 stack / authored duration. |
| `core/buff/BuffSystem.ts:487` | `targetBuffs` param | Internal `targetBuffSystem` inside `rollOnHitEffects`. |
| `core/battle/turn/TurnStatsRecompute.ts:24` | `buffs` param | `getActiveModifiers()` reader inside `recomputeEffectiveStats` — the ONLY stat-modifier read path. |

Direct `BuffPool` writes that bypass `BuffSystem` entirely:
`actor.buffs.clearCcEffects()` (`TurnBattleSystem.ts:1063`),
`target.buffs.clearCcEffects()` (`:1963`), `target.buffs.removeInstance(buff.id,
buff.sourceId)` (`:3039`, detonate consume), `target.buffs.hasInstance` (`:3028`), and
readers (`getAll`, `getAllById` — e.g. taunt lookup `selectTarget` `:267`).

`applySkillAilments` (`TurnBattleSystem.ts:2939-2990`) — the authoritative
skill->ailment application path: per authored `appliesAilments`/`appliesAilment`
entry, rolls `this.rng() < resolveAilmentApplicationChance(chance,
elementApplicationPercent)` (`:2959`), resolves the def via
`this.registry.get(buffDefinitionId)` in try/catch (`:2962-2968`), applies `stacks`
times via `new BuffSystem(target.buffs).apply(definition, actor.entity, target.entity,
this.registry)` (`:2973-2975`), then — when `initiatesReactions` — calls
`this.reactionManager?.checkAndTrigger(target.buffs, ailment.buffDefinitionId,
actor.entity, target.entity, this.combat, this.registry)` (`:2977-2986`).

---

## 6. Root-transaction id census

**No explicit root-resolution transaction id exists in this tree.** Greps across
`game/src` find zero production occurrences of `rootActionId`, `castId`,
`subcastIndex`, `action.turn.*`, `status.turn.*`, `script.*`, or `proc.*`. R-C2's id
forms are FUTURE contract names — this section maps where each would hang today.

### 6.1 De facto resolution roots (what exists)

Every resolution root today is: one `turnToken.claim` + one `beginTurnPipeline` run +
the `declareActorAction -> applyActionImpact -> completeAction` triple (production) or
the `resolveActorTurn`/`resolveNextStep`/`runToCompletion` wrappers
(`TurnBattleSystem.ts:2874`/`:2889`/`:2921` — test/tooling path).

| Root kind | Current entry | Identity anchor today | Gap vs R-C2 form |
|---|---|---|---|
| Natural / forced actor action | `declareActorAction` (`TurnBattleSystem.ts:894`) via `beginTurnPipeline` (ops `:477`) | `battle.totalTurnsElapsed` incremented `:944`; presentation `actionId = ${actor.id}-${totalTurnsElapsed}` (`CombatAnimationRuntime.ts:273`) | `action.turn.N.*` — counter exists; no minted string id. |
| Queued executions (repeat/multicast) | `battle.queuedExecutions` (`:238`) -> `dequeueFollowUpActor` (`:571-638`) -> `pendingQueuedExecution` -> `declareQueuedExecution` (`:2109`) | `TurnQueuedExecution {actorId, rootSkill, source:'repeat'|'multicast', multicastDepth}` (`TurnSkillAction.ts:406-411`) | Same pipeline claim; SKIPS `totalTurnsElapsed` increment and status phase (early return `:908`). `multicastDepth` is a depth bound, not an ordinal; `repeatCasts` pushes N identical entries with no index — no `subcastIndex` analogue. |
| Reactive bypass (counter/follow_up/intercept) | `battle.queuedFollowUps` (`:225`) -> `dequeueFollowUpActor` -> `pendingReactiveEntry` -> `declareReactiveBypass` (`:2694`) | `QueuedFollowUp {actorId, executionKind, actionSource, triggerContext?, payloadSkillId?, targetIds?}` (`:419-431`); `actionSource` in `'counter'|'follow_up'|'intercept'` (`ReactiveActionSource` `:403`) | `proc.*`-adjacent; provenance exists structurally, no id minted. Chain bound: `followUpChainDepth` cap `MAX_FOLLOW_UP_CHAIN_DEPTH = 4` (`:300`, `:604-634`). |
| Status / buff tick phase | Inside the actor's `declareActorAction` — `actorBuffSystem.update` (`:1110`), `applyTurnRegen` (`:1155`), cooldown tick, `bossTrigger` (`:1193`) | none — runs inside the actor's action root | `status.turn.N.*` — NO separate root; DoT kills mid-phase early-return inside the parent's transaction. A future status-phase id must wrap this block without changing its position in the turn. |
| Scripted beats | `specialAttacks` `everyNth` substitution inside declare (`specialAttackCounter`, `:150`, `:1259+`); charge resolve inside declare | shares the actor action's identity | `script.*` — no separate producer exists. |
| Proc-driven roots | `resolveReactiveProcs` (`:2355`) pushes `QueuedFollowUp` (`:2436-2437`); `rollReactiveTrigger` queue push (`:1843-1844`) | the `QueuedFollowUp` record itself | `proc.*` — producer sites identified, no ids. |
| System-level mutations (NO root identity at all) | Wave spawn/telegraph materialization and gauge advance in `tickPacing` (`:701-823`), inter-wave `actionGauge = 0` reset (`:782`), `battle.state` victory/defeat writes (`:789`, `:2838`, `:2844`), intro/countdown transitions (`:657`, `:681`) | none | Out of `rootActionId` scope today — but they ARE ordered mutations in the same stream; flag for M2 sequencing decisions. |

### 6.2 Identity-like fields that DO exist

| Field | Definition | Notes |
|---|---|---|
| `CombatEntity.id: string` | `core/combat/CombatEntity.ts:12` | Produced by `'player'` (`core/player/Player.ts:468`), companion definition id (`core/companion/CompanionCombat.ts:19`), enemy `` `${template.id}_${crypto.randomUUID()}` `` (`core/enemy/EnemySystem.ts:20` — nondeterministic uuid, see §1.3), tribulation ghost `'player'` (`TribulationDirector.ts:196`). This is the `CombatEntityId` substrate. |
| `battle.totalTurnsElapsed` | `TurnBattle.ts:176`; written `:944`; read `:2849` | Raw actor-action counter; skipped by bypass/queued branches. |
| `BattleLogEntry` | `core/battle/turn/TurnOrderPreview.ts:7-14` | `{ turn: totalTurnsElapsed, actorId, skillId, targetIds }` appended in `completeAction` (`:2849-2856`). |
| `TurnSkillExecution` | `TurnSkillAction.ts:379-396` | `{ rootSkillId, resolvedSkill, source: TurnExecutionSource, theBurned?, multicastDepth? }` — `TurnExecutionSource = 'original'|'empowered'|'composite'|'repeat'|'multicast'` (`:377`). `rootSkillId` owns cast count/cooldown (`executionCommitsCast` `:422-424`); `resolvedSkill` owns the payload. Closest thing to a cast identity — in-memory, per-declare, never minted as a string. |
| `TurnDeclaredAction.execution` + `actionSource`/`triggerContext`/`intercepted`/`interceptedBy` | `TurnBattleSystem.ts:374-395` | Per-declare provenance bundle handed declare -> impact -> complete. |
| Presentation `actionId` / `actionInstanceId` / `playbackToken` | `CombatAnimationRuntime.ts:273` (`${actor.id}-${totalTurnsElapsed}`), `:305` (`-extra-${primaryId}`), `TurnActionPresentationEvents.ts:70` (`turn-act-${actionId}`), `CombatAnimationRuntime.ts:122-123` (`playback-${seq}`) | PRESENTATION identities, not transaction ids. Collision note: bypass/queued actions do not increment `totalTurnsElapsed`, so a reactor's actionId is `actorId`-disambiguated against the last natural turn — two same-actor follow-ups inside one turn would share an `actionId`. |
| `TurnStepResult.execution` | `TurnBattleSystem.ts:313-321` | Carries the `TurnSkillExecution` out of `resolveNextStep`. |
| `rootSkillId` vs `skillId` | `TurnSkillAction.ts:77` comment (INV-18) | Cast identity vs payload identity split already exists conceptually — `castId` will bind to the former. |

`castId` / `subcastIndex`: **no analogues exist.** The skill plan's resolver/executor
must mint them; the natural attachment point is `TurnSkillExecution` (per execution)
plus an ordinal for repeat/multicast subcasts that `TurnQueuedExecution` currently
lacks.

---

## 7. Write-authority matrix

Format: `type -> producing file -> consuming files`. "Current" = this baseline;
contract-layer producers are marked FUTURE.

| State / type | Producing file(s) | Consuming file(s) |
|---|---|---|
| Cycle RNG `() => number` | `GameManagerTurnBattleOps.mintCycleRng` (`:835-839`); field `:808`; factories `deps.createBattleRng` / `setBattleRngFactory` (`:814`) | `CombatSystem.randomSource` (`CombatSystem.ts:111`); `TurnBattleSystem.rng` (`:479` -> all rolls §1.2); `StageWaveSystem` pick/elite/hidden-beast (`:173-200`, `:217`); `EnemySpawnPlacement` (`:63`, `:75-76`); `CultivationPathRuntime.buildDynamicBasic` -> `NguKiemDaoProvider` (`:83`, `:88`); `StageSystem.pickNextEnemyEntry` -> `DropRoll.weightedRandom` |
| `CombatEntity.id` | `Player.ts:468`; `EnemySystem.spawn` `:20`; `CompanionCombat.companionToCombatEntity` `:19`; `TribulationDirector` ghost `:196` | Targeting (`selectTarget`), events/logs (`BattleLogEntry`, `ActionImpactEvent`), buff instance `sourceId`/`targetId`, `killIfDead` attribution |
| `battle.totalTurnsElapsed` / `roundsElapsed` / `actedThisRound` | `TurnBattleSystem.declareActorAction` (`:944`, round tracking `:944-971`) | `CombatAnimationRuntime` actionId (`:273`, `:305`); `BattleLogEntry.turn` (`:2849`); sudden-death reads `roundsElapsed` (`:3057+`); `baTheTriggeredAtTurn` (`:1065`) |
| `TurnDeclaredAction` | `declareActorAction` (`:894`), `declareQueuedExecution` (`:2109`), `declareReactiveBypass` (`:2694`) | `applyActionImpact` (`:1418`), `completeAction` (`:2807`), `CombatAnimationRuntime` ack paths |
| `battle.queuedExecutions` (`TurnQueuedExecution`) | `enqueueFollowUpExecutions` (`:2217-2261`) | `dequeueFollowUpActor` (`:577-595`) -> `declareQueuedExecution`; `isPendingQueuedExecution` (`:2272`, ops `:462`) |
| `battle.queuedFollowUps` (`QueuedFollowUp`) / `followUpChainDepth` | `resolveReactiveProcs` (`:2436-2437`); `rollReactiveTrigger` push (`:1843-1844`); depth reset `:840`, cap `:604-634` | `dequeueFollowUpActor` (`:598-635`) -> `pendingReactiveEntry` -> `declareReactiveBypass`; presentation/tests |
| `TurnSkillExecution` / `execution` | `TurnSkillAction.ts` types; populated in declare paths | `executionCommitsCast` (`:422`) gates `commitAction`/cooldown (`TurnSkillAction.ts:605-611`); `TurnStepResult.execution`; presentation |
| `entity.currentHp` / `maxHp` / `alive` | `EntityVitalsSystem` (`applyDamage` `:36`, `applyHpDamageFromSnapshot` `:48`, `applyHealing` `:87`, `applyTurnRegen` `:137`, `clampToMaxHp` `:61`); `CombatSystem.killIfDead` (`alive=false` `:687`, survive `currentHp=1` ~`:617`); `TribulationDirector` own vitals + ghost writes (`:141`, `:523`); `entity.maxHp` via `refreshParticipantStats` (`:523-532` -> `TurnStatsRecompute`) | `'entity_vitals_changed'` consumers (HUD/snapshot `buildTurnBattleEntitySnapshot`); `killIfDead`; leech/regen readers; `isGaugeReady`/`alive` filters |
| `entity.currentWard` / `currentMp` / `externalWard` / `currentThe` | `vitals.spendWard` (`:75`); `applyTurnRegen`; DIRECT writes: `CombatSystem.resolveAttack` (`externalWard` `:398-403`, `currentWard` `:412`, `currentMp` `:427`); `TurnBattleSystem` externalWard grants (`:1981`, `:2665`); `consumeResourceFor` (`TurnSkillAction.ts:336`); `TheEconomy` (`grantThe` `:30`, `tryPayProcCost` `:62`, `onProcSuccess` `:70`); `TheTuExternalWard.reconcileExternalWard` (`:19-51`) | `resolveAttack` absorb order; ward regen gate (`turnsSinceLastHitLanded`); proc-cost gates `resolveReactiveProcs`; The-scaling payload folds |
| `participant.actionGauge` | `ActionGauge.ts` (`advanceGauge` `:15`, `consumeGaugeAfterAction` `:28`, `refundGauge` `:40`); DIRECT writes: `TurnBattleSystem.ts:782` (inter-wave reset), initializers `TurnBattleAdapter.ts:42`, `TurnOrderPreview.ts:56` | `TurnQueue` (`:29`, `:32`); `tickPacing` (`:823`); `completeAction` (`:2815`); `applyGaugeDeltaEffects` (`:54-61`); turn-order preview |
| `participant.buffs` (`BuffPool`) | `BuffSystem.apply` (`:78`), `update` (`:264`), `updateTime`, `convertsToId` recursion (`:168`), `rollOnHitEffects` (`:478`), `rollReactiveTrigger` (`:505`); DIRECT pool ops: `clearCcEffects` (`TBS:1063`, `:1963`), `removeInstance` (`:3039`), `removeAllById` (`:1807`) | `TurnStatsRecompute.getActiveModifiers` (`:24` -> `entity.stats`); CC gates (`:1060`); taunt (`selectTarget` `:267`); `reactionManager.checkAndTrigger`; status-VFX diff emitters; `applyDetonate` (`:3016-3044`) |
| `entity.stats` (effective) | `recomputeEffectiveStats` (`core/battle/turn/TurnStatsRecompute.ts`) via `refreshParticipantStats` (`TurnBattleSystem.ts:523-532`; call sites `:562`, `:1117`, `:1204`, `:1660-1661`, `:1904-1905`, `:1993`) | All combat formulas (`CombatSystem`), `participant.speed` cache, presentation snapshot |
| `battle.state` (`TurnBattleState`) | `TurnBattleSystem` `:657` (countdown), `:681` (fighting), `:789` (victory), `:2838`/`:2844` (defeat/victory), `:2913`, `:2930`; ops-level defeat/abandon writes | `stepTurnBattle` pacing loop; `onTurnDrained` (`:698`); `settleCombatOutcome`; reward/session ops |
| `battle.wave` / `PendingEnemySpawn` | `buildTurnBattle` (ops `:981-987`); `tickPacing` spawn/materialize (`:714-759`); spawn factory `pickEnemyForTurnSpawn` + `resolveEnemySpawnPosition` | `tickPacing` inter-wave logic; presentation pending-spawn visuals (`TurnBattleEntitySnapshotEvent`) |
| `battle.log` (`BattleLogEntry[]`) | `completeAction` (`:2849-2856`) | `TurnOrderPreview`/UI battle log |
| `TurnToken` state | `TurnToken.ts` (`claim` `:33`, `submitChoice` `:48`, `resolve` `:55`, `reset` `:69`) | `GameManagerTurnBattleOps` (`:374` in-flight check, `:464` claim, `:522`/`:544` boundary gates, `:691`/`:702` drain-resolve, `:1503`/`:1537` manual gates); `attachTurnTokenToClock` (`:382-392`); `CombatAnimationRuntime` manual flow |
| `TurnPipeline` queue/depths | `TurnPipeline.ts` (`push`/`drain`/`reset`/`completeStep`) | `beginTurnPipeline` (`ops:565-603`) — SOLE production driver; `TurnPipeline.test.ts` exercises the unused kinds |
| `CombatClock` freeze reasons / steps | `CombatClock.ts` (`freeze` `:85`, `resume` `:95`, `ManualClockSource` `:35`) | `advanceCombat` driver (`ops:312`, `:329`, `:423`); token listener (`:385-389`); off-screen sync (`:401-403`); settle `stop` (`:743`, `:1078`, `:1456`) |
| Cooldown/counter participant fields (`remainingCooldownTurns`, `specialAttackCounter`, `consecutiveHardCcTurns`, `baTheTriggeredAtTurn`, `chargingTurnsRemaining`, `pendingChargedSkillId`, `castCounts`) | `tickCooldowns` (`TurnSkillAction.ts`), `commitAction` (`:605`), declare-phase writes in `TurnBattleSystem` | `selectAction`/`selectForcedAction`; `specialAttacks` substitution; charge resolve; cast sinks |
| `boundaryQueue` | `enqueueAtTurnBoundary` (`ops:516`) | `drainBoundaryQueueIfIdle` (`:539`, called `:450`); dropped on `COMBAT_OVER` (`:709`) |
| Domain events (`'attack'`, `'hit'`, `'damage'`, `'dodge'`, `'critical'`, `'block'`, `'heal'`, `'death'`, `'kill'`, `'reaction'`, `'talent_survive_lethal'`, `'entity_vitals_changed'`) | `CombatSystem` (`:307`, `:359-378`, `:458`, `:557`, `:661`, `:689`, `:697`); `EntityVitalsSystem` (`:198`); `TurnReactionManager` (`'reaction'`); `TurnBattleSystem` `'attack'` (`:1549`) | `EventBus` subscribers: presentation ops, Vue UI, combat log — NO ordering/transaction semantics (per R-C4 the contract layer does not reuse it) |
| Presentation events (`turn_ready`/`turn_cast_start`/`action_impact`/`turn_standby_complete`/entity snapshot/`status_vfx_*`) | `TurnActionPresentationEvents.ts` (`:25`, `:29`, `:66`, `:83`, `:185`); `TurnStatusPresentationEvents`; `CombatAnimationRuntime` | Phaser scene renderers; `GameManagerTurnBattlePresentationOps` snapshot (`:128-147`) |
| Tribulation outcome/session | `TribulationDirector` (own vitals `:141`, ghost entity `:195-205`, `attemptId` `:132`, `PresentationSession` `:142`) | `App.vue`/HUD via `entity_vitals_changed` + tribulation events — parallel lifecycle, out of turn-battle scope |
| FUTURE `rootActionId`/`operationId`/`castId`/`subcastIndex`/`eventId`/`combatSequence` | contract layer (`core/battle/contracts` + `core/battle/runtime`, R-C1) minted at the §6.1 root entry points; scheduler asserts uniqueness (R-C2) | scheduler trace, causation edges, `BatchResultContext`, diagnostic sink |

---

## 8. Rulings (R-C1..R-C7, R9-revised) — copied verbatim for sign-off

| # | Assumption | Rationale |
|---|---|---|
| R-C1 | Contract layer location: `game/src/core/battle/contracts/` (types) + `game/src/core/battle/runtime/` (impls). | Review: "type-only contracts" wording was self-contradictory once RNG/registry factories landed — split makes the dependency constitution honest. |
| R-C2 | `operationId` minting: producer mints deterministic ids; scheduler ASSERTS uniqueness on enqueue (duplicate → structural fault throw). `rootActionId` = id of the ROOT combat resolution transaction — NOT restricted to skill casts (review r2 HIGH 4): `action.turn.N.*` for declared actions, `status.turn.N.*` for buff/status phase ticks, `script.*` for scripted beats, `proc.*` for proc-driven roots. Owner = whatever entry point drives the resolution (TurnBattleSystem declare, status phase, scripted runner). | §13 requires uniqueness; assertion enforces it. Non-action roots exist today (buff ticks run before the action's declare phase) — narrowing the owner to casts would force sibling plans to invent ids off-contract. |
| R-C3 | `CombatScheduler` per battle, constructed by `GameManagerTurnBattleOps` (the composition root) alongside `mintCycleRng`; handed INTO `TurnBattleSystem` as a ctor dep. | Review: per-battle scope approved, but construction belongs at lifecycle root — same place the cycle RNG already lives. |
| R-C4 | `EventBus` NOT reused for combat immediate events — scheduler owns its ordered queue (settlement ordering + exactly-once + quiescence exceed EventBus emit-snapshot semantics). | Approved in review. |
| R9-revised | Settlement guard violation — nesting depth OR per-root work budget exceeded (r5 MEDIUM 2) → `CombatSettlementFault`: dev/test throw; production stops battle progression + emits `CombatSettlementFaultEvent` (out-of-band diagnostic, never a queued gameplay event) + trace dump. NEVER retroactively marks the committed originating op failed — its result already committed (contract §48). | Review rejected retro-fail: committed state can't be un-resolved. |
| R-C5 | `CombatScheduler` is strictly intra-action: it may NOT advance `CombatClock`, own `TurnToken`, decide turn end, drive presentation, or run boundary commands — `TurnPipeline` keeps all of that. | TurnPipeline already owns turn lifecycle; a second scheduler there = two authorities. |
| R-C6 | The cycle `CombatRng` is minted ONCE per battle cycle at `mintCycleRng` (`GameManagerTurnBattleOps.ts:835`) and shared with every consumer (CombatSystem via `setRandomSource`, TurnBattleSystem ctor, spawn placement, pool picks) — exactly the current `() => number` distribution, just typed. | Review: one battle = one random stream; adapter-level minting would split it. |
| R-C7 | `HealOperation.amount` is always concrete by executor time. Result-referencing heals (`heal_from_damage`) are emitted as `DeferredOperation` inside a `CombatOperationBatch` — the batch runner materializes them from prior in-batch results. Executor never resolves refs. | Review: executor must not read scheduler/result state; deferred-materialization keeps it a pure router. |
