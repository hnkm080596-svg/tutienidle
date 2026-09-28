// Phap Tu Reimagined (spec D9, F11) -- Linh Luc Ho The damage
// reduction: the live MP-ratio-scaled DR. One implementation shared
// by the damage authority (CombatSystem) and the presentation bridge
// (hoTheBridge) so a rule change cannot split display from combat.

import type { CombatEntity } from './CombatEntity'
import { clampStatValue } from '../stats/StatMetadata'

export interface HoTheDamageReduction {
  /** The authored cap (clamped linhLucHoTheCap stat). */
  cap: number
  /** DR fraction in [0, cap]: cap * min(1, currentMp / maxMp). */
  dr: number
}

export function resolveHoTheDamageReduction(
  entity: Pick<CombatEntity, 'stats' | 'currentMp'>,
): HoTheDamageReduction {
  const cap = clampStatValue('linhLucHoTheCap', entity.stats.linhLucHoTheCap)
  const maxMp = entity.stats.maxMp
  // mp can transiently exceed maxMp (buffs) -- clamp the ratio so dr
  // never breaches the linhLucHoTheCap stat cap.
  const mpRatio = maxMp > 0 ? Math.min(1, Math.max(0, entity.currentMp / maxMp)) : 0
  return { cap, dr: cap * mpRatio }
}
