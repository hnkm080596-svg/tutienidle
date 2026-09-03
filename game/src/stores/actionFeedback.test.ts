// @vitest-environment jsdom
// QA (task 2.2 lô 1 — actionFeedback key-form entries): entry key-form mới
// phải giữ nguyên hợp đồng gộp (dedup) của "Nhật ký thao tác" và không rò
// raw key/param ra message. Runtime-only store — không liên quan save.
import { describe, expect, it, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useActionFeedbackStore } from './actionFeedback'

describe('actionFeedback store — key-form entries (i18n 2.2 lô 1)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('errorKey lưu messageKey + params, message rỗng — không ghép chuỗi ở store', () => {
    const feedback = useActionFeedbackStore()

    feedback.errorKey('actionFeedback.failed', {
      label: 'actionFeedback.ops.wash.label',
      reason: 'actionFailure.no_forge_uses',
    })

    expect(feedback.entries).toHaveLength(1)
    expect(feedback.entries[0]!.messageKey).toBe('actionFeedback.failed')
    expect(feedback.entries[0]!.messageParams).toEqual({
      label: 'actionFeedback.ops.wash.label',
      reason: 'actionFailure.no_forge_uses',
    })
    expect(feedback.entries[0]!.message).toBe('')
    expect(feedback.entries[0]!.tone).toBe('error')
  })

  it('lặp cùng một lỗi (cùng key + params) trong cửa sổ merge → gộp count, không spam entry (Repeat)', () => {
    const feedback = useActionFeedbackStore()

    const params = {
      label: 'actionFeedback.ops.refine.label',
      reason: 'actionFailure.missing_tinh_hoa',
    }

    feedback.errorKey('actionFeedback.failed', params)
    feedback.errorKey('actionFeedback.failed', params)

    expect(feedback.entries).toHaveLength(1)
    expect(feedback.entries[0]!.count).toBe(2)
  })

  it('hai lỗi KHÁC nhau (params khác reason) không bị gộp nhầm (Value mutation)', () => {
    const feedback = useActionFeedbackStore()

    feedback.errorKey('actionFeedback.failed', {
      label: 'actionFeedback.ops.refine.label',
      reason: 'actionFailure.missing_tinh_hoa',
    })
    feedback.errorKey('actionFeedback.failed', {
      label: 'actionFeedback.ops.refine.label',
      reason: 'actionFailure.no_forge_uses',
    })

    expect(feedback.entries).toHaveLength(2)
  })

  it('entry chuỗi thường vẫn dedup theo message như hợp đồng cũ (regression)', () => {
    const feedback = useActionFeedbackStore()

    feedback.success('Cường Hóa thành công')
    feedback.success('Cường Hóa thành công')
    feedback.error('Không thể Hóa Luyện: Không đủ nguyên liệu.')
    feedback.error('Không thể Hóa Luyện: Không đủ nguyên liệu.')
    feedback.error('Không thể Hóa Luyện: Không đủ Linh Thạch.')

    expect(feedback.entries).toHaveLength(3)
    expect(feedback.entries[0]!.count).toBe(2)
    expect(feedback.entries[0]!.message).toBe('Cường Hóa thành công')
    expect(feedback.entries[1]!.count).toBe(2)
    expect(feedback.entries[2]!.count).toBe(1)
  })

  it('key-form và chuỗi thường là hai identity khác nhau — không gộp chéo', () => {
    const feedback = useActionFeedbackStore()

    feedback.errorKey('actionFeedback.failed', {
      label: 'actionFeedback.ops.wash.label',
      reason: 'actionFailure.no_forge_uses',
    })
    feedback.error('')

    expect(feedback.entries).toHaveLength(2)
  })
})
