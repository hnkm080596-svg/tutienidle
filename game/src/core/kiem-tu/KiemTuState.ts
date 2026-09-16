// Kiem Tu Reimagined (spec 2026-09-15 K1/K6/K14) — the ONE canonical
// state model for the path. Cultivation Path Framework M6: the
// discriminator moved OFF this slice — player.cultivationWay
// ('hien'|'ngu') is the membership check (isKiemTuHien/isKiemTuNgu);
// hien (Kiem Pho preset-combo) never reads kiemY/kiemDao*; ngu (Ngu
// Kiem Dao) never reads preset. All mutations go through the owning
// ops — applyPathChoice (create), NguKiemDao (economy),
// GameManagerRealmAdvanceOps (breakthrough merge).

/** Canonical orb ids — the ONLY ids the preset, cast log and combo
 *  patterns ever use (K6). KiemPhoOrbs.ts re-exports this union. */
export type OrbId = 'orb_dam' | 'orb_chem' | 'orb_bo' | 'orb_hat' | 'orb_quet'

/** Runtime membership list for the OrbId union — save validation and
 *  other catalog-membership checks consume this, not hand-rolled sets. */
export const KIEM_PHO_ORB_IDS: readonly OrbId[] = [
  'orb_dam',
  'orb_chem',
  'orb_bo',
  'orb_hat',
  'orb_quet',
]

export interface KiemTuState {
  /** Hien: the 1..9-orb auto-cast loop, persisted. Edited out of combat
   *  only (setKiemPhoPreset op). Meaningless to ngu. */
  preset: OrbId[]

  /** Ngu: banked Kiem Y — converts to Kiem Dao inside the gain hook at
   *  forgeCost(realmIndex); untouched by the breakthrough merge. */
  kiemY: number

  /** Ngu: live flying swords per cast — count instance for
   *  ngu_kiem_thuat; capped at realmIndex + 1; resets to 1 on merge. */
  kiemDaoCount: number

  /** Ngu: permanent damage multiplier on ngu_kiem_thuat, compounds
   *  through merges (x= (1 + 0.3 * mergedCount) per breakthrough). */
  kiemDaoBase: number
}

/** Spec-locked fresh state at path choice (K1). Way-agnostic: the
 *  same defaults serve hien (preset) and ngu (economy zeros). */
export function freshKiemTuState(): KiemTuState {
  return {
    preset: ['orb_dam'],
    kiemY: 0,
    kiemDaoCount: 1,
    kiemDaoBase: 1,
  }
}

/** K3 — mortal precursor skills: pre-path only for EVERY path (the Lv3
 *  mastery must be earned as a Pham Nhan). Only 'tram' exists today;
 *  linh_bao/huy_quyen are the planned phap/the precursors — the guard
 *  is table-driven so they are covered the day they get authored. */
export const MORTAL_PRECURSOR_SKILL_IDS = ['tram', 'linh_bao', 'huy_quyen'] as const
