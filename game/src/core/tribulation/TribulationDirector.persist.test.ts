// F-W-5 (v82) - the tribulation runtime persists: a committed-but-
// undrained outcome + the retry cooldown serialize into the save
// slice and restore into a fresh director. A settled-but-undrained
// receipt re-presents after reload (receipt-slot dedup keeps the
// restored record from double-applying). An ONGOING run is not
// persisted by design - reload mid-run loses the run.
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../stores/player'
import { GameManager } from '../game/GameManager'
import { TribulationOutcomeService } from './TribulationOutcomeService'
import { asBaseStats } from '../stats/StatBlock'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { SKILLS } from '../../data/skill/Skills'
import { pills } from '../../data/pill/pills'
import { MERIDIANS } from '../../data/realm/Meridians'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

function driveToTerminal(gameManager: GameManager, answerCorrectly = true) {
  let guard = 0
  while (gameManager.tribulationDirector.getState()?.state === 'ongoing' && guard++ < 5000) {
    gameManager.tickOps.update(1)
    const q = gameManager.tribulationDirector.getState()!.currentQuestion
    if (answerCorrectly && q) {
      gameManager.tribulationDirector.answerQuestion(q.correctAnswerIndex)
    }
  }
}

function surviveFoundationTribulation(player: ReturnType<typeof usePlayerStore>) {
  player.realmId = 'qi_refining'
  player.realmLevel = 12
  // F-W-8 - the single admission authority (level + chapter-final
  // clear) gates startTribulation: tests must satisfy it like the UI.
  player.completedStageIds = ['qi_refining_abyssal_pool']
  player.baseStats = asBaseStats({ ...player.baseStats, maxHp: 5_000_000, defense: 50_000, hpRegenPerTurn: 0 })
}

function setupManager() {
  const gameManager = new GameManager()
  const player = usePlayerStore()
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
  gameManager.catalogOps.registerPills(pills)
  player.selectedTalentIds = ['pham_cot']
  player.realmLevel = 12
  player.bodyProgression.body_refinement.completedTiers = 6
  player.physiqueGrade = 'bao'
  player.mortalPerfectionAchieved = true
  player.baseStats = { ...player.baseStats, strength: 10, dexterity: 10, intelligence: 10, attunement: 10, vitality: 10 }
  gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', player.$state)
  player.realmLevel = 18
  player.baseStats = { ...player.baseStats, strength: 30, dexterity: 30, intelligence: 30, attunement: 30, vitality: 30 }
  player.bodyProgression.meridian.openedIds = MERIDIANS.map((m) => m.id)
  gameManager.pillBag.add(gameManager.pillRegistry.get('truc_co_dan')!, 1)
  return { gameManager, player }
}

