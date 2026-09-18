import { describe, expect, it, vi } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import type { BuffDefinition } from '../../buff2/BuffDefinition'
import type { CombatEntity } from '../../combat/CombatEntity'
import type { TurnSkillDefinition } from './TurnSkillAction'
import { makeTestBuffRegistry, makeTurnRuntime, type TurnRuntimeFixture } from './testing/TurnRuntimeFixtures'

// AR-03 QA Probes:
// 1. Pure self-buff execution: targetScope: 'self', damage undefined.
//    Enemy takes 0 damage; actor receives buff; targetIds contains actor ID.
// 2. Leech healing: healPercentOfDamage on hit heals source entity via vitals.
// M4: instances live in the shared runtime store; applies ride apply_buff ops.

const DIA_TRU_BUFF: BuffDefinition = {
  id: 'dia_tru',
  name: 'Địa Trụ',
  kind: 'buff',
  polarity: 'buff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, onReapplyStacks: 'replace', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'holder_turns', duration: 3, scaling: 'fixed' },
  statModifiers: [{ stat: 'wardMax', flat: 100 }],
  dispellable: true,
}

const POISON_BUFF: BuffDefinition = {
  id: 'trung_doc',
  name: 'Trúng Độc',
  kind: 'ailment',
  element: 'wood',
  polarity: 'debuff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'holder_turns', duration: 3, scaling: 'ailment_scaled' },
  application: { resistance: 'ailment' },
  periodic: [
    {
      id: 'trung_doc.tick',
      type: 'damage',
      element: 'wood',
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

const ROOT_BUFF: BuffDefinition = {
  id: 'troi_chan',
  name: 'Trói Chân',
  kind: 'ailment',
  element: 'earth',
  polarity: 'debuff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, onReapplyStacks: 'replace', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'holder_turns', duration: 2, scaling: 'ailment_scaled' },
  application: { resistance: 'ailment' },
  controls: [{ type: 'root' }],
  dispellable: true,
}

const REGISTRY = makeTestBuffRegistry([DIA_TRU_BUFF, POISON_BUFF, ROOT_BUFF])

function makeEntity(id: string, overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ might: 100, ...overrides.stats })
  const entity = {
    id,
    name: id,
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: 1_000_000,
    maxHp: 1_000_000,
    currentMp: stats.maxMp,
    currentThe: 0,

    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  } as CombatEntity

  // ARCH-002 (M7 R1): refreshParticipantStats reconciles entity.maxHp from
  // entity.stats.maxHp and clamps currentHp — the fixture's declared vitals
  // ceiling must exist in the resolved/base stats or refresh reverts it.
  entity.baseStats = (overrides.baseStats ?? overrides.stats ?? entity.baseStats) as CombatEntity['baseStats']
  const ceiling = Math.max(entity.maxHp, entity.currentHp)
  if (entity.stats.maxHp !== ceiling) {
    entity.stats = { ...entity.stats, maxHp: ceiling }
    entity.baseStats = asBaseStats({ ...entity.baseStats, maxHp: ceiling })
  }
  return entity
}

function makeParticipant(id: string, entity: CombatEntity, priority: number): TurnBattleParticipant {
  return {
    id,
    entity,
    speed: entity.stats.speed,
    priority,
    actionGauge: 0,
    alive: entity.alive,

    consecutiveHardCcTurns: 0,
  }
}

function buffsOf(runtime: TurnRuntimeFixture, participant: TurnBattleParticipant, id: string) {
  return runtime.buffs
    .getForTarget(participant.entity.id)
    .filter((instance) => instance.definitionId === id)
}

function stacksOf(runtime: TurnRuntimeFixture, participant: TurnBattleParticipant, id: string) {
  return buffsOf(runtime, participant, id).reduce((total, instance) => total + instance.stacks, 0)
}

describe('AR-03: Self-buff execution and leech healing', () => {
  it('executes a pure self-buff skill without dealing damage to enemy', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)

    const player = makeEntity('player')
    const enemy = makeEntity('enemy', { currentHp: 10_000, maxHp: 10_000 })
    enemy.type = 'enemy'

    const playerP = makeParticipant('player', player, 0)
    const enemyP = makeParticipant('enemy', enemy, 1)
    const runtime = makeTurnRuntime({
      registry: REGISTRY,
      participants: () => [playerP, enemyP],
      combatSystem: combat,
    })
    const system = new TurnBattleSystem(combat, 10, REGISTRY, undefined, runtime)

    // Pure self buff skill
    const selfBuffSkill: TurnSkillDefinition = {
      id: 'dia_tru_thua_thien',
      cooldownTurns: 3,
      targetScope: 'self',
      targeting: { shape: 'single' },
      appliesBuff: { definitionId: 'dia_tru', target: 'self' },
    }

    playerP.basic = selfBuffSkill

    const battle: TurnBattle = {
      players: [playerP],
      enemies: [enemyP],
      state: 'fighting',
    }

    const damageEvents: Array<{ targetId: string }> = []
    eventBus.on<{ targetId: string }>('damage', (e) => damageEvents.push(e))

    const stepResult = system.resolveNextStep(battle)

    // 1. Enemy takes 0 damage and enemy HP is unchanged.
    expect(enemy.currentHp).toBe(10_000)
    expect(damageEvents).toHaveLength(0)

    // 2. Player receives the dia_tru buff.
    expect(buffsOf(runtime, playerP, 'dia_tru')).toHaveLength(1)

    // 3. Step result reflects actor as target.
    expect(stepResult.targetIds).toContain('player')
  })

  it('heals actor for healPercentOfDamage on landed hit', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)

    // Player with missing HP
    const player = makeEntity('player', { currentHp: 500, maxHp: 1000 })
    const enemy = makeEntity('enemy', { currentHp: 10_000, maxHp: 10_000 })
    enemy.type = 'enemy'

    const playerP = makeParticipant('player', player, 0)
    const enemyP = makeParticipant('enemy', enemy, 1)
    const runtime = makeTurnRuntime({
      registry: REGISTRY,
      participants: () => [playerP, enemyP],
      combatSystem: combat,
    })
    const system = new TurnBattleSystem(combat, 10, REGISTRY, undefined, runtime)

    // Wood ultimate style: deals damage + 40% leech
    const leechSkill: TurnSkillDefinition = {
      id: 'doc_vien_bao_can',
      cooldownTurns: 6,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      healPercentOfDamage: 0.4,
    }

    playerP.basic = leechSkill

    const battle: TurnBattle = {
      players: [playerP],
      enemies: [enemyP],
      state: 'fighting',
    }

    const hpBefore = player.currentHp

    // Pin the hit/crit dice (fd22f2b6 discipline): base stats carry 5%
    // criticalRate and rating-based hit chance, so an unpinned resolve can
    // miss or crit — this suite flaked as "expected 500 to be greater than
    // 500" when the attack missed and leech healed 0. 0.5 lands the hit
    // without a crit for the default rating spread.
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
    try {
      system.resolveNextStep(battle)
    } finally {
      randomSpy.mockRestore()
    }

    // Player should heal 40% of the damage dealt.
    expect(player.currentHp).toBeGreaterThan(hpBefore)
  })

  it('applies multiple ailments and multi-stack applications on landed hit', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)

    const player = makeEntity('player')
    const enemy = makeEntity('enemy', { currentHp: 10_000, maxHp: 10_000 })
    enemy.type = 'enemy'

    const playerP = makeParticipant('player', player, 0)
    const enemyP = makeParticipant('enemy', enemy, 1)
    const runtime = makeTurnRuntime({
      registry: REGISTRY,
      participants: () => [playerP, enemyP],
      combatSystem: combat,
    })
    const system = new TurnBattleSystem(combat, 10, REGISTRY, undefined, runtime)

    // Skill with 2 ailments: 1 root + 2 poison stacks
    const multiAilmentSkill: TurnSkillDefinition = {
      id: 'cau_mang_can_tri',
      cooldownTurns: 3,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      appliesAilments: [
        { buffDefinitionId: 'troi_chan', chance: 1 },
        { buffDefinitionId: 'trung_doc', chance: 1, stacks: 2 },
      ],
    }

    playerP.basic = multiAilmentSkill

    const battle: TurnBattle = {
      players: [playerP],
      enemies: [enemyP],
      state: 'fighting',
    }

    // Same dice-pinning discipline as the leech test above: unpinned the
    // hit can miss and the ailments never roll (observed as a load flake).
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
    try {
      system.resolveNextStep(battle)
    } finally {
      randomSpy.mockRestore()
    }

    // Enemy should have both buffs, with trung_doc having 2 stacks.
    expect(buffsOf(runtime, enemyP, 'troi_chan')).toHaveLength(1)
    expect(stacksOf(runtime, enemyP, 'trung_doc')).toBe(2)
  })
})
