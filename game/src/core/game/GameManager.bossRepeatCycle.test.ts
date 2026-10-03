import { afterEach, describe, expect, it, vi } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'
import type { Enemy } from '../enemy/Enemy'
import type { Stage } from '../stage/Stage'
import { StageWaveSystem } from './StageWaveSystem'
import { EventBus } from '../events/EventBus'
import { EnemySystem } from '../enemy/EnemySystem'
import { EnemyManager } from '../enemy/EnemyManager'
import { StageManager } from '../stage/StageManager'
import { StageSystem } from '../stage/StageSystem'
import { TemplateRegistry } from './TemplateRegistry'
import { HiddenBeastSystem } from './HiddenBeastSystem'

// Fix round 1 (2026-09-05) - regression cho finding Critical cua review Task 2/2.5:
// restartTurnBattleCycle() (GameManager.ts) tung tinh isFinalSpawn thang theo
// stageRef.totalEnemyCount (raw content data) thay vi effectiveTotalEnemyCount(stageRef)
// - trong khi wave object no dung ngay phia tren da dung effectiveTotalEnemyCount().
// Lech nay chi lo ra o cycle THU HAI tro di (qua turnBattleRepeatContinuously): boss
// chet -> victory -> auto-restart -> spawn factory tinh sai isFinalSpawn=false vi so voi
// totalEnemyCount tho (vd 5) thay vi effective (1) -> pickEnemyForTurnSpawn() tra ve
// quai enemyPool binh thuong thay vi Boss - Boss KHONG bao gio spawn lai tren repeat.
// GameManager.bossSolo.test.ts chi goi startStage() 1 lan, khong di qua
// restartTurnBattleCycle() nen miss hoan toan bug nay - bai test duoi day lai NGUYEN
// vong lap update() that, bat repeatContinuously=true, de boss chet va cycle tu
// restart, roi assert quai spawn o cycle 2 van la Boss (khong phai mob enemyPool).
describe('boss stage — restartTurnBattleCycle() repeat cycle keeps spawning the boss', () => {
  it('a floor-10 boss stage under turnBattleRepeatContinuously still spawns the boss (not an enemyPool mob) on the 2nd cycle', () => {
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)

    const bossTemplate = defineEnemy({
      id: 'repeat_test_boss', name: 'Repeat Boss', level: 1, realmId: 'mortal', lane: 'ground', isBoss: true,
      // maxHp cuc thap de player (basic attack mac dinh, khong can chon dao)
      // giet Boss trong luot dau tien, kich hoat victory + auto-restart ngay.
      statsInput: { maxHp: 1, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueMastery: 0, spiritStone: 0 },
    })
    const mobTemplate = defineEnemy({
      // maxHp rat cao - neu bug tai xuat hien (mob spawn nham o cycle 2), mob
      // se KHONG chet trong vong lap test, id cua no van lo ra trong assertion.
      id: 'repeat_test_mob_should_not_spawn', name: 'Mob', level: 1, realmId: 'mortal', lane: 'ground',
      statsInput: { maxHp: 100000, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueMastery: 0, spiritStone: 0 },
    })

    const stage: Stage = {
      id: 'repeat_boss_stage', name: 'Repeat Boss Stage', description: '',
      floor: 10, bossEnemyId: 'repeat_test_boss',
      enemyPool: [{ enemyId: 'repeat_test_mob_should_not_spawn', weight: 1 }],
      // content author "sai" totalEnemyCount, giong GameManager.bossSolo.test.ts -
      // day CHINH LA con so ma code cu (chua fix) so sanh nham trong isFinalSpawn.
      totalEnemyCount: 5, waves: [5],
      spawnIntervalSeconds: 0,
    }

    gameManager.catalogOps.registerEnemyTemplates([bossTemplate, mobTemplate])
    gameManager.catalogOps.registerStages([stage])

    const player = createDefaultPlayer()

    gameManager.setActivePlayer(player)

    // repeatContinuously = true - bat dung feature auto-repeat-farm that
    // (GameManager.ts update() loop, gated boi turnBattleRepeatContinuously).
    expect(gameManager.turnBattleOps.startStage(player, stage, true)).toBe(true)

    const seenEnemyIds: string[] = []

    for (let i = 0; i < 1000 && seenEnemyIds.length < 2; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)

      for (const enemy of gameManager.getTurnBattle()?.enemies ?? []) {
        if (!seenEnemyIds.includes(enemy.entity.id)) {
          seenEnemyIds.push(enemy.entity.id)
        }
      }
    }

    // Phai quan sat duoc DU 2 cycle trong vong lap test (neu khong, fixture sai).
    expect(seenEnemyIds.length).toBeGreaterThanOrEqual(2)

    // Cycle 1 (startStage, duong von da dung truoc fix round 1).
    expect(seenEnemyIds[0]).toMatch(/^repeat_test_boss_/)

    // Cycle 2 (qua restartTurnBattleCycle - duong bi bug Critical) PHAI van la
    // Boss. Truoc fix, dong nay le ra la 'repeat_test_mob_should_not_spawn_...'.
    expect(seenEnemyIds[1]).toMatch(/^repeat_test_boss_/)
    expect(seenEnemyIds[1]).not.toContain('repeat_test_mob')
  })
})

