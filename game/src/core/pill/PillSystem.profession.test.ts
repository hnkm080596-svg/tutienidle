// Pill nghề (2026-08-24, plan §5): gate wrong_realm KHÔNG consume; main
// stat roll bỏ stat đã cap + deterministic RNG; regen = timed effect
// deadline tuyệt đối có hiệu lực trong combat và hết đúng hạn; Tu Vi đi
// qua addCultivation (giữ cap); Cảm Ngộ tăng cả current + lifetime.
// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { GameManager } from '../game/GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats, type StatModifier } from '../stats/StatCalculator'
import { getMainStatCap } from '../stats/StatCap'
import { getRequiredCultivation } from '../realm/realmSystem'
import { createBaseStats } from '../stats/StatBlock'
import type { Enemy } from '../enemy/Enemy'
import type { CombatEntity } from '../combat/CombatEntity'

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

function makeEnemy(): CombatEntity {
  const stats = {
    ...calculateStats({ ...emptyStats() }, []),
    attack: 0,
    attackRange: 0,
    movementSpeed: 0,
  }

  return {
    id: 'enemy',
    name: 'Quái',
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
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 8,
    row: 4,
    alive: true,
  }
}

function emptyStats() {
  return {
    maxHp: 100,
    maxMp: 50,
    attack: 0,
    defense: 0,
    attackSpeed: 1,
    movementSpeed: 0,
    attackRange: 0,
    criticalRate: 0,
    criticalDamage: 1.5,
    evasionRate: 0,
    strength: 0,
    dexterity: 0,
    intelligence: 0,
    attunement: 0,
    vitality: 0,
    hpRegenPerSecond: 0,
    manaRegenPerSecond: 0,
  } as unknown as ReturnType<typeof calculateStats>
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

describe('Regen timed effect — thời gian thực, hết hạn trong combat', () => {
  it('uống regen → timed effect deadline tuyệt đối; trong combat hpRegenPerSecond tăng; hết hạn giữa trận về baseline + effect bị xoá', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

    const { gameManager, player } = setup()

    await registerPill(gameManager, REGEN_PILL)

    // Truyền baseStats THÔ (không calculated) — recompute trong battle
    // derive lại từ vitality; tránh double-derive làm nhiễu assertion.
    gameManager.startBattleWithPlayer(player, player.baseStats, makeEnemyData())

    gameManager.update(3) // bỏ countdown (telegraph materialize luôn)

    // Một tick fighting để recompute baseline (derive hpRegen từ
    // vitality = 0.1) TRƯỚC khi uống.
    gameManager.update(0.1)

    const battle = gameManager.getBattle()!
    const baselineRegen = battle.player.stats.hpRegenPerSecond

    expect(gameManager.usePillDetailed(REGEN_PILL, pillTarget(), player).ok).toBe(true)

    expect(player.persistentTimedEffects).toHaveLength(1)

    const expiresAtMs = player.persistentTimedEffects[0]!.expiresAtMs

    // Tick combat — provider đọc timed effect → regen stat tăng.
    gameManager.update(0.1)

    expect(battle.player.stats.hpRegenPerSecond).toBeGreaterThan(baselineRegen)

    // Thời gian trôi qua hết deadline (thời gian THỰC, không phải game
    // delta) — tick kế effect rơi khỏi recompute + bị xoá khỏi player.
    vi.setSystemTime(new Date(expiresAtMs + 1000))

    gameManager.update(0.1)

    expect(battle.player.stats.hpRegenPerSecond).toBe(baselineRegen)
    expect(player.persistentTimedEffects).toHaveLength(0)
  })

  it('stack policy: uống lại cùng effectGroup refresh deadline, KHÔNG cộng dồn HP/s', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

    const { gameManager, player } = setup()

    await registerPill(gameManager, REGEN_PILL, 2)

    gameManager.usePillDetailed(REGEN_PILL, pillTarget(), player)

    const first = player.persistentTimedEffects[0]!
    const firstExpiresAt = first.expiresAtMs
    const firstModifiers = first.modifiers.map((modifier) => modifier.flat)

    // 30s sau uống lần nữa — deadline refresh, HP/s KHÔNG cộng đôi.
    vi.setSystemTime(new Date(Date.now() + 30_000))

    gameManager.usePillDetailed(REGEN_PILL, pillTarget(), player)

    expect(player.persistentTimedEffects).toHaveLength(1)

    const refreshed = player.persistentTimedEffects[0]!

    expect(refreshed.expiresAtMs).toBeGreaterThan(firstExpiresAt)
    expect(refreshed.modifiers.map((modifier) => modifier.flat)).toEqual(firstModifiers)
  })
})

export type { StatModifier }
