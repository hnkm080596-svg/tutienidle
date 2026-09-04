import type { PlayerData } from '../../core/player/Player'
import type { StatModifier } from '../../core/stats/StatCalculator'
import { MAIN_STAT_KEYS } from '../../core/stats/StatTypes'
import type { FoundationType } from '../../core/breakthrough/FoundationType'

// Realm Passive & Pressure System (2026-08-20) — buff VĨNH VIỄN cấp
// lúc bước vào 1 đại cảnh giới mới (id = realmId ĐÍCH), xem
// core/realm/RealmPassiveSystem.ts. Thêm cảnh giới mới (Kim Đan+) chỉ
// cần thêm entry vào mảng này, không đụng gì tới hệ thống gọi.
export interface RealmPassiveDefinition {
  id: string

  name: string

  description: string

  buildModifiers: (player: PlayerData) => StatModifier[]
}

// Nhập Đạo (mục XI tài liệu) — Phàm Nhân -> Luyện Khí. Hiệu ứng nền
// scale THẲNG theo breakthroughGrade (1-6, chốt lúc Lễ Nhập Môn, xem
// core/realm/BodyRefinementSystem.ts) — KHÔNG tự chứa Realm Pressure
// (×2.00/×0.50), Combat System tự đọc breakthroughGrade để tính Pressure
// riêng (xem core/combat/RealmPressure.ts) — 2 hệ thống tách biệt đúng
// architecture mục XI.
const NHAP_DAO_PERCENT_PER_GRADE = 0.03

function buildNhapDaoModifiers(player: PlayerData): StatModifier[] {
  const percent = player.breakthroughGrade * NHAP_DAO_PERCENT_PER_GRADE

  const stats: StatModifier['stat'][] = ['maxHp', 'maxMp', 'hpRegenPerTurn', 'manaRegenPerSecond']

  return stats.map((stat) => ({
    id: `realm-passive:nhap_dao:${stat}`,
    sourceId: 'nhap_dao',
    sourceType: 'realm',
    stat,
    percent,
  }))
}

// Kiến Cơ (mục XII-XIV tài liệu) — Luyện Khí -> Trúc Cơ, khuếch đại
// Main Stat theo "Loại Trúc Cơ". Thiết kế 2026-08-27: mốc 12 = Nhân Đạo
// baseline; 4 mức Kiến Cơ ẩn khác sẽ được thiết kế sau. TÁCH BIỆT hoàn
// toàn với breakthroughGrade/Realm Pressure (mục XIV — "2 hệ thống không
// chồng chéo"). Số liệu first pass, tinh chỉnh sau.
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

export const REALM_PASSIVES: RealmPassiveDefinition[] = [
  {
    id: 'qi_refining',
    name: 'Nhập Đạo',
    description:
      'Xây dựng sinh mệnh nền và mở đường tu luyện — hiệu lực theo Bậc Nhập Đạo đạt được lúc Lễ Nhập Môn.',
    buildModifiers: buildNhapDaoModifiers,
  },
  {
    id: 'foundation_establishment',
    name: 'Kiến Cơ',
    description: 'Xây dựng căn cơ, khuếch đại Main Stat — hiệu lực theo Loại Trúc Cơ đã đạt.',
    buildModifiers: buildKienCoModifiers,
  },
]
