import { describe, expect, it } from 'vitest'
import { PHAP_TU_NODES } from './PhapTuNodes'
import { KIEM_TU_NODES } from './KiemTuNodes'
import { THE_TU_NODES } from './TheTuNodes'
import {
  canPurchaseNode,
  canUpgradeNode,
  getEffectiveNodeMaxLevel,
  purchaseNode,
  upgradeNode,
} from '../../core/progression/NodeSystem'
import { createDefaultPlayer } from '../../core/player/Player'
import type { ProgressionNode } from '../../core/progression/ProgressionNode'

// M-QI-06 (QI-D3) - the minimal authored technique-gate set: unlock
// gates on TheTu majors; levelGates on the PhapTu basic-lane ailment
// minors (Phap Tu Reimagine 2026-09-26: the intensity minors and the
// linh_ngo_<godUlt> unlocks are retired; the kept basic lane keeps the
// L3@rank2/L4@rank3/L5@rank4 ramp on its maxLevel-5 trunks) + KiemTu
// ngu_kiem minors. Mechanism-proving set - the complete gate map is
// deferred to the content pass.

const ALL_NODES = [...PHAP_TU_NODES, ...KIEM_TU_NODES, ...THE_TU_NODES]

const UNLOCK_IDS = [
  'major_bat_tu_tuc_menh',
  'major_loan_dau_sat',
  'major_khiem_khich_dien',
  'major_son_nhac_bao_bi',
] as const

const CAP_IDS = [
  'ngu_kiem_sac',
  'ngu_kiem_phong',
  'ngu_kiem_sat',
] as const

function byId(id: string): ProgressionNode {
  const node = ALL_NODES.find((entry) => entry.id === id)

  if (!node) {
    throw new Error(`missing node ${id}`)
  }

  return node
}

