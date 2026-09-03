import { describe, expect, it, vi } from 'vitest'
import {
  autoPhapTuUltimateDecision,
  canUsePhapTuUltimate,
  PHAP_TU_ULTIMATE_IDS,
  PHAP_TU_ULTIMATE_PROFILES,
  triggerPhapTuUltimate,
} from './UltimateSystem'
import { MAX_THE } from '../combat/CombatTypes'
import type { Battle } from './Battle'
import type { CombatEntity } from '../combat/CombatEntity'
import type { SkillRuntimeStats } from '../skill/SkillRuntimeStats'
import type { Skill } from '../skill/Skill'
import { BuffPool } from '../buff/BuffPool'
import { BuffSystem } from '../buff/BuffSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { createBaseStats } from '../stats/StatBlock'

// Spec 2026-08-30-phap-tu-dao-sac §2.4 — ult Thuần hệ mở khi Thế đầy
// 100, auto-AI bắn khi boss active + Thế đầy, KHÔNG chiếm loadout slot.
// Fixture theo pattern UltimateSystem.test.ts hiện có.
// Task 10 (spec 2026-09-03 §3) — id ult mới thay placeholder cũ.
function makeEntity(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), attack: 10, evasionRate: 0, dexterity: 0 }

  return {
    id: 'entity',
    name: 'entity',
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
  } as CombatEntity
}

function makeBattle(
  opts: { the?: number; boss?: boolean; state?: Battle['state']; skillStats?: Partial<SkillRuntimeStats> } = {},
): Battle {
  const player = makeEntity({
    id: 'player',
    type: 'player',
    currentThe: opts.the,
    skillStats: opts.skillStats as SkillRuntimeStats | undefined,
  })
  const enemy = makeEntity({
    id: 'enemy',
    isBoss: opts.boss === true,
  })

  return {
    state: opts.state ?? 'fighting',
    player,
    playerBuffs: new BuffPool(),
    enemies: [{ entity: enemy } as Battle['enemies'][number]],
  } as unknown as Battle
}

function makeMultiEnemyBattle(
  the: number,
  enemies: Array<{ id: string; isBoss?: boolean; hp?: number; alive?: boolean }>,
): Battle {
  const player = makeEntity({ id: 'player', type: 'player', currentThe: the })

  return {
    state: 'fighting',
    player,
    playerBuffs: new BuffPool(),
    enemies: enemies.map(
      (e) =>
        ({
          entity: makeEntity({
            id: e.id,
            isBoss: e.isBoss === true,
            currentHp: e.hp ?? 100,
            alive: e.alive ?? true,
          }),
        }) as Battle['enemies'][number],
    ),
  } as unknown as Battle
}

function makeUltSkill(id: string): Skill {
  return {
    id,
    name: id,
    type: 'active',
    level: 1,
    maxLevel: 5,
    cooldown: 0,
    remainingCooldown: 0,
    castTime: 1.5,
    execution: { kind: 'cast_time', castTime: 1.5 },
    target: 'enemy',
    effects: [{ type: 'damage', value: 4 }],
    resourceType: 'none',
    unlocked: false,
    equipped: false,
  } as unknown as Skill
}

