// QA novel-attack probe (clean-A round, state 36dd5273) - attacks the
// lane the pinned suite does NOT cover: every existing momentum ratio
// assertion drives the ENGINE-UNIT lane (raw TurnBattleSystem with no
// runtime). Production + the BalanceMatrix sim run the PLAN lane
// (tryPlanCast via combatScheduler) where momentum is computed by an
// `each.momentumPerLandedInstance` ops_result_sum read over prior
// hit opIds. If the plan lane mis-reads (counts ops not instances,
// lets a miss mint stack-free opIds, or double-applies), real-game
// damage diverges from what invariants.test.ts pinned.
// Lives in docs/qa/runs/ so it never moves productStateId; run via
// vitest.probe.config.mts.
import { describe, expect, it, vi } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../../../../../src/core/battle/turn/CombatClock'
import { GameManager } from '../../../../../src/core/game/GameManager'
import { createDefaultPlayer, type PlayerData } from '../../../../../src/core/player/Player'
import { freshSwordPathState } from '../../../../../src/core/kiem-tu/KiemTuState'
import { LIEN_MOMENTUM_RATE } from '../../../../../src/core/kiem-tu/NguKiemDao'
import { defineEnemy } from '../../../../../src/core/enemy/Enemy'
import { SKILLS } from '../../../../../src/data/skill/Skills'
import { TECHNIQUES } from '../../../../../src/data/technique/Techniques'
import { KIEM_TU_NODES } from '../../../../../src/data/progression/KiemTuNodes'
import { SKILL_CORE_NODES } from '../../../../../src/data/progression/SkillCoreNodes'

function nguPlayer(realmId = 'foundation_establishment'): PlayerData {
  const player = createDefaultPlayer()
  player.cultivationPath = 'sword'
  player.cultivationWay = 'hidden_sword_pathway'
  player.realmId = realmId
  player.swordPath = freshSwordPathState()
  // Committed spine: ritual grants khoi; lien is the Truc Co layer the
  // momentum model belongs to.
  player.nodeLevels = { ...player.nodeLevels, ngu_kiem_khoi: 1, ngu_kiem_lien: 1 }
  return player
}

function makeManager(player: PlayerData) {
  const gameManager = new GameManager()
  const clock = new ManualClockSource()
  gameManager.setCombatClockSource(clock)
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
  gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
  gameManager.setActivePlayer(player)
  return { gameManager, clock }
}

function dummyEnemy(maxHp = 50_000_000) {
  return defineEnemy({
    id: 'probe_dummy',
    name: 'Probe Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp,
      might: 0,
      attackSpeed: 1,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
      evasionRate: 0,
    },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })
}

function collectDamage(gameManager: GameManager) {
  const values: number[] = []
  gameManager.eventBus.on('damage', (event: { value?: number }) => {
    if (event.value !== undefined) values.push(event.value)
  })
  return values
}

function advanceUntil(source: ManualClockSource, predicate: () => boolean, cap = 6000) {
  for (let i = 0; i < cap; i++) {
    if (predicate()) return
    source.advance(COMBAT_STEP_SECONDS)
  }
  throw new Error('predicate not reached')
}

describe('plan-lane Kiem The parity (production scheduler lane)', () => {
  it('three landed swords carry 1.0 / 1+rate / 1+2*rate through the REAL plan cast', () => {
    const player = nguPlayer()
    player.swordPath!.kiemDaoCount = 3
    player.swordPath!.kiemDaoBase = 2
    const { gameManager, clock } = makeManager(player)
    const values = collectDamage(gameManager)

    // Deterministic lane: every roll lands, no crits inflate ratios.
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    gameManager.turnBattleOps.startBattleWithPlayer(player, dummyEnemy())
    advanceUntil(clock, () => values.length >= 3)
    vi.restoreAllMocks()

    const [first, second, third] = values as [number, number, number]
    expect(first).toBeGreaterThan(0)
    expect(second / first).toBeCloseTo(1 + LIEN_MOMENTUM_RATE, 1)
    expect(third / first).toBeCloseTo(1 + 2 * LIEN_MOMENTUM_RATE, 1)
    // Plan lane must not double-apply: if BOTH the declarative each and
    // the engine-lane closure fired, second/first would be ~(1+rate)^2.
    expect(second / first).toBeLessThan(Math.pow(1 + LIEN_MOMENTUM_RATE, 2) - 0.01)
  })

  it('a mid-cast enemy death drops remaining swords - no phantom hits on the dead target', () => {
    const player = nguPlayer()
    player.swordPath!.kiemDaoCount = 4
    player.swordPath!.kiemDaoBase = 200
    const { gameManager, clock } = makeManager(player)
    const values = collectDamage(gameManager)

    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    // Tiny hp: sword 1 kills, swords 2-4 must never fire on the corpse.
    gameManager.turnBattleOps.startBattleWithPlayer(player, dummyEnemy(10))
    advanceUntil(clock, () => {
      const battle = gameManager.getTurnBattle()
      return battle === null || battle.state === 'victory' || battle.state === 'defeat' || values.length >= 4
    })
    vi.restoreAllMocks()

    // Strictly fewer hits than the 4-sword cast - the kill ended the
    // cast early instead of phantom hits firing on a dead target.
    expect(values.length).toBeLessThan(4)
    expect(values.length).toBeGreaterThanOrEqual(1)
  })

  it('kiemY banks +1 per resolved cast at battle level (forgeCost above beta reach, no auto-forge)', () => {
    // Below the realm cap (foundation realmIndex 2 => cap 3): at cap
    // the spec'd early return would correctly bank nothing.
    const player = nguPlayer('foundation_establishment')
    player.swordPath!.kiemDaoCount = 2
    const { gameManager, clock } = makeManager(player)
    const values = collectDamage(gameManager)
    const before = player.swordPath!.kiemY
    const countBefore = player.swordPath!.kiemDaoCount

    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    gameManager.turnBattleOps.startBattleWithPlayer(player, dummyEnemy())
    advanceUntil(clock, () => values.length >= 2)
    vi.restoreAllMocks()

    // One resolved cast => +1 Kiem Y; forgeCost at foundation is far
    // above 1 so no conversion happened.
    expect(player.swordPath!.kiemY).toBe(before + 1)
    expect(player.swordPath!.kiemDaoCount).toBe(countBefore)
  })
})
