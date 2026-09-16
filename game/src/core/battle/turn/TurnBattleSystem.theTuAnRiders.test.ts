import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  TurnBattleSystem,
  type TurnBattle,
  type TurnBattleParticipant,
  type TurnDeclaredAction,
} from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import { BuffPool } from '../../buff/BuffPool'
import { BuffSystem } from '../../buff/BuffSystem'
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import { HO_MON_MARKER, TRO_MON_MARKER } from '../../../data/buff/TheTuBuffs'
import { TRO_KICH } from '../../../data/skill/TheTuSkills'
import type { TurnSkillDefinition } from './TurnSkillAction'

// The Tu Reimagined (plan Task 20, spec 8.2) — node-rider mechanics on
// the *_mon marker clones: intercept->ally ward, Tro triggering-ally
// heal, Tro non-damaging window. The riders are baked onto marker
// clones at participant build; these tests apply hand-baked clones to
// exercise the engine read sites.

const NO_MITIGATION = {
  evasionRate: 0,
  dexterity: 0,
  criticalRate: 0,
  defense: 0,
  endurancePercent: 0,
  blockChance: 0,
  finalDamageReductionPercent: 0,
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

const ENEMY_BASIC: TurnSkillDefinition = {
  id: 'enemy_hit',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'single' },
}

/** A non-damaging ally action (buff self) for the non-damaging Tro window. */
const ALLY_SELF_BUFF: TurnSkillDefinition = {
  id: 'ally_buff',
  cooldownTurns: 0,
  targetScope: 'self',
  targeting: { shape: 'single' },
}

function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, buffs: new BuffPool(), consecutiveHardCcTurns: 0 }
}

/** Apply a marker clone with hand-baked rider fields. */
function applyMarker(
  p: TurnBattleParticipant,
  base: typeof HO_MON_MARKER | typeof TRO_MON_MARKER,
  bake: (marker: typeof base) => void,
): void {
  const clone = structuredClone(base)
  bake(clone)
  new BuffSystem(p.buffs).apply(clone, p.entity, p.entity, BUFF_REGISTRY)
}

function declaredEnemyAction(fixture: {
  battle: TurnBattle
  enemyP: TurnBattleParticipant
}, affected: TurnBattleParticipant[]): TurnDeclaredAction {
  return {
    actorId: fixture.enemyP.id,
    skillId: ENEMY_BASIC.id,
    ccBlocked: false,
    isCharging: false,
    chargeResolved: false,
    chargeTargetIds: [],
    chargedSkill: null,
    action: {
      skillId: ENEMY_BASIC.id,
      skill: ENEMY_BASIC,
      damage: ENEMY_BASIC.damage,
      targeting: ENEMY_BASIC.targeting,
      slot: null,
    },
    opposingSide: fixture.battle.players,
    affected,
    scaledDamage: ENEMY_BASIC.damage ?? null,
    suddenDeathMultiplier: 1,
    compositePickedSkills: null,
    isFollowUpBypass: false,
    actionSource: 'normal',
  }
}

function declaredAllyAction(
  actor: TurnBattleParticipant,
  skill: TurnSkillDefinition,
  opposing: TurnBattleParticipant[],
  affected: TurnBattleParticipant[],
): TurnDeclaredAction {
  return {
    actorId: actor.id,
    skillId: skill.id,
    ccBlocked: false,
    isCharging: false,
    chargeResolved: false,
    chargeTargetIds: [],
    chargedSkill: null,
    action: { skillId: skill.id, skill, damage: skill.damage, targeting: skill.targeting, slot: null },
    opposingSide: opposing,
    affected,
    scaledDamage: skill.damage ?? null,
    suddenDeathMultiplier: 1,
    compositePickedSkills: null,
    isFollowUpBypass: false,
    actionSource: 'normal',
  }
}

