import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import type { EntityVitalsChangedEvent } from '../../combat/EntityVitalsSystem'
import { SurviveLethalGuard } from '../../talent/SurviveLethalGuard'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import { BuffPool } from '../../buff/BuffPool'
import { BuffSystem } from '../../buff/BuffSystem'
import type { TurnSkillDefinition } from './TurnSkillAction'
import type { BuffDefinition } from '../../buff/BuffTypes'

// Phase A3 (2026-09-07) — consume-for-damage skill effects (Pháp Tu
// Detonate / Thổ Tu ward burst), ported from legacy SkillEffect's
// consumesAilmentId/damagePerStack and consumesWardForDamage/
// damagePerWardPoint. Orchestration lives in TurnBattleSystem's
// per-target hit loop; stack state is read/cleared ONLY through
// BuffSystem/BuffPool's own API.

function createCombatant(id: string, overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0 })

  const entity = {
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

function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, buffs: new BuffPool(), consecutiveHardCcTurns: 0 }
}

const REGISTRY = {
  get: (id: string): BuffDefinition => {
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

  const eventBus = new EventBus()
  const system = new TurnBattleSystem(new CombatSystem(eventBus), 100, {
    get: (id: string) => REGISTRY.get(id),
  })

  return { battle, playerParticipant, enemyParticipant, system, eventBus }
}

describe('consume-for-damage skill effects (Phase A3)', () => {
  it('consumesAilmentId: applies stacks × damagePerStack as true damage, then clears the ailment', () => {
    const { battle, enemyParticipant, system } = battleWith(DETONATE, (target) => {
      const buffs = new BuffSystem(target.buffs)
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

  // R1 (AR-01) — consumption bonus damage must go through the authoritative
  // damage path: completion (death), survive-lethal intervention, vitals
  // events and exactly-once death are part of the outcome contract.
  describe('R1 authoritative damage/vitals closure (AR-01)', () => {
    function collectDeaths(eventBus: EventBus) {
      const deaths: string[] = []
      eventBus.on<{ targetId: string }>('death', (event) => deaths.push(event.targetId))
      return deaths
    }

    function collectVitals(eventBus: EventBus) {
      const vitals: EntityVitalsChangedEvent[] = []
      eventBus.on<EntityVitalsChangedEvent>('entity_vitals_changed', (event) => vitals.push(event))
      return vitals
    }

    it('lethal ward-consumption bonus completes death: alive becomes false and exactly one death event fires', () => {
      const { battle, playerParticipant, enemyParticipant, system, eventBus } = battleWith(WARD_BURST, () => {})

      // One ward point × 5 damage/point leaves the enemy at exactly 0 HP.
      playerParticipant.entity.currentWard = 20
      enemyParticipant.entity.currentHp = 21
      enemyParticipant.entity.maxHp = 1_000_000

      const deaths = collectDeaths(eventBus)

      system.resolveNextStep(battle)

      expect(enemyParticipant.entity.currentHp).toBe(0)
      expect(enemyParticipant.entity.alive).toBe(false)
      expect(deaths).toEqual(['enemy'])
      // The kill consumed the battle: victory, not a fight against a corpse.
      expect(battle.state).toBe('victory')
    })

    it('lethal ailment-consumption bonus completes death through the same authority', () => {
      const { battle, enemyParticipant, system, eventBus } = battleWith(DETONATE, (target) => {
        const buffs = new BuffSystem(target.buffs)
        const source = createCombatant('player')
        buffs.apply(REGISTRY.get('qa_dot'), source, target.entity, REGISTRY)
        buffs.apply(REGISTRY.get('qa_dot'), source, target.entity, REGISTRY)
        buffs.apply(REGISTRY.get('qa_dot'), source, target.entity, REGISTRY)
      })

      // 3 stacks × 50 = 150 bonus damage against 101 remaining HP.
      enemyParticipant.entity.currentHp = 101
      enemyParticipant.entity.maxHp = 1_000_000

      const deaths = collectDeaths(eventBus)

      system.resolveNextStep(battle)

      expect(enemyParticipant.entity.currentHp).toBe(0)
      expect(enemyParticipant.entity.alive).toBe(false)
      expect(deaths).toEqual(['enemy'])
      expect(battle.state).toBe('victory')
    })

    it('survive-lethal guard intercepts lethal consumption bonus: HP 1, alive stays true', () => {
      const { battle, playerParticipant, enemyParticipant, system } = battleWith(WARD_BURST, () => {})

      playerParticipant.entity.currentWard = 20
      enemyParticipant.entity.currentHp = 21
      enemyParticipant.entity.maxHp = 1_000_000

      // Survive-lethal session protects the ENEMY entity in this fixture
      // (production wires the player; the invariant under test is the
      // authority path, identity-agnostic). 'bat_tu_the' is the authored
      // survive-lethal talent source.
      const guard = new SurviveLethalGuard()
      guard.beginBattle(['bat_tu_the'])
      system.setSurviveLethalSessionForTest({ playerEntityId: 'enemy', guard })

      system.resolveNextStep(battle)

      expect(enemyParticipant.entity.currentHp).toBe(1)
      expect(enemyParticipant.entity.alive).toBe(true)
    })

    it('ward consumption emits a vitals event for the ward spend (observation parity with authority paths)', () => {
      const { battle, playerParticipant, enemyParticipant, system, eventBus } = battleWith(WARD_BURST, () => {})

      playerParticipant.entity.currentWard = 20

      const vitals = collectVitals(eventBus)

      system.resolveNextStep(battle)

      const spendEvents = vitals.filter(
        (event) => event.entityId === 'player' && event.reason === 'ward_spend',
      )

      expect(spendEvents).toHaveLength(1)
      expect(spendEvents[0]!.wardBefore).toBe(20)
      expect(spendEvents[0]!.wardAfter).toBe(0)
      expect(enemyParticipant.entity.currentHp).toBeLessThan(1_000_000)
    })
  })
})
