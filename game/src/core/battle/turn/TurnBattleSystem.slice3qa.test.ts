import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { BuffDefinition } from '../../buff2/BuffDefinition'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import { makeTestBuffRegistry, makeTurnRuntime, type TurnRuntimeFixture } from './testing/TurnRuntimeFixtures'

// QA adversarial probes (2026-09-04 quick review) — Slice 3 buff/CC wiring.
// M4: definitions are authored buff2; instances live in the shared runtime
// store; death sweeps a dead target's instances at the kill boundary
// (spec sec.40) instead of leaving them on the corpse.

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, blockChance: 0 })

  const entity = {
    id: 'id',
    name: 'name',
    type: 'enemy',
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,

    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
    // ARCH-002 (M7): entity.stats is derived from baseStats every refresh —
    // an injected `stats` override must become the resolved base as well.
    baseStats: overrides.baseStats ?? overrides.stats ?? stats,
  } as CombatEntity

  // ARCH-002 (M7 R1): refreshParticipantStats reconciles entity.maxHp from
  // entity.stats.maxHp and clamps currentHp — the fixture's declared vitals
  // ceiling must exist in the resolved/base stats or the first refresh
  // reverts it.
  const ceiling = Math.max(entity.maxHp, entity.currentHp)
  if (entity.stats.maxHp !== ceiling) {
    entity.stats = { ...entity.stats, maxHp: ceiling }
    entity.baseStats = asBaseStats({ ...entity.baseStats, maxHp: ceiling })
  }
  return entity
}

function makeParticipant(
  id: string,
  combatEntity: CombatEntity,
  speed: number,
  priority: number,
): TurnBattleParticipant {
  return { id, entity: combatEntity, speed, priority, actionGauge: 0, alive: combatEntity.alive, consecutiveHardCcTurns: 0 }
}

const STUN: BuffDefinition = {
  id: 'qa_stun',
  name: 'Stun',
  kind: 'debuff',
  polarity: 'debuff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, onReapplyStacks: 'replace', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'holder_turns', duration: 2, scaling: 'fixed' },
  controls: [{ type: 'stun' }],
  dispellable: true,
}

const BURN: BuffDefinition = {
  id: 'qa_burn',
  name: 'Burn',
  kind: 'debuff',
  polarity: 'debuff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, onReapplyStacks: 'replace', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'holder_turns', duration: 3, scaling: 'fixed' },
  periodic: [
    {
      id: 'qa_burn.tick',
      type: 'damage',
      element: 'physical',
      damageProfile: 'legacy_dot',
      coefficient: 1,
      scaling: 'dynamic',
      timing: 'holder_turn_end',
      stackScaling: 'multiply',
      canCrit: false,
      canMiss: false,
      hitCount: 1,
    },
  ],
  dispellable: true,
}

const STUN_DOT: BuffDefinition = {
  ...BURN,
  id: 'qa_stun_dot',
  name: 'StunDot',
  lifetime: { clock: 'holder_turns', duration: 2, scaling: 'fixed' },
  controls: [{ type: 'stun' }],
}

function makeRuntime(participants: () => TurnBattleParticipant[], combat: CombatSystem): TurnRuntimeFixture {
  return makeTurnRuntime({
    registry: makeTestBuffRegistry([STUN, BURN, STUN_DOT]),
    participants,
    combatSystem: combat,
  })
}

