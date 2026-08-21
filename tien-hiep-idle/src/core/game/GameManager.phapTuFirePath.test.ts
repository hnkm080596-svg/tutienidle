import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { SKILLS } from '../../data/skill/Skills'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'

// Skill tree redesign (2026-08-21, Plans/FirePath + Plans/magicpathgeneral)
// — Hỏa Cầu Thuật là ROOT NODE của Hỏa skill tree (hoa_linh_ngo, cost
// 0), chọn "phap_tu" tự mua node đó rồi trang bị vào slot 0, thay vì
// bắt người chơi tự mở Node Tree trước khi đánh được trận nào (xem
// GameManager.chooseCultivationPath()). 4 hành còn lại (Thủy/Mộc/Thổ/
// Kim) có root node riêng tốn 2 Skill Point, người chơi tự mua (xem
// data/progression/PhapTuNodes.ts's WATER_LINH_NGO/WOOD_LINH_NGO/
// EARTH_LINH_NGO/METAL_LINH_NGO) — test riêng ở GameManager.
// phapTuWaterPath.test.ts/phapTuWoodPath.test.ts/phapTuEarthPath.test.ts/
// phapTuMetalPath.test.ts.
describe('GameManager — Pháp Tu FirePath (chọn path tự cấp basic + Hỏa Node Tree Luyện Khí/Trúc Cơ)', () => {
  it('chooseCultivationPath("phap_tu") học CHỈ Hỏa Cầu Thuật và trang bị vào slot 0 — 4 hành còn lại CHƯA học', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    // Skill tree redesign — Hỏa Cầu Thuật giờ là root NODE (hoa_linh_ngo,
    // cost 0) chứ không phải learnSkill() gọi tay, cần nodeRegistry.
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    expect(gameManager.chooseCultivationPath('phap_tu', player)).toBe(true)

    const hoaCauThuat = gameManager.skillManager.get('hoa_cau_thuat')

    expect(hoaCauThuat?.unlocked).toBe(true)
    expect(hoaCauThuat?.equipped).toBe(true)
    expect(hoaCauThuat?.loadoutSlot).toBe(0)
    // Skill tree redesign (2026-08-21) — Hỏa Cầu Thuật KHÔNG còn
    // isBasicAttack, nó chiếm slot 0 của Loadout như mọi skill khác
    // (getLoadoutSkills() đọc qua loadoutSlot, không qua flag riêng).
    expect(hoaCauThuat?.isBasicAttack).toBeFalsy()
    expect(gameManager.skillManager.getLoadoutSkills().map(skill => skill.id)).toEqual(['hoa_cau_thuat'])

    // 4 hành còn lại CHƯA học — chưa có trong skillManager (chỉ có
    // trong skillTemplates), phải mua node "Lĩnh Ngộ" trước.
    for (const skillId of ['thuy_tien_thuat', 'doc_chuong', 'diem_kim_thuat', 'tho_cau_thuat']) {
      expect(gameManager.skillManager.get(skillId)).toBeUndefined()
    }
  })

  // Bug (2026-08-21) — trước đây CẢ 5 skill hệ (Hỏa/Thủy/Mộc/Thổ/Kim)
  // bị flag isBasicAttack:true, khiến RadialSkillSelector/getLoadoutSkills()
  // (đều lọc !isBasicAttack) không bao giờ liệt kê được skill nào để
  // equip — bấm slot khác chỉ thấy nút "Gỡ" của Hỏa Cầu Thuật (slot 0),
  // không có gì để chọn. Đã bỏ isBasicAttack khỏi cả 5 skill (chỉ
  // basic_strike/ngu_kiem_thuat của Phàm Nhân/Kiếm Tu còn giữ).
  it('setSkillLoadoutSlot: equip Thủy Tiễn Thuật vào slot 1 hoạt động bình thường, không đụng Hỏa Cầu Thuật ở slot 0', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    expect(gameManager.chooseCultivationPath('phap_tu', player)).toBe(true)

    player.skillPoints = 2

    expect(gameManager.purchaseNode('thuy_linh_ngo', player)).toBe(true)

    // Luyện Khí (qi_refining) mở đúng 2 slot — slot 1 hợp lệ.
    expect(gameManager.setSkillLoadoutSlot(player, 1, 'thuy_tien_thuat')).toBe(true)

    expect(gameManager.skillManager.get('thuy_tien_thuat')?.loadoutSlot).toBe(1)
    expect(gameManager.skillManager.get('hoa_cau_thuat')?.loadoutSlot).toBe(0)
    expect(gameManager.skillManager.getLoadoutSkills().map(skill => skill.id)).toEqual(['hoa_cau_thuat', 'thuy_tien_thuat'])
  })

  it('Hỏa Luyện Khí: 3 Minor mua được sau khi mua root (hoa_linh_ngo, cost 0), KHÔNG mua được trước đó', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    player.skillPoints = 3

    expect(gameManager.purchaseNode('minor_fire_intensity', player)).toBe(false)

    expect(gameManager.purchaseNode('hoa_linh_ngo', player)).toBe(true)
    expect(gameManager.skillManager.get('hoa_cau_thuat')?.unlocked).toBe(true)
    // Root cost 0 — không tốn Skill Point.
    expect(player.skillPoints).toBe(3)

    expect(gameManager.purchaseNode('minor_fire_intensity', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_fire_burn', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_fire_haste', player)).toBe(true)

    expect(player.skillPoints).toBe(0)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(),
    ])

    expect(finalStats.ailmentPotencyPercent).toBeGreaterThanOrEqual(0.05)
    expect(finalStats.projectileSpeedPercent).toBeGreaterThanOrEqual(0.05)
  })

  it('Hỏa Trúc Cơ: Major Dẫn Hỏa/Tụ Hỏa bị chặn trước Trúc Cơ, loại trừ lẫn nhau sau khi mua 1 trong 2', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    player.skillPoints = 10
    player.realmId = 'qi_refining'

    expect(gameManager.purchaseNode('hoa_linh_ngo', player)).toBe(true)

    // Chưa tới Trúc Cơ ('foundation') — cả 2 Major đều chặn.
    expect(gameManager.purchaseNode('hoa_truc_co_dan_hoa', player)).toBe(false)

    player.realmId = 'foundation'

    expect(gameManager.purchaseNode('hoa_truc_co_dan_hoa', player)).toBe(true)
    // Đã chọn Dẫn Hỏa (Reaction) — Tụ Hỏa (Pure) bị loại trừ.
    expect(gameManager.purchaseNode('hoa_truc_co_tu_hoa', player)).toBe(false)
  })

  it('Hỏa Trúc Cơ: Hỏa Tâm + Hỏa Nguyên (minor chung) chỉ cần Trúc Cơ, không cần chọn Major nào', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    player.skillPoints = 2
    player.realmId = 'foundation'

    expect(gameManager.purchaseNode('minor_fire_heart', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_fire_application', player)).toBe(true)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(),
    ])

    expect(finalStats.elementApplicationPercent).toBeGreaterThanOrEqual(0.05)
  })

  it('Hỏa Trúc Cơ Reaction: Dẫn Hỏa cấp thật elementApplicationPercent, Cộng Minh CHẶN nếu chưa chọn Dẫn Hỏa', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    player.skillPoints = 10
    player.realmId = 'foundation'

    expect(gameManager.purchaseNode('hoa_linh_ngo', player)).toBe(true)

    // Chưa mua Dẫn Hỏa — Cộng Minh (Minor Reaction) phải chặn.
    expect(gameManager.purchaseNode('minor_fire_reaction_effect', player)).toBe(false)

    expect(gameManager.purchaseNode('hoa_truc_co_dan_hoa', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_fire_reaction_effect', player)).toBe(true)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(),
    ])

    expect(finalStats.elementApplicationPercent).toBeGreaterThanOrEqual(0.15)
    expect(finalStats.reactionEffectPercent).toBeGreaterThanOrEqual(0.05)
  })

  it('Hỏa Trúc Cơ Pure: Tụ Hỏa cấp hoaTheGainPerCast, Hỏa Mạch/Tụ Viêm CHẶN nếu chưa chọn Tụ Hỏa', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    player.skillPoints = 10
    player.realmId = 'foundation'

    // Skill tree redesign — Hỏa Cầu Thuật giờ là root NODE (hoa_linh_ngo),
    // mua nó (cost 0) học skill vào skillManager, đúng con đường
    // purchaseNode() dùng cho mọi node khác thay vì learnSkill() tay.
    expect(gameManager.purchaseNode('hoa_linh_ngo', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_fire_channeling', player)).toBe(false)
    expect(gameManager.purchaseNode('minor_fire_retention', player)).toBe(false)

    expect(gameManager.purchaseNode('hoa_truc_co_tu_hoa', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_fire_channeling', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_fire_retention', player)).toBe(true)

    const hoaCauThuat = gameManager.skillManager.get('hoa_cau_thuat')

    // Tụ Hỏa flat 1 + Hỏa Mạch percent 0.1 (trên CÙNG stat) -> >= 1.
    expect(hoaCauThuat?.hoaTheGainPerCast).toBeGreaterThanOrEqual(1)
    expect(hoaCauThuat?.hoaTheDecayReductionPercent).toBeGreaterThanOrEqual(0.1)

    // Skill rework — SkillSystem.getSkillResourceStatModifiers() phải
    // đồng bộ đúng số đó thành CombatEntity.stats (combat đọc qua đây,
    // KHÔNG đọc thẳng Skill.field), cùng pipeline getAggregatedModifiers().
    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(),
    ])

    expect(finalStats.hoaTheGainPerCast).toBeCloseTo(hoaCauThuat!.hoaTheGainPerCast!, 5)
    expect(finalStats.hoaTheDecayReductionPercent).toBeCloseTo(hoaCauThuat!.hoaTheDecayReductionPercent!, 5)
  })
})
