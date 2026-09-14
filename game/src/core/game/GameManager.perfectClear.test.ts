import { afterEach, describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { asBaseStats } from '../stats/StatBlock'
import { defineEnemy } from '../enemy/Enemy'
import type { Stage } from '../stage/Stage'
import { COMPANIONS } from '../../data/companion/Companions'
import type { CompanionDefinition } from '../../data/companion/Companions'

// Auto-farm spec Task 3 — Hoàn Mỹ condition trên turn-based victory:
// record perfectClearStageIds + perfectClearSeconds khi HP loss <=75%
// VÀ turns < stage.perfectClearTurnLimit. Ghi 1 LẦN (không overwrite).
//
// STATUS (2026-09-04): mechanism recordPerfectClearIfEligible đã wire
// vào grantTurnBattleRewards victory block + turnBattleStartedAtMs ở
// startStage — NHƯNG tests này đang tạm disable (describe.skip): victory
// block chạy (emitted=true) nhưng record không ghi — 1 subtle flow issue
// chưa root-cause sau nhiều hypothesis (systematic-debugging rule: >3
// attempts → stop). Follow-up: debug riêng với victory-block tracing.
describe('GameManager — Hoàn Mỹ condition on turn-based victory', () => {
  const DUMMY_ENEMY = defineEnemy({
    id: 'perfect_dummy',
    name: 'Perfect Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp: 1,
      might: 0,
      attackSpeed: 1,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
    },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })

  function stage(overrides: Partial<Stage> = {}): Stage {
    return {
      id: 'perfect_stage',
      name: 'Perfect Stage',
      description: '',
      floor: 1,
      enemyPool: [{ enemyId: DUMMY_ENEMY.id, weight: 1 }],
      totalEnemyCount: 1, waves: [1],
      spawnIntervalSeconds: 0,
      ...overrides,
    }
  }

  function harness(stageDef: Stage) {
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    const player = createDefaultPlayer()
    player.baseStats = asBaseStats({ ...player.baseStats, might: 100  })

    gameManager.catalogOps.registerEnemyTemplates([DUMMY_ENEMY])
    gameManager.catalogOps.registerStages([stageDef])
    gameManager.setActivePlayer(player)

    gameManager.turnBattleOps.startStage(player, stageDef, false)

    return { gameManager, player, stageDef, combatSource }
  }

  it('ghi perfectClearStageIds + perfectClearSeconds khi đủ điều kiện', () => {
    const { gameManager, player, combatSource } = harness(stage({ perfectClearTurnLimit: 10 }))

    try {
      for (let i = 0; i < 400 && gameManager.getTurnBattle()?.state !== 'victory'; i++) {
        combatSource.advance(COMBAT_STEP_SECONDS)
      }
    } catch (error) {
      console.error('[PC-TEST-CAUGHT]', error instanceof Error ? error.stack?.split('\n').slice(0, 10).join(' | ') : String(error))
    }

    console.error('[PC-TEST-PROBE]', gameManager.getTurnBattle()?.state)
    expect(gameManager.getTurnBattle()?.state).toBe('victory')
    expect({ pc: JSON.stringify(player.perfectClearStageIds), cs: JSON.stringify(player.completedStageIds) }).toEqual({ pc: JSON.stringify(['perfect_stage']), cs: JSON.stringify(['perfect_stage']) })
    expect(player.perfectClearStageIds).toContain('perfect_stage')
    expect(player.perfectClearSeconds['perfect_stage']).toBeDefined()
  })

  it('không ghi khi stage chưa định nghĩa perfectClearTurnLimit', () => {
    const { gameManager, player, combatSource } = harness(stage())

    for (let i = 0; i < 400 && gameManager.getTurnBattle()?.state !== 'victory'; i++) {
      try {
        combatSource.advance(COMBAT_STEP_SECONDS)
      } catch (error) {
        console.error('[PC-LOOP-THREW]', i, error instanceof Error ? error.message : String(error))
        break
      }
    }

    expect(gameManager.getTurnBattle()?.state).toBe('victory')
    expect(player.perfectClearStageIds).not.toContain('perfect_stage')
  })

  it('không overwrite perfectClearSeconds khi đạt Hoàn Mỹ lần 2', () => {
    const { gameManager, player, stageDef, combatSource } = harness(stage({ perfectClearTurnLimit: 50 }))
    player.baseStats = asBaseStats({ ...player.baseStats, might: 100  })

    for (let i = 0; i < 400 && gameManager.getTurnBattle()?.state !== 'victory'; i++) {
      try {
        combatSource.advance(COMBAT_STEP_SECONDS)
      } catch (error) {
        console.error('[PC-LOOP-THREW]', i, error instanceof Error ? error.message : String(error))
        break
      }
    }

    const firstSeconds = player.perfectClearSeconds['perfect_stage']

    // clearSeconds is wall-clock (Date.now() diff) and can legitimately
    // be 0 in a synchronous test loop - assert the RECORD, not the value.
    expect(player.perfectClearStageIds).toContain('perfect_stage')

    gameManager.turnBattleOps.startStage(player, stageDef, false)

    for (let i = 0; i < 400 && gameManager.getTurnBattle()?.state !== 'victory'; i++) {
      try {
        combatSource.advance(COMBAT_STEP_SECONDS)
      } catch (error) {
        console.error('[PC-LOOP-THREW]', i, error instanceof Error ? error.message : String(error))
        break
      }
    }

    expect(player.perfectClearSeconds['perfect_stage']).toBe(firstSeconds)
  })

  // Spec v3 D1 (2026-09-11): perfect clear = EVERY party member alive at
  // the victory tick AND totalTurnsElapsed < stage.perfectClearTurnLimit.
  // HP-loss is no longer consulted. B4 edges lock the once-only contract.
  // Two-member party tests push a test-only companion into COMPANIONS for
  // the test duration (same fixture pattern as partyFormation.test.ts).
  // Dead/revive uses direct alive-flag assignment - allowed in tests
  // (the vitals-write guard exempts test code).
  describe('Hoan My alive-for-all (D1) + B4 edges', () => {
    const TEST_COMPANION: CompanionDefinition = {
      id: 'pc_test_companion',
      name: 'PC Test Companion',
      grade: 'hoang',
      growthRate: 0.05,
      unlockThresholds: {},
      baseStats: { maxHp: 100, might: 10, speed: 100 },
      basic: {
        id: 'pc_test_companion_basic',
        cooldownTurns: 0,
        damage: { kind: 'physical', multiplier: 1 },
        targeting: { shape: 'single' },
      },
    }

    afterEach(() => {
      const index = COMPANIONS.findIndex((companion) => companion.id === TEST_COMPANION.id)
      if (index >= 0) {
        ;(COMPANIONS as unknown as CompanionDefinition[]).splice(index, 1)
      }
    })

    function driveToVictory(gameManager: GameManager, combatSource: ManualClockSource, maxSteps = 400) {
      for (let i = 0; i < maxSteps && gameManager.getTurnBattle()?.state !== 'victory'; i++) {
        combatSource.advance(COMBAT_STEP_SECONDS)
      }
    }

    function harnessWithCompanion(stageDef: Stage) {
      ;(COMPANIONS as unknown as CompanionDefinition[]).push(TEST_COMPANION)

      const gameManager = new GameManager()
      const combatSource = new ManualClockSource()
      gameManager.setCombatClockSource(combatSource)
      const player = createDefaultPlayer()
      player.baseStats = asBaseStats({ ...player.baseStats, might: 100  })

      // formationLoadout + companions must be set BEFORE
      // setActivePlayer/startStage - buildTurnBattle reads the live
      // PlayerData and only adds a companion that has a formation slot.
      player.companions = [
        {
          instanceId: 'pc_test_instance',
          definitionId: TEST_COMPANION.id,
          realmId: 'mortal',
          realmLevel: 1,
          exp: 0,
          constellationRank: 0,
        },
      ]
      player.formationLoadout = {
        formationId: 'pc_test_formation',
        assignments: [
          { row: 0, column: 0, combatantId: 'player' },
          { row: 1, column: 1, combatantId: TEST_COMPANION.id },
        ],
      }

      gameManager.catalogOps.registerEnemyTemplates([DUMMY_ENEMY])
      gameManager.catalogOps.registerStages([stageDef])
      gameManager.setActivePlayer(player)
      gameManager.turnBattleOps.startStage(player, stageDef, false)

      return { gameManager, player, stageDef, combatSource }
    }

    it('records when every member is alive and turns are under the limit', () => {
      const { gameManager, player, combatSource } = harnessWithCompanion(stage({ perfectClearTurnLimit: 50 }))

      expect(gameManager.getTurnBattle()?.players).toHaveLength(2)

      driveToVictory(gameManager, combatSource)

      expect(gameManager.getTurnBattle()?.state).toBe('victory')
      expect(player.perfectClearStageIds).toContain('perfect_stage')
      expect(player.perfectClearSeconds['perfect_stage']).toBeDefined()
    })

    it('does NOT record when a party member is dead at the victory tick', () => {
      const { gameManager, player, combatSource } = harnessWithCompanion(stage({ perfectClearTurnLimit: 50 }))

      const companion = gameManager
        .getTurnBattle()!
        .players.find((member) => member.id === TEST_COMPANION.id)

      expect(companion).toBeDefined()
      companion!.entity.alive = false
      companion!.alive = false

      driveToVictory(gameManager, combatSource)

      expect(gameManager.getTurnBattle()?.state).toBe('victory')
      expect(player.perfectClearStageIds).not.toContain('perfect_stage')
    })

    it('already-PC stage cleared without qualifying -> PC state kept, nothing re-recorded', () => {
      // perfectClearTurnLimit: 1 - a real battle always takes >= 1 turn,
      // so this victory is a normal (non-qualifying) clear.
      const { gameManager, player, combatSource } = harness(stage({ perfectClearTurnLimit: 1 }))

      player.perfectClearStageIds.push('perfect_stage')
      player.perfectClearSeconds['perfect_stage'] = 42

      driveToVictory(gameManager, combatSource)

      expect(gameManager.getTurnBattle()?.state).toBe('victory')
      expect(player.perfectClearStageIds).toEqual(['perfect_stage'])
      expect(player.perfectClearSeconds['perfect_stage']).toBe(42)
    })

    it('already-PC stage cleared again with qualifying pace -> perfectClearSeconds NOT overwritten', () => {
      const { gameManager, player, combatSource } = harness(stage({ perfectClearTurnLimit: 50 }))

      player.perfectClearStageIds.push('perfect_stage')
      player.perfectClearSeconds['perfect_stage'] = 42

      driveToVictory(gameManager, combatSource)

      expect(gameManager.getTurnBattle()?.state).toBe('victory')
      expect(player.perfectClearStageIds).toEqual(['perfect_stage'])
      expect(player.perfectClearSeconds['perfect_stage']).toBe(42)
    })

    it('die then revive still counts as PC (alive at the victory tick)', () => {
      const { gameManager, player, combatSource } = harnessWithCompanion(stage({ perfectClearTurnLimit: 50 }))

      const companion = gameManager
        .getTurnBattle()!
        .players.find((member) => member.id === TEST_COMPANION.id)!

      companion.entity.alive = false
      companion.alive = false

      combatSource.advance(COMBAT_STEP_SECONDS)
      combatSource.advance(COMBAT_STEP_SECONDS)

      // Revived before the victory tick - the predicate reads the alive
      // state AT victory, not "was ever dead" (B4 edge d).
      companion.entity.alive = true
      companion.alive = true

      driveToVictory(gameManager, combatSource)

      expect(gameManager.getTurnBattle()?.state).toBe('victory')
      expect(player.perfectClearStageIds).toContain('perfect_stage')
    })

    it('first PC also pushes completedStageIds (two independent pushes)', () => {
      const { gameManager, player, combatSource } = harness(stage({ perfectClearTurnLimit: 50 }))

      driveToVictory(gameManager, combatSource)

      expect(gameManager.getTurnBattle()?.state).toBe('victory')
      expect(player.perfectClearStageIds).toContain('perfect_stage')
      expect(player.completedStageIds).toContain('perfect_stage')
    })
  })
})
