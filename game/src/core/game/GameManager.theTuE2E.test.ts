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
import type { BuffDefinitionId, CombatEntityId, CombatOperationId } from '../battle/contracts/ids'
import { COMPANIONS, type CompanionDefinition } from '../../data/companion/Companions'
import { CUONG_QUYEN } from '../../data/skill/TheTuSkills'
import { PHAN_CHAN_MARKED_RATIO } from '../../data/buff/TheTuBuffs'
import type { EntityVitalsChangedEvent } from '../combat/EntityVitalsSystem'
import type { PlayerData } from '../player/Player'
import type { TurnBattle } from '../battle/turn/TurnBattleSystem'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

// The Tu Reimagined (plan Task 13) - Hien end-to-end: real initiation
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
    rewards: { techniqueMastery: 0, spiritStone: 0 },
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
  return player
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

// buff2 M4: applies a registered def through the battle's buff authority
// (authored op + settle while quiescent) -- the same lane production uses.
function applyBattleBuff(
  gameManager: GameManager,
  definitionId: string,
  targetId: string,
  sourceId: string,
): void {
  const scheduler = gameManager.turnBattleOps.getTurnBattleSystem().combatScheduler
  if (scheduler === undefined) {
    throw new Error('no combat scheduler on the live battle')
  }
  const root = `test.apply.${definitionId}.${targetId}`
  scheduler.enqueueAuthored([
    {
      type: 'apply_buff',
      operationId: `op.${root}` as CombatOperationId,
      payload: {
        definitionId: definitionId as BuffDefinitionId,
        targetId: targetId as CombatEntityId,
        stacks: 1,
        baseChance: 1,
        reactionEligibility: 'eligible',
      },
      origin: {
        kind: 'proc',
        originId: 'test.apply',
        sourceId: sourceId as CombatEntityId,
        rootActionId: root,
      },
    },
  ])
  scheduler.run()
}

function hasBuff(gameManager: GameManager, entityId: string, definitionId: string): boolean {
  return gameManager.getBattleBuffs(entityId).some((i) => i.definitionId === definitionId)
}

describe('initiation ritual (T1/T6)', () => {
  it('mortal at CORE_REALM_LEVEL -> body grants path, technique, qi_refining', () => {
    const { gameManager } = makeManager()
    const player = mortalAtGate()

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('body', 'body_pathway', player)).toBe(true)
    expect(player.cultivationPath).toBe('body')
    expect(player.realmId).toBe('qi_refining')
    const technique = gameManager.techniqueManager.getActive()
    expect(technique?.id).toBe('diamond_body_art')
  })

  it('hidden_body refused without huy_quyen Lv3; accepted once the mirror shows it (INV-1)', () => {
    const { gameManager } = makeManager()
    const player = mortalAtGate()

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('body', 'hidden_body_pathway', player)).toBe(false)
    expect(player.cultivationPath).toBeUndefined()

    player.nodeLevels.core_huy_quyen = 3
    expect(gameManager.realmAdvanceOps.chooseCultivationPath('body', 'hidden_body_pathway', player)).toBe(true)
    expect(player.cultivationPath).toBe('body')
    expect(player.cultivationWay).toBe('hidden_body_pathway')
    expect(gameManager.techniqueManager.getActive()?.id).toBe('responsive_body_art')
  })
})

