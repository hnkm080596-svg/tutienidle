import type { EventBus } from '../events/EventBus'
import { createBossVariant } from '../enemy/Enemy'
import type { Enemy } from '../enemy/Enemy'
import { applyEnemyTags } from '../enemy/EnemyTag'
import { ENEMY_TAGS } from '../../data/enemy/EnemyTags'
import { rollChance } from '../reward/DropRoll'
import type { PlayerData } from '../player/Player'
import type { StageLease, StageManager } from '../stage/StageManager'
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
  // startBattleWithPlayer để không phải inject skill systems. ARCH-002 (M7):
  // stats are resolved inside the battle ops after the passive reset — the
  // caller no longer passes a snapshot.
  launchBattle: (player: PlayerData, enemy: Enemy) => void
  // Quái ẩn (spec dot-pha-loi-kiep §4.1c) — roll trà trộn pool spawn
  // Luyện Khí khi cửa sổ 1000 kill mở.
  hiddenBeast: HiddenBeastSystem
}

/**
 * Wave lifecycle of one stage (2026-08-24, split from GameManager):
 * spawns on cadence (IN PARALLEL, without waiting for prior enemies to
 * die), spawns immediately if the field is empty, sets 'victory' when
 * all waves spawned + no enemies alive, auto-repeats the cycle when
 * continuous-fight mode is on.
 */
export class StageWaveSystem {
  private activeStagePlayer?: PlayerData
  private repeatStageContinuously = false
  // The lease token THIS stage run acquired - the ownership capability
  // (Mission C audit): release is valid only while the slot still holds
  // this exact token, so a stale stopRepeat can never stomp a foreign
  // owner's lease.
  private stageLease: StageLease | null = null

  constructor(private readonly deps: StageWaveSystemDeps) {}

  /**
   * Điểm vào DUY NHẤT để bắt đầu 1 màn. Quái đầu tiên spawn ngay trong
   * lệnh gọi này (qua launchBattle — tự nhiên tái dùng
   * passiveSystem.resetStacks() bên trong, đúng điểm reset stack 1 LẦN/
   * màn chứ không phải mỗi wave).
   *
   * Transactional (Mission C audit): the lease is acquired first, then
   * pick + launch run; ANY failure - refused pick, thrown pick, thrown
   * launch - rolls the lease back and rethrows. A thrown start can never
   * leave the global slot occupied.
   */
  start(
    player: PlayerData,
    stage: Stage,
    repeatContinuously = false,
    options?: { rng?: () => number },
  ): boolean {
    if (!this.deps.isStageUnlocked(stage.id, player)) {
      return false
    }

    // Self-heal a stale marker: our previous lease died externally, so
    // it must not count as "us still holding the slot".
    if (!this.deps.stageManager.owns(this.stageLease)) {
      this.stageLease = null
    }

    const lease = this.deps.stageManager.acquire(stage)
    if (!lease) {
      return false
    }

    this.stageLease = lease
    this.activeStagePlayer = player
    this.repeatStageContinuously = repeatContinuously

    try {
      // A stage with exactly 1 enemy + a bossEnemyId means the FIRST
      // enemy (spawnedCount 0) is also the LAST - it must be the Boss
      // from the start.
      const firstEnemyTemplate = this.pickEnemyForSpawn(stage, effectiveTotalEnemyCount(stage) === 1, options)

      if (!firstEnemyTemplate) {
        this.rollbackFailedStart(lease)
        return false
      }

      this.deps.launchBattle(player, firstEnemyTemplate)

      return true
    } catch (error) {
      // Roll back ONLY the lease we acquired: release() is identity-
      // checked, so if the slot somehow changed hands mid-unwind the
      // foreign owner is never stomped. The original error propagates.
      this.rollbackFailedStart(lease)
      throw error
    }
  }

  private rollbackFailedStart(lease: StageLease): void {
    this.deps.stageManager.release(lease)
    this.stageLease = null
    this.activeStagePlayer = undefined
    this.repeatStageContinuously = false
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
    // Capability release - frees the slot ONLY if this stage run still
    // owns it. A lease that died externally (or a slot now held by a
    // foreign owner like auto-farm) is untouched.
    if (this.stageLease !== null) {
      this.deps.stageManager.release(this.stageLease)
      this.stageLease = null
    }
    this.repeatStageContinuously = false
    // C8 - the stage run's player context must not outlive the stage
    // hold: pickEnemyForSpawn reads it for the hidden-beast roll, and
    // this same system serves the idle auto-farm pick channel.
    this.activeStagePlayer = undefined
  }

