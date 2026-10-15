import { computed, onBeforeUnmount, onMounted, readonly, shallowRef } from 'vue'

const DURATION = 2200

// This clock drives display only. Settlement and retry deadlines never wait for it.
export function useResultCeremonyPlayback(fast: () => boolean) {
  const elapsed = shallowRef(0)
  const pace = shallowRef(1)
  const complete = computed(() => elapsed.value >= DURATION)
  let frame: number | undefined
  let motion: MediaQueryList | undefined

  function cancel() {
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
  }

  function finish() {
    cancel()
    elapsed.value = DURATION
  }

  function motionChanged(event: MediaQueryListEvent) {
    if (event.matches) finish()
  }

  onMounted(() => {
    pace.value = fast() ? 0.6 : 1
    motion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    motion?.addEventListener('change', motionChanged)
    if (motion?.matches) {
      finish()
      return
    }
    const startedAt = performance.now()
    function tick(now: number) {
      elapsed.value = Math.min(DURATION, Math.max(0, (now - startedAt) / pace.value))
      if (!complete.value) frame = requestAnimationFrame(tick)
      else frame = undefined
    }
    frame = requestAnimationFrame(tick)
  })

  onBeforeUnmount(() => {
    cancel()
    motion?.removeEventListener('change', motionChanged)
  })

  return { elapsed: readonly(elapsed), pace: readonly(pace), complete, finish }
}

export function countedReward(total: number, elapsed: number, index: number): number {
  const start = 1050 + Math.min(index, 5) * 65
  const progress = Math.max(0, Math.min(1, (elapsed - start) / 650))
  if (progress === 1) return total
  return Math.floor(total * (1 - (1 - progress) ** 3))
}
