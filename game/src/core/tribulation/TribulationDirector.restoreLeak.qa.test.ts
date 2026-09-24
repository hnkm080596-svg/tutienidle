// QA EVIDENCE (adversarial P4, BETA-SEAM-REPAIR review) - reproduce the
// restoreRuntime replacement gap on a LIVE director:
//
//   (1) committed-but-undrained outcome leaks forward: loading a save
//       WITHOUT a committedOutcome must clear the director's committed
//       record (restore = replacement, ARCH-001). Today it survives ->
//       the stale receipt re-presents and, when its receipt slot is
//       still unbound, settleOutcome applies the OLD timeline's
//       consequences (realm bump + entitlement + kiep debuff) onto a
//       save that never earned them.
//   (2) an ONGOING run survives restore: the director's live battle
//       state is never reset, contradicting the documented contract
//       "an ONGOING run is not persisted - reload mid-run loses the
//       run" (TribulationDirector.persist.test.ts). Same-session load
//       keeps the old battle + its captured player reference alive.
//
// Both assertions FAIL against bc80ffef: restoreRuntime only touches
// cooldownUntil + committedOutcome (and committedOutcome only when the
// incoming slice carries one).
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../stores/player'
import { GameManager } from '../game/GameManager'
import { asBaseStats } from '../stats/StatBlock'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { SKILLS } from '../../data/skill/Skills'
import { pills } from '../../data/pill/pills'
import { MERIDIANS } from '../../data/realm/Meridians'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

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
  player.baseStats = { ...player.baseStats, strength: 10, dexterity: 10, intelligence: 10, attunement: 10, vitality: 10 }
  gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', player.$state)
  player.realmLevel = 18
  player.bodyProgression.meridian.openedIds = MERIDIANS.map((m) => m.id)
  gameManager.pillBag.add(gameManager.pillRegistry.get('truc_co_dan')!, 1)
  return { gameManager, player }
}

function surviveFoundationTribulation(player: ReturnType<typeof usePlayerStore>) {
  player.realmId = 'qi_refining'
  player.realmLevel = 12
  player.completedStageIds = ['qi_refining_abyssal_pool']
  player.baseStats = asBaseStats({ ...player.baseStats, maxHp: 5_000_000, defense: 50_000, hpRegenPerTurn: 0 })
}

describe('TribulationDirector - restoreRuntime replacement leak (QA evidence)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('a committed outcome from another timeline survives restoring a save without one', () => {
    const { gameManager } = setupManager()
    const director = gameManager.tribulationDirector

    // Timeline A: an outcome was committed (undrained, unbound receipt).
    director.restoreRuntime({
      committedOutcome: {
        attemptId: 7,
        outcome: 'victory',
        targetRealmId: 'foundation_establishment',
        grade: 'heaven',
        breakthroughType: 'normal',
        receipt: null,
        settlementError: false,
      },
      cooldownUntil: 1_700_000_000_000,
    })
    expect(director.getCommittedOutcome()).not.toBeNull()

    // Timeline B: loadGame applies an older save whose tribulation
    // slice carried NO committed outcome (and no cooldown).
    director.restoreRuntime({})

    // Replacement contract: the committed record must be gone. FAILS -
    // the stale outcome persists, re-presents, and (receipt: null)
    // re-runs resolveVictory onto the restored player.
    expect(director.getCommittedOutcome()).toBeNull()
    expect(director.getCooldownSeconds()).toBe(0)
  })

  it('an ongoing run survives a mid-run save load instead of being lost', () => {
    const { gameManager, player } = setupManager()
    surviveFoundationTribulation(player)
    const director = gameManager.tribulationDirector

    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(true)
    expect(director.getState()?.state).toBe('ongoing')

    // Mid-run load of a save with no tribulation slice at all.
    director.restoreRuntime(undefined)

    // Documented intent: reload mid-run LOSES the run. FAILS - the
    // battle state is never cleared; the old run (and its captured
    // player reference) keeps ticking on the restored save.
    expect(director.getState()).toBeNull()
  })
})
