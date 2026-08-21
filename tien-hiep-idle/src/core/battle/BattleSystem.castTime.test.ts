import { describe, expect, it } from 'vitest'
import { BattleSystem } from './BattleSystem'
import { CombatSystem } from '../combat/CombatSystem'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { SkillEffectSystem } from '../skill/SkillEffectSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { AilmentRegistry } from '../ailment/AilmentRegistry'
import { EventBus } from '../events/EventBus'
import { MissileSystem, MISSILE_SPEED } from '../combat/missile/MissileSystem'
import { MissileManager } from '../combat/missile/MissileManager'
import { createBaseStats } from '../stats/StatBlock'
import { ENEMY_SPAWN_X } from './BattleLane'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'

// Cast Time (2026-08-21) — Skill.castTime > 0 hoãn hiệu ứng thật lại
// (BattleSystem.beginCast()/updateCasting(), TÁCH khỏi castSkill() cũ)
// thay vì thi triển tức thời như MỌI skill hiện có trong game (castTime
// undefined/0). Test này dùng skill fixture RIÊNG (castTime: 2), không
// đụng data/skill/Skills.ts thật.
//
// missile fired lúc resolveSkillEffects() phải BAY hết quãng đường tới
// enemy (system.start() luôn set enemy.x = ENEMY_SPAWN_X, ghi đè bất kỳ
// x nào truyền vào fixture — gotcha đã ghi ở EarthPath, xem BattleLane.ts).
// MISSILE_TRAVEL_BUFFER_SECONDS = thời gian bay tối đa (ENEMY_SPAWN_X/
// MISSILE_SPEED) + biên an toàn nhỏ, dùng SAU khi cast complete để chờ
// missile trúng đích trước khi assert currentHp.
const MISSILE_TRAVEL_BUFFER_SECONDS = ENEMY_SPAWN_X / MISSILE_SPEED + 0.1

function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = {
    ...createBaseStats(),
    attack: 0,
    evasionRate: 0,
    dexterity: 0,
    attackSpeed: 0,
    attackRange: 0,
    // resolveMovement() cho enemy tự đi tới attackRange=0 (tức đi hết
    // về phía player) nếu không zero hẳn — cùng bug đã sửa ở
    // BattleSystem.lavaZone.test.ts, làm khoảng cách/missile travel
    // time không còn dự đoán được.
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
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    lane: 'ground',
    alive: true,
    ...overrides,
  }
}

function createCastTimeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'test_cast_skill',
    name: 'Niệm Chú Thử Nghiệm',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    experience: 0,
    experienceRequired: 100,
    cooldown: 5,
    remainingCooldown: 0,
    cost: 0,
    target: 'enemy',
    // effect 'damage' là MULTIPLIER lên source.stats.attack (xem
    // SkillEffectSystem.ts's finalMultiplier) — player.stats.attack
    // phải > 0 (set riêng ở mỗi test) để có damage thật đo được.
    effects: [{ type: 'damage', value: 100, damageType: 'physical' }],
    castTime: 2,
    resourceType: 'none',
    unlocked: true,
    equipped: true,
    loadoutSlot: 0,
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
    new BuffRegistry(),
    new AilmentRegistry(),
    eventBus,
    new MissileSystem(new MissileManager(), eventBus),
  )

  const events: { type: string; sourceId?: string; skillId?: string; skillName?: string; castTimeSeconds?: number }[] = []

  for (const type of ['cast_start', 'cast_complete']) {
    eventBus.on(type, (event: any) => events.push({ type, ...event }))
  }

  function tick(deltaSeconds: number) {
    skillSystem.update(deltaSeconds, 0)
    system.update(deltaSeconds)
  }

  return { system, tick, events }
}

