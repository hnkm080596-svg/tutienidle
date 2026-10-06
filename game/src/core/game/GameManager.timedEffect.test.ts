import { describe, expect, it, vi } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import type { PersistentTimedEffect } from '../player/PersistentTimedEffect'
import type { StatModifier } from '../stats/StatCalculator'

function makeEffect(
  id: string,
  effectGroup: string,
  expiresAtMs: number,
  modifiers: StatModifier[],
): PersistentTimedEffect {
  return {
    id,

    sourceItemId: `item_${id}`,

    effectGroup,

    appliedAtMs: 0,

    expiresAtMs,

    modifiers,
  }
}

describe('GameManager.applyTimedEffect — stack policy cùng effectGroup', () => {
  it('weaker → stronger: giữ giá trị mạnh hơn cho flat và percent', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.effectOps.applyTimedEffect(
      player,
      makeEffect('e1', 'pill_regen', 10_000, [
        { id: 'm1', sourceId: 'e1', sourceType: 'pill', stat: 'maxHp', flat: 50, percent: 0.1 },
      ]),
    )

    gameManager.effectOps.applyTimedEffect(
      player,
      makeEffect('e2', 'pill_regen', 20_000, [
        { id: 'm2', sourceId: 'e2', sourceType: 'pill', stat: 'maxHp', flat: 80, percent: 0.15 },
      ]),
    )

    expect(player.persistentTimedEffects).toHaveLength(1)

    const modifiers = player.persistentTimedEffects[0]!.modifiers

    expect(modifiers).toHaveLength(1)
    expect(modifiers[0]!.flat).toBe(80)
    expect(modifiers[0]!.percent).toBe(0.15)

    // Deadline refresh (max).
    expect(player.persistentTimedEffects[0]!.expiresAtMs).toBe(20_000)
  })

  it('stronger → weaker: KHÔNG bị hạ xuống giá trị yếu', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.effectOps.applyTimedEffect(
      player,
      makeEffect('e1', 'pill_regen', 20_000, [
        { id: 'm1', sourceId: 'e1', sourceType: 'pill', stat: 'might', flat: 100, percent: 0.2 },
      ]),
    )

    gameManager.effectOps.applyTimedEffect(
      player,
      makeEffect('e2', 'pill_regen', 30_000, [
        { id: 'm2', sourceId: 'e2', sourceType: 'pill', stat: 'might', flat: 40, percent: 0.05 },
      ]),
    )

    expect(player.persistentTimedEffects).toHaveLength(1)

    const modifiers = player.persistentTimedEffects[0]!.modifiers

    expect(modifiers).toHaveLength(1)
    expect(modifiers[0]!.flat).toBe(100)
    expect(modifiers[0]!.percent).toBe(0.2)
    expect(player.persistentTimedEffects[0]!.expiresAtMs).toBe(30_000)
  })

  it('percent khác giá trị của cùng stat KHÔNG cộng dồn — chỉ giữ mạnh hơn', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    // Bug audit P0-1: hai percent khac nhau tung duoc coi la 2 modifier
    // rieng va cong don trong pipeline.
    gameManager.effectOps.applyTimedEffect(
      player,
      makeEffect('e1', 'pill_buff', 10_000, [
        { id: 'm1', sourceId: 'e1', sourceType: 'pill', stat: 'might', percent: 0.1 },
      ]),
    )

    gameManager.effectOps.applyTimedEffect(
      player,
      makeEffect('e2', 'pill_buff', 12_000, [
        { id: 'm2', sourceId: 'e2', sourceType: 'pill', stat: 'might', percent: 0.3 },
      ]),
    )

    expect(player.persistentTimedEffects).toHaveLength(1)

    const modifiers = player.persistentTimedEffects[0]!.modifiers

    expect(modifiers).toHaveLength(1)
    expect(modifiers[0]!.percent).toBe(0.3)
  })

  it('hai tag hợp lệ của cùng stat là 2 pool ĐỘC LẬP — không merge lẫn nhau', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.effectOps.applyTimedEffect(
      player,
      makeEffect('e1', 'pill_buff', 10_000, [
        { id: 'm1', sourceId: 'e1', sourceType: 'pill', stat: 'might', tag: 'fire', percent: 0.1 },
      ]),
    )

    gameManager.effectOps.applyTimedEffect(
      player,
      makeEffect('e2', 'pill_buff', 12_000, [
        { id: 'm2', sourceId: 'e2', sourceType: 'pill', stat: 'might', tag: 'physical', percent: 0.2 },
      ]),
    )

    expect(player.persistentTimedEffects).toHaveLength(1)

    const modifiers = player.persistentTimedEffects[0]!.modifiers

    expect(modifiers).toHaveLength(2)
    expect(modifiers.map((modifier) => modifier.tag).sort()).toEqual(['fire', 'physical'])
  })

  it('khác effectGroup → thêm effect MỚI, không đụng nhóm cũ', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.effectOps.applyTimedEffect(
      player,
      makeEffect('e1', 'pill_regen', 10_000, [
        { id: 'm1', sourceId: 'e1', sourceType: 'pill', stat: 'maxHp', flat: 50 },
      ]),
    )

    gameManager.effectOps.applyTimedEffect(
      player,
      makeEffect('e2', 'elixir_might', 15_000, [
        { id: 'm2', sourceId: 'e2', sourceType: 'pill', stat: 'maxHp', flat: 30 },
      ]),
    )

    expect(player.persistentTimedEffects).toHaveLength(2)
  })

  it('multiplier giữ giá trị mạnh hơn (> 1 là mạnh hơn)', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.effectOps.applyTimedEffect(
      player,
      makeEffect('e1', 'group_mult', 10_000, [
        { id: 'm1', sourceId: 'e1', sourceType: 'buff', stat: 'criticalDamage', multiplier: 1.5 },
      ]),
    )

    gameManager.effectOps.applyTimedEffect(
      player,
      makeEffect('e2', 'group_mult', 12_000, [
        { id: 'm2', sourceId: 'e2', sourceType: 'buff', stat: 'criticalDamage', multiplier: 1.25 },
      ]),
    )

    expect(player.persistentTimedEffects[0]!.modifiers[0]!.multiplier).toBe(1.5)
  })

  // R22-COR-1: the durationStackable arm is the only writer that ADDS
  // onto a persisted stamp - a parked expiry just inside the
  // validator's bound plus one honest re-drink used to push
  // expiresAtMs past it, and the next save wrote the out-of-domain
  // value verbatim, bricking the save at load. The write now clamps
  // inside the admitted domain (|x| < 2^52).
  describe('durationStackable clamp (R22-COR-1)', () => {
    const stackable = (
      id: string,
      appliedAtMs: number,
      expiresAtMs: number,
    ): PersistentTimedEffect => ({
      id,
      sourceItemId: `item_${id}`,
      effectGroup: 'pill_regen',
      appliedAtMs,
      expiresAtMs,
      durationStackable: true,
      modifiers: [
        { id: `m_${id}`, sourceId: id, sourceType: 'pill', stat: 'maxHp', flat: 10 },
      ],
    })

    it('a parked near-bound expiry + re-drink stays inside the admitted domain', () => {
      const gameManager = new GameManager()
      const player = createDefaultPlayer()

      // Existing buff parked just inside the bound (as a crafted save
      // would leave it - restore keeps sub-bound stamps verbatim).
      player.persistentTimedEffects = [stackable('seed', 0, 2 ** 52 - 2)]

      // One honest re-drink of a small authored duration (60s).
      gameManager.effectOps.applyTimedEffect(player, stackable('re1', 0, 60_000))

      const stored = player.persistentTimedEffects[0]!
      expect(stored.expiresAtMs).toBe(2 ** 52 - 1)
      expect(Math.abs(stored.expiresAtMs)).toBeLessThan(2 ** 52)

      // Idempotent at the clamp - further drinks never leave the
      // admitted domain either.
      gameManager.effectOps.applyTimedEffect(player, stackable('re2', 0, 60_000))
      expect(player.persistentTimedEffects[0]!.expiresAtMs).toBe(2 ** 52 - 1)
    })

    it('normal stacking still adds the full authored duration', () => {
      const gameManager = new GameManager()
      const player = createDefaultPlayer()
      const now = 1_800_000_000_000
      vi.spyOn(Date, 'now').mockReturnValue(now)

      player.persistentTimedEffects = [stackable('seed', 0, 500_000)]
      gameManager.effectOps.applyTimedEffect(player, stackable('re1', 0, 60_000))

      // max(Date.now(), old) + duration - the parked deadline extends
      // by the full authored span, unchanged.
      expect(player.persistentTimedEffects[0]!.expiresAtMs).toBe(now + 60_000)

      // Live expiry extends from its own deadline instead.
      player.persistentTimedEffects = [stackable('seed', 0, now + 30_000)]
      gameManager.effectOps.applyTimedEffect(player, stackable('re1', 0, 60_000))
      expect(player.persistentTimedEffects[0]!.expiresAtMs).toBe(now + 90_000)

      vi.restoreAllMocks()
    })
  })
})
