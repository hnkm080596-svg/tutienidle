import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { TurnBuffPool } from './TurnBuffPool'
import { TurnBuffSystem } from './TurnBuffSystem'
import type { TurnSkillDefinition } from './TurnSkillAction'
import type { TurnBuffDefinition } from './TurnBuffTypes'

// Phase A3 (2026-09-07) — consume-for-damage skill effects (Pháp Tu
// Detonate / Thổ Tu ward burst), ported from legacy SkillEffect's
// consumesAilmentId/damagePerStack and consumesWardForDamage/
// damagePerWardPoint. Orchestration lives in TurnBattleSystem's
// per-target hit loop; stack state is read/cleared ONLY through
// TurnBuffSystem/TurnBuffPool's own API.

function createCombatant(id: string, overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0 }

  return {
    id,
    name: id,
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: 1_000_000,
    maxHp: 1_000_000,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    currentThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  } as CombatEntity
}

function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, buffs: new TurnBuffPool(), consecutiveHardCcTurns: 0 }
}

const REGISTRY = {
  get: (id: string): TurnBuffDefinition => {
    if (id === 'qa_dot') {
      return { id, name: 'QA Dot', polarity: 'debuff', duration: 5, maxStacks: 5, stackMode: 'stack', effects: [{ type: 'dot', dpsRatio: 0.1, element: 'fire' }] }
    }
    throw new Error(`unknown fixture buff id: ${id}`)
  },
}

const BASIC: TurnSkillDefinition = {
  id: 'qa_basic',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 0 },
  targeting: { shape: 'single' },
}

// Base damage 0 so any HP change is attributable to the consume bonus.
const DETONATE: TurnSkillDefinition = {
  id: 'qa_detonate',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 0 },
  targeting: { shape: 'single' },
  consumesAilmentId: 'qa_dot',
  damagePerStack: 50,
}

const WARD_BURST: TurnSkillDefinition = {
  id: 'qa_ward_burst',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 0 },
  targeting: { shape: 'single' },
  consumesWardForDamage: true,
  damagePerWardPoint: 5,
}

function battleWith(actorSkill: TurnSkillDefinition, seedTarget: (p: TurnBattleParticipant) => void) {
  const player = createCombatant('player')
  const enemyEntity = createCombatant('enemy')
  enemyEntity.type = 'enemy'

  const playerParticipant = makeParticipant('player', player, 100, 0)
  playerParticipant.basic = BASIC
  playerParticipant.special = { skill: actorSkill, remainingCooldownTurns: 0 }

  const enemyParticipant = makeParticipant('enemy', enemyEntity, 1, 1)
  enemyParticipant.basic = BASIC

  seedTarget(enemyParticipant)

  const battle: TurnBattle = {
    players: [playerParticipant],
    enemies: [enemyParticipant],
    state: 'fighting',
  }

  const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 100, {
    get: (id: string) => REGISTRY.get(id),
  })

  return { battle, playerParticipant, enemyParticipant, system }
}

describe('consume-for-damage skill effects (Phase A3)', () => {
  it('consumesAilmentId: applies stacks × damagePerStack as true damage, then clears the ailment', () => {
    const { battle, enemyParticipant, system } = battleWith(DETONATE, (target) => {
      const buffs = new TurnBuffSystem(target.buffs)
      const source = createCombatant('player')
      // 3 stacks of the ailment on the target.
      buffs.apply(REGISTRY.get('qa_dot'), source, target.entity, REGISTRY)
      buffs.apply(REGISTRY.get('qa_dot'), source, target.entity, REGISTRY)
      buffs.apply(REGISTRY.get('qa_dot'), source, target.entity, REGISTRY)
    })

    const hpBefore = enemyParticipant.entity.currentHp

    system.resolveNextStep(battle)

    // Base damage 0 — the entire drop is 3 stacks × 50 = 150 true damage.
    // resolveActionHit floors base damage at 1 even with multiplier 0, so the total drop is 150 bonus + 1 base.
    expect(hpBefore - enemyParticipant.entity.currentHp).toBe(151)
    // The ailment is fully cleared afterward.
    expect(enemyParticipant.buffs.getAllById('qa_dot')).toHaveLength(0)
  })

  it('consumesWardForDamage: applies currentWard × damagePerWardPoint as true damage, then zeroes ward', () => {
    const { battle, playerParticipant, enemyParticipant, system } = battleWith(WARD_BURST, () => {})

    playerParticipant.entity.currentWard = 20

    const hpBefore = enemyParticipant.entity.currentHp

    system.resolveNextStep(battle)

    // Base damage 0 — the entire drop is 20 ward × 5 = 100 true damage.
    // Same engine floor: 100 bonus + 1 base.
    expect(hpBefore - enemyParticipant.entity.currentHp).toBe(101)
    // The source's ward is fully consumed.
    expect(playerParticipant.entity.currentWard).toBe(0)
  })
})
