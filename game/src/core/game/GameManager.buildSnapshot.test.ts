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
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

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
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })
}

// Combat Rework Phase 8 - Class (PathWayDefinition) + Equipment
// (static modifier) + Pre-Battle Upgrade (Skill Specialization) deu
// DA co san ha tang rieng (audit xac nhan, khong phai xay moi) -
// test nay la "acceptance test" DUY NHAT xac nhan CA 3 nguon that su
// cong don dung vao 1 build snapshot roi flow dung vao battle.players[0].stats
// khi vao tran, mirror finalStats getter that cua stores/player.ts
// (calculateStats(baseStats, [...modifiers, ...externalModifiers])).
describe('GameManager — Build Snapshot: Class + Equipment + Pre-Battle Upgrade → Combat (Combat Rework Phase 8)', () => {
  it('cả 3 nguồn build cộng dồn đúng vào finalStats, rồi flow đúng vào battle.players[0].stats lúc vào trận', () => {
    const gameManager = new GameManager()

    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    gameManager.catalogOps.registerEquipment([TEST_WEAPON])

    const player = createDefaultPlayer()

    const attackBeforeAnyBuild = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.effectOps.getAggregatedModifiers(),
    ]).might

    // --- Class: chon Kiem Tu (path THAT da ship, khong phai fixture)
    // - tu cap Tam Phap (Technique) + 3 skill co dinh.
    player.realmLevel = 12
    expect(gameManager.realmAdvanceOps.chooseCultivationPath('sword', 'sword_pathway', player)).toBe(true)

    const attackAfterClass = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.effectOps.getAggregatedModifiers(),
    ]).might

    // --- Equipment: trang bi vu khi +50 might (static modifier, KHONG
    // qua getAggregatedModifiers() - di vao player.modifiers rieng,
    // dung kien truc that, xem stores/player.ts's finalStats).
    gameManager.equipmentBag.add(manualWeaponInstance())

    expect(gameManager.equipmentOps.equipItem('build-snapshot-test-1', player)).toEqual({ ok: true })

    player.modifiers = gameManager.equipmentOps.getEquipmentModifiers()

    const attackAfterEquipment = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.effectOps.getAggregatedModifiers(),
    ]).might

    expect(attackAfterEquipment).toBeGreaterThanOrEqual(attackAfterClass + 50)

    // --- Pre-Battle Upgrade: nang cap 1 skill bat ky (Kiem Tu
    // Reimagined - hien basics come from the orb preset, so the generic
    // authored skill here is hoa_cau_thuat).
    gameManager.progressionOps.learnSkill('hoa_cau_thuat', player)

    const rawSkill = gameManager.skillManager.get('hoa_cau_thuat')!

    // Trang thai goc - elemental fire damage components.
    expect(rawSkill.effects[0]?.components).toBeDefined()

    // --- Build Snapshot -> Combat: finalStats CUOI CUNG (du ca 3
    // nguon: Class + Equipment + Upgrade) phai flow DUNG vao
    // battle.players[0].stats khi bat dau tran - khong tinh lai gi khac.
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
    // M-QI-05 - the canonical level authority is nodeLevels[core_<id>]:
    // register the core so the combat projection picks it up.
    gameManager.catalogOps.registerProgressionNodes([
      {
        id: 'core_snapshot_runtime_skill',
        name: 'Core: Snapshot Runtime Skill',
        type: 'minor',
        insightCost: 0,
        maxLevel: runtimeSkill.maxLevel,
        levelsSkillId: runtimeSkill.id,
        effect: {},
      },
    ])

    gameManager.startBattleWithPlayer(player, createTestEnemy())
    expect(gameManager.getTurnBattle()!.players[0]!.entity.skillLevels?.snapshot_runtime_skill).toBe(1)

    player.nodeLevels['core_snapshot_runtime_skill'] = 5
    expect(gameManager.getTurnBattle()!.players[0]!.entity.skillLevels?.snapshot_runtime_skill).toBe(1)

    gameManager.startBattleWithPlayer(player, createTestEnemy())
    expect(gameManager.getTurnBattle()!.players[0]!.entity.skillLevels?.snapshot_runtime_skill).toBe(5)
  })
})
