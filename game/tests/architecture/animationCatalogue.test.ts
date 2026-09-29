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
 * sec. 7.1 states plainly what neither can catch: that a clip LOOKS right. A
 * frame range can be internally coherent and still contain the wrong frames -
 * the sword still rising at the moment it should land. That is a judgement
 * made by watching, and no metadata field makes it machine-checkable.
 */
import { describe, expect, it } from 'vitest'
import { ENTITY_ART_MODE } from '@/presentation/art/EntityArtMode'
import { ANIMATED_ENEMY_KEYS } from '@/game/support/MonsterArt'
import { ANIMATED_CHARACTER_KEYS } from '@/game/support/CharacterArt'
import {
  animatedArtFormFor,
  animatedCombatEntities,
  COMBAT_ANIMATION_NAMES,
  combatPresentationEntityKeys,
  PLAYER_MORTAL_ATLAS_SHEET_KEY,
  presentationFor,
  REQUIRED_COMBAT_ANIMATION_NAMES,
} from '@/presentation/art/CombatPresentationCatalogue'
import {
  atlasClipsOf,
  type AtlasClip,
  type CombatAnimationCatalogue,
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
      // castClips is a keyed MAP of AtlasClips, not a clip - flatten it in
      // alongside the named entries so its ranges get policed too.
      const namedClips: Array<[string, AtlasClip]> = [
        ...Object.entries(clips).filter(
          (entry): entry is [string, AtlasClip] => entry[0] !== 'castClips',
        ),
        ...Object.entries(clips.castClips ?? {}).map(
          ([key, clip]): [string, AtlasClip] => [`castClips.${key}`, clip],
        ),
      ]

      for (const [name, clip] of namedClips) {
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
        // castClips is a keyed map member, not a CombatAnimationName
        // (user ruling Q1 2026-09-29) - allowed here; its CONTENTS are
        // pinned below.
        if (name === 'castClips') continue

        expect(validNames.has(name), `${entityKey}: '${name}' is not a CombatAnimationName`).toBe(
          true,
        )
      }

      // Every cast clip's anim key follows `${slug}-cast-<clip>` (the
      // `role:` selector prefix is stripped) - the name playCastClip looks
      // up by Skill.id / `role:<slotRole>`.
      for (const [key, clip] of Object.entries(clips.castClips ?? {})) {
        expect(clip.key, `${entityKey}.castClips.${key} key`).toBe(
          `${entityKey}-cast-${key.replace(/^role:/, '')}`,
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
  })

  it('the combat bundle loads exactly the mode-selected atlases', () => {
    // A clip naming a sheet nobody loads registers an animation over a texture
    // that does not exist. Phaser yields no frames and plays nothing, silently.
    // In 'static' mode the reverse must hold: no entity atlas is loaded, so the
    // mode switch provably changes what the bundle carries.
    const loadedKeys = new Set(getCombatDescriptors().map((descriptor) => descriptor.key))

    for (const { entityKey, clips } of animatedCombatEntities()) {
      for (const clip of atlasClipsOf(clips)) {
        expect(
          loadedKeys.has(clip.sheetKey),
          `${entityKey} clip '${clip.key}': sheetKey '${clip.sheetKey}' is in no combat bundle`,
        ).toBe(true)
      }
    }

    if (ENTITY_ART_MODE === 'static') {
      // enemy-art-wave1 + character-art-infra amendments: the ONLY animated
      // entities under 'static' are the enumerated reskin sets - nothing
      // else may drift animated.
      expect(new Set(animatedCombatEntities().map((e) => e.entityKey))).toEqual(
        new Set([...ANIMATED_ENEMY_KEYS, ...ANIMATED_CHARACTER_KEYS]),
      )
    }
  })

  it('an animation key is unique per entity, so two entities on one sheet stay independent', () => {
    const seen = new Set<string>()

    for (const { clips } of allAnimatedForms()) {
      for (const clip of atlasClipsOf(clips)) {
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

  // Impact-sync sec.66: atlasClipsOf is the ONLY enumeration - it must
  // flatten the named clips AND the castClips map into plain AtlasClips,
  // never a nested map and never a present-but-undefined entry.
  it('atlasClipsOf flattens named clips + castClips into plain AtlasClips', () => {
    for (const { entityKey, clips } of allAnimatedForms()) {
      const named = Object.entries(clips)
        .filter(([name]) => name !== 'castClips')
        .map(([, clip]) => clip)
      const casts = Object.values(clips.castClips ?? {})
      const flat = atlasClipsOf(clips)

      expect(flat.length, `${entityKey}: flatten lost clips`).toBe(
        named.length + casts.length,
      )

      // Every element is a real clip - a leaked castClips map would lack
      // frame fields and would crash frame iteration downstream.
      for (const clip of flat) {
        expect(clip, `${entityKey}: undefined clip entry`).toBeDefined()
        expect(typeof clip.firstFrame, `${entityKey}: '${clip?.key}' is not an AtlasClip`)
          .toBe('number')
        expect(typeof clip.lastFrame).toBe('number')
      }
    }

    // Corpus proof - the pins above are vacuous on a catalogue with no
    // cast clips at all.
    const withCasts = allAnimatedForms().filter(
      ({ clips }) => Object.keys(clips.castClips ?? {}).length > 0,
    )
    expect(withCasts.length).toBeGreaterThanOrEqual(2)
  })
})
