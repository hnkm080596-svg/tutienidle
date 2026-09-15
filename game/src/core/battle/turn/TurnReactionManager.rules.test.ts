import { describe, expect, it, vi, afterEach } from 'vitest'
import { CONG_MINH_AMP, KHAC_CHE_COEFF, TurnReactionManager } from './TurnReactionManager'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import { BuffSystem } from '../../buff/BuffSystem'
import { BuffPool } from '../../buff/BuffPool'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import { GENERIC_PHYSICAL_BASIC, PHAP_TU_BASICS } from '../../../data/skill/TurnBasicAttacks'
import type { CombatEntity } from '../../combat/CombatEntity'

// Phap Tu Reimagined Task 12 — spec §6 rule engine. The 10 authored
// ELEMENT_REACTIONS pairs are replaced by two rule classes driven by
// WuxingRelations: khac pairs -> Khac Che (consume both, burst on the
// overcomer element) and sinh pairs -> Cong Minh (no consume, the
// wuxing-direction child gains potency+duration). The manager itself
// is provenance-agnostic; the player-origin initiation gate lives at
// the engine call site (applySkillAilments) and is tested through the
// real TurnBattleSystem below.

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

function makeHarness() {
  const eventBus = new EventBus()
  const reactionManager = new TurnReactionManager(eventBus)
  const combatSystem = new CombatSystem(eventBus)
  const reactionEvents: { name?: string; damage?: number }[] = []
  eventBus.on('reaction', (event) => reactionEvents.push(event as { name?: string; damage?: number }))
  return { eventBus, reactionManager, combatSystem, reactionEvents }
}

function dotDamage(pool: BuffPool, id: string, sourceId: string): number {
  const buff = pool.getFromSource(id, sourceId)
  const dot = buff?.effects.find((e) => e.type === 'dot')
  return dot && dot.type === 'dot' ? dot.damagePerSecond ?? 0 : 0
}

describe('TurnReactionManager — Khac Che (khac pair rule)', () => {
  it('consumes BOTH instances and bursts on the OVERCOMER element (Kim into Hoa bursts as Hoa)', () => {
    const { reactionManager, combatSystem, reactionEvents } = makeHarness()
    const source = createCombatant({ id: 'src', type: 'player', stats: createBaseStats({ might: 100, firePower: 50 }) })
    const target = createCombatant({ id: 'tgt', currentHp: 100_000, maxHp: 100_000 })

    const pool = new BuffPool()
    const buffs = new BuffSystem(pool)
    buffs.apply(BUFF_REGISTRY.get('bong'), source, target)
    buffs.apply(BUFF_REGISTRY.get('chay_mau'), source, target)

    reactionManager.checkAndTrigger(pool, 'chay_mau', source, target, combatSystem, BUFF_REGISTRY)

    // consumedStacks (1+1) x elementalBasePower(fire) 150 x COEFF x (1+0)
    // — the burst is FIRE because fire overcomes metal; metal power and
    // metal resistance are irrelevant to this pair.
    expect(target.currentHp).toBe(100_000 - 2 * 150 * KHAC_CHE_COEFF)
    expect(pool.getAll()).toEqual([])
    expect(reactionEvents).toEqual([expect.objectContaining({ name: 'khac_che' })])
  })

  it('applies the target\'s resistance to the overcomer element', () => {
    const { reactionManager, combatSystem } = makeHarness()
    const source = createCombatant({ id: 'src', type: 'player', stats: createBaseStats({ might: 100, firePower: 50 }) })
    const target = createCombatant({
      id: 'tgt',
      currentHp: 100_000,
      maxHp: 100_000,
      stats: createBaseStats({ fireResistance: 25, metalResistance: 75 }),
    })

    const pool = new BuffPool()
    const buffs = new BuffSystem(pool)
    buffs.apply(BUFF_REGISTRY.get('bong'), source, target)
    buffs.apply(BUFF_REGISTRY.get('chay_mau'), source, target)

    reactionManager.checkAndTrigger(pool, 'chay_mau', source, target, combatSystem, BUFF_REGISTRY)

    // metalResistance 75 must NOT apply — the pair bursts as fire.
    expect(target.currentHp).toBe(100_000 - 2 * 150 * KHAC_CHE_COEFF * 0.75)
  })

  it('consumedStacks = stacks(newcomer) + stacks(incumbent)', () => {
    const { reactionManager, combatSystem } = makeHarness()
    const source = createCombatant({ id: 'src', type: 'player', stats: createBaseStats({ might: 0, waterPower: 40 }) })
    const target = createCombatant({ id: 'tgt', currentHp: 100_000, maxHp: 100_000 })

    const pool = new BuffPool()
    const buffs = new BuffSystem(pool)
    buffs.apply(BUFF_REGISTRY.get('bong'), source, target)
    buffs.apply(BUFF_REGISTRY.get('bong'), source, target) // stacks -> 2
    buffs.apply(BUFF_REGISTRY.get('te_cong'), source, target)

    reactionManager.checkAndTrigger(pool, 'te_cong', source, target, combatSystem, BUFF_REGISTRY)

    // water overcomes fire; (2 bong stacks + 1 te_cong stack) x 40.
    expect(target.currentHp).toBe(100_000 - 3 * 40 * KHAC_CHE_COEFF)
  })

  it('reactionEffectPercent amplifies the burst', () => {
    const { reactionManager, combatSystem } = makeHarness()
    const source = createCombatant({ id: 'src', type: 'player' })
    source.stats.reactionEffectPercent = 0.5
    source.stats.might = 0
    source.stats.waterPower = 40

    const target = createCombatant({ id: 'tgt', currentHp: 100_000, maxHp: 100_000 })

    const pool = new BuffPool()
    const buffs = new BuffSystem(pool)
    buffs.apply(BUFF_REGISTRY.get('bong'), source, target)
    buffs.apply(BUFF_REGISTRY.get('te_cong'), source, target)

    reactionManager.checkAndTrigger(pool, 'te_cong', source, target, combatSystem, BUFF_REGISTRY)

    expect(target.currentHp).toBe(100_000 - 2 * 40 * KHAC_CHE_COEFF * 1.5)
  })
})

