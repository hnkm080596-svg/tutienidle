// EnemySpawnPlacement (plan §5.1) — resolver thuần chọn ô spawn cho quái
// theo contract overlap-hợp-lệ:
// - Quái thường: row random 0..9, column random 7..15 (RNG ĐỘC LẬP cho
//   row và column).
// - Boss: luôn row 4, chỉ roll column.
// - NHIỀU quái được phép spawn trùng hoàn toàn một ô — resolver KHÔNG
//   nhận occupied/reserved cells và KHÔNG BAO GIỜ trả null (luôn có miền
//   spawn), nên caller không phải retry vì "hết chỗ".
import { GRID_COLUMN_COUNT, GRID_ROW_COUNT, type GridPosition } from './BattleGrid'
import { HERO_LANE_INDEX } from './BattleLane'

export interface EnemySpawnPlacementInput {
  isBoss: boolean

  /** RNG tiêm từ ngoài (Math.random hoặc seeded) — deterministic test được. */
  random: () => number
}

/** Số nguyên trong [min, max] bằng ĐÚNG MỘT lần gọi random(). */
function randomIntInclusive(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1))
}

const ENEMY_SPAWN_MIN_COLUMN = 7
const ENEMY_SPAWN_MAX_COLUMN = GRID_COLUMN_COUNT - 1

export function resolveEnemySpawnPosition(input: EnemySpawnPlacementInput): GridPosition {
  const row = input.isBoss
    ? HERO_LANE_INDEX
    : randomIntInclusive(input.random, 0, GRID_ROW_COUNT - 1)

  const column = randomIntInclusive(input.random, ENEMY_SPAWN_MIN_COLUMN, ENEMY_SPAWN_MAX_COLUMN)

  return { row: row as GridPosition['row'], column }
}
