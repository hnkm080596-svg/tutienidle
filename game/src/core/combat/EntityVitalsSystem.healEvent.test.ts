// 6A-T1 (2026-09-01) — event 'heal' mới: emit từ applyHealing với reason
// 'healing' | 'leech' (KHÔNG 'regen' — spam mỗi tick), amount > 0.
// Floating "+N" xanh trong CombatScene consume event này (Task 2).
import { describe, expect, it, vi, afterEach } from 'vitest'
import { EntityVitalsSystem } from './EntityVitalsSystem'
import type { EventBus } from '../events/EventBus'
import type { CombatEntity } from './CombatEntity'
import { createBaseStats } from '../stats/StatBlock'

function makeTarget(): CombatEntity {
  const stats = createBaseStats()

  return {
    id: 't1',
    name: 't',
    type: 'enemy',
    baseStats: stats,
    stats,
    currentHp: 50,
    maxHp: stats.maxHp,
    currentMp: 0,
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
  }
}

function makeBus(): { bus: EventBus; events: Array<Record<string, unknown>> } {
  const events: Array<Record<string, unknown>> = []

  const bus = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn((type: string, payload: Record<string, unknown>) => {
      events.push({ type, ...payload })
    }),
  }

  return { bus: bus as unknown as EventBus, events }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('EntityVitalsSystem — heal event (6A-T1)', () => {
  it('applyHealing reason healing → emit event heal với value = amount', () => {
    const { bus, events } = makeBus()
    const system = new EntityVitalsSystem(bus)
    const target = makeTarget()

    system.applyHealing(target, 50, 'healing', 'src1')

    const healEvents = events.filter((e) => e.type === 'heal')

    expect(healEvents).toHaveLength(1)
    expect(healEvents[0]).toMatchObject({ targetId: 't1', sourceId: 'src1', value: 50 })
  })

  it('applyHealing reason leech → cũng emit heal (leech là heal)', () => {
    const { bus, events } = makeBus()
    const system = new EntityVitalsSystem(bus)

    system.applyHealing(makeTarget(), 20, 'leech', 'src1')

    expect(events.filter((e) => e.type === 'heal')).toHaveLength(1)
  })

  it('applyHealing reason regen → KHÔNG emit heal (chống spam mỗi tick)', () => {
    const { bus, events } = makeBus()
    const system = new EntityVitalsSystem(bus)

    system.applyHealing(makeTarget(), 10, 'regen')

    expect(events.filter((e) => e.type === 'heal')).toHaveLength(0)
    // vitals_changed vẫn emit như cũ — chỉ heal event bị lọc
    expect(events.filter((e) => e.type === 'entity_vitals_changed')).toHaveLength(1)
  })

  it('amount <= 0 → KHÔNG emit heal (tránh noise)', () => {
    const { bus, events } = makeBus()
    const system = new EntityVitalsSystem(bus)

    system.applyHealing(makeTarget(), 0, 'healing')

    expect(events.filter((e) => e.type === 'heal')).toHaveLength(0)
  })

  it('reason khác (damage/thorns/...) không emit heal từ applyHealing path', () => {
    const { bus, events } = makeBus()
    const system = new EntityVitalsSystem(bus)

    // reaction-heal tương lai nếu đổi reason vẫn an toàn: chỉ healing/leech mở
    system.applyHealing(makeTarget(), 10, 'reaction')

    expect(events.filter((e) => e.type === 'heal')).toHaveLength(0)
  })
})
