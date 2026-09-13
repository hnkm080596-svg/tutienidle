// EffectiveWaves (Turn-Based Wave Redesign, 2026-09-06) — mirror đúng
// EffectiveEnemyCount.ts's floor-10 solo-boss override, áp cho waves[]
// thay vì totalEnemyCount. Boss CHỈ xuất hiện ở floor 10 (xem
// StageWaveSystem.pickEnemyForSpawn()'s "DESIGN: boss chỉ xuất hiện ở
// tầng 10" comment) — floor 10 LUÔN là 1 wave duy nhất, 1 quái.
import type { Stage } from './Stage'

export function effectiveWaves(stage: Stage): number[] {
  if (stage.floor === 10 && stage.bossEnemyId) {
    return [1]
  }

  return stage.waves
}
