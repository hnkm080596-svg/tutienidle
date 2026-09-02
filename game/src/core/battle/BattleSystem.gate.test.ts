import { describe, expect, it } from 'vitest'
import { BattleSystem } from './BattleSystem'
import { CombatSystem } from '../combat/CombatSystem'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { SkillEffectSystem } from '../skill/SkillEffectSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { EventBus } from '../events/EventBus'
import { ActionImpactSystem } from './ActionImpactSystem'
import { createBaseStats, type Stats } from '../stats/StatBlock'
import { HERO_COLUMN, HERO_LANE_INDEX } from './BattleLane'
import { canEnemyReachGate, canPlayerReachTarget } from './ActionTargetingSystem'
import type { CombatEntity } from '../combat/CombatEntity'

// Gate semantics (plan §2.2/§6.1/§16.2): hai vai trò của Player dùng
// hai semantics khoảng cách RIÊNG — avatar teleport KHÔNG được làm đổi
// enemy-to-gate range.
function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats: Stats = {
    ...createBaseStats(),
    attackRange: 3,
    movementSpeed: 0,
    attack: 0,
    evasionRate: 0,
    dexterity: 0,
  }

  return {
    id: 'id',
    name: 'name',
    type: 'enemy',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    timeSinceLastHitTaken: Infinity,
    currentWard: 0,
    realmIndex: 0,
    x: 8,
    row: 2,
    alive: true,
    ...overrides,
  }
}

describe('BattleSystem — cổng phòng thủ và avatar (hai semantics độc lập)', () => {
  it('Player bắt đầu trận tại ô (4,1) — column cổng, hàng khởi đầu avatar', () => {
    const eventBus = new EventBus()
    const skillManager = new SkillManager()

    const system = new BattleSystem(
      new CombatSystem(eventBus),
      skillManager,
      new SkillSystem(skillManager),
      new SkillEffectSystem(),
      new BuffRegistry(),
      eventBus,
      new ActionImpactSystem({ eventBus, rollCritical: () => false }),
    )

    const player = createCombatant({ id: 'player', type: 'player', x: 99 })
    const enemy = createCombatant({ id: 'enemy' })

    system.start(player, enemy)

    expect(player.x).toBe(HERO_COLUMN)
    expect(HERO_COLUMN).toBe(1)
    expect(player.row).toBe(HERO_LANE_INDEX)
    expect(HERO_LANE_INDEX).toBe(4)
  })

  it('canEnemyReachGate KHÔNG xét row: cùng một cột, row 0 hay row 9 đều bằng nhau', () => {
    const topRow = createCombatant({ id: 'top', x: 4 })
    topRow.row = 0 as never

    const bottomRow = createCombatant({ id: 'bottom', x: 4 })
    bottomRow.row = 9 as never

    // Đủ khoảng cách cột (|4-1| = 3 ≤ range 3) bất kể row.
    expect(canEnemyReachGate(topRow, HERO_COLUMN)).toBe(true)
    expect(canEnemyReachGate(bottomRow, HERO_COLUMN)).toBe(true)

    // Thiếu khoảng cách cột thì row nào cũng không tới.
    const far = createCombatant({ id: 'far', x: 5 })

    expect(canEnemyReachGate(far, HERO_COLUMN)).toBe(false)
  })

  it('avatar Player đổi row (teleport) không ảnh hưởng enemy-to-gate; chỉ Chebyshev player-side đổi', () => {
    const enemy = createCombatant({ id: 'enemy', x: 4 })
    enemy.row = 9 as never

    const playerTop = createCombatant({ id: 'player_top', type: 'player', x: 1 })
    playerTop.row = 0 as never

    const playerBottom = createCombatant({ id: 'player_bottom', type: 'player', x: 1 })
    playerBottom.row = 9 as never

    // Enemy-to-gate: chỉ cột — không phụ thuộc avatar đang đứng hàng nào.
    expect(canEnemyReachGate(enemy, HERO_COLUMN)).toBe(true)

    // Player-to-enemy (Chebyshev): cùng hàng → trong tầm range 3;
    // khác hàng 9 → ngoài tầm dù column giống hệt.
    expect(canPlayerReachTarget(playerBottom, enemy)).toBe(true)
    expect(canPlayerReachTarget(playerTop, enemy)).toBe(false)
  })
})
