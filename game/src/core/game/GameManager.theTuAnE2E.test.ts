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
import { THE_PROC_COST } from '../the-tu/TheEconomy'
import type { PlayerData } from '../player/Player'
import type { TurnBattle } from '../battle/turn/TurnBattleSystem'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

// The Tu Reimagined - An end-to-end (Ung The beta): path pick ->
// major_quan_the purchase (realm + techniqueRank prereqs) grants the
// quan_the skill core -> GameManager battle build plants ung_the +
// phan_mon baseline and ho_mon/tro_mon while Quan The is owned ->
// enemy hits the companion -> the player intercepts (Ho window),
// takes the hit, then its Phan window queues a counter bypass with
// the composite trigger context. Economy: each committed reaction
// costs THE_PROC_COST, each observed enemy action grants +4 after
// its own windows close. Chance stats derive from attributes:
// vit/dex -> protectChance, str/dex -> counterChance. Math.random
// mocked to 0 = every roll wins.

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
    rewards: { techniqueMastery: 0, spiritStone: 0 },
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
  gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
  gameManager.catalogOps.registerProgressionNodes(THE_TU_AN_NODES)
  gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
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
  player.nodeLevels.core_huy_quyen = 3
  return player
}

/** Ung The beta: promote the gate player to Truc Co and buy the
 * major_quan_the node - its grantsSkillCoreIds writes core_quan_the,
 * the ONLY authority that opens the quan_the special + Ho/Tro markers. */
