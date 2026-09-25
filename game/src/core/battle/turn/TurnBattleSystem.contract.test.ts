import { describe, expect, it, vi } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import type { TurnSkillDefinition } from './TurnSkillAction'
import type { BuffDefinition } from '../../buff2/BuffDefinition'
import { FunctionCombatRng } from '../runtime/rng/FunctionCombatRng'
import type { BuffDefinitionId, CombatEntityId } from '../contracts/ids'
import type { ElementalApplicationCommitted } from '../contracts/events'
import { makeTestBuffRegistry, makeTurnRuntime, type TurnRuntimeFixture } from './testing/TurnRuntimeFixtures'
import {
  attachFixtureReaction as attachFixtureReactionComposition,
  createFixtureElementalStates,
  fixtureElementalDef,
} from './testing/FixtureReaction'

// M7 contract closure (contract spec sec.91-102 + skill whole-stack
// acceptance, megaplan M7.3). ONE canonical composition:
//   TurnSkillDefinition -> LegacySkillAdapter -> SkillResolver ->
//   SkillExecutor -> CombatScheduler -> CombatOperationExecutor ->
//   domain authorities -- the same wiring makeTurnRuntime mirrors from
//   GameManagerTurnBattleOps.mintCycleScheduler.
//
// Reaction scenarios attach the FIXTURE composition documented as the
// deferred production wiring (ElementalStateRegistry + capability query
// + ReactionTriggerGate + ReactionSystem + ReactionDispatcher,
// registered as the 'elemental_application_committed' immediate
// handler). This is test-only: production registers no dispatcher and
// grants elemental_reaction_enabled to nobody.

// ---------------------------------------------------------------------------
// Harness (mirrors TurnBattleSystem.skillPlan.test.ts).
// ---------------------------------------------------------------------------

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
    currentThe: 0,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  } as CombatEntity

  entity.baseStats = (overrides.baseStats ?? overrides.stats ?? entity.baseStats) as CombatEntity['baseStats']
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

// ---------------------------------------------------------------------------
// Fixture definitions -- element ids match the canonical five-element map
// TurnRuntimeFixtures binds into the BuffSystem's ElementalStateRegistry.
// ---------------------------------------------------------------------------

const elementalDef = fixtureElementalDef

const QA_BLEED: BuffDefinition = {
  id: 'qa_bleed',
  name: 'QA Bleed',
  kind: 'ailment',
  instanceScope: 'per_source',
  stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'holder_turns', duration: 3, scaling: 'fixed' },
  application: { resistance: 'none' },
  dispellable: true,
}

const QA_CAM_CONG: BuffDefinition = {
  id: 'qa_cam_cong',
  name: 'QA Cam Cong',
  kind: 'ailment',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'holder_turns', duration: 3, scaling: 'fixed' },
  application: { resistance: 'none' },
  forbiddenActionTags: ['attack'],
  dispellable: true,
}

const QA_DOT: BuffDefinition = {
  id: 'qa_dot',
  name: 'QA DoT',
  kind: 'ailment',
  instanceScope: 'per_source',
  stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'holder_turns', duration: 5, scaling: 'fixed' },
  application: { resistance: 'none' },
  periodic: [
    {
      id: 'qa_dot_tick',
      type: 'damage',
      element: 'physical',
      damageProfile: 'legacy_dot',
      coefficient: 50,
      scaling: 'dynamic',
      timing: 'holder_turn_end',
      stackScaling: 'multiply',
      canCrit: false,
      canMiss: false,
      hitCount: 1,
    },
  ],
  dispellable: true,
}

const QA_REFLECT: BuffDefinition = {
  id: 'qa_reflect',
  name: 'QA Reflect',
  kind: 'buff',
  polarity: 'buff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'keep' },
  lifetime: { clock: 'holder_turns', duration: 5, scaling: 'fixed' },
  capabilities: [
    {
      id: 'qa_reflect.reactive',
      type: 'reactive_trigger',
      payload: {
        trigger: 'onImpactLanded',
        chance: 1,
        reflectsDamage: { maxHpRatio: 1 },
      },
    },
  ],
  dispellable: false,
}

const QA_MARK: BuffDefinition = {
  id: 'qa_mark',
  name: 'QA Mark',
  kind: 'debuff',
  polarity: 'debuff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'holder_turns', duration: 5, scaling: 'fixed' },
  dispellable: true,
}

const QA_EXPIRING: BuffDefinition = {
  id: 'qa_expiring',
  name: 'QA Expiring',
  kind: 'debuff',
  polarity: 'debuff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'keep' },
  lifetime: { clock: 'holder_turns', duration: 1, scaling: 'fixed' },
  dispellable: true,
}

const REGISTRY = makeTestBuffRegistry([
  elementalDef('fire'),
  elementalDef('water'),
  elementalDef('wood'),
  elementalDef('metal'),
  elementalDef('earth'),
  QA_BLEED,
  QA_CAM_CONG,
  QA_DOT,
  QA_REFLECT,
  QA_MARK,
  QA_EXPIRING,
])

const ELEMENTS = createFixtureElementalStates()

// ---------------------------------------------------------------------------
// Battle + runtime builders.
// ---------------------------------------------------------------------------

const BASIC: TurnSkillDefinition = {
  id: 'qa_basic',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'single' },
}

