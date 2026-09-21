import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import { makeTestBuffRegistry, makeTurnRuntime } from './testing/TurnRuntimeFixtures'
import type { CombatAuthorityExecutionContext } from '../contracts/context'
import type { ResolvedCombatOperation } from '../contracts/operations'
import type { BuffDefinitionId, CombatEntityId, CombatOperationId } from '../contracts/ids'
import { BAT_TU_BA_THE, CUONG_QUYEN, LOAN_DAU } from '../../../data/skill/TheTuSkills'
import { BAT_TU_BA_THE_BUFF } from '../../../data/buff/TheTuBuffs'
import { BodyBatTuSurvival } from '../../the-tu/TheTuBatTuSurvival'
import { SurviveLethalGuard } from '../../talent/SurviveLethalGuard'
import { selectAction } from './TurnSkillAction'
import type { BuffDefinition } from '../../buff2/BuffDefinition'

// The Tu Reimagined (spec 2026-09-15 section 5.1, plan Task 9,
// D9/D10/INV-4/5) — Bat Tu Ba The survival contract: lethal -> HP 1 ->
// bat_tu_ba_the buff for the holder's own turns + ultimate cooldown
// consumed; an active buff means FREE survive (no re-grant, no refresh);
// the talent guard stays the second line when the ult is spent.

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0 })

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

function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, consecutiveHardCcTurns: 0 }
}

const STUN: BuffDefinition = {
  id: 'fixture_stun' as BuffDefinitionId,
  name: 'Stun',
  polarity: 'debuff',
  kind: 'debuff',
  instanceScope: 'per_source',
  dispellable: true,
  stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'holder_turns', duration: 5, scaling: 'fixed' },
  controls: [{ type: 'stun' }],
}

// Non-cc debuff (poison/dot) — must survive BOTH the lethal grant and
// repeat lethals inside the Bat Tu window: only hard CC is cleansed,
// via clearsCcOnApply on the grant path.
const POISON: BuffDefinition = {
  id: 'fixture_poison' as BuffDefinitionId,
  name: 'Poison',
  polarity: 'debuff',
  kind: 'ailment',
  instanceScope: 'per_source',
  dispellable: true,
  stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'holder_turns', duration: 5, scaling: 'fixed' },
  periodic: [
    {
      id: 'fixture_poison.tick',
      type: 'damage',
      element: 'physical',
      damageProfile: 'legacy_dot',
      coefficient: 0.2,
      scaling: 'dynamic',
      timing: 'holder_turn_end',
      stackScaling: 'multiply',
      canCrit: false,
      canMiss: false,
      hitCount: 1,
    },
  ],
}

const TU_SINH_NGO: BuffDefinition = {
  id: 'tu_sinh_ngo' as BuffDefinitionId,
  name: 'Tu Sinh Ngo',
  polarity: 'buff',
  kind: 'buff',
  instanceScope: 'per_source',
  dispellable: true,
  stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'holder_turns', duration: 1, scaling: 'fixed' },
}

const REGISTRY = makeTestBuffRegistry([BAT_TU_BA_THE_BUFF, STUN, POISON, TU_SINH_NGO])

function makeBodyParticipant(id: string, entity: CombatEntity): TurnBattleParticipant {
  const participant = makeParticipant(id, entity, 10, 0)
  participant.basic = CUONG_QUYEN
  participant.special = { skill: LOAN_DAU, remainingCooldownTurns: 0 }
  participant.ultimate = { skill: BAT_TU_BA_THE, remainingCooldownTurns: 0 }
  return participant
}