function grantQuanThe(player: PlayerData) {
  player.realmId = 'foundation_establishment'
  player.realmLevel = 1
  // techniqueRank gate (rank 5) reads the mirror's live grade at the
  // realm index - foundation_establishment is index 2.
  player.techniqueProgress = { rank: 5, grade: 2 }
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

/** Freeze the player's pace: gauge accrual reads speed off baseStats
 * and the participant mirror, so all three must move together. */
function parkParticipantSpeed(participant: TurnBattle['players'][number]) {
  participant.entity.baseStats = asBaseStats({ ...participant.entity.baseStats, speed: 1 })
  participant.entity.stats = { ...participant.entity.stats, speed: 1 }
  participant.speed = 1
}

/** An Ẩn player at Truc Co with Quan The owned, capped reactive
 * chances, and a companion to protect. */
function makeAnPlayerWithCompanion() {
  registerE2ECompanion()
  const { gameManager, combatSource } = makeManager()
  const player = mortalAtGate()
  gameManager.realmAdvanceOps.chooseCultivationPath('body', 'hidden_body_pathway', player)
  grantQuanThe(player)
  gameManager.progressionOps.purchaseNode('major_quan_the', player)
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
    // The enemy is observed through the single Tham mark (Quan The is
    // owned but not cast - isObserved still resolves via the mark).
    protector!.thamTargetId = enemyP.id
    protector!.entity.currentThe = 50

    vi.spyOn(Math, 'random').mockReturnValue(0)
    advanceIntoFighting(combatSource, battle)

    const companionHp = companion!.entity.stats.maxHp
    const enemyHpBefore = enemyP.entity.currentHp

    // Per-tick capture: the counter entry is observable only between the
    // hit's impact tick and the queue's drain tick.
    let entry: (typeof battle.queuedFollowUps extends (infer T)[] | undefined ? T : never) | undefined
    let theBefore = 0
    let cycleDelta = 0
    for (let i = 0; i < 4000 && entry === undefined; i++) {
      theBefore = protector!.entity.currentThe ?? 0
      combatSource.advance(COMBAT_STEP_SECONDS)
      entry = (battle.queuedFollowUps ?? []).find((candidate) => candidate.actionSource === 'counter')
      if (entry !== undefined) {
        cycleDelta = (protector!.entity.currentThe ?? 0) - theBefore
      }
    }

    expect(entry).toMatchObject({
      actorId: protector!.id,
      executionKind: 'reactive_bypass',
      payloadSkillId: 'phan_kich',
      targetIds: [enemyP.id],
      triggerContext: { origin: 'enemy_hit', intercepted: true, outcome: 'taken' },
    })
    // One cycle = intercept -15, counter -15, observed-action income +4
    // (lands only after both windows closed).
    expect(cycleDelta).toBe(-THE_PROC_COST * 2 + 4)

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
    gameManager.realmAdvanceOps.chooseCultivationPath('body', 'hidden_body_pathway', player)
    grantQuanThe(player)
    gameManager.progressionOps.purchaseNode('major_quan_the', player)
    player.baseStats = asBaseStats({ ...player.baseStats, vitality: 200, dexterity: 200, strength: 200, might: 10, speed: 1 })

    const battle = startBattle(gameManager, combatSource, player, makeDummy('e2e_an_solo', { might: 5_000, attackSpeed: 100 }))
    const participant = battle.players[0]!
    // thamTargetId takes the enemy's PARTICIPANT id, not the source id.
    participant.thamTargetId = battle.enemies[0]!.id
    participant.entity.currentThe = 50

    vi.spyOn(Math, 'random').mockReturnValue(0)
    advanceIntoFighting(combatSource, battle)

    expect(advanceUntil(combatSource, () => participant.entity.currentHp < participant.entity.stats.maxHp)).toBe(true)

    // Ho/Tro need an ALLY action/target - solo, neither window opens.
    // Only the Phan window ran: -15 paid +4 observed income afterwards.
    expect(participant.entity.currentThe).toBe(50 - THE_PROC_COST + 4)
    expect((battle.queuedFollowUps ?? []).every((entry) => entry.actionSource === 'counter')).toBe(true)
  })

  it('quan_the marker through the stack observes every enemy — no Tham mark needed', () => {
    const { gameManager, combatSource, player } = makeAnPlayerWithCompanion()
    const battle = startBattle(gameManager, combatSource, player, makeDummy('e2e_an_quan', { might: 5_000, attackSpeed: 100 }))
    const [protector] = battle.players
    const enemyP = battle.enemies[0]!

    advanceIntoFighting(combatSource, battle)
    // The live quan_the marker IS the quanTheActive predicate: every
    // enemy satisfies isObserved even with no Tham mark planted.
    gameManager.turnBattleOps.applyBuffToPlayer('quan_the')
    parkParticipantSpeed(protector!)
    protector!.thamTargetId = undefined
    protector!.entity.currentThe = 50

    vi.spyOn(Math, 'random').mockReturnValue(0)

    // The enemy hits the protector directly (companion sits off-lane):
    // Phan window commits on observation alone.
    enemyP.entity.row = protector!.entity.row
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

    // -15 counter paid +4 observed income = -11 on the hit tick.
    expect(delta).toBe(-THE_PROC_COST + 4)
    expect(
      (battle.queuedFollowUps ?? []).some(
        (entry) => entry.actionSource === 'counter' && entry.payloadSkillId === 'phan_kich',
      ),
    ).toBe(true)
  })

  it('economy nodes reach the participant: Thau The bakes observed income at build', () => {
    const { gameManager, combatSource, player } = makeAnPlayerWithCompanion()
    gameManager.progressionOps.purchaseNode('minor_thau_the', player)

    const battle = startBattle(gameManager, combatSource, player, makeDummy('e2e_an_thau', { attackSpeed: 100 }))
    const participant = battle.players[0]!
    participant.thamTargetId = battle.enemies[0]!.id
    parkParticipantSpeed(participant)

    vi.spyOn(Math, 'random').mockReturnValue(0)
    advanceIntoFighting(combatSource, battle)

    // Isolate per-tick pool deltas: each observed enemy action nets
    // +6 (base 4 + Thau The 2) until the pool can afford the Phan
    // window, when the action nets 6 - 15 = -9.
    participant.entity.currentThe = 0
    const deltas: number[] = []
    let prev = 0
    for (let i = 0; i < 400 && deltas.length < 4; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
      const now = participant.entity.currentThe ?? 0
      if (now !== prev) {
        deltas.push(now - prev)
        prev = now
      }
    }

    expect(deltas[0]).toBe(6)
    expect(deltas.every((delta) => delta === 6 || delta === 6 - THE_PROC_COST)).toBe(true)
  })
})

