import { describe, expect, it } from 'vitest'
import { KIEM_TU_NODES, NGU_KIEM_EVOLUTION_NODE_IDS } from './KiemTuNodes'
import { ORB_UNLOCK_REALM } from '../skill/KiemPhoOrbs'
import type { OrbId } from '../../core/kiem-tu/KiemTuState'

// Kiem Tu Reimagined Task 11 (spec 2026-09-15 sec.6) -- the reimagined
// tree: 5 orb branches (growth + combo capstone) under 'kiem_pho',
// and the ngu branch (cascade unlocks, per-instance growth, Cuu Cung
// 3x3) under 'ngu_kiem'. The legacy Kiem Tran / Bat Kiem node set is
// gone (Task 12 teardown). Cultivation Path Framework M6: the
// kiem_tu_an flip node is retired -- way entry is ritual-only and every
// node carries requiredCultivationPath 'sword' + requiredWay
// ('sword_pathway' orbs / 'hidden_sword_pathway' subtree) stamped at export.
//
// Ngu Kiem Beta (design 2026-09-24) -- the ngu branch is now a SINGLE
// VERTICAL evolution spine: one single-level evolution node per realm
// (Khoi auto-granted at way commit, Lien insight-purchased at Truc Co,
// Phong a sealed '???' placeholder beyond the beta ceiling). Roll
// Cascade nodes, the Cuu Cung 3x3 grid and every stat-yielding hidden
// node are non-goals and carry no ids in the tree.

const ORB_IDS: OrbId[] = ['orb_dam', 'orb_chem', 'orb_bo', 'orb_hat', 'orb_quet']
const REALM_BY_INDEX = [
  'mortal',
  'qi_refining',
  'foundation_establishment',
  'golden_core',
  'nascent_soul',
  'soul_transformation',
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
      n => n.branchTag === 'kiem_pho' && n.id.startsWith(`orb_${short}_`) && !n.effect.swordPathComboModifier,
    )
    const capstone = KIEM_TU_NODES.find(
      n => n.branchTag === 'kiem_pho' && n.id.startsWith(`orb_${short}_`) && n.effect.swordPathComboModifier,
    )

    expect(growth.length).toBe(5)
    expect(capstone, `missing capstone for ${orb}`).toBeDefined()

    const gateRealm = REALM_BY_INDEX[ORB_UNLOCK_REALM[orb]]!
    for (const g of growth) {
      expect(g.requiredCultivationPath).toBe('sword')
      expect(g.requiredWay).toBe('sword_pathway')
      expect(g.prerequisites).toContainEqual({ kind: 'realm', realmId: gateRealm })
    }
    expect(capstone!.requiredCultivationPath).toBe('sword')
    expect(capstone!.requiredWay).toBe('sword_pathway')
    expect(capstone!.type).toBe('major')
  })

  it('capstones carry swordPathComboModifier targeting their own orb', () => {
    for (const orb of ORB_IDS) {
      const short = orb.replace('orb_', '')
      const capstone = KIEM_TU_NODES.find(
        n => n.id.startsWith(`orb_${short}_`) && n.effect.swordPathComboModifier,
      )!
      expect(capstone.effect.swordPathComboModifier!.minOrbCount.orb).toBe(orb)
      expect(capstone.effect.swordPathComboModifier!.minOrbCount.count).toBeGreaterThanOrEqual(1)
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

describe('KiemTuNodes — ngu evolution spine', () => {
  it('no kiem_tu_an flip node exists — way entry is ritual-only (M6)', () => {
    expect(KIEM_TU_NODES.find(n => n.id === 'kiem_tu_an')).toBeUndefined()
    // The retired effect field is gone from every node.
    for (const n of KIEM_TU_NODES) {
      expect('kiemTuModeSwitch' in n.effect).toBe(false)
    }
  })

  it('exactly the three spine nodes exist (Khoi / Lien / Phong) — no Cuu Cung or Roll Cascade ids remain', () => {
    const nguNodes = KIEM_TU_NODES.filter(n => n.branchTag === 'ngu_kiem')
    expect(nguNodes.map(n => n.id)).toEqual([...NGU_KIEM_EVOLUTION_NODE_IDS])
  })

  it('every spine node is single-level, major and way-stamped; live layers carry evolutionId, the sealed node carries none', () => {
    for (const id of NGU_KIEM_EVOLUTION_NODE_IDS) {
      const n = node(id)
      expect(n.branchTag).toBe('ngu_kiem')
      expect(n.type).toBe('major')
      expect(n.maxLevel).toBe(1)
      expect(n.requiredCultivationPath).toBe('sword')
      expect(n.requiredWay).toBe('hidden_sword_pathway')
    }
    expect(node('ngu_kiem_khoi').effect.evolutionId).toBe('khoi')
    expect(node('ngu_kiem_lien').effect.evolutionId).toBe('lien')
    // Sealed: no evolution layer ever activates from this node.
    expect(node('ngu_kiem_phong_an').effect.evolutionId).toBeUndefined()
  })

  it('ngu_kiem_khoi is grant-only: free, grantedOnly, no prerequisites', () => {
    const khoi = node('ngu_kiem_khoi')
    expect(khoi.grantedOnly).toBe(true)
    expect(khoi.insightCost).toBe(0)
    expect(khoi.prerequisites ?? []).toEqual([])
  })

  it('ngu_kiem_lien requires Khoi + foundation_establishment and costs insight', () => {
    const lien = node('ngu_kiem_lien')
    expect(lien.grantedOnly).not.toBe(true)
    expect(lien.insightCost).toBeGreaterThan(0)
    expect(lien.prerequisites).toContainEqual({ kind: 'node', nodeId: 'ngu_kiem_khoi' })
    expect(lien.prerequisites).toContainEqual({ kind: 'realm', realmId: 'foundation_establishment' })
  })

  it("ngu_kiem_phong_an is the sealed '???' placeholder beyond the beta ceiling", () => {
    const phong = node('ngu_kiem_phong_an')
    expect(phong.name).toBe('???')
    expect(phong.prerequisites).toContainEqual({ kind: 'node', nodeId: 'ngu_kiem_lien' })
    expect(phong.prerequisites).toContainEqual({ kind: 'realm', realmId: 'golden_core' })
  })

  it('spine nodes never modify character stats — no stat/kiem-economy effect fields', () => {
    for (const id of NGU_KIEM_EVOLUTION_NODE_IDS) {
      const n = node(id)
      const forbidden = [
        'kiemYGrant',
        'kiemDaoGrant',
        'cascadeUnlock',
        'statBonus',
        'damageBonus',
        'levelsSkillId',
      ]
      for (const field of forbidden) {
        expect(
          (n.effect as Record<string, unknown>)[field],
          `${id} carries forbidden field ${field}`,
        ).toBeUndefined()
      }
      expect('levelsSkillId' in n).toBe(false)
    }
  })

  it('spine node-prereq chain is strictly linear (khoi -> lien -> phong)', () => {
    for (const id of NGU_KIEM_EVOLUTION_NODE_IDS) {
      const n = node(id)
      const nodePrereqs = (n.prerequisites ?? []).filter(p => p.kind === 'node')
      expect(nodePrereqs.length).toBeLessThanOrEqual(1)
    }
    expect(node('ngu_kiem_lien').prerequisites).toContainEqual({
      kind: 'node',
      nodeId: 'ngu_kiem_khoi',
    })
    expect(node('ngu_kiem_phong_an').prerequisites).toContainEqual({
      kind: 'node',
      nodeId: 'ngu_kiem_lien',
    })
  })
})
