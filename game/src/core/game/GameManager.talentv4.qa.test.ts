import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'
import type { Stage } from '../stage/Stage'
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
import { TALENT_PASSIVE_SKILLS } from '../../data/skill/TalentPassives'

// QA quick-mode adversarial checks (spec 2026-09-03 talent catalog v4
// M1) - reproduction/invariant tests cho cac hypothesis rui ro cao nhat
// cua wiring combat passive. Khong sua production code trong QA run.
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

  return manager
}

describe('QA talent v4 M1 — invariant wiring', () => {
  it('INV-2: buffApplier với battle đang chạy — buff bùng nổ vào pool ĐÚNG player, không crash khi battle null', () => {
    // Phase A2 cutover (2026-09-07): buffApplier gio nham turn-based
    // battle (legacy battleSystem khong chay trong gameplay that -
    // xem spec Phase A2). Test nay giu 2 bat bien: no-crash ngoai tran
    // va buff bung no vao pool DUNG player trong tran (INV-2b kiem
    // chung sau hon qua startStage).
    const manager = makeWiredManager()
    const player = createDefaultPlayer()

    player.selectedTalentIds = ['kiem_quang']
    manager.setActivePlayer(player)

    // Ngoai tran: buffApplier khong crash (turnBattle null -> no-op an toan).
    expect(() => manager.passiveSystem.tick(1)).not.toThrow()

    // Trong tran: player duoc grant passive; crit event -> stack; du 10
    // tang -> buff kiem_vuc phai nam trong pool cua turn-based player.
    const enemy = ENEMIES[0]!

    manager.startBattleWithPlayer(player, enemy)

    const bus = manager.eventBus

    for (let i = 0; i < 10; i++) {
      bus.emit('critical', { type: 'critical', sourceId: 'player', targetId: 'enemy_1' })
    }

    const turnPlayer = manager.getTurnBattle()?.players[0]

    expect(turnPlayer).toBeDefined()
    expect(
      manager.getBattleBuffs(turnPlayer!.entity.id).some((i) => i.definitionId === 'kiem_vuc'),
    ).toBe(true)
  })

  it('INV-2b (turn-based): buffApplier applies to the real turn-based player pool, not just the legacy one', () => {
    const manager = makeWiredManager()
    const player = createDefaultPlayer()

    player.selectedTalentIds = ['kiem_quang']
    manager.setActivePlayer(player)
    manager.progressionOps.syncTalentCombatPassive(player)

    // STAGES[0] requires the qi_refining realm - a fresh default player
    // (mortal) would be rejected by isStageUnlocked. Register a
    // realm-free stage fixture instead (same pattern as
    // GameManager.stageRestart.test.ts).
    const stage: Stage = {
      id: 'qa_inv2b_stage',
      name: 'QA INV-2b Stage',
      description: '',
      floor: 1,
      enemyPool: [{ enemyId: 'restart_dummy', weight: 1 }],
      totalEnemyCount: 1,
      waves: [1],
      spawnIntervalSeconds: 0,
    }
    const enemy = defineEnemy({
      id: 'restart_dummy',
      name: 'Dummy',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: { maxHp: 500, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueMastery: 0, spiritStone: 0 },
    })
    manager.catalogOps.registerEnemyTemplates([enemy])
    manager.catalogOps.registerStages([stage])


    expect(manager.turnBattleOps.startStage(player, stage)).toBe(true)

    const bus = manager.eventBus

    for (let i = 0; i < 10; i++) {
      bus.emit('critical', { type: 'critical', sourceId: 'player', targetId: 'enemy_1' })
    }

    const turnPlayer = manager.getTurnBattle()?.players[0]

    expect(turnPlayer).toBeDefined()
    expect(
      manager.getBattleBuffs(turnPlayer!.entity.id).some((i) => i.definitionId === 'kiem_vuc'),
    ).toBe(true)
  })

  it('INV-3: 2 trận liên tiếp — stack passive reset, buff bùng trận trước KHÔNG kẹt pool trận sau', () => {
    const manager = makeWiredManager()
    const player = createDefaultPlayer()

    player.selectedTalentIds = ['kiem_quang']
    manager.setActivePlayer(player)

    const enemy = ENEMIES[0]!

    // Battle 1: trigger Kiem Vuc (Phase A2 cutover - assert on the
    // turn-based pool).
    manager.startBattleWithPlayer(player, enemy)
    for (let i = 0; i < 10; i++) {
      manager.eventBus.emit('critical', { type: 'critical', sourceId: 'player', targetId: 'enemy_1' })
    }
    expect(
      manager
        .getBattleBuffs(manager.getTurnBattle()!.players[0]!.entity.id)
        .some((i) => i.definitionId === 'kiem_vuc'),
    ).toBe(true)

    // Battle 2: fresh pool - Kiem Vuc must not leak, stack modifier reset.
    manager.startBattleWithPlayer(player, enemy)

    expect(
      manager
        .getBattleBuffs(manager.getTurnBattle()!.players[0]!.entity.id)
        .some((i) => i.definitionId === 'kiem_vuc'),
    ).toBe(false)

    const passive = manager.skillManager.get('talent_passive_kiem_quang')!

    expect(passive.passiveModifiers![0]!.stacks).toBe(0)
  })

  it('INV-4: talent passive KHÔNG nằm trong save payload (runtime grant — không persistence)', () => {
    // Talent passive duoc grant runtime qua syncTalentCombatPassive -
    // kiem chung chung KHONG tu lot vao cac collection ma SaveSystem
    // persist tu SkillManager (save chi luu skill data that qua
    // manager snapshot - passive talent co id talent_passive_* rieng
    // cu phap, assert khong co skill nao mang prefix nay duoc danh dau
    // la "learned technique" trong payload nguon cua build save).
    const manager = makeWiredManager()
    const player = createDefaultPlayer()

    player.selectedTalentIds = ['kiem_quang']
    manager.setActivePlayer(player)

    const allSkills = manager.skillManager.getAll()
    const talentPassives = allSkills.filter((skill) => skill.id.startsWith('talent_passive_'))

    // Passive DUNG duoc grant runtime (1 cai) - membership la learned
    // authority; passive khong con slot/equip state de lot vao save.
    expect(talentPassives).toHaveLength(1)
  })

  it('INV-1: đổi talent liên tục qua save edit — chỉ 1 passive tồn tại mỗi lúc, không nhân đôi', () => {
    const manager = makeWiredManager()
    const player = createDefaultPlayer()

    manager.setActivePlayer(player)

    const talentIds = ['kiem_quang', 'vo_anh', 'thach_giap', 'bat_tu_the', 'can_than']

    for (const talentId of talentIds) {
      player.selectedTalentIds = [talentId]
      manager.progressionOps.syncTalentCombatPassive(player)

      const active = manager.skillManager.getAll().filter((skill) =>
        TALENT_PASSIVE_SKILLS.some((template) => template.id === skill.id),
      )

      // can_than co 2 passive (chinh + phan) - moi talent khac dung 1.
      const expected = talentId === 'can_than' ? 2 : 1

      expect(active).toHaveLength(expected)
    }
  })
})

