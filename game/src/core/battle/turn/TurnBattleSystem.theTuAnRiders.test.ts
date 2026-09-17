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
import { FunctionCombatRng } from '../runtime/rng/FunctionCombatRng'
import { HO_MON_MARKER, TRO_MON_MARKER } from '../../../data/buff/TheTuBuffs'
import { BAT_TU_BA_THE, TRO_KICH } from '../../../data/skill/TheTuSkills'
import { TheTuBatTuSurvival } from '../../the-tu/TheTuBatTuSurvival'
import { SurviveLethalGuard } from '../../talent/SurviveLethalGuard'
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

function system(rng?: () => number): TurnBattleSystem {
  // The rng seam is the LAST constructor param — the reactive-proc
  // success roll (resolveReactiveProcs) draws from it, so proc outcomes
  // are scripted here instead of through a Math.random spy.
  return new TurnBattleSystem(
    new CombatSystem(new EventBus()),
    10_000,
    BUFF_REGISTRY,
    /*spawnEnemy*/ undefined,
    /*reactionManager*/ undefined,
    /*onSkillCast*/ undefined,
    /*liveStatModifiers*/ undefined,
    rng === undefined ? undefined : new FunctionCombatRng(rng),
  )
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
    // Two seams, two mechanisms: the HIT check still reads the global
    // Math.random inside CombatSystem — pin it high so the roll misses
    // even the 5% floor (forced dodge). The Tro PROC roll reads the
    // injected this.rng — pin that low so the supporter's proc succeeds
    // through its own authority (followUpChance hard-caps at
    // REACTIVE_CHANCE_CAP = 0.6, so it needs < 0.6 on its own seam).
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    const declared = declaredAllyAction(f.strikerP, f.strikerP.basic!, f.battle.enemies, [f.enemyP])
    system(() => 0).applyActionImpact(f.battle, declared)

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

describe('dead holder performs no reactive transaction (review MED)', () => {
  function lethalFixture() {
    const defender = createCombatant({ id: 'defender', type: 'player', currentHp: 100, maxHp: 100, x: 0, row: 2 }, 5)
    const defenderP = makeParticipant('defender', defender, 5, 0)
    defenderP.entity.baseStats = asBaseStats({ ...defenderP.entity.baseStats, counterChance: 1 })
    defenderP.entity.stats = { ...defenderP.entity.stats, counterChance: 1 }
    defenderP.entity.currentThe = 50
    new BuffSystem(defenderP.buffs).apply(
      BUFF_REGISTRY.get('phan_mon'),
      defenderP.entity,
      defenderP.entity,
      BUFF_REGISTRY,
    )

    const enemy = createCombatant(
      {
        id: 'enemy',
        type: 'enemy',
        currentHp: 100_000,
        maxHp: 100_000,
        x: 0,
        row: 0,
        // One-shot force: 999_999 might x multiplier 1 vs a 100-HP defender.
        baseStats: createBaseStats({ ...NO_MITIGATION, might: 999_999 }),
      },
      10,
    )
    const enemyP = makeParticipant('enemy', enemy, 10, 100)
    enemyP.basic = ENEMY_BASIC

    const battle: TurnBattle = { players: [defenderP], enemies: [enemyP], state: 'fighting' }
    return { battle, enemyP, defenderP }
  }

  it('a lethal hit kills the phan_mon holder -> no The cost, no rng draw, no queue', () => {
    const f = lethalFixture()
    const rng = vi.fn(() => 0)

    system(rng).applyActionImpact(
      f.battle,
      declaredEnemyAction(f, [f.defenderP]),
    )

    expect(f.defenderP.entity.alive).toBe(false)
    // The window never opened: no cost paid, no success credit, no draw.
    expect(f.defenderP.entity.currentThe).toBe(50)
    expect(rng).not.toHaveBeenCalled()
    expect(f.battle.queuedFollowUps ?? []).toHaveLength(0)
  })

  it('the same lethal hit with Bat Tu survival wired -> holder lives -> the Phan window still rolls', () => {
    // Counter-case: the gate keys on alive AFTER survival resolution, not
    // on the raw damage amount — a saved holder must still counter.
    const f = lethalFixture()
    f.defenderP.ultimate = { skill: BAT_TU_BA_THE, remainingCooldownTurns: 0 }

    const combat = new CombatSystem(new EventBus())
    combat.setSurviveLethalSession({
      playerEntityId: f.defenderP.entity.id,
      guard: new SurviveLethalGuard(),
      surviveEffects: {
        buffSystem: new BuffSystem(f.defenderP.buffs),
        registry: BUFF_REGISTRY,
        grantBuffId: 'bat_tu_ba_the',
        cleanseDebuffs: false,
      },
      extraSources: [
        new TheTuBatTuSurvival({
          ultimateSlot: () => f.defenderP.ultimate,
          buffs: f.defenderP.buffs,
        }),
      ],
    })

    const rng = vi.fn(() => 0)
    const sys = new TurnBattleSystem(
      combat,
      10_000,
      BUFF_REGISTRY,
      /*spawnEnemy*/ undefined,
      /*reactionManager*/ undefined,
      /*onSkillCast*/ undefined,
      /*liveStatModifiers*/ undefined,
      new FunctionCombatRng(rng),
    )

    sys.applyActionImpact(f.battle, declaredEnemyAction(f, [f.defenderP]))

    expect(f.defenderP.entity.alive).toBe(true)
    expect(f.defenderP.buffs.getAllById('bat_tu_ba_the')).toHaveLength(1)
    // Holder survived -> the taken window opened, paid, rolled, queued.
    expect(rng).toHaveBeenCalled()
    expect(f.battle.queuedFollowUps ?? []).toContainEqual(
      expect.objectContaining({ actorId: 'defender', actionSource: 'counter' }),
    )
  })
})
