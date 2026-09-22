import type { ElementType } from '../../core/element/ElementType'
import type { StatType } from '../../core/stats/StatTypes'
import type {
  NodePrerequisite,
  ProgressionNode,
} from '../../core/progression/ProgressionNode'
import type { StatModifier } from '../../core/stats/StatCalculator'
import { SPELL_KIT_IDS } from '../skill/Skills'
import { PHAP_TU_ULTIMATE_IDS } from '../skill/PhapTuUltimates'

// Phap Tu Reimagined (2026-09-15 plan, Task 6) — node builders for the
// new tree: 5 mutex element roots (committed atomically by
// GameManagerProgressionOps.selectSpellPathElement, NOT public purchase),
// growth + unlock lanes, The lanes, and route-tagged specialization
// (3 'dot' + 3 'no' + truong_the tagged 'no' per element).

/** Goc hanh — id giu nguyen tu cay cu de presentation/da ton tai giu ten. */
export const PHAP_TU_ELEMENT_ROOT_IDS: Record<ElementType, string> = {
  fire: 'hoa_linh_ngo',
  water: 'thuy_linh_ngo',
  wood: 'moc_linh_ngo',
  metal: 'kim_linh_ngo',
  earth: 'tho_linh_ngo',
}

export const TRUONG_THE_CAP_PER_LEVEL = 10

const ELEMENT_LABELS: Record<ElementType, string> = {
  fire: 'Hoa',
  water: 'Thuy',
  wood: 'Moc',
  metal: 'Kim',
  earth: 'Tho',
}

const ELEMENT_NAMES: Record<ElementType, string> = {
  fire: 'Hoa Linh Ngo',
  water: 'Thuy Linh Ngo',
  wood: 'Moc Linh Ngo',
  metal: 'Kim Linh Ngo',
  earth: 'Tho Linh Ngo',
}

function stat(
  nodeId: string,
  statKey: StatType,
  flat: number,
  perLevelFlat = 0,
): StatModifier {
  return {
    id: `${nodeId}_${statKey}`,
    sourceId: 'spell',
    sourceType: 'realm',
    stat: statKey,
    flat,
    perLevelFlat,
    domain: 'spell',
  }
}

function elementRoot(element: ElementType): ProgressionNode {
  const rootId = PHAP_TU_ELEMENT_ROOT_IDS[element]
  const excludes: NodePrerequisite[] = (
    Object.keys(PHAP_TU_ELEMENT_ROOT_IDS) as ElementType[]
  )
    .filter((other) => other !== element)
    .map((other) => ({ kind: 'excludesNode', nodeId: PHAP_TU_ELEMENT_ROOT_IDS[other] }))

  return {
    id: rootId,
    name: ELEMENT_NAMES[element],
    description: `Mo hanh ${ELEMENT_LABELS[element]} — chon nguyen to Phap Tu (atomic voi route, qua selectSpellPathElement).`,
    type: 'major',
    role: 'root',
    insightCost: 0,
    prerequisites: excludes,
    elementTag: element,
    effect: { unlocksSkillIds: [SPELL_KIT_IDS[element][0]] },
  }
}

function growth(
  id: string,
  name: string,
  description: string,
  element: ElementType,
  modifiers: StatModifier[],
  options: { maxLevel?: number; upgradeCost?: { base: number; perLevel: number }; prereqs?: NodePrerequisite[]; routeTag?: 'dot' | 'no'; levelGates?: ProgressionNode['levelGates'] } = {},
): ProgressionNode {
  return {
    id,
    name,
    description,
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: options.maxLevel ?? 5,
    upgradeCost: options.upgradeCost ?? { base: 1, perLevel: 2 },
    levelGates: options.levelGates,
    prerequisites: options.prereqs ?? [
      { kind: 'node', nodeId: PHAP_TU_ELEMENT_ROOT_IDS[element] },
    ],
    elementTag: element,
    routeTag: options.routeTag,
    effect: { statModifiers: modifiers },
  }
}

function unlockNode(
  skillId: string,
  name: string,
  description: string,
  element: ElementType,
  prereqNodeId: string,
  grantSkillIds?: readonly string[],
): ProgressionNode {
  return {
    id: `linh_ngo_${skillId}`,
    name,
    description,
    type: 'major',
    role: 'keystone',
    insightCost: 2,
    prerequisites: [{ kind: 'node', nodeId: prereqNodeId }],
    elementTag: element,
    effect: { unlocksSkillIds: [...(grantSkillIds ?? [skillId])] },
  }
}

