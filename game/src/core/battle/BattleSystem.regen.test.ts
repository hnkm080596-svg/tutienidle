import { describe, expect, it } from 'vitest'
import { BattleSystem } from './BattleSystem'
import { CombatSystem } from '../combat/CombatSystem'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { SkillEffectSystem } from '../skill/SkillEffectSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { EventBus } from '../events/EventBus'
import { ActionImpactSystem } from './ActionImpactSystem'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { EntityVitalsChangedEvent } from '../combat/EntityVitalsSystem'

function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = {
    ...createBaseStats(),
    attack: 0,
    defense: 0,
    evasionRate: 0,
    dexterity: 0,
    criticalRate: 0,
    attackRange: 0,
    speed: 0,
    vitality: 0,
    // Tắt regen phái sinh để phép đo chỉ đến từ field set tường minh.
    intelligence: 0,
    hpRegenPerSecond: 0,
    manaRegenPerSecond: 0,
    wardRegenPerSecond: 0,
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
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  }
}

function setup() {
  const eventBus = new EventBus()
  const skillManager = new SkillManager()
  const skillSystem = new SkillSystem(skillManager)
  const system = new BattleSystem(
    new CombatSystem(eventBus),
    skillManager,
    skillSystem,
    new SkillEffectSystem(),
    new BuffRegistry(),
    eventBus,
    new ActionImpactSystem({ eventBus, rollCritical: () => false }),
  )

  return { system, eventBus }
}

// Mana/Ward regen phải đi qua 'entity_vitals_changed' như HP regen —
// trước đây mutate thẳng currentMp/currentWard không event, HUD không
// thấy thay đổi.
describe('BattleSystem — regen Mana/Ward phát vitals event', () => {
  it('manaRegenPerSecond > 0 — emit entity_vitals_changed reason regen với mpAfter tăng', () => {
    const { system, eventBus } = setup()

    const player = createCombatant({ id: 'player', type: 'player' })
    player.stats.manaRegenPerSecond = 10
    player.stats.maxMp = 100
    player.currentMp = 0

    const enemy = createCombatant({ id: 'enemy', x: 8 })

    system.start(player, enemy)
    // Đốt countdown để battle vào 'fighting' (regen chỉ chạy lúc fighting).
    system.update(3)

    const events: EntityVitalsChangedEvent[] = []
    eventBus.on<EntityVitalsChangedEvent>('entity_vitals_changed', (event) => events.push(event))

    system.update(1)

    const regenEvents = events.filter((event) => event.entityId === 'player' && event.reason === 'regen')
    expect(regenEvents.length).toBeGreaterThan(0)
    expect(regenEvents[0]!.mpAfter).toBeGreaterThan(0)
    expect(player.currentMp).toBeGreaterThan(0)
  })

  it('wardRegenPerSecond > 0 sau delay không bị đánh — emit vitals event với wardAfter tăng', () => {
    const { system, eventBus } = setup()

    const player = createCombatant({ id: 'player', type: 'player' })
    player.stats.wardRegenPerSecond = 5
    player.stats.wardMax = 100
    player.currentWard = 0
    // Infinity >= WARD_REGEN_DELAY_SECONDS — đủ điều kiện hồi ward ngay.
    player.timeSinceLastHitTaken = Infinity

    const enemy = createCombatant({ id: 'enemy', x: 8 })

    system.start(player, enemy)
    system.update(3)

    const events: EntityVitalsChangedEvent[] = []
    eventBus.on<EntityVitalsChangedEvent>('entity_vitals_changed', (event) => events.push(event))

    system.update(1)

    const regenEvents = events.filter((event) => event.entityId === 'player' && event.reason === 'regen')
    expect(regenEvents.length).toBeGreaterThan(0)
    expect(regenEvents[0]!.wardAfter).toBeGreaterThan(0)
    expect(player.currentWard).toBeGreaterThan(0)
  })

  it('không có regen stat — KHÔNG emit vitals event noise mỗi tick', () => {
    const { system, eventBus } = setup()

    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy', x: 8 })

    system.start(player, enemy)
    system.update(3)

    const events: EntityVitalsChangedEvent[] = []
    eventBus.on<EntityVitalsChangedEvent>('entity_vitals_changed', (event) => events.push(event))

    system.update(1)

    expect(events.filter((event) => event.reason === 'regen')).toHaveLength(0)
  })
})
