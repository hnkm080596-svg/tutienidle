import { describe, expect, it, vi } from 'vitest'
import type { PlayerData } from '../../core/player/Player'
import { createDefaultPlayer } from '../../core/player/Player'
import { grantCultivationPathRealmReward } from '../../core/player/CultivationPathSystem'
import {
  aggregateNodeStatModifiers,
  canPurchaseNode,
  canUpgradeNode,
  isNodeElementActive,
  nodeWayApplies,
  revokeNodeOwnership,
} from '../../core/progression/NodeSystem'
import { CULTIVATION_PATH_MODULES } from '../../core/player/CultivationPathKit'
import { SPELL_PATHWAY, HIDDEN_SPELL_PATHWAY } from '../../core/phap-tu/PhapTuPath'
import { PHAP_TU_NODES } from './PhapTuNodes'
import { ALL_PROGRESSION_NODES, PROGRESSION_NODE_BY_ID } from '../../data/progression/ProgressionNodeCatalog'
import { TINH_THONG_NODE_IDS } from './PhapTuRealmRewardNodes'

// Three-path design (2026-09-25, sec.4-b + ruling #19) -- contract pins
// for the realm-reward grant channel: rewardOnly nodes, grantedNodeLevels
// on each way's realmRewards, same grant kinds at different numbers.
//
// Phap Tu Reimagine (2026-09-26 spec sec.1.4): the_thuc_tinh is retired
// (legacy The economy gone), spellPath carries {element} only, and every
// mastery rider is an ailment channel (metal moved off
// skillDamagePercent).

const REWARD_NODE_IDS = [...Object.values(TINH_THONG_NODE_IDS)]

function nguHanh(overrides: Partial<PlayerData> = {}): PlayerData {
  const player = createDefaultPlayer()
  player.cultivationPath = 'spell'
  player.cultivationWay = 'spell_pathway'
  return Object.assign(player, overrides)
}

function ngoDao(overrides: Partial<PlayerData> = {}): PlayerData {
  const player = createDefaultPlayer()
  player.cultivationPath = 'spell'
  player.cultivationWay = 'hidden_spell_pathway'
  return Object.assign(player, overrides)
}

const registry = { getAll: () => PHAP_TU_NODES }

