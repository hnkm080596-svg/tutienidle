import { getRealmIndex } from '../realm/realmSystem'

// PLAN HOAN CHINH muc 3 - tran cua MOI Main Stat. CO Y KHONG dung
// RealmData.attributeCap - field do da co y nghia RIENG (tran cong don
// vinh vien tu Dan duoc, xem PillSystem.canUse()), chi dinh nghia cho
// 3/10 canh gioi - tai dung ten/field do cho Main Stat se dung do.
//
// 2026-08-20 (Realm Passive & Pressure follow-up) - thay cong thuc x2
// moi dai canh gioi cu bang bang so lieu tay cho 3 canh gioi dau (yeu
// cau cu the: Pham Nhan 10 / Luyen Khi 30 / Truc Co 100, khong con
// theo cap so nhan sach x2 nua). baseStats khoi diem moi Main Stat = 1
// (xem StatBlock.ts's createBaseStats()) - tran 10 o Pham Nhan cho
// dung 9 diem headroom de dau tu trong 18 tang.
const MAIN_STAT_CAP_BY_REALM_ID: Record<string, number> = {
  mortal: 10,
  qi_refining: 30,
  foundation_establishment: 100,
}

// Canh gioi CHUA co so lieu tay o tren (Kim Dan tro di) - tiep tuc
// nhan doi moi dai canh gioi, neo vao tran Truc Co (100) thay vi cong
// thuc 10*2^index cu, de khong bi "gay khuc" ngay sau Truc Co.
const FALLBACK_ANCHOR_REALM_INDEX = 2
const FALLBACK_ANCHOR_CAP = 100

export function getMainStatCap(realmId: string): number {
  const explicit = MAIN_STAT_CAP_BY_REALM_ID[realmId]

  if (explicit !== undefined) {
    return explicit
  }

  const realmIndex = getRealmIndex(realmId)

  return FALLBACK_ANCHOR_CAP * 2 ** Math.max(0, realmIndex - FALLBACK_ANCHOR_REALM_INDEX)
}

// Hidden Perfection Lineage (design 2026-09-23 sec.7, master spec sec.3) -
// each COMPLETED hidden body raises every main-stat cap by +10pp
// ADDITIVE on the current realm's base cap. The bonus RAISES THE CAP
// ONLY - it never fills stats (design sec.7.2: the player must earn the
// headroom themselves).
export const HIDDEN_BODY_CAP_BONUS_PER_REALM = 0.1

interface EffectiveCapPlayer {
  realmId: string
  hiddenPerfection?: { completedHiddenBodyRealmIds: readonly string[] }
}

/**
 * The ONE canonical effective-cap read (master spec sec.3): every writer
 * that grants or gates main-stat gains (attribute points, profession
 * pills, hidden eligibility, rewards) clamps at this value, never at
 * getMainStatCap directly. Rounding rule: ONE rule for the whole
 * system - Math.floor of the exact product. No stat, realm or caller
 * may round differently.
 */
export function getEffectiveMainStatCap(player: EffectiveCapPlayer): number {
  const completed = player.hiddenPerfection?.completedHiddenBodyRealmIds.length ?? 0
  return Math.floor(getMainStatCap(player.realmId) * (1 + completed * HIDDEN_BODY_CAP_BONUS_PER_REALM))
}