describe('TurnReactionManager — Cong Minh (sinh pair rule)', () => {
  it('does NOT consume either instance and amps the CHILD ailment (newcomer is child)', () => {
    const { reactionManager, combatSystem, reactionEvents } = makeHarness()
    const source = createCombatant({ id: 'src', type: 'player' })
    const target = createCombatant({ id: 'tgt', currentHp: 100_000, maxHp: 100_000 })

    const pool = new BuffPool()
    const buffs = new BuffSystem(pool)
    buffs.apply(BUFF_REGISTRY.get('trung_doc'), source, target) // wood incumbent
    buffs.apply(BUFF_REGISTRY.get('bong'), source, target) // fire newcomer

    const beforeDot = dotDamage(pool, 'bong', 'src')
    const beforeTurns = pool.getFromSource('bong', 'src')!.remainingTurns
    const docDot = dotDamage(pool, 'trung_doc', 'src')
    const docTurns = pool.getFromSource('trung_doc', 'src')!.remainingTurns

    reactionManager.checkAndTrigger(pool, 'bong', source, target, combatSystem, BUFF_REGISTRY)

    // wood generates fire -> the CHILD is fire = the newcomer instance.
    expect(pool.getAll()).toHaveLength(2)
    expect(dotDamage(pool, 'bong', 'src')).toBeCloseTo(beforeDot * (1 + CONG_MINH_AMP), 5)
    expect(pool.getFromSource('bong', 'src')!.remainingTurns).toBeCloseTo(beforeTurns * (1 + CONG_MINH_AMP), 5)
    // the parent (wood incumbent) is untouched.
    expect(dotDamage(pool, 'trung_doc', 'src')).toBeCloseTo(docDot, 5)
    expect(pool.getFromSource('trung_doc', 'src')!.remainingTurns).toBeCloseTo(docTurns, 5)
    expect(target.currentHp).toBe(100_000)
    expect(reactionEvents).toEqual([expect.objectContaining({ name: 'cong_minh', damage: 0 })])
  })

  it('amps the INCUMBENT when wuxing direction makes it the child (order-independent beneficiary)', () => {
    const { reactionManager, combatSystem } = makeHarness()
    const source = createCombatant({ id: 'src', type: 'player' })
    const target = createCombatant({ id: 'tgt', currentHp: 100_000, maxHp: 100_000 })

    const pool = new BuffPool()
    const buffs = new BuffSystem(pool)
    buffs.apply(BUFF_REGISTRY.get('bong'), source, target) // fire incumbent
    buffs.apply(BUFF_REGISTRY.get('trung_doc'), source, target) // wood newcomer

    const bongDot = dotDamage(pool, 'bong', 'src')
    const bongTurns = pool.getFromSource('bong', 'src')!.remainingTurns
    const docDot = dotDamage(pool, 'trung_doc', 'src')

    reactionManager.checkAndTrigger(pool, 'trung_doc', source, target, combatSystem, BUFF_REGISTRY)

    // Same pair, flipped arrival order: the child is STILL fire — the
    // incumbent bong gains the amp, not the wood newcomer.
    expect(pool.getAll()).toHaveLength(2)
    expect(dotDamage(pool, 'bong', 'src')).toBeCloseTo(bongDot * (1 + CONG_MINH_AMP), 5)
    expect(pool.getFromSource('bong', 'src')!.remainingTurns).toBeCloseTo(bongTurns * (1 + CONG_MINH_AMP), 5)
    expect(dotDamage(pool, 'trung_doc', 'src')).toBeCloseTo(docDot, 5)
    expect(target.currentHp).toBe(100_000)
  })

  it('amps a NON-DoT child — statModifier percent and onHitProc chance both scale (Fire->Earth / Thach Hoa)', () => {
    // Review fix (MED-4): "potency" is every numeric magnitude carrier
    // on the child, not just DoT fields — otherwise Fire->Earth Cong
    // Minh duration-amps Thach Hoa while leaving -evasionRate and the
    // Choang proc at base strength.
    const { reactionManager, combatSystem, reactionEvents } = makeHarness()
    const source = createCombatant({ id: 'src', type: 'player' })
    const target = createCombatant({ id: 'tgt', currentHp: 100_000, maxHp: 100_000 })

    const pool = new BuffPool()
    const buffs = new BuffSystem(pool)
    buffs.apply(BUFF_REGISTRY.get('bong'), source, target) // fire incumbent
    buffs.apply(BUFF_REGISTRY.get('thach_hoa'), source, target) // earth newcomer — child

    const child = pool.getFromSource('thach_hoa', 'src')!
    const beforeTurns = child.remainingTurns

    reactionManager.checkAndTrigger(pool, 'thach_hoa', source, target, combatSystem, BUFF_REGISTRY)

    expect(child.effects).toContainEqual(
      expect.objectContaining({ type: 'statModifier', stat: 'evasionRate', percent: -0.3 * (1 + CONG_MINH_AMP) }),
    )
    expect(child.effects).toContainEqual(
      expect.objectContaining({ type: 'onHitProc', chance: 0.5 * (1 + CONG_MINH_AMP), appliesBuffId: 'choang' }),
    )
    expect(child.remainingTurns).toBeCloseTo(beforeTurns * (1 + CONG_MINH_AMP), 5)
    expect(reactionEvents).toEqual([expect.objectContaining({ name: 'cong_minh', damage: 0 })])
  })

  it('amps a child INSTANCE at most once — re-applying the parent must not compound potency or duration', () => {
    // Review round-2 (MEDIUM): refresh/stack keep the same Buff instance,
    // so a repeat sinh event would re-scale already-amplified effects
    // (x1.5 -> x2.25 -> x3.375...). Rule: one Cong Minh amplification
    // per ailment instance — potency AND duration consumed together.
    const { reactionManager, combatSystem, reactionEvents } = makeHarness()
    const source = createCombatant({ id: 'src', type: 'player' })
    const target = createCombatant({ id: 'tgt', currentHp: 100_000, maxHp: 100_000 })

    const pool = new BuffPool()
    const buffs = new BuffSystem(pool)
    buffs.apply(BUFF_REGISTRY.get('bong'), source, target) // fire incumbent
    buffs.apply(BUFF_REGISTRY.get('trung_doc'), source, target) // wood newcomer

    const baseDot = dotDamage(pool, 'bong', 'src')

    reactionManager.checkAndTrigger(pool, 'trung_doc', source, target, combatSystem, BUFF_REGISTRY)

    const ampedDot = dotDamage(pool, 'bong', 'src')
    const ampedTurns = pool.getFromSource('bong', 'src')!.remainingTurns
    expect(ampedDot).toBeCloseTo(baseDot * (1 + CONG_MINH_AMP), 5)

    // Re-apply the wood parent — the SAME fire instance pairs again.
    buffs.apply(BUFF_REGISTRY.get('trung_doc'), source, target)
    reactionManager.checkAndTrigger(pool, 'trung_doc', source, target, combatSystem, BUFF_REGISTRY)

    expect(dotDamage(pool, 'bong', 'src')).toBeCloseTo(ampedDot, 5)
    expect(pool.getFromSource('bong', 'src')!.remainingTurns).toBeCloseTo(ampedTurns, 5)
    // No phantom reaction — the event means "the child was amplified".
    expect(reactionEvents).toHaveLength(1)
  })

  it('amps a NEW child instance again — the once-per-instance bound is not global', () => {
    const { reactionManager, combatSystem } = makeHarness()
    const source = createCombatant({ id: 'src', type: 'player' })
    const target = createCombatant({ id: 'tgt', currentHp: 100_000, maxHp: 100_000 })

    const pool = new BuffPool()
    const buffs = new BuffSystem(pool)
    buffs.apply(BUFF_REGISTRY.get('bong'), source, target)
    buffs.apply(BUFF_REGISTRY.get('trung_doc'), source, target)
    reactionManager.checkAndTrigger(pool, 'trung_doc', source, target, combatSystem, BUFF_REGISTRY)

    // Fresh instance replaces the amplified one — it may consume its
    // own one-time amplification.
    pool.removeInstance('bong', 'src')
    buffs.apply(BUFF_REGISTRY.get('bong'), source, target)
    buffs.apply(BUFF_REGISTRY.get('trung_doc'), source, target)

    const baseDot = dotDamage(pool, 'bong', 'src')
    reactionManager.checkAndTrigger(pool, 'trung_doc', source, target, combatSystem, BUFF_REGISTRY)

    expect(dotDamage(pool, 'bong', 'src')).toBeCloseTo(baseDot * (1 + CONG_MINH_AMP), 5)
  })
})

