import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import { ManualClockSource } from '../battle/turn/CombatClock'
import type { ProgressionNode } from '../progression/ProgressionNode'
import { freshSwordPathState } from '../kiem-tu/KiemTuState'
import { forgeCost } from '../kiem-tu/NguKiemDao'
import { getRealmIndex } from '../realm/realmSystem'
import { SKILLS } from '../../data/skill/Skills'
import { PHAP_TU_SKILLS } from '../../data/skill/PhapTuChainSkills'
import { SKILL_CORE_NODES } from '../../data/progression/SkillCoreNodes'

// F-W-2 (v82) - respec/devReset/switchRoute thu hoi dung cac one-shot
// grant ma node bi revoke da phat (skill unlock + core refund, kiemY/
// kiemDao absorb, specialization), nho provenance trong
// player.nodeOneShotGrants. Truoc v82 respec hoan 100% Insight nhung
// bo quen grant -> exploit ren kiem/skill mien phi.

function node(overrides: Partial<ProgressionNode> = {}): ProgressionNode {
  return {
    id: 'ops_node',
    name: 'Ops Node',
    type: 'minor',
    insightCost: 1,
    effect: {},
    ...overrides,
  }
}

function setup(nodes: ProgressionNode[]) {
  const gameManager = new GameManager()
  gameManager.setCombatClockSource(new ManualClockSource())
  gameManager.catalogOps.registerSkillTemplates([...SKILLS, ...PHAP_TU_SKILLS])
  gameManager.catalogOps.registerProgressionNodes([...nodes, ...SKILL_CORE_NODES])

  const player = createDefaultPlayer()
  player.skillInsight = 1000
  gameManager.setActivePlayer(player)

  return { gameManager, player }
}

