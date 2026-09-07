import type { EventBus } from '../events/EventBus'
import { createEliteVariant, createBossVariant } from '../enemy/Enemy'
import type { Enemy } from '../enemy/Enemy'
import { rollChance } from '../reward/DropRoll'
import type { PlayerData } from '../player/Player'
import type { Stats } from '../stats/StatBlock'
import type { StageManager } from '../stage/StageManager'
import type { StageSystem } from '../stage/StageSystem'
import type { Stage } from '../stage/Stage'
import type { EnemySystem } from '../enemy/EnemySystem'
import type { TemplateRegistry } from './TemplateRegistry'
import type { HiddenBeastSystem } from './HiddenBeastSystem'
import { effectiveTotalEnemyCount } from '../stage/EffectiveEnemyCount'

export interface StageWaveSystemDeps {
  eventBus: EventBus
  enemySystem: EnemySystem
  stageManager: StageManager
  stageSystem: StageSystem
  stageTemplates: TemplateRegistry<Stage>
  enemyTemplates: TemplateRegistry<Enemy>
  // Gate mở màn (realm gate + tuyến zone) — GameManager cung cấp closure
  // vì isStageUnlocked cần cả stageTemplates lẫn zoneRegistry.
  isStageUnlocked: (stageId: string, player: PlayerData) => boolean
  // Khởi trận với player thật (snapshot skill/stats) — GameManager cung cấp
  // startBattleWithPlayer để không phải inject skill systems.
  launchBattle: (player: PlayerData, playerStats: Stats, enemy: Enemy) => void
  // Quái ẩn (spec dot-pha-loi-kiep §4.1c) — roll trà trộn pool spawn
  // Luyện Khí khi cửa sổ 1000 kill mở.
  hiddenBeast: HiddenBeastSystem
}

/**
 * Vòng đời wave của 1 Màn (2026-08-24, tách khỏi GameManager):
 * spawn theo nhịp (SONG SONG, không đợi quái cũ chết), spawn ngay nếu
 * sân trống, set 'victory' khi đã spawn đủ + hết quái sống, auto-repeat
 * cycle khi bật chế độ đánh liên tục. Cả boss summon (Combat Rework
 * Phase 4 — rút Battle.pendingSummons rồi spawn thật) cũng nằm đây vì
 * cùng pattern spawn glue.
 */
export class StageWaveSystem {
  private activeStagePlayer?: PlayerData
  private repeatStageContinuously = false

  constructor(private readonly deps: StageWaveSystemDeps) {}

  /**
   * Điểm vào DUY NHẤT để bắt đầu 1 màn. Quái đầu tiên spawn ngay trong
   * lệnh gọi này (qua launchBattle — tự nhiên tái dùng
   * passiveSystem.resetStacks() bên trong, đúng điểm reset stack 1 LẦN/
   * màn chứ không phải mỗi wave).
   */
  start(player: PlayerData, playerStats: Stats, stage: Stage, repeatContinuously = false): boolean {
    if (!this.deps.isStageUnlocked(stage.id, player)) {
      return false
    }

    if (!this.deps.stageManager.start(stage)) {
      return false
    }

    this.activeStagePlayer = player
    this.repeatStageContinuously = repeatContinuously

    // Stage chỉ 1 quái + có bossEnemyId -> quái đầu tiên (spawnedCount
    // 0) CŨNG là quái CUỐI, phải là Boss ngay từ đầu.
    const firstEnemyTemplate = this.pickEnemyForSpawn(stage, effectiveTotalEnemyCount(stage) === 1)

    if (!firstEnemyTemplate) {
      this.deps.stageManager.stop()

      return false
    }

    this.deps.launchBattle(player, playerStats, firstEnemyTemplate)

    return true
  }

  // C1 (2026-09-08) — the legacy real-time spawn loop (update()) and
  // resolveBossSummons() are REMOVED: neither was called from any prod
  // caller since the Slice 6 cutover (turn-based wave spawning lives in
  // TurnBattleSystem.tickPacing via the spawnEnemy factory). The live
  // surface is start/stopRepeat/getProgress/pickEnemyForTurnSpawn below.

  // Người chơi CHỦ ĐỘNG thoát trận giữa chừng / player chết — dừng stage
  // và tắt auto-repeat. Phần thưởng đã kiếm được KHÔNG mất (loot cấp theo
  // từng quái chết, xem BattleLootSystem.processDefeatedEnemies()).
  stopRepeat() {
    this.deps.stageManager.stop()
    this.repeatStageContinuously = false
  }

