// @vitest-environment jsdom
//
// Audit P1-4 — lớp smoothing cadence HUD: test fake-rAF cho resync,
// pause (đóng băng khi gameplay không advancing) và cleanup (cancel
// rAF khi unmount). KHÔNG mutate battle timer — composable chỉ đọc.
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createApp, h } from 'vue'
import { useCadenceSmoothing } from './useCadenceSmoothing'

function stubRaf() {
  const queue = new Map<number, FrameRequestCallback>()
  let nextId = 1

  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextId++

    queue.set(id, callback)

    return id
  })

  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    queue.delete(id)
  })

  return {
    /** Chạy MỘT frame với timestamp giả. */
    pump(timeMs: number) {
      const callbacks = [...queue.values()]

      queue.clear()

      for (const callback of callbacks) {
        callback(timeMs)
      }
    },

    pendingCount: () => queue.size,
  }
}

describe('useCadenceSmoothing — resync / pause / cleanup', () => {
  it('resync ở mỗi snapshot — giá trị hiển thị bám theo authority mới', async () => {
    const raf = stubRaf()
    const sample = ref({ remaining: 2, total: 3 })
    const advancing = ref(true)

    const displayed = useCadenceSmoothing(
      () => ({ ...sample.value }),
      () => advancing.value,
    )

    expect(displayed.value).toBe(2)

    // Nội suy giữa hai snapshot: 500ms trôi → còn ~1.5s.
    raf.pump(0)
    raf.pump(500)

    expect(displayed.value).toBeCloseTo(1.5, 5)

    // Snapshot mới từ BattleSystem (tick) — resync về giá trị authority,
    // không tích lũy drift từ nội suy cũ.
    sample.value = { remaining: 2.9, total: 3 }
    await nextTick()

    expect(displayed.value).toBeCloseTo(2.9, 5)

    vi.unstubAllGlobals()
  })

  it('pause → đóng băng; resume → tiếp tục từ đúng chỗ, không nhảy cóc', () => {
    const raf = stubRaf()
    const sample = ref({ remaining: 2, total: 3 })
    const advancing = ref(true)

    const displayed = useCadenceSmoothing(
      () => ({ ...sample.value }),
      () => advancing.value,
    )

    raf.pump(0)

    raf.pump(400)
    expect(displayed.value).toBeCloseTo(1.6, 5)

    // Gameplay ngừng advancing — frame vẫn chạy nhưng KHÔNG trừ thời gian.
    advancing.value = false

    raf.pump(1400)
    expect(displayed.value).toBeCloseTo(1.6, 5)

    // Resume — nội suy tiếp tục từ mốc đóng băng (không cộng cả khoảng pause).
    advancing.value = true

    raf.pump(1500)
    expect(displayed.value).toBeCloseTo(1.5, 5)

    vi.unstubAllGlobals()
  })

  it('không bao giờ âm — kẹp về 0 khi nội suy vượt snapshot', () => {
    const raf = stubRaf()
    const sample = ref({ remaining: 0.3, total: 3 })

    const displayed = useCadenceSmoothing(
      () => ({ ...sample.value }),
      () => true,
    )

    raf.pump(0)
    raf.pump(10_000)

    expect(displayed.value).toBe(0)

    vi.unstubAllGlobals()
  })

  it('cleanup: unmount cancel toàn bộ rAF callback đang chờ', async () => {
    const raf = stubRaf()
    const sample = ref({ remaining: 2, total: 3 })

    const container = document.createElement('div')

    document.body.appendChild(container)

    const app = createApp({
      setup() {
        const displayed = useCadenceSmoothing(
          () => ({ ...sample.value }),
          () => true,
        )

        return () => h('span', String(displayed.value))
      },
    })

    app.mount(container)

    // Loop đã start (1 callback chờ).
    expect(raf.pendingCount()).toBe(1)

    raf.pump(0)

    await nextTick()

    app.unmount()

    // Không còn rAF sau unmount.
    expect(raf.pendingCount()).toBe(0)

    container.remove()

    vi.unstubAllGlobals()
  })

  it('idle stop: slot không có cadence (total <= 0) và đã về 0 → không tự lên lịch rAF tiếp; resync mới re-arm', async () => {
    const raf = stubRaf()
    const sample = ref({ remaining: 0, total: 0 })

    const displayed = useCadenceSmoothing(
      () => ({ ...sample.value }),
      () => true,
    )

    expect(displayed.value).toBe(0)
    expect(raf.pendingCount()).toBe(1)

    // Chạy frame đầu tiên — vẫn về 0, không có cadence → tự dừng, không
    // còn callback rAF nào chờ.
    raf.pump(0)

    expect(displayed.value).toBe(0)
    expect(raf.pendingCount()).toBe(0)

    // Snapshot mới có cadence thật → watch(getSample) resync, re-arm rAF.
    sample.value = { remaining: 2, total: 3 }
    await nextTick()

    expect(raf.pendingCount()).toBe(1)

    vi.unstubAllGlobals()
  })
})
