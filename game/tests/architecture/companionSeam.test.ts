/**
 * Companion art seam (impact-sync sec.46-53, sec.69).
 *
 * COMPANION_RESKIN_MAP is intentionally EMPTY today - companions still
 * render the tracked placeholder. These tests pin the SEAM so the first
 * real mapping lands without touching the runtime: a fixture mutates the
 * live map, rebuilds the catalogue through the exported builder, and the
 * companion id flows through identity/forced-animation/flatten/preload
 * exactly the way real content will.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { COMPANIONS } from '@/data/companion/Companions'
import {
  COMPANION_RESKIN_MAP,
  companionArtVariant,
  companionArtVariants,
} from '@/game/support/CharacterArt'
import { ENEMY_RESKIN_MAP } from '@/game/support/MonsterArt'
import { atlasClipsOf } from '@/presentation/art/CombatEntityPresentation'
import {
  buildCatalogue,
  isForcedAnimatedEntity,
  PLACEHOLDER_STATIC_TEXTURE_KEY,
} from '@/presentation/art/CombatPresentationCatalogue'
import { queueCombatAssets } from '@/game/support/CombatPreload'
import { getCombatDescriptors } from '@/presentation/assets/AssetBundleCatalog'

const FIXTURE_COMPANION = 'ho_ly_tinh'
const FIXTURE_ART = 'zuofeng'

afterEach(() => {
  delete COMPANION_RESKIN_MAP[FIXTURE_COMPANION]
})

describe('companion seam - empty baseline', () => {
  it('ships no invented mappings and no extra assets', () => {
    expect(COMPANION_RESKIN_MAP).toEqual({})
    expect(companionArtVariants()).toEqual([])
    for (const companion of COMPANIONS) {
      expect(companionArtVariant(companion.id)).toBeUndefined()
      expect(isForcedAnimatedEntity(companion.id)).toBe(false)
    }
  })

  it('unmapped companions keep placeholder-static debt', () => {
    const { staticForms } = buildCatalogue()
    for (const companion of COMPANIONS) {
      expect(staticForms.get(companion.id)?.texture.textureKey).toBe(
        PLACEHOLDER_STATIC_TEXTURE_KEY,
      )
    }
  })

  it('companion ids cannot collide with the enemy reskin namespace (sec.53)', () => {
    const enemyIds = new Set(Object.keys(ENEMY_RESKIN_MAP))
    for (const companion of COMPANIONS) {
      expect(enemyIds.has(companion.id)).toBe(false)
    }
    for (const companionId of Object.keys(COMPANION_RESKIN_MAP)) {
      expect(enemyIds.has(companionId)).toBe(false)
    }
  })
})

describe('companion seam - fixture-injected mapping (sec.69)', () => {
  it('flows companion.id through identity, clips, forced set, flatten, preload', () => {
    COMPANION_RESKIN_MAP[FIXTURE_COMPANION] = FIXTURE_ART
    expect(companionArtVariant(FIXTURE_COMPANION)?.slug).toBe(FIXTURE_ART)

    const { entries, animatedForms } = buildCatalogue()

    // Runtime identity stays the companion id - never the art slug.
    expect(animatedForms.has(FIXTURE_COMPANION)).toBe(true)
    const presentation = entries.get(FIXTURE_COMPANION)!
    expect(presentation.kind).toBe('animated')

    // Animation keys are prefixed by the companion id.
    expect(animatedForms.get(FIXTURE_COMPANION)!.attack?.key).toBe(
      `${FIXTURE_COMPANION}-attack`,
    )

    // Frames/sheets come from the mapped art slug.
    const atlas = atlasClipsOf(animatedForms.get(FIXTURE_COMPANION)!)
    expect(atlas.length).toBeGreaterThan(0)
    expect(atlas.every((clip) => clip.sheetKey.startsWith(`${FIXTURE_ART}-sheet-`))).toBe(true)

    // Forced-animation membership is keyed by companion id.
    expect(isForcedAnimatedEntity(FIXTURE_COMPANION)).toBe(true)
    expect(isForcedAnimatedEntity(FIXTURE_ART)).toBe(true) // the slug stays forced too

    // The atlas reaches the canonical enumeration path the same way any
    // animated entity does (sec.51) - the rebuilt form map is the proof.
    expect(atlasClipsOf(animatedForms.get(FIXTURE_COMPANION)!).length)
      .toBeGreaterThan(0)

    // Both parity surfaces enumerate the mapped companion's avatar (sec.52).
    const queued: Array<{ key: string; url: string }> = []
    const fakeScene = {
      textures: { exists: () => false },
      load: {
        image: (key: string, url: string) => queued.push({ key, url }),
        atlas: () => {},
      },
    }
    queueCombatAssets(fakeScene as never)
    expect(queued.some((d) => d.key === 'zuofeng-avatar')).toBe(true)

    const descriptors = getCombatDescriptors()
    expect(
      descriptors.some((d) => d.kind === 'image' && d.key === 'zuofeng-avatar'),
    ).toBe(true)
  })

  it('an unknown art slug fails loudly instead of shipping dead data', () => {
    COMPANION_RESKIN_MAP[FIXTURE_COMPANION] = 'ghost_city'
    expect(() => companionArtVariant(FIXTURE_COMPANION)).toThrow(/ghost_city/)
  })
})
