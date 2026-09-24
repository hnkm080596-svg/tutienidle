import type { PlayerData } from '../../core/player/Player'
import type { StatModifier } from '../../core/stats/StatCalculator'
import { MAIN_STAT_KEYS } from '../../core/stats/StatTypes'
import type { FoundationType } from '../../core/breakthrough/FoundationType'

// Realm Passive & Pressure System (2026-08-20) - buff VINH VIEN cap
// luc buoc vao 1 dai canh gioi moi (id = realmId DICH), xem
// core/realm/RealmPassiveSystem.ts. Them canh gioi moi (Kim Dan+) chi
// can them entry vao mang nay, khong dung gi toi he thong goi.
export interface RealmPassiveDefinition {
  id: string

  name: string

  description: string

  // sourceId ma buildModifiers() dat len moi StatModifier no phat - khai
  // bao tuong minh de validator save co the doi chieu marker
  // grantedRealmPassiveIds voi payload modifiers con song (F-W-9).
  sourceId: string

  buildModifiers: (player: PlayerData) => StatModifier[]

  // Hidden Perfection Lineage (2026-09-23, master spec sec.4.4): when the
  // player ENTERED this passive's realm via a hidden breakthrough
  // (hiddenBreakthroughRealmIds contains this id), grantRealmPassive
  // calls this builder INSTEAD of buildModifiers. The enhanced
  // variant is authored per realm - never a universal multiplier.
  // A realm without one simply grants the normal variant.
  buildEnhancedModifiers?: (player: PlayerData) => StatModifier[]
}

// Nhap Dao (muc XI tai lieu) - Pham Nhan -> Luyen Khi. Hieu ung nen
// scale THANG theo breakthroughGrade (1-6, chot luc Le Nhap Mon, xem
// core/realm/body/BodyProgressionSystem.ts) - KHONG tu chua Realm Pressure
// (x2.00/x0.50), Combat System tu doc breakthroughGrade de tinh Pressure
// rieng (xem core/combat/RealmPressure.ts) - 2 he thong tach biet dung
// architecture muc XI.
const NHAP_DAO_PERCENT_PER_GRADE = 0.03

// sec.18 BALANCE-deferred placeholder - NON-CANONICAL. The enhanced
// (hidden-breakthrough) Nhap Dao percent models the conceptual 'Bac 7'
// tier (7 x NHAP_DAO_PERCENT_PER_GRADE). BALANCE owns the final number.
const NHAP_DAO_ENHANCED_PERCENT = 0.3 // spec sec.4.4 authored; NON-CANONICAL until the sec.18 balance pass

function buildNhapDaoModifiers(player: PlayerData): StatModifier[] {
  const percent = player.breakthroughGrade * NHAP_DAO_PERCENT_PER_GRADE

  // Task 3 (D17): the MP-pool stats carry domain:'spell' so the
  // Task-7 domain gate keeps accepting these grants once maxMp /
  // manaRegenPerTurn are gated to the spell domain.
  const universalStats: StatModifier['stat'][] = ['maxHp', 'hpRegenPerTurn']
  const spellPathStats: StatModifier['stat'][] = ['maxMp', 'manaRegenPerTurn']

  return [
    ...universalStats.map((stat) => ({
      id: `realm-passive:nhap_dao:${stat}`,
      sourceId: 'nhap_dao',
      sourceType: 'realm' as const,
      stat,
      percent,
    })),
    ...spellPathStats.map((stat) => ({
      id: `realm-passive:nhap_dao:${stat}`,
      sourceId: 'nhap_dao',
      sourceType: 'realm' as const,
      stat,
      percent,
      domain: 'spell' as const,
    })),
  ]
}

// Kien Co (muc XII-XIV tai lieu) - Luyen Khi -> Truc Co, khuech dai
// Main Stat theo "Loai Truc Co". Thiet ke 2026-08-27: moc 12 = Nhan Dao
// baseline; 4 muc Kien Co an khac se duoc thiet ke sau. TACH BIET hoan
// toan voi breakthroughGrade/Realm Pressure (muc XIV - "2 he thong khong
// chong cheo"). So lieu first pass, tinh chinh sau.
const KIEN_CO_MAIN_STAT_PERCENT: Record<FoundationType, number> = {
  human: 0,
  earth: 0.05,
  heaven: 0.1,
  great_dao: 0.2,
}

function buildKienCoModifiers(player: PlayerData): StatModifier[] {
  const foundationType = player.highestFoundationAchieved

  if (!foundationType) {
    return []
  }

  const percent = KIEN_CO_MAIN_STAT_PERCENT[foundationType]

  return MAIN_STAT_KEYS.map((stat) => ({
    id: `realm-passive:kien_co:${stat}`,
    sourceId: 'kien_co',
    sourceType: 'realm',
    stat,
    percent,
  }))
}

// sec.18 BALANCE-deferred placeholder - NON-CANONICAL. The enhanced
// Kien Co (hidden-breakthrough) Main Stat percent. BALANCE owns the
// final number; do not tune here.
const KIEN_CO_ENHANCED_MAIN_STAT_PERCENT = 0.2 // NON-CANONICAL (sec.18)

function buildEnhancedNhapDaoModifiers(_player: PlayerData): StatModifier[] {
  const universalStats: StatModifier['stat'][] = ['maxHp', 'hpRegenPerTurn']
  const spellPathStats: StatModifier['stat'][] = ['maxMp', 'manaRegenPerTurn']

  return [
    ...universalStats.map((stat) => ({
      id: `realm-passive:nhap_dao:${stat}`,
      sourceId: 'nhap_dao',
      sourceType: 'realm' as const,
      stat,
      percent: NHAP_DAO_ENHANCED_PERCENT,
    })),
    ...spellPathStats.map((stat) => ({
      id: `realm-passive:nhap_dao:${stat}`,
      sourceId: 'nhap_dao',
      sourceType: 'realm' as const,
      stat,
      percent: NHAP_DAO_ENHANCED_PERCENT,
      domain: 'spell' as const,
    })),
  ]
}

function buildEnhancedKienCoModifiers(_player: PlayerData): StatModifier[] {
  // The enhanced variant ignores highestFoundationAchieved - the
  // hidden breakthrough IS the enhanced record (a hidden entry's
  // foundation always lands as the authored enhanced passive).
  return MAIN_STAT_KEYS.map((stat) => ({
    id: `realm-passive:kien_co:${stat}`,
    sourceId: 'kien_co',
    sourceType: 'realm',
    stat,
    percent: KIEN_CO_ENHANCED_MAIN_STAT_PERCENT,
  }))
}

export const REALM_PASSIVES: RealmPassiveDefinition[] = [
  {
    id: 'qi_refining',
    name: 'Nhập Đạo',
    description:
      'Xây dựng sinh mệnh nền và mở đường tu luyện — hiệu lực theo Bậc Nhập Đạo đạt được lúc Lễ Nhập Môn.',
    sourceId: 'nhap_dao',
    buildModifiers: buildNhapDaoModifiers,
    buildEnhancedModifiers: buildEnhancedNhapDaoModifiers,
  },
  {
    id: 'foundation_establishment',
    name: 'Kiến Cơ',
    description: 'Xây dựng căn cơ, khuếch đại Main Stat — hiệu lực theo Loại Trúc Cơ đã đạt.',
    sourceId: 'kien_co',
    buildModifiers: buildKienCoModifiers,
    buildEnhancedModifiers: buildEnhancedKienCoModifiers,
  },
]
