import type { PlayerData } from '../player/Player'
import type { SwordPathState } from './KiemTuState'
import { isHiddenSwordPathway } from './KiemTuPath'
import { forgeCost, kiemDaoCap } from './KiemTuState'
import { getRealmIndex } from '../realm/realmSystem'

// Canonical bound formulas live on the KiemTuState leaf (re-exported
// here so existing consumers keep their import site).
export { forgeCost, kiemDaoCap }

// Kiem Tu Reimagined Task 8 (spec 2026-09-15 K14/K15) -- Ngu Kiem Dao
// economy. THE owner of the Kiem Y -> Kiem Dao conversion and the
// breakthrough merge. All numbers come from the CURRENT realmIndex --
// never snapshot at state-init time.
//
//   +1 Kiem Y per ngu_kiem_thuat cast (Task 9 provider onCastResolved)
//   forgeCost(realmIndex) = ceil(9999 * 1.3^(r-1)) -- the Kiem Y cost of
//     one Kiem Dao at that realm
//   kiemDaoCap(realmIndex) = realmIndex + 1
//   gain is a NO-OP at cap (K14b) -- excess Y is not banked past the cap
//   breakthrough merge: base *= 1 + 0.3 * mergedCount, count -> 1,
//     Kiem Y untouched (K15)

export const KIEM_DAO_MERGE_BONUS = 0.3

// Ngu Kiem Beta (design sec.56 -- first-pass, tuning deferred): the
// Lien evolution's Kiem The rate -- each landed prior sword of the same
// cast multiplies the next sword's coefficient by (1 + rate * stacks).
export const LIEN_MOMENTUM_RATE = 0.15

/**
 * The ONLY Kiem Y entry point (A3). No-op entirely when the player is
 * not on the hidden_sword_pathway way (cultivationWay is the discriminator — M6) or
 * when already at the realm cap — a capped forge does not bank Y.
 * Otherwise adds `amount` and converts greedily at the CURRENT realm's
 * forgeCost until under cost or at cap.
 */
export function gainKiemY(player: PlayerData, amount: number): void {
  const state = player.swordPath
  if (!state || !isHiddenSwordPathway(player) || amount <= 0) {
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
 * Breakthrough merge (K15): the swords forged this realm fold into the
 * permanent base multiplier, then the live count resets to 1. The
 * count snapshot MUST precede the reset — order is load-bearing.
 * Banked Kiem Y carries over untouched (it converts at the NEW realm's
 * forgeCost on the next gain).
 */
export function applyBreakthroughMerge(state: SwordPathState): void {
  const mergedCount = state.kiemDaoCount
  state.kiemDaoBase *= 1 + KIEM_DAO_MERGE_BONUS * mergedCount
  state.kiemDaoCount = 1
}
