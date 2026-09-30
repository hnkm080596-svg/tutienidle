// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import { createPinia } from 'pinia'
import ErrorScreen from './ErrorScreen.vue'
import { useErrorStore } from '@/stores/error'
import { i18n } from '@/i18n'
import { BUILD_IDENTITY, shortGitSha } from '@/shared/build/BuildIdentity'
import {
  bindDiagnosticRecorder,
  DiagnosticRecorder,
  unbindDiagnosticRecorder,
} from '@/services/diagnostics/DiagnosticRecorder'

afterEach(() => {
  unbindDiagnosticRecorder()
  document.body.innerHTML = ''
})

function mountScreen() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp({ render: () => h(ErrorScreen) })
  app.use(createPinia())
  app.use(i18n)
  app.mount(container)
  return { container, app }
}

// BETA-FINAL PR11 / spec B8 - the crash surface correlates to the local
// bundle: the bound recorder's report id renders for support screenshots.
describe('ErrorScreen — diagnostic report block', () => {
  it('shows the bound recorder report id when one is bound', async () => {
    bindDiagnosticRecorder(new DiagnosticRecorder({ reportId: 'report-qa-1' }))
    const { container, app } = mountScreen()
    useErrorStore().report('boom')
    await nextTick()

    const block = container.querySelector<HTMLElement>('[data-testid="error-report-id"]')
    expect(block).not.toBeNull()
    expect(block!.textContent).toContain('report-qa-1')
    app.unmount()
  })

  it('hides the report block when no recorder and no bridge exist', async () => {
    const { container, app } = mountScreen()
    useErrorStore().report('boom')
    await nextTick()

    expect(container.querySelector('.error-screen__report')).toBeNull()
    app.unmount()
  })
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
