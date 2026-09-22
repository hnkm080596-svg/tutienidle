import { describe, expect, it } from 'vitest'
import { PHAP_TU_NODES } from './PhapTuNodes'
import { KIEM_TU_NODES } from './KiemTuNodes'
import { THE_TU_NODES } from './TheTuNodes'
import { PHAP_TU_ULTIMATE_IDS } from '../skill/PhapTuUltimates'
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
// gates on linh_ngo_<godUlt> + TheTu majors; levelGates on PhapTu
// intensity minors + KiemTu ngu_kiem minors. Mechanism-proving set -
// the complete gate map is deferred to the content pass.

const ALL_NODES = [...PHAP_TU_NODES, ...KIEM_TU_NODES, ...THE_TU_NODES]

const UNLOCK_IDS = [
  ...Object.values(PHAP_TU_ULTIMATE_IDS).map((id) => `linh_ngo_${id}`),
  'major_bat_tu_tuc_menh',
  'major_loan_dau_sat',
  'major_khiem_khich_dien',
  'major_son_nhac_bao_bi',
] as const

const CAP_IDS = [
  'minor_fire_intensity',
  'minor_water_intensity',
  'minor_wood_intensity',
  'minor_metal_intensity',
  'minor_earth_intensity',
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

  it('every intensity minor carries L6@rank3 + L9@rank6 level gates', () => {
    for (const element of ['fire', 'water', 'wood', 'metal', 'earth']) {
      const node = byId(`minor_${element}_intensity`)

      expect(node.levelGates, `${node.id} levelGates`).toEqual([
        { atLevel: 6, prerequisite: { kind: 'techniqueRank', rank: 3 } },
        { atLevel: 9, prerequisite: { kind: 'techniqueRank', rank: 6 } },
      ])
    }
  })

  it('every ngu_kiem minor carries an L5@rank4 level gate', () => {
    for (const id of ['ngu_kiem_sac', 'ngu_kiem_phong', 'ngu_kiem_sat']) {
      expect(byId(id).levelGates, `${id} levelGates`).toEqual([
        { atLevel: 5, prerequisite: { kind: 'techniqueRank', rank: 4 } },
      ])
    }
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

  it('linh_ngo_<godUlt> is unpurchasable below technique rank 5 despite satisfied node prereqs', () => {
    const godUlt = byId(`linh_ngo_${PHAP_TU_ULTIMATE_IDS.fire}`)
    const player = createDefaultPlayer()
    player.realmId = 'golden_core'
    player.skillInsight = 500
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.spellPath.element = 'fire'
    player.techniqueProgress = { rank: 4, grade: 1 }
    // Satisfy the node-chain prereq (linh_ngo_<special>) so only the
    // technique gate can fail.
    player.nodeLevels['linh_ngo_tam_muoi_chan_hoa'] = 1
    player.purchasedNodeIds.push('linh_ngo_tam_muoi_chan_hoa')

    // Realm is not directly on this node (it arrives transitively);
    // the decisive gate here is techniqueRank.
    expect(canPurchaseNode(player, godUlt)).toBe(false)

    player.techniqueProgress = { rank: 5, grade: 1 }

    expect(canPurchaseNode(player, godUlt)).toBe(true)
    expect(purchaseNode(player, godUlt)).toBe(true)
  })

  it('intensity minor upgrades to 5, blocks 5->6 until rank 3, blocks 8->9 until rank 6', () => {
    const intensity = byId('minor_fire_intensity')
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.skillInsight = 500
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.spellPath.element = 'fire'
    player.techniqueProgress = { rank: 0, grade: 1 }
    player.nodeLevels['hoa_linh_ngo'] = 1
    player.purchasedNodeIds.push('hoa_linh_ngo')

    expect(purchaseNode(player, intensity)).toBe(true)

    for (let i = 0; i < 4; i++) {
      expect(upgradeNode(player, intensity)).toBe(true)
    }

    expect(getEffectiveNodeMaxLevel(player, intensity)).toBe(5)
    expect(upgradeNode(player, intensity)).toBe(false)

    player.techniqueProgress = { rank: 3, grade: 1 }

    for (let i = 0; i < 3; i++) {
      expect(upgradeNode(player, intensity)).toBe(true)
    }

    expect(getEffectiveNodeMaxLevel(player, intensity)).toBe(8)
    expect(upgradeNode(player, intensity)).toBe(false)

    player.techniqueProgress = { rank: 6, grade: 1 }

    expect(upgradeNode(player, intensity)).toBe(true)
    expect(upgradeNode(player, intensity)).toBe(true)
    expect(canUpgradeNode(player, intensity)).toBe(false)
  })

  it('frozen surplus: an owned L6 intensity stays owned after rank resets to 0', () => {
    const intensity = byId('minor_fire_intensity')
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.spellPath.element = 'fire'
    player.skillInsight = 500
    player.techniqueProgress = { rank: 0, grade: 2 }
    player.nodeLevels['hoa_linh_ngo'] = 1
    player.nodeLevels['minor_fire_intensity'] = 6
    player.purchasedNodeIds.push('hoa_linh_ngo', 'minor_fire_intensity')

    expect(getEffectiveNodeMaxLevel(player, intensity)).toBe(5)
    expect(canUpgradeNode(player, intensity)).toBe(false)

    player.techniqueProgress = { rank: 3, grade: 2 }

    expect(canUpgradeNode(player, intensity)).toBe(true)
  })
})
