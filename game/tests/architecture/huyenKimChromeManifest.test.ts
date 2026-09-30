import { existsSync } from 'node:fs'
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
      expect(a.url1x, a.id).toMatch(/assets\/ui\/huyen-kim\/.+@1x\.png$/)
      expect(a.url2x, a.id).toMatch(/assets\/ui\/huyen-kim\/.+@2x\.png$/)
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

  it('chromeSlice returns null for unknown ids (typo safety)', () => {
    expect(chromeSlice('frame-not-a-slot')).toBeNull()
  })
})