describe('mortal basic wiring — huy_quyen is castable as the picked basic (spec 2.3)', () => {
  function mortalWithBasic(basicSkillId: string | null) {
    const { gameManager, combatSource } = makeManager()
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.realmLevel = CORE_REALM_LEVEL
    player.baseStats = asBaseStats({ ...player.baseStats, speed: 500 })
    for (const skillId of ['tram', 'huy_quyen'] as const) {
      gameManager.progressionOps.learnSkill(skillId, player)
    }
    if (basicSkillId !== null) {
      gameManager.progressionOps.setMortalBasicSkill(player, basicSkillId)
    }
    return { gameManager, combatSource, player }
  }

  it('huy_quyen picked as the mortal basic becomes the battle basic and accrues huy_quyen casts', () => {
    const { gameManager, combatSource, player } = mortalWithBasic('huy_quyen')
    const battle = startBattle(gameManager, combatSource, player, makeDummy('e2e_mortal_hq'))
    expect(battle.players[0]!.basic?.id).toBe('huy_quyen')

    advanceIntoFighting(combatSource, battle)

    expect(advanceUntil(combatSource, () => (player.skillCastCounts?.['huy_quyen'] ?? 0) > 0)).toBe(true)
  })

  it('tram picked as the mortal basic keeps recording tram casts (kiem-route parity)', () => {
    const { gameManager, combatSource, player } = mortalWithBasic('tram')
    const battle = startBattle(gameManager, combatSource, player, makeDummy('e2e_mortal_tram'))
    expect(battle.players[0]!.basic?.id).toBe('tram')

    advanceIntoFighting(combatSource, battle)

    expect(advanceUntil(combatSource, () => (player.skillCastCounts?.['tram'] ?? 0) > 0)).toBe(true)
  })

  it('a non-precursor pick is rejected and falls back to the runtime-default tram', () => {
    const { gameManager, combatSource, player } = mortalWithBasic(null)
    gameManager.progressionOps.learnSkill('bat_kiem_thuat', player)
    expect(gameManager.progressionOps.setMortalBasicSkill(player, 'bat_kiem_thuat')).toBe(false)

    const battle = startBattle(gameManager, combatSource, player, makeDummy('e2e_mortal_bk'))
    expect(battle.players[0]!.basic?.id).toBe('tram')
  })
})

describe('an save/restore parity', () => {
  it('path + the quan_the core round-trip; the rebuilt battle plants all four markers', () => {
    const { gameManager } = makeManager()
    const player = mortalAtGate()
    gameManager.realmAdvanceOps.chooseCultivationPath('body', 'hidden_body_pathway', player)
    // Granted-core state written directly (the purchase path needs a
    // real technique holder; the kit only reads the core level).
    player.nodeLevels.core_quan_the = 1
    player.nodeLevels.major_quan_the = 1

    const save = buildGameSave(player, gameManager)

    setActivePinia(createPinia())
    const playerStore = usePlayerStore()
    const { gameManager: restored, combatSource } = makeManager()
    const result = restoreGameSession(playerStore, restored, save)
    expect(result.status).toBe('ok')

    const restoredPlayer = playerStore.$state
    expect(restoredPlayer.cultivationPath).toBe('body')
    expect(restoredPlayer.cultivationWay).toBe('hidden_body_pathway')
    expect(restoredPlayer.nodeLevels?.major_quan_the).toBe(1)
    // grantsSkillCoreIds wrote the core at purchase; it round-trips
    // through nodeLevels like every other node level.
    expect(restoredPlayer.nodeLevels?.core_quan_the).toBe(1)

    const battle = startBattle(restored, combatSource, restoredPlayer, makeDummy('e2e_an_restore'))
    advanceIntoFighting(combatSource, battle)
    const participant = battle.players[0]!
    expect(participant.basic?.id).toBe('tham_the')
    expect(participant.special?.skill.id).toBe('quan_the')
    for (const marker of ['ung_the', 'phan_mon', 'ho_mon', 'tro_mon'] as const) {
      expect(
        restored.getBattleBuffs(participant.entity.id).some((i) => i.definitionId === marker),
        `marker ${marker}`,
      ).toBe(true)
    }
    expect(participant.reactivePayloads?.['phan_kich']).toBeDefined()
    expect(participant.reactivePayloads?.['tro_kich']).toBeDefined()
  })
})
