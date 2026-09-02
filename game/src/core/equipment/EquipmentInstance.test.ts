import { describe, expect, it } from 'vitest'
import { makeInstance } from './EquipmentInstance.fixture'

describe('EquipmentInstance schema', () => {
  it('uses profession grade and item quality without legacy instance fields', () => {
    const instance = makeInstance({ grade: 'cuu_pham', quality: 'hoang' })

    expect(instance.grade).toBe('cuu_pham')
    expect(instance.quality).toBe('hoang')
    expect('realmId' in instance).toBe(false)
    expect('rarity' in instance).toBe(false)
    expect('forgePoints' in instance).toBe(false)
    expect('forgePotential' in instance).toBe(false)
  })
})
