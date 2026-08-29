import { describe, expect, it } from 'vitest'
import {
  autoUltimateDecision,
  canUseUltimate,
  KIEM_Y_KKTM_AUTO_THRESHOLD,
  KIEM_THE_PER_ULT_SWORD,
  triggerUltimate,
} from './UltimateSystem'
import type { Battle } from './Battle'
import type { CombatEntity } from '../combat/CombatEntity'
import { createBaseStats } from '../stats/StatBlock'
import type { Enemy } from '../enemy/Enemy'

// Ult Kiếm Tu (spec 2026-08-29-kiem-the-kiem-y mục 2/3.4):
// TTKT — nuke AoE + zone 6s, cost 10×số kiếm trận, manual + auto.
// KKTM — đốt TOÀN BỘ kiếm ý tạm (giữ vĩnh viễn), đơn mục tiêu ưu
// tiên boss, overkill tràn 50% chia đều còn sống, auto khi boss +
// kiếm ý tạm ≥ 500.

function makeEntity(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats() }
  return {
    id: 'player',
    name: 'P',
    type: 'player',
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
  } as CombatEntity
}

function makeEnemy(id: string, isBoss: boolean, hp = 100000): Enemy {
  const stats = { ...createBaseStats(), maxHp: hp, attack: 0 }
  const entity = makeEntity({
    id,
    type: 'enemy',
    stats,
    baseStats: stats,
    currentHp: hp,
    maxHp: hp,
    isBoss,
  })
  return {
    entity,
    buffs: new Map(),
    ailments: new Map(),
    archetype: 'melee' as const,
    materializingId: undefined,
    spawnVfxPreset: undefined,
    enrageApplied: false,
  } as unknown as Enemy
}

function makeBattle(opts: {
  kiemThe?: number
  kiemYTemp?: number
  kiemYPermanent?: number
  hasBoss?: boolean
  enemies?: Array<{ id: string; isBoss: boolean; hp?: number; alive?: boolean }>
}): Battle {
  const player = makeEntity({ currentKiemThe: opts.kiemThe ?? 0, currentKiemYTemp: opts.kiemYTemp ?? 0 })

  const enemies = (opts.enemies ?? [{ id: 'e1', isBoss: false }]).map((e) =>
    makeEnemy(e.id, e.isBoss, e.hp ?? 100000),
  )

  return {
    id: 'battle',
    player,
    enemies,
    state: 'fighting',
    mode: 'stage',
    countdownSecondsRemaining: 0,
    playerTeleport: { remainingSeconds: 0 },
    pendingPlayerSpawn: undefined as never,
    playerMaterialized: true,
    playerBuffs: undefined as never,
    playerAilments: undefined as never,
    elapsedSeconds: 10,
    pendingSummons: [],
    lavaZones: [],
    swordZones: [],
    pendingEnemySpawns: [],
    nextSkillSlotIndexCursor: 0,
    artifactRuntime: undefined,
  } as unknown as Battle
}

describe('UltimateSystem — Tru Tiên Kiếm Trận (route Kiếm Trận)', () => {
  it('cost = 10 × số kiếm trận hiện có (Lưỡng Nghi 2 kiếm → 20)', () => {
    expect(KIEM_THE_PER_ULT_SWORD).toBe(10)
  })

  it('canUseUltimate TTKT: 0 kiếm thế → false (resource); đủ → true', () => {
    const empty = canUseUltimate(makeBattle({ kiemThe: 19 }), 'kiem_tran', 2)
    expect(empty.ok).toBe(false)
    expect(empty.reason).toBe('resource')

    const full = canUseUltimate(makeBattle({ kiemThe: 20 }), 'kiem_tran', 2)
    expect(full.ok).toBe(true)
  })

  it('triggerUltimate TTKT: consume kiếm thế, đặt sword zone 6 tick', () => {
    const battle = makeBattle({ kiemThe: 30 })
    const ok = triggerUltimate(battle, 'kiem_tran', 2, { resolveNuke: () => 500 })
    expect(ok).toBe(true)
    expect(battle.player.currentKiemThe).toBe(30 - 20)
    expect(battle.swordZones.length).toBe(1)
    expect(battle.swordZones[0]!.remainingCharges).toBe(6)
    expect(battle.swordZones[0]!.tickInterval).toBe(1)
  })

  it('auto TTKT: đủ cost là auto (không cần boss)', () => {
    expect(autoUltimateDecision(makeBattle({ kiemThe: 20 }), 'kiem_tran', 2)).toBe('ttkt')
    expect(autoUltimateDecision(makeBattle({ kiemThe: 10 }), 'kiem_tran', 3)).toBe(null)
  })
})

