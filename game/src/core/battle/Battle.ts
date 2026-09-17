// [M13 STATUS: PARKED] Legacy real-time Battle/BattleEnemy contract.
// Trimmed in Mission G to exactly the surface the parked ArtifactSystem
// reads - no live consumer sees this shape (the turn engine owns
// TurnBattle in battle/turn/). Do not re-extend; if the artifact runtime
// is ever revived it re-declares the fields it needs.
import type { CombatEntity } from '../combat/CombatEntity'

import type { BattleState } from './BattleTypes'

import type { BuffPool } from '../buff/BuffPool'
import type { ArtifactRuntime } from '../artifact/ArtifactRuntime'

/**
 * One living enemy in the battle - buff pool kept separate per enemy.
 */
export interface BattleEnemy {
  entity: CombatEntity

  buffs: BuffPool
}

export interface Battle {
  player: CombatEntity

  enemies: BattleEnemy[]

  state: BattleState

  /**
   * Targetability (plan §5.4) — false khi Player chưa materialize:
   * không thể bị enemy target, không nhận damage và không cast. KHÔNG
   * dùng `alive = false` cho pending spawn vì "chưa xuất hiện" khác
   * "đã chết".
   */
  playerMaterialized: boolean

  // Buffs/debuffs raised WITHIN the battle - separate from persistent
  // out-of-battle buffs (e.g. from pills). Each enemy has its own buff
  // pool in BattleEnemy.buffs.
  playerBuffs: BuffPool

  /**
   * ban_menh_phap_bao (2026-08-27, foundation-artifact-system-plan.md
   * sec.11) - snapshot level/grade/path + timer/rotation/ICD
   * RUNTIME-ONLY (not persisted). undefined = player has no artifact -
   * the artifact tick is a full no-op in that case.
   */
  artifactRuntime?: ArtifactRuntime
}
