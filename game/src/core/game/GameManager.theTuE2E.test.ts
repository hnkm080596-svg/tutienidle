import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it } from 'vitest'
import { GameManager, INTRO_TOTAL_TICKS, COUNTDOWN_TOTAL_TICKS } from './GameManager'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { createDefaultPlayer } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'
import { asBaseStats } from '../stats/StatBlock'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { THE_TU_NODES } from '../../data/progression/TheTuNodes'
import { THE_TU_AN_NODES } from '../../data/progression/TheTuAnNodes'
import { CORE_REALM_LEVEL } from '../realm/realmSystem'
import { buildGameSave, restoreGameSession } from '../../services/save/SaveSystem'
import { usePlayerStore } from '../../stores/player'
import { BuffSystem } from '../buff/BuffSystem'
import { BUFF_REGISTRY } from '../../data/buff/BuffRegistry'
import { COMPANIONS, type CompanionDefinition } from '../../data/companion/Companions'
import { CUONG_QUYEN_MISSING_HP_PER_PERCENT, SON_NHAC_WARD_RATIO } from '../../data/skill/TheTuSkills'
import type { PlayerData } from '../player/Player'
import type { TurnBattle } from '../battle/turn/TurnBattleSystem'

// The Tu Reimagined (plan Task 13) — Hien end-to-end: real initiation
// ritual -> node purchase -> GameManager battle build -> live combat
// through the CombatClock-driven stack (survival source, kit clones,
// emblem buffs all wired by GameManagerTurnBattleOps), plus save/restore
// parity for the path + node state.

const TANKY_DUMMY = {
  maxHp: 10_000_000,
  might: 0,
  attackSpeed: 1,
  criticalRate: 0,
  criticalDamage: 1.5,
  armor: 0,
}

function makeDummy(id: string, statsInput: Partial<typeof TANKY_DUMMY> = {}) {
  return defineEnemy({
    id,
    name: 'Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: { ...TANKY_DUMMY, ...statsInput },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
}

const E2E_COMPANION: CompanionDefinition = {
  id: 'companion_e2e',
  name: 'E2E Companion',
  grade: 'hoang',
  growthRate: 0.05,
  unlockThresholds: {},
  baseStats: { maxHp: 5_000, might: 0, speed: 1 },
  basic: {
    id: 'companion_e2e_basic',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1 },
    targeting: { shape: 'single' },
  },
}

function makeManager() {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(THE_TU_NODES)
  const combatSource = new ManualClockSource()
  gameManager.setCombatClockSource(combatSource)
  return { gameManager, combatSource }
}

function registerE2ECompanion() {
  if (!COMPANIONS.find((candidate) => candidate.id === E2E_COMPANION.id)) {
    ;(COMPANIONS as unknown as CompanionDefinition[]).push(E2E_COMPANION)
  }
}

function removeE2ECompanion() {
  const index = COMPANIONS.findIndex((candidate) => candidate.id === E2E_COMPANION.id)
  if (index >= 0) {
    ;(COMPANIONS as unknown as CompanionDefinition[]).splice(index, 1)
  }
}

function mortalAtGate(): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = 'mortal'
  player.realmLevel = CORE_REALM_LEVEL
  player.skillInsight = 99
  return player
}

function advance(combatSource: ManualClockSource, ticks: number) {
  for (let i = 0; i < ticks; i++) {
    combatSource.advance(COMBAT_STEP_SECONDS)
  }
}

/** Advance until `predicate` holds or the cap hits; returns predicate(). */
function advanceUntil(combatSource: ManualClockSource, predicate: () => boolean, cap = 4000): boolean {
  for (let i = 0; i < cap; i++) {
    if (predicate()) {
      return true
    }
    combatSource.advance(COMBAT_STEP_SECONDS)
  }
  return predicate()
}

function startBattle(gameManager: GameManager, combatSource: ManualClockSource, player: PlayerData, enemy: ReturnType<typeof makeDummy>): TurnBattle {
  gameManager.setActivePlayer(player)
  gameManager.startBattleWithPlayer(player, enemy)
  const battle = gameManager.getTurnBattle()
  expect(battle).not.toBeNull()
  return battle!
}

function advanceIntoFighting(combatSource: ManualClockSource, battle: TurnBattle) {
  advanceUntil(combatSource, () => battle.state === 'fighting', INTRO_TOTAL_TICKS + COUNTDOWN_TOTAL_TICKS + 20)
  expect(battle.state).toBe('fighting')
}

