// EffectiveEnemyCount (Combat Art Pipeline spec sec7 addendum, 2026-09-05) -
// stage Boss LUON chi co DUNG 1 quai (chinh Boss do), khong bao gio khac.
// Mirror dung dieu kien boss-gate cua StageWaveSystem.pickEnemyForSpawn()
// (floor === 10 && stage.bossEnemyId - per spec v3 D9 bossEnemyId only
// exists on floor 10 at all) de wave/spawn/dieu kien
// thang khong bao gio lech nhau ve viec stage nao thuc su spawn Boss. Tach
// rieng ra file nay de ca StageWaveSystem (duong legacy-bridge) lan
// GameManager (duong turn-based) doc CHUNG mot nguon su that duy nhat,
// thay vi lap lai dieu kien floor===10 inline o 2 noi.
import type { Stage } from './Stage'

export function effectiveTotalEnemyCount(stage: Stage): number {
  if (stage.floor === 10 && stage.bossEnemyId) {
    return 1
  }

  return stage.totalEnemyCount
}
