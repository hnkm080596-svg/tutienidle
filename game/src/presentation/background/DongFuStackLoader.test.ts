import { describe, expect, it, vi } from 'vitest'
import { dongFuLayerList } from './DongFuArt'
import { preloadDongFuStack } from './DongFuStackLoader'

describe('preloadDongFuStack', () => {
  const layers = dongFuLayerList({ season: 'spring', time: 'morning' })

  it('resolves only after every layer loads', async () => {
    const loadImage = vi.fn(async () => undefined)

    await expect(preloadDongFuStack(layers, loadImage)).resolves.toEqual(layers)
    expect(loadImage).toHaveBeenCalledTimes(10)
  })

  it('rejects the complete stack when any layer fails', async () => {
    const loadImage = vi.fn(async (url: string) => {
      if (url.endsWith('08-low-mist.png')) {
        throw new Error('missing mist')
      }
    })

    await expect(preloadDongFuStack(layers, loadImage)).rejects.toThrow('missing mist')
  })
})
