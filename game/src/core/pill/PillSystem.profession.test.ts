// Pill nghề (2026-08-24, plan §5): gate wrong_realm KHÔNG consume; main
// stat roll bỏ stat đã cap + deterministic RNG; regen = timed effect
// deadline tuyệt đối có hiệu lực trong combat và hết đúng hạn; Tu Vi đi
// qua addCultivation (giữ cap); Cảm Ngộ tăng cả current + lifetime.
// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { GameManager } from '../game/GameManager'
import { createDefaultPlayer } from '../player/Player'
import { getMainStatCap } from '../stats/StatCap'
import { getRequiredCultivation } from '../realm/realmSystem'
import { createBaseStats } from '../stats/StatBlock'
import type { Enemy } from '../enemy/Enemy'

function makeEnemyData(): Enemy {
  const stats = {
    ...createBaseStats(),
    attack: 0,
    attackRange: 0,
    movementSpeed: 0,
  }

  return {
    id: 'enemy_x',
    level: 1,
    realmId: 'mortal',
    rewards: { techniqueInsight: 0, spiritStone: 0 },
    lane: 'ground',
    name: 'Quái',
    type: 'enemy',
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    alive: true,
  } as unknown as Enemy
}

function setup() {
  const gameManager = new GameManager()
  const player = createDefaultPlayer()

  gameManager.setActivePlayer(player)

  return { gameManager, player }
}

const REGEN_PILL = 'hoi_xuan_dan_mortal'
const PERMANENT_PILL = 'to_cot_dan_mortal'
const CULTIVATION_PILL = 'tu_linh_dan_mortal'

function registerPill(gameManager: GameManager, pillId: string, amount = 1) {
  // Pill đã register qua bootstrap data ở App.vue; ở test, lấy từ registry
  // data bằng import gián tiếp để tránh phụ thuộc App.vue.
  return import('../../data/pill/pills').then(({ pills }) => {
    gameManager.registerPills(pills.filter((pill) => pill.id === pillId))
    gameManager.pillBag.add(gameManager.pillRegistry.get(pillId), amount)
  })
}

function pillTarget() {
  return {
    addCultivation: () => {},
    heal: () => {},
    applyBuff: () => {},
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('Pill nghề — gate + atomic consumption', () => {
  it('wrong_realm: KHÔNG consume, KHÔNG apply', async () => {
    const { gameManager, player } = setup()

    await registerPill(gameManager, REGEN_PILL)

    const playerWrongRealm = { ...player, realmId: 'golden_core' }

    const result = gameManager.usePillDetailed(REGEN_PILL, pillTarget(), playerWrongRealm as never)

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('wrong_realm')
    expect(gameManager.pillBag.has(REGEN_PILL, 1)).toBe(true)
  })

  it('đan vĩnh viễn tăng đúng thuộc tính cố định của loại đan', async () => {
    const { gameManager, player } = setup()

    await registerPill(gameManager, PERMANENT_PILL, 2)
    const result = gameManager.usePillDetailed(PERMANENT_PILL, pillTarget(), player)

    expect(result.ok).toBe(true)
    expect(player.modifiers.find((modifier) => modifier.id === 'pill-permanent:strength')?.flat).toBe(1)
    expect(gameManager.pillBag.getAmount(PERMANENT_PILL)).toBe(1)
  })

  it('thuộc tính đích đã chạm trần → không consume', async () => {
    const { gameManager, player } = setup()

    await registerPill(gameManager, PERMANENT_PILL)

    const cap = getMainStatCap('mortal')
    player.baseStats.strength = cap
    const result = gameManager.usePillDetailed(PERMANENT_PILL, pillTarget(), player)

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('cap')
    expect(gameManager.pillBag.has(PERMANENT_PILL, 1)).toBe(true)
  })

  it('cultivation: % yêu cầu tầng, qua addCultivation giữ cap tầng', async () => {
    const { gameManager, player } = setup()

    await registerPill(gameManager, CULTIVATION_PILL)

    // Đặt cultivation sát trần: pill cộng 3% required nhưng KHÔNG vượt
    // required (addCultivation chặn ở required — hành vi giữ cap).
    const required = getRequiredCultivation(player.realmId, player.realmLevel)

    player.cultivation = required - 1

    expect(gameManager.usePillDetailed(CULTIVATION_PILL, pillTarget(), player).ok).toBe(true)

    expect(player.cultivation).toBe(required)
  })
})

// Gameplay fixes (2026-09-05): hpRegenPerTurn pill modifier REMOVED per user request —
// uong thuoc nhan HP regen vo nghia trong turn engine. 2 test pin cu (regen stat tang
// trong combat + stack policy HP/s) da retire cung tinh nang. MP regen pill giu nguyen.
describe('Regen timed effect — hpRegen pill REMOVED (user request 2026-09-05)', () => {
  it('uong Hoi Xuan Dan KHONG con cap modifier hpRegenPerTurn', async () => {
    const { gameManager, player } = setup()
    await registerPill(gameManager, REGEN_PILL)
    gameManager.usePillDetailed(REGEN_PILL, pillTarget(), player)
    const effects = player.persistentTimedEffects
    const hpModifiers = effects.flatMap((e) => e.modifiers).filter((m) => m.stat === 'hpRegenPerTurn')
    expect(hpModifiers).toHaveLength(0)
    expect(effects.length).toBeGreaterThan(0)
  })
})