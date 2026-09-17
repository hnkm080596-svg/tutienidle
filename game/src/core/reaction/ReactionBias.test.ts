// ReactionBias.test.ts -- megaplan M2 step 3 (contract sec.79-80).

import { describe, expect, it } from 'vitest'
import {
  BIAS_SCALE,
  IdentityReactionBiasQuery,
  normalizeReactionBias,
} from './ReactionBias'
import { TEST_ENTITIES } from './testing/ReactionTestFixtures'

describe('normalizeReactionBias', () => {
  it('undefined bias normalizes to all x1.00', () => {
    const n = normalizeReactionBias(undefined)
    expect(n.relationBps.sinh).toBe(BIAS_SCALE)
    expect(n.relationBps.khac).toBe(BIAS_SCALE)
    expect(n.elementBps('fire')).toBe(BIAS_SCALE)
    expect(n.elementBps('water')).toBe(BIAS_SCALE)
    expect(n.reactionBps('anything' as never)).toBe(BIAS_SCALE)
  })

  it('empty bias object normalizes to all x1.00', () => {
    const n = normalizeReactionBias({})
    expect(n.relationBps.sinh).toBe(BIAS_SCALE)
    expect(n.elementBps('wood')).toBe(BIAS_SCALE)
  })

  it('materializes only the authored fields', () => {
    const n = normalizeReactionBias({
      relationBiasBps: { khac: 12_500 },
      elementBiasBps: { fire: 8_000 },
      reactionBiasBps: { tuc_viem: 20_000 } as never,
    })
    expect(n.relationBps.khac).toBe(12_500)
    expect(n.relationBps.sinh).toBe(BIAS_SCALE) // untouched
    expect(n.elementBps('fire')).toBe(8_000)
    expect(n.elementBps('water')).toBe(BIAS_SCALE)
    expect(n.reactionBps('tuc_viem' as never)).toBe(20_000)
    expect(n.reactionBps('dung_kim' as never)).toBe(BIAS_SCALE)
  })
})

describe('IdentityReactionBiasQuery -- production default', () => {
  it('returns all-1.0 bias for any source/element', () => {
    const q = new IdentityReactionBiasQuery()
    const n = normalizeReactionBias(
      q.getFor(TEST_ENTITIES.sourceA, 'fire'),
    )
    expect(n.relationBps.sinh).toBe(BIAS_SCALE)
    expect(n.relationBps.khac).toBe(BIAS_SCALE)
    expect(n.elementBps('metal')).toBe(BIAS_SCALE)
    expect(n.reactionBps('duong_viem' as never)).toBe(BIAS_SCALE)
  })
})