function battleWith(
  actorSkill: TurnSkillDefinition | undefined,
  opts: {
    rng?: FunctionCombatRng
    onSkillCast?: (actor: TurnBattleParticipant, skillId: string) => void
    extraPlayers?: { id: string; skill?: TurnSkillDefinition; speed?: number }[]
    extraEnemies?: { id: string; skill?: TurnSkillDefinition; speed?: number; overrides?: Partial<CombatEntity> }[]
    enemyOverrides?: Partial<CombatEntity>
    enemySkill?: TurnSkillDefinition
  } = {},
) {
  const player = createCombatant('player')
  const enemyEntity = createCombatant('enemy', opts.enemyOverrides)
  enemyEntity.type = 'enemy'

  const playerParticipant = makeParticipant('player', player, 100, 0)
  playerParticipant.basic = BASIC
  if (actorSkill !== undefined) {
    playerParticipant.special = { skill: actorSkill, remainingCooldownTurns: 0 }
  }

  const extraParticipants: TurnBattleParticipant[] = []
  for (const extra of opts.extraPlayers ?? []) {
    const entity = createCombatant(extra.id)
    const participant = makeParticipant(extra.id, entity, extra.speed ?? 50, 0)
    participant.basic = BASIC
    if (extra.skill !== undefined) {
      participant.special = { skill: extra.skill, remainingCooldownTurns: 0 }
    }
    extraParticipants.push(participant)
  }

  const enemyParticipant = makeParticipant('enemy', enemyEntity, 1, 1)
  enemyParticipant.basic = opts.enemySkill ?? BASIC

  const extraEnemies: TurnBattleParticipant[] = []
  for (const extra of opts.extraEnemies ?? []) {
    const entity = createCombatant(extra.id, extra.overrides)
    entity.type = 'enemy'
    const participant = makeParticipant(extra.id, entity, extra.speed ?? 1, 1)
    participant.basic = extra.skill ?? BASIC
    extraEnemies.push(participant)
  }

  const all = [playerParticipant, ...extraParticipants, enemyParticipant, ...extraEnemies]
  const eventBus = new EventBus()
  const combat = new CombatSystem(eventBus)
  const runtime = makeTurnRuntime({
    registry: REGISTRY,
    participants: () => all,
    combatSystem: combat,
    ...(opts.rng !== undefined ? { rng: opts.rng } : {}),
    elements: ELEMENTS,
  })

  const battle: TurnBattle = {
    players: [playerParticipant, ...extraParticipants],
    enemies: [enemyParticipant, ...extraEnemies],
    state: 'fighting',
  }

  const system = new TurnBattleSystem(combat, 100, REGISTRY, undefined, runtime, opts.onSkillCast)

  return { battle, playerParticipant, enemyParticipant, extraParticipants, extraEnemies, system, eventBus, runtime }
}

/** The deferred production wiring shape -- fixture-only composition.
    Grants elemental_reaction_enabled to the listed sources. */
function attachFixtureReaction(runtime: TurnRuntimeFixture, grantedSourceIds: string[]) {
  return attachFixtureReactionComposition({
    runtime,
    registry: REGISTRY,
    elements: ELEMENTS,
    grantedSourceIds,
  })
}

// ---------------------------------------------------------------------------
// Trace probes.
// ---------------------------------------------------------------------------

function settledOps(runtime: TurnRuntimeFixture) {
  return runtime.scheduler.trace.records.map((r) => ({
    operationId: r.operation.operationId,
    type: r.operation.type,
    status: r.result.status,
    reason: 'reason' in r.result ? r.result.reason : undefined,
    sourceId: r.operation.origin.sourceId,
    originKind: r.operation.origin.kind,
    payload: r.operation.payload,
    result: r.result,
  }))
}

function traceEvents(runtime: TurnRuntimeFixture, type: string) {
  return runtime.scheduler.trace.events.filter((e) => e.type === type)
}

function playerHits(runtime: TurnRuntimeFixture) {
  return settledOps(runtime).filter(
    (o) =>
      o.sourceId === 'player' &&
      o.type === 'deal_damage' &&
      (o.payload as { damageProfile?: string }).damageProfile === 'skill_hit',
  )
}

function instancesOf(runtime: TurnRuntimeFixture, targetId: string, definitionId: string) {
  return runtime.buffs
    .getForTarget(targetId as CombatEntityId)
    .filter((i) => i.definitionId === (definitionId as BuffDefinitionId))
}

// ---------------------------------------------------------------------------
// Contract sec.91-102 -- whole-stack canonical composition.
// ---------------------------------------------------------------------------

