import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import type { TurnSkillDefinition } from './TurnSkillAction'
import type { BuffDefinition } from '../../buff2/BuffDefinition'
import { FunctionCombatRng } from '../runtime/rng/FunctionCombatRng'
import { SeededCombatRng } from '../runtime/rng/SeededCombatRng'
import type { CombatRng } from '../contracts/rng'
import type { BuffDefinitionId, CombatEntityId } from '../contracts/ids'
import type { CombatEvent } from '../contracts/events'
import { CombatTraceExporter, type CombatTraceExport } from '../runtime/scheduler/CombatTraceExporter'
import { makeTestBuffRegistry, makeTurnRuntime, type TurnRuntimeFixture } from './testing/TurnRuntimeFixtures'
import {
  attachFixtureReaction,
  createFixtureElementalStates,
  fixtureElementalDef,
} from './testing/FixtureReaction'

// M7.4 -- determinism & trace closure (megaplan M7.4):
//   1. same-seed whole battle -> identical final state + identical
//      exported trace (records, events, skipped results, causal fields).
//   2. controlled rolls on opposite sides of a threshold -> the exact
//      expected divergence, never a bare not.toEqual.
//   3. causal graph -> provenance rebuildable from causation fields
//      alone (rootActionId / causationOperationId / causationEventId /
//      castId / subcastIndex / reactionId).
//   4. CombatTraceExporter -> executions + events + faults + batchSkips
//      + skippedResults + chronological journal over a REAL battle.
//
// Determinism surface: the SAME CombatRng feeds every roll channel --
// makeTurnRuntime (application resolver, damage-adapter policy rolls,
// proc system, combatSystem.setRandomSource hit/crit/armor channel)
// AND the TurnBattleSystem engine rolls (composite picks, multicast
// chance) -- matching production, which injects this.combatRng into
// both (GameManagerTurnBattleOps). Loot rolls stay on Math.random by
// contract (spec C3 -- outside the session boundary).

// ---------------------------------------------------------------------------
// Harness (contract-suite parity -- rng additionally injected into TBS).
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
// Fixture definitions.
// ---------------------------------------------------------------------------

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

// on_hit_proc capability -- a landed player hit procs a qa_mark apply
// onto the victim through the proc channel (origin.kind 'proc').
const QA_ONHIT: BuffDefinition = {
  id: 'qa_onhit',
  name: 'QA On-Hit',
  kind: 'buff',
  polarity: 'buff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'keep' },
  lifetime: { clock: 'holder_turns', duration: 10, scaling: 'fixed' },
  capabilities: [
    {
      id: 'qa_onhit.proc',
      type: 'on_hit_proc',
      payload: { chance: 1, appliesBuffId: 'qa_mark' },
    },
  ],
  dispellable: false,
}

const REGISTRY = makeTestBuffRegistry([
  fixtureElementalDef('fire'),
  fixtureElementalDef('water'),
  fixtureElementalDef('wood'),
  fixtureElementalDef('metal'),
  fixtureElementalDef('earth'),
  QA_BLEED,
  QA_DOT,
  QA_MARK,
  QA_ONHIT,
])

const ELEMENTS = createFixtureElementalStates()

const BASIC: TurnSkillDefinition = {
  id: 'det_basic',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'single' },
}

