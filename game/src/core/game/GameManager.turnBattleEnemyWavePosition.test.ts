import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createDefaultPlayer } from '../player/Player'
import { asBaseStats } from '../stats/StatBlock'
import type { Stage } from '../stage/Stage'
import { SKILLS } from '../../data/skill/Skills'
import { SKILL_CORE_NODES } from '../../data/progression/SkillCoreNodes'
import { ENEMY_SIDE_REGION } from '../battle/BattlefieldRegions'

// Bug fix (2026-09-06, user report "quai van spawn goc tren ben trai thay
// vi ben san cua chung, bat dau tu con quai thu 2") - startStage()/
// restartTurnBattleCycle() truyen 1 factory `spawnEnemy` cho
// TurnBattleSystem de spawn quai thu 2 tro di giua wave (quai DAU TIEN di
// qua buildTurnBattle(), noi DA goi resolveEnemySpawnPosition() dung).
// Factory do truoc fix KHONG he goi resolveEnemySpawnPosition() - entity
// giu nguyen x:0/row:0 mac dinh cua enemyToCombatEntity() (Enemy.ts), tuc
// goc tren-trai cua luoi, thay vi random trong ENEMY_SIDE_REGION
// (columnMin 7). Test nay ghi lai vi tri spawn CUA TUNG quai (theo id, ke
// ca quai da chet/bi thay id khac) va khang dinh KHONG quai nao - ke ca
// quai thu 2, 3 tro di - spawn o cot 0.
describe('GameManager — turn-based wave spawn position (bug fix 2026-09-06)', () => {
  it('mọi quái trong wave (kể cả quái thứ 2 trở đi) spawn trong ENEMY_SIDE_REGION, không dính góc trên-trái (x=0)', () => {
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)

    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

    const mob = defineEnemy({
      id: 'wave_position_mob',
      name: 'Wave Mob',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: {
        // HP cuc thap - chet nhanh de wave spawn nhieu luot trong it tick.
        maxHp: 1,
        might: 0,
        attackSpeed: 1,
        criticalRate: 0,
        criticalDamage: 1.5,
        armor: 0,
      },
      rewards: { techniqueMastery: 0, spiritStone: 0 },
    })

    const stage: Stage = {
      id: 'wave_position_stage',
      name: 'Wave Position Stage',
      description: '',
      floor: 1,
      enemyPool: [{ enemyId: mob.id, weight: 1 }],
      // KHONG co bossEnemyId - effectiveTotalEnemyCount() giu nguyen 5,
      // du de quan sat quai thu 2+ (yeu cau toi thieu de bug lo ra).
      totalEnemyCount: 5, waves: [5],
      spawnIntervalSeconds: 0,
    }

    gameManager.catalogOps.registerEnemyTemplates([mob])
    gameManager.catalogOps.registerStages([stage])

    const player = createDefaultPlayer()
    player.baseStats = asBaseStats({ ...player.baseStats, might: 999  })

    expect(gameManager.progressionOps.learnSkill('linh_bao', player)).toBe(true)
    expect(gameManager.progressionOps.setMortalBasicSkill(player, 'linh_bao')).toBe(true)

    expect(gameManager.turnBattleOps.startStage(player, stage)).toBe(true)

    // id -> x (column) tai lan dau thay id do trong turn battle.
    const seenAtSpawn = new Map<string, number>()

    for (let index = 0; index < 400; index++) {
      combatSource.advance(COMBAT_STEP_SECONDS)

      for (const enemy of gameManager.getTurnBattle()?.enemies ?? []) {
        if (!seenAtSpawn.has(enemy.id)) {
          seenAtSpawn.set(enemy.id, enemy.entity.x)
        }
      }

      if (gameManager.getTurnBattle()?.state === 'victory' || gameManager.getTurnBattle()?.state === 'defeat') {
        break
      }
    }

    // Phai quan sat duoc it nhat quai #1 va #2 (wave 5 con, HP=1, might=999
    // - thua thoi gian de spawn toi thieu 2 con trong 400 tick).
    expect(seenAtSpawn.size).toBeGreaterThanOrEqual(2)

    for (const x of seenAtSpawn.values()) {
      expect(x).toBeGreaterThanOrEqual(ENEMY_SIDE_REGION.columnMin)
      expect(x).toBeLessThanOrEqual(ENEMY_SIDE_REGION.columnMax)
    }
  })
})
