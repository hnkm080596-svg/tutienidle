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
import { stageSpawnableEnemyIds } from '../stage/StageSpawnableEnemies'

export interface StageWaveSystemDeps {
  eventBus: EventBus
  enemySystem: EnemySystem
  stageManager: StageManager
  stageSystem: StageSystem
  stageTemplates: TemplateRegistry<Stage>
  enemyTemplates: TemplateRegistry<Enemy>
  // Gate mo man (realm gate + tuyen zone) - GameManager cung cap closure
  // vi isStageUnlocked can ca stageTemplates lan zoneRegistry.
  isStageUnlocked: (stageId: string, player: PlayerData) => boolean
  // Khoi tran voi player that (snapshot skill/stats) - GameManager cung cap
  // startBattleWithPlayer de khong phai inject skill systems. ARCH-002 (M7):
  // stats are resolved inside the battle ops after the passive reset - the
  // caller no longer passes a snapshot.
  launchBattle: (player: PlayerData, enemy: Enemy) => void
  // Quai an (spec dot-pha-loi-kiep sec4.1c) - roll tra tron pool spawn
  // Luyen Khi khi cua so 1000 kill mo.
  hiddenBeast: HiddenBeastSystem
  // Session rng seam (F-W-7) - optional injectable stream so harnesses
  // pin the hidden-substitution roll.
  sessionRng?: () => number
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
   * Admission probe: would start() pass its two gates for this
   * (player, stage) right now? Mirrors the refused-start checks -
   * stage unlocked + the single slot free - without minting a lease or
   * touching RNG. The only write is the same stale-lease self-heal
   * start() performs before acquiring. Callers with pre-admission side
   * effects (HIDDEN-B's hidden-battle resolver consumes a roll on
   * resolve) consult this BEFORE resolving so a refused start resolves
   * nothing.
   */
  canStart(player: PlayerData, stage: Stage): boolean {
    if (!this.deps.isStageUnlocked(stage.id, player)) {
      return false
    }
    if (!this.deps.stageManager.owns(this.stageLease)) {
      this.stageLease = null
    }
    return this.deps.stageManager.getActive() === null
  }

