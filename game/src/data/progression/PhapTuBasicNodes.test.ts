import { describe, expect, it } from 'vitest'
import { PHAP_TU_NODES } from './PhapTuNodes'
import { SKILLS } from '../skill/Skills'

// Phap Tu Reimagine (2026-09-26 spec sec.1.4 + openQuestion 5) -- the
// basic lane keeps ONLY skill-owned ailment channels
// (elementApplicationPercent / ailmentPotencyPercent /
// ailmentDurationPercent) plus the mutex capstone pairs; generic-stat
// nodes are cut. Kept contract pins: <=+10% per direction per maxed
// node, realm ring gates, minor-tier level gates, capstone mutex.

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

const ELEMENT_BY_CAPSTONE_PREFIX = new Map(
  BASIC_CAPSTONE_IDS.map((id) => [id, id.split('_basic_')[0]]),
)

const BASIC_LANE_IDS = PHAP_TU_NODES.filter((n) =>
  [
    'hoa_diem_chuan', 'hoa_an_sau', 'hoa_nhiet_keo', 'hoa_diem_tham',
    'thuy_diem_chuan', 'thuy_te_dam', 'thuy_luu_tich', 'thuy_nhiet_tri', 'thuy_te_tham',
    'moc_doc_sau', 'moc_doc_dien', 'moc_doc_tham',
    'moc_doc_man', 'moc_doc_nhuan', 'moc_doc_tu', 'moc_doc_am', 'moc_doc_nhiem',
    'kim_diem_chuan', 'kim_liet_huyet', 'kim_diem_tham',
    'tho_tran_sau', 'tho_tran_cung',
  ].includes(n.id) || BASIC_CAPSTONE_IDS.includes(n.id),
)

describe('PhapTu basic lane — reimagined contract', () => {
  it('every basic-lane node is leveled and chains to the element root', () => {
    // Glyph shape: trunk nodes prereq the element root (*_linh_ngo)
    // directly; ring/capstone nodes hang off a same-element basic-lane
    // node, so every chain resolves to the root.
    const laneIds = new Set(BASIC_LANE_IDS.map((n) => n.id))

    for (const node of BASIC_LANE_IDS) {
      expect(node.maxLevel ?? 1, node.id).toBeGreaterThanOrEqual(1)

      const target = node.prerequisites?.find((p) => p.kind === 'node')?.nodeId

      expect(target, node.id).toBeDefined()
      const onRoot = target!.endsWith('linh_ngo')
      const onLanePeer = laneIds.has(target!)
      expect(onRoot || onLanePeer, `${node.id} -> ${target}`).toBe(true)
    }
  })

  it('a maxed power node never exceeds +10% in one direction', () => {
    for (const node of BASIC_LANE_IDS) {
      const level = node.maxLevel ?? 1
      for (const mod of node.effect.statModifiers ?? []) {
        const total = (mod.flat ?? 0) + (mod.perLevelFlat ?? 0) * (level - 1)
        expect(total, `${node.id} ${mod.stat}`).toBeLessThanOrEqual(0.1 + 1e-9)
        // Level 1 must already pay out: per-level nodes with flat:0 are
        // a dead first purchase (engine adds perLevelFlat*(level-1)).
        const atLevelOne = (mod.flat ?? 0) + (mod.perLevelFlat ?? 0) * 0
        expect(atLevelOne, `${node.id} ${mod.stat} level-1 payout`).toBeGreaterThan(0)
      }
    }
  })

  it('all basic-lane stats stay on the ailment channel set (reimagine rule)', () => {
    const ailmentChannels = new Set([
      'elementApplicationPercent',
      'ailmentPotencyPercent',
      'ailmentDurationPercent',
    ])

    for (const node of BASIC_LANE_IDS) {
      for (const mod of node.effect.statModifiers ?? []) {
        expect(ailmentChannels.has(mod.stat), `${node.id} ${mod.stat}`).toBe(true)
      }
    }
  })

  it('apply-chance nodes reach a x1.10 multiplier at max (ApplicationResolver is multiplicative)', () => {
    // ApplicationResolver.resolve computes chance = baseChance x (1 + pool),
    // so the documented 'toi da +10% so voi goc' requires pool 0.10 at max.
    const APPLY_CHANCE_NODE_IDS = [
      'hoa_diem_chuan', 'thuy_diem_chuan', 'kim_diem_chuan',
      'hoa_diem_tham', 'kim_diem_tham',
    ]

    for (const nodeId of APPLY_CHANCE_NODE_IDS) {
      const node = PHAP_TU_NODES.find((n) => n.id === nodeId)!

      expect(node, nodeId).toBeDefined()

      const mod = node.effect.statModifiers?.find((m) => m.stat === 'elementApplicationPercent')

      expect(mod, `${nodeId} elementApplicationPercent`).toBeDefined()

      const pool = (mod?.flat ?? 0) + (mod?.perLevelFlat ?? 0) * ((node.maxLevel ?? 1) - 1)

      expect(pool, `${nodeId} pool at max`).toBeCloseTo(0.1, 9)
    }
  })

  it('outer-ring nodes gate on foundation_establishment; trunk nodes do not', () => {
    // The outer ring is pinned by explicit id: realm decides which nodes
    // open (foundation gate), techniqueRank only caps levels inside an
    // open node - trunk nodes carry rank gates but never the realm gate.
    const EXPECTED_OUTER = new Set([
      'hoa_nhiet_keo', 'hoa_diem_tham',
      'thuy_nhiet_tri', 'thuy_te_tham',
      'moc_doc_tham', 'moc_doc_man', 'moc_doc_am', 'moc_doc_nhiem',
      'kim_diem_tham',
      'tho_tran_cung',
      ...BASIC_CAPSTONE_IDS,
    ])

    const actualOuter = new Set(
      BASIC_LANE_IDS.filter((node) =>
        node.prerequisites?.some(
          (p) => p.kind === 'realm' && p.realmId === 'foundation_establishment',
        ),
      ).map((n) => n.id),
    )

    expect([...actualOuter].sort()).toEqual([...EXPECTED_OUTER].sort())
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
        // Same-element mutex only: a fire capstone must pair with the
        // other fire capstone, never a different element's variant.
        const element = nodeId.split('_basic_')[0]
        expect(mutex.nodeId.startsWith(`${element}_basic_`), `${nodeId} -> ${mutex.nodeId}`).toBe(true)
        expect(mutex.nodeId, nodeId).not.toBe(nodeId)
        expect(ELEMENT_BY_CAPSTONE_PREFIX.get(nodeId), nodeId).toBe(element)
      }
    }
  })

  it('every element gets a capstone pair', () => {
    for (const element of ELEMENTS) {
      const pair = BASIC_CAPSTONE_IDS.filter((id) => id.startsWith(`${element}_basic_`))
      expect(pair, element).toHaveLength(2)
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