describe('cuong_chien battle flow', () => {
  it('root + Trọng Quyền node levels reach the participant-local kit clone', () => {
    const { gameManager, combatSource } = makeManager()
    const player = mortalAtGate()
    gameManager.realmAdvanceOps.chooseCultivationPath('body', 'body_pathway', player)
    gameManager.progressionOps.purchaseNode('cuong_chien', player)
    gameManager.progressionOps.purchaseNode('minor_trong_quyen', player)
    gameManager.progressionOps.upgradeNode('minor_trong_quyen', player)
    gameManager.progressionOps.upgradeNode('minor_trong_quyen', player)

    const battle = startBattle(gameManager, combatSource, player, makeDummy('e2e_cuong_kit'))
    advanceIntoFighting(combatSource, battle)
    const participant = battle.players[0]!

    expect(participant.basic?.id).toBe('cuong_quyen')
    expect(participant.basic?.damage?.multiplier).toBeCloseTo(
      (CUONG_QUYEN.damage?.multiplier ?? 0) + 0.1 * 3,
    )
  })

  it('LQ window: no special/ultimate slot; Cuồng Quyền never pays HP and never scales with missing HP', () => {
    const { gameManager, combatSource } = makeManager()
    const player = mortalAtGate()
    gameManager.realmAdvanceOps.chooseCultivationPath('body', 'body_pathway', player)
    gameManager.progressionOps.purchaseNode('cuong_chien', player)
    player.baseStats = asBaseStats({ ...player.baseStats, might: 50, speed: 500, criticalRate: 0 })

    const battle = startBattle(gameManager, combatSource, player, makeDummy('e2e_no_missing_hp'))
    advanceIntoFighting(combatSource, battle)
    const participant = battle.players[0]!
    const enemy = battle.enemies[0]!

    // Beta window pin: root grants ONLY the Basic - no special, no ultimate.
    expect(participant.special).toBeUndefined()
    expect(participant.ultimate).toBeUndefined()

    const sacrifices: number[] = []
    gameManager.eventBus.on<EntityVitalsChangedEvent>('entity_vitals_changed', (event) => {
      if (event.reason === 'sacrifice' && event.entityId === participant.entity.id) {
        sacrifices.push(event.amount)
      }
    })

    const hpBefore = enemy.entity.currentHp
    expect(advanceUntil(combatSource, () => enemy.entity.currentHp < hpBefore)).toBe(true)
    const fullHpHit = hpBefore - enemy.entity.currentHp
    const fullHpMight = participant.entity.stats.might

    // Wounded to 10% -- the LQ basic carries no missing-HP scalar, so
    // damage per unit might must be INVARIANT (live stat drift inside
    // the battle is real; missing-HP scaling would add a term on top).
    participant.entity.currentHp = Math.floor(participant.entity.stats.maxHp * 0.1)
    const hpBefore2 = enemy.entity.currentHp
    expect(advanceUntil(combatSource, () => enemy.entity.currentHp < hpBefore2)).toBe(true)
    const woundedHit = hpBefore2 - enemy.entity.currentHp
    const woundedMight = participant.entity.stats.might

    expect(woundedHit / woundedMight).toBeCloseTo(fullHpHit / fullHpMight, 3)
    expect(sacrifices).toHaveLength(0)
  })

  it('post-TC window: major_loan_dau grants Loạn Đấu; wounded hits deal more through Huyết Cuồng', () => {
    const { gameManager, combatSource } = makeManager()
    const player = mortalAtGate()
    gameManager.realmAdvanceOps.chooseCultivationPath('body', 'body_pathway', player)
    player.realmId = 'foundation_establishment'
    player.techniqueProgress = { rank: 5, grade: 2 }
    gameManager.progressionOps.purchaseNode('cuong_chien', player)
    gameManager.progressionOps.purchaseNode('major_loan_dau', player)
    player.baseStats = asBaseStats({ ...player.baseStats, might: 50, speed: 500, criticalRate: 0 })

    const battle = startBattle(gameManager, combatSource, player, makeDummy('e2e_huyet_cuong'))
    advanceIntoFighting(combatSource, battle)
    const participant = battle.players[0]!
    const enemy = battle.enemies[0]!

    expect(participant.special?.skill.id).toBe('loan_dau')
    // Basic-only stream: park the special on cooldown so the wounded-hit
    // comparison reads the kit-local missing-HP scalar alone.
    participant.special!.remainingCooldownTurns = 99

    const hpBefore = enemy.entity.currentHp
    expect(advanceUntil(combatSource, () => enemy.entity.currentHp < hpBefore)).toBe(true)
    const fullHpHit = hpBefore - enemy.entity.currentHp
    const fullHpMight = participant.entity.stats.might

    participant.entity.currentHp = Math.floor(participant.entity.stats.maxHp * 0.1)
    const hpBefore2 = enemy.entity.currentHp
    expect(advanceUntil(combatSource, () => enemy.entity.currentHp < hpBefore2)).toBe(true)
    const woundedHit = hpBefore2 - enemy.entity.currentHp
    const woundedMight = participant.entity.stats.might

    // Huyet Cuong: damage per unit might GROWS with missing HP (the
    // drift-normalized scalar comparison).
    expect(woundedHit / woundedMight).toBeGreaterThan(fullHpHit / fullHpMight)
  })

  it('Ba The suppresses hard-CC blocking while the buff is active (INV-5)', () => {
    const { gameManager, combatSource } = makeManager()
    const player = mortalAtGate()
    gameManager.realmAdvanceOps.chooseCultivationPath('body', 'body_pathway', player)
    gameManager.progressionOps.purchaseNode('cuong_chien', player)
    player.baseStats = asBaseStats({ ...player.baseStats, might: 50, speed: 500 })

    const battle = startBattle(gameManager, combatSource, player, makeDummy('e2e_ba_the'))
    advanceIntoFighting(combatSource, battle)
    const participant = battle.players[0]!
    const enemy = battle.enemies[0]!

    applyBattleBuff(gameManager, 'choang', participant.entity.id, enemy.entity.id)
    applyBattleBuff(gameManager, 'bat_tu_ba_the', participant.entity.id, enemy.entity.id)

    const turnsBefore = battle.totalTurnsElapsed ?? 0
    const hpBefore = enemy.entity.currentHp
    expect(
      advanceUntil(combatSource, () => enemy.entity.currentHp < hpBefore || participant.consecutiveHardCcTurns > 0, 200),
    ).toBe(true)

    // The stunned-but-undying actor still acted - no CC-block counter moved.
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
    gameManager.realmAdvanceOps.chooseCultivationPath('body', 'body_pathway', player)
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

  it('phan_chan cast through the stack: taunt + Chấn Ấn on every enemy, reflect passive buff on tank', () => {
    const { gameManager, combatSource, player } = makeTranPlayerCompanion()
    player.realmId = 'foundation_establishment'
    player.techniqueProgress = { rank: 5, grade: 2 }
    gameManager.progressionOps.purchaseNode('major_phan_chan', player)

    const battle = startBattle(gameManager, combatSource, player, makeDummy('e2e_phan_chan'))
    advanceIntoFighting(combatSource, battle)
    const [tank, companion] = battle.players
    const enemy = battle.enemies[0]!

    expect(companion).toBeDefined()
    // grantsBuffsAtBuild plants the reflect passive with the special.
    expect(
      gameManager.getBattleBuffs(tank!.entity.id).filter((i) => i.definitionId === 'phan_chan'),
    ).toHaveLength(1)

    // The active cast applies BOTH khiem_khich (taunt) and chan_an (mark)
    // to every valid enemy - never direct damage.
    expect(
      advanceUntil(
        combatSource,
        () =>
          hasBuff(gameManager, enemy.entity.id, 'khiem_khich') &&
          hasBuff(gameManager, enemy.entity.id, 'chan_an'),
      ),
    ).toBe(true)
  })

  it('taunted enemy hits the tank (companion untouched); phan_chan reflects Max-HP damage back', () => {
    const { gameManager, combatSource, player } = makeTranPlayerCompanion()
    player.realmId = 'foundation_establishment'
    player.techniqueProgress = { rank: 5, grade: 2 }
    gameManager.progressionOps.purchaseNode('major_phan_chan', player)
    // Slow enemy - the tank casts phan_chan long before its first hit,
    // so EVERY enemy action happens under Taunt + mark.
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

    const reflects: number[] = []
    gameManager.eventBus.on<EntityVitalsChangedEvent>('entity_vitals_changed', (event) => {
      if (event.reason === 'reflection' && event.entityId === enemyP.entity.id) {
        reflects.push(event.amount)
      }
    })

    const tankHpBefore = tank!.entity.currentHp

    // Wait until the enemy has actually landed a taunted hit on the tank.
    expect(
      advanceUntil(
        combatSource,
        () => tank!.entity.currentHp < tankHpBefore && hasBuff(gameManager, enemyP.entity.id, 'khiem_khich'),
      ),
    ).toBe(true)

    // Taunt forced the tank target - the natural-target companion is untouched.
    expect(companion!.entity.currentHp).toBe(companion!.entity.stats.maxHp)
    // Exactly ONE reflect per hostile action at holder maxHp x MARKED
    // ratio - the enemy is Chan An-marked by the phan_chan cast.
    expect(reflects).toEqual([tank!.entity.stats.maxHp * PHAN_CHAN_MARKED_RATIO])
  })

  it('a fully-warded hit (hpDamage=0) queues no reflect', () => {
    const { gameManager, combatSource, player } = makeTranPlayerCompanion()
    player.realmId = 'foundation_establishment'
    player.techniqueProgress = { rank: 5, grade: 2 }
    gameManager.progressionOps.purchaseNode('major_phan_chan', player)
    const enemy = makeDummy('e2e_ward_reflect', { might: 100, attackSpeed: 0.5 })
    const battle = startBattle(gameManager, combatSource, player, enemy)
    const [tank, companion] = battle.players
    const enemyP = battle.enemies[0]!

    const enemyPos = { row: enemyP.entity.row, x: enemyP.entity.x }
    companion!.entity.row = enemyPos.row
    companion!.entity.x = enemyPos.x - 1
    tank!.entity.x = Math.max(0, enemyPos.x - 8)

    // Native ward pool sized to absorb every hit - hpDamage stays
    // 0, so the taken-gate never queues a reflect.
    tank!.entity.currentWard = tank!.entity.stats.maxHp * 100

    const reflects: number[] = []
    gameManager.eventBus.on<EntityVitalsChangedEvent>('entity_vitals_changed', (event) => {
      if (event.reason === 'reflection' && event.entityId === enemyP.entity.id) {
        reflects.push(event.amount)
      }
    })

    const hpBefore = tank!.entity.currentHp
    const wardBefore = tank!.entity.currentWard
    // Wait for at least one absorbed hit: ward drops, hp does not.
    expect(
      advanceUntil(
        combatSource,
        () => tank!.entity.currentWard < wardBefore,
        400,
      ),
    ).toBe(true)
    expect(tank!.entity.currentHp).toBe(hpBefore)
    expect(reflects).toEqual([])
  })
})

describe('hidden_body build wiring (Task 14)', () => {
  it('fixed kit slots populate; ung_the + owned-root markers land on the pool at build', () => {
    const { gameManager, combatSource } = makeManager()
    gameManager.catalogOps.registerProgressionNodes(THE_TU_AN_NODES)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    const player = mortalAtGate()
    player.nodeLevels.core_huy_quyen = 3
    gameManager.realmAdvanceOps.chooseCultivationPath('body', 'hidden_body_pathway', player)
    gameManager.progressionOps.purchaseNode('phan_mon', player)

    const battle = startBattle(gameManager, combatSource, player, makeDummy('e2e_an'))
    const participant = battle.players[0]!

    expect(participant.basic?.id).toBe('tham_the')
    expect(participant.special?.skill.id).toBe('tu_the')
    expect(participant.ultimate?.skill.id).toBe('bach_ung')
    expect(hasBuff(gameManager, participant.entity.id, 'ung_the')).toBe(true)
    expect(hasBuff(gameManager, participant.entity.id, 'phan_mon')).toBe(true)
    expect(hasBuff(gameManager, participant.entity.id, 'ho_mon')).toBe(false)
    expect(hasBuff(gameManager, participant.entity.id, 'tro_mon')).toBe(false)
  })
})

describe('save/restore parity', () => {
  it('path + node state round-trips; the rebuilt battle resolves the same node-scaled kit', () => {
    const { gameManager } = makeManager()
    const player = mortalAtGate()
    gameManager.realmAdvanceOps.chooseCultivationPath('body', 'body_pathway', player)
    gameManager.progressionOps.purchaseNode('cuong_chien', player)
    gameManager.progressionOps.purchaseNode('minor_trong_quyen', player)

    const save = buildGameSave(player, gameManager)

    setActivePinia(createPinia())
    const playerStore = usePlayerStore()
    const { gameManager: restored, combatSource } = makeManager()
    const result = restoreGameSession(playerStore, restored, save)
    expect(result.status).toBe('ok')

    const restoredPlayer = playerStore.$state
    expect(restoredPlayer.cultivationPath).toBe('body')
    expect(restoredPlayer.nodeLevels?.cuong_chien).toBe(1)
    expect(restoredPlayer.nodeLevels?.minor_trong_quyen).toBe(1)

    const battle = startBattle(restored, combatSource, restoredPlayer, makeDummy('e2e_restore'))
    advanceIntoFighting(combatSource, battle)
    const participant = battle.players[0]!
    expect(participant.basic?.id).toBe('cuong_quyen')
    expect(participant.basic?.damage?.multiplier).toBeCloseTo(
      (CUONG_QUYEN.damage?.multiplier ?? 0) + 0.1,
    )
    // Beta window: root at Luyen Khi grants the Basic only.
    expect(participant.special).toBeUndefined()
    expect(participant.ultimate).toBeUndefined()
  })
})
