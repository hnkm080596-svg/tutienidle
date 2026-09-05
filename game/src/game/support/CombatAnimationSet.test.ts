import { describe, expect, it } from 'vitest'
import { buildPlaceholderAnimationSet, type CombatAnimationName } from './CombatAnimationSet'

describe('buildPlaceholderAnimationSet', () => {
  it('produces all 5 named clips, each pointing at the same static texture (single-frame sheet)', () => {
    const set = buildPlaceholderAnimationSet('player-mortal', '/assets/characters/player/mortal/player-mortal-ink-sword-concept-v2.png')

    const names: CombatAnimationName[] = ['idle', 'ready', 'cast', 'standby', 'death']

    for (const name of names) {
      const clip = set[name]

      expect(clip.sheetUrl).toBe('/assets/characters/player/mortal/player-mortal-ink-sword-concept-v2.png')
      expect(clip.key).toBe(`player-mortal-${name}`)
      expect(clip.frameCount).toBe(1)
      expect(clip.sheetKey).toBe(`player-mortal-${name}-sheet`)
    }
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
