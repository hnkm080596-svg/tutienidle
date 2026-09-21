// Phap Tu Reimagined (Task 16) — direct coverage for makeTheBarReader
// (battle/player -> TheBarSnapshot mapping). Same pattern as
// kiemBarBridge.test.ts: fake gameManager/player state, structural, no
// Pinia/Phaser.
import { describe, expect, it } from 'vitest'
import { MAX_THE } from '@/core/combat/CombatTypes'
import { PHAP_TU_EMPOWERMENT_THE_THRESHOLD } from '@/core/phap-tu/PhapTuRoutes'
import { PHAP_TU_ULTIMATE_IDS } from '@/data/skill/PhapTuUltimates'
import { hasPathCapability } from '@/core/player/CultivationPathSystem'
import type { PathCapability } from '@/core/player/CultivationPathKit'
import type { TurnBattle, TurnBattleState } from '@/core/battle/turn/TurnBattleSystem'
import type { GameManager } from '@/core/game/GameManager'
import {
  makeTheBarReader,
  readTheBar,
  registerTheBarReader,
  THE_BAR_READER_KEY,
  type TheBarPlayerState,
} from '@/presentation/bridges/theBarBridge'

function fakeBattle(
  state: TurnBattleState,
  entity: { currentThe?: number; maxThe?: number },
): TurnBattle {
  return { state, players: [{ entity }], enemies: [] } as unknown as TurnBattle
}

function phapTuPlayer(overrides: Partial<TheBarPlayerState> = {}): TheBarPlayerState {
  return {
    cultivationPath: 'phap_tu',
    cultivationWay: 'ngu_hanh',
    phapTu: { element: 'fire', route: 'dot' },
    nodeLevels: {},
    ...overrides,
  }
}

function makeReader(battle: TurnBattle | null, player: TheBarPlayerState) {
  // P1 - the bridge reads conditional capabilities through the bound
  // facade; the fake binds the REAL resolver to the same player state.
  const gameManager = {
    getTurnBattle: () => battle,
    hasPathCapability: (cap: PathCapability) =>
      hasPathCapability(player, cap, { hasSkill: () => false }),
  } as unknown as GameManager

  return makeTheBarReader(gameManager, () => player)
}

describe('makeTheBarReader — Task 16 The bar mapping', () => {
  it('phap_tu + element committed + fighting → snapshot voi threshold co dinh', () => {
    const reader = makeReader(
      fakeBattle('fighting', { currentThe: 40, maxThe: MAX_THE }),
      phapTuPlayer(),
    )

    expect(reader()).toEqual({
      current: 40,
      max: MAX_THE,
      threshold: PHAP_TU_EMPOWERMENT_THE_THRESHOLD,
      empowered: false,
      label: 'Thế',
    })
  })

  it('truong_the-raised max surfaces in the snapshot (marker stays at 100)', () => {
    const reader = makeReader(
      fakeBattle('fighting', { currentThe: 105, maxThe: 130 }),
      phapTuPlayer(),
    )

    const snap = reader()

    expect(snap?.max).toBe(130)
    expect(snap?.threshold).toBe(100)
  })

  it('linh_ngo_<godUlt> owned → empowered true', () => {
    const godUltId = PHAP_TU_ULTIMATE_IDS.fire
    const reader = makeReader(
      fakeBattle('fighting', { currentThe: 0 }),
      phapTuPlayer({ nodeLevels: { [`linh_ngo_${godUltId}`]: 1 } }),
    )

    expect(reader()?.empowered).toBe(true)
  })

  it('không có battle → null', () => {
    expect(makeReader(null, phapTuPlayer())()).toBeNull()
  })

  it('battle không diễn ra (victory/defeat) → null', () => {
    for (const state of ['victory', 'defeat'] as const) {
      expect(makeReader(fakeBattle(state, { currentThe: 30 }), phapTuPlayer())()).toBeNull()
    }
  })

  it('ngo_dao way owns NO The pool → null (spec P6)', () => {
    const reader = makeReader(
      fakeBattle('fighting', { currentThe: 30 }),
      phapTuPlayer({ cultivationPath: 'phap_tu', cultivationWay: 'ngo_dao' }),
    )

    expect(reader()).toBeNull()
  })

  it('chưa chọn hành (element null) → null', () => {
    const reader = makeReader(
      fakeBattle('fighting', { currentThe: 30 }),
      phapTuPlayer({ phapTu: { element: null, route: null } }),
    )

    expect(reader()).toBeNull()
  })
})

describe('registerTheBarReader / readTheBar — registry round-trip', () => {
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
      fakeBattle('fighting', { currentThe: 55 }),
      phapTuPlayer(),
    )

    registerTheBarReader(registry, reader)

    expect(registry.get(THE_BAR_READER_KEY)).toBeDefined()
    expect(readTheBar(registry)?.current).toBe(55)
  })

  it('không có reader đăng ký → readTheBar trả null (không throw)', () => {
    expect(readTheBar(fakeRegistry())).toBeNull()
  })
})
