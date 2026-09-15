import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import { TurnReactionManager } from './TurnReactionManager'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import { BuffPool } from '../../buff/BuffPool'
import { BuffSystem } from '../../buff/BuffSystem'
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import { GENERIC_PHYSICAL_BASIC } from '../../../data/skill/TurnBasicAttacks'
import type { TurnSkillDefinition } from './TurnSkillAction'

// Phap Tu Reimagined Task 13 — spec §4: the empowered ult's two route
// expressions. `detonate` (dot route): direct + normal application
// first, then consume every live DoT ailment for remaining-tick x
// stacks x DETONATE_AMP and re-seed a FIXED 1 stack at AUTHORED
// duration with potency recomputed vs the caster's CURRENT stats —
// reaction-silent (O2/R2). `nuke` (no route): damage x (1 +
// theBurned/100 x NUKE_THE_COEFF), linear in the whole pool.

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
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    currentThe: 0,
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
    buffs: new BuffPool(),
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
  const eventBus = new EventBus()
  const combat = new CombatSystem(eventBus)
  const reactionManager = new TurnReactionManager(eventBus)
  const triggerSpy = vi.spyOn(reactionManager, 'checkAndTrigger')
  const reactionEvents: { name?: string }[] = []
  eventBus.on('reaction', (event) => reactionEvents.push(event as { name?: string }))

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
  const system = new TurnBattleSystem(combat, 10_000, BUFF_REGISTRY, undefined, undefined, reactionManager)

  return { battle, player, enemy, playerEntity, enemyEntity, system, reactionEvents, triggerSpy }
}

function dotTick(pool: BuffPool, id: string, sourceId: string): number {
  const buff = pool.getFromSource(id, sourceId)
  const dot = buff?.effects.find((e) => e.type === 'dot')
  return dot && dot.type === 'dot' ? dot.damagePerTurn ?? dot.damagePerSecond ?? 0 : 0
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
    const { battle, player, enemy, enemyEntity, playerEntity, system } = harness(DETONATE_ROOT)

    // Pre-seed: trung_doc (wood DoT) x3 from a THIRD source with
    // woodPower 10 -> snapshot 2/tick; choang (stun — untagged, no dot)
    // is a pure-utility ailment the detonate must leave alone AND that
    // never forms a reaction pair.
    const thirdSource = createCombatant({ id: 'minion', stats: createBaseStats({ might: 0, woodPower: 10 }) })
    const enemyBuffs = new BuffSystem(enemy.buffs)
    for (let i = 0; i < 3; i++) {
      enemyBuffs.apply(BUFF_REGISTRY.get('trung_doc'), thirdSource, enemyEntity, BUFF_REGISTRY)
    }
    enemyBuffs.apply(BUFF_REGISTRY.get('choang'), playerEntity, enemyEntity, BUFF_REGISTRY)
    const choangBefore = enemy.buffs.getFromSource('choang', 'player')

    const hpBefore = enemyEntity.currentHp
    system.resolveActorTurn(battle, player)

    // trung_doc burst: (0 might + 10 woodPower) x 0.2 = 2/tick x 5 turns
    // x 3 stacks x 1.5 = 45. The applied bong (fire) pairs SINH with the
    // wood incumbent at application — legitimately amped to 33.75/tick
    // and 6 turns before the detonate consumes it: 33.75 x 6 x 1 x 1.5
    // = 303.75. Direct packet floors at min-1.
    expect(enemyEntity.currentHp).toBeCloseTo(hpBefore - 45 - 303.75 - 1, 0)

    // Utility ailment untouched — same instance, same remaining life.
    const choangAfter = enemy.buffs.getFromSource('choang', 'player')
    expect(choangAfter).toBe(choangBefore)
    expect(choangAfter!.remainingTurns).toBe(choangBefore!.remainingTurns)
  })

  it('re-seeds a FIXED 1 stack at AUTHORED duration with potency recomputed vs the caster current stats', () => {
    const { battle, player, enemy, enemyEntity, playerEntity, system } = harness(DETONATE_ROOT)

    // Enemy-origin seed with woodPower 10 -> consumed snapshot ticks 2;
    // the re-seed must recompute vs the PLAYER's woodPower 30 -> 6/tick.
    const weakSource = createCombatant({ id: 'minion', stats: createBaseStats({ might: 0, woodPower: 10 }) })
    const enemyBuffs = new BuffSystem(enemy.buffs)
    for (let i = 0; i < 3; i++) {
      enemyBuffs.apply(BUFF_REGISTRY.get('trung_doc'), weakSource, enemyEntity, BUFF_REGISTRY)
    }
    enemyBuffs.apply(BUFF_REGISTRY.get('trung_doc'), playerEntity, enemyEntity, BUFF_REGISTRY)

    system.resolveActorTurn(battle, player)

    // The consumed instances (both sources) are gone; each id re-seeded
    // by the CASTER at exactly 1 stack and the AUTHORED 5-turn duration
    // — not the consumed stack's remaining life, not a stack-up.
    expect(enemy.buffs.getFromSource('trung_doc', 'minion')).toBeUndefined()
    const reseeded = enemy.buffs.getFromSource('trung_doc', 'player')
    expect(reseeded).toBeDefined()
    expect(reseeded!.stacks).toBe(1)
    expect(reseeded!.remainingTurns).toBe(5)
    // Potency recomputed from the caster's CURRENT stats —
    // elementalBasePower (might 100 + woodPower 30) x dpsRatio 0.2 = 26,
    // never the consumed snapshot's stale 2/tick.
    expect(dotTick(enemy.buffs, 'trung_doc', 'player')).toBeCloseTo(26, 5)
  })

  it('is reaction-silent — the re-seed never reaches TurnReactionManager', () => {
    const { battle, player, enemy, enemyEntity, playerEntity, system, reactionEvents, triggerSpy } = harness(DETONATE_ROOT)

    // trung_doc (wood) incumbent + the cast's bong (fire) application
    // form a SINH pair at application — that legitimate check is the
    // ONLY checkAndTrigger call allowed; both ailments are DoT so the
    // detonate consumes them, and the re-seeded pair must NOT re-fire.
    new BuffSystem(enemy.buffs).apply(BUFF_REGISTRY.get('trung_doc'), playerEntity, enemyEntity, BUFF_REGISTRY)

    system.resolveActorTurn(battle, player)

    expect(triggerSpy).toHaveBeenCalledTimes(1)
    expect(reactionEvents.map((e) => e.name)).toEqual(['cong_minh'])
    // Re-seeded pair is present and un-amped (no leaked cong_minh).
    expect(enemy.buffs.getFromSource('trung_doc', 'player')!.stacks).toBe(1)
    expect(enemy.buffs.getFromSource('bong', 'player')!.stacks).toBe(1)
  })

  it('a clean target still takes the direct hit + application — consume+re-seed is simply 0', () => {
    const { battle, player, enemy, enemyEntity, system } = harness(DETONATE_ROOT)

    const hpBefore = enemyEntity.currentHp
    system.resolveActorTurn(battle, player)

    // Direct packet floors at 1 + the fresh bong IS a DoT ailment —
    // consumed for (100 might + 50 firePower) x 0.15 = 22.5/tick x 4
    // turns x 1 stack x 1.5 = 135, then re-seeded at fixed 1.
    expect(enemyEntity.currentHp).toBeCloseTo(hpBefore - 1 - 135, 0)
    const bong = enemy.buffs.getFromSource('bong', 'player')
    expect(bong).toBeDefined()
    expect(bong!.stacks).toBe(1)
    expect(bong!.remainingTurns).toBe(4)
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
