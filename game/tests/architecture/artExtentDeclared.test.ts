/**
 * Guard (Spec C §5) — the declared extent is the box the art actually occupies.
 *
 * Spec: docs/superpowers/specs/2026-09-12-combat-anchor-scale-geometry-design.md
 * §4.1 and §5.
 *
 * This is the datum that sizes every animated character (§3.2). When the size
 * came from a different file than the pixels did, the player rendered 3.44x too
 * wide and nothing failed (commit c0826723). This guard reads the atlas JSON on
 * disk so that cannot recur silently.
 *
 * Guards police app code, so they re-read the catalogue's constants from source
 * rather than importing it — the same rule `atlasFramesExist.test.ts` follows.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SCAN_TIMEOUT } from './helpers/scanTs'

const GAME_ROOT = process.cwd()

const CATALOGUE_SOURCE = join(
  GAME_ROOT,
  'src',
  'presentation',
  'art',
  'CombatPresentationCatalogue.ts',
)

const source = readFileSync(CATALOGUE_SOURCE, 'utf8')

function numberConstant(name: string): number {
  const match = new RegExp(`export const ${name} = ([\\d.]+)`).exec(source)

  if (!match) {
    throw new Error(`constant ${name} not found in CombatPresentationCatalogue.ts`)
  }

  return Number(match[1])
}

function stringConstant(name: string): string {
  const match = new RegExp(`export const ${name} = '([^']*)'`).exec(source)

  if (!match) {
    throw new Error(`constant ${name} not found in CombatPresentationCatalogue.ts`)
  }

  return match[1]!
}

interface AtlasFrame {
  spriteSourceSize: { x: number; y: number; w: number; h: number }
  sourceSize: { w: number; h: number }
}

const atlas = JSON.parse(
  readFileSync(join(GAME_ROOT, 'public', stringConstant('PLACEHOLDER_ATLAS_URL')), 'utf8'),
) as { frames: Record<string, AtlasFrame> }

/** The frame whose art is tallest — the one the declared extent must describe. */
function tallestFrame(): AtlasFrame {
  return Object.values(atlas.frames).reduce((tallest, frame) =>
    frame.spriteSourceSize.h > tallest.spriteSourceSize.h ? frame : tallest,
  )
}

describe('declared art extent', () => {
  it(
    'the placeholder clip extent matches the tallest frame in the atlas on disk',
    () => {
      const frame = tallestFrame()

      expect(numberConstant('PLACEHOLDER_EXTENT_X')).toBeCloseTo(
        frame.spriteSourceSize.x / frame.sourceSize.w,
        4,
      )
      expect(numberConstant('PLACEHOLDER_EXTENT_Y')).toBeCloseTo(
        frame.spriteSourceSize.y / frame.sourceSize.h,
        4,
      )
      expect(numberConstant('PLACEHOLDER_EXTENT_W')).toBeCloseTo(
        frame.spriteSourceSize.w / frame.sourceSize.w,
        4,
      )
      expect(numberConstant('PLACEHOLDER_EXTENT_H')).toBeCloseTo(
        frame.spriteSourceSize.h / frame.sourceSize.h,
        4,
      )
    },
    SCAN_TIMEOUT,
  )

  it(
    'the placeholder art is genuinely trimmed, so the extent path is exercised',
    () => {
      // An extent of {0,0,1,1} would make every formula in §3.2 collapse to the
      // old box-sizing behaviour, and this guard would pass while proving
      // nothing. Enemies legitimately have that; the placeholder must not.
      expect(numberConstant('PLACEHOLDER_EXTENT_H')).toBeLessThan(1)
      expect(numberConstant('PLACEHOLDER_EXTENT_W')).toBeLessThan(1)
    },
    SCAN_TIMEOUT,
  )
})