function system(): TurnBattleSystem {
  return new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, BUFF_REGISTRY)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('intercept -> ally ward rider (spec 8.2)', () => {
  function fixture() {
    const enemy = createCombatant({ id: 'enemy', type: 'enemy', currentHp: 100_000, maxHp: 100_000, x: 0, row: 0 }, 10)
    const squishy = createCombatant({ id: 'squishy', type: 'player', currentHp: 100_000, maxHp: 100_000, x: 0, row: 2 }, 5)
    const protector = createCombatant({ id: 'protector', type: 'player', currentHp: 50_000, maxHp: 50_000, x: 5, row: 2 }, 5)

    const enemyP = makeParticipant('enemy', enemy, 10, 100)
    enemyP.basic = ENEMY_BASIC
    const squishyP = makeParticipant('squishy', squishy, 5, 0)
    const protectorP = makeParticipant('protector', protector, 5, 1)

    const battle: TurnBattle = { players: [squishyP, protectorP], enemies: [enemyP], state: 'fighting' }
    return { battle, enemyP, squishyP, protectorP }
  }

  it('a successful intercept grants the rescued ally an externalWard + the ho_ve marker', () => {
    const f = fixture()
    f.protectorP.entity.baseStats = asBaseStats({ ...f.protectorP.entity.baseStats, protectChance: 1 })
    f.protectorP.entity.stats = { ...f.protectorP.entity.stats, protectChance: 1 }
    f.protectorP.entity.currentThe = 15
    applyMarker(f.protectorP, HO_MON_MARKER, (marker) => {
      for (const effect of marker.effects) {
        if (effect.type === 'reactiveProc') {
          effect.grantsWardToOriginalTarget = { buffDefinitionId: 'ho_ve', sourceMaxHpRatio: 0.15 }
        }
      }
    })
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const declared = declaredEnemyAction(f, [f.squishyP])
    system().applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBe(true)
    // Ward = 15% x protector's 50k maxHp, sourced by the protector.
    expect(f.squishyP.entity.externalWard).toEqual({ sourceId: 'protector', amount: 7500 })
    expect(f.squishyP.buffs.hasAny('ho_ve')).toBe(true)
    // The protector still took the hit (squishy untouched HP-wise).
    expect(f.squishyP.entity.currentHp).toBe(100_000)
  })

  it('the intercept-granted ward survives reconcile — marker sourceId keys to the protector', () => {
    const f = fixture()
    f.protectorP.entity.baseStats = asBaseStats({ ...f.protectorP.entity.baseStats, protectChance: 1 })
    f.protectorP.entity.stats = { ...f.protectorP.entity.stats, protectChance: 1 }
    f.protectorP.entity.currentThe = 15
    applyMarker(f.protectorP, HO_MON_MARKER, (marker) => {
      for (const effect of marker.effects) {
        if (effect.type === 'reactiveProc') {
          effect.grantsWardToOriginalTarget = { buffDefinitionId: 'ho_ve', sourceMaxHpRatio: 0.15 }
        }
      }
    })
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const declared = declaredEnemyAction(f, [f.squishyP])
    system().applyActionImpact(f.battle, declared)

    expect(f.squishyP.entity.externalWard).toEqual({ sourceId: 'protector', amount: 7500 })

    // Reconcile at the stat-refresh seam (every pool mutation / pacing
    // step) must NOT clear the pool while the granting marker still lives.
    system().refreshEffectiveStats(f.battle)

    expect(f.squishyP.entity.externalWard).toEqual({ sourceId: 'protector', amount: 7500 })
  })

  it('no rider -> no ward (base marker stays wardless)', () => {
    const f = fixture()
    f.protectorP.entity.baseStats = asBaseStats({ ...f.protectorP.entity.baseStats, protectChance: 1 })
    f.protectorP.entity.stats = { ...f.protectorP.entity.stats, protectChance: 1 }
    f.protectorP.entity.currentThe = 15
    new BuffSystem(f.protectorP.buffs).apply(HO_MON_MARKER, f.protectorP.entity, f.protectorP.entity, BUFF_REGISTRY)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const declared = declaredEnemyAction(f, [f.squishyP])
    system().applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBe(true)
    expect(f.squishyP.entity.externalWard).toBeUndefined()
  })
})

