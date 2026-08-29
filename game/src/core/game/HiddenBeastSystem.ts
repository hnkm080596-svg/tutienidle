import type { PlayerData } from '../player/Player'
import type { Enemy } from '../enemy/Enemy'
import { rollChance } from '../reward/DropRoll'

// Quái ẩn (spec dot-pha-loi-kiep §4.1c) — đếm kill quái Luyện Khí từ
// lần giết quái ẩn gần nhất; đủ 1000 mở cửa sổ: quái ẩn có tỉ lệ trà
// trộn mỗi lượt spawn; giết quái ẩn reset đếm về 0 (kể cả khi không
// drop). Không spoil: quái ẩn không hiện danh sách stage/map nào.
export const HIDDEN_BEAST_KILL_THRESHOLD = 1000
export const HIDDEN_BEAST_SPAWN_CHANCE_PER_SPAWN = 0.05
export const HIDDEN_BEAST_ENEMY_ID = 'huyet_mong'
const HIDDEN_BEAST_REALM_ID = 'qi_refining'

export class HiddenBeastSystem {
  constructor(private readonly deps: { getEnemyTemplate: (id: string) => Enemy | undefined }) {}

  isWindowOpen(player: PlayerData): boolean {
    return player.luyenKhiKillsSinceBeast >= HIDDEN_BEAST_KILL_THRESHOLD
  }

  /** Mỗi lượt spawn stage Luyện Khí: nếu window mở, roll 5% trả Huyết Mông thay quái pool. */
  maybeReplaceSpawn(player: PlayerData, stageRealmId: string): Enemy | undefined {
    if (stageRealmId !== HIDDEN_BEAST_REALM_ID || !this.isWindowOpen(player)) {
      return undefined
    }

    if (!rollChance(HIDDEN_BEAST_SPAWN_CHANCE_PER_SPAWN)) {
      return undefined
    }

    return this.deps.getEnemyTemplate(HIDDEN_BEAST_ENEMY_ID)
  }

  /** Gọi từ BattleLootSystem khi 1 quái chết (chỉ đếm quái Luyện Khí). */
  onEnemyDefeated(player: PlayerData, enemyId: string, enemyRealmId: string): void {
    if (enemyRealmId !== HIDDEN_BEAST_REALM_ID) {
      return
    }

    if (enemyId === HIDDEN_BEAST_ENEMY_ID) {
      player.luyenKhiKillsSinceBeast = 0
      return
    }

    player.luyenKhiKillsSinceBeast += 1
  }
}
