import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { SKILLS } from '../../data/skill/Skills'
import type { ProgressionNode } from '../progression/ProgressionNode'

// Pháp Tu Redesign (magicpath) — GameManager.purchaseNode() là phần
// KHÔNG pure của Node Tree: gọi purchaseNode() thuần trước (đã test
// riêng ở NodeSystem.test.ts), rồi tự làm nốt unlocksSkillIds (cần
// skillTemplates — chỉ GameManager có).
describe('GameManager.purchaseNode (Pháp Tu Redesign, Node Tree)', () => {
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

    const player = createDefaultPlayer()

    player.skillInsight = 5

    expect(gameManager.skillManager.has('tram')).toBe(false)

    expect(gameManager.progressionOps.purchaseNode('unlock_tru_tien', player)).toBe(true)

    expect(gameManager.skillManager.has('tram')).toBe(true)
    // learn() KHÔNG tự equip — đúng tinh thần "học" khác "trang bị".
    expect(gameManager.skillManager.get('tram')?.equipped).toBe(false)
    expect(player.skillInsight).toBe(3)
    expect(player.purchasedNodeIds).toEqual(['unlock_tru_tien'])
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

    gameManager.catalogOps.registerProgressionNodes([node])

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

    gameManager.catalogOps.registerProgressionNodes([node])

    const player = createDefaultPlayer()

    player.skillInsight = 5

    expect(gameManager.progressionOps.purchaseNode('test_spec_node_bad', player)).toBe(true)
    expect(gameManager.skillManager.get('test_spec_skill')?.selectedSpecializationId).toBeUndefined()
  })
})
