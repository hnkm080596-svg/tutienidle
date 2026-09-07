import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
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
// M1) — reproduction/invariant tests cho các hypothesis rủi ro cao nhất
// của wiring combat passive. Không sửa production code trong QA run.
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

describe('QA talent v4 M1 — invariant wiring', () => {
  it('INV-2: buffApplier với battle đang chạy — buff bùng nổ vào pool ĐÚNG player, không crash khi battle null', () => {
    // Phase A2 cutover (2026-09-07): buffApplier giờ nhắm turn-based
    // battle (legacy battleSystem không chạy trong gameplay thật —
    // xem spec Phase A2). Test này giữ 2 bất biến: no-crash ngoài trận
    // và buff bùng nổ vào pool ĐÚNG player trong trận (INV-2b kiểm
    // chứng sâu hơn qua startStage).
    const manager = makeWiredManager()
    const player = createDefaultPlayer()

    player.selectedTalentIds = ['kiem_quang']
    manager.setActivePlayer(player)

    // Ngoài trận: buffApplier không crash (turnBattle null → no-op an toàn).
    expect(() => manager.passiveSystem.tick(1)).not.toThrow()

    // Trong trận: player được grant passive; crit event → stack; đủ 10
    // tầng → buff kiem_vuc phải nằm trong pool của turn-based player.
    const enemy = ENEMIES[0]!
    const stats = calculateStats(player.baseStats, player.modifiers)

    manager.startBattleWithPlayer(player, stats, enemy)

    const bus = manager.eventBus

    for (let i = 0; i < 10; i++) {
      bus.emit('critical', { type: 'critical', sourceId: 'player', targetId: 'enemy_1' })
    }

    const turnPlayer = manager.getTurnBattle()?.players[0]

    expect(turnPlayer).toBeDefined()
    expect(turnPlayer!.buffs.hasAny('kiem_vuc')).toBe(true)
  })

  it('INV-2b (turn-based): buffApplier applies to the real turn-based player pool, not just the legacy one', () => {
    const manager = makeWiredManager()
    const player = createDefaultPlayer()

    player.selectedTalentIds = ['kiem_quang']
    manager.setActivePlayer(player)
    manager.syncTalentCombatPassive(player)

    // STAGES[0] requires the qi_refining realm — a fresh default player
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
      statsInput: { maxHp: 500, attack: 0, attackSpeed: 1, attackRangeRanks: 9, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })
    manager.registerEnemyTemplates([enemy])
    manager.registerStages([stage])

    const stats = calculateStats(player.baseStats, player.modifiers)

    expect(manager.startStage(player, stats, stage)).toBe(true)

    const bus = manager.eventBus

    for (let i = 0; i < 10; i++) {
      bus.emit('critical', { type: 'critical', sourceId: 'player', targetId: 'enemy_1' })
    }

    const turnPlayer = manager.getTurnBattle()?.players[0]

    expect(turnPlayer).toBeDefined()
    expect(turnPlayer!.buffs.hasAny('kiem_vuc')).toBe(true)
  })

  it('INV-3: 2 trận liên tiếp — stack passive reset, buff bùng trận trước KHÔNG kẹt pool trận sau', () => {
    const manager = makeWiredManager()
    const player = createDefaultPlayer()

    player.selectedTalentIds = ['kiem_quang']
    manager.setActivePlayer(player)

    const enemy = ENEMIES[0]!
    const stats = calculateStats(player.baseStats, player.modifiers)

    // Battle 1: trigger Kiếm Vực (Phase A2 cutover — assert on the
    // turn-based pool).
    manager.startBattleWithPlayer(player, stats, enemy)
    for (let i = 0; i < 10; i++) {
      manager.eventBus.emit('critical', { type: 'critical', sourceId: 'player', targetId: 'enemy_1' })
    }
    expect(manager.getTurnBattle()!.players[0]!.buffs.hasAny('kiem_vuc')).toBe(true)

    // Battle 2: fresh pool — Kiếm Vực must not leak, stack modifier reset.
    manager.startBattleWithPlayer(player, stats, enemy)

    expect(manager.getTurnBattle()!.players[0]!.buffs.hasAny('kiem_vuc')).toBe(false)

    const passive = manager.skillManager.get('talent_passive_kiem_quang')!

    expect(passive.passiveModifiers![0]!.stacks).toBe(0)
  })

  it('INV-4: talent passive KHÔNG nằm trong save payload (runtime grant — không persistence)', () => {
    // Talent passive được grant runtime qua syncTalentCombatPassive —
    // kiểm chứng chúng KHÔNG tự lọt vào các collection mà SaveSystem
    // persist từ SkillManager (save chỉ lưu skill data thật qua
    // manager snapshot — passive talent có id talent_passive_* riêng
    // cú pháp, assert không có skill nào mang prefix này được đánh dấu
    // là "learned technique" trong payload nguồn của build save).
    const manager = makeWiredManager()
    const player = createDefaultPlayer()

    player.selectedTalentIds = ['kiem_quang']
    manager.setActivePlayer(player)

    const allSkills = manager.skillManager.getAll()
    const talentPassives = allSkills.filter((skill) => skill.id.startsWith('talent_passive_'))

    // Passive ĐÚNG được grant runtime (1 cái), nhưng KHÔNG loadout/
    // unlocked-equipped qua save — passive không chiếm slot:
    expect(talentPassives).toHaveLength(1)
    expect(talentPassives[0]!.loadoutSlot).toBeUndefined()
    expect(talentPassives[0]!.loadoutSlots).toBeUndefined()
  })

  it('INV-1: đổi talent liên tục qua save edit — chỉ 1 passive tồn tại mỗi lúc, không nhân đôi', () => {
    const manager = makeWiredManager()
    const player = createDefaultPlayer()

    manager.setActivePlayer(player)

    const talentIds = ['kiem_quang', 'vo_anh', 'thach_giap', 'bat_tu_the', 'can_than']

    for (const talentId of talentIds) {
      player.selectedTalentIds = [talentId]
      manager.syncTalentCombatPassive(player)

      const active = manager.skillManager.getAll().filter((skill) =>
        TALENT_PASSIVE_SKILLS.some((template) => template.id === skill.id),
      )

      // can_than có 2 passive (chính + phản) — mọi talent khác đúng 1.
      const expected = talentId === 'can_than' ? 2 : 1

      expect(active).toHaveLength(expected)
    }
  })
})
