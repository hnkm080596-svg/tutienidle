import { describe, expect, it } from 'vitest'
import { BattleSystem } from './BattleSystem'
import { CombatSystem } from '../combat/CombatSystem'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { SkillEffectSystem } from '../skill/SkillEffectSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { AilmentRegistry } from '../ailment/AilmentRegistry'
import { EventBus } from '../events/EventBus'
import { ActionImpactSystem } from './ActionImpactSystem'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'

// combat-skill-flow-element-power-dot-plan.md §4 (cast transaction) +
// §5 (round-robin scheduler) — kiểm chứng bắt buộc mục 9.

function channeledSkill(): Skill {
  return {
    id: 'skill_chan',
    name: 'Niệm Chưởng',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 10,
    remainingCooldown: 0,
    cost: 8,
    resourceType: 'mana',
    target: 'enemy',
    effects: [],
    unlocked: true,
    equipped: false,
    execution: { kind: 'cast_time', castTime: 0.5 },
  }
}

function instantSkill(id: string, cost: number): Skill {
  return {
    id,
    name: id,
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 0,
    remainingCooldown: 0,
    cost,
    resourceType: 'mana',
    target: 'enemy',
    effects: [],
    unlocked: true,
    equipped: false,
    execution: { kind: 'cooldown' },
  }
}

interface Harness {
  system: BattleSystem

  skillManager: SkillManager

  skillSystem: SkillSystem

  eventBus: EventBus

  player: CombatEntity
}

function createHarness(playerOverrides: Partial<CombatEntity> = {}): Harness {
  const eventBus = new EventBus()

  const skillManager = new SkillManager()

  const skillSystem = new SkillSystem(skillManager)

  const system = new BattleSystem(
    new CombatSystem(eventBus),
    skillManager,
    skillSystem,
    new SkillEffectSystem(),
    new BuffRegistry(),
    new AilmentRegistry(),
    eventBus,
    new ActionImpactSystem({ eventBus, rollCritical: () => false }),
  )

  const stats = {
    ...createBaseStats(),

    // Range khổng lồ để target luôn trong tầm sau khi materialize.
    attackRange: 999,

    evasionRate: 0,

    // Intelligence = 0 tắt regen phái sinh (StatCalculator cộng
    // intelligence × MANA_REGEN_PER_POINT vào manaRegenPerSecond).
    intelligence: 0,

    // Regen = 0 để phép đo qua currentMp KHÔNG bị nhiễu float giữa các
    // fixed-step (phân loại skill cast theo lượng mana tiêu).
    manaRegenPerSecond: 0,

    // maxMp đồng bộ cả trong stats (updateStatsFromModifiers clamp
    // currentMp theo stats.maxMp mỗi tick).
    maxMp: 1000,
  }

  const player: CombatEntity = {
    id: 'player',

    name: 'Player',

    type: 'player',

    baseStats: stats,

    stats,

    currentHp: stats.maxHp,

    maxHp: stats.maxHp,

    currentMp: 1000,

    currentRage: 0,

    currentSwordIntent: 0,

    currentMomentum: 0,

    currentHoaThe: 0,

    currentThoThe: 0,

    currentKimThe: 0,

    timeSinceLastBleedProc: 0,

    currentWard: 0,

    timeSinceLastHitTaken: Infinity,

    realmIndex: 99,

    x: 0,

    row: 2,

    alive: true,

    ...playerOverrides,
  }

  return { system, skillManager, skillSystem, eventBus, player }
}

/** Start trận + chạy qua countdown để state='fighting', quái đã materialize. */
function enterFighting(harness: Harness, enemyId = 'enemy') {
  const enemyStats = { ...createBaseStats(), evasionRate: 0 }

  const enemy: CombatEntity = {
    id: enemyId,

    name: enemyId,

    type: 'enemy',

    baseStats: enemyStats,

    stats: enemyStats,

    currentHp: 1_000_000,

    maxHp: 1_000_000,

    currentMp: 0,

    currentRage: 0,

    currentSwordIntent: 0,

    currentMomentum: 0,

    currentHoaThe: 0,

    currentThoThe: 0,

    currentKimThe: 0,

    timeSinceLastBleedProc: 0,

    currentWard: 0,

    timeSinceLastHitTaken: Infinity,

    realmIndex: 0,

    x: 6,

    row: 2,

    alive: true,
  }

  harness.system.start(harness.player, enemy)

  // Flush telegraph spawn (0.75s) rồi hết countdown (3s).
  harness.system.update(0.8)

  harness.system.update(2.5)

  expect(harness.system.getBattle()!.state).toBe('fighting')
}