describe('TurnReactionManager — two-phase order and dead-pair skip', () => {
  it('sinh resolves before khac for one application event (event order cong_minh -> khac_che)', () => {
    const { reactionManager, combatSystem, reactionEvents } = makeHarness()
    const source = createCombatant({ id: 'src', type: 'player', stats: createBaseStats({ might: 0, waterPower: 40 }) })
    const target = createCombatant({ id: 'tgt', currentHp: 100_000, maxHp: 100_000 })

    const pool = new BuffPool()
    const buffs = new BuffSystem(pool)
    buffs.apply(BUFF_REGISTRY.get('trung_doc'), source, target) // wood
    buffs.apply(BUFF_REGISTRY.get('te_cong'), source, target) // water
    buffs.apply(BUFF_REGISTRY.get('bong'), source, target) // fire newcomer

    reactionManager.checkAndTrigger(pool, 'bong', source, target, combatSystem, BUFF_REGISTRY)

    // fire+wood = sinh (child fire — the newcomer is amped THEN the
    // khac phase may still consume it); fire+water = khac (water wins).
    expect(reactionEvents.map((e) => e.name)).toEqual(['cong_minh', 'khac_che'])
    expect(pool.getAll().map((b) => b.id)).toEqual(['trung_doc'])
    // khac burst: (1 bong + 1 te_cong) x waterPower 40.
    expect(target.currentHp).toBe(100_000 - 2 * 40 * KHAC_CHE_COEFF)
  })

  it('a consumed newcomer ends its remaining pairs (later khac pair is skipped)', () => {
    const { reactionManager, combatSystem, reactionEvents } = makeHarness()
    const source = createCombatant({ id: 'src', type: 'player', stats: createBaseStats({ might: 0, firePower: 40 }) })
    const target = createCombatant({ id: 'tgt', currentHp: 100_000, maxHp: 100_000 })

    const pool = new BuffPool()
    const buffs = new BuffSystem(pool)
    buffs.apply(BUFF_REGISTRY.get('chay_mau'), source, target) // metal (order idx 3)
    buffs.apply(BUFF_REGISTRY.get('te_cong'), source, target) // water (order idx 4)
    buffs.apply(BUFF_REGISTRY.get('bong'), source, target) // fire newcomer

    reactionManager.checkAndTrigger(pool, 'bong', source, target, combatSystem, BUFF_REGISTRY)

    // Both metal and water are khac vs fire. metal resolves first
    // (ELEMENT_ORDER), consumes bong -> the water pair is dead and
    // skipped: exactly one burst, te_cong survives.
    expect(reactionEvents).toHaveLength(1)
    expect(pool.getAll().map((b) => b.id)).toEqual(['te_cong'])
    expect(target.currentHp).toBe(100_000 - 2 * 40 * KHAC_CHE_COEFF)
  })
})

