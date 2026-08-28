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
import { ActionImpactSystem } from './ActionImpactSystem'
import { createBaseStats } from '../stats/StatBlock'
import { HERO_COLUMN } from './BattleLane'
import { ailments } from '../../data/ailment/ailments'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'
import type { EntityVitalsChangedEvent } from '../combat/EntityVitalsSystem'

// Kiếm Tu Bạt Kiếm (Task 4, spec §4.2) — TỤ LỰC: mọi damage/randomness
// khác bị triệt tiêu (crit/dodge/block = 0, attack cao + defense/endurance
// zero khi cần phép đo chính xác) để test chỉ đo đúng cơ chế channel.
function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = {
    ...createBaseStats(),
    // attack=0 mặc định — CHỈ Player override attack:100 tường minh ở
    // từng test (xem createPlayer()). Quái giữ attack=0: enemy1/2/3 bị
    // ép đứng ĐÚNG cột HERO_COLUMN (distance=0) để nằm gọn trong vùng
    // 'all_lanes' của channel — nếu quái cũng có attack>0 thì distance=0
    // <= attackRange=0 vẫn đủ điều kiện "trong tầm" (Chebyshev 0<=0) và
    // sẽ phản công Player, nhiễu phép đo damage/amp thuần channel.
    attack: 0,
    defense: 0,
    evasionRate: 0,
    criticalRate: 0,
    blockChance: 0,
    dexterity: 0,
    // Không ai chủ động tấn công nhau ngoài channel tick — attackRange=0
    // đảm bảo Player scheduler (updatePlayerSkills) không tìm được
    // target cho slot nào (loadout chỉ có skill channel, vốn đã KHÔNG
    // đi qua beginPlayerCast — attackRange=0 chỉ để tránh nhiễu thêm),
    // và enemy archetype mặc định không tự bước vào tầm bắn.
    attackRange: 0,
    attackSpeed: 0,
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
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  }
}

/** Player — attack:100 tường minh (nguồn damage của channel), quái giữ attack:0. */
function createPlayer(overrides: Partial<CombatEntity>): CombatEntity {
  const player = createCombatant({ id: 'player', type: 'player', x: 0, ...overrides })

  player.stats.attack = 100

  return player
}

// bat_kiem_thuat (test-only fixture) — target 'all_enemies' đủ để
// targetingForSkill() (CombatAction.ts:44) tự quyết shape 'all_lanes',
// engine thật sự chỉ đọc execution.kind==='channel' + tickSeconds.
function createBatKiemThuat(tickSeconds = 3): Skill {
  return {
    id: 'bat_kiem_thuat',
    name: 'Bạt Kiếm Thuật (test)',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 0,
    remainingCooldown: 0,
    cost: 0,
    target: 'all_enemies',
    effects: [{ type: 'damage', value: 1, damageType: 'physical' }],
    execution: { kind: 'channel', tickSeconds },
    loadoutSlot: 0,
    loadoutSlots: [0],
    resourceType: 'none',
    unlocked: true,
    equipped: true,
  }
}

function setup(tickSeconds = 3) {
  const eventBus = new EventBus()
  const skillManager = new SkillManager()
  const skillSystem = new SkillSystem(skillManager)
  const ailmentRegistry = new AilmentRegistry()

  for (const template of ailments) {
    ailmentRegistry.register(template)
  }

  const combat = new CombatSystem(eventBus)

  const system = new BattleSystem(
    combat,
    skillManager,
    skillSystem,
    new SkillEffectSystem(),
    new BuffRegistry(),
    ailmentRegistry,
    eventBus,
    new ActionImpactSystem({ eventBus, rollCritical: () => false }),
  )

  const skill = createBatKiemThuat(tickSeconds)

  skillManager.add(skill)

  const vitalsEvents: EntityVitalsChangedEvent[] = []

  eventBus.on<EntityVitalsChangedEvent>('entity_vitals_changed', (event) => {
    vitalsEvents.push(event)
  })

  function tick(deltaSeconds: number) {
    skillSystem.update(deltaSeconds, 0)
    system.update(deltaSeconds)
  }

  return { system, combat, tick, skill, vitalsEvents, eventBus }
}

