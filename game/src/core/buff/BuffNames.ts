import { BUFF_REGISTRY } from '../../data/buff/BuffRegistry'

// R4 (AR-19) — Canonical throw-safe display-name resolver for buff badges.
// Presentation code needs a soft fallback (the raw id) instead of throwing on unknown ids.

export function buffDisplayName(buffId: string): string {
  try {
    return BUFF_REGISTRY.get(buffId).name
  } catch {
    return buffId
  }
}