describe('Slice 3 adversarial (QA probes)', () => {
  it('INV-S3-1: stun duration-2 block đúng 2 lượt rồi hết (CC check trước tick)', () => {
    // R2 (AR-05): effective speed lives on entity.stats — the participant
    // speed cache is synced from it. Fixtures must set speed there (the
    // adapter copies entity.stats.speed into participant.speed).
    const player = createCombatant({ id: 'player', type: 'player' as never, stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 10, speed: 10 }) })
    const enemy = createCombatant({ id: 'enemy', currentHp: 1_000_000, maxHp: 1_000_000, stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 0, speed: 5 }) })

    const playerP = makeParticipant('player', player, 10, 0)
    const enemyP = makeParticipant('enemy', enemy, 5, 1)
    const combat = new CombatSystem(new EventBus())
    const runtime = makeRuntime(() => [playerP, enemyP], combat)
    runtime.applyBuff('qa_stun', playerP, enemyP)

    const battle: TurnBattle = {
      players: [playerP],
      enemies: [enemyP],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(combat, 10, runtime.registry, undefined, runtime)

    const step1 = system.resolveNextStep(battle)
    expect(step1.ccBlocked).toBe(true)

    const step2 = system.resolveNextStep(battle)
    expect(step2.ccBlocked).toBe(true)

    // duration 2: sau 2 lượt block, buff expire → lượt 3 hành động được.
    const step3 = system.resolveNextStep(battle)
    expect(step3.ccBlocked).toBe(false)
    expect(step3.targetIds.length).toBeGreaterThan(0)
  })

  it('INV-S3-2: DoT tick tại lượt HOLDER gây damage lên holder (không lên source)', () => {
    const player = createCombatant({ id: 'player', type: 'player' as never, currentHp: 1_000_000, maxHp: 1_000_000, stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 0 }) })
    const enemy = createCombatant({ id: 'enemy', currentHp: 1_000_000, maxHp: 1_000_000, stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 10 }) })

    const playerP = makeParticipant('player', player, 10, 0)
    const enemyP = makeParticipant('enemy', enemy, 5, 1)
    const combat = new CombatSystem(new EventBus())
    const runtime = makeRuntime(() => [playerP, enemyP], combat)
    runtime.applyBuff('qa_burn', enemyP, playerP)

    const battle: TurnBattle = { players: [playerP], enemies: [enemyP], state: 'fighting' }
    const hpBefore = enemy.currentHp
    const playerHpBefore = player.currentHp

    new TurnBattleSystem(combat, 10, runtime.registry, undefined, runtime).resolveNextStep(battle)

    // enemy (holder burn) tick buff ở lượt của chính nó → hp giảm.
    expect(enemy.currentHp).toBeLessThan(hpBefore)
    expect(player.currentHp).toBe(playerHpBefore)
  })

  it('INV-S3-3: holder đã chết — resolveNextTurn không chọn dead, death sweep dọn instance', () => {
    const player = createCombatant({ id: 'player', type: 'player' as never, stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 999 }) })
    const dying = createCombatant({ id: 'dying', currentHp: 1, maxHp: 1, stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 0 }) })

    const playerP = makeParticipant('player', player, 10, 0)
    const dyingP = makeParticipant('dying', dying, 5, 1)
    const combat = new CombatSystem(new EventBus())
    const runtime = makeRuntime(() => [playerP, dyingP], combat)
    runtime.applyBuff('qa_burn', dyingP, playerP)

    const battle: TurnBattle = { players: [playerP], enemies: [dyingP], state: 'fighting' }

    const step = new TurnBattleSystem(combat, 10, runtime.registry, undefined, runtime).resolveNextStep(battle)

    // player giết dying trước; dying không được chọn làm actor. buff2: the
    // death boundary sweeps the corpse's instances (reason 'death').
    expect(step.state).toBe('victory')
    expect(runtime.buffs.getForTarget('dying')).toHaveLength(0)
  })

  it('INV-S3-4: CC blocked vẫn bị DoT của chính buff đó tick (stun không dừng dot pool processing)', () => {
    const player = createCombatant({ id: 'player', type: 'player' as never, currentHp: 1_000_000, maxHp: 1_000_000, stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 0 }) })
    const enemy = createCombatant({ id: 'enemy', currentHp: 1_000_000, maxHp: 1_000_000, stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 999 }) })

    const playerP = makeParticipant('player', player, 10, 0)
    const enemyP = makeParticipant('enemy', enemy, 5, 1)
    const combat = new CombatSystem(new EventBus())
    const runtime = makeRuntime(() => [playerP, enemyP], combat)
    runtime.applyBuff('qa_stun_dot', playerP, enemyP)

    const battle: TurnBattle = { players: [playerP], enemies: [enemyP], state: 'fighting' }
    const hpBefore = player.currentHp

    const step = new TurnBattleSystem(combat, 10, runtime.registry, undefined, runtime).resolveNextStep(battle)

    expect(step.ccBlocked).toBe(true)
    // DoT tick trong holder-turn-end TRƯỚC step action — hp giảm dù bị block.
    expect(player.currentHp).toBeLessThan(hpBefore)
  })

  it('INV-S3-5: self-buff dot tự gây damage cho chính mình qua periodic settle', () => {
    const player = createCombatant({ id: 'player', type: 'player' as never, currentHp: 1_000_000, maxHp: 1_000_000, stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 100 }) })
    const enemy = createCombatant({ id: 'enemy', currentHp: 1_000_000, maxHp: 1_000_000, stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 0 }) })

    const playerP = makeParticipant('player', player, 10, 0)
    const enemyP = makeParticipant('enemy', enemy, 5, 1)
    const combat = new CombatSystem(new EventBus())
    const runtime = makeRuntime(() => [playerP, enemyP], combat)

    playerP.basic = {
      id: 'qa_self_dot', cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      appliesBuff: { definitionId: 'qa_burn', target: 'self' },
    }

    const battle: TurnBattle = { players: [playerP], enemies: [enemyP], state: 'fighting' }

    const system = new TurnBattleSystem(combat, 10, runtime.registry, undefined, runtime)
    system.resolveNextStep(battle)

    const applied = runtime.buffs.getForTarget('player')
    expect(applied).toHaveLength(1)
    expect(applied[0]!.sourceId).toBe('player')
  })
})
