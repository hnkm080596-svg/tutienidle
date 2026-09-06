import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { defineEnemy } from '../enemy/Enemy'
import type { Stage } from '../stage/Stage'

// Fix round 1 (2026-09-05) — regression cho finding Critical của review Task 2/2.5:
// restartTurnBattleCycle() (GameManager.ts) từng tính isFinalSpawn thẳng theo
// stageRef.totalEnemyCount (raw content data) thay vì effectiveTotalEnemyCount(stageRef)
// — trong khi wave object nó dựng ngay phía trên đã đúng effectiveTotalEnemyCount().
// Lệch này chỉ lộ ra ở cycle THỨ HAI trở đi (qua turnBattleRepeatContinuously): boss
// chết → victory → auto-restart → spawn factory tính sai isFinalSpawn=false vì so với
// totalEnemyCount thô (vd 5) thay vì effective (1) → pickEnemyForTurnSpawn() trả về
// quái enemyPool bình thường thay vì Boss — Boss KHÔNG bao giờ spawn lại trên repeat.
// GameManager.bossSolo.test.ts chỉ gọi startStage() 1 lần, không đi qua
// restartTurnBattleCycle() nên miss hoàn toàn bug này — bài test dưới đây lái NGUYÊN
// vòng lặp update() thật, bật repeatContinuously=true, để boss chết và cycle tự
// restart, rồi assert quái spawn ở cycle 2 vẫn là Boss (không phải mob enemyPool).
describe('boss stage — restartTurnBattleCycle() repeat cycle keeps spawning the boss', () => {
  it('a floor-10 boss stage under turnBattleRepeatContinuously still spawns the boss (not an enemyPool mob) on the 2nd cycle', () => {
    const gameManager = new GameManager()

    const bossTemplate = defineEnemy({
      id: 'repeat_test_boss', name: 'Repeat Boss', level: 1, realmId: 'mortal', lane: 'ground', isBoss: true,
      // maxHp cực thấp để player (basic attack mặc định, không cần chọn đạo)
      // giết Boss trong lượt đầu tiên, kích hoạt victory + auto-restart ngay.
      statsInput: { maxHp: 1, attack: 0, attackSpeed: 1, attackRangeRanks: 9, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })
    const mobTemplate = defineEnemy({
      // maxHp rất cao — nếu bug tái xuất hiện (mob spawn nhầm ở cycle 2), mob
      // sẽ KHÔNG chết trong vòng lặp test, id của nó vẫn lộ ra trong assertion.
      id: 'repeat_test_mob_should_not_spawn', name: 'Mob', level: 1, realmId: 'mortal', lane: 'ground',
      statsInput: { maxHp: 100000, attack: 0, attackSpeed: 1, attackRangeRanks: 9, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })

    const stage: Stage = {
      id: 'repeat_boss_stage', name: 'Repeat Boss Stage', description: '',
      floor: 10, bossEnemyId: 'repeat_test_boss',
      enemyPool: [{ enemyId: 'repeat_test_mob_should_not_spawn', weight: 1 }],
      // content author "sai" totalEnemyCount, giống GameManager.bossSolo.test.ts —
      // đây CHÍNH LÀ con số mà code cũ (chưa fix) so sánh nhầm trong isFinalSpawn.
      totalEnemyCount: 5, waves: [5],
      spawnIntervalSeconds: 0,
    }

    gameManager.registerEnemyTemplates([bossTemplate, mobTemplate])
    gameManager.registerStages([stage])

    const player = createDefaultPlayer()
    const stats = calculateStats(player.baseStats, [])

    gameManager.setActivePlayer(player)

    // repeatContinuously = true — bật đúng feature auto-repeat-farm thật
    // (GameManager.ts update() loop, gated bởi turnBattleRepeatContinuously).
    expect(gameManager.startStage(player, stats, stage, true)).toBe(true)

    const seenEnemyIds: string[] = []

    for (let i = 0; i < 1000 && seenEnemyIds.length < 2; i++) {
      gameManager.update(0.1)

      for (const enemy of gameManager.getTurnBattle()?.enemies ?? []) {
        if (!seenEnemyIds.includes(enemy.entity.id)) {
          seenEnemyIds.push(enemy.entity.id)
        }
      }
    }

    // Phải quan sát được ĐỦ 2 cycle trong vòng lặp test (nếu không, fixture sai).
    expect(seenEnemyIds.length).toBeGreaterThanOrEqual(2)

    // Cycle 1 (startStage, đường vốn đã đúng trước fix round 1).
    expect(seenEnemyIds[0]).toMatch(/^repeat_test_boss_/)

    // Cycle 2 (qua restartTurnBattleCycle — đường bị bug Critical) PHẢI vẫn là
    // Boss. Trước fix, dòng này lẽ ra là 'repeat_test_mob_should_not_spawn_...'.
    expect(seenEnemyIds[1]).toMatch(/^repeat_test_boss_/)
    expect(seenEnemyIds[1]).not.toContain('repeat_test_mob')
  })
})
