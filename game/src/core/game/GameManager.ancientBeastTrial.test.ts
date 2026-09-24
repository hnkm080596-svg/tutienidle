// Pin tests (design 2026-09-23 sec.9, master spec sec.8.2) - the
// Ancient Beast trial end-to-end through GameManagerTurnBattleOps:
// the per-cycle seam covers BOTH manual startStage AND repeat cycles,
// the beast replaces the WHOLE stage battle as a settlement-isolated
// 'fresh' cycle, and surviving survivalRounds canonical rounds
// completes the mortal hidden body (+10pp cap via the completed count).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { GameManager } from './GameManager'
import { COMBAT_STEP_SECONDS, ManualClockSource } from '../battle/turn/CombatClock'
import { defineEnemy } from '../enemy/Enemy'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import { asBaseStats } from '../stats/StatBlock'
import type { Stage } from '../stage/Stage'
import { materials } from '../../data/materials/materials'
import { pills } from '../../data/pill/pills'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { SKILL_CORE_NODES } from '../../data/progression/SkillCoreNodes'
import { BODY_REFINEMENT_TIERS } from '../../data/realm/BodyRefinement'
import {
  ANCIENT_BEAST_ENEMY_ID,
  ANCIENT_BEAST_SURVIVAL_ROUNDS,
} from '../realm/hidden/AncientBeastTrial'

function makeManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerPills(pills)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  manager.catalogOps.registerBuildings(buildings)
  manager.catalogOps.registerSkillTemplates(SKILLS)
  manager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  manager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
  return manager
}

function mortalEligiblePlayer(): PlayerData {
  const base = createDefaultPlayer()
  return {
    ...base,
    realmId: 'mortal',
    // Tanky enough that the beast cannot kill inside the trial window:
    // survival is the trial's own win condition, not the fight's.
    baseStats: asBaseStats({ ...base.baseStats, might: 5, vitality: 50_000, speed: 100 }),
    bodyProgression: {
      ...base.bodyProgression,
      body_refinement: {
        completedTiers: BODY_REFINEMENT_TIERS.length,
        currentTierProgress: 0,
      },
    },
  }
}

function registerFixtureStage(manager: GameManager): Stage {
  const enemy = defineEnemy({
    id: 'fixture_dummy',
    name: 'Fixture Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp: 10,
      might: 0,
      attackSpeed: 1,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
    },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })
  const stage: Stage = {
    id: 'fixture_stage',
    name: 'fixture_stage',
    description: '',
    floor: 1,
    enemyPool: [{ enemyId: 'fixture_dummy', weight: 1 }],
    totalEnemyCount: 1,
    waves: [1],
    spawnIntervalSeconds: 0,
  }
  manager.catalogOps.registerEnemyTemplates([enemy])
  manager.catalogOps.registerStages([stage])
  return stage
}

function driveUntilTerminal(
  manager: GameManager,
  combatSource: ManualClockSource,
  maxSteps = 20_000,
): void {
  for (let i = 0; i < maxSteps; i += 1) {
    const state = manager.turnBattleOps.getTurnBattle()?.state
    if (state === 'victory' || state === 'defeat' || state === undefined) {
      return
    }
    combatSource.advance(COMBAT_STEP_SECONDS)
  }
}

