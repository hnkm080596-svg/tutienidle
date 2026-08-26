// @vitest-environment jsdom
//
// Depth layer tường minh cho background (yêu cầu 2026-08-26): xác nhận
// depth GẮN CHO TỪNG TEXTURE KEY (không chỉ thứ tự mảng add):
//   sky < far mountains < midground < atmosphere < battle ground
//     < foreground left/right < time grading, và tất cả < DEPTH_GROUND_GRID.
import { describe, expect, it } from 'vitest'
import { DEPTH_GROUND_GRID, DEPTH_THANH_VAN_TIME_GRADE } from './BattleLayers'
import { attachThanhVanBackdrop } from './ThanhVanBackdrop'
import { THANH_VAN_SEASONS, THANH_VAN_TIMES } from './ThanhVanArt'

interface FakeImage {
  textureKey: string

  depth: number

  setOrigin(): this

  setDepth(depth: number): this

  setDisplaySize(): this

  setPosition(): this
}

function createFakeScene() {
  const images: FakeImage[] = []

  const scene = {
    add: {
      image(_x: number, _y: number, textureKey: string) {
        const image: FakeImage = {
          textureKey,

          depth: Number.NaN,

          setOrigin() {
            return image
          },

          setDepth(depth: number) {
            image.depth = depth

            return image
          },

          setDisplaySize() {
            return image
          },

          setPosition() {
            return image
          },
        }

        images.push(image)

        return image
      },

      rectangle() {
        const rect = {
          depth: Number.NaN,

          setOrigin() {
            return rect
          },

          setDepth(depth: number) {
            rect.depth = depth

            return rect
          },

          setSize() {
            return rect
          },

          setPosition() {
            return rect
          },
        }

        return rect
      },
    },
  }

  return { scene, images }
}

describe('ThanhVanBackdrop — depth theo texture key', () => {
  it('mỗi texture key nhận đúng lớp depth của nó', () => {
    const variant = { season: 'spring' as const, time: 'morning' as const }
    const { scene } = createFakeScene()

    const handle = attachThanhVanBackdrop(scene as never, variant, 1600, 900)

    const byKey = handle.depthByKey()

    expect(byKey.get('tv-morning-sky')).toBe(1)

    expect(byKey.get('tv-spring-01-far-mountains')).toBe(2)

    expect(byKey.get('tv-spring-02-midground')).toBe(3)

    expect(byKey.get('tv-spring-03-battle-ground')).toBe(5)

    // Lỗi thật đã gặp: atmosphere từng đè lên battle ground vì cùng depth.
    expect(byKey.get('tv-spring-06-atmosphere')).toBeLessThan(
      byKey.get('tv-spring-03-battle-ground')!,
    )

    expect(byKey.get('tv-spring-04-foreground-left')).toBeGreaterThan(
      byKey.get('tv-spring-03-battle-ground')!,
    )

    expect(byKey.get('tv-spring-05-foreground-right')).toBeGreaterThan(
      byKey.get('tv-spring-03-battle-ground')!,
    )
  })

  it('thứ tự bắt buộc giữ đúng qua MỌI 16 variant', () => {
    for (const season of THANH_VAN_SEASONS) {
      for (const time of THANH_VAN_TIMES) {
        const { scene } = createFakeScene()

        const handle = attachThanhVanBackdrop(scene as never, variant(season, time), 1600, 900)

        const byKey = handle.depthByKey()

        const sky = byKey.get(`tv-${time}-sky`)!
        const far = byKey.get(`tv-${season}-01-far-mountains`)!
        const mid = byKey.get(`tv-${season}-02-midground`)!
        const atmosphere = byKey.get(`tv-${season}-06-atmosphere`)!
        const ground = byKey.get(`tv-${season}-03-battle-ground`)!
        const fgLeft = byKey.get(`tv-${season}-04-foreground-left`)!
        const fgRight = byKey.get(`tv-${season}-05-foreground-right`)!

        expect(sky).toBeLessThan(far)

        expect(far).toBeLessThan(mid)

        expect(mid).toBeLessThan(atmosphere)

        expect(atmosphere).toBeLessThan(ground)

        expect(ground).toBeLessThan(fgLeft)

        expect(ground).toBeLessThan(fgRight)

        // Mọi depth background vẫn NHỎ HƠN lớp grid mặt đất.
        expect(Math.max(sky, far, mid, atmosphere, ground, fgLeft, fgRight)).toBeLessThan(
          DEPTH_GROUND_GRID,
        )
      }
    }
  })

  it('grading overlay nằm trên mọi layer background và dưới grid', () => {
    const { scene } = createFakeScene()

    const handle = attachThanhVanBackdrop(scene as never, { season: 'winter', time: 'night' }, 1600, 900)

    const maxBackgroundDepth = Math.max(...[...handle.depthByKey().values()])

    expect(DEPTH_THANH_VAN_TIME_GRADE).toBeGreaterThan(maxBackgroundDepth)

    expect(DEPTH_THANH_VAN_TIME_GRADE).toBeLessThan(DEPTH_GROUND_GRID)
  })
})

function variant(season: (typeof THANH_VAN_SEASONS)[number], time: (typeof THANH_VAN_TIMES)[number]) {
  return { season, time }
}
