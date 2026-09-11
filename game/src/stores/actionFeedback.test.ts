// @vitest-environment jsdom
// QA (task 2.2 lô 1 — actionFeedback key-form entries): entry key-form mới
// phải giữ nguyên hợp đồng gộp (dedup) của "Nhật ký thao tác" và không rò
// raw key/param ra message. Runtime-only store — không liên quan save.
//
// Auto-hide (user request 2026-09-11): the action log hides completely
// after 5s without a new entry; a new entry shows it again immediately.
import { describe, expect, it, beforeEach, vi } from 'vitest'
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

describe('actionFeedback store — auto-hide 5s (user request 2026-09-11)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
  })

  it('mặc định ẩn (không entry nào) — log không chiếm chỗ trên màn hình', () => {
    const feedback = useActionFeedbackStore()

    expect(feedback.isVisible).toBe(false)
  })

  it('push entry → hiện ngay; 5 giây im lặng → ẩn lại hoàn toàn', () => {
    const feedback = useActionFeedbackStore()

    feedback.success('Cường Hóa thành công')

    expect(feedback.isVisible).toBe(true)

    vi.advanceTimersByTime(4999)
    expect(feedback.isVisible).toBe(true)

    vi.advanceTimersByTime(1)
    expect(feedback.isVisible).toBe(false)
  })

  it('entry mới trong cửa sổ 5s → đợi lại từ đầu, log không nhấp nháy tắt', () => {
    const feedback = useActionFeedbackStore()

    feedback.success('Cường Hóa thành công')

    vi.advanceTimersByTime(3000)
    feedback.success('Tẩy Luyện thành công')

    vi.advanceTimersByTime(2000)
    expect(feedback.isVisible).toBe(true)

    vi.advanceTimersByTime(3000)
    expect(feedback.isVisible).toBe(false)
  })

  it('collapsed (user bấm Thu gọn) vẫn tự hiện lại khi entry mới xuất hiện', () => {
    const feedback = useActionFeedbackStore()

    feedback.success('A')
    feedback.toggleCollapsed()
    expect(feedback.collapsed).toBe(true)

    feedback.success('B')

    expect(feedback.collapsed).toBe(false)
    expect(feedback.isVisible).toBe(true)
  })

  it('clear() hủy timer — không toggle isVisible sau khi đã dọn', () => {
    const feedback = useActionFeedbackStore()

    feedback.success('A')
    feedback.clear()
    expect(feedback.isVisible).toBe(false)

    vi.advanceTimersByTime(6000)
    expect(feedback.isVisible).toBe(false)
  })
})
