// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, type App } from 'vue'
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

// M13: the GamePanel mounting case was dropped with the component (zero
// template/tooling consumers). The XL surface/frame pairing contract it
// exercised is still pinned below through the live OverlayPanel shell
// plus the raw-source assertions on the ceremonial panels.
describe('ink-wash large surfaces', () => {
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
    // M-UI-SYSTEM: ConfirmModal migrated to SysModalBase (system chrome) -
    // it intentionally no longer carries the XL ink layers, so only the
    // combat victory/defeat panels stay in this ceremonial assertion.
    for (const source of [victorySource, defeatSource]) {
      expect(source).toContain('asset-id="surface-xl-paper-scroll"')
      expect(source).toContain('asset-id="frame-xl-ceremony"')
    }
    expect(confirmSource).toContain("emit('confirm')")
    expect(victorySource).toContain('startAutoRefightCountdown')
    expect(defeatSource).toContain('startAutoRetryCountdown')
  })

})
