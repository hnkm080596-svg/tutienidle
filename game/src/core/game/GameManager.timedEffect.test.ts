import { describe, expect, it } from 'vitest'
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

    gameManager.applyTimedEffect(
      player,
      makeEffect('e1', 'pill_regen', 10_000, [
        { id: 'm1', sourceId: 'e1', sourceType: 'pill', stat: 'maxHp', flat: 50, percent: 0.1 },
      ]),
    )

    gameManager.applyTimedEffect(
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

    gameManager.applyTimedEffect(
      player,
      makeEffect('e1', 'pill_regen', 20_000, [
        { id: 'm1', sourceId: 'e1', sourceType: 'pill', stat: 'attack', flat: 100, percent: 0.2 },
      ]),
    )

    gameManager.applyTimedEffect(
      player,
      makeEffect('e2', 'pill_regen', 30_000, [
        { id: 'm2', sourceId: 'e2', sourceType: 'pill', stat: 'attack', flat: 40, percent: 0.05 },
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

    // Bug audit P0-1: hai percent khác nhau từng được coi là 2 modifier
    // riêng và cộng dồn trong pipeline.
    gameManager.applyTimedEffect(
      player,
      makeEffect('e1', 'pill_buff', 10_000, [
        { id: 'm1', sourceId: 'e1', sourceType: 'pill', stat: 'attack', percent: 0.1 },
      ]),
    )

    gameManager.applyTimedEffect(
      player,
      makeEffect('e2', 'pill_buff', 12_000, [
        { id: 'm2', sourceId: 'e2', sourceType: 'pill', stat: 'attack', percent: 0.3 },
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

    gameManager.applyTimedEffect(
      player,
      makeEffect('e1', 'pill_buff', 10_000, [
        { id: 'm1', sourceId: 'e1', sourceType: 'pill', stat: 'attack', tag: 'fire', percent: 0.1 },
      ]),
    )

    gameManager.applyTimedEffect(
      player,
      makeEffect('e2', 'pill_buff', 12_000, [
        { id: 'm2', sourceId: 'e2', sourceType: 'pill', stat: 'attack', tag: 'physical', percent: 0.2 },
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

    gameManager.applyTimedEffect(
      player,
      makeEffect('e1', 'pill_regen', 10_000, [
        { id: 'm1', sourceId: 'e1', sourceType: 'pill', stat: 'maxHp', flat: 50 },
      ]),
    )

    gameManager.applyTimedEffect(
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

    gameManager.applyTimedEffect(
      player,
      makeEffect('e1', 'group_mult', 10_000, [
        { id: 'm1', sourceId: 'e1', sourceType: 'buff', stat: 'criticalDamage', multiplier: 1.5 },
      ]),
    )

    gameManager.applyTimedEffect(
      player,
      makeEffect('e2', 'group_mult', 12_000, [
        { id: 'm2', sourceId: 'e2', sourceType: 'buff', stat: 'criticalDamage', multiplier: 1.25 },
      ]),
    )

    expect(player.persistentTimedEffects[0]!.modifiers[0]!.multiplier).toBe(1.5)
  })
})
