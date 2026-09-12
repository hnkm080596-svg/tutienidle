/**
 * Guard the authored mortal atlas against drift between hand-written clip
 * metadata and the files Phaser reads at runtime.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { PLAYER_VISUAL_PROFILES } from '@/presentation/art/PlayerVisualProfiles'
import {
  COMBAT_ANIMATION_NAMES,
  presentationFor,
} from '@/presentation/art/CombatPresentationCatalogue'
import type { AtlasClip } from '@/presentation/art/CombatEntityPresentation'
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

function mortalClips(): Record<string, AtlasClip> {
  const presentation = presentationFor(MORTAL_ENTITY_KEY)

  if (!presentation || presentation.kind !== 'animated') {
    throw new Error(`Expected animated mortal presentation for '${MORTAL_ENTITY_KEY}'`)
  }

  return presentation.clips
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
const atlasUrl = clips.idle.atlasUrl
const sheetUrl = clips.idle.sheetUrl
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

      for (const name of COMBAT_ANIMATION_NAMES) {
        const clip = clips[name]

        for (let index = clip.firstFrame; index <= clip.lastFrame; index++) {
          const key = frameName(clip, index)
          declaredFrameNames.add(key)
          expect(atlas.frames[key], `${name}: missing ${key}`).toBeDefined()
          expect(key).toMatch(/^frame_\d{3}\.png$/)
        }
      }

      expect(Object.keys(atlas.frames).sort()).toEqual([...declaredFrameNames].sort())
    },
    SCAN_TIMEOUT,
  )

  it(
    'keeps all five clips on one sheet with consistent source frames',
    () => {
      expect(new Set(Object.values(clips).map((clip) => clip.sheetKey))).toEqual(
        new Set([clips.idle.sheetKey]),
      )

      for (const name of COMBAT_ANIMATION_NAMES) {
        const clip = clips[name]

        for (let index = clip.firstFrame; index <= clip.lastFrame; index++) {
          const frame = atlas.frames[frameName(clip, index)]!

          expect(frame.trimmed, `${name} frame ${index} is not trimmed`).toBe(true)
          expect(frame.sourceSize, `${name} frame ${index} sourceSize drift`).toEqual(
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
            `${name} frame ${index} is identity-trimmed`,
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

      expect(source).not.toMatch(/load\.spritesheet[\s\S]{0,300}player-mortal-combat-atlas-v1/)
      expect(source).not.toMatch(/player-mortal-combat-atlas-v1[\s\S]{0,300}load\.spritesheet/)
    },
    SCAN_TIMEOUT,
  )
})
