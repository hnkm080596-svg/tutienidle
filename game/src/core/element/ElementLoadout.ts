import type { PlayerData } from '../player/Player'
import type { ElementType } from './ElementType'
import { getElementSlotCount } from './ElementSlot'

/**
 * Pháp Tu Redesign (magicpath mục 4/32) — Element Loadout: chọn Element
 * nào trong số ĐÃ MỞ KHÓA (player.unlockedElements) được mang vào
 * combat, giới hạn bởi getElementSlotCount(realmId). Unequip KHÔNG xoá
 * tiến trình unlock — element vẫn nằm trong unlockedElements, chỉ rời
 * khỏi equippedElements (đúng yêu cầu spec mục 32: "Unequip Fire
 * không có nghĩa Fire bị mất upgrade").
 */
export function canEquipElement(player: PlayerData, element: ElementType): boolean {
  if (!player.unlockedElements.includes(element)) {
    return false
  }

  if (player.equippedElements.includes(element)) {
    return false
  }

  return player.equippedElements.length < getElementSlotCount(player.realmId)
}

export function equipElement(player: PlayerData, element: ElementType): boolean {
  if (!canEquipElement(player, element)) {
    return false
  }

  player.equippedElements.push(element)

  return true
}

export function unequipElement(player: PlayerData, element: ElementType): boolean {
  const index = player.equippedElements.indexOf(element)

  if (index === -1) {
    return false
  }

  player.equippedElements.splice(index, 1)

  return true
}