describe('BattleSystem — Bạt Kiếm auto-channel (spec §4.2, Task 4)', () => {
  it('vào trận với skill channel: mỗi tickSeconds gây 1 phát trúng MỌI hàng', () => {
    const { system, vitalsEvents } = setup(3)

    const player = createPlayer({})
    const enemy1 = createCombatant({ id: 'enemy1', row: 0 })
    const enemy2 = createCombatant({ id: 'enemy2', row: 4 })
    const enemy3 = createCombatant({ id: 'enemy3', row: 8 })

    system.start(player, enemy1)

    // Gotcha (BattleSystem.start()/spawnEnemyInto() overwrite entity.x
    // ngay khi materialize — set lại vị trí SAU khi gọi, không set qua
    // fixture): flush telegraph của enemy1 rồi ép lại toạ độ cả 3 quái
    // vào 3 hàng khác nhau, CÙNG cột HERO_COLUMN để nằm gọn trong vùng
    // 'all_lanes' (columnRadius rất lớn nhưng vẫn clamp trong lưới).
    system.flushPendingSpawns()

    enemy1.x = HERO_COLUMN
    enemy1.row = 0

    const battle = system.getBattle()!

    system.spawnEnemyInto(battle, enemy2)
    enemy2.x = HERO_COLUMN
    enemy2.row = 4

    system.spawnEnemyInto(battle, enemy3)
    enemy3.x = HERO_COLUMN
    enemy3.row = 8

    // Channel bật NGAY từ start() (skill channel đang equip duy nhất
    // trong loadout) nhưng elapsed chỉ tích khi state 'fighting'.
    expect(battle.player.tuLucActive).toBe(true)

    system.update(3) // bỏ qua countdown (BATTLE_COUNTDOWN_SECONDS=3)

    expect(battle.state).toBe('fighting')
    expect(battle.player.tuLucElapsed).toBe(0)

    const damageEventsFor = (id: string) =>
      vitalsEvents.filter((event) => event.entityId === id && event.reason === 'damage')

    system.update(2.9)

    expect(battle.player.tuLucElapsed).toBeCloseTo(2.9, 5)
    expect(damageEventsFor('enemy1')).toHaveLength(0)
    expect(damageEventsFor('enemy2')).toHaveLength(0)
    expect(damageEventsFor('enemy3')).toHaveLength(0)

    system.update(0.1) // 2.9 + 0.1 = 3.0 → đúng 1 kỳ nổ, trúng CẢ 3 hàng

    expect(damageEventsFor('enemy1')).toHaveLength(1)
    expect(damageEventsFor('enemy2')).toHaveLength(1)
    expect(damageEventsFor('enemy3')).toHaveLength(1)
    expect(battle.player.tuLucElapsed).toBeCloseTo(0, 5)
  })

  it('amp: mất 20% maxHP trong kỳ → phát quạt +20% damage (hệ số 1.0)', () => {
    // Control: không ai đụng tới Player trong kỳ tụ → damage nền, không amp.
    const control = setup(3)
    const controlPlayer = createPlayer({})
    // maxHp lớn để đòn quạt (kể cả bản amp) không giết chết quái giữa
    // chừng — chết thì currentHp bị clamp ở 0, che mất phần chênh amp.
    const controlEnemy = createCombatant({ id: 'enemy', row: 4, currentHp: 10_000, maxHp: 10_000 })

    control.system.start(controlPlayer, controlEnemy)
    control.system.update(3) // bỏ qua countdown

    const controlBefore = controlEnemy.currentHp

    control.system.update(3) // đúng 1 kỳ nổ, không amp

    const baseDamage = controlBefore - controlEnemy.currentHp

    expect(baseDamage).toBeGreaterThan(0)

    // Thí nghiệm: Player mất đúng 20% maxHP TRONG kỳ tụ hiện tại trước
    // khi kỳ đó nổ.
    const experiment = setup(3)
    const player = createPlayer({})
    const enemy = createCombatant({ id: 'enemy', row: 4, currentHp: 10_000, maxHp: 10_000 })

    experiment.system.start(player, enemy)
    experiment.system.update(3) // bỏ qua countdown

    experiment.combat.vitals.applyDamage(player, player.maxHp * 0.2, 'damage', enemy.id)

    expect(player.tuLucDamageTakenPercent).toBeCloseTo(0.2, 5)

    const before = enemy.currentHp

    experiment.system.update(3) // đúng 1 kỳ nổ, amp = +20%

    const ampDamage = before - enemy.currentHp

    expect(ampDamage).toBeGreaterThan(baseDamage * 1.19)
    // ampPercent reset về 0 sau khi kỳ đã nổ.
    expect(player.tuLucDamageTakenPercent).toBe(0)
  })

  it('chết/khống chế cứng cắt tụ: stun → tuLucActive=false, không tick tiếp', () => {
    const { system, vitalsEvents } = setup(3)

    const player = createPlayer({})
    const enemy = createCombatant({ id: 'enemy', row: 4 })

    system.start(player, enemy)

    const battle = system.getBattle()!

    system.update(3) // bỏ qua countdown

    expect(battle.player.tuLucActive).toBe(true)

    new AilmentSystem(battle.playerAilments).apply(
      ailments.find((template) => template.id === 'choang')!,
      enemy,
      player,
    )

    system.update(0.1)

    expect(battle.player.tuLucActive).toBe(false)
    expect(battle.player.tuLucElapsed).toBe(0)

    const damageEventsForEnemy = () =>
      vitalsEvents.filter((event) => event.entityId === 'enemy' && event.reason === 'damage')

    const countAfterInterrupt = damageEventsForEnemy().length

    // 10s đủ chờ hết Choáng (duration 1.5s) rồi thừa 1 kỳ 3s nữa —
    // channel VẪN không tự tái kích hoạt (spec: chỉ bật lại đầu trận mới).
    system.update(10)

    expect(damageEventsForEnemy()).toHaveLength(countAfterInterrupt)
    expect(battle.player.tuLucActive).toBe(false)
  })

  it('setChannelTickSeconds đổi nhịp từ kỳ tụ KẾ TIẾP', () => {
    const { system, vitalsEvents } = setup(3)

    const player = createPlayer({})
    const enemy = createCombatant({ id: 'enemy', row: 4 })

    system.start(player, enemy)
    system.update(3) // bỏ qua countdown

    system.setChannelTickSeconds('bat_kiem_thuat', 9)

    const damageEventsForEnemy = () =>
      vitalsEvents.filter((event) => event.entityId === 'enemy' && event.reason === 'damage')

    system.update(3) // nhịp cũ (3s) đã qua nhưng nhịp mới là 9s → CHƯA nổ

    expect(damageEventsForEnemy()).toHaveLength(0)

    system.update(6) // 3 + 6 = 9s → đủ nhịp mới, nổ đúng 1 lần

    expect(damageEventsForEnemy()).toHaveLength(1)
  })
})
