import { describe, expect, it } from 'vitest'
import { KIEM_TU_NODES } from './KiemTuNodes'
import { KIEM_PHO_ORBS, ORB_UNLOCK_REALM } from '../skill/KiemPhoOrbs'
import { KIEM_PHO_BUFFS } from '../buff/KiemPhoBuffs'

// Kiem Pho Beta (docs/specs/kiem-pho-beta-spec.md) - the tree under
// test: 8 kiem_pho nodes - one four-role branch per beta orb (Dam at
// qi_refining, Chem at foundation_establishment): Can (growth),
// Thuan Thuc (skill-scoped keystone), Kiem Ket (combo modifier on the
// completing orb), Lien Thuc (combo modifier on >=2 of that orb).
// Bo/Hat/Quet stay out of scope. The ngu branch (cascade unlocks,
// per-instance growth, Cuu Cung 3x3) under 'ngu_kiem' is unchanged.
// Every node carries requiredCultivationPath 'sword' + requiredWay
// ('sword_pathway' orbs / 'hidden_sword_pathway' subtree) stamped at
// export; beta nodes modify the SKILL via skillDefinitionModifiers /
// swordPathComboModifier, never the character.

const REALM_BY_INDEX = [
  'mortal',
  'qi_refining',
  'foundation_establishment',
  'golden_core',
  'nascent_soul',
  'soul_transformation',
] as const

const CUU_CUNG_OUTER_IDS = [
  'cuu_cung_kham',
  'cuu_cung_khon',
  'cuu_cung_chan',
  'cuu_cung_ton',
  'cuu_cung_can',
  'cuu_cung_doai',
  'cuu_cung_cin',
  'cuu_cung_ly',
] as const

function node(id: string) {
  const found = KIEM_TU_NODES.find(n => n.id === id)
  if (!found) throw new Error(`node ${id} missing from KIEM_TU_NODES`)
  return found
}