function makeCombatWithSession(
  player: TurnBattleParticipant,
  guard: SurviveLethalGuard,
  extraParticipants: TurnBattleParticipant[] = [],
) {
  const combat = new CombatSystem(new EventBus())
  const participants = [player, ...extraParticipants]
  const runtime = makeTurnRuntime({ registry: REGISTRY, participants: () => participants, combatSystem: combat })
  combat.setSurviveLethalSession({
    playerEntityId: player.entity.id,
    guard,
    // Same bound-lane shape as GameManagerTurnBattleOps: mid-settlement
    // reuses the frame ctx; quiescent mints authored ops and settles.
    surviveEffects: {
      grantBuffId: 'tu_sinh_ngo' as BuffDefinitionId,
      cleanseDebuffs: true,
      apply: (entity, resolved, execCtx: CombatAuthorityExecutionContext | undefined) => {
        const entityId = entity.id as CombatEntityId
        if (execCtx !== undefined) {
          if (resolved.cleanseDebuffs) {
            runtime.buffs.cleanse(entityId, { polarity: 'debuff' }, undefined, execCtx)
          }
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
        const root = `survive.test.${entity.id}`
        const origin = {
          kind: 'proc' as const,
          originId: 'survive_effects',
          sourceId: entityId,
          rootActionId: root,
        }
        const ops: ResolvedCombatOperation[] = []
        if (resolved.cleanseDebuffs) {
          ops.push({
            type: 'cleanse_buff',
            operationId: `${root}.cleanse` as CombatOperationId,
            payload: { targetId: entityId, query: { polarity: 'debuff' } },
            origin,
          })
        }
        if (resolved.grantBuffId !== undefined) {
          ops.push({
            type: 'apply_buff',
            operationId: `${root}.grant` as CombatOperationId,
            payload: {
              definitionId: resolved.grantBuffId,
              targetId: entityId,
              stacks: 1,
              baseChance: 1,
              durationOverride: resolved.grantBuffDurationOverride,
              reactionEligibility: 'suppressed',
            },
            origin,
          })
        }
        runtime.scheduler.enqueueAuthored(ops)
        runtime.scheduler.runIfQuiescent()
      },
    },
    extraSources: [
      new BodyBatTuSurvival({
        ultimateSlot: () => player.ultimate,
        hasActiveBuff: (definitionId) =>
          runtime.buffs
            .getForTarget(player.entity.id)
            .some((instance) => instance.definitionId === definitionId),
      }),
    ],
  })
  return { combat, runtime }
}

function buffsOf(
  runtime: ReturnType<typeof makeTurnRuntime>,
  participant: TurnBattleParticipant,
  definitionId: string,
) {
  return runtime.buffs
    .getForTarget(participant.entity.id)
    .filter((instance) => instance.definitionId === definitionId)
}

function makeEnemy(id: string, might = 999_999): CombatEntity {
  return createCombatant({
    id,
    stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might, defense: 0, endurancePercent: 0, blockChance: 0 }),
    currentHp: 1_000_000,
    maxHp: 1_000_000,
  })
}

