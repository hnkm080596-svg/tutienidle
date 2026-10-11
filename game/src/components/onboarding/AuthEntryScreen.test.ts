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
    // The drawer's content swap is an out-in transition keyed on the
    // title - in jsdom it only settles after Vue's computed fallback
    // (~220ms), never on nextTick.
    await new Promise((resolve) => setTimeout(resolve, 300))
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
    // The current drawer design has no close button - the scrim is the
    // dismiss affordance.
    container.querySelector<HTMLElement>('.login-drawer-scrim')!.click()
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 450))
    expect(container.querySelector('#auth-input-id')).toBeNull()
    expect(container.querySelector('[data-testid="login-opening"]')).not.toBeNull()
    app.unmount()
  })
})