describe('PhapTu realm-reward grant nodes', () => {
  it('all five reward nodes are registered and rewardOnly-flagged; masteries cap at the granted L2', () => {
    for (const id of REWARD_NODE_IDS) {
      const node = PHAP_TU_NODES.find((n) => n.id === id)
      expect(node, id).toBeDefined()
      expect(node?.rewardOnly, id).toBe(true)
      // Masteries reach L2 via the hidden way's grant (rewardOnly
      // rejects upgrades -- a deeper maxLevel would be dead range).
      expect(node?.maxLevel, id).toBe(2)
      expect(node?.requiredCultivationPath, id).toBe('spell')
      // Masteries carry no requiredWay -- both spell ways aggregate them.
      expect(node?.requiredWay, id).toBeUndefined()
    }
  })

  it('reward nodes are never purchasable or upgradeable with Insight', () => {
    const player = nguHanh({
      realmId: 'foundation_establishment',
      skillInsight: 999,
      spellPath: { element: 'fire' },
    })

    for (const id of REWARD_NODE_IDS) {
      const node = PHAP_TU_NODES.find((n) => n.id === id)!
      expect(canPurchaseNode(player, node), `purchase ${id}`).toBe(false)

      player.nodeLevels = { [id]: 1 }
      expect(canUpgradeNode(player, node), `upgrade ${id}`).toBe(false)
      player.nodeLevels = {}
    }
  })

  it('normal way grants the five masteries at level 1, idempotently', () => {
    const player = nguHanh({ realmId: 'foundation_establishment' })
    player.nodeLevels = { tinh_thong_hoa: 2 } // deeper earlier grant must not downgrade

    expect(grantCultivationPathRealmReward(player, 'foundation_establishment', (id) => PROGRESSION_NODE_BY_ID.get(id))).toBe(true)

    for (const id of Object.values(TINH_THONG_NODE_IDS)) {
      expect(player.nodeLevels[id], id).toBeGreaterThanOrEqual(1)
    }
    expect(player.nodeLevels.tinh_thong_hoa).toBe(2)

    // Re-running the same grant is a no-op.
    grantCultivationPathRealmReward(player, 'foundation_establishment', (id) => PROGRESSION_NODE_BY_ID.get(id))
    expect(player.nodeLevels.tinh_thong_thuy).toBe(1)
  })

  it('hidden way grants the masteries at level 2', () => {
    const player = ngoDao({ realmId: 'foundation_establishment' })
    expect(grantCultivationPathRealmReward(player, 'foundation_establishment', (id) => PROGRESSION_NODE_BY_ID.get(id))).toBe(true)

    for (const id of Object.values(TINH_THONG_NODE_IDS)) {
      expect(player.nodeLevels[id], id).toBe(2)
      // Reward nodes carry no requiredWay -- the hidden way aggregates them.
      const node = PHAP_TU_NODES.find((n) => n.id === id)!
      expect(nodeWayApplies(player, node), id).toBe(true)
    }
  })

  it('element gate activates only the committed element mastery on the normal way', () => {
    const player = nguHanh({
      spellPath: { element: 'water' },
      nodeLevels: { tinh_thong_thuy: 1, tinh_thong_hoa: 1 },
    })

    const water = PHAP_TU_NODES.find((n) => n.id === 'tinh_thong_thuy')!
    const fire = PHAP_TU_NODES.find((n) => n.id === 'tinh_thong_hoa')!

    expect(isNodeElementActive(player, water)).toBe(true)
    expect(isNodeElementActive(player, fire)).toBe(false)
  })

  it('null element on the normal way keeps grants dormant - only ngo_dao activates all', () => {
    const uncommitted = nguHanh({
      spellPath: { element: null },
      nodeLevels: { tinh_thong_hoa: 1 },
    })
    expect(
      aggregateNodeStatModifiers(registry, uncommitted).filter((m) => m.sourceId === 'spell'),
    ).toEqual([])

    const hidden = ngoDao({
      spellPath: { element: null },
      nodeLevels: { tinh_thong_hoa: 1 },
    })
    expect(
      aggregateNodeStatModifiers(registry, hidden).some((m) => m.stat === 'ailmentPotencyPercent'),
    ).toBe(true)
  })

  it('every grantedNodeLevels key across ways resolves to a registered rewardOnly node', () => {
    for (const module of Object.values(CULTIVATION_PATH_MODULES)) {
      for (const way of Object.values(module.ways)) {
        for (const reward of Object.values(way.realmRewards ?? {})) {
          for (const nodeId of Object.keys(reward.grantedNodeLevels ?? {})) {
            const node = PHAP_TU_NODES.find((n) => n.id === nodeId)
            expect(node, `${way.id} -> ${nodeId}`).toBeDefined()
            expect(node?.rewardOnly, `${way.id} -> ${nodeId}`).toBe(true)
          }
        }
      }
    }
  })

  it('the normal way record carries the mastery grants at foundation_establishment (no the_thuc_tinh)', () => {
    const record = SPELL_PATHWAY.realmRewards?.foundation_establishment
    expect(record?.grantedNodeLevels?.['the_thuc_tinh']).toBeUndefined()
    for (const id of Object.values(TINH_THONG_NODE_IDS)) {
      expect(record?.grantedNodeLevels?.[id], id).toBe(1)
    }
    const hiddenRecord = HIDDEN_SPELL_PATHWAY.realmRewards?.foundation_establishment
    expect(hiddenRecord?.grantedNodeLevels?.['the_thuc_tinh']).toBeUndefined()
  })
})

