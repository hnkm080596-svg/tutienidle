/**
 * a19 (qa-fixpoint-master) -- element-root witness on persisted node claims.
 *
 * Every element root (PHAP_TU_ELEMENT_ROOT_IDS) is written by exactly one
 * writer: commitFiveElementInitiation, atomically together with
 * cultivationPath/cultivationWay, spellPath.element, the qi_refining
 * realm advance, and the element kit basic. The save boundary replays
 * each node's authored prereqs (node/excludesNode/nodeCount/realm) but
 * never cross-checks an owned root against player.spellPath.element.
 *
 * A crafted MORTAL save claiming an element root passes every replay:
 * the root's only prereqs are excludesNode on the other four roots, the
 * shape layer does not restrict mortal nodeLevels to core_* grants, and
 * the acceptance seam only replays element -> basic when an element is
 * committed. Result: an accepted save where every element's
 * purchasability probe inside commitFiveElementInitiation fails
 * (claimed element: already owned -> false; the other four:
 * excludesNode fail), so the initiation can never commit -- the save
 * loads a permanently bricked progression the writer cannot produce.
 *
 * These tests pin the desired invariant and FAIL on ab0b135.
 */
import { describe, expect, it } from 'vitest'
import { validateGameSaveShape } from '../../src/services/save/saveShapeValidation'
import { isSaveAcceptable, staticSaveAcceptanceCatalogs } from '../../src/services/save/saveAcceptance'
import { createDefaultPlayer } from '../../src/core/player/Player'
import { canPurchaseNode as canPurchaseNodeSystem } from '../../src/core/progression/NodeSystem'
import { PHAP_TU_ELEMENT_ROOT_IDS } from '../../src/data/progression/PhapTuNodes.builders'
import { PROGRESSION_NODE_BY_ID } from '../../src/data/progression/ProgressionNodeCatalog'
import { TECHNIQUES } from '../../src/data/technique/Techniques'
import { PHAP_TU_SKILLS } from '../../src/data/skill/PhapTuSkills'
import { SKILLS } from '../../src/data/skill/Skills'
import { SPELL_KIT_IDS } from '../../src/data/skill/Skills'
import { CURRENT_SAVE_VERSION } from '../../src/services/save/SaveSystem'
import type { GameSave } from '../../src/services/save/saveTypes'

const nodeById = PROGRESSION_NODE_BY_ID

function mortalSave(): GameSave {
  const player = createDefaultPlayer()
  // A legal mortal save carries the creation pick on three channels:
  // mortalBasicSkillId, the learned skill, and the core_<id> grant.
  player.mortalBasicSkillId = 'linh_bao'
  player.nodeLevels = { ...player.nodeLevels, core_linh_bao: 1 }
  player.purchasedNodeIds = [...(player.purchasedNodeIds ?? []), 'core_linh_bao']

  return {
    version: CURRENT_SAVE_VERSION,
    player,
    techniques: [],
    skills: [structuredClone(SKILLS.find((skill) => skill.id === 'linh_bao')!)],
    materials: [],
    equipment: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    equipmentSlots: [],
  }
}

function spellPathwaySave(): GameSave {
  const player = {
    ...createDefaultPlayer(),
    realmId: 'qi_refining',
    breakthroughGrade: 1,
    cultivationPath: 'spell' as const,
    cultivationWay: 'spell_pathway' as const,
  }
  return {
    version: CURRENT_SAVE_VERSION,
    player,
    techniques: [structuredClone(TECHNIQUES.find((entry) => entry.id === 'five_elements_art')!)],
    skills: [],
    materials: [],
    equipment: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    equipmentSlots: [],
  }
}

describe('a19 - forged element-root claims (persisted authority seam)', () => {
  it('a mortal save claiming an element root bricks every initiation probe', () => {
    // Given a crafted save claiming hoa_linh_ngo with element = null.
    const save = mortalSave()
    save.player.nodeLevels = { ...save.player.nodeLevels, hoa_linh_ngo: 1 }
    save.player.purchasedNodeIds = [...(save.player.purchasedNodeIds ?? []), 'hoa_linh_ngo']

    // The brick: every element root probe inside
    // commitFiveElementInitiation -> canPurchaseNodeSystem fails.
    const probe = JSON.parse(JSON.stringify(save.player))
    probe.cultivationPath = 'spell'
    probe.cultivationWay = 'spell_pathway'
    const blocked = Object.values(PHAP_TU_ELEMENT_ROOT_IDS).every(
      (rootId) => !canPurchaseNodeSystem(probe, nodeById.get(rootId)!),
    )
    expect(blocked, 'every element probe is blocked (brick evidence)').toBe(true)

    // The boundary currently accepts it (element root has no writer
    // outside the atomic ritual on an element=null mortal save).
    const shape = validateGameSaveShape(save)
    const acceptable = isSaveAcceptable(save, staticSaveAcceptanceCatalogs())

    // Desired invariant: an unproducible root claim must be rejected at
    // the save boundary, not admitted into a permanently bricked save.
    expect(shape.ok, 'shape accepts a forged element-root claim on a mortal save').toBe(false)
    expect(acceptable, 'acceptance admits a forged element-root claim').toBe(false)
  })

  // A19-2 (committed way + element = null) is a confirmed Low deferred
  // per the Medium+-only attack-surface ruling - it mints no extra
  // capability (getActiveElement fails closed, the kit check stays
  // inert). This witness pins the residual as EXPECTED TO FAIL until
  // the online-authority layer owns the verdict.
  it.fails('a committed spell_pathway save with element = null is unproducible', () => {
    // The ONLY element commit runs inside commitFiveElementInitiation,
    // the ONLY way onto spell_pathway - so every writer-produced
    // spell_pathway save carries element != null. element = null on a
    // committed save mints the way authority (MP pool, technique,
    // starter kit) with no element and can never gain one
    // (selectSpellPathElement refuses realmId != mortal).
    const save = spellPathwaySave()
    save.player.spellPath = { element: null }
    save.skills = [structuredClone(SKILLS.find((skill) => skill.id === 'linh_bao')!)]
    save.player.nodeLevels = { core_linh_bao: 1 }
    save.player.purchasedNodeIds = ['core_linh_bao']

    const shape = validateGameSaveShape(save)
    const acceptable = isSaveAcceptable(save, staticSaveAcceptanceCatalogs())

    expect(shape.ok, 'shape accepts a committed spell_pathway save with element = null').toBe(false)
    expect(acceptable, 'acceptance admits element = null on a committed save').toBe(false)
  })

  it('a committed save claiming an element root for a DIFFERENT element is unproducible', () => {
    // element = fire coherent commit (root + basic present), plus a
    // forged moc_linh_ngo. The moc root excludes hoa_linh_ngo so the
    // pair cannot coexist under the authored prereq replay - sanity
    // check that THIS direction is already sealed (control case).
    const save = spellPathwaySave()
    save.player.spellPath = { element: 'fire' }
    save.skills = [
      structuredClone(SKILLS.find((skill) => skill.id === 'linh_bao')!),
      structuredClone(
        PHAP_TU_SKILLS.find((skill) => skill.id === SPELL_KIT_IDS.fire[0])!,
      ),
    ]
    save.player.nodeLevels = {
      core_linh_bao: 1,
      hoa_linh_ngo: 1,
      moc_linh_ngo: 1,
    }
    save.player.purchasedNodeIds = ['core_linh_bao', 'hoa_linh_ngo', 'moc_linh_ngo']

    expect(validateGameSaveShape(save).ok).toBe(false)
  })
})
