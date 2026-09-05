// EffectiveEnemyCount (Combat Art Pipeline spec §7 addendum, 2026-09-05) —
// stage Boss LUÔN chỉ có ĐÚNG 1 quái (chính Boss đó), không bao giờ khác.
// Mirror đúng điều kiện boss-gate của StageWaveSystem.pickEnemyForSpawn()
// (floor === 10 && stage.bossEnemyId — bossEnemyId chỉ là reserved/metadata
// ở các floor 1-9, theo đúng comment của Stage.ts) để wave/spawn/điều kiện
// thắng không bao giờ lệch nhau về việc stage nào thực sự spawn Boss. Tách
// riêng ra file này để cả StageWaveSystem (đường legacy-bridge) lẫn
// GameManager (đường turn-based) đọc CHUNG một nguồn sự thật duy nhất,
// thay vì lặp lại điều kiện floor===10 inline ở 2 nơi.
import type { Stage } from './Stage'

export function effectiveTotalEnemyCount(stage: Stage): number {
  if (stage.floor === 10 && stage.bossEnemyId) {
    return 1
  }

  return stage.totalEnemyCount
}