function battleWith(opts: {
  rng: CombatRng
  actorSkill?: TurnSkillDefinition
  enemyOverrides?: Partial<CombatEntity>
  extraEnemies?: { id: string; overrides?: Partial<CombatEntity>; speed?: number }[]
  extraPlayers?: { id: string; speed?: number }[]
}) {
  const player = createCombatant('player')
  const enemyEntity = createCombatant('enemy', opts.enemyOverrides)
  enemyEntity.type = 'enemy'

  const playerParticipant = makeParticipant('player', player, 100, 0)
  playerParticipant.basic = BASIC
  if (opts.actorSkill !== undefined) {
    playerParticipant.special = { skill: opts.actorSkill, remainingCooldownTurns: 0 }
  }

  const extraParticipants: TurnBattleParticipant[] = []
  for (const extra of opts.extraPlayers ?? []) {
    const entity = createCombatant(extra.id)
    const participant = makeParticipant(extra.id, entity, extra.speed ?? 50, 0)
    participant.basic = BASIC
    extraParticipants.push(participant)
  }

  const enemyParticipant = makeParticipant('enemy', enemyEntity, 1, 1)
  enemyParticipant.basic = BASIC

  const extraEnemies: TurnBattleParticipant[] = []
  for (const extra of opts.extraEnemies ?? []) {
    const entity = createCombatant(extra.id, extra.overrides)
    entity.type = 'enemy'
    const participant = makeParticipant(extra.id, entity, extra.speed ?? 1, 1)
    participant.basic = BASIC
    extraEnemies.push(participant)
  }

  const all = [playerParticipant, ...extraParticipants, enemyParticipant, ...extraEnemies]
  const eventBus = new EventBus()
  const combat = new CombatSystem(eventBus)
  const runtime = makeTurnRuntime({
    registry: REGISTRY,
    participants: () => all,
    combatSystem: combat,
    rng: opts.rng,
    elements: ELEMENTS,
  })

  const battle: TurnBattle = {
    players: [playerParticipant, ...extraParticipants],
    enemies: [enemyParticipant, ...extraEnemies],
    state: 'fighting',
  }

  // Same CombatRng as the runtime bundle -- production parity
  // (GameManagerTurnBattleOps passes this.combatRng into both).
  const system = new TurnBattleSystem(
    combat,
    100,
    REGISTRY,
    undefined,
    runtime,
    undefined,
    undefined,
    opts.rng,
  )

  return { battle, playerParticipant, enemyParticipant, extraParticipants, extraEnemies, system, runtime }
}

// ---------------------------------------------------------------------------
// Probes + snapshot.
// ---------------------------------------------------------------------------

function settledOps(runtime: TurnRuntimeFixture) {
  return runtime.scheduler.trace.records.map((r) => ({
    operationId: r.operation.operationId,
    type: r.operation.type,
    status: r.result.status,
    sourceId: r.operation.origin.sourceId,
    originKind: r.operation.origin.kind,
    payload: r.operation.payload,
    result: r.result,
  }))
}

function traceEvents(runtime: TurnRuntimeFixture, type: string) {
  return runtime.scheduler.trace.events.filter((e) => e.type === type)
}

/** Event rootActionId accessor -- CombatEventBase carries none; most
    types stamp it top-level while ElementalApplicationCommitted /
    BuffApplicationFailedEvent carry it inside `origin`. Fault events
    carry neither (out-of-band diagnostics, never a causation parent). */
function eventRoot(event: CombatEvent): string | undefined {
  if ('rootActionId' in event) return event.rootActionId
  if ('origin' in event) return event.origin.rootActionId
  return undefined
}

function instancesOf(runtime: TurnRuntimeFixture, targetId: string, definitionId: string) {
  return runtime.buffs
    .getForTarget(targetId as CombatEntityId)
    .filter((i) => i.definitionId === (definitionId as BuffDefinitionId))
}

/** Whole-state digest + the full exported trace -- the same-seed parity
    assertion compares this verbatim (state AND causal metadata). */
function battleSnapshot(
  battle: TurnBattle,
  participants: readonly TurnBattleParticipant[],
  runtime: TurnRuntimeFixture,
) {
  return {
    state: battle.state,
    totalTurnsElapsed: battle.totalTurnsElapsed ?? 0,
    roundsElapsed: battle.roundsElapsed ?? 0,
    participants: participants.map((p) => ({
      id: p.id,
      hp: p.entity.currentHp,
      maxHp: p.entity.maxHp,
      alive: p.entity.alive,
      mp: p.entity.currentMp,
      the: p.entity.currentThe,
      ward: p.entity.currentWard,
      actionGauge: p.actionGauge,
      cooldown: p.special?.remainingCooldownTurns ?? null,
      charging: p.chargingTurnsRemaining ?? null,
      buffs: runtime.buffs.getForTarget(p.entity.id as CombatEntityId).map((i) => ({
        instanceId: i.instanceId,
        definitionId: i.definitionId,
        sourceId: i.sourceId,
        stacks: i.stacks,
        remaining: i.remaining ?? null,
        continuousTurns: i.continuousTurns,
        createdSequence: i.createdSequence,
        lastAppliedSequence: i.lastAppliedSequence,
      })),
    })),
    export: new CombatTraceExporter(runtime.scheduler.trace).export(),
  }
}

// ---------------------------------------------------------------------------
// The representative battle -- exercises every consequence channel the
// determinism contract names: skill damage, buff application, periodic
// damage, resource mutation, proc, repeat/multicast, death, fixture
// Reaction. The script is a fixed command list; the only entropy source
// is the injected seed.
// ---------------------------------------------------------------------------

