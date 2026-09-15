import type { BuffDefinition, BuffEffectTemplate, BuffDefinitionCatalog } from '../../core/buff/BuffTypes'
import { buffs as LIVE_BUFFS } from './buffs'

// Completion plan Task 13 — migrate 46 real BuffDefinition entries sang
// turn-clock shape. Converter tự động thay vì 46×hand-copy (E10 —
// statModifier/dot/cc/onHitProc field names giống hệt giữa hai khung).
//
// No-rebalance policy (Completion plan §Global Constraints): duration GIỮ
// NGUYÊN SỐ (giây → lượt), convertsAfterContinuousSeconds →
// convertsAfterContinuousTurns cùng số. `duration: Infinity` (buff vĩnh
// viễn) giữ nguyên — BuffSystem.update() trừ remainingTurns mỗi lượt
// holder, Infinity không bao giờ <= 0 → sống vĩnh viễn, khớp semantics hệ sống.
//
// Regen stats (`manaRegenPerTurn`, `wardRegenPerTurn`) pass through as
// statModifier entries applied via recomputeEffectiveStats()
// (Completion Task 4).

export function toBuffDefinition(live: BuffDefinition): BuffDefinition {
  const effects: BuffEffectTemplate[] = live.effects.map((effect: BuffEffectTemplate) => effect)

  return {
    id: live.id,
    name: live.name,
    description: live.description,
    polarity: live.polarity,
    hidden: live.hidden,
    // Phap Tu Reimagined Task 12 — the definition-level element tag must
    // reach the registry; the sinh/khac rule engine resolves pair
    // relations through it.
    element: live.element,
    duration: live.duration,
    maxStacks: live.maxStacks,
    stackMode: live.stackMode,
    convertsToId: live.convertsToId,
    convertsAfterContinuousTurns: live.convertsAfterContinuousSeconds,
    effects,
  }
}

class MapBuffRegistry implements BuffDefinitionCatalog {
  private readonly definitions = new Map<string, BuffDefinition>()

  constructor(definitions: BuffDefinition[]) {
    for (const definition of definitions) {
      this.definitions.set(definition.id, definition)
    }
  }

  get(id: string): BuffDefinition {
    const definition = this.definitions.get(id)

    if (!definition) {
      throw new Error(`BuffRegistry: unknown buff id "${id}"`)
    }

    return definition
  }
}

export const BUFF_REGISTRY: BuffDefinitionCatalog = new MapBuffRegistry(
  LIVE_BUFFS.map(toBuffDefinition),
)
