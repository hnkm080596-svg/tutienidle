import { describe, expect, it } from 'vitest'
import {
  aggregateNodeStatModifiers,
  aggregateTurnSkillResourceModifiers,
  canPurchaseNode,
  canUpgradeNode,
  getNodeLevel,
  nodeWayApplies,
  purchaseNode,
} from './NodeSystem'
import { collectKiemDaoCascadeUnlocks } from '../kiem-tu/NguKiemDaoProvider'
import { collectKiemPhoComboModifiers } from '../kiem-tu/KiemPhoNodeModifiers'
import { collectBodyKitModifiers } from '../the-tu/TheTuKitModifiers'
import { collectHiddenBodyMechanicModifiers } from '../the-tu/TheTuAnMechanicModifiers'
import { resolveMaxThe } from '../phap-tu/PhapTuRoutes'
import { MAX_THE } from '../combat/CombatTypes'
import { createDefaultPlayer } from '../player/Player'
import type { ProgressionNode } from './ProgressionNode'

// Cultivation Path Framework (M3, spec 2026-09-16 §24) — requiredWay
// way-membership gate: a way-tagged node is inert for every other way
// at purchase, upgrade, aggregation, and every domain collector (the
// render layer is not the gameplay authority). requiredWay undefined =
// way-agnostic — all existing (untagged) nodes keep working.
//
// The way gate sits BESIDE the path gate: the test nodes here carry
// only requiredWay (no requiredCultivationPath) so the way check alone
// is what differentiates the players.

function playerWith(overrides: Partial<ReturnType<typeof createDefaultPlayer>> = {}) {
  return { ...createDefaultPlayer(), ...overrides }
}

function minorNode(overrides: Partial<ProgressionNode> = {}): ProgressionNode {
  return {
    id: 'test_way_minor',
    name: 'Test Way Minor',
    type: 'minor',
    insightCost: 1,
    effect: { statModifiers: [{ id: 'test_way_mod', sourceId: 'test_way_minor', sourceType: 'talent', stat: 'might', flat: 5 }] },
    ...overrides,
  }
}

function ungTheNode(overrides: Partial<ProgressionNode> = {}): ProgressionNode {
  return minorNode({ id: 'ung_the_only', requiredWay: 'hidden_body_pathway', ...overrides })
}

describe('nodeWayApplies — cultivation way membership gate', () => {
  it('undefined requiredWay applies to every way (incl. none); a tagged way only applies to its match', () => {
    const agnostic = minorNode()
    const tagged = ungTheNode()

    const mortal = playerWith()
    const hien = playerWith({ cultivationPath: 'body', cultivationWay: 'body_pathway' })
    const ungThe = playerWith({ cultivationPath: 'body', cultivationWay: 'hidden_body_pathway' })

    for (const player of [mortal, hien, ungThe]) {
      expect(nodeWayApplies(player, agnostic)).toBe(true)
    }

    expect(nodeWayApplies(mortal, tagged)).toBe(false)
    expect(nodeWayApplies(hien, tagged)).toBe(false)
    expect(nodeWayApplies(ungThe, tagged)).toBe(true)
  })

  it('an ung_the node is NOT purchasable by a hien-way player or a mortal, even with insight', () => {
    const hien = playerWith({ cultivationPath: 'body', cultivationWay: 'body_pathway', skillInsight: 50 })
    const mortal = playerWith({ skillInsight: 50 })

    expect(canPurchaseNode(hien, ungTheNode())).toBe(false)
    expect(purchaseNode(hien, ungTheNode())).toBe(false)
    expect(getNodeLevel(hien, 'ung_the_only')).toBe(0)

    expect(canPurchaseNode(mortal, ungTheNode())).toBe(false)
    expect(purchaseNode(mortal, ungTheNode())).toBe(false)
    expect(getNodeLevel(mortal, 'ung_the_only')).toBe(0)
  })

  it('a matching-way player purchases and aggregates the node normally', () => {
    const player = playerWith({ cultivationPath: 'body', cultivationWay: 'hidden_body_pathway', skillInsight: 50 })

    expect(canPurchaseNode(player, ungTheNode())).toBe(true)
    expect(purchaseNode(player, ungTheNode())).toBe(true)

    const registry = { getAll: () => [ungTheNode()] }
    const mods = aggregateNodeStatModifiers(registry, player)

    expect(mods).toHaveLength(1)
    expect(mods[0]!.flat).toBe(5)
  })

  it('canUpgradeNode rejects a wrong-way owner even when the node has levels', () => {
    const node = ungTheNode({ maxLevel: 5, upgradeCost: { base: 1, perLevel: 2 } })

    const ungThe = playerWith({ cultivationPath: 'body', cultivationWay: 'hidden_body_pathway', skillInsight: 50, nodeLevels: { ung_the_only: 1 } })
    expect(canUpgradeNode(ungThe, node)).toBe(true)

    const hien = playerWith({ cultivationPath: 'body', cultivationWay: 'body_pathway', skillInsight: 50, nodeLevels: { ung_the_only: 1 } })
    expect(canUpgradeNode(hien, node)).toBe(false)

    const mortal = playerWith({ skillInsight: 50, nodeLevels: { ung_the_only: 1 } })
    expect(canUpgradeNode(mortal, node)).toBe(false)
  })

  it('injected levels of a wrong-way node aggregate NOTHING (stat + turn-skill-resource aggregators)', () => {
    const node = ungTheNode({
      effect: {
        statModifiers: [{ id: 'ung_the_only:vit', sourceId: 'ung_the_only', sourceType: 'talent', stat: 'vitality', flat: 3 }],
        turnSkillResourceModifiers: [{ skillId: 'cuong_quyen', theGainOnLandedCast: 4 }],
      },
    })
    const registry = { getAll: () => [node] }

    for (const way of [undefined, 'body_pathway'] as const) {
      const player = playerWith({ cultivationWay: way, nodeLevels: { ung_the_only: 2 } })

      expect(aggregateNodeStatModifiers(registry, player)).toEqual([])
      expect(aggregateTurnSkillResourceModifiers(registry, player).size).toBe(0)
    }

    const ungThe = playerWith({ cultivationWay: 'hidden_body_pathway', nodeLevels: { ung_the_only: 2 } })
    expect(aggregateNodeStatModifiers(registry, ungThe)).toHaveLength(1)
    expect(aggregateTurnSkillResourceModifiers(registry, ungThe).get('cuong_quyen')?.theGainOnLandedCast).toBe(8)
  })
})