const DET_STRIKE: TurnSkillDefinition = {
  id: 'det_strike',
  cooldownTurns: 3,
  resourceType: 'mana',
  resourceCost: 30,
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'single' },
  appliesAilments: [{ buffDefinitionId: 'liet_thuong', chance: 1, stacks: 1 }],
  repeatCasts: 1,
  multicast: { chance: 1, maxExtraCasts: 1 },
}

function runRepresentativeBattle(seed: number) {
  const rng = new SeededCombatRng(seed)
  const { battle, playerParticipant, enemyParticipant, extraEnemies, system, runtime } =
    battleWith({
      rng,
      actorSkill: DET_STRIKE,
      // ~140 hp: three mult-1 hits (might 10) leave it standing; the
      // 3-stack qa_dot tick (~150) kills it mid-script.
      enemyOverrides: { currentHp: 140 },
      extraEnemies: [{ id: 'enemy2' }],
    })
  attachFixtureReaction({
    runtime,
    registry: REGISTRY,
    elements: ELEMENTS,
    grantedSourceIds: ['player'],
  })
  playerParticipant.entity.baseStats = asBaseStats({ ...playerParticipant.entity.baseStats, maxMp: 200 })
  playerParticipant.entity.stats = { ...playerParticipant.entity.stats, maxMp: 200 }
  playerParticipant.entity.currentMp = 200

  // Seed: fire on enemy1 (dung_kim parent), the DoT that kills it, and
  // the attacker's on-hit proc grant.
  runtime.applyBuff('hoa_an', enemyParticipant, playerParticipant, { stacks: 2 })
  runtime.applyBuff('qa_dot', enemyParticipant, enemyParticipant, { stacks: 3 })
  runtime.applyBuff('qa_onhit', playerParticipant, playerParticipant, { stacks: 1 })

  system.resolveNextStep(battle) // cast 0: commit + hit + proc mark + metal apply -> dung_kim
  system.resolveNextStep(battle) // repeat execution (fresh cast identity, no commit)
  system.resolveNextStep(battle) // multicast execution (chance 1)
  // Reseed the khac parent on the anchor so a later recast reacts again.
  // durationOverride 99: enemy2's own holder turns would otherwise
  // expire a duration-3 instance before the cooldown-free recast.
  runtime.applyBuff('hoa_an', extraEnemies[0]!, playerParticipant, {
    stacks: 2,
    durationOverride: 99,
  })
  runtime.tickHolderTurnsEnd(enemyParticipant.entity.id) // periodic tick -> enemy1 dies
  // Aftermath: cooldown expiry -> strike recasts onto enemy2 (second
  // dung_kim); enemy2 anchors the still-fighting battle.
  for (let i = 0; i < 12 && battle.state === 'fighting'; i++) {
    system.resolveNextStep(battle)
  }

  const all = [playerParticipant, enemyParticipant, extraEnemies[0]!]
  return {
    snapshot: battleSnapshot(battle, all, runtime),
    export: new CombatTraceExporter(runtime.scheduler.trace).export(),
    ops: settledOps(runtime),
    runtime,
  }
}

// ---------------------------------------------------------------------------
// M7.4 -- same-seed whole-battle parity.
// ---------------------------------------------------------------------------

