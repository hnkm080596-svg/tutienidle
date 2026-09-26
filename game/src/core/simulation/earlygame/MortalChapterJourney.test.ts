// M-C (decision D5) - MortalChapterJourney: the committed regression
// contract for the Mortal chapter. One suite owns the canonical
// creation -> qi_refining progression narrative as journey legs, all
// driven through EarlyGameSession production seams (never direct
// player grants). Boundary legs assert rejected actions leave state
// untouched; the checkpoint leg rides the real build/restore save path.
// Replaces the TEMPORARY M0LoopProbe (deleted in this mission).
//
// Wall note: mortal_dong_5 stays a characterized balance wall
// (post-P7-M3 power loss, compensation owned by the balance phase) -
// legs never assert floor-5+ victories.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { EarlyGameSession, type EarlyGameSnapshot } from './EarlyGameSession'
import { usePlayerStore } from '../../../stores/player'
import { buildGameSave } from '../../../services/save/SaveSystem'
import { getRequiredCultivation } from '../../realm/realmSystem'

const PINNED = {
  name: 'journey',
  talentIds: ['hap_linh'], // combat passive - no cultivation/insight/economy subsidy
  mortalBasicSkillId: 'tram',
}

function makeSession(seed = 11): EarlyGameSession {
  return new EarlyGameSession({ seed, profile: PINNED })
}

function grindToBreakthrough(s: EarlyGameSession): boolean {
  const req = getRequiredCultivation(s.player.realmId, s.player.realmLevel)
  s.cultivate(req / s.player.cultivationPerSecond + 1)
  return s.breakthroughIfReady()
}

function grindToLevel(s: EarlyGameSession, level: number): void {
  while (s.player.realmLevel < level) {
    expect(grindToBreakthrough(s)).toBe(true)
  }
}

