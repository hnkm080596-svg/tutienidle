/**
 * Guard (Spec B sec. 7) - the animation catalogue describes clips that can exist.
 *
 * Spec: docs/superpowers/specs/2026-09-11-combat-animation-metadata-design.md
 * sec. 4.2, sec. 4.4, sec. 7; updated 2026-09-19 for the uniform contract
 * (docs/superpowers/plans/2026-09-19-entity-art-mode-switch.md).
 *
 * sec. 3.3 chose hand-written metadata over a generated manifest and accepted the
 * cost out loud: nothing measures the art. These assertions check the half that
 * IS checkable - that a clip is internally coherent and reachable. Its sibling
 * `atlasFramesExist.test.ts` checks the other half, against the file on disk.
 *
 * These tests read `animatedArtFormFor` - the entity's dormant ANIMATED form -
 * rather than the emitted presentation, so they validate clip data in EITHER
 * mode: 'static' does not mean the atlases stop needing to be honest.
 *
 * sec. 7.1 states plainly what neither can catch: that a clip LOOKS right. A clip
 * whose `impactFrame` is inside the range but on the wrong frame - the sword
 * still rising - passes everything here. That is a judgement made by watching,
 * and it belongs to spec D.
 */
import { describe, expect, it } from 'vitest'
import { ENTITY_ART_MODE } from '@/presentation/art/EntityArtMode'
import {
  animatedArtFormFor,
  animatedCombatEntities,
  COMBAT_ANIMATION_NAMES,
  combatPresentationEntityKeys,
  PLAYER_MORTAL_ATLAS_SHEET_KEY,
  presentationFor,
  REQUIRED_COMBAT_ANIMATION_NAMES,
} from '@/presentation/art/CombatPresentationCatalogue'
import type {
  AtlasClip,
  CombatAnimationCatalogue,
} from '@/presentation/art/CombatEntityPresentation'
import { PLAYER_VISUAL_PROFILES } from '@/presentation/art/PlayerVisualProfiles'
import { getCombatDescriptors } from '@/presentation/assets/AssetBundleCatalog'

/** Every registered entity's dormant animated form - mode-independent. */
function allAnimatedForms(): Array<{ entityKey: string; clips: CombatAnimationCatalogue }> {
  const forms: Array<{ entityKey: string; clips: CombatAnimationCatalogue }> = []

  for (const entityKey of combatPresentationEntityKeys()) {
    const clips = animatedArtFormFor(entityKey)

    if (clips) {
      forms.push({ entityKey, clips })
    }
  }

  return forms
}

describe('combat animation catalogue', () => {
  it('has entities to police - a guard over an empty corpus proves nothing', () => {
    expect(combatPresentationEntityKeys().length).toBeGreaterThan(20)
    expect(allAnimatedForms().length).toBe(combatPresentationEntityKeys().length)
  })

  it('every clip is internally coherent: a real range, a real rate', () => {
    for (const { entityKey, clips } of allAnimatedForms()) {
      for (const [name, clip] of Object.entries(clips)) {
        const where = `${entityKey}.${name}`

        expect(clip.lastFrame, `${where}: lastFrame before firstFrame`).toBeGreaterThanOrEqual(
          clip.firstFrame,
        )

        expect(clip.frameRate, `${where}: non-positive frameRate`).toBeGreaterThan(0)

        // A clip at 0 fps or with an inverted range registers without error and
        // then plays nothing. Phaser says so out loud on neither.
      }
    }
  })

  it('every impactFrame lies inside its own clip', () => {
    for (const { entityKey, clips } of allAnimatedForms()) {
      for (const [name, clip] of Object.entries(clips)) {
        if (clip.impactFrame === undefined) {
          continue
        }

        const where = `${entityKey}.${name}`

        expect(clip.impactFrame, `${where}: impactFrame before firstFrame`).toBeGreaterThanOrEqual(
          clip.firstFrame,
        )

        expect(clip.impactFrame, `${where}: impactFrame past lastFrame`).toBeLessThanOrEqual(
          clip.lastFrame,
        )
      }
    }
  })

  it('every animated form declares the three required clips, and only real names', () => {
    // The uniform contract: idle/standby/death are required; transitions and
    // cultivate are optional extras. A declared key that is not in
    // COMBAT_ANIMATION_NAMES is a typo the compiler cannot see inside
    // Object.entries.
    const validNames = new Set<string>(COMBAT_ANIMATION_NAMES)

    for (const { entityKey, clips } of allAnimatedForms()) {
      for (const name of REQUIRED_COMBAT_ANIMATION_NAMES) {
        expect(clips[name], `${entityKey}: no clip for required '${name}'`).toBeDefined()
      }

      for (const name of Object.keys(clips)) {
        expect(validNames.has(name), `${entityKey}: '${name}' is not a CombatAnimationName`).toBe(
          true,
        )
      }
    }
  })

  it('mortal uses one real atlas with authored per-state ranges', () => {
    const clips = animatedArtFormFor(PLAYER_VISUAL_PROFILES.mortal.combatTextureKey)

    expect(clips).toBeDefined()

    if (!clips) {
      return
    }

    expect(new Set(Object.values(clips).map((clip) => clip.sheetKey))).toEqual(
      new Set([PLAYER_MORTAL_ATLAS_SHEET_KEY]),
    )
    expect(
      Object.fromEntries(
        Object.entries(clips).map(([name, clip]: [string, AtlasClip]) => [
          name,
          [clip.firstFrame, clip.lastFrame, clip.frameRate, clip.repeat],
        ]),
      ),
    ).toEqual({
      idle: [0, 31, 8, -1],
      standby: [32, 42, 8, -1],
      death: [91, 106, 10, 0],
    })
    expect(clips.death.impactFrame).toBe(94)
  })

  it('the combat bundle loads exactly the mode-selected atlases', () => {
    // A clip naming a sheet nobody loads registers an animation over a texture
    // that does not exist. Phaser yields no frames and plays nothing, silently.
    // In 'static' mode the reverse must hold: no entity atlas is loaded, so the
    // mode switch provably changes what the bundle carries.
    const loadedKeys = new Set(getCombatDescriptors().map((descriptor) => descriptor.key))

    for (const { entityKey, clips } of animatedCombatEntities()) {
      for (const [name, clip] of Object.entries(clips)) {
        expect(
          loadedKeys.has(clip.sheetKey),
          `${entityKey}.${name}: sheetKey '${clip.sheetKey}' is in no combat bundle`,
        ).toBe(true)
      }
    }

    if (ENTITY_ART_MODE === 'static') {
      expect(animatedCombatEntities()).toEqual([])
    }
  })

  it('an animation key is unique per entity, so two entities on one sheet stay independent', () => {
    const seen = new Set<string>()

    for (const { clips } of allAnimatedForms()) {
      for (const clip of Object.values(clips)) {
        expect(seen.has(clip.key), `duplicate animation key '${clip.key}'`).toBe(false)
        seen.add(clip.key)
      }
    }
  })

  it('an entity with no drawn art resolves to nothing, rather than to a guess', () => {
    // presentationFor stays strict: the wildcard placeholder is resolved by the
    // CALLERS (sprite factory, animation prefix), not fabricated inside the
    // catalogue lookup - so a typo'd key still cannot masquerade as real art.
    expect(presentationFor('no-such-entity-key')).toBeUndefined()
  })
})
