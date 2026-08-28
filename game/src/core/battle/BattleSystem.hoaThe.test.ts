import { describe, expect, it } from 'vitest'
import { BattleSystem } from './BattleSystem'
import { CombatSystem } from '../combat/CombatSystem'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { SkillEffectSystem } from '../skill/SkillEffectSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { AilmentRegistry } from '../ailment/AilmentRegistry'
import { EventBus } from '../events/EventBus'
import { ActionImpactSystem } from '../battle/ActionImpactSystem'


import { createBaseStats } from '../stats/StatBlock'
import { createSkillRuntimeStats } from '../skill/SkillRuntimeStats'
import { ailments } from '../../data/ailment/ailments'
import { MAX_HOA_THE } from '../combat/CombatTypes'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'

// Hỏa Tu Pure (Plans/FirePath mục 7, 2026-08-21) — Hỏa Thế tích theo
// LƯỢT CAST (khác Momentum/Kiếm Ý tích theo ĐÒN TRÚNG, xem
// BattleSystem.theTu.test.ts), nên test này KHÔNG cần chờ missile bay
// tới đích — gain xảy ra ngay trong castSkill().
function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = { ...createBaseStats(), attack: 0, evasionRate: 0, dexterity: 0 }

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
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  }
}

// hoa_cau_thuat (test-only fixture, không đọc data/skill/Skills.ts
// thật) — chỉ cần đúng 2 field engine thật sự đọc:
// grantsHoaThePerCast (skill-level flag) + execution 'attack_speed'
// (nhịp cast theo Attack Speed, cast mỗi giây ở attackSpeed mặc định).
function createHoaCauThuat(): Skill {
  return {
    id: 'hoa_cau_thuat',
    name: 'Hỏa Cầu Thuật (test)',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 1,
    remainingCooldown: 0,
    cost: 0,
    target: 'enemy',
    effects: [{ type: 'damage', value: 1, damageType: 'physical' }],
    execution: { kind: 'attack_speed' },
    loadoutSlot: 0,
    loadoutSlots: [0],
    resourceType: 'none',
    grantsHoaThePerCast: true,
    unlocked: true,
    equipped: true,
  }
}

function setup() {
  const eventBus = new EventBus()
  const skillManager = new SkillManager()
  const skillSystem = new SkillSystem(skillManager)
  const ailmentRegistry = new AilmentRegistry()

  for (const template of ailments) {
    ailmentRegistry.register(template)
  }

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

  const hoaCauThuat = createHoaCauThuat()

  skillManager.add(hoaCauThuat)

  function tick(deltaSeconds: number) {
    skillSystem.update(deltaSeconds, 0)
    system.update(deltaSeconds)
  }

  return { system, tick, hoaCauThuat }
}

describe('BattleSystem — Hỏa Thế (Plans/FirePath mục 7, Tụ Hỏa)', () => {
  it('chưa mua "Tụ Hỏa" (hoaTheGainPerCast=0, nền createBaseStats()) — cast bao nhiêu cũng không tích Hỏa Thế', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })
    const enemy = createCombatant({ id: 'enemy' })

    system.start(player, enemy)
    system.update(3) // Countdown 3s trước trận (2026-08-22) — bỏ qua để test chạy combat logic ngay
    enemy.x = 2
    enemy.row = 4

    for (let i = 0; i < 320; i++) {
      tick(0.01)
    }

    expect(system.getBattle()!.player.currentHoaThe).toBe(0)
  })

  it('đã mua "Tụ Hỏa" (hoaTheGainPerCast=1) — mỗi lần cast Hỏa Cầu Thuật +1 Hỏa Thế, chặn ở MAX_HOA_THE', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })

    player.skillStats = { ...createSkillRuntimeStats(), hoaTheGainPerCast: 1 }

    const enemy = createCombatant({ id: 'enemy' })

    system.start(player, enemy)
    system.update(3) // Countdown 3s trước trận (2026-08-22) — bỏ qua để test chạy combat logic ngay
    enemy.x = 2
    enemy.row = 4

    // attackSpeed mặc định 1 -> cast mỗi 1s (+1 Hỏa Thế/cast), nhưng
    // HOA_THE_BASE_DECAY_PER_SECOND=0.5 chạy song song (updateHoaThe())
    // — sau đủ lâu, giá trị dao động ổn định giữa (MAX_HOA_THE - 1 chu
    // kỳ decay) và MAX_HOA_THE (chạm trần ngay lúc cast, decay dần tới
    // lúc cast kế tiếp), KHÔNG neo cứng ở đúng MAX_HOA_THE tại 1 mốc
    // tick bất kỳ — chỉ cần xác nhận trần được tôn trọng (không vượt)
    // và giá trị đã leo cao (không kẹt gần 0).
    for (let i = 0; i < 3000; i++) {
      tick(0.01)
    }

    const finalHoaThe = system.getBattle()!.player.currentHoaThe

    expect(finalHoaThe).toBeLessThanOrEqual(MAX_HOA_THE)
    expect(finalHoaThe).toBeGreaterThan(4)
  })

  it('Hỏa Thế tự giảm theo thời gian (updateHoaThe) dù vẫn đang cast, vì hoaTheGainPerCast=0 (chưa mua Tụ Hỏa)', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0, currentHoaThe: 5 })
    const enemy = createCombatant({ id: 'enemy' })

    system.start(player, enemy)
    system.update(3) // Countdown 3s trước trận (2026-08-22) — bỏ qua để test chạy combat logic ngay

    // HOA_THE_BASE_DECAY_PER_SECOND=0.5 -> 2s giảm hết 1 tầng.
    for (let i = 0; i < 200; i++) {
      tick(0.01)
    }

    expect(system.getBattle()!.player.currentHoaThe).toBeCloseTo(4, 5)
  })

  it('"Tụ Viêm" (hoaTheDecayReductionPercent=0.1) làm Hỏa Thế giảm chậm hơn', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0, currentHoaThe: 5 })

    player.skillStats = { ...createSkillRuntimeStats(), hoaTheDecayReductionPercent: 0.1 }

    const enemy = createCombatant({ id: 'enemy' })

    system.start(player, enemy)
    system.update(3) // Countdown 3s trước trận (2026-08-22) — bỏ qua để test chạy combat logic ngay

    for (let i = 0; i < 200; i++) {
      tick(0.01)
    }

    // Không giảm reduction: 5 - 0.5*2 = 4. Có -10%: 5 - 0.45*2 = 4.1.
    expect(system.getBattle()!.player.currentHoaThe).toBeCloseTo(4.1, 5)
  })
})
