import type { PlayerData } from '../player/Player'
import type { NodePrerequisite, ProgressionNode, TurnSkillResourceModifier } from './ProgressionNode'
import type { PhapTuRoute } from '../phap-tu/PhapTuState'
import { getRealmIndex } from '../realm/realmSystem'
import { getNodeCostFreeChance } from '../talent/TalentEffects'
import { kiemDaoCap } from '../kiem-tu/NguKiemDao'

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

    // §6.1 — kiểm tra qua LEVEL thay vì danh sách boolean riêng.
    case 'node':
      return getNodeLevel(player, prerequisite.nodeId) >= 1

    case 'nodeCount': {
      const purchasedCount = prerequisite.nodeIds.filter(nodeId => getNodeLevel(player, nodeId) >= 1).length

      return purchasedCount >= prerequisite.countRequired
    }

    case 'excludesNode':
      return getNodeLevel(player, prerequisite.nodeId) === 0

    // Kiếm Tu (2026-08-28) — đọc mirror player.skillCastCounts/skillLevels
    // (skill instance thật sống trong SkillManager, NodeSystem chỉ nhận
    // PlayerData nên không tra được trực tiếp).
    case 'skillCastCount': {
      const counts = player.skillCastCounts ?? {}
      const levels = player.skillLevels ?? {}

      const castOk = prerequisite.count === undefined || (counts[prerequisite.skillId] ?? 0) >= prerequisite.count
      const levelOk = prerequisite.level === undefined || (levels[prerequisite.skillId] ?? 1) >= prerequisite.level

      return castOk && levelOk
    }

    // Kiem Tu Reimagined (spec K20) — the Cuu Cung cap guard. Lives in
    // hasPrerequisite so canPurchaseNode blocks the buy BEFORE insight
    // is deducted or the node recorded. Mortal realm (index 0) fails —
    // ngu cannot be entered there anyway.
    case 'kiemDaoBelowCap': {
      const state = player.kiemTu
      const realmIndex = getRealmIndex(player.realmId)

      if (state?.mode !== 'ngu' || realmIndex < 1) {
        return false
      }

      return state.kiemDaoCount < kiemDaoCap(realmIndex)
    }
  }
}

/** Prerequisite (chỉ gate việc LĨNH NGỘ level 0→1, không gate nâng cấp). */
function meetsPrerequisites(player: PlayerData, node: ProgressionNode): boolean {
  return (node.prerequisites ?? []).every(prerequisite => hasPrerequisite(player, prerequisite))
}

/**
 * Phap Tu Reimagined Task 4 — route membership: a routeTag node only
 * exists while the player's route matches (untagged nodes are always
 * active). Aggregators skip inactive-route nodes and purchase/upgrade
 * reject them, so an inactive node's levels can never take effect.
 */
export function isNodeRouteActive(player: PlayerData, node: ProgressionNode): boolean {
  return node.routeTag === undefined || player.phapTu.route === node.routeTag
}

/**
 * Phap Tu Reimagined Task 6 — element-branch membership: a node with
 * elementTag is active only while phapTu.element matches (untagged
 * nodes are always active). Same gate points as routeTag: aggregators
 * skip inactive-element nodes, purchase/upgrade reject them. While
 * phapTu.element is null (pre-selection) every element node counts as
 * active so selectPhapTuElement can purchase its root — unreachable
 * branch children still fail their root prerequisite.
 */
export function isNodeElementActive(player: PlayerData, node: ProgressionNode): boolean {
  return (
    node.elementTag === undefined ||
    player.phapTu.element === null ||
    player.phapTu.element === node.elementTag
  )
}