  /**
   * Ownership query for the repeat gate (Mission C audit): "this stage
   * run still holds its lease" - not "someone holds the slot". A foreign
   * owner (auto-farm, or a lease that replaced ours) must not keep a
   * dead stage run auto-repeating.
   */
  holdsActiveStageLease(): boolean {
    return this.deps.stageManager.owns(this.stageLease)
  }

  // Phase A0 (2026-09-07) — the `alive` field is REMOVED from this shape:
  // it used to read the legacy battleSystem's enemy list, which is always
  // empty during real turn-based gameplay (HUD counter stuck at 0).
  // GameManager.getStageProgress() now composes the live count itself from
  // this.turnBattle.enemies.
  getProgress(): { spawned: number; total: number } | null {
    // Ownership check: only OUR lease's progress is reportable - a
    // foreign owner holding the slot is not this stage run.
    if (!this.deps.stageManager.owns(this.stageLease)) {
      return null
    }

    const active = this.deps.stageManager.getActive()!

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
   * riêng `eliteChance` của ĐÚNG entry đó — trúng thì gắn tag tinh_anh
   * lên bản spawn (stat/prefix/flag qua applyEnemyTags, xem
   * core/enemy/EnemyTag.ts) thay vì trả bản thường. `eliteChance` nghĩa
   * mới (spec v3 B9): chance to attach the tinh_anh tag. Dùng chung cho
   * quái ĐẦU (start) lẫn quái spawn giữa chừng (update).
   *
   * `isFinalSpawn` — Core Loop Foundation checklist (Mục BOSS): lượt
   * spawn CUỐI của stage có bossEnemyId LUÔN LÀ Boss, bỏ qua roll
   * enemyPool cho phần template (Boss KHÔNG ngẫu nhiên như tag).
   *
   * `options.allowTags` — spec v3 D5: tag chỉ roll ở kênh ACTIVE; idle
   * (auto-farm cycle) pass `allowTags: false` nên không bao giờ gắn tag.
   * Boss vẫn áp unconditional ở cả 2 kênh (D4).
   */
  private pickEnemyForSpawn(
    stage: Stage,
    isFinalSpawn: boolean,
    options?: { allowTags?: boolean; rng?: () => number },
  ): Enemy | undefined {
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
        const boss = createBossVariant(bossTemplate)

        // Spec v3 section 2.2 — active floor 10 can still stack the
        // tinh_anh tag ON TOP of the boss variant (~10% boss+tinh_anh).
        // The chance comes from the boss species' own pool entry (the
        // builder authors bossEnemyId === the elite pool species); idle
        // never rolls (allowTags: false).
        const bossEntry = stage.enemyPool.find(poolEntry => poolEntry.enemyId === stage.bossEnemyId)
        if (options?.allowTags !== false && bossEntry?.eliteChance && rollChance(bossEntry.eliteChance, options?.rng)) {
          return applyStageRealm(applyEnemyTags(boss, ['tinh_anh'], ENEMY_TAGS))
        }

        return applyStageRealm(boss)
      }
    }

    const entry = this.deps.stageSystem.pickNextEnemyEntry(stage, options?.rng)
    const template = this.deps.enemyTemplates.get(entry.enemyId)

    if (!template) {
      return undefined
    }

    // Tag roll — ACTIVE only (spec v3 D5): eliteChance is the chance to
    // attach the tinh_anh tag; idle passes allowTags: false.
    if (options?.allowTags !== false && entry.eliteChance && rollChance(entry.eliteChance, options?.rng)) {
      return applyStageRealm(applyEnemyTags(template, ['tinh_anh'], ENEMY_TAGS))
    }

    // Quái ẩn trà trộn (spec dot-pha-loi-kiep §4.1c) — chỉ stage Luyện
    // Khí + cửa sổ 1000 kill mở; roll 5% thay thế quái pool bằng Huyết Mông.
    if (this.activeStagePlayer) {
      const hidden = this.deps.hiddenBeast.maybeReplaceSpawn(
        this.activeStagePlayer,
        stage.requiredRealmId ?? 'qi_refining',
        options?.rng,
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
   * pool roll + tag roll + hidden beast + realm override). KHÔNG đổi
   * logic, chỉ expose pickEnemyForSpawn cho adapter ngoài. `allowTags`
   * mặc định true (active); idle (auto-farm) truyền false (spec v3 D5).
   */
  pickEnemyForTurnSpawn(
    stage: Stage,
    isFinalSpawn: boolean,
    options?: { allowTags?: boolean; rng?: () => number },
  ): Enemy | undefined {
    return this.pickEnemyForSpawn(stage, isFinalSpawn, options)
  }
}
