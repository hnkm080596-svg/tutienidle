import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import type { Stage } from '../stage/Stage'
import { SKILLS } from '../../data/skill/Skills'
import { ENEMY_SIDE_REGION } from '../battle/BattlefieldRegions'

// Bug fix (2026-09-06, user report "quái vẫn spawn góc trên bên trái thay
// vì bên sân của chúng, bắt đầu từ con quái thứ 2") — startStage()/
// restartTurnBattleCycle() truyền 1 factory `spawnEnemy` cho
// TurnBattleSystem để spawn quái thứ 2 trở đi giữa wave (quái ĐẦU TIÊN đi
// qua buildTurnBattle(), nơi ĐÃ gọi resolveEnemySpawnPosition() đúng).
// Factory đó trước fix KHÔNG hề gọi resolveEnemySpawnPosition() — entity
// giữ nguyên x:0/row:0 mặc định của enemyToCombatEntity() (Enemy.ts), tức
// góc trên-trái của lưới, thay vì random trong ENEMY_SIDE_REGION
// (columnMin 7). Test này ghi lại vị trí spawn CỦA TỪNG quái (theo id, kể
// cả quái đã chết/bị thay id khác) và khẳng định KHÔNG quái nào — kể cả
// quái thứ 2, 3 trở đi — spawn ở cột 0.
describe('GameManager — turn-based wave spawn position (bug fix 2026-09-06)', () => {
  it('mọi quái trong wave (kể cả quái thứ 2 trở đi) spawn trong ENEMY_SIDE_REGION, không dính góc trên-trái (x=0)', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)

    const mob = defineEnemy({
      id: 'wave_position_mob',
      name: 'Wave Mob',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: {
        // HP cực thấp — chết nhanh để wave spawn nhiều lượt trong ít tick.
        maxHp: 1,
        attack: 0,
        attackSpeed: 1,
        attackRangeRanks: 999999,
        criticalRate: 0,
        criticalDamage: 1.5,
        armor: 0,
      },
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })

    const stage: Stage = {
      id: 'wave_position_stage',
      name: 'Wave Position Stage',
      description: '',
      floor: 1,
      enemyPool: [{ enemyId: mob.id, weight: 1 }],
      // KHÔNG có bossEnemyId — effectiveTotalEnemyCount() giữ nguyên 5,
      // đủ để quan sát quái thứ 2+ (yêu cầu tối thiểu để bug lộ ra).
      totalEnemyCount: 5, waves: [5],
      spawnIntervalSeconds: 0,
    }

    gameManager.registerEnemyTemplates([mob])
    gameManager.registerStages([stage])

    expect(gameManager.skillSystem.learn(SKILLS[0]!)).toBe(true)
    expect(gameManager.skillSystem.equipToSlot('tram', 0)).toBe(true)

    const player = createDefaultPlayer()
    const stats = calculateStats({ ...player.baseStats, attack: 999 }, [])

    expect(gameManager.startStage(player, stats, stage)).toBe(true)

    // id -> x (column) tại lần đầu thấy id đó trong turn battle.
    const seenAtSpawn = new Map<string, number>()

    for (let index = 0; index < 400; index++) {
      gameManager.update(0.05)

      for (const enemy of gameManager.getTurnBattle()?.enemies ?? []) {
        if (!seenAtSpawn.has(enemy.id)) {
          seenAtSpawn.set(enemy.id, enemy.entity.x)
        }
      }

      if (gameManager.getBattle()?.state === 'victory' || gameManager.getBattle()?.state === 'defeat') {
        break
      }
    }

    // Phải quan sát được ít nhất quái #1 và #2 (wave 5 con, HP=1, attack=999
    // — thừa thời gian để spawn tối thiểu 2 con trong 400 tick).
    expect(seenAtSpawn.size).toBeGreaterThanOrEqual(2)

    for (const x of seenAtSpawn.values()) {
      expect(x).toBeGreaterThanOrEqual(ENEMY_SIDE_REGION.columnMin)
      expect(x).toBeLessThanOrEqual(ENEMY_SIDE_REGION.columnMax)
    }
  })
})
