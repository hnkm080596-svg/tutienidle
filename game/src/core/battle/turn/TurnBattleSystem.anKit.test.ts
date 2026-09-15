import { describe, expect, it, vi } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { BuffPool } from '../../buff/BuffPool'
import type { TurnSkillDefinition } from './TurnSkillAction'

// Phap Tu Reimagined Task 11 (plan Task 10) — the Phap Tu An kit:
// van_phap_tuy_tam (basic) composite-picks uniformly among the element
// basics and resolves AS the pick; da_phap_lien_tuyen (special) repeats
// the pick exactly X times via follow-up executions; ngo_dao_hon_don
// (dao passive) attaches `multicast` to the basic so each basic cast may
// chain extra executions up to the cap. ALL randomness flows through the
// injected rng; cast identity always stays on the root skill (INV-18/20).

function createCombatant(id: string, overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0 })

  return {
    id,
    name: id,
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: 1_000_000,
    maxHp: 1_000_000,
    currentMp: stats.maxMp,
    currentMomentum: 0,
    currentThe: 0,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  } as CombatEntity
}

function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, buffs: new BuffPool(), consecutiveHardCcTurns: 0 }
}

/** Five distinct element-basic payloads — ids/damage identify the pick. */
const ELEMENT_POOL: readonly TurnSkillDefinition[] = ['fire', 'water', 'wood', 'metal', 'earth'].map(
  (element, index) => ({
    id: `${element}_basic`,
    cooldownTurns: 0,
    damage: {
      kind: 'elemental',
      components: [{ kind: 'element', element: element as 'fire', ratio: 1 }],
      multiplier: index + 1,
    },
    targeting: { shape: 'single' },
  }),
)

const AN_BASIC: TurnSkillDefinition = {
  id: 'van_phap_tuy_tam',
  cooldownTurns: 0,
  damage: { kind: 'primordial', multiplier: 1 },
  targeting: { shape: 'single' },
  compositePicks: { poolType: 'element_basic', count: 1, pool: ELEMENT_POOL },
}

const AN_SPECIAL: TurnSkillDefinition = {
  id: 'da_phap_lien_tuyen',
  cooldownTurns: 4,
  targeting: { shape: 'single' },
  compositePicks: { poolType: 'element_basic', count: 1, pool: ELEMENT_POOL },
  repeatCasts: 2,
}

const ENEMY_BASIC: TurnSkillDefinition = {
  id: 'enemy_basic',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 0 },
  targeting: { shape: 'single' },
}

/** Scripted rng — draws consumed in call order. */
function scriptedRng(...values: number[]): () => number {
  let index = 0

  return () => values[Math.min(index++, values.length - 1)]!
}

function harness(rng: () => number = () => 0.5) {
  const player = createCombatant('player')
  const enemyEntity = createCombatant('enemy')
  // Multi-hit chains (repeat + multicast) accumulate real damage — the
  // enemy needs a huge STAT maxHp (refreshParticipantStats clamps
  // entity.maxHp/currentHp to stats.maxHp) to survive the whole storm.
  enemyEntity.baseStats = { ...enemyEntity.baseStats, maxHp: 1_000_000_000 }
  enemyEntity.stats = { ...enemyEntity.stats, maxHp: 1_000_000_000 }
  enemyEntity.currentHp = 1_000_000_000
  enemyEntity.maxHp = 1_000_000_000
  enemyEntity.type = 'enemy'

  const playerParticipant = makeParticipant('player', player, 100, 0)
  const enemyParticipant = makeParticipant('enemy', enemyEntity, 1, 1)
  enemyParticipant.basic = ENEMY_BASIC

  const battle: TurnBattle = {
    players: [playerParticipant],
    enemies: [enemyParticipant],
    state: 'fighting',
  }

  const onSkillCast = vi.fn()
  const system = new TurnBattleSystem(
    new CombatSystem(new EventBus()),
    100,
    undefined,
    undefined,
    undefined,
    onSkillCast,
    undefined,
    rng,
  )

  return { battle, playerParticipant, enemyParticipant, system, onSkillCast }
}

describe('An kit — composite element pick (van_phap_tuy_tam)', () => {
  it('resolves AS the picked element basic — deterministic via injected rng', () => {
    const { battle, playerParticipant, enemyParticipant, system } = harness(scriptedRng(0.4))
    playerParticipant.basic = AN_BASIC

    const result = system.resolveNextStep(battle)

    // rng 0.4 * 5 = index 2 -> wood_basic
    expect(result.execution?.source).toBe('composite')
    expect(result.execution?.rootSkillId).toBe('van_phap_tuy_tam')
    expect(result.execution?.resolvedSkill?.id).toBe('wood_basic')
    expect(result.skillId).toBe('van_phap_tuy_tam')

    // The picked payload dealt its own damage (wood multiplier 3).
    expect(enemyParticipant.entity.currentHp).toBeLessThan(1_000_000_000)
  })

  it('the picked element id never enters the cast sink — only the root id', () => {
    const { battle, playerParticipant, onSkillCast, system } = harness(scriptedRng(0.9))
    playerParticipant.basic = AN_BASIC

    system.resolveNextStep(battle)

    expect(onSkillCast).toHaveBeenCalledTimes(1)
    expect(onSkillCast).toHaveBeenCalledWith(playerParticipant, 'van_phap_tuy_tam')
    expect(onSkillCast).not.toHaveBeenCalledWith(playerParticipant, 'earth_basic')
  })
})

