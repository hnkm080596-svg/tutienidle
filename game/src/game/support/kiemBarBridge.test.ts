// 9.4 — coverage TRỰC TIẾP cho makeKiemBarReader (logic mapping
// battle/player → KiemBarSnapshot). CombatScene.hudWiring.test.ts chỉ
// test poll plumbing với reader mock; file này test chính hàm mapping
// bằng fake gameManager/player state (structural, không Pinia/Phaser).
import { describe, expect, it } from 'vitest'
import { MAX_KIEM_THE } from '@/core/combat/CombatTypes'
import { kiemYTempMaxFor } from '@/core/battle/KiemTuResourceSystem'
import type { Battle } from '@/core/battle/Battle'
import type { BattleState } from '@/core/battle/BattleTypes'
import type { GameManager } from '@/core/game/GameManager'
import {
  KIEM_BAR_READER_KEY,
  makeKiemBarReader,
  readKiemBar,
  registerKiemBarReader,
  type KiemBarPlayerState,
} from './kiemBarBridge'

function fakeBattle(
  state: BattleState,
  player: { currentKiemThe?: number; currentKiemYTemp?: number },
): Battle {
  return { state, player } as unknown as Battle
}

function makeReader(battle: Battle | null, player: KiemBarPlayerState) {
  const gameManager = { getBattle: () => battle } as unknown as GameManager

  return makeKiemBarReader(gameManager, () => player)
}

describe('makeKiemBarReader — 9.4 Kiếm bar mapping', () => {
  it('route kiem_tran + currentKiemThe=30, battle fighting → {30, MAX_KIEM_THE, "Kiếm Thế"}', () => {
    const reader = makeReader(
      fakeBattle('fighting', { currentKiemThe: 30 }),
      { kiemTuRoute: 'kiem_tran', bossKillCount: 0 },
    )

    expect(reader()).toEqual({ current: 30, max: MAX_KIEM_THE, label: 'Kiếm Thế' })
  })

  it('route bat_kiem + temp=20 + bossKillCount 25 (permanent 20, tier 2) → {40, kiemYTempMaxFor(20), "Kiếm Ý T.2"}', () => {
    const reader = makeReader(
      fakeBattle('fighting', { currentKiemYTemp: 20 }),
      { kiemTuRoute: 'bat_kiem', bossKillCount: 25 },
    )

    expect(reader()).toEqual({ current: 40, max: kiemYTempMaxFor(20), label: 'Kiếm Ý T.2' })
  })

  it('state countdown vẫn tính đang trong trận → trả snapshot', () => {
    const reader = makeReader(
      fakeBattle('countdown', { currentKiemThe: 5 }),
      { kiemTuRoute: 'kiem_tran', bossKillCount: 0 },
    )

    expect(reader()).toEqual({ current: 5, max: MAX_KIEM_THE, label: 'Kiếm Thế' })
  })

  it('field optional thiếu (currentKiemThe undefined) → current 0', () => {
    const reader = makeReader(
      fakeBattle('fighting', {}),
      { kiemTuRoute: 'kiem_tran', bossKillCount: 0 },
    )

    expect(reader()).toEqual({ current: 0, max: MAX_KIEM_THE, label: 'Kiếm Thế' })
  })

  it('bat_kiem thiếu currentKiemYTemp → current = permanent (tier 1: bossKillCount 10 → 10)', () => {
    const reader = makeReader(
      fakeBattle('fighting', {}),
      { kiemTuRoute: 'bat_kiem', bossKillCount: 10 },
    )

    expect(reader()).toEqual({ current: 10, max: kiemYTempMaxFor(10), label: 'Kiếm Ý T.1' })
  })

  it('không có battle → null', () => {
    const reader = makeReader(null, { kiemTuRoute: 'kiem_tran', bossKillCount: 0 })

    expect(reader()).toBeNull()
  })

  it('battle không diễn ra (victory/defeat/idle) → null', () => {
    for (const state of ['victory', 'defeat', 'idle'] as const) {
      const reader = makeReader(
        fakeBattle(state, { currentKiemThe: 30 }),
        { kiemTuRoute: 'kiem_tran', bossKillCount: 0 },
      )

      expect(reader()).toBeNull()
    }
  })

  it('player không có kiemTuRoute (không phải Kiếm Tu) → null', () => {
    const reader = makeReader(
      fakeBattle('fighting', { currentKiemThe: 30 }),
      { bossKillCount: 0 },
    )

    expect(reader()).toBeNull()
  })
})

describe('registerKiemBarReader / readKiemBar — registry round-trip', () => {
  function fakeRegistry() {
    const map = new Map<string, unknown>()

    return {
      set: (key: string, value: unknown) => {
        map.set(key, value)
      },
      get: (key: string) => map.get(key),
    }
  }

  it('register rồi read → đúng snapshot của reader', () => {
    const registry = fakeRegistry()
    const reader = makeReader(
      fakeBattle('fighting', { currentKiemThe: 30 }),
      { kiemTuRoute: 'kiem_tran', bossKillCount: 0 },
    )

    registerKiemBarReader(registry, reader)

    expect(registry.get(KIEM_BAR_READER_KEY)).toBeDefined()
    expect(readKiemBar(registry)).toEqual({ current: 30, max: MAX_KIEM_THE, label: 'Kiếm Thế' })
  })

  it('không có reader đăng ký → readKiemBar trả null (không throw)', () => {
    expect(readKiemBar(fakeRegistry())).toBeNull()
  })
})