describe('Bat Tu Ba The survival contract (D9/D10/INV-4/5)', () => {
  it('lethal hit at low HP -> survives at 1, buff granted for 3 own-turns, ult CD started', () => {
    const player = makeBodyParticipant('player', createCombatant({ id: 'player', type: 'player', currentHp: 50, maxHp: 1_000 }))
    const { combat, runtime } = makeCombatWithSession(player, new SurviveLethalGuard())

    combat.applyDirectDamage(player.entity, 9_999, 'enemy')

    expect(player.entity.alive).toBe(true)
    expect(player.entity.currentHp).toBe(1)
    const buff = buffsOf(runtime, player, 'bat_tu_ba_the')[0]
    expect(buff).toBeDefined()
    expect(buff!.remaining).toBe(3)
    expect(player.ultimate!.remainingCooldownTurns).toBe(BAT_TU_BA_THE.cooldownTurns)
  })

  it('repeat lethal while buffed -> free survive, NO duration refresh, NO CD touch', () => {
    const player = makeBodyParticipant('player', createCombatant({ id: 'player', type: 'player', currentHp: 50, maxHp: 1_000 }))
    const { combat, runtime } = makeCombatWithSession(player, new SurviveLethalGuard())

    // Buff already active at 2 remaining turns — a re-grant would reset to 3.
    runtime.applyBuff('bat_tu_ba_the', player, player, { durationOverride: 2 })
    player.ultimate!.remainingCooldownTurns = 4 // ticking down from an earlier trigger

    combat.applyDirectDamage(player.entity, 9_999, 'enemy')

    expect(player.entity.alive).toBe(true)
    expect(player.entity.currentHp).toBe(1)
    expect(buffsOf(runtime, player, 'bat_tu_ba_the')).toHaveLength(1)
    expect(buffsOf(runtime, player, 'bat_tu_ba_the')[0]!.remaining).toBe(2)
    expect(player.ultimate!.remainingCooldownTurns).toBe(4)
  })

  it('lethal while ult on CD and no talent -> dies', () => {
    const player = makeBodyParticipant('player', createCombatant({ id: 'player', type: 'player', currentHp: 50, maxHp: 1_000 }))
    player.ultimate!.remainingCooldownTurns = 5
    const { combat, runtime } = makeCombatWithSession(player, new SurviveLethalGuard())

    combat.applyDirectDamage(player.entity, 9_999, 'enemy')

    expect(player.entity.alive).toBe(false)
  })

  it('talent guard stacks as the second line when the ult is exhausted', () => {
    const player = makeBodyParticipant('player', createCombatant({ id: 'player', type: 'player', currentHp: 50, maxHp: 1_000 }))
    player.ultimate!.remainingCooldownTurns = 5
    const guard = new SurviveLethalGuard()
    guard.beginBattle(['bat_tu_the']) // talent id -> 1 use (getSurviveLethalUsesPerBattle)
    const { combat, runtime } = makeCombatWithSession(player, guard)

    combat.applyDirectDamage(player.entity, 9_999, 'enemy')

    expect(player.entity.alive).toBe(true)
    expect(player.entity.currentHp).toBe(1)
    expect(guard.getRemainingUses()).toBe(0)
    // Talent path grants its own buff id, not bat_tu_ba_the.
    expect(buffsOf(runtime, player, 'bat_tu_ba_the')).toHaveLength(0)
  })

  it('node-scaled duration reaches the lethal grant via the slot application', () => {
    const player = makeBodyParticipant('player', createCombatant({ id: 'player', type: 'player', currentHp: 50, maxHp: 1_000 }))
    // Participant-build clone carries the resolved override (base 3 + 1 node).
    player.ultimate = {
      skill: {
        ...BAT_TU_BA_THE,
        appliesBuffs: [{ definitionId: 'bat_tu_ba_the', target: 'self', durationOverride: 4 }],
      },
      remainingCooldownTurns: 0,
    }
    const { combat, runtime } = makeCombatWithSession(player, new SurviveLethalGuard())

    combat.applyDirectDamage(player.entity, 9_999, 'enemy')

    expect(player.entity.alive).toBe(true)
    expect(buffsOf(runtime, player, 'bat_tu_ba_the')[0]!.remaining).toBe(4)
  })

  it('lethal grant cleanses an active stun (clearsCcOnApply on the grant path)', () => {
    const player = makeBodyParticipant('player', createCombatant({ id: 'player', type: 'player', currentHp: 50, maxHp: 1_000 }))
    const dummy = makeParticipant('dummy', makeEnemy('dummy'), 0, 0)
    const { combat, runtime } = makeCombatWithSession(player, new SurviveLethalGuard(), [dummy])
    runtime.applyBuff('fixture_stun', player, dummy)

    combat.applyDirectDamage(player.entity, 9_999, 'enemy')

    expect(player.entity.alive).toBe(true)
    expect(buffsOf(runtime, player, 'fixture_stun')).toHaveLength(0)
  })

  it('cleanses hard CC only — non-cc debuffs survive the grant AND repeat lethals in the window', () => {
    const player = makeBodyParticipant('player', createCombatant({ id: 'player', type: 'player', currentHp: 50, maxHp: 1_000 }))
    const dummy = makeParticipant('dummy', makeEnemy('dummy'), 0, 0)
    const { combat, runtime } = makeCombatWithSession(player, new SurviveLethalGuard(), [dummy])
    runtime.applyBuff('fixture_stun', player, dummy)
    runtime.applyBuff('fixture_poison', player, dummy)

    // First lethal: grant strips the stun via clearsCcOnApply; the
    // poison is a non-cc debuff and must NOT be blanket-cleansed.
    combat.applyDirectDamage(player.entity, 9_999, 'enemy')

    expect(player.entity.alive).toBe(true)
    expect(buffsOf(runtime, player, 'fixture_stun')).toHaveLength(0)
    expect(buffsOf(runtime, player, 'fixture_poison')).toHaveLength(1)
    expect(buffsOf(runtime, player, 'bat_tu_ba_the')).toHaveLength(1)

    // Second lethal inside the window: the already-active free survive
    // used to return no cleanseDebuffs -> undefined !== false wiped
    // every debuff. It must leave the poison untouched.
    combat.applyDirectDamage(player.entity, 9_999, 'enemy')

    expect(player.entity.alive).toBe(true)
    expect(player.entity.currentHp).toBe(1)
    expect(buffsOf(runtime, player, 'fixture_poison')).toHaveLength(1)
  })

  it('active buff suppresses hard-CC blocking without touching consecutiveHardCcTurns', () => {
    const player = makeBodyParticipant('player', createCombatant({ id: 'player', type: 'player', currentHp: 500, maxHp: 1_000 }))
    const enemyP = makeParticipant('enemy', makeEnemy('enemy', 0), 8, 100)
    const battle: TurnBattle = { players: [player], enemies: [enemyP], state: 'fighting' }

    const { combat, runtime } = makeCombatWithSession(player, new SurviveLethalGuard(), [enemyP])
    runtime.applyBuff('fixture_stun', player, enemyP)
    runtime.applyBuff('bat_tu_ba_the', player, player)
    player.consecutiveHardCcTurns = 2
    // Ult+special on cooldown so the unblocked action is the basic.
    player.ultimate!.remainingCooldownTurns = 8
    player.special!.remainingCooldownTurns = 4

    const system = new TurnBattleSystem(combat, 10, REGISTRY, undefined, runtime)
    const step = system.resolveNextStep(battle)

    // Buffed: the stun cannot block — the actor still acts (basic hit).
    expect(step.ccBlocked).toBe(false)
    expect(step.skillId).toBe('cuong_quyen')
    // Suppressed, NOT reset: the counter resumes accumulating post-expiry.
    expect(player.consecutiveHardCcTurns).toBe(2)
  })

  it('manual cast applies the buff through the appliesBuffs path', () => {
    // A stunned actor cannot cast at all — clearsCcOnApply on a self-buff
    // is only reachable through the lethal grant (covered above). The
    // manual path just proves the skill applies its own buff.
    const player = makeBodyParticipant('player', createCombatant({ id: 'player', type: 'player', currentHp: 500, maxHp: 1_000 }))
    const enemyP = makeParticipant('enemy', makeEnemy('enemy', 0), 8, 100)
    const battle: TurnBattle = { players: [player], enemies: [enemyP], state: 'fighting' }

    const { combat, runtime } = makeCombatWithSession(player, new SurviveLethalGuard(), [enemyP])
    const system = new TurnBattleSystem(combat, 10, REGISTRY, undefined, runtime)
    const step = system.resolveNextStep(battle)

    expect(step.skillId).toBe('bat_tu_ba_the')
    expect(buffsOf(runtime, player, 'bat_tu_ba_the')).toHaveLength(1)
    expect(player.ultimate!.remainingCooldownTurns).toBe(8)
  })

  it('selectAction DOES auto-pick the ultimate when off-CD (T11-accepted, do not gate)', () => {
    const player = makeBodyParticipant('player', createCombatant({ id: 'player', type: 'player' }))
    expect(selectAction(player).skillId).toBe('bat_tu_ba_the')
  })

  it('own-turn lethal DoT -> Bat Tu fires -> committed ult CD does NOT tick again that same turn', () => {
    const player = makeBodyParticipant('player', createCombatant({ id: 'player', type: 'player', currentHp: 50, maxHp: 1_000 }))
    const enemyP = makeParticipant('enemy', makeEnemy('enemy', 0), 8, 100)
    const battle: TurnBattle = { players: [player], enemies: [enemyP], state: 'fighting' }
    const dummy = makeParticipant('dummy', makeEnemy('dummy'), 0, 0)
    const { combat, runtime } = makeCombatWithSession(player, new SurviveLethalGuard(), [enemyP, dummy])

    // Lethal poison ticking on the holder's OWN turn: a might-999k source
    // x coefficient 0.2 resolves ~200k at tick — far over 50 HP.
    runtime.applyBuff('fixture_poison', player, dummy)

    const system = new TurnBattleSystem(combat, 10, REGISTRY, undefined, runtime)
    system.declareActorAction(battle, player)

    expect(player.entity.alive).toBe(true)
    expect(player.entity.currentHp).toBe(1)
    expect(buffsOf(runtime, player, 'bat_tu_ba_the')).toHaveLength(1)
    // The survival source committed the full 8-turn cooldown DURING this
    // turn's status phase (inside BuffSystem.update); the same turn's
    // cooldown tick must not drop it to 7 — the regression this guards.
    expect(player.ultimate!.remainingCooldownTurns).toBe(8)

    // Next own turn: the poison ticks lethal again inside the still-active
    // Bat Tu window (free survive — no new commit), so the cooldown DOES
    // tick down to 7. The first turn's skip was a same-turn exemption,
    // not a freeze.
    system.declareActorAction(battle, player)

    expect(player.entity.alive).toBe(true)
    expect(buffsOf(runtime, player, 'bat_tu_ba_the')).toHaveLength(1)
    expect(player.ultimate!.remainingCooldownTurns).toBe(7)
  })

  it('enemy-turn lethal commits CD=8 -> the holder\'s NEXT own turn still ticks it to 7', () => {
    const player = makeBodyParticipant('player', createCombatant({ id: 'player', type: 'player', currentHp: 50, maxHp: 1_000 }))
    const enemyP = makeParticipant('enemy', makeEnemy('enemy', 0), 8, 100)
    const battle: TurnBattle = { players: [player], enemies: [enemyP], state: 'fighting' }
    const { combat, runtime } = makeCombatWithSession(player, new SurviveLethalGuard(), [enemyP])

    // Enemy-turn lethal: the commit happens outside any status phase of
    // the holder, so the full cooldown stands and counts down normally.
    combat.applyDirectDamage(player.entity, 9_999, 'enemy')

    expect(player.entity.alive).toBe(true)
    expect(player.ultimate!.remainingCooldownTurns).toBe(8)

    const system = new TurnBattleSystem(combat, 10, REGISTRY, undefined, runtime)
    system.declareActorAction(battle, player)

    expect(player.entity.alive).toBe(true)
    expect(player.ultimate!.remainingCooldownTurns).toBe(7)
  })
})
