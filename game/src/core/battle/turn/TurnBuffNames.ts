import { TURN_BUFF_REGISTRY } from '../../../data/buff/TurnBuffRegistry'

// Phase A6 (2026-09-08) — throw-safe display-name resolver for buff
// badges on TurnOrderStrip. TURN_BUFF_REGISTRY.get() THROWS on unknown
// ids; presentation code needs a soft fallback (the raw id) instead.

export function buffDisplayName(buffId: string): string {
  try {
    return TURN_BUFF_REGISTRY.get(buffId).name
  } catch {
    return buffId
  }
}
