// @vitest-environment node
// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { execFileSync } from 'node:child_process'
// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { readFileSync } from 'node:fs'
// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { dongFuLayerList } from '@/game/support/DongFuArt'
import { THANH_VAN_SEASONS, THANH_VAN_TIMES } from '@/game/support/ThanhVanArt'

const variants = THANH_VAN_SEASONS.flatMap((season) =>
  THANH_VAN_TIMES.map((time) => ({ season, time })),
)

const urls = [
  ...new Set(variants.flatMap((variant) => dongFuLayerList(variant).map((layer) => layer.url))),
]

function sampleAlpha(url: string, x: number, y: number): number {
  const file = fileURLToPath(new URL(`../../public${url}`, import.meta.url))
  return Number(execFileSync(
    'magick',
    [file, '-crop', `1x1+${x}+${y}`, '-format', '%[fx:a]', 'info:'],
    { encoding: 'utf8' },
  ).trim())
}

describe('Dong Fu modular background assets', () => {
  it('contains exactly forty aligned runtime PNGs with the required alpha contract', () => {
    expect(urls).toHaveLength(40)

    for (const url of urls) {
      const png = readFileSync(new URL(`../../public${url}`, import.meta.url))

      expect([...png.subarray(0, 8)], url).toEqual([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ])
      expect(png.readUInt32BE(16), url).toBe(1672)
      expect(png.readUInt32BE(20), url).toBe(941)
      expect(png[25], url).toBe(url.endsWith('/00-sky.png') ? 2 : 6)
    }
  })

  it('keeps the lake above the cultivation dais transparent without erasing the dais', () => {
    for (const season of THANH_VAN_SEASONS) {
      const url = `/assets/backgrounds/dong-fu/modular/seasons/${season}/07-sect-ground.png`

      expect(sampleAlpha(url, 836, 680), `${season} rectangular matte`).toBeLessThanOrEqual(0.02)
      expect(sampleAlpha(url, 836, 710), `${season} cultivation dais`).toBeGreaterThan(0.8)
    }
  })
})
