import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { defineEnemy } from '../enemy/Enemy'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { SKILLS } from '../../data/skill/Skills'
import type { Equipment } from '../equipment/Equipment'
import type { EquipmentInstance } from '../equipment/EquipmentInstance'

const TEST_WEAPON: Equipment = {
  id: 'build_snapshot_test_sword',
  name: 'Test Sword',
  slot: 'weapon',
  grade: 1,
  maxEnhanceLevel: 10,
  mainStats: [{ stat: 'attack', min: 50, max: 50 }],
}

function manualWeaponInstance(): EquipmentInstance {
  return {
    instanceId: 'build-snapshot-test-1',
    itemId: TEST_WEAPON.id,
    slot: 'weapon',
    equipped: false,
    quality: 'pham_khi',
    rarity: 'hoang',
    realmId: 'qi_refining',
    mainStat: { id: 'roll-main-attack', sourceId: 'roll-main', sourceType: 'equipment', stat: 'attack', flat: 50 },
    affixes: [],
    forgePoints: 0,
  forgePotential: 100,
  }
}

function createTestEnemy() {
  return defineEnemy({
    id: 'build_snapshot_test_enemy',
    name: 'Test Enemy',
    level: 1,
    realmId: 'qi_refining',
    lane: 'ground',
    statsInput: {
      maxHp: 100,
      attack: 1,
      attackSpeed: 1,
      movementSpeed: 60,
      attackRangeRanks: 9,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
    },
    rewards: { techniqueInsight: 0, cultivation: 0, spiritStone: 0 },
  })
}

// Combat Rework Phase 8 — Class (CultivationPathKit) + Equipment
// (static modifier) + Pre-Battle Upgrade (Skill Specialization) đều
// ĐÃ có sẵn hạ tầng riêng (audit xác nhận, không phải xây mới) —
// test này là "acceptance test" DUY NHẤT xác nhận CẢ 3 nguồn thật sự
// cộng dồn đúng vào 1 build snapshot rồi flow đúng vào battle.player.stats
// khi vào trận, mirror finalStats getter thật của stores/player.ts
// (calculateStats(baseStats, [...modifiers, ...externalModifiers])).
describe('GameManager — Build Snapshot: Class + Equipment + Pre-Battle Upgrade → Combat (Combat Rework Phase 8)', () => {
  it('cả 3 nguồn build cộng dồn đúng vào finalStats, rồi flow đúng vào battle.player.stats lúc vào trận', () => {
    const gameManager = new GameManager()

    gameManager.registerTechniqueTemplates(TECHNIQUES)
    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerEquipment([TEST_WEAPON])

    const player = createDefaultPlayer()

    const attackBeforeAnyBuild = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(),
    ]).attack

    // --- Class: chọn Kiếm Tu (path THẬT đã ship, không phải fixture)
    // — tự cấp Tâm Pháp (Technique) + 3 skill cố định.
    player.realmLevel = 12
    expect(gameManager.chooseCultivationPath('kiem_tu', player)).toBe(true)

    const attackAfterClass = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(),
    ]).attack

    // --- Equipment: trang bị vũ khí +50 attack (static modifier, KHÔNG
    // qua getAggregatedModifiers() — đi vào player.modifiers riêng,
    // đúng kiến trúc thật, xem stores/player.ts's finalStats).
    gameManager.equipmentBag.add(manualWeaponInstance())

    expect(gameManager.equipItem('build-snapshot-test-1', player)).toBe(true)

    player.modifiers = gameManager.getEquipmentModifiers()

    const attackAfterEquipment = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(),
    ]).attack

    expect(attackAfterEquipment).toBeGreaterThanOrEqual(attackAfterClass + 50)

    // --- Pre-Battle Upgrade: học skill THẬT có Specialization
    // ("behavior-changing node") — thai_hu_nhat_kiem, đổi hẳn effects.
    gameManager.learnSkill('thai_hu_nhat_kiem')
    // Execution policy rework (plan §8.6) — active skill equip qua slot.
    gameManager.skillSystem.equipToSlot('thai_hu_nhat_kiem', 0)

    const rawSkill = gameManager.skillManager.get('thai_hu_nhat_kiem')!

    const beforeSpec = gameManager.skillSystem.getEffectiveSkill(rawSkill)

    // Trạng thái gốc — kiếm khí pha Kim (components), không phải
    // physical đơn thuần.
    expect(beforeSpec.effects[0]?.components).toBeDefined()

    expect(gameManager.selectSkillSpecialization('thai_hu_nhat_kiem', 'trong_kiem')).toBe(true)

    const afterSpec = gameManager.skillSystem.getEffectiveSkill(rawSkill)

    // "Trọng Kiếm" override HẲN effects — mất components Kim, chuyển
    // thành physical đơn thuần, đúng ý "đổi HẲN cách skill hoạt động".
    expect(afterSpec.effects[0]?.damageType).toBe('physical')
    expect(afterSpec.effects[0]?.components).toBeUndefined()

    // --- Build Snapshot -> Combat: finalStats CUỐI CÙNG (đủ cả 3
    // nguồn: Class + Equipment + Upgrade) phải flow ĐÚNG vào
    // battle.player.stats khi bắt đầu trận — không tính lại gì khác.
    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(),
    ])

    expect(finalStats.attack).toBeGreaterThan(attackBeforeAnyBuild)

    gameManager.startBattleWithPlayer(player, finalStats, createTestEnemy())

    expect(gameManager.getBattle()!.player.stats.attack).toBe(finalStats.attack)
  })

  it('giữ nguyên skill runtime stats trong trận và chỉ nhận thay đổi ở trận kế tiếp', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    const runtimeSkill = {
      ...structuredClone(SKILLS[0]!),
      id: 'snapshot_runtime_skill',
      hoaTheGainPerCast: 1,
    }
    gameManager.skillManager.add(runtimeSkill)

    const stats = calculateStats(player.baseStats, [])
    gameManager.startBattleWithPlayer(player, stats, createTestEnemy())
    expect(gameManager.getBattle()!.player.skillStats?.hoaTheGainPerCast).toBe(1)
    expect(gameManager.getBattle()!.player.skillLevels?.snapshot_runtime_skill).toBe(runtimeSkill.level)

    runtimeSkill.hoaTheGainPerCast = 5
    runtimeSkill.level = 5
    expect(gameManager.getBattle()!.player.skillStats?.hoaTheGainPerCast).toBe(1)
    expect(gameManager.getBattle()!.player.skillLevels?.snapshot_runtime_skill).toBe(1)

    gameManager.startBattleWithPlayer(player, stats, createTestEnemy())
    expect(gameManager.getBattle()!.player.skillStats?.hoaTheGainPerCast).toBe(5)
    expect(gameManager.getBattle()!.player.skillLevels?.snapshot_runtime_skill).toBe(5)
  })
})