  // Phase A0 (2026-09-07) — the `alive` field is REMOVED from this shape:
  // it used to read the legacy battleSystem's enemy list, which is always
  // empty during real turn-based gameplay (HUD counter stuck at 0).
  // GameManager.getStageProgress() now composes the live count itself from
  // this.turnBattle.enemies. resolveBossSummons() below still reads
  // battleSystem for pendingSummons (separate, currently-dead code path —
  // out of scope per the A0 spec).
  getProgress(): { spawned: number; total: number } | null {
    const active = this.deps.stageManager.get()

    if (!active) {
      return null
    }

    const stage = this.deps.stageTemplates.get(active.stageId)

    if (!stage) {
      return null
    }

    return {
      spawned: active.spawnedCount,

      // Đọc effectiveTotalEnemyCount thay vì stage.totalEnemyCount thô —
      // progress hiển thị (CombatTopBar.vue) phải khớp con số THẬT dùng
      // để quyết định victory (xem update() ở trên), không thì stage
      // Boss hiện "1/5" thay vì "1/1" dù trận đã thắng.
      total: effectiveTotalEnemyCount(stage),
    }
  }

  /**
   * Roll 1 entry trong enemyPool theo weight, tra template, rồi roll
   * riêng `eliteChance` của ĐÚNG entry đó — trúng thì trả bản Elite
   * (buff stat + eliteRewards nếu có, xem
   * core/enemy/Enemy.createEliteVariant()) thay vì bản thường. Dùng
   * chung cho quái ĐẦU (start) lẫn quái spawn giữa chừng (update).
   *
   * `isFinalSpawn` — Core Loop Foundation checklist (Mục BOSS): lượt
   * spawn CUỐI của stage có bossEnemyId LUÔN LÀ Boss, bỏ qua roll
   * enemyPool/eliteChance hoàn toàn (Boss KHÔNG ngẫu nhiên như Elite).
   */
  private pickEnemyForSpawn(stage: Stage, isFinalSpawn: boolean): Enemy | undefined {
    const floor = stage.floor ?? stage.requiredRealmLevel

    // Các chapter có thể tạm tái dùng encounter pool của chapter trước.
    // Combat vẫn phải dùng cảnh giới của stage để Realm Pressure không biến
    // quái Trúc Cơ thành quái Luyện Khí dưới tên khác.
    const applyStageRealm = (enemy: Enemy): Enemy =>
      stage.requiredRealmId ? { ...enemy, realmId: stage.requiredRealmId } : enemy

    // DESIGN: boss chỉ xuất hiện ở tầng 10 (tầng cuối chương). bossEnemyId trên
    // các stage 1-9 hiện là metadata/reserved data, không phải lệnh spawn boss.
    // Không bỏ guard này chỉ vì stage 1-9 cũng khai bossEnemyId.
    if (isFinalSpawn && floor === 10 && stage.bossEnemyId) {
      const bossTemplate = this.deps.enemyTemplates.get(stage.bossEnemyId)

      if (bossTemplate) {
        return applyStageRealm(createBossVariant(bossTemplate))
      }
    }

    const entry = this.deps.stageSystem.pickNextEnemyEntry(stage)
    const template = this.deps.enemyTemplates.get(entry.enemyId)

    if (!template) {
      return undefined
    }

    if (entry.eliteChance && rollChance(entry.eliteChance)) {
      return applyStageRealm(createEliteVariant(template))
    }

    // Quái ẩn trà trộn (spec dot-pha-loi-kiep §4.1c) — chỉ stage Luyện
    // Khí + cửa sổ 1000 kill mở; roll 5% thay thế quái pool bằng Huyết Mông.
    if (this.activeStagePlayer) {
      const hidden = this.deps.hiddenBeast.maybeReplaceSpawn(
        this.activeStagePlayer,
        stage.requiredRealmId ?? 'qi_refining',
      )
      if (hidden) {
        return applyStageRealm(hidden)
      }
    }

    return applyStageRealm(template)
  }

  /**
   * Slice 6 cutover (Completion Task 8): public wrapper cho TurnBattle's
   * spawnEnemy factory — dùng chung nguyên logic roll thật (boss-at-10 +
   * pool roll + elite chance + hidden beast + realm override). KHÔNG đổi
   * logic, chỉ expose pickEnemyForSpawn cho adapter ngoài.
   */
  pickEnemyForTurnSpawn(stage: Stage, isFinalSpawn: boolean): Enemy | undefined {
    return this.pickEnemyForSpawn(stage, isFinalSpawn)
  }
}
