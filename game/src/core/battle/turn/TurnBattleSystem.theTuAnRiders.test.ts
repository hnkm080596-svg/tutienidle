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
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import { buffs as LIVE_BUFFS } from '../../../data/buff/buffs'
import { FunctionCombatRng } from '../runtime/rng/FunctionCombatRng'
import type { CombatRng } from '../contracts/rng'
import { HO_MON_MARKER } from '../../../data/buff/TheTuBuffs'
import { BAT_TU_BA_THE, buildTheTuAnKit } from '../../../data/skill/TheTuSkills'
import { BodyBatTuSurvival } from '../../the-tu/TheTuBatTuSurvival'
import { SurviveLethalGuard } from '../../talent/SurviveLethalGuard'
import type { TurnSkillDefinition } from './TurnSkillAction'
import type { BuffDefinition } from '../../buff2/BuffDefinition'
import type { BuffRegistry } from '../../buff2/BuffRegistry'
import type { ReactiveProcPayload } from '../../proc/ProcCapabilities'
import type { CombatAuthorityExecutionContext } from '../contracts/context'
import type { ResolvedCombatOperation } from '../contracts/operations'
import type { BuffDefinitionId, CombatEntityId, CombatOperationId } from '../contracts/ids'
import { makeTestBuffRegistry, makeTurnRuntime, type TurnRuntimeFixture } from './testing/TurnRuntimeFixtures'

// Ung The beta (design Parts V-VIII) — node-rider mechanics on the
// *_mon marker clones: the Ho Bich intercept->ally ward and the Dan
// The one-shot mark (tro_kich clone carrying appliesAilments). Riders
// are baked onto clones at participant build; these tests register
// kit-baked clones under the same def ids (the production seam) to
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

function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, consecutiveHardCcTurns: 0 }
}

/** Clone a marker def with hand-baked reactive_proc rider fields — the
    same capability-payload writes buildTheTuAnKit performs. */
function markerClone(
  base: BuffDefinition,
  bake?: (payload: ReactiveProcPayload) => void,
): BuffDefinition {
  const clone = structuredClone(base)
  for (const capability of clone.capabilities ?? []) {
    if (capability.type === 'reactive_proc') {
      bake?.(capability.payload as ReactiveProcPayload)
    }
  }
  return clone
}

/** Live-data registry with the given defs swapped in under their own
    ids — the kit-clone seam the battle-local registry performs. */
function registryWith(replacements: readonly BuffDefinition[]) {
  const byId = new Map(replacements.map((def) => [def.id, def]))
  return makeTestBuffRegistry(LIVE_BUFFS.map((def) => byId.get(def.id) ?? def))
}

function world(
  participants: () => readonly TurnBattleParticipant[],
  opts: {
    registry?: ReturnType<typeof makeTestBuffRegistry>
    rng?: () => number
    combatRng?: CombatRng
  } = {},
) {
  const combat = new CombatSystem(new EventBus())
  const registry = opts.registry ?? BUFF_REGISTRY
  const runtime = makeTurnRuntime({
    registry,
    participants,
    combatSystem: combat,
    rng:
      opts.combatRng ??
      (opts.rng === undefined ? undefined : new FunctionCombatRng(opts.rng)),
  })

  return { combat, registry, runtime }
}

function systemOf(w: {
  combat: CombatSystem
  registry: BuffRegistry
  runtime: TurnRuntimeFixture
}): TurnBattleSystem {
  return new TurnBattleSystem(w.combat, 10_000, w.registry, undefined, w.runtime)
}

