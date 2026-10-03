// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAutoRetryCountdown } from './useAutoRetryCountdown'

// Uncommitted audit followup plan, muc "Countdown auto retry dung deadline
// thuc" (2026-08-24) - truoc day moi callback setInterval tru cung
// remaining -= 1 bat ke bao nhieu giay THAT da troi qua. Khi tab bi
// trinh duyet throttle (nen/minimize), callback co the quay lai tre (vi
// du 5 giay thuc troi qua nhung chi fire dung 1 lan) - code cu van chi
// tru 1, khien countdown keo dai lau hon thoi gian thuc da hua. Gio moi
// callback tinh lai remaining tu deadline = timestamp thuc, nen callback
// tre bao lau cung resolve dung ngay lan fire do.
// 9.9 - start() goi khi countdown dang chay phai clear interval cu TRUOC
// khi lap lich moi, neu khong interval cu bi orphan: van tick mai, duy
// cung deadline/completed dung chung (stop() thu cong khong dung duoc no).
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

    // 9.9 - restart phai clear ngay interval dau tien (handle cu).
    expect(clearSpy).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(5000)

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(remaining.value).toBe(0)

    // Hoan tat roi thi khong interval nao con - clearInterval lan 2 nhan
    // handle cua interval moi (lap o start thu 2), advance them khong doi gi.
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

    // Mo phong trinh duyet throttle callback dau tien: 5 giay THUC troi
    // qua (deadline 3s da qua tu lau) nhung setInterval chi kip fire
    // DUNG 1 LAN khi tab duoc foreground tro lai - khong phai 5 lan
    // lien tiep nhu mo phong "advance timers" thong thuong.
    vi.setSystemTime(Date.now() + 5000)
    vi.advanceTimersToNextTimer()

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(remaining.value).toBe(0)

    // Interval da tu stop() khi hoan tat - khong con callback nao chay
    // them du thoi gian tiep tuc troi.
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

describe('useAutoRetryCountdown — B4 async onComplete', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('accepts an async onComplete — runs once, rejection is logged not thrown unhandled', async () => {
    vi.useFakeTimers()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onComplete = vi.fn(async () => {
      throw new Error('refight rejected')
    })
    const { start } = useAutoRetryCountdown(1, onComplete)

    start()
    await vi.advanceTimersByTimeAsync(2_000)

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith(
      '[auto-retry] onComplete callback failed',
      expect.any(Error),
    )

    errorSpy.mockRestore()
  })
})