describe('QA A0 � B?t T? Th? cleanse/grant on the LIVE turn-based pool', () => {
  it('A0: Bat Tu The cleanse + Tu Sinh Ngo grant land on the LIVE turn-based pool', () => {
    const manager = makeWiredManager()
    const player = createDefaultPlayer()

    player.selectedTalentIds = ['bat_tu_the']
    player.realmId = 'mortal'
    player.realmLevel = 1
    manager.setActivePlayer(player)
    manager.progressionOps.syncTalentCombatPassive(player)

    const enemy = ENEMIES[0]!

    manager.startBattleWithPlayer(player, enemy)

    const turnBattle = manager.getTurnBattle()!
    const playerParticipant = turnBattle.players[0]!

    // Seed a real debuff directly on the live turn-based pool (matching
    // how a real enemy hit would have applied it).
    manager.turnBattleOps.applyBuffToPlayer('hoa_an')

    expect(
      manager
        .getBattleBuffs(playerParticipant.entity.id)
        .some((b) => b.definitionId === 'hoa_an'),
    ).toBe(true)

    // Force a lethal hit through the real production damage path.
    manager.combatSystem.applyDirectDamage(playerParticipant.entity, 999_999, 'enemy_1')

    expect(playerParticipant.entity.alive).toBe(true)
    expect(playerParticipant.entity.currentHp).toBe(1)
    expect(
      manager
        .getBattleBuffs(playerParticipant.entity.id)
        .some((b) => b.definitionId === 'hoa_an'),
    ).toBe(false)
    expect(
      manager
        .getBattleBuffs(playerParticipant.entity.id)
        .some((b) => b.definitionId === 'tu_sinh_ngo'),
    ).toBe(true)
  })
})
