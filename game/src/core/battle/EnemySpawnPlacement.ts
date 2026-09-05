// EnemySpawnPlacement — resolver thuần chọn ô spawn cho quái, giới hạn
// trong ENEMY_SIDE_REGION (Combat Art Pipeline spec §6/§7, 2026-09-05).
// Boss LUÔN ở trung tâm vùng địch (không còn cùng hàng với player).
// NHIỀU quái được phép spawn trùng hoàn toàn một ô — resolver KHÔNG nhận
// occupied/reserved cells và KHÔNG BAO GIỜ trả null.
import type { GridPosition } from './BattleGrid'
import { ENEMY_SIDE_REGION, centerOfRegion, type BattlefieldUsableRegion } from './BattlefieldRegions'

export interface EnemySpawnPlacementInput {
  isBoss: boolean

  /** RNG tiêm từ ngoài (Math.random hoặc seeded) — deterministic test được. */
  random: () => number
}

/** Số nguyên trong [min, max] bằng ĐÚNG MỘT lần gọi random(). */
function randomIntInclusive(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1))
}

export function resolveEnemySpawnPosition(
  input: EnemySpawnPlacementInput,
  region: BattlefieldUsableRegion = ENEMY_SIDE_REGION,
): GridPosition {
  if (input.isBoss) {
    return centerOfRegion(region)
  }

  const row = randomIntInclusive(input.random, region.rowMin, region.rowMax)
  const column = randomIntInclusive(input.random, region.columnMin, region.columnMax)

  return { row: row as GridPosition['row'], column }
}