describe('authored technique gate set (M-QI-06)', () => {
  it('every unlock node carries techniqueRank 5', () => {
    for (const id of UNLOCK_IDS) {
      const node = byId(id)

      expect(
        node.prerequisites?.filter((prereq) => prereq.kind === 'techniqueRank'),
        `${id} must carry exactly one techniqueRank 5 prerequisite`,
      ).toEqual([{ kind: 'techniqueRank', rank: 5 }])
    }
  })

  it('every basic-lane trunk minor carries the L3@rank2/L4@rank3/L5@rank4 gates', () => {
    for (const id of ['hoa_diem_chuan', 'thuy_diem_chuan', 'kim_diem_chuan']) {
      const node = byId(id)

      expect(node.levelGates, `${id} levelGates`).toEqual([
        { atLevel: 3, prerequisite: { kind: 'techniqueRank', rank: 2 } },
        { atLevel: 4, prerequisite: { kind: 'techniqueRank', rank: 3 } },
        { atLevel: 5, prerequisite: { kind: 'techniqueRank', rank: 4 } },
      ])
    }
  })

  it('every ngu_kiem minor carries an L5@rank4 level gate', () => {
    for (const id of CAP_IDS) {
      expect(byId(id).levelGates, `${id} levelGates`).toEqual([
        { atLevel: 5, prerequisite: { kind: 'techniqueRank', rank: 4 } },
      ])
    }
  })

  it('linh_ngo_<special> gates on realm foundation_establishment (no techniqueRank)', () => {
    const special = byId('linh_ngo_tam_muoi_chan_hoa')

    expect(special.prerequisites).toContainEqual({
      kind: 'realm',
      realmId: 'foundation_establishment',
    })
    expect(
      special.prerequisites?.filter((p) => p.kind === 'techniqueRank'),
    ).toEqual([])
  })

  it('linh_ngo_<special> is unpurchasable below foundation_establishment despite satisfied node prereqs', () => {
    const special = byId('linh_ngo_tam_muoi_chan_hoa')
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.skillInsight = 500
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.spellPath.element = 'fire'
    player.techniqueProgress = { rank: 0, grade: 1 }
    player.nodeLevels['hoa_linh_ngo'] = 1
    player.purchasedNodeIds.push('hoa_linh_ngo')

    // The decisive gate is the realm prerequisite.
    expect(canPurchaseNode(player, special)).toBe(false)

    player.realmId = 'foundation_establishment'

    expect(canPurchaseNode(player, special)).toBe(true)
    expect(purchaseNode(player, special)).toBe(true)
  })

  it('authored gate entries obey the data discipline (2 <= atLevel <= maxLevel, positive rank)', () => {
    for (const node of ALL_NODES) {
      const maxLevel = node.maxLevel ?? 1

      for (const gate of node.levelGates ?? []) {
        expect(gate.atLevel, `${node.id} atLevel`).toBeGreaterThanOrEqual(2)
        expect(gate.atLevel, `${node.id} atLevel`).toBeLessThanOrEqual(maxLevel)

        if (gate.prerequisite.kind === 'techniqueRank') {
          expect(gate.prerequisite.rank, `${node.id} rank`).toBeGreaterThanOrEqual(1)
        }
      }
    }
  })

  it('basic-lane trunk upgrades to 2, blocks 2->3 until rank 2, then each tier until rank 4', () => {
    const trunk = byId('hoa_diem_chuan')
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.skillInsight = 500
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.spellPath.element = 'fire'
    player.techniqueProgress = { rank: 0, grade: 1 }
    player.nodeLevels['hoa_linh_ngo'] = 1
    player.purchasedNodeIds.push('hoa_linh_ngo')

    expect(purchaseNode(player, trunk)).toBe(true)

    expect(upgradeNode(player, trunk)).toBe(true)

    expect(getEffectiveNodeMaxLevel(player, trunk)).toBe(2)
    expect(upgradeNode(player, trunk)).toBe(false)

    player.techniqueProgress = { rank: 2, grade: 1 }

    expect(upgradeNode(player, trunk)).toBe(true)
    expect(getEffectiveNodeMaxLevel(player, trunk)).toBe(3)
    expect(upgradeNode(player, trunk)).toBe(false)

    player.techniqueProgress = { rank: 3, grade: 1 }

    expect(upgradeNode(player, trunk)).toBe(true)
    expect(getEffectiveNodeMaxLevel(player, trunk)).toBe(4)
    expect(upgradeNode(player, trunk)).toBe(false)

    player.techniqueProgress = { rank: 4, grade: 1 }

    expect(upgradeNode(player, trunk)).toBe(true)
    expect(canUpgradeNode(player, trunk)).toBe(false)
  })

  it('frozen surplus: an owned L4 ailment minor stays owned after the cycle freezes', () => {
    const trunk = byId('hoa_diem_chuan')
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.spellPath.element = 'fire'
    player.skillInsight = 500
    // In-band grade-2 cycle at realm index 2, rank 0: owned L4 stays
    // legal surplus while the rank-3 gate blocks further upgrades.
    player.techniqueProgress = { rank: 0, grade: 2 }
    player.nodeLevels['hoa_linh_ngo'] = 1
    player.nodeLevels['hoa_diem_chuan'] = 4
    player.purchasedNodeIds.push('hoa_linh_ngo', 'hoa_diem_chuan')

    expect(getEffectiveNodeMaxLevel(player, trunk)).toBe(2)
    expect(canUpgradeNode(player, trunk)).toBe(false)

    player.techniqueProgress = { rank: 3, grade: 2 }

    expect(canUpgradeNode(player, trunk)).toBe(true)
  })

  it('M-F-TECHNIQUE (F5): a lagging live grade contributes rank 0 even when the mirror still shows the sealed rank', () => {
    const trunk = byId('hoa_diem_chuan')
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.spellPath.element = 'fire'
    player.skillInsight = 500
    player.nodeLevels['hoa_linh_ngo'] = 1
    player.nodeLevels['hoa_diem_chuan'] = 3
    player.purchasedNodeIds.push('hoa_linh_ngo', 'hoa_diem_chuan')

    // Sealed grade-1 holder inside foundation_establishment (index 2):
    // the mirror keeps its literal sealed rank for display but gates
    // see effective rank 0.
    player.techniqueProgress = { rank: 12, grade: 1 }
    expect(canUpgradeNode(player, trunk)).toBe(false)

    // After catch-up the live grade-2 cycle trains again - rank 3 in
    // band satisfies the gate.
    player.techniqueProgress = { rank: 3, grade: 2 }
    expect(canUpgradeNode(player, trunk)).toBe(true)
  })
})