describe('progressionOps respec one-shot clawback (F-W-2)', () => {
  it('respec unlearns a node-granted skill and deletes its grant record', () => {
    const grantNode = node({ id: 'grant_skill', effect: { unlocksSkillIds: ['linh_bao'] } })
    const { gameManager, player } = setup([grantNode])

    expect(gameManager.progressionOps.purchaseNode('grant_skill', player)).toBe(true)
    expect(gameManager.skillManager.has('linh_bao')).toBe(true)
    expect(player.nodeOneShotGrants['grant_skill']?.learnedSkillIds).toEqual(['linh_bao'])

    gameManager.progressionOps.respecNodeTree(player)

    expect(gameManager.skillManager.has('linh_bao')).toBe(false)
    expect(player.nodeOneShotGrants['grant_skill']).toBeUndefined()
  })

  it('a node-granted skill survives respec while another owned node still grants it', () => {
    const first = node({ id: 'grant_a', effect: { unlocksSkillIds: ['linh_bao'] } })
    const second = node({ id: 'grant_b', effect: { unlocksSkillIds: ['linh_bao'] } })
    const { gameManager, player } = setup([first, second])

    expect(gameManager.progressionOps.purchaseNode('grant_a', player)).toBe(true)
    expect(gameManager.progressionOps.purchaseNode('grant_b', player)).toBe(true)

    // Branch-scope respec only revokes grant_a's subtree - grant_b is a
    // sibling and stays, so the shared skill must survive.
    gameManager.progressionOps.respecNodeTree(player, { rootId: 'grant_a' })

    expect(player.nodeLevels['grant_a']).toBeUndefined()
    expect(gameManager.skillManager.has('linh_bao')).toBe(true)
  })

  it('an already-learned skill is not recorded, so respec never strips another source', () => {
    const grantNode = node({ id: 'grant_dup', effect: { unlocksSkillIds: ['linh_bao'] } })
    const { gameManager, player } = setup([grantNode])

    // Skill learned elsewhere FIRST (ritual/kit): purchase fires
    // learnSkill -> false, no provenance is written.
    gameManager.progressionOps.learnSkill('linh_bao', player)
    expect(gameManager.progressionOps.purchaseNode('grant_dup', player)).toBe(true)
    expect(player.nodeOneShotGrants['grant_dup']).toBeUndefined()

    gameManager.progressionOps.respecNodeTree(player)

    expect(gameManager.skillManager.has('linh_bao')).toBe(true)
  })

  it('respec claws back kiemY through loseKiemY - pool debit then sword absorb', () => {
    const grantNode = node({ id: 'grant_y', effect: { kiemYGrant: 50 } })
    const { gameManager, player } = setup([grantNode])

    player.cultivationPath = 'sword'
    player.cultivationWay = 'hidden_sword_pathway'
    player.swordPath = freshSwordPathState()
    player.realmId = 'qi_refining'

    expect(gameManager.progressionOps.purchaseNode('grant_y', player)).toBe(true)
    expect(player.nodeOneShotGrants['grant_y']?.kiemY).toBe(50)
    expect(player.swordPath.kiemY).toBe(50)

    // Drop the pool below the recorded grant so loseKiemY owes swords:
    // residual 40 < forgeCost(qi_refining)=9999 absorbs exactly 1 sword.
    player.swordPath.kiemY = 10
    player.swordPath.kiemDaoCount = 3
    const cost = forgeCost(getRealmIndex(player.realmId))
    expect(cost).toBe(9999)

    gameManager.progressionOps.respecNodeTree(player)

    expect(player.swordPath.kiemY).toBe(0)
    expect(player.swordPath.kiemDaoCount).toBe(2)
    expect(player.nodeOneShotGrants['grant_y']).toBeUndefined()
  })

  it('respec clears a node-applied specialization', () => {
    const grantNode = node({
      id: 'grant_spec',
      effect: {
        selectsSpecialization: {
          skillId: 'tam_muoi_chan_hoa',
          specializationId: 'tam_muoi_tu_diem',
        },
      },
    })
    const { gameManager, player } = setup([grantNode])

    gameManager.progressionOps.learnSkill('tam_muoi_chan_hoa', player)
    expect(gameManager.progressionOps.purchaseNode('grant_spec', player)).toBe(true)
    expect(
      gameManager.skillManager.get('tam_muoi_chan_hoa')?.selectedSpecializationId,
    ).toBe('tam_muoi_tu_diem')

    gameManager.progressionOps.respecNodeTree(player)

    expect(
      gameManager.skillManager.get('tam_muoi_chan_hoa')?.selectedSpecializationId,
    ).toBeUndefined()
    expect(player.nodeOneShotGrants['grant_spec']).toBeUndefined()
  })

  it('devResetBranch runs the same clawback', () => {
    const grantNode = node({
      id: 'grant_branch',
      branchTag: 'test_branch',
      effect: { unlocksSkillIds: ['linh_bao'] },
    })
    const { gameManager, player } = setup([grantNode])

    expect(gameManager.progressionOps.purchaseNode('grant_branch', player)).toBe(true)
    expect(gameManager.skillManager.has('linh_bao')).toBe(true)

    gameManager.progressionOps.devResetBranch('test_branch', player)

    expect(gameManager.skillManager.has('linh_bao')).toBe(false)
    expect(player.nodeOneShotGrants['grant_branch']).toBeUndefined()
  })

  it('a node-granted spec survives while another owned node still claims it', () => {
    const claim = {
      skillId: 'tam_muoi_chan_hoa',
      specializationId: 'tam_muoi_tu_diem',
    }
    const first = node({ id: 'spec_a', effect: { selectsSpecialization: claim } })
    const second = node({ id: 'spec_b', effect: { selectsSpecialization: claim } })
    const { gameManager, player } = setup([first, second])

    gameManager.progressionOps.learnSkill('tam_muoi_chan_hoa', player)
    expect(gameManager.progressionOps.purchaseNode('spec_a', player)).toBe(true)
    expect(gameManager.progressionOps.purchaseNode('spec_b', player)).toBe(true)

    // respec/devReset go node khoi ca hai ownership mirrors TRUOC khi
    // clawback (revokeNodeOwnership xoa nodeLevels + purchasedNodeIds).
    player.purchasedNodeIds = player.purchasedNodeIds.filter((id) => id !== 'spec_a')
    delete player.nodeLevels['spec_a']
    gameManager.progressionOps.applyOneShotClawback(player, new Set(['spec_a']))

    expect(
      gameManager.skillManager.get('tam_muoi_chan_hoa')?.selectedSpecializationId,
    ).toBe('tam_muoi_tu_diem')
    expect(player.nodeOneShotGrants['spec_a']).toBeUndefined()
    expect(player.nodeOneShotGrants['spec_b']).toBeDefined()

    player.purchasedNodeIds = player.purchasedNodeIds.filter((id) => id !== 'spec_b')
    delete player.nodeLevels['spec_b']
    gameManager.progressionOps.applyOneShotClawback(player, new Set(['spec_b']))

    expect(
      gameManager.skillManager.get('tam_muoi_chan_hoa')?.selectedSpecializationId,
    ).toBeUndefined()
  })
})

