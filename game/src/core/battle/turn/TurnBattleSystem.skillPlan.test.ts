import { describe, expect, it, vi } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import type { TurnSkillDefinition } from './TurnSkillAction'
import type { BuffDefinition } from '../../buff2/BuffDefinition'
import { FunctionCombatRng } from '../runtime/rng/FunctionCombatRng'
import type { CombatOperationResult } from '../contracts/results'
import { makeTestBuffRegistry, makeTurnRuntime, type TurnRuntimeFixture } from './testing/TurnRuntimeFixtures'

// skilldef M4e/M4f/M5b -- the plan-pipeline routing contract:
//   adapter-covered casts -> LegacySkillAdapter -> SkillResolver ->
//     SkillExecutor -> scheduler ops (skill_hit / consume_resource /
//     apply_buff / ... visible in the trace; legacy hits never mint ops)
//   charge-inits commit through the plan seam; charge-resolves run the
//     charged def verbatim as a non-committing follow-up plan
//   unsupported casts are reported loudly once and no-op -- nothing
//     falls back to legacy; insufficient-resource casts route to a
//     blocked outcome (no commit, no ops) when they reach the
//     pipeline, or slotReady filters them at selection first
//   TBS's declare-side resolution (empowerment/composite/theBurned)
//     replays through preResolved -- the plan never re-rolls it
//   repeat/multicast executions route too but never re-commit the cast.

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

const QA_BUFF: BuffDefinition = {
  id: 'qa_mark',
  name: 'QA Mark',
  kind: 'debuff',
  polarity: 'debuff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'holder_turns', duration: 5, scaling: 'fixed' },
  dispellable: true,
}

const REGISTRY = makeTestBuffRegistry([QA_BUFF])

const BASIC: TurnSkillDefinition = {
  id: 'qa_basic',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'single' },
}

const STRIKE: TurnSkillDefinition = {
  id: 'qa_strike',
  cooldownTurns: 2,
  damage: { kind: 'physical', multiplier: 2 },
  targeting: { shape: 'single' },
}

function battleWith(
  actorSkill: TurnSkillDefinition,
  opts: { rng?: FunctionCombatRng; onSkillCast?: (actor: TurnBattleParticipant, skillId: string) => void } = {},
) {
  const player = createCombatant('player')
  const enemyEntity = createCombatant('enemy')
  enemyEntity.type = 'enemy'

  const playerParticipant = makeParticipant('player', player, 100, 0)
  playerParticipant.basic = BASIC
  playerParticipant.special = { skill: actorSkill, remainingCooldownTurns: 0 }

  const enemyParticipant = makeParticipant('enemy', enemyEntity, 1, 1)
  enemyParticipant.basic = BASIC

  const eventBus = new EventBus()
  const combat = new CombatSystem(eventBus)
  const runtime = makeTurnRuntime({
    registry: REGISTRY,
    participants: () => [playerParticipant, enemyParticipant],
    combatSystem: combat,
    ...(opts.rng !== undefined ? { rng: opts.rng } : {}),
  })

  const battle: TurnBattle = {
    players: [playerParticipant],
    enemies: [enemyParticipant],
    state: 'fighting',
  }

  const system = new TurnBattleSystem(combat, 100, REGISTRY, undefined, runtime, opts.onSkillCast)

  return { battle, playerParticipant, enemyParticipant, system, eventBus, runtime }
}

/** Ops that settled through the scheduler this battle -- the routed-lane
    receipt. The engine-unit lane (runtime === undefined) resolves hits
    without minting ops, so a non-empty skill_hit set is positive proof
    of routing. */
function settledOps(runtime: TurnRuntimeFixture) {
  return runtime.scheduler.trace.records.map((r) => ({
    type: r.operation.type,
    status: r.result.status,
    sourceId: r.operation.origin.sourceId,
    payload: r.operation.payload,
    result: r.result,
  }))
}

function skillHitResults(runtime: TurnRuntimeFixture) {
  return runtime.scheduler.trace.records
    .filter(
      (r) =>
        r.operation.type === 'deal_damage' &&
        (r.operation.payload as { damageProfile?: string }).damageProfile === 'skill_hit',
    )
    .map((r) => r.result)
}

/** The fixture's base stats carry maxMp 0 -- a mana-costed skill needs an
    explicit pool (stats + baseStats both, the refresh reconciles). */
