import type { BattleSystem } from '../battle/legacy/BattleSystem'
import type { EventBus } from '../events/EventBus'
import { enemyToCombatEntity, createEliteVariant, createBossVariant } from '../enemy/Enemy'
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

export interface StageWaveSystemDeps {
  eventBus: EventBus
  battleSystem: BattleSystem
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
    const firstEnemyTemplate = this.pickEnemyForSpawn(stage, stage.totalEnemyCount === 1)

    if (!firstEnemyTemplate) {
      this.deps.stageManager.stop()

      return false
    }

    this.deps.launchBattle(player, playerStats, firstEnemyTemplate)

    return true
  }

  /**
   * Gọi mỗi tick (sau grantBattleRewardIfNeeded() — cần battle.enemies
   * đã được dọn quái chết trước khi đếm "còn sống bao nhiêu").
   */
  update(deltaSeconds: number) {
    const active = this.deps.stageManager.get()

    if (!active) {
      return
    }

    const battle = this.deps.battleSystem.getBattle()

    // Player chết (battle.state 'defeat') — BattleSystem.checkBattleEnd()
    // chỉ tự set 'defeat', KHÔNG tự dừng stage (không nên biết về
    // Stage, xem class doc). Phải dừng stageManager ở ĐÂY, không thì
    // active không bao giờ về null, khoá cứng nút "Chiến Đấu" vĩnh viễn.
    if (!battle || battle.state === 'defeat') {
      this.stopRepeat()

      return
    }

    if (battle.state !== 'fighting') {
      return
    }

    const stage = this.deps.stageTemplates.get(active.stageId)

    if (!stage) {
      return
    }

    // "Còn trên sân" = quái ĐANG ĐÁNH + quái ĐANG TELEGRAPH (pending):
    // thiếu pendingCount thì wave sau được đặt lịch ồ ạt (sân "trống" giả
    // khi quái chưa materialize) và trận kết thúc sớm khi telegraph còn
    // chạy (migration spawn telegraph 2026-08-24).
    const aliveCount = battle.enemies.length + battle.pendingEnemySpawns.length

    if (active.spawnedCount >= stage.totalEnemyCount) {
      if (aliveCount === 0) {
        if (
          this.activeStagePlayer &&
          !this.activeStagePlayer.completedStageIds.includes(stage.id)
        ) {
          this.activeStagePlayer.completedStageIds.push(stage.id)
        }

        if (this.repeatStageContinuously && this.deps.stageManager.restartCycle(stage)) {
          // Giữ nguyên Battle/player HP, resource, cooldown và reward summary;
          // cycle mới chỉ khởi động lại bộ đếm spawn của stage.
          return
        }

        battle.state = 'victory'

        this.deps.stageManager.stop()

        // Chỉ chạy tới đây đúng 1 lần — tick kế battle.state đã là
        // 'victory' (!== 'fighting'), hàm này return sớm ở trên.
        this.deps.eventBus.emit('battle_end', { type: 'battle_end', state: 'victory' })
      }

      return
    }

    active.spawnCountdown -= deltaSeconds

    // Sân trống quái giữa chừng thì spawn ngay (không đợi hết nhịp) —
    // tránh "chết thời gian" khi player out-DPS nhịp spawn mặc định.
    if (active.spawnCountdown > 0 && aliveCount > 0) {
      return
    }

    const nextEnemyTemplate = this.pickEnemyForSpawn(
      stage,
      active.spawnedCount === stage.totalEnemyCount - 1,
    )

    if (!nextEnemyTemplate) {
      return
    }

    const nextEnemyEntity = enemyToCombatEntity(this.deps.enemySystem.spawn(nextEnemyTemplate))

    // Luồng mới (plan §5.2): ĐẶT LỊCH spawn (telegraph 0.75–1.4s) thay vì
    // materialize ngay tại cột 16. Overlap hợp lệ nên queue LUÔN thành
    // công — không còn retry "hết chỗ" (spawnedCount tăng ngay).
    this.deps.battleSystem.queueEnemySpawn(battle, nextEnemyEntity)

    active.spawnedCount++

    active.spawnCountdown = stage.spawnIntervalSeconds
  }

  // Người chơi CHỦ ĐỘNG thoát trận giữa chừng / player chết — dừng stage
  // và tắt auto-repeat. Phần thưởng đã kiếm được KHÔNG mất (loot cấp theo
  // từng quái chết, xem BattleLootSystem.processDefeatedEnemies()).
  stopRepeat() {
    this.deps.stageManager.stop()
    this.repeatStageContinuously = false
  }

  getProgress(): { spawned: number; total: number; alive: number } | null {
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

      total: stage.totalEnemyCount,

      alive: this.deps.battleSystem.getBattle()?.enemies.length ?? 0,
    }
  }

  /**
   * Combat Rework Phase 4 (Boss Mechanics) — rút Battle.pendingSummons
   * (BattleSystem đẩy vào khi 1 TribulationPhase.summonEnemyIds trigger,
   * xem BattleSystem.updateTribulationPhases()) rồi spawn thật, cùng
   * pattern update() dùng cho wave spawn — đây là nơi DUY NHẤT biết tra
   * Enemy template theo id (enemyTemplates), BattleSystem không nên biết.
   */
  resolveBossSummons() {
    const battle = this.deps.battleSystem.getBattle()

    if (!battle || battle.pendingSummons.length === 0) {
      return
    }

    // Spawn qua telegraph queue như quái thường; overlap hợp lệ nên
    // luôn schedule được (plan §5.2).
    for (const enemyId of battle.pendingSummons) {
      const template = this.deps.enemyTemplates.get(enemyId)

      if (!template) {
        continue
      }

      const summonedEntity = enemyToCombatEntity(this.deps.enemySystem.spawn(template))

      this.deps.battleSystem.queueEnemySpawn(battle, summonedEntity)
    }

    battle.pendingSummons = []
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
