import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'
import { SKILLS } from '../../data/skill/Skills'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'

// ARCH-008 (M10) — authored-parity regression matrix through REAL
// GameManager entry points (not converter isolation):
//  - BASIC_PROGRESS: production basic consumes canonical resolved skill
//    output — tram's per-cast flat bonus (L3 @ 10000 casts => x1001)
//    reaches the participant basic, and the mortal kit reports 'tram'
//    so skillCastCounts accrue toward the bat_kiem route gate.
//  - SPECIALIZATION_DURATION: authored buff-effect duration rides
//    appliesBuff.duration through BuffSystem.apply (8 * 0.998 = 7.984,
//    not the registry-default 6 * 0.998 = 5.988).
//  - Hoi Xuan Dan retirement: the family is explicitly retired across
//    craftable + usable surfaces; not a silent no-op.

const ENEMY_STATS_INPUT = {
  maxHp: 10_000_000,
  might: 0,
  attackSpeed: 1,
  criticalRate: 0,
  criticalDamage: 1.5,
  armor: 0,
}

function makeDummyEnemy(id: string) {
  return defineEnemy({
    id,
    name: 'Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: { ...ENEMY_STATS_INPUT },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
}

function makeManager() {
  const gameManager = new GameManager()
  const combatSource = new ManualClockSource()

  gameManager.setCombatClockSource(combatSource)
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerPills(pills)
  gameManager.catalogOps.registerAlchemyRecipes(alchemyRecipes)

  return { gameManager, combatSource }
}

describe('ARCH-008 — production basic consumes canonical resolved output', () => {
  it('kiem_tu tram basic carries the per-cast flat bonus (10000 casts -> x1001)', () => {
    const { gameManager } = makeManager()
    const player = createDefaultPlayer()
    player.cultivationPath = 'kiem_tu'

    gameManager.setActivePlayer(player)
    gameManager.progressionOps.learnSkill('tram')

    const tram = gameManager.skillManager.get('tram')!
    tram.totalExperience = 10_000

    gameManager.startBattleWithPlayer(player, makeDummyEnemy('parity_kiem_tu'))

    const basic = gameManager.getTurnBattle()!.players[0]!.basic!

    expect(basic.id).toBe('tram')
    expect(basic.damage?.kind).toBe('physical')
    expect(basic.damage?.multiplier).toBe(1001)
    // Basic slot stays cadence-free (turn cadence preserved).
    expect(basic.cooldownTurns).toBe(0)
  })

  it('mortal (no cultivationPath) with learned tram casts tram as basic — casts accrue to the mirror', () => {
    const { gameManager, combatSource } = makeManager()
    const player = createDefaultPlayer()

    gameManager.setActivePlayer(player)
    gameManager.progressionOps.learnSkill('tram')

    gameManager.startBattleWithPlayer(player, makeDummyEnemy('parity_mortal'))

    const participant = gameManager.getTurnBattle()!.players[0]!

    expect(participant.basic?.id).toBe('tram')

    for (let i = 0; i < 400 && !player.skillCastCounts?.['tram']; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    expect(player.skillCastCounts?.['tram'] ?? 0).toBeGreaterThan(0)
  })

  it('phap_tu wood basic doc_chuong executes authored pure-ailment semantics (no phantom x1 damage)', () => {
    const { gameManager } = makeManager()
    const player = createDefaultPlayer()
    player.cultivationPath = 'phap_tu'
    player.phapTu = { element: 'wood', route: null }

    gameManager.setActivePlayer(player)
    gameManager.progressionOps.learnSkill('doc_chuong')

    gameManager.startBattleWithPlayer(player, makeDummyEnemy('parity_wood'))

    const basic = gameManager.getTurnBattle()!.players[0]!.basic!

    expect(basic.id).toBe('doc_chuong')
    expect(basic.damage).toBeUndefined()
    expect(basic.appliesAilments).toContainEqual({ buffDefinitionId: 'trung_doc', chance: 1 })
  })

  it('phap_tu fire basic carries authored elemental components, scaling and ailment chance', () => {
    const { gameManager } = makeManager()
    const player = createDefaultPlayer()
    player.cultivationPath = 'phap_tu'
    player.phapTu = { element: 'fire', route: null }

    gameManager.setActivePlayer(player)
    gameManager.progressionOps.learnSkill('hoa_cau_thuat')

    gameManager.startBattleWithPlayer(player, makeDummyEnemy('parity_fire'))

    const basic = gameManager.getTurnBattle()!.players[0]!.basic!

    expect(basic.id).toBe('hoa_cau_thuat')
    expect(basic.damage?.kind).toBe('elemental')

    if (basic.damage?.kind === 'elemental') {
      expect(basic.damage.components).toEqual([{ kind: 'element', element: 'fire', ratio: 1 }])
      expect(basic.damage.scaling?.manaScalingRatio).toBe(0.001)
      expect(basic.damage.scaling?.attributeScaling).toEqual([
        { attributes: ['attunement'], ratioPerPoint: 0.004 },
      ])
    }

    expect(basic.appliesAilments).toContainEqual({ buffDefinitionId: 'bong', chance: 0.5 })
  })

  it('kiem_tu without learned tram falls back to the static build basic (physical x1, no authored scaling)', () => {
    const { gameManager } = makeManager()
    const player = createDefaultPlayer()
    player.cultivationPath = 'kiem_tu'

    gameManager.setActivePlayer(player)

    gameManager.startBattleWithPlayer(player, makeDummyEnemy('parity_kiem_tu_fallback'))

    const basic = gameManager.getTurnBattle()!.players[0]!.basic!

    expect(basic.id).toBe('tram')
    expect(basic.damage).toEqual({ kind: 'physical', multiplier: 1 })
  })

  it('mortal without learned tram keeps the generic physical basic', () => {
    const { gameManager } = makeManager()
    const player = createDefaultPlayer()

    gameManager.setActivePlayer(player)

    gameManager.startBattleWithPlayer(player, makeDummyEnemy('parity_mortal_fallback'))

    const basic = gameManager.getTurnBattle()!.players[0]!.basic!

    expect(basic.id).toBe('generic_physical')
    expect(basic.damage).toEqual({ kind: 'physical', multiplier: 1 })
  })
})

describe('ARCH-008 — authored buff duration rides appliesBuff.duration', () => {
  it('duong_linh_tuyen specialization applies thanh_tuyen for 7.984 turns, not the registry-default 5.988', () => {
    const { gameManager, combatSource } = makeManager()
    const player = createDefaultPlayer()
    player.cultivationPath = 'phap_tu'
    player.phapTu = { element: 'water', route: null }

    gameManager.setActivePlayer(player)
    gameManager.progressionOps.learnSkill('thanh_tuyen_duong_linh')
    gameManager.progressionOps.selectSkillSpecialization('thanh_tuyen_duong_linh', 'duong_linh_tuyen')

    gameManager.startBattleWithPlayer(player, makeDummyEnemy('parity_water'))

    const participant = gameManager.getTurnBattle()!.players[0]!

    // Reproduce the audit environment: -0.002 ailmentDurationPercent so the
    // authored 8-turn override lands as 8 * (1 - 0.002) = 7.984 while the
    // registry default 6 would land as 5.988.
    participant.entity.baseStats.ailmentDurationPercent = -0.002

    for (
      let i = 0;
      i < 2000 && participant.buffs.getAllById('thanh_tuyen').length === 0;
      i++
    ) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    const buff = participant.buffs.getAllById('thanh_tuyen')[0]

    expect(buff).toBeDefined()
    // Registry default 6 can never produce a duration above 6; the authored
    // override 8 lands just under 8 once the environment's resist/duration
    // factor applies (audit environment: 8 * 0.998 = 7.984).
    expect(buff!.duration).toBeGreaterThan(7.5)
    expect(buff!.duration).toBeLessThanOrEqual(8)
  })
})

describe('ARCH-008 — Hoi Xuan Dan explicitly retired (user-locked, HP regen not restored)', () => {
  it('usePillDetailed rejects the retired pill without consuming it', () => {
    const { gameManager } = makeManager()
    const player = createDefaultPlayer()

    gameManager.setActivePlayer(player)

    const pill = gameManager.pillRegistry.get('hoi_xuan_dan_mortal')

    expect(pill.retired).toBe(true)

    gameManager.pillBag.add(pill, 1)

    const result = gameManager.pillOps.usePillDetailed(
      'hoi_xuan_dan_mortal',
      { addCultivation: () => {}, heal: () => {}, applyBuff: () => {} },
      player,
    )

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('retired')
    expect(gameManager.pillBag.getAmount('hoi_xuan_dan_mortal')).toBe(1)
  })

  it('every hoi_xuan_dan recipe is marked retired; startAlchemyJob rejects it', () => {
    const { gameManager } = makeManager()
    const player = createDefaultPlayer()

    gameManager.setActivePlayer(player)

    const retiredRecipes = alchemyRecipes.filter((recipe) => recipe.pillId.startsWith('hoi_xuan_dan_'))

    // Recipes stay resolvable (in-flight job settle compat) but carry the flag.
    expect(retiredRecipes.length).toBe(9)
    expect(retiredRecipes.every((recipe) => recipe.retired === true)).toBe(true)

    const result = gameManager.alchemyOps.startAlchemyJob(
      'alchemy_hoi_xuan_dan_mortal',
      'hoi_xuan_thao_mortal_decade',
      player,
    )

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('retired')
  })

  it('an alchemy job started BEFORE retirement still settles and delivers the pill', () => {
    const { gameManager } = makeManager()
    const player = createDefaultPlayer()

    gameManager.setActivePlayer(player)

    const recipe = alchemyRecipes.find((candidate) => candidate.id === 'alchemy_hoi_xuan_dan_mortal')!

    gameManager.alchemySystem.restoreJobs([
      {
        jobId: 'legacy_hoi_xuan_job',
        recipeId: recipe.id,
        pillId: recipe.pillId,
        herbMaterialId: 'hoi_xuan_thao_mortal_decade',
        startedAtMs: 1_000,
        completesAtMs: 2_000,
        roomLevelAtStart: 1,
      },
    ])

    const settled = gameManager.alchemySystem.settleOffline(
      gameManager.pillBag,
      (pillId) => (gameManager.pillRegistry.has(pillId) ? gameManager.pillRegistry.get(pillId) : undefined),
      10_000,
      200,
    )

    expect(settled).toBe(1)
    expect(gameManager.pillBag.getAmount(recipe.pillId)).toBeGreaterThan(0)
  })

  it('AlchemySystem.startJob rejects a retired recipe directly — not only the ops gate', () => {
    const { gameManager } = makeManager()

    const recipe = alchemyRecipes.find((candidate) => candidate.id === 'alchemy_hoi_xuan_dan_mortal')!

    const result = gameManager.alchemySystem.startJob(
      recipe,
      'hoi_xuan_thao_mortal_decade',
      gameManager.materialBag,
      gameManager.materialRegistry,
      1_000,
      1,
      1_000,
      4,
    )

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('retired')
  })
})
