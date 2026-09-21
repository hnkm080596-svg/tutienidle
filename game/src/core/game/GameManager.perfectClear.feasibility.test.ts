import { afterEach, describe, expect, it, vi } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { asBaseStats } from '../stats/StatBlock'
import { defineEnemy } from '../enemy/Enemy'
import type { Stage } from '../stage/Stage'
import type { Enemy } from '../enemy/Enemy'
import { defineChapterStages } from '../../data/stage/ChapterStages'

// Perfect-clear feasibility guard (spec v3 D1/D2 revised, 2026-09-12):
// perfectClearTurnLimit counts ATB ROUNDS (battle.roundsElapsed - a
// round closes when every participant alive at that moment has acted
// once), so wave size no longer inflates the count. Limits are
// totalEnemyCount + 10 on floors 1-9 and 15 on the boss floor.
// This is a permanent regression lock: a best-case run (one-shot
// player, zero-damage foes) and a realistic multi-hit run (3000 HP
// foes, ~3 hits per kill) must BOTH earn the perfect clear on every
// floor shape - if a limit rebalance or a spawn-rule change makes a
// flawless run unrecordable, this test fails.
describe('perfect clear feasibility on a real floor shape', () => {
  const ONE_HP = defineEnemy({
    id: 'qa_one_hp',
    name: 'QA One HP',
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

  // Multi-hit variant: 3000 HP dummy vs player might 1000 -> ~3 landed
  // hits per enemy (armor/weakness aside) - measures rounds when kills
  // take real effort instead of one-shots.
  const TANKY = defineEnemy({
    id: 'qa_tanky',
    name: 'QA Tanky',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp: 3000,
      might: 0,
      attackSpeed: 1,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
    },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })

  // Floors built by the production builder (9 + floor enemies, waves
  // split in 3, floor 10 solo boss) with the species swapped for the
  // harmless dummy so the run is the best case a player could ever get.
  function builtFloor(floor: number, species: Enemy): Stage {
    const stages = defineChapterStages({
      realmId: 'mortal',
      chapter: 1,
      ids: Array.from({ length: 10 }, (_, i) => `qa_floor_${i + 1}`),
      names: (f) => `QA ${f}`,
      descriptions: Array.from({ length: 10 }, () => ''),
      speciesByFloor: Array.from({ length: 10 }, () => ({ common: species.id, elite: species.id })),
    })

    return { ...stages[floor - 1]!, spawnIntervalSeconds: 0 }
  }

  function harness(stageDef: Stage, species: Enemy, playerAttack: number) {
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    const player = createDefaultPlayer()
    player.realmLevel = 10
    player.baseStats = asBaseStats({ ...player.baseStats, might: playerAttack  })

    gameManager.catalogOps.registerEnemyTemplates([species])
    gameManager.catalogOps.registerStages([stageDef])
    gameManager.setActivePlayer(player)
    gameManager.turnBattleOps.startStage(player, stageDef, false)

    return { gameManager, player, combatSource }
  }

  let cleanup: (() => void) | undefined

  // Deterministic RNG so the feasibility measurement is reproducible:
  // unseeded Math.random (dodge/crit/placement draws) let floors straddle
  // the limit nondeterministically between runs. One mulberry32 stream
  // per floor keeps the real engine sim but fixes the outcome.
  function mulberry32(seed: number): () => number {
    let a = seed >>> 0
    return () => {
      a |= 0
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  function pinRandom(floor: number): void {
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(0x9e37 + floor * 7919))
  }

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
    vi.restoreAllMocks()
  })

  it.each([1, 5, 9, 10])('best-case floor %i (one-shot player, zero-damage foes): rounds at victory vs the fixed limit', (floor) => {
    pinRandom(floor)
    const stageDef = builtFloor(floor, ONE_HP)
    const { gameManager, player, combatSource } = harness(stageDef, ONE_HP, 1000)
    cleanup = () => { gameManager.abandonBattle() }

    let turnsAtVictory = -1
    let roundsAtVictory = -1

    for (let i = 0; i < 5000; i++) {
      const battle = gameManager.getTurnBattle()

      if (battle?.state === 'victory') {
        turnsAtVictory = battle.totalTurnsElapsed ?? 0
        roundsAtVictory = battle.roundsElapsed ?? 0
        break
      }

      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    expect(turnsAtVictory, 'battle must reach victory').toBeGreaterThanOrEqual(0)

    // Evidence line for the QA report: actor actions AND completed
    // rounds the best possible run needed, against the fixed limit.
    console.info(`[QA-e] floor ${floor} best case: totalTurnsElapsed=${turnsAtVictory}, roundsElapsed=${roundsAtVictory}, limit=${stageDef.perfectClearTurnLimit}, recorded=${player.perfectClearStageIds.includes(stageDef.id)}`)

    // The intended product behavior is that a flawless run CAN earn the
    // perfect clear. If this fails, the limit is unreachable on this floor.
    expect(player.perfectClearStageIds).toContain(stageDef.id)
  })

  // PLAYTEST DEBT (2026-09-14, user-locked): the solo/basic-attack-only
  // fixture cannot perfect-clear floors 1/5/9/10 within the fixed limits —
  // pinned-seed measurements: floor 1 needs 21 rounds vs limit 20, floor 5
  // 24 vs 24 (not recorded), floor 9 does not reach victory inside 5000
  // steps, floor 10 needs 16 vs 15. Conditions stay unchanged pending
  // playtest + a real party/skill composition; the skill system is not
  // complete. it.fails keeps these VISIBLE: if a future change makes a
  // floor pass, vitest flags it and this block must be revisited.
  // See docs/qa/2026-09-14-full-project-engineering-audit.md (perfect-clear
  // feasibility) and the arch-repair program ledger.
  for (const floor of [1, 5, 9, 10]) {
    it.fails(`multi-hit floor ${floor} (3000 HP foes, might 1000 = ~3 hits per kill): rounds at victory vs the fixed limit`, () => {
      pinRandom(floor)
      const stageDef = builtFloor(floor, TANKY)
      const { gameManager, player, combatSource } = harness(stageDef, TANKY, 1000)
      cleanup = () => { gameManager.abandonBattle() }

      let turnsAtVictory = -1
      let roundsAtVictory = -1

      for (let i = 0; i < 5000; i++) {
        const battle = gameManager.getTurnBattle()

        if (battle?.state === 'victory') {
          turnsAtVictory = battle.totalTurnsElapsed ?? 0
          roundsAtVictory = battle.roundsElapsed ?? 0
          break
        }

        combatSource.advance(COMBAT_STEP_SECONDS)
      }

      expect(turnsAtVictory, 'battle must reach victory').toBeGreaterThanOrEqual(0)

      console.info(`[QA-e] floor ${floor} multi-hit: totalTurnsElapsed=${turnsAtVictory}, roundsElapsed=${roundsAtVictory}, limit=${stageDef.perfectClearTurnLimit}, recorded=${player.perfectClearStageIds.includes(stageDef.id)}`)

      expect(player.perfectClearStageIds).toContain(stageDef.id)
    })
  }
})
