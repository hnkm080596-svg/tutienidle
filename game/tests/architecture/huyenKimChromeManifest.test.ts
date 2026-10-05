import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { chromeSlice, HUYEN_KIM_CHROME, pendingChromeIds } from '@/ui/huyenKimChrome'

// The chrome manifest is Minh's art-drop contract: every slot he draws lands
// under public/assets/ui/huyen-kim/ and flips status 'pending' -> 'ready' in
// the JSON - no code edits. These tests pin the manifest shape and the
// pending/ready resolution contract so a bad art drop fails loudly here.
const PUBLIC_DIR = join(process.cwd(), 'public')

describe('huyen-kim chrome manifest', () => {
  it('asset ids are unique and every asset has a well-formed slice box', () => {
    const ids = Object.keys(HUYEN_KIM_CHROME)
    expect(ids.length).toBeGreaterThanOrEqual(20)
    expect(new Set(ids).size).toBe(ids.length)
    for (const a of Object.values(HUYEN_KIM_CHROME)) {
      expect(a.url1x, a.id).toMatch(/assets\/ui\/(?:huyen-kim|tien-hiep-2026-10)\/.+@1x\.png$/)
      expect(a.url2x, a.id).toMatch(/assets\/ui\/(?:huyen-kim|tien-hiep-2026-10)\/.+@2x\.png$/)
      expect(a.sourceWidth, a.id).toBeGreaterThan(0)
      expect(a.sourceHeight, a.id).toBeGreaterThan(0)
      for (const edge of ['left', 'right', 'top', 'bottom'] as const) {
        expect(a.slices[edge], `${a.id}.${edge}`).toBeGreaterThanOrEqual(0)
      }
      expect(a.slices.left + a.slices.right, a.id).toBeLessThan(a.sourceWidth)
      expect(a.slices.top + a.slices.bottom, a.id).toBeLessThan(a.sourceHeight)
      expect(['fill', 'transparent', 'stretch']).toContain(a.center)
      expect(['stretch', 'tile']).toContain(a.edgeMode)
    }
  })

  it('pending slots resolve to null so consumers fall back to CSS chrome', () => {
    for (const id of pendingChromeIds()) {
      expect(chromeSlice(id), id).toBeNull()
      expect(HUYEN_KIM_CHROME[id]?.status, id).toBe('pending')
    }
  })

  it('ready slots resolve to slice data and their files exist under public/', () => {
    for (const a of Object.values(HUYEN_KIM_CHROME).filter((x) => x.status === 'ready')) {
      for (const url of [a.url1x, a.url2x]) {
        const onDisk = join(PUBLIC_DIR, url.replace(/^\//, ''))
        expect(existsSync(onDisk), `${a.id}: ${url} missing on disk`).toBe(true)
      }
      const resolved = chromeSlice(a.id)
      expect(resolved, a.id).not.toBeNull()
      expect(resolved?.url1x).toBe(a.url1x)
      expect(resolved?.slices).toEqual(a.slices)
    }
  })

  // Reference-fidelity Task 1: declared sourceWidth/sourceHeight must match
  // the real PNG (IHDR), and @2x must be exactly 2x - a mismatch makes
  // border-image-slice cut the art at the wrong relative position (halved
  // or doubled border thickness at DPR 2).
  function pngSize(relUrl: string): { width: number; height: number } {
    const buf = readFileSync(join(PUBLIC_DIR, relUrl.replace(/^\//, '')))
    expect(buf.slice(12, 16).toString('ascii')).toBe('IHDR')
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  }

  it('declared source dims match the @1x IHDR and @2x is exactly 2x', () => {
    for (const a of Object.values(HUYEN_KIM_CHROME).filter((x) => x.status === 'ready')) {
      expect(pngSize(a.url1x), `${a.id} @1x vs sourceWidth/Height`).toEqual({
        width: a.sourceWidth,
        height: a.sourceHeight,
      })
      expect(pngSize(a.url2x), `${a.id} @2x density parity`).toEqual({
        width: a.sourceWidth * 2,
        height: a.sourceHeight * 2,
      })
    }
  })

  it('chromeSlice returns null for unknown ids (typo safety)', () => {
    expect(chromeSlice('frame-not-a-slot')).toBeNull()
  })
})
