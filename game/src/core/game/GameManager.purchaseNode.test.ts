import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { SKILLS } from '../../data/skill/Skills'
import type { ProgressionNode } from '../progression/ProgressionNode'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

// Pháp Tu Redesign (magicpath) — GameManager.purchaseNode() là phần
// KHÔNG pure của Node Tree: gọi purchaseNode() thuần trước (đã test
// riêng ở NodeSystem.test.ts), rồi tự làm nốt unlocksSkillIds (cần
// skillTemplates — chỉ GameManager có).
describe('GameManager.purchaseNode (Pháp Tu Redesign, Node Tree)', () => {
  // M-QI-05 - a levelled fixture skill (maxLevel > 1) only learns when
  // its canonical core is registered; mirrors SKILL_CORE_NODES shape.
  const specSkillCore: ProgressionNode = {
    id: 'core_test_spec_skill',
    name: 'Core: Test Spec Skill',
    type: 'minor',
    insightCost: 0,
    maxLevel: 10,
    levelsSkillId: 'test_spec_skill',
    effect: {},
  }

  it('node có unlocksSkillIds thì learnSkill() từng skill thật, dùng data skill có sẵn', () => {
    const gameManager = new GameManager()

    gameManager.catalogOps.registerSkillTemplates(SKILLS)

    const node: ProgressionNode = {
      id: 'unlock_tru_tien',
      name: 'Test Unlock',
      type: 'major',
      insightCost: 2,
      effect: { unlocksSkillIds: ['tram'] },
    }

    gameManager.catalogOps.registerProgressionNodes([node])
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

    const player = createDefaultPlayer()

    player.skillInsight = 5

    expect(gameManager.skillManager.has('tram')).toBe(false)

    expect(gameManager.progressionOps.purchaseNode('unlock_tru_tien', player)).toBe(true)

    expect(gameManager.skillManager.has('tram')).toBe(true)
    expect(player.skillInsight).toBe(3)
    // M-QI-05 - learnSkill('tram') granted core_tram (level-1 grant,
    // free): grants are ownership entries alongside the purchased node.
    expect(player.purchasedNodeIds).toEqual(['unlock_tru_tien', 'core_tram'])
  })

  it('nodeId không tồn tại trong registry thì trả false, không throw', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    expect(() => gameManager.progressionOps.purchaseNode('unknown_node', player)).not.toThrow()
    expect(gameManager.progressionOps.purchaseNode('unknown_node', player)).toBe(false)
  })

  it('không đủ skillInsight thì purchaseNode() trả false, không learnSkill()', () => {
    const gameManager = new GameManager()

    gameManager.catalogOps.registerSkillTemplates(SKILLS)

    const node: ProgressionNode = {
      id: 'unlock_expensive',
      name: 'Test Unlock',
      type: 'major',
      insightCost: 100,
      effect: { unlocksSkillIds: ['tram'] },
    }

    gameManager.catalogOps.registerProgressionNodes([node])
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

    const player = createDefaultPlayer()

    player.skillInsight = 5

    expect(gameManager.progressionOps.purchaseNode('unlock_expensive', player)).toBe(false)
    expect(gameManager.skillManager.has('tram')).toBe(false)
    expect(player.skillInsight).toBe(5)
  })

  // E-8 (2026-09-03) — node biến thể: effect.selectsSpecialization wire
  // thẳng SkillSystem.selectSpecialization sau khi mua thành công.
  // Fixture: skill template TỰ KHAI specializations (data Task 8 sẽ
  // khai trên skill thật) + node unlock skill TRƯỚC rồi chọn spec —
  // đúng thứ tự purchaseNode chạy (vòng unlocksSkillIds → selectsSpec).
  function specSkillTemplate() {
    return {
      id: 'test_spec_skill',
      name: 'Test Spec Skill',
      description: '',
      type: 'active' as const,
      level: 1,
      maxLevel: 10,
      cooldown: 1,
      cost: 0,
      target: 'enemy' as const,
      effects: [],
      execution: { kind: 'cooldown' as const },
      resourceType: 'none' as const,
      unlocked: false,
      equipped: false,
      specializations: [
        { id: 'hoa_long', name: 'Hỏa Long' },
        { id: 'hoa_phung', name: 'Hỏa Phụng' },
      ],
    }
  }

  it('node có selectsSpecialization → mua xong skill.selectedSpecializationId đổi', () => {
    const gameManager = new GameManager()

    gameManager.catalogOps.registerSkillTemplates([specSkillTemplate()])

    const node: ProgressionNode = {
      id: 'test_spec_node',
      name: 'Test Spec',
      type: 'major',
      insightCost: 1,
      effect: {
        unlocksSkillIds: ['test_spec_skill'],
        selectsSpecialization: { skillId: 'test_spec_skill', specializationId: 'hoa_long' },
      },
    }

    gameManager.catalogOps.registerProgressionNodes([node, specSkillCore])
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

    const player = createDefaultPlayer()

    player.skillInsight = 5

    expect(gameManager.progressionOps.purchaseNode('test_spec_node', player)).toBe(true)
    expect(gameManager.skillManager.get('test_spec_skill')?.selectedSpecializationId).toBe('hoa_long')
  })

  it('node selectsSpecialization specialization không tồn tại → vẫn mua được, không đổi', () => {
    const gameManager = new GameManager()

    gameManager.catalogOps.registerSkillTemplates([specSkillTemplate()])

    const node: ProgressionNode = {
      id: 'test_spec_node_bad',
      name: 'Test Spec Bad',
      type: 'major',
      insightCost: 1,
      effect: {
        unlocksSkillIds: ['test_spec_skill'],
        selectsSpecialization: { skillId: 'test_spec_skill', specializationId: 'khong_ton_tai' },
      },
    }

    gameManager.catalogOps.registerProgressionNodes([node, specSkillCore])
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

    const player = createDefaultPlayer()

    player.skillInsight = 5

    expect(gameManager.progressionOps.purchaseNode('test_spec_node_bad', player)).toBe(true)
    expect(gameManager.skillManager.get('test_spec_skill')?.selectedSpecializationId).toBeUndefined()
  })

  // Three-path design (2026-09-25) -- capstone/variant nodes own the
  // claim on the specialization they select: the free-switch chip path
  // must hold the claiming node or the Insight cost / realm prereq /
  // excludesNode mutex are all bypassed. Unclaimed specs stay free.
  describe('selectSkillSpecialization node-claim gate', () => {
    const claimNode = (nodeId: string, specializationId: string): ProgressionNode => ({
      id: nodeId,
      name: `Claim ${specializationId}`,
      type: 'major',
      insightCost: 3,
      effect: {
        unlocksSkillIds: ['test_spec_skill'],
        selectsSpecialization: { skillId: 'test_spec_skill', specializationId },
      },
    })

    it('spec có claiming node nhưng chưa mua node → free-switch bị từ chối', () => {
      const gameManager = new GameManager()

      gameManager.catalogOps.registerSkillTemplates([specSkillTemplate()])
      gameManager.catalogOps.registerProgressionNodes([
        claimNode('claim_hoa_long', 'hoa_long'),
        specSkillCore,
      ])
      gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

      const player = createDefaultPlayer()

      player.skillInsight = 5
      gameManager.progressionOps.learnSkill('test_spec_skill', player)

      expect(
        gameManager.progressionOps.selectSkillSpecialization('test_spec_skill', 'hoa_long', player),
      ).toBe(false)
      expect(gameManager.skillManager.get('test_spec_skill')?.selectedSpecializationId).toBeUndefined()
    })

    it('sở hữu claiming node → chọn spec khác vẫn bị từ chối nếu node của spec đó chưa mua', () => {
      const gameManager = new GameManager()

      gameManager.catalogOps.registerSkillTemplates([specSkillTemplate()])
      gameManager.catalogOps.registerProgressionNodes([
        claimNode('claim_hoa_long', 'hoa_long'),
        claimNode('claim_hoa_phung', 'hoa_phung'),
        specSkillCore,
      ])
      gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

      const player = createDefaultPlayer()

      player.skillInsight = 10

      // Mua claim hoa_long: purchase tự set spec hoa_long (purchase path
      // IS the authorization).
      expect(gameManager.progressionOps.purchaseNode('claim_hoa_long', player)).toBe(true)
      expect(gameManager.skillManager.get('test_spec_skill')?.selectedSpecializationId).toBe('hoa_long')

      // Chip switch sang hoa_phung khi chưa mua node của nó → reject.
      expect(
        gameManager.progressionOps.selectSkillSpecialization('test_spec_skill', 'hoa_phung', player),
      ).toBe(false)
      expect(gameManager.skillManager.get('test_spec_skill')?.selectedSpecializationId).toBe('hoa_long')
    })

    it('spec không node nào claim → free-switch vẫn hoạt động', () => {
      const gameManager = new GameManager()

      gameManager.catalogOps.registerSkillTemplates([specSkillTemplate()])
      gameManager.catalogOps.registerProgressionNodes([specSkillCore])
      gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

      const player = createDefaultPlayer()

      gameManager.progressionOps.learnSkill('test_spec_skill', player)

      expect(
        gameManager.progressionOps.selectSkillSpecialization('test_spec_skill', 'hoa_phung', player),
      ).toBe(true)
      expect(gameManager.skillManager.get('test_spec_skill')?.selectedSpecializationId).toBe('hoa_phung')
    })
  })
})