describe('UltimateSystem — Kiếm Khai Thiên Môn (route Bạt Kiếm)', () => {
  it('canUseUltimate KKTM: kiếm ý tạm 0 → false; > 0 → true (manual chỉ cần >0)', () => {
    const empty = canUseUltimate(makeBattle({ kiemYTemp: 0 }), 'bat_kiem', 0)
    expect(empty.ok).toBe(false)

    const some = canUseUltimate(makeBattle({ kiemYTemp: 10 }), 'bat_kiem', 0)
    expect(some.ok).toBe(true)
  })

  it('triggerUltimate KKTM: đốt TOÀN BỘ kiếm ý tạm, giữ vĩnh viễn (đã nằm ngoài pool)', () => {
    const battle = makeBattle({ kiemYTemp: 500, kiemYPermanent: 50 })
    const ok = triggerUltimate(battle, 'bat_kiem', 0, { resolveNuke: () => 12345 })
    expect(ok).toBe(true)
    expect(battle.player.currentKiemYTemp).toBe(0)
  })

  it('auto KKTM: cần boss trong trận VÀ kiếm ý tạm ≥ 500', () => {
    expect(KIEM_Y_KKTM_AUTO_THRESHOLD).toBe(500)

    // Không boss dù đủ pool → null
    expect(autoUltimateDecision(makeBattle({ kiemYTemp: 900 }), 'bat_kiem', 0)).toBe(null)
    // Có boss + đủ → 'kktm'
    const withBoss = makeBattle({ kiemYTemp: 600, enemies: [{ id: 'boss1', isBoss: true }] })
    expect(autoUltimateDecision(withBoss, 'bat_kiem', 0)).toBe('kktm')
    // Có boss nhưng pool thấp → null
    const lowPool = makeBattle({ kiemYTemp: 100, enemies: [{ id: 'boss1', isBoss: true }] })
    expect(autoUltimateDecision(lowPool, 'bat_kiem', 0)).toBe(null)
  })

  it('overkill tràn: dmg dư phân 50% chia đều địch còn sống', () => {
    // Target boss 1000 HP, nuke 5000 → dư 4000 → 2000 chia 2 quái = 1000 mỗi con
    const battle = makeBattle({
      kiemYTemp: 500,
      enemies: [
        { id: 'boss1', isBoss: true, hp: 1000 },
        { id: 'e2', isBoss: false, hp: 100000 },
        { id: 'e3', isBoss: false, hp: 100000 },
      ],
    })

    const ok = triggerUltimate(battle, 'bat_kiem', 0, {
      resolveNuke: (target) => {
        // Resolver pipeline trả TỔNG damage đã tính (5000) — phần vượt
        // HP target chính là overkill.
        target.currentHp = 0
        target.alive = false
        return 5000
      },
    })
    expect(ok).toBe(true)

    // boss chết; e2/e3 mỗi con nhận (5000-1000)×50%/2 = 1000
    const splashReceiver = battle.enemies.find((e) => e.entity.id === 'e2')!
    expect(100000 - splashReceiver.entity.currentHp).toBeCloseTo(1000, 5)
  })
})