export function buildElementBranch(element: ElementType): ProgressionNode[] {
  const [basicId, specialId, ultimateId] = SPELL_KIT_IDS[element]
  const godUltId = PHAP_TU_ULTIMATE_IDS[element]
  const label = ELEMENT_LABELS[element]

  return [
    elementRoot(element),

    // Power growth - elementPower tuyen tinh 10 cap. M-QI-06 authored
    // cap gates: deep mastery paces behind technique rank (mechanism-
    // proving set, not a balance pass).
    growth(
      `minor_${element}_intensity`,
      `${label} Luc`,
      `+2 ${element}Power ${label}/cap.`,
      element,
      [stat(`minor_${element}_intensity`, `${element}Power`, 2, 2)],
      {
        maxLevel: 10,
        upgradeCost: { base: 1, perLevel: 3 },
        levelGates: [
          { atLevel: 6, prerequisite: { kind: 'techniqueRank', rank: 3 } },
          { atLevel: 9, prerequisite: { kind: 'techniqueRank', rank: 6 } },
        ],
      },
    ),

    // Ailment-leaning growth (shared — ap dung bat ke route).
    growth(
      `${element}_ailment_mastery`,
      `${label} Chuong`,
      `+4% ailment potency, +3% ailment duration ${label}/cap.`,
      element,
      [
        stat(`${element}_ailment_mastery_pot`, 'ailmentPotencyPercent', 0.04, 0.04),
        stat(`${element}_ailment_mastery_dur`, 'ailmentDurationPercent', 0.03, 0.03),
      ],
    ),

    // Damage-leaning growth (shared).
    growth(
      `${element}_damage_mastery`,
      `${label} Sat`,
      `+5% skill damage ${label}/cap.`,
      element,
      [stat(`${element}_damage_mastery`, 'skillDamagePercent', 0.05, 0.05)],
    ),

    // Special unlock — gate realm Kim Dan. Grants the kit's remaining
    // slots together (special + chain-E ultimate): spec §7 has only two
    // unlock nodes per element, and the ult's BASE form must be castable
    // without the phap-tuong node (spec §3.3), so the ult cannot ride on
    // `linh_ngo_<godUlt>` itself.
    {
      ...unlockNode(
        specialId,
        `Linh Ngo ${label} Dac Biet`,
        `Mo khoa ky nang dac biet ${label}.`,
        element,
        PHAP_TU_ELEMENT_ROOT_IDS[element],
        [specialId, ultimateId],
      ),
      prerequisites: [
        { kind: 'node', nodeId: PHAP_TU_ELEMENT_ROOT_IDS[element] },
        { kind: 'realm', realmId: 'golden_core' },
      ],
    },

    // Phap Tuong (god-ult) unlock - sau special. M-QI-06 authored
    // unlock gate: god-ult mastery requires technique rank 5 (the
    // realm gate arrives transitively through linh_ngo_<special>).
    {
      ...unlockNode(
        godUltId,
        `Phap Tuong ${label}`,
        `Mo khoa Phap Tuong ${label} — gate cho ultimate empowerment.`,
        element,
        `linh_ngo_${specialId}`,
      ),
      insightCost: 3,
      prerequisites: [
        { kind: 'node', nodeId: `linh_ngo_${specialId}` },
        { kind: 'techniqueRank', rank: 5 },
      ],
    },

    // Tu The — The gain lane (basic + special +1/cap).
    {
      id: `tu_the_${element}`,
      name: `Tu The ${label}`,
      description: `+1 The per landed cast cho basic + special ${label}/cap.`,
      type: 'minor',
      role: 'growth',
      insightCost: 1,
      maxLevel: 5,
      upgradeCost: { base: 1, perLevel: 2 },
      prerequisites: [{ kind: 'node', nodeId: PHAP_TU_ELEMENT_ROOT_IDS[element] }],
      elementTag: element,
      effect: {
        turnSkillResourceModifiers: [
          { skillId: basicId, theGainOnLandedCast: 1 },
          { skillId: specialId, theGainOnLandedCast: 1 },
        ],
      },
    },

    // Truong The — route 'no', cap The +10/cap.
    {
      id: `truong_the_${element}`,
      name: `Truong The ${label}`,
      description: `+${TRUONG_THE_CAP_PER_LEVEL} max The/cap (route No).`,
      type: 'minor',
      role: 'specialization',
      insightCost: 1,
      maxLevel: 5,
      upgradeCost: { base: 1, perLevel: 2 },
      prerequisites: [{ kind: 'node', nodeId: PHAP_TU_ELEMENT_ROOT_IDS[element] }],
      elementTag: element,
      routeTag: 'no',
      effect: { theCapPerLevel: TRUONG_THE_CAP_PER_LEVEL },
    },

    // Route 'dot' specialization — 3 nodes.
    growth(
      `${element}_dot_potency`,
      `Dot Hoa ${label}`,
      `+6% ailment potency/cap (route Dot).`,
      element,
      [stat(`${element}_dot_potency`, 'ailmentPotencyPercent', 0.06, 0.06)],
      { routeTag: 'dot' },
    ),
    growth(
      `${element}_dot_duration`,
      `Dot Dien ${label}`,
      `+5% ailment duration/cap (route Dot).`,
      element,
      [stat(`${element}_dot_duration`, 'ailmentDurationPercent', 0.05, 0.05)],
      { routeTag: 'dot' },
    ),
    growth(
      `${element}_dot_chance`,
      `Dot Van ${label}`,
      `+4% element application/cap (route Dot).`,
      element,
      [stat(`${element}_dot_chance`, 'elementApplicationPercent', 0.04, 0.04)],
      { routeTag: 'dot' },
    ),

    // Route 'no' specialization — 3 nodes (ngoai truong_the).
    growth(
      `${element}_no_crit`,
      `No Tam ${label}`,
      `+2% crit rate/cap (route No).`,
      element,
      [stat(`${element}_no_crit`, 'criticalRate', 0.02, 0.02)],
      { routeTag: 'no' },
    ),
    growth(
      `${element}_no_critdmg`,
      `No Pha ${label}`,
      `+6% crit damage/cap (route No).`,
      element,
      [stat(`${element}_no_critdmg`, 'criticalDamage', 0.06, 0.06)],
      { routeTag: 'no' },
    ),
    growth(
      `${element}_no_damage`,
      `No Sat ${label}`,
      `+5% skill damage/cap (route No).`,
      element,
      [stat(`${element}_no_damage`, 'skillDamagePercent', 0.05, 0.05)],
      { routeTag: 'no' },
    ),
  ]
}
