// Buff bar (2026-09-02) — snapshot statuses mở rộng: MỌI buff visible
// (không chỉ dot) + payload polarity/permanent/buffName.
//
// PIPELINE NOTE (verify bằng debug): pipeline diff phát
// status_vfx_attached CHỈ khi buff áp VÀO TRONG tick — skill cast hoàn
// tất giữa [1] snapshot và [16] diff. Buff áp từ ngoài tick (mutation
// trực tiếp pool) KHÔNG phát attached (before/after cùng thấy buff).
// Nên các case dùng skill thực qua scheduler — đúng kênh production.
import { describe, expect, it } from 'vitest'
import { BattleSystem } from './BattleSystem'
import { CombatSystem } from '../combat/CombatSystem'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { SkillEffectSystem } from '../skill/SkillEffectSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { EventBus } from '../events/EventBus'
import { ActionImpactSystem } from '../battle/ActionImpactSystem'

import { createBaseStats } from '../stats/StatBlock'
import { HERO_LANE_INDEX } from './BattleLane'
import { buffs } from '../../data/buff/buffs'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'
import type { StatusVfxAttachedEvent, StatusVfxRemovedEvent } from './BattleEvents'

function createBuffRegistry(): BuffRegistry {
  const registry = new BuffRegistry()

  for (const definition of buffs) {
    registry.register(definition)
  }

  return registry
}

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
    row: HERO_LANE_INDEX,
    alive: true,
    ...overrides,
  }
}

function createSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'test_debuff_skill',
    name: 'Bỏng Thử Nghiệm',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 5,
    remainingCooldown: 0,
    cost: 0,
    target: 'enemy',
    // debuff áp QUA SkillEffectSystem khi cast hoàn tất — đúng kênh
    // production (buff vào pool GIỮA [1] snapshot và [16] diff).
    effects: [{ type: 'debuff', buffId: 'bong', ailmentChance: 1 }],
    execution: { kind: 'cast_time', castTime: 0.5 },
    resourceType: 'none',
    unlocked: true,
    equipped: true,
    loadoutSlot: 0,
    loadoutSlots: [0],
    ...overrides,
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
    createBuffRegistry(),
    eventBus,
    new ActionImpactSystem({ eventBus, rollCritical: () => false }),
  )

  const attached: StatusVfxAttachedEvent[] = []
  const removed: StatusVfxRemovedEvent[] = []

  eventBus.on<StatusVfxAttachedEvent>('status_vfx_attached', (event) => attached.push(event))
  eventBus.on<StatusVfxRemovedEvent>('status_vfx_removed', (event) => removed.push(event))

  function tick(deltaSeconds: number) {
    skillSystem.update(deltaSeconds, 0)
    system.update(deltaSeconds)
  }

  return { system, tick, attached, removed }
}

/** Đưa quái vào ô kề avatar (Chebyshev 1) sau khi materialize. */
function placeAdjacent(enemy: CombatEntity) {
  enemy.x = 2
  enemy.row = HERO_LANE_INDEX
}

/** Boot trận: countdown 3s + player telegraph 1s + chọn skill. */
function startCombat(skill: Skill) {
  const { system, tick, attached, removed } = setup(skill)

  const player = createCombatant({ id: 'player', type: 'player', x: 0 })
  const enemy = createCombatant({ id: 'enemy', currentHp: 1000, maxHp: 1000 })

  system.start(player, enemy)
  system.update(3) // countdown
  system.update(1.1) // telegraph 1s → fighting
  placeAdjacent(enemy)
  tick(0.1) // scheduler chọn skill → bắt đầu cast

  return { system, tick, attached, removed, player, enemy }
}

