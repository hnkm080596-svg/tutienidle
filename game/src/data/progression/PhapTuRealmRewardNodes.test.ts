import { describe, expect, it } from 'vitest'
import type { PlayerData } from '../../core/player/Player'
import { createDefaultPlayer } from '../../core/player/Player'
import { grantCultivationPathRealmReward } from '../../core/player/CultivationPathSystem'
import {
  aggregateNodeStatModifiers,
  canPurchaseNode,
  canUpgradeNode,
  isNodeElementActive,
  nodeWayApplies,
} from '../../core/progression/NodeSystem'
import { CULTIVATION_PATH_MODULES } from '../../core/player/CultivationPathKit'
import { resolveMaxThe } from '../../core/phap-tu/PhapTuRoutes'
import { MAX_THE } from '../../core/combat/CombatTypes'
import { SPELL_PATHWAY, HIDDEN_SPELL_PATHWAY } from '../../core/phap-tu/PhapTuPath'
import { PHAP_TU_NODES } from './PhapTuNodes'
import {
  THE_THUC_TINH_NODE_ID,
  TINH_THONG_NODE_IDS,
} from './PhapTuRealmRewardNodes'

// Three-path design (2026-09-25, sec.4-b + ruling #19) -- contract pins
// for the realm-reward grant channel: rewardOnly nodes, grantedNodeLevels
// on each way's realmRewards, same grant kinds at different numbers.