describe('initiation ritual (T1/T6)', () => {
  it('mortal at CORE_REALM_LEVEL -> the_tu grants path, technique, qi_refining', () => {
    const { gameManager } = makeManager()
    const player = mortalAtGate()

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('the_tu', player)).toBe(true)
    expect(player.cultivationPath).toBe('the_tu')
    expect(player.realmId).toBe('qi_refining')
    const technique = gameManager.techniqueManager.get('kim_cang_bat_hoai_the')
    expect(technique?.unlocked).toBe(true)
    expect(technique?.equipped).toBe(true)
  })

  it('the_tu_an refused without huy_quyen Lv3; accepted once the mirror shows it (INV-1)', () => {
    const { gameManager } = makeManager()
    const player = mortalAtGate()

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('the_tu_an', player)).toBe(false)
    expect(player.cultivationPath).toBeUndefined()

    player.skillLevels = { huy_quyen: 3 }
    expect(gameManager.realmAdvanceOps.chooseCultivationPath('the_tu_an', player)).toBe(true)
    expect(player.cultivationPath).toBe('the_tu_an')
    expect(gameManager.techniqueManager.get('ung_the_than_quyet')?.equipped).toBe(true)
  })
})

describe('cuong_chien battle flow', () => {
  it('root + scalar node reach the participant-local kit clone', () => {
    const { gameManager, combatSource } = makeManager()
    const player = mortalAtGate()
    gameManager.realmAdvanceOps.chooseCultivationPath('the_tu', player)
    gameManager.progressionOps.purchaseNode('cuong_chien', player)
    gameManager.progressionOps.purchaseNode('minor_cuong_huyet_no', player)
    gameManager.progressionOps.upgradeNode('minor_cuong_huyet_no', player)
    gameManager.progressionOps.upgradeNode('minor_cuong_huyet_no', player)

    const battle = startBattle(gameManager, combatSource, player, makeDummy('e2e_cuong_kit'))
    advanceIntoFighting(combatSource, battle)
    const participant = battle.players[0]!

    expect(participant.basic?.id).toBe('cuong_quyen')
    expect(participant.basic?.damage?.missingHpBonusPerMissingPercent).toBeCloseTo(
      CUONG_QUYEN_MISSING_HP_PER_PERCENT + 0.005 * 3,
    )
  })

  it('missing-HP scalar lands through the live battle: wounded hits deal more', () => {
    const { gameManager, combatSource } = makeManager()
    const player = mortalAtGate()
    gameManager.realmAdvanceOps.chooseCultivationPath('the_tu', player)
    gameManager.progressionOps.purchaseNode('cuong_chien', player)
    player.baseStats = asBaseStats({ ...player.baseStats, might: 50, speed: 500 })

    const battle = startBattle(gameManager, combatSource, player, makeDummy('e2e_missing_hp'))
    advanceIntoFighting(combatSource, battle)
    const participant = battle.players[0]!
    const enemy = battle.enemies[0]!

    // Basic-only stream: park the special/ultimate on cooldown.
    participant.special!.remainingCooldownTurns = 99
    participant.ultimate!.remainingCooldownTurns = 99

    const hpBefore = enemy.entity.currentHp
    expect(advanceUntil(combatSource, () => enemy.entity.currentHp < hpBefore)).toBe(true)
    const fullHpHit = hpBefore - enemy.entity.currentHp

    participant.entity.currentHp = Math.floor(participant.entity.stats.maxHp * 0.1)
    const hpBefore2 = enemy.entity.currentHp
    expect(advanceUntil(combatSource, () => enemy.entity.currentHp < hpBefore2)).toBe(true)
    const woundedHit = hpBefore2 - enemy.entity.currentHp

    expect(woundedHit).toBeGreaterThan(fullHpHit)
  })

  it('lethal hit triggers the ops-wired Bat Tu survival: HP 1, buff, ult CD spent', () => {
    const { gameManager, combatSource } = makeManager()
    const player = mortalAtGate()
    gameManager.realmAdvanceOps.chooseCultivationPath('the_tu', player)
    gameManager.progressionOps.purchaseNode('cuong_chien', player)
    player.baseStats = asBaseStats({ ...player.baseStats, speed: 1 })

    const enemy = makeDummy('e2e_bat_tu', { might: 9_999_999, attackSpeed: 500 })
    const battle = startBattle(gameManager, combatSource, player, enemy)
    const participant = battle.players[0]!
    // Set low HP BEFORE the fight starts — the enemy is far faster and
    // lands the lethal hit during the first fighting ticks.
    participant.entity.currentHp = 50
    advanceIntoFighting(combatSource, battle)

    expect(advanceUntil(combatSource, () => participant.buffs.getAllById('bat_tu_ba_the').length > 0)).toBe(true)
    expect(participant.entity.alive).toBe(true)
    expect(participant.entity.currentHp).toBe(1)
    expect(participant.ultimate!.remainingCooldownTurns).toBe(8)
  })

  it('Ba The suppresses hard-CC blocking while the buff is active (INV-5)', () => {
    const { gameManager, combatSource } = makeManager()
    const player = mortalAtGate()
    gameManager.realmAdvanceOps.chooseCultivationPath('the_tu', player)
    gameManager.progressionOps.purchaseNode('cuong_chien', player)
    player.baseStats = asBaseStats({ ...player.baseStats, might: 50, speed: 500 })

    const battle = startBattle(gameManager, combatSource, player, makeDummy('e2e_ba_the'))
    advanceIntoFighting(combatSource, battle)
    const participant = battle.players[0]!
    const enemy = battle.enemies[0]!
    participant.special!.remainingCooldownTurns = 99
    participant.ultimate!.remainingCooldownTurns = 99

    const buffs = new BuffSystem(participant.buffs)
    buffs.apply(BUFF_REGISTRY.get('choang'), enemy.entity, participant.entity, BUFF_REGISTRY)
    buffs.apply(BUFF_REGISTRY.get('bat_tu_ba_the'), enemy.entity, participant.entity, BUFF_REGISTRY)

    const turnsBefore = battle.totalTurnsElapsed ?? 0
    const hpBefore = enemy.entity.currentHp
    expect(
      advanceUntil(combatSource, () => enemy.entity.currentHp < hpBefore || participant.consecutiveHardCcTurns > 0, 200),
    ).toBe(true)

    // The stunned-but-undying actor still acted — no CC-block counter moved.
    expect(participant.consecutiveHardCcTurns).toBe(0)
    expect(enemy.entity.currentHp).toBeLessThan(hpBefore)
    expect(battle.totalTurnsElapsed).toBeGreaterThan(turnsBefore)
  })
})

