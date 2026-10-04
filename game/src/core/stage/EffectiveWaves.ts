// EffectiveWaves (Turn-Based Wave Redesign, 2026-09-06) - mirror dung
// EffectiveEnemyCount.ts's floor-10 solo-boss override, ap cho waves[]
// thay vi totalEnemyCount. Boss CHI xuat hien o floor 10 (xem
// StageWaveSystem.pickEnemyForSpawn()'s "DESIGN: boss chi xuat hien o
// tang 10" comment) - floor 10 LUON la 1 wave duy nhat, 1 quai.
import type { Stage } from './Stage'

export function effectiveWaves(stage: Stage): number[] {
  if (stage.floor === 10 && stage.bossEnemyId) {
    return [1]
  }

  return stage.waves
}
