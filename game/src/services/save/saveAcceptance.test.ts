import { describe, expect, it } from 'vitest'
import { assertSaveAcceptable, isSaveAcceptable, type SaveAcceptanceCatalogs } from './saveAcceptance'
import { createDefaultPlayer } from '../../core/player/Player'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { PHAP_TU_SKILLS } from '../../data/skill/PhapTuSkills'
import { CORE_SKILLS } from '../../data/skill/CoreSkills'
import { SPELL_KIT_IDS } from '../../data/skill/Skills'
import {
  HIDDEN_SPELL_BASIC_ID,
  HIDDEN_SPELL_PASSIVE_ID,
  HIDDEN_SPELL_REQUIRED_SKILLS,
  HIDDEN_SPELL_SPECIAL_ID,
} from '../../core/phap-tu/PhapTuPath'
import { CURRENT_SAVE_VERSION } from './SaveSystem'
import type { GameSave } from './saveTypes'

const catalogs: SaveAcceptanceCatalogs = {
  hasEquipment: () => true,
  hasAffix: () => true,
  hasMaterial: () => true,
  hasPill: () => true,
  hasBuilding: () => true,
  getSiteDefinition: () => undefined,
  hasTechnique: (id) => TECHNIQUES.some((entry) => entry.id === id),
}

function spellPathwaySave(): GameSave {
  const player = {
    ...createDefaultPlayer(),
    realmId: 'qi_refining',
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

// NOVA-5 -- element <-> kit coherence: the element commit grants the
// element basic atomically (resolveAuthoredBasic throws on a missing
// required basic at battle build). A save carrying the axis but not
// the basic loads once then crashes on EVERY battle entry -- the
// acceptance seam must reject it at load.
describe('spell element <-> kit coherence (saveAcceptance)', () => {
  it('element axis without the element basic -> hard reject', () => {
    const save = spellPathwaySave()
    save.player.spellPath.element = 'fire'
    save.skills = []

    expect(() => assertSaveAcceptable(save, catalogs)).toThrow(
      `requires learned basic '${SPELL_KIT_IDS.fire[0]}'`,
    )
    expect(isSaveAcceptable(save, catalogs)).toBe(false)
  })

  it('element axis + the element basic learned -> accepted', () => {
    const save = spellPathwaySave()
    save.player.spellPath.element = 'fire'
    const basic = PHAP_TU_SKILLS.find((skill) => skill.id === SPELL_KIT_IDS.fire[0])
    save.skills = [structuredClone(basic!)]

    expect(() => assertSaveAcceptable(save, catalogs)).not.toThrow()
    expect(isSaveAcceptable(save, catalogs)).toBe(true)
  })

  it('element axis + a WRONG element\'s basic -> reject (the required id is per-element)', () => {
    const save = spellPathwaySave()
    save.player.spellPath.element = 'fire'
    const wrongBasic = PHAP_TU_SKILLS.find((skill) => skill.id === SPELL_KIT_IDS.water[0])
    save.skills = [structuredClone(wrongBasic!)]

    expect(() => assertSaveAcceptable(save, catalogs)).toThrow('coherence')
  })

  it('no element committed (fresh spell_pathway) -> the class stays inert', () => {
    const save = spellPathwaySave()
    save.skills = []

    expect(isSaveAcceptable(save, catalogs)).toBe(true)
  })

  // A corrupt save may carry a non-ElementType string that slipped past
  // shape validation -- the lookup must reject descriptively, never a
  // bare TypeError.
  it('corrupt element string outside ElementType -> descriptive reject, not TypeError', () => {
    const save = spellPathwaySave()
    save.player.spellPath.element = 'shadow' as never
    save.skills = []

    expect(() => assertSaveAcceptable(save, catalogs)).toThrow("unknown element 'shadow'")
    expect(isSaveAcceptable(save, catalogs)).toBe(false)
  })
})

// Sibling axis of the element check above: hidden_spell_pathway owns a
// fixed three-skill kit granted atomically by the ngo_dao ritual
// (assertNgoDaoKitLearned throws at battle build). A corrupt save
// missing a kit member crashes on EVERY battle entry -- reject at load.
describe('hidden_spell_pathway kit coherence (saveAcceptance)', () => {
  function hiddenPathwaySave(): GameSave {
    const save = spellPathwaySave()
    save.player.cultivationWay = 'hidden_spell_pathway'
    save.techniques = [structuredClone(TECHNIQUES.find((entry) => entry.id === 'dao_insight_art')!)]
    return save
  }

  it('hidden pathway missing a kit member -> hard reject', () => {
    const save = hiddenPathwaySave()
    save.skills = []

    expect(() => assertSaveAcceptable(save, catalogs)).toThrow('missing learned skills')
    expect(isSaveAcceptable(save, catalogs)).toBe(false)
  })

  it('hidden pathway missing ONLY the passive -> still reject (all three are required)', () => {
    const save = hiddenPathwaySave()
    const actives = CORE_SKILLS.filter((skill) =>
      [HIDDEN_SPELL_BASIC_ID, HIDDEN_SPELL_SPECIAL_ID].includes(skill.id),
    )
    save.skills = actives.map((skill) => structuredClone(skill))

    expect(() => assertSaveAcceptable(save, catalogs)).toThrow(HIDDEN_SPELL_PASSIVE_ID)
  })

  it('hidden pathway with the full kit -> accepted', () => {
    const save = hiddenPathwaySave()
    const kit = CORE_SKILLS.filter((skill) => HIDDEN_SPELL_REQUIRED_SKILLS.includes(skill.id))
    save.skills = kit.map((skill) => structuredClone(skill))

    expect(isSaveAcceptable(save, catalogs)).toBe(true)
  })
})

// Mutation finding F-MUT-COMPLETION-ENUM (beta-release-2026-09-29): the
// completionState whitelist inside the gradeHistory record-shape check had
// no detector - a mutant dropping it passed because the existing 'bad
// completionState' corpus only ever rejected via keySet. Pin: an otherwise
// canonical record (valid grade key, valid finalRank) whose completionState
// is outside 'partial'|'dai_thanh'|'vien_man' must be rejected on the
// record shape alone.
describe('gradeHistory completionState whitelist (saveAcceptance)', () => {
  it('non-canonical completionState on an otherwise-valid record -> reject', () => {
    const save = spellPathwaySave()
    // foundation_establishment (realmIndex 2) makes grade 1 the lagging
    // live grade -> gradeHistory MUST carry the sealed record {'1'} and
    // nothing else, so the record shape is the only failing leg.
    save.player.realmId = 'foundation_establishment'
    save.techniques = [
      {
        ...structuredClone(TECHNIQUES.find((entry) => entry.id === 'five_elements_art')!),
        grade: 1,
        rank: 0,
        mastery: 0,
        gradeHistory: { '1': { finalRank: 10, completionState: 'bogus' as never } },
      },
    ]

    expect(() => assertSaveAcceptable(save, catalogs)).toThrow(
      'Invalid technique progression state',
    )
    expect(isSaveAcceptable(save, catalogs)).toBe(false)
  })

  it('canonical completionState on the same record -> accepted', () => {
    const save = spellPathwaySave()
    save.player.realmId = 'foundation_establishment'
    save.techniques = [
      {
        ...structuredClone(TECHNIQUES.find((entry) => entry.id === 'five_elements_art')!),
        grade: 1,
        rank: 0,
        mastery: 0,
        gradeHistory: { '1': { finalRank: 10, completionState: 'vien_man' } },
      },
    ]

    expect(isSaveAcceptable(save, catalogs)).toBe(true)
  })
})
