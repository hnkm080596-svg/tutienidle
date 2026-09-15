import { describe, expect, it } from 'vitest'
import {
  selectTarget,
  TurnBattleSystem,
  type TurnBattle,
  type TurnBattleParticipant,
} from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import { BuffPool } from '../../buff/BuffPool'
import { BuffSystem } from '../../buff/BuffSystem'
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import { KHIEM_KHICH_DEBUFF } from '../../../data/buff/TheTuBuffs'
import type { TurnSkillDefinition } from './TurnSkillAction'

// The Tu Reimagined (plan Task 10, D6/INV-11) — khiem_khich is a
// debuff on the ACTING entity; its sourceId is the taunter's entity id.
// selectTarget reads the ACTOR's own pool first: a living taunter in the
// opposing side is force-targeted; dead/missing falls through to
// positional. uniquePerTarget => newest application wins by
// construction. Scripted specialAttacks are exempt (positional target +
// their own multiplier preserved).

const NO_MITIGATION = {
  defense: 0,
  endurancePercent: 0,
  blockChance: 0,
  evasionRate: 0,
  dexterity: 0,
  criticalRate: 0,
} as const

function createCombatant(overrides: Partial<CombatEntity> = {}, speed = 10): CombatEntity {
  const stats = createBaseStats({ ...NO_MITIGATION, might: 100, speed })

  const entity = {
    id: 'id',
    name: 'name',
    type: 'enemy',
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
    baseStats: overrides.baseStats ?? overrides.stats ?? stats,
  } as CombatEntity

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

const BASIC_HIT: TurnSkillDefinition = {
  id: 'enemy_hit',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'single' },
}

function applyTaunt(target: TurnBattleParticipant, taunter: CombatEntity): void {
  new BuffSystem(target.buffs).apply(KHIEM_KHICH_DEBUFF, taunter, target.entity, BUFF_REGISTRY)
}

// Two player-side units: 'near' sits on the actor's row close by;
// 'taunter' sits far off-row — positional selection would always pick
// 'near', so any return of 'taunter' proves the forced re-aim.
// speed on the ENTITY stats — refreshParticipantStats rewrites
// participant.speed from entity.stats.speed every step.
function makeSides(actorSpeed = 10) {
  const taunter = createCombatant({ id: 'taunter', type: 'player', x: 0, row: 8 }, 1)
  const near = createCombatant({ id: 'near', type: 'player', x: 14, row: 2 }, 1)
  const actor = createCombatant({ id: 'actor', x: 15, row: 2 }, actorSpeed)

  const taunterP = makeParticipant('taunter', taunter, 10, 0)
  const nearP = makeParticipant('near', near, 10, 1)
  const actorP = makeParticipant('actor', actor, 10, 0)
  actorP.basic = BASIC_HIT

  return { taunter, taunterP, nearP, actor, actorP }
}

describe('khiem_khich Taunt (actor-pool read, newest-wins, scripted exempt)', () => {
  it('actor carrying khiem_khich force-targets the living taunter (own pool, not the tank\'s)', () => {
    const { taunterP, nearP, actorP } = makeSides()
    applyTaunt(actorP, taunterP.entity)

    expect(selectTarget(actorP, [taunterP, nearP])).toBe(taunterP)
  })

  it('no/expired taunt -> positional nearest', () => {
    const { taunterP, nearP, actorP } = makeSides()

    expect(selectTarget(actorP, [taunterP, nearP])).toBe(nearP)

    applyTaunt(actorP, taunterP.entity)
    actorP.buffs.removeAllById('khiem_khich')

    expect(selectTarget(actorP, [taunterP, nearP])).toBe(nearP)
  })

  it('sequential taunters -> newest source wins (uniquePerTarget)', () => {
    const { taunterP, nearP, actorP } = makeSides()
    const second = createCombatant({ id: 'taunter2', type: 'player', x: 1, row: 9 })
    const secondP = makeParticipant('taunter2', second, 10, 2)

    applyTaunt(actorP, taunterP.entity)
    applyTaunt(actorP, second)

    // uniquePerTarget removed the first instance entirely.
    expect(actorP.buffs.getAllById('khiem_khich')).toHaveLength(1)
    expect(selectTarget(actorP, [taunterP, secondP, nearP])).toBe(secondP)
  })

  it('dead taunter -> falls through to positional', () => {
    const { taunterP, nearP, actorP } = makeSides()
    applyTaunt(actorP, taunterP.entity)
    taunterP.entity.alive = false

    expect(selectTarget(actorP, [taunterP, nearP])).toBe(nearP)
  })

  it('ignoreTaunt opt-out keeps positional targeting', () => {
    const { taunterP, nearP, actorP } = makeSides()
    applyTaunt(actorP, taunterP.entity)

    expect(selectTarget(actorP, [taunterP, nearP], { ignoreTaunt: true })).toBe(nearP)
  })

  it('end-to-end: taunted enemy hits the taunter through resolveNextStep', () => {
    const { taunter, taunterP, nearP, actorP } = makeSides()
    const battle: TurnBattle = { players: [taunterP, nearP], enemies: [actorP], state: 'fighting' }
    applyTaunt(actorP, taunter)

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, BUFF_REGISTRY)
    const step = system.resolveNextStep(battle)

    expect(step.actorId).toBe('actor')
    expect(step.targetIds).toEqual(['taunter'])
  })

  it('scripted everyNth specialAttacks keep positional target AND their multiplier', () => {
    const { taunter, taunterP, nearP, actor, actorP } = makeSides()
    actor.specialAttacks = [{ presetId: 'slash', everyNth: 1, damageMultiplier: 3 }]
    const battle: TurnBattle = { players: [taunterP, nearP], enemies: [actorP], state: 'fighting' }
    applyTaunt(actorP, taunter)

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, BUFF_REGISTRY)
    const step = system.resolveNextStep(battle)

    expect(step.actorId).toBe('actor')
    // Positional pick (near), NOT the taunter.
    expect(step.targetIds).toEqual(['near'])
    // The scripted multiplier landed: might 100 x 3 = 300 raw.
    expect(10_000 - nearP.entity.currentHp).toBeGreaterThan(100)
  })

  it('AoE re-aims the primary to the taunter with the shape intact', () => {
    const { taunter, taunterP, nearP, actorP } = makeSides()
    // Cross radius 1 around the primary: taunter at (x0,row8) -> covers
    // rows 7-9 / col 0; 'near' at (x14,row2) is far outside. Positional
    // primary 'near' would cover (13-15, 1-3): taunter excluded. Re-aim
    // proves taunt moved the anchor.
    actorP.basic = {
      id: 'cross_hit',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'cross', laneRadius: 1 },
    }
    const battle: TurnBattle = { players: [taunterP, nearP], enemies: [actorP], state: 'fighting' }
    applyTaunt(actorP, taunter)

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, BUFF_REGISTRY)
    const step = system.resolveNextStep(battle)

    expect(step.targetIds).toContain('taunter')
    expect(step.targetIds).not.toContain('near')
  })

  it('bosses are tauntable by default', () => {
    const { taunterP, nearP, actor, actorP } = makeSides()
    actor.isBoss = true
    applyTaunt(actorP, taunterP.entity)

    expect(selectTarget(actorP, [taunterP, nearP])).toBe(taunterP)
  })
})
