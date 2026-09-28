// Kiem Tu Reimagined (spec 2026-09-15 K1/K6/K14) - the ONE canonical
// state model for the path. Cultivation Path Framework M6: the
// discriminator moved OFF this slice - player.cultivationWay
// ('sword_pathway'|'hidden_sword_pathway') is the membership check (isSwordPathway/isHiddenSwordPathway);
// sword_pathway (Kiem Pho preset-combo) never reads kiemY/kiemDao*; hidden_sword_pathway (Ngu
// Kiem Dao) never reads preset. All mutations go through the owning
// ops - applyPathChoice (create), NguKiemDao (economy),
// GameManagerRealmAdvanceOps (breakthrough merge).

/** Canonical orb ids - the ONLY ids the preset, cast log and combo
 *  patterns ever use (K6). KiemPhoOrbs.ts re-exports this union. */
export type OrbId = 'orb_dam' | 'orb_chem' | 'orb_bo' | 'orb_hat' | 'orb_quet'

/** Runtime membership list for the OrbId union - save validation and
 *  other catalog-membership checks consume this, not hand-rolled sets. */
export const KIEM_PHO_ORB_IDS: readonly OrbId[] = [
  'orb_dam',
  'orb_chem',
  'orb_bo',
  'orb_hat',
  'orb_quet',
]

export interface SwordPathState {
  /** Hien: the 1..9-orb auto-cast loop, persisted. Edited out of combat
   *  only (setKiemPhoPreset op). Meaningless to hidden_sword_pathway. */
  preset: OrbId[]

  /** Ngu: banked Kiem Y - converts to Kiem Dao inside the gain hook at
   *  forgeCost(realmIndex); untouched by the breakthrough merge. */
  kiemY: number

  /** Ngu: live flying swords per cast - count instance for
   *  ngu_kiem_thuat; capped at realmIndex + 1; resets to 1 on merge. */
  kiemDaoCount: number

  /** Ngu: permanent damage multiplier on ngu_kiem_thuat, compounds
   *  through merges (x= (1 + 0.3 * mergedCount) per breakthrough). */
  kiemDaoBase: number
}

// Ngu economy bounds -- the slice's own realm-indexed formulas, kept
// at leaf level so BOTH the persisted-state validator (KiemTuPath)
// and the economy module (NguKiemDao) consume them without a runtime
// cycle. mortal cannot enter hidden_sword_pathway, so r<1 is a
// contract violation everywhere the formulas run.
function assertRealmIndex(realmIndex: number): void {
  if (realmIndex < 1) {
    throw new RangeError(`hidden_sword_pathway economy requires realmIndex >= 1, got ${realmIndex}`)
  }
}

/** Max live flying swords at this realm (asserts r>=1). */
export function kiemDaoCap(realmIndex: number): number {
  assertRealmIndex(realmIndex)
  return realmIndex + 1
}

/** Kiem Y cost of forging one Kiem Dao at this realm (asserts r>=1). */
export function forgeCost(realmIndex: number): number {
  assertRealmIndex(realmIndex)
  return Math.ceil(9_999 * Math.pow(1.3, realmIndex - 1))
}

/** Spec-locked fresh state at path choice (K1). Way-agnostic: the
 *  same defaults serve sword_pathway (preset) and hidden_sword_pathway (economy zeros). */
export function freshSwordPathState(): SwordPathState {
  return {
    preset: ['orb_dam'],
    kiemY: 0,
    kiemDaoCount: 1,
    kiemDaoBase: 1,
  }
}

// P7-M4 - MORTAL_PRECURSOR_SKILL_IDS moved to core/skill/MortalPrecursors.ts
// (the mortal-selectable basic set is a skill-domain concern, not a
// sword-path one).
