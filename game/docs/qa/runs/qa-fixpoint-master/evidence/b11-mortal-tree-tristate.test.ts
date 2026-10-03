// Probe: mortal skill-tree tri-state divergence.
//
// Contract (game/docs/design/frontend-contract.md sec.D): on a mortal
// save the tree's in-scope nodes are `progression-locked` + reason
// 'initiation-pending' -- in scope, behind the initiation ritual, and
// the tri-state table (sec.A) says progression-locked renders with
// lock treatment. Grant-only nodes stay scope-hidden.
//
// The canonical renderable projection activeElementTreeFor() keeps
// those mortal entries ("for a mortal player the entries stay
// progression-locked rather than hidden" -- its own docstring).
//
// The frontend (SkillPathPanel.vue) only mounts NodeTreePanel when
// showTree === true, and showTree requires
// hasStaticPathCapability(player,'spell.elemental_casting') OR a
// beta-admitted way nodeTreeTag. A clean mortal satisfies neither,
// so every in-scope progression-locked verdict the read-model emits
// reaches zero surface -- the mortal sees no tree at all (in-scope
// content rendered as absent = half-rendered tri-state).
//
// Expected vs actual:
//   expected - mortal gets a locked-tree surface for the nodes the
//              read-model marks progression-locked (contract sec.A/D).
//   actual   - the panel's own gate (mirrored verbatim below) returns
//              false, so no node row can ever render for a mortal.

import { describe, expect, it } from 'vitest'

import { createDefaultPlayer } from '../game/src/core/player/Player'
import { betaSkillTreeFor, activeElementTreeFor } from '../game/src/core/betaScopeSkillDomain'
import { PHAP_TU_NODES } from '../game/src/data/progression/PhapTuNodes'
import { getActiveWay, hasStaticPathCapability } from '../game/src/core/player/CultivationPathSystem'
import { getActiveWayDefinition } from '../game/src/core/player/CultivationPathKit'

describe('mortal tree tri-state (contract sec.D vs SkillPathPanel)', () => {
  const mortal = createDefaultPlayer()

  it('read-model keeps every non-grant mortal node in scope (progression-locked)', () => {
    expect(mortal.realmId).toBe('mortal')
    const tree = betaSkillTreeFor(mortal)
    expect(tree.nodes.length).toBeGreaterThan(0)

    const nonGrant = tree.nodes.filter((node) => node.reason !== 'grant-only-node')
    expect(nonGrant.length).toBeGreaterThan(0)
    for (const node of nonGrant) {
      expect(node.state).toBe('progression-locked')
      expect(node.reason).toBe('initiation-pending')
    }
  })

  it('activeElementTreeFor (the renderable projection) is non-empty for a mortal', () => {
    const renderable = activeElementTreeFor(mortal, PHAP_TU_NODES)
    expect(renderable.length).toBeGreaterThan(0)
    expect(renderable.every((node) => node.state !== 'scope-hidden')).toBe(true)
  })

  it('the panel gate (verbatim mirror of SkillPathPanel.showTree) hides all of it', () => {
    // showTree = hasElementalCasting || (wayNodeTreeTag !== undefined && betaWayAdmitted)
    const hasElementalCasting = hasStaticPathCapability(mortal, 'spell.elemental_casting')
    const wayNodeTreeTag = getActiveWayDefinition(mortal)?.nodeTreeTag
    const way = getActiveWay(mortal)
    const betaWayAdmitted = way === undefined || way === 'spell_pathway'
    const showTree = hasElementalCasting || (wayNodeTreeTag !== undefined && betaWayAdmitted)

    expect(hasElementalCasting).toBe(false)
    expect(wayNodeTreeTag).toBeUndefined()
    expect(showTree).toBe(false)
  })
})
