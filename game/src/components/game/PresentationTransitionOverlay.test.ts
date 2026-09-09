// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { i18n } from '@/i18n'
import PresentationTransitionOverlay from './PresentationTransitionOverlay.vue'

describe('PresentationTransitionOverlay', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  function mountOverlay(props: Record<string, unknown> = {}) {
    const overlayRef = ref<any>(null)
    const app = createApp({
      render: () => h(PresentationTransitionOverlay, { ref: overlayRef, ...props }),
    })
    app.use(i18n)
    app.mount(container)

    return {
      instance: overlayRef.value,
      unmount: () => {
        app.unmount()
        container.remove()
      },
    }
  }

  it('exposes close and open methods', () => {
    const { instance, unmount } = mountOverlay()
    expect(instance.close).toBeDefined()
    expect(instance.open).toBeDefined()
    unmount()
  })

  it('reduced motion resolves close immediately on nextTick', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })))

    const { instance, unmount } = mountOverlay()
    const signal = new AbortController().signal

    await expect(instance.close(1, signal)).resolves.toBeUndefined()
    expect(instance.curtainState).toBe('closed')

    await expect(instance.open(1, signal)).resolves.toBeUndefined()
    expect(instance.curtainState).toBe('opened')

    unmount()
  })

  it('aborting signal cancels curtain animation and rejects with error', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      media: '',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))

    const { instance, unmount } = mountOverlay()
    const controller = new AbortController()

    const closePromise = instance.close(1, controller.signal)
    controller.abort()

    await expect(closePromise).rejects.toThrow('Curtain animation aborted')
    unmount()
  })

  it('intercepts keyboard events while locked to prevent activating elements underneath', async () => {
    const { unmount } = mountOverlay({ isLocked: true })

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

    window.dispatchEvent(event)
    expect(preventDefaultSpy).toHaveBeenCalled()

    unmount()
  })

  it('allows clicking retry button when error is displayed', async () => {
    let retryEmitted = false
    const overlayRef = ref<any>(null)
    const app = createApp({
      render: () =>
        h(PresentationTransitionOverlay, {
          ref: overlayRef,
          phase: 'failed',
          isLocked: true,
          error: {
            message: 'Physical asset load failed',
            failedRequest: { target: 'home' },
            availableRenderer: 'home',
          },
          onRetry: () => {
            retryEmitted = true
          },
        }),
    })
    app.use(i18n)
    app.mount(container)

    await nextTick()

    const retryBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="presentation-retry-button"]',
    )
    expect(retryBtn).not.toBeNull()
    retryBtn?.click()

    expect(retryEmitted).toBe(true)

    app.unmount()
  })
})
