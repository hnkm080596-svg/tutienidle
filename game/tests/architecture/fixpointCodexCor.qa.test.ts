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
import { validateGameSaveShape } from '../../src/services/save/saveShapeValidation'
import { CURRENT_SAVE_VERSION } from '../../src/services/save/SaveSystem'
import type { GameSave } from '../../src/services/save/saveTypes'
import type { ElementType } from '../../src/core/element/ElementType'

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

  it('the read model agrees with the write refusal (F-READ-1)', () => {
    // An uncommitted spell_pathway state (only reachable pre-validation
    // - the boundary below now rejects this shape) can buy NO
    // out-of-beta node: the tree must scope-hide it, not report it
    // purchasable while the ops layer refuses the write.
    const player = {
      ...createDefaultPlayer(),
      realmId: 'qi_refining',
      cultivationPath: 'spell' as const,
      cultivationWay: 'spell_pathway' as const,
      spellPath: { element: null },
    }
    const tree = betaSkillTreeFor(player)
    const byId = new Map(tree.nodes.map((entry) => [entry.nodeId, entry]))

    for (const node of PHAP_TU_NODES) {
      const entry = byId.get(node.id as string)
      if (node.elementTag !== undefined && node.elementTag !== 'fire') {
        expect(entry?.state, `${node.id} hidden`).toBe('scope-hidden')
        expect(entry?.reason, `${node.id} reason`).toBe('non-beta-scope')
      }
      if (node.elementTag === 'fire') {
        expect(entry?.reason, `${node.id} stays out of the hidden class`)
          .not.toBe('non-beta-scope')
      }
    }
  })
})

describe('fixpoint-codex-COR - out-of-beta element rejection (F-SCOPE-1)', () => {
  function spellWaySave(element: ElementType | null): GameSave {
    return {
      version: CURRENT_SAVE_VERSION,
      player: {
        ...createDefaultPlayer(),
        realmId: 'qi_refining',
        cultivationPath: 'spell',
        cultivationWay: 'spell_pathway',
        spellPath: { element },
      },
      techniques: [],
      skills: [],
      materials: [],
      equipment: [],
      pills: [],
      talismans: [],
      formations: [],
      buildings: [],
      equipmentSlots: [],
    }
  }

  const scopeIssue = (save: GameSave) =>
    validateGameSaveShape(save).issues.find(
      (issue) =>
        issue.path === 'player.spellPath.element' &&
        issue.message.includes('beta scope'),
    )

  it('a null commit on a post-mortal spell_pathway save rejects', () => {
    expect(scopeIssue(spellWaySave(null))).toBeTruthy()
  })

  it('an out-of-beta commit on a post-mortal spell_pathway save rejects', () => {
    expect(scopeIssue(spellWaySave('water'))).toBeTruthy()
    expect(scopeIssue(spellWaySave('metal'))).toBeTruthy()
  })

  it('an in-beta commit stays admitted (control)', () => {
    expect(scopeIssue(spellWaySave('fire'))).toBeUndefined()
  })
})
