# R2 — Stat Provenance & Effective Combat Stats — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (project convention: opencode has no subagent dispatch — Inline Execution, per P6). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Single-pass attribute derivation — effective battle stats = resolved base + temporary buff modifiers, and queue/preview consume effective speed.

**Architecture:** New primitive `calculateEffectiveStats` (1 pass, no attribute derivation) in `StatCalculator`; `TurnStatsRecompute` migrates to it; `TurnBattleSystem` syncs `participant.speed` from effective stats at recompute + pacing. Adapter comment documents the cache contract.

**Tech Stack:** Vue 3 + TypeScript + Vitest (headless engine tests, no Phaser needed).

**Spec:** `game/docs/superpowers/specs/2026-09-08-r2-stat-provenance-design.md`

## Global Constraints

- No `any` (P8); new/edited comments English ASCII only (P15).
- No rebalance of authored numbers; no nominal Stats types; no modifier-system rewrite (spec §10).
- `calculateStats` (2-pass) remains the ONLY attribute-derivation owner; it stays unchanged for Resolved layer.
- In-battle recompute reads `entity.baseStats` directly (drop `?? entity.stats` fallback at TurnBattleSystem.ts:743).
- Commit only inside the R2 worktree; merge to master after gates pass (user-authorized per-step merge with evidence).
- Verification per task: `npx.cmd vitest run <file>`; final: P3 full.

---

### Task 1: Worktree + baseline

**Files:** none (environment).

**Interfaces:**
- Consumes: master at current HEAD.
- Produces: worktree `.agent-worktrees/r2-stat-provenance` on branch `feat/r2-stat-provenance`, baseline suite green.

- [ ] **Step 1: Create worktree** via using-git-worktrees flow: `git worktree add ".agent-worktrees/r2-stat-provenance" -b feat/r2-stat-provenance`; junction `game/node_modules` → main `game/node_modules`.
- [ ] **Step 2: Baseline:** `npm.cmd run type-check` (expect PASS) + `npx.cmd vitest run src/core/stats src/core/battle/turn` (expect green).

### Task 2: `calculateEffectiveStats` primitive (TDD)

**Files:**
- Modify: `game/src/core/stats/StatCalculator.ts`
- Test: `game/src/core/stats/StatCalculator.turnConversion.test.ts` (append describe block)

**Interfaces:**
- Consumes: existing `runPipeline(baseStats, modifiers)` (module-private), `Stats`, `StatModifier`.
- Produces: `calculateEffectiveStats(resolvedBase: Stats, tempModifiers: StatModifier[]): Stats` — 1-pass fold, NO attribute derivation. Exported from StatCalculator.

- [ ] **Step 1: Write failing tests** (append to StatCalculator.turnConversion.test.ts):

```typescript
describe('calculateEffectiveStats (R2 resolved->effective boundary)', () => {
  // strength 100 raw → derived +60 attack (ATTRIBUTE_ATTACK_PER_POINT=0.6)
  const BASE_WITH_STRENGTH: Stats = { ...createBaseStats(), strength: 100, attack: 10 }
  const ATTACK_BUFF: StatModifier = { id: 'b1', sourceId: 'buff', sourceType: 'buff', stat: 'attack', percent: 0.5 }

  it('does NOT re-derive attribute bonuses from resolved input', () => {
    // resolvedBase already contains attack 70 (10 raw + 60 derived).
    const resolved = calculateStats(BASE_WITH_STRENGTH, [])
    expect(resolved.attack).toBe(70)
    const effective = calculateEffectiveStats(resolved, [ATTACK_BUFF])
    // +50% applied to 70 ONCE = 105; the old double-derivation path yielded 130 (70 re-derived +60, then buffed 130).
    expect(effective.attack).toBe(105)
  })

  it('resolved base passes through unchanged with no temp modifiers', () => {
    const resolved = calculateStats(BASE_WITH_STRENGTH, [])
    expect(calculateEffectiveStats(resolved, [])).toEqual(resolved)
  })
})
```

