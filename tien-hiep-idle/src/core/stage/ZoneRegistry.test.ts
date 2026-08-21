import { describe, expect, it } from 'vitest'
import { ZoneRegistry } from './ZoneRegistry'
import type { Zone } from './Zone'

const ZONE_A: Zone = { id: 'zone_a', name: 'Địa Giới A', stageIds: ['stage_1', 'stage_2'] }
const ZONE_B: Zone = { id: 'zone_b', name: 'Địa Giới B', stageIds: ['stage_3'] }

function setup() {
  const registry = new ZoneRegistry()
  registry.register(ZONE_A)
  registry.register(ZONE_B)
  return registry
}

describe('ZoneRegistry.getZoneForStage — reverse lookup Stage -> Zone', () => {
  it('trả về đúng Zone chứa stageId', () => {
    const registry = setup()

    expect(registry.getZoneForStage('stage_1')?.id).toBe('zone_a')
    expect(registry.getZoneForStage('stage_2')?.id).toBe('zone_a')
    expect(registry.getZoneForStage('stage_3')?.id).toBe('zone_b')
  })

  it('trả về undefined nếu stageId không thuộc Zone nào', () => {
    const registry = setup()

    expect(registry.getZoneForStage('unknown_stage')).toBeUndefined()
  })
})