describe('SkillSystem — cast transaction (plan §4)', () => {
  it('beginCastInSlot CHỈ trừ tài nguyên, KHÔNG set cooldown; commitSlotCooldown mới set', () => {
    const harness = createHarness()

    harness.skillManager.add(channeledSkill())

    harness.skillSystem.equipToSlot('skill_chan', 0)

    const entity = harness.player

    entity.currentMp = 100

    const begun = harness.skillSystem.beginCastInSlot('skill_chan', 0, entity)

    expect(begun).not.toBeNull()
    expect(entity.currentMp).toBe(92)
    expect(harness.skillManager.get('skill_chan')!.remainingCooldownBySlot?.[0]).toBeUndefined()

    harness.skillSystem.commitSlotCooldown('skill_chan', 0)

    expect(harness.skillManager.get('skill_chan')!.remainingCooldownBySlot?.[0]).toBe(10)
  })

  it('beginCastInSlot thiếu tài nguyên → null và KHÔNG mutate gì', () => {
    const harness = createHarness()

    harness.skillManager.add(channeledSkill())

    harness.skillSystem.equipToSlot('skill_chan', 0)

    const entity = harness.player

    entity.currentMp = 5

    expect(harness.skillSystem.beginCastInSlot('skill_chan', 0, entity)).toBeNull()
    expect(entity.currentMp).toBe(5)
  })
})

describe('BattleSystem — cast transaction trong trận (plan §4)', () => {
  it('mana bị trừ lúc BẮT ĐẦU niệm đúng 1 lần; cooldown bằng 0 trong lúc niệm và nhận ĐỦ giá trị khi hoàn tất', () => {
    const harness = createHarness()

    harness.skillManager.add(channeledSkill())

    harness.skillSystem.equipToSlot('skill_chan', 0)

    enterFighting(harness)

    // Tick đầu tiên của scheduler — bắt đầu niệm ngay.
    harness.system.update(0.016)

    expect(harness.player.castingSkillId).toBe('skill_chan')
    expect(harness.player.currentMp).toBeCloseTo(1000 - 8, 2)
    expect(harness.skillManager.get('skill_chan')!.remainingCooldownBySlot?.[0] ?? 0).toBe(0)

    // Niệm dở — cooldown vẫn chưa bắt đầu.
    harness.system.update(0.2)

    expect(harness.player.castingSkillId).toBe('skill_chan')
    expect(harness.skillManager.get('skill_chan')!.remainingCooldownBySlot?.[0] ?? 0).toBe(0)
    expect(harness.player.currentMp).toBeCloseTo(1000 - 8, 2)

    // Hết 0.5s cast time — hoàn tất, cooldown đầy đủ bắt đầu.
    harness.system.update(0.4)

    expect(harness.player.castingSkillId).toBeUndefined()

    // Commit trong CÙNG bước hoàn tất — giá trị ĐẦY ĐỦ, trừ dần từ bước kế.
    expect(harness.skillManager.get('skill_chan')!.remainingCooldownBySlot?.[0]).toBe(10)
    expect(harness.player.currentMp).toBeCloseTo(1000 - 8, 2)
  })

  it('fizzle (target chết giữa lúc niệm) vẫn tiêu mana và bắt đầu cooldown đầy đủ', () => {
    const harness = createHarness()

    harness.skillManager.add(channeledSkill())

    harness.skillSystem.equipToSlot('skill_chan', 0)

    enterFighting(harness)

    harness.system.update(0.016)

    expect(harness.player.castingSkillId).toBe('skill_chan')

    // Giết target NGAY TRƯỚC khi niệm xong.
    const battle = harness.system.getBattle()!

    battle.enemies[0]!.entity.alive = false

    harness.system.update(0.6)

    expect(harness.player.castingSkillId).toBeUndefined()
    expect(harness.player.currentMp).toBeCloseTo(1000 - 8, 2)
    expect(
      (harness.skillManager.get('skill_chan')!.remainingCooldownBySlot?.[0] ?? 0),
    ).toBeGreaterThan(9)
  })

  it('skill tức thời resolve rồi cooldown bắt đầu trong CÙNG fixed-step', () => {
    const harness = createHarness()

    harness.skillManager.add(instantSkill('instant_a', 5))

    harness.skillSystem.equipToSlot('instant_a', 0)

    enterFighting(harness)

    harness.system.update(0.016)

    expect(harness.player.currentMp).toBeCloseTo(1000 - 5, 2)
    expect(harness.skillManager.get('instant_a')!.remainingCooldownBySlot?.[0]).toBe(0)
    expect(harness.player.castingSkillId).toBeUndefined()
    expect(harness.player.castingSlotIndex).toBeUndefined()
  })

  it('đổi loadout GIỮA LÚC NIỆM không làm cooldown gắn nhầm slot (snapshot castingSlotIndex)', () => {
    const harness = createHarness()

    harness.skillManager.add(channeledSkill())

    harness.skillSystem.equipToSlot('skill_chan', 0)

    enterFighting(harness)

    harness.system.update(0.016)

    expect(harness.player.castingSlotIndex).toBe(0)

    // Gỡ khỏi loadout giữa lúc niệm.
    harness.skillSystem.unequipFromSlot(0)

    harness.system.update(0.6)

    // Cooldown vẫn commit vào ĐÚNG skill/slot đã snapshot.
    expect(harness.skillManager.get('skill_chan')!.remainingCooldownBySlot?.[0]).toBeGreaterThan(9)
    expect(harness.player.castingSlotIndex).toBeUndefined()
  })
})

