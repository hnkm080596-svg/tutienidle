import { onUnmounted, ref } from 'vue'

// CombatVictoryPanel.vue / CombatDefeatPanel.vue chia se DUNG 1 khuon: dem
// nguoc N giay roi tu chay 1 hanh dong - truoc day moi panel tu viet lai
// setInterval/clearInterval rieng (ten bien khac nhau nhung cung logic),
// de lech khi sua (vd doi tick interval) chi o 1 trong 2 ban copy.
//
// Uncommitted audit followup plan, muc "Countdown auto retry dung deadline
// thuc" (2026-08-24) - truoc day moi callback setInterval tru cung 1 giay
// bat ke thoi gian thuc da troi qua bao lau. Khi tab bi trinh duyet
// throttle (nen/minimize), callback fire thua hon 1s/lan nen dem nguoc
// keo dai sai thuc te. Gio neo theo deadline = timestamp thuc (cung
// nguyen tac "diff theo Date.now()" nhu GameClock, xem core/idle/
// GameClock.ts) - moi callback tinh lai remaining tu deadline, khong phu
// thuoc so lan callback da fire.
export function useAutoRetryCountdown(seconds: number, onComplete: () => void | Promise<void>) {
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

    // Callback co the quay lai tre (throttle) dung luc deadline vua qua -
    // dam bao onComplete() chi chay dung 1 lan du tick() co bi goi lai.
    if (completed) {
      return
    }

    completed = true
    // onComplete may be async (B4 - refight awaits runAdmitted). A
    // rejection must be logged, not surface as an unhandled rejection from
    // a timer callback.
    void Promise.resolve(onComplete()).catch((error: unknown) => {
      console.error('[auto-retry] onComplete callback failed', error)
    })
  }

  function start() {
    // 9.9 - restart an toan, khong orphan interval: start() goi khi dang
    // chay phai clear interval cu truoc khi lap lich moi (interval cu neu
    // giu lai se tick mai, dung chung deadline/completed voi interval moi).
    stop()

    completed = false
    deadline = Date.now() + seconds * 1000
    remaining.value = seconds

    handle = setInterval(tick, 1000)
  }

  onUnmounted(stop)

  return { remaining, start, stop }
}
