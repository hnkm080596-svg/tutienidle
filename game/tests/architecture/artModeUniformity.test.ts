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
import { ANIMATED_ENEMY_KEYS } from '@/game/support/MonsterArt'
import { ANIMATED_CHARACTER_KEYS } from '@/game/support/CharacterArt'
import {
  animatedArtFormFor,
  combatPresentationEntityKeys,
  PLACEHOLDER_ENTITY_KEY,
  placeholderEntityKeys,
  presentationFor,
  REQUIRED_COMBAT_ANIMATION_NAMES,
  staticArtFormFor,
} from '@/presentation/art/CombatPresentationCatalogue'

/** The one enumeration of entities allowed to emit 'animated' under 'static'
 * mode (enemy-art-wave1 + character-art-infra amendments). */
const ANIMATED_OVERRIDE_KEYS: ReadonlySet<string> = new Set([
  ...ANIMATED_ENEMY_KEYS,
  ...ANIMATED_CHARACTER_KEYS,
])

describe('ENTITY_ART_MODE uniformity', () => {
  it('every registered presentation kind matches ENTITY_ART_MODE, except the enumerated reskin set', () => {
    // enemy-art-wave1 + character-art-infra amendments (2026-09-28): the
    // ANIMATED_*_KEYS sets are the ONE enumeration of entities allowed to
    // emit 'animated' under 'static' mode. Nothing else may drift.
    for (const key of combatPresentationEntityKeys()) {
      const expected = ANIMATED_OVERRIDE_KEYS.has(key) ? 'animated' : ENTITY_ART_MODE
      expect(presentationFor(key)?.kind, `entity '${key}'`).toBe(expected)
    }
  })

  it('every reskin-set entity actually emits animated - a dead override is a bug', () => {
    for (const key of ANIMATED_OVERRIDE_KEYS) {
      expect(
        presentationFor(key)?.kind,
        `reskinned enemy '${key}' must be animated`,
      ).toBe('animated')
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

  it('declared transition clips are one-shots - a looping transition never reaches its destination', () => {
    for (const key of combatPresentationEntityKeys()) {
      const clips = animatedArtFormFor(key)

      for (const name of ['idle_to_standby', 'standby_to_idle'] as const) {
        const clip = clips?.[name]

        if (clip) {
          expect(clip.repeat, `entity '${key}' transition '${name}'`).toBe(0)
        }
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
