import { describe, expect, it } from 'vitest'
import { canPurchaseNode, hasPrerequisite, purchaseNode } from './NodeSystem'
import { createDefaultPlayer } from '../player/Player'
import type { ProgressionNode } from './ProgressionNode'

function playerWith(overrides: Partial<ReturnType<typeof createDefaultPlayer>> = {}) {
  return { ...createDefaultPlayer(), ...overrides }
}

function minorNode(overrides: Partial<ProgressionNode> = {}): ProgressionNode {
  return {
    id: 'test_minor',
    name: 'Test Minor',
    type: 'minor',
    cost: 1,
    effect: { statModifiers: [{ id: 'test_mod', sourceId: 'test_minor', sourceType: 'talent', stat: 'attack', flat: 5 }] },
    ...overrides,
  }
}

describe('hasPrerequisite (Pháp Tu Redesign, Node Tree)', () => {
  it('kind realm — thoả khi player ở cảnh giới >= yêu cầu', () => {
    const player = playerWith({ realmId: 'nascent_soul' })

    expect(hasPrerequisite(player, { kind: 'realm', realmId: 'golden_core' })).toBe(true)
    expect(hasPrerequisite(player, { kind: 'realm', realmId: 'void_refinement' })).toBe(false)
  })

  it('kind element — thoả khi hành đã nằm trong unlockedElements', () => {
    const player = playerWith({ unlockedElements: ['fire'] })

    expect(hasPrerequisite(player, { kind: 'element', element: 'fire' })).toBe(true)
    expect(hasPrerequisite(player, { kind: 'element', element: 'water' })).toBe(false)
  })

  it('kind node — thoả khi node kia đã nằm trong purchasedNodeIds', () => {
    const player = playerWith({ purchasedNodeIds: ['unlock_fire'] })

    expect(hasPrerequisite(player, { kind: 'node', nodeId: 'unlock_fire' })).toBe(true)
    expect(hasPrerequisite(player, { kind: 'node', nodeId: 'unlock_water' })).toBe(false)
  })

  it('kind nodeCount — "lĩnh ngộ N/M nhánh" (any-N-of-M, không cần ĐÚNG node nào)', () => {
    const masteryNodeIds = ['mastery_fire', 'mastery_water', 'mastery_wood', 'mastery_metal', 'mastery_earth']

    const player = playerWith({ purchasedNodeIds: ['mastery_water', 'mastery_metal'] })

    expect(hasPrerequisite(player, { kind: 'nodeCount', nodeIds: masteryNodeIds, countRequired: 2 })).toBe(true)
    expect(hasPrerequisite(player, { kind: 'nodeCount', nodeIds: masteryNodeIds, countRequired: 3 })).toBe(false)

    // ĐÚNG 2/5 node bất kỳ trong danh sách đều tính, không bắt buộc
    // phải là 2 node CỤ THỂ nào.
    player.purchasedNodeIds = ['mastery_fire', 'mastery_wood']

    expect(hasPrerequisite(player, { kind: 'nodeCount', nodeIds: masteryNodeIds, countRequired: 2 })).toBe(true)
  })
})

describe('canPurchaseNode (Pháp Tu Redesign, Node Tree)', () => {
  it('true khi đủ skillPoints, chưa mua, không có prerequisite', () => {
    const player = playerWith({ skillPoints: 5 })

    expect(canPurchaseNode(player, minorNode({ cost: 3 }))).toBe(true)
  })

  it('false khi KHÔNG đủ skillPoints', () => {
    const player = playerWith({ skillPoints: 2 })

    expect(canPurchaseNode(player, minorNode({ cost: 3 }))).toBe(false)
  })

  it('false khi node đã mua rồi (chặn mua trùng)', () => {
    const player = playerWith({ skillPoints: 5, purchasedNodeIds: ['test_minor'] })

    expect(canPurchaseNode(player, minorNode({ cost: 3 }))).toBe(false)
  })

  it('prerequisites là AND — thiếu 1 cái thì false', () => {
    const player = playerWith({ skillPoints: 10, realmId: 'golden_core', unlockedElements: ['fire'] })

    const node = minorNode({
      cost: 1,
      prerequisites: [
        { kind: 'realm', realmId: 'golden_core' },
        { kind: 'element', element: 'water' }, // chưa unlock
      ],
    })

    expect(canPurchaseNode(player, node)).toBe(false)

    player.unlockedElements.push('water')

    expect(canPurchaseNode(player, node)).toBe(true)
  })
})

describe('purchaseNode (Pháp Tu Redesign, Node Tree)', () => {
  it('trừ skillPoints, đánh dấu đã mua, áp statModifiers', () => {
    const player = playerWith({ skillPoints: 5 })

    const node = minorNode({ cost: 3 })

    expect(purchaseNode(player, node)).toBe(true)
    expect(player.skillPoints).toBe(2)
    expect(player.purchasedNodeIds).toEqual(['test_minor'])
    expect(player.modifiers).toEqual(node.effect.statModifiers)
  })

  it('unlocksElement — thêm vào unlockedElements, không thêm trùng nếu đã có sẵn', () => {
    const player = playerWith({ skillPoints: 5 })

    expect(purchaseNode(player, minorNode({ id: 'unlock_fire', cost: 1, effect: { unlocksElement: 'fire' } }))).toBe(true)
    expect(player.unlockedElements).toEqual(['fire'])

    // Mua node KHÁC cũng unlock 'fire' (trường hợp giả định) — không
    // tạo bản trùng trong unlockedElements.
    expect(purchaseNode(player, minorNode({ id: 'unlock_fire_2', cost: 1, effect: { unlocksElement: 'fire' } }))).toBe(true)
    expect(player.unlockedElements).toEqual(['fire'])
  })

  it('không đủ điều kiện thì trả false, KHÔNG mutate state gì cả', () => {
    const player = playerWith({ skillPoints: 0 })

    const node = minorNode({ cost: 5 })

    expect(purchaseNode(player, node)).toBe(false)
    expect(player.skillPoints).toBe(0)
    expect(player.purchasedNodeIds).toEqual([])
    expect(player.modifiers).toEqual([])
  })
})