describe('requiredWay — domain collectors honor the same gate', () => {
  it('collectKiemPhoComboModifiers skips a way-mismatched node even with owned levels', () => {
    const node = minorNode({
      id: 'ngu_combo_node',
      requiredWay: 'hidden_sword_pathway',
      effect: {
        swordPathComboModifier: {
          minOrbCount: { orb: 'orb_dam', count: 2 },
          bonusDamageMultiplier: 0.5,
        },
      },
    })

    const hien = playerWith({ cultivationPath: 'sword', cultivationWay: 'sword_pathway', nodeLevels: { ngu_combo_node: 1 } })
    expect(collectKiemPhoComboModifiers(hien, [node])).toEqual([])

    const ngu = playerWith({ cultivationPath: 'sword', cultivationWay: 'hidden_sword_pathway', nodeLevels: { ngu_combo_node: 1 } })
    expect(collectKiemPhoComboModifiers(ngu, [node])).toHaveLength(1)
  })

  it('collectKiemDaoCascadeUnlocks skips a way-mismatched node even with owned levels', () => {
    const node = minorNode({
      id: 'ngu_cascade_node',
      requiredWay: 'hidden_sword_pathway',
      effect: { cascadeUnlock: 'a' },
    })

    const hien = playerWith({ cultivationPath: 'sword', cultivationWay: 'sword_pathway', nodeLevels: { ngu_cascade_node: 1 } })
    expect(collectKiemDaoCascadeUnlocks(hien, [node])).toEqual({ a: false, e: false, d: false })

    const ngu = playerWith({ cultivationPath: 'sword', cultivationWay: 'hidden_sword_pathway', nodeLevels: { ngu_cascade_node: 1 } })
    expect(collectKiemDaoCascadeUnlocks(ngu, [node])).toEqual({ a: true, e: false, d: false })
  })

  it('collectBodyKitModifiers / collectHiddenBodyMechanicModifiers skip way-mismatched nodes', () => {
    const kitNode = minorNode({
      id: 'ung_the_kit_node',
      requiredWay: 'hidden_body_pathway',
      effect: { bodyKitModifiers: { missingHpBonusBonus: 0.5 } },
    })
    const anNode = minorNode({
      id: 'ung_the_an_node',
      requiredWay: 'hidden_body_pathway',
      effect: { hiddenBodyMechanicModifiers: { danTheBonus: 7 } },
    })
    const registry = { getAll: () => [kitNode, anNode] }

    const hien = playerWith({ cultivationPath: 'body', cultivationWay: 'body_pathway', nodeLevels: { ung_the_kit_node: 2, ung_the_an_node: 2 } })
    expect(collectBodyKitModifiers(registry, hien).missingHpBonusBonus).toBe(0)
    expect(collectHiddenBodyMechanicModifiers(registry, hien).danTheBonus).toBe(0)

    const ungThe = playerWith({ cultivationPath: 'body', cultivationWay: 'hidden_body_pathway', nodeLevels: { ung_the_kit_node: 2, ung_the_an_node: 2 } })
    expect(collectBodyKitModifiers(registry, ungThe).missingHpBonusBonus).toBe(1)
    expect(collectHiddenBodyMechanicModifiers(registry, ungThe).danTheBonus).toBe(14)
  })

  it('resolveMaxThe skips a way-mismatched node even with owned levels', () => {
    const node = minorNode({
      id: 'ngo_dao_the_cap',
      requiredWay: 'hidden_spell_pathway',
      effect: { theCapPerLevel: 5 },
    })
    const registry = { getAll: () => [node] }

    // M4 (R6): resolveMaxThe is spell_pathway machinery — ngo_dao owns no
    // The pool at all, so even a way-MATCHING the-cap node contributes
    // nothing for a ngo_dao player (both persisted shapes). The loop's
    // nodeWayApplies check remains for way-mismatched nodes inside the
    // spell_pathway tree.
    const nguHanh = playerWith({ cultivationPath: 'spell', cultivationWay: 'spell_pathway', nodeLevels: { ngo_dao_the_cap: 2 } })
    expect(resolveMaxThe(registry, nguHanh)).toBe(MAX_THE)

    const ngoDao = playerWith({ cultivationPath: 'spell', cultivationWay: 'hidden_spell_pathway', nodeLevels: { ngo_dao_the_cap: 2 } })
    expect(resolveMaxThe(registry, ngoDao)).toBe(MAX_THE)
  })
})
