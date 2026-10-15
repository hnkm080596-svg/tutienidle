// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import { countedReward, useResultCeremonyPlayback } from './useResultCeremonyPlayback'

let dispose: (() => void) | undefined
let motionListener: ((event: MediaQueryListEvent) => void) | undefined
const removeListener = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addEventListener: (_: string, listener: typeof motionListener) => {
        motionListener = listener
      },
      removeEventListener: removeListener,
    })),
  )
})

afterEach(() => {
  dispose?.()
  dispose = undefined
  motionListener = undefined
  removeListener.mockClear()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function mountPlayback(fast = false) {
  let playback!: ReturnType<typeof useResultCeremonyPlayback>
  const app = createApp(
    defineComponent({
      setup() {
        playback = useResultCeremonyPlayback(() => fast)
        return () => h('div')
      },
    }),
  )
  app.mount(document.createElement('div'))
  dispose = () => app.unmount()
  return playback
}

describe('result presentation clock', () => {
  it('starts at the final totals when reduced motion is already enabled', () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    } as unknown as MediaQueryList)
    const playback = mountPlayback()
    expect(playback.complete.value).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('shows intermediate gains then exact totals; later rows also finish within the ceremony', async () => {
    const playback = mountPlayback()
    expect(countedReward(128, playback.elapsed.value, 0)).toBe(0)
    await vi.advanceTimersByTimeAsync(1350)
    expect(countedReward(128, playback.elapsed.value, 0)).toBeGreaterThan(0)
    expect(countedReward(128, playback.elapsed.value, 0)).toBeLessThan(128)
    await vi.advanceTimersByTimeAsync(1000)
    expect(playback.complete.value).toBe(true)
    expect(countedReward(128, playback.elapsed.value, 200)).toBe(128)
    expect(countedReward(2.75, playback.elapsed.value, 0)).toBe(2.75)
  })

  it('skip cancels visual work and reaches exact totals without changing the reward input', async () => {
    const playback = mountPlayback()
    const total = 987654
    playback.finish()
    expect(playback.complete.value).toBe(true)
    expect(countedReward(total, playback.elapsed.value, 0)).toBe(total)
    expect(total).toBe(987654)
    expect(vi.getTimerCount()).toBe(0)
    await nextTick()
  })

  it('auto mode finishes before the existing three-second retry deadline', async () => {
    const playback = mountPlayback(true)
    await vi.advanceTimersByTimeAsync(1500)
    expect(playback.complete.value).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reduced motion initially and when changed snaps to final state', () => {
    const playback = mountPlayback()
    motionListener?.({ matches: true } as MediaQueryListEvent)
    expect(playback.complete.value).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('unmount cancels the animation frame and removes the motion subscription', () => {
    mountPlayback()
    dispose?.()
    dispose = undefined
    expect(vi.getTimerCount()).toBe(0)
    expect(removeListener).toHaveBeenCalledOnce()
  })
})