describe('BattleSystem — status_vfx: mọi buff visible (buff bar), không chỉ dot', () => {
  it('DoT skill (bong) cast hoàn tất → attached mang đủ payload buff bar', () => {
    const skill = createSkill()
    const { tick, attached } = startCombat(skill)

    tick(0.5) // hoàn tất cast 0.5s — debuff áp GIỮA tick
    tick(0.1) // tick kế — diff phát attached

    expect(attached).toHaveLength(1)
    expect(attached[0]).toMatchObject({
      targetId: 'enemy',
      dotType: 'bong',
      stacks: 1,
      buffName: 'Bỏng',
      polarity: 'debuff',
      permanent: false,
      durationSeconds: expect.any(Number),
    })
  })

  it('buff tạm polarity "buff" (reaction áp khai_son — qua skill debuff suy_nhuoc fallback: dùng skill buff trực tiếp khai_son buffId)', () => {
    // khai_son hiện chỉ đạt qua reaction (Thổ+Kim) — khó dựng qua skill
    // scheduler. Test polarity 'buff' dùng skill áp buff thẳng (effects
    // type 'buff' — kênh SkillEffectSystem case 'buff').
    const skill = createSkill({
      id: 'test_buff_skill',
      name: 'Khai Sơn Thử Nghiệm',
      effects: [{ type: 'buff', buffId: 'khai_son' }],
    })
    const { tick, attached } = startCombat(skill)

    tick(0.5)
    tick(0.1)

    expect(attached).toHaveLength(1)
    expect(attached[0]).toMatchObject({
      targetId: 'player',
      dotType: 'khai_son',
      polarity: 'buff',
      permanent: false,
    })
  })

  it('statModifier debuff (lam_cham) qua skill → attached polarity debuff, buffName đúng', () => {
    const skill = createSkill({
      id: 'test_lam_cham_skill',
      name: 'Làm Chậm Thử Nghiệm',
      effects: [{ type: 'debuff', buffId: 'lam_cham', ailmentChance: 1 }],
    })
    const { tick, attached } = startCombat(skill)

    tick(0.5)
    tick(0.1)

    expect(attached).toHaveLength(1)
    expect(attached[0]).toMatchObject({
      targetId: 'enemy',
      dotType: 'lam_cham',
      buffName: 'Làm Chậm',
      polarity: 'debuff',
    })
  })

  it('CC (choang) qua skill → attached với duration > 0', () => {
    const skill = createSkill({
      id: 'test_choang_skill',
      name: 'Choáng Thử Nghiệm',
      effects: [{ type: 'debuff', buffId: 'choang', ailmentChance: 1 }],
    })
    const { tick, attached } = startCombat(skill)

    tick(0.5)
    tick(0.1)

    expect(attached).toHaveLength(1)
    expect(attached[0]).toMatchObject({
      targetId: 'enemy',
      dotType: 'choang',
      polarity: 'debuff',
      durationSeconds: expect.any(Number),
    })
  })

  it('permanent buff (onhit_*, duration Infinity) → permanent: true', () => {
    // onhit_* đạt qua talent on-hit — không có skill directa. Test qua
    // skill buff trỏ thẳng onhit def (registry có sẵn).
    const skill = createSkill({
      id: 'test_onhit_skill',
      name: 'Khiêm Phong Thử Nghiệm',
      effects: [{ type: 'buff', buffId: 'onhit_khiem_phong_haste' }],
    })
    const { tick, attached } = startCombat(skill)

    tick(0.5)
    tick(0.1)

    expect(attached).toHaveLength(1)
    expect(attached[0]).toMatchObject({
      targetId: 'player',
      dotType: 'onhit_khiem_phong_haste',
      polarity: 'buff',
      permanent: true,
    })
  })

  it('buff hết hạn → removed event (statModifier debuff trước đây không event nào)', () => {
    const skill = createSkill({
      id: 'test_lam_cham_expire_skill',
      name: 'Làm Chậm Hết Hạn',
      cooldown: 100,
      effects: [{ type: 'debuff', buffId: 'lam_cham', ailmentChance: 1 }],
    })
    const { tick, attached, removed } = startCombat(skill)

    tick(0.5)
    tick(0.1)
    expect(attached).toHaveLength(1)

    tick(5) // quá duration 4s của lam_cham — scheduler cooldown 100s không re-cast

    expect(removed).toHaveLength(1)
    expect(attached[0]).toMatchObject({ statusInstanceId: removed[0]?.statusInstanceId })
  })
})
