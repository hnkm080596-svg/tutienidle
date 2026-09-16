// Kiem Tu Reimagined Task 7 — direct coverage for makeKiemBarReader
// (battle/player → KiemBarSnapshot mapping). Structural fakes only —
// no Pinia/Phaser (same harness shape as the retired route test).
import { describe, expect, it } from 'vitest'
import { MAX_THE } from '@/core/combat/CombatTypes'
import type { TurnBattle, TurnBattleState } from '@/core/battle/turn/TurnBattleSystem'
import type { GameManager } from '@/core/game/GameManager'
import { freshKiemTuState, type KiemTuState, type OrbId } from '@/core/kiem-tu/KiemTuState'
import type { KiemPhoBattleState } from '@/core/kiem-tu/KiemPhoSystem'
import {
  KIEM_BAR_READER_KEY,
  makeKiemBarReader,
  readKiemBar,
  registerKiemBarReader,
  type KiemBarPlayerState,
} from '@/presentation/bridges/kiemBarBridge'

function fakeBattle(
  state: TurnBattleState,
  provider?: { snapshot: () => KiemPhoBattleState },
  entity: {
    currentThe?: number
    maxThe?: number
    externalWard?: { sourceId: string; amount: number }
    stats?: { maxHp: number }
  } = {},
): TurnBattle {
  return {
    state,
    players: [{ entity, dynamicBasic: provider }],
    enemies: [],
  } as unknown as TurnBattle
}

function fakeProvider(over: Partial<KiemPhoBattleState> = {}) {
  const state: KiemPhoBattleState = {
    preset: ['orb_dam', 'orb_chem'],
    cursor: 0,
    log: [],
    comboMaxLength: 3,
    ...over,
  }

  return { snapshot: () => ({ ...state, preset: [...state.preset], log: [...state.log] }) }
}

function makeReader(battle: TurnBattle | null, player: KiemBarPlayerState) {
  const gameManager = { getTurnBattle: () => battle } as unknown as GameManager

  return makeKiemBarReader(gameManager, () => player)
}

function hienPlayer(preset: OrbId[] = ['orb_dam', 'orb_chem']): KiemBarPlayerState {
  return {
    realmId: 'golden_core',
    cultivationPath: 'kiem_tu',
    cultivationWay: 'hien',
    kiemTu: { ...freshKiemTuState(), preset },
  }
}

describe('makeKiemBarReader — hien (Kiem Pho) mapping', () => {
  it('hien + provider → strip model from the live snapshot', () => {
    const reader = makeReader(
      fakeBattle('fighting', fakeProvider({ cursor: 1, log: ['orb_dam'] })),
      hienPlayer(),
    )

    expect(reader()).toEqual({
      current: 1,
      max: 2,
      label: 'Kiếm Phổ',
      mode: 'hien',
      preset: ['orb_dam', 'orb_chem'],
      cursor: 1,
      nextOrb: 'orb_chem',
      log: ['orb_dam'],
    })
  })

  it('hien without a provider falls back to the persisted preset (cursor 0)', () => {
    const reader = makeReader(fakeBattle('fighting'), hienPlayer(['orb_dam']))

    expect(reader()).toMatchObject({
      label: 'Kiếm Phổ',
      mode: 'hien',
      preset: ['orb_dam'],
      cursor: 0,
      nextOrb: 'orb_dam',
      current: 0,
      max: 1,
    })
  })

  it('countdown state still counts as in-battle → snapshot', () => {
    const reader = makeReader(fakeBattle('countdown', fakeProvider()), hienPlayer())

    expect(reader()?.label).toBe('Kiếm Phổ')
  })

  it('no battle / battle ended → null', () => {
    expect(makeReader(null, hienPlayer())()).toBeNull()

    for (const state of ['victory', 'defeat'] as const) {
      expect(makeReader(fakeBattle(state, fakeProvider()), hienPlayer())()).toBeNull()
    }
  })

  it('player without kiemTu (not Kiem Tu) → null', () => {
    const reader = makeReader(fakeBattle('fighting', fakeProvider()), { realmId: 'golden_core' })

    expect(reader()).toBeNull()
  })

  it('ngu way → Kiem Y / forgeCost(realm) progress + sword count label', () => {
    const kiemTu: KiemTuState = {
      ...freshKiemTuState(),
      kiemY: 5_000,
      kiemDaoCount: 3,
      kiemDaoBase: 1.9,
    }
    // golden_core = realmIndex 3 → forgeCost(3) = 16_899.
    const reader = makeReader(fakeBattle('fighting'), {
      realmId: 'golden_core',
      cultivationPath: 'kiem_tu',
      cultivationWay: 'ngu',
      kiemTu,
    })

    expect(reader()).toEqual({
      current: 5_000,
      max: 16_899,
      label: 'Kiếm Ý · 3 kiếm',
      mode: 'ngu',
      kiemDaoCount: 3,
      kiemDaoBase: 1.9,
    })
  })
})

