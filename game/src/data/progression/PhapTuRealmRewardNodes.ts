import type { ProgressionNode } from '../../core/progression/ProgressionNode'
import type { ElementType } from '../../core/element/ElementType'
import type { StatType } from '../../core/stats/StatTypes'

// Three-path design (2026-09-25, sec.4-b + ruling #19) -- realm-breakthrough
// rewards for the spell path are NODE GRANTS, not purchases: each way's
// realmRewards record hands out levels via grantedNodeLevels, and the
// rewardOnly flag keeps them out of purchase/upgrade/tree rendering.
//
// Two grant kinds, same grants different numbers:
//   normal way  (spell_pathway)        -> mastery L1 + the_thuc_tinh L1
//   hidden way  (hidden_spell_pathway) -> mastery L2 only
// (ngo_dao owns no The pool -- M4/R6 -- so the awakening grant would be a
// dead write there; the deeper mastery level is the hidden-way bump.)
//
// tinh_thong_<e> carries elementTag so the standard element gate does the
// per-element pick for free: a thuan-he player only ever activates their
// committed element's mastery; an ngo_dao player (element === null)
// activates every granted mastery, matching the multicast kit.
//
// Rider per element follows the M1 identity map: fire/wood = ailment
// potency (Hoa An / Doc Can tick harder), water/earth = ailment duration
// (Han Tuc / Tran An last longer), metal = skill damage (Kim is the
// burst line -- no DoT rider to amplify).
const MASTERY_RIDER: Record<ElementType, { stat: StatType; perLevel: number }> = {
  fire: { stat: 'ailmentPotencyPercent', perLevel: 0.05 },
  water: { stat: 'ailmentDurationPercent', perLevel: 0.06 },
  wood: { stat: 'ailmentPotencyPercent', perLevel: 0.05 },
  metal: { stat: 'skillDamagePercent', perLevel: 0.05 },
  earth: { stat: 'ailmentDurationPercent', perLevel: 0.06 },
}

const ELEMENT_LABELS: Record<ElementType, string> = {
  fire: 'Hoa',
  water: 'Thuy',
  wood: 'Moc',
  metal: 'Kim',
  earth: 'Tho',
}

export const THE_THUC_TINH_NODE_ID = 'the_thuc_tinh'
export const TINH_THONG_NODE_IDS: Record<ElementType, string> = {
  fire: 'tinh_thong_hoa',
  water: 'tinh_thong_thuy',
  wood: 'tinh_thong_moc',
  metal: 'tinh_thong_kim',
  earth: 'tinh_thong_tho',
}

const BASIC_IDS: Record<ElementType, string> = {
  fire: 'hoa_cau_thuat',
  water: 'thuy_tien_thuat',
  wood: 'doc_chuong',
  metal: 'diem_kim_thuat',
  earth: 'tho_cau_thuat',
}

function masteryNode(element: ElementType): ProgressionNode {
  const { stat, perLevel } = MASTERY_RIDER[element]

  return {
    id: TINH_THONG_NODE_IDS[element],
    name: `Tinh Thong ${ELEMENT_LABELS[element]}`,
    description: `Mastery ${ELEMENT_LABELS[element]} — rider cua basic ${ELEMENT_LABELS[element]} tang theo cap.`,
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

function awakeningNode(): ProgressionNode {
  return {
    id: THE_THUC_TINH_NODE_ID,
    name: 'Thuc Tinh Be The',
    description: 'Be The thuc tinh — basic landed cast bat dau nap The, tran The tang theo cap (spend van khoa Kim Dan).',
    type: 'minor',
    role: 'growth',
    insightCost: 0,
    maxLevel: 2,
    rewardOnly: true,
    effect: {
      turnSkillResourceModifiers: Object.values(BASIC_IDS).map((skillId) => ({
        skillId,
        theGainOnLandedCast: 1,
      })),
      theCapPerLevel: 10,
    },
  }
}

/**
 * Realm-reward grant nodes for the spell path. NOT spread into the
 * requiredWay 'spell_pathway' stamping map -- rewards must aggregate for
 * both spell ways (a hidden-way player is still cultivationPath 'spell'),
 * so they carry only requiredCultivationPath 'spell' and no requiredWay.
 */
export function buildRealmRewardNodes(): ProgressionNode[] {
  const elements: ElementType[] = ['fire', 'water', 'wood', 'metal', 'earth']

  return [
    ...elements.map(masteryNode),
    awakeningNode(),
  ].map((node) => ({
    ...node,
    requiredCultivationPath: 'spell',
  }))
}
