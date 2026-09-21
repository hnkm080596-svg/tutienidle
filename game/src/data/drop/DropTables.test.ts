import { describe, expect, it } from 'vitest'
import { ENEMIES } from '../enemy/Enemies'
import { assertDropEntryIsAddressable } from '../../core/drop/DropTable'
import { FAMILY_DROP_TABLES, familyDropTableFor } from './FamilyDropTables'
import { STAGE_DROP_TABLES, stageDropTableFor } from './StageDropTables'

describe('drop tables - coverage', () => {
  it('has a stage table for every realm that has enemies', () => {
    const realms = new Set(ENEMIES.map((enemy) => enemy.realmId))

    for (const realmId of realms) {
      expect(stageDropTableFor(realmId, 1), `no stage table for realm ${realmId}`).toBeDefined()
    }
  })

  it('has a family table for every family that has enemies', () => {
    const families = new Set(ENEMIES.map((enemy) => enemy.family).filter(Boolean) as string[])

    for (const familyId of families) {
      expect(familyDropTableFor(familyId), `no family table for ${familyId}`).toBeDefined()
    }
  })

  it('returns nothing for an unknown realm or family', () => {
    expect(stageDropTableFor('no_such_realm', 1)).toBeUndefined()
    expect(familyDropTableFor('no_such_family')).toBeUndefined()
    expect(familyDropTableFor(undefined)).toBeUndefined()
  })
})

describe('drop tables - shape', () => {
  it('every entry names an item unless it is equipment_any', () => {
    for (const table of [...STAGE_DROP_TABLES, ...FAMILY_DROP_TABLES]) {
      for (const entry of [...table.guaranteed, ...table.pool]) {
        expect(() => assertDropEntryIsAddressable(entry)).not.toThrow()
      }
    }
  })

  it('every pool entry carries positive weight', () => {
    for (const table of [...STAGE_DROP_TABLES, ...FAMILY_DROP_TABLES]) {
      for (const entry of table.pool) {
        expect(entry.weight, `${entry.itemId ?? entry.kind} has no weight`).toBeGreaterThan(0)
      }
    }
  })

  it('every stage table can pay currency', () => {
    for (const table of STAGE_DROP_TABLES) {
      expect(table.currency.spiritStone.min).toBeGreaterThan(0)
      expect(table.currency.techniqueMastery.min).toBeGreaterThan(0)
      expect(table.currency.spiritStone.max).toBeGreaterThanOrEqual(table.currency.spiritStone.min)
      expect(table.currency.techniqueMastery.max).toBeGreaterThanOrEqual(
        table.currency.techniqueMastery.min,
      )
    }
  })
})