const REWARD_NODE_IDS = [...Object.values(TINH_THONG_NODE_IDS), THE_THUC_TINH_NODE_ID]

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
  it('all six reward nodes are registered and rewardOnly-flagged; mastery caps at the granted L2, the awakening at the granted L1', () => {
    for (const id of REWARD_NODE_IDS) {
      const node = PHAP_TU_NODES.find((n) => n.id === id)
      expect(node, id).toBeDefined()
      expect(node?.rewardOnly, id).toBe(true)
      // Masteries reach L2 via the hidden way's grant; the_thuc_tinh is
      // granted at L1 on the normal way only, so its authored cap is 1
      // (rewardOnly rejects upgrades -- a deeper maxLevel would be dead
      // range).
      expect(node?.maxLevel, id).toBe(id === THE_THUC_TINH_NODE_ID ? 1 : 2)
      expect(node?.requiredCultivationPath, id).toBe('spell')
      // No requiredWay stamp -- both spell ways aggregate a granted level.
      expect(node?.requiredWay, id).toBeUndefined()
    }
  })

  it('reward nodes are never purchasable or upgradeable with Insight', () => {
    const player = nguHanh({
      realmId: 'foundation_establishment',
      skillInsight: 999,
      spellPath: { element: 'fire', route: 'dot' },
    })

    for (const id of REWARD_NODE_IDS) {
      const node = PHAP_TU_NODES.find((n) => n.id === id)!
      expect(canPurchaseNode(player, node), `purchase ${id}`).toBe(false)

      player.nodeLevels = { [id]: 1 }
      expect(canUpgradeNode(player, node), `upgrade ${id}`).toBe(false)
      player.nodeLevels = {}
    }
  })

  it('normal way grants the five masteries + the awakening at level 1, idempotently', () => {
    const player = nguHanh({ realmId: 'foundation_establishment' })
    player.nodeLevels = { tinh_thong_hoa: 2 } // deeper earlier grant must not downgrade

    expect(grantCultivationPathRealmReward(player, 'foundation_establishment')).toBe(true)

    expect(player.nodeLevels[THE_THUC_TINH_NODE_ID]).toBe(1)
    for (const id of Object.values(TINH_THONG_NODE_IDS)) {
      expect(player.nodeLevels[id], id).toBeGreaterThanOrEqual(1)
    }
    expect(player.nodeLevels.tinh_thong_hoa).toBe(2)

    // Re-running the same grant is a no-op.
    grantCultivationPathRealmReward(player, 'foundation_establishment')
    expect(player.nodeLevels[THE_THUC_TINH_NODE_ID]).toBe(1)
  })

  it('hidden way grants only the masteries at level 2 — no The awakening (ngo_dao owns no pool)', () => {
    const record = HIDDEN_SPELL_PATHWAY.realmRewards?.foundation_establishment
    expect(record?.grantedNodeLevels?.[THE_THUC_TINH_NODE_ID]).toBeUndefined()

    const player = ngoDao({ realmId: 'foundation_establishment' })
    expect(grantCultivationPathRealmReward(player, 'foundation_establishment')).toBe(true)

    for (const id of Object.values(TINH_THONG_NODE_IDS)) {
      expect(player.nodeLevels[id], id).toBe(2)
      // Reward nodes carry no requiredWay -- the hidden way aggregates them.
      const node = PHAP_TU_NODES.find((n) => n.id === id)!
      expect(nodeWayApplies(player, node), id).toBe(true)
    }
  })

  it('element gate activates only the committed element mastery on the normal way', () => {
    const player = nguHanh({
      spellPath: { element: 'water', route: 'no' },
      nodeLevels: { tinh_thong_thuy: 1, tinh_thong_hoa: 1 },
    })

    const water = PHAP_TU_NODES.find((n) => n.id === 'tinh_thong_thuy')!
    const fire = PHAP_TU_NODES.find((n) => n.id === 'tinh_thong_hoa')!

    expect(isNodeElementActive(player, water)).toBe(true)
    expect(isNodeElementActive(player, fire)).toBe(false)
  })

  it('null element on the normal way keeps grants dormant - only ngo_dao activates all', () => {
    const uncommitted = nguHanh({
      spellPath: { element: null, route: null },
      nodeLevels: { tinh_thong_hoa: 1 },
    })
    expect(
      aggregateNodeStatModifiers(registry, uncommitted).filter((m) => m.sourceId === 'spell'),
    ).toEqual([])

    const hidden = ngoDao({
      spellPath: { element: null, route: null },
      nodeLevels: { tinh_thong_hoa: 1 },
    })
    expect(
      aggregateNodeStatModifiers(registry, hidden).some((m) => m.stat === 'ailmentPotencyPercent'),
    ).toBe(true)
  })

  it('resolveMaxThe keeps element-gated The-cap nodes dormant until element commit', () => {
    // Aggregation gate pin: the The-cap query must use the same
    // dormant-until-commit element gate as the stat aggregators - a
    // spell_pathway player with element === null gets nothing even while
    // holding a level on an elementTag node.
    const synthetic = {
      id: 'synthetic_the_cap',
      name: 'Synthetic The Cap',
      type: 'minor' as const,
      insightCost: 0,
      elementTag: 'fire' as const,
      effect: { theCapPerLevel: 5 },
    }
    const customRegistry = { getAll: () => [...PHAP_TU_NODES, synthetic] }

    const uncommitted = nguHanh({
      spellPath: { element: null, route: null },
      nodeLevels: { synthetic_the_cap: 1 },
    })
    expect(resolveMaxThe(customRegistry, uncommitted)).toBe(MAX_THE)

    const committed = nguHanh({
      spellPath: { element: 'fire', route: 'dot' },
      nodeLevels: { synthetic_the_cap: 1 },
    })
    expect(resolveMaxThe(customRegistry, committed)).toBe(MAX_THE + 5)

    const wrongElement = nguHanh({
      spellPath: { element: 'water', route: 'dot' },
      nodeLevels: { synthetic_the_cap: 1 },
    })
    expect(resolveMaxThe(customRegistry, wrongElement)).toBe(MAX_THE)
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

  it('the awakening raises the battle-scoped The cap for the normal way', () => {
    const before = nguHanh({ spellPath: { element: 'fire', route: 'dot' } })
    expect(resolveMaxThe(registry, before)).toBe(MAX_THE)

    const granted = nguHanh({
      spellPath: { element: 'fire', route: 'dot' },
      nodeLevels: { [THE_THUC_TINH_NODE_ID]: 1 },
    })
    expect(resolveMaxThe(registry, granted)).toBe(MAX_THE + 10)
  })

  it('the normal way record carries the grant at foundation_establishment', () => {
    const record = SPELL_PATHWAY.realmRewards?.foundation_establishment
    expect(record?.grantedNodeLevels?.[THE_THUC_TINH_NODE_ID]).toBe(1)
    for (const id of Object.values(TINH_THONG_NODE_IDS)) {
      expect(record?.grantedNodeLevels?.[id], id).toBe(1)
    }
  })
})
