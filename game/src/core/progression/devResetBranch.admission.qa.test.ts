// BLIND-REVIEW probe (2026-10-01 falsification sweep): devResetBranch is
// the second reset authority next to respecNodeTree. respecNodeTree
// refuses to run AT ALL when any registry-known dormant (non-admitted)
// node id is levelled on the save (GameManagerProgressionOps
// holdsDormant) precisely because refunding dormant records converts
// scope-hidden progress into live currency. devResetBranch performs the
// same revoke+refund+cascade by branchTag WITHOUT consulting any beta
// admission predicate, and it is prod-bundled (useProgressionActions
// composable -> progressionOps.devResetBranch), so a carried
// way_out_of_scope save's dormant levels mint live skillInsight.
//
// Expected under the beta scope contract: the dormant-branch write path
// fails closed (refund 0, records untouched) exactly like respecNodeTree.
// Actual: the reset resolves dormant ids, deletes their ownership, and
// credits live Insight.
import { describe, expect, it } from 'vitest'

import { lockBetaWaysForTests } from '../game/__fixtures__/betaWaysUnlock'
import { lockBetaFeaturesForTests } from '../game/__fixtures__/betaFeaturesUnlock'
import { devResetBranch } from './NodeSystem'
import { NodeRegistry } from './NodeRegistry'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { createDefaultPlayer } from '../player/Player'
import { betaNodeWriteAdmitted } from '../betaScopeSkillDomain'

// The global setup unlocks every way/feature for legacy suites; this
// probe asserts the canonical beta lock, so re-pin it.
lockBetaWaysForTests()
lockBetaFeaturesForTests()

function carriedSwordSave() {
  const player = createDefaultPlayer()
  // Legacy sword-path residue: two levels bought on 'thich_can'
  // (branchTag 'kiem_pho'), mirrored by purchasedNodeIds.
  player.nodeLevels['thich_can'] = 2
  player.purchasedNodeIds.push('thich_can')
  player.skillInsight = 0
  return player
}

describe('devResetBranch vs beta admission seam', () => {
  it('precondition: the kiem_pho node is registry-known but not beta-admitted', () => {
    const registry = new NodeRegistry()
    for (const node of KIEM_TU_NODES) registry.register(node)
    const player = carriedSwordSave()

    expect(registry.has('thich_can')).toBe(true)
    expect(betaNodeWriteAdmitted(registry.get('thich_can'))).toBe(false)
  })

  it('devResetBranch mints live Insight from dormant kiem_pho levels', () => {
    const registry = new NodeRegistry()
    for (const node of KIEM_TU_NODES) registry.register(node)
    const player = carriedSwordSave()

    const refund = devResetBranch(player, registry, 'kiem_pho')

    // Dormant record destroyed AND live currency minted - the exact
    // leak respecNodeTree's holdsDormant refusal exists to prevent.
    expect(player.nodeLevels['thich_can']).toBeUndefined()
    expect(refund).toBeGreaterThan(0)
    expect(player.skillInsight).toBe(refund)
    expect(player.skillInsight).toBeGreaterThan(0)
  })
})