describe('M7.4 determinism -- same-seed whole battle', () => {
  it('identical seed + identical commands -> identical state and exported trace', () => {
    const first = runRepresentativeBattle(7)
    const second = runRepresentativeBattle(7)

    expect(second.snapshot).toEqual(first.snapshot)
    expect(second.export.tree).toBe(first.export.tree)
    expect(second.export).toEqual(first.export)

    // Non-vacuous: the run exercised every channel the contract names.
    const ops = first.ops
    const damageOrigins = new Set(
      ops.filter((o) => o.type === 'deal_damage').map((o) => o.originKind),
    )
    expect(damageOrigins.has('skill')).toBe(true)
    expect(damageOrigins.has('buff_periodic')).toBe(true)
    expect(damageOrigins.has('reaction')).toBe(true)
    // Resource mutation + cast commitment.
    expect(
      ops.filter(
        (o) =>
          o.type === 'consume_resource' &&
          (o.payload as { resourceId?: string }).resourceId === 'mana',
      ).length,
    ).toBeGreaterThanOrEqual(1)
    // Proc channel (origin 'proc' apply_buff).
    expect(
      ops.some((o) => o.type === 'apply_buff' && o.originKind === 'proc'),
    ).toBe(true)
    // Repeat + multicast follow-ups resolved (3+ casts' worth of hits).
    expect(
      ops.filter(
        (o) =>
          o.sourceId === 'player' &&
          o.type === 'deal_damage' &&
          (o.payload as { damageProfile?: string }).damageProfile === 'skill_hit',
      ).length,
    ).toBeGreaterThanOrEqual(3)
    // Reaction fired at least twice (enemy1 cast + enemy2 recast).
    expect(traceEvents(first.runtime, 'reaction_resolved').length).toBeGreaterThanOrEqual(2)
    // Death exercised mid-script.
    expect(first.snapshot.participants.find((p) => p.id === 'enemy')?.alive).toBe(false)
    // A genuinely long trace -- dozens of settled ops, not a toy run.
    expect(first.export.executions.length).toBeGreaterThan(20)
  })

  it('a second export is a frozen snapshot -- later settlement cannot mutate it', () => {
    const rng = new SeededCombatRng(11)
    const { battle, system, runtime } = battleWith({ rng, actorSkill: DET_STRIKE })
    playerOf(battle).entity.currentMp = 200
    playerOf(battle).entity.baseStats = asBaseStats({
      ...playerOf(battle).entity.baseStats,
      maxMp: 200,
    })
    playerOf(battle).entity.stats = { ...playerOf(battle).entity.stats, maxMp: 200 }

    system.resolveNextStep(battle)
    const exporter = new CombatTraceExporter(runtime.scheduler.trace)
    const frozen = exporter.export()
    const executionsAtExport = frozen.executions.length

    system.resolveNextStep(battle)
    system.resolveNextStep(battle)

    // The prior export is untouched; a fresh export sees the new ops.
    expect(frozen.executions).toHaveLength(executionsAtExport)
    expect(exporter.export().executions.length).toBeGreaterThan(executionsAtExport)
  })
})

// ---------------------------------------------------------------------------
// M7.4 -- different-seed controlled divergence.
// ---------------------------------------------------------------------------

describe('M7.4 determinism -- controlled divergence', () => {
  it('rolls on opposite sides of the 0.5 hit threshold diverge exactly', () => {
    // hitChance = accuracy/(accuracy+evasion) = 100/200 = 0.5 exactly
    // (above the 5% floor, below any ceiling). Roll 0.4 < 0.5 lands;
    // roll 0.6 > 0.5 misses. The multicast chance rides the SAME
    // constant stream: 0.4 < 0.5 fires a follow-up, 0.6 does not.
    const PROBE: TurnSkillDefinition = {
      id: 'det_probe',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      multicast: { chance: 0.5, maxExtraCasts: 1 },
    }
    const runProbe = (roll: number) => {
      const rng = new FunctionCombatRng(() => roll)
      const { battle, playerParticipant, enemyParticipant, system, runtime } =
        battleWith({ rng, actorSkill: PROBE })
      playerParticipant.entity.baseStats = asBaseStats({
        ...playerParticipant.entity.baseStats,
        accuracyRating: 100,
      })
      playerParticipant.entity.stats = { ...playerParticipant.entity.stats, accuracyRating: 100 }
      enemyParticipant.entity.baseStats = asBaseStats({
        ...enemyParticipant.entity.baseStats,
        evasionRate: 100,
      })
      enemyParticipant.entity.stats = { ...enemyParticipant.entity.stats, evasionRate: 100 }

      for (let i = 0; i < 4; i++) system.resolveNextStep(battle)

      const hits = settledOps(runtime).filter(
        (o) =>
          o.sourceId === 'player' &&
          o.type === 'deal_damage' &&
          (o.payload as { damageProfile?: string }).damageProfile === 'skill_hit',
      )
      return {
        hits,
        enemyHp: enemyParticipant.entity.currentHp,
        enemyMaxHp: enemyParticipant.entity.maxHp,
        runtime,
      }
    }

    const landed = runProbe(0.4)
    const whiffed = runProbe(0.6)

    // Landed run: every hit landed, the multicast follow-up fired --
    // with cooldownTurns 0 the player recasts on the next ready turn, so
    // the landed run holds exactly ONE more hit than the whiffed run
    // (the multicast-sourced execution that 0.6 never queued).
    expect(landed.hits.length).toBe(whiffed.hits.length + 1)
    expect(
      landed.hits.every(
        (h) => (h.result as { damage?: { landed?: boolean } }).damage?.landed === true,
      ),
    ).toBe(true)
    const dealt = landed.hits.reduce(
      (sum, h) => sum + ((h.result as { damage?: { hpDamage?: number } }).damage?.hpDamage ?? 0),
      0,
    )
    expect(dealt).toBeGreaterThan(0)
    expect(landed.enemyHp).toBe(landed.enemyMaxHp - dealt)

    // Whiffed run: every hit landed:false, enemy hp untouched.
    expect(whiffed.hits.length).toBeGreaterThanOrEqual(1)
    expect(
      whiffed.hits.every(
        (h) => (h.result as { damage?: { landed?: boolean } }).damage?.landed === false,
      ),
    ).toBe(true)
    expect(whiffed.enemyHp).toBe(whiffed.enemyMaxHp)
  })
})