describe('TribulationDirector — v82 runtime persist (F-W-5)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('committed outcome + bound receipt restore on a fresh director; settle never double-applies', () => {
    const { gameManager, player } = setupManager()
    surviveFoundationTribulation(player)

    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(true)
    driveToTerminal(gameManager)

    const committed = gameManager.tribulationDirector.getCommittedOutcome()!
    const service = new TribulationOutcomeService()
    const receipt = service.settleOutcome(player, gameManager, gameManager.tribulationDirector)
    expect(committed.receipt).toBe(receipt)

    // Serialize -> JSON round-trip (same detach the save writer runs).
    const slice = JSON.parse(
      JSON.stringify(gameManager.tribulationDirector.serializeRuntime()),
    )

    // Fresh boot: a second director restores the slice.
    const restored = new GameManager()
    restored.tribulationDirector.restoreRuntime(slice)

    const restoredOutcome = restored.tribulationDirector.getCommittedOutcome()!
    expect(restoredOutcome.attemptId).toBe(committed.attemptId)
    expect(restoredOutcome.outcome).toBe('victory')
    expect(restoredOutcome.targetRealmId).toBe('foundation_establishment')
    expect(restoredOutcome.grade).toBe(committed.grade)
    expect(restoredOutcome.settlementError).toBeNull()

    // The settled receipt re-presents after reload.
    expect(restoredOutcome.receipt).toEqual(committed.receipt)

    // Dedup: settling the restored record returns the bound receipt -
    // consequences never apply a second time.
    const rebound = new TribulationOutcomeService()
    const reReceipt = rebound.settleOutcome(player, restored, restored.tribulationDirector)
    expect(reReceipt).toBe(restoredOutcome.receipt)
    expect(reReceipt!.kind).toBe(receipt!.kind)
  })

  it('cooldownUntil restores; a fresh director still refuses entry on cooldown', () => {
    const { gameManager, player } = setupManager()
    surviveFoundationTribulation(player)

    // Defeat run (weak tank + no answers) arms the 5-minute cooldown.
    player.realmId = 'qi_refining'
    player.completedStageIds = ['qi_refining_abyssal_pool']
    player.baseStats = asBaseStats({ ...player.baseStats, maxHp: 1, defense: 0, hpRegenPerTurn: 0 })
    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(true)
    driveToTerminal(gameManager, false)
    expect(gameManager.tribulationDirector.getCooldownSeconds()).toBeGreaterThan(0)

    const slice = JSON.parse(
      JSON.stringify(gameManager.tribulationDirector.serializeRuntime()),
    )
    expect(slice.cooldownUntil).toBeGreaterThan(0)

    const restored = new GameManager()
    restored.tribulationDirector.restoreRuntime(slice)
    expect(restored.tribulationDirector.getCooldownSeconds()).toBeGreaterThan(0)

    // Defeat also commits an outcome - it round-trips too.
    expect(restored.tribulationDirector.getCommittedOutcome()?.outcome).toBe('defeat')
  })

  it('an ongoing run serializes nothing - reload mid-run loses the run by design', () => {
    const { gameManager, player } = setupManager()
    surviveFoundationTribulation(player)

    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(true)
    expect(gameManager.tribulationDirector.getState()?.state).toBe('ongoing')

    const slice = gameManager.tribulationDirector.serializeRuntime()
    expect(slice.committedOutcome).toBeUndefined()
    expect(slice.cooldownUntil).toBeUndefined()

    const restored = new GameManager()
    restored.tribulationDirector.restoreRuntime(slice)
    expect(restored.tribulationDirector.getCommittedOutcome()).toBeNull()
    expect(restored.tribulationDirector.getState()).toBeNull()
  })

  it('settlementError persists as a boolean marker and restores the terminal-after-first-attempt record', () => {
    const { gameManager, player } = setupManager()
    surviveFoundationTribulation(player)

    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(true)
    driveToTerminal(gameManager)

    // Forge the error state: the committed outcome carries an Error
    // object in production; only its presence persists.
    const committed = gameManager.tribulationDirector.getCommittedOutcome()!
    committed.settlementError = new Error('boom')

    const slice = JSON.parse(
      JSON.stringify(gameManager.tribulationDirector.serializeRuntime()),
    )
    expect(slice.committedOutcome.settlementError).toBe(true)

    const restored = new GameManager()
    restored.tribulationDirector.restoreRuntime(slice)
    const restoredOutcome = restored.tribulationDirector.getCommittedOutcome()!
    expect(restoredOutcome.settlementError).toBeInstanceOf(Error)
  })

  it('same-session restore is replacement-complete: a save without the slice clears stale outcome + live run (QA-2026-09-24-01)', () => {
    const { gameManager, player } = setupManager()
    surviveFoundationTribulation(player)

    // Timeline A commits an outcome on THIS director.
    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(true)
    driveToTerminal(gameManager)
    expect(gameManager.tribulationDirector.getCommittedOutcome()).not.toBeNull()

    // A same-session load whose save carries no tribulation slice must
    // not let timeline A's outcome survive: it would re-present, soft-
    // lock start(), and re-run settlement onto a save that never earned
    // it (receipt slot re-binds before dedup can fire).
    gameManager.tribulationDirector.restoreRuntime(undefined)
    expect(gameManager.tribulationDirector.getCommittedOutcome()).toBeNull()
    expect(gameManager.tribulationDirector.getState()).toBeNull()

    // An ONGOING run on the old timeline also dies with the load - the
    // director must not keep ticking against the restored player and
    // overwrite a legit commit later.
    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(true)
    expect(gameManager.tribulationDirector.getState()?.state).toBe('ongoing')
    gameManager.tribulationDirector.restoreRuntime(undefined)
    expect(gameManager.tribulationDirector.getState()).toBeNull()
    expect(gameManager.tribulationDirector.getCommittedOutcome()).toBeNull()
    expect(gameManager.tribulationDirector.getCooldownSeconds()).toBe(0)

    // And the restored director accepts a fresh run on the new timeline.
    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(true)
  })
})
