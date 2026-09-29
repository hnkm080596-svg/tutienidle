// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import { createPinia } from 'pinia'
import ErrorScreen from './ErrorScreen.vue'
import { useErrorStore } from '@/stores/error'
import { i18n } from '@/i18n'
import { BUILD_IDENTITY, shortGitSha } from '@/shared/build/BuildIdentity'

afterEach(() => {
  document.body.innerHTML = ''
})

// BETA-FINAL PR1 / spec B2 - the error surface must carry the exact release
// manifest values so a crash screenshot is self-identifying.
describe('ErrorScreen — build identity footer', () => {
  it('renders product, version, build id, short sha and environment', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const app = createApp({ render: () => h(ErrorScreen) })
    app.use(createPinia())
    app.use(i18n)
    app.mount(container)

    const errorStore = useErrorStore()
    errorStore.report('boom')
    await nextTick()

    const footer = container.querySelector<HTMLElement>('[data-testid="error-build"]')
    expect(footer).not.toBeNull()

    const text = footer!.textContent!
    expect(text).toContain(BUILD_IDENTITY.productName)
    expect(text).toContain(BUILD_IDENTITY.appVersion)
    expect(text).toContain(BUILD_IDENTITY.buildId)
    expect(text).toContain(shortGitSha())
    expect(text).toContain(BUILD_IDENTITY.backendEnvironment)

    app.unmount()
  })

  it('does not leak fields outside the i18n template', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const app = createApp({ render: () => h(ErrorScreen) })
    app.use(createPinia())
    app.use(i18n)
    app.mount(container)

    useErrorStore().report('boom')
    await nextTick()

    const footer = container.querySelector<HTMLElement>('[data-testid="error-build"]')!
    // The full 40-char sha must NOT appear - only the display-safe prefix.
    expect(footer.textContent).not.toContain(BUILD_IDENTITY.gitSha)
    expect(footer.textContent).not.toContain(BUILD_IDENTITY.builtAtUtc)

    app.unmount()
  })
})