describe('grantCultivationPathRealmReward - ownership validation', () => {
  const resolve = (id: string) => PROGRESSION_NODE_BY_ID.get(id)

  it('refuses entries targeting non-rewardOnly or unknown nodes (warns, no write)', () => {
    const player = nguHanh({ realmId: 'foundation_establishment' })
    const way = CULTIVATION_PATH_MODULES.spell.ways.spell_pathway!
    const original = way.realmRewards?.foundation_establishment?.grantedNodeLevels

    // A record entry naming a purchasable node must be refused - granting it
    // would hand out gated power for free.
    const bad = 'hoa_diem_chuan'
    expect(PHAP_TU_NODES.find((n) => n.id === bad)?.rewardOnly).not.toBe(true)

    if (way.realmRewards?.foundation_establishment) {
      way.realmRewards.foundation_establishment.grantedNodeLevels = {
        [bad]: 3,
        'core_hoa_cau_thuat': 2,
        'no_such_node': 1,
      }
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      grantCultivationPathRealmReward(player, 'foundation_establishment', resolve)
      expect(player.nodeLevels?.[bad]).toBeUndefined()
      expect(player.nodeLevels?.['core_hoa_cau_thuat']).toBeUndefined()
      expect(player.nodeLevels?.['no_such_node']).toBeUndefined()
      expect(warn).toHaveBeenCalled()
    } finally {
      warn.mockRestore()
      if (way.realmRewards?.foundation_establishment) {
        way.realmRewards.foundation_establishment.grantedNodeLevels = original
      }
    }
  })

  it('clamps grant levels to the authored maxLevel', () => {
    const player = nguHanh({ realmId: 'foundation_establishment' })
    const way = CULTIVATION_PATH_MODULES.spell.ways.spell_pathway!
    const original = way.realmRewards?.foundation_establishment?.grantedNodeLevels

    if (way.realmRewards?.foundation_establishment) {
      way.realmRewards.foundation_establishment.grantedNodeLevels = {
        tinh_thong_hoa: 5, // authored maxLevel 2
      }
    }
    try {
      grantCultivationPathRealmReward(player, 'foundation_establishment', resolve)
      expect(player.nodeLevels?.['tinh_thong_hoa']).toBe(2)
    } finally {
      if (way.realmRewards?.foundation_establishment) {
        way.realmRewards.foundation_establishment.grantedNodeLevels = original
      }
    }
  })

  it('every authored grantedNodeLevels entry resolves to a rewardOnly node within maxLevel', () => {
    for (const [pathId, module] of Object.entries(CULTIVATION_PATH_MODULES)) {
      for (const [wayId, way] of Object.entries(module.ways)) {
        if (!way) continue
        for (const record of Object.values(way.realmRewards ?? {})) {
          for (const [nodeId, level] of Object.entries(record.grantedNodeLevels ?? {})) {
            const node = PROGRESSION_NODE_BY_ID.get(nodeId)
            expect(node, `${pathId}/${wayId} grants unknown node ${nodeId}`).toBeDefined()
            expect(node!.rewardOnly, `${nodeId} is not rewardOnly`).toBe(true)
            expect(level).toBeLessThanOrEqual(node!.maxLevel ?? 1)
          }
        }
      }
    }
  })
})

describe('specialization claims - uniqueness pin', () => {
  it('no two nodes claim the same (skillId, specializationId) pair', () => {
    const seen = new Map<string, string>()
    // Catalog-wide: a duplicate claimer in ANY node array would make the
    // .find() claiming-node gate and the .some() clawback disagree.
    for (const node of ALL_PROGRESSION_NODES) {
      const claim = node.effect.selectsSpecialization
      if (!claim) continue
      const key = `${claim.skillId}::${claim.specializationId}`
      expect(seen.has(key), `${node.id} duplicates the claim held by ${seen.get(key)}`).toBe(false)
      seen.set(key, node.id)
    }
  })
})

describe('rewardOnly nodes - shared removal seam', () => {
  it('revokeNodeOwnership refuses rewardOnly nodes (level kept, zero refund)', () => {
    const player = nguHanh({ realmId: 'foundation_establishment' })
    player.nodeLevels = { tinh_thong_hoa: 1 }
    const node = PHAP_TU_NODES.find((n) => n.id === 'tinh_thong_hoa')!

    const registry = new Map(PHAP_TU_NODES.map((n) => [n.id, n]))
    const resolve = { has: (id: string) => registry.has(id), get: (id: string) => registry.get(id)! }

    const refund = revokeNodeOwnership(player, node, resolve)
    expect(refund).toBe(0)
    expect(player.nodeLevels['tinh_thong_hoa']).toBe(1)
  })
})
