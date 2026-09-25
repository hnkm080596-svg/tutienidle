import type { ProgressionNode } from '../../core/progression/ProgressionNode'
import { skillCoreNodeId } from '../../core/progression/SkillCoreLevel'
import { SKILLS } from '../skill/Skills'
import { turnSkillDisplayMetaOf } from '../skill/TurnSkillDisplayMeta'

// M-QI-05 / QI-D3 - the Core Node catalog IS the progression-metadata
// source: `player.nodeLevels[core_<skillId>]` is the only writable
// skill-level authority, and this file is the only place cores are
// declared.
//
// Three classes:
//  1. Generated template cores - one per authored Skill template with
//     maxLevel > 1 (id/maxLevel mirror the template; drift is a data
//     bug pinned by SkillCoreNodes.test.ts).
//  2. Authored native cores - the 16 eligible top-level native
//     TurnSkillDefinition ids below (the census whitelist). Damage-
//     bearing defs get maxLevel 10 + damage.levelScaling 0.05;
//     non-damage defs get maxLevel 1 (canonical at Lv1, Insight-
//     rejected - a direct progression channel must be authored before
//     the cap rises).
//  3. NOTHING ELSE - levelsSkillId must never target an internal
//     chained/stance/emblem/reactive/generated sub-action (phan_chinh,
//     phan_kich, tro_kich, trong_phan_kich, ngu_kiem emblem defs,
//     combo extras). Internal actions inherit their parent's Core
//     level via TurnSkillDefinition.progressionOwnerId. Extending the
//     native whitelist requires an eligibility note here AND updating
//     the census test.

/** The 16 eligible native top-level def ids (QI-D3 census).
    Beta: phan_chan is the castable Tran The special (non-damage core);
    the emblem def phan_chinh is retired (internal sub-actions stay
    ineligible). bat_tu_ba_the / son_nhac keep authored cores - parked
    post-beta content, granted by no beta node.
    Ung The beta: tu_the / bach_ung cores stay PARKED-REGISTERED (defs
    superseded, granted by nothing in beta); quan_the is the Truc Co
    special granted by major_quan_the's grantsSkillCoreIds - its Core
    Level is the authored scaling axis for the cast's initial The gain,
    so it carries a REAL level channel (non-damage but maxLevel > 1: see
    NATIVE_LEVEL_SCALED). */
export const NATIVE_CORE_SKILL_IDS = [
  // body_pathway kits - granted by the kit roots'/majors'
  // grantsSkillCoreIds
  'cuong_quyen',
  'loan_dau',
  'bat_tu_ba_the',
  'tran_ap',
  'phan_chan',
  'son_nhac',
  // hidden_body_pathway - tham_the granted by way.coreSkillIds;
  // quan_the granted by the major_quan_the node's grantsSkillCoreIds;
  // tu_the/bach_ung parked (granted by nothing in beta)
  'tham_the',
  'tu_the',
  'bach_ung',
  'quan_the',
  // hidden_sword_pathway provider action - way.coreSkillIds
  'ngu_kiem_thuat',
  // sword_pathway orb actions - way.coreSkillIds
  'orb_dam',
  'orb_chem',
  'orb_bo',
  'orb_hat',
  'orb_quet',
] as const

/** Native defs whose damage channel carries levelScaling: 0.05. */
const NATIVE_DAMAGE_BEARING: ReadonlySet<string> = new Set([
  'cuong_quyen',
  'loan_dau',
  'tran_ap',
  'tham_the',
  'ngu_kiem_thuat',
  'orb_dam',
  'orb_chem',
  'orb_bo',
  'orb_hat',
  'orb_quet',
])

/** Non-damage native defs with an AUTHORED core-level progression
    channel (quan_the: Core Level scales the cast's theGainOnLandedCast
    The seed - baked at kit build, design Part V). */
const NATIVE_LEVEL_SCALED: ReadonlySet<string> = new Set(['quan_the'])

function coreNode(skillId: string, name: string, description: string | undefined, maxLevel: number): ProgressionNode {
  return {
    id: skillCoreNodeId(skillId),
    name: `Core: ${name}`,
    description,
    // Spec D2 - 'major' is the pinned semantic type for every Core.
    type: 'major',
    insightCost: 0,
    maxLevel,
    levelsSkillId: skillId,
    effect: {},
  }
}

const templateCores: ProgressionNode[] = SKILLS.filter((skill) => skill.maxLevel > 1).map((skill) =>
  coreNode(skill.id, skill.name, skill.description, skill.maxLevel),
)

const nativeCores: ProgressionNode[] = NATIVE_CORE_SKILL_IDS.map((skillId) => {
  const meta = turnSkillDisplayMetaOf(skillId)

  return coreNode(
    skillId,
    meta?.name ?? skillId,
    meta?.description,
    NATIVE_DAMAGE_BEARING.has(skillId) || NATIVE_LEVEL_SCALED.has(skillId) ? 10 : 1,
  )
})

export const SKILL_CORE_NODES: readonly ProgressionNode[] = [...templateCores, ...nativeCores]
