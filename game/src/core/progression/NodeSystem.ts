import type { PlayerData } from '../player/Player'
import type { NodePrerequisite, ProgressionNode, SkillModifier } from './ProgressionNode'
import { getRealmIndex } from '../realm/realmSystem'

/**
 * Node level hạ tầng dùng chung (combat-skill-flow-element-power-dot-plan.md
 * §6.1/§6.8) — `player.nodeLevels` là NGUỒN SỰ THẬT DUY NHẤT của state đã
 * đầu tư:
 * - Level 0 = chưa lĩnh ngộ; level >= 1 = đã lĩnh ngộ và thỏa prerequisite.
 * - maxLevel mặc định 1 → toàn bộ node cũ giữ hành vi mua một lần.
 * - Modifier KHÔNG còn được push vĩnh viễn vào player.modifiers hay mutate
 *   Skill instance lúc mua nữa — mọi hiệu lực suy ra từ
 *   (registry, nodeLevels) qua aggregateNodeStatModifiers()/
 *   aggregateNodeSkillModifiers() để recompute luôn cho cùng kết quả
 *   xác định, không cộng hai lần khi load.
 *
 * Chi phí theo cấp data-driven: node.upgradeCost = { base, perLevel }
 * với cost(level L → L+1) = base + floor(L / perLevel). Power 10 cấp
 * {1,3} → dãy 1,1,1,2,2,2,3,3,3,4; growth/specialization 5 cấp {1,2} →
 * 1,1,2,2,3 (đúng §6.2/§6.7). Node không khai upgradeCost dùng
 * insightCost cho MỌI lần mua/nâng (root/keystone một cấp).
 */
export function getNodeMaxLevel(node: ProgressionNode): number {
  return Math.max(1, node.maxLevel ?? 1)
}

/** Level hiện tại của node trong PlayerData — nguồn sự thật là nodeLevels. */
export function getNodeLevel(player: PlayerData, nodeId: string): number {
  // Defensive (?.) — save cũ trước khi có nodeLevels (giữa v46) trả về
  // undefined; coi như chưa lĩnh ngộ node nào thay vì crash toàn UI.
  return player.nodeLevels?.[nodeId] ?? 0
}

/** Cost để nâng từ `currentLevel` lên `currentLevel + 1`. */
export function getNextLevelCost(node: ProgressionNode, currentLevel: number): number {
  if (node.upgradeCost) {
    return node.upgradeCost.base + Math.floor(Math.max(0, currentLevel) / node.upgradeCost.perLevel)
  }

  return node.insightCost
}

export function hasPrerequisite(player: PlayerData, prerequisite: NodePrerequisite): boolean {
  switch (prerequisite.kind) {
    case 'realm':
      return getRealmIndex(player.realmId) >= getRealmIndex(prerequisite.realmId)

    case 'element':
      return player.unlockedElements.includes(prerequisite.element)

    // §6.1 — kiểm tra qua LEVEL thay vì danh sách boolean riêng.
    case 'node':
      return getNodeLevel(player, prerequisite.nodeId) >= 1

    case 'nodeCount': {
      const purchasedCount = prerequisite.nodeIds.filter(nodeId => getNodeLevel(player, nodeId) >= 1).length

      return purchasedCount >= prerequisite.countRequired
    }

    case 'excludesNode':
      return getNodeLevel(player, prerequisite.nodeId) === 0
  }
}

/** Prerequisite (chỉ gate việc LĨNH NGỘ level 0→1, không gate nâng cấp). */
function meetsPrerequisites(player: PlayerData, node: ProgressionNode): boolean {
  return (node.prerequisites ?? []).every(prerequisite => hasPrerequisite(player, prerequisite))
}

/** Đủ điều kiện LĨNH NGỘ (0→1): chưa có level, đủ prereq, đủ Cảm Ngộ cost cấp 1. */
export function canPurchaseNode(player: PlayerData, node: ProgressionNode): boolean {
  if (getNodeLevel(player, node.id) > 0) {
    return false
  }

  if (player.skillInsight < getNextLevelCost(node, 0)) {
    return false
  }

  return meetsPrerequisites(player, node)
}

/** Đủ điều kiện NÂNG CẤP (L→L+1): đã lĩnh ngộ, chưa max, đủ Cảm Ngộ. */
export function canUpgradeNode(player: PlayerData, node: ProgressionNode): boolean {
  const level = getNodeLevel(player, node.id)

  if (level < 1 || level >= getNodeMaxLevel(node)) {
    return false
  }

  return player.skillInsight >= getNextLevelCost(node, level)
}

/**
 * Áp phần effect KHÔNG cần registry ở mức data thuần (trừ skillInsight,
 * ghi nodeLevels/purchasedNodeIds, unlocksElement). KHÔNG push modifier
 * vào player.modifiers (§6.8 — hiệu lực do aggregator suy ra).
 * `unlocksSkillIds` xử lý ở GameManager.purchaseNode() sau khi gọi hàm
 * này (cần skillTemplates). Trả false nếu !canPurchaseNode().
 */
export function purchaseNode(player: PlayerData, node: ProgressionNode): boolean {
  if (!canPurchaseNode(player, node)) {
    return false
  }

  player.skillInsight -= getNextLevelCost(node, 0)

  // Defensive — save cũ có thể thiếu object này.
  player.nodeLevels ??= {}

  player.nodeLevels[node.id] = 1

  // Compat đọc-thôi: giữ danh sách id đồng bộ "level >= 1".
  if (!player.purchasedNodeIds.includes(node.id)) {
    player.purchasedNodeIds.push(node.id)
  }

  if (node.effect.unlocksElement && !player.unlockedElements.includes(node.effect.unlocksElement)) {
    player.unlockedElements.push(node.effect.unlocksElement)
  }

  return true
}

