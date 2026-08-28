import type { EventBus } from '../events/EventBus'
import type { BattleSystem } from '../battle/BattleSystem'
import type { CombatSystem } from '../combat/CombatSystem'
import type { CombatEntity } from '../combat/CombatEntity'
import type { FoundationType } from '../breakthrough/FoundationType'
import { getTribulationProfile } from '../breakthrough/TribulationProfile'
import type { PlayerData } from '../player/Player'
import type { Stats } from '../stats/StatBlock'

// Trạng thái Tribulation ĐANG diễn ra — targetRealmId là cảnh giới sẽ
// bước vào NẾU thắng, foundationType chỉ có mặt khi targetRealmId ===
// 'foundation_establishment' (hệ Căn Cơ 4-tier riêng, xem FoundationResolver.ts).
export interface ActiveTribulation {
  targetRealmId: string

  foundationType?: FoundationType

  durationSeconds: number
  secondsRemaining: number
  strikeIntervalSeconds: number
  nextStrikeInSeconds: number
  lightningMaxHpDamagePercent: number
}

export const TRIBULATION_COOLDOWN_SECONDS = 5 * 60

/**
 * Runtime của trận Độ Kiếp (2026-08-24, tách khỏi GameManager) — sở hữu:
 * - Trạng thái ephemeral activeTribulation + cooldown sau thất bại
 *   (KHÔNG persist vào save).
 * - Vòng lặp lôi kích có catch-up riêng dạng đóng (while
 *   nextStrikeInSeconds <= 0) — CHỦ Ý đứng NGOÀI vòng fixed-step 0.1s
 *   của updateBattleFixedStep(): chia nhỏ thành hàng trăm bước sẽ CỘNG
 *   DỒN sai số dấu phẩy động (0.1 không biểu diễn chẵn nhị phân) vào
 *   nextStrikeInSeconds, có thể làm lệch 1 lôi kích so với thật.
 * - Phát hiện thắng/thua trận Kiếp ('defeat' do BattleSystem
 *   .checkBattleEnd() tự set khi player chết; phần thưởng/phạt thắng/
 *   thua xử lý ở useTribulation.ts — hàm này CHỈ phát hiện thắng).
 *
 * GameManager giữ nguyên public API (startTribulation/getActiveTribulation/...)
 * và delegate xuống đây.
 */
export class TribulationSystem {
  private active: ActiveTribulation | null = null
  private cooldownUntil = 0

  constructor(
    private readonly deps: {
      eventBus: EventBus
      battleSystem: BattleSystem
      combatSystem: CombatSystem
      // Snapshot player -> CombatEntity cần skillManager/skillSystem
      // (skill levels + runtime stats) — GameManager cung cấp closure
      // này thay vì inject cả hai hệ thống skill vào đây.
      buildPlayerSnapshot: (player: PlayerData, playerStats: Stats) => CombatEntity
    },
  ) {}

  /**
   * Độ Kiếp (mục 11 spec `breakthrough`) — khởi trận đấu với quái Kiếp,
   * bỏ qua Stage hoàn toàn. Enemy Kiếp phải đã được đăng ký qua
   * registerEnemyTemplates().
   *
   * Đột Phá tổng quát (2026-08-16) — `foundationType` CHỈ truyền khi
   * targetRealmId === 'foundation_establishment' (tra TRIBULATION_ENEMY_ID_BY_FOUNDATION,
   * hệ Căn Cơ 4-tier cũ, không đổi); mọi targetRealmId khác tra
   * TRIBULATION_ENEMY_ID_BY_REALM (1 quái Kiếp/cảnh giới, không tier).
   */
  start(player: PlayerData, playerStats: Stats, targetRealmId: string, foundationType?: FoundationType): boolean {
    if (this.getCooldownSeconds() > 0 || this.active) {
      return false
    }

    const profile = getTribulationProfile(targetRealmId)

    if (!profile) {
      return false
    }

    this.deps.battleSystem.startTribulation(this.deps.buildPlayerSnapshot(player, playerStats))

    this.active = {
      targetRealmId,
      foundationType,
      durationSeconds: profile.durationSeconds,
      secondsRemaining: profile.durationSeconds,
      strikeIntervalSeconds: profile.strikeIntervalSeconds,
      nextStrikeInSeconds: profile.strikeIntervalSeconds,
      lightningMaxHpDamagePercent: profile.lightningMaxHpDamagePercent,
    }

    return true
  }