- [ ] **Step 2: Run** `npx.cmd vitest run src/core/stats/StatCalculator.turnConversion.test.ts` — expect FAIL (`calculateEffectiveStats is not exported`).
- [ ] **Step 3: Implement** in StatCalculator.ts:

```typescript
/**
 * Effective battle stats (R2 / AR-02): fold TEMPORARY battle modifiers
 * (turn buffs) on top of an ALREADY-RESOLVED base. Runs the pipeline
 * exactly once and never re-derives attribute bonuses — the input must
 * be calculateStats() output (or equivalent normalized stats).
 */
export function calculateEffectiveStats(resolvedBase: Stats, tempModifiers: StatModifier[]): Stats {
  return runPipeline(resolvedBase, tempModifiers)
}
```

- [ ] **Step 4: Run again** — expect PASS (2 tests + existing suite green).

### Task 3: Migrate `TurnStatsRecompute` + drop fallback (TDD)

**Files:**
- Modify: `game/src/core/battle/turn/TurnStatsRecompute.ts`
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` (call site ~line 743)
- Test: `game/src/core/battle/turn/TurnStatsRecompute.test.ts` (create if absent)

**Interfaces:**
- Consumes: `calculateEffectiveStats` (Task 2).
- Produces: `recomputeEffectiveStats(baseStats: Stats, buffs: TurnBuffPool): Stats` — signature unchanged; now treats first arg as RESOLVED base.

- [ ] **Step 1: Characterization test** (new file TurnStatsRecompute.test.ts) — resolved base + buff folded once:

```typescript
import { describe, expect, it } from 'vitest'
import { recomputeEffectiveStats } from './TurnStatsRecompute'
import { calculateStats, type StatModifier } from '../../stats/StatCalculator'
import { createBaseStats, type Stats } from '../../stats/StatBlock'
import { TurnBuffPool } from './TurnBuffPool'

// R2 (AR-02): engine-level proof that attribute derivation happens ONCE.
// Fixture mirrors the audit probe: raw attack 10 + strength 100 resolves
// to attack 70; an in-battle +50% attack buff must fold onto 70 (=105),
// not re-derive strength (+60) first (=130).
function makePoolWith(modifier: { stat: 'attack'; percent: number; stacks?: number }): TurnBuffPool {
  const pool = new TurnBuffPool()
  const definition = {
    id: 'qa_atk_buff',
    name: 'QA Attack Buff',
    polarity: 'buff' as const,
    duration: 5,
    maxStacks: 5,
    stackMode: 'stack' as const,
    effects: [{ type: 'statModifier', stat: modifier.stat, percent: modifier.percent }],
  }
  const entity = { id: 'src' } as never // source entity unused by statModifier folding
  pool.apply(definition, entity, entity, { get: (id: string) => { if (id === definition.id) return definition; throw new Error('unknown') } })
  return pool
}

describe('recomputeEffectiveStats (R2 effective boundary)', () => {
  it('folds buff modifiers onto the RESOLVED base without re-deriving attributes', () => {
    const raw: Stats = { ...createBaseStats(), strength: 100, attack: 10 }
    const resolved = calculateStats(raw, [])
    expect(resolved.attack).toBe(70)

    const effective = recomputeEffectiveStats(resolved, makePoolWith({ stat: 'attack', percent: 0.5 }))
    expect(effective.attack).toBe(105)
  })
})
```

(Note: check `TurnBuffPool.apply` signature against `TurnBuffSystem.apply` usage; adjust fixture to the real API.)

- [ ] **Step 2: Run** — expect FAIL (current implementation re-derives → 130).
- [ ] **Step 3: Migrate** TurnStatsRecompute:

```typescript
import { calculateEffectiveStats } from '../../stats/StatCalculator'