describe('KiemTuNodes - tree shape', () => {
  it('unique node ids', () => {
    const ids = KIEM_TU_NODES.map(n => n.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('no retired legacy ids survive in the tree', () => {
    const retired = /^(kiem_tran_|bat_kiem|onhit_|passive_ngu_kiem|passive_van_kiem|passive_thai_hu|passive_phieu_van|passive_pha_thien|minor_tran_|minor_bat_)/
    const survivors = KIEM_TU_NODES.filter(n => retired.test(n.id)).map(n => n.id)
    expect(survivors).toEqual([])
    expect(KIEM_TU_NODES.find(n => n.id === 'bat_kiem_an')).toBeUndefined()
    expect(KIEM_TU_NODES.find(n => n.id === 'bat_kiem_thuc')).toBeUndefined()
  })

  it('every node lives on kiem_pho or ngu_kiem', () => {
    for (const n of KIEM_TU_NODES) {
      expect(['kiem_pho', 'ngu_kiem']).toContain(n.branchTag)
    }
  })
})

describe('KiemTuNodes - kiem_pho beta branches (hien)', () => {
  // Kiem Pho Beta (design sec.10-12): exactly the 8 authored beta
  // nodes; the legacy orb_* growth/capstone ids are retired.
  const BETA_IDS = [
    'thich_can', 'nhat_diem', 'quy_tuyen', 'lien_thich',
    'tram_can', 'thuong_tham', 'luu_ngan', 'lien_tram',
  ]

  it('the kiem_pho branch is exactly the 8 beta nodes - no legacy orb ids remain', () => {
    const kiemPho = KIEM_TU_NODES.filter(n => n.branchTag === 'kiem_pho').map(n => n.id)
    expect([...kiemPho].sort()).toEqual([...BETA_IDS].sort())
    expect(
      KIEM_TU_NODES.some(
        n => /^orb_(dam|chem|bo|hat|quet)_\d+$/.test(n.id) || n.id.endsWith('_capstone'),
      ),
    ).toBe(false)
  })

  it('no kiem_pho node carries statModifiers - nodes modify the SKILL, never the character (design sec.16.A)', () => {
    for (const n of KIEM_TU_NODES.filter(n => n.branchTag === 'kiem_pho')) {
      expect(n.effect.statModifiers).toBeUndefined()
    }
  })

  it('branch shape per orb: Can realm-gated at the orb unlock realm, Thuan Thuc/Kiem Ket prereq Can, Lien Thuc prereq both', () => {
    const branches = [
      ['orb_dam', 'thich_can', 'nhat_diem', 'quy_tuyen', 'lien_thich'],
      ['orb_chem', 'tram_can', 'thuong_tham', 'luu_ngan', 'lien_tram'],
    ] as const
    for (const [orb, can, thuanThuc, kiemKet, lienThuc] of branches) {
      const gateRealm = REALM_BY_INDEX[ORB_UNLOCK_REALM[orb]]
      const canNode = node(can)
      expect(canNode.requiredCultivationPath).toBe('sword')
      expect(canNode.requiredWay).toBe('sword_pathway')
      expect(canNode.prerequisites).toContainEqual({ kind: 'realm', realmId: gateRealm })
      expect(canNode.type).toBe('minor')
      expect(canNode.role).toBe('growth')

      for (const id of [thuanThuc, kiemKet, lienThuc]) {
        const n = node(id)
        expect(n.requiredCultivationPath).toBe('sword')
        expect(n.requiredWay).toBe('sword_pathway')
        expect(n.type).toBe('major')
      }
      expect(node(thuanThuc).prerequisites).toContainEqual({ kind: 'node', nodeId: can })
      expect(node(kiemKet).prerequisites).toContainEqual({ kind: 'node', nodeId: can })
      const lienPrereqs = node(lienThuc).prerequisites
      expect(lienPrereqs).toContainEqual({ kind: 'node', nodeId: thuanThuc })
      expect(lienPrereqs).toContainEqual({ kind: 'node', nodeId: kiemKet })
    }
  })

  it('Can nodes carry per-level skillDefinitionModifiers on their own orb', () => {
    expect(node('thich_can').effect.skillDefinitionModifiers).toContainEqual(
      expect.objectContaining({ skillId: 'orb_dam' }),
    )
    expect(node('tram_can').effect.skillDefinitionModifiers).toContainEqual(
      expect.objectContaining({ skillId: 'orb_chem' }),
    )
  })
})

describe('KiemTuNodes - ngu branch', () => {
  it('no kiem_tu_an flip node exists - way entry is ritual-only (M6)', () => {
    expect(KIEM_TU_NODES.find(n => n.id === 'kiem_tu_an')).toBeUndefined()
    // The retired effect field is gone from every node.
    for (const n of KIEM_TU_NODES) {
      expect('kiemTuModeSwitch' in n.effect).toBe(false)
    }
  })

  it('cascade unlock nodes: a @ foundation, e @ golden_core, d @ nascent_soul', () => {
    const expected: Array<[string, 'a' | 'e' | 'd', string]> = [
      ['ngu_cascade_a', 'a', 'foundation_establishment'],
      ['ngu_cascade_e', 'e', 'golden_core'],
      ['ngu_cascade_d', 'd', 'nascent_soul'],
    ]
    for (const [id, unlock, realmId] of expected) {
      const n = node(id)
      expect(n.branchTag).toBe('ngu_kiem')
      expect(n.requiredCultivationPath).toBe('sword')
      expect(n.requiredWay).toBe('hidden_sword_pathway')
      expect(n.effect.cascadeUnlock).toBe(unlock)
      expect(n.prerequisites).toContainEqual({ kind: 'realm', realmId })
    }
  })

  it('every ngu node is way-stamped (requiredWay ngu + requiredCultivationPath sword) and never prereqs the retired flip node', () => {
    const nguNodes = KIEM_TU_NODES.filter(n => n.branchTag === 'ngu_kiem')
    expect(nguNodes.length).toBeGreaterThan(0)
    for (const n of nguNodes) {
      expect(n.requiredCultivationPath).toBe('sword')
      expect(n.requiredWay).toBe('hidden_sword_pathway')
      const nodePrereqs = (n.prerequisites ?? []).filter(p => p.kind === 'node')
      // No 'node' prereq may point at the retired kiem_tu_an flip node;
      // in-branch node links (none today) stay legal.
      expect(nodePrereqs.every(p => p.nodeId !== 'kiem_tu_an')).toBe(true)
    }
  })
})

describe('KiemTuNodes - Cuu Cung 3x3', () => {
  it('8 outer kiemYGrant nodes, each realm-gated, cap-guarded, way-stamped ngu', () => {
    for (const id of CUU_CUNG_OUTER_IDS) {
      const n = node(id)
      expect(n.branchTag).toBe('ngu_kiem')
      expect(n.requiredCultivationPath).toBe('sword')
      expect(n.requiredWay).toBe('hidden_sword_pathway')
      expect(n.effect.kiemYGrant).toBeGreaterThan(0)
      expect(n.prerequisites).toContainEqual({ kind: 'kiemDaoBelowCap' })
      expect((n.prerequisites ?? []).some(p => p.kind === 'realm')).toBe(true)
    }
  })

  it('trung_cung grants +1 kiemDaoCount, requires all 8 outers, cap-guarded', () => {
    const trung = node('cuu_cung_trung')
    expect(trung.branchTag).toBe('ngu_kiem')
    expect(trung.requiredCultivationPath).toBe('sword')
    expect(trung.requiredWay).toBe('hidden_sword_pathway')
    expect(trung.effect.kiemDaoGrant).toBe(1)
    expect(trung.prerequisites).toContainEqual({
      kind: 'nodeCount',
      nodeIds: [...CUU_CUNG_OUTER_IDS],
      countRequired: 8,
    })
    expect(trung.prerequisites).toContainEqual({ kind: 'kiemDaoBelowCap' })
  })
})

describe('KiemTuNodes - swordPathComboModifier predicate contract (DEC-6)', () => {
  it('every authored combo modifier carries at least one predicate', () => {
    for (const n of KIEM_TU_NODES) {
      const m = n.effect.swordPathComboModifier
      if (!m) continue
      expect(
        m.minOrbCount !== undefined || m.completingOrb !== undefined,
        `${n.id} authors a swordPathComboModifier with no predicate - it can never match`,
      ).toBe(true)
    }
  })
})


describe('KiemTuNodes - authored-id resolution contract', () => {
  // A typo'd skillId/buffId matches nothing at fold and the purchased
  // node is silently inert - authored ids must resolve against the
  // authored registries, same as the DEC-6 predicate pin's sibling.
  it('every skillDefinitionModifiers.skillId resolves against KIEM_PHO_ORBS', () => {
    for (const n of KIEM_TU_NODES) {
      for (const m of n.effect.skillDefinitionModifiers ?? []) {
        expect(
          m.skillId in KIEM_PHO_ORBS,
          `${n.id} targets unknown skillId ${m.skillId} - node would be silently inert`,
        ).toBe(true)
      }
    }
  })

  it('every swordPathComboModifier authored id resolves against the registries', () => {
    // F-KP-9-1 - the combo channel carries the same registry-keyed ids:
    // completingOrb/minOrbCount.orb vs KIEM_PHO_ORBS; appliesBuff
    // .definitionId and ailmentInteractions[].buffId vs KIEM_PHO_BUFFS.
    const buffIds = new Set(KIEM_PHO_BUFFS.map(b => b.id))
    for (const n of KIEM_TU_NODES) {
      const m = n.effect.swordPathComboModifier
      if (!m) continue
      if (m.completingOrb !== undefined) {
        expect(
          m.completingOrb in KIEM_PHO_ORBS,
          `${n.id} completingOrb ${m.completingOrb} unknown - predicate can never match`,
        ).toBe(true)
      }
      if (m.minOrbCount !== undefined) {
        expect(
          m.minOrbCount.orb in KIEM_PHO_ORBS,
          `${n.id} minOrbCount.orb ${m.minOrbCount.orb} unknown - predicate can never match`,
        ).toBe(true)
      }
      if (m.appliesBuff !== undefined) {
        expect(
          buffIds.has(m.appliesBuff.definitionId),
          `${n.id} appliesBuff ${m.appliesBuff.definitionId} unknown - application binds no instance`,
        ).toBe(true)
      }
      for (const i of m.ailmentInteractions ?? []) {
        expect(
          buffIds.has(i.buffId),
          `${n.id} interaction buffId ${i.buffId} unknown - interaction binds no instance`,
        ).toBe(true)
      }
    }
  })

  it('every addAilmentInteractions buffId resolves against KIEM_PHO_BUFFS', () => {
    const buffIds = new Set(KIEM_PHO_BUFFS.map(b => b.id))
    for (const n of KIEM_TU_NODES) {
      for (const m of n.effect.skillDefinitionModifiers ?? []) {
        for (const i of m.addAilmentInteractions ?? []) {
          expect(
            buffIds.has(i.buffId),
            `${n.id} targets unknown buffId ${i.buffId} - interaction would bind no instance`,
          ).toBe(true)
        }
      }
    }
  })
})