// ---------------------------------------------------------------------------
// M7.4 -- causal graph (provenance from fields, never sequence order).
// ---------------------------------------------------------------------------

describe('M7.4 causal graph', () => {
  it('every causation field resolves to a real parent inside the export', () => {
    const { export: exp } = runRepresentativeBattle(7)

    const opById = new Map(exp.executions.map((r) => [r.operation.operationId, r]))
    const eventById = new Map(exp.events.map((e) => [e.eventId, e]))

    for (const record of exp.executions) {
      const origin = record.operation.origin
      // An op caused by an event: the parent event exists, shares the
      // rootActionId, and was stamped before the op executed.
      if (origin.causationEventId !== undefined) {
        const parent = eventById.get(origin.causationEventId)
        expect(parent, `missing parent event for ${record.operation.operationId}`).toBeDefined()
        expect(eventRoot(parent!)).toBe(origin.rootActionId)
        expect(parent!.combatSequence).toBeLessThan(record.combatSequence)
      }
      if (origin.kind === 'skill') {
        expect(origin.castId).toBeTruthy()
        expect(origin.subcastIndex).toBeDefined()
      }
      if (origin.kind === 'reaction') {
        expect(origin.reactionId).toBeTruthy()
        expect(origin.causationEventId).toBeDefined()
      }
      if (origin.parentOperationId !== undefined) {
        expect(opById.has(origin.parentOperationId)).toBe(true)
      }
    }

    for (const event of exp.events) {
      if (event.causationOperationId !== undefined) {
        const parent = opById.get(event.causationOperationId)
        expect(parent, `missing parent op for ${event.eventId}`).toBeDefined()
        expect(parent!.combatSequence).toBeLessThan(event.combatSequence)
      }
      if (event.causationEventId !== undefined) {
        const parent = eventById.get(event.causationEventId)
        expect(parent, `missing parent event for ${event.eventId}`).toBeDefined()
        expect(parent!.combatSequence).toBeLessThan(event.combatSequence)
      }
    }
  })

  it('the named chain apply_buff -> committed event -> reaction ops -> resolved event resolves', () => {
    const { export: exp } = runRepresentativeBattle(7)

    const opById = new Map(exp.executions.map((r) => [r.operation.operationId, r]))
    const committed = exp.events.find((e) => e.type === 'elemental_application_committed')
    expect(committed).toBeDefined()

    // The committed event names the apply_buff op that emitted it.
    const apply = opById.get(committed!.causationOperationId!)
    expect(apply?.operation.type).toBe('apply_buff')

    // Every reaction op in that batch names the event as its cause and
    // carries the reaction identity.
    const rxOps = exp.executions.filter(
      (r) => r.operation.origin.causationEventId === committed!.eventId,
    )
    expect(rxOps.length).toBeGreaterThanOrEqual(2)
    expect(
      rxOps.every(
        (r) => r.operation.origin.kind === 'reaction' && r.operation.origin.reactionId !== undefined,
      ),
    ).toBe(true)

    // reaction_resolved names the same triggering event.
    const resolved = exp.events.find(
      (e) => e.type === 'reaction_resolved' && e.causationEventId === committed!.eventId,
    )
    expect(resolved).toBeDefined()
    // One root transaction owns the whole chain (the committed event
    // carries the root inside `origin`; the ops carry it top-level).
    const root = eventRoot(committed!)
    expect(root).toBeDefined()
    expect(
      rxOps.every((r) => r.operation.origin.rootActionId === root),
    ).toBe(true)
    expect(apply!.operation.origin.rootActionId).toBe(root)
  })
})

