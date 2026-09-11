import { describe, expect, it } from 'vitest'
import {
  buildPlaceholderAnimationSet,
  combatAnimationKey,
  placeholderFrameName,
  COMBAT_ANIMATION_NAMES,
  PLACEHOLDER_SHEET_KEY,
  PLACEHOLDER_SHEET_URL,
  PLACEHOLDER_ATLAS_URL,
  PLACEHOLDER_FRAME_COUNT,
  PLACEHOLDER_ZERO_PAD,
  type CombatAnimationName,
} from './CombatAnimationSet'

const ALL: CombatAnimationName[] = ['idle', 'ready', 'standby', 'cast', 'death']

describe('buildPlaceholderAnimationSet', () => {
  it('every clip describes the shared placeholder ATLAS, png and json together', () => {
    const set = buildPlaceholderAnimationSet('player-mortal')

    for (const name of ALL) {
      const clip = set[name]

      expect(clip.sheetKey).toBe(PLACEHOLDER_SHEET_KEY)
      expect(clip.sheetUrl).toBe(PLACEHOLDER_SHEET_URL)

      // The json is the half that makes it an atlas. A clip carrying only the
      // png would load as a texture with no frames and animate nothing.
      expect(clip.atlasUrl).toBe(PLACEHOLDER_ATLAS_URL)

      // key stays per-entity: CombatScene plays a key, and two entities sharing
      // one texture must still be able to animate independently.
      expect(clip.key).toBe(`player-mortal-${name}`)
    }
  })

  it('the frame range covers the whole placeholder, inclusive at both ends', () => {
    const set = buildPlaceholderAnimationSet('enemy-wolf')

    for (const name of ALL) {
      expect(set[name].firstFrame).toBe(0)
      expect(set[name].lastFrame).toBe(PLACEHOLDER_FRAME_COUNT - 1)

      // lastFrame is INCLUSIVE. Off by one here plays 31 frames or asks for a
      // 33rd that does not exist, and Phaser reports neither loudly.
      expect(set[name].lastFrame - set[name].firstFrame + 1).toBe(PLACEHOLDER_FRAME_COUNT)
    }
  })

  it('frame naming reproduces what the generator actually wrote', () => {
    const clip = buildPlaceholderAnimationSet('player-mortal').idle

    const first = `${clip.framePrefix}${String(clip.firstFrame).padStart(clip.zeroPad, '0')}${clip.frameSuffix}`
    const last = `${clip.framePrefix}${String(clip.lastFrame).padStart(clip.zeroPad, '0')}${clip.frameSuffix}`

    expect(first).toBe('frame_000.png')
    expect(last).toBe('frame_031.png')
    expect(first).toBe(placeholderFrameName(clip.firstFrame))
    expect(clip.zeroPad).toBe(PLACEHOLDER_ZERO_PAD)
  })

  it('two entities share one sheetKey, so the texture loads once', () => {
    const player = buildPlaceholderAnimationSet('player-mortal')
    const enemy = buildPlaceholderAnimationSet('enemy-wolf')

    expect(player.idle.sheetKey).toBe(enemy.idle.sheetKey)
    expect(player.idle.key).not.toBe(enemy.idle.key)
  })

  it('cast/death play once; idle/ready/standby loop', () => {
    const set = buildPlaceholderAnimationSet('enemy-wolf')

    expect(set.idle.repeat).toBe(-1)
    expect(set.ready.repeat).toBe(-1)
    expect(set.standby.repeat).toBe(-1)
    expect(set.cast.repeat).toBe(0)
    expect(set.death.repeat).toBe(0)
  })

  it('one-shot clips declare an impactFrame inside their own range; looping clips do not', () => {
    const set = buildPlaceholderAnimationSet('player-mortal')

    for (const name of ['cast', 'death'] as const) {
      const clip = set[name]

      expect(clip.impactFrame).toBeDefined()
      expect(clip.impactFrame!).toBeGreaterThanOrEqual(clip.firstFrame)
      expect(clip.impactFrame!).toBeLessThanOrEqual(clip.lastFrame)
    }

    // A looping clip has no moment where anything connects.
    for (const name of ['idle', 'ready', 'standby'] as const) {
      expect(set[name].impactFrame).toBeUndefined()
    }
  })

  it('the set covers every declared animation name, with nothing undefined', () => {
    const set = buildPlaceholderAnimationSet('player-mortal')

    // The regression this pins: the builder used to end in
    // `Object.fromEntries(...) as CombatAnimationSet` while three of the eight
    // declared names had no clip, so `set.hit` type-checked and was undefined.
    for (const name of COMBAT_ANIMATION_NAMES) {
      expect(set[name], `clip missing for '${name}'`).toBeDefined()
    }

    expect(Object.keys(set).sort()).toEqual([...COMBAT_ANIMATION_NAMES].sort())
  })

  it('no clip carries grid-spritesheet geometry any more', () => {
    // frameWidth/frameHeight/frameCount belonged to the uniform-grid format.
    // Leaving them on the type would let a consumer keep loading the atlas as a
    // spritesheet and silently get one frame.
    const clip = buildPlaceholderAnimationSet('player-mortal').idle as unknown as Record<string, unknown>

    expect(clip.frameWidth).toBeUndefined()
    expect(clip.frameHeight).toBeUndefined()
    expect(clip.frameCount).toBeUndefined()
  })

  it('combatAnimationKey is the only key format', () => {
    expect(combatAnimationKey('player-mortal', 'cast')).toBe('player-mortal-cast')
  })
})
