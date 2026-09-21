/**
 * Guard the authored mortal atlas against drift between hand-written clip
 * metadata and the files Phaser reads at runtime.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
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
  frame: { x: number; y: number; w: number; h: number }
  rotated?: boolean
  trimmed: boolean
  spriteSourceSize: { x: number; y: number; w: number; h: number }
  sourceSize: { w: number; h: number }
}

interface AtlasFile {
  frames: Record<string, AtlasFrame>
  meta: { image: string; size: { w: number; h: number } }
}

function publicPath(url: string): string {
  return join(GAME_ROOT, 'public', url)
}

function mortalClips(): CombatAnimationCatalogue {
  // The dormant ANIMATED form - validated in either ENTITY_ART_MODE so the
  // clip data stays honest while 'static' is the emitted kind.
  const clips = animatedArtFormFor(MORTAL_ENTITY_KEY)

  if (!clips) {
    throw new Error(`Expected animated form for '${MORTAL_ENTITY_KEY}'`)
  }

  return clips
}

/** Every declared clip as a flat list - optional members absent, never undefined. */
function clipList(catalogue: CombatAnimationCatalogue): AtlasClip[] {
  return Object.values(catalogue).filter((clip): clip is AtlasClip => clip !== undefined)
}

function frameName(clip: AtlasClip, index: number): string {
  return `${clip.framePrefix}${String(index).padStart(clip.zeroPad, '0')}${clip.frameSuffix}`
}

function sourceFiles(root: string): string[] {
  const files: string[] = []

  for (const entry of readdirSync(root)) {
    const path = join(root, entry)

    if (statSync(path).isDirectory()) {
      files.push(...sourceFiles(path))
    } else if (/\.(?:ts|tsx|vue)$/.test(entry)) {
      files.push(path)
    }
  }

  return files
}

const clips = mortalClips()
const idleClip = clips.idle

if (!idleClip) {
  throw new Error('mortal clips missing idle')
}

const atlasUrl = idleClip.atlasUrl
const sheetUrl = idleClip.sheetUrl
const atlas = JSON.parse(readFileSync(publicPath(atlasUrl), 'utf8')) as AtlasFile

describe('mortal combat atlas frames', () => {
  it(
    'has the atlas json and its png on disk where the catalogue says',
    () => {
      expect(() => readFileSync(publicPath(atlasUrl))).not.toThrow()
      expect(() => readFileSync(publicPath(sheetUrl))).not.toThrow()
      expect(atlas.meta.image).toBe(basename(sheetUrl))
      expect(atlas.meta.size.w).toBeGreaterThan(0)
      expect(atlas.meta.size.h).toBeGreaterThan(0)
    },
    SCAN_TIMEOUT,
  )

  it(
    'has every declared frame by exact frame_000.png naming',
    () => {
      const declaredFrameNames = new Set<string>()

      for (const clip of clipList(clips)) {
        for (let index = clip.firstFrame; index <= clip.lastFrame; index++) {
          const key = frameName(clip, index)
          declaredFrameNames.add(key)
          expect(atlas.frames[key], `${clip.key}: missing ${key}`).toBeDefined()
          expect(key).toMatch(/^frame_\d{3}\.png$/)
        }
      }

      // The atlas still CARRIES the pre-contract attack frames (43-90:
      // cast/sweep_hand/punch + the old 'ready' loop at 32-42 was remapped to
      // standby). They are dead art until the sheet is repacked - enumerated
      // so the file's contents stay fully explained rather than shrinking the
      // assertion to a subset check.
      const DEAD_FRAME_RANGES: Array<[number, number]> = [[43, 90]]
      const deadFrameNames = new Set<string>()

      for (const [first, last] of DEAD_FRAME_RANGES) {
        for (let index = first; index <= last; index++) {
          deadFrameNames.add(`frame_${String(index).padStart(3, '0')}.png`)
        }
      }

      const unexplained = Object.keys(atlas.frames).filter(
        (key) => !declaredFrameNames.has(key) && !deadFrameNames.has(key),
      )

      expect(unexplained, 'atlas frames outside clips and dead ranges').toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'keeps all mortal clips on one sheet with consistent source frames',
    () => {
      expect(new Set(clipList(clips).map((clip) => clip.sheetKey))).toEqual(
        new Set([idleClip.sheetKey]),
      )

      for (const clip of clipList(clips)) {
        for (let index = clip.firstFrame; index <= clip.lastFrame; index++) {
          const frame = atlas.frames[frameName(clip, index)]!

          expect(frame.trimmed, `${clip.key} frame ${index} is not trimmed`).toBe(true)
          expect(frame.sourceSize, `${clip.key} frame ${index} sourceSize drift`).toEqual(
            clip.sourceSize,
          )
          expect(frame.frame.x).toBeGreaterThanOrEqual(0)
          expect(frame.frame.y).toBeGreaterThanOrEqual(0)
          expect(frame.frame.x + frame.frame.w).toBeLessThanOrEqual(atlas.meta.size.w)
          expect(frame.frame.y + frame.frame.h).toBeLessThanOrEqual(atlas.meta.size.h)
          expect(frame.spriteSourceSize.x).toBeGreaterThanOrEqual(0)
          expect(frame.spriteSourceSize.y).toBeGreaterThanOrEqual(0)
          expect(frame.spriteSourceSize.x + frame.spriteSourceSize.w).toBeLessThanOrEqual(
            clip.sourceSize.w,
          )
          expect(frame.spriteSourceSize.y + frame.spriteSourceSize.h).toBeLessThanOrEqual(
            clip.sourceSize.h,
          )
          expect(frame.spriteSourceSize.w).toBeGreaterThan(0)
          expect(frame.spriteSourceSize.h).toBeGreaterThan(0)
          expect(
            frame.spriteSourceSize.w !== clip.sourceSize.w ||
              frame.spriteSourceSize.h !== clip.sourceSize.h,
            `${clip.key} frame ${index} is identity-trimmed`,
          ).toBe(true)
        }
      }
    },
    SCAN_TIMEOUT,
  )

  it(
    'does not register the atlas through a grid spritesheet loader',
    () => {
      const source = sourceFiles(join(GAME_ROOT, 'src'))
        .map((path) => readFileSync(path, 'utf8'))
        .join('\n')

      expect(source).not.toMatch(/load\.spritesheet[\s\S]{0,300}player-mortal-combat-atlas-v2/)
      expect(source).not.toMatch(/player-mortal-combat-atlas-v2[\s\S]{0,300}load\.spritesheet/)
    },
    SCAN_TIMEOUT,
  )
})