describe('BattleSystem — round-robin scheduler (plan §5)', () => {
  it('hai skill cùng điều kiện luân phiên 0,1,0,1 theo slot', () => {
    const harness = createHarness()

    harness.skillManager.add(instantSkill('inst_slot0', 8))

    harness.skillManager.add(instantSkill('inst_slot1', 5))

    harness.skillSystem.equipToSlot('inst_slot0', 0)

    harness.skillSystem.equipToSlot('inst_slot1', 1)

    enterFighting(harness)

    const castOrder: string[] = []

    harness.eventBus.on('cast_complete', event => {
      void event
    })

    // Theo dõi qua mana: mỗi lần cast trừ đúng cost của skill đó.
    let previousMana = harness.player.currentMp

    const spentPerStep: number[] = []

    for (let step = 0; step < 4; step++) {
      harness.system.update(0.016)

      const spent = Math.round(previousMana - harness.player.currentMp)

      if (spent > 0) {
        castOrder.push(spent === 8 ? 'inst_slot0' : 'inst_slot1')
      }

      spentPerStep.push(spent)

      previousMana = harness.player.currentMp
    }

    expect(castOrder).toEqual(['inst_slot0', 'inst_slot1', 'inst_slot0', 'inst_slot1'])
    expect(spentPerStep.every(cost => cost === 8 || cost === 5)).toBe(true)
  })

  it('skill chưa ready bị bỏ qua, con trỏ không kẹt — skill ready kế tiếp vẫn dùng được', () => {
    const harness = createHarness()

    const blocked = instantSkill('blocked', 8)

    blocked.cooldown = 999

    harness.skillManager.add(blocked)

    harness.skillManager.add(instantSkill('free', 5))

    harness.skillSystem.equipToSlot('blocked', 0)

    harness.skillSystem.equipToSlot('free', 1)

    enterFighting(harness)

    // Tick 1: cursor ở slot 0 — 'blocked' cast rồi vào cooldown dài.
    harness.system.update(0.016)

    const mpAfterFirst = harness.player.currentMp

    expect(mpAfterFirst).toBeCloseTo(1000 - 8, 2)

    // Tick 2..3: cursor quét qua slot 0 (bỏ qua — đang cooldown) và
    // slot 1 ('free' cooldown 0 nên cast lại được mỗi lượt).
    harness.system.update(0.016)

    harness.system.update(0.016)

    expect(harness.player.currentMp).toBeLessThan(mpAfterFirst)
    expect(harness.player.currentMp).toBeCloseTo(1000 - 8 - 5 - 5, 2)
  })

  it('trận mới reset vòng xoay về slot đầu', () => {
    const harness = createHarness()

    harness.skillManager.add(instantSkill('reset_a', 8))

    harness.skillManager.add(instantSkill('reset_b', 5))

    harness.skillSystem.equipToSlot('reset_a', 0)

    harness.skillSystem.equipToSlot('reset_b', 1)

    enterFighting(harness)

    // Ba tick: a, b, a — cursor kết thúc ở VỊ TRÍ slot 1 (không phải
    // slot 0), nhờ round-robin.
    harness.system.update(0.016)

    harness.system.update(0.016)

    harness.system.update(0.016)

    expect(harness.player.currentMp).toBeCloseTo(1000 - 8 - 5 - 8, 2)

    // Trận MỚI — cursor reset về slot đầu: tick kế phải cast skill
    // SLOT 0 (cost 8). Nếu không reset sẽ rơi vào slot 1 (cost 5).
    enterFighting(harness, 'enemy_2')

    harness.system.update(0.016)

    expect(harness.player.currentMp).toBeCloseTo(1000 - 8 - 5 - 8 - 8, 2)
  })
})
