import { describe, expect, it } from 'vitest'
import { createDefaultPlayer } from '../player/Player'
import { freshKiemTuState } from './KiemTuState'
import { GameManager } from '../game/GameManager'
import {
  KIEM_DAO_MERGE_BONUS,
  applyBreakthroughMerge,
  forgeCost,
  gainKiemY,
  kiemDaoCap,
} from './NguKiemDao'

// Kiem Tu Reimagined Task 8 (spec 2026-09-15 K14/K15) — the ngu economy:
// +1 Kiem Y per cast, converts to Kiem Dao at forgeCost(realmIndex),
// count capped at realmIndex+1, gain is a no-op at cap, breakthrough
// merge snapshots count into kiemDaoBase then resets count to 1.

function makeNguPlayer(realmId: string) {
  const player = createDefaultPlayer()
  player.cultivationPath = 'kiem_tu'
  player.realmId = realmId
  player.kiemTu = { ...freshKiemTuState(), mode: 'ngu' }
  return player
}

describe('forgeCost / kiemDaoCap', () => {
  it('forgeCost: LK 9999, TC 12999, DK ~81565', () => {
    expect(forgeCost(1)).toBe(9_999)
    expect(forgeCost(2)).toBe(12_999)
    expect(forgeCost(9)).toBe(81_565)
  })

  it('forgeCost asserts realmIndex >= 1 (mortal cannot forge)', () => {
    expect(() => forgeCost(0)).toThrow()
  })

  it('kiemDaoCap = realmIndex + 1 (asserts >= 1)', () => {
    expect(kiemDaoCap(1)).toBe(2)
    expect(kiemDaoCap(3)).toBe(4)
    expect(kiemDaoCap(9)).toBe(10)
    expect(() => kiemDaoCap(0)).toThrow()
  })
})

describe('gainKiemY', () => {
  it('banks Kiem Y without converting below forgeCost', () => {
    const player = makeNguPlayer('qi_refining')

    gainKiemY(player, 500)

    expect(player.kiemTu!.kiemY).toBe(500)
    expect(player.kiemTu!.kiemDaoCount).toBe(1)
  })

  it('converts exactly at forgeCost and keeps the remainder', () => {
    const player = makeNguPlayer('qi_refining')

    // LK cap is 2 — one forge at 9999 fills it.
    gainKiemY(player, 9_999)
    expect(player.kiemTu!.kiemDaoCount).toBe(2)
    expect(player.kiemTu!.kiemY).toBe(0)
  })

  it('gain is a no-op at cap — banked Y does not grow', () => {
    const player = makeNguPlayer('qi_refining')

    gainKiemY(player, 9_999)
    expect(player.kiemTu!.kiemDaoCount).toBe(2)

    gainKiemY(player, 1)
    expect(player.kiemTu!.kiemDaoCount).toBe(2)
    expect(player.kiemTu!.kiemY).toBe(0)
  })

  it('multi-forge: one large gain converts repeatedly until cap', () => {
    const player = makeNguPlayer('golden_core') // cap 4, forgeCost(3) = 16_899

    gainKiemY(player, 16_899 * 3 + 123)

    expect(player.kiemTu!.kiemDaoCount).toBe(4)
    // Cap reached — per the gain-gate the remaining amount is NOT banked
    // once count hits cap mid-gain (the while loop stops at cap; the
    // leftover below forgeCost stays banked).
    expect(player.kiemTu!.kiemY).toBeLessThan(forgeCost(3))
  })

  it('uses the CURRENT realm forgeCost — cost rises after breakthrough', () => {
    const player = makeNguPlayer('foundation_establishment') // forgeCost(2) = 12_999

    gainKiemY(player, 9_999)
    expect(player.kiemTu!.kiemDaoCount).toBe(1)
    expect(player.kiemTu!.kiemY).toBe(9_999)

    gainKiemY(player, 3_000)
    expect(player.kiemTu!.kiemDaoCount).toBe(2)
    expect(player.kiemTu!.kiemY).toBe(0)
  })

  it('is a no-op for hien players and missing kiemTu state', () => {
    const player = makeNguPlayer('qi_refining')
    player.kiemTu!.mode = 'hien'

    gainKiemY(player, 9_999)
    expect(player.kiemTu!.kiemY).toBe(0)
    expect(player.kiemTu!.kiemDaoCount).toBe(1)

    const noPath = createDefaultPlayer()
    noPath.kiemTu = undefined
    gainKiemY(noPath, 9_999)
    expect(noPath.kiemTu).toBeUndefined()
  })
})

describe('applyBreakthroughMerge', () => {
  it('snapshots count into base BEFORE reset: count 3 / base 1 → base 1.9, count 1', () => {
    const state = { ...freshKiemTuState(), mode: 'ngu' as const, kiemDaoCount: 3, kiemDaoBase: 1 }

    applyBreakthroughMerge(state)

    expect(state.kiemDaoBase).toBeCloseTo(1 + KIEM_DAO_MERGE_BONUS * 3, 10)
    expect(state.kiemDaoCount).toBe(1)
  })

  it('kiemY is untouched by the merge', () => {
    const state = {
      ...freshKiemTuState(),
      mode: 'ngu' as const,
      kiemDaoCount: 4,
      kiemDaoBase: 2,
      kiemY: 777,
    }

    applyBreakthroughMerge(state)

    expect(state.kiemY).toBe(777)
    expect(state.kiemDaoBase).toBeCloseTo(2 * (1 + KIEM_DAO_MERGE_BONUS * 4), 10)
  })

  it('compounds across merges (base multiplies, not adds)', () => {
    const state = { ...freshKiemTuState(), mode: 'ngu' as const, kiemDaoCount: 2, kiemDaoBase: 1 }

    applyBreakthroughMerge(state) // base = 1 * 1.6 = 1.6, count 1
    state.kiemDaoCount = 3
    applyBreakthroughMerge(state) // base = 1.6 * 1.9 = 3.04

    expect(state.kiemDaoBase).toBeCloseTo(3.04, 10)
    expect(state.kiemDaoCount).toBe(1)
  })
})

describe('realm-advance merge hook (GameManagerRealmAdvanceOps)', () => {
  it('applies the merge for ngu, never for hien', () => {
    const gameManager = new GameManager()

    const ngu = makeNguPlayer('golden_core')
    ngu.kiemTu!.kiemDaoCount = 4
    gameManager.realmAdvanceOps.applyKiemTuRealmTransition(ngu)

    expect(ngu.kiemTu!.kiemDaoCount).toBe(1)
    expect(ngu.kiemTu!.kiemDaoBase).toBeCloseTo(1 + KIEM_DAO_MERGE_BONUS * 4, 10)

    const hien = makeNguPlayer('golden_core')
    hien.kiemTu!.mode = 'hien'
    hien.kiemTu!.kiemDaoCount = 4
    gameManager.realmAdvanceOps.applyKiemTuRealmTransition(hien)

    expect(hien.kiemTu!.kiemDaoCount).toBe(4)
    expect(hien.kiemTu!.kiemDaoBase).toBe(1)
  })
})
