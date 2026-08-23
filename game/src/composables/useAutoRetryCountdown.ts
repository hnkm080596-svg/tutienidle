import { onUnmounted, ref } from 'vue'

// CombatVictoryPanel.vue / CombatDefeatPanel.vue chia sẻ ĐÚNG 1 khuôn: đếm
// ngược N giây rồi tự chạy 1 hành động — trước đây mỗi panel tự viết lại
// setInterval/clearInterval riêng (tên biến khác nhau nhưng cùng logic),
// dễ lệch khi sửa (vd đổi tick interval) chỉ ở 1 trong 2 bản copy.
//
// Uncommitted audit followup plan, mục "Countdown auto retry dùng deadline
// thực" (2026-08-24) — trước đây mỗi callback setInterval trừ cứng 1 giây
// bất kể thời gian thực đã trôi qua bao lâu. Khi tab bị trình duyệt
// throttle (nền/minimize), callback fire thưa hơn 1s/lần nên đếm ngược
// kéo dài sai thực tế. Giờ neo theo deadline = timestamp thực (cùng
// nguyên tắc "diff theo Date.now()" như GameClock, xem core/idle/
// GameClock.ts) — mỗi callback tính lại remaining từ deadline, không phụ
// thuộc số lần callback đã fire.
export function useAutoRetryCountdown(seconds: number, onComplete: () => void) {
  const remaining = ref(seconds)
  let handle: ReturnType<typeof setInterval> | undefined
  let deadline = 0
  let completed = false

  function stop() {
    if (handle) {
      clearInterval(handle)
      handle = undefined
    }
  }

  function tick() {
    const secondsLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))

    remaining.value = secondsLeft

    if (secondsLeft > 0) {
      return
    }

    stop()

    // Callback có thể quay lại trễ (throttle) đúng lúc deadline vừa qua —
    // đảm bảo onComplete() chỉ chạy đúng 1 lần dù tick() có bị gọi lại.
    if (completed) {
      return
    }

    completed = true
    onComplete()
  }

  function start() {
    completed = false
    deadline = Date.now() + seconds * 1000
    remaining.value = seconds

    handle = setInterval(tick, 1000)
  }

  onUnmounted(stop)

  return { remaining, start, stop }
}