describe('TurnReactionManager — eligibility', () => {
  it('untagged (non-elemental) buffs never react', () => {
    const { reactionManager, combatSystem, reactionEvents } = makeHarness()
    const source = createCombatant({ id: 'src', type: 'player' })
    const target = createCombatant({ id: 'tgt', currentHp: 100_000, maxHp: 100_000 })

    const pool = new BuffPool()
    const buffs = new BuffSystem(pool)
    buffs.apply(BUFF_REGISTRY.get('bong'), source, target)
    buffs.apply(BUFF_REGISTRY.get('choang'), source, target) // no element tag

    reactionManager.checkAndTrigger(pool, 'choang', source, target, combatSystem, BUFF_REGISTRY)

    expect(reactionEvents).toHaveLength(0)
    expect(pool.getAll()).toHaveLength(2)
    expect(target.currentHp).toBe(100_000)
  })

  it('two ailments sharing ONE element never react (same-element pair)', () => {
    const { reactionManager, combatSystem, reactionEvents } = makeHarness()
    const source = createCombatant({ id: 'src', type: 'player' })
    const target = createCombatant({ id: 'tgt', currentHp: 100_000, maxHp: 100_000 })

    const pool = new BuffPool()
    const buffs = new BuffSystem(pool)
    buffs.apply(BUFF_REGISTRY.get('bong'), source, target) // fire
    buffs.apply(BUFF_REGISTRY.get('dung_nham'), source, target) // fire

    reactionManager.checkAndTrigger(pool, 'dung_nham', source, target, combatSystem, BUFF_REGISTRY)

    expect(reactionEvents).toHaveLength(0)
    expect(pool.getAll()).toHaveLength(2)
  })

  it('incumbents are provenance-agnostic — an enemy-sourced ailment pairs against a player application', () => {
    const { reactionManager, combatSystem, reactionEvents } = makeHarness()
    const player = createCombatant({ id: 'player', type: 'player', stats: createBaseStats({ might: 0, firePower: 40 }) })
    const enemy = createCombatant({ id: 'enemy', type: 'enemy' })
    const target = createCombatant({ id: 'tgt', currentHp: 100_000, maxHp: 100_000 })

    const pool = new BuffPool()
    const buffs = new BuffSystem(pool)
    buffs.apply(BUFF_REGISTRY.get('bong'), enemy, target) // ENEMY-origin incumbent
    buffs.apply(BUFF_REGISTRY.get('chay_mau'), player, target)

    reactionManager.checkAndTrigger(pool, 'chay_mau', player, target, combatSystem, BUFF_REGISTRY)

    expect(reactionEvents).toHaveLength(1)
    expect(pool.getAll()).toEqual([])
  })
})

