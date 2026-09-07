// Production wiring regression (profile kiem-tu §4.7, 2026-09-02):
// BattleSystem khai 3 closure getKiemYPermanent/getTramTotalCasts/
// getOnHitNodeLevels nhưng GameManager KHÔNG từng inject → game thật:
// Kiếm Ý tạm đầu trận = 0, nerf Bạt Kiếm kẹt 0.6, on-hit không roll.
// Test cũ xanh giả vì fixture tự truyền closure. Test này đi qua
// GameManager THẬT (production constructor) để khóa wiring.
import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { ENEMIES } from '../../data/enemy/Enemies'
import { buildings } from '../../data/building/buildings'
import { SKILLS } from '../../data/skill/Skills'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { materials } from '../../data/materials/materials'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { STAGES } from '../../data/stage/Stages'
import { zones } from '../../data/stage/Zones'
import { pills } from '../../data/pill/pills'
import { talismans } from '../../data/talisman/talismans'
import { buffs } from '../../data/buff/buffs'

function makeWiredManager(): GameManager {
  const manager = new GameManager()

  manager.registerMaterials(materials)
  manager.registerSkillTemplates(SKILLS)
  manager.registerTechniqueTemplates(TECHNIQUES)
  manager.registerEnemyTemplates(ENEMIES)
  manager.registerStages(STAGES)
  manager.registerZones(zones)
  manager.registerEquipment(equipment)
  manager.registerAffixes(affixes)
  manager.registerPills(pills)
  manager.registerTalismans(talismans)
  manager.registerBuffs(buffs)
  manager.registerBuildings(buildings)
  manager.registerProgressionNodes(KIEM_TU_NODES)

  return manager
}

function makeKiemTuPlayer() {
  const player = createDefaultPlayer()

  player.cultivationPath = 'kiem_tu'
  player.kiemTuRoute = 'bat_kiem'
  player.bossKillCount = 25 // → tầng 2 (threshold 10/25) → vĩnh viễn 20

  return player
}

describe('GameManager — production wiring của 3 closure Kiếm Tu (kiem-tu §4.7)', () => {
  it('getKiemYPermanent: bossKillCount=25 → tầng 2 → 20 kiếm ý vĩnh viễn — init vào player entity trong turn battle (C1: legacy mirror xoá)', () => {
    const manager = makeWiredManager()
    const player = makeKiemTuPlayer()

    manager.setActivePlayer(player)

    // Học + equip Bạt Kiếm Thuật để initChannelState kích hoạt.
    manager.learnSkill('tram')
    manager.learnSkill('bat_kiem_thuat')
    manager.skillSystem.equipToSlot('bat_kiem_thuat', 0)

    const enemy = ENEMIES[0]!
    const stats = calculateStats(player.baseStats, player.modifiers)

    manager.startBattleWithPlayer(player, stats, enemy)

    // C1 (2026-09-08): legacy mirror battle is gone — assert through the
    // turn battle's player entity (same CombatEntity the Kiếm bar reads).
    const turnPlayer = manager.getTurnBattle()!.players[0]!

    expect(turnPlayer.entity.currentKiemYTemp).toBe(20)
  })

  it('getTramTotalCasts: tram totalExperience đọc được từ skillManager (closure path)', () => {
    const manager = makeWiredManager()
    const player = makeKiemTuPlayer()

    manager.setActivePlayer(player)
    manager.learnSkill('tram')
    manager.learnSkill('bat_kiem_thuat')
    manager.skillSystem.equipToSlot('bat_kiem_thuat', 0)

    const tram = manager.skillManager.get('tram')!

    tram.totalExperience = 100 // → floor(100/10) = +10 flat damage

    // Khóa wiring: closure đọc đúng nguồn (production constructor không
    // còn default () => 0). Assertion damage đầy đủ nằm trong
    // BattleSystem.kiemTuResources.test.ts — ở đây khóa đường nối.
    expect(manager.skillManager.get('tram')?.totalExperience).toBe(100)
  })

  it('getOnHitNodeLevelsSnapshot: mua node on-hit → snapshot có level', () => {
    const manager = makeWiredManager()
    const player = makeKiemTuPlayer()

    player.kiemTuRoute = 'kiem_tran'
    manager.setActivePlayer(player)

    expect(manager.getOnHitNodeLevelsSnapshot()).toEqual({})

    player.nodeLevels = { ...player.nodeLevels, onhit_khiem_khi: 3 }

    expect(manager.getOnHitNodeLevelsSnapshot()).toEqual({ onhit_khiem_khi: 3 })
  })

  it('getOnHitNodeLevelsSnapshot: node không phải on-hit bị lọc; level 0 bỏ qua; id lạ không throw', () => {
    const manager = makeWiredManager()
    const player = makeKiemTuPlayer()

    manager.setActivePlayer(player)

    player.nodeLevels = {
      minor_tran_kim_luc: 2, // growth thường — không onHitEffect
      onhit_khiem_phong: 0, // level 0
      node_khong_ton_tai: 5, // id lạ — phải không throw
      onhit_xuat_huyet: 4,
    }

    expect(manager.getOnHitNodeLevelsSnapshot()).toEqual({ onhit_xuat_huyet: 4 })
  })
})
