import { describe, expect, it } from 'vitest'
import { fitGameUiFrame } from './GameUiFrame'
describe('shared game UI frame', () => {
  it.each([[655,576],[1920,1080],[2560,1080],[800,600]])('contains a centered 16:9 frame in %sx%s', (w,h) => {
    const frame = fitGameUiFrame(w,h)
    expect(frame.width / frame.height).toBeCloseTo(16/9)
    expect(frame.x).toBeGreaterThanOrEqual(0)
    expect(frame.y).toBeGreaterThanOrEqual(0)
    expect(frame.x * 2 + frame.width).toBeCloseTo(w)
    expect(frame.y * 2 + frame.height).toBeCloseTo(h)
    expect(frame.width).toBeCloseTo(1440 * frame.scale)
    expect(frame.height).toBeCloseTo(810 * frame.scale)
  })
})