/** The combat-economy happy path: floor 1 defeat -> grind -> victory -> floor 2. */
function clearFloorsOneAndTwo(s: EarlyGameSession): void {
  let attempts = 0
  while (s.runStage('mortal_dong_1') !== 'victory' && attempts < 5) {
    expect(grindToBreakthrough(s)).toBe(true)
    attempts++
  }
  expect(s.player.completedStageIds).toContain('mortal_dong_1')

  grindToLevel(s, 14)
  // Post-BETA-CREATION the creation pick grants no stats - base is the
  // 1/1/1/1/1 default, so the earned pool covers BOTH survival (vitality)
  // and damage (strength). strength caps first; the rest goes to vitality,
  // mirroring the canonical loop's spend-until-dry behavior.
  while (s.allocateAttribute('strength')) { /* str to cap */ }
  while (s.allocateAttribute('vitality')) { /* remainder to vit */ }
  expect(s.runStage('mortal_dong_2')).toBe('victory')
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('MortalChapterJourney', () => {
  describe('leg A - combat economy (mortal floors)', () => {
    it('creation -> dong_1 defeat -> grind+allocate -> dong_1+dong_2 victories with loot income', { timeout: 60000 }, () => {
      const s = makeSession()

      expect(s.runStage('mortal_dong_1')).toBe('defeat')
      expect(s.player.completedStageIds).not.toContain('mortal_dong_1')

      clearFloorsOneAndTwo(s)

      expect(s.player.completedStageIds).toEqual(
        expect.arrayContaining(['mortal_dong_1', 'mortal_dong_2']),
      )
      // Combat income actually landed: insight earned and drops in the bag.
      expect(s.player.skillInsight).toBeGreaterThan(0)
      expect(s.gameManager.materialBag.getAll().length).toBeGreaterThan(0)

      // Gear loop (spec Leg A pin): mortal families drop equipment
      // (base_kiem + equipment_any weights); the equip seam must land
      // at least one item from combat-earned drops.
      expect(s.equipAll()).toBeGreaterThan(0)
    })
  })

  describe('leg B - cultivation spine (tribulation -> ritual)', () => {
    it('grind to mortal:12 -> Quan Khi victory -> ritual commits path/way/realm', { timeout: 60000 }, () => {
      const s = makeSession()

      grindToLevel(s, 12)

      expect(s.runTribulation('qi_refining')).toBe('victory')
      expect(s.performRitual('sword', 'sword_pathway')).toBe(true)

      expect(s.player.realmId).toBe('qi_refining')
      expect(s.player.realmLevel).toBe(1)
      expect(s.player.cultivationPath).toBe('sword')
      expect(s.player.cultivationWay).toBe('sword_pathway')

      // Production gate (Zones.ts): all 30 floors form ONE linear
      // chain - qi_refining_forest sits behind mortal_dong_10, which
      // the current journey cannot clear (dong_5 wall). Pinned: the
      // ritual does NOT leapfrog the stage chain.
      expect(s.runStage('qi_refining_forest')).toBe('locked')
    })

    it('ritual does NOT require a Quan Khi victory (independence contract)', { timeout: 60000 }, () => {
      // chooseCultivationPath gates on realm+level+valid pair only -
      // it never reads a tribulation outcome. If a future change makes
      // initiation secretly depend on Quan Khi, THIS leg fails first.
      const s = makeSession()
      grindToLevel(s, 12)

      expect(s.gameManager.tribulationDirector.getCommittedOutcome()).toBeNull()
      expect(s.performRitual('spell', 'spell_pathway')).toBe(true)

      expect(s.player.realmId).toBe('qi_refining')
      expect(s.player.realmLevel).toBe(1)
      expect(s.player.cultivationPath).toBe('spell')
      expect(s.player.cultivationWay).toBe('spell_pathway')
    })
  })

  describe('leg C - boundary rejects leave state untouched', () => {
    it('every mid-journey reject is atomic and the journey still completes', { timeout: 90000 }, () => {
      const s = makeSession()
      const untouched = () => ({
        realmId: s.player.realmId,
        realmLevel: s.player.realmLevel,
        cultivation: s.player.cultivation,
        cultivationPath: s.player.cultivationPath ?? null,
        cultivationWay: s.player.cultivationWay ?? null,
        completedStageIds: [...s.player.completedStageIds],
        nodeLevels: { ...s.player.nodeLevels },
        attributePoints: s.player.attributePoints,
        bodyProgression: structuredClone(s.player.bodyProgression),
      })

      // Every reject gets the same before/after byte-equality proof
      // (spec invariant 2) - a regression that mutates ANY captured
      // field on a failed call fails here.
      let before = untouched()

      // Stage realm-gate: floor 2 is locked for a fresh character.
      expect(s.runStage('mortal_dong_2')).toBe('locked')
      expect(untouched()).toEqual(before)
      expect(s.player.realmLevel).toBe(1)

      // Tribulation below the breakthrough gate is refused BEFORE any
      // tribulation state exists (production gate: canTriggerBreakthrough).
      expect(s.runTribulation('qi_refining')).toBe('refused')
      expect(s.gameManager.tribulationDirector.getState()).toBeNull()
      expect(untouched()).toEqual(before)

      // Ritual below CORE_REALM_LEVEL(12): fail-closed, no mutation.
      expect(s.performRitual('sword', 'sword_pathway')).toBe(false)
      expect(untouched()).toEqual(before)

      // Invalid path/way pair: fail-closed, each call proven atomic.
      expect(s.performRitual('sword', 'hidden_spell_pathway')).toBe(false)
      expect(untouched()).toEqual(before)
      expect(s.performRitual('body', 'sword_pathway')).toBe(false)
      expect(untouched()).toEqual(before)

      // Attribute allocation with an empty pool is a no-op reject.
      expect(s.player.attributePoints).toBe(0)
      expect(s.allocateAttribute('strength')).toBe(false)
      expect(untouched()).toEqual(before)

      // Refinement with zero Tinh Hoa invests nothing.
      expect(s.investRefinement()).toBe(0)
      expect(untouched()).toEqual(before)

      // Per-stat cap reject (spec pin): grind accumulates 11 points
      // (1/breakthrough); strength 3->10 spends 7, leaving a live pool
      // - the cap reject must leave the pool unchanged.
      grindToLevel(s, 12)
      while (s.allocateAttribute('strength')) {
        // drain to the mortal cap (10)
      }
      expect(s.player.baseStats.strength).toBe(10)
      expect(s.player.attributePoints).toBeGreaterThan(0)
      before = untouched()
      expect(s.allocateAttribute('strength')).toBe(false)
      expect(untouched()).toEqual(before)

      // The canonical boundary: after the successful ritual, a second
      // ritual attempt is an idempotent reject - a VALID ungated pair
      // still fails on the committed-path gate alone.
      expect(s.runTribulation('qi_refining')).toBe('victory')
      expect(s.performRitual('sword', 'sword_pathway')).toBe(true)
      before = untouched()
      expect(s.performRitual('spell', 'spell_pathway')).toBe(false)
      expect(untouched()).toEqual(before)
      expect(s.player.cultivationPath).toBe('sword')
      expect(s.player.cultivationWay).toBe('sword_pathway')
      expect(s.player.realmId).toBe('qi_refining')
    })
  })

  describe('leg D - save/restore checkpoint mid-journey', () => {
    it('fresh manager+owner restored through restoreGameSession keeps progressing', { timeout: 90000 }, () => {
      const s = makeSession()

      // Drive past the ritual with a node purchase so every persisted
      // journey field is non-trivial.
      clearFloorsOneAndTwo(s)
      grindToLevel(s, 12)
      expect(s.runTribulation('qi_refining')).toBe('victory')
      expect(s.performRitual('sword', 'sword_pathway')).toBe(true)
      const insightBefore = s.player.skillInsight
      expect(s.purchaseNode('thich_can')).toBe(true)
      expect(s.player.skillInsight).toBeLessThan(insightBefore)

      const checkpoint: EarlyGameSnapshot = s.snapshot()

      // Pin wall-clock across build+restore so the offline-progress
      // term is exactly 0 - parity then means byte-level equality, not
      // a timing-dependent tolerance.
      vi.useFakeTimers()
      try {
        vi.setSystemTime(Date.now())
        const save = buildGameSave(s.player, s.gameManager)

        // Production restore semantics: a FRESH catalog-registered
        // GameManager + fresh player owner (new session), restored via
        // the real restoreGameSession() - its bootstrap player is
        // replaced, not merged.
        const resumed = makeSession(99)
        // Fresh player owner: a real Pinia store owned by the TEST -
        // EarlyGameSession.ts stays free of stores/* dependencies and
        // merely wraps restoreGameSession(owner, gm, save).
        const owner = usePlayerStore()
        const result = resumed.restoreCheckpoint(save, owner)
        expect(result.status).toBe('ok')
        expect(resumed.player).toBe(owner.$state)
        expect(resumed.player).not.toBe(s.player)

        const restored = resumed.snapshot()
        // Persisted fields round-trip exactly - including tribulationState:
        // the v82 slice (F-W-5) makes the committed outcome/cooldown real
        // GameSave state, so the restored manager re-presents it instead
        // of losing the run on reload.
        const { tribulationState: _checkpointTrib, ...persistedCheckpoint } = checkpoint
        const { tribulationState: restoredTrib, ...persistedRestored } = restored
        expect(restoredTrib).toEqual(_checkpointTrib)
        expect(persistedRestored).toEqual(persistedCheckpoint)

        // Manager-backed continuation: a stage run proves catalogs,
        // combat pipeline, and restored player state are all live on
        // the fresh manager (cultivation-only would only prove the
        // player slice survived).
        expect(resumed.runStage('mortal_dong_3')).toBe('victory')
        expect(resumed.player.completedStageIds).toContain('mortal_dong_3')
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('leg E - determinism', () => {
    it('same seed reproduces the identical normalized journey snapshot', { timeout: 90000 }, () => {
      const run = () => {
        const s = new EarlyGameSession({ seed: 7, profile: PINNED })
        s.runStage('mortal_dong_1')
        grindToBreakthrough(s)
        s.runStage('mortal_dong_1')
        grindToLevel(s, 12)
        s.runTribulation('qi_refining')
        s.performRitual('sword', 'sword_pathway')
        return s.snapshot()
      }
      expect(run()).toEqual(run())
    })
  })
})