/** Đủ điều kiện LĨNH NGỘ (0→1): chưa có level, đủ prereq, đủ Cảm Ngộ cost cấp 1. */
export function canPurchaseNode(player: PlayerData, node: ProgressionNode): boolean {
  if (getNodeLevel(player, node.id) > 0) {
    return false
  }

  if (!isNodeRouteActive(player, node) || !isNodeElementActive(player, node) || !nodePathApplies(player, node)) {
    return false
  }

  // Kiem Tu Reimagined — a mode-tagged node is only purchasable in its
  // own mode. Without this a converted ngu player could buy inert hien
  // orb nodes (the aggregation filter would silently eat the effect).
  if (node.kiemTuMode !== undefined && node.kiemTuMode !== player.kiemTu?.mode) {
    return false
  }

  if (player.skillInsight < getNextLevelCost(node, 0)) {
    return false
  }

  // Kiem Tu Reimagined — a hidden node is never purchasable before its
  // revealWhen gate holds (display gate + purchase gate share the read).
  if (node.revealWhen && !hasPrerequisite(player, node.revealWhen)) {
    return false
  }

  return meetsPrerequisites(player, node)
}

/** Đủ điều kiện NÂNG CẤP (L→L+1): đã lĩnh ngộ, chưa max, đủ Cảm Ngộ. */
export function canUpgradeNode(player: PlayerData, node: ProgressionNode): boolean {
  if (!isNodeRouteActive(player, node) || !isNodeElementActive(player, node) || !nodeModeApplies(player, node) || !nodePathApplies(player, node)) {
    return false
  }

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
/**
 * Van Dao (M2, spec §4.3): each purchase/upgrade rolls a chance to waive
 * the insight cost. The waived amount is recorded in
 * player.nodeFreePurchaseRecord[nodeId] so refunds later repay only the
 * insight ACTUALLY paid. The affordability gate (canPurchase/canUpgrade)
 * is unchanged — a free roll still requires being able to afford it.
 * Returns true when the cost was waived (caller deducts nothing).
 */
function rollVanDaoWaive(player: PlayerData, node: ProgressionNode, cost: number): boolean {
  const chance = getNodeCostFreeChance(player.selectedTalentIds)

  if (chance <= 0 || cost <= 0) {
    return false
  }

  if (Math.random() >= chance) {
    return false
  }

  player.nodeFreePurchaseRecord ??= {}
  player.nodeFreePurchaseRecord[node.id] =
    (player.nodeFreePurchaseRecord[node.id] ?? 0) + cost

  return true
}

export function purchaseNode(player: PlayerData, node: ProgressionNode): boolean {
  if (!canPurchaseNode(player, node)) {
    return false
  }

  const cost = getNextLevelCost(node, 0)

  if (!rollVanDaoWaive(player, node, cost)) {
    player.skillInsight -= cost
  }

  // Defensive — save cũ có thể thiếu object này.
  player.nodeLevels ??= {}

  player.nodeLevels[node.id] = 1

  // Compat đọc-thôi: giữ danh sách id đồng bộ "level >= 1".
  if (!player.purchasedNodeIds.includes(node.id)) {
    player.purchasedNodeIds.push(node.id)
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

  const cost = getNextLevelCost(node, getNodeLevel(player, node.id))

  if (!rollVanDaoWaive(player, node, cost)) {
    player.skillInsight -= cost
  }

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
/**
 * Kiem Tu Reimagined — a node authored for one kiem_tu mode contributes
 * nothing while the player is in the other mode (orb growth nodes are
 * inert for ngu, ngu growth nodes are inert for hien). Mode-agnostic
 * nodes (kiemTuMode undefined) always apply.
 */
export function nodeModeApplies(player: PlayerData, node: ProgressionNode): boolean {
  return node.kiemTuMode === undefined || node.kiemTuMode === player.kiemTu?.mode
}

/**
 * Ownership gate — a node authored for one cultivation path can be
 * purchased/upgraded by, and aggregates effects for, only a player on
 * that same path. requiredCultivationPath undefined = path-agnostic.
 */
export function nodePathApplies(player: PlayerData, node: ProgressionNode): boolean {
  return node.requiredCultivationPath === undefined || node.requiredCultivationPath === player.cultivationPath
}

export function aggregateNodeStatModifiers(
  registry: { getAll(): ProgressionNode[] },

  player: PlayerData,
) {
  const modifiers = []

  for (const node of registry.getAll()) {
    const level = getNodeLevel(player, node.id)

    if (level <= 0 || !isNodeRouteActive(player, node) || !isNodeElementActive(player, node) || !nodeModeApplies(player, node) || !nodePathApplies(player, node)) {
      continue
    }

    for (const modifier of node.effect.statModifiers ?? []) {
      modifiers.push(scaleModifierForLevel(modifier, level))
    }
  }

  return modifiers
}

/**
 * Phap Tu Reimagined Task 6 — aggregate the The-resource lane: for
 * each authored turn skill, sum node-level-scaled theGainOnLandedCast /
 * theGainOnCrit across all active nodes. Values contribute
 * per node level (level L adds value x L). The modifier stays scoped
 * to its authored skillId — it cannot leak to other elements, Kiem
 * Tu, or mortal skills.
 */
export function aggregateTurnSkillResourceModifiers(
  registry: { getAll(): ProgressionNode[] },

  player: PlayerData,
): Map<string, TurnSkillResourceModifier> {
  const result = new Map<string, TurnSkillResourceModifier>()

  for (const node of registry.getAll()) {
    const level = getNodeLevel(player, node.id)

    if (level <= 0 || !isNodeRouteActive(player, node) || !isNodeElementActive(player, node) || !nodeModeApplies(player, node) || !nodePathApplies(player, node)) {
      continue
    }

    for (const entry of node.effect.turnSkillResourceModifiers ?? []) {
      const existing = result.get(entry.skillId) ?? { skillId: entry.skillId }

      existing.theGainOnLandedCast =
        (existing.theGainOnLandedCast ?? 0) + (entry.theGainOnLandedCast ?? 0) * level
      existing.theGainOnCrit =
        (existing.theGainOnCrit ?? 0) + (entry.theGainOnCrit ?? 0) * level

      result.set(entry.skillId, existing)
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
    // Kiem Tu Reimagined (spec K4) — mode-switch nodes are one-way and
    // non-refundable: dev reset never clears nor refunds them. Their
    // branch children still reset (they hold no mode-switch state).
    if (node.effect.kiemTuModeSwitch) {
      continue
    }

    const level = getNodeLevel(player, node.id)

    let nodeRefund = 0

    for (let spent = 0; spent < level; spent++) {
      nodeRefund += getNextLevelCost(node, spent)
    }

    // Van Dao (M2): refund only the insight ACTUALLY paid — subtract the
    // waived amounts recorded at purchase time, then clear the record
    // alongside the node itself.
    nodeRefund = Math.max(0, nodeRefund - (player.nodeFreePurchaseRecord?.[node.id] ?? 0))
    if (player.nodeFreePurchaseRecord) {
      delete player.nodeFreePurchaseRecord[node.id]
    }

    refund += nodeRefund

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
      if (getNodeLevel(player, node.id) < 1 || node.effect.kiemTuModeSwitch) {
        continue
      }

      const orphaned = (node.prerequisites ?? []).some(
        prerequisite =>
          prerequisite.kind === 'node' &&
          getNodeLevel(player, prerequisite.nodeId) < 1,
      )

      if (orphaned) {
        const level = getNodeLevel(player, node.id)

        let nodeRefund = 0

        for (let spent = 0; spent < level; spent++) {
          nodeRefund += getNextLevelCost(node, spent)
        }

        // Van Dao (M2): same actually-paid refund rule as the main loop.
        nodeRefund = Math.max(0, nodeRefund - (player.nodeFreePurchaseRecord?.[node.id] ?? 0))
        if (player.nodeFreePurchaseRecord) {
          delete player.nodeFreePurchaseRecord[node.id]
        }

        refund += nodeRefund

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

/**
 * Phap Tu Reimagined Task 4 — switch the route half of the atomic
 * (element, route) commitment. Out-of-combat only (the orchestration op
 * enforces the no-active-battle rule). For every node tagged with the
 * OLD route: level -> 0, nodeLevels/purchasedNodeIds entries cleared,
 * floor(actualPaid x 0.75) refunded using nodeFreePurchaseRecord
 * exactly like devResetBranch. Nodes tagged with the NEW route are not
 * auto-bought — the player re-invests. Untagged nodes are untouched.
 * No The-pool clear is needed: currentThe is battle-scoped (INV-14)
 * and switching is out-of-combat, so banked The cannot exist at switch
 * time (INV-16 holds by construction).
 * Returns total refunded.
 */
export function switchRoute(
  player: PlayerData,

  registry: { getAll(): ProgressionNode[] },

  route: PhapTuRoute,
): number {
  const oldRoute = player.phapTu.route

  // Review fix (HIGH-2): this is the only writer of phapTu.route besides
  // the atomic (element, route) commit in selectPhapTuElement — it needs
  // the same commitment gate. Without it a pre-commit call stamps route
  // onto {element: null} and permanently poisons selectPhapTuElement's
  // null-check invariant; a non-phap_tu player's dirty route state would
  // also leak universal route stats via getRouteStatModifiers.
  if (
    player.cultivationPath !== 'phap_tu' ||
    player.phapTu.element === null ||
    oldRoute === null ||
    oldRoute === route
  ) {
    return 0
  }

  let refund = 0

  for (const node of registry.getAll()) {
    if (node.routeTag !== oldRoute) {
      continue
    }

    const level = getNodeLevel(player, node.id)

    if (level <= 0) {
      continue
    }

    const paid = paidForNodeLevels(player, node)

    if (player.nodeFreePurchaseRecord) {
      delete player.nodeFreePurchaseRecord[node.id]
    }

    refund += Math.floor(paid * 0.75)

    delete player.nodeLevels[node.id]

    const index = player.purchasedNodeIds.indexOf(node.id)

    if (index !== -1) {
      player.purchasedNodeIds.splice(index, 1)
    }
  }

  player.skillInsight += refund

  player.phapTu.route = route

  return refund
}

/** Insight ACTUALLY paid into a node across its levels — Van Dao waived
 * amounts are deducted (same accounting as devResetBranch/switchRoute). */
function paidForNodeLevels(player: PlayerData, node: ProgressionNode): number {
  const level = getNodeLevel(player, node.id)

  let paid = 0

  for (let spent = 0; spent < level; spent++) {
    paid += getNextLevelCost(node, spent)
  }

  return Math.max(0, paid - (player.nodeFreePurchaseRecord?.[node.id] ?? 0))
}

export interface RouteSwitchPreview {
  /** floor(actualPaid x 0.75) summed over the old route's nodes. */
  refund: number

  /** The 25% respec tax — paid insight that is NOT returned. */
  forfeited: number

  /** Old-route nodes that would reset to level 0. */
  resetNodeCount: number
}

/**
 * Task 16 — read-only preview of switchRoute()'s refund math for the
 * "you regain X, lose Y" UI. Shares paidForNodeLevels with switchRoute
 * (A9 — one implementation); mutates nothing.
 */
export function previewRouteSwitch(
  player: PlayerData,

  registry: { getAll(): ProgressionNode[] },
): RouteSwitchPreview {
  const oldRoute = player.phapTu.route

  const preview: RouteSwitchPreview = { refund: 0, forfeited: 0, resetNodeCount: 0 }

  // Same gate as switchRoute (HIGH-2) — never preview a switch the
  // domain would reject.
  if (
    player.cultivationPath !== 'phap_tu' ||
    player.phapTu.element === null ||
    oldRoute === null
  ) {
    return preview
  }

  for (const node of registry.getAll()) {
    if (node.routeTag !== oldRoute || getNodeLevel(player, node.id) <= 0) {
      continue
    }

    const paid = paidForNodeLevels(player, node)
    const refund = Math.floor(paid * 0.75)

    preview.refund += refund
    preview.forfeited += paid - refund
    preview.resetNodeCount += 1
  }

  return preview
}
