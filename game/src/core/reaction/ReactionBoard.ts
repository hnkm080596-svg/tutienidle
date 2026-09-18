// ReactionBoard.ts -- contract sec.26/27. The board is a per
// (sourceId, targetId) SNAPSHOT read through BuffReadPort: only the
// source's own instances on that target count (spec sec.7 -- a second
// caster's seals on the same target never enter the board). Non-elemental
// buffs never appear; elements only appear with stacks > 0.

import type { ElementType } from '../element/ElementType'
import type {
  BuffInstanceId,
  CombatEntityId,
} from '../battle/contracts/ids'
import type { BuffReadPort } from '../buff2/BuffQuery'
import type { ElementalStateRegistry } from './ElementalStateRegistry'
import type { ReactionBoard } from './ReactionTypes'

export interface ElementalBoardQuery {
  read(sourceId: CombatEntityId, targetId: CombatEntityId): ReactionBoard
}

const ELEMENTS = [
  'wood',
  'fire',
  'earth',
  'metal',
  'water',
] as const satisfies readonly ElementType[]

export class BuffSystemBoardQuery implements ElementalBoardQuery {
  constructor(
    private readonly buffs: BuffReadPort,
    private readonly elements: ElementalStateRegistry,
  ) {}

  read(sourceId: CombatEntityId, targetId: CombatEntityId): ReactionBoard {
    const counts: Record<ElementType, number> = {
      wood: 0,
      fire: 0,
      earth: 0,
      metal: 0,
      water: 0,
    }
    const instances: Partial<Record<ElementType, BuffInstanceId>> = {}

    for (const instance of this.buffs.getForTarget(targetId)) {
      if (instance.sourceId !== sourceId) continue // spec sec.7 -- same-source only
      const element = this.elements.getElement(instance.definitionId)
      if (element === null || instance.stacks <= 0) continue
      counts[element] += instance.stacks
      // per_source scope: at most one live instance per (def,source,target)
      // -- first-wins is unreachable in practice, deterministic regardless.
      instances[element] ??= instance.instanceId
    }

    return {
      sourceId,
      targetId,
      fireStacks: counts.fire,
      waterStacks: counts.water,
      woodStacks: counts.wood,
      metalStacks: counts.metal,
      earthStacks: counts.earth,
      instances,
    }
  }
}
