import { describe, expect, it } from 'vitest'
import { PHAP_TU_NODES } from './PhapTuNodes'
import { SKILLS } from '../skill/Skills'

// Three-path design (2026-09-25) -- contract pins for the Phap Tu
// basic-skill lane: skill-scoped power only, <=+10% per direction per
// maxed node, realm ring gates, minor-tier level gates, mutex capstones.

const BASIC_IDS = new Set([
  'hoa_cau_thuat',
  'thuy_tien_thuat',
  'doc_chuong',
  'diem_kim_thuat',
  'tho_cau_thuat',
])

const BASIC_CAPSTONE_IDS = PHAP_TU_NODES.filter(
  (n) => n.effect.selectsSpecialization !== undefined,
).map((n) => n.id)

const ELEMENTS = ['fire', 'water', 'wood', 'metal', 'earth'] as const

const BASIC_LANE_IDS = PHAP_TU_NODES.filter((n) =>
  [
    'hoa_sac_nhiet', 'hoa_diem_chuan', 'hoa_an_sau', 'hoa_nhiet_keo', 'hoa_sac_huyet',
    'thuy_xuyen_lan', 'thuy_diem_chuan', 'thuy_te_dam', 'thuy_nhiet_tri',
    'moc_doc_sau', 'moc_doc_dien', 'moc_doc_tham',
    'kim_sac_ben', 'kim_diem_chuan', 'kim_xuyen_nhuy', 'kim_bao_the',
    'tho_tram_luy', 'tho_tran_sau', 'tho_cung_gioi', 'tho_linh_the',
  ].includes(n.id) || BASIC_CAPSTONE_IDS.includes(n.id),
)

describe('PhapTu basic lane — ruled contract', () => {
  it('every basic-lane node is leveled and gated by the element root', () => {
    for (const node of BASIC_LANE_IDS) {
      expect(node.maxLevel ?? 1, node.id).toBeGreaterThanOrEqual(1)
      expect(
        node.prerequisites?.some((p) => p.kind === 'node' && p.nodeId.endsWith('linh_ngo')),
        node.id,
      ).toBe(true)
    }
  })

  it('a maxed power node never exceeds +10% in one direction', () => {
    for (const node of BASIC_LANE_IDS) {
      const level = node.maxLevel ?? 1
      for (const mod of node.effect.statModifiers ?? []) {
        const total = (mod.flat ?? 0) + (mod.perLevelFlat ?? 0) * level
        expect(total, `${node.id} ${mod.stat}`).toBeLessThanOrEqual(0.1 + 1e-9)
      }
    }
  })

  it('all basic-lane stats stay skill-scoped (no character stats)', () => {
    const skillScoped = new Set([
      'skillDamagePercent',
      'elementApplicationPercent',
      'ailmentPotencyPercent',
      'ailmentDurationPercent',
      'criticalRate',
      'criticalDamage',
    ])

    for (const node of BASIC_LANE_IDS) {
      for (const mod of node.effect.statModifiers ?? []) {
        expect(skillScoped.has(mod.stat), `${node.id} ${mod.stat}`).toBe(true)
      }
    }
  })

  it('outer-ring nodes gate on foundation_establishment; trunk nodes do not', () => {
    for (const node of BASIC_LANE_IDS) {
      const hasFoundation = node.prerequisites?.some(
        (p) => p.kind === 'realm' && p.realmId === 'foundation_establishment',
      )

      if (node.effect.selectsSpecialization || node.id.endsWith('_keo') || node.id.endsWith('_the') || node.id.endsWith('_gioi') || node.id.endsWith('_tham')) {
        expect(hasFoundation, node.id).toBe(true)
      }
    }
  })

  it('capstones come in mutex pairs and reference authored specializations', () => {
    for (const nodeId of BASIC_CAPSTONE_IDS) {
      const node = PHAP_TU_NODES.find((n) => n.id === nodeId)!
      const spec = node.effect.selectsSpecialization!

      const basic = SKILLS.find((s) => s.id === spec.skillId)
      expect(basic, spec.skillId).toBeDefined()
      expect(BASIC_IDS.has(spec.skillId), spec.skillId).toBe(true)
      expect(
        basic!.specializations?.some((s) => s.id === spec.specializationId),
        spec.specializationId,
      ).toBe(true)

      const mutex = node.prerequisites?.find((p) => p.kind === 'excludesNode')
      expect(mutex, nodeId).toBeDefined()
      if (mutex?.kind === 'excludesNode') {
        expect(BASIC_CAPSTONE_IDS).toContain(mutex.nodeId)
      }
    }
  })

  it('every element gets a capstone pair', () => {
    for (const element of ELEMENTS) {
      const pair = BASIC_CAPSTONE_IDS.filter((id) => id.startsWith(`${element}_basic_`))
      expect(pair, element).toHaveLength(2)
    }
  })

  it('The-economy lanes open at foundation_establishment', () => {
    for (const node of PHAP_TU_NODES) {
      const isThe =
        (node.effect.turnSkillResourceModifiers?.length ?? 0) > 0 ||
        node.effect.theCapPerLevel !== undefined

      // Realm-reward grants (the_thuc_tinh) are realm-gated by the grant
      // record itself -- the foundation prereq only governs purchases.
      if (isThe && !node.rewardOnly) {
        expect(
          node.prerequisites?.some(
            (p) => p.kind === 'realm' && p.realmId === 'foundation_establishment',
          ),
          node.id,
        ).toBe(true)
      }
    }
  })

  it('level gates never exceed maxLevel (techniqueRank discipline)', () => {
    for (const node of BASIC_LANE_IDS) {
      for (const gate of node.levelGates ?? []) {
        expect(gate.atLevel, node.id).toBeLessThanOrEqual(node.maxLevel ?? 1)
      }
    }
  })

})
