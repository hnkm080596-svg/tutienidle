/**
 * Guard (Spec B §7) — the animation catalogue describes clips that can exist.
 *
 * Spec: docs/superpowers/specs/2026-09-11-combat-animation-metadata-design.md
 * §4.2, §4.4, §7.
 *
 * §3.3 chose hand-written metadata over a generated manifest and accepted the
 * cost out loud: nothing measures the art. These assertions check the half that
 * IS checkable — that a clip is internally coherent and reachable. Its sibling
 * `atlasFramesExist.test.ts` checks the other half, against the file on disk.
 *
 * §7.1 states plainly what neither can catch: that a clip LOOKS right. A clip
 * whose `impactFrame` is inside the range but on the wrong frame — the sword
 * still rising — passes everything here. That is a judgement made by watching,
 * and it belongs to spec D.
 */
import { describe, expect, it } from 'vitest'
import {
  animatedCombatEntities,
  COMBAT_ANIMATION_NAMES,
  combatAnimationForSkill,
  combatPresentationEntityKeys,
  PLAYER_MORTAL_ATLAS_SHEET_KEY,
  presentationFor,
} from '@/presentation/art/CombatPresentationCatalogue'
import { PLAYER_VISUAL_PROFILES } from '@/presentation/art/PlayerVisualProfiles'
import { getCombatDescriptors } from '@/presentation/assets/AssetBundleCatalog'

describe('combat animation catalogue', () => {
  it('has animated entities to police — a guard over an empty corpus proves nothing', () => {
    expect(animatedCombatEntities().length).toBeGreaterThan(0)
    expect(combatPresentationEntityKeys().length).toBeGreaterThan(20)
  })

  it('every clip is internally coherent: a real range, a real rate', () => {
    for (const { entityKey, clips } of animatedCombatEntities()) {
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
    // Spec D consumes this to time the moment an attack READS as landing. A
    // value outside the range would make D wait for a frame that never plays.
    for (const { entityKey, clips } of animatedCombatEntities()) {
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

  it('every animated entity declares EVERY animation name — no partial records', () => {
    // §4.1 chose a discriminated union over `Partial<Record<…>>` precisely so
    // an animated entity cannot be missing clips. This is that promise, checked
    // against the values rather than the type: the regression it pins is
    // `Object.fromEntries(...) as CombatAnimationSet`, under which `set.hit`
    // type-checked and was `undefined` at runtime (§2.2).
    for (const { entityKey, clips } of animatedCombatEntities()) {
      for (const name of COMBAT_ANIMATION_NAMES) {
        expect(clips[name], `${entityKey}: no clip for '${name}'`).toBeDefined()
      }

      expect(Object.keys(clips).sort()).toEqual([...COMBAT_ANIMATION_NAMES].sort())
    }
  })

  it('mortal uses one real atlas with authored per-state ranges', () => {
    const presentation = presentationFor(PLAYER_VISUAL_PROFILES.mortal.combatTextureKey)

    expect(presentation?.kind).toBe('animated')

    if (!presentation || presentation.kind !== 'animated') {
      return
    }

    expect(new Set(Object.values(presentation.clips).map((clip) => clip.sheetKey))).toEqual(
      new Set([PLAYER_MORTAL_ATLAS_SHEET_KEY]),
    )
    expect(
      Object.fromEntries(
        COMBAT_ANIMATION_NAMES.map((name) => {
          const clip = presentation.clips[name]
          return [name, [clip.firstFrame, clip.lastFrame, clip.frameRate, clip.repeat]]
        }),
      ),
    ).toEqual({
      idle: [0, 31, 8, -1],
      ready: [32, 42, 10, -1],
      standby: [32, 42, 8, -1],
      cast: [43, 58, 12, 0],
      sweep_hand: [59, 74, 12, 0],
      punch: [75, 90, 12, 0],
      death: [91, 106, 10, 0],
    })
    expect(presentation.clips.cast.impactFrame).toBe(53)
    expect(presentation.clips.sweep_hand.impactFrame).toBe(69)
    expect(presentation.clips.punch.impactFrame).toBe(85)
    expect(presentation.clips.death.impactFrame).toBe(94)
  })

  it('maps mortal opening skills to body-only gestures', () => {
    expect(combatAnimationForSkill('linh_chuong')).toBe('cast')
    expect(combatAnimationForSkill('tram')).toBe('sweep_hand')
    expect(combatAnimationForSkill('dam')).toBe('punch')
    expect(combatAnimationForSkill('generic_physical')).toBe('punch')
    expect(combatAnimationForSkill('unknown_skill')).toBe('cast')
  })

  it("every clip's sheetKey is actually loaded by the combat bundle", () => {
    // A clip naming a sheet nobody loads registers an animation over a texture
    // that does not exist. Phaser yields no frames and plays nothing, silently.
    //
    // MEASURED LIMIT, recorded rather than assumed. §7 proposed falsifying this
    // by "renaming a sheet key in the catalogue only". That probe does NOT turn
    // it red: `AssetBundleCatalog` derives its atlas descriptors from this same
    // catalogue, so the two sides cannot disagree about a name — renaming
    // renames both. What it does catch, verified red on 2026-09-11, is the
    // bundle ceasing to load the sheet at all.
    const loadedKeys = new Set(getCombatDescriptors().map((descriptor) => descriptor.key))

    for (const { entityKey, clips } of animatedCombatEntities()) {
      for (const [name, clip] of Object.entries(clips)) {
        expect(
          loadedKeys.has(clip.sheetKey),
          `${entityKey}.${name}: sheetKey '${clip.sheetKey}' is in no combat bundle`,
        ).toBe(true)
      }
    }
  })

  it('an animation key is unique per entity, so two entities on one sheet stay independent', () => {
    const seen = new Set<string>()

    for (const { clips } of animatedCombatEntities()) {
      for (const clip of Object.values(clips)) {
        expect(seen.has(clip.key), `duplicate animation key '${clip.key}'`).toBe(false)
        seen.add(clip.key)
      }
    }
  })

  it('an entity with no drawn art resolves to nothing, rather than to a guess', () => {
    // §3.2.1 refuses a silent downgrade. A realm whose enemies are outside the
    // Mortal batch must reach the caller's Rectangle fallback, not a fabricated
    // presentation that claims art exists.
    expect(presentationFor('no-such-entity-key')).toBeUndefined()
  })
})
