import { describe, expect, it } from 'vitest'
import type { Skill } from './Skill'
import { SkillManager } from './SkillManager'
import { SkillSystem } from './SkillSystem'

function fireball(): Skill {
  return {
    id: 'fireball', name: 'Hỏa Cầu', description: '', type: 'active',
    level: 1, maxLevel: 10,
    cooldown: 5, cost: 8, resourceType: 'mana',
    target: 'enemy', effects: [], unlocked: true, equipped: false,
  }
}

describe('duplicate skill loadout slots', () => {
  it('allows one learned skill to occupy multiple loadout slots', () => {
    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    manager.add(fireball())
    system.equipToSlot('fireball', 0)
    system.equipToSlot('fireball', 1)

    expect(manager.getLoadoutEntries().map(entry => entry.slotIndex)).toEqual([0, 1])
    expect(manager.get('fireball')?.loadoutSlots).toEqual([0, 1])
  })
})