/**
 * Nâng node từ level hiện tại lên +1 (§6.2) — trừ đúng cost cấp kế,
 * không vượt maxLevel; thất bại KHÔNG mutate gì.
 */
export function upgradeNode(player: PlayerData, node: ProgressionNode): boolean {
  if (!canUpgradeNode(player, node)) {
    return false
  }

  player.skillInsight -= getNextLevelCost(node, getNodeLevel(player, node.id))

  // Defensive — save cũ có thể thiếu object này.
  player.nodeLevels ??= {}

  player.nodeLevels[node.id] = getNodeLevel(player, node.id) + 1

  return true
}

/**
 * Scale modifier theo level — cùng công thức getScaledPassiveModifiers():
 * giá trị tại level L = base + perLevel × (L − 1). Node một cấp (root/
 * keystone) ứng L=1 → đúng base, không perLevel.
 */
function scaleModifierForLevel<T extends { flat?: number; percent?: number; perLevelFlat?: number; perLevelPercent?: number }>(
  modifier: T,

  level: number,
): T & { flat: number; percent: number } {
  const extraLevels = Math.max(0, level - 1)

  return {
    ...modifier,

    flat: (modifier.flat ?? 0) + (modifier.perLevelFlat ?? 0) * extraLevels,

    percent: (modifier.percent ?? 0) + (modifier.perLevelPercent ?? 0) * extraLevels,
  }
}

/**
 * Aggregator stat modifiers của character từ (registry, nodeLevels)
 * (§6.8 bước 3) — thay hoàn toàn đường push vào player.modifiers cũ.
 * Cùng (registry, levels) bất kể thứ tự nâng → cùng kết quả.
 */
export function aggregateNodeStatModifiers(
  registry: { getAll(): ProgressionNode[] },

  player: PlayerData,
) {
  const modifiers = []

  for (const node of registry.getAll()) {
    const level = getNodeLevel(player, node.id)

    if (level <= 0) {
      continue
    }

    for (const modifier of node.effect.statModifiers ?? []) {
      modifiers.push(scaleModifierForLevel(modifier, level))
    }
  }

  return modifiers
}

/**
 * Aggregator skill runtime modifiers (thay đường mutate Skill instance
 * cũ lúc purchase) — SkillModifier chỉ dùng flat/perLevelFlat; percent
 * giữ nguyên ngữ nghĩa nhân một lần nếu author có khai.
 */
export function aggregateNodeSkillModifiers(
  registry: { getAll(): ProgressionNode[] },

  player: PlayerData,
) {
  const result: {
    skillId: string

    statModifiers: Array<SkillModifier & { flat: number; percent: number }>
  }[] = []

  for (const node of registry.getAll()) {
    const level = getNodeLevel(player, node.id)

    if (level <= 0) {
      continue
    }

    for (const entry of node.effect.skillModifiers ?? []) {
      result.push({
        skillId: entry.skillId,

        statModifiers: entry.statModifiers.map(modifier => scaleModifierForLevel(modifier, level)),
      })
    }
  }

  return result
}

/**
 * Reset development MỘT NHÁNH (§6.10) — hoàn đúng tổng Cảm Ngộ đã tiêu
 * suy ra từ lịch sử level/cost data; gỡ cascade node con mồ côi khi
 * prerequisite cha về 0; KHÔNG hoàn root miễn phí thành sai lệch
 * (cost 0 tự nhiên hoàn 0). Chỉ dùng ngoài combat, phục vụ cân bằng.
 */
export function devResetBranch(
  player: PlayerData,

  registry: { getAll(): ProgressionNode[] },

  branchTag: string,
): number {
  const nodes = registry.getAll().filter(node => node.branchTag === branchTag)

  if (nodes.length === 0) {
    return 0
  }

  let refund = 0

  for (const node of nodes) {
    const level = getNodeLevel(player, node.id)

    for (let spent = 0; spent < level; spent++) {
      refund += getNextLevelCost(node, spent)
    }

    delete player.nodeLevels[node.id]

    const index = player.purchasedNodeIds.indexOf(node.id)

    if (index !== -1) {
      player.purchasedNodeIds.splice(index, 1)
    }
  }

  // Cascade gỡ node con mồ côi: lặp tới ổn định — node nào còn level
  // mà prereq 'node' cha về 0 thì gỡ tiếp (hoàn tiền của nó luôn, vì
  // trạng thái không còn hợp lệ).
  let changed = true

  while (changed) {
    changed = false

    for (const node of registry.getAll()) {
      if (getNodeLevel(player, node.id) < 1) {
        continue
      }

      const orphaned = (node.prerequisites ?? []).some(
        prerequisite =>
          prerequisite.kind === 'node' &&
          getNodeLevel(player, prerequisite.nodeId) < 1,
      )

      if (orphaned) {
        const level = getNodeLevel(player, node.id)

        for (let spent = 0; spent < level; spent++) {
          refund += getNextLevelCost(node, spent)
        }

        delete player.nodeLevels[node.id]

        const index = player.purchasedNodeIds.indexOf(node.id)

        if (index !== -1) {
          player.purchasedNodeIds.splice(index, 1)
        }

        changed = true
      }
    }
  }

  // Hoàn Cảm Ngộ vào player (§6.10).
  player.skillInsight += refund

  return refund
}
