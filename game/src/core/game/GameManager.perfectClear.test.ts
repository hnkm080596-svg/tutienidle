import { afterEach, describe, expect, it, vi } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { asBaseStats } from '../stats/StatBlock'
import { defineEnemy } from '../enemy/Enemy'
import type { Stage } from '../stage/Stage'
import { COMPANIONS } from '../../data/companion/Companions'
import type { CompanionDefinition } from '../../data/companion/Companions'
import { SPIRIT_STONE_MATERIAL } from '../material/SpiritStoneMaterial'

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
    rewards: { techniqueMastery: 0, spiritStone: 0 },
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

  it('slower Hoàn Mỹ lần 2 không rewrite record - record là best time', () => {
    // F-BX-85 contract: the record channel is the fastest qualifying
    // clear. A second PC that is NOT faster leaves the record untouched.
    // Wall-clock durations pin the F-BX-53 FALLBACK path deterministically
    // - a mid-battle clock-source swap detaches the step anchor, so the
    // writer measures wall time instead of combat steps.
    let nowMs = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => nowMs)

    const { gameManager, player, stageDef } = harness(stage({ perfectClearTurnLimit: 50 }))
    player.baseStats = asBaseStats({ ...player.baseStats, might: 100  })
    const clock1 = new ManualClockSource()
    gameManager.setCombatClockSource(clock1)

    nowMs += 1_000 // cycle 1 clears in 1s
    for (let i = 0; i < 400 && gameManager.getTurnBattle()?.state !== 'victory'; i++) {
      try {
        clock1.advance(COMBAT_STEP_SECONDS)
      } catch (error) {
        console.error('[PC-LOOP-THREW]', i, error instanceof Error ? error.message : String(error))
        break
      }
    }

    const firstSeconds = player.perfectClearSeconds['perfect_stage']
    expect(firstSeconds).toBeCloseTo(1, 3)
    expect(player.perfectClearStageIds).toContain('perfect_stage')

    gameManager.turnBattleOps.startStage(player, stageDef, false)
    const clock2 = new ManualClockSource()
    gameManager.setCombatClockSource(clock2)

    nowMs += 2_000 // cycle 2 clears in 2s - slower, must not rewrite
    for (let i = 0; i < 400 && gameManager.getTurnBattle()?.state !== 'victory'; i++) {
      try {
        clock2.advance(COMBAT_STEP_SECONDS)
      } catch (error) {
        console.error('[PC-LOOP-THREW]', i, error instanceof Error ? error.message : String(error))
        break
      }
    }

    expect(player.perfectClearSeconds['perfect_stage']).toBe(firstSeconds)
    vi.restoreAllMocks()
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
      // perfectClearTurnLimit: 0 - roundsElapsed < 0 can never hold, so
      // this victory is always a normal (non-qualifying) clear: under
      // the fastest-record contract (F-BX-85) only a QUALIFYING faster
      // clear may rewrite the record.
      const { gameManager, player, combatSource } = harness(stage({ perfectClearTurnLimit: 0 }))

      player.perfectClearStageIds.push('perfect_stage')
      player.perfectClearSeconds['perfect_stage'] = 42

      driveToVictory(gameManager, combatSource)

      expect(gameManager.getTurnBattle()?.state).toBe('victory')
      expect(player.perfectClearStageIds).toEqual(['perfect_stage'])
      expect(player.perfectClearSeconds['perfect_stage']).toBe(42)
    })

    it('already-PC stage cleared again SLOWER -> record kept; FASTER -> record rewritten (F-BX-85)', () => {
      // The record channel is the best time: a qualifying clear that is
      // NOT faster than the stored record never rewrites it.
      let nowMs = 1_000_000
      vi.spyOn(Date, 'now').mockImplementation(() => nowMs)

      const { gameManager, player, stageDef } = harness(stage({ perfectClearTurnLimit: 50 }))
      // F-BX-53 fallback path: swap the clock source mid-battle so the
      // record reads wall time - that is what the 42s comparison pins.
      const clock1 = new ManualClockSource()
      gameManager.setCombatClockSource(clock1)

      player.perfectClearStageIds.push('perfect_stage')
      player.perfectClearSeconds['perfect_stage'] = 42

      nowMs += 43_000 // a slower qualifying clear than the stored 42s
      driveToVictory(gameManager, clock1)

      expect(gameManager.getTurnBattle()?.state).toBe('victory')
      expect(player.perfectClearSeconds['perfect_stage']).toBe(42)

      // A later qualifying clear that beats the record rewrites it -
      // repeat-run clears are eligible again once anchoring is fixed.
      gameManager.turnBattleOps.startStage(player, stageDef, false)
      const clock2 = new ManualClockSource()
      gameManager.setCombatClockSource(clock2)
      nowMs += 1_000 // this cycle clears in 1s - faster than 42
      driveToVictory(gameManager, clock2)

      expect(gameManager.getTurnBattle()?.state).toBe('victory')
      expect(player.perfectClearSeconds['perfect_stage']).toBeLessThan(42)
      expect(player.perfectClearSeconds['perfect_stage']).toBeCloseTo(1, 3)
      vi.restoreAllMocks()
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

describe('GameManager — perfect_clear observation emit (Sound System W6)', () => {
  it('fires per RECORD write — the first record and each faster clear; slower victories stay silent (F-BX-85)', () => {
    const stageDef = {
      id: 'perfect_stage',
      name: 'Perfect Stage',
      description: '',
      floor: 1,
      enemyPool: [{ enemyId: 'perfect_dummy', weight: 1 }],
      totalEnemyCount: 1, waves: [1],
      spawnIntervalSeconds: 0,
      perfectClearTurnLimit: 10,
    } as Stage
    const DUMMY = defineEnemy({
      id: 'perfect_dummy', name: 'Perfect Dummy', level: 1, realmId: 'mortal', lane: 'ground',
      statsInput: { maxHp: 1, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueMastery: 0, spiritStone: 0 },
    })
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    const player = createDefaultPlayer()
    player.baseStats = asBaseStats({ ...player.baseStats, might: 100 })
    gameManager.catalogOps.registerEnemyTemplates([DUMMY])
    gameManager.catalogOps.registerStages([stageDef])
    gameManager.setActivePlayer(player)

    const seen: { stageId: string; clearSeconds: number }[] = []
    gameManager.eventBus.on<typeof seen[number]>('perfect_clear', (e) => seen.push(e))

    // Round 1: first record (10s). Round 2: faster (5s) -> record
    // rewritten AND re-emitted. Round 3: slower (7s) -> no write, silent.
    // Wall-clock durations pin the F-BX-53 fallback path (a mid-battle
    // source swap detaches the step anchor -> wall-clock measure).
    let nowMs = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => nowMs)
    const roundDurationsMs = [10_000, 5_000, 7_000]

    for (const durationMs of roundDurationsMs) {
      gameManager.turnBattleOps.startStage(player, stageDef, false)
      const roundClock = new ManualClockSource()
      gameManager.setCombatClockSource(roundClock)
      nowMs += durationMs
      for (let i = 0; i < 400 && gameManager.getTurnBattle()?.state !== 'victory'; i++) {
        roundClock.advance(COMBAT_STEP_SECONDS)
      }
      expect(gameManager.getTurnBattle()?.state).toBe('victory')
    }

    expect(player.perfectClearStageIds).toEqual(['perfect_stage'])
    expect(player.perfectClearSeconds['perfect_stage']).toBeCloseTo(5, 3)
    expect(seen).toHaveLength(2)
    expect(seen[0]!.clearSeconds).toBeCloseTo(10, 3)
    expect(seen[1]!.clearSeconds).toBeCloseTo(5, 3)
    vi.restoreAllMocks()
  })
})

describe('GameManager — F-BX-84/85: clearSeconds writer contract (positive floor + cycle anchoring)', () => {
  const DUMMY_ENEMY = defineEnemy({
    id: 'pc85_dummy',
    name: 'PC85 Dummy',
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
    rewards: { techniqueMastery: 0, spiritStone: 1 },
  })

  function stageDef(): Stage {
    return {
      id: 'pc85_stage',
      name: 'PC85 Stage',
      description: '',
      floor: 1,
      enemyPool: [{ enemyId: DUMMY_ENEMY.id, weight: 1 }],
      totalEnemyCount: 1, waves: [1],
      spawnIntervalSeconds: 0,
      perfectClearTurnLimit: 50,
    }
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('F-BX-84: a same-instant qualifying clear still records a POSITIVE clearSeconds (validator requires >0)', () => {
    // The save validator rejects perfectClearSeconds <= 0 - a headless
    // run can legitimately measure a 0 wall-clock diff; the writer must
    // floor the record instead of writing a corruptable value.
    const fixed = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(fixed)

    const stage = stageDef()
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    const player = createDefaultPlayer()
    player.baseStats = asBaseStats({ ...player.baseStats, might: 100 })
    gameManager.catalogOps.registerEnemyTemplates([DUMMY_ENEMY])
    gameManager.catalogOps.registerStages([stage])
    gameManager.setActivePlayer(player)
    gameManager.turnBattleOps.startStage(player, stage, false)

    for (let i = 0; i < 400 && gameManager.getTurnBattle()?.state !== 'victory'; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    expect(gameManager.getTurnBattle()?.state).toBe('victory')
    expect(player.perfectClearStageIds).toContain('pc85_stage')
    expect(player.perfectClearSeconds['pc85_stage']).toBeGreaterThan(0)
  })

  it('F-BX-85: repeat cycles re-anchor the clear clock AND a faster cycle rewrites the record', () => {
    // Whole-run anchoring (bug): cycle N>1 records the full run clock
    // (~45s farm cycles) AND the once-only guard kept the inflated
    // record forever. Contract: the record is the fastest qualifying
    // cycle time, measured from that cycle's start.
    let nowMs = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => nowMs)

    const stage = stageDef()
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    const player = createDefaultPlayer()
    player.baseStats = asBaseStats({ ...player.baseStats, might: 100 })
    gameManager.catalogOps.registerMaterials([SPIRIT_STONE_MATERIAL])
    gameManager.catalogOps.registerEnemyTemplates([DUMMY_ENEMY])
    gameManager.catalogOps.registerStages([stage])
    gameManager.setActivePlayer(player)

    // battle_end publishes exactly once per cycle (ARCH-014) - the
    // deterministic per-victory counter a repeat loop can gate on.
    let victories = 0
    gameManager.eventBus.on('battle_end', () => {
      victories += 1
    })

    gameManager.turnBattleOps.startStage(player, stage, true) // repeatContinuously
    // F-BX-53 fallback path: swap the source mid-battle so these
    // wall-clock durations are what the record measures.
    const cycle1Clock = new ManualClockSource()
    gameManager.setCombatClockSource(cycle1Clock)

    nowMs += 10_000 // cycle 1 clears 10s after launch
    for (let i = 0; i < 400 && victories < 1; i++) {
      cycle1Clock.advance(COMBAT_STEP_SECONDS)
    }
    expect(victories).toBe(1)
    expect(player.perfectClearSeconds['pc85_stage']).toBeCloseTo(10, 3)

    // Cycle 2 restarts at the cycle-1 victory instant (1_010_000); clearing
    // 200ms into the new cycle must record ~0.2s, not ~10.2s (anchor),
    // and must rewrite because it is faster (record-is-best contract).
    const cycle2Clock = new ManualClockSource()
    gameManager.setCombatClockSource(cycle2Clock)
    nowMs += 200
    for (let i = 0; i < 400 && victories < 2; i++) {
      cycle2Clock.advance(COMBAT_STEP_SECONDS)
    }
    expect(victories).toBe(2)
    expect(player.perfectClearSeconds['pc85_stage']).toBeCloseTo(0.2, 3)
  })

  it('F-BX-53: clearSeconds is the combat-clock measure - frozen (paused/hidden) time does not count', () => {
    // The writer reads the battle clock's emitted steps: they accumulate
    // only while the clock runs, so a held clock ('tab-hidden' /
    // 'not-revealed' / 'turn-in-flight') charges nothing to the clear -
    // exactly the pause-aware contract the auditor asked for.
    const stage = stageDef()
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    const player = createDefaultPlayer()
    player.baseStats = asBaseStats({ ...player.baseStats, might: 100 })
    gameManager.catalogOps.registerEnemyTemplates([DUMMY_ENEMY])
    gameManager.catalogOps.registerStages([stage])
    gameManager.setActivePlayer(player)
    gameManager.turnBattleOps.startStage(player, stage, false)

    const stepsAtStart = gameManager.turnBattleOps.getElapsedCombatSteps()

    // 50 frames (~5s of wall-clock-equivalent combat time) arrive while
    // the clock is frozen - they must emit zero steps and never reach
    // the record.
    const stepsBeforeFreeze = gameManager.turnBattleOps.getElapsedCombatSteps()
    gameManager.turnBattleOps.freezeCombat('tab-hidden')
    for (let i = 0; i < 50; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }
    expect(gameManager.turnBattleOps.getElapsedCombatSteps()).toBe(stepsBeforeFreeze)
    gameManager.turnBattleOps.resumeCombat('tab-hidden')

    for (let i = 0; i < 400 && gameManager.getTurnBattle()?.state !== 'victory'; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    expect(gameManager.getTurnBattle()?.state).toBe('victory')
    const battleSeconds =
      (gameManager.turnBattleOps.getElapsedCombatSteps() - stepsAtStart) * COMBAT_STEP_SECONDS
    expect(battleSeconds).toBeGreaterThan(0)
    expect(player.perfectClearStageIds).toContain('pc85_stage')
    expect(player.perfectClearSeconds['pc85_stage']).toBeCloseTo(battleSeconds, 10)
  })

  it('F-BX-53 fallback: a mid-battle clock-source swap keeps the wall-clock measure', () => {
    let nowMs = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => nowMs)

    const stage = stageDef()
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    const player = createDefaultPlayer()
    player.baseStats = asBaseStats({ ...player.baseStats, might: 100 })
    gameManager.catalogOps.registerEnemyTemplates([DUMMY_ENEMY])
    gameManager.catalogOps.registerStages([stage])
    gameManager.setActivePlayer(player)
    gameManager.turnBattleOps.startStage(player, stage, false)

    // Swapping the source re-mints the clock: the step anchor belongs to
    // a different instance, so the writer falls back to wall clock.
    const swappedClock = new ManualClockSource()
    gameManager.setCombatClockSource(swappedClock)

    nowMs += 3_000
    for (let i = 0; i < 400 && gameManager.getTurnBattle()?.state !== 'victory'; i++) {
      swappedClock.advance(COMBAT_STEP_SECONDS)
    }

    expect(gameManager.getTurnBattle()?.state).toBe('victory')
    expect(player.perfectClearSeconds['pc85_stage']).toBeCloseTo(3, 3)
  })
})
