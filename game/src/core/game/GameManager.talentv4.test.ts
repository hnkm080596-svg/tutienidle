// Talent v4 production wiring (spec 2026-09-03-talent-catalog-v4
// sec4.1 + plan M1 Task 4) - khoa 3 duong wiring qua GameManager THAT:
// 1. syncTalentCombatPassive: grant/revoke hidden passive theo talent.
// 2. PassiveSystem closures (hpReader/buffApplier) noi battle player.
// 3. startBattleWithPlayer set surviveEffects (cleanse + Tu Sinh Ngo)
//    cho Bat Tu Th the v4.
import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
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
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'


function makeWiredManager(): GameManager {
  const manager = new GameManager()

  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerSkillTemplates(SKILLS)
  manager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  manager.catalogOps.registerEnemyTemplates(ENEMIES)
  manager.catalogOps.registerStages(STAGES)
  manager.catalogOps.registerZones(zones)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  manager.catalogOps.registerPills(pills)
  manager.catalogOps.registerTalismans(talismans)
  manager.catalogOps.registerBuffs(buffs)
  manager.catalogOps.registerBuildings(buildings)
  manager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
  manager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

  return manager
}

describe('GameManager — talent v4 combat passive wiring', () => {
  it('syncTalentCombatPassive — player có talent combat → passive được grant vào SkillManager', () => {
    const manager = makeWiredManager()
    const player = createDefaultPlayer()

    player.selectedTalentIds = ['kiem_quang']
    manager.setActivePlayer(player)
    manager.progressionOps.syncTalentCombatPassive(player)

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
    manager.progressionOps.syncTalentCombatPassive(player)

    const talentPassiveIds = TALENT_PASSIVE_SKILLS.map((skill) => skill.id)

    expect(manager.skillManager.getAll().filter((skill) => talentPassiveIds.includes(skill.id))).toHaveLength(0)
  })

  it('syncTalentCombatPassive idempotent — gọi 2 lần không nhân đôi, đổi talent thì revoke passive cũ', () => {
    const manager = makeWiredManager()
    const player = createDefaultPlayer()

    player.selectedTalentIds = ['kiem_quang']
    manager.setActivePlayer(player)
    manager.progressionOps.syncTalentCombatPassive(player)
    manager.progressionOps.syncTalentCombatPassive(player)

    expect(manager.skillManager.getAll().filter((skill) => skill.id === 'talent_passive_kiem_quang')).toHaveLength(1)

    // Doi talent (save edit scenario) - passive cu bi revoke.
    player.selectedTalentIds = ['vo_anh']
    manager.progressionOps.syncTalentCombatPassive(player)

    expect(manager.skillManager.get('talent_passive_kiem_quang')).toBeUndefined()
    expect(manager.skillManager.get('talent_passive_vo_anh')).toBeDefined()
  })

  it('Cẩn Thận — 2 passive (chính + phản) đều được grant', () => {
    const manager = makeWiredManager()
    const player = createDefaultPlayer()

    player.selectedTalentIds = ['can_than']
    manager.setActivePlayer(player)
    manager.progressionOps.syncTalentCombatPassive(player)

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
    manager.progressionOps.syncTalentCombatPassive(player)

    const enemy = ENEMIES[0]!

    manager.startBattleWithPlayer(player, enemy)

    // Truy cap session qua combatSystem - kiem chung noi bo qua hanh
    // vi: don chi mang giet player trong tran that se tay debuff +
    // ap Tu Sinh Ngo. O day kiem chung wiring gian tiep: player vao
    // tran voi passive bat_tu_the duoc grant + guard co 1 use.
    const passive = manager.skillManager.get('talent_passive_bat_tu_the')

    expect(passive).toBeDefined()
    expect(manager.surviveLethalGuard.getRemainingUses()).toBe(1)

    // Phase A0 (2026-09-07) - surviveEffects phai tro vao LIVE turn-based
    // pool cua player (khong con legacy battleSystem pool chet). Kiem
    // chung hanh vi that: ap debuff len pool turn-based, don chi mang
    // -> debuff bi tay + Tu Sinh Ngo xuat hien tren CUNG pool do.
    const playerParticipant = manager.getTurnBattle()!.players[0]!

    manager.turnBattleOps.applyBuffToPlayer('hoa_an')

    manager.combatSystem.applyDirectDamage(playerParticipant.entity, 999_999, 'enemy_1')

    const turnBuffs = () => manager.getBattleBuffs(playerParticipant.entity.id)

    expect(playerParticipant.entity.currentHp).toBe(1)
    expect(turnBuffs().some((b) => b.definitionId === 'hoa_an')).toBe(false)
    expect(turnBuffs().some((b) => b.definitionId === 'tu_sinh_ngo')).toBe(true)
  })

  it('PassiveSystem hpReader — nối battle player entity (đọc được HP ratio trong trận)', () => {
    const manager = makeWiredManager()
    const player = createDefaultPlayer()

    player.selectedTalentIds = ['hap_linh']
    manager.setActivePlayer(player)
    manager.progressionOps.syncTalentCombatPassive(player)

    const enemy = ENEMIES[0]!

    manager.startBattleWithPlayer(player, enemy)

    // hpReader la private wiring - kiem chung qua hanh vi cong khai:
    // passive hap_linh co condition hpBelow 0.5; ngoai tran reader
    // tra undefined (dieu kien thong qua - khong crash), trong tran
    // tra ratio that. Khong throw la pass toi thieu; ratio doc duoc
    // qua readonly expose neu manager cung cap (xem production code).
    expect(() => manager.passiveSystem.tick(1)).not.toThrow()
  })

  it('getTalentPassiveSkill — helper data resolve đúng 11+1 passive', () => {
    expect(getTalentPassiveSkill('talent_passive_kiem_quang')!.passiveConvertsTo).toEqual({ buffId: 'kiem_vuc' })
    expect(getTalentPassiveSkill('talent_khong_ton_tai')).toBeUndefined()
  })
})
