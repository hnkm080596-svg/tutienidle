import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import { GENERIC_PHYSICAL_BASIC } from '../../../data/skill/TurnBasicAttacks'
import type { TurnSkillDefinition } from './TurnSkillAction'
import { makeTurnRuntime, type TurnRuntimeFixture } from './testing/TurnRuntimeFixtures'

// Phap Tu Reimagined Task 13 — spec §4: the empowered ult's two route
// expressions. `detonate` (dot route): direct + normal application
// first, then consume every live DoT ailment for remaining-tick x
// stacks x DETONATE_AMP and re-seed a FIXED 1 stack at AUTHORED
// duration with potency recomputed vs the caster's CURRENT stats —
// reaction-silent (O2/R2: re-seed ops carry 'suppressed' eligibility).
// `nuke` (no route): damage x (1 + theBurned/100 x NUKE_THE_COEFF),
// linear in the whole pool.
// buff2 M4: the burst resolves vs the CONSUMED INSTANCE's source stats
// (statSourceId) — a third-party DoT pays its own owner's per-tick.

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, ...(overrides.stats ?? {}) })

  const entity = {
    id: 'id',
    name: 'name',
    type: 'enemy',
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentThe: 0,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
    baseStats: overrides.baseStats ?? stats,
  } as CombatEntity

  const ceiling = Math.max(entity.maxHp, entity.currentHp)
  if (entity.stats.maxHp !== ceiling) {
    entity.stats = { ...entity.stats, maxHp: ceiling }
    entity.baseStats = asBaseStats({ ...entity.baseStats, maxHp: ceiling })
  }
  return entity
}

function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return {
    id,
    entity,
    speed,
    priority,
    actionGauge: 0,
    alive: entity.alive,

    consecutiveHardCcTurns: 0,
    basic: GENERIC_PHYSICAL_BASIC,
  }
}

const DETONATE_AMP = 1.5
const NUKE_COEFF = 1

const DETONATE_ROOT: TurnSkillDefinition = {
  id: 'hoa_ha_cuu_thien',
  cooldownTurns: 3,
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'single' },
  empowerment: {
    theThreshold: 100,
    empowered: {
      id: 'tat_phuong_giang_the',
      cooldownTurns: 0,
      consumesAllThe: true,
      detonateDoT: { amp: DETONATE_AMP },
      // multiplier 0 + the unconditional min-1 floor isolates the
      // detonate bursts: hp delta = 1 + consumed-tick damage.
      damage: { kind: 'physical', multiplier: 0 },
      targeting: { shape: 'single' },
      appliesAilments: [{ buffDefinitionId: 'bong', chance: 1 }],
    },
  },
}

const NUKE_ROOT: TurnSkillDefinition = {
  id: 'hoa_ha_cuu_thien',
  cooldownTurns: 3,
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'single' },
  empowerment: {
    theThreshold: 100,
    empowered: {
      id: 'tat_phuong_giang_the',
      cooldownTurns: 0,
      consumesAllThe: true,
      theScaling: { coeff: NUKE_COEFF },
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
    },
  },
}

function harness(root: TurnSkillDefinition, thePool = 100, maxThe?: number) {
  const playerEntity = createCombatant({
    id: 'player',
    type: 'player',
    currentThe: thePool,
    maxThe,
    stats: createBaseStats({ might: 100, firePower: 50, woodPower: 30, evasionRate: 0, dexterity: 0, criticalRate: 0 }),
  })
  const enemyEntity = createCombatant({
    id: 'enemy',
    currentHp: 1_000_000,
    // endurance zeroed: its flat (threshold x percent) subtraction is
    // ADDITIVE, which would break the clean theScaling damage ratio.
    stats: createBaseStats({ might: 0, blockChance: 0, enduranceThreshold: 0, endurancePercent: 0 }),
  })

  const player = makeParticipant('player', playerEntity, 100, 0)
  player.ultimate = { skill: root, remainingCooldownTurns: 0 }
  const enemy = makeParticipant('enemy', enemyEntity, 1, 1)

  const battle: TurnBattle = { players: [player], enemies: [enemy], state: 'fighting' }
  const combat = new CombatSystem(new EventBus())

  // Side-roster participants (third-party DoT sources) join the runtime
  // resolver without joining the battle arrays.
  const roster: TurnBattleParticipant[] = [player, enemy]
  const runtime = makeTurnRuntime({
    registry: BUFF_REGISTRY,
    participants: () => roster,
    combatSystem: combat,
  })
  const system = new TurnBattleSystem(combat, 10_000, BUFF_REGISTRY, undefined, runtime)

  const addRosterParticipant = (participant: TurnBattleParticipant) => {
    roster.push(participant)
    return participant
  }

  return { battle, player, enemy, playerEntity, enemyEntity, system, runtime, addRosterParticipant }
}

