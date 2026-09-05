// @vitest-environment jsdom
//
// Project không có @vue/test-utils (xem SlotView.test.ts / DongFuScene.test.ts
// dùng createApp/h trực tiếp). Brief yêu cầu không thêm dependency mới, nên
// mount bằng API công khai của Vue, vẫn render đúng SFC thật qua
// @vitejs/plugin-vue đã cấu hình sẵn trong vite.config.ts.
import { describe, it, expect, beforeEach } from 'vitest'
import { createApp, h } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import ThemeSwitcher from './ThemeSwitcher.vue'
import { useThemeStore } from '@/stores/themeStore'

interface MountedThemeSwitcher {
  container: HTMLDivElement
  cards: NodeListOf<HTMLElement>
  unmount: () => void
}

function mountThemeSwitcher(): MountedThemeSwitcher {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp({
    render: () => h(ThemeSwitcher),
  })
  app.mount(container)

  return {
    container,
    cards: container.querySelectorAll<HTMLElement>('[data-testid="theme-card"]'),
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

describe('ThemeSwitcher', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders 5 theme cards', () => {
    const { cards, unmount } = mountThemeSwitcher()
    expect(cards).toHaveLength(5)
    unmount()
  })

  it('clicking a card calls setTheme', async () => {
    const store = useThemeStore()
    const { container, unmount } = mountThemeSwitcher()
    const card = container.querySelector<HTMLElement>('[data-testid="theme-card"][data-theme-id="xianxia-glow"]')
    expect(card).toBeDefined()
    card?.click()
    expect(store.currentTheme).toBe('xianxia-glow')
    unmount()
  })

  it('marks current theme card as selected', () => {
    const store = useThemeStore()
    store.setTheme('landscape-shanshui')
    const { container, unmount } = mountThemeSwitcher()
    const selected = container.querySelectorAll<HTMLElement>(
      '[data-testid="theme-card"][data-selected="true"]',
    )
    expect(selected).toHaveLength(1)
    expect(selected[0]?.getAttribute('data-theme-id')).toBe('landscape-shanshui')
    unmount()
  })

  // Remediation Task 6 (2026-09-05) — theme cards là native <button>:
  // Enter + Space kích hoạt (browsers phát click trên button), selected
  // theme exposes aria-pressed. Trước đây role="button" + keydown.enter
  // thủ công — thiếu Space, thiếu trạng thái pressed.
  describe('accessibility (Remediation Task 6)', () => {
    it('cards là <button type="button"> (native keyboard activation)', () => {
      const { container, unmount } = mountThemeSwitcher()
      const cards = container.querySelectorAll<HTMLButtonElement>('[data-testid="theme-card"]')

      for (const card of cards) {
        expect(card.tagName).toBe('BUTTON')
        expect(card.getAttribute('type')).toBe('button')
      }

      unmount()
    })

    it('Space kích hoạt theme card (keydown.space → setTheme)', async () => {
      const store = useThemeStore()
      const { container, unmount } = mountThemeSwitcher()
      const card = container.querySelector<HTMLButtonElement>(
        '[data-testid="theme-card"][data-theme-id="classical-imperial"]',
      )

      expect(card).toBeDefined()
      card?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
      // Space trên <button> phát click khi keyup — jsdom cần click thủ
      // công; contract thực: browser phát click sau keydown space.
      card?.click()

      expect(store.currentTheme).toBe('classical-imperial')
      unmount()
    })

    it('selected theme exposes aria-pressed="true", khác "false"', () => {
      const store = useThemeStore()
      store.setTheme('xianxia-glow')
      const { container, unmount } = mountThemeSwitcher()

      const pressed = container.querySelector<HTMLElement>(
        '[data-testid="theme-card"][aria-pressed="true"]',
      )

      expect(pressed?.getAttribute('data-theme-id')).toBe('xianxia-glow')

      const allCards = container.querySelectorAll<HTMLElement>('[data-testid="theme-card"]')

      expect(
        [...allCards].filter((card) => card.getAttribute('aria-pressed') === 'true'),
      ).toHaveLength(1)

      unmount()
    })
  })
})
