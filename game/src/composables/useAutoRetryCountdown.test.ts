// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAutoRetryCountdown } from './useAutoRetryCountdown'

// Uncommitted audit followup plan, mục "Countdown auto retry dùng deadline
// thực" (2026-08-24) — trước đây mỗi callback setInterval trừ cứng
// remaining -= 1 bất kể bao nhiêu giây THẬT đã trôi qua. Khi tab bị
// trình duyệt throttle (nền/minimize), callback có thể quay lại trễ (ví
// dụ 5 giây thực trôi qua nhưng chỉ fire đúng 1 lần) — code cũ vẫn chỉ
// trừ 1, khiến countdown kéo dài lâu hơn thời gian thực đã hứa. Giờ mỗi
// callback tính lại remaining từ deadline = timestamp thực, nên callback
// trễ bao lâu cũng resolve đúng ngay lần fire đó.
// 9.9 — start() gọi khi countdown đang chạy phải clear interval cũ TRƯỚC
// khi lập lịch mới, nếu không interval cũ bị orphan: vẫn tick mãi, đuỵ
// cùng deadline/completed dùng chung (stop() thủ công không dừng được nó).
describe('useAutoRetryCountdown — 9.9 restart an toàn', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('start() khi đang chạy clear interval cũ — không orphan, onComplete đúng 1 lần, stop() sau đó không còn interval nào', () => {
    vi.useFakeTimers()

    const clearSpy = vi.spyOn(globalThis, 'clearInterval')
    const onComplete = vi.fn()
    const { start, stop, remaining } = useAutoRetryCountdown(3, onComplete)

    start()
    vi.advanceTimersByTime(500)
    start()

    // 9.9 — restart phải clear ngay interval đầu tiên (handle cũ).
    expect(clearSpy).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(5000)

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(remaining.value).toBe(0)

    // Hoàn tất rồi thì không interval nào còn — clearInterval lần 2 nhận
    // handle của interval mới (lập ở start thứ 2), advance thêm không đổi gì.
    expect(clearSpy).toHaveBeenCalledTimes(2)
    stop()
    vi.advanceTimersByTime(10000)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})

describe('useAutoRetryCountdown — deadline thực (uncommitted audit followup plan)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('callback quay lại trễ (throttle) vẫn hoàn tất NGAY lần fire đó, không phải đợi thêm nhiều callback nữa mới về 0', () => {
    vi.useFakeTimers()

    const onComplete = vi.fn()
    const { start, remaining } = useAutoRetryCountdown(3, onComplete)

    start()
    expect(remaining.value).toBe(3)

    // Mô phỏng trình duyệt throttle callback đầu tiên: 5 giây THỰC trôi
    // qua (deadline 3s đã quá từ lâu) nhưng setInterval chỉ kịp fire
    // ĐÚNG 1 LẦN khi tab được foreground trở lại — không phải 5 lần
    // liên tiếp như mô phỏng "advance timers" thông thường.
    vi.setSystemTime(Date.now() + 5000)
    vi.advanceTimersToNextTimer()

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(remaining.value).toBe(0)

    // Interval đã tự stop() khi hoàn tất — không còn callback nào chạy
    // thêm dù thời gian tiếp tục trôi.
    vi.advanceTimersByTime(10000)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('stop() dọn interval — không còn callback nào chạy sau khi unmount/dừng thủ công', () => {
    vi.useFakeTimers()

    const onComplete = vi.fn()
    const { start, stop, remaining } = useAutoRetryCountdown(3, onComplete)

    start()
    vi.advanceTimersByTime(1000)
    expect(remaining.value).toBe(2)

    stop()
    vi.advanceTimersByTime(10000)

    expect(onComplete).not.toHaveBeenCalled()
  })
})
