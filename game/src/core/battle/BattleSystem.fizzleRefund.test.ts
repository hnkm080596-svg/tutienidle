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
import { HERO_LANE_INDEX } from './BattleLane'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'

// Combat Balance Pass (2026-08-29) — Task 5 (plan §3.5): fizzle (cast bị
// hủy vì target chết/ra khỏi tầm — không do người chơi) hoàn 100% tài
// nguyên, chỉ commit 50% cooldown thay vì đủ. Idle game không thể phản
// ứng — penalty nên nhẹ hơn.
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

function createCostlyCastSkill(): Skill {
  return {
    id: 'test_costly_cast',
    name: 'Niệm Tốn Kiếm Ý',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 5,
    remainingCooldown: 0,
    cost: 100,
    target: 'enemy',
    effects: [{ type: 'damage', value: 100, damageType: 'physical' }],
    execution: { kind: 'cast_time', castTime: 2 },
    resourceType: 'sword_intent',
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

  skillManager.add(skill)

  const system = new BattleSystem(
    new CombatSystem(eventBus),
    skillManager,
    skillSystem,
    new SkillEffectSystem(),
    new BuffRegistry(),
    eventBus,
    new ActionImpactSystem({ eventBus, rollCritical: () => false }),
  )

  function tick(deltaSeconds: number) {
    skillSystem.update(deltaSeconds, 0)
    system.update(deltaSeconds)
  }

  return { system, tick, skillSystem }
}

describe('BattleSystem — fizzle refund (Task 5, plan §3.5)', () => {
  it('fizzle vì target ra khỏi tầm — hoàn 100% tài nguyên, commit 50% cooldown', () => {
    const skill = createCostlyCastSkill()
    const { system, tick, skillSystem } = setup(skill)

    const player = createCombatant({ id: 'player', type: 'player', currentSwordIntent: 100 })
    const enemy = createCombatant({ id: 'enemy', currentHp: 1000000, maxHp: 1000000 })

    system.start(player, enemy)
    system.update(3)
    enemy.x = 2
    enemy.row = HERO_LANE_INDEX

    // Tick đầu bắt đầu niệm — trừ 100 Kiếm Ý ngay lúc begin.
    tick(0.1)
    expect(player.castingSkillId).toBe('test_costly_cast')
    expect(player.currentSwordIntent).toBe(0)

    // Kéo enemy ra khỏi tầm (attackRange 16) — HERO_COLUMN + xa.
    enemy.x = 999

    // Tick tới khi niệm xong (2s) → fizzle vì target ngoài tầm.
    for (let i = 0; i < 25; i++) tick(0.1)

    expect(player.castingSkillId).toBeUndefined()

    // Hoàn 100% Kiếm Ý.
    expect(player.currentSwordIntent).toBe(100)

    // Cooldown slot FIZZLE = 50% × 5 = 2.5, trừ tick đã qua sau commit.
    // So sánh: fizzle < hoàn tất (2.5 < 5 trước tick).
    const skillAfter = skillSystem['manager'].get('test_costly_cast')

    expect(skillAfter?.remainingCooldownBySlot?.[0]).toBeGreaterThan(0)
    expect(skillAfter?.remainingCooldownBySlot?.[0]).toBeLessThan(3)
  })

  it('cast HOÀN TẤT bình thường — không refund, cooldown đầy đủ (5)', () => {
    const skill = createCostlyCastSkill()
    const { system, tick, skillSystem } = setup(skill)

    const player = createCombatant({ id: 'player', type: 'player', currentSwordIntent: 100 })
    const enemy = createCombatant({ id: 'enemy', currentHp: 1000000, maxHp: 1000000 })

    system.start(player, enemy)
    system.update(3)
    enemy.x = 2
    enemy.row = HERO_LANE_INDEX

    tick(0.1)
    expect(player.currentSwordIntent).toBe(0)

    // Enemy ở trong tầm suốt → cast hoàn tất, damage gây, không refund.
    for (let i = 0; i < 25; i++) tick(0.1)

    expect(player.castingSkillId).toBeUndefined()
    expect(player.currentSwordIntent).toBe(0)

    const skillAfter = skillSystem['manager'].get('test_costly_cast')

    // Cooldown hoàn tất = 5 trước tick; tick đã giảm ~0.5 → còn ~4.5.
    // So sánh: hoàn tất > fizzle (4.5 > 2.0).
    expect(skillAfter?.remainingCooldownBySlot?.[0]).toBeGreaterThan(3)
    expect(skillAfter?.remainingCooldownBySlot?.[0]).toBeLessThanOrEqual(5)
    // Damage gây ra (bị defense/armor mitigation giảm — attack nền 0) —
    // chỉ chắc chắn KHÔNG refund tài nguyên.
    expect(enemy.currentHp).toBeLessThan(1000000)
  })
})