// Spec v3 D4/D5 (2026-09-11): the spawn pick rolls the tinh_anh tag only
// on the ACTIVE channel; idle passes allowTags: false and never rolls.
// Boss (floor 10) is a stage property applied unconditionally in BOTH
// modes via createBossVariant; in active mode the tag roll can still
// stack on top of the boss variant (spec section 2.2 table).
// Seam: rollChance/weightedRandom read Math.random - forced via spyOn.
describe('pickEnemyForTurnSpawn - spawn mode plumbing (spec v3 D4/D5)', () => {
  const TAG_MOB = defineEnemy({
    id: 'tag_spawn_mob', name: 'Spawn Mob', level: 1, realmId: 'mortal', lane: 'ground',
    statsInput: { maxHp: 100, might: 10, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })
  const TAG_BOSS = defineEnemy({
    id: 'tag_spawn_boss', name: 'Spawn Boss', level: 1, realmId: 'mortal', lane: 'ground',
    statsInput: { maxHp: 50, might: 10, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })

  const TAG_STAGE: Stage = {
    id: 'tag_spawn_stage', name: 'Tag Spawn Stage', description: '',
    floor: 3,
    enemyPool: [{ enemyId: TAG_MOB.id, weight: 1, eliteChance: 0.1 }],
    totalEnemyCount: 3, waves: [3],
    spawnIntervalSeconds: 0,
  }
  // Floor-10 boss stage: the boss species carries the pool eliteChance
  // (builder rule: bossEnemyId on floor 10 IS the elite species).
  const TAG_BOSS_STAGE: Stage = {
    id: 'tag_spawn_boss_stage', name: 'Tag Spawn Boss Stage', description: '',
    floor: 10, bossEnemyId: TAG_BOSS.id,
    enemyPool: [{ enemyId: TAG_BOSS.id, weight: 1, eliteChance: 0.1 }],
    totalEnemyCount: 5, waves: [5],
    spawnIntervalSeconds: 0,
  }

  function stageWaveHarness() {
    const enemyTemplates = new TemplateRegistry<Enemy>()
    enemyTemplates.register(TAG_MOB.id, TAG_MOB)
    enemyTemplates.register(TAG_BOSS.id, TAG_BOSS)

    const stageWaves = new StageWaveSystem({
      eventBus: new EventBus(),
      enemySystem: new EnemySystem(new EnemyManager()),
      stageManager: new StageManager(),
      stageSystem: new StageSystem(),
      stageTemplates: new TemplateRegistry<Stage>(),
      enemyTemplates,
      isStageUnlocked: () => true,
      launchBattle: () => {},
      hiddenBeast: new HiddenBeastSystem({ getEnemyTemplate: () => undefined }),
    })

    return { stageWaves }
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('active + elite roll hit -> spawned enemy has tinh_anh stats/flag/name', () => {
    const { stageWaves } = stageWaveHarness()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const picked = stageWaves.pickEnemyForTurnSpawn(TAG_STAGE, false)

    expect(picked?.name).toBe('Tinh Anh Spawn Mob')
    expect(picked?.isElite).toBe(true)
    expect(picked?.stats.maxHp).toBeCloseTo(TAG_MOB.stats.maxHp * 2.5)
  })

  it('idle (allowTags:false) never applies tags even when the roll would hit', () => {
    const { stageWaves } = stageWaveHarness()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const picked = stageWaves.pickEnemyForTurnSpawn(TAG_STAGE, false, { allowTags: false })

    expect(picked?.name).toBe('Spawn Mob')
    expect(picked?.isElite).toBeFalsy()
    expect(picked?.stats.maxHp).toBe(TAG_MOB.stats.maxHp)
  })

  it('floor-10 final spawn is boss base in BOTH active and idle (tag roll missed)', () => {
    const { stageWaves } = stageWaveHarness()
    vi.spyOn(Math, 'random').mockReturnValue(0.99)

    const active = stageWaves.pickEnemyForTurnSpawn(TAG_BOSS_STAGE, true)
    const idle = stageWaves.pickEnemyForTurnSpawn(TAG_BOSS_STAGE, true, { allowTags: false })

    for (const picked of [active, idle]) {
      expect(picked?.isBoss).toBe(true)
      expect(picked?.isElite).toBeFalsy()
      expect(picked?.name.endsWith('Spawn Boss')).toBe(true)
      expect(picked?.name.startsWith('Tinh Anh')).toBe(false)
      expect(picked?.stats.maxHp).toBeCloseTo(TAG_BOSS.stats.maxHp * 7)
    }
  })

  it('active floor-10 stacks boss + tinh_anh when the roll hits (isBoss && isElite)', () => {
    const { stageWaves } = stageWaveHarness()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const picked = stageWaves.pickEnemyForTurnSpawn(TAG_BOSS_STAGE, true)

    expect(picked?.isBoss).toBe(true)
    expect(picked?.isElite).toBe(true)
    expect(picked?.name).toBe('Tinh Anh Đại Vương Spawn Boss')
    expect(picked?.stats.maxHp).toBeCloseTo(TAG_BOSS.stats.maxHp * 7 * 2.5)
  })

  it('idle floor-10 (allowTags:false) stays boss base even when the roll would hit', () => {
    const { stageWaves } = stageWaveHarness()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const picked = stageWaves.pickEnemyForTurnSpawn(TAG_BOSS_STAGE, true, { allowTags: false })

    expect(picked?.isBoss).toBe(true)
    expect(picked?.isElite).toBeFalsy()
    expect(picked?.name.startsWith('Tinh Anh')).toBe(false)
    expect(picked?.stats.maxHp).toBeCloseTo(TAG_BOSS.stats.maxHp * 7)
  })
})