describe('Pháp Tu ult theo Thế (spec §2.4)', () => {
  it('PHAP_TU_ULTIMATE_IDS đủ 5 hành đúng id', () => {
    expect(PHAP_TU_ULTIMATE_IDS).toEqual({
      fire: 'tat_phuong_giang_the',
      water: 'bat_thu_can_quet',
      wood: 'kien_moc_thong_thien',
      metal: 'kim_phat_thu_sat',
      earth: 'hau_tho_thanh_luy',
    })
  })

  it('canUsePhapTuUltimate: Thế < MAX_THE → false; = MAX_THE → true', () => {
    expect(canUsePhapTuUltimate(makeBattle({ the: MAX_THE - 1 }))).toBe(false)
    expect(canUsePhapTuUltimate(makeBattle({ the: MAX_THE }))).toBe(true)
  })

  it('auto: boss active + Thế đầy → element; thiếu 1 trong 2 → null', () => {
    expect(autoPhapTuUltimateDecision(makeBattle({ the: MAX_THE, boss: true }), 'fire')).toBe('fire')
    expect(autoPhapTuUltimateDecision(makeBattle({ the: MAX_THE, boss: false }), 'fire')).toBeNull()
    expect(autoPhapTuUltimateDecision(makeBattle({ the: 50, boss: true }), 'fire')).toBeNull()
    expect(autoPhapTuUltimateDecision(makeBattle({ the: 50, boss: false }), 'fire')).toBeNull()
  })

  it('auto: không bắn khi trận không fighting hoặc player chết', () => {
    expect(
      autoPhapTuUltimateDecision(makeBattle({ the: MAX_THE, boss: true, state: 'countdown' }), 'fire'),
    ).toBeNull()

    const deadPlayerBattle = makeBattle({ the: MAX_THE, boss: true })
    deadPlayerBattle.player.alive = false
    expect(autoPhapTuUltimateDecision(deadPlayerBattle, 'fire')).toBeNull()
  })

  it('triggerPhapTuUltimate: đầy → tiêu Thế về 0 + nuke mọi địch sống; chưa đầy → false giữ nguyên', () => {
    const notFull = makeBattle({ the: 50 })
    expect(triggerPhapTuUltimate(notFull, { resolveNuke: () => 100 })).toBe(false)
    expect(notFull.player.currentThe).toBe(50)

    const full = makeBattle({ the: MAX_THE })
    let nukeCount = 0
    expect(
      triggerPhapTuUltimate(full, {
        resolveNuke: () => {
          nukeCount += 1
          return 100
        },
      }),
    ).toBe(true)
    expect(full.player.currentThe).toBe(0)
    expect(nukeCount).toBe(1)
  })

  it('trigger bỏ qua địch đã chết', () => {
    const battle = makeBattle({ the: MAX_THE })
    const dead = makeEntity({ id: 'dead', alive: false })
    battle.enemies.push({ entity: dead } as Battle['enemies'][number])

    let nukeCount = 0
    triggerPhapTuUltimate(battle, {
      resolveNuke: () => {
        nukeCount += 1
        return 100
      },
    })

    expect(nukeCount).toBe(1)
  })

  // E-7 (2026-09-03) — gate ult đọc TRẦN có bonus từ player.skillStats
  // (theMaxBonus — cùng nguồn skill A mà BattleSystem glue dùng); trigger
  // reset Thế về 0 ĐỒNG THỜI gỡ buff the_man_<el> (element = ult vừa bắn).
  it('E-7: canUse với theMaxBonus — 100 chưa đủ khi cap 120, 120 thì đủ', () => {
    const withBonus = makeBattle({ the: 100, skillStats: { theMaxBonus: 20 } })
    expect(canUsePhapTuUltimate(withBonus)).toBe(false)

    const atCap = makeBattle({ the: 120, skillStats: { theMaxBonus: 20 } })
    expect(canUsePhapTuUltimate(atCap)).toBe(true)
  })

  it('E-7: trigger thành công → gỡ buff the_man_<el> theo ult id', () => {
    const battle = makeBattle({ the: MAX_THE })
    const registry = new BuffRegistry()

    registry.register({
      id: 'the_man_fire',
      name: 'Thế Mãn (Hỏa)',
      polarity: 'buff',
      duration: Infinity,
      stackMode: 'refresh',
      effects: [],
    })

    const buffs = new BuffSystem(battle.playerBuffs)
    buffs.apply(registry.get('the_man_fire'), battle.player, battle.player, registry)
    expect(buffs.getActiveIds()).toContain('the_man_fire')

    expect(triggerPhapTuUltimate(battle, { resolveNuke: () => 100 }, 'fire')).toBe(true)
    expect(battle.player.currentThe).toBe(0)
    expect(buffs.getActiveIds()).not.toContain('the_man_fire')
  })

  it('E-7: trigger không element → vẫn reset Thế, không crash', () => {
    const battle = makeBattle({ the: MAX_THE })
    expect(triggerPhapTuUltimate(battle, { resolveNuke: () => 100 })).toBe(true)
    expect(battle.player.currentThe).toBe(0)
  })
})

