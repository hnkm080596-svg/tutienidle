// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { MainProcessClockSource } from './MainProcessClockSource'

describe('MainProcessClockSource', () => {
  it('forwards ticks from the preload bridge', () => {
    let handler: ((d: number) => void) | null = null
    const bridge = {
      onTick: vi.fn((cb: (d: number) => void) => {
        handler = cb
        return () => { handler = null }
      }),
      stop: vi.fn(),
    }

    const source = new MainProcessClockSource(bridge)
    const deltas: number[] = []
    source.start((d) => deltas.push(d))

    handler!(0.05)
    handler!(0.05)
    expect(deltas).toEqual([0.05, 0.05])

    source.stop()
    expect(bridge.stop).toHaveBeenCalled()
  })
})
