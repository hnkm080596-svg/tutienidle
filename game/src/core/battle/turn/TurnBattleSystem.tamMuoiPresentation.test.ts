import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import { makeTurnRuntime, type TurnRuntimeFixture } from './testing/TurnRuntimeFixtures'
import { SKILLS } from '../../../data/skill/Skills'
import { toTurnSkillDefinition } from '../../skilldef/LegacySkillAdapter'
import { SkillManager } from '../../skill/SkillManager'
import { SkillSystem } from '../../skill/SkillSystem'
import { buildSkillCastPresentation } from './SkillPresentationFacts'

// Tam Muoi VFX wiring pins (2026-10-04) - empirical proof, not inference:
// - the real toTurnSkillDefinition carries the authored tam_muoi_aura preset
// - a self-buff declare produces disposition 'action' on slot 'special'
//   (execution.kind 'cast_time' is presentation-only; no charge lane engages)
// - declare stamps the caster's live buff ids so the hoa-cau presentation
//   can pick its empowered variant inside the Tam Muoi window.

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, maxMp: 500 })
  const entity = {
    id: 'id', name: 'name', type: 'enemy', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    currentWard: 0, turnsSinceLastHitLanded: Infinity, realmIndex: 0,
    x: 0, row: 2, alive: true,
    ...overrides,
  } as CombatEntity
  entity.baseStats = (overrides.baseStats ?? overrides.stats ?? entity.baseStats) as CombatEntity['baseStats']
  return entity
}

function makeParticipant(id: string, entity: CombatEntity): TurnBattleParticipant {
  return {
    id, entity, speed: 100, priority: 0, actionGauge: 0,
    alive: entity.alive, consecutiveHardCcTurns: 0,
    basic: {
      id: 'hoa_cau_thuat', cooldownTurns: 0,
      damage: { kind: 'elemental', components: [{ kind: 'element', element: 'fire', ratio: 1 }], multiplier: 1 },
      targeting: { shape: 'single' },
      presetId: 'hoa_cau_comet',
    },
  }
}

function tamMuoiDef() {
  const manager = new SkillManager()
  const skillSystem = new SkillSystem(manager)
  const skill = structuredClone(SKILLS.find((s) => s.id === 'tam_muoi_chan_hoa')!)
  manager.add(skill)
  const effective = skillSystem.getEffectiveSkill(skill)
  return toTurnSkillDefinition(skill, effective)
}

function fixture(withRuntime = true) {
  const caster = createCombatant({ id: 'player', type: 'player', row: 4 })
  const enemyEntity = createCombatant({ id: 'enemy' })
  const casterP = makeParticipant('player', caster)
  const enemyP = makeParticipant('enemy', enemyEntity)
  const battle: TurnBattle = { players: [casterP], enemies: [enemyP], state: 'fighting' }
  const combat = new CombatSystem(new EventBus())
  let runtime: TurnRuntimeFixture | undefined
  if (withRuntime) {
    runtime = makeTurnRuntime({
      registry: BUFF_REGISTRY,
      participants: () => [...battle.players, ...battle.enemies],
      combatSystem: combat,
    })
  }
  const system = new TurnBattleSystem(combat, 10, BUFF_REGISTRY, undefined, runtime)
  return { battle, casterP, runtime, system }
}

const REF = { sessionId: 1, requestId: 'skill-request-1', token: 'tok' }

describe('Tam Muoi cast presentation facts', () => {
  it('the authored special converts with the tam_muoi_aura preset', () => {
    expect(tamMuoiDef().presetId).toBe('tam_muoi_aura')
  })

  it('a tam_muoi_chan_hoa declare is an action cast on the special slot', () => {
    const { battle, casterP, system } = fixture()
    casterP.special = { skill: tamMuoiDef(), remainingCooldownTurns: 0 }

    const declared = system.declareActorAction(battle, casterP)
    const cast = buildSkillCastPresentation(REF, casterP, declared)

    expect(declared.skillId).toBe('tam_muoi_chan_hoa')
    expect(cast.disposition).toBe('action')
    expect(cast.slotRole).toBe('special')
    expect(cast.presetId).toBe('tam_muoi_aura')
    expect(cast.declaredTargets).toHaveLength(1)
    expect(cast.declaredTargets[0]!.entityId).toBe('player')
  })

  it('stamps the caster buff ids at declare and carries them to the cast fact', () => {
    const { battle, casterP, runtime, system } = fixture()
    runtime!.applyBuff('tam_muoi', casterP)
    casterP.special = { skill: tamMuoiDef(), remainingCooldownTurns: 0 }

    const declared = system.declareActorAction(battle, casterP)
    expect(declared.casterBuffIds).toContain('tam_muoi')

    const cast = buildSkillCastPresentation(REF, casterP, declared)
    expect(cast.casterBuffIds).toContain('tam_muoi')
  })

  it('a basic cast inside the window reports the window on its fact', () => {
    const { battle, casterP, runtime, system } = fixture()
    runtime!.applyBuff('tam_muoi', casterP)
    // No special slot -> selectAction commits the fire basic.
    const declared = system.declareActorAction(battle, casterP)
    const cast = buildSkillCastPresentation(REF, casterP, declared)

    expect(cast.resolvedSkillId).toBe('hoa_cau_thuat')
    expect(cast.presetId).toBe('hoa_cau_comet')
    expect(cast.casterBuffIds).toContain('tam_muoi')
  })

  it('an unwired battle reports no caster buffs (empty lane, no fault)', () => {
    const { battle, casterP, system } = fixture(false)
    const declared = system.declareActorAction(battle, casterP)
    expect(declared.casterBuffIds).toEqual([])
    const cast = buildSkillCastPresentation(REF, casterP, declared)
    expect(cast.casterBuffIds).toEqual([])
  })
})