describe('BattleSystem — Cast Time (2026-08-21)', () => {
  it('castTime > 0: hiệu ứng KHÔNG áp ngay lúc bắt đầu cast, chỉ áp SAU khi đếm ngược xong', () => {
    const skill = createCastTimeSkill()
    const { system, tick, events } = setup(skill)

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })
    const enemy = createCombatant({ id: 'enemy', currentHp: 1000, maxHp: 1000 })

    player.stats.attack = 100

    system.start(player, enemy)

    // Tick đầu tiên chọn skill trong Loadout, BẮT ĐẦU niệm — cooldown
    // đã tốn NGAY (đúng quy ước MMO) nhưng damage CHƯA áp.
    tick(0.1)

    expect(enemy.currentHp).toBe(1000)
    expect(player.castingSkillId).toBe('test_cast_skill')
    expect(skill.remainingCooldown).toBeGreaterThan(0)
    expect(events).toContainEqual(expect.objectContaining({
      type: 'cast_start',
      sourceId: 'player',
      skillId: 'test_cast_skill',
      skillName: 'Niệm Chú Thử Nghiệm',
      castTimeSeconds: 2,
    }))

    // Chưa đủ 2s — vẫn đang niệm, chưa áp damage.
    tick(1.5)
    expect(enemy.currentHp).toBe(1000)
    expect(player.castingSkillId).toBe('test_cast_skill')

    // Đủ 2s — hiệu ứng thi triển thật (bắn missile), castingSkillId gỡ
    // ra NGAY dù missile còn đang bay tới đích.
    tick(0.5)
    expect(player.castingSkillId).toBeUndefined()
    expect(events).toContainEqual(expect.objectContaining({ type: 'cast_complete', sourceId: 'player', skillId: 'test_cast_skill' }))

    // Chờ missile bay hết quãng đường (ENEMY_SPAWN_X/MISSILE_SPEED)
    // rồi mới đo damage thật.
    tick(MISSILE_TRAVEL_BUFFER_SECONDS)
    expect(enemy.currentHp).toBeLessThan(1000)
  })

  it('đang casting thì KHÔNG chọn skill mới (updateAutoCast() bị chặn tới khi cast xong)', () => {
    const skill = createCastTimeSkill()
    const { system, tick, events } = setup(skill)

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })
    const enemy = createCombatant({ id: 'enemy', currentHp: 1000, maxHp: 1000 })

    player.stats.attack = 100

    system.start(player, enemy)

    tick(0.1)
    tick(0.5)
    tick(0.5)

    // 3 tick liên tiếp trong lúc đang niệm — vẫn CHỈ đúng 1 'cast_start'
    // (không bắt đầu cast chồng cast).
    expect(events.filter(event => event.type === 'cast_start')).toHaveLength(1)
  })

  it('castSpeedPercent rút ngắn Cast Time thật — cùng 1 khoảng deltaSeconds, cast xong sớm hơn', () => {
    const skill = createCastTimeSkill()
    const { system, tick } = setup(skill)

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })
    const enemy = createCombatant({ id: 'enemy', currentHp: 1000, maxHp: 1000 })

    player.stats.attack = 100
    player.stats.castSpeedPercent = 1 // +100% tốc độ niệm — 2s còn 1s thật.

    system.start(player, enemy)

    // Tick đầu chỉ BẮT ĐẦU niệm (updateCasting() chạy TRƯỚC
    // updateAutoCast() trong cùng tick — castTimeRemaining=2 raw chưa
    // bị trừ tick này).
    tick(0.1)
    // effectiveDelta = 0.9 * (1+1) = 1.8 -> remaining 2 - 1.8 = 0.2, CHƯA xong.
    tick(0.9)
    expect(enemy.currentHp).toBe(1000)
    // effectiveDelta = 0.2 * (1+1) = 0.4 -> remaining 0.2 - 0.4 < 0, xong — bắn missile.
    tick(0.2)
    expect(player.castingSkillId).toBeUndefined()

    tick(MISSILE_TRAVEL_BUFFER_SECONDS)
    expect(enemy.currentHp).toBeLessThan(1000)
  })
})
