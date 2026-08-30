import { describe, expect, it } from 'vitest'
import { THANH_VAN_SEASONS, THANH_VAN_TIMES } from './ThanhVanArt'
import { DONG_FU_LAYER_COUNT, dongFuLayerList } from './DongFuArt'

describe('DongFuArt', () => {
  it('maps a variant to three time layers followed by seven season layers', () => {
    const layers = dongFuLayerList({ season: 'winter', time: 'night' })

    expect(layers).toHaveLength(10)
    expect(layers.map((layer) => layer.url)).toEqual([
      '/assets/backgrounds/dong-fu/modular/times/night/00-sky.png',
      '/assets/backgrounds/dong-fu/modular/times/night/01-high-clouds.png',
      '/assets/backgrounds/dong-fu/modular/times/night/02-light-veil.png',
      '/assets/backgrounds/dong-fu/modular/seasons/winter/03-far-mountains.png',
      '/assets/backgrounds/dong-fu/modular/seasons/winter/04-distant-ledges.png',
      '/assets/backgrounds/dong-fu/modular/seasons/winter/05-mid-landscape.png',
      '/assets/backgrounds/dong-fu/modular/seasons/winter/06-water-valley.png',
      '/assets/backgrounds/dong-fu/modular/seasons/winter/07-sect-ground.png',
      '/assets/backgrounds/dong-fu/modular/seasons/winter/08-low-mist.png',
      '/assets/backgrounds/dong-fu/modular/seasons/winter/09-foreground.png',
    ])
    expect(layers.map((layer) => layer.shiftX)).toEqual([0, 1, 2, 4, 6, 8, 10, 12, 14, 18])
    expect(DONG_FU_LAYER_COUNT).toBe(10)
  })

  it('produces ten unique keys for each of the sixteen variants', () => {
    for (const season of THANH_VAN_SEASONS) {
      for (const time of THANH_VAN_TIMES) {
        const layers = dongFuLayerList({ season, time })

        expect(layers).toHaveLength(10)
        expect(new Set(layers.map((layer) => layer.key)).size).toBe(10)
      }
    }
  })
})
