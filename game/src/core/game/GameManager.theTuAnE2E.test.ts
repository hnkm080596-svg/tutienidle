import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
import { COMPANIONS, type CompanionDefinition } from '../../data/companion/Companions'
import { MAX_THE } from '../combat/CombatTypes'
import type { PlayerData } from '../player/Player'
import type { TurnBattle } from '../battle/turn/TurnBattleSystem'

// The Tu Reimagined (plan Task 21, spec section 6) — An end-to-end:
// gated ritual -> ho_mon/phan_mon purchase -> GameManager battle build
// -> enemy hits the companion -> the player intercepts (Ho window),
// takes the hit, then its Phan window queues a counter bypass with the
// composite trigger context. Solo An has no Ho/Tro windows (spec 6.3).
// Chance stats derive from attributes (Task 3): vit/dex -> protectChance,
// str/dex -> counterChance. Math.random mocked to 0 = every roll wins.

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
  id: 'companion_an_e2e',
  name: 'E2E An Companion',
  grade: 'hoang',
  growthRate: 0.05,
  unlockThresholds: {},
  baseStats: { maxHp: 5_000, might: 0, speed: 1 },
  basic: {
    id: 'companion_an_e2e_basic',
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
  gameManager.catalogOps.registerProgressionNodes(THE_TU_AN_NODES)
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
  player.skillLevels = { huy_quyen: 3 }
  return player
}

function advance(combatSource: ManualClockSource, ticks: number) {
  for (let i = 0; i < ticks; i++) {
    combatSource.advance(COMBAT_STEP_SECONDS)
  }
}

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

/** An Ẩn player with capped reactive chances and a companion to protect. */
function makeAnPlayerWithCompanion() {
  registerE2ECompanion()
  const { gameManager, combatSource } = makeManager()
  const player = mortalAtGate()
  gameManager.realmAdvanceOps.chooseCultivationPath('the_tu', 'ung_the', player)
  gameManager.progressionOps.purchaseNode('ho_mon', player)
  gameManager.progressionOps.purchaseNode('phan_mon', player)
  // vit+dex -> protectChance, str+dex -> counterChance: 200s reach the
  // 0.60 stat cap so a mocked 0 roll always procs.
  player.baseStats = asBaseStats({ ...player.baseStats, vitality: 200, dexterity: 200, strength: 200, might: 10, speed: 500 })
  player.formationLoadout = {
    formationId: 'test_formation',
    assignments: [
      { row: 2, column: 5, combatantId: 'player' },
      { row: 4, column: 3, combatantId: 'companion_an_e2e' },
    ],
  }
  player.companions = [
    {
      instanceId: 'companion_an_e2e_inst',
      definitionId: 'companion_an_e2e',
      realmId: 'mortal',
      realmLevel: 1,
      exp: 0,
      constellationRank: 0,
    },
  ]
  return { gameManager, combatSource, player }
}

afterEach(() => {
  removeE2ECompanion()
  vi.restoreAllMocks()
})

