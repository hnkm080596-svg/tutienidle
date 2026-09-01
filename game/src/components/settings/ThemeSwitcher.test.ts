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
})
