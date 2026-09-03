// @vitest-environment jsdom
// QA (task 2.2 lô 1 — ActionFeedbackLog render): entry key-form phải render
// chuỗi vi GIỐNG BYTE với thông điệp cũ ("Không thể {label}: {reason}") qua
// t() lồng param; entry chuỗi thường render nguyên văn. Regression theo
// learned-defect QA-2026-09-01-007 (rendered contract copy per locale).
import { describe, expect, it } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import { createPinia } from 'pinia'
import { i18n } from '@/i18n'
import { useActionFeedbackStore } from '@/stores/actionFeedback'
import ActionFeedbackLog from './ActionFeedbackLog.vue'

function mountLog() {
  const root = document.createElement('div')
  const app = createApp({ render: () => h(ActionFeedbackLog) })
  app.use(createPinia())
  app.use(i18n)
  app.mount(root)
  return { root, app }
}

function messageText(_root: HTMLElement): string {
  return document.body.querySelector('.feedback-log__message')?.textContent ?? ''
}

describe('ActionFeedbackLog — render key-form entry giống byte message cũ', () => {
  it('đổi locale sang en → entry key-form render tiếng Anh; chuỗi thường giữ nguyên (Stale state)', async () => {
    const { root, app } = mountLog()
    const feedback = useActionFeedbackStore()

    feedback.errorKey('actionFeedback.failed', {
      label: 'actionFeedback.ops.refine.label',
      reason: 'actionFailure.missing_tinh_hoa',
    })
    feedback.success('Hóa Luyện: Hạ phẩm Linh Thạch ×2')
    await nextTick()

    const global = i18n.global as unknown as { locale: { value: 'vi' | 'en' } }
    global.locale.value = 'en'
    await nextTick()

    const texts = Array.from(document.body.querySelectorAll('.feedback-log__message')).map(
      (node) => node.textContent ?? '',
    )
    expect(texts).toContain('Cannot Refine: Not enough Qi Refining Essence.')
    expect(texts).toContain('Hóa Luyện: Hạ phẩm Linh Thạch ×2')

    global.locale.value = 'vi'
    app.unmount()
  })
  it('failure key-form → "Không thể Tẩy Luyện: Món đồ đã hết lượt Rèn." (vi, byte-identical)', async () => {
    const { root, app } = mountLog()
    const feedback = useActionFeedbackStore()

    feedback.errorKey('actionFeedback.failed', {
      label: 'actionFeedback.ops.wash.label',
      reason: 'actionFailure.no_forge_uses',
    })
    await nextTick()

    expect(messageText(root)).toBe('Không thể Tẩy Luyện: Món đồ đã hết lượt Rèn.')

    app.unmount()
  })

  it('success key-form → "Cường Hóa thành công" (vi, byte-identical)', async () => {
    const { root, app } = mountLog()
    const feedback = useActionFeedbackStore()

    feedback.successKey('actionFeedback.success', { label: 'actionFeedback.ops.enhance.label' })
    await nextTick()

    expect(messageText(root)).toBe('Cường Hóa thành công')

    app.unmount()
  })

  it('reason không có trong mapping → fallback key "Thao tác thất bại." (vi, byte-identical)', async () => {
    const { root, app } = mountLog()
    const feedback = useActionFeedbackStore()

    feedback.errorKey('actionFeedback.failed', {
      label: 'actionFeedback.ops.dissolve.label',
      reason: 'actionFailure.fallback',
    })
    await nextTick()

    expect(messageText(root)).toBe('Không thể Hóa Luyện: Thao tác thất bại.')

    app.unmount()
  })

  it('entry chuỗi thường (dissolve reward — data-layer) vẫn render nguyên văn', async () => {
    const { root, app } = mountLog()
    const feedback = useActionFeedbackStore()

    feedback.success('Hóa Luyện: Hạ phẩm Linh Thạch ×12')
    await nextTick()

    expect(messageText(root)).toBe('Hóa Luyện: Hạ phẩm Linh Thạch ×12')

    app.unmount()
  })
})
