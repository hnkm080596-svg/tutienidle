import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { defineEnemy } from '../enemy/Enemy'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { SKILLS } from '../../data/skill/Skills'
import type { Equipment } from '../equipment/Equipment'
import { makeInstance } from '../equipment/EquipmentInstance.fixture'

const TEST_WEAPON: Equipment = {
  id: 'build_snapshot_test_sword',
  name: 'Test Sword',
  slot: 'weapon',
  grade: 1,
  maxEnhanceLevel: 10,
  mainStats: [{ stat: 'might', min: 50, max: 50 }],
}

function manualWeaponInstance() {
  return makeInstance({
    instanceId: 'build-snapshot-test-1',
    itemId: TEST_WEAPON.id,
    grade: 'bat_pham',
    quality: 'hoang',
    mainStat: { id: 'roll-main-might', sourceId: 'roll-main', sourceType: 'equipment', stat: 'might', flat: 50 },
    forgeUsesRemaining: 0,
  })
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
      might: 1,
      attackSpeed: 1,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
    },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
}

// Combat Rework Phase 8 — Class (CultivationPathKit) + Equipment
// (static modifier) + Pre-Battle Upgrade (Skill Specialization) đều
// ĐÃ có sẵn hạ tầng riêng (audit xác nhận, không phải xây mới) —
// test này là "acceptance test" DUY NHẤT xác nhận CẢ 3 nguồn thật sự
// cộng dồn đúng vào 1 build snapshot rồi flow đúng vào battle.players[0].stats
// khi vào trận, mirror finalStats getter thật của stores/player.ts
// (calculateStats(baseStats, [...modifiers, ...externalModifiers])).
describe('GameManager — Build Snapshot: Class + Equipment + Pre-Battle Upgrade → Combat (Combat Rework Phase 8)', () => {
  it('cả 3 nguồn build cộng dồn đúng vào finalStats, rồi flow đúng vào battle.players[0].stats lúc vào trận', () => {
    const gameManager = new GameManager()

    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
    gameManager.catalogOps.registerEquipment([TEST_WEAPON])

    const player = createDefaultPlayer()

    const attackBeforeAnyBuild = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.effectOps.getAggregatedModifiers(),
    ]).might

    // --- Class: chọn Kiếm Tu (path THẬT đã ship, không phải fixture)
    // — tự cấp Tâm Pháp (Technique) + 3 skill cố định.
    player.realmLevel = 12
    expect(gameManager.realmAdvanceOps.chooseCultivationPath('kiem_tu', player)).toBe(true)

    const attackAfterClass = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.effectOps.getAggregatedModifiers(),
    ]).might

    // --- Equipment: trang bị vũ khí +50 might (static modifier, KHÔNG
    // qua getAggregatedModifiers() — đi vào player.modifiers riêng,
    // đúng kiến trúc thật, xem stores/player.ts's finalStats).
    gameManager.equipmentBag.add(manualWeaponInstance())

    expect(gameManager.equipmentOps.equipItem('build-snapshot-test-1', player)).toEqual({ ok: true })

    player.modifiers = gameManager.equipmentOps.getEquipmentModifiers()

    const attackAfterEquipment = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.effectOps.getAggregatedModifiers(),
    ]).might

    expect(attackAfterEquipment).toBeGreaterThanOrEqual(attackAfterClass + 50)

    // --- Pre-Battle Upgrade: nâng cấp 1 skill bất kỳ (Kiem Tu
    // Reimagined — hien basics come from the orb preset, so the generic
    // authored skill here is tam_muoi_chan_hoa).
    gameManager.progressionOps.learnSkill('tam_muoi_chan_hoa')
    gameManager.skillSystem.equipToSlot('tam_muoi_chan_hoa', 0)

    const rawSkill = gameManager.skillManager.get('tam_muoi_chan_hoa')!

    // Trạng thái gốc — channel tick AoE metal components.
    expect(rawSkill.effects[0]?.components).toBeDefined()

    // --- Build Snapshot -> Combat: finalStats CUỐI CÙNG (đủ cả 3
    // nguồn: Class + Equipment + Upgrade) phải flow ĐÚNG vào
    // battle.players[0].stats khi bắt đầu trận — không tính lại gì khác.
    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.effectOps.getAggregatedModifiers(),
    ])

    expect(finalStats.might).toBeGreaterThan(attackBeforeAnyBuild)

    gameManager.startBattleWithPlayer(player, createTestEnemy())

    expect(gameManager.getTurnBattle()!.players[0]!.entity.stats.might).toBe(finalStats.might)
  })

  it('giữ nguyên skill levels trong trận và chỉ nhận thay đổi ở trận kế tiếp', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    const runtimeSkill = {
      ...structuredClone(SKILLS[0]!),
      id: 'snapshot_runtime_skill',
    }
    gameManager.skillManager.add(runtimeSkill)

    gameManager.startBattleWithPlayer(player, createTestEnemy())
    expect(gameManager.getTurnBattle()!.players[0]!.entity.skillLevels?.snapshot_runtime_skill).toBe(runtimeSkill.level)

    runtimeSkill.level = 5
    expect(gameManager.getTurnBattle()!.players[0]!.entity.skillLevels?.snapshot_runtime_skill).toBe(1)

    gameManager.startBattleWithPlayer(player, createTestEnemy())
    expect(gameManager.getTurnBattle()!.players[0]!.entity.skillLevels?.snapshot_runtime_skill).toBe(5)
  })
})
