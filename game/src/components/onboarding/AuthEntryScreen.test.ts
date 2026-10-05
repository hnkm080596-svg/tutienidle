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
    await nextTick()
    await nextTick()
    expect(container.querySelector('[data-testid="login-opening"]')).not.toBeNull()
    expect(container.querySelector('#auth-input-id')).not.toBeNull()
    expect(container.querySelector('[data-testid="auth-guest-button"]')).not.toBeNull()
    // Mode is chosen from the opening menu - the drawer title carries
    // it and there is no second tabs row inside the drawer.
    expect(container.querySelector('[data-testid="entry-drawer"] h2')?.textContent).toContain(
      i18n.global.t('onboarding.auth.tabs.register'),
    )
    expect(container.querySelector('#auth-input-password')?.getAttribute('autocomplete')).toBe('new-password')
    container.querySelector<HTMLButtonElement>('[data-testid="entry-drawer-close"]')!.click()
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 450))
    expect(container.querySelector('#auth-input-id')).toBeNull()
    expect(container.querySelector('[data-testid="login-opening"]')).not.toBeNull()
    app.unmount()
  })
})
