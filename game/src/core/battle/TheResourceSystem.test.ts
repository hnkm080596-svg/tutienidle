import { describe, expect, it } from 'vitest'
import { consumeTheForUlt, gainTheOnChainLink } from './TheResourceSystem'
import { MAX_THE } from '../combat/CombatTypes'
import type { CombatEntity } from '../combat/CombatEntity'

function playerWith(the?: number): CombatEntity {
  return { id: 'player', type: 'player', currentThe: the } as CombatEntity
}

// Spec 2026-08-30-phap-tu-dao-sac §2.3 — Thế Thuần hệ: pool 0-100,
// +10/link (+20 E), tích xuyên kill trong phiên, chỉ reset khi bắn
// ult (đầy 100). Không decay theo thời gian.
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
