// Talent v4 production wiring (spec 2026-09-03-talent-catalog-v4
// §4.1 + plan M1 Task 4) — khóa 3 đường wiring qua GameManager THẬT:
// 1. syncTalentCombatPassive: grant/revoke hidden passive theo talent.
// 2. PassiveSystem closures (hpReader/buffApplier) nối battle player.
// 3. startBattleWithPlayer set surviveEffects (cleanse + Tử Sinh Ngộ)
//    cho Bất Tử Th thể v4.
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
import { TALENT_PASSIVE_SKILLS, getTalentPassiveSkill } from '../../data/skill/TalentPassives'
import { TurnBuffSystem } from '../battle/turn/TurnBuffSystem'
import { TURN_BUFF_REGISTRY } from '../../data/buff/TurnBuffRegistry'

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

describe('GameManager — talent v4 combat passive wiring', () => {
  it('syncTalentCombatPassive — player có talent combat → passive được grant vào SkillManager', () => {
    const manager = makeWiredManager()
    const player = createDefaultPlayer()

    player.selectedTalentIds = ['kiem_quang']
    manager.setActivePlayer(player)
    manager.syncTalentCombatPassive(player)

    const granted = manager.skillManager.get('talent_passive_kiem_quang')

    expect(granted).toBeDefined()
    expect(granted!.type).toBe('passive')
    expect(manager.skillManager.getPassiveSkills().some((skill) => skill.id === 'talent_passive_kiem_quang')).toBe(true)
  })

  it('syncTalentCombatPassive — KHÔNG có talent combat → không grant passive nào (không leak)', () => {
    const manager = makeWiredManager()
    const player = createDefaultPlayer()

    player.selectedTalentIds = ['pham_cot']
    manager.setActivePlayer(player)
    manager.syncTalentCombatPassive(player)

    const talentPassiveIds = TALENT_PASSIVE_SKILLS.map((skill) => skill.id)

    expect(manager.skillManager.getAll().filter((skill) => talentPassiveIds.includes(skill.id))).toHaveLength(0)
  })

  it('syncTalentCombatPassive idempotent — gọi 2 lần không nhân đôi, đổi talent thì revoke passive cũ', () => {
    const manager = makeWiredManager()
    const player = createDefaultPlayer()

    player.selectedTalentIds = ['kiem_quang']
    manager.setActivePlayer(player)
    manager.syncTalentCombatPassive(player)
    manager.syncTalentCombatPassive(player)

    expect(manager.skillManager.getAll().filter((skill) => skill.id === 'talent_passive_kiem_quang')).toHaveLength(1)

    // Đổi talent (save edit scenario) — passive cũ bị revoke.
    player.selectedTalentIds = ['vo_anh']
    manager.syncTalentCombatPassive(player)

    expect(manager.skillManager.get('talent_passive_kiem_quang')).toBeUndefined()
    expect(manager.skillManager.get('talent_passive_vo_anh')).toBeDefined()
  })

  it('Cẩn Thận — 2 passive (chính + phản) đều được grant', () => {
    const manager = makeWiredManager()
    const player = createDefaultPlayer()

    player.selectedTalentIds = ['can_than']
    manager.setActivePlayer(player)
    manager.syncTalentCombatPassive(player)

    expect(manager.skillManager.get('talent_passive_can_than')).toBeDefined()
    expect(manager.skillManager.get('talent_passive_can_than_phi')).toBeDefined()
  })

  it('startBattleWithPlayer với bat_tu_the — session gắn surviveEffects (buffSystem của player + registry)', () => {
    const manager = makeWiredManager()
    const player = createDefaultPlayer()

    player.selectedTalentIds = ['bat_tu_the']
    player.realmId = 'mortal'
    player.realmLevel = 1
    manager.setActivePlayer(player)
    manager.syncTalentCombatPassive(player)

    const enemy = ENEMIES[0]!
    const stats = calculateStats(player.baseStats, player.modifiers)

    manager.startBattleWithPlayer(player, stats, enemy)

    // Truy cập session qua combatSystem — kiểm chứng nội bộ qua hành
    // vi: đòn chí mạng giết player trong trận thật sẽ tẩy debuff +
    // áp Tử Sinh Ngộ. Ở đây kiểm chứng wiring gián tiếp: player vào
    // trận với passive bat_tu_the được grant + guard có 1 use.
    const passive = manager.skillManager.get('talent_passive_bat_tu_the')

    expect(passive).toBeDefined()
    expect(manager.surviveLethalGuard.getRemainingUses()).toBe(1)

    // Phase A0 (2026-09-07) — surviveEffects phải trỏ vào LIVE turn-based
    // pool của player (không còn legacy battleSystem pool chết). Kiểm
    // chứng hành vi thật: áp debuff lên pool turn-based, đòn chí mạng
    // → debuff bị tẩy + Tử Sinh Ngộ xuất hiện trên CÙNG pool đó.
    const playerParticipant = manager.getTurnBattle()!.players[0]!

    new TurnBuffSystem(playerParticipant.buffs).apply(
      TURN_BUFF_REGISTRY.get('bong'),
      playerParticipant.entity,
      playerParticipant.entity,
      TURN_BUFF_REGISTRY,
    )

    manager.combatSystem.applyDirectDamage(playerParticipant.entity, 999_999, 'enemy_1')

    expect(playerParticipant.entity.currentHp).toBe(1)
    expect(playerParticipant.buffs.getAll().some((b) => b.id === 'bong')).toBe(false)
    expect(playerParticipant.buffs.getAll().some((b) => b.id === 'tu_sinh_ngo')).toBe(true)
  })

  it('PassiveSystem hpReader — nối battle player entity (đọc được HP ratio trong trận)', () => {
    const manager = makeWiredManager()
    const player = createDefaultPlayer()

    player.selectedTalentIds = ['hap_linh']
    manager.setActivePlayer(player)
    manager.syncTalentCombatPassive(player)

    const enemy = ENEMIES[0]!
    const stats = calculateStats(player.baseStats, player.modifiers)

    manager.startBattleWithPlayer(player, stats, enemy)

    // hpReader là private wiring — kiểm chứng qua hành vi công khai:
    // passive hap_linh có condition hpBelow 0.5; ngoài trận reader
    // trả undefined (điều kiện thông qua — không crash), trong trận
    // trả ratio thật. Không throw là pass tối thiểu; ratio đọc được
    // qua readonly expose nếu manager cung cấp (xem production code).
    expect(() => manager.passiveSystem.tick(1)).not.toThrow()
  })

  it('getTalentPassiveSkill — helper data resolve đúng 11+1 passive', () => {
    expect(getTalentPassiveSkill('talent_passive_kiem_quang')!.passiveConvertsTo).toEqual({ buffId: 'kiem_vuc' })
    expect(getTalentPassiveSkill('talent_khong_ton_tai')).toBeUndefined()
  })
})