  /**
   * Diem vao DUY NHAT de bat dau 1 man. Quai dau tien spawn ngay trong
   * lenh goi nay (qua launchBattle - tu nhien tai dung
   * passiveSystem.resetStacks() ben trong, dung diem reset stack 1 LAN/
   * man chu khong phai moi wave).
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

  // C1 (2026-09-08) - the legacy real-time spawn loop (update()) and
  // resolveBossSummons() are REMOVED: neither was called from any prod
  // caller since the Slice 6 cutover (turn-based wave spawning lives in
  // TurnBattleSystem.tickPacing via the spawnEnemy factory). The live
  // surface is start/stopRepeat/getProgress/pickEnemyForTurnSpawn below.

  // Nguoi choi CHU DONG thoat tran giua chung / player chet - dung stage
  // va tat auto-repeat. Phan thuong da kiem duoc KHONG mat (loot cap theo
  // tung quai chet, xem BattleLootSystem.processDefeatedEnemies()).
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

  // Phase A0 (2026-09-07) - the `alive` field is REMOVED from this shape:
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

      // Doc effectiveTotalEnemyCount thay vi stage.totalEnemyCount tho -
      // progress hien thi (CombatTopBar.vue) phai khop con so THAT dung
      // de quyet dinh victory (xem update() o tren), khong thi stage
      // Boss hien "1/5" thay vi "1/1" du tran da thang.
      total: effectiveTotalEnemyCount(stage),
    }
  }

  /**
   * Roll 1 entry trong enemyPool theo weight, tra template, roi roll
   * rieng `eliteChance` cua DUNG entry do - trung thi gan tag tinh_anh
   * len ban spawn (stat/prefix/flag qua applyEnemyTags, xem
   * core/enemy/EnemyTag.ts) thay vi tra ban thuong. `eliteChance` nghia
   * moi (spec v3 B9): chance to attach the tinh_anh tag. Dung chung cho
   * quai DAU (start) lan quai spawn giua chung (update).
   *
   * `isFinalSpawn` - Core Loop Foundation checklist (Muc BOSS): luot
   * spawn CUOI cua stage co bossEnemyId LUON LA Boss, bo qua roll
   * enemyPool cho phan template (Boss KHONG ngau nhien nhu tag).
   *
   * `options.allowTags` - spec v3 D5: tag chi roll o kenh ACTIVE; idle
   * (auto-farm cycle) pass `allowTags: false` nen khong bao gio gan tag.
   * Boss van ap unconditional o ca 2 kenh (D4).
   */
  private pickEnemyForSpawn(
    stage: Stage,
    isFinalSpawn: boolean,
    options?: { allowTags?: boolean; rng?: () => number },
  ): Enemy | undefined {
    const floor = stage.floor ?? stage.requiredRealmLevel

    // Cac chapter co the tam tai dung encounter pool cua chapter truoc.
    // Combat van phai dung canh gioi cua stage de Realm Pressure khong bien
    // quai Truc Co thanh quai Luyen Khi duoi ten khac.
    const applyStageRealm = (enemy: Enemy): Enemy =>
      stage.requiredRealmId ? { ...enemy, realmId: stage.requiredRealmId } : enemy

    // DESIGN: boss chi xuat hien o tang 10 (tang cuoi chuong). bossEnemyId tren
    // cac stage 1-9 hien la metadata/reserved data, khong phai lenh spawn boss.
    // Khong bo guard nay chi vi stage 1-9 cung khai bossEnemyId.
    if (isFinalSpawn && floor === 10 && stage.bossEnemyId) {
      const bossTemplate = this.deps.enemyTemplates.get(stage.bossEnemyId)

      if (bossTemplate) {
        const boss = createBossVariant(bossTemplate)

        // Spec v3 section 2.2 - active floor 10 can still stack the
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

    // Tag roll - ACTIVE only (spec v3 D5): eliteChance is the chance to
    // attach the tinh_anh tag; idle passes allowTags: false.
    if (options?.allowTags !== false && entry.eliteChance && rollChance(entry.eliteChance, options?.rng)) {
      return applyStageRealm(applyEnemyTags(template, ['tinh_anh'], ENEMY_TAGS))
    }

    // Quai an tra tron (spec dot-pha-loi-kiep sec4.1c) - chi stage Luyen
    // Khi + cua so 1000 kill mo; roll 5% thay the quai pool bang Huyet Mong.
    // Stage khong khai bao requiredRealmId thi khong thuoc band nao -
    // pass raw, khong ngam coi nhu Luyen Khi.
    // BETA SCOPE LOCK v2 funnel: the stage pool is the single allow-list
    // - a substitution may only surface an identity the stage declares
    // spawnable. Beta stages never declare a hidden beast, so the
    // substitution can never fire on them (matches hiddenContent: false).
    if (this.activeStagePlayer) {
      const hidden = this.deps.hiddenBeast.maybeReplaceSpawn(
        this.activeStagePlayer,
        stage.requiredRealmId,
        options?.rng ?? this.deps.sessionRng,
      )
      if (hidden && stageSpawnableEnemyIds(stage).has(hidden.id)) {
        return applyStageRealm(hidden)
      }
    }

    return applyStageRealm(template)
  }

  /**
   * Slice 6 cutover (Completion Task 8): public wrapper cho TurnBattle's
   * spawnEnemy factory - dung chung nguyen logic roll that (boss-at-10 +
   * pool roll + tag roll + hidden beast + realm override). KHONG doi
   * logic, chi expose pickEnemyForSpawn cho adapter ngoai. `allowTags`
   * mac dinh true (active); idle (auto-farm) truyen false (spec v3 D5).
   */
  pickEnemyForTurnSpawn(
    stage: Stage,
    isFinalSpawn: boolean,
    options?: { allowTags?: boolean; rng?: () => number },
  ): Enemy | undefined {
    return this.pickEnemyForSpawn(stage, isFinalSpawn, options)
  }
}
