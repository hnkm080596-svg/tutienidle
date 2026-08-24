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

    gameManager.registerSkillTemplates(SKILLS)

    const node: ProgressionNode = {
      id: 'unlock_ngu_kiem_thuat',
      name: 'Test Unlock',
      type: 'major',
      insightCost: 2,
      effect: { unlocksSkillIds: ['ngu_kiem_thuat'] },
    }

    gameManager.registerProgressionNodes([node])

    const player = createDefaultPlayer()

    player.skillInsight = 5

    expect(gameManager.skillManager.has('ngu_kiem_thuat')).toBe(false)

    expect(gameManager.purchaseNode('unlock_ngu_kiem_thuat', player)).toBe(true)

    expect(gameManager.skillManager.has('ngu_kiem_thuat')).toBe(true)
    // learn() KHÔNG tự equip — đúng tinh thần "học" khác "trang bị".
    expect(gameManager.skillManager.get('ngu_kiem_thuat')?.equipped).toBe(false)
    expect(player.skillInsight).toBe(3)
    expect(player.purchasedNodeIds).toEqual(['unlock_ngu_kiem_thuat'])
  })

  it('nodeId không tồn tại trong registry thì trả false, không throw', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    expect(() => gameManager.purchaseNode('unknown_node', player)).not.toThrow()
    expect(gameManager.purchaseNode('unknown_node', player)).toBe(false)
  })

  it('không đủ skillInsight thì purchaseNode() trả false, không learnSkill()', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)

    const node: ProgressionNode = {
      id: 'unlock_expensive',
      name: 'Test Unlock',
      type: 'major',
      insightCost: 100,
      effect: { unlocksSkillIds: ['ngu_kiem_thuat'] },
    }

    gameManager.registerProgressionNodes([node])

    const player = createDefaultPlayer()

    player.skillInsight = 5

    expect(gameManager.purchaseNode('unlock_expensive', player)).toBe(false)
    expect(gameManager.skillManager.has('ngu_kiem_thuat')).toBe(false)
    expect(player.skillInsight).toBe(5)
  })
})
