import type { PlayerData } from '../player/Player'
import type { KiemTuState } from './KiemTuState'
import { isKiemTuNgu } from './KiemTuPath'
import { getRealmIndex } from '../realm/realmSystem'

// Kiem Tu Reimagined Task 8 (spec 2026-09-15 K14/K15) — Ngu Kiem Dao
// economy. THE owner of the Kiem Y → Kiem Dao conversion and the
// breakthrough merge. All numbers come from the CURRENT realmIndex —
// never snapshot at state-init time.
//
//   +1 Kiem Y per ngu_kiem_thuat cast (Task 9 provider onCastResolved)
//   forgeCost(realmIndex) = ceil(9999 * 1.3^(r-1)) — the Kiem Y cost of
//     one Kiem Dao at that realm
//   kiemDaoCap(realmIndex) = realmIndex + 1
//   gain is a NO-OP at cap (K14b) — excess Y is not banked past the cap
//   breakthrough merge: base *= 1 + 0.3 * mergedCount, count → 1,
//     Kiem Y untouched (K15)

export const KIEM_DAO_MERGE_BONUS = 0.3

// Roll Cascade tunables (spec §11 first-pass values — the a/e/d unlock
// nodes live in Task 11; the provider consumes these, never inlines).
export const EXECUTE_MULT = 10
export const CASCADE_CRIT_CHANCE = 0.25
export const CASCADE_PIERCE_CHANCE = 0.5
export const PIERCE_FRACTION = 0.6

function assertRealmIndex(realmIndex: number): void {
  if (realmIndex < 1) {
    throw new RangeError(`kiem-tu ngu economy requires realmIndex >= 1, got ${realmIndex}`)
  }
}

/** Kiem Y cost of forging one Kiem Dao at this realm (asserts r>=1 —
 *  mortal cannot enter ngu, so r=0 is a contract violation). */
export function forgeCost(realmIndex: number): number {
  assertRealmIndex(realmIndex)
  return Math.ceil(9_999 * Math.pow(1.3, realmIndex - 1))
}

/** Max live flying swords at this realm (asserts r>=1). */
export function kiemDaoCap(realmIndex: number): number {
  assertRealmIndex(realmIndex)
  return realmIndex + 1
}

/**
 * The ONLY Kiem Y entry point (A3). No-op entirely when the player is
 * not on the ngu way (cultivationWay is the discriminator — M6) or
 * when already at the realm cap — a capped forge does not bank Y.
 * Otherwise adds `amount` and converts greedily at the CURRENT realm's
 * forgeCost until under cost or at cap.
 */
export function gainKiemY(player: PlayerData, amount: number): void {
  const state = player.kiemTu
  if (!state || !isKiemTuNgu(player) || amount <= 0) {
    return
  }

  const realmIndex = getRealmIndex(player.realmId)
  const cap = kiemDaoCap(realmIndex)

  if (state.kiemDaoCount >= cap) {
    return
  }

  state.kiemY += amount

  const cost = forgeCost(realmIndex)
  while (state.kiemY >= cost && state.kiemDaoCount < cap) {
    state.kiemY -= cost
    state.kiemDaoCount += 1
  }
}

/**
 * Trung Cung purchase grant (spec §5.4) — +N live swords WITHOUT
 * spending Kiem Y, clamped at the current realm cap. ngu-only; the
 * kiemDaoBelowCap prereq should already have rejected a capped buy —
 * this clamp is the second line of defense.
 */
export function grantKiemDao(player: PlayerData, amount: number): void {
  const state = player.kiemTu
  const realmIndex = getRealmIndex(player.realmId)

  if (!state || !isKiemTuNgu(player) || amount <= 0 || realmIndex < 1) {
    return
  }

  state.kiemDaoCount = Math.min(kiemDaoCap(realmIndex), state.kiemDaoCount + amount)
}

/**
 * Breakthrough merge (K15): the swords forged this realm fold into the
 * permanent base multiplier, then the live count resets to 1. The
 * count snapshot MUST precede the reset — order is load-bearing.
 * Banked Kiem Y carries over untouched (it converts at the NEW realm's
 * forgeCost on the next gain).
 */
export function applyBreakthroughMerge(state: KiemTuState): void {
  const mergedCount = state.kiemDaoCount
  state.kiemDaoBase *= 1 + KIEM_DAO_MERGE_BONUS * mergedCount
  state.kiemDaoCount = 1
}
