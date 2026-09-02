// Perf (Task 6, 2026-09-02) — chứng minh BuffSystem wrapper được TÁI SỬ
// DỤNG (cached theo BuffPool, xem BattleSystem.getBuffSystem()) thay vì
// `new BuffSystem(pool)` lại mỗi fixed-step (10Hz) cho player + từng
// enemy (updateStatsFromModifiers/isIncapacitated/resolveMovement).
// BuffSystem tự thân KHÔNG giữ state nào ngoài tham chiếu `pool` (xem
// BuffSystem.ts — constructor chỉ `private readonly pool`), nên cache
// theo pool an toàn tuyệt đối: bài test dưới verify (1) hành vi giữ
// NGUYÊN — VFX status_vfx_attached/removed vẫn bắn đúng khi buff
// thêm/gỡ giữa trận (như trước khi tối ưu), và (2) danh tính wrapper
// ổn định — constructor CHỈ được gọi 1 LẦN cho mỗi BuffPool dù update()
// chạy nhiều step liên tiếp.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BattleSystem } from './BattleSystem'
import * as BuffSystemModule from '../buff/BuffSystem'
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

/** Boot trận: countdown 3s + player telegraph 1s. */
function startCombat(skill: Skill, enemyOverrides: Partial<CombatEntity> = {}) {
  const { system, tick, attached, removed } = setup(skill)

  const player = createCombatant({ id: 'player', type: 'player', x: 0 })
  const enemy = createCombatant({ id: 'enemy', currentHp: 1000, maxHp: 1000, ...enemyOverrides })

  system.start(player, enemy)
  system.update(3) // countdown
  system.update(1.1) // telegraph 1s → fighting
  placeAdjacent(enemy)

  return { system, tick, attached, removed, player, enemy }
}

describe('BattleSystem — BuffSystem wrapper caching (Task 6 perf)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('không tạo BuffSystem mới cho player/enemy pool ở mỗi fixed-step khi buff không đổi', () => {
    const skill = createSkill({ cooldown: 9999 }) // không cast trong test này — cô lập riêng effect của caching
    const { system, tick } = startCombat(skill)

    const battle = system.getBattle()!
    const playerPool = battle.playerBuffs
    const enemyPool = battle.enemies[0]!.buffs

    // Cache đã "ấm" từ các update() nội bộ trong startCombat() (countdown
    // + telegraph→fighting) TRƯỚC khi spy gắn vào — đây chính xác là điều
    // ta muốn: gắn spy SAU điểm này rồi chứng minh KHÔNG CÒN construction
    // nào nữa dù chạy thêm nhiều fixed-step liên tiếp.
    const spy = vi.spyOn(BuffSystemModule, 'BuffSystem')

    // 10 fixed-step liên tiếp (mô phỏng 1s @ 10Hz) — trước khi tối ưu,
    // mỗi step gọi lại `new BuffSystem(...)` nhiều lần cho CẢ player lẫn
    // enemy (isIncapacitated + updateStatsFromModifiers + resolveMovement).
    for (let i = 0; i < 10; i++) {
      tick(0.1)
    }

    const playerConstructions = spy.mock.calls.filter((call) => call[0] === playerPool)
    const enemyConstructions = spy.mock.calls.filter((call) => call[0] === enemyPool)

    // Cache theo pool: KHÔNG có construction nào thêm sau khi cache đã
    // ấm, dù update() chạy 10 step liên tiếp và CẢ player lẫn enemy đều
    // đi qua nhiều call site đọc buff mỗi step (isIncapacitated x2,
    // resolveMovement, updateStatsFromModifiers).
    expect(playerConstructions).toHaveLength(0)
    expect(enemyConstructions).toHaveLength(0)
  })

  it('VFX status_vfx_attached/removed vẫn bắn đúng khi buff thêm/gỡ giữa trận (hành vi giữ nguyên sau khi cache wrapper)', () => {
    const skill = createSkill({
      id: 'test_lam_cham_expire_skill',
      name: 'Làm Chậm Hết Hạn',
      cooldown: 100,
      effects: [{ type: 'debuff', buffId: 'lam_cham', ailmentChance: 1 }],
    })
    const { tick, attached, removed, system } = startCombat(skill)

    const battle = system.getBattle()!
    const enemyPool = battle.enemies[0]!.buffs
    // Gắn spy SAU khi cache đã ấm (giống test trên) — chứng minh cache
    // KHÔNG bị vô hiệu hoá bởi chính việc buff pool của enemy sắp bị
    // thêm/gỡ 1 debuff thật giữa các tick dưới đây.
    const spy = vi.spyOn(BuffSystemModule, 'BuffSystem')

    tick(0.1) // scheduler chọn skill → bắt đầu cast
    tick(0.5) // hoàn tất cast 0.5s — debuff áp GIỮA tick
    tick(0.1) // tick kế — diff phát attached

    expect(attached).toHaveLength(1)
    expect(attached[0]).toMatchObject({
      targetId: 'enemy',
      dotType: 'lam_cham',
      buffName: 'Làm Chậm',
      polarity: 'debuff',
    })

    tick(5) // quá duration 4s của lam_cham — scheduler cooldown 100s không re-cast

    expect(removed).toHaveLength(1)
    expect(attached[0]).toMatchObject({ statusInstanceId: removed[0]?.statusInstanceId })

    // Wrapper vẫn được TÁI SỬ DỤNG suốt cả pha thêm lẫn gỡ buff — cache
    // không bị "vô hiệu hoá" hay rebuild chỉ vì nội dung pool thay đổi
    // (đúng như kỳ vọng: state thật nằm trong BuffPool, không nằm trong
    // BuffSystem, nên thay đổi buff KHÔNG cần construct lại wrapper).
    const enemyConstructions = spy.mock.calls.filter((call) => call[0] === enemyPool)
    expect(enemyConstructions).toHaveLength(0)
  })
})
