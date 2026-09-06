import { describe, expect, it } from 'vitest'
import {
  buildPlaceholderAnimationSet,
  PLACEHOLDER_SHEET_KEY,
  PLACEHOLDER_SHEET_URL,
  PLACEHOLDER_FRAME_WIDTH,
  PLACEHOLDER_FRAME_HEIGHT,
  PLACEHOLDER_FRAME_COUNT,
  type CombatAnimationName,
} from './CombatAnimationSet'

describe('buildPlaceholderAnimationSet', () => {
  it('every clip points at the SHARED 32-frame placeholder sheet, regardless of caller-provided url/size', () => {
    const set = buildPlaceholderAnimationSet('player-mortal', '/some/other/static-image.png', { width: 999, height: 999 })

    const names: CombatAnimationName[] = ['idle', 'ready', 'cast', 'standby', 'death']

    for (const name of names) {
      const clip = set[name]

      expect(clip.sheetKey).toBe(PLACEHOLDER_SHEET_KEY)
      expect(clip.sheetUrl).toBe(PLACEHOLDER_SHEET_URL)
      expect(clip.frameWidth).toBe(PLACEHOLDER_FRAME_WIDTH)
      expect(clip.frameHeight).toBe(PLACEHOLDER_FRAME_HEIGHT)
      expect(clip.frameCount).toBe(PLACEHOLDER_FRAME_COUNT)
      // key vẫn per-entity — CombatScene.ts cần key riêng để play() đúng
      // entity dù texture nguồn (sheetKey) dùng chung.
      expect(clip.key).toBe(`player-mortal-${name}`)
    }
  })

  it('two different entities share the exact same sheetKey (one texture load for both)', () => {
    const playerSet = buildPlaceholderAnimationSet('player-mortal', '/a.png')
    const enemySet = buildPlaceholderAnimationSet('enemy-wolf', '/b.png')

    expect(playerSet.idle.sheetKey).toBe(enemySet.idle.sheetKey)
  })

  it('cast/death play once (repeat: 0), idle/ready/standby loop (repeat: -1)', () => {
    const set = buildPlaceholderAnimationSet('enemy-wolf', '/assets/enemies/wolf.png')

    expect(set.idle.repeat).toBe(-1)
    expect(set.ready.repeat).toBe(-1)
    expect(set.standby.repeat).toBe(-1)
    expect(set.cast.repeat).toBe(0)
    expect(set.death.repeat).toBe(0)
  })
})
