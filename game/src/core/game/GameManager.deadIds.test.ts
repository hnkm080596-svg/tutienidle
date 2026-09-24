import { describe, expect, it } from 'vitest'
import { createDefaultPlayer } from '../player/Player'
import { SKILLS } from '../../data/skill/Skills'
import { CORE_SKILLS } from '../../data/skill/CoreSkills'
import { buffs } from '../../data/buff/buffs'
import { BOSS_BUFFS } from '../../data/buff/BossBuffs'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'
import { PHAP_TU_AN_NODES } from '../../data/progression/PhapTuAnNodes'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { THE_TU_NODES } from '../../data/progression/TheTuNodes'
import { THE_TU_AN_NODES } from '../../data/progression/TheTuAnNodes'
import { TURN_SKILL_DISPLAY_META } from '../../data/skill/TurnSkillDisplayMeta'
import { COMPANIONS } from '../../data/companion/Companions'

// Phap Tu Reimagined Task 14 (INV-12) — retired ids must not survive in
// ANY registry or content table a fresh save loads. The kill list is
// data-level: the legacy reaction-path chain (Ngũ Hành Luân Chuyển /
// Ngũ Hành Hợp Nhất marker pair + the reaction_empowerment self-buff),
// the thuan_he node family (lap_dao_thuan_*/thuan_* node ids,
// reaction_path_unlock_* keystones), and the old element authority
// (unlockedElements/equippedElements on PlayerData).

const RETIRED_IDS = [
  'phap_tu_reaction_special',
  'phap_tu_reaction_ultimate',
  'reaction_empowerment',
] as const

const RETIRED_ID_PATTERNS = [
  /^reaction_path_unlock_/,
  /^lap_dao_thuan_/,
  /^thuan_(kim|moc|thuy|hoa|tho)/,
] as const

function collectIds(): { label: string; ids: string[] }[] {
  const buffIds = [...buffs, ...BOSS_BUFFS].map((buff) => buff.id)
  const nodeIds = [...PHAP_TU_NODES, ...PHAP_TU_AN_NODES, ...KIEM_TU_NODES].map((node) => node.id)
  const companionSkillIds = COMPANIONS.flatMap((companion) =>
    [companion.basic.id, companion.special?.id, companion.ultimate?.id].filter(
      (id): id is string => typeof id === 'string',
    ),
  )

  return [
    { label: 'SKILLS', ids: SKILLS.map((skill) => skill.id) },
    { label: 'CORE_SKILLS', ids: CORE_SKILLS.map((skill) => skill.id) },
    { label: 'buffs', ids: buffIds },
    { label: 'nodes', ids: nodeIds },
    { label: 'TURN_SKILL_DISPLAY_META', ids: Object.keys(TURN_SKILL_DISPLAY_META) },
    { label: 'COMPANIONS', ids: companionSkillIds },
  ]
}

