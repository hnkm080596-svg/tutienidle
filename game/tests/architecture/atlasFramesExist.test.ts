/**
 * Guard (Spec B §7) — every frame a clip asks for exists in the atlas on disk.
 *
 * Spec: docs/superpowers/specs/2026-09-11-combat-animation-metadata-design.md
 * §3.3 and §7.
 *
 * §3.3 chose hand-written metadata over a generated manifest, and accepted the
 * cost out loud: nothing measures the art, so a frame count can drift from the
 * file. This guard is the thing that makes that drift fail a test instead of a
 * frame.
 *
 * It matters most on the day it is least expected. Today the atlas is generated
 * by `scripts/generate-hon-don-tran-placeholder-art.mjs`, so metadata and art
 * agree by construction. When real art lands as a TexturePacker export (§3.4),
 * this is the first thing that will notice if it names its frames differently,
 * pads them to a different width, or simply has 24 frames where the catalogue
 * says 32.
 *
 * Phaser fails this case QUIETLY: `generateFrameNames` for a missing frame
 * yields nothing, and the animation plays short or not at all with no error.
 *
 * These guards must never import app code (they police it), so the clip data is
 * re-read from source rather than imported. That is a real limitation, stated:
 * it parses the placeholder constants, so a future entity whose clips are built
 * some other way is NOT covered until this file learns about it. The corpus
 * check below is what makes that visible rather than silent.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SCAN_TIMEOUT } from './helpers/scanTs'

const GAME_ROOT = process.cwd()

const ANIMATION_SET_SOURCE = join(
  GAME_ROOT,
  'src',
  'presentation',
  'art',
  'CombatPresentationCatalogue.ts',
)

/** Pull a string constant out of the source, without importing it. */
function stringConstant(source: string, name: string): string {
  const match = new RegExp(`export const ${name} = '([^']*)'`).exec(source)

  if (!match) {
    throw new Error(`constant ${name} not found in CombatPresentationCatalogue.ts`)
  }

  return match[1]!
}

/** Pull a numeric constant out of the source. */
function numberConstant(source: string, name: string): number {
  const match = new RegExp(`export const ${name} = (\\d+)`).exec(source)

  if (!match) {
    throw new Error(`constant ${name} not found in CombatPresentationCatalogue.ts`)
  }

  return Number(match[1])
}

const source = readFileSync(ANIMATION_SET_SOURCE, 'utf8')

const atlasUrl = stringConstant(source, 'PLACEHOLDER_ATLAS_URL')
const sheetUrl = stringConstant(source, 'PLACEHOLDER_SHEET_URL')
const framePrefix = stringConstant(source, 'PLACEHOLDER_FRAME_PREFIX')
const frameSuffix = stringConstant(source, 'PLACEHOLDER_FRAME_SUFFIX')
const zeroPad = numberConstant(source, 'PLACEHOLDER_ZERO_PAD')
const frameCount = numberConstant(source, 'PLACEHOLDER_FRAME_COUNT')

/** `assets/...` in the clip is `public/assets/...` on disk. */
function publicPath(url: string): string {
  return join(GAME_ROOT, 'public', url)
}

interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number }
  trimmed: boolean
  spriteSourceSize: { x: number; y: number; w: number; h: number }
  sourceSize: { w: number; h: number }
}

const atlas = JSON.parse(readFileSync(publicPath(atlasUrl), 'utf8')) as {
  frames: Record<string, AtlasFrame>
  meta: { image: string; size: { w: number; h: number } }
}

function frameName(index: number): string {
  return `${framePrefix}${String(index).padStart(zeroPad, '0')}${frameSuffix}`
}