function buffsOf(runtime: TurnRuntimeFixture, participant: TurnBattleParticipant, id: string) {
  return runtime.buffs
    .getForTarget(participant.entity.id)
    .filter((instance) => instance.definitionId === id)
}

describe('Detonate (dot-route empowered ult)', () => {
  beforeEach(() => {
    // Deterministic rolls: this file's expectations assume every hit
    // lands, never crits/blocks, and every chance-1 ailment applies.
    // Installing our own mock also shields the assertions from a
    // Math.random spy leaked by a sibling file in the same worker.
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('consumes every DoT ailment for remaining-tick x stacks x amp; utility ailments are never touched', () => {
    const { battle, player, enemy, enemyEntity, playerEntity, system, runtime, addRosterParticipant } = harness(DETONATE_ROOT)

    // Pre-seed: trung_doc (wood DoT) x3 from a THIRD source with
    // woodPower 10 -> per-tick resolves vs the minion, NOT the caster;
    // choang (stun — controls, no damage periodic) is a pure-utility
    // ailment the detonate must leave alone.
    const minion = addRosterParticipant(
      makeParticipant('minion', createCombatant({ id: 'minion', stats: createBaseStats({ might: 0, woodPower: 10 }) }), 1, 2),
    )
    for (let i = 0; i < 3; i++) {
      runtime.applyBuff('trung_doc', enemy, minion)
    }
    runtime.applyBuff('choang', enemy, player)
    const choangBefore = buffsOf(runtime, enemy, 'choang')[0]

    const hpBefore = enemyEntity.currentHp
    system.resolveActorTurn(battle, player)

    // trung_doc burst: intent 0.2 x 5 remaining x 3 stacks x 1.5 = 4.5,
    // resolved vs the minion's wood power 10 -> 45. The cast's own bong
    // (fire, chance 1) lands then is consumed in the same pass: intent
    // 0.15 x 4 x 1 x 1.5 = 0.9 vs the caster's fire power 150 -> 135.
    // Direct packet floors at min-1.
    expect(enemyEntity.currentHp).toBeCloseTo(hpBefore - 45 - 135 - 1, 0)

    // Utility ailment untouched — same instance, same remaining life.
    const choangAfter = buffsOf(runtime, enemy, 'choang')[0]
    expect(choangAfter?.instanceId).toBe(choangBefore?.instanceId)
    expect(choangAfter!.remaining).toBe(choangBefore!.remaining)
  })

  it('re-seeds a FIXED 1 stack at AUTHORED duration with potency recomputed vs the caster current stats', () => {
    const { battle, player, enemy, enemyEntity, playerEntity, system, runtime, addRosterParticipant } = harness(DETONATE_ROOT)

    // Enemy-origin seed with woodPower 10; the re-seed must resolve vs
    // the PLAYER's wood power 130 on subsequent ticks.
    const weakSource = addRosterParticipant(
      makeParticipant('minion', createCombatant({ id: 'minion', stats: createBaseStats({ might: 0, woodPower: 10 }) }), 1, 2),
    )
    for (let i = 0; i < 3; i++) {
      runtime.applyBuff('trung_doc', enemy, weakSource)
    }
    runtime.applyBuff('trung_doc', enemy, player)

    const hpBefore = enemyEntity.currentHp
    system.resolveActorTurn(battle, player)

    // minion burst: 0.2 x 5 x 3 x 1.5 = 4.5 vs wood 10 -> 45; player's
    // own trung_doc: 0.2 x 5 x 1 x 1.5 = 1.5 vs wood 130 -> 195; bong:
    // 135; direct min-1.
    expect(enemyEntity.currentHp).toBeCloseTo(hpBefore - 45 - 195 - 135 - 1, 0)

    // Both consumed instances are gone; the id re-seeded ONCE by the
    // CASTER at exactly 1 stack and the AUTHORED 5-turn duration.
    const reseeded = buffsOf(runtime, enemy, 'trung_doc')
    expect(reseeded).toHaveLength(1)
    expect(reseeded[0]!.sourceId).toBe('player')
    expect(reseeded[0]!.stacks).toBe(1)
    expect(reseeded[0]!.remaining).toBe(5)

    // Potency recomputed vs the caster's CURRENT stats — the enemy's
    // own turn end ticks BOTH re-seeded ailments at caster power:
    // trung_doc 130 wood x 0.2 = 26 (never the consumed snapshot's
    // stale 2/tick) + bong 150 fire x 0.15 = 22.5.
    const hpAfterDetonate = enemyEntity.currentHp
    system.resolveActorTurn(battle, enemy)
    expect(hpAfterDetonate - enemyEntity.currentHp).toBeCloseTo(26 + 22.5, 5)
  })

  it('re-seed is reaction-silent — suppressed eligibility is wired into the consume+re-seed ops', () => {
    const { battle, player, enemy, system, runtime } = harness(DETONATE_ROOT)

    // trung_doc (wood) incumbent + the cast's bong (fire): with the
    // legacy manager deleted (M-INT) there is no reaction listener at
    // all — both ailments are DoT so the detonate consumes them, and
    // the re-seeded pair rides 'suppressed' eligibility by contract.
    runtime.applyBuff('trung_doc', enemy, player)

    system.resolveActorTurn(battle, player)

    // Re-seeded pair present at fixed 1 stack each, caster-sourced.
    expect(buffsOf(runtime, enemy, 'trung_doc')[0]!.stacks).toBe(1)
    expect(buffsOf(runtime, enemy, 'bong')[0]!.stacks).toBe(1)
  })

  it('a clean target still takes the direct hit + application — consume+re-seed is simply 0', () => {
    const { battle, player, enemy, enemyEntity, system, runtime } = harness(DETONATE_ROOT)

    const hpBefore = enemyEntity.currentHp
    system.resolveActorTurn(battle, player)

    // Direct packet floors at 1 + the fresh bong IS a DoT ailment —
    // consumed for intent 0.15 x 4 x 1 x 1.5 = 0.9 vs caster fire power
    // 150 -> 135, then re-seeded at fixed 1.
    expect(enemyEntity.currentHp).toBeCloseTo(hpBefore - 1 - 135, 0)
    const bong = buffsOf(runtime, enemy, 'bong')
    expect(bong).toHaveLength(1)
    expect(bong[0]!.stacks).toBe(1)
    expect(bong[0]!.remaining).toBe(4)
  })
})

describe('Nuke (no-route empowered ult)', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('scales final damage linearly with theBurned, including excess above the threshold', () => {
    // Same payload, two pool levels: 100 -> x2.0, 150 -> x2.5.
    const at100 = harness(NUKE_ROOT, 100)
    const at150 = harness(NUKE_ROOT, 150, 150)

    const hp100 = at100.enemyEntity.currentHp
    const hp150 = at150.enemyEntity.currentHp

    at100.system.resolveActorTurn(at100.battle, at100.player)
    at150.system.resolveActorTurn(at150.battle, at150.player)

    const dealt100 = hp100 - at100.enemyEntity.currentHp
    const dealt150 = hp150 - at150.enemyEntity.currentHp

    expect(dealt150 / dealt100).toBeCloseTo(2.5 / 2.0, 5)
    expect(at150.player.entity.currentThe).toBe(0)
  })

  it('theBurned reads the PRE-BURN pool (captured before consumesAllThe zeroes it)', () => {
    const { battle, player, system } = harness(NUKE_ROOT, 130, 150)

    const result = system.resolveActorTurn(battle, player)

    expect(result.execution?.theBurned).toBe(130)
    expect(player.entity.currentThe).toBe(0)
  })
})
