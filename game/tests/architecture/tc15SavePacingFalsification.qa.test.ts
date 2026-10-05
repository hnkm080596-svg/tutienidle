// TC15 blind terminal falsification (pin af3666e) - probes for
// unproducible-state claims admitted by the save boundary. Each test
// asserts the SECURE expectation: an incoherent progression claim that
// no authored writer could produce must be rejected by
// validateGameSaveShape / assertBodyProgressionIntegrity, and must
// never mint modifiers or base-stat deltas at restore.
//
// Findings recorded in docs/qa/runs/qa-fixpoint-master/evidence/.
// ASCII comments only.

import { describe, expect, it } from 'vitest'

import { TECHNIQUES } from '@/data/technique/Techniques'
import { PHAP_TU_SKILLS } from '@/data/skill/PhapTuSkills'
import { SPELL_KIT_IDS } from '@/data/skill/Skills'
import { MERIDIANS } from '@/data/realm/Meridians'
import { createDefaultPlayer } from '@/core/player/Player'
import {
  assertBodyProgressionIntegrity,
  collectBodyBaseStatDeltas,
} from '@/core/realm/body/BodyProgressionSystem'
import { withMortalCreationPick } from '@/services/save/GameSave.fixture'
import { validateGameSaveShape } from '@/services/save/saveShapeValidation'
import { CURRENT_SAVE_VERSION } from '@/services/save/SaveSystem'
import type { GameSave } from '@/services/save/saveTypes'

function mortalSave(): GameSave {
  const save: GameSave = {
    version: CURRENT_SAVE_VERSION,
    player: createDefaultPlayer(),
    techniques: [],
    skills: [],
    materials: [],
    equipment: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    equipmentSlots: [],
  }
  return withMortalCreationPick(save)
}

function qiRefiningSave(): GameSave {
  const save = mortalSave()
  save.player = {
    ...createDefaultPlayer(),
    realmId: 'qi_refining',
    realmLevel: 1,
    cultivationPath: 'spell',
    cultivationWay: 'spell_pathway',
    spellPath: { element: 'fire' },
    nodeLevels: { hoa_linh_ngo: 1, core_hoa_cau_thuat: 1 },
    purchasedNodeIds: ['hoa_linh_ngo', 'core_hoa_cau_thuat'],
    breakthroughGrade: 1,
    mortalBasicSkillId: undefined,
  }
  save.techniques = [structuredClone(TECHNIQUES.find((t) => t.id === 'five_elements_art')!)]
  save.skills = [structuredClone(PHAP_TU_SKILLS.find((s) => s.id === SPELL_KIT_IDS.fire[0])!)]
  return save
}

// C2C-64 prerequisite: meridian chapter progression requires the
// body_refinement chapter complete. A legal post-mortal profile has
// completedTiers=6 with the derived 'bao' physique grade.
function withCompletedRefinement(player: GameSave['player']) {
  player.bodyProgression.body_refinement.completedTiers = 6
  player.bodyProgression.body_refinement.currentTierProgress = 0
  player.physiqueGrade = 'bao'
}

// ------------------------------------------------------------------
// F-TC15-MERIDIAN-PACING: invest() paces meridian opens inside the
// page realm - at qi_refining level L only meridians with
// requiredRealmLevel <= L can open (Meridians.ts requires 2..16).
// integrityIssues replays strict-prefix + page-lock (M-E D2) and the
// chapter prerequisite, but NOT the in-page realmLevel pacing, so a
// save claiming all 8 opened meridians at qi_refining realmLevel 1 is
// an unproducible claim the boundary accepts; applyAllBodyModifiers
// then mints bat-mach:* percent modifiers (stats in visible beta play).
// SECURE expectation: rejection.
// ------------------------------------------------------------------
describe('F-TC15-MERIDIAN-PACING', () => {
  it('rejects all-8 opened meridians at qi_refining realmLevel 1', () => {
    const save = qiRefiningSave()
    withCompletedRefinement(save.player)
    save.player.bodyProgression.meridian.openedIds = MERIDIANS.map((m) => m.id)

    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(true)

    expect(() => assertBodyProgressionIntegrity(save.player as never)).toThrow()
  })

  it('sibling: rejects 5 opened meridians at qi_refining realmLevel 8', () => {
    const save = qiRefiningSave()
    save.player.realmLevel = 8
    withCompletedRefinement(save.player)
    // 5th meridian requires realmLevel 10 - unproducible at level 8
    save.player.bodyProgression.meridian.openedIds = MERIDIANS.slice(0, 5).map((m) => m.id)
    expect(() => assertBodyProgressionIntegrity(save.player as never)).toThrow()
  })

  it('control: page-locked openedIds at mortal are rejected today', () => {
    const save = mortalSave()
    withCompletedRefinement(save.player)
    save.player.bodyProgression.meridian.openedIds = MERIDIANS.map((m) => m.id)
    expect(() => assertBodyProgressionIntegrity(save.player as never)).toThrow()
  })

  it('control: producible pacing claim (2 meridians at level 4) is legal', () => {
    const save = qiRefiningSave()
    save.player.realmLevel = 4
    withCompletedRefinement(save.player)
    // nham=2, doi=4 both <= 4 - producible, must NOT throw
    save.player.bodyProgression.meridian.openedIds = ['nham_mach', 'doi_mach']
    expect(() => assertBodyProgressionIntegrity(save.player as never)).not.toThrow()
  })
})

// ------------------------------------------------------------------
// F-TC15-BODYREF-PACING: invest() paces body_refinement tiers inside
// Pham Nhan - tier k requires realmLevel >= requiredRealmLevel
// (2,4,6,8,10,12). A mortal at realmLevel 1 with completedTiers=6 is
// unproducible, yet only completedTiers<=6 / progress<cap /
// physiqueGrade-derivation are replayed. The admitted claim mints
// per-tier base-stat deltas via collectTierBaseStatDeltas at restore.
// SECURE expectation: rejection.
// ------------------------------------------------------------------
describe('F-TC15-BODYREF-PACING', () => {
  it('rejects completedTiers=6 at mortal realmLevel 1', () => {
    const save = mortalSave()
    save.player.bodyProgression.body_refinement.completedTiers = 6
    save.player.bodyProgression.body_refinement.currentTierProgress = 0
    save.player.physiqueGrade = 'bao'

    expect(() => assertBodyProgressionIntegrity(save.player as never)).toThrow()
  })

  it('documents the mint: admitted pacing claim yields base-stat deltas', () => {
    const save = mortalSave()
    save.player.bodyProgression.body_refinement.completedTiers = 6
    save.player.bodyProgression.body_refinement.currentTierProgress = 0
    save.player.physiqueGrade = 'bao'

    const deltas = collectBodyBaseStatDeltas(save.player as never)
    expect(Object.keys(deltas).length).toBeGreaterThan(0)
  })
})
