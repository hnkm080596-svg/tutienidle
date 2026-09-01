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
import { HERO_COLUMN } from './BattleLane'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'
import type { EntityVitalsChangedEvent } from '../combat/EntityVitalsSystem'
import { MAX_KIEM_THE } from '../combat/CombatTypes'

// Kiếm Thế / Kiếm Ý (spec 2026-08-29-kiem-the-kiem-y mục 2/3.2/3.4) —
// wiring BattleSystem: gain Kiếm Thế khi cast kiếm trận, gain Kiếm Ý
// theo channel tick + dmg nhận, nerf BKT (base 0.6+0.02×tầng, amp
// 0.3), buff Kiếm Thế +1%/2 điểm, hấp thụ Huy Kiếm floor(casts/10).

function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = {
    ...createBaseStats(),
    attack: 0,
    defense: 0,
    evasionRate: 0,
    criticalRate: 0,
    blockChance: 0,
    dexterity: 0,
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
    currentSwordIntent: 0,
    currentKiemThe: 0,
    currentKiemYTemp: 0,
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

function createPlayer(overrides: Partial<CombatEntity>): CombatEntity {
  const player = createCombatant({ id: 'player', type: 'player', x: 0, ...overrides })
  player.stats.attack = 100
  return player
}

/** Kiếm trận fixture — attack_speed policy cho gain Kiếm Thế test. */
function createKiemTranSkill(id = 'kiem_tran_test', value = 10): Skill {
  return {
    id,
    name: id,
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 0,
    remainingCooldown: 0,
    cost: 0,
    target: 'enemy',
    // 'physical' tránh kích ReactionManager (element metal) — test này
    // đo wiring Kiếm Thế, không đo element pipeline (pattern batKiem
    // test cũ cùng chọn physical).
    effects: [{ type: 'damage', value, damageType: 'physical' }],
    execution: { kind: 'attack_speed', attackSpeedMultiplier: 1 },
    loadoutSlot: 0,
    loadoutSlots: [0],
    resourceType: 'none',
    unlocked: true,
    equipped: true,
  }
}

function createBatKiemThuat(tickSeconds = 3, value = 100): Skill {
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
    effects: [{ type: 'damage', value, damageType: 'physical' }],
    execution: { kind: 'channel', tickSeconds },
    loadoutSlot: 0,
    loadoutSlots: [0],
    resourceType: 'none',
    unlocked: true,
    equipped: true,
  }
}

interface SetupOptions {
  route: 'kiem_tran' | 'bat_kiem'
  kiemYPermanent?: number
  tramCasts?: number
  skill: Skill
}

function setup(opts: SetupOptions) {
  const eventBus = new EventBus()
  const skillManager = new SkillManager()
  const skillSystem = new SkillSystem(skillManager)
  const combat = new CombatSystem(eventBus)

  const system = new BattleSystem(
    combat,
    skillManager,
    skillSystem,
    new SkillEffectSystem(),
    new BuffRegistry(),
    eventBus,
    new ActionImpactSystem({ eventBus, rollCritical: () => false }),
    undefined,
    undefined,
    undefined,
    () => opts.route,
    () => opts.kiemYPermanent ?? 0,
    () => opts.tramCasts ?? 0,
  )

  skillManager.add(opts.skill)

  const vitalsEvents: EntityVitalsChangedEvent[] = []

  eventBus.on<EntityVitalsChangedEvent>('entity_vitals_changed', (event) => {
    vitalsEvents.push(event)
  })

  function tick(deltaSeconds: number) {
    skillSystem.update(deltaSeconds, 0)
    system.update(deltaSeconds)
  }

  return { system, combat, tick, skillManager, vitalsEvents, eventBus }
}

/** Quái trâu bì (maxHp đồng bộ cả 3 field: stats.maxHp/maxHp/currentHp). */
function makeTankEnemy(id: string, maxHp: number): CombatEntity {
  const enemy = createCombatant({ id })
  enemy.stats.maxHp = maxHp
  enemy.maxHp = maxHp
  enemy.currentHp = maxHp
  return enemy
}

/** Emit event vitals loss đầy đủ shape (helper tránh lặp 2 chỗ). */
function emitVitalsLoss(eventBus: EventBus, player: CombatEntity, maxHpPercentLost: number) {
  eventBus.emit<EntityVitalsChangedEvent>('entity_vitals_changed', {
    type: 'entity_vitals_changed',
    entityId: player.id,
    reason: 'damage',
    hpBefore: player.maxHp,
    hpAfter: player.maxHp * (1 - maxHpPercentLost),
    maxHp: player.maxHp,
    wardBefore: 0,
    wardAfter: 0,
    maxWard: 0,
    mpBefore: player.stats.maxMp,
    mpAfter: player.stats.maxMp,
    maxMp: player.stats.maxMp,
    amount: player.maxHp * maxHpPercentLost,
    killed: false,
  })
}

