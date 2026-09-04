import type { BuffDefinition } from '../../core/buff/BuffDefinition'
import type { BuffEffectTemplate } from '../../core/buff/BuffTypes'
import type { TurnBuffDefinition, TurnBuffEffectTemplate } from '../../core/battle/turn/TurnBuffTypes'
import type { TurnBuffRegistry } from '../../core/battle/turn/TurnBuffTypes'
import { buffs as LIVE_BUFFS } from './buffs'

// Completion plan Task 13 — migrate 46 real BuffDefinition entries sang
// TurnBuffDefinition. Converter tự động thay vì 46×hand-copy (E10 — khuôn
// shapes 1:1 giữa BuffTypes/TurnBuffTypes đã xác nhận khi port
// TurnBuffSystem: statModifier/dot/cc/onHitProc field names giống hệt).
//
// No-rebalance policy (Completion plan §Global Constraints): duration GIỮ
// NGUYÊN SỐ (giây → lượt), convertsAfterContinuousSeconds →
// convertsAfterContinuousTurns cùng số. `duration: Infinity` (buff vĩnh
// viễn) giữ nguyên — TurnBuffSystem.update() trừ remainingTurns mỗi lượt
// holder, Infinity không bao giờ <= 0 → sống vĩnh viễn, khớp semantics hệ sống.
//
// Stats per-second (`manaRegenPerSecond`, `wardRegenPerSecond`) giữ nguyên
// key — chúng là statModifier entries áp qua recomputeEffectiveStats()
// (Completion Task 4); đổi key là việc Stat System toàn cục, không thuộc
// converter này.

export function toTurnBuffDefinition(live: BuffDefinition): TurnBuffDefinition {
  const effects: TurnBuffEffectTemplate[] = live.effects.map((effect: BuffEffectTemplate) => effect)

  return {
    id: live.id,
    name: live.name,
    description: live.description,
    polarity: live.polarity,
    hidden: live.hidden,
    duration: live.duration,
    maxStacks: live.maxStacks,
    stackMode: live.stackMode,
    convertsToId: live.convertsToId,
    convertsAfterContinuousTurns: live.convertsAfterContinuousSeconds,
    effects,
  }
}

class MapTurnBuffRegistry implements TurnBuffRegistry {
  private readonly definitions = new Map<string, TurnBuffDefinition>()

  constructor(definitions: TurnBuffDefinition[]) {
    for (const definition of definitions) {
      this.definitions.set(definition.id, definition)
    }
  }

  get(id: string): TurnBuffDefinition {
    const definition = this.definitions.get(id)

    if (!definition) {
      throw new Error(`TurnBuffRegistry: unknown buff id "${id}"`)
    }

    return definition
  }
}

export const TURN_BUFF_REGISTRY: TurnBuffRegistry = new MapTurnBuffRegistry(
  LIVE_BUFFS.map(toTurnBuffDefinition),
)
