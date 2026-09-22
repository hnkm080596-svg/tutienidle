import { describe, expect, it } from 'vitest'
import { skillCoreNodeId } from '../../core/progression/SkillCoreLevel'
import { SKILLS } from '../skill/Skills'
import { TALENT_PASSIVE_SKILLS } from '../skill/TalentPassives'
import { NATIVE_CORE_SKILL_IDS, SKILL_CORE_NODES } from './SkillCoreNodes'

// M-QI-05 / QI-D3 - the Core Node catalog IS the progression-metadata
// source. Every levelled Skill template gets exactly one generated
// core; the 14 eligible native top-level defs get authored cores;
// internal chained/stance/emblem/generated ids NEVER get cores.

const NATIVE_TOP_LEVEL_IDS = [
  'cuong_quyen',
  'loan_dau',
  'bat_tu_ba_the',
  'tran_ap',
  'son_nhac',
  'tham_the',
  'tu_the',
  'bach_ung',
  'ngu_kiem_thuat',
  'orb_dam',
  'orb_chem',
  'orb_bo',
  'orb_hat',
  'orb_quet',
] as const

const NATIVE_DAMAGE_BEARING = new Set([
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

const INTERNAL_NEGATIVE_LIST = [
  'phan_chinh',
  'phan_kich',
  'tro_kich',
  'trong_phan_kich',
] as const

const levelledTemplates = SKILLS.filter((skill) => skill.maxLevel > 1)
const fixedTemplates = SKILLS.filter((skill) => skill.maxLevel === 1)

describe('SkillCoreNodes — template coverage', () => {
  it('authors exactly one core per maxLevel>1 template (id/levelsSkillId/maxLevel)', () => {
    for (const template of levelledTemplates) {
      const coreId = skillCoreNodeId(template.id)
      const cores = SKILL_CORE_NODES.filter((node) => node.id === coreId)

      expect(cores, `template ${template.id}`).toHaveLength(1)
      expect(cores[0]!.levelsSkillId).toBe(template.id)
      expect(cores[0]!.maxLevel).toBe(template.maxLevel)
    }
  })

  it('zero cores for maxLevel:1 templates', () => {
    for (const template of fixedTemplates) {
      expect(
        SKILL_CORE_NODES.some((node) => node.levelsSkillId === template.id),
        `fixed template ${template.id} must not have a core`,
      ).toBe(false)
    }
  })

  it('no two nodes share levelsSkillId; levelsSkillId resolves to a template or the native whitelist', () => {
    const seen = new Set<string>()
    const templateIds = new Set(SKILLS.map((skill) => skill.id))
    const whitelist = new Set<string>([...NATIVE_TOP_LEVEL_IDS])

    for (const node of SKILL_CORE_NODES) {
      expect(node.levelsSkillId, `node ${node.id} must declare levelsSkillId`).toBeDefined()

      const skillId = node.levelsSkillId!

      expect(seen.has(skillId), `duplicate levelsSkillId ${skillId}`).toBe(false)
      seen.add(skillId)
      expect(
        templateIds.has(skillId) || whitelist.has(skillId),
        `levelsSkillId ${skillId} resolves to neither a template nor the native whitelist`,
      ).toBe(true)
      expect(node.id, `core id convention for ${skillId}`).toBe(skillCoreNodeId(skillId))
    }
  })

  it('cores carry no tags, prereqs, or effect payload', () => {
    for (const node of SKILL_CORE_NODES) {
      expect(node.branchTag, node.id).toBeUndefined()
      expect(node.routeTag, node.id).toBeUndefined()
      expect(node.elementTag, node.id).toBeUndefined()
      expect(node.prerequisites, node.id).toBeUndefined()
      expect(node.revealWhen, node.id).toBeUndefined()
      expect(node.effect, node.id).toEqual({})
    }
  })

  it('every core is the pinned major type (spec D2 semantic)', () => {
    for (const node of SKILL_CORE_NODES) {
      expect(node.type, node.id).toBe('major')
    }
  })
})

describe('SkillCoreNodes — native census', () => {
  it('whitelist export matches the 14 eligible native ids exactly', () => {
    expect([...NATIVE_CORE_SKILL_IDS].sort()).toEqual([...NATIVE_TOP_LEVEL_IDS].sort())
  })

  it('every eligible native def has an authored core with the maxLevel policy', () => {
    for (const skillId of NATIVE_TOP_LEVEL_IDS) {
      const core = SKILL_CORE_NODES.find((node) => node.id === skillCoreNodeId(skillId))

      expect(core, `native core for ${skillId}`).toBeDefined()
      expect(core!.levelsSkillId).toBe(skillId)

      const expectedMax = NATIVE_DAMAGE_BEARING.has(skillId) ? 10 : 1

      expect(core!.maxLevel, `${skillId} maxLevel`).toBe(expectedMax)
    }
  })

  it('internal negative-list ids never have cores', () => {
    for (const internalId of INTERNAL_NEGATIVE_LIST) {
      expect(
        SKILL_CORE_NODES.some((node) => node.id === skillCoreNodeId(internalId) || node.levelsSkillId === internalId),
        `internal ${internalId} must not have a core`,
      ).toBe(false)
    }
  })
})

describe('SkillCoreNodes — talent passives stay out', () => {
  it('no talent passive has a core (all fixed Lv1)', () => {
    for (const passive of TALENT_PASSIVE_SKILLS) {
      expect(passive.maxLevel, `talent passive ${passive.id}`).toBe(1)
      expect(SKILL_CORE_NODES.some((node) => node.levelsSkillId === passive.id)).toBe(false)
    }
  })
})
