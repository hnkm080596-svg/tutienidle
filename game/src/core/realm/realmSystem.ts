import { REALMS } from '../../data/realms/realm'

export function getCurrentRealm(realmId: string) {
  const realm = REALMS.find((realm) => realm.id === realmId)

  if (!realm) {
    throw new Error(`Không tìm thấy cảnh giới: ${realmId}`)
  }

  return realm
}

export function getNextRealm(realmId: string) {
  const index = REALMS.findIndex((realm) => realm.id === realmId)

  if (index === -1) {
    return null
  }

  return REALMS[index + 1] ?? null
}

// Rework "100% moi tieu canh gioi" (2026-08-16) - x, don vi thoi gian
// GOC (giay) cho ngan sach tu luyen moi dai canh gioi, xem
// RealmData.realmDurationMultiplier. Hang so dieu chinh duoc theo yeu
// cau - doi 1 dong nay de retune toan bo toc do tu luyen cua MOI canh
// gioi tru Pham Nhan. Tam thoi = 1 ngay.
export const BASE_CULTIVATION_UNIT_SECONDS = 86400

// Toc do tu luyen CO BAN dung de quy doi ngan sach thoi gian o tren
// thanh luong cultivation can. Phap Tu Redesign (magicpath, 2026-08-18)
// - cultivationRate da bi xoa HOAN TOAN khoi Stats; day la toc do NEN.
// Tu 2026-08-27, thien phu character creation co the nhan toc do nay
// (xem core/talent/TalentEffects.ts's getCultivationSpeedMultiplier), nhung
// yeu cau tu vi moi tang van tinh theo toc do nen de khong pha vo pace.
export const BASE_CULTIVATION_PER_SECOND = 10

// Moc tang toi thieu CHUNG cho moi cong dot pha dai canh gioi
// (2026-08-27): moc 12 = Nhan Dao baseline. Tu vi luon chi la moc thap
// nhat; cac gate/cap dot pha an khac (vi du 4 muc Kien Co cho Luyen Khi
// -> Truc Co) se duoc thiet ke sau. Dung lai 1 hang so duy nhat cho
// mortal -> qi_refining (GameManager.chooseCultivationPath()) VA
// qi_refining -> foundation_establishment (GameManager.canTriggerBreakthrough()).
export const CORE_REALM_LEVEL = 12

// QI-D5 - the Truc Co admission gate pins the qi_refining chapter-final
// stage clear alongside CORE_REALM_LEVEL (both mandatory). Mortal keeps
// the level-only gate: its initiation ritual is chooseCultivationPath.
export const QI_REFINING_BREAKTHROUGH_STAGE_ID = 'qi_refining_abyssal_pool'

export const EXTENDED_REALM_LEVEL = 18

// Trong 1 dai canh gioi, tang cuoi ton thoi gian lau hon tang dau theo
// duong cong mu nay (trong so tang T = growthRate^(T-1), tong ngan
// sach chia theo ti le trong so) - hang so dieu chinh duoc.
const INTRA_REALM_DURATION_GROWTH_RATE = 1.15

export function getRequiredCultivation(realmId: string, realmLevel: number): number {
  const realm = getCurrentRealm(realmId)

  if (realm.baseCultivationMinutes !== undefined) {
    return Math.floor(
      (realm.baseCultivationMinutes + Math.max(1, realmLevel) - 1) * 60 * BASE_CULTIVATION_PER_SECOND,
    )
  }

  if (realm.realmDurationMultiplier === undefined) {
    // XOR data contract (pinned in CultivationSystem.test.ts): a realm
    // without EITHER formula field is a data bug - fail loudly.
    throw new Error(`Realm "${realmId}" declares no cultivation formula field`)
  }

  const totalSeconds = realm.realmDurationMultiplier * BASE_CULTIVATION_UNIT_SECONDS

  let weightSum = 0

  for (let tang = 1; tang <= realm.maxLevel; tang++) {
    weightSum += Math.pow(INTRA_REALM_DURATION_GROWTH_RATE, tang - 1)
  }

  const tangWeight = Math.pow(INTRA_REALM_DURATION_GROWTH_RATE, realmLevel - 1)
  const tangSeconds = (totalSeconds * tangWeight) / weightSum

  return Math.floor(tangSeconds * BASE_CULTIVATION_PER_SECOND)
}

export function canBreakthrough(realmId: string, realmLevel: number): boolean {
  const realm = getCurrentRealm(realmId)

  return realmLevel < realm.maxLevel
}

/**
 * Vi tri (0-based) cua 1 dai canh gioi trong REALMS - dung de so
 * sanh "canh gioi nao cao hon" ma khong can biet realmLevel (vd
 * tinh Realm Pressure trong combat).
 */
export function getRealmIndex(realmId: string): number {
  return REALMS.findIndex((realm) => realm.id === realmId)
}

/**
 * Quy doi (realmId, realmLevel) thanh 1 so tang dan xuyen suot 9
 * dai canh gioi - dung de scale chi so chinh trang bi theo canh
 * gioi nguoi choi luc rot do (xem EquipmentSystem.createInstance()).
 */
export function getGlobalCultivationLevel(realmId: string, realmLevel: number): number {
  const index = REALMS.findIndex((realm) => realm.id === realmId)

  if (index === -1) {
    return realmLevel
  }

  let total = realmLevel

  for (let i = 0; i < index; i++) {
    total += REALMS[i]!.maxLevel
  }

  return total
}
