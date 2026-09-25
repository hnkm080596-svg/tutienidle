import { describe, expect, it } from 'vitest'
import { THE_TU_NODES } from './TheTuNodes'
import { NodeRegistry } from '../../core/progression/NodeRegistry'
import { canPurchaseNode, getNodeLevel, purchaseNode } from '../../core/progression/NodeSystem'
import { createDefaultPlayer } from '../../core/player/Player'
import { collectBodyKitModifiers } from '../../core/the-tu/TheTuKitModifiers'
import { buildTheTuKit } from '../skill/TheTuSkills'
import { CUONG_QUYEN, LOAN_DAU } from '../skill/TheTuSkills'
import { TRAN_KINH_DEBUFF } from '../buff/TheTuBuffs'
import { STAT_DOMAIN } from '../../core/stats/StatDomain'
import type { StatType } from '../../core/stats/StatTypes'

// The Tu Reimagined (plan Task 12, spec section 8.1) - body tree data:
// mutex roots, realm gates, collector->kit delivery, INV-13 authoring ban.

// Every node in this tree carries requiredCultivationPath 'body' +
// requiredWay 'body_pathway' - the fixture player owns both, plus
// techniqueRank 5 (M-QI-06 authored major gates), so the purchase/upgrade
// gates hold.
function playerWith(overrides: Partial<ReturnType<typeof createDefaultPlayer>> = {}) {
  return {
    ...createDefaultPlayer(),
    skillInsight: 99,
    cultivationPath: 'body' as const,
    cultivationWay: 'body_pathway' as const,
    techniqueProgress: { rank: 5, grade: 1 },
    ...overrides,
  }
}

function registryWithNodes() {
  const registry = new NodeRegistry()
  for (const node of THE_TU_NODES) {
    registry.register(node)
  }
  return registry
}

function node(id: string) {
  const found = THE_TU_NODES.find((candidate) => candidate.id === id)
  if (!found) {
    throw new Error(`node ${id} not authored`)
  }
  return found
}

describe('TheTuNodes — root mutex + realm gates (INV-2)', () => {
  it('cuong_chien and tran_the are excludesNode-mutual roots gated at qi_refining', () => {
    const cuong = node('cuong_chien')
    const tran = node('tran_the')

    expect(cuong.prerequisites).toContainEqual({ kind: 'excludesNode', nodeId: 'tran_the' })
    expect(tran.prerequisites).toContainEqual({ kind: 'excludesNode', nodeId: 'cuong_chien' })
    expect(cuong.prerequisites).toContainEqual({ kind: 'realm', realmId: 'qi_refining' })
    expect(tran.prerequisites).toContainEqual({ kind: 'realm', realmId: 'qi_refining' })
  })

  it('owning one root blocks purchasing the other (both directions)', () => {
    const playerA = playerWith({ realmId: 'qi_refining', nodeLevels: { cuong_chien: 1 }, purchasedNodeIds: ['cuong_chien'] })
    const playerB = playerWith({ realmId: 'qi_refining', nodeLevels: { tran_the: 1 }, purchasedNodeIds: ['tran_the'] })

    expect(canPurchaseNode(playerA, node('tran_the'))).toBe(false)
    expect(canPurchaseNode(playerB, node('cuong_chien'))).toBe(false)
  })

  it('roots are purchasable at qi_refining; deeper nodes require foundation_establishment', () => {
    const qiPlayer = playerWith({ realmId: 'qi_refining' })
    expect(canPurchaseNode(qiPlayer, node('cuong_chien'))).toBe(true)

    const deeper = THE_TU_NODES.filter(
      (candidate) =>
        (candidate.prerequisites ?? []).some(
          (prerequisite) => prerequisite.kind === 'realm' && prerequisite.realmId === 'foundation_establishment',
        ),
    )
    expect(deeper.length).toBeGreaterThan(0)
    for (const gated of deeper) {
      const nodePrereqs = (gated.prerequisites ?? [])
        .filter((prerequisite) => prerequisite.kind === 'node')
        .map((prerequisite) => (prerequisite as { nodeId: string }).nodeId)
      const nodeLevels: Record<string, number> = { cuong_chien: 1, tran_the: 1 }
      for (const prereqId of nodePrereqs) {
        nodeLevels[prereqId] = 1
      }
      const owner = playerWith({
        realmId: 'qi_refining',
        nodeLevels,
        purchasedNodeIds: Object.keys(nodeLevels),
      })
      expect(canPurchaseNode(owner, gated), `${gated.id} must stay gated at qi_refining`).toBe(false)
      owner.realmId = 'foundation_establishment'
      // M-F-TECHNIQUE (F5) - at realm index 2 the grade-1 cycle is
      // sealed: the mirror shows the caught-up in-band grade-2 cycle.
      owner.techniqueProgress = { rank: 5, grade: 2 }
      expect(canPurchaseNode(owner, gated), `${gated.id} opens at foundation_establishment`).toBe(true)
    }
  })
})

