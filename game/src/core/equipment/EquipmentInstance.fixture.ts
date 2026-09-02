import { ITEM_QUALITY_FORGE_USES } from './ItemQualityBalance'
import type { EquipmentInstance } from './EquipmentInstance'

/** Side-effect-free shared factory for equipment tests. */
export function makeInstance(
  overrides: Partial<EquipmentInstance> = {},
): EquipmentInstance {
  const quality = overrides.quality ?? 'hoang'

  return {
    instanceId: 'equipment-instance-1',
    itemId: 'test-sword',
    slot: 'weapon',
    equipped: false,
    grade: 'cuu_pham',
    quality,
    forgeUsesTotal: ITEM_QUALITY_FORGE_USES[quality],
    forgeUsesRemaining: ITEM_QUALITY_FORGE_USES[quality],
    mainStat: {
      id: 'test-sword-main-stat',
      sourceId: 'test-sword',
      sourceType: 'equipment',
      stat: 'attack',
      flat: 1,
    },
    affixes: [],
    ...overrides,
  }
}
