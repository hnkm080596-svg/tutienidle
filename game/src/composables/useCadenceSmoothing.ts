import { getCurrentInstance, onUnmounted, ref, watch, type Ref } from 'vue'

// Lớp smoothing CHỈ-PRESENTATION cho cadence HUD (audit P1-4,
// dong-fu-command-wheel-inventory-spirit-stone-plan.md). Trước đây
// useBasicAttackCadence() có nội suy rAF đã bị loại cùng đợt execution-
// policy rework — giờ khôi phục dùng CHUNG cho mọi slot có execution
// policy cadence:
// - RESYNC ở mỗi snapshot (getter phụ thuộc stateVersion → App.vue tick
//   là nguồn sự thật; giá trị authority không bao giờ bị mutate).
// - Nội suy tuyến tính theo thời gian thực GIỮA hai snapshot để mask/số
//   đếm không nhảy theo nhịp tick.
// - ĐÓNG BĂNG khi gameplay không advancing (pause/không có trận) —
//   giữ mốc thời gian để resume không nhảy cóc.
// - Cancel rAF khi unmount.
// KHÔNG chạy logic gameplay, KHÔNG mutate BattleSystem timer.

export interface CadenceSample {
  /** Giây cadence còn lại — authority từ snapshot BattleSystem. */
  remaining: number

  /** Tổng chu kỳ (giây); <=0 nghĩa là slot không có cadence. */
  total: number
}

export function useCadenceSmoothing(
  getSample: () => CadenceSample,

  isAdvancing: () => boolean,
): Readonly<Ref<number>> {
  const displayed = ref(0)

  let baseRemaining = 0

  let elapsedSinceSyncMs = 0

  let lastFrameTimeMs: number | undefined

  let rafHandle: number | undefined

  function resync() {
    const sample = getSample()

    baseRemaining = Math.max(0, sample.remaining)

    elapsedSinceSyncMs = 0

    lastFrameTimeMs = undefined

    displayed.value = baseRemaining

    if (rafHandle === undefined) {
      rafHandle = window.requestAnimationFrame(frame)
    }
  }

  function frame(nowMs: number) {
    rafHandle = undefined

    if (lastFrameTimeMs !== undefined && isAdvancing()) {
      elapsedSinceSyncMs += Math.max(0, nowMs - lastFrameTimeMs)
    }

    lastFrameTimeMs = nowMs

    displayed.value = Math.max(0, baseRemaining - elapsedSinceSyncMs / 1000)

    rafHandle = window.requestAnimationFrame(frame)
  }

  // Snapshot mới (stateVersion bump) → getter trả object mới → resync.
  watch(getSample, resync)

  resync()

  // Cho phép gọi bare trong test (không có component instance) — ngoài
  // test luôn có instance nên cleanup luôn được gắn.
  if (getCurrentInstance()) {
    onUnmounted(() => {
      if (rafHandle !== undefined) {
        window.cancelAnimationFrame(rafHandle)

        rafHandle = undefined
      }
    })
  }

  return displayed
}
