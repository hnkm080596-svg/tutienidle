# Combat Fairness Guards — Bá Thể + Sudden Death — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two small, symmetric combat-fairness guards to `TurnBattleSystem`: (1) "Bá Thể" — a hard-CC lock breaker that guarantees any participant acts on its 4th consecutive blocked turn, and (2) "Sudden Death" — a linear damage-up/heal-down escalation from turn 11 onward that ends long stalemates well before the existing 10,000-turn safety cap.

**Architecture:** Both guards are additive changes inside `TurnBattleSystem.resolveNextStep()`, layered on top of Slice 3's CC-check and Slice 4's `totalTurnsElapsed` counter. Bá Thể needs one new method on `TurnBuffPool` (`clearCcEffects()`) and two new fields on `TurnBattleParticipant`. Sudden Death needs no new fields — it reuses the existing `scaleActionDamage()` pure helper from `ActionImpactSystem.ts` to scale `action.damage` before the existing `resolveActionHit()` call. No new files.

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-combat-fairness-guards-design.md`

**Dependency (blocking):** This plan assumes both Slice 3
(`docs/superpowers/plans/2026-09-04-turn-battle-system-slice3-buff-wiring.md`)
and Slice 4
(`docs/superpowers/plans/2026-09-04-turn-battle-system-slice4-resource-boss.md`)
have already been executed and merged — it reads/writes
`TurnBattleParticipant.buffs`, `TurnStepResult.ccBlocked`,
`TurnBuffSystem.isStunned()`/`isFrozen()`, and `TurnBattle.totalTurnsElapsed`
exactly as those two plans define them, and assumes `resolveNextStep()`'s
body looks like the merged result of both plans' Task 2/3 diffs. If the
actual merged code differs in shape (renamed field, reordered lines),
locate the equivalent CC-check assignment (`const ccBlocked = ...`) and
`resolveActionHit()` call site and adapt this plan's diffs to the real
code before starting — do not guess, read the real file first.

## Global Constraints

- Do not modify `game/src/core/battle/BattleSystem.ts`,
  `game/src/core/combat/CombatSystem.ts`,
  `game/src/core/battle/ActionImpactSystem.ts`,
  `game/src/core/battle/HazardZoneSystem.ts`,
  `game/src/core/element/ReactionManager.ts`,
  `game/src/core/battle/SkillEffectResolver.ts`, or
  `game/src/core/game/GameManager.ts`.
- `TurnBuffPool.ts` gets exactly one new method added
  (`clearCcEffects()`) — do not otherwise modify its existing methods.
- No `any` types.
- No UI/battle-log rendering of either mechanic firing — that is
  Slice 7's job (tracked in the roadmap), out of scope here.
- Sudden Death's heal/shield-received multiplier is **not** wired in
  this plan — no heal/shield mechanism exists yet in the turn-based
  engine to hook into (see spec §4.3). Only the damage-dealt side is
  implemented.
- No real content migration — all buffs/skills used in this plan's
  tests are fixtures, matching Slice 3/4's convention.

---

### Task 1: Bá Thể — CC-lock guard

**Files:**
- Modify: `game/src/core/battle/turn/TurnBuffPool.ts`
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts`
- Modify: `game/src/core/battle/turn/TurnBattleSystem.test.ts`

**Interfaces:**
- Consumes: `TurnBattleParticipant.buffs` (Slice 3), `TurnBuffSystem.isStunned()`/`isFrozen()` (Slice 3), the CC-check line in `resolveNextStep()` (Slice 3).
- Produces: `TurnBattleParticipant.consecutiveHardCcTurns: number`, `TurnBattleParticipant.baTheTriggeredAtTurn?: number`, `TurnBuffPool.clearCcEffects(): void` — not consumed by any other task in this plan, but available for Slice 7's future battle-log rendering.

- [ ] **Step 1: Add `clearCcEffects()` to `TurnBuffPool`**

In `game/src/core/battle/turn/TurnBuffPool.ts`, add a new method alongside the existing `removeAllById`/`clear`:

```typescript
  /** Removes every active buff that carries a cc:stun/cc:freeze effect — used by the Bá Thể CC-lock guard. */
  clearCcEffects(): void {
    this.buffs = this.buffs.filter((buff) => !buff.effects.some((effect) => effect.type === 'cc'))
  }
```

- [ ] **Step 2: Write the failing tests**