describe('an e2e — Ho intercept + Phan counter through the live stack', () => {
  it('enemy hits the companion; the player intercepts, takes the hit, and counters with composite context', () => {
    const { gameManager, combatSource, player } = makeAnPlayerWithCompanion()
    // Fast enemy, slow player: the player never acts between enemy hits,
    // so every HP-drop tick isolates exactly one intercept+counter cycle.
    player.baseStats = asBaseStats({ ...player.baseStats, speed: 1 })
    const battle = startBattle(gameManager, combatSource, player, makeDummy('e2e_an_ho', { might: 5_000, attackSpeed: 100 }))
    const [protector, companion] = battle.players
    const enemyP = battle.enemies[0]!

    // Companion is the enemy's NATURAL target (same row, nearest column).
    companion!.entity.row = enemyP.entity.row
    companion!.entity.x = enemyP.entity.x - 1
    protector!.entity.x = Math.max(0, enemyP.entity.x - 8)
    protector!.entity.currentThe = 50

    vi.spyOn(Math, 'random').mockReturnValue(0)
    advanceIntoFighting(combatSource, battle)

    const companionHp = companion!.entity.stats.maxHp
    const enemyHpBefore = enemyP.entity.currentHp

    // Per-tick capture: the counter entry is observable only between the
    // hit's impact tick and the queue's drain tick.
    let entry: (typeof battle.queuedFollowUps extends (infer T)[] | undefined ? T : never) | undefined
    let theBefore = 0
    let cycles = 0
    for (let i = 0; i < 4000 && entry === undefined; i++) {
      theBefore = protector!.entity.currentThe ?? 0
      combatSource.advance(COMBAT_STEP_SECONDS)
      entry = (battle.queuedFollowUps ?? []).find((candidate) => candidate.actionSource === 'counter')
      if (entry !== undefined) {
        cycles = Math.round(((protector!.entity.currentThe ?? 0) - theBefore) / 16)
      }
    }

    expect(entry).toMatchObject({
      actorId: protector!.id,
      executionKind: 'reactive_bypass',
      payloadSkillId: 'phan_kich',
      targetIds: [enemyP.id],
      triggerContext: { origin: 'enemy_hit', intercepted: true, outcome: 'taken' },
    })
    // One cycle = intercept -15/+20, taken income +6, counter -15/+20.
    expect(cycles).toBe(1)

    // The substitution resolved fully vs the protector — the companion
    // was never touched.
    expect(companion!.entity.currentHp).toBe(companionHp)
    expect(protector!.entity.currentHp).toBeLessThan(protector!.entity.stats.maxHp)

    // The queued bypass resolves phan_kich into the enemy on a later step.
    expect(advanceUntil(combatSource, () => enemyP.entity.currentHp < enemyHpBefore)).toBe(true)
  })

  it('solo An has no Ho/Tro windows — self-hit pays only the counter check (spec 6.3)', () => {
    const { gameManager, combatSource } = makeManager()
    const player = mortalAtGate()
    gameManager.realmAdvanceOps.chooseCultivationPath('the_tu', 'ung_the', player)
    gameManager.progressionOps.purchaseNode('ho_mon', player)
    gameManager.progressionOps.purchaseNode('phan_mon', player)
    player.baseStats = asBaseStats({ ...player.baseStats, vitality: 200, dexterity: 200, strength: 200, might: 10, speed: 1 })

    const battle = startBattle(gameManager, combatSource, player, makeDummy('e2e_an_solo', { might: 5_000, attackSpeed: 100 }))
    const participant = battle.players[0]!
    participant.entity.currentThe = 50

    vi.spyOn(Math, 'random').mockReturnValue(0)
    advanceIntoFighting(combatSource, battle)

    expect(advanceUntil(combatSource, () => participant.entity.currentHp < participant.entity.stats.maxHp)).toBe(true)

    // A Ho attempt would have paid -15 before the roll even with no valid
    // substitute target — it never ran. Net: +6 taken, -15 +20 counter.
    expect(participant.entity.currentThe).toBe(50 + 6 - 15 + 20)
    expect((battle.queuedFollowUps ?? []).every((entry) => entry.actionSource === 'counter')).toBe(true)
  })

  it('bach_ung cast through the stack makes reactive checks free', () => {
    const { gameManager, combatSource, player } = makeAnPlayerWithCompanion()
    // Fast enemy: hits keep landing while the 3-holder-turn buff is live.
    const battle = startBattle(gameManager, combatSource, player, makeDummy('e2e_an_bach', { might: 5_000, attackSpeed: 100 }))
    const [protector, companion] = battle.players
    const enemyP = battle.enemies[0]!

    companion!.entity.row = enemyP.entity.row
    companion!.entity.x = enemyP.entity.x - 1
    protector!.entity.x = Math.max(0, enemyP.entity.x - 8)
    // The first player turn casts the ultimate (special parked on CD).
    protector!.special!.remainingCooldownTurns = 99

    vi.spyOn(Math, 'random').mockReturnValue(0)
    advanceIntoFighting(combatSource, battle)

    expect(
      advanceUntil(combatSource, () =>
        gameManager
          .getBattleBuffs(protector!.entity.id)
          .some((i) => i.definitionId === 'bach_ung'),
      ),
    ).toBe(true)

    // Pin the pool under the live buff, then isolate one hit's delta.
    protector!.entity.currentThe = 30
    let delta = 0
    for (let i = 0; i < 4000; i++) {
      const before = protector!.entity.currentThe ?? 0
      const hpBefore = protector!.entity.currentHp
      combatSource.advance(COMBAT_STEP_SECONDS)
      if (protector!.entity.currentHp < hpBefore) {
        delta = (protector!.entity.currentThe ?? 0) - before
        break
      }
    }

    // Free checks: intercept 0 cost +20, taken income +6, counter 0 +20.
    expect(delta).toBe(46)
  })

  it('economy nodes reach the participant: maxThe cap baked at build', () => {
    const { gameManager, combatSource, player } = makeAnPlayerWithCompanion()
    gameManager.progressionOps.purchaseNode('minor_ung_the_bi_the', player)
    gameManager.progressionOps.upgradeNode('minor_ung_the_bi_the', player)

    const battle = startBattle(gameManager, combatSource, player, makeDummy('e2e_an_cap'))
    expect(battle.players[0]!.entity.maxThe).toBe(MAX_THE + 20)
  })
})