  update(deltaSeconds: number) {
    const active = this.active
    const battle = this.deps.battleSystem.getBattle()

    if (!active || !battle || battle.mode !== 'tribulation' || battle.state !== 'fighting') {
      return
    }

    // GameClock đo thời gian thực và Chromium có thể gom nhiều giây vào một
    // tick khi tab/cửa sổ nằm nền. Chỉ tiêu thụ phần thời gian còn thuộc trận,
    // rồi catch-up TẤT CẢ mốc lôi kích trong khoảng đó trước khi tuyên thắng.
    const elapsedInTribulation = Math.min(deltaSeconds, active.secondsRemaining)

    active.secondsRemaining = Math.max(0, active.secondsRemaining - elapsedInTribulation)
    active.nextStrikeInSeconds -= elapsedInTribulation

    // Guard interval > 0 — strikeIntervalSeconds 0/âm làm nextStrikeInSeconds
    // không bao giờ tăng lại, vòng lặp catch-up thành vô hạn.
    while (active.strikeIntervalSeconds > 0 && active.nextStrikeInSeconds <= 0 && battle.player.currentHp > 0) {
      const mitigation = 100 / (100 + Math.max(0, battle.player.stats.defense))
      const damage = battle.player.maxHp * active.lightningMaxHpDamagePercent * mitigation
      const applied = this.deps.combatSystem.applyDirectDamage(battle.player, damage, 'heavenly_tribulation')
      this.deps.eventBus.emit('damage', {
        type: 'damage', sourceId: 'heavenly_tribulation', targetId: battle.player.id,
        value: applied, damageType: 'elemental',
      })
      this.deps.eventBus.emit('tribulation_lightning', { targetId: battle.player.id })
      active.nextStrikeInSeconds += active.strikeIntervalSeconds
    }
  }

  /**
   * Trận Kiếp KHÔNG đi qua Stage nên không ai tự set 'victory' khi hết
   * quái (khác updateStageProgress() — Stage-specific, xem class doc
   * BattleSystem.checkBattleEnd()) — hàm này bù lại đúng 1 việc đó.
   * 'defeat' đã tự đúng sẵn (BattleSystem.checkBattleEnd() set khi
   * player chết).
   */
  updateProgress() {
    if (!this.active) {
      return
    }

    const battle = this.deps.battleSystem.getBattle()

    if (!battle || battle.state !== 'fighting' || battle.mode !== 'tribulation') {
      return
    }

    if (battle.player.currentHp <= 0) {
      battle.state = 'defeat'
      this.cooldownUntil = Date.now() + TRIBULATION_COOLDOWN_SECONDS * 1000
      this.deps.eventBus.emit('battle_end', { type: 'battle_end', state: 'defeat' })
    } else if (this.active.secondsRemaining <= 0) {
      battle.state = 'victory'

      this.deps.eventBus.emit('battle_end', { type: 'battle_end', state: 'victory' })
    }
  }

  /**
   * Gọi sau khi useTribulation.ts (Phase 5) đã xử lý xong thắng/thua —
   * dọn trạng thái để trận kế tiếp (Stage bình thường hoặc TRÚC CƠ khác)
   * không bị nhầm là đang giữa 1 Tribulation cũ.
   */
  clear() {
    this.active = null
  }

  getActive(): ActiveTribulation | null {
    return this.active
  }

  getCooldownSeconds(now = Date.now()): number {
    return Math.max(0, Math.ceil((this.cooldownUntil - now) / 1000))
  }
}