function buffsOf(runtime: TurnRuntimeFixture, participant: TurnBattleParticipant, id: string) {
  return runtime.buffs
    .getForTarget(participant.entity.id)
    .filter((instance) => instance.definitionId === id)
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

afterEach(() => {
  vi.restoreAllMocks()
})

describe('intercept -> ally ward rider (Ho Bich)', () => {
  function fixture() {
    const enemy = createCombatant({ id: 'enemy', type: 'enemy', currentHp: 100_000, maxHp: 100_000, x: 0, row: 0 }, 10)
    const squishy = createCombatant({ id: 'squishy', type: 'player', currentHp: 100_000, maxHp: 100_000, x: 0, row: 2 }, 5)
    const protector = createCombatant({ id: 'protector', type: 'player', currentHp: 50_000, maxHp: 50_000, x: 5, row: 2 }, 5)

    const enemyP = makeParticipant('enemy', enemy, 10, 100)
    enemyP.basic = ENEMY_BASIC
    const squishyP = makeParticipant('squishy', squishy, 5, 0)
    const protectorP = makeParticipant('protector', protector, 5, 1)
    protectorP.thamTargetId = 'enemy' // observation gate

    const battle: TurnBattle = { players: [squishyP, protectorP], enemies: [enemyP], state: 'fighting' }
    const roster = [squishyP, protectorP, enemyP]
    return { battle, enemyP, squishyP, protectorP, roster }
  }

  function withHoMon(protectorP: TurnBattleParticipant, ratio?: number) {
    protectorP.entity.baseStats = asBaseStats({ ...protectorP.entity.baseStats, protectChance: 1 })
    protectorP.entity.stats = { ...protectorP.entity.stats, protectChance: 1 }
    protectorP.entity.currentThe = 15
    return ratio === undefined
      ? HO_MON_MARKER
      : markerClone(HO_MON_MARKER, (payload) => {
          payload.grantsWardToOriginalTarget = { buffDefinitionId: 'ho_ve' as BuffDefinitionId, sourceMaxHpRatio: ratio }
        })
  }

  it('a successful intercept grants the rescued ally an externalWard + the ho_ve marker', () => {
    const f = fixture()
    const w = world(() => f.roster, {
      registry: registryWith([withHoMon(f.protectorP, 0.15)]),
    })
    w.runtime.applyBuff('ho_mon', f.protectorP)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const declared = declaredEnemyAction(f, [f.squishyP])
    systemOf(w).applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBe(true)
    // Ward = 15% x protector's 50k maxHp, sourced by the protector.
    expect(f.squishyP.entity.externalWard).toEqual({ sourceId: 'protector', amount: 7500 })
    expect(buffsOf(w.runtime, f.squishyP, 'ho_ve')).toHaveLength(1)
    // The protector still took the hit (squishy untouched HP-wise).
    expect(f.squishyP.entity.currentHp).toBe(100_000)
  })

  it('the intercept-granted ward survives reconcile — marker sourceId keys to the protector', () => {
    const f = fixture()
    const w = world(() => f.roster, {
      registry: registryWith([withHoMon(f.protectorP, 0.15)]),
    })
    w.runtime.applyBuff('ho_mon', f.protectorP)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const system = systemOf(w)
    const declared = declaredEnemyAction(f, [f.squishyP])
    system.applyActionImpact(f.battle, declared)

    expect(f.squishyP.entity.externalWard).toEqual({ sourceId: 'protector', amount: 7500 })

    // Reconcile at the stat-refresh seam (every pool mutation / pacing
    // step) must NOT clear the pool while the granting marker still lives.
    system.refreshEffectiveStats(f.battle)

    expect(f.squishyP.entity.externalWard).toEqual({ sourceId: 'protector', amount: 7500 })
  })

  it('no rider -> no ward (base marker stays wardless)', () => {
    const f = fixture()
    const w = world(() => f.roster)
    withHoMon(f.protectorP)
    w.runtime.applyBuff('ho_mon', f.protectorP)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const declared = declaredEnemyAction(f, [f.squishyP])
    systemOf(w).applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBe(true)
    expect(f.squishyP.entity.externalWard).toBeUndefined()
  })
})

describe('Dan The one-shot mark (Ung The beta node)', () => {
  function fixture() {
    const enemy = createCombatant({ id: 'enemy', type: 'enemy', currentHp: 100_000, maxHp: 100_000, x: 0, row: 0 }, 10)
    const striker = createCombatant({ id: 'striker', type: 'player', currentHp: 60_000, maxHp: 60_000, x: 0, row: 2 }, 5)
    const supporter = createCombatant({ id: 'supporter', type: 'player', currentHp: 100_000, maxHp: 100_000, x: 5, row: 2 }, 5)

    const enemyP = makeParticipant('enemy', enemy, 10, 100)
    enemyP.basic = ENEMY_BASIC
    const strikerP = makeParticipant('striker', striker, 5, 0)
    strikerP.basic = { id: 'ally_hit', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } }
    const supporterP = makeParticipant('supporter', supporter, 5, 1)
    supporterP.thamTargetId = 'enemy' // observation gate

    const battle: TurnBattle = { players: [strikerP, supporterP], enemies: [enemyP], state: 'fighting' }
    const roster = [strikerP, supporterP, enemyP]
    return { battle, enemyP, strikerP, supporterP, roster }
  }

  it('tro_kich landed applies the dan_the mark; the marked enemy\'s observed action yields boosted income, then the mark is consumed', () => {
    const f = fixture()
    // The Dẫn Thế node bakes the one-shot ailment onto the tro_kich
    // payload clone — register the baked kit clones under their ids.
    const kit = buildTheTuAnKit(
      {
        observationGainBonus: 0,
        phanKinhArmorPierce: 0,
        interceptWardRatio: 0,
        evadeCounterMultiplierBonus: 0,
        danTheBonus: 1,
      },
      { quanThe: true, quanTheCoreLevel: 1 },
    )
    const w = world(() => f.roster, { registry: registryWith([...kit.basic.grantsBuffsAtBuild!]) })
    f.supporterP.reactivePayloads = kit.reactivePayloads
    f.supporterP.entity.baseStats = asBaseStats({ ...f.supporterP.entity.baseStats, followUpChance: 1 })
    f.supporterP.entity.stats = { ...f.supporterP.entity.stats, followUpChance: 1 }
    f.supporterP.entity.currentThe = 100
    w.runtime.applyBuff('tro_mon', f.supporterP)
    w.runtime.applyBuff('ung_the', f.supporterP)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const system = systemOf(w)
    // Ally action -> Tro window -> queued tro_kich at the canonical target.
    const declared = declaredAllyAction(f.strikerP, f.strikerP.basic!, f.battle.enemies, [f.enemyP])
    system.applyActionImpact(f.battle, declared)
    expect(f.battle.queuedFollowUps).toHaveLength(1)

    // The queued payload resolves: tro_kich lands, applying dan_the.
    system.resolveNextStep(f.battle)
    expect(buffsOf(w.runtime, f.enemyP, 'dan_the')).toHaveLength(1)

    // The marked enemy's next OBSERVED action yields x3 income and
    // consumes the mark.
    f.supporterP.entity.currentThe = 0
    const enemyAction = declaredEnemyAction(f, [f.strikerP])
    system.applyActionImpact(f.battle, enemyAction)

    expect(f.supporterP.entity.currentThe).toBe(4 * 3) // gainOnObservedAction x DAN_THE_INCOME_MULT
    expect(buffsOf(w.runtime, f.enemyP, 'dan_the')).toHaveLength(0)
  })
})