describe('TheTuNodes — node -> collector -> kit-def delivery', () => {
  it('Trọng Quyền node levels raise the built cuong_quyen clone coefficient, not the registry def', () => {
    const registry = registryWithNodes()
    const player = playerWith({ realmId: 'qi_refining' })

    purchaseNode(player, node('cuong_chien'))
    const growth = node('minor_trong_quyen')
    purchaseNode(player, growth)
    player.nodeLevels[growth.id] = 3

    const mods = collectBodyKitModifiers(registry, player)
    expect(mods.cuongQuyenCoefficientBonus).toBeCloseTo(0.1 * 3)

    const kit = buildTheTuKit('cuong_chien', mods)
    expect(kit.basic.damage?.multiplier).toBeCloseTo((CUONG_QUYEN.damage?.multiplier ?? 0) + 0.3)
    // Registry def untouched - participant clones carry the bonus.
    expect(CUONG_QUYEN.damage?.multiplier).not.toBeCloseTo(kit.basic.damage!.multiplier)
  })

  it('Trấn Kình node grants the tran_kinh weaken application on the tran_ap clone (stacks scale the cut)', () => {
    const registry = registryWithNodes()
    const player = playerWith({ realmId: 'qi_refining' })

    purchaseNode(player, node('tran_the'))
    const kinh = node('minor_tran_kinh')
    purchaseNode(player, kinh)
    player.nodeLevels[kinh.id] = 2

    const mods = collectBodyKitModifiers(registry, player)
    expect(mods.tranKinhStacksBonus).toBe(2)

    const kit = buildTheTuKit('tran_the', mods)
    const application = kit.basic.appliesAilments?.find((entry) => entry.buffDefinitionId === 'tran_kinh')
    expect(application?.chance).toBe(1)
    expect(application?.stacks).toBe(3)
    expect(TRAN_KINH_DEBUFF.statModifiers?.[0]?.flat).toBeLessThan(0)
  })

  it('without the Trấn Kình node the tran_ap clone carries no weaken rider', () => {
    const registry = registryWithNodes()
    const player = playerWith({ realmId: 'qi_refining' })
    purchaseNode(player, node('tran_the'))

    const kit = buildTheTuKit('tran_the', collectBodyKitModifiers(registry, player))
    expect(kit.basic.appliesAilments ?? []).toHaveLength(0)
  })

  it('Cuồng Ý node levels feed the Huyết Cuồng channel only while Loạn Đấu is owned (kit-local scope)', () => {
    const registry = registryWithNodes()
    const player = playerWith({ realmId: 'foundation_establishment', techniqueProgress: { rank: 5, grade: 2 } })

    purchaseNode(player, node('cuong_chien'))
    purchaseNode(player, node('major_loan_dau'))
    const cuongY = node('minor_cuong_y')
    purchaseNode(player, cuongY)
    player.nodeLevels[cuongY.id] = 2

    const mods = collectBodyKitModifiers(registry, player)
    const kit = buildTheTuKit('cuong_chien', mods, { special: true })

    for (const def of [kit.basic, kit.special!]) {
      expect(def.damage?.missingHpBonusPerMissingPercent).toBeGreaterThan(0)
    }
    // Authored defs stay clean - the scalar is clone-local.
    expect(LOAN_DAU.damage?.missingHpBonusPerMissingPercent).toBeUndefined()
  })
})

describe('TheTuNodes — authoring contract (INV-13 + single render path)', () => {
  const FORBIDDEN: StatType[] = ['counterChance', 'protectChance', 'followUpChance']

  it('no authored modifier targets the the_tu_an chance stats', () => {
    for (const candidate of THE_TU_NODES) {
      for (const modifier of candidate.effect.statModifiers ?? []) {
        expect(FORBIDDEN.includes(modifier.stat), `${candidate.id} emits ${modifier.stat}`).toBe(false)
      }
    }
  })

  it('every gated-stat modifier declares domain body', () => {
    for (const candidate of THE_TU_NODES) {
      for (const modifier of candidate.effect.statModifiers ?? []) {
        const gate = STAT_DOMAIN[modifier.stat]
        if (gate && gate !== 'universal') {
          expect(modifier.domain, `${candidate.id}:${modifier.stat} missing domain tag`).toBe('body')
        }
      }
    }
  })

  it('all nodes share the single the_tu branchTag (one tree view; mutex enforced by gates)', () => {
    for (const candidate of THE_TU_NODES) {
      expect(candidate.branchTag).toBe('the_tu')
    }
  })

  it('kit resolution roots exist exactly once', () => {
    expect(getNodeLevel(playerWith({ nodeLevels: { cuong_chien: 1 } }), 'cuong_chien')).toBe(1)
    expect(THE_TU_NODES.filter((candidate) => candidate.role === 'root').map((candidate) => candidate.id).sort()).toEqual([
      'cuong_chien',
      'tran_the',
    ])
  })
})
