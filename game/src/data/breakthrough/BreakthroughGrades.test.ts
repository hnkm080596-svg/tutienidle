import { describe, it, expect } from 'vitest'
import { createDefaultPlayer, type PlayerData } from '../../core/player/Player'
import { BODY_REFINEMENT_TIERS } from '../realm/BodyRefinement'
import { resolveKienCoGrade } from './BreakthroughGrades'
import { MERIDIANS } from '../realm/Meridians'

function createReadyPlayer(): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = 'qi_refining'
  player.realmLevel = 12
  return player
}

// Helper full mọi điều kiện Đại Đạo
function createGreatDaoPlayer(): PlayerData {
  const player = createReadyPlayer()
  player.realmLevel = 18
  player.selectedTalentIds = ['pham_cot']
  player.bodyRefinementCompletedTiers = 6
  player.mortalPerfectionAchieved = true
  player.openedMeridianIds = MERIDIANS.map((m) => m.id) // 9/9 gồm Kỳ Kinh
  // 5/5 main stat 30/30 (cap Luyện Khí — StatCap.ts)
  player.baseStats = { ...player.baseStats, strength: 30, dexterity: 30, intelligence: 30, attunement: 30, vitality: 30 }
  return player
}

describe('BodyRefinement caps cấp số nhân (spec §3.1)', () => {
  it('caps mới theo hệ số ×3.5 từ 50', () => {
    expect(BODY_REFINEMENT_TIERS.map((t) => t.cap)).toEqual([50, 175, 615, 2150, 7500, 26300])
  })
})

describe('resolveKienCoGrade — 4 bậc Kiến Cơ (spec §4.2)', () => {
  it('không đủ gì → Nhân Đạo (baseline)', () => {
    expect(resolveKienCoGrade(createReadyPlayer(), false)).toBe('human')
  })

  it('Địa Đạo: Trúc Cơ Đan + Luyện Th thể full 3 tầng đầu', () => {
    const player = createReadyPlayer()
    player.bodyRefinementCompletedTiers = 3
    expect(resolveKienCoGrade(player, true)).toBe('earth')
    // thiếu đan → rơi về Nhân
    expect(resolveKienCoGrade(player, false)).toBe('human')
    // chỉ 2 tầng → không đủ
    const thin = createReadyPlayer()
    thin.bodyRefinementCompletedTiers = 2
    expect(resolveKienCoGrade(thin, true)).toBe('human')
  })

  it('Thiên Đạo: đan + Luyện Th thể 6/6 + 6/8 kinh mạch', () => {
    const player = createReadyPlayer()
    player.bodyRefinementCompletedTiers = 6
    player.openedMeridianIds = MERIDIANS.slice(0, 6).map((m) => m.id)
    expect(resolveKienCoGrade(player, true)).toBe('heaven')
    // chỉ 5 đường → Địa
    const thin = createReadyPlayer()
    thin.bodyRefinementCompletedTiers = 6
    thin.openedMeridianIds = MERIDIANS.slice(0, 5).map((m) => m.id)
    expect(resolveKienCoGrade(thin, true)).toBe('earth')
  })

  it('Đại Đạo: đủ MỌI điều kiện (Kỳ Kinh 9/9 + Phàm Cốt + hoàn hảo Phàm Nhân + 30/30)', () => {
    const player = createGreatDaoPlayer()
    expect(resolveKienCoGrade(player, true)).toBe('great_dao')
  })

  it('Đại Đạo thiếu TỪNG điều kiện → rơi về Thiên', () => {
    // thiếu Kỳ Kinh (8/9)
    const noKyKinh = createGreatDaoPlayer()
    noKyKinh.openedMeridianIds = MERIDIANS.slice(0, 8).map((m) => m.id)
    expect(resolveKienCoGrade(noKyKinh, true)).toBe('heaven')
    // thiếu Phàm Cốt
    const noTalent = createGreatDaoPlayer()
    noTalent.selectedTalentIds = []
    expect(resolveKienCoGrade(noTalent, true)).toBe('heaven')
    // thiếu hoàn hảo Phàm Nhân
    const noPerfect = createGreatDaoPlayer()
    noPerfect.mortalPerfectionAchieved = false
    expect(resolveKienCoGrade(noPerfect, true)).toBe('heaven')
    // thiếu 30/30 (một stat 29)
    const noStats = createGreatDaoPlayer()
    noStats.baseStats = { ...noStats.baseStats, strength: 29 }
    expect(resolveKienCoGrade(noStats, true)).toBe('heaven')
    // thiếu đan → cả Địa không đủ (điều kiện lũy tiến) → human
    expect(resolveKienCoGrade(createGreatDaoPlayer(), false)).toBe('human')
  })

  it('greatDaoOpportunityLost: cap Thiên Đạo mọi lần xét sau (vĩnh viễn, spec §4.3)', () => {
    const player = createGreatDaoPlayer()
    player.greatDaoOpportunityLost = true
    expect(resolveKienCoGrade(player, true)).toBe('heaven')
  })
})
