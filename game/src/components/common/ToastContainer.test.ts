// @vitest-environment jsdom
//
// Loot toast name pattern (item-info-card spec section 2 / Task 7): the
// toast renders ONE text-only pattern - the composed name in the
// payload's single color var (max-rank tone upgrades to the rainbow
// class) plus a muted middle-dot grade suffix. No per-segment coloring.
// Mounted via createApp/h (no @vue/test-utils in this project, same
// pattern as ItemCardBody.test.ts); the component teleports to <body>,
// so assertions query document.body.
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import { createPinia } from 'pinia'
import { i18n } from '@/i18n'
import { useNotificationStore } from '@/stores/notification'
import type { LootNotificationPresentation } from '@/core/notification/NotificationEvent'
import ToastContainer from './ToastContainer.vue'

const cleanup: Array<() => void> = []

// Mounts the container + its pinia, returns the notification store the
// component resolves (app.use(pinia) sets the active instance).
function mountToasts() {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp({ render: () => h(ToastContainer) })
  app.use(createPinia())
  app.use(i18n)
  app.mount(container)

  cleanup.push(() => {
    app.unmount()
    container.remove()
  })

  return useNotificationStore()
}

afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose()
})

async function pushLoot(loot: LootNotificationPresentation) {
  const notification = mountToasts()
  notification.push('loot', loot.name, loot)
  await nextTick()
}

// First child of .toast-item__name is the single-color name span; the
// optional grade suffix is the .toast-item__grade sibling.
function nameSpan(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('.toast-item__name > span')
}

describe('ToastContainer - loot name pattern (item-info-card spec section 2)', () => {
  it('applies the payload nameColorVar as the single name color', async () => {
    await pushLoot({
      name: 'Thanh Vân Kiếm',
      nameColorVar: '--rank-color-9',
      gradeLabel: 'Ngũ Phẩm',
    })

    const name = nameSpan()
    expect(name?.textContent).toBe('Thanh Vân Kiếm')
    expect(name?.getAttribute('style')).toContain('color: var(--rank-color-9)')
  })

  it('renders the grade as a muted middle-dot suffix - separate span, no name color', async () => {
    await pushLoot({
      name: 'Thanh Vân Kiếm',
      nameColorVar: '--rank-color-9',
      gradeLabel: 'Ngũ Phẩm',
    })

    const grade = document.body.querySelector<HTMLElement>('.toast-item__grade')
    expect(grade?.textContent?.trim()).toBe('· Ngũ Phẩm')
    // Muted styling lives on the scoped class - the suffix must not
    // inherit an inline color from the payload.
    expect(grade?.getAttribute('style') ?? '').not.toContain('color:')
    expect(nameSpan()?.textContent).not.toContain('Ngũ Phẩm')
  })

  it("max-rank nameTone ('tien') gets the rainbow class instead of the color", async () => {
    await pushLoot({
      name: 'Tiên Kiếm',
      nameColorVar: '--rank-color-9',
      nameTone: 'tien',
      gradeLabel: 'Tiên Phẩm',
    })

    const name = nameSpan()
    expect(name?.classList.contains('toast-item__segment--max-rank')).toBe(true)
    expect(name?.getAttribute('style') ?? '').not.toContain('color:')
  })

  it('omits the middle-dot suffix entirely when gradeLabel is absent', async () => {
    await pushLoot({
      name: 'Linh Thạch',
      nameColorVar: '--rank-color-3',
    })

    const nameLine = document.body.querySelector<HTMLElement>('.toast-item__name')
    expect(document.body.querySelector('.toast-item__grade')).toBeNull()
    expect(nameLine?.textContent).not.toContain('·')
  })
})
