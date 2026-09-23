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

describe('BodyRefinement caps cấp số nhân (spec §3.1)', () => {
  it('caps mới theo hệ số ×3.5 từ 50', () => {
    expect(BODY_REFINEMENT_TIERS.map((t) => t.cap)).toEqual([50, 175, 615, 2150, 7500, 26300])
  })
})

// Hidden Perfection Lineage (2026-09-23): the great_dao synthesis arm
// retired - a hidden breakthrough records 'great_dao' through the
// lineage channel (committed.breakthroughType), so this resolver only
// grades the NORMAL track (human / earth / heaven).
describe('resolveKienCoGrade — 3 bậc đột phá thường (spec §4.2)', () => {
  it('không đủ gì → Nhân Đạo (baseline)', () => {
    expect(resolveKienCoGrade(createReadyPlayer(), false)).toBe('human')
  })

  it('Địa Đạo: Trúc Cơ Đan + Luyện Th thể full 3 tầng đầu', () => {
    const player = createReadyPlayer()
    player.bodyProgression.body_refinement.completedTiers = 3
    expect(resolveKienCoGrade(player, true)).toBe('earth')
    // thieu dan -> roi ve Nhan
    expect(resolveKienCoGrade(player, false)).toBe('human')
    // chi 2 tang -> khong du
    const thin = createReadyPlayer()
    thin.bodyProgression.body_refinement.completedTiers = 2
    expect(resolveKienCoGrade(thin, true)).toBe('human')
  })

  it('Thiên Đạo: đan + Luyện Th thể 6/6 + 6/8 kinh mạch', () => {
    const player = createReadyPlayer()
    player.bodyProgression.body_refinement.completedTiers = 6
    player.physiqueGrade = 'bao'
    player.bodyProgression.meridian.openedIds = MERIDIANS.slice(0, 6).map((m) => m.id)
    expect(resolveKienCoGrade(player, true)).toBe('heaven')
    // chi 5 duong -> Dia
    const thin = createReadyPlayer()
    thin.bodyProgression.body_refinement.completedTiers = 6
    thin.physiqueGrade = 'bao'
    thin.bodyProgression.meridian.openedIds = MERIDIANS.slice(0, 5).map((m) => m.id)
    expect(resolveKienCoGrade(thin, true)).toBe('earth')
  })

  it('max heaven: resolver KHÔNG bao giờ trả great_dao (arm đã nghỉ)', () => {
    const player = createReadyPlayer()
    player.realmLevel = 18
    player.bodyProgression.body_refinement.completedTiers = 6
    player.physiqueGrade = 'bao'
    player.bodyProgression.meridian.openedIds = MERIDIANS.map((m) => m.id)
    player.baseStats = { ...player.baseStats, strength: 30, dexterity: 30, intelligence: 30, attunement: 30, vitality: 30 }
    expect(resolveKienCoGrade(player, true)).toBe('heaven')
  })
})