describe('placeholder atlas frames exist', () => {
  it(
    'the atlas json and its png are both on disk where the clip says',
    () => {
      expect(() => readFileSync(publicPath(atlasUrl))).not.toThrow()
      expect(() => readFileSync(publicPath(sheetUrl))).not.toThrow()

      // The json names its own image; if that disagrees with the clip's
      // sheetUrl, Phaser loads one file and indexes into another.
      expect(atlas.meta.image).toBe(sheetUrl.split('/').pop())
    },
    SCAN_TIMEOUT,
  )

  it(
    'every frame the clip range asks for is present, by exact name',
    () => {
      const missing: string[] = []

      for (let index = 0; index < frameCount; index++) {
        if (!atlas.frames[frameName(index)]) {
          missing.push(frameName(index))
        }
      }

      expect(missing).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'the atlas holds no frames beyond the declared count',
    () => {
      // The other direction, and not pedantry: extra frames mean the art has
      // moved on and the metadata has not, which is exactly the drift §3.3
      // accepted the risk of.
      expect(Object.keys(atlas.frames)).toHaveLength(frameCount)
    },
    SCAN_TIMEOUT,
  )

  it(
    'frames are really trimmed, so the trim path is exercised before real art',
    () => {
      // §3.4: a placeholder packed with identity trim would leave
      // spriteSourceSize handling untested until the first real atlas. Distinct
      // trimmed sizes prove the generator measured actual bounds.
      const distinctWidths = new Set(
        Object.values(atlas.frames).map((frame) => frame.spriteSourceSize.w),
      )

      expect(Object.values(atlas.frames).every((frame) => frame.trimmed)).toBe(true)
      expect(distinctWidths.size).toBeGreaterThan(1)
    },
    SCAN_TIMEOUT,
  )

  it(
    'every trimmed frame sits inside its untrimmed box, and inside the sheet',
    () => {
      for (const [name, frame] of Object.entries(atlas.frames)) {
        expect(
          frame.spriteSourceSize.x + frame.spriteSourceSize.w,
          `${name} overflows its sourceSize horizontally`,
        ).toBeLessThanOrEqual(frame.sourceSize.w)

        expect(
          frame.spriteSourceSize.y + frame.spriteSourceSize.h,
          `${name} overflows its sourceSize vertically`,
        ).toBeLessThanOrEqual(frame.sourceSize.h)

        expect(frame.frame.x + frame.frame.w, `${name} overflows the sheet`).toBeLessThanOrEqual(
          atlas.meta.size.w,
        )

        expect(frame.frame.y + frame.frame.h, `${name} overflows the sheet`).toBeLessThanOrEqual(
          atlas.meta.size.h,
        )
      }
    },
    SCAN_TIMEOUT,
  )

  it(
    "the clip's declared sourceSize is the box the atlas actually authored",
    () => {
      // The datum that sizes an animated sprite on screen. When it drifted from
      // the art, nothing failed and the player rendered 3.44x too wide
      // (measured 2026-09-11) — because the size came from a different file
      // entirely than the pixels did.
      //
      // Read from the catalogue rather than imported, like everything else in
      // this file: these guards police app code, so they do not import it.
      const declaredWidth = numberConstant(source, 'PLACEHOLDER_FRAME_WIDTH')
      const declaredHeight = numberConstant(source, 'PLACEHOLDER_FRAME_HEIGHT')

      for (const [name, frame] of Object.entries(atlas.frames)) {
        expect(frame.sourceSize.w, `${name}: authored width disagrees`).toBe(declaredWidth)
        expect(frame.sourceSize.h, `${name}: authored height disagrees`).toBe(declaredHeight)
      }
    },
    SCAN_TIMEOUT,
  )

  it(
    'nothing loads this atlas as a grid spritesheet any more',
    () => {
      // A leftover `load.spritesheet` on the atlas key would read the packed
      // sheet as a uniform grid and produce garbage frames, silently.
      const scenes = join(GAME_ROOT, 'src')

      const offenders: string[] = []

      const walk = (dir: string): void => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const full = join(dir, entry.name)

          if (entry.isDirectory()) {
            walk(full)
          } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.vue')) {
            const text = readFileSync(full, 'utf8')

            if (/load\s*\.\s*spritesheet\s*\(\s*PLACEHOLDER_SHEET_KEY/.test(text)) {
              offenders.push(full.slice(scenes.length + 1))
            }
          }
        }
      }

      walk(scenes)

      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )
})
