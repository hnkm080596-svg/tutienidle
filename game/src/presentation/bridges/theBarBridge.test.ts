// Phap Tu Reimagine (spec D17) -- direct coverage for makeTheBarReader
// (battle/player -> TheBarSnapshot mapping). Same pattern as
// kiemBarBridge.test.ts: fake gameManager/player state, structural, no
// Pinia/Phaser.
import { describe, expect, it } from 'vitest'
import { hasPathCapability } from '@/core/player/CultivationPathSystem'
import type { PathCapability } from '@/core/player/CultivationPathKit'
import type { TurnBattle, TurnBattleState } from '@/core/battle/turn/TurnBattleSystem'
import type { TurnSkillDefinition } from '@/core/battle/turn/TurnSkillAction'
import type { GameManager } from '@/core/game/GameManager'
import {
  makeTheBarReader,
  readTheBar,
  registerTheBarReader,
  THE_BAR_MAX,
  THE_BAR_READER_KEY,
  type TheBarPlayerState,
} from '@/presentation/bridges/theBarBridge'

function fakeBattle(
  state: TurnBattleState,
  entity: { currentThe?: number },
  basic?: Partial<TurnSkillDefinition>,
): TurnBattle {
  return { state, players: [{ entity, basic }], enemies: [] } as unknown as TurnBattle
}

function spellPathPlayer(overrides: Partial<TheBarPlayerState> = {}): TheBarPlayerState {
  return {
    cultivationPath: 'spell',
    cultivationWay: 'spell_pathway',
    spellPath: { element: 'fire' } as TheBarPlayerState['spellPath'],
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

describe('makeTheBarReader — reimagined The bar mapping (D17)', () => {
  it('spell + element committed + fighting → snapshot voi cap 5', () => {
    const reader = makeReader(
      fakeBattle('fighting', { currentThe: 3 }),
      spellPathPlayer(),
    )

    expect(reader()).toEqual({
      current: 3,
      max: 5,
      threshold: 5,
      phapTheActive: false,
      label: 'Thế',
    })
  })

  it('cap is a flat 5 — never a raised max', () => {
    const reader = makeReader(
      fakeBattle('fighting', { currentThe: 5 }),
      spellPathPlayer(),
    )

    const snap = reader()

    expect(snap?.max).toBe(THE_BAR_MAX)
    expect(snap?.threshold).toBe(THE_BAR_MAX)
  })

  it('element basic carries an empowerment variant + pool full → phapTheActive', () => {
    const empoweredBasic = {
      id: 'hoa_cau_thuat',
      empowerment: { theThreshold: 5, empowered: {} as TurnSkillDefinition },
    }
    const reader = makeReader(
      fakeBattle('fighting', { currentThe: 5 }, empoweredBasic),
      spellPathPlayer(),
    )

    expect(reader()?.phapTheActive).toBe(true)
  })

  it('empowerment variant present but pool not full → phapTheActive false', () => {
    const empoweredBasic = {
      id: 'hoa_cau_thuat',
      empowerment: { theThreshold: 5, empowered: {} as TurnSkillDefinition },
    }
    const reader = makeReader(
      fakeBattle('fighting', { currentThe: 4 }, empoweredBasic),
      spellPathPlayer(),
    )

    expect(reader()?.phapTheActive).toBe(false)
  })

  it('pool full but basic has no empowerment variant → phapTheActive false', () => {
    const reader = makeReader(
      fakeBattle('fighting', { currentThe: 5 }),
      spellPathPlayer(),
    )

    expect(reader()?.phapTheActive).toBe(false)
  })

  it('không có battle → null', () => {
    expect(makeReader(null, spellPathPlayer())()).toBeNull()
  })

  it('battle không diễn ra (victory/defeat) → null', () => {
    for (const state of ['victory', 'defeat'] as const) {
      expect(makeReader(fakeBattle(state, { currentThe: 3 }), spellPathPlayer())()).toBeNull()
    }
  })

  it('hidden_spell_pathway way owns NO The pool → null (spec P6)', () => {
    const reader = makeReader(
      fakeBattle('fighting', { currentThe: 3 }),
      spellPathPlayer({ cultivationPath: 'spell', cultivationWay: 'hidden_spell_pathway' }),
    )

    expect(reader()).toBeNull()
  })

  it('chưa chọn hành (element null) → null', () => {
    const reader = makeReader(
      fakeBattle('fighting', { currentThe: 3 }),
      spellPathPlayer({ spellPath: { element: null } as TheBarPlayerState['spellPath'] }),
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
      fakeBattle('fighting', { currentThe: 5 }),
      spellPathPlayer(),
    )

    registerTheBarReader(registry, reader)

    expect(registry.get(THE_BAR_READER_KEY)).toBeDefined()
    expect(readTheBar(registry)?.current).toBe(5)
  })

  it('không có reader đăng ký → readTheBar trả null (không throw)', () => {
    expect(readTheBar(fakeRegistry())).toBeNull()
  })
})
