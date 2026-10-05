import { describe, expect, it } from 'vitest'
import { skillGraphViewport } from './skillGraphViewport'
import type { SkillUiNode } from './skillUi'

const node = (x: number, y: number, prominent = false) => ({ x, y, prominent }) as SkillUiNode
describe('painted skill graph bounds', () => {
  it('keeps the top disc and bottom labels inside the allocated body', () => {
    const result = skillGraphViewport([node(355, 50, true), node(100, 710)], 1)
    expect((50 - 48) * result.scale + result.y).toBeGreaterThanOrEqual(16)
    expect((710 + 94) * result.scale + result.y).toBeLessThanOrEqual(404)
    expect((100 - 80) * result.scale + result.x).toBeGreaterThanOrEqual(16)
  })
  it('normalizes invalid fit values and handles empty graphs', () => {
    expect(skillGraphViewport([], 0)).toEqual({ scale: 1, x: 0, y: 0 })
    const result = skillGraphViewport([node(0, 0)], Number.NaN)
    expect(result.scale).toBe(1)
    expect(Number.isFinite(result.x) && Number.isFinite(result.y)).toBe(true)
  })
})
