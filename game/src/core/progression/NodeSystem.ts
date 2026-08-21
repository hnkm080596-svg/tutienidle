import type { PlayerData } from '../player/Player'
import type { NodePrerequisite, ProgressionNode } from './ProgressionNode'
import { getRealmIndex } from '../realm/realmSystem'

/**
 * Thuần PlayerData — KHÔNG cần registry nào (kể cả `{ kind: 'node' }`
 * chỉ tra `player.purchasedNodeIds`, không cần NodeRegistry để biết
 * node đó ĐÃ mua hay chưa). Vì vậy test được độc lập, không cần dựng
 * GameManager. `unlocksSkillId` (NodeEffect) KHÔNG kiểm tra được ở
 * đây — đó là việc của GameManager.purchaseNode() (cần skillTemplates).
 */
export function hasPrerequisite(player: PlayerData, prerequisite: NodePrerequisite): boolean {
  switch (prerequisite.kind) {
    case 'realm':
      return getRealmIndex(player.realmId) >= getRealmIndex(prerequisite.realmId)

    case 'element':
      return player.unlockedElements.includes(prerequisite.element)

    case 'node':
      return player.purchasedNodeIds.includes(prerequisite.nodeId)

    case 'nodeCount': {
      const purchasedCount = prerequisite.nodeIds.filter(nodeId => player.purchasedNodeIds.includes(nodeId)).length

      return purchasedCount >= prerequisite.countRequired
    }

    case 'excludesNode':
      return !player.purchasedNodeIds.includes(prerequisite.nodeId)
  }
}

export function canPurchaseNode(player: PlayerData, node: ProgressionNode): boolean {
  if (player.purchasedNodeIds.includes(node.id)) {
    return false
  }

  if (player.skillPoints < node.cost) {
    return false
  }

  return (node.prerequisites ?? []).every(prerequisite => hasPrerequisite(player, prerequisite))
}

/**
 * Áp phần effect KHÔNG cần registry (statModifiers/unlocksElement) +
 * trừ skillPoints + đánh dấu đã mua. `unlocksSkillId` KHÔNG xử lý ở
 * đây — GameManager.purchaseNode() tự làm nốt sau khi gọi hàm này,
 * vì cần skillTemplates để learnSkill() (giống pattern
 * Battle.pendingSummons ở Combat Rework Phase 4: phần core chỉ làm
 * được gì KHÔNG cần registry, phần còn lại nhường cho GameManager).
 * Trả false (không làm gì) nếu !canPurchaseNode().
 */
export function purchaseNode(player: PlayerData, node: ProgressionNode): boolean {
  if (!canPurchaseNode(player, node)) {
    return false
  }

  player.skillPoints -= node.cost

  player.purchasedNodeIds.push(node.id)

  if (node.effect.statModifiers) {
    player.modifiers.push(...node.effect.statModifiers)
  }

  if (node.effect.unlocksElement && !player.unlockedElements.includes(node.effect.unlocksElement)) {
    player.unlockedElements.push(node.effect.unlocksElement)
  }

  return true
}
