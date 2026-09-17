// @vitest-environment jsdom
//
// T4-35 - the announcement overlay is ambient chrome: it must not leak
// its typewriter interval across unmount, must dismiss on Escape, and
// the store's auto-close timer must be a tracked handle (cleared by
// show()/hide()), not a fire-and-forget setTimeout.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { i18n } from '@/i18n'
import { useWorldAnnouncementStore } from '@/stores/worldAnnouncement'
import WorldAnnouncementOverlay from './WorldAnnouncementOverlay.vue'

const cleanup: Array<() => void> = []

function mountOverlay() {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp({ render: () => h(WorldAnnouncementOverlay) })
  app.use(createPinia())
  app.use(i18n)
  app.mount(container)

  cleanup.push(() => {
    app.unmount()
    container.remove()
  })

  return { app, container, store: useWorldAnnouncementStore() }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose()
  vi.useRealTimers()
})

describe('WorldAnnouncementOverlay lifecycle (T4-35)', () => {
  it('unmount clears the typewriter interval', async () => {
    const { app, store } = mountOverlay()
    store.show('Thiên đạo', 'một thông điệp rất dài cần gõ từ từ')
    await nextTick() // let the watch flush so the interval exists

    const clearSpy = vi.spyOn(globalThis, 'clearInterval')
    app.unmount()

    expect(clearSpy).toHaveBeenCalled()
  })

  it('Escape keydown dismisses the announcement', () => {
    const { store } = mountOverlay()
    store.show('Thiên đạo', 'nội dung')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(store.active).toBeNull()
  })

  it('hide() clears the pending auto-close timer (no stale callback left armed)', () => {
    setActivePinia(createPinia())
    const store = useWorldAnnouncementStore()

    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    store.show('A', 'body A')
    clearSpy.mockClear()
    store.hide()

    expect(clearSpy).toHaveBeenCalled()
  })

  it('a second show() retires the first auto-close timer', () => {
    setActivePinia(createPinia())
    const store = useWorldAnnouncementStore()

    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    store.show('A', 'body A')
    clearSpy.mockClear()
    store.show('B', 'body B')

    expect(clearSpy).toHaveBeenCalled()
  })
})