describe('BattleSystem — Kiếm Thế / Kiếm Ý wiring (spec 2026-08-29)', () => {
  it('init trận: route BK khởi đầu kiếm ý tạm = vĩnh viễn; route KT reset Kiếm Thế về 0', () => {
    const bk = setup({ route: 'bat_kiem', kiemYPermanent: 30, skill: createBatKiemThuat() })
    const bkPlayer = createPlayer({})
    bk.system.start(bkPlayer, createCombatant({ id: 'e1' }))
    expect(bkPlayer.currentKiemYTemp).toBe(30)

    const kt = setup({ route: 'kiem_tran', skill: createKiemTranSkill() })
    const ktPlayer = createPlayer({})
    ktPlayer.currentKiemThe = 50
    kt.system.start(ktPlayer, createCombatant({ id: 'e1' }))
    expect(ktPlayer.currentKiemThe).toBe(0)
    expect(ktPlayer.currentKiemYTemp).toBe(0)
  })

  it('route KT: mỗi cast kiếm trận +số kiếm (theo TRAN lookup), cap 100', () => {
    // Skill id 'kiem_tran_luong_nghi' → TRAN_SEQUENCE swordCount = 2
    const { system } = setup({
      route: 'kiem_tran',
      skill: createKiemTranSkill('kiem_tran_luong_nghi', 10),
    })

    const player = createPlayer({})
    player.stats.attackSpeed = 10
    player.stats.attackRange = 999999
    const enemy = makeTankEnemy('enemy', 100000)

    system.start(player, enemy)
    system.flushPendingSpawns()
    enemy.x = HERO_COLUMN
    system.update(3) // qua countdown

    const before = player.currentKiemThe ?? 0
    system.update(0.2)
    expect((player.currentKiemThe ?? 0) - before).toBe(2)
  })

  it('route BK: mỗi channel tick +1 kiếm ý tạm (cap vĩnh viễn + 900)', () => {
    const { system, tick } = setup({ route: 'bat_kiem', kiemYPermanent: 10, skill: createBatKiemThuat(3) })

    const player = createPlayer({})
    const enemy = makeTankEnemy('e1', 100000)

    system.start(player, enemy)
    expect(player.currentKiemYTemp).toBe(10)

    tick(3) // countdown
    tick(3) // 1 channel tick
    expect(player.currentKiemYTemp).toBe(11)
  })

  it('route BK: nhận sát thương +kiếm ý tạm (1 mỗi 5% maxHP)', () => {
    const { system, eventBus } = setup({ route: 'bat_kiem', kiemYPermanent: 10, skill: createBatKiemThuat(3) })
    const player = createPlayer({})
    system.start(player, createCombatant({ id: 'e1' }))

    // Giả lập nhận 12% maxHP qua event vitals (pattern onEntityVitalsChanged)
    emitVitalsLoss(eventBus, player, 0.12)
    expect(player.currentKiemYTemp).toBe(12)
  })

  it('nerf BKT: amp dmg-taken ×0.3 (không còn ×1.0), tier 0 base 60%', () => {
    const { system, tick, eventBus } = setup({ route: 'bat_kiem', kiemYPermanent: 0, skill: createBatKiemThuat(3, 1) })

    const player = createPlayer({})
    const enemy = makeTankEnemy('e1', 1000000)

    system.start(player, enemy)
    tick(3) // countdown

    // Nhận 10% maxHP damage trong lúc tụ lực → tuLucDamageTakenPercent = 0.1
    emitVitalsLoss(eventBus, player, 0.1)
    expect(player.tuLucDamageTakenPercent).toBeCloseTo(0.1, 5)

    const enemyHpBefore = enemy.currentHp
    tick(3) // 1 channel tick
    const dealt = enemyHpBefore - enemy.currentHp

    // Pipeline thật: dmg = attack(100) × value(1) × (1+amp 0.1×0.3
    // =0.03) × tier(0.6) ≈ 61.8 — có regen enemy nhiễu nhẹ → [55, 64].
    expect(dealt).toBeGreaterThanOrEqual(55)
    expect(dealt).toBeLessThanOrEqual(64)
  })

  it('hấp thụ Huy Kiếm: BKT value 0 + 1000 tram casts → tick ×(0 + 100/attack 100 × 0.6)', () => {
    const { system, tick } = setup({ route: 'bat_kiem', kiemYPermanent: 0, tramCasts: 1000, skill: createBatKiemThuat(3, 0) })

    const player = createPlayer({})
    const enemy = makeTankEnemy('e1', 10000000)

    system.start(player, enemy)
    tick(3) // countdown
    const hpBefore = enemy.currentHp
    tick(3) // 1 channel tick

    const dealt = hpBefore - enemy.currentHp
    // Pipeline: dmg = attack(100) × (value 0 + floor(1000/10)=100
    // multiplier hấp thụ) × 0.6 tier ≈ 6000 — assert [5500, 6500].
    expect(dealt).toBeGreaterThanOrEqual(5500)
    expect(dealt).toBeLessThanOrEqual(6500)
  })

  it('buff Kiếm Thế: KT có 100 kiếm thế → sát thương trận +50%', () => {
    const { system } = setup({ route: 'kiem_tran', skill: createKiemTranSkill('kiem_tran_luong_nghi', 1) })

    const player = createPlayer({})
    player.stats.attackSpeed = 10
    player.stats.attackRange = 999999
    const enemy = makeTankEnemy('enemy', 10000000)

    system.start(player, enemy)
    system.flushPendingSpawns()
    enemy.x = HERO_COLUMN
    system.update(3)

    // Cast 1 lần không buff (kiếm thế = 2 sau cast đầu)
    const hpBefore1 = enemy.currentHp
    system.update(0.5)
    expect(Number.isFinite(enemy.currentHp)).toBe(true)
    const dealt1 = hpBefore1 - enemy.currentHp
    expect(dealt1).toBeGreaterThan(0)

    // Đầy Kiếm Thế
    player.currentKiemThe = MAX_KIEM_THE
    const hpBefore2 = enemy.currentHp
    system.update(0.5)
    expect(Number.isFinite(enemy.currentHp)).toBe(true)
    const dealt2 = hpBefore2 - enemy.currentHp

    // dealt2 phải lớn hơn dealt1 đáng kể (buff 50%) — tỷ lệ > 1.3
    expect(dealt2).toBeGreaterThan(dealt1 * 1.3)
  })
})