export function recomputeEffectiveStats(resolvedBase: Stats, buffs: TurnBuffPool): Stats {
  return calculateEffectiveStats(resolvedBase, collectStatModifiers(buffs))
}
```

- [ ] **Step 4: Migrate call site** TurnBattleSystem.ts:743:

```typescript
// R2 (AR-02): baseStats holds the RESOLVED base (built from
// player.finalStats / enemy normalization); effective stats fold
// temporary buffs on top WITHOUT re-deriving attributes.
actor.entity.stats = recomputeEffectiveStats(actor.entity.baseStats, actor.buffs)
```

- [ ] **Step 5: Run turn + stats suites** — `npx.cmd vitest run src/core/battle/turn src/core/stats` — expect green (some tests may assert old doubled numbers: fix by updating expectations to the single-derivation values per spec §9 — this is the disclosed intentional change, NOT a rebalance).

### Task 4: Effective speed sync (AR-05, TDD)

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts`
- Test: `game/src/core/battle/turn/TurnBattleSystem.effectiveSpeed.test.ts` (new)

**Interfaces:**
- Consumes: participant shape `{ speed: number }`, `advanceGauge`, existing battle fixture helpers (reuse pattern from `TurnBattleSystem.consumeDamage.test.ts`).
- Produces: participant.speed synced from entity.stats.speed at (a) recompute site, (b) pacing loop in tickPacing/peekNextActor.

- [ ] **Step 1: Write failing tests** (fixture mirrors consumeDamage.test.ts):

```typescript
import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { TurnBuffPool } from './TurnBuffPool'
import { TurnBuffSystem } from './TurnBuffSystem'
import type { TurnBuffDefinition } from './TurnBuffTypes'

// R2 (AR-05) — participant.speed is a synced cache of effective stats.
const SPEED_BUFF: TurnBuffDefinition = {
  id: 'qa_speed_buff', name: 'QA Speed', polarity: 'buff', duration: 5, maxStacks: 1, stackMode: 'replace',
  effects: [{ type: 'statModifier', stat: 'speed', percent: 1 }], // +100%
}

function createCombatant(id: string, overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), speed: 100 }
  return { id, name: id, type: 'player', baseStats: stats, stats, currentHp: 1_000_000, maxHp: 1_000_000,
    currentMp: stats.maxMp, currentSwordIntent: 0, currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0,
    currentKimThe: 0, currentThe: 0, timeSinceLastBleedProc: 0, tuLucActive: false, tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0, currentWard: 0, timeSinceLastHitTaken: Infinity, realmIndex: 0, x: 0, row: 2,
    alive: true, ...overrides } as CombatEntity
}

function battle(speedBuffOnPlayer: boolean): { battle: TurnBattle; system: TurnBattleSystem; player: TurnBattleParticipant; enemy: TurnBattleParticipant; registry: { get: (id: string) => TurnBuffDefinition } } {
  const playerEntity = createCombatant('player')
  const enemyEntity = createCombatant('enemy'); enemyEntity.type = 'enemy'
  const registry = { get: (id: string) => { if (id === SPEED_BUFF.id) return SPEED_BUFF; throw new Error('unknown') } }
  const mk = (id: string, e: CombatEntity, speed: number, priority: number): TurnBattleParticipant =>
    ({ id, entity: e, speed, priority, actionGauge: 0, alive: e.alive, buffs: new TurnBuffPool(), consecutiveHardCcTurns: 0 })
  const player = mk('player', playerEntity, 100, 0)
  const enemy = mk('enemy', enemyEntity, 100, 1)
  player.basic = { id: 'b', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 0 }, targeting: { shape: 'single' } }
  enemy.basic = player.basic
  const battle: TurnBattle = { players: [player], enemies: [enemy], state: 'fighting' }
  const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 100, registry)
  if (speedBuffOnPlayer) new TurnBuffSystem(player.buffs).apply(SPEED_BUFF, playerEntity, playerEntity, registry)
  return { battle, system, player, enemy, registry }
}

describe('effective speed sync (AR-05)', () => {
  it('buff applied mid-battle: participant.speed syncs to effective speed at next pacing step', () => {
    const ctx = battle(true) // buff pre-applied to player pool
    // First tickPacing: recompute + sync happen; player acts (gauge reaches max first at equal speed via priority).
    ctx.system.resolveNextStep(ctx.battle)
    expect(ctx.player.speed).toBe(200) // 100 × (1+1.0)
  })

  it('gauge consumption reflects the new speed: player gets its next turn sooner than enemy at equal gauge', () => {
    const ctx = battle(true)
    ctx.system.resolveNextStep(ctx.battle)
    // After first action both gauges reset (consume 1). Player speed 200 vs enemy 100 → next ready actor is player again.
    const next = ctx.system.peekNextActor(ctx.battle)
    expect(next?.id).toBe('player')
  })

  it('buff expiry restores stats and synced speed', () => {
    const ctx = battle(true)
    ctx.system.resolveNextStep(ctx.battle)
    // Expire the buff manually (duration ticks at turn start via TurnBuffSystem.update).
    const playerEntity = ctx.player.entity
    new TurnBuffSystem(ctx.player.buffs).update(playerEntity, ctx.system.combatForTest(), ctx.registry)
    expect(playerEntity.stats.speed).toBe(100)
    expect(ctx.player.speed).toBe(100)
  })
})
```