// ---- Player-origin initiation gate (engine level, INV-8/D21) ----

function makeParticipant(
  id: string,
  combatEntity: CombatEntity,
  speed: number,
  priority: number,
  basic: TurnBattleParticipant['basic'] = GENERIC_PHYSICAL_BASIC,
): TurnBattleParticipant {
  return {
    id,
    entity: combatEntity,
    speed,
    priority,
    actionGauge: 0,
    alive: combatEntity.alive,
    buffs: new BuffPool(),
    consecutiveHardCcTurns: 0,
    basic,
  }
}

describe('player-origin gate — enemies participate as incumbents, never initiate', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('an ENEMY-side application onto a paired target fires NO reaction', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)
    const system = new TurnBattleSystem(combat, 10_000, BUFF_REGISTRY, undefined, new TurnReactionManager(eventBus))

    const playerEntity = createCombatant({ id: 'player', type: 'player' })
    const enemyEntity = createCombatant({ id: 'enemy', currentHp: 1_000_000, stats: createBaseStats({ might: 0 }) })

    const player = makeParticipant('player', playerEntity, 10, 0)
    const enemy = makeParticipant('enemy', enemyEntity, 10, 1, PHAP_TU_BASICS.fire)

    // The player already holds a water ailment (player-origin incumbent).
    new BuffSystem(player.buffs).apply(BUFF_REGISTRY.get('te_cong'), playerEntity, playerEntity, BUFF_REGISTRY)

    const battle: TurnBattle = { players: [player], enemies: [enemy], state: 'fighting' }
    const reactionEvents: unknown[] = []
    eventBus.on('reaction', (event) => reactionEvents.push(event))

    vi.spyOn(Math, 'random').mockReturnValue(0.2) // < fire ailment chance

    system.resolveActorTurn(battle, enemy)

    expect(reactionEvents).toHaveLength(0)
    expect(player.buffs.hasAny('bong')).toBe(true)
    expect(player.buffs.hasAny('te_cong')).toBe(true)
  })

  it('an enemy-ORIGIN incumbent on the enemy + a phap_tu player metal application resolves normally', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)
    const system = new TurnBattleSystem(combat, 10_000, BUFF_REGISTRY, undefined, new TurnReactionManager(eventBus))

    const playerEntity = createCombatant({ id: 'player', type: 'player' })
    const enemyEntity = createCombatant({ id: 'enemy', currentHp: 1_000_000, stats: createBaseStats({ might: 0 }) })

    // Review fix (MED-3): initiation authority is the explicit
    // phap_tu-domain capability flag, not player-side membership.
    const player = makeParticipant('player', playerEntity, 10, 0, PHAP_TU_BASICS.metal)
    player.canInitiateWuxingReactions = true
    const enemy = makeParticipant('enemy', enemyEntity, 10, 1)

    // Enemy-origin fire incumbent sitting on the enemy (e.g. a boss
    // self-debuff): it participates but could not have initiated.
    new BuffSystem(enemy.buffs).apply(BUFF_REGISTRY.get('bong'), enemyEntity, enemyEntity, BUFF_REGISTRY)

    const battle: TurnBattle = { players: [player], enemies: [enemy], state: 'fighting' }
    const reactionEvents: unknown[] = []
    eventBus.on('reaction', (event) => reactionEvents.push(event))

    vi.spyOn(Math, 'random').mockReturnValue(0.2)

    system.resolveActorTurn(battle, player)

    expect(reactionEvents).toHaveLength(1)
    expect(enemy.buffs.hasAny('bong')).toBe(false)
    expect(enemy.buffs.hasAny('chay_mau')).toBe(false)
  })

  it('a player-side participant WITHOUT the capability never initiates — even against an enemy incumbent', () => {
    // Review fix (MED-3): companions, mortal actors, kiem_tu — anything
    // sharing the players array without the phap_tu domain — must not
    // trigger reactions. Spec §6: the pair check is a phap_tu-domain
    // capability, not a party-membership inference.
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)
    const system = new TurnBattleSystem(combat, 10_000, BUFF_REGISTRY, undefined, new TurnReactionManager(eventBus))

    const companionEntity = createCombatant({ id: 'companion', type: 'player' })
    const enemyEntity = createCombatant({ id: 'enemy', currentHp: 1_000_000, stats: createBaseStats({ might: 0 }) })

    const companion = makeParticipant('companion', companionEntity, 10, 0, PHAP_TU_BASICS.metal)
    const enemy = makeParticipant('enemy', enemyEntity, 10, 1)

    new BuffSystem(enemy.buffs).apply(BUFF_REGISTRY.get('bong'), enemyEntity, enemyEntity, BUFF_REGISTRY)

    const battle: TurnBattle = { players: [companion], enemies: [enemy], state: 'fighting' }
    const reactionEvents: unknown[] = []
    eventBus.on('reaction', (event) => reactionEvents.push(event))

    vi.spyOn(Math, 'random').mockReturnValue(0.2)

    system.resolveActorTurn(battle, companion)

    expect(reactionEvents).toHaveLength(0)
    // The ailment still lands — only reaction INITIATION is gated.
    expect(enemy.buffs.hasAny('chay_mau')).toBe(true)
    expect(enemy.buffs.hasAny('bong')).toBe(true)
  })
})