describe('An kit — repeat casts (da_phap_lien_tuyen)', () => {
  it('fires exactly 3 executions: 1 original + 2 repeats, each re-rolling the pick', () => {
    // Pick draws: original 0.0 (fire), repeat1 0.4 (wood), repeat2 0.7 (metal)
    const { battle, playerParticipant, system, onSkillCast } = harness(scriptedRng(0, 0.4, 0.7, 0.5))
    playerParticipant.basic = ELEMENT_POOL[0]
    playerParticipant.special = { skill: AN_SPECIAL, remainingCooldownTurns: 0 }

    const steps: string[] = []
    const sources: (string | undefined)[] = []

    for (let i = 0; i < 3; i++) {
      const step = system.resolveNextStep(battle)
      if (step.actorId !== 'player') break
      steps.push(step.execution?.resolvedSkill?.id ?? step.skillId)
      sources.push(step.execution?.source)
    }

    expect(steps).toEqual(['fire_basic', 'wood_basic', 'metal_basic'])
    expect(sources).toEqual(['composite', 'repeat', 'repeat'])

    // Cast identity: one commit under the root id, slot cooldown consumed once.
    expect(onSkillCast).toHaveBeenCalledTimes(1)
    expect(onSkillCast).toHaveBeenCalledWith(playerParticipant, 'da_phap_lien_tuyen')
    expect(playerParticipant.special!.remainingCooldownTurns).toBe(4)
  })

  it('repeat executions never roll multicast (P15) — only the original cast chains', () => {
    // Authored with BOTH fields: the original composite cast rolls the
    // full multicast chain (3 extras at chance:1), while each repeat fire
    // must roll NOTHING — if repeats could roll, each would add its own
    // 3-deep chain and the multiset below would grow.
    const special: TurnSkillDefinition = {
      ...AN_SPECIAL,
      multicast: { chance: 1, maxExtraCasts: 3 },
    }
    const { battle, playerParticipant, system } = harness(scriptedRng(0.5))
    playerParticipant.basic = ELEMENT_POOL[0]
    playerParticipant.special = { skill: special, remainingCooldownTurns: 0 }

    const sources: (string | undefined)[] = []
    for (let i = 0; i < 6; i++) {
      const step = system.resolveNextStep(battle)
      if (step.actorId !== 'player') break
      sources.push(step.execution?.source)
    }

    // 1 original + 2 repeats + exactly 3 multicast extras (depth cap) —
    // repeats contributed zero rolls.
    expect(sources).toEqual([
      'composite',
      'repeat',
      'repeat',
      'multicast',
      'multicast',
      'multicast',
    ])
  })
})

describe('An kit — multicast (ngo_dao_hon_don)', () => {
  it('chance:1 chains to the depth cap — 1 original + MAX_MULTICAST extra executions', () => {
    const basic: TurnSkillDefinition = {
      ...AN_BASIC,
      multicast: { chance: 1, maxExtraCasts: 3 },
    }
    const { battle, playerParticipant, onSkillCast, system } = harness(scriptedRng(0.2))
    playerParticipant.basic = basic

    const sources: (string | undefined)[] = []
    for (let i = 0; i < 4; i++) {
      const step = system.resolveNextStep(battle)
      if (step.actorId !== 'player') break
      sources.push(step.execution?.source)
    }

    expect(sources).toEqual(['composite', 'multicast', 'multicast', 'multicast'])
    expect(onSkillCast).toHaveBeenCalledTimes(1)
  })

  it('chance:0 never enqueues a multicast execution', () => {
    const basic: TurnSkillDefinition = {
      ...AN_BASIC,
      multicast: { chance: 0, maxExtraCasts: 3 },
    }
    const { battle, playerParticipant, system } = harness(scriptedRng(0.5))
    playerParticipant.basic = basic

    const sources: (string | undefined)[] = []
    for (let i = 0; i < 4; i++) {
      const step = system.resolveNextStep(battle)
      if (step.actorId !== 'player') break
      sources.push(step.execution?.source)
    }

    // Player keeps taking normal casts (speed 100 vs enemy 1) — the
    // assertion is that NONE of them spawn a multicast-sourced step.
    expect(sources).not.toContain('multicast')
    expect(sources.every((source) => source === 'composite')).toBe(true)
  })

  it('a miss below chance rolls again on each multicast until it fails', () => {
    // chance 0.5 — rolls: 0.4 hit, 0.4 hit, 0.9 miss -> 2 extra executions.
    const basic: TurnSkillDefinition = {
      ...AN_BASIC,
      multicast: { chance: 0.5, maxExtraCasts: 3 },
    }
    // draw order per execution: composite pick, then multicast roll
    const { battle, playerParticipant, system } = harness(scriptedRng(0.1, 0.4, 0.1, 0.4, 0.1, 0.9))
    playerParticipant.basic = basic

    const sources: (string | undefined)[] = []
    for (let i = 0; i < 6; i++) {
      const step = system.resolveNextStep(battle)
      if (step.actorId !== 'player') break
      sources.push(step.execution?.source)
    }

    expect(sources).toEqual(['composite', 'multicast', 'multicast'])
  })

  it('multicast executions are bypass turns — the actor gauge is untouched', () => {
    const basic: TurnSkillDefinition = {
      ...AN_BASIC,
      multicast: { chance: 1, maxExtraCasts: 3 },
    }
    const { battle, playerParticipant, system } = harness(scriptedRng(0.2))
    playerParticipant.basic = basic

    system.resolveNextStep(battle) // original cast
    const gaugeAfterCast = playerParticipant.actionGauge

    system.resolveNextStep(battle) // first multicast follow-up

    expect(playerParticipant.actionGauge).toBe(gaugeAfterCast)
  })
})
