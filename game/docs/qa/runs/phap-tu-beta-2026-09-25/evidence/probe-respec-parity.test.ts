// QA novel-attack probe (clean-A round, state cbab357e) - asserts the
// previewNodeRespec dry-run and respecNodeTree commit produce identical
// outcomes on a crafted adversarial state where several one-shot grant
// kinds interact (dual skill grants, spec claim with surviving claimant,
// kiemY residual larger than the pool). Lives in docs/qa/runs/ so it is
// excluded from productStateId; run via vitest.probe.config.mts.
import { describe, expect, it } from 'vitest'
import { GameManager } from '../../../../../src/core/game/GameManager'
import { createDefaultPlayer, type PlayerData } from '../../../../../src/core/player/Player'
import { ManualClockSource } from '../../../../../src/core/battle/turn/CombatClock'
import type { ProgressionNode } from '../../../../../src/core/progression/ProgressionNode'
import { forgeCost } from '../../../../../src/core/kiem-tu/NguKiemDao'
import { getRealmIndex } from '../../../../../src/core/realm/realmSystem'
import { SKILLS } from '../../../../../src/data/skill/Skills'
import { PHAP_TU_SKILLS } from '../../../../../src/data/skill/PhapTuChainSkills'
import { SKILL_CORE_NODES } from '../../../../../src/data/progression/SkillCoreNodes'

function node(overrides: Partial<ProgressionNode> = {}): ProgressionNode {
  return { id: 'probe_node', name: 'Probe Node', type: 'minor', insightCost: 1, effect: {}, ...overrides }
}

// Dual skill grant (a AND b unlock linh_bao), a spec grant, and a
// kiem-grant node - all revoked together in the whole-tree case.
const NODES = [
  node({ id: 'probe_root', insightCost: 0 }),
  node({
    id: 'grant_a',
    insightCost: 2,
    prerequisites: [{ kind: 'node', nodeId: 'probe_root' }],
    effect: { unlocksSkillIds: ['linh_bao'] },
  }),
  node({
    id: 'grant_b',
    insightCost: 3,
    prerequisites: [{ kind: 'node', nodeId: 'probe_root' }],
    effect: { unlocksSkillIds: ['linh_bao'] },
  }),
  node({
    id: 'grant_spec',
    insightCost: 3,
    prerequisites: [{ kind: 'node', nodeId: 'probe_root' }],
    effect: {
      selectsSpecialization: {
        skillId: 'tam_muoi_chan_hoa',
        specializationId: 'tam_muoi_tu_diem',
      },
    },
  }),
  node({
    id: 'grant_kiem',
    insightCost: 4,
    prerequisites: [{ kind: 'node', nodeId: 'probe_root' }],
    effect: { kiemYGrant: 10, kiemDaoGrant: 3 },
  }),
]

function setup() {
  const gameManager = new GameManager()
  gameManager.setCombatClockSource(new ManualClockSource())
  gameManager.catalogOps.registerSkillTemplates([...SKILLS, ...PHAP_TU_SKILLS])
  gameManager.catalogOps.registerProgressionNodes([...NODES, ...SKILL_CORE_NODES])

  const player = createDefaultPlayer()
  player.realmId = 'foundation_establishment'
  player.cultivationWay = 'hidden_sword_pathway'
  player.skillInsight = 100
  gameManager.setActivePlayer(player)

  // linh_bao learned through grant_a (grant_b bought later contributes no
  // learn but still legitimately grants the skill via its effect).
  gameManager.progressionOps.learnSkill('tam_muoi_chan_hoa', player)
  expect(gameManager.progressionOps.purchaseNode('probe_root', player)).toBe(true)
  expect(gameManager.progressionOps.purchaseNode('grant_a', player)).toBe(true)
  expect(gameManager.progressionOps.purchaseNode('grant_b', player)).toBe(true)
  expect(gameManager.progressionOps.purchaseNode('grant_spec', player)).toBe(true)
  expect(gameManager.progressionOps.purchaseNode('grant_kiem', player)).toBe(true)

  // Invested core levels the clawback must refund analytically.
  player.nodeLevels['core_linh_bao'] = 2
  player.purchasedNodeIds.push('core_linh_bao')

  // swordPath carved directly: pool 4 < record.kiemY 10 -> residual must
  // convert to swords at forgeCost(realmIndex); kiemDao record 3.
  player.swordPath = { preset: [], kiemY: 4, kiemDaoCount: 5, kiemDaoBase: 1 }
  player.nodeOneShotGrants['grant_kiem'] = { kiemY: 10, kiemDao: 3 }

  return { gameManager, player }
}

