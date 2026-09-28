// QA novel-attack probe (clean-B round, state 65be0a9a...) - executes
// crafted adversarial states against the four seams the clean-B
// adjudication changed. Lives in docs/qa/runs/ so it is excluded from
// productStateId; run via vitest.probe.config.mts.
import { describe, expect, it, vi } from 'vitest'
import { createDefaultPlayer } from '../../../../../src/core/player/Player'
import { grantCultivationPathRealmReward } from '../../../../../src/core/player/CultivationPathSystem'
import { purchaseNode, switchRoute } from '../../../../../src/core/progression/NodeSystem'
import { ALL_PROGRESSION_NODES } from '../../../../../src/data/progression/ProgressionNodeCatalog'
import { PHAP_TU_NODES } from '../../../../../src/data/progression/PhapTuNodes'
import { PHAP_TU_AN_NODES } from '../../../../../src/data/progression/PhapTuAnNodes'
import { KIEM_TU_NODES } from '../../../../../src/data/progression/KiemTuNodes'
import { THE_TU_NODES } from '../../../../../src/data/progression/TheTuNodes'
import { THE_TU_AN_NODES } from '../../../../../src/data/progression/TheTuAnNodes'
import { SKILL_CORE_NODES } from '../../../../../src/data/progression/SkillCoreNodes'
import type { ProgressionNode } from '../../../../../src/core/progression/ProgressionNode'

const GROUPS = [PHAP_TU_NODES, PHAP_TU_AN_NODES, KIEM_TU_NODES, THE_TU_NODES, THE_TU_AN_NODES, SKILL_CORE_NODES]

function node(overrides: Partial<ProgressionNode> = {}): ProgressionNode {
  return { id: 'probe', name: 'Probe', type: 'minor', insightCost: 1, effect: {}, ...overrides }
}

describe('novel attack: grant validator seams', () => {
  it('refuses a crafted core_-prefixed rewardOnly grant', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.realmId = 'foundation_establishment'
    const evil = node({ id: 'core_fake', rewardOnly: true, effect: {} })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // real authored grant ids resolve to the evil node via the fake resolver
    grantCultivationPathRealmReward(player, 'foundation_establishment', (id) =>
      id.startsWith('core_') || id === 'the_thuc_tinh' || id === 'ngo_dao_hon_don' ? evil : undefined,
    )
    expect(player.nodeLevels?.['core_fake']).toBeUndefined()
    warn.mockRestore()
  })

  it('clamps a rewardOnly grant to maxLevel and never writes the mirror', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    const byId = new Map(ALL_PROGRESSION_NODES.map((n) => [n.id, n]))
    grantCultivationPathRealmReward(player, 'foundation_establishment', (id) => byId.get(id))
    for (const id of Object.keys(player.nodeLevels ?? {})) {
      expect(player.purchasedNodeIds).not.toContain(id)
      const n = byId.get(id)!
      expect(n.rewardOnly).toBe(true)
    }
  })
})

describe('novel attack: switchRoute rewardOnly seam', () => {
  it('rewardOnly+routeTag crafted node survives a switch', () => {
    const sealed = node({ id: 'sealed_grant', routeTag: 'dot', rewardOnly: true })
    const bought = node({ id: 'route_bought', routeTag: 'dot' })
    const nodes = [sealed, bought]
    const registry = {
      get: (id: string) => nodes.find((n) => n.id === id)!,
      getAll: () => nodes,
    }
    const player = createDefaultPlayer()
    player.skillInsight = 100
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.spellPath = { element: 'fire', route: 'dot' }
    purchaseNode(player, registry.get('route_bought'))
    player.nodeLevels['sealed_grant'] = 2 // as a grant would leave it

    switchRoute(player, registry, 'no')
    expect(player.nodeLevels['sealed_grant']).toBe(2)
    expect(player.nodeLevels['route_bought']).toBeUndefined()
    expect(player.spellPath.route).toBe('no')
  })
})

describe('novel attack: catalog single-source parity', () => {
  it('ALL_PROGRESSION_NODES equals the six group arrays exactly', () => {
    const flat = GROUPS.flat()
    expect(ALL_PROGRESSION_NODES.length).toBe(flat.length)
    expect(new Set(ALL_PROGRESSION_NODES.map((n) => n.id)).size).toBe(flat.length)
    for (const n of ALL_PROGRESSION_NODES) expect(flat).toContain(n)
  })

  it('no rewardOnly node carries routeTag (seam census)', () => {
    expect(ALL_PROGRESSION_NODES.filter((n) => n.rewardOnly && n.routeTag)).toEqual([])
  })

  it('no nodeLevels->core_ grant can exist in authored realmRewards', () => {
    // every grantedNodeLevels entry in authored data must resolve to a
    // rewardOnly non-core node - else the validator would skip it
    for (const n of ALL_PROGRESSION_NODES) {
      if (!n.rewardOnly) continue
      expect(n.id.startsWith('core_')).toBe(false)
    }
  })
})