describe('tro riders (spec 8.2)', () => {
  function fixture() {
    const enemy = createCombatant({ id: 'enemy', type: 'enemy', currentHp: 100_000, maxHp: 100_000, x: 0, row: 0 }, 10)
    const striker = createCombatant({ id: 'striker', type: 'player', currentHp: 60_000, maxHp: 60_000, x: 0, row: 2 }, 5)
    const supporter = createCombatant({ id: 'supporter', type: 'player', currentHp: 100_000, maxHp: 100_000, x: 5, row: 2 }, 5)

    const enemyP = makeParticipant('enemy', enemy, 10, 100)
    enemyP.basic = ENEMY_BASIC
    const strikerP = makeParticipant('striker', striker, 5, 0)
    strikerP.basic = { id: 'ally_hit', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } }
    const supporterP = makeParticipant('supporter', supporter, 5, 1)

    const battle: TurnBattle = { players: [strikerP, supporterP], enemies: [enemyP], state: 'fighting' }
    return { battle, enemyP, strikerP, supporterP }
  }

  function withTroMon(p: TurnBattleParticipant, bake?: (effect: { firesOnNonDamagingAction?: boolean; healsTriggeringAllyMaxHpRatio?: number }) => void) {
    p.entity.baseStats = asBaseStats({ ...p.entity.baseStats, followUpChance: 1 })
    p.entity.stats = { ...p.entity.stats, followUpChance: 1 }
    p.entity.currentThe = 15
    applyMarker(p, TRO_MON_MARKER, (marker) => {
      for (const effect of marker.effects) {
        if (effect.type === 'reactiveProc') bake?.(effect)
      }
    })
    p.reactivePayloads = { tro_kich: { ...TRO_KICH } }
  }

  it('tro proc heals the triggering ally by ratio x its maxHp', () => {
    const f = fixture()
    f.strikerP.entity.currentHp = 30_000 // half of 60k
    withTroMon(f.supporterP, (effect) => {
      effect.healsTriggeringAllyMaxHpRatio = 0.15
    })
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const declared = declaredAllyAction(f.strikerP, f.strikerP.basic!, f.battle.enemies, [f.enemyP])
    system().applyActionImpact(f.battle, declared)

    // 0.15 x 60k = 9000 healed on the triggering ally.
    expect(f.strikerP.entity.currentHp).toBe(39_000)
    expect(f.battle.queuedFollowUps).toHaveLength(1)
    expect(f.battle.queuedFollowUps![0]).toMatchObject({ actorId: 'supporter', actionSource: 'follow_up' })
  })

  it('non-damaging ally action opens no window without the flag — and opens one with it', () => {
    // Without the flag: a self-buff action never triggers Tro.
    let f = fixture()
    withTroMon(f.supporterP)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    let declared = declaredAllyAction(f.strikerP, ALLY_SELF_BUFF, f.battle.enemies, [f.strikerP])
    system().applyActionImpact(f.battle, declared)

    expect(f.battle.queuedFollowUps ?? []).toHaveLength(0)
    expect(f.supporterP.entity.currentThe).toBe(15) // no attempt was paid
    vi.restoreAllMocks()

    // With firesOnNonDamagingAction: the same action queues tro_kich
    // against all living enemies.
    f = fixture()
    withTroMon(f.supporterP, (effect) => {
      effect.firesOnNonDamagingAction = true
    })
    vi.spyOn(Math, 'random').mockReturnValue(0)

    declared = declaredAllyAction(f.strikerP, ALLY_SELF_BUFF, f.battle.enemies, [f.strikerP])
    system().applyActionImpact(f.battle, declared)

    expect(f.battle.queuedFollowUps).toHaveLength(1)
    expect(f.battle.queuedFollowUps![0]).toMatchObject({
      actorId: 'supporter',
      actionSource: 'follow_up',
      payloadSkillId: 'tro_kich',
      targetIds: ['enemy'],
      triggerContext: { origin: 'ally_action' },
    })
    expect(f.supporterP.entity.currentThe).toBe(20)
  })

  it('a DODGED damaging ally action keeps the follow-up on the intended target — no all-enemies fan-out', () => {
    // Regression guard — resolveAllyActionWindow once treated
    // landedTargets === 0 as "non-damaging" and fanned the follow-up out
    // to every living enemy. A dodged DAMAGING action is not authored
    // non-damaging: it must inherit declared.affected instead.
    const f = fixture()
    const enemy2 = createCombatant(
      { id: 'enemy2', type: 'enemy', currentHp: 100_000, maxHp: 100_000, x: 9, row: 0 },
      3,
    )
    const enemy2P = makeParticipant('enemy2', enemy2, 3, 101)
    f.battle.enemies.push(enemy2P)

    // Force the dodge: hit chance floors at 5% (Accuracy.ts), so a
    // 0.999 roll misses even through the floor.
    f.enemyP.entity.baseStats = asBaseStats({
      ...f.enemyP.entity.baseStats,
      evasionRate: 1_000_000,
    })
    f.enemyP.entity.stats = { ...f.enemyP.entity.stats, evasionRate: 1_000_000 }

    withTroMon(f.supporterP, (effect) => {
      effect.firesOnNonDamagingAction = true
    })
    // First roll is the hit check (0.999 misses even the 5% floor ->
    // dodge); every LATER roll must be low so the supporter's proc
    // succeeds — followUpChance hard-caps at REACTIVE_CHANCE_CAP = 0.6,
    // so a flat 0.999 mock would suppress the proc too.
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.999).mockReturnValue(0)

    const declared = declaredAllyAction(f.strikerP, f.strikerP.basic!, f.battle.enemies, [f.enemyP])
    system().applyActionImpact(f.battle, declared)

    // The striker's single-target hit whiffed on the ONLY declared
    // target; the supporter's tro_kich must queue against that one
    // intended enemy — not ['enemy', 'enemy2'].
    expect(f.battle.queuedFollowUps).toHaveLength(1)
    expect(f.battle.queuedFollowUps![0]).toMatchObject({
      actorId: 'supporter',
      actionSource: 'follow_up',
      payloadSkillId: 'tro_kich',
      triggerContext: { origin: 'ally_action' },
    })
    expect(f.battle.queuedFollowUps![0]!.targetIds).toEqual(['enemy'])
  })
})