Append to `game/src/core/battle/turn/TurnBattleSystem.test.ts` (reuses the `FixtureBuffRegistry`/`STUN_DEFINITION` fixtures Slice 3's plan already added to this file):

These tests deliberately avoid depending on `TurnBuffSystem.update()`'s
exact decrement/expiry ordering (a Slice 3 internal not yet exercised
by real execution) in two ways: they use a long-duration (100-turn)
stun so it cannot expire mid-test, and the "resets to 0" case sets
`consecutiveHardCcTurns` directly rather than relying on a buff's
natural expiry timing.

```typescript
const LONG_STUN_DEFINITION: TurnBuffDefinition = {
  id: 'fixture_long_stun',
  name: 'Fixture Long Stun',
  polarity: 'debuff',
  duration: 100,
  stackMode: 'refresh',
  effects: [{ type: 'cc', ccEffect: 'stun' }],
}

describe('TurnBattleSystem.resolveNextStep Bá Thể (CC-lock guard)', () => {
  function stunnedBattle() {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)
    playerParticipant.basic = {
      id: 'fixture_basic',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
    }

    const registry = new FixtureBuffRegistry([LONG_STUN_DEFINITION])
    const enemyParticipant = makeParticipant('enemy', enemyEntity, 10, 1)

    const battle: TurnBattle = {
      player: playerParticipant,
      enemies: [enemyParticipant],
      state: 'fighting',
    }

    // Applied ONCE — duration 100 means it cannot expire within this
    // test's turn count, so every subsequent player turn stays hard-CC'd
    // without needing to reason about Slice 3's tick/expiry ordering.
    new TurnBuffSystem(playerParticipant.buffs).apply(LONG_STUN_DEFINITION, enemyEntity, player, registry)

    return { player, playerParticipant, enemyEntity, enemyParticipant, battle, registry }
  }

  it('blocks normally for the first 3 consecutive hard-CC turns, incrementing the counter', () => {
    const { playerParticipant, battle } = stunnedBattle()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, undefined)

    for (let i = 0; i < 3; i++) {
      const step = system.resolveNextStep(battle) // player's turn (speed tie broken by priority: player priority 0 < enemy 1)
      expect(step.ccBlocked).toBe(true)
      expect(playerParticipant.consecutiveHardCcTurns).toBe(i + 1)
      system.resolveNextStep(battle) // enemy's turn, consumes the enemy's gauge tick
    }
  })

  it('fires Bá Thể on the 4th consecutive blocked turn: clears CC, actor acts, counter resets', () => {
    const { playerParticipant, battle } = stunnedBattle()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, undefined)

    for (let i = 0; i < 3; i++) {
      system.resolveNextStep(battle) // player blocked, counter -> i+1
      system.resolveNextStep(battle) // enemy turn
    }

    const step = system.resolveNextStep(battle) // 4th consecutive blocked attempt — Bá Thể should fire here

    expect(step.ccBlocked).toBe(false)
    expect(step.targetIds).toEqual(['enemy'])
    expect(playerParticipant.consecutiveHardCcTurns).toBe(0)
    expect(playerParticipant.buffs.getAll()).toEqual([])
    expect(playerParticipant.baTheTriggeredAtTurn).toBeDefined()
  })

  it('resets the counter to 0 the moment the actor is not CC-blocked on its own turn', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)
    playerParticipant.basic = {
      id: 'fixture_basic',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
    }
    // Simulates "already had 2 consecutive blocked turns" WITHOUT applying
    // any CC buff — isolates the reset behavior from buff-timing entirely.
    playerParticipant.consecutiveHardCcTurns = 2

    const battle: TurnBattle = {
      player: playerParticipant,
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const step = system.resolveNextStep(battle) // player's turn, not CC'd (no buff applied)

    expect(step.ccBlocked).toBe(false)
    expect(playerParticipant.consecutiveHardCcTurns).toBe(0)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run game/src/core/battle/turn/TurnBattleSystem.test.ts`
Expected: FAIL — `consecutiveHardCcTurns`/`baTheTriggeredAtTurn` don't exist on `TurnBattleParticipant`, `clearCcEffects()` is a new unused method with nothing calling it yet.

- [ ] **Step 4: Add the fields and wire Bá Thể into `resolveNextStep()`**

In `game/src/core/battle/turn/TurnBattleSystem.ts`, add the two fields to `TurnBattleParticipant`:

```typescript
export interface TurnBattleParticipant {
  id: string
  entity: CombatEntity
  speed: number
  priority: number
  actionGauge: number
  alive: boolean
  buffs: TurnBuffPool
  consecutiveHardCcTurns: number
  baTheTriggeredAtTurn?: number
  basic?: TurnSkillDefinition
  special?: TurnSkillSlot
  ultimate?: TurnSkillSlot
  // ...any fields Slice 4 already added (resources?/bossTrigger?) stay unchanged
}
```

Replace the CC-check line (`const ccBlocked = actorBuffSystem.isStunned() || actorBuffSystem.isFrozen()`, wherever it landed after Slice 3+4 merged) with:

```typescript
    const hardCcActive = actorBuffSystem.isStunned() || actorBuffSystem.isFrozen()

    let ccBlocked: boolean

    if (hardCcActive && actor.consecutiveHardCcTurns >= 3) {
      actor.buffs.clearCcEffects()
      actor.consecutiveHardCcTurns = 0
      actor.baTheTriggeredAtTurn = battle.totalTurnsElapsed
      ccBlocked = false
    } else if (hardCcActive) {
      actor.consecutiveHardCcTurns += 1
      ccBlocked = true
    } else {
      actor.consecutiveHardCcTurns = 0
      ccBlocked = false
    }
```

- [ ] **Step 5: Update every `makeParticipant()`/`participant()` test helper to initialize the new fields**

In `game/src/core/battle/turn/TurnBattleSystem.test.ts`, `TurnBattleSystem.adversarial.test.ts`, `TurnBattleSystem.qadebug.test.ts`, and `TurnSkillAction.test.ts` (the same 4 files Slice 3's plan Task 1 already touched for `buffs`), add `consecutiveHardCcTurns: 0` to every helper's returned object, e.g.:

```typescript
function makeParticipant(
  id: string,
  combatEntity: CombatEntity,
  speed: number,
  priority: number,
): TurnBattleParticipant {
  return { id, entity: combatEntity, speed, priority, actionGauge: 0, alive: combatEntity.alive, buffs: new TurnBuffPool(), consecutiveHardCcTurns: 0 }
}
```

(`baTheTriggeredAtTurn` is optional — no initialization needed.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run game/src/core/battle/turn/`
Expected: PASS — every pre-existing case (the new fields are additive/optional-defaulted) plus the 3 new Bá Thể cases.

- [ ] **Step 7: Typecheck**

Run: `npx vue-tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add game/src/core/battle/turn/TurnBuffPool.ts game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnBattleSystem.test.ts game/src/core/battle/turn/TurnBattleSystem.adversarial.test.ts game/src/core/battle/turn/TurnBattleSystem.qadebug.test.ts game/src/core/battle/turn/TurnSkillAction.test.ts
git commit -m "feat(turn-combat): Bá Thể CC-lock guard — 4th consecutive hard-CC turn clears CC and acts"
```

---

### Task 2: Sudden Death — stalemate escalation

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts`
- Modify: `game/src/core/battle/turn/TurnBattleSystem.test.ts`

**Interfaces:**
- Consumes: `TurnBattle.totalTurnsElapsed` (Slice 4), `scaleActionDamage()` (`game/src/core/battle/ActionImpactSystem.ts`, already exported, read-only import — not modified by this task), the `resolveActionHit()` call site in `resolveNextStep()`.
- Produces: nothing consumed by a later task — this is the plan's final mechanic.

- [ ] **Step 1: Write the failing tests**

Append to `game/src/core/battle/turn/TurnBattleSystem.test.ts`:

```typescript
describe('TurnBattleSystem.resolveNextStep Sudden Death escalation', () => {
  function bareBattle(totalTurnsElapsed: number) {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 100 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0, defense: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)
    playerParticipant.basic = {
      id: 'fixture_basic',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
    }

    const battle: TurnBattle = {
      player: playerParticipant,
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
      totalTurnsElapsed,
    }

    return { player, enemyEntity, battle }
  }

  it('deals unscaled damage (x1) when totalTurnsElapsed is 10 or below', () => {
    const { enemyEntity, battle } = bareBattle(9) // becomes 10 after this step's own increment
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const hpBefore = enemyEntity.currentHp

    system.resolveNextStep(battle)

    const rawDamageDealt = hpBefore - enemyEntity.currentHp
    expect(battle.totalTurnsElapsed).toBe(10)
    // At exactly turn 10, Sudden Death has not started yet (starts turn 11) — damage is the normal, unscaled amount.
    // (Exact expected HP delta depends on calculateBaseDamage's real formula — assert only that it's the SAME
    // as a control run at turn 1, not a hardcoded number, to avoid coupling this test to damage-formula internals.)
    const { enemyEntity: controlEnemy, battle: controlBattle } = bareBattle(0)
    const controlHpBefore = controlEnemy.currentHp
    system.resolveNextStep(controlBattle)
    const controlDamage = controlHpBefore - controlEnemy.currentHp

    expect(rawDamageDealt).toBe(controlDamage)
  })

  it('scales damage by x1.3 at turn 11 (first Sudden Death turn)', () => {
    const { enemyEntity, battle } = bareBattle(10) // becomes 11 after this step's own increment
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const hpBefore = enemyEntity.currentHp

    system.resolveNextStep(battle)

    const scaledDamage = hpBefore - enemyEntity.currentHp

    const { enemyEntity: controlEnemy, battle: controlBattle } = bareBattle(0)
    const controlHpBefore = controlEnemy.currentHp
    system.resolveNextStep(controlBattle)
    const baseDamage = controlHpBefore - controlEnemy.currentHp

    expect(battle.totalTurnsElapsed).toBe(11)
    expect(scaledDamage).toBeCloseTo(baseDamage * 1.3, 1)
  })

  it('scales damage by x2.5 at turn 15 (linear, additive: 1 + 0.3*(15-10))', () => {
    const { enemyEntity, battle } = bareBattle(14) // becomes 15 after this step's own increment
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const hpBefore = enemyEntity.currentHp

    system.resolveNextStep(battle)

    const scaledDamage = hpBefore - enemyEntity.currentHp

    const { enemyEntity: controlEnemy, battle: controlBattle } = bareBattle(0)
    const controlHpBefore = controlEnemy.currentHp
    system.resolveNextStep(controlBattle)
    const baseDamage = controlHpBefore - controlEnemy.currentHp

    expect(scaledDamage).toBeCloseTo(baseDamage * 2.5, 1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run game/src/core/battle/turn/TurnBattleSystem.test.ts`
Expected: FAIL — damage is not yet scaled, the turn-11 and turn-15 cases show `scaledDamage === baseDamage` (no escalation applied).

- [ ] **Step 3: Wire the damage scaling**

In `game/src/core/battle/turn/TurnBattleSystem.ts`, add the import:

```typescript
import { scaleActionDamage } from '../ActionImpactSystem'
```

Add a small private helper method on the class:

```typescript
  private suddenDeathDamageMultiplier(totalTurnsElapsed: number): number {
    const turnsPastGrace = totalTurnsElapsed - 10

    return turnsPastGrace > 0 ? 1 + 0.3 * turnsPastGrace : 1
  }
```

Replace the hit-resolution loop (inside the `if (primaryTarget) { ... }` block, wherever Slice 3/4 left it):

```typescript
        const suddenDeathMultiplier = this.suddenDeathDamageMultiplier(battle.totalTurnsElapsed ?? 0)
        const scaledDamage = suddenDeathMultiplier === 1 ? action.damage : scaleActionDamage(action.damage, suddenDeathMultiplier)

        for (const target of affected) {
          this.combat.resolveActionHit(actor.entity, target.entity, scaledDamage)
          targetIds.push(target.id)
        }
```

(Everything else in that block — `commitAction`, the `appliesBuff` block from Slice 3 — stays unchanged; only the `resolveActionHit()` argument changes from `action.damage` to `scaledDamage`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run game/src/core/battle/turn/TurnBattleSystem.test.ts`
Expected: PASS, all cases including the 3 new Sudden Death cases.

- [ ] **Step 5: Typecheck**

Run: `npx vue-tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnBattleSystem.test.ts
git commit -m "feat(turn-combat): Sudden Death — linear damage escalation from turn 11"
```

---

### Task 3: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, zero regressions. Only `game/src/core/battle/turn/**` and `TurnBuffPool.ts` were touched, plus a new read-only import of `scaleActionDamage` from the already-live `ActionImpactSystem.ts` (no changes to that file itself).

- [ ] **Step 2: Run typecheck**

Run: `npx vue-tsc --noEmit` (or the project's existing typecheck script — check `package.json`'s `scripts` for the exact command already used elsewhere in this repo before running).
Expected: PASS, zero errors.

- [ ] **Step 3: Commit any fixups**

If Step 1-2 required fixes beyond what Tasks 1-2 anticipated, stage exactly the changed files and commit:

```bash
git add -A
git commit -m "fix: address regressions found during Combat Fairness Guards full-suite verification"
```

If no fixes were needed, skip this step.

## Not Covered By This Plan

- Sudden Death's heal/shield-received multiplier (`max(0, 1 - 0.3*(turn-10))`) — no heal/shield mechanism exists in the turn-based engine yet to hook into (spec §4.3). Wire it when heal/shield skill effects are designed.
- Any UI/battle-log rendering of "Bá Thể!" firing or "Sudden Death active" state — Slice 7's domain (per the Deep Review decision to add turn-order-preview + battle log to Slice 7's scope), not requested here.
- Soft-CC (non-action-blocking effects like slow/silence) — Bá Thể only guards `cc:stun`/`cc:freeze`, the only action-blocking effect kinds `TurnBuffTypes.ts` has today.
- Any change to `BattleSystem.ts`, `CombatSystem.ts`, `HazardZoneSystem.ts`, `ReactionManager.ts`, `SkillEffectResolver.ts`, or `GameManager.ts`.