describe('tran_the battle flow', () => {
  afterEach(() => {
    removeE2ECompanion()
  })

  function makeTranPlayerCompanion() {
    registerE2ECompanion()
    const { gameManager, combatSource } = makeManager()
    const player = mortalAtGate()
    gameManager.realmAdvanceOps.chooseCultivationPath('the_tu', player)
    gameManager.progressionOps.purchaseNode('tran_the', player)
    player.baseStats = asBaseStats({ ...player.baseStats, might: 10, speed: 500, vitality: 200 })
    player.formationLoadout = {
      formationId: 'test_formation',
      assignments: [
        { row: 2, column: 5, combatantId: 'player' },
        { row: 4, column: 3, combatantId: 'companion_e2e' },
      ],
    }
    player.companions = [
      {
        instanceId: 'companion_e2e_inst',
        definitionId: 'companion_e2e',
        realmId: 'mortal',
        realmLevel: 1,
        exp: 0,
        constellationRank: 0,
      },
    ]
    return { gameManager, combatSource, player }
  }

  it('son_nhac cast through the stack: taunt on enemy, external ward on companion, emblem buff on tank', () => {
    const { gameManager, combatSource, player } = makeTranPlayerCompanion()
    const battle = startBattle(gameManager, combatSource, player, makeDummy('e2e_son_nhac'))
    advanceIntoFighting(combatSource, battle)
    const [tank, companion] = battle.players
    const enemy = battle.enemies[0]!

    expect(companion).toBeDefined()
    expect(tank!.buffs.getAllById('phan_chinh')).toHaveLength(1)

    expect(advanceUntil(combatSource, () => enemy.buffs.getAllById('khiem_khich').length > 0)).toBe(true)
    expect(tank!.buffs.getAllById('son_nhac')).toHaveLength(1)
    expect(companion!.entity.externalWard?.sourceId).toBe(tank!.entity.id)
    expect(companion!.entity.externalWard!.amount).toBeCloseTo(tank!.entity.stats.maxHp * SON_NHAC_WARD_RATIO)
  })

  it('taunted enemy hits the tank (companion untouched); phan_chinh reflects into the attacker', () => {
    const { gameManager, combatSource, player } = makeTranPlayerCompanion()
    // Slow enemy (speed ~30) — the tank casts son_nhac long before its
    // first hit, so EVERY enemy action happens under Taunt.
    const enemy = makeDummy('e2e_taunt_reflect', { might: 5_000, attackSpeed: 0.3 })
    const battle = startBattle(gameManager, combatSource, player, enemy)
    const [tank, companion] = battle.players
    const enemyP = battle.enemies[0]!

    // Companion is the enemy's NATURAL target (same row, nearest column);
    // without Taunt it would take every hit.
    const enemyPos = { row: enemyP.entity.row, x: enemyP.entity.x }
    companion!.entity.row = enemyPos.row
    companion!.entity.x = enemyPos.x - 1
    tank!.entity.x = Math.max(0, enemyPos.x - 8)

    const tankHpBefore = tank!.entity.currentHp
    const enemyHpBefore = enemyP.entity.currentHp

    // Wait until the enemy has actually landed a taunted hit on the tank.
    expect(
      advanceUntil(
        combatSource,
        () => tank!.entity.currentHp < tankHpBefore && enemyP.buffs.getAllById('khiem_khich').length > 0,
      ),
    ).toBe(true)

    // Taunt forced the tank target — the natural-target companion is untouched.
    expect(companion!.entity.currentHp).toBe(companion!.entity.stats.maxHp)
    // Reflection credits the taken hit back: tank might is 10 (tran_ap
    // basic ~8-10 per hit), so a >50 drop is the reflect, not the poke.
    expect(enemyHpBefore - enemyP.entity.currentHp).toBeGreaterThan(50)
  })
})

