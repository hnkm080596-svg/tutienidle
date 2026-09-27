import { describe, expect, it } from 'vitest'
import { assertSaveAcceptable, isSaveAcceptable, type SaveAcceptanceCatalogs } from './saveAcceptance'
import { createDefaultPlayer } from '../../core/player/Player'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { PHAP_TU_SKILLS } from '../../data/skill/PhapTuSkills'
import { SPELL_KIT_IDS } from '../../data/skill/Skills'
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
