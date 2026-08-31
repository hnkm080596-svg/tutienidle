// @vitest-environment jsdom
//
// Project không có @vue/test-utils (xem ThemeSwitcher.test.ts dùng createApp/h).
// Brief yêu cầu không thêm dependency mới, nên mount bằng API công khai của
// Vue, vẫn render đúng SFC thật qua @vitejs/plugin-vue đã cấu hình sẵn.
import { describe, it, expect } from 'vitest'
import { createApp, h } from 'vue'
import MenuButton from './MenuButton.vue'

interface MountedMenuButton {
  container: HTMLDivElement
  button: HTMLButtonElement | null
  unmount: () => void
}

function mountMenuButton(props: {
  label: string
  variant?: 'primary' | 'secondary'
  disabled?: boolean
}): MountedMenuButton {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp({
    render: () => h(MenuButton, props),
  })
  app.mount(container)

  return {
    container,
    button: container.querySelector<HTMLButtonElement>('button.menu-button'),
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

describe('MenuButton', () => {
  it('renders label', () => {
    const { button, unmount } = mountMenuButton({ label: 'Bắt đầu' })
    expect(button?.textContent).toContain('Bắt đầu')
    unmount()
  })

  it('emits click event on press', () => {
    let emittedClicks = 0

    const container = document.createElement('div')
    document.body.appendChild(container)
    const app = createApp({
      components: { MenuButton },
      template: `<MenuButton label="Test" @click="onClick" />`,
      methods: {
        onClick() { emittedClicks++ },
      },
    })
    app.mount(container)

    const button = container.querySelector<HTMLButtonElement>('button.menu-button')
    expect(button).not.toBeNull()
    button!.click()

    expect(emittedClicks).toBe(1)

    app.unmount()
    container.remove()
  })

  it('applies primary variant class', () => {
    const { button, unmount } = mountMenuButton({ label: 'X', variant: 'primary' })
    expect(button?.classList.contains('menu-button--primary')).toBe(true)
    unmount()
  })

  it('applies secondary variant class', () => {
    const { button, unmount } = mountMenuButton({ label: 'X', variant: 'secondary' })
    expect(button?.classList.contains('menu-button--secondary')).toBe(true)
    unmount()
  })
})