describe('INV-12 — retired ids are absent from every live registry', () => {
  it('no retired id or pattern appears in skills/buffs/nodes/display-meta/companions', () => {
    const violations: string[] = []

    for (const { label, ids } of collectIds()) {
      for (const id of ids) {
        if ((RETIRED_IDS as readonly string[]).includes(id) || RETIRED_ID_PATTERNS.some((pattern) => pattern.test(id))) {
          violations.push(`${label}: ${id}`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('no buff references a retired buff id (reaction_empowerment convertsToId/effects)', () => {
    for (const buff of [...buffs, ...BOSS_BUFFS]) {
      expect(buff.convertsToId).not.toBe('reaction_empowerment')
    }
  })

  it('fresh PlayerData carries no legacy element authority fields', () => {
    const player = createDefaultPlayer()
    const record = player as unknown as Record<string, unknown>

    expect('unlockedElements' in record).toBe(false)
    expect('equippedElements' in record).toBe(false)
  })

  it('no progression node uses the retired element authority (unlocksElement / element prerequisite)', () => {
    for (const node of [...PHAP_TU_NODES, ...PHAP_TU_AN_NODES, ...KIEM_TU_NODES]) {
      const effect = node.effect as Record<string, unknown>

      expect(effect.unlocksElement, `${node.id} still unlocksElement`).toBeUndefined()

      for (const prerequisite of node.prerequisites ?? []) {
        expect(prerequisite.kind, `${node.id} still gates on kind:element`).not.toBe('element')
      }
    }
  })

  // M-QI-06 - constrained-authoring guard: the minimal proving set may
  // carry techniqueRank gates on exactly the listed ids (9 unlock nodes
  // in `prerequisites`, 8 cap nodes in `levelGates`); techniqueGrade and
  // revealWhen technique gates remain forbidden everywhere until a later
  // content mission extends the allowlist.
  // Three-path design (2026-09-25, ruling #8): the Phap Tu basic lane
  // extends the cap allowlist -- the minor tier inside a realm decides
  // the level cap, so every leveled basic node carries techniqueRank
  // levelGates by contract.
  const TECHNIQUE_UNLOCK_ALLOWLIST = new Set([
    'linh_ngo_tat_phuong_giang_the',
    'linh_ngo_bat_thu_can_quet',
    'linh_ngo_kien_moc_thong_thien',
    'linh_ngo_kim_phat_thu_sat',
    'linh_ngo_hau_tho_thanh_luy',
    'major_bat_tu_tuc_menh',
    'major_loan_dau_sat',
    'major_khiem_khich_dien',
    'major_son_nhac_bao_bi',
  ])
  const TECHNIQUE_CAP_ALLOWLIST = new Set([
    'minor_fire_intensity',
    'minor_water_intensity',
    'minor_wood_intensity',
    'minor_metal_intensity',
    'minor_earth_intensity',
    'ngu_kiem_sac',
    'ngu_kiem_phong',
    'ngu_kiem_sat',
    // Phap Tu basic lane (ruling #8 minor-tier caps).
    'hoa_sac_nhiet',
    'hoa_diem_chuan',
    'hoa_an_sau',
    'hoa_nhiet_keo',
    'hoa_sac_huyet',
    'thuy_xuyen_lan',
    'thuy_diem_chuan',
    'thuy_te_dam',
    'thuy_nhiet_tri',
    'moc_doc_sau',
    'moc_doc_dien',
    'moc_doc_tham',
    'kim_sac_ben',
    'kim_diem_chuan',
    'kim_xuyen_nhuy',
    'kim_bao_the',
    'tho_tram_luy',
    'tho_tran_sau',
    'tho_cung_gioi',
    'tho_linh_the',
  ])

  it('technique gates stay inside the M-QI-06 authored allowlist', () => {
    const allNodes = [
      ...PHAP_TU_NODES,
      ...PHAP_TU_AN_NODES,
      ...KIEM_TU_NODES,
      ...THE_TU_NODES,
      ...THE_TU_AN_NODES,
    ]

    for (const node of allNodes) {
      for (const prerequisite of node.prerequisites ?? []) {
        if (prerequisite.kind === 'techniqueRank') {
          expect(
            TECHNIQUE_UNLOCK_ALLOWLIST.has(node.id),
            `${node.id} authors a techniqueRank prerequisite outside the M-QI-06 allowlist`,
          ).toBe(true)
        } else {
          expect(
            prerequisite.kind === 'techniqueGrade',
            `${node.id} authors a techniqueGrade prerequisite before content missions allow it`,
          ).toBe(false)
        }
      }

      for (const gate of node.levelGates ?? []) {
        if (gate.prerequisite.kind === 'techniqueRank') {
          expect(
            TECHNIQUE_CAP_ALLOWLIST.has(node.id),
            `${node.id} authors a techniqueRank levelGate outside the M-QI-06 allowlist`,
          ).toBe(true)
        } else {
          expect(
            gate.prerequisite.kind === 'techniqueGrade',
            `${node.id} authors a techniqueGrade levelGate before content missions allow it`,
          ).toBe(false)
        }
      }

      if (node.revealWhen) {
        expect(
          node.revealWhen.kind === 'techniqueRank' || node.revealWhen.kind === 'techniqueGrade',
          `${node.id} authors a technique reveal gate before content missions allow it`,
        ).toBe(false)
      }
    }
  })
})
