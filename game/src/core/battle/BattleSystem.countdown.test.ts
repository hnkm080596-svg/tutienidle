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
import type { CombatEntity } from '../combat/CombatEntity'
import type { BattlePositionsEvent } from './BattleEvents'

// Countdown 3 giây trước trận (2026-08-22) — giống vạch xuất phát đua
// xe: quái đầu tiên đã spawn/hiển thị NGAY trong start(), nhưng
// movement/attack/spawn-tiếp-theo đóng băng cho tới khi đếm về 0.
function createBattleSystem(eventBus = new EventBus()) {
  const skillManager = new SkillManager()

  return new BattleSystem(
    new CombatSystem(eventBus),
    skillManager,
    new SkillSystem(skillManager),
    new SkillEffectSystem(),
    new BuffRegistry(),
    new AilmentRegistry(),
    eventBus,
    new ActionImpactSystem({ eventBus, rollCritical: () => false }),
  )
}

// attackSpeed đủ để bắn NGAY nếu combat logic thật sự chạy — dùng để
// phát hiện combat có bị đóng băng đúng trong lúc countdown hay không
// (nếu KHÔNG đóng băng, HP sẽ tụt/missile sẽ bắn ngay tick đầu).
// attackRange=60 (< ENEMY_SPAWN_X=400) để resolveMovement() TỰ kéo
// quái vào cả tầm đánh lẫn tầm nhìn (SCREEN_VISIBLE_MAX_X=350, xem
// BattleLane.ts) sau khi countdown kết thúc — không cần set tay x.
function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = {
    ...createBaseStats(),
    evasionRate: 0,
    dexterity: 0,
    attackSpeed: 1,
    attackRange: 60,
    movementSpeed: 60,
    attack: 100,
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

describe('BattleSystem — Countdown trước trận (2026-08-22)', () => {
  it('start() bắt đầu ở state "countdown", quái đầu tiên ở GIAI ĐOẠN TELEGRAPH (pendingEnemySpawns) rồi materialize trong countdown', () => {
    const system = createBattleSystem()
    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy' })

    system.start(player, enemy)

    const battle = system.getBattle()!

    expect(battle.state).toBe('countdown')
    expect(battle.countdownSecondsRemaining).toBe(3)

    // Luồng mới (2026-08-24): quái đầu tiên đi qua "telegraph → xuất
    // hiện" — CHƯA nằm trong battle.enemies ngay lập tức.
    expect(battle.enemies).toHaveLength(0)
    expect(battle.pendingEnemySpawns).toHaveLength(1)
    expect(battle.pendingEnemySpawns[0]!.entity.id).toBe('enemy')
    expect(battle.pendingEnemySpawns[0]!.position.column).toBeGreaterThan(0)

    // Telegraph 0.75s < 1s tick — materialize trong countdown, đứng yên
    // chờ trận bắt đầu (combat logic đóng băng).
    system.update(1)

    expect(battle.enemies).toHaveLength(1)
    expect(battle.enemies[0]!.entity.id).toBe('enemy')
    expect(battle.pendingEnemySpawns).toHaveLength(0)
  })

  it('trong lúc countdown, update() KHÔNG di chuyển quái/không bắn missile/không giảm attackTimer', () => {
    const eventBus = new EventBus()
    const system = createBattleSystem(eventBus)
    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy' })

    system.start(player, enemy)

    // Flush telegraph (0.75s) trước — quái materialize trong countdown.
    // 0.8 + 2 < 3s: vẫn còn countdown sau cả 2 lần update.
    system.update(0.8)

    const enemyXBeforeUpdate = system.getBattle()!.enemies[0]!.entity.x
    const attackTimerBefore = system.getBattle()!.enemies[0]!.attackTimer

    let attackFired = false

    eventBus.on<unknown>('attack', () => {
      attackFired = true
    })

    // 2 giây trong tổng 3 giây countdown — vẫn chưa đủ để flip 'fighting'.
    system.update(2)

    const battle = system.getBattle()!

    expect(battle.state).toBe('countdown')
    expect(battle.countdownSecondsRemaining).toBeCloseTo(3 - 2.8, 3)
    expect(battle.enemies[0]!.entity.x).toBe(enemyXBeforeUpdate)
    expect(battle.enemies[0]!.attackTimer).toBe(attackTimerBefore)
    expect(attackFired).toBe(false)
    expect(player.currentHp).toBe(player.maxHp)
  })

  it('vẫn emit "positions" liên tục trong countdown, snapshot có spawningEnemies progress tăng dần', () => {
    const eventBus = new EventBus()
    const system = createBattleSystem(eventBus)
    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy' })

    const snapshots: BattlePositionsEvent[] = []

    eventBus.on<BattlePositionsEvent>('positions', (event) => snapshots.push(event))

    system.start(player, enemy)

    const snapshotCountAfterStart = snapshots.length

    // Ngay sau start: telegraph trong snapshot với progress 0.
    expect(snapshots.at(-1)?.spawningEnemies).toHaveLength(1)
    expect(snapshots.at(-1)?.spawningEnemies?.[0]?.progress).toBe(0)

    system.update(0.4)
    const midProgress = snapshots.at(-1)?.spawningEnemies?.[0]?.progress ?? 0

    system.update(1)

    expect(snapshots.length).toBeGreaterThan(snapshotCountAfterStart)

    // Materialize xong (0.75s telegraph đã qua): id rời spawningEnemies,
    // enemy xuất hiện trong enemies của snapshot.
    expect(snapshots.at(-1)?.spawningEnemies ?? []).toHaveLength(0)
    expect(snapshots.at(-1)?.enemies).toHaveLength(1)
    expect(midProgress).toBeGreaterThan(0)
  })

  it('đủ 3 giây tích luỹ (nhiều tick nhỏ) → tự chuyển "fighting", combat logic chạy bình thường từ tick kế', () => {
    const eventBus = new EventBus()
    const system = createBattleSystem(eventBus)
    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy' })

    system.start(player, enemy)

    // 3 tick 1 giây (số tròn, tránh sai số dấu phẩy động tích luỹ khi
    // trừ dần nhiều lần) — countdown còn ở tick thứ 2 (còn 1s), hết
    // hẳn ở tick thứ 3.
    system.update(1)
    system.update(1)

    expect(system.getBattle()!.state).toBe('countdown')

    system.update(1)

    expect(system.getBattle()!.state).toBe('fighting')

    // Tick kế combat chạy bình thường — quái (đứng trong tầm, timer=0)
    // bắn missile ngay, player nhận damage.
    for (let i = 0; i < 100; i++) {
      system.update(0.1)
    }

    expect(player.currentHp).toBeLessThan(player.maxHp)
  })
})
