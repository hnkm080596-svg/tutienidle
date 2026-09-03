import { describe, expect, it } from 'vitest'
import {
  consumeTheForUlt,
  gainTheOnChainLink,
  isTheFull,
  THE_MAN_BUFF_PREFIX,
  theManBuffId,
  theMaxWithBonus,
  updateTheManBuff,
} from './TheResourceSystem'
import { MAX_THE } from '../combat/CombatTypes'
import type { CombatEntity } from '../combat/CombatEntity'
import type { SkillRuntimeStats } from '../skill/SkillRuntimeStats'
import { BuffPool } from '../buff/BuffPool'
import { BuffSystem } from '../buff/BuffSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { createBaseStats } from '../stats/StatBlock'

function playerWith(the?: number): CombatEntity {
  return { id: 'player', type: 'player', currentThe: the } as CombatEntity
}

// Spec 2026-08-30-phap-tu-dao-sac §2.3 + Pháp Tu Thuần Hệ E-7
// (2026-09-03) — Thế Thuần hệ: pool 0-100, +10/link (+20 E), tích xuyên
// kill trong phiên, chỉ reset khi bắn ult (đầy 100). Không decay theo
// thời gian. E-7: node bonus (theGainPerLinkBonus/theMaxBonus) đọc từ
// runtime stats skill A của chuỗi; buff the_man_<el> phản ánh trạng
// thái "Thế Mãn" (engine áp/gỡ theo id string — definition nằm ở
// data/buff, Task 9).
describe('Thế hệ thống (spec §2.3)', () => {
  it('+10 mỗi link thường, +20 finisher E', () => {
    const player = playerWith(0)

    gainTheOnChainLink(player, false)
    expect(player.currentThe).toBe(10)

    gainTheOnChainLink(player, true)
    expect(player.currentThe).toBe(30)
  })

  it('cap MAX_THE 100', () => {
    const player = playerWith(95)

    gainTheOnChainLink(player, true)
    expect(player.currentThe).toBe(MAX_THE)
    expect(MAX_THE).toBe(100)
  })

  it('consumeTheForUlt: đầy mới bắn, reset về 0', () => {
    const notFull = playerWith(99)
    expect(consumeTheForUlt(notFull)).toBe(false)
    expect(notFull.currentThe).toBe(99)

    const full = playerWith(100)
    expect(consumeTheForUlt(full)).toBe(true)
    expect(full.currentThe).toBe(0)
  })

  it('undefined coi như 0 (fixture khác path không cần set)', () => {
    const player = playerWith(undefined)

    gainTheOnChainLink(player, false)
    expect(player.currentThe).toBe(10)
  })
})

describe('E-7 — node bonus Thế (theGainPerLinkBonus / theMaxBonus)', () => {
  it('bonus +5/link → link 15, finisher 25', () => {
    const player = playerWith(0)

    gainTheOnChainLink(player, false, { theGainPerLinkBonus: 5 })
    expect(player.currentThe).toBe(15)

    gainTheOnChainLink(player, true, { theGainPerLinkBonus: 5 })
    expect(player.currentThe).toBe(40)
  })

  it('maxBonus +20 → cap 120; consume/isTheFull theo maxOverride', () => {
    const player = playerWith(115)

    gainTheOnChainLink(player, true, { theMaxBonus: 20 })
    expect(player.currentThe).toBe(120)

    expect(isTheFull(player, 120)).toBe(true)
    expect(consumeTheForUlt(player, 120)).toBe(true)
    expect(player.currentThe).toBe(0)
  })

  it('không bonus (stats undefined/0) → y hệt hiện tại', () => {
    const player = playerWith(95)

    gainTheOnChainLink(player, true, {})
    expect(player.currentThe).toBe(MAX_THE)

    expect(isTheFull(player)).toBe(true)
    expect(consumeTheForUlt(player)).toBe(true)
    expect(player.currentThe).toBe(0)
  })

  it('theMaxWithBonus: MAX_THE + theMaxBonus, undefined → MAX_THE', () => {
    expect(theMaxWithBonus(undefined)).toBe(MAX_THE)
    expect(theMaxWithBonus({ theMaxBonus: 20 })).toBe(120)
    expect(theMaxWithBonus({})).toBe(MAX_THE)
  })

  it('API-contract: bonus đọc từ THAM SỐ 3 skillAStats, không từ player.skillStats', () => {
    // Kênh duy nhất BattleSystem glue dùng (getSkillRuntimeStat ở phía
    // glue rồi truyền xuống) — chốt hợp đồng để glue Task 12 không
    // nhầm sang đọc thẳng entity.
    const viaParam = playerWith(0)
    gainTheOnChainLink(viaParam, false, { theGainPerLinkBonus: 5 })
    expect(viaParam.currentThe).toBe(15)

    const viaEntityOnly = {
      id: 'p2',
      type: 'player',
      currentThe: 0,
      skillStats: { theGainPerLinkBonus: 5 },
    } as CombatEntity
    gainTheOnChainLink(viaEntityOnly, false)
    expect(viaEntityOnly.currentThe).toBe(10)
  })
})

describe('E-7 — buff Thế Mãn (the_man_<el>)', () => {
  function makeHarness() {
    const pool = new BuffPool()
    const buffs = new BuffSystem(pool)
    const registry = new BuffRegistry()

    registry.register({
      id: 'the_man_fire',
      name: 'Thế Mãn (Hỏa)',
      polarity: 'buff',
      duration: Infinity,
      stackMode: 'refresh',
      effects: [],
    })

    const stats = { ...createBaseStats(), attack: 0, evasionRate: 0, dexterity: 0 }
    const player = {
      id: 'player',
      type: 'player',
      baseStats: stats,
      stats,
      currentHp: stats.maxHp,
      maxHp: stats.maxHp,
      alive: true,
    } as CombatEntity

    return { buffs, registry, player }
  }

  it('theManBuffId: prefix + element', () => {
    expect(THE_MAN_BUFF_PREFIX).toBe('the_man_')
    expect(theManBuffId('fire')).toBe('the_man_fire')
  })

  it('đạt Thế đầy → áp buff; chưa đầy/không có definition → không áp', () => {
    const { buffs, registry, player } = makeHarness()

    updateTheManBuff(buffs, registry, player, 'fire', 100, 100)
    expect(buffs.getActiveIds()).toContain('the_man_fire')

    updateTheManBuff(buffs, registry, player, 'fire', 50, 100)
    expect(buffs.getActiveIds()).not.toContain('the_man_fire')

    // Registry chưa đăng ký the_man_water (Task 9 data) → no-op, không crash.
    updateTheManBuff(buffs, registry, player, 'water', 100, 100)
    expect(buffs.getActiveIds()).not.toContain('the_man_water')
  })

  it('reset về 0 (ult) → gỡ buff', () => {
    const { buffs, registry, player } = makeHarness()

    updateTheManBuff(buffs, registry, player, 'fire', 100, 100)
    expect(buffs.getActiveIds()).toContain('the_man_fire')

    updateTheManBuff(buffs, registry, player, 'fire', 0, 100)
    expect(buffs.getActiveIds()).not.toContain('the_man_fire')
  })
})
