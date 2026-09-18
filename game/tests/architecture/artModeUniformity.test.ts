/**
 * ENTITY_ART_MODE uniformity invariant - every registered combat entity's
 * presentation `kind` must equal the compile-time mode. This is the guard
 * that makes "never half animated / half static" enforceable rather than a
 * comment: the catalogue emits kinds from the constant, and this test fails
 * the moment any entry drifts.
 *
 * Uniformity is a CONSTRUCTION property, not only an emitted one: every
 * entity declares both a static PNG + idle motion and an animated clip set,
 * so flipping ENTITY_ART_MODE never leaves an entity without art. The
 * required-clip and placeholder checks below pin the two halves.
 *
 * Spec: docs/superpowers/plans/2026-09-19-entity-art-mode-switch.md
 */
import { describe, expect, it } from 'vitest'
import { ENTITY_ART_MODE } from '@/presentation/art/EntityArtMode'
import {
  animatedArtFormFor,
  combatPresentationEntityKeys,
  PLACEHOLDER_ENTITY_KEY,
  placeholderEntityKeys,
  presentationFor,
  REQUIRED_COMBAT_ANIMATION_NAMES,
  staticArtFormFor,
} from '@/presentation/art/CombatPresentationCatalogue'

describe('ENTITY_ART_MODE uniformity', () => {
  it('every registered presentation kind matches ENTITY_ART_MODE', () => {
    for (const key of combatPresentationEntityKeys()) {
      expect(presentationFor(key)?.kind, `entity '${key}'`).toBe(ENTITY_ART_MODE)
    }
  })

  it('every registered entity declares BOTH dormant forms - the flip never strands art', () => {
    for (const key of combatPresentationEntityKeys()) {
      expect(
        animatedArtFormFor(key),
        `entity '${key}' missing its animated form`,
      ).toBeDefined()
      expect(
        staticArtFormFor(key),
        `entity '${key}' missing its static form`,
      ).toBeDefined()
    }
  })

  it('every animated form carries the three required combat clips', () => {
    for (const key of combatPresentationEntityKeys()) {
      const clips = animatedArtFormFor(key)

      for (const name of REQUIRED_COMBAT_ANIMATION_NAMES) {
        expect(clips?.[name], `entity '${key}' clip '${name}'`).toBeDefined()
      }
    }
  })

  it('the shared placeholder resolves to a presentation of the ACTIVE kind', () => {
    expect(presentationFor(PLACEHOLDER_ENTITY_KEY)?.kind).toBe(ENTITY_ART_MODE)
    expect(staticArtFormFor(PLACEHOLDER_ENTITY_KEY)).toBeDefined()
    expect(animatedArtFormFor(PLACEHOLDER_ENTITY_KEY)).toBeDefined()
  })

  it('placeholder-debt keys are real catalogue entries of the active kind', () => {
    for (const key of placeholderEntityKeys()) {
      expect(presentationFor(key)?.kind, `placeholder entity '${key}'`).toBe(
        ENTITY_ART_MODE,
      )
    }
  })
})