describe('dead holder performs no reactive transaction (review MED)', () => {
  function lethalFixture() {
    const defender = createCombatant({ id: 'defender', type: 'player', currentHp: 100, maxHp: 100, x: 0, row: 2 }, 5)
    const defenderP = makeParticipant('defender', defender, 5, 0)
    defenderP.entity.baseStats = asBaseStats({ ...defenderP.entity.baseStats, counterChance: 1 })
    defenderP.entity.stats = { ...defenderP.entity.stats, counterChance: 1 }
    defenderP.entity.currentThe = 50
    defenderP.thamTargetId = 'enemy'

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
    const roster = [defenderP, enemyP]
    return { battle, enemyP, defenderP, roster }
  }

  it('a lethal hit kills the phan_mon holder -> no The cost, no rng draw, no queue', () => {
    const f = lethalFixture()
    // The hit channel draws roll() (accuracy/crit/block); the reactive
    // window's ONLY draw is rollChance -- split the channels so the
    // assertion pins the window specifically, not the hit's own rolls.
    const roll = vi.fn(() => 0)
    const rollChance = vi.fn((_chance: number) => true)
    const w = world(() => f.roster, { combatRng: { roll, rollChance } })
    w.runtime.applyBuff('phan_mon', f.defenderP)
    // The seed apply consumes resolver rolls (stream parity) -- clear
    // so the assertion measures only the hit window's draws.
    roll.mockClear()
    rollChance.mockClear()

    systemOf(w).applyActionImpact(
      f.battle,
      declaredEnemyAction(f, [f.defenderP]),
    )

    expect(f.defenderP.entity.alive).toBe(false)
    // The window never opened: no cost paid, no commit, and the proc's
    // chance draw (rollChance) never happened -- the hit's own roll()s
    // are a separate, legitimate channel.
    expect(f.defenderP.entity.currentThe).toBe(50)
    expect(rollChance).not.toHaveBeenCalled()
    expect(f.battle.queuedFollowUps ?? []).toHaveLength(0)
  })

  it('the same lethal hit with Bat Tu survival wired -> holder lives -> the Phan window still rolls', () => {
    // Counter-case: the gate keys on alive AFTER survival resolution, not
    // on the raw damage amount — a saved holder must still counter.
    const f = lethalFixture()
    f.defenderP.ultimate = { skill: BAT_TU_BA_THE, remainingCooldownTurns: 0 }

    const rng = vi.fn(() => 0)
    const w = world(() => f.roster, { rng })
    const runtime = w.runtime
    w.runtime.applyBuff('phan_mon', f.defenderP)
    // Clear the seed-apply's resolver roll — the assertion below counts
    // only draws the taken window itself performs.
    rng.mockClear()

    const defenderP = f.defenderP
    w.combat.setSurviveLethalSession({
      playerEntityId: defenderP.entity.id,
      guard: new SurviveLethalGuard(),
      // Same bound-lane shape as GameManagerTurnBattleOps: mid-settlement
      // reuses the frame ctx; quiescent mints authored ops and settles.
      surviveEffects: {
        grantBuffId: 'bat_tu_ba_the' as BuffDefinitionId,
        cleanseDebuffs: false,
        apply: (entity, resolved, execCtx: CombatAuthorityExecutionContext | undefined) => {
          const entityId = entity.id as CombatEntityId
          if (execCtx !== undefined) {
            if (resolved.grantBuffId !== undefined) {
              runtime.buffs.apply(
                {
                  definitionId: resolved.grantBuffId,
                  sourceId: entityId,
                  targetId: entityId,
                  stacks: 1,
                  baseChance: 1,
                  durationOverride: resolved.grantBuffDurationOverride,
                  reactionEligibility: 'suppressed',
                  origin: execCtx.origin,
                },
                execCtx,
              )
            }
            return
          }
          runtime.scheduler.enqueueAuthored([
            {
              type: 'apply_buff',
              operationId: 'survive.test.grant' as CombatOperationId,
              payload: {
                definitionId: resolved.grantBuffId!,
                targetId: entityId,
                stacks: 1,
                baseChance: 1,
                durationOverride: resolved.grantBuffDurationOverride,
                reactionEligibility: 'suppressed',
              },
              origin: {
                kind: 'proc',
                originId: 'survive_effects',
                sourceId: entityId,
                rootActionId: 'survive.test',
              },
            },
          ] satisfies ResolvedCombatOperation[])
          runtime.scheduler.runIfQuiescent()
        },
      },
      extraSources: [
        new BodyBatTuSurvival({
          ultimateSlot: () => defenderP.ultimate,
          hasActiveBuff: (definitionId) =>
            runtime.buffs
              .getForTarget(defenderP.entity.id)
              .some((instance) => instance.definitionId === definitionId),
        }),
      ],
    })

    systemOf(w).applyActionImpact(f.battle, declaredEnemyAction(f, [f.defenderP]))

    expect(defenderP.entity.alive).toBe(true)
    expect(buffsOf(runtime, defenderP, 'bat_tu_ba_the')).toHaveLength(1)
    // Holder survived -> the taken window opened, paid, rolled, queued.
    expect(rng).toHaveBeenCalled()
    expect(f.battle.queuedFollowUps ?? []).toContainEqual(
      expect.objectContaining({ actorId: 'defender', actionSource: 'counter' }),
    )
  })
})
