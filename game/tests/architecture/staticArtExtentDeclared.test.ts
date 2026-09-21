/**
 * Guard every static-mode PNG's declared sourceSize/extent against the file
 * on disk.
 *
 * `resolveEntityDisplaySize` divides personHeight by `extent.h` to get the
 * drawn box - a stale declared extent after a PNG swap silently resizes the
 * character while every test stays green. The extents are measured by
 * scripts/measure-entity-extents.mjs and pasted into
 * CombatPresentationCatalogue; this test re-measures so the paste cannot
 * drift.
 *
 * UNTRIMMED_FULL_BOX_EXTENT is exempt from the alpha-bbox check by design:
 * for the Mortal enemy batch the whole file is the entity's frame - the
 * margins encode relative creature sizes, they are not trimming waste.
 * Those entries still get their sourceSize verified against the real image
 * dimensions.
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { createCanvas, loadImage } from 'canvas'
import {
  combatPresentationEntityKeys,
  staticArtFormFor,
  UNTRIMMED_FULL_BOX_EXTENT,
} from '@/presentation/art/CombatPresentationCatalogue'
import type { ArtExtent } from '@/presentation/art/CombatEntityPresentation'
import { SCAN_TIMEOUT } from './helpers/scanTs'

const GAME_ROOT = process.cwd()

function publicPath(url: string): string {
  return join(GAME_ROOT, 'public', url)
}

/** Same measurement as opaqueBounds() in scripts/measure-entity-extents.mjs. */
function measuredExtent(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  w: number,
  h: number,
): ArtExtent {
  const { data } = ctx.getImageData(0, 0, w, h)
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] === 0) {
        continue
      }

      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  if (maxX < 0) {
    throw new Error('fully transparent image')
  }

  return {
    x: minX / w,
    y: minY / h,
    w: (maxX - minX + 1) / w,
    h: (maxY - minY + 1) / h,
  }
}

const entityKeys = combatPresentationEntityKeys()

describe('static art extents', () => {
  it(
    'every registered static form declares a sourceSize that matches its PNG',
    async () => {
      for (const entityKey of entityKeys) {
        const form = staticArtFormFor(entityKey)

        if (!form) {
          throw new Error(`Expected static form for '${entityKey}'`)
        }

        const image = await loadImage(publicPath(form.texture.textureUrl))

        expect(
          { w: image.width, h: image.height },
          `${entityKey}: declared sourceSize does not match ${form.texture.textureUrl}`,
        ).toEqual(form.texture.sourceSize)
      }
    },
    SCAN_TIMEOUT,
  )

  it(
    'every trimmed declared extent equals the PNG alpha bbox',
    async () => {
      for (const entityKey of entityKeys) {
        const form = staticArtFormFor(entityKey)

        if (!form) {
          throw new Error(`Expected static form for '${entityKey}'`)
        }

        // Full-box entries (Mortal enemy batch) declare their margins as
        // composition - no alpha-bbox contract applies.
        if (form.texture.extent === UNTRIMMED_FULL_BOX_EXTENT) {
          continue
        }

        const image = await loadImage(publicPath(form.texture.textureUrl))
        const canvas = createCanvas(image.width, image.height)
        const ctx = canvas.getContext('2d')

        ctx.drawImage(image, 0, 0)

        const measured = measuredExtent(ctx, image.width, image.height)

        // Catalogue extents are pasted at 6 decimals - 1e-6 epsilon is the
        // rounding floor, not slop.
        expect(measured.x, `${entityKey}: extent.x drifted`).toBeCloseTo(form.texture.extent.x, 5)
        expect(measured.y, `${entityKey}: extent.y drifted`).toBeCloseTo(form.texture.extent.y, 5)
        expect(measured.w, `${entityKey}: extent.w drifted`).toBeCloseTo(form.texture.extent.w, 5)
        expect(measured.h, `${entityKey}: extent.h drifted`).toBeCloseTo(form.texture.extent.h, 5)
      }
    },
    SCAN_TIMEOUT,
  )
})
