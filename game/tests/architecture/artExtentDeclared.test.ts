/**
 * Guard each clip's normalized body extent against the tallest trimmed frame
 * in the atlas range that clip actually declares.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PLAYER_VISUAL_PROFILES } from '@/presentation/art/PlayerVisualProfiles'
import { animatedArtFormFor } from '@/presentation/art/CombatPresentationCatalogue'
import type {
  AtlasClip,
  CombatAnimationCatalogue,
} from '@/presentation/art/CombatEntityPresentation'
import { SCAN_TIMEOUT } from './helpers/scanTs'

const GAME_ROOT = process.cwd()
const MORTAL_ENTITY_KEY = PLAYER_VISUAL_PROFILES.mortal.combatTextureKey

interface AtlasFrame {
  spriteSourceSize: { x: number; y: number; w: number; h: number }
  sourceSize: { w: number; h: number }
}

function publicPath(url: string): string {
  return join(GAME_ROOT, 'public', url)
}

function mortalClips(): CombatAnimationCatalogue {
  // The dormant ANIMATED form - validated in either ENTITY_ART_MODE.
  const clips = animatedArtFormFor(MORTAL_ENTITY_KEY)

  if (!clips) {
    throw new Error(`Expected animated form for '${MORTAL_ENTITY_KEY}'`)
  }

  return clips
}

function frameName(clip: AtlasClip, index: number): string {
  return `${clip.framePrefix}${String(index).padStart(clip.zeroPad, '0')}${clip.frameSuffix}`
}

const clips = mortalClips()
const idleClip = clips.idle

if (!idleClip) {
  throw new Error('mortal clips missing idle')
}

const atlas = JSON.parse(readFileSync(publicPath(idleClip.atlasUrl), 'utf8')) as {
  frames: Record<string, AtlasFrame>
}

function closeTo(actual: number, expected: number): void {
  expect(actual).toBeCloseTo(expected, 4)
}

describe('mortal art extents', () => {
  it(
    'declares the measured tallest trimmed frame for every clip',
    () => {
      for (const clip of Object.values(clips).filter(
        (c): c is AtlasClip => c !== undefined,
      )) {

        let tallest: AtlasFrame | undefined

        for (let index = clip.firstFrame; index <= clip.lastFrame; index++) {
          const frame = atlas.frames[frameName(clip, index)]

          if (!frame) {
            throw new Error(`${clip.key}: missing frame ${index}`)
          }

          if (!tallest || frame.spriteSourceSize.h > tallest.spriteSourceSize.h) {
            tallest = frame
          }
        }

        if (!tallest) {
          throw new Error(`${clip.key}: empty clip range`)
        }

        const { sourceSize, spriteSourceSize } = tallest

        expect(clip.extent.w).toBeGreaterThan(0)
        expect(clip.extent.h).toBeGreaterThan(0)
        expect(clip.extent.x).toBeGreaterThanOrEqual(0)
        expect(clip.extent.y).toBeGreaterThanOrEqual(0)
        expect(clip.extent.x + clip.extent.w).toBeLessThanOrEqual(1)
        expect(clip.extent.y + clip.extent.h).toBeLessThanOrEqual(1)

        closeTo(clip.extent.x, spriteSourceSize.x / sourceSize.w)
        closeTo(clip.extent.y, spriteSourceSize.y / sourceSize.h)
        closeTo(clip.extent.w, spriteSourceSize.w / sourceSize.w)
        closeTo(clip.extent.h, spriteSourceSize.h / sourceSize.h)
      }
    },
    SCAN_TIMEOUT,
  )
})
