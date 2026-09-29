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

  // F-BX-54 - the error card is a keyboard-reachable dialog: the
  // window-capture guard suppresses keys outside the card, so focus must
  // move in on open and Tab must cycle inside it via useDialogFocus.
  it('moves focus into the error card on show and cycles Tab inside it', async () => {
    const { unmount } = mountOverlay({
      phase: 'failed',
      isLocked: true,
      error: {
        message: 'Physical asset load failed',
        failedRequest: { target: 'home' },
        availableRenderer: 'home',
      },
    })
    await nextTick()
    await nextTick()

    const retryBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="presentation-retry-button"]',
    )
    const backBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="presentation-back-button"]',
    )
    expect(retryBtn).not.toBeNull()
    expect(backBtn).not.toBeNull()

    // Focus-on-open lands on the first action inside the card.
    expect(document.activeElement).toBe(retryBtn)

    retryBtn!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(backBtn)

    backBtn!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(retryBtn)

    retryBtn!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(backBtn)

    unmount()
  })

  it('suppresses Tab outside the error card but forwards keys inside it to the trap', async () => {
    const { unmount } = mountOverlay({
      phase: 'failed',
      isLocked: true,
      error: {
        message: 'Physical asset load failed',
        failedRequest: { target: 'home' },
        availableRenderer: 'home',
      },
    })
    await nextTick()
    await nextTick()

    // A keydown not targeting the card is still swallowed app-wide.
    const outside = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    const outsideSpy = vi.spyOn(outside, 'preventDefault')
    window.dispatchEvent(outside)
    expect(outsideSpy).toHaveBeenCalled()

    // The same key inside the card must reach the focus trap - if the
    // window-capture guard ate it first, focus would not move.
    const retryBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="presentation-retry-button"]',
    )
    const backBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="presentation-back-button"]',
    )
    retryBtn!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(backBtn)

    unmount()
  })

  it('Escape inside the error card emits back when return-home is allowed', async () => {
    let backEmitted = false
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
          onBack: () => {
            backEmitted = true
          },
        }),
    })
    app.use(i18n)
    app.mount(container)
    await nextTick()
    await nextTick()

    const retryBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="presentation-retry-button"]',
    )
    retryBtn!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))

    expect(backEmitted).toBe(true)
    app.unmount()
  })

  it('resolves immediately when the panels already sit at the requested state', async () => {
    vi.useFakeTimers()
    const { instance, unmount } = mountOverlay()

    try {
      let settled = false
      const controller = new AbortController()
      const promise = instance.open(1, controller.signal).then(() => {
        settled = true
      })

      await nextTick()
      await nextTick()

      expect(settled).toBe(true)
      expect(instance.curtainState).toBe('opened')

      await promise
    } finally {
      vi.useRealTimers()
      unmount()
    }
  })
})
