import type { ProgressionNode } from '../../core/progression/ProgressionNode'
import type { ElementType } from '../../core/element/ElementType'
import { ELEMENT_LABELS } from '../../core/element/ElementLabels'
import type { StatType } from '../../core/stats/StatTypes'

// Three-path design (2026-09-25, sec.4-b + ruling #19) -- realm-breakthrough
// rewards for the spell path are NODE GRANTS, not purchases: each way's
// realmRewards record hands out levels via grantedNodeLevels, and the
// rewardOnly flag keeps them out of purchase/upgrade/tree rendering.
//
// Grant kinds by way:
//   normal way  (spell_pathway)        -> mastery L1
//   hidden way  (hidden_spell_pathway) -> mastery L2
//
// Phap Tu Reimagine (2026-09-26 spec sec.1.4): the_thuc_tinh retired with
// the legacy The economy (The gain is stamped on the basic itself), and
// every rider stat must be a skill-owned channel -- metal's old
// skillDamagePercent ride is replaced by ailmentPotencyPercent now that
// the metal basic carries Liet Thuong. Fire/wood keep potency (Hoa An /
// Doc Can tick harder); water/earth keep duration (Han Tuc / Tran An
// last longer).
//
// tinh_thong_<e> carries elementTag so the standard element gate does the
// per-element pick for free: a thuan-he player only ever activates their
// committed element's mastery; an ngo_dao player (element === null)
// activates every granted mastery, matching the multicast kit.
const MASTERY_RIDER: Record<ElementType, { stat: StatType; perLevel: number }> = {
  fire: { stat: 'ailmentPotencyPercent', perLevel: 0.05 },
  water: { stat: 'ailmentDurationPercent', perLevel: 0.05 },
  wood: { stat: 'ailmentPotencyPercent', perLevel: 0.05 },
  metal: { stat: 'ailmentPotencyPercent', perLevel: 0.05 },
  earth: { stat: 'ailmentDurationPercent', perLevel: 0.05 },
}

export const TINH_THONG_NODE_IDS: Record<ElementType, string> = {
  fire: 'tinh_thong_hoa',
  water: 'tinh_thong_thuy',
  wood: 'tinh_thong_moc',
  metal: 'tinh_thong_kim',
  earth: 'tinh_thong_tho',
}



function masteryNode(element: ElementType): ProgressionNode {
  const { stat, perLevel } = MASTERY_RIDER[element]

  return {
    id: TINH_THONG_NODE_IDS[element],
    name: `Tinh Thông ${ELEMENT_LABELS[element]}`,
    description: `Mastery ${ELEMENT_LABELS[element]} — rider của mọi chiêu pháp ${ELEMENT_LABELS[element]} tăng theo cấp.`,
    type: 'minor',
    role: 'growth',
    insightCost: 0,
    maxLevel: 2,
    rewardOnly: true,
    elementTag: element,
    effect: {
      statModifiers: [
        {
          id: `${TINH_THONG_NODE_IDS[element]}_${stat}`,
          sourceId: 'spell',
          sourceType: 'realm',
          stat,
          flat: perLevel,
          perLevelFlat: perLevel,
          domain: 'spell',
        },
      ],
    },
  }
}

/**
 * Realm-reward grant nodes for the spell path. Mastery nodes carry no
 * requiredWay -- they must aggregate for both spell ways (a hidden-way
 * player is still cultivationPath 'spell').
 */
export function buildRealmRewardNodes(): ProgressionNode[] {
  const elements: ElementType[] = ['fire', 'water', 'wood', 'metal', 'earth']

  return elements.map(masteryNode).map((node) => ({
    ...node,
    requiredCultivationPath: 'spell',
  }))
}

/**
 * grantedNodeLevels entries covering all five element masteries at the
 * given level - the single id source (TINH_THONG_NODE_IDS), so way
 * definitions cannot drift from the registered reward nodes.
 */
export function masteryGrantRecord(level: number): Record<string, number> {
  return Object.fromEntries(
    Object.values(TINH_THONG_NODE_IDS).map((id) => [id, level]),
  )
}
