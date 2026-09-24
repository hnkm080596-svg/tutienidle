// HIDDEN-C - Chu Thien (Heavenly Circuit) authored constants, the Truc Co
// normal-Body track (design 2026-09-23 sec.11). Circulation is now 36
// DISCRETE deterministic steps (0/36, not a continuous 0..360 pool);
// capacity still derives from the foundation_establishment realm level
// (2 steps per level -> 36 at Lv18). Tieu/Dai survive as non-authoritative
// lore marks (sec.11.1) at steps 18/36.

import type { StatType } from '../../core/stats/StatTypes'

export const ZHOU_TIAN_REALM_ID = 'foundation_establishment'

/** Total authored Chu Thien advancements (sec.11.1: canonical 0/36). */
export const ZHOU_TIAN_TOTAL_STEPS = 36

/** Step capacity per Truc Co minor level (36/18 = 2 steps/level). */
export const ZHOU_TIAN_STEPS_PER_REALM_LEVEL = 2

/** Tieu Chu Thien lore mark - step 18. Non-authoritative display only. */
export const ZHOU_TIAN_TIEU_STEP = 18

/** Dai Chu Thien lore mark - step 36 = normal completion. */
export const ZHOU_TIAN_DAI_STEP = 36

// C2C-64 ruling (unchanged): Phap essence is the AUTHORED currency kind;
// only per-step COST VALUES are content-deferred below.
export const ZHOU_TIAN_CURRENCY_MATERIAL_ID = 'tinh_hoa_phap_the'

/** BALANCE - Tinh Hoa Phap The consumed to advance step `step` (0-indexed,
 * i.e. the advancement INTO step+1). Increasing flat curve; full 36-step
 * run totals 3690 essence. Design pins no cost shape - retune freely. */
export function zhouTianStepCost(step: number): number {
  return 15 + step * 5
}

/** BALANCE - authored raw/base combat-stat reward of step `step`
 * (0-indexed). Vocabulary is limited to raw combat stats by sec.11.3
 * (no five main stats, no generic percentage). Early steps weight maxHp,
 * later steps weight offense/defense - retune freely. */
export function zhouTianStepReward(step: number): Partial<Record<StatType, number>> {
  return {
    maxHp: 10 + step * 2,
    might: 2 + Math.floor(step / 4),
    defense: 1 + Math.floor(step / 6),
    hpRegenPerTurn: Math.floor(step / 9),
  }
}