describe('makeKiemBarReader — Thể Tu resource bar (Task 22)', () => {
  it('the_tu_an (kit usesTheResource) → {currentThe, maxThe ?? MAX_THE, "Thế"}', () => {
    const reader = makeReader(
      fakeBattle('fighting', undefined, { currentThe: 45, stats: { maxHp: 400 } }),
      { realmId: 'golden_core', cultivationPath: 'the_tu_an' },
    )

    expect(reader()).toEqual({ current: 45, max: MAX_THE, label: 'Thế', externalWard: undefined })
  })

  it('collapsed save (the_tu + ung_the way) → same Thế bar as the legacy id (M5)', () => {
    const reader = makeReader(
      fakeBattle('fighting', undefined, { currentThe: 45, stats: { maxHp: 400 } }),
      { realmId: 'golden_core', cultivationPath: 'the_tu', cultivationWay: 'ung_the' },
    )

    expect(reader()).toEqual({ current: 45, max: MAX_THE, label: 'Thế', externalWard: undefined })
  })

  it('entity-baked maxThe wins over MAX_THE (node bonus)', () => {
    const reader = makeReader(
      fakeBattle('fighting', undefined, { currentThe: 100, maxThe: 120, stats: { maxHp: 400 } }),
      { realmId: 'golden_core', cultivationPath: 'the_tu_an' },
    )

    expect(reader()!.max).toBe(120)
  })

  it('the_tu (Hiện — no Thế pool) without externalWard → null', () => {
    const reader = makeReader(
      fakeBattle('fighting', undefined, { currentThe: 45, stats: { maxHp: 400 } }),
      { realmId: 'golden_core', cultivationPath: 'the_tu' },
    )

    expect(reader()).toBeNull()
  })

  it('externalWard rides the snapshot on ANY mode (separate shield layer)', () => {
    const reader = makeReader(
      fakeBattle('fighting', undefined, {
        externalWard: { sourceId: 'p', amount: 60 },
        stats: { maxHp: 400 },
      }),
      hienPlayer(),
    )

    expect(reader()).toMatchObject({
      mode: 'hien',
      externalWard: { current: 60, max: 400 },
    })
  })

  it('externalWard alone (no resource route) → snapshot still returned, main bar zeroed', () => {
    const reader = makeReader(
      fakeBattle('fighting', undefined, {
        externalWard: { sourceId: 'p', amount: 25 },
        stats: { maxHp: 200 },
      }),
      { realmId: 'golden_core', cultivationPath: 'the_tu' },
    )

    expect(reader()).toEqual({
      current: 0,
      max: 0,
      label: '',
      externalWard: { current: 25, max: 200 },
    })
  })

  it('the_tu_an with externalWard → Thế bar + shield layer together', () => {
    const reader = makeReader(
      fakeBattle('fighting', undefined, {
        currentThe: 30,
        externalWard: { sourceId: 'p', amount: 50 },
        stats: { maxHp: 250 },
      }),
      { realmId: 'golden_core', cultivationPath: 'the_tu_an' },
    )

    expect(reader()).toEqual({
      current: 30,
      max: MAX_THE,
      label: 'Thế',
      externalWard: { current: 50, max: 250 },
    })
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

  it('register then read → the reader snapshot passes through', () => {
    const registry = fakeRegistry()
    const reader = makeReader(fakeBattle('fighting', fakeProvider()), hienPlayer())

    registerKiemBarReader(registry, reader)

    expect(registry.get(KIEM_BAR_READER_KEY)).toBeDefined()
    expect(readKiemBar(registry)?.mode).toBe('hien')
  })

  it('no reader registered → readKiemBar returns null (no throw)', () => {
    expect(readKiemBar(fakeRegistry())).toBeNull()
  })
})
