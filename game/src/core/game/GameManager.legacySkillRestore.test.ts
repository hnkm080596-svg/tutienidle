import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { defineEnemy } from '../enemy/Enemy'
import { SKILLS } from '../../data/skill/Skills'
import { HERO_LANE_INDEX } from '../battle/BattleLane'
import type { GameSave } from '../../services/save/SaveSystem'
import type { Skill } from '../skill/Skill'

// Bug report 2026-08-26: "nhân vật không gây sát thương nữa dù vẫn tele".
// Root cause — save nhân vật CŨ (development build, không migration) lưu
// skill object NGUYÊN TRẠNG trước khi có field `execution` bắt buộc;
// scheduler thống nhất bỏ qua mọi active thiếu execution nên Player
// không bao giờ cast, trong khi teleport AI (không cần skill) vẫn chạy.
// Fix: restoreFromSave đối chiếu template để hồi phục authored data.
function buildLegacySave(skills: Skill[]): GameSave {
  return {
    player: {},
    techniques: [],
    skills,
    materials: [],
    pills: [],
    talismans: [],
    formations: [],
    equipment: [],
    buildings: [],
    equipmentSlots: [],
  } as unknown as GameSave
}

describe('GameManager — restore skill legacy thiếu execution (bugfix 2026-08-26)', () => {
  it('backfill execution từ template cho skill save cũ', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)

    // Mô phỏng skill object trong save cũ: progression state THẬT của
    // nhân vật đã học+trang bị (unlocked/equipped true), nhưng KHÔNG có
    // field execution (field sinh ra sau này).
    const legacyTram = JSON.parse(
      JSON.stringify(SKILLS.find((skill) => skill.id === 'tram')),
    ) as Skill

    delete legacyTram.execution
    legacyTram.unlocked = true
    legacyTram.equipped = true

    gameManager.restoreFromSave(buildLegacySave([legacyTram]))

    const restored = gameManager.skillManager.get('tram')!

    expect(restored.equipped).toBe(true)
    expect(restored.execution?.kind).toBe('attack_speed')
  })

  it('end-to-end: sau restore, Trảm gây sát thương lại bình thường (symptom của bug report)', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)

    const legacyTram = JSON.parse(
      JSON.stringify(SKILLS.find((skill) => skill.id === 'tram')),
    ) as Skill

    delete legacyTram.execution
    legacyTram.unlocked = true
    legacyTram.equipped = true

    gameManager.restoreFromSave(buildLegacySave([legacyTram]))

    // App.vue's boot path — bảo đảm Trảm chiếm slot mặc định.
    if (!gameManager.skillManager.getEquippedInSlot(0)) {
      gameManager.skillSystem.equipToSlot('tram', 0)
    }

    const player = createDefaultPlayer()
    const stats = calculateStats({ ...player.baseStats, attack: 100 }, [])

    const enemy = defineEnemy({
      id: 'legacy_restore_dummy',
      name: 'Dummy',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: {
        maxHp: 1000,
        attack: 0,
        attackSpeed: 1,
        movementSpeed: 0,
        attackRangeRanks: 5,
        criticalRate: 0,
        criticalDamage: 1.5,
        armor: 0,
      },
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })

    gameManager.registerEnemyTemplates([enemy])
    gameManager.startBattleWithPlayer(player, stats, enemy)
    gameManager.update(3) // Bỏ qua countdown + telegraph spawn.

    const battle = gameManager.getBattle()!

    battle.enemies[0]!.entity.x = 2
    battle.enemies[0]!.entity.row = HERO_LANE_INDEX

    for (let index = 0; index < 150; index++) {
      gameManager.update(0.05)
    }

    expect(battle.enemies[0]!.entity.currentHp).toBeLessThan(1000)
  })
})
