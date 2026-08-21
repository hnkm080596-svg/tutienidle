import { describe, expect, it } from 'vitest'
import { canEquipElement, equipElement, unequipElement } from './ElementLoadout'
import { createDefaultPlayer } from '../player/Player'

function playerAt(realmId: string, unlockedElements: string[] = []) {
  const player = createDefaultPlayer()

  player.realmId = realmId
  player.unlockedElements = unlockedElements as never

  return player
}

describe('ElementLoadout (Pháp Tu Redesign, magicpath mục 4/32)', () => {
  it('equip thành công khi element đã unlock và còn slot trống', () => {
    const player = playerAt('qi_refining', ['fire'])

    expect(equipElement(player, 'fire')).toBe(true)
    expect(player.equippedElements).toEqual(['fire'])
  })

  it('KHÔNG equip được element chưa unlock', () => {
    const player = playerAt('qi_refining', [])

    expect(canEquipElement(player, 'fire')).toBe(false)
    expect(equipElement(player, 'fire')).toBe(false)
    expect(player.equippedElements).toEqual([])
  })

  it('KHÔNG equip trùng element đã equip', () => {
    const player = playerAt('qi_refining', ['fire'])

    equipElement(player, 'fire')

    expect(equipElement(player, 'fire')).toBe(false)
    expect(player.equippedElements).toEqual(['fire'])
  })

  it('chặn equip khi đã đầy slot (Luyện Khí = 2 slot)', () => {
    const player = playerAt('qi_refining', ['fire', 'water', 'wood'])

    expect(equipElement(player, 'fire')).toBe(true)
    expect(equipElement(player, 'water')).toBe(true)

    expect(canEquipElement(player, 'wood')).toBe(false)
    expect(equipElement(player, 'wood')).toBe(false)
    expect(player.equippedElements).toEqual(['fire', 'water'])
  })

  it('unequip KHÔNG xoá khỏi unlockedElements (giữ tiến trình unlock, spec mục 32)', () => {
    const player = playerAt('qi_refining', ['fire'])

    equipElement(player, 'fire')

    expect(unequipElement(player, 'fire')).toBe(true)
    expect(player.equippedElements).toEqual([])
    expect(player.unlockedElements).toEqual(['fire'])
  })

  it('unequip element chưa equip thì trả false, không throw', () => {
    const player = playerAt('qi_refining', ['fire'])

    expect(unequipElement(player, 'fire')).toBe(false)
  })

  it('Element Slot tăng theo realm — 3 slot ở Kim Đan cho phép equip 3 element', () => {
    const player = playerAt('golden_core', ['fire', 'water', 'wood'])

    expect(equipElement(player, 'fire')).toBe(true)
    expect(equipElement(player, 'water')).toBe(true)
    expect(equipElement(player, 'wood')).toBe(true)
    expect(player.equippedElements).toEqual(['fire', 'water', 'wood'])
  })
})