describe('M7 contract closure -- whole-stack acceptance (sec.91-102)', () => {
  it('sec.91 application failure: no state, no committed event, no Reaction', () => {
    const FAILING: TurnSkillDefinition = {
      id: 'qa_fail_apply',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      appliesAilments: [{ buffDefinitionId: 'hoa_an', chance: 0, stacks: 1 }],
    }
    const { battle, enemyParticipant, system, runtime } = battleWith(FAILING)
    attachFixtureReaction(runtime, ['player'])

    system.resolveNextStep(battle)

    expect(instancesOf(runtime, 'enemy', 'hoa_an')).toHaveLength(0)
    expect(traceEvents(runtime, 'elemental_application_committed')).toHaveLength(0)
    expect(traceEvents(runtime, 'reaction_resolved')).toHaveLength(0)
    expect(settledOps(runtime).filter((o) => o.type.startsWith('consume_buff'))).toHaveLength(0)
    // The failure is observable as a typed event, not silence.
    expect(traceEvents(runtime, 'buff_application_failed')).toHaveLength(1)
    expect(enemyParticipant.entity.alive).toBe(true)
  })

  it('sec.92 max-stack refresh: addedStacks 0, duration refreshes, no Reaction', () => {
    const REAPPLY: TurnSkillDefinition = {
      id: 'qa_reapply',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      appliesAilments: [{ buffDefinitionId: 'hoa_an', chance: 1, stacks: 3 }],
    }
    const { battle, system, runtime } = battleWith(REAPPLY)
    attachFixtureReaction(runtime, ['player'])
    // Seed at cap with a nearly-expired duration so refresh is observable.
    runtime.applyBuff('hoa_an', enemyOf(battle), playerOf(battle), {
      stacks: 5,
      durationOverride: 1,
    })

    system.resolveNextStep(battle)

    const instance = instancesOf(runtime, 'enemy', 'hoa_an')[0]
    expect(instance?.stacks).toBe(5)
    expect(instance?.remaining).toBe(3)
    // Pure refresh emits no elemental_application_committed -> the
    // dispatcher never sees a trigger.
    expect(traceEvents(runtime, 'elemental_application_committed')).toHaveLength(0)
    expect(traceEvents(runtime, 'reaction_resolved')).toHaveLength(0)
    expect(settledOps(runtime).filter((o) => o.operationId.startsWith('rx.'))).toHaveLength(0)
  })

  it('sec.93 generic AddStacks is not an elemental application (no recursion)', () => {
    const APPLY_FIRE: TurnSkillDefinition = {
      id: 'qa_apply_fire',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      appliesAilments: [{ buffDefinitionId: 'hoa_an', chance: 1, stacks: 1 }],
    }
    const { battle, system, runtime } = battleWith(APPLY_FIRE)
    attachFixtureReaction(runtime, ['player'])
    runtime.applyBuff('doc_can', enemyOf(battle), playerOf(battle), { stacks: 3 })

    system.resolveNextStep(battle)

    // duong_viem (wood -> fire sinh) consumed the parent and added one
    // fire stack via AddBuffStacks.
    const addStacks = settledOps(runtime).filter((o) => o.type === 'add_buff_stacks')
    expect(addStacks.length).toBeGreaterThanOrEqual(1)
    expect(addStacks[0]!.status).toBe('resolved')
    // Conversion is NOT an application: exactly one committed event
    // (the triggering fire apply) and exactly one reaction.
    expect(traceEvents(runtime, 'elemental_application_committed')).toHaveLength(1)
    expect(traceEvents(runtime, 'reaction_resolved')).toHaveLength(1)
    expect(instancesOf(runtime, 'enemy', 'doc_can')).toHaveLength(0)
    expect(instancesOf(runtime, 'enemy', 'hoa_an')[0]?.stacks).toBe(2)
  })

  it('sec.94 immediate settlement: a later plan step reads the post-Reaction board', () => {
    const READER: TurnSkillDefinition = {
      id: 'qa_reader',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      appliesAilments: [{ buffDefinitionId: 'liet_thuong', chance: 1, stacks: 1 }],
      appliesBuffs: [{ definitionId: 'hoa_an', target: 'target', stacks: 1 }],
    }
    const { battle, system, runtime } = battleWith(READER)
    attachFixtureReaction(runtime, ['player'])
    runtime.applyBuff('hoa_an', enemyOf(battle), playerOf(battle), { stacks: 2 })

    system.resolveNextStep(battle)

    // dung_kim (fire -> metal khac) consumed BOTH elements inside the
    // hit's barrier, BEFORE the post-cast appliesBuffs lane ran.
    const ops = settledOps(runtime)
    const lastReactionOp = ops.map((o, i) => (o.operationId.startsWith('rx.') ? i : -1)).reduce((a, b) => Math.max(a, b), -1)
    const trailingApply = ops.findIndex(
      (o) =>
        o.type === 'apply_buff' &&
        (o.payload as { definitionId?: string }).definitionId === 'hoa_an',
    )
    expect(lastReactionOp).toBeGreaterThanOrEqual(0)
    expect(trailingApply).toBeGreaterThan(lastReactionOp)

    // The trailing apply saw the post-Reaction board: a FRESH instance
    // (stacksBefore 0), not the pre-Reaction 2-stack one.
    const committed = traceEvents(runtime, 'elemental_application_committed')
    const reapplied = committed.find(
      (e) => (e as ElementalApplicationCommitted).definitionId === ('hoa_an' as BuffDefinitionId),
    ) as ElementalApplicationCommitted | undefined
    expect(reapplied?.stacksBefore).toBe(0)
    expect(instancesOf(runtime, 'enemy', 'liet_thuong')).toHaveLength(0)
    expect(instancesOf(runtime, 'enemy', 'hoa_an')[0]?.stacks).toBe(1)
  })

  it('sec.95 stale snapshot: the whole reaction batch skips atomically', () => {
    const { runtime, enemyParticipant, playerParticipant } = battleWith(BASIC)
    // Seed a live participant instance, then hand the scheduler a batch
    // whose precondition expects a different stack count.
    runtime.applyBuff('hoa_an', enemyParticipant, playerParticipant, { stacks: 2 })
    const instance = instancesOf(runtime, 'enemy', 'hoa_an')[0]!
    runtime.scheduler.registerImmediateHandler('elemental_application_committed', () => ({
      kind: 'batch',
      batch: {
        batchId: 'rxbatch.contract.stale',
        origin: {
          kind: 'reaction',
          originId: 'dung_kim',
          sourceId: 'player' as CombatEntityId,
          rootActionId: 'root.contract.stale',
        },
        preconditions: [
          {
            kind: 'buff_participant',
            instanceId: instance.instanceId,
            expectedSourceId: 'player' as CombatEntityId,
            expectedTargetId: 'enemy' as CombatEntityId,
            expectedStacks: 99, // live instance has 2 -> stale
          },
        ],
        operations: [
          {
            type: 'consume_buff_stacks',
            operationId: 'rx.contract.stale.consume' as never,
            origin: {
              kind: 'reaction',
              originId: 'dung_kim',
              sourceId: 'player' as CombatEntityId,
              rootActionId: 'root.contract.stale',
            },
            payload: {
              selector: { kind: 'instance', instanceId: instance.instanceId },
              stacks: 'all',
              removalReason: 'reaction',
            },
          },
          {
            type: 'deal_damage',
            operationId: 'rx.contract.stale.damage' as never,
            origin: {
              kind: 'reaction',
              originId: 'dung_kim',
              sourceId: 'player' as CombatEntityId,
              rootActionId: 'root.contract.stale',
            },
            payload: {
              targetId: 'enemy' as CombatEntityId,
              damageProfile: 'reaction',
              coefficient: 1,
              hitCount: 1,
              canCrit: false,
              canMiss: false,
            },
          },
        ],
      },
    }))

    const { sink } = runtime.scheduler.createLifecycleSink('root.contract.stale')
    sink.emit({
      type: 'elemental_application_committed',
      instanceId: instance.instanceId,
      sourceId: 'player' as CombatEntityId,
      targetId: 'enemy' as CombatEntityId,
      definitionId: 'hoa_an' as BuffDefinitionId,
      element: 'fire',
      stacksBefore: 0,
      stacksAfter: 2,
      requestedStacks: 2,
      addedStacks: 2,
      reactionEligibility: 'eligible',
      origin: {
        kind: 'skill',
        originId: 'contract_stale',
        sourceId: 'player' as CombatEntityId,
        rootActionId: 'root.contract.stale',
      },
    })
    runtime.scheduler.run()

    // Atomic stale-skip: zero ops executed, the batch skip is recorded,
    // the seeded instance is untouched (no partial consumption).
    expect(runtime.scheduler.trace.batchSkips).toHaveLength(1)
    expect(runtime.scheduler.trace.batchSkips[0]!.batchId).toBe('rxbatch.contract.stale')
    expect(runtime.scheduler.trace.batchSkips[0]!.reason).toBe('stale_reaction_snapshot')
    expect(settledOps(runtime).filter((o) => o.operationId.startsWith('rx.contract.stale'))).toHaveLength(0)
    expect(instancesOf(runtime, 'enemy', 'hoa_an')[0]?.stacks).toBe(2)
    expect(enemyParticipant.entity.currentHp).toBe(enemyParticipant.entity.maxHp)
  })

  it('sec.96 death mid-batch: committed ops stay, trailing op skips, no rollback', () => {
    const KILLER: TurnSkillDefinition = {
      id: 'qa_killer',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 0.01 },
      targeting: { shape: 'single' },
      appliesAilments: [{ buffDefinitionId: 'han_tuc', chance: 1, stacks: 1 }],
    }
    // The skill hit cannot kill (multiplier 0.01 vs 500k hp); the
    // tran_thuy payoff (earth -> water khac: reaction_damage coefficient
    // ~1e9, plus a trailing apply_status qa_bleed on the now-dead
    // target) runs inside the cast's barrier.
    const { battle, enemyParticipant, system, runtime } = battleWith(KILLER, {
      enemyOverrides: { currentHp: 500_000, maxHp: 1_000_000 },
    })
    attachFixtureReaction(runtime, ['player'])
    runtime.applyBuff('tran_an', enemyParticipant, playerOf(battle), { stacks: 4 })

    system.resolveNextStep(battle)

    const ops = settledOps(runtime)
    const rxOps = ops.filter((o) => o.operationId.startsWith('rx.'))
    // consume(earth) + consume(water) + damage committed; the trailing
    // apply_buff on the now-dead target skips invalid_target_state.
    expect(rxOps.map((o) => o.type)).toEqual([
      'consume_buff_stacks',
      'consume_buff_stacks',
      'deal_damage',
    ])
    expect(rxOps.every((o) => o.status === 'resolved')).toBe(true)
    // Skipped ops land in the trace's skipped-results lane (they never
    // dispatched, so there is no execution record).
    const rxSkips = runtime.scheduler.trace.skippedResults.filter((r) =>
      r.operationId.startsWith('rx.'),
    )
    expect(rxSkips).toHaveLength(1)
    expect(rxSkips[0]!.type).toBe('apply_buff')
    expect(rxSkips[0]!.reason).toBe('invalid_target_state')
    expect(enemyParticipant.entity.alive).toBe(false)
    // No rollback: consumed stacks stay consumed; no bleed on the corpse.
    expect(instancesOf(runtime, 'enemy', 'tran_an')).toHaveLength(0)
    expect(instancesOf(runtime, 'enemy', 'han_tuc')).toHaveLength(0)
    expect(instancesOf(runtime, 'enemy', 'qa_bleed')).toHaveLength(0)
  })

  it('sec.97 exactly once: a duplicated eventId processes once', () => {
    const { runtime, enemyParticipant, playerParticipant } = battleWith(BASIC)
    const { reactionSystem } = attachFixtureReaction(runtime, ['player'])
    runtime.applyBuff('han_tuc', enemyParticipant, playerParticipant, { stacks: 2 })
    // The board read is real state: the committed event must mirror an
    // actual application, so hoa_an is applied via the authority first.
    runtime.applyBuff('hoa_an', enemyParticipant, playerParticipant, { stacks: 1 })
    const instance = instancesOf(runtime, 'enemy', 'hoa_an')[0]!

    const pending: ElementalApplicationCommitted = {
      eventId: 'evt.contract.dup.1' as never,
      type: 'elemental_application_committed',
      instanceId: instance.instanceId,
      sourceId: 'player' as CombatEntityId,
      targetId: 'enemy' as CombatEntityId,
      definitionId: 'hoa_an' as BuffDefinitionId,
      element: 'fire',
      stacksBefore: 0,
      stacksAfter: 1,
      requestedStacks: 1,
      addedStacks: 1,
      reactionEligibility: 'eligible',
      origin: {
        kind: 'skill',
        originId: 'contract_dup',
        sourceId: 'player' as CombatEntityId,
        rootActionId: 'root.contract.dup',
      },
      combatSequence: 1,
    }
    const spy = vi.spyOn(reactionSystem, 'evaluateAfterElementalApplication')
    runtime.scheduler.enqueueEvent(pending)
    runtime.scheduler.enqueueEvent(pending) // duplicate delivery
    runtime.scheduler.run()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(traceEvents(runtime, 'reaction_resolved')).toHaveLength(1)
    // tuc_viem is khac: one batch consumes BOTH participants exactly once
    // (a second evaluation would mint a second pair of consumes).
    expect(
      settledOps(runtime).filter((o) => o.type === 'consume_buff_stacks'),
    ).toHaveLength(2)
  })

  it('sec.98 sequential multicast: each execution settles fully before the next', () => {
    const STORM: TurnSkillDefinition = {
      id: 'qa_storm',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      appliesAilments: [{ buffDefinitionId: 'liet_thuong', chance: 1, stacks: 1 }],
      multicast: { chance: 1, maxExtraCasts: 1 },
    }
    const { battle, system, runtime } = battleWith(STORM)
    attachFixtureReaction(runtime, ['player'])
    runtime.applyBuff('hoa_an', enemyOf(battle), playerOf(battle), { stacks: 2 })

    system.resolveNextStep(battle) // original execution
    system.resolveNextStep(battle) // multicast-sourced follow-up

    const ops = settledOps(runtime)
    const metalApplies = ops
      .map((o, i) => ({ i, o }))
      .filter(
        ({ o }) =>
          o.type === 'apply_buff' &&
          (o.payload as { definitionId?: string }).definitionId === 'liet_thuong',
      )
    expect(metalApplies).toHaveLength(2)
    // The first execution's reaction batch settled before the second
    // execution's apply -- sequential, never interleaved.
    const lastRx = ops.map((o, i) => (o.operationId.startsWith('rx.') ? i : -1)).reduce((a, b) => Math.max(a, b), -1)
    expect(lastRx).toBeGreaterThanOrEqual(0)
    expect(lastRx).toBeLessThan(metalApplies[1]!.i)
    // Second execution saw the settled board: fresh metal instance.
    expect(instancesOf(runtime, 'enemy', 'liet_thuong')[0]?.stacks).toBe(1)
    expect(traceEvents(runtime, 'reaction_resolved')).toHaveLength(1)
  })

  it('sec.99 source isolation: another caster\'s stacks are not consumable', () => {
    const APPLY_METAL: TurnSkillDefinition = {
      id: 'qa_apply_metal',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      appliesAilments: [{ buffDefinitionId: 'liet_thuong', chance: 1, stacks: 1 }],
    }
    const { battle, extraParticipants, system, runtime } = battleWith(APPLY_METAL, {
      extraPlayers: [{ id: 'ally' }],
    })
    attachFixtureReaction(runtime, ['player'])
    // The fire on the enemy belongs to ALLY -- the player's metal pairs
    // with nothing on the player's own board.
    runtime.applyBuff('hoa_an', enemyOf(battle), extraParticipants[0]!, { stacks: 5 })

    system.resolveNextStep(battle)

    expect(traceEvents(runtime, 'reaction_resolved')).toHaveLength(0)
    expect(settledOps(runtime).filter((o) => o.operationId.startsWith('rx.'))).toHaveLength(0)
    // Ally's fire is untouched; the player's metal committed normally.
    expect(instancesOf(runtime, 'enemy', 'hoa_an')[0]?.stacks).toBe(5)
    expect(instancesOf(runtime, 'enemy', 'liet_thuong')).toHaveLength(1)
  })

  it('sec.100 damage origins: skill / buff_periodic / reaction stay distinct', () => {
    const MIXED: TurnSkillDefinition = {
      id: 'qa_mixed',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      appliesAilments: [{ buffDefinitionId: 'liet_thuong', chance: 1, stacks: 1 }],
    }
    const { battle, enemyParticipant, playerParticipant, system, runtime } = battleWith(MIXED)
    attachFixtureReaction(runtime, ['player'])
    runtime.applyBuff('hoa_an', enemyParticipant, playerParticipant, { stacks: 2 })
    runtime.applyBuff('qa_dot', enemyParticipant, playerParticipant, { stacks: 1 })

    system.resolveNextStep(battle) // skill hit + metal apply + dung_kim
    runtime.tickHolderTurnsEnd(enemyParticipant.entity.id) // periodic tick

    const damageOrigins = settledOps(runtime)
      .filter((o) => o.type === 'deal_damage')
      .map((o) => o.originKind)
    expect(damageOrigins).toContain('skill')
    expect(damageOrigins).toContain('reaction')
    expect(damageOrigins).toContain('buff_periodic')
  })

  it('sec.101 Cam Cong: attack rejected, non-attack allowed, not stunned', () => {
    const SUPPORT: TurnSkillDefinition = {
      id: 'qa_support',
      cooldownTurns: 0,
      targeting: { shape: 'single' },
      appliesBuffs: [{ definitionId: 'qa_mark', target: 'target', stacks: 1 }],
    }
    const { battle, playerParticipant, system, runtime } = battleWith(SUPPORT)
    runtime.applyBuff('qa_cam_cong', playerParticipant, playerParticipant, { stacks: 1 })

    system.resolveNextStep(battle)

    // The untagged non-attack special still executes under the seal --
    // Cam Cong forbids 'attack' only, never the turn itself.
    const playerOps = settledOps(runtime).filter((o) => o.sourceId === 'player')
    expect(playerOps.some((o) => o.type === 'apply_buff')).toBe(true)
    expect(playerOps.some((o) => o.type === 'deal_damage')).toBe(false)
    expect(
      instancesOf(runtime, 'enemy', 'qa_mark').length +
        instancesOf(runtime, 'player', 'qa_mark').length,
    ).toBeGreaterThanOrEqual(1)
  })

  it('sec.101b Cam Cong: an attack-only sealed actor yields no player ops', () => {
    const { battle, playerParticipant, system, runtime } = battleWith(undefined)
    runtime.applyBuff('qa_cam_cong', playerParticipant, playerParticipant, { stacks: 1 })

    system.resolveNextStep(battle)

    expect(settledOps(runtime).filter((o) => o.sourceId === 'player')).toHaveLength(0)
  })

  it('sec.102 lifecycle exception: internal expiry mints no CombatOperation', () => {
    const { battle, enemyParticipant, playerParticipant, system, runtime } = battleWith(BASIC)
    runtime.applyBuff('qa_expiring', enemyParticipant, playerParticipant, { stacks: 1 })
    const before = settledOps(runtime).length

    runtime.tickHolderTurnsEnd(enemyParticipant.entity.id)

    // BuffSystem expired its own instance inside the lifecycle barrier
    // -- no remove_buff/consume op was constructed for the removal.
    expect(instancesOf(runtime, 'enemy', 'qa_expiring')).toHaveLength(0)
    const newOps = settledOps(runtime).slice(before)
    expect(newOps.filter((o) => o.type === 'remove_buff' || o.type === 'consume_buff_stacks')).toHaveLength(0)
    expect(
      traceEvents(runtime, 'buff_removed').some(
        (e) => (e as { reason?: string }).reason === 'expired',
      ),
    ).toBe(true)
    void system
    void battle
  })
})

