import { describe, expect, it } from 'vitest'
import { realmMapAnchors } from './realmUi'
describe('realm paper map presentation anchors', () => {
  it('provides eighteen distinct contained markers with six major landings', () => {
    expect(realmMapAnchors).toHaveLength(18)
    expect(new Set(realmMapAnchors.map(anchor => anchor.join(','))).size).toBe(18)
    expect(realmMapAnchors.map((_, i) => i + 1).filter(floor => floor % 3 === 0)).toEqual([3, 6, 9, 12, 15, 18])
    for (const [x, y] of realmMapAnchors) {
      expect(x).toBeGreaterThan(0)
      expect(x).toBeLessThan(100)
      expect(y).toBeGreaterThan(0)
      expect(y).toBeLessThan(100)
    }
  })
})
