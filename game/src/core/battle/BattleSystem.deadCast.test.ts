import { describe, expect, it } from 'vitest'
import { BattleSystem } from './BattleSystem'
import { CombatSystem } from '../combat/CombatSystem'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { SkillEffectSystem } from '../skill/SkillEffectSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { AilmentRegistry } from '../ailment/AilmentRegistry'
import { AilmentSystem } from '../ailment/AilmentSystem'
import { EventBus } from '../events/EventBus'
import { ActionImpactSystem } from '../battle/ActionImpactSystem'

import { createBaseStats } from '../stats/StatBlock'
import { HERO_LANE_INDEX } from './BattleLane'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'
import type { BattleEndEvent } from './BattleEvents'
import { ailments } from '../../data/ailment/ailments'

// Audit P0-2 (dead-cast guard) — regression test "DoT lethal đúng tick
// cast hoàn tất": updateCasting() chạy SAU updateAilments() trong cùng
// tick, nên nếu DoT giết Player thì cast đang niệm phải HỦY (không
// resolve skill effect) và cast bar phải được gỡ qua 'cast_complete'.
function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = {
    ...createBaseStats(),
    attack: 0,
    evasionRate: 0,
    dexterity: 0,
    attackSpeed: 0,
    attackRange: 16,
    movementSpeed: 0,
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
    currentRage: 0,
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
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  }
}

function createCastTimeSkill(): Skill {
  return {
    id: 'test_cast_skill',
    name: 'Niệm Chú Thử Nghiệm',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 5,
    remainingCooldown: 0,
    cost: 0,
    target: 'enemy',
    effects: [{ type: 'damage', value: 100, damageType: 'physical' }],
    execution: { kind: 'cast_time', castTime: 2 },
    resourceType: 'none',
    unlocked: true,
    equipped: true,
    loadoutSlot: 0,
    loadoutSlots: [0],
  }
}

function setup(skill: Skill) {
  const eventBus = new EventBus()
  const skillManager = new SkillManager()
  const skillSystem = new SkillSystem(skillManager)
  const ailmentRegistry = new AilmentRegistry()

  for (const template of ailments) {
    ailmentRegistry.register(template)
  }

  skillManager.add(skill)

  const system = new BattleSystem(
    new CombatSystem(eventBus),
    skillManager,
    skillSystem,
    new SkillEffectSystem(),
    new BuffRegistry(),
    ailmentRegistry,
    eventBus,
    new ActionImpactSystem({ eventBus, rollCritical: () => false }),
  )

  const castCompleteEvents: { sourceId?: string; skillId?: string }[] = []
  const battleEndEvents: BattleEndEvent[] = []

  eventBus.on('cast_complete', (event: { sourceId?: string; skillId?: string }) =>
    castCompleteEvents.push(event),
  )
  eventBus.on<BattleEndEvent>('battle_end', (event) => battleEndEvents.push(event))

  function tick(deltaSeconds: number) {
    skillSystem.update(deltaSeconds, 0)
    system.update(deltaSeconds)
  }

  return { system, tick, castCompleteEvents, battleEndEvents }
}

describe('BattleSystem — Player chết bởi DoT giữa lúc niệm (audit P0-2)', () => {
  it('DoT giết Player đúng tick cast còn lại → cast bị HỦY, không resolve skill effect', () => {
    const skill = createCastTimeSkill()
    const { system, tick, castCompleteEvents, battleEndEvents } = setup(skill)

    // Player sắp chết: 1 HP. Enemy attack khổng lồ để DoT snapshot
    // ('bong' — fire, power = ATK + firePower) chắc chắn lethal trong
    // một tick.
    const player = createCombatant({ id: 'player', type: 'player', currentHp: 1 })
    const enemy = createCombatant({ id: 'enemy', currentHp: 1000000, maxHp: 1000000 })

    enemy.stats.attack = 1_000_000

    system.start(player, enemy)
    system.update(3) // Bỏ qua countdown.
    enemy.x = 2
    enemy.row = HERO_LANE_INDEX

    // Tick đầu bắt đầu niệm.
    tick(0.1)
    expect(player.castingSkillId).toBe('test_cast_skill')
    expect(player.alive).toBe(true)

    // Gắn DoT lên Player (nguồn = enemy) rồi tick — DoT tick CHẠY
    // TRƯỚC updateCasting() nên Player chết trong cùng tick này.
    const battle = system.getBattle()!

    new AilmentSystem(battle.playerAilments).apply(
      ailments.find((template) => template.id === 'bong')!,
      enemy,
      player,
    )

    tick(0.1)

    expect(player.alive).toBe(false)
    expect(battle.state).toBe('defeat')

    // Cast đã bị clear — KHÔNG hoàn tất sau cái chết.
    expect(player.castingSkillId).toBeUndefined()
    expect(player.castTimeRemaining).toBeUndefined()
    expect(player.castTimeTotal).toBeUndefined()
    expect(player.castTargetId).toBeUndefined()

    // Tín hiệu gỡ cast bar vẫn phát để bar không kẹt trên unit đã chết.
    expect(castCompleteEvents).toContainEqual(
      expect.objectContaining({ sourceId: 'player' }),
    )

    // TUYỆT ĐỐI không resolveSkillEffects cho xác chết — enemy nguyên vẹn.
    expect(enemy.currentHp).toBe(1000000)

    expect(battleEndEvents).toContainEqual(expect.objectContaining({ state: 'defeat' }))
  })

  it('Player đã chết mà chưa kịp hủy ở tick trước → tick kế tiếp cũng hủy cast', () => {
    const skill = createCastTimeSkill()
    const { system, tick, castCompleteEvents } = setup(skill)

    const player = createCombatant({ id: 'player', type: 'player', currentHp: 1 })
    const enemy = createCombatant({ id: 'enemy', currentHp: 1000, maxHp: 1000 })

    system.start(player, enemy)
    system.update(3)

    tick(0.1)
    expect(player.castingSkillId).toBe('test_cast_skill')

    // Giết Player trực tiếp ngoài pipeline (giả lập mọi nguồn sát thương).
    player.alive = false

    tick(0.1)

    expect(player.castingSkillId).toBeUndefined()
    expect(castCompleteEvents).toContainEqual(expect.objectContaining({ sourceId: 'player' }))
  })
})
