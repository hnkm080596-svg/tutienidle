// [M13 STATUS: PARKED] Legacy real-time Battle/BattleEnemy contract.
// Trimmed in Mission G to exactly the surface the parked ArtifactSystem
// reads — no live consumer sees this shape (the turn engine owns
// TurnBattle in battle/turn/). Do not re-extend; if the artifact runtime
// is ever revived it re-declares the fields it needs.
import type { CombatEntity } from '../combat/CombatEntity'

import type { BattleState } from './BattleTypes'

import type { BuffPool } from '../buff/BuffPool'
import type { ArtifactRuntime } from '../artifact/ArtifactRuntime'

/**
 * 1 quái đang sống trong trận — buff pool tách riêng theo từng con.
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

  // Buff/debuff phát sinh TRONG trận — tách khỏi buff persistent ngoài
  // trận (ví dụ từ pill). Mỗi quái có buff pool riêng trong
  // BattleEnemy.buffs.
  playerBuffs: BuffPool

  /**
   * Bản Mệnh Pháp Bảo (2026-08-27, foundation-artifact-system-plan.md
   * §11) — snapshot level/grade/path + timer/rotation/ICD RUNTIME-ONLY
   * (không persist). undefined = player không có artifact — tick
   * artifact no-op hoàn toàn trong trường hợp đó.
   */
  artifactRuntime?: ArtifactRuntime
}
