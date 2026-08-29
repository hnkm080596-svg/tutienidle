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
import { BuffManager } from '../buff/BuffManager'
import { AilmentManager } from '../ailment/AilmentManager'
import { HERO_COLUMN, HERO_LANE_INDEX } from './BattleLane'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'
import type { PlayerTeleportedEvent } from './BattleEvents'

// Teleport AI (plan §7): chỉ đổi ROW, column giữ HERO_COLUMN; ICD đúng
// 1 giây; không teleport khi đã có target trong range; event
// player_teleported phát TRƯỚC attack/cast cùng tick.
function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = {
    ...createBaseStats(),
    attack: 100,
    evasionRate: 0,
    dexterity: 0,
    attackSpeed: 1,
    movementSpeed: 0,
    attackRange: 1,
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
    x: 8,
    row: 2,
    alive: true,
    ...overrides,
  }
}

function createAttackSpeedSkill(): Skill {
  return {
    id: 'tp_test_skill',
    name: 'Teleport Test Skill',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 0,
    remainingCooldown: 0,
    cost: 0,
    target: 'enemy',
    effects: [{ type: 'damage', value: 1, damageType: 'physical' }],
    execution: { kind: 'attack_speed' },
    resourceType: 'none',
    unlocked: true,
    equipped: true,
    loadoutSlot: 0,
    loadoutSlots: [0],
  }
}

function setup() {
  const eventBus = new EventBus()
  const skillManager = new SkillManager()
  const skillSystem = new SkillSystem(skillManager)

  skillManager.add(createAttackSpeedSkill())

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

  const teleports: PlayerTeleportedEvent[] = []

  eventBus.on<PlayerTeleportedEvent>('player_teleported', (event) => teleports.push(event))

  function startWith(enemy: CombatEntity) {
    const player = createCombatant({ id: 'player', type: 'player', x: 0 })

    system.start(player, enemy)
    system.update(3) // Bỏ qua countdown + telegraph spawn.

    return system.getBattle()!
  }

  return { system, startWith, teleports }
}