(Note: `combatForTest()` — expose the existing CombatSystem collaborator to tests via a test-seam method on TurnBattleSystem if not already exposed; R1 added `setSurviveLethalSessionForTest`, follow the same seam pattern. Adjust buff-duration/expiry mechanics to the real `TurnBuffSystem.update` behavior — duration decrements per update call; verify via existing TurnBuffSystem tests.)

- [ ] **Step 2: Run** — expect FAIL on speed assertions (stale 100).
- [ ] **Step 3: Implement sync** — in `resolveActorTurn` recompute block (after Task 3 edit):

```typescript
// R2 (AR-05): participant.speed is a read-only cache of effective
// combat speed — refresh it at every recompute (owner: entity.stats).
actor.speed = actor.entity.stats.speed
```

and in `tickPacing` + `peekNextActor` gauge-step loops (before `advanceGauge`):

```typescript
// R2 (AR-05): sync cache from owner before every pacing use so buffs
// applied/expired during the previous turn are reflected immediately.
participant.speed = participant.entity.stats.speed
```

- [ ] **Step 4: Run turn suite** — green (order-dependent tests may need expectation updates only where they assert the stale-speed bug's timing).

### Task 5: Adapter contract comment

**Files:**
- Modify: `game/src/core/game/TurnBattleAdapter.ts:38-44` (comment only)

- [ ] **Step 1:** Replace the speed line comment context:

```typescript
// R2 (AR-05): participant.speed starts as a copy of effective speed and
// is a READ-ONLY CACHE — the engine re-syncs it from entity.stats.speed
// at every recompute/pacing step. Never write it independently.
speed: entity.stats.speed,
```

- [ ] **Step 2:** type-check.

### Task 6: Full verification + finish gates

- [ ] **Step 1: P3 full:** `npm.cmd run type-check` + `npm.cmd run build` + `npx.cmd vitest run` (no filter) — stop on first failure.
- [ ] **Step 2: E3 code-simplifier** over the diff.
- [ ] **Step 3: P5 code-review** (post-simplify), fix findings ≥80 confidence.
- [ ] **Step 4: P4 QA quick** via tutienidle-adversarial-qa; write QA doc `game/docs/qa/2026-09-08-r2-stat-provenance-quick.md` incl. P17 contract note (reference file absent; contract established from consumers/tests per spec §8).
- [ ] **Step 5: Commit** (worktree), merge to master (user-authorized), verify merged master: type-check + full suite.
- [ ] **Step 6: Roadmap update** (R2 → COMPLETE with evidence; NEXT → R3) + cleanup worktree/branch.
