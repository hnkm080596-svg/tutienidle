import { describe, expect, it } from 'vitest'
import { createDefaultPlayer, playerToCombatEntity } from '../player/Player'
import { createBaseStats } from '../stats/StatBlock'
import type { Skill } from './Skill'
import { SkillManager } from './SkillManager'
import { SkillSystem } from './SkillSystem'

function fireball(): Skill {
  return {
    id: 'fireball', name: 'Hỏa Cầu', description: '', type: 'active',
    level: 1, maxLevel: 10,  
    cooldown: 5, remainingCooldown: 0, cost: 8, resourceType: 'mana',
    target: 'enemy', effects: [], unlocked: true, equipped: false,
  }
}

describe('duplicate skill loadout slots', () => {
  it('allows duplicate spells and tracks cooldown independently per slot', () => {
    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    manager.add(fireball())
    system.equipToSlot('fireball', 0)
    system.equipToSlot('fireball', 1)

    const entity = playerToCombatEntity(createDefaultPlayer(), createBaseStats())
    entity.currentMp = 100

    expect(manager.getLoadoutEntries().map(entry => entry.slotIndex)).toEqual([0, 1])
    expect(system.useInSlot('fireball', 0, entity)).not.toBeNull()
    expect(manager.get('fireball')?.remainingCooldownBySlot).toEqual({ 0: 5 })
    expect(system.canUseInSlot('fireball', 1, entity)).toBe(true)
    expect(entity.currentMp).toBe(92)
  })
})
