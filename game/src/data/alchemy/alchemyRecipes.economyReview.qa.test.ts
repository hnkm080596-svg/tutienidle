// QA pin for 2026-10-04 economy-review tunes.
// Guards the deliberate per-recipe retirement of alchemy_hoi_linh_dan_mortal:
// mp_regen cannot land while maxMp/manaRegenPerTurn stay 0 at mortal
// (spell-domain stats unlock with the qi_refining spell path), so the
// recipe is a dead craft. Retired keeps the row resolvable - save-compat
// for dormant jobs and the grotto herb base's pillRecipeId reference -
// while the craft gate rejects new jobs and the panel hides it.
import { describe, expect, it } from 'vitest'

import { alchemyRecipes } from './alchemyRecipes'

describe('economy-review alchemy tune - mortal mp_regen recipe retirement', () => {
  it('retires alchemy_hoi_linh_dan_mortal but keeps the row resolvable', () => {
    const recipe = alchemyRecipes.find((r) => r.id === 'alchemy_hoi_linh_dan_mortal')
    expect(recipe).toBeDefined()
    expect(recipe!.retired).toBe(true)
    // Herb variants stay intact: hoi_linh_thao_mortal_* materials and the
    // grotto pool still resolve against this recipe id.
    expect(recipe!.herbVariants.length).toBeGreaterThan(0)
  })

  it('keeps the hoi_linh_dan family live at every other realm', () => {
    const family = alchemyRecipes.filter((r) => r.pillId.startsWith('hoi_linh_dan_'))
    expect(family.length).toBeGreaterThan(1)
    for (const recipe of family) {
      if (recipe.realmId === 'mortal') {
        expect(recipe.retired).toBe(true)
      } else {
        expect(recipe.retired).not.toBe(true)
      }
    }
  })

  it('leaves other mortal recipes craftable', () => {
    const mortal = alchemyRecipes.filter(
      (r) => r.realmId === 'mortal' && r.retired !== true,
    )
    const ids = mortal.map((r) => r.id)
    expect(ids).toContain('alchemy_tu_linh_dan_mortal')
    expect(ids).toContain('alchemy_khai_linh_dan_mortal')
  })
})
