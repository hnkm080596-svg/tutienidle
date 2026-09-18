/**
 * Guard - placeholder-art debt is listed, not discovered.
 *
 * Spec: docs/superpowers/plans/2026-09-19-entity-art-mode-switch.md
 *
 * ENTITY_ART_MODE made per-entity art tiers obsolete: every entity renders
 * the mode's kind, and "has no authored art" means resolving to the shared
 * placeholder of the SAME kind - never a Rectangle, never the other kind.
 * The old tier list (bosses "deserving" animation while enemies stayed
 * static) died with that contract.
 *
 * What remains is the debt itself: registered entities whose art is still
 * the placeholder. `placeholderEntityKeys()` derives the set from the
 * catalogue, so this list is the ratchet - it may shrink without ceremony
 * (ship the art, remove the key); it may not grow without someone editing
 * this file and saying so.
 *
 * NOTE the mode asymmetry: in 'static' mode every registered entity owns a
 * real PNG (the mortal batch, both profile PNGs), so the debt set is EMPTY -
 * the meaningful assertion is that nobody registers an entity whose only
 * texture is the silhouette (unregistered entities use the wildcard entry
 * instead). In 'animated' mode the debt is real and long: phap_tu plus every
 * enemy template until their sheets are drawn.
 */
import { describe, expect, it } from 'vitest'
import { ENTITY_ART_MODE } from '@/presentation/art/EntityArtMode'
import { MORTAL_ENEMY_TEMPLATE_IDS, resolveEnemyTextureKey } from '@/game/support/EnemyArt'
import {
  combatPresentationEntityKeys,
  PLACEHOLDER_ENTITY_KEY,
  placeholderEntityKeys,
} from '@/presentation/art/CombatPresentationCatalogue'

const EXPECTED_PLACEHOLDER_KEYS: readonly string[] =
  ENTITY_ART_MODE === 'animated'
    ? [
        'player-phap-tu-v1',
        ...MORTAL_ENEMY_TEMPLATE_IDS.map(
          (templateId) => resolveEnemyTextureKey(templateId) ?? templateId,
        ),
      ]
    : []

describe('placeholder art debt ratchet', () => {
  it('the wildcard placeholder entity itself is registered', () => {
    expect(combatPresentationEntityKeys()).toContain(PLACEHOLDER_ENTITY_KEY)
  })

  it('the placeholder-backed entity set is exactly the declared debt', () => {
    expect(
      [...placeholderEntityKeys()].sort(),
      'placeholder debt changed - shrink it by shipping real art, grow it only by editing this list',
    ).toEqual([...EXPECTED_PLACEHOLDER_KEYS].sort())
  })

  it('every listed entity is still a real one', () => {
    const known = new Set(combatPresentationEntityKeys())

    const phantom = EXPECTED_PLACEHOLDER_KEYS.filter((entityKey) => !known.has(entityKey))

    expect(phantom, 'a listed key the catalogue does not know is a typo or a deletion').toEqual([])
  })
})
