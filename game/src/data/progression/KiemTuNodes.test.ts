import { describe, expect, it } from 'vitest'
import { KIEM_TU_NODES } from './KiemTuNodes'
import { ORB_UNLOCK_REALM } from '../skill/KiemPhoOrbs'
import type { OrbId } from '../../core/kiem-tu/KiemTuState'

// Kiem Tu Reimagined Task 11 (spec 2026-09-15 §6) — the reimagined
// tree: 5 orb branches (growth + combo capstone) under 'kiem_pho',
// and the ngu branch (cascade unlocks, per-instance growth, Cuu Cung
// 3x3) under 'ngu_kiem'. The legacy Kiem Tran / Bat Kiem node set is
// gone (Task 12 teardown). Cultivation Path Framework M6: the
// kiem_tu_an flip node is retired — way entry is ritual-only and every
// node carries requiredCultivationPath 'kiem_tu' + requiredWay
// ('hien' orbs / 'ngu' subtree) stamped at export.

const ORB_IDS: OrbId[] = ['orb_dam', 'orb_chem', 'orb_bo', 'orb_hat', 'orb_quet']
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

describe('KiemTuNodes — tree shape', () => {
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

describe('KiemTuNodes — orb branches (hien)', () => {
  it.each(ORB_IDS)('%s branch: 5 growth + 1 capstone, hien way, realm gate', orb => {
    const short = orb.replace('orb_', '')
    const growth = KIEM_TU_NODES.filter(
      n => n.branchTag === 'kiem_pho' && n.id.startsWith(`orb_${short}_`) && !n.effect.kiemTuComboModifier,
    )
    const capstone = KIEM_TU_NODES.find(
      n => n.branchTag === 'kiem_pho' && n.id.startsWith(`orb_${short}_`) && n.effect.kiemTuComboModifier,
    )

    expect(growth.length).toBe(5)
    expect(capstone, `missing capstone for ${orb}`).toBeDefined()

    const gateRealm = REALM_BY_INDEX[ORB_UNLOCK_REALM[orb]]!
    for (const g of growth) {
      expect(g.requiredCultivationPath).toBe('kiem_tu')
      expect(g.requiredWay).toBe('hien')
      expect(g.prerequisites).toContainEqual({ kind: 'realm', realmId: gateRealm })
    }
    expect(capstone!.requiredCultivationPath).toBe('kiem_tu')
    expect(capstone!.requiredWay).toBe('hien')
    expect(capstone!.type).toBe('major')
  })

  it('capstones carry kiemTuComboModifier targeting their own orb', () => {
    for (const orb of ORB_IDS) {
      const short = orb.replace('orb_', '')
      const capstone = KIEM_TU_NODES.find(
        n => n.id.startsWith(`orb_${short}_`) && n.effect.kiemTuComboModifier,
      )!
      expect(capstone.effect.kiemTuComboModifier!.minOrbCount.orb).toBe(orb)
      expect(capstone.effect.kiemTuComboModifier!.minOrbCount.count).toBeGreaterThanOrEqual(1)
    }
  })

  it('orb growth nodes are prereq-chained inside their own branch (no cross-orb links)', () => {
    for (const n of KIEM_TU_NODES.filter(n => n.branchTag === 'kiem_pho')) {
      const short = n.id.split('_')[1]
      for (const prereq of n.prerequisites ?? []) {
        if (prereq.kind === 'node') {
          expect(prereq.nodeId.startsWith(`orb_${short}_`)).toBe(true)
        }
      }
    }
  })
})

describe('KiemTuNodes — ngu branch', () => {
  it('no kiem_tu_an flip node exists — way entry is ritual-only (M6)', () => {
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
      expect(n.requiredCultivationPath).toBe('kiem_tu')
      expect(n.requiredWay).toBe('ngu')
      expect(n.effect.cascadeUnlock).toBe(unlock)
      expect(n.prerequisites).toContainEqual({ kind: 'realm', realmId })
    }
  })

  it('every ngu node is way-stamped (requiredWay ngu + requiredCultivationPath kiem_tu) and never prereqs the retired flip node', () => {
    const nguNodes = KIEM_TU_NODES.filter(n => n.branchTag === 'ngu_kiem')
    expect(nguNodes.length).toBeGreaterThan(0)
    for (const n of nguNodes) {
      expect(n.requiredCultivationPath).toBe('kiem_tu')
      expect(n.requiredWay).toBe('ngu')
      const nodePrereqs = (n.prerequisites ?? []).filter(p => p.kind === 'node')
      // No 'node' prereq may point at the retired kiem_tu_an flip node;
      // in-branch node links (none today) stay legal.
      expect(nodePrereqs.every(p => p.nodeId !== 'kiem_tu_an')).toBe(true)
    }
  })
})

describe('KiemTuNodes — Cuu Cung 3x3', () => {
  it('8 outer kiemYGrant nodes, each realm-gated, cap-guarded, way-stamped ngu', () => {
    for (const id of CUU_CUNG_OUTER_IDS) {
      const n = node(id)
      expect(n.branchTag).toBe('ngu_kiem')
      expect(n.requiredCultivationPath).toBe('kiem_tu')
      expect(n.requiredWay).toBe('ngu')
      expect(n.effect.kiemYGrant).toBeGreaterThan(0)
      expect(n.prerequisites).toContainEqual({ kind: 'kiemDaoBelowCap' })
      expect((n.prerequisites ?? []).some(p => p.kind === 'realm')).toBe(true)
    }
  })

  it('trung_cung grants +1 kiemDaoCount, requires all 8 outers, cap-guarded', () => {
    const trung = node('cuu_cung_trung')
    expect(trung.branchTag).toBe('ngu_kiem')
    expect(trung.requiredCultivationPath).toBe('kiem_tu')
    expect(trung.requiredWay).toBe('ngu')
    expect(trung.effect.kiemDaoGrant).toBe(1)
    expect(trung.prerequisites).toContainEqual({
      kind: 'nodeCount',
      nodeIds: [...CUU_CUNG_OUTER_IDS],
      countRequired: 8,
    })
    expect(trung.prerequisites).toContainEqual({ kind: 'kiemDaoBelowCap' })
  })
})