// ---------------------------------------------------------------------------
// Skill whole-stack acceptance (M7.3): real TBS composition, not isolated
// executor tests -- commit/economy semantics ride the production routing.
// ---------------------------------------------------------------------------

describe('M7 contract closure -- skill whole-stack acceptance', () => {
  const STRIKE: TurnSkillDefinition = {
    id: 'qa_strike',
    cooldownTurns: 2,
    damage: { kind: 'physical', multiplier: 2 },
    targeting: { shape: 'single' },
  }

  it('whiff never rolls back the committed cost + cooldown', () => {
    const COSTED: TurnSkillDefinition = {
      ...STRIKE,
      resourceType: 'mana',
      resourceCost: 40,
    }
    // Deterministic whiff: hitChance = accuracy/(accuracy+evasion) with
    // a hard 5% floor (Accuracy.ts), so 0 accuracy + 100 evasion -> 5%
    // and an injected 0.99 roll always misses. Math.random could land.
    const { battle, playerParticipant, enemyParticipant, system, runtime } =
      battleWith(COSTED, { rng: new FunctionCombatRng(() => 0.99) })
    // Stat refresh rebuilds entity.stats from baseStats -- write the
    // override into BOTH or the refresh restores the authored evasion.
    enemyParticipant.entity.baseStats = asBaseStats({ ...enemyParticipant.entity.baseStats, evasionRate: 100 })
    enemyParticipant.entity.stats = { ...enemyParticipant.entity.stats, evasionRate: 100 }
    playerParticipant.entity.baseStats = asBaseStats({ ...playerParticipant.entity.baseStats, accuracyRating: 0 })
    playerParticipant.entity.stats = { ...playerParticipant.entity.stats, accuracyRating: 0 }
    playerParticipant.entity.stats = { ...playerParticipant.entity.stats, maxMp: 200 }
    playerParticipant.entity.baseStats = asBaseStats({ ...playerParticipant.entity.baseStats, maxMp: 200 })
    playerParticipant.entity.currentMp = 200

    system.resolveNextStep(battle)

    const hits = playerHits(runtime)
    expect(hits.length).toBeGreaterThanOrEqual(1)
    expect(
      hits.every((h) => (h.result as { damage?: { landed?: boolean } }).damage?.landed === false),
    ).toBe(true)
    // Commit happened anyway -- whiff is a landed:false outcome, not a
    // cast cancellation.
    expect(playerParticipant.entity.currentMp).toBe(160)
    expect(playerParticipant.special!.remainingCooldownTurns).toBe(2)
  })

  it('repeat + multicast executions never repay the committed cast', () => {
    const STORM: TurnSkillDefinition = {
      ...STRIKE,
      resourceType: 'mana',
      resourceCost: 30,
      repeatCasts: 1,
      multicast: { chance: 1, maxExtraCasts: 1 },
    }
    const onSkillCast = vi.fn()
    const { battle, playerParticipant, system, runtime } = battleWith(STORM, { onSkillCast })
    playerParticipant.entity.stats = { ...playerParticipant.entity.stats, maxMp: 200 }
    playerParticipant.entity.baseStats = asBaseStats({ ...playerParticipant.entity.baseStats, maxMp: 200 })
    playerParticipant.entity.currentMp = 200

    system.resolveNextStep(battle) // original
    system.resolveNextStep(battle) // repeat
    system.resolveNextStep(battle) // multicast (chance 1)

    expect(playerHits(runtime)).toHaveLength(3)
    // One commit: one mana debit, one cooldown, one cast sink.
    expect(playerParticipant.entity.currentMp).toBe(170)
    expect(playerParticipant.special!.remainingCooldownTurns).toBe(2)
    expect(onSkillCast).toHaveBeenCalledTimes(1)
    expect(
      settledOps(runtime).filter(
        (o) =>
          o.type === 'consume_resource' &&
          (o.payload as { resourceId?: string }).resourceId === 'mana',
      ),
    ).toHaveLength(1)
  })

  it('a dead target mid-plan skips trailing steps; committed steps stay', () => {
    const COMBO: TurnSkillDefinition = {
      id: 'qa_combo',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      appliesBuffs: [{ definitionId: 'qa_mark', target: 'target', stacks: 1 }],
    }
    const { battle, enemyParticipant, system, runtime } = battleWith(COMBO, {
      enemyOverrides: { currentHp: 1, maxHp: 1_000_000 },
    })

    system.resolveNextStep(battle)

    expect(enemyParticipant.entity.alive).toBe(false)
    // The post-cast apply never committed a buff on the corpse.
    expect(instancesOf(runtime, 'enemy', 'qa_mark')).toHaveLength(0)
  })

  it('source death mid-cast drops the queued repeat without fault', () => {
    const REPEATER: TurnSkillDefinition = {
      ...STRIKE,
      repeatCasts: 1,
    }
    // Queued executions drain before any gauge turn, so an enemy attack
    // can never interpose between cast and repeat -- the in-cast death
    // path is the defender's reflect firing inside hit settlement.
    const { battle, enemyParticipant, playerParticipant, system, runtime } =
      battleWith(REPEATER, { extraPlayers: [{ id: 'ally' }] })
    runtime.applyBuff('qa_reflect', enemyParticipant, enemyParticipant, {})
    playerParticipant.entity.currentHp = 1

    system.resolveNextStep(battle) // hit lands -> reflect kills the caster

    expect(playerParticipant.entity.alive).toBe(false)
    expect(playerHits(runtime)).toHaveLength(1)

    // The battle continues on the surviving ally; the dead caster's
    // queued repeat drains as a drop, never as a second execution.
    for (let i = 0; i < 10 && battle.state === 'fighting'; i++) {
      system.resolveNextStep(battle)
    }
    expect(playerHits(runtime)).toHaveLength(1)
  })

  it('battle end during queued consequences: follow-ups never execute', () => {
    const REPEATER: TurnSkillDefinition = {
      ...STRIKE,
      repeatCasts: 1,
      damage: { kind: 'physical', multiplier: 500 },
    }
    const { battle, enemyParticipant, system, runtime } = battleWith(REPEATER, {
      enemyOverrides: { currentHp: 1, maxHp: 1_000_000 },
    })

    system.resolveNextStep(battle) // kills the only enemy -> battle ends

    expect(enemyParticipant.entity.alive).toBe(false)
    const opsAfterDeath = settledOps(runtime).length
    for (let i = 0; i < 6; i++) {
      system.resolveNextStep(battle)
    }
    // The queued repeat produced no further executions -- the battle is
    // over and the scheduler queue does not mint phantom actions.
    expect(settledOps(runtime).length).toBe(opsAfterDeath)
    expect(playerHits(runtime)).toHaveLength(1)
  })

  it('composite extra picks never repay the committed cast', () => {
    const PICK_A: TurnSkillDefinition = {
      id: 'qa_pick_a',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
    }
    const PICK_B: TurnSkillDefinition = {
      id: 'qa_pick_b',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
    }
    const COMPOSITE: TurnSkillDefinition = {
      ...STRIKE,
      resourceType: 'mana',
      resourceCost: 30,
      compositePicks: { poolType: 'element_basic', count: 2, pool: [PICK_A, PICK_B] },
    }
    const onSkillCast = vi.fn()
    const { battle, playerParticipant, system, runtime } = battleWith(COMPOSITE, { onSkillCast })
    playerParticipant.entity.baseStats = asBaseStats({ ...playerParticipant.entity.baseStats, maxMp: 200 })
    playerParticipant.entity.stats = { ...playerParticipant.entity.stats, maxMp: 200 }
    playerParticipant.entity.currentMp = 200

    system.resolveNextStep(battle) // one cast -> picks[0] + one extra pick

    // Both picks landed inside the same execution; cast identity stayed
    // on the root -- one mana debit, one cooldown, one cast sink.
    expect(playerHits(runtime).length).toBeGreaterThanOrEqual(2)
    expect(playerParticipant.entity.currentMp).toBe(170)
    expect(playerParticipant.special!.remainingCooldownTurns).toBe(2)
    expect(onSkillCast).toHaveBeenCalledTimes(1)
    expect(
      settledOps(runtime).filter(
        (o) =>
          o.type === 'consume_resource' &&
          (o.payload as { resourceId?: string }).resourceId === 'mana',
      ),
    ).toHaveLength(1)
  })

  it('charge init commits once; the deferred resolve never recommits', () => {
    const CHARGE: TurnSkillDefinition = {
      id: 'qa_charge',
      cooldownTurns: 5,
      chargeTurns: 2,
      resourceType: 'mana',
      resourceCost: 40,
      damage: { kind: 'physical', multiplier: 2 },
      targeting: { shape: 'single' },
    }
    const { battle, playerParticipant, system, runtime } = battleWith(CHARGE)
    playerParticipant.entity.baseStats = asBaseStats({ ...playerParticipant.entity.baseStats, maxMp: 200 })
    playerParticipant.entity.stats = { ...playerParticipant.entity.stats, maxMp: 200 }
    playerParticipant.entity.currentMp = 200

    system.resolveNextStep(battle) // charge INIT -- the cast commits here

    expect(playerParticipant.entity.currentMp).toBe(160)
    expect(playerParticipant.special!.remainingCooldownTurns).toBe(5)
    expect(playerParticipant.chargingTurnsRemaining).toBe(2)
    expect(playerHits(runtime)).toHaveLength(0)

    // Charging turns tick down; the deferred resolve lands on the last
    // one (a chargeTickTurns=2 def resolves on the second later turn).
    for (let i = 0; i < 8 && playerHits(runtime).length === 0; i++) {
      system.resolveNextStep(battle)
    }

    expect(playerHits(runtime).length).toBeGreaterThanOrEqual(1)
    // The resolve routed payloadOnly: mana never moved a second time
    // and exactly one consume_resource exists in the whole journal.
    expect(playerParticipant.entity.currentMp).toBe(160)
    expect(
      settledOps(runtime).filter(
        (o) =>
          o.type === 'consume_resource' &&
          (o.payload as { resourceId?: string }).resourceId === 'mana',
      ),
    ).toHaveLength(1)
  })

  it('a target that dies mid-charge leaves the deferred resolve safe', () => {
    const CHARGE: TurnSkillDefinition = {
      id: 'qa_charge_dead',
      cooldownTurns: 5,
      chargeTurns: 2,
      damage: { kind: 'physical', multiplier: 2 },
      targeting: { shape: 'single' },
    }
    const { battle, enemyParticipant, extraEnemies, system, runtime } =
      battleWith(CHARGE, {
        enemyOverrides: { currentHp: 40 },
        extraEnemies: [{ id: 'enemy2' }],
      })
    // A holder-turn-end DoT tick kills the primary target mid-charge
    // while a second enemy keeps the battle alive.
    runtime.applyBuff('qa_dot', enemyParticipant, enemyParticipant, { stacks: 1 })

    system.resolveNextStep(battle) // charge init -- target still alive
    expect(enemyParticipant.entity.alive).toBe(true)
    runtime.tickHolderTurnsEnd(enemyParticipant.entity.id)
    expect(enemyParticipant.entity.alive).toBe(false)

    for (let i = 0; i < 10; i++) {
      system.resolveNextStep(battle)
    }

    // The resolve re-collected targets at declare: the corpse took no
    // hit, the surviving enemy absorbed the deferred swing, and nothing
    // faulted.
    expect(enemyParticipant.entity.alive).toBe(false)
    expect(
      settledOps(runtime).filter(
        (o) =>
          o.sourceId === 'player' &&
          o.type === 'deal_damage' &&
          (o.payload as { targetId?: string }).targetId === 'enemy',
      ),
    ).toHaveLength(0)
    expect(
      settledOps(runtime).filter(
        (o) =>
          o.sourceId === 'player' &&
          o.type === 'deal_damage' &&
          (o.payload as { targetId?: string }).targetId === 'enemy2',
      ).length,
    ).toBeGreaterThanOrEqual(1)
    expect(runtime.scheduler.trace.faults).toHaveLength(0)
  })

  it('unrouted cast: loud report + no-op, never the production legacy lane', () => {
    const CLOSURE_DEF: TurnSkillDefinition = {
      id: 'qa_closure',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 2 },
      targeting: { shape: 'single' },
      instances: {
        count: 2,
        perInstanceOptions: () => ({}),
      },
    }
    const { battle, enemyParticipant, system, runtime } = battleWith(CLOSURE_DEF)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    system.resolveNextStep(battle)

    expect(enemyParticipant.entity.currentHp).toBe(enemyParticipant.entity.maxHp)
    expect(playerHits(runtime)).toHaveLength(0)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("'qa_closure'"))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('perInstanceOptions'))
    warn.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// Locators (declared late -- used by the reaction tests above).
// ---------------------------------------------------------------------------

function playerOf(battle: TurnBattle): TurnBattleParticipant {
  const p = battle.players[0]
  if (p === undefined) throw new Error('no player participant')
  return p
}

function enemyOf(battle: TurnBattle): TurnBattleParticipant {
  const e = battle.enemies[0]
  if (e === undefined) throw new Error('no enemy participant')
  return e
}
