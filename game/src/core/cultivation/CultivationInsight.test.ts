import { afterEach, describe, expect, it, vi } from 'vitest'
import { accrueCultivationInsight } from './CultivationInsight'
import { createDefaultPlayer } from '../player/Player'

const mocks = vi.hoisted(() => ({
  insightPerCultivation: vi.fn<(ids: readonly string[] | undefined) => number | undefined>(),
}))

vi.mock('../talent/TalentEffects', async (importOriginal) => {
  const original = await importOriginal<typeof import('../talent/TalentEffects')>()
  return {
    ...original,
    getInsightPerCultivation: mocks.insightPerCultivation,
  }
})

// Single owner of the threshold accumulator - online cultivate() and
// offline restoreFromSave() both delegate here (Mission G Task 34).
describe('accrueCultivationInsight', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    mocks.insightPerCultivation.mockReset()
  })

  it('below threshold — no insight, remainder kept', () => {
    mocks.insightPerCultivation.mockReturnValue(2000)
    const player = createDefaultPlayer()

    accrueCultivationInsight(player, 1500)

    expect(player.skillInsight).toBe(0)
    expect(player.cultivationInsightAccumulator).toBe(1500)
  })

  it('exact threshold — +1 insight, accumulator resets', () => {
    mocks.insightPerCultivation.mockReturnValue(2000)
    const player = createDefaultPlayer()

    accrueCultivationInsight(player, 2000)

    expect(player.skillInsight).toBe(1)
    expect(player.totalSkillInsightGained).toBe(1)
    expect(player.cultivationInsightAccumulator).toBe(0)
  })

  it('multi-threshold — 2.5x grants +2 and keeps the remainder', () => {
    mocks.insightPerCultivation.mockReturnValue(2000)
    const player = createDefaultPlayer()

    accrueCultivationInsight(player, 5000)

    expect(player.skillInsight).toBe(2)
    expect(player.totalSkillInsightGained).toBe(2)
    expect(player.cultivationInsightAccumulator).toBe(1000)
  })

  it('threshold 0 — no-op, accumulator untouched (guards the 2026-08-31 infinite-loop vector)', () => {
    mocks.insightPerCultivation.mockReturnValue(0)
    const player = createDefaultPlayer()

    accrueCultivationInsight(player, 5000)

    expect(player.skillInsight).toBe(0)
    expect(player.cultivationInsightAccumulator).toBe(0)
  })

  it('no insight talent (undefined) — no-op', () => {
    mocks.insightPerCultivation.mockReturnValue(undefined)
    const player = createDefaultPlayer()

    accrueCultivationInsight(player, 5000)

    expect(player.skillInsight).toBe(0)
    expect(player.cultivationInsightAccumulator).toBe(0)
  })

  it('huge accumulator drains in one O(1) jump (r22-AUT pin)', () => {
    mocks.insightPerCultivation.mockReturnValue(2000)
    const player = createDefaultPlayer()
    // The r22-AUT child probe hung on this magnitude - the old while
    // loop would take ~5e11 iterations.
    player.cultivationInsightAccumulator = 1e15

    const start = Date.now()
    accrueCultivationInsight(player, 1)

    expect(Date.now() - start).toBeLessThan(1_000)
    expect(player.skillInsight).toBe(500_000_000_000)
    expect(player.totalSkillInsightGained).toBe(500_000_000_000)
    expect(player.cultivationInsightAccumulator).toBe(1)
  })

  it('non-positive gained — no-op', () => {
    mocks.insightPerCultivation.mockReturnValue(2000)
    const player = createDefaultPlayer()

    accrueCultivationInsight(player, 0)
    accrueCultivationInsight(player, -100)

    expect(player.skillInsight).toBe(0)
    expect(player.cultivationInsightAccumulator).toBe(0)
  })

  it('non-finite gained resets the poisoned accumulator instead of bricking later saves (r23-AUT nit)', () => {
    mocks.insightPerCultivation.mockReturnValue(2000)
    const player = createDefaultPlayer()
    player.cultivationInsightAccumulator = 500

    // A non-finite feed mints no insight - and the accumulator drops
    // back to a writable value instead of staying Infinity, which
    // would fail save-shape validation on every later save-write.
    accrueCultivationInsight(player, Number.POSITIVE_INFINITY)

    expect(player.skillInsight).toBe(0)
    expect(player.totalSkillInsightGained).toBe(0)
    expect(player.cultivationInsightAccumulator).toBe(0)

    // The next honest accrual works normally from the reset.
    accrueCultivationInsight(player, 2500)
    expect(player.skillInsight).toBe(1)
    expect(player.cultivationInsightAccumulator).toBe(500)
  })
})
