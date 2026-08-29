import { describe, expect, it } from 'vitest'
import { CombatSystem } from './CombatSystem'
import { EventBus } from '../events/EventBus'
import { SurviveLethalGuard } from '../talent/SurviveLethalGuard'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from './CombatEntity'
import type { EntityVitalsChangedEvent } from './EntityVitalsSystem'

// Thiên phú Bất Tử Thể (talent-direction-choice-plan §6) — hook tại
// CombatSystem.killIfDead(), điểm DUY NHẤT tuyên bố chết của mọi đường
// damage. Entity pattern mirror CombatSystem.manaShield.test.ts.
function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0 }

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
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  }
}

function createSession(talentIds: string[]) {
  const guard = new SurviveLethalGuard()

  guard.beginBattle(talentIds)

  return { guard, playerEntityId: 'player' }
}

describe('CombatSystem — Bất Tử Thể (survive_lethal)', () => {
  it('đòn lẽ ra chết còn lượt — sống sót HP = 1, giữ alive, emit event', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)

    combat.setSurviveLethalSession(createSession(['bat_tu_the']))

    const player = createCombatant({ id: 'player', type: 'player', currentHp: 10, maxHp: 1000 })

    const events: unknown[] = []
    eventBus.on('talent_survive_lethal', (event) => events.push(event))

    combat.applyDirectDamage(player, 9999, 'enemy_1')

    expect(player.currentHp).toBe(1)
    expect(player.alive).toBe(true)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ entityId: 'player', sourceId: 'enemy_1' })
  })

  it('đòn chí mạng thứ hai cùng trận — hết lượt, chết thật', () => {
    const combat = new CombatSystem(new EventBus())

    combat.setSurviveLethalSession(createSession(['bat_tu_the']))

    const player = createCombatant({ id: 'player', type: 'player', currentHp: 10, maxHp: 1000 })

    combat.applyDirectDamage(player, 9999, 'enemy_1')
    expect(player.alive).toBe(true)

    combat.applyDirectDamage(player, 9999, 'enemy_1')

    expect(player.currentHp).toBe(0)
    expect(player.alive).toBe(false)
  })

  it('không có session — hành vi mặc định, chết ngay', () => {
    const combat = new CombatSystem(new EventBus())

    const player = createCombatant({ id: 'player', type: 'player', currentHp: 10, maxHp: 1000 })

    combat.applyDirectDamage(player, 9999, 'enemy_1')

    expect(player.currentHp).toBe(0)
    expect(player.alive).toBe(false)
  })

  it('entity KHÔNG phải player của session — không được bảo vệ', () => {
    const combat = new CombatSystem(new EventBus())

    combat.setSurviveLethalSession(createSession(['bat_tu_the']))

    const enemy = createCombatant({ id: 'enemy_x', currentHp: 10, maxHp: 1000 })

    combat.applyDirectDamage(enemy, 9999, 'player')

    expect(enemy.currentHp).toBe(0)
    expect(enemy.alive).toBe(false)
  })

  it('trận Độ Kiếp — KHÔNG kích hoạt dù player có Bất Tử Thể (khoá theo plan §6)', () => {
    const combat = new CombatSystem(new EventBus())

    // Mirror GameManager.startTribulation(): guard về 0 + session null.
    const session = createSession(['bat_tu_the'])

    session.guard.beginTribulation()
    combat.setSurviveLethalSession(null)

    const player = createCombatant({ id: 'player', type: 'player', currentHp: 10, maxHp: 1000 })

    combat.applyDirectDamage(player, 9999, 'heavenly_tribulation')

    expect(player.currentHp).toBe(0)
    expect(player.alive).toBe(false)
    expect(session.guard.getRemainingUses()).toBe(0)
  })

  it('đòn không chết — không tiêu lượt', () => {
    const combat = new CombatSystem(new EventBus())

    const session = createSession(['bat_tu_the'])

    combat.setSurviveLethalSession(session)

    const player = createCombatant({ id: 'player', type: 'player', currentHp: 500, maxHp: 1000 })

    combat.applyDirectDamage(player, 100, 'enemy_1')

    expect(player.currentHp).toBe(400)
    expect(player.alive).toBe(true)
    expect(session.guard.getRemainingUses()).toBe(1)
  })

  it('guard cứu sống — event vitals CUỐI cùng phải là killed=false (hiệu chỉnh sau guard)', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)

    combat.setSurviveLethalSession(createSession(['bat_tu_the']))

    const player = createCombatant({ id: 'player', type: 'player', currentHp: 10, maxHp: 1000 })

    const vitalsEvents: EntityVitalsChangedEvent[] = []
    eventBus.on<EntityVitalsChangedEvent>('entity_vitals_changed', (event) => vitalsEvents.push(event))

    combat.applyDirectDamage(player, 9999, 'enemy_1')

    // Event damage ban đầu mang killed=true (HP chạm 0), event hiệu chỉnh
    // 'survive_lethal' phát SAU guard phải là trạng thái cuối: còn sống.
    expect(vitalsEvents.length).toBeGreaterThanOrEqual(2)
    expect(vitalsEvents[0]?.killed).toBe(true)

    const last = vitalsEvents[vitalsEvents.length - 1]
    expect(last).toMatchObject({ entityId: 'player', reason: 'survive_lethal', killed: false, hpAfter: 1 })
  })
})
