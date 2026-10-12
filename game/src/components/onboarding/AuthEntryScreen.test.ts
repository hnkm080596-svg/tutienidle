// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import { createPinia } from 'pinia'
import { i18n } from '@/i18n'
import AuthEntryScreen from './AuthEntryScreen.vue'

vi.mock('@/composables/resumeSession', () => ({
  readResumeCandidate: vi.fn(async () => null),
  consumeResetNotice: () => false,
}))

describe('AuthEntryScreen opening', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('opens the selected authentication drawer and returns to the four opening actions', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const app = createApp({ render: () => h(AuthEntryScreen) })
    app.use(createPinia())
    app.use(i18n)
    app.mount(container)
    await nextTick()
    expect(container.querySelector('[data-testid="login-opening"]')).not.toBeNull()
    expect(container.querySelector('#auth-input-id')).toBeNull()
    expect(container.querySelector('[data-testid="auth-guest-button"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="opening-settings-button"]')).not.toBeNull()
    container.querySelector<HTMLButtonElement>('[data-testid="opening-register-button"]')!.click()
    // The drawer is a persistent layer whose content swaps under a
    // keyed out-in Transition - the new swap block mounts only after
    // the old one's leave completes (a jsdom frame, not a tick), so
    // flush a real timer before asserting the field exists.
    await new Promise((resolve) => setTimeout(resolve, 50))
    await nextTick()
    for (let i = 0; i < 10 && !container.querySelector('#auth-input-id'); i++) {
      await new Promise((resolve) => setTimeout(resolve, 20))
      await nextTick()
    }
    expect(container.querySelector('[data-testid="login-opening"]')).not.toBeNull()
    expect(container.querySelector('#auth-input-id')).not.toBeNull()
    expect(container.querySelector('[data-testid="auth-guest-button"]')).not.toBeNull()
    // Mode is chosen from the opening menu - the drawer title carries
    // it and there is no second tabs row inside the drawer.
    expect(container.querySelector('[data-testid="entry-drawer"] h2')?.textContent).toContain(
      i18n.global.t('onboarding.auth.tabs.register'),
    )
    expect(container.querySelector('#auth-input-password')?.getAttribute('autocomplete')).toBe('new-password')
    // The dedicated close button was removed from the real drawer -
    // closing happens through the scrim (LoginSideDrawer .login-drawer-scrim).
    container.querySelector<HTMLElement>('.login-drawer-scrim')!.click()
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 450))
    await nextTick()
    for (let i = 0; i < 10 && container.querySelector('#auth-input-id'); i++) {
      await new Promise((resolve) => setTimeout(resolve, 20))
      await nextTick()
    }
    expect(container.querySelector('#auth-input-id')).toBeNull()
    expect(container.querySelector('[data-testid="login-opening"]')).not.toBeNull()
    app.unmount()
  })
})