function withMana(entity: CombatEntity, amount: number): void {
  entity.stats = { ...entity.stats, maxMp: amount }
  entity.baseStats = asBaseStats({ ...entity.baseStats, maxMp: amount })
  entity.currentMp = amount
}

describe('TurnBattleSystem -- skill plan routing (skilldef M4e)', () => {
  it('routes an adapter-covered cast through the scheduler: skill_hit op settles with a landed result', () => {
    const { battle, enemyParticipant, system, runtime } = battleWith(STRIKE)

    system.resolveNextStep(battle)

    const hits = skillHitResults(runtime)
    expect(hits).toHaveLength(1)
    const hit = hits[0]!
    if (hit.type !== 'deal_damage') throw new Error('unreachable')
    expect(hit.damage?.landed).toBe(true)
    expect(enemyParticipant.entity.currentHp).toBeLessThan(enemyParticipant.entity.maxHp)
  })

  it('commits cost + cooldown through the plan exactly once, cost op before the hit', () => {
    const COSTED: TurnSkillDefinition = {
      ...STRIKE,
      resourceType: 'mana',
      resourceCost: 40,
    }
    const { battle, playerParticipant, system, runtime } = battleWith(COSTED)
    withMana(playerParticipant.entity, 200)
    const mpBefore = playerParticipant.entity.currentMp

    system.resolveNextStep(battle)

    const ops = settledOps(runtime)
    const costIndex = ops.findIndex(
      (o) =>
        o.type === 'consume_resource' &&
        (o.payload as { resourceId?: string }).resourceId === 'mana',
    )
    const hitIndex = ops.findIndex(
      (o) =>
        o.type === 'deal_damage' &&
        (o.payload as { damageProfile?: string }).damageProfile === 'skill_hit',
    )
    // Commit-first ordering: the cost op settles before any hit op.
    expect(costIndex).toBeGreaterThanOrEqual(0)
    expect(hitIndex).toBeGreaterThan(costIndex)
    expect(playerParticipant.entity.currentMp).toBe(mpBefore - 40)
    // Cooldown slotted once, on the used slot.
    expect(playerParticipant.special!.remainingCooldownTurns).toBe(2)
  })

  it('a charge resolves through the plan pipeline: init commits, resolve mints one hit, no re-commit', () => {
    const CHARGED: TurnSkillDefinition = {
      id: 'qa_charged',
      cooldownTurns: 3,
      chargeTurns: 1,
      resourceType: 'mana',
      resourceCost: 20,
      damage: { kind: 'physical', multiplier: 3 },
      targeting: { shape: 'single' },
    }
    const { battle, playerParticipant, enemyParticipant, system, runtime } = battleWith(CHARGED)
    withMana(playerParticipant.entity, 100)

    system.resolveNextStep(battle) // charge init -- commits, no hit
    expect(enemyParticipant.entity.currentHp).toBe(enemyParticipant.entity.maxHp)
    // The init commit rode the plan seam: the mana cost settled as the
    // first scheduled op and the slot cooldown committed.
    expect(playerParticipant.entity.currentMp).toBe(80)
    expect(playerParticipant.special!.remainingCooldownTurns).toBe(3)

    // Charge ticks/resolve advance on the PLAYER's later turns; the
    // enemy's own basics route through the plan pipeline in between
    // (enemy-sourced ops). Step until the charged hit lands.
    for (let i = 0; i < 10 && enemyParticipant.entity.currentHp === enemyParticipant.entity.maxHp; i++) {
      system.resolveNextStep(battle)
    }
    expect(enemyParticipant.entity.currentHp).toBeLessThan(enemyParticipant.entity.maxHp)

    // The resolve minted exactly one player-sourced hit op -- and no
    // second consume: the deferred execution never re-commits.
    const playerOps = settledOps(runtime).filter((o) => o.sourceId === 'player')
    expect(
      playerOps.filter(
        (o) =>
          o.type === 'deal_damage' &&
          (o.payload as { damageProfile?: string }).damageProfile === 'skill_hit',
      ),
    ).toHaveLength(1)
    expect(
      playerOps.filter(
        (o) =>
          o.type === 'consume_resource' &&
          (o.payload as { resourceId?: string }).resourceId === 'mana',
      ),
    ).toHaveLength(1)
    expect(playerParticipant.entity.currentMp).toBe(80)
  })

  it('a def with unexpressible semantics (runtime-closure perInstanceOptions) reports loudly and no-ops', () => {
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

    // M5d -- runtime-present unsupported casts never fall back to the
    // legacy lane: the cast fizzles (no damage, no ops) and the report
    // names the unexpressible semantics.
    expect(enemyParticipant.entity.currentHp).toBe(enemyParticipant.entity.maxHp)
    expect(skillHitResults(runtime)).toHaveLength(0)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("'qa_closure'"),
    )
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('perInstanceOptions'))
    warn.mockRestore()
  })

  it('an unaffordable special falls back to a routed basic cast -- mana is never touched', () => {
    // slotReady drops the expensive slot at selection; the basic
    // fallback that replaces it is itself adapter-covered and routes.
    const EXPENSIVE: TurnSkillDefinition = {
      ...STRIKE,
      resourceType: 'mana',
      resourceCost: 999_999,
    }
    const { battle, playerParticipant, enemyParticipant, system, runtime } = battleWith(EXPENSIVE)
    withMana(playerParticipant.entity, 100)

    system.resolveNextStep(battle)

    expect(enemyParticipant.entity.currentHp).toBeLessThan(enemyParticipant.entity.maxHp)
    // The fallback basic routed -- a player-sourced skill_hit op settled.
    const playerHits = settledOps(runtime).filter(
      (o) =>
        o.sourceId === 'player' &&
        o.type === 'deal_damage' &&
        (o.payload as { damageProfile?: string }).damageProfile === 'skill_hit',
    )
    expect(playerHits).toHaveLength(1)
    // The expensive special never committed: pool untouched (no
    // negative commit), its slot still off cooldown.
    expect(playerParticipant.entity.currentMp).toBe(100)
    expect(playerParticipant.special!.remainingCooldownTurns).toBe(0)
  })

  it('replays declare-side empowerment: pool burns once through a consume_resource(the) op, root commits once', () => {
    const GOD_ULT: TurnSkillDefinition = {
      id: 'qa_god_ult',
      cooldownTurns: 0,
      consumesAllThe: true,
      damage: { kind: 'elemental', components: [{ kind: 'element', element: 'fire', ratio: 1 }], multiplier: 5 },
      targeting: { shape: 'single' },
    }
    const EMPOWERED_ROOT: TurnSkillDefinition = {
      id: 'qa_empowered_root',
      cooldownTurns: 3,
      damage: { kind: 'elemental', components: [{ kind: 'element', element: 'fire', ratio: 1 }], multiplier: 2 },
      targeting: { shape: 'single' },
      empowerment: { theThreshold: 100, empowered: GOD_ULT },
    }
    const onSkillCast = vi.fn()
    const { battle, playerParticipant, enemyParticipant, system, runtime } = battleWith(EMPOWERED_ROOT, { onSkillCast })
    playerParticipant.entity.currentThe = 100

    system.resolveNextStep(battle)

    // The empowered payload executed (multiplier 5 vs root 2) -- the
    // plan replayed TBS's declare-side swap instead of re-resolving.
    expect(enemyParticipant.entity.currentHp).toBeLessThan(enemyParticipant.entity.maxHp)
    expect(skillHitResults(runtime)).toHaveLength(1)

    // The whole pool burned exactly once via the authored consume op.
    const theBurns = settledOps(runtime).filter(
      (o) =>
        o.type === 'consume_resource' &&
        (o.payload as { resourceId?: string }).resourceId === 'the',
    )
    expect(theBurns).toHaveLength(1)
    expect(playerParticipant.entity.currentThe).toBe(0)

    // Cast identity stays on the root (INV-18): one cooldown, one sink.
    expect(playerParticipant.special!.remainingCooldownTurns).toBe(3)
    expect(onSkillCast).toHaveBeenCalledTimes(1)
    expect(onSkillCast).toHaveBeenCalledWith(playerParticipant, 'qa_empowered_root')
  })

  it('a composite cast executes primary + extra payloads in one plan while the root commits once', () => {
    const POOL_A: TurnSkillDefinition = {
      id: 'qa_pool_a',
      cooldownTurns: 0,
      damage: { kind: 'elemental', components: [{ kind: 'element', element: 'fire', ratio: 1 }], multiplier: 2 },
      targeting: { shape: 'single' },
    }
    const POOL_B: TurnSkillDefinition = {
      id: 'qa_pool_b',
      cooldownTurns: 0,
      damage: { kind: 'elemental', components: [{ kind: 'element', element: 'water', ratio: 1 }], multiplier: 2 },
      targeting: { shape: 'single' },
    }
    const COMPOSITE: TurnSkillDefinition = {
      id: 'qa_composite',
      cooldownTurns: 4,
      targeting: { shape: 'single' },
      compositePicks: { poolType: 'element_basic', pool: [POOL_A, POOL_B], count: 2 },
    }
    const onSkillCast = vi.fn()
    // rng -> 0 picks pool[0] as primary, pool[1] as the extra lane.
    const { battle, playerParticipant, enemyParticipant, system, runtime } = battleWith(COMPOSITE, {
      rng: new FunctionCombatRng(() => 0),
      onSkillCast,
    })

    system.resolveNextStep(battle)

    // Both payloads hit through the plan (primary + one extra lane).
    expect(skillHitResults(runtime)).toHaveLength(2)
    expect(enemyParticipant.entity.currentHp).toBeLessThan(enemyParticipant.entity.maxHp)

    // The composite ROOT committed exactly once -- the payload picks are
    // never cast identities.
    expect(playerParticipant.special!.remainingCooldownTurns).toBe(4)
    expect(onSkillCast).toHaveBeenCalledTimes(1)
    expect(onSkillCast).toHaveBeenCalledWith(playerParticipant, 'qa_composite')
  })

  it('routes two casts whose defs share one composite pool (An kit parity)', () => {
    // applyAnKitToBasic/Special inject THE SAME elementPool object into
    // the basic and the special -- the second adaptation's auxiliaries
    // repeat member ids already in the registry. Identical shapes
    // dedupe; without that the special would stay legacy forever.
    const POOL_A: TurnSkillDefinition = {
      id: 'qa_shared_a',
      cooldownTurns: 0,
      damage: { kind: 'elemental', components: [{ kind: 'element', element: 'fire', ratio: 1 }], multiplier: 2 },
      targeting: { shape: 'single' },
    }
    const POOL_B: TurnSkillDefinition = {
      id: 'qa_shared_b',
      cooldownTurns: 0,
      damage: { kind: 'elemental', components: [{ kind: 'element', element: 'water', ratio: 1 }], multiplier: 2 },
      targeting: { shape: 'single' },
    }
    const SHARED_POOL = [POOL_A, POOL_B]
    const AN_BASIC: TurnSkillDefinition = {
      id: 'qa_an_basic',
      cooldownTurns: 0,
      targeting: { shape: 'single' },
      compositePicks: { poolType: 'element_basic', pool: SHARED_POOL, count: 1 },
    }
    const AN_SPECIAL: TurnSkillDefinition = {
      id: 'qa_an_special',
      // On cooldown after the first cast so the player's next turn
      // takes the basic lane -- exercising the second adaptation.
      cooldownTurns: 3,
      targeting: { shape: 'single' },
      compositePicks: { poolType: 'element_basic', pool: SHARED_POOL, count: 1 },
    }
    const { battle, playerParticipant, system, runtime } = battleWith(AN_SPECIAL)
    playerParticipant.basic = AN_BASIC
    playerParticipant.special = { skill: AN_SPECIAL, remainingCooldownTurns: 0 }

    system.resolveNextStep(battle)
    expect(skillHitResults(runtime).length).toBeGreaterThanOrEqual(1)

    // Advance until the player's next turn lands (routed enemy basics
    // mint ops too -- the wait must count PLAYER-sourced hits only).
    const playerHitCount = () =>
      settledOps(runtime).filter(
        (o) =>
          o.sourceId === 'player' &&
          o.type === 'deal_damage' &&
          (o.payload as { damageProfile?: string }).damageProfile === 'skill_hit',
      ).length
    const before = playerHitCount()
    for (let i = 0; i < 10 && playerHitCount() <= before; i++) {
      system.resolveNextStep(battle)
    }

    // Both the special AND the basic routed -- the shared pool members
    // deduped into the registry instead of faulting the second catalog.
    expect(playerHitCount()).toBeGreaterThanOrEqual(2)
  })

  it('a queued repeat execution re-resolves damage without re-committing the cast', () => {
    const REPEATER: TurnSkillDefinition = {
      id: 'qa_repeater',
      cooldownTurns: 5,
      resourceType: 'mana',
      resourceCost: 30,
      repeatCasts: 1,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
    }
    const onSkillCast = vi.fn()
    const { battle, playerParticipant, enemyParticipant, system, runtime } = battleWith(REPEATER, { onSkillCast })
    // Exactly one cast's worth of mana -- the original drains the pool;
    // the repeat routes anyway (it never pays the cost again).
    withMana(playerParticipant.entity, 30)

    system.resolveNextStep(battle) // original cast -- commits
    system.resolveNextStep(battle) // queued 'repeat' execution

    // Two executions hit -- original + one repeat.
    expect(skillHitResults(runtime)).toHaveLength(2)

    // The repeat execution never re-committed: one cost debit, one
    // cooldown slot, one cast sink (INV-18 structural).
    expect(playerParticipant.entity.currentMp).toBe(0)
    expect(playerParticipant.special!.remainingCooldownTurns).toBe(5)
    expect(onSkillCast).toHaveBeenCalledTimes(1)
    expect(enemyParticipant.entity.currentHp).toBeLessThan(enemyParticipant.entity.maxHp)
  })

  it('routes a non-damaging buff cast: apply_buff ops settle, no hit ops minted', () => {
    const DEBUFF: TurnSkillDefinition = {
      id: 'qa_debuff',
      cooldownTurns: 0,
      targeting: { shape: 'single' },
      appliesAilments: [{ buffDefinitionId: 'qa_mark', chance: 1, stacks: 1 }],
    }
    const { battle, enemyParticipant, system, runtime } = battleWith(DEBUFF)

    system.resolveNextStep(battle)

    const applied = settledOps(runtime).filter((o) => o.type === 'apply_buff')
    expect(applied.length).toBeGreaterThanOrEqual(1)
    expect(skillHitResults(runtime)).toHaveLength(0)
    expect(
      runtime.buffs
        .getForTarget(enemyParticipant.entity.id)
        .some((inst) => inst.definitionId === 'qa_mark'),
    ).toBe(true)
  })

  it('a dodged hit settles landed:false through the op result and opens no consequence gates', () => {
    const AILMENT_STRIKE: TurnSkillDefinition = {
      ...STRIKE,
      appliesAilments: [{ buffDefinitionId: 'qa_mark', chance: 1, stacks: 1 }],
    }
    const { battle, playerParticipant, enemyParticipant, system, runtime } = battleWith(AILMENT_STRIKE, {
      // Hit chance floors at MIN_HIT_CHANCE -- a roll above it whiffs.
      rng: new FunctionCombatRng(() => 0.999),
    })
    enemyParticipant.entity.stats = { ...enemyParticipant.entity.stats, evasionRate: 1e9 }
    enemyParticipant.entity.baseStats = asBaseStats({ ...enemyParticipant.entity.baseStats, evasionRate: 1e9 })
    void playerParticipant

    system.resolveNextStep(battle)

    const hits = skillHitResults(runtime)
    expect(hits).toHaveLength(1)
    const hit = hits[0]!
    if (hit.type !== 'deal_damage') throw new Error('unreachable')
    expect(hit.damage?.landed).toBe(false)
    // No consequence ops settled -- the landed gate never opened.
    expect(
      runtime.buffs
        .getForTarget(enemyParticipant.entity.id)
        .some((inst) => inst.definitionId === 'qa_mark'),
    ).toBe(false)
    const applyOps = settledOps(runtime).filter((o) => o.type === 'apply_buff')
    expect(applyOps).toHaveLength(0)
  })

  it('sweeps buffs off a target killed through the routed lane', () => {
    const { battle, enemyParticipant, playerParticipant, system, runtime } = battleWith(STRIKE)
    // Seed a buff on the enemy, then the routed hit kills them -- the
    // gate-exit death sweep removes holder-dead instances.
    runtime.applyBuff('qa_mark', enemyParticipant, playerParticipant, { stacks: 2 })
    enemyParticipant.entity.currentHp = 1

    system.resolveNextStep(battle)

    expect(enemyParticipant.entity.alive).toBe(false)
    expect(runtime.buffs.getForTarget(enemyParticipant.entity.id)).toHaveLength(0)
  })
})