describe('the_tu_an build wiring (Task 14)', () => {
  it('fixed kit slots populate; ung_the + owned-root markers land on the pool at build', () => {
    const { gameManager, combatSource } = makeManager()
    gameManager.catalogOps.registerProgressionNodes(THE_TU_AN_NODES)
    const player = mortalAtGate()
    player.skillLevels = { huy_quyen: 3 }
    gameManager.realmAdvanceOps.chooseCultivationPath('the_tu_an', player)
    gameManager.progressionOps.purchaseNode('phan_mon', player)

    const battle = startBattle(gameManager, combatSource, player, makeDummy('e2e_an'))
    const participant = battle.players[0]!

    expect(participant.basic?.id).toBe('tham_the')
    expect(participant.special?.skill.id).toBe('tu_the')
    expect(participant.ultimate?.skill.id).toBe('bach_ung')
    expect(participant.buffs.hasAny('ung_the')).toBe(true)
    expect(participant.buffs.hasAny('phan_mon')).toBe(true)
    expect(participant.buffs.hasAny('ho_mon')).toBe(false)
    expect(participant.buffs.hasAny('tro_mon')).toBe(false)
  })
})

describe('save/restore parity', () => {
  it('path + node state round-trips; the rebuilt battle resolves the same node-scaled kit', () => {
    const { gameManager } = makeManager()
    const player = mortalAtGate()
    gameManager.realmAdvanceOps.chooseCultivationPath('the_tu', player)
    gameManager.progressionOps.purchaseNode('cuong_chien', player)
    gameManager.progressionOps.purchaseNode('minor_cuong_huyet_no', player)

    const save = buildGameSave(player, gameManager)

    setActivePinia(createPinia())
    const playerStore = usePlayerStore()
    const { gameManager: restored, combatSource } = makeManager()
    const result = restoreGameSession(playerStore, restored, save)
    expect(result.status).toBe('ok')

    const restoredPlayer = playerStore.$state
    expect(restoredPlayer.cultivationPath).toBe('the_tu')
    expect(restoredPlayer.nodeLevels?.cuong_chien).toBe(1)
    expect(restoredPlayer.nodeLevels?.minor_cuong_huyet_no).toBe(1)

    const battle = startBattle(restored, combatSource, restoredPlayer, makeDummy('e2e_restore'))
    advanceIntoFighting(combatSource, battle)
    const participant = battle.players[0]!
    expect(participant.basic?.id).toBe('cuong_quyen')
    expect(participant.basic?.damage?.missingHpBonusPerMissingPercent).toBeCloseTo(
      CUONG_QUYEN_MISSING_HP_PER_PERCENT + 0.005,
    )
    expect(participant.ultimate?.skill.id).toBe('bat_tu_ba_the')
  })
})
