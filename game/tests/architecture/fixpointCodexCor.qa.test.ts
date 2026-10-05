/**
 * fixpoint-codex-COR pin: a pre-lock save that carries an out-of-beta
 * committed element (e.g. water) must resolve as UNCOMMITTED on the
 * skill-tree surface - matching the combat rail's element-uncommitted
 * verdict - and every node stamped for that element must refuse writes
 * and emit no effects. New commits are already fail-closed via
 * selectSpellPathElement's isBetaElement gate.
 */
import { describe, expect, it } from 'vitest'
import {
  betaNodeWriteAdmitted,
  betaSkillTreeFor,
} from '../../src/core/betaScopeSkillDomain'
import { lockBetaElementsForTests } from '../../src/core/game/__fixtures__/betaElementsUnlock'
import { lockBetaWaysForTests } from '../../src/core/game/__fixtures__/betaWaysUnlock'
import { createDefaultPlayer } from '../../src/core/player/Player'
import { PHAP_TU_NODES } from '../../src/data/progression/PhapTuNodes'
import type { ElementType } from '../../src/core/battle/CombatTypes'

// Lock suites re-pin the canonical beta scope - the shared setup file
// admits the full catalog for pre-lock historical suites.
lockBetaElementsForTests()
lockBetaWaysForTests()

function committedElementSave(element: ElementType) {
  return {
    ...createDefaultPlayer(),
    realmId: 'qi_refining',
    cultivationPath: 'spell' as const,
    cultivationWay: 'spell_pathway' as const,
    spellPath: { element },
  }
}

describe('fixpoint-codex-COR - out-of-beta committed element', () => {
  it('a legacy water commit resolves as uncommitted on the tree surface', () => {
    const player = committedElementSave('water')
    expect(betaSkillTreeFor(player).element).toBe(null)
  })

  it('an in-beta fire commit still resolves normally', () => {
    const player = committedElementSave('fire')
    expect(betaSkillTreeFor(player).element).toBe('fire')
  })

  it('out-of-beta elementTag nodes refuse writes', () => {
    const waterNodes = PHAP_TU_NODES.filter((node) => node.elementTag === 'water')
    const fireNodes = PHAP_TU_NODES.filter((node) => node.elementTag === 'fire')

    expect(waterNodes.length).toBeGreaterThan(0)
    expect(fireNodes.length).toBeGreaterThan(0)

    for (const node of waterNodes) {
      expect(betaNodeWriteAdmitted(node), `${node.id} must not take insight`).toBe(false)
    }
    for (const node of fireNodes) {
      expect(betaNodeWriteAdmitted(node), `${node.id} stays admitted`).toBe(true)
    }
  })
})
