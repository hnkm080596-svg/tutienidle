// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, type App } from 'vue'
import GamePanel from './GamePanel.vue'
import OverlayPanel from './OverlayPanel.vue'
import confirmSource from './ConfirmModal.vue?raw'
import victorySource from '@/components/game/combat/CombatVictoryPanel.vue?raw'
import defeatSource from '@/components/game/combat/CombatDefeatPanel.vue?raw'

const mounted: Array<{ app: App; container: HTMLElement }> = []

function mount(component: Parameters<typeof h>[0], props: Record<string, unknown>) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp({ render: () => h(component, props, { default: () => 'Nội dung' }) })
  app.mount(container)
  mounted.push({ app, container })
  return container
}

afterEach(() => {
  for (const entry of mounted.splice(0)) {
    entry.app.unmount()
    entry.container.remove()
  }
})

describe('ink-wash large surfaces', () => {
  it('uses M paper plus L frame for regular panels and XL pair for ornate panels', () => {
    const regular = mount(GamePanel, {})
    const ornate = mount(GamePanel, { variant: 'ornate' })

    expect(regular.querySelector('[data-ink-slice="surface-m-paper"]')).not.toBeNull()
    expect(regular.querySelector('[data-ink-slice="frame-l-landscape"]')).not.toBeNull()
    expect(ornate.querySelector('[data-ink-slice="surface-xl-paper-scroll"]')).not.toBeNull()
    expect(ornate.querySelector('[data-ink-slice="frame-xl-ceremony"]')).not.toBeNull()
  })

  it('keeps OverlayPanel dialog and the click-outside close path around the XL shell', () => {
    const onClose = vi.fn()
    const container = mount(OverlayPanel, { open: true, title: 'Đối thoại', onClose })
    const overlay = container.querySelector<HTMLElement>('.overlay-panel')!
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!

    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.querySelector('[data-ink-slice="surface-xl-paper-scroll"]')).not.toBeNull()
    expect(dialog.querySelector('[data-ink-slice="frame-xl-ceremony"]')).not.toBeNull()
    overlay.click()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('adds ceremonial layers without removing modal and combat actions', () => {
    for (const source of [confirmSource, victorySource, defeatSource]) {
      expect(source).toContain('asset-id="surface-xl-paper-scroll"')
      expect(source).toContain('asset-id="frame-xl-ceremony"')
    }
    expect(confirmSource).toContain("emit('confirm')")
    expect(victorySource).toContain('startAutoRefightCountdown')
    expect(defeatSource).toContain('startAutoRetryCountdown')
  })

})