// ---------------------------------------------------------------------------
// M7.4 -- CombatTraceExporter over a real battle trace.
// ---------------------------------------------------------------------------

describe('M7.4 trace exporter', () => {
  it('exposes executions/events/faults/batchSkips/skippedResults/journal + causal fields', () => {
    const { export: exp } = runRepresentativeBattle(7)

    expect(exp.executions.length).toBeGreaterThan(20)
    expect(exp.events.length).toBeGreaterThan(0)
    // Journal = executions + events merged, chronological by
    // combatSequence (unique per stamp -> strictly increasing).
    expect(exp.journal).toHaveLength(exp.executions.length + exp.events.length)
    for (let i = 1; i < exp.journal.length; i++) {
      expect(exp.journal[i]!.sequence).toBeGreaterThan(exp.journal[i - 1]!.sequence)
    }
    // Every journal entry carries its own record/event (not a lookup).
    expect(exp.journal.every((j) => (j.kind === 'operation' ? 'record' in j : 'event' in j))).toBe(true)
    // The out-of-band journals exist (this run is clean -> empty).
    expect(Array.isArray(exp.faults)).toBe(true)
    expect(Array.isArray(exp.batchSkips)).toBe(true)
    expect(Array.isArray(exp.skippedResults)).toBe(true)
    // The tree names the causal roots the fields encode.
    expect(exp.tree).toContain('action.')
  })

  it('a stale batch lands in batchSkips AND skippedResults on the exported trace', () => {
    const rng = new SeededCombatRng(13)
    const { battle, playerParticipant, enemyParticipant, system, runtime } = battleWith({ rng })
    runtime.applyBuff('hoa_an', enemyParticipant, playerParticipant, { stacks: 2 })
    const instance = instancesOf(runtime, 'enemy', 'hoa_an')[0]!

    runtime.scheduler.registerImmediateHandler('elemental_application_committed', () => ({
      kind: 'batch',
      batch: {
        batchId: 'rxbatch.det.stale',
        origin: {
          kind: 'reaction',
          originId: 'dung_kim',
          sourceId: 'player' as CombatEntityId,
          rootActionId: 'root.det.stale',
        },
        preconditions: [
          {
            kind: 'buff_participant',
            instanceId: instance.instanceId,
            expectedSourceId: 'player' as CombatEntityId,
            expectedTargetId: 'enemy' as CombatEntityId,
            expectedStacks: 99,
          },
        ],
        operations: [
          {
            type: 'consume_buff_stacks',
            operationId: 'rx.det.stale.consume' as never,
            origin: {
              kind: 'reaction',
              originId: 'dung_kim',
              sourceId: 'player' as CombatEntityId,
              rootActionId: 'root.det.stale',
            },
            payload: {
              selector: { kind: 'instance', instanceId: instance.instanceId },
              stacks: 'all',
              removalReason: 'reaction',
            },
          },
        ],
      },
    }))

    const { sink } = runtime.scheduler.createLifecycleSink('root.det.stale')
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
        originId: 'det_stale',
        sourceId: 'player' as CombatEntityId,
        rootActionId: 'root.det.stale',
      },
    })
    runtime.scheduler.run()

    const exp = new CombatTraceExporter(runtime.scheduler.trace).export()
    expect(exp.batchSkips).toHaveLength(1)
    expect(exp.batchSkips[0]!.batchId).toBe('rxbatch.det.stale')
    expect(exp.batchSkips[0]!.reason).toBe('stale_reaction_snapshot')
    expect(exp.skippedResults).toHaveLength(1)
    expect(exp.skippedResults[0]!.operationId).toBe('rx.det.stale.consume')
    expect(exp.skippedResults[0]!.reason).toBe('stale_reaction_snapshot')
    expect(instancesOf(runtime, 'enemy', 'hoa_an')[0]?.stacks).toBe(2)
    void system
    void battle
  })
})

// ---------------------------------------------------------------------------
// Locators.
// ---------------------------------------------------------------------------

function playerOf(battle: TurnBattle): TurnBattleParticipant {
  const p = battle.players[0]
  if (p === undefined) throw new Error('no player participant')
  return p
}