describe('ancient beast trial - GameManager integration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('a fired roll replaces the stage battle with the undefeatable beast and arms the watcher', () => {
    setActivePinia(createPinia())
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const gameManager = makeManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    const player = mortalEligiblePlayer()
    const stage = registerFixtureStage(gameManager)
    gameManager.setActivePlayer(player)

    expect(gameManager.turnBattleOps.startStage(player, stage, false)).toBe(true)

    const battle = gameManager.turnBattleOps.getTurnBattle()
    expect(battle).not.toBeNull()
    expect(battle!.enemies[0]?.entity.templateId).toBe('co_thu')
    expect(battle!.enemies[0]?.entity.undefeatable).toBe(true)

    expect(gameManager.turnBattleOps.getActiveHiddenTrial()).toMatchObject({
      survivalRounds: ANCIENT_BEAST_SURVIVAL_ROUNDS,
    })
    // Discovery IS the fired event (sec.8.2): the record exists with the
    // counters stamped even before the first round resolves.
    const record = player.hiddenPerfection.realms['mortal']
    expect(record?.discovered).toBe(true)
    expect(record?.bodyCompleted).toBe(false)
  })

  it('surviving the required rounds completes the hidden body; the stage grants nothing', () => {
    setActivePinia(createPinia())
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const gameManager = makeManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    const player = mortalEligiblePlayer()
    const stage = registerFixtureStage(gameManager)
    gameManager.setActivePlayer(player)

    gameManager.turnBattleOps.startStage(player, stage, false)
    driveUntilTerminal(gameManager, combatSource)

    const battle = gameManager.turnBattleOps.getTurnBattle()
    expect(battle?.state).toBe('victory')
    expect((battle?.roundsElapsed ?? 0) >= ANCIENT_BEAST_SURVIVAL_ROUNDS).toBe(true)

    // sec.9.5: survival IS the completion - bodyCompleted + completed list.
    const record = player.hiddenPerfection.realms['mortal']
    expect(record?.bodyCompleted).toBe(true)
    expect(player.hiddenPerfection.completedHiddenBodyRealmIds).toContain('mortal')

    // sec.9.4 settlement isolation: no stage completion, no kill credit
    // (the beast is undefeatable and still alive at the terminal).
    expect(player.completedStageIds).toEqual([])
    expect(battle!.enemies[0]?.entity.alive).toBe(true)
    expect(gameManager.turnBattleOps.getActiveHiddenTrial()).toBeNull()
  })

  it('a repeat-intent start resumes the interrupted stage loop after the trial', () => {
    setActivePinia(createPinia())
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)

    const gameManager = makeManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    const player = mortalEligiblePlayer()
    const stage = registerFixtureStage(gameManager)
    gameManager.setActivePlayer(player)

    gameManager.turnBattleOps.startStage(player, stage, true)

    // The resume re-enters startStage INSIDE the same settlement as the
    // trial victory - drive until the hidden body completes, then the
    // live battle is already the resumed one.
    for (let i = 0; i < 20_000 && player.hiddenPerfection.realms['mortal']?.bodyCompleted !== true; i += 1) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }
    expect(player.hiddenPerfection.realms['mortal']?.bodyCompleted).toBe(true)

    // The trial stole ONE cycle (sec.9.3): the resumed battle is the
    // normal stage fight again (rolls cease post-completion, so no
    // second trial fires even with the roll still primed low). Enemies
    // spawn once the wave runs - advance until the first spawn lands.
    let resumed = gameManager.turnBattleOps.getTurnBattle()
    for (let i = 0; i < 2_000 && (resumed?.enemies[0] === undefined); i += 1) {
      combatSource.advance(COMBAT_STEP_SECONDS)
      resumed = gameManager.turnBattleOps.getTurnBattle()
    }
    expect(resumed?.state === 'intro' || resumed?.state === 'countdown' || resumed?.state === 'fighting').toBe(true)
    expect(gameManager.turnBattleOps.getActiveHiddenTrial()).toBeNull()
    expect(resumed!.enemies[0]?.entity.templateId).toBe('fixture_dummy')
  })

  it('INT-1: a refused start resolves nothing - no roll, no discovery, the live battle untouched', () => {
    setActivePinia(createPinia())
    vi.spyOn(Math, 'random').mockReturnValue(0) // primed: a resolve WOULD fire

    const gameManager = makeManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    const player = mortalEligiblePlayer()
    const stage = registerFixtureStage(gameManager)
    gameManager.setActivePlayer(player)

    // Case A - locked stage: requiredRealmId above the mortal player.
    const lockedStage: Stage = {
      ...stage,
      id: 'fixture_stage_locked',
      requiredRealmId: 'qi_refining',
    }
    gameManager.catalogOps.registerStages([lockedStage])

    expect(gameManager.turnBattleOps.startStage(player, lockedStage, false)).toBe(false)
    // The resolver never ran: discovery is stamped by the runner on a
    // fired plan, and a refused start must not even roll.
    expect(player.hiddenPerfection.realms['mortal']).toBeUndefined()
    expect(gameManager.turnBattleOps.getTurnBattle()).toBeNull()

    // Case B - slot already held by a live stage run: a second
    // startStage is refused, the resolver stays unconsulted, and the
    // running battle survives untouched.
    const runningStage: Stage = { ...stage, id: 'fixture_stage_running' }
    gameManager.catalogOps.registerStages([runningStage])
    vi.spyOn(Math, 'random').mockReturnValue(1) // roll high: normal launch
    expect(gameManager.turnBattleOps.startStage(player, runningStage, false)).toBe(true)
    const liveBattle = gameManager.turnBattleOps.getTurnBattle()
    expect(liveBattle).not.toBeNull()

    vi.spyOn(Math, 'random').mockReturnValue(0) // re-prime: WOULD fire
    const otherStage: Stage = { ...stage, id: 'fixture_stage_other' }
    gameManager.catalogOps.registerStages([otherStage])
    expect(gameManager.turnBattleOps.startStage(player, otherStage, false)).toBe(false)

    expect(player.hiddenPerfection.realms['mortal']).toBeUndefined()
    expect(gameManager.turnBattleOps.getTurnBattle()).toBe(liveBattle)
    expect(liveBattle!.state).not.toBe('victory')
    expect(liveBattle!.state).not.toBe('defeat')
  })

  it('INT-2: the trial teardown despawns the immortal beast from EnemyManager', () => {
    setActivePinia(createPinia())
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const gameManager = makeManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    const player = mortalEligiblePlayer()
    const stage = registerFixtureStage(gameManager)
    gameManager.setActivePlayer(player)

    gameManager.turnBattleOps.startStage(player, stage, false)
    const beastEntityId = gameManager.turnBattleOps
      .getTurnBattle()!
      .enemies[0]!.entity.id
    expect(gameManager.enemyManager.get(beastEntityId)).toBeDefined()

    driveUntilTerminal(gameManager, combatSource)
    expect(player.hiddenPerfection.realms['mortal']?.bodyCompleted).toBe(true)

    // The beast never died (undefeatable) yet the registry released it
    // at the trial's own teardown - no phantom live entity.
    expect(gameManager.enemyManager.get(beastEntityId)).toBeUndefined()
    expect(
      gameManager.enemyManager
        .getAll()
        .some((enemy) => enemy.id === ANCIENT_BEAST_ENEMY_ID || enemy.id === beastEntityId),
    ).toBe(false)
  })
})
