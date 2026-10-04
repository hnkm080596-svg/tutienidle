// @vitest-environment jsdom
// BETA-FINAL PR13 / spec B7 - the intake dialog: consent gating, draft
// preservation across failure, stable report id, export-while-offline.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, type App } from 'vue'
import { createPinia } from 'pinia'
import FeedbackDialog from './FeedbackDialog.vue'
import { i18n } from '@/i18n'
import {
  bindFeedbackService,
  bindFeedbackProviders,
  unbindFeedbackProviders,
  unbindFeedbackService,
  type FeedbackService,
} from '@/services/feedback/FeedbackService'
import {
  bindDiagnosticRecorder,
  unbindDiagnosticRecorder,
  DiagnosticRecorder,
} from '@/services/diagnostics/DiagnosticRecorder'
import type { DiagnosticEvent } from '@/shared/diagnostics/DiagnosticEvent'

let app: App | undefined

function mountDialog() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  app = createApp({ render: () => h(FeedbackDialog, { open: true }) })
  app.use(createPinia())
  app.use(i18n)
  app.mount(container)
  return container
}

function field(selector: string): HTMLTextAreaElement | HTMLInputElement {
  const el = document.body.querySelector<HTMLTextAreaElement | HTMLInputElement>(selector)
  if (!el) throw new Error(`missing field ${selector}`)
  return el
}

function setValue(el: HTMLTextAreaElement | HTMLInputElement, value: string) {
  el.value = value
  el.dispatchEvent(new Event('input'))
}

async function fillForm(description = 'The merge gate stays open after defeat.') {
  setValue(field('#feedback-description'), description)
  await nextTick()
}

async function flushSubmit() {
  // Submit awaits the service promise; nextTick alone does not drain it.
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

async function clickSubmit() {
  const button = document.body.querySelector<HTMLButtonElement>('.feedback-dialog__actions .game-button--primary')
  if (!button) throw new Error('missing submit button')
  button.click()
  await flushSubmit()
}

beforeEach(() => {
  sessionStorage.clear()
  bindFeedbackProviders({ route: () => 'home', saveRevision: () => 7 })
})

afterEach(() => {
  app?.unmount()
  app = undefined
  document.body.innerHTML = ''
  sessionStorage.clear()
  unbindFeedbackService()
  unbindFeedbackProviders()
  unbindDiagnosticRecorder()
  vi.restoreAllMocks()
})

describe('FeedbackDialog', () => {
  it('renders form fields and keeps the submit disabled until description is set', async () => {
    mountDialog()
    await nextTick()
    const submit = document.body.querySelector<HTMLButtonElement>(
      '.feedback-dialog__actions .game-button--primary',
    )!
    expect(submit.disabled).toBe(true)
    await fillForm()
    expect(submit.disabled).toBe(false)
  })

  it('previews attached diagnostics only behind explicit consent', async () => {
    const recorder = new DiagnosticRecorder()
    const events: DiagnosticEvent[] = [
      {
        source: 'renderer',
        severity: 'error',
        category: 'lifecycle',
        code: 'EV_1',
        message: 'boot failed',
        seq: 1,
        atUtc: '2026-09-30T00:00:00Z',
      },
    ]
    vi.spyOn(recorder, 'events', 'get').mockReturnValue(events)
    bindDiagnosticRecorder(recorder)

    const submitted: { diagnostics?: unknown }[] = []
    bindFeedbackService({
      submit: async (draft) => {
        submitted.push(draft)
        return { status: 'accepted', reportId: 'rep-1', alreadyAccepted: false }
      },
    } satisfies FeedbackService)

    mountDialog()
    await nextTick()
    // No consent yet: the preview list is hidden.
    expect(document.body.querySelector('.feedback-dialog__events')).toBeNull()
    // Opt in: the preview lists the event the wire would carry.
    const checkbox = field('#feedback-attach') as HTMLInputElement
    checkbox.click()
    await nextTick()
    expect(document.body.querySelectorAll('.feedback-dialog__events li')).toHaveLength(1)
    expect(document.body.querySelector('.feedback-dialog__events')?.textContent).toContain('boot failed')
    // Consent back off: the submitted draft carries no diagnostics.
    checkbox.click()
    await nextTick()
    await fillForm()
    await clickSubmit()
    expect(submitted).toHaveLength(1)
    expect(submitted[0]!.diagnostics).toBeUndefined()
  })

  it('preserves the draft after a failed submit', async () => {
    bindFeedbackService({
      submit: async () => ({ status: 'unavailable', code: 'NETWORK_UNAVAILABLE', retryable: true }),
    })
    mountDialog()
    await nextTick()
    const originalDescription = 'Keep this text across the failure'
    await fillForm(originalDescription)
    await clickSubmit()
    const formAfterFailure = field('#feedback-description')
    expect(formAfterFailure.value).toBe(originalDescription)
    expect(document.body.querySelector('[data-testid="feedback-status"]')?.textContent).toBeTruthy()
  })

  it('shows a stable reportId and clears the stored draft on success', async () => {
    bindFeedbackService({
      submit: async () => ({ status: 'accepted', reportId: 'rep-stable-1', alreadyAccepted: false }),
    })
    mountDialog()
    await nextTick()
    await fillForm()
    await clickSubmit()
    expect(document.body.querySelector('.feedback-dialog__report-id')?.textContent).toContain('rep-stable-1')
    expect(sessionStorage.getItem('tien-hiep-idle-feedback-draft')).toBeNull()
  })

  it('restores a persisted draft on open', async () => {
    sessionStorage.setItem(
      'tien-hiep-idle-feedback-draft',
      JSON.stringify({ category: 'balance', description: 'restored', attachDiagnostics: false, idempotencyKey: 'key-x' }),
    )
    mountDialog()
    await nextTick()
    expect(field('#feedback-description').value).toBe('restored')
  })

  it('always offers local export, even when the service reports session-revoked', async () => {
    bindFeedbackService({
      submit: async () => ({ status: 'session-revoked' }),
    })
    const createUrl = vi.fn(() => 'blob:mock')
    const revokeUrl = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { value: createUrl, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeUrl, configurable: true })
    mountDialog()
    await nextTick()
    await fillForm()
    await clickSubmit()
    const exportButton = document.body.querySelector<HTMLButtonElement>('[data-testid="feedback-export"]')!
    exportButton.click()
    await nextTick()
    expect(createUrl).toHaveBeenCalled()
  })
})