describe('BattleSystem — Teleport AI (plan §7)', () => {
  it('KHÔNG teleport khi đã có target trong range hiện tại', () => {
    const { system, startWith, teleports } = setup()
    const battle = startWith(createCombatant({ id: 'enemy' }))

    // Quái ở ô kề avatar cùng hàng — trong tầm, không cần teleport.
    battle.enemies[0]!.entity.x = 2
    battle.enemies[0]!.entity.row = HERO_LANE_INDEX

    system.update(0.05)

    expect(battle.player.row).toBe(HERO_LANE_INDEX)
    expect(teleports).toHaveLength(0)
  })

  it('teleport đúng ROW của target khi giúp target vào range; column giữ HERO_COLUMN; event from/to đúng', () => {
    const { system, startWith, teleports } = setup()
    const battle = startWith(createCombatant({ id: 'enemy' }))

    const enemyRow = 9

    battle.enemies[0]!.entity.x = 2 // cột kề cổng — đủ gần theo cột
    battle.enemies[0]!.entity.row = enemyRow as never

    system.update(0.05)

    expect(battle.player.row).toBe(enemyRow)
    expect(battle.player.x).toBe(HERO_COLUMN)

    expect(teleports).toHaveLength(1)
    expect(teleports[0]!.sourceId).toBe('player')
    expect(teleports[0]!.from).toEqual({ row: HERO_LANE_INDEX, column: HERO_COLUMN })
    expect(teleports[0]!.to).toEqual({ row: enemyRow, column: HERO_COLUMN })
  })

  it('pre-position: teleport NGAY tới hàng quái kể cả khi quái còn xa theo cột (không đứng đợi)', () => {
    const { system, startWith, teleports } = setup()
    const battle = startWith(createCombatant({ id: 'enemy' }))

    battle.enemies[0]!.entity.x = 10 // cột 10 — chưa trong tầm base range 5
    battle.enemies[0]!.entity.row = 0 as never

    system.update(0.05)

    // Player đã đứng sẵn đúng hàng để đánh ngay khi quái đi vào tầm.
    expect(battle.player.row).toBe(0)
    expect(battle.player.x).toBe(HERO_COLUMN)
    expect(teleports).toHaveLength(1)
  })

  it('ICD đúng 1 giây: không teleport lần hai trong ICD nhưng VẪN cast được', () => {
    const { system, startWith, teleports } = setup()
    const battle = startWith(createCombatant({ id: 'enemy_a' }))

    // Teleport lần 1 tới hàng quái A.
    battle.enemies[0]!.entity.x = 2
    battle.enemies[0]!.entity.row = 0 as never

    system.update(0.05)

    expect(teleports).toHaveLength(1)
    expect(battle.playerTeleport.remainingSeconds).toBeGreaterThan(0.9)

    // Quái B xuất hiện ở hàng khác, cũng sát cổng — trong ICD thì KHÔNG
    // được teleport nốt.
    const second = createCombatant({ id: 'enemy_b', x: 2 })
    second.row = 8 as never

    battle.enemies.push({
      entity: second,
      attackTimer: 0,
      buffs: new BuffManager(),
      ailments: new AilmentManager(),
      rewardGranted: false,
    })

    system.update(0.05)

    expect(teleports).toHaveLength(1)
    expect(battle.player.row).toBe(0)

    // Trong ICD vẫn cast bình thường: quái A còn đứng trong tầm → cadence
    // chạy và gây damage (hp giảm).
    const hpBefore = battle.enemies[0]!.entity.currentHp

    system.update(1) // Hết ICD + vài nhịp cadence.

    expect(battle.playerTeleport.remainingSeconds).toBe(0)
    expect(battle.enemies[0]!.entity.currentHp).toBeLessThan(hpBefore)
  })

  it('strategy được tôn trọng: boss_first teleport tới hàng Boss thay vì quái thường gần hơn', () => {
    const bossRow = 8
    const mobRow = 1

    const boss = createCombatant({ id: 'boss', x: 2 })
    boss.row = bossRow as never
    boss.isBoss = true

    const mob = createCombatant({ id: 'mob', x: 2 })
    mob.row = mobRow as never

    const eventBus = new EventBus()
    const skillManager = new SkillManager()
    const skillSystem = new SkillSystem(skillManager)

    skillManager.add(createAttackSpeedSkill())

    const system = new BattleSystem(
      new CombatSystem(eventBus),
      skillManager,
      skillSystem,
      new SkillEffectSystem(),
      new BuffRegistry(),
      new AilmentRegistry(),
      eventBus,
      new ActionImpactSystem({ eventBus, rollCritical: () => false }),
      () => [],
      () => 'boss_first',
    )

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })

    system.start(player, boss)
    system.update(3) // Bỏ qua countdown — chuyển 'fighting' + materialize.

    const battle = system.getBattle()!

    // Materialize ghi đè vị trí từ resolver — đặt lại SAU để cả
    // hai đứng sát cổng ở hai hàng khác nhau.
    battle.enemies[0]!.entity.x = HERO_COLUMN + 1
    battle.enemies[0]!.entity.row = bossRow as never

    battle.enemies.push({
      entity: mob,
      attackTimer: 0,
      buffs: new BuffManager(),
      ailments: new AilmentManager(),
      rewardGranted: false,
    })

    system.update(0.05)

    // Cả hai đều cần teleport; strategy boss_first chọn hàng Boss.
    expect(battle.player.row).toBe(bossRow)
  })

  it('target đã cùng hàng → KHÔNG teleport lại: không emit event, không reset ICD (chống nhấp nháy)', () => {
    const { system, startWith, teleports } = setup()
    const battle = startWith(createCombatant({ id: 'enemy' }))

    // Quái ở hàng avatar (4) nhưng còn xa theo cột — pre-position đã xong
    // sẵn, các tick kế không được bắn event teleport nữa.
    battle.enemies[0]!.entity.x = 10
    battle.enemies[0]!.entity.row = HERO_LANE_INDEX

    for (let index = 0; index < 30; index++) {
      system.update(0.1)
    }

    expect(teleports).toHaveLength(0)
    expect(battle.playerTeleport.remainingSeconds).toBe(0)
    expect(battle.player.row).toBe(HERO_LANE_INDEX)
  })

  it('event player_teleported phát TRƯỚC cast/impact cùng tick', () => {
    const eventBus = new EventBus()
    const skillManager = new SkillManager()
    const skillSystem = new SkillSystem(skillManager)

    skillManager.add(createAttackSpeedSkill())

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

    const order: string[] = []

    eventBus.on<PlayerTeleportedEvent>('player_teleported', () => order.push('player_teleported'))
    eventBus.on('cast', () => order.push('cast'))
    eventBus.on('action_impact', () => order.push('action_impact'))

    const enemy = createCombatant({ id: 'enemy' })

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })

    system.start(player, enemy)
    system.update(3)

    // Materialize ghi đè vị trí — đặt lại sau để quái sát cổng hàng 6.
    system.getBattle()!.enemies[0]!.entity.x = HERO_COLUMN + 1
    system.getBattle()!.enemies[0]!.entity.row = 6 as never

    system.update(0.05)

    expect(order[0]).toBe('player_teleported')
  })
})
