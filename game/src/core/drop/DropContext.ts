import { BOSS_MODIFIER, TINH_ANH_MODIFIER, type DropModifier } from './DropModifier'
import type { DropChannel } from './resolveDrops'

export interface DropContextInput {
  channel: DropChannel

  /** Stage property (Perfect Clear spec D4) - survives on idle. */
  isBoss: boolean

  /** Tag - stripped on idle. */
  isElite: boolean

  /**
   * Future EnemyTag ids. EnemyTag.ts does not exist yet; when it lands, map
   * its ids here and nothing else in the drop system changes.
   */
  tagIds?: readonly string[]
}

const TAG_MODIFIERS: Record<string, DropModifier> = {
  tinh_anh: TINH_ANH_MODIFIER,
}

/**
 * The ONE place that knows which modifiers are tags and which are stage
 * properties (spec E10 / section 3.2).
 *
 * Idle strips tags and keeps stage properties, so idle floor 10 still fights
 * a boss and still earns boss rolls, but can never reach the stacked ceiling
 * and can never earn the quality bonus. Keeping that rule here rather than at
 * the call sites means no future caller can forget to pass a flag.
 */
export function modifiersFor(input: DropContextInput): DropModifier[] {
  const modifiers: DropModifier[] = []

  if (input.isBoss) {
    modifiers.push(BOSS_MODIFIER)
  }

  if (input.channel === 'idle') {
    return modifiers
  }

  if (input.isElite) {
    modifiers.push(TINH_ANH_MODIFIER)
  }

  for (const tagId of input.tagIds ?? []) {
    const modifier = TAG_MODIFIERS[tagId]

    // Unmapped tag ids are silently ignored for forward compatibility: if tag
    // data ships before its modifier mapping lands, crashing would make that a
    // deploy-order hazard. This system must not be what breaks when EnemyTag ships.
    if (modifier && !modifiers.some((existing) => existing.id === modifier.id)) {
      modifiers.push(modifier)
    }
  }

  return modifiers
}