// E-6 (plan 2026-09-03-thuan-he Task 8) — 5 ult Thuần KHÔNG còn nuke
// đồng nhất: trigger resolve EFFECTS của skill ult qua callback
// runUltimateEffects (GameManager glue Task 12 build ctx đủ như skill
// thường); profile per-element quyết target set: 'all' = mọi địch sống,
// 'single_boss_priority' (Kim) = boss trước, không boss → HP cao nhất,
// ĐÚNG 1 target, không splash overkill (khác KKTM).
describe('Pháp Tu ult E-6 — profiles per-element + effect-driven resolution', () => {
  it('PHAP_TU_ULTIMATE_PROFILES: metal single_boss_priority, 4 hành kia all', () => {
    expect(PHAP_TU_ULTIMATE_PROFILES).toEqual({
      fire: 'all',
      water: 'all',
      wood: 'all',
      metal: 'single_boss_priority',
      earth: 'all',
    })
  })

  it('trigger chạy effects skill ult qua runUltimateEffects (không raw nuke)', () => {
    const battle = makeBattle({ the: MAX_THE })
    const skill = makeUltSkill('tat_phuong_giang_the')
    const runUltimateEffects = vi.fn()

    expect(
      triggerPhapTuUltimate(battle, { resolveNuke: () => 100 }, 'fire', {
        getUltSkill: () => skill,
        runUltimateEffects,
      }),
    ).toBe(true)

    expect(runUltimateEffects).toHaveBeenCalledTimes(1)
    expect(runUltimateEffects).toHaveBeenCalledWith(skill, battle.player, [battle.enemies[0]!.entity])
  })

  it('profile all: resolve MỘT lần với MỌI địch còn sống (all_lanes do targeting skill lo)', () => {
    const battle = makeMultiEnemyBattle(MAX_THE, [
      { id: 'e1' },
      { id: 'e2', alive: false },
      { id: 'e3' },
    ])
    const runUltimateEffects = vi.fn()

    expect(
      triggerPhapTuUltimate(battle, { resolveNuke: () => 100 }, 'fire', {
        getUltSkill: () => makeUltSkill('tat_phuong_giang_the'),
        runUltimateEffects,
      }),
    ).toBe(true)

    expect(runUltimateEffects).toHaveBeenCalledTimes(1)
    const [, source, targets] = runUltimateEffects.mock.calls[0]!
    expect(source).toBe(battle.player)
    expect((targets as CombatEntity[]).map((t) => t.id)).toEqual(['e1', 'e3'])
  })

  it('Kim Phạt single_boss_priority: ĐÚNG 1 target là boss, không splash', () => {
    const battle = makeMultiEnemyBattle(MAX_THE, [
      { id: 'e1', hp: 500 },
      { id: 'boss', isBoss: true, hp: 100 },
      { id: 'e3', hp: 300 },
    ])
    const runUltimateEffects = vi.fn()

    expect(
      triggerPhapTuUltimate(battle, { resolveNuke: () => 100 }, 'metal', {
        getUltSkill: () => makeUltSkill('kim_phat_thu_sat'),
        runUltimateEffects,
      }),
    ).toBe(true)

    expect(runUltimateEffects).toHaveBeenCalledTimes(1)
    const [, , targets] = runUltimateEffects.mock.calls[0]!
    expect((targets as CombatEntity[]).map((t) => t.id)).toEqual(['boss'])
  })

  it('Kim Phạt không boss: chọn HP HIỆN TẠI cao nhất (không theo maxHp)', () => {
    const battle = makeMultiEnemyBattle(MAX_THE, [
      { id: 'e1', hp: 900 },
      { id: 'e2', hp: 1000 },
      { id: 'e3', hp: 10 },
    ])
    const runUltimateEffects = vi.fn()

    triggerPhapTuUltimate(battle, { resolveNuke: () => 100 }, 'metal', {
      getUltSkill: () => makeUltSkill('kim_phat'),
      runUltimateEffects,
    })

    expect(runUltimateEffects).toHaveBeenCalledTimes(1)
    const [, , targets] = runUltimateEffects.mock.calls[0]!
    expect((targets as CombatEntity[]).map((t) => t.id)).toEqual(['e2'])
  })

  it('Kim Phạt: không có địch sống → không resolve, vẫn tiêu Thế, trả true', () => {
    const battle = makeMultiEnemyBattle(MAX_THE, [{ id: 'e1', alive: false }])
    const runUltimateEffects = vi.fn()

    expect(
      triggerPhapTuUltimate(battle, { resolveNuke: () => 100 }, 'metal', {
        getUltSkill: () => makeUltSkill('kim_phat_thu_sat'),
        runUltimateEffects,
      }),
    ).toBe(true)

    expect(battle.player.currentThe).toBe(0)
    expect(runUltimateEffects).not.toHaveBeenCalled()
  })

  it('không deps (caller cũ) → fallback nuke AoE mọi địch sống', () => {
    const battle = makeMultiEnemyBattle(MAX_THE, [{ id: 'e1' }, { id: 'e2', alive: false }, { id: 'e3' }])
    const nuked: string[] = []
    const resolveNuke = vi.fn((target: CombatEntity) => {
      nuked.push(target.id)
      return 100
    })

    expect(triggerPhapTuUltimate(battle, { resolveNuke }, 'fire')).toBe(true)
    expect(resolveNuke).toHaveBeenCalledTimes(2)
    expect(nuked).toEqual(['e1', 'e3'])
  })

  it('không deps + metal → fallback nuke ĐÚNG 1 target (boss ưu tiên), không splash', () => {
    const battle = makeMultiEnemyBattle(MAX_THE, [
      { id: 'e1', hp: 500 },
      { id: 'boss', isBoss: true, hp: 100 },
      { id: 'e3', hp: 300 },
    ])
    const nuked: string[] = []
    const resolveNuke = vi.fn((target: CombatEntity) => {
      nuked.push(target.id)
      return 100
    })

    expect(triggerPhapTuUltimate(battle, { resolveNuke }, 'metal')).toBe(true)
    expect(resolveNuke).toHaveBeenCalledTimes(1)
    expect(nuked).toEqual(['boss'])
  })

  it('deps nhưng skill ult chưa đăng ký → không resolve, vẫn tiêu Thế, trả true', () => {
    const battle = makeBattle({ the: MAX_THE })
    const runUltimateEffects = vi.fn()

    expect(
      triggerPhapTuUltimate(battle, { resolveNuke: () => 100 }, 'fire', {
        getUltSkill: () => undefined,
        runUltimateEffects,
      }),
    ).toBe(true)

    expect(battle.player.currentThe).toBe(0)
    expect(runUltimateEffects).not.toHaveBeenCalled()
  })
})
