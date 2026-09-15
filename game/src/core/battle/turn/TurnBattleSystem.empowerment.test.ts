import { describe, expect, it, vi } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { BuffPool } from '../../buff/BuffPool'
import type { TurnSkillDefinition } from './TurnSkillAction'

// Phap Tu Reimagined Task 10 — ultimate empowerment: the equipped
// chain-E ultimate carries `empowerment`; at cast time, when the actor's
// The pool meets theThreshold, the RESOLVED payload swaps to the
// empowered form while rootSkillId stays the equipped skill (INV-18).
// The empowered form's `consumesAllThe` burns the ENTIRE pool after
// capture (theBurned feeds theScaling in Task 13).

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

const GOD_ULT_PAYLOAD: TurnSkillDefinition = {
  id: 'tat_phuong_giang_the',
  cooldownTurns: 0,
  consumesAllThe: true,
  damage: { kind: 'elemental', components: [{ kind: 'element', element: 'fire', ratio: 1 }], multiplier: 5 },
  targeting: { shape: 'single' },
}

const CHAIN_E_ULT: TurnSkillDefinition = {
  id: 'hoa_ha_cuu_thien',
  cooldownTurns: 3,
  damage: { kind: 'elemental', components: [{ kind: 'element', element: 'fire', ratio: 1 }], multiplier: 2 },
  targeting: { shape: 'single' },
  empowerment: { theThreshold: 100, empowered: GOD_ULT_PAYLOAD },
}

const BASIC: TurnSkillDefinition = {
  id: 'qa_basic',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'single' },
}

function harness(thePool = 0, maxThe?: number) {
  const player = createCombatant('player', { currentThe: thePool, maxThe })
  const enemyEntity = createCombatant('enemy')
  enemyEntity.type = 'enemy'

  const playerParticipant = makeParticipant('player', player, 100, 0)
  playerParticipant.basic = BASIC

  const enemyParticipant = makeParticipant('enemy', enemyEntity, 1, 1)
  enemyParticipant.basic = BASIC

  const battle: TurnBattle = {
    players: [playerParticipant],
    enemies: [enemyParticipant],
    state: 'fighting',
  }

  const onSkillCast = vi.fn()
  const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 100, undefined, undefined, undefined, onSkillCast)

  return { battle, playerParticipant, enemyParticipant, system, onSkillCast }
}

describe('Ultimate empowerment (Task 10)', () => {
  it('below the threshold the base form resolves and The is untouched', () => {
    const { battle, playerParticipant, system } = harness(50)
    playerParticipant.ultimate = { skill: CHAIN_E_ULT, remainingCooldownTurns: 0 }

    const result = system.resolveNextStep(battle)

    expect(result.execution?.source).toBe('original')
    expect(result.execution?.resolvedSkill?.id).toBe('hoa_ha_cuu_thien')
    expect(playerParticipant.entity.currentThe).toBe(50)
  })

  it('at the threshold WITHOUT empowerment the base form resolves and The is untouched', () => {
    const plain: TurnSkillDefinition = { ...CHAIN_E_ULT, empowerment: undefined }
    const { battle, playerParticipant, system } = harness(100)
    playerParticipant.ultimate = { skill: plain, remainingCooldownTurns: 0 }

    const result = system.resolveNextStep(battle)

    expect(result.execution?.source).toBe('original')
    expect(result.execution?.resolvedSkill?.id).toBe('hoa_ha_cuu_thien')
    expect(playerParticipant.entity.currentThe).toBe(100)
  })

  it('at the threshold the empowered payload resolves and consumes ALL The', () => {
    const { battle, playerParticipant, enemyParticipant, system } = harness(100)
    playerParticipant.ultimate = { skill: CHAIN_E_ULT, remainingCooldownTurns: 0 }

    const result = system.resolveNextStep(battle)

    expect(result.execution?.source).toBe('empowered')
    expect(result.execution?.rootSkillId).toBe('hoa_ha_cuu_thien')
    expect(result.execution?.resolvedSkill?.id).toBe('tat_phuong_giang_the')
    expect(result.execution?.theBurned).toBe(100)
    expect(playerParticipant.entity.currentThe).toBe(0)

    // The empowered payload dealt its own damage (multiplier 5 vs base 2).
    expect(enemyParticipant.entity.currentHp).toBeLessThan(1_000_000)
  })

  it('a raised cap burns the WHOLE pool (150), not just the threshold', () => {
    const { battle, playerParticipant, system } = harness(150, 150)
    playerParticipant.ultimate = { skill: CHAIN_E_ULT, remainingCooldownTurns: 0 }

    system.resolveNextStep(battle)

    expect(playerParticipant.entity.currentThe).toBe(0)
  })

  it('INV-18 — cast identity stays on the equipped root: cooldown once, cast sink under rootSkillId only', () => {
    const { battle, playerParticipant, onSkillCast, system } = harness(100)
    playerParticipant.ultimate = { skill: CHAIN_E_ULT, remainingCooldownTurns: 0 }

    system.resolveNextStep(battle)

    // Slot cooldown consumed exactly once, on the equipped skill.
    expect(playerParticipant.ultimate!.remainingCooldownTurns).toBe(3)

    // The cast sink reports ONLY the root id — the god-ult payload id
    // must never appear (no cast count, no progression identity).
    expect(onSkillCast).toHaveBeenCalledTimes(1)
    expect(onSkillCast).toHaveBeenCalledWith(playerParticipant, 'hoa_ha_cuu_thien')
    expect(onSkillCast).not.toHaveBeenCalledWith(playerParticipant, 'tat_phuong_giang_the')
  })
})