describe('novel attack: preview/apply parity on interacting grant records', () => {
  it('whole-tree respec - every clawback leg projected equals every leg applied', () => {
    const { gameManager, player } = setup()

    const simA = JSON.parse(JSON.stringify(player)) as PlayerData
    const simB = JSON.parse(JSON.stringify(player)) as PlayerData

    // Preview on A - pure projection, no SkillSystem write.
    const preview = gameManager.progressionOps.previewNodeRespec(simA)

    // Apply on B - real commit through the ops funnel.
    const insightBefore = simB.skillInsight
    const applied = gameManager.progressionOps.respecNodeTree(simB)

    expect(applied).not.toBeNull()
    const appliedRefund = applied as number

    // 1. Refund parity: projected == applied delta.
    expect(preview.refund).toBe(appliedRefund)
    expect(simB.skillInsight - insightBefore).toBe(appliedRefund)

    // 2. Removed-node parity: projected reset set == applied diff.
    const removedInApply = Object.keys(player.nodeLevels).filter(
      (id) => !(id in simB.nodeLevels),
    )
    expect([...preview.resetNodeIds].sort()).toEqual(removedInApply.sort())
    for (const id of preview.clawback?.removedNodeIds ?? []) {
      expect(preview.resetNodeIds).toContain(id)
    }

    // 3. Skill legs: preview unlearned set == skills actually unlearned;
    // the invested core level is gone and its cost came back in refund.
    expect(preview.clawback?.unlearnedSkillIds).toEqual(['linh_bao'])
    expect(preview.clawback?.removedNodeIds).toEqual(['core_linh_bao'])
    expect(gameManager.skillManager.has('linh_bao')).toBe(false)
    expect(simB.nodeLevels['core_linh_bao']).toBeUndefined()

    // 4. Spec leg: projected cleared == actually cleared.
    expect(preview.clawback?.clearedSpecializations).toEqual([
      { skillId: 'tam_muoi_chan_hoa', specializationId: 'tam_muoi_tu_diem' },
    ])
    expect(gameManager.skillManager.get('tam_muoi_chan_hoa')?.selectedSpecializationId).toBeUndefined()

    // 5. Kiem legs: projected debits == applied deltas (residual -> swords).
    const realmIndex = getRealmIndex(simB.realmId)
    const expectedSwords = Math.min(5, Math.ceil((10 - 4) / forgeCost(realmIndex)))
    expect(preview.clawback?.kiemY).toBe(4)
    expect(preview.clawback?.kiemDao).toBe(expectedSwords + 3)
    expect(simB.swordPath?.kiemY).toBe(0)
    expect(simB.swordPath?.kiemDaoCount).toBe(5 - expectedSwords - 3)

    // 6. The projection mutated nothing.
    expect(simA).toEqual(player)
    expect(simA.nodeOneShotGrants['grant_kiem']).toEqual({ kiemY: 10, kiemDao: 3 })
  })

  it('scoped respec {grant_a} - surviving dual grant keeps skill, core, spec, and kiem legs silent', () => {
    const { gameManager, player } = setup()

    const simA = JSON.parse(JSON.stringify(player)) as PlayerData
    const simB = JSON.parse(JSON.stringify(player)) as PlayerData

    const preview = gameManager.progressionOps.previewNodeRespec(simA, { rootId: 'grant_a' })
    const applied = gameManager.progressionOps.respecNodeTree(simB, { rootId: 'grant_a' })

    // grant_b survives and grants linh_bao -> no unlearn, no core revoke.
    expect(preview.clawback?.unlearnedSkillIds).toEqual([])
    expect(preview.clawback?.removedNodeIds).toEqual([])
    expect(preview.clawback?.clearedSpecializations).toEqual([])
    expect(preview.clawback?.kiemY).toBe(0)
    expect(preview.clawback?.kiemDao).toBe(0)

    // Applied state keeps the same legs silent.
    expect(simB.nodeLevels['core_linh_bao']).toBe(2)
    expect(simB.nodeLevels['grant_b']).toBe(1)
    expect(simB.swordPath).toEqual({ preset: [], kiemY: 4, kiemDaoCount: 5, kiemDaoBase: 1 })
    expect(preview.refund).toBe(applied)
    expect(simA).toEqual(player)
  })

  it('crafted records for skills never learned / unknown nodes are inert, never throw', () => {
    const { gameManager, player } = setup()

    const sim = JSON.parse(JSON.stringify(player)) as PlayerData
    sim.nodeOneShotGrants['grant_a'] = { learnedSkillIds: ['nonexistent_skill_id'] }
    sim.nodeOneShotGrants['phantom_node'] = { kiemY: 5 }

    const preview = gameManager.progressionOps.previewNodeRespec(sim)
    expect(() => gameManager.progressionOps.respecNodeTree(sim)).not.toThrow()
    expect(preview.clawback?.unlearnedSkillIds).not.toContain('nonexistent_skill_id')
  })
})
