// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, ref } from 'vue'
import { i18n } from '@/i18n'
import AuthOpeningCurtain from './AuthOpeningCurtain.vue'

const cleanup: Array<() => void> = []
beforeEach(() => {
  const original = HTMLImageElement.prototype.decode
  HTMLImageElement.prototype.decode = vi.fn(async () => {})
  cleanup.push(() => { HTMLImageElement.prototype.decode = original })
})
afterEach(() => { cleanup.splice(0).forEach((fn) => fn()); vi.restoreAllMocks() })
function mountCurtain(progress = 1) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const instance = ref<InstanceType<typeof AuthOpeningCurtain> | null>(null)
  const app = createApp({ render: () => h(AuthOpeningCurtain, { ref: instance, progress }) })
  app.use(i18n)
  app.mount(host)
  cleanup.push(() => { app.unmount(); host.remove() })
  return { host, instance }
}

describe('auth cloud curtain lifecycle', () => {
  it('caps loading below 100 until the coordinator opens the curtain', async () => {
    const { host, instance } = mountCurtain()
    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('99')
    await instance.value!.open(1, new AbortController().signal)
    expect(host.querySelector('[data-testid="auth-opening-curtain"]')).toBeNull()
  })
  it('does not expose the scene when opening is already aborted', async () => {
    const { host, instance } = mountCurtain()
    const controller = new AbortController()
    controller.abort()
    await expect(instance.value!.open(1, controller.signal)).rejects.toThrow()
    expect(host.querySelector('[data-testid="auth-opening-curtain"]')).not.toBeNull()
  })
  it('aborts an in-flight reveal and keeps clouds for a later retry', async () => {
    let cancelCount = 0
    const original = Element.prototype.animate
    cleanup.push(() => { Element.prototype.animate = original })
    Element.prototype.animate = vi.fn(() => ({
      finished: new Promise<Animation>(() => {}), cancel: () => { cancelCount++ },
    }) as Animation)
    const { host, instance } = mountCurtain()
    const controller = new AbortController()
    const opening = instance.value!.open(1, controller.signal)
    await vi.waitFor(() => expect(Element.prototype.animate).toHaveBeenCalled())
    controller.abort()
    await expect(opening).rejects.toThrow()
    expect(cancelCount).toBeGreaterThan(0)
    expect(host.querySelector('[data-testid="auth-opening-curtain"]')).not.toBeNull()
  })
})