describe('mortal basic wiring — huy_quyen is castable as the slot-0 basic (spec 2.3)', () => {
  function mortalWithBasic(basicSkillId: string | null) {
    const { gameManager, combatSource } = makeManager()
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.realmLevel = CORE_REALM_LEVEL
    player.baseStats = asBaseStats({ ...player.baseStats, speed: 500 })
    for (const skillId of ['tram', 'huy_quyen'] as const) {
      gameManager.progressionOps.learnSkill(skillId)
    }
    if (basicSkillId !== null) {
      gameManager.progressionOps.setSkillLoadoutSlot(player, 0, basicSkillId)
    }
    return { gameManager, combatSource, player }
  }

  it('huy_quyen equipped at slot 0 becomes the battle basic and accrues huy_quyen casts', () => {
    const { gameManager, combatSource, player } = mortalWithBasic('huy_quyen')
    const battle = startBattle(gameManager, combatSource, player, makeDummy('e2e_mortal_hq'))
    expect(battle.players[0]!.basic?.id).toBe('huy_quyen')

    advanceIntoFighting(combatSource, battle)

    expect(advanceUntil(combatSource, () => (player.skillCastCounts?.['huy_quyen'] ?? 0) > 0)).toBe(true)
  })

  it('tram equipped at slot 0 keeps recording tram casts (kiem-route parity)', () => {
    const { gameManager, combatSource, player } = mortalWithBasic('tram')
    const battle = startBattle(gameManager, combatSource, player, makeDummy('e2e_mortal_tram'))
    expect(battle.players[0]!.basic?.id).toBe('tram')

    advanceIntoFighting(combatSource, battle)

    expect(advanceUntil(combatSource, () => (player.skillCastCounts?.['tram'] ?? 0) > 0)).toBe(true)
  })

  it('a non-basic-tier slot-0 occupant falls back to the creation-granted tram', () => {
    const { gameManager, combatSource, player } = mortalWithBasic(null)
    gameManager.progressionOps.learnSkill('bat_kiem_thuat')
    gameManager.progressionOps.setSkillLoadoutSlot(player, 0, 'bat_kiem_thuat')

    const battle = startBattle(gameManager, combatSource, player, makeDummy('e2e_mortal_bk'))
    expect(battle.players[0]!.basic?.id).toBe('tram')
  })
})

describe('an save/restore parity', () => {
  it('path + root nodes round-trip; the rebuilt battle plants the markers', () => {
    const { gameManager } = makeManager()
    const player = mortalAtGate()
    gameManager.realmAdvanceOps.chooseCultivationPath('the_tu', 'ung_the', player)
    gameManager.progressionOps.purchaseNode('ho_mon', player)
    gameManager.progressionOps.purchaseNode('tro_mon', player)

    const save = buildGameSave(player, gameManager)

    setActivePinia(createPinia())
    const playerStore = usePlayerStore()
    const { gameManager: restored, combatSource } = makeManager()
    const result = restoreGameSession(playerStore, restored, save)
    expect(result.status).toBe('ok')

    const restoredPlayer = playerStore.$state
    expect(restoredPlayer.cultivationPath).toBe('the_tu')
    expect(restoredPlayer.cultivationWay).toBe('ung_the')
    expect(restoredPlayer.nodeLevels?.ho_mon).toBe(1)
    expect(restoredPlayer.nodeLevels?.tro_mon).toBe(1)

    const battle = startBattle(restored, combatSource, restoredPlayer, makeDummy('e2e_an_restore'))
    advanceIntoFighting(combatSource, battle)
    const participant = battle.players[0]!
    expect(participant.basic?.id).toBe('tham_the')
    expect(restored.getBattleBuffs(participant.entity.id).some((i) => i.definitionId === 'ung_the')).toBe(true)
    expect(restored.getBattleBuffs(participant.entity.id).some((i) => i.definitionId === 'ho_mon')).toBe(true)
    expect(restored.getBattleBuffs(participant.entity.id).some((i) => i.definitionId === 'tro_mon')).toBe(true)
    expect(restored.getBattleBuffs(participant.entity.id).some((i) => i.definitionId === 'phan_mon')).toBe(false)
    expect(participant.reactivePayloads?.['tro_kich']).toBeDefined()
  })
})
