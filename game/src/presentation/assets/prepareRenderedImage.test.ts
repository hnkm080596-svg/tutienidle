// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { prepareRenderedImage } from './prepareRenderedImage'

describe('rendered image readiness after asset retry', () => {
  it('reassigns a failed element source before decoding cached resource bytes', async () => {
    const image = document.createElement('img')
    image.src = '/mortal.png'
    Object.defineProperty(image, 'complete', { value: true })
    const setSource = vi.spyOn(image, 'src', 'set')
    image.decode = vi.fn(async () => {})
    await prepareRenderedImage(image, new AbortController().signal)
    expect(setSource).toHaveBeenCalledWith(image.src)
    expect(image.decode).toHaveBeenCalledOnce()
  })
  it('rejects stale completion without revealing an aborted opening', async () => {
    const image = document.createElement('img')
    let finish!: () => void
    image.decode = () => new Promise<void>((resolve) => { finish = resolve })
    const controller = new AbortController()
    const preparing = prepareRenderedImage(image, controller.signal)
    controller.abort()
    finish()
    await expect(preparing).rejects.toThrow()
  })
})
