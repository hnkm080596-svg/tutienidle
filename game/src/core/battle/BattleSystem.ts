import type { Battle, BattleEnemy, PendingEnemySpawn } from './Battle'

import type { CombatSystem } from '../combat/CombatSystem'

import { BuffManager } from '../buff/BuffManager'

import { BuffSystem } from '../buff/BuffSystem'

import type { BuffRegistry } from '../buff/BuffRegistry'

import { AilmentManager } from '../ailment/AilmentManager'

import { AilmentSystem } from '../ailment/AilmentSystem'

import type { AilmentRegistry } from '../ailment/AilmentRegistry'

import { calculateStats } from '../stats/StatCalculator'

import type { SkillManager } from '../skill/SkillManager'

import type { SkillSystem } from '../skill/SkillSystem'

import type { SkillEffectSystem } from '../skill/SkillEffectSystem'

import type { Skill } from '../skill/Skill'
import type { SkillEffect } from '../skill/SkillEffect'
import { getSkillRuntimeStat } from '../skill/SkillRuntimeStats'

import type { CombatEntity } from '../combat/CombatEntity'

import type { EventBus } from '../events/EventBus'

import { ReactionManager } from '../element/ReactionManager'

import { HERO_COLUMN, SPAWN_COLUMN, VISIBLE_MAX_COLUMN } from './BattleLane'

import { resolveEnemySpawnPosition, enemySpawnCellKey } from './EnemySpawnPlacement'
import type { EnemySpawnVfxPresetId } from './CombatAction'
import type { GridPosition } from './BattleGrid'

import {
  ActionImpactSystem,
  type ActionDamageInfo,
  type HitResolveOptions,
} from './ActionImpactSystem'

import { areaFor, collectAffected, selectPrimaryTarget } from './ActionTargetingSystem'
import { targetingForSkill, vfxPresetForSkill, type EffectScope } from './CombatAction'
import {
  MAX_SWORD_INTENT,
  MAX_MOMENTUM,
  MAX_HOA_THE,
  MAX_THO_THE,
  KIM_THE_DECAY_INTERVAL_SECONDS,
} from '../combat/CombatTypes'

import { getAttackIntervalSeconds } from '../combat/AttackTiming'

import type { BattlePositionsEvent } from './BattleEvents'

import type { LavaZone } from './LavaZone'

import type { ElementType } from '../element/ElementType'
import { getColumnFromWorldX, worldToGridPosition } from './BattleGrid'

// Combat Grid Rework — windup cơ bản cho đòn thường (không còn thời

// gian bay projectile): đòn có "trọng lượng" nhờ khoảng lặng ngắn này.

const PLAYER_BASIC_WINDUP_SECONDS = 0.12

const ENEMY_MELEE_WINDUP_SECONDS = 0.15

const ENEMY_RANGED_WINDUP_SECONDS = 0.3

// Enemy attackRange từ mức này trở lên coi như "ranged" (chọn preset VFX

// impact phép + windup dài hơn).

// Core Loop Foundation checklist (Mục MONSTER) — 'ranged' giữ khoảng

// cách bằng % attackRange (không đứng sát mép tầm đánh như melee).

const RANGED_PREFERRED_DISTANCE_RATIO = 0.6

// 'caster' có 1 khoảng "khoảng lặng" ngắn trước khi đòn thực sự bắn

// ra (telegraph) — khác melee/ranged bắn ngay khi tới lượt.

const CASTER_CAST_DELAY_SECONDS = 0.6

// Pháp Tu (Thổ Tu, 2026-08-15) — Ward chỉ bắt đầu hồi sau khi không

// bị đánh trúng liên tục đủ số giây này, xem updateRegen().

const WARD_REGEN_DELAY_SECONDS = 3

// Hỏa Tu Pure (Plans/FirePath mục 7, 2026-08-21) — tốc độ Hỏa Thế TỰ

// GIẢM mỗi giây (giảm 10% nhờ "Tụ Viêm" minor, xem updateHoaThe()).

// 0.5/giây nghĩa là: đánh liên tục ở attackSpeed cơ bản (~1 cast/giây,

// +1 Hỏa Thế/cast qua hoaTheGainPerCast) vẫn tích ròng dương, ngừng

// đánh thì tụt hết trong 10 giây — "giữ nhịp thì lên, ngừng thì tụt"

// đúng tinh thần buff chiến đấu tạm thời.

const HOA_THE_BASE_DECAY_PER_SECOND = 0.5

// Countdown trước trận (2026-08-22) — giống vạch xuất phát đua xe:

// quái đầu tiên đã spawn/hiển thị (xem start()) nhưng combat logic

// đóng băng cho tới khi đếm về 0 (xem update()'s 'countdown' branch).

const BATTLE_COUNTDOWN_SECONDS = 3

// Spawn telegraph (2026-08-24) — thời gian "telegraph → xuất hiện" theo
// cấp bậc quái. Đây là TRẠNG THÁI GAMEPLAY THẬT: trong thời gian này quái
// chưa nằm trong battle.enemies (không target/đỡ đòn/đánh được), giving
// người chơi thời gian cảnh báo công bằng vì attackRange quái hiện lớn
// hơn chiều rộng grid (spawn trong sân có thể đánh ngay sau materialize).
const SPAWN_TELEGRAPH_SECONDS = {
  normal: 0.75,
  elite: 1.0,
  boss: 1.4,
} as const

function spawnTelegraphSeconds(entity: Pick<CombatEntity, 'isBoss' | 'isElite'>): number {
  if (entity.isBoss) {
    return SPAWN_TELEGRAPH_SECONDS.boss
  }

  if (entity.isElite) {
    return SPAWN_TELEGRAPH_SECONDS.elite
  }

  return SPAWN_TELEGRAPH_SECONDS.normal
}

function spawnPresetId(entity: Pick<CombatEntity, 'isBoss' | 'isElite'>): EnemySpawnVfxPresetId {
  if (entity.isBoss) {
    return 'boss_spawn'
  }

  if (entity.isElite) {
    return 'elite_spawn'
  }

  return 'enemy_spawn'
}

function scopeForEffect(effect: SkillEffect): EffectScope {
  if (effect.scope) {
    return effect.scope
  }

  return effect.type === 'heal' || effect.type === 'buff' ? 'source' : 'affected_targets'
}

export class BattleSystem {
  private battle: Battle | null = null

  private readonly reactionManager: ReactionManager

  constructor(
    private readonly combat: CombatSystem,

    private readonly skillManager: SkillManager,

    private readonly skillSystem: SkillSystem,

    private readonly skillEffectSystem: SkillEffectSystem,

    private readonly buffRegistry: BuffRegistry,

    private readonly ailmentRegistry: AilmentRegistry,

    private readonly eventBus: EventBus,

    /** Combat Grid Rework — thay hoàn toàn MissileSystem. */

    readonly actionImpact: ActionImpactSystem,
  ) {
    this.reactionManager = new ReactionManager(eventBus)
  }

  start(
    player: CombatEntity,

    firstEnemy: CombatEntity,
  ) {
    this.actionImpact.clear()

    player.x = HERO_COLUMN

    // firstEnemy KHÔNG còn đặt x = SPAWN_COLUMN ngay — đi qua luồng
    // telegraph giống mọi quái khác (queueEnemySpawn sau khi battle tạo).
    // Countdown 3s hiển thị hiệu ứng telegraph trước khi trận bắt đầu.

    this.battle = {
      id: crypto.randomUUID(),

      player,

      enemies: [],

      state: 'countdown',

      countdownSecondsRemaining: BATTLE_COUNTDOWN_SECONDS,

      playerAttackTimer: 0,

      playerBuffs: new BuffManager(),

      playerAilments: new AilmentManager(),

      elapsedSeconds: 0,

      pendingSummons: [],

      lavaZones: [],

      pendingEnemySpawns: [],
    }

    // Quái đầu tiên cũng đi qua "telegraph → xuất hiện → tham chiến".
    // Grid chắc chắn còn ô trống lúc start (0 occupied/reserved) nên
    // queue luôn thành công; fallback biên: materialize tại cột spawn cũ.
    if (!this.queueEnemySpawn(this.battle, firstEnemy)) {
      firstEnemy.x = SPAWN_COLUMN

      this.battle.enemies.push(this.createBattleEnemy(firstEnemy))

      this.eventBus.emit('enemy_spawned', { type: 'enemy_spawned', targetId: firstEnemy.id })
    }

    // Auto: trận mới có thể bắt đầu lại NGAY trong cùng 1 tick tick()

    // (App.vue thấy battle vừa 'victory'/'defeat' thì tự fightStage()

    // luôn) — Vue/registry không kịp thấy state 'fighting' rớt xuống

    // rồi lên lại, nên isFighting (MainScene.ts) không đổi giá trị và

    // KHÔNG re-trigger applyLayout()/resetVisual(). Emit event riêng,

    // MainScene subscribe thẳng qua EventBus (như các event combat

    // khác) để luôn reset hình ảnh (xoay/mờ do chết) mỗi khi trận thật

    // sự bắt đầu, không phụ thuộc Vue có quan sát kịp hay không.

    this.eventBus.emit('battle_start', { type: 'battle_start' })

    // Emit SAU 'battle_start' — MainScene reset visual trước, có data

    // vẽ khung hình đầu ngay sau, khỏi phải đợi tick kế tiếp.

    this.emitPositions(this.battle)
  }

  startTribulation(player: CombatEntity) {
    this.actionImpact.clear()

    player.x = (HERO_COLUMN + VISIBLE_MAX_COLUMN) / 2

    this.battle = {
      id: crypto.randomUUID(),
      player,
      enemies: [],
      state: 'fighting',
      mode: 'tribulation',

      playerAttackTimer: 0,
      playerBuffs: new BuffManager(),
      playerAilments: new AilmentManager(),

      elapsedSeconds: 0,
      pendingSummons: [],
      lavaZones: [],
      pendingEnemySpawns: [],
    }

    this.eventBus.emit('tribulation_started', undefined)

    this.emitPositions(this.battle)
  }

  /**

   * Quái mới vào trận GIỮA CHỪNG (wave spawn, không đợi quái cũ chết

   * hết) — gọi từ GameManager theo nhịp spawnIntervalSeconds. Không

   * đụng gì tới battle.player (HP/vị trí giữ nguyên, sinh tồn xuyên

   * suốt nhiều wave đúng yêu cầu).

   */

  spawnEnemyInto(battle: Battle, newEnemy: CombatEntity) {
    newEnemy.x = SPAWN_COLUMN

    battle.enemies.push(this.createBattleEnemy(newEnemy))

    this.eventBus.emit('enemy_spawned', { type: 'enemy_spawned', targetId: newEnemy.id })

    // Quái mới có vị trí ngay, khỏi đợi tick kế tiếp mới xuất hiện.

    this.emitPositions(battle)
  }

  /**

   * Spawn telegraph (2026-08-24) — ĐẶT LỊCH spawn: resolve 1 ô trống bên

   * phải player (không đè quái sống/telegraph khác), đẩy entity vào

   * `pendingEnemySpawns` với thời gian đếm ngược theo cấp bậc. Trong thời

   * gian telegraph, entity CHƯA nằm trong `battle.enemies` — không thể bị

   * target, không đỡ đòn, không tấn công (trạng thái gameplay thật, xem

   * Battle.pendingEnemySpawns). Hết chỗ → false: caller HOÃN spawn đến

   * tick sau (StageWaveSystem giữ spawnedCount, retry tick kế).

   */

  queueEnemySpawn(battle: Battle, entity: CombatEntity): boolean {
    const occupiedCells = new Set(
      battle.enemies

        .filter((battleEnemy) => battleEnemy.entity.alive)

        .map((battleEnemy) =>
          enemySpawnCellKey(battleEnemy.entity.row, getColumnFromWorldX(battleEnemy.entity.x)),
        ),
    )

    const reservedCells = new Set(
      battle.pendingEnemySpawns.map((pending) =>
        enemySpawnCellKey(pending.position.row, pending.position.column),
      ),
    )

    const position = resolveEnemySpawnPosition({
      playerColumn: battle.player.x,

      occupiedCells,

      reservedCells,

      isBoss: entity.isBoss ?? false,

      random: Math.random,
    })

    if (!position) {
      return false
    }

    const totalSeconds = spawnTelegraphSeconds(entity)

    battle.pendingEnemySpawns.push({
      entity,

      position,

      remainingSeconds: totalSeconds,

      totalSeconds,

      presetId: spawnPresetId(entity),
    })

    // Snapshot ngay để renderer vẽ telegraph trong chính tick này (không

    // đợi tick kế — quan trọng cho quái đầu tiên lúc countdown 3s).

    this.emitPositions(battle)

    return true
  }

  /**

   * Đếm ngược telegraph mỗi tick (chạy ở CẢ 'countdown' lẫn 'fighting'):

   * hết thời gian → gán row/x, chuyển sang battle.enemies (materialize),

   * emit 'enemy_spawned' + snapshot positions. Quái materialize trong

   * countdown đứng yên (combat logic đóng băng) — đúng ý "người chơi

   * thấy quái xuất hiện trước khi trận chính thức bắt đầu".

   */

  updatePendingEnemySpawns(battle: Battle, deltaSeconds: number) {
    if (battle.pendingEnemySpawns.length === 0) {
      return
    }

    let materialized = false

    for (const pending of [...battle.pendingEnemySpawns]) {
      pending.remainingSeconds -= deltaSeconds

      if (pending.remainingSeconds > 0) {
        continue
      }

      battle.pendingEnemySpawns = battle.pendingEnemySpawns.filter((entry) => entry !== pending)

      this.materializePendingSpawn(battle, pending)

      materialized = true
    }

    if (materialized) {
      this.emitPositions(battle)
    }
  }

  private materializePendingSpawn(battle: Battle, pending: PendingEnemySpawn) {
    pending.entity.row = pending.position.row

    pending.entity.x = pending.position.column

    battle.enemies.push(this.createBattleEnemy(pending.entity))

    this.eventBus.emit('enemy_spawned', { type: 'enemy_spawned', targetId: pending.entity.id })
  }

  /**

   * Materialize TOÀN BỘ pending ngay (bỏ qua telegraph) — dùng cho test

   * cần trạng thái tức thời sau start(); runtime không gọi.

   */

  flushPendingSpawns() {
    const battle = this.battle

    if (!battle || battle.pendingEnemySpawns.length === 0) {
      return
    }

    for (const pending of battle.pendingEnemySpawns) {
      this.materializePendingSpawn(battle, pending)
    }

    battle.pendingEnemySpawns = []

    this.emitPositions(battle)
  }

  /**

   * Nguồn DUY NHẤT Phaser (MainScene.ts) biết vị trí player/quái —

   * core ↔ Phaser chỉ giao tiếp qua EventBus, không cầm tham chiếu

   * GameManager/BattleSystem trực tiếp (xem ghi chú kiến trúc trong

   * kế hoạch). Chỉ gồm quái CÒN SỐNG, xem BattlePositionsEvent.

   */

  private emitPositions(battle: Battle) {
    const event: BattlePositionsEvent = {
      type: 'positions',

      mode: battle.mode,

      playerX: battle.player.x,

      playerCurrentHp: battle.player.currentHp,

      playerMaxHp: battle.player.maxHp,

      enemies: battle.enemies

        .filter((battleEnemy) => battleEnemy.entity.alive)

        .map((battleEnemy) => ({
          id: battleEnemy.entity.id,

          name: battleEnemy.entity.name,

          x: battleEnemy.entity.x,

          row: battleEnemy.entity.row,

          currentHp: battleEnemy.entity.currentHp,

          maxHp: battleEnemy.entity.maxHp,

          isBoss: battleEnemy.entity.isBoss ?? false,
        })),

      // Snapshot telegraph spawn — renderer reconcile theo id (id biến

      // mất = materialize xong). progress ∈ [0,1] cho VFX đếm ngược.

      spawningEnemies: battle.pendingEnemySpawns.map((pending) => ({
        id: pending.entity.id,

        name: pending.entity.name,

        row: pending.position.row,

        column: pending.position.column,

        progress:
          pending.totalSeconds > 0
            ? Math.min(1, Math.max(0, 1 - pending.remainingSeconds / pending.totalSeconds))
            : 1,

        isBoss: pending.entity.isBoss ?? false,

        presetId: pending.presetId,
      })),
    }

    this.eventBus.emit('positions', event)
  }

  private createBattleEnemy(entity: CombatEntity): BattleEnemy {
    return {
      entity,

      attackTimer: 0,

      buffs: new BuffManager(),

      ailments: new AilmentManager(),

      rewardGranted: false,
    }
  }

  getBattle() {
    return this.battle
  }

  update(deltaSeconds: number) {
    const battle = this.battle

    if (!battle) {
      return
    }

    if (battle.mode === 'tribulation') {
      this.emitPositions(battle)

      return
    }

    // Countdown trước trận (2026-08-22) — quái đầu tiên đã spawn +

    // emitPositions() đã chạy trong start(), nên chỉ cần TIẾP TỤC emit

    // vị trí mỗi tick (Phaser vẽ đúng quái đứng yên trong lúc đếm),

    // KHÔNG chạy movement/attack/spawn-tiếp-theo cho tới khi đếm về 0.

    if (battle.state === 'countdown') {
      battle.countdownSecondsRemaining = Math.max(
        0,
        (battle.countdownSecondsRemaining ?? 0) - deltaSeconds,
      )

      // Telegraph spawn chạy cả trong countdown — quái đầu tiên hiện

      // hình TRƯỚC khi trận chính thức bắt đầu (đứng yên, combat đóng băng).

      this.updatePendingEnemySpawns(battle, deltaSeconds)

      this.emitPositions(battle)

      if (battle.countdownSecondsRemaining <= 0) {
        battle.state = 'fighting'
      }

      return
    }

    if (battle.state !== 'fighting') {
      return
    }

    // Telegraph spawn giữa trận — hết đếm ngược mới materialize (xem

    // updatePendingEnemySpawns()). Đặt TRƯỚC combat logic: quái vừa hiện

    // có thể bị target ngay tick này nhưng chưa từng tồn tại trước đó.

    this.updatePendingEnemySpawns(battle, deltaSeconds)

    // Trước updateStatsFromModifiers() để buff phase mới áp (nếu có)

    // được recompute vào stats hiệu lực NGAY trong tick này, không

    // trễ 1 tick.

    this.updateTribulationPhases(battle)

    this.updateEnrage(battle, deltaSeconds)

    const dotStatusesBefore = this.snapshotDotStatuses(battle)

    this.updateStatsFromModifiers(
      battle,

      deltaSeconds,
    )

    this.updateAilments(
      battle,

      deltaSeconds,
    )

    this.updateLavaZones(
      battle,

      deltaSeconds,
    )

    this.updateRegen(
      battle,

      deltaSeconds,
    )

    this.updateHoaThe(
      battle,

      deltaSeconds,
    )

    this.updateKimThe(
      battle,

      deltaSeconds,
    )

    this.resolveMovement(
      battle,

      deltaSeconds,
    )

    // Emit NGAY SAU resolveMovement(), TRƯỚC updatePlayerAttack()/

    // updateEnemyAttacks() bên dưới — EventBus.emit() đồng bộ, nên

    // renderer có snapshot MỚI của tick này trước khi windup action

    // nào hoàn tất cùng tick.

    this.emitPositions(battle)

    // Timer đánh KHÔNG trừ trong lúc Choáng/Đóng Băng — "dừng nhịp"

    // thay vì mất tempo, hết khống chế đánh tiếp bình thường ngay.

    if (!this.isIncapacitated(battle.playerAilments)) {
      battle.playerAttackTimer -= deltaSeconds
    }

    for (const battleEnemy of battle.enemies) {
      if (!this.isIncapacitated(battleEnemy.ailments)) {
        battleEnemy.attackTimer -= deltaSeconds
      }
    }

    this.updateCasting(
      battle,

      deltaSeconds,
    )

    this.updatePlayerAttack(battle)

    this.updateEnemyAttacks(
      battle,

      deltaSeconds,
    )

    this.updateAutoCast(battle)

    // Combat Grid Rework — tick các impact đang windup (basic attack),

    // hết giờ thì snapshot anchor + resolve + emit action_impact.

    this.actionImpact.tick(
      battle,
      deltaSeconds,
      (battleRef, hitSource, hitTarget, hitDamage, hitOptions) => {
        return this.applyActionHit(battleRef, hitSource, hitTarget, hitDamage, hitOptions)
      },
    )

    this.emitStatusVfxDiff(battle, dotStatusesBefore)

    this.checkBattleEnd(battle)

    // Snapshot sau khi toàn bộ damage/regen/thorns/ward-break của tick đã

    // hoàn tất. Snapshot đầu tick vẫn cần cho vị trí bắt đầu windup; snapshot

    // này bảo đảm UI không bị giữ ở lượng HP của tick trước, kể cả đòn kết liễu.

    this.emitPositions(battle)
  }

  /**

   * Độ Kiếp (mục 12 spec `breakthrough`) — quái Kiếp leo thang sức

   * mạnh giữa trận qua các mốc HP (entity.tribulationPhases, sắp XUỐNG

   * DẦN theo hpThresholdPercent). Dùng while thay vì if để bắt kịp

   * TRƯỜNG HỢP 1 đòn to rớt qua nhiều mốc cùng lúc — áp hết các phase

   * đã đạt trong CÙNG 1 tick thay vì rải mỗi tick 1 phase.

   */

  private updateTribulationPhases(battle: Battle) {
    for (const battleEnemy of battle.enemies) {
      const phases = battleEnemy.entity.tribulationPhases

      if (!phases || !battleEnemy.entity.alive) {
        continue
      }

      let appliedCount = battleEnemy.appliedTribulationPhaseCount ?? 0

      const hpPercent = battleEnemy.entity.currentHp / battleEnemy.entity.maxHp

      while (
        appliedCount < phases.length &&
        hpPercent <= phases[appliedCount]!.hpThresholdPercent
      ) {
        const phase = phases[appliedCount]!

        new BuffSystem(battleEnemy.buffs).apply(phase.buff)

        // Boss Mechanics (Phase 4) — Attack Pattern: đổi hẳn archetype

        // TRỰC TIẾP (không qua Buff, archetype không phải stat).

        if (phase.archetypeOverride) {
          battleEnemy.entity.archetype = phase.archetypeOverride
        }

        // Boss Mechanics (Phase 4) — Summon: chỉ ĐẨY yêu cầu, GameManager

        // tự spawn thật (xem ghi chú Battle.pendingSummons).

        if (phase.summonEnemyIds) {
          battle.pendingSummons.push(...phase.summonEnemyIds)
        }

        appliedCount++
      }

      battleEnemy.appliedTribulationPhaseCount = appliedCount
    }
  }

  /**

   * Boss Mechanics (Phase 4) — DPS check: trận kéo dài quá

   * entity.enrage.afterSeconds thì áp buff enrage MỘT LẦN, cùng cơ chế

   * "permanent buff qua BuffSystem" như updateTribulationPhases().

   * elapsedSeconds đếm CHUNG cho cả trận (không phải riêng từng quái)

   * — enrage là DPS check của TOÀN BỘ cuộc chiến, không phải của

   * riêng 1 con quái.

   */

  private updateEnrage(battle: Battle, deltaSeconds: number) {
    battle.elapsedSeconds += deltaSeconds

    for (const battleEnemy of battle.enemies) {
      const enrage = battleEnemy.entity.enrage

      if (!enrage || battleEnemy.enrageApplied || !battleEnemy.entity.alive) {
        continue
      }

      if (battle.elapsedSeconds < enrage.afterSeconds) {
        continue
      }

      new BuffSystem(battleEnemy.buffs).apply(enrage.buff)

      battleEnemy.enrageApplied = true
    }
  }

  private isIncapacitated(ailments: AilmentManager): boolean {
    const system = new AilmentSystem(ailments)

    return system.isStunned() || system.isFrozen()
  }

  /**

   * Player là tower cố định (tower defense) — KHÔNG di chuyển, x set

   * 1 lần lúc start() rồi giữ nguyên suốt trận. Chỉ quái tiến vào:

   * con nào ngoài tầm đánh của chính nó thì tiến về phía player, dừng

   * lại đúng mép tầm đánh (không đi lố vào bên trong). Quái đang Đóng

   * Băng đứng yên tại chỗ (Choáng KHÔNG chặn di chuyển).

   */

  private resolveMovement(battle: Battle, deltaSeconds: number) {
    for (const battleEnemy of battle.enemies) {
      if (!battleEnemy.entity.alive) {
        continue
      }

      const battleEnemyAilments = new AilmentSystem(battleEnemy.ailments)

      // Thổ Tu ("Trói Chân", Plans/EarthPath mục VI) — Root chặn di

      // chuyển giống Đóng Băng nhưng KHÔNG chặn attack/cast (xem

      // isIncapacitated() — cố tình KHÔNG gộp isRooted() vào đó).

      if (battleEnemyAilments.isFrozen() || battleEnemyAilments.isRooted()) {
        continue
      }

      const distance = Math.abs(battleEnemy.entity.x - battle.player.x)

      const range = battleEnemy.entity.stats.attackRange

      // Combat Grid Rework (2026-08-24) — CHỈ được "giữ vị trí" khi đã
      // VÀO màn hình (x <= VISIBLE_MAX_COLUMN). Range đơn vị cột mới
      // thường ≥ khoảng cách spawn; không có gate này quái đứng off-screen
      // vĩnh viễn và không bên nào bắn được nhau (gate hiển thị chặn 2 chiều).
      const canHoldPosition = battleEnemy.entity.x <= VISIBLE_MAX_COLUMN

      // Core Loop Foundation checklist (Mục MONSTER) — 'ranged' thích

      // giữ khoảng cách, lùi lại nếu player áp sát quá gần thay vì

      // đứng ì hoặc tiếp tục tiến (hành vi 'melee'/không khai archetype

      // giữ NGUYÊN như cũ, không đổi gì).

      if (battleEnemy.entity.archetype === 'ranged' && canHoldPosition) {
        const preferredDistance = range * RANGED_PREFERRED_DISTANCE_RATIO

        if (distance < preferredDistance) {
          const step = Math.min(
            battleEnemy.entity.stats.movementSpeed * deltaSeconds,
            preferredDistance - distance,
          )

          battleEnemy.entity.x += battleEnemy.entity.x > battle.player.x ? step : -step

          continue
        }
      }

      if (distance > range || !canHoldPosition) {
        // Combat Grid Rework — khi còn off-screen, tiến tối thiểu 0.5 cột

        // mỗi tick cho tới khi vào màn hình, bất kể range "đủ" hay không.

        const holdDistance = canHoldPosition
          ? distance - range
          : battleEnemy.entity.x - VISIBLE_MAX_COLUMN

        const step = Math.min(
          battleEnemy.entity.stats.movementSpeed * deltaSeconds,
          Math.max(holdDistance, 0.5),
        )

        battleEnemy.entity.x += battleEnemy.entity.x > battle.player.x ? -step : step
      }
    }
  }

  private findNearestAliveEnemy(battle: Battle): CombatEntity | undefined {
    let nearest: CombatEntity | undefined

    let nearestDistance = Infinity

    for (const battleEnemy of battle.enemies) {
      if (!battleEnemy.entity.alive) {
        continue
      }

      const distance = Math.abs(battleEnemy.entity.x - battle.player.x)

      if (distance < nearestDistance) {
        nearestDistance = distance

        nearest = battleEnemy.entity
      }
    }

    return nearest
  }

  private getBuffsFor(battle: Battle, entity: CombatEntity): BuffManager {
    if (entity.id === battle.player.id) {
      return battle.playerBuffs
    }

    return (
      battle.enemies.find((battleEnemy) => battleEnemy.entity.id === entity.id)?.buffs ??
      new BuffManager()
    )
  }

  private getAilmentsFor(battle: Battle, entity: CombatEntity): AilmentManager {
    if (entity.id === battle.player.id) {
      return battle.playerAilments
    }

    return (
      battle.enemies.find((battleEnemy) => battleEnemy.entity.id === entity.id)?.ailments ??
      new AilmentManager()
    )
  }

  /**

   * Combat Grid Rework — resolve MỘT hit của action impact qua pipeline

   * đầy đủ (accuracy → realm pressure → armor/resist → crit → block →

   * endurance → ward/mana-shield → HP) + toàn bộ on-hit hooks giữ nguyên

   * hành vi cũ: roll on-hit ailment proc, Kiếm Ý/Momentum/Break theo

   * skillId, knockback đẩy target còn sống ra xa nguồn.

   */

  private applyActionHit(
    battle: Battle,

    source: CombatEntity,

    target: CombatEntity,

    damage: ActionDamageInfo,

    options: HitResolveOptions,
  ) {
    if (!target.alive || !source.alive) {
      return { landed: false }
    }

    const result = this.combat.resolveActionHit(source, target, damage, options.critical)

    // Thổ Tu (Thạch Hóa) — MỌI đòn đánh TRÚNG roll on-hit-proc đang

    // active trên target (AilmentSystem.rollOnHitEffects()).

    if (!result.dodged && target.alive) {
      new AilmentSystem(this.getAilmentsFor(battle, target)).rollOnHitEffects(
        source,
        target,
        this.ailmentRegistry,
      )
    }

    if (!result.dodged && options.skillId) {
      const skill = this.skillManager.get(options.skillId)

      if (skill?.grantsSwordIntentPerHit) {
        source.currentSwordIntent = Math.min(MAX_SWORD_INTENT, source.currentSwordIntent + 1)
      }

      if (skill?.grantsMomentumPerHit) {
        source.currentMomentum = Math.min(
          MAX_MOMENTUM,
          source.currentMomentum + skill.grantsMomentumPerHit,
        )
      }

      if (
        skill?.breakDamagePerHit &&
        target.breakGaugeMax !== undefined &&
        target.currentBreakGauge !== undefined
      ) {
        target.currentBreakGauge -= skill.breakDamagePerHit

        if (target.currentBreakGauge <= 0) {
          const targetAilments = new AilmentSystem(this.getAilmentsFor(battle, target))

          targetAilments.apply(
            this.ailmentRegistry.get('choang'),
            source,
            target,
            this.ailmentRegistry,
          )

          target.currentBreakGauge = target.breakGaugeMax
        }
      }
    }

    if (options.knockbackDistance && target.alive) {
      const direction = target.x >= source.x ? 1 : -1

      target.x += direction * options.knockbackDistance
    }

    return { landed: !result.dodged }
  }
  /**

   * Hết hạn buff/debuff của player + từng quái rồi recompute `stats`

   * hiệu lực từ `baseStats` + modifier đang active (buff THẬT + Làm

   * Chậm từ AilmentSystem.getActiveModifiers(), hoà chung 1 pool —

   * xem StatCalculator.calculateStats()) — phải chạy TRƯỚC attack

   * timer trong cùng tick để damage/heal dùng đúng buff/ailment mới

   * nhất.

   */

  private updateStatsFromModifiers(battle: Battle, deltaSeconds: number) {
    const playerBuffSystem = new BuffSystem(battle.playerBuffs)

    playerBuffSystem.update(deltaSeconds)

    const playerAilmentSystem = new AilmentSystem(battle.playerAilments)

    battle.player.stats = calculateStats(
      battle.player.baseStats,

      [...playerBuffSystem.getActiveModifiers(), ...playerAilmentSystem.getActiveModifiers()],
    )

    for (const battleEnemy of battle.enemies) {
      if (!battleEnemy.entity.alive) {
        continue
      }

      const enemyBuffSystem = new BuffSystem(battleEnemy.buffs)

      enemyBuffSystem.update(deltaSeconds)

      const enemyAilmentSystem = new AilmentSystem(battleEnemy.ailments)

      battleEnemy.entity.stats = calculateStats(
        battleEnemy.entity.baseStats,

        [...enemyBuffSystem.getActiveModifiers(), ...enemyAilmentSystem.getActiveModifiers()],
      )
    }
  }

  /**

   * Hết hạn + tick DoT cho player + từng quái — gọi NGAY SAU

   * updateStatsFromModifiers() (đã recompute stats mới nhất, DoT tính

   * theo damagePerSecond đã snapshot sẵn lúc áp dụng nên không cần

   * đọc lại stats ở đây, chỉ cần entity còn sống).

   */

  private updateAilments(battle: Battle, deltaSeconds: number) {
    // Combat Grid Rework (§3, 2026-08-24) — DOT là persistent VFX gắn
    // theo target: dedupe khoá (targetId + ailmentId), reapply = refresh,
    // hết/cleanse/chết = remove. Diff BEFORE/AFTER mỗi tick tại ĐÂY (một
    // điểm phát duy nhất cho mọi nguồn gây ailment). Resolver DoT biết
    // entity NGUỒN thật (Kim Thế penetration/Poison Recovery), sourceId
    // có thể không còn tồn tại — trả undefined an toàn.
    const resolveSource = (id: string): CombatEntity | undefined => {
      if (id === battle.player.id) {
        return battle.player
      }

      return battle.enemies.find((battleEnemy) => battleEnemy.entity.id === id)?.entity
    }

    new AilmentSystem(battle.playerAilments).update(
      deltaSeconds,
      battle.player,
      this.combat,
      this.ailmentRegistry,
      resolveSource,
    )

    for (const battleEnemy of battle.enemies) {
      if (!battleEnemy.entity.alive) {
        continue
      }

      new AilmentSystem(battleEnemy.ailments).update(
        deltaSeconds,
        battleEnemy.entity,
        this.combat,
        this.ailmentRegistry,
        resolveSource,
      )
    }
  }

  /** Snapshot trạng thái DoT toàn trận, khoá `targetId:ailmentId`. */
  private snapshotDotStatuses(
    battle: Battle,
  ): Map<string, { targetId: string; dotType: string; stacks: number; remainingTime: number }> {
    const snapshot = new Map<
      string,
      { targetId: string; dotType: string; stacks: number; remainingTime: number }
    >()

    const collect = (manager: AilmentManager, targetId: string) => {
      for (const ailment of manager.getAll()) {
        if (ailment.category !== 'dot') {
          continue
        }

        snapshot.set(`${targetId}:${ailment.id}:${ailment.sourceId}`, {
          targetId,
          dotType: ailment.id,
          stacks: ailment.stacks,
          remainingTime: ailment.remainingTime,
        })
      }
    }

    collect(battle.playerAilments, battle.player.id)

    for (const battleEnemy of battle.enemies) {
      collect(battleEnemy.ailments, battleEnemy.entity.id)
    }

    return snapshot
  }

  /** Phát status_vfx_attached/updated/removed theo diff — decay tự nhiên KHÔNG emit updated. */
  private emitStatusVfxDiff(
    battle: Battle,
    before: Map<
      string,
      { targetId: string; dotType: string; stacks: number; remainingTime: number }
    >,
  ) {
    const after = this.snapshotDotStatuses(battle)

    for (const [key, current] of after) {
      const previous = before.get(key)
      if (!previous) {
        this.eventBus.emit('status_vfx_attached', {
          type: 'status_vfx_attached',
          statusInstanceId: key,
          targetId: current.targetId,
          dotType: current.dotType,
          stacks: current.stacks,
          durationSeconds: current.remainingTime,
        })
      } else if (
        current.stacks !== previous.stacks ||
        current.remainingTime >= previous.remainingTime
      ) {
        this.eventBus.emit('status_vfx_updated', {
          type: 'status_vfx_updated',
          statusInstanceId: key,
          stacks: current.stacks,
          durationSeconds: current.remainingTime,
        })
      }
    }

    for (const [key, previous] of before) {
      if (after.has(key)) {
        continue
      }

      const alive =
        previous.targetId === battle.player.id
          ? battle.player.alive
          : (battle.enemies.find((entry) => entry.entity.id === previous.targetId)?.entity.alive ??
            false)

      this.eventBus.emit('status_vfx_removed', {
        type: 'status_vfx_removed',
        statusInstanceId: key,
        reason: alive ? 'expired' : 'target_dead',
      })
    }
  }

  /**

   * Plans/magicpathgeneral Phase 12 (2026-08-21) — Lava Zone, xem

   * LavaZone.ts. Gọi bởi Reaction (thach_hoa+bong "Dung Nham", xem

   * ReactionManager.ts) qua context truyền vào SkillEffectSystem —

   * `battle` bind sẵn ở call site (castSkill()), zone tồn tại ĐỘC LẬP

   * với entity đã kích hoạt nó sau khi spawn.

   */

  spawnLavaZone(
    battle: Battle,

    spec: {
      ownerId: string
      row: number
      column: number
      laneRadius: number
      columnRadius: number

      duration: number

      tickInterval: number

      damagePerTick: number

      element: ElementType | 'physical'
    },
  ) {
    battle.lavaZones.push({
      id: crypto.randomUUID(),

      ownerId: spec.ownerId,

      row: spec.row,

      column: spec.column,

      laneRadius: spec.laneRadius,

      columnRadius: spec.columnRadius,

      remainingTime: spec.duration,

      tickInterval: spec.tickInterval,

      timeSinceLastTick: 0,

      damagePerTick: spec.damagePerTick,

      element: spec.element,
    })
  }

  /**

   * Tick từng Lava Zone — vòng lặp `while` (không phải `if`) để bắt

   * kịp nếu 1 deltaSeconds bất thường lớn hơn tickInterval, cùng gotcha

   * đã gặp ở Kim Thế decay ([[tienhiep-kimpath-kim]]). Entity phe đối

   * lập với `zone.ownerId` đứng trong bán kính LÚC TICK đều bị trúng,

   * kể cả entity spawn sau khi zone đã tồn tại — không snapshot danh

   * sách mục tiêu lúc spawn.

   */

  private updateLavaZones(battle: Battle, deltaSeconds: number) {
    for (const zone of battle.lavaZones) {
      zone.remainingTime -= deltaSeconds

      zone.timeSinceLastTick += deltaSeconds

      while (zone.timeSinceLastTick >= zone.tickInterval) {
        zone.timeSinceLastTick -= zone.tickInterval

        this.tickLavaZone(battle, zone)
      }
    }

    battle.lavaZones = battle.lavaZones.filter((zone) => zone.remainingTime > 0)
  }

  private tickLavaZone(battle: Battle, zone: LavaZone) {
    const isPlayerOwned = zone.ownerId === battle.player.id

    const owner = isPlayerOwned
      ? battle.player
      : battle.enemies.find((battleEnemy) => battleEnemy.entity.id === zone.ownerId)?.entity

    const targets: CombatEntity[] = isPlayerOwned
      ? battle.enemies
          .filter((battleEnemy) => battleEnemy.entity.alive)
          .map((battleEnemy) => battleEnemy.entity)
      : battle.player.alive
        ? [battle.player]
        : []

    for (const target of targets) {
      const inArea =
        target.row >= zone.row - zone.laneRadius &&
        target.row <= zone.row + zone.laneRadius &&
        Math.round(target.x) >= zone.column - zone.columnRadius &&
        Math.round(target.x) <= zone.column + zone.columnRadius

      if (!inArea) {
        continue
      }

      this.combat.applyDotDamage({
        sourceId: zone.ownerId,

        source: owner,

        target,

        rawDamage: zone.damagePerTick,

        element: zone.element,

        effectId: zone.id,
      })
    }
  }

  /**

   * HP/Mana/Ward regen mỗi tick — `hpRegenPerSecond` đã có field từ

   * đợt revamp trước nhưng chưa từng được tick ở đâu (dead stat), giờ

   * chạy cùng nhịp với DoT ở trên. Chỉ entity còn sống mới regen.

   * `wardRegenPerSecond` (Pháp Tu Thổ Tu, 2026-08-15) CÙNG tình trạng

   * — thêm gate WARD_REGEN_DELAY_SECONDS (chỉ hồi sau khi không bị

   * đánh trúng đủ lâu, đúng mô tả stat sẵn có trong CharacterPanel.vue).

   */

  private updateRegen(battle: Battle, deltaSeconds: number) {
    if (battle.player.alive) {
      const playerRegen = battle.player.stats.hpRegenPerSecond * deltaSeconds

      // Bỏ qua applyHealing()/emit 'entity_vitals_changed' khi không có gì

      // để hồi — phần lớn entity không có hpRegenPerSecond, trước đây vẫn

      // emit đầy đủ payload + trigger bumpState() mỗi tick dù amount=0.

      if (playerRegen > 0) {
        this.combat.applyHealing(battle.player, playerRegen, battle.player.id, 'regen')
      }

      battle.player.currentMp = Math.min(
        battle.player.stats.maxMp,
        battle.player.currentMp + battle.player.stats.manaRegenPerSecond * deltaSeconds,
      )

      battle.player.timeSinceLastHitTaken += deltaSeconds

      if (battle.player.timeSinceLastHitTaken >= WARD_REGEN_DELAY_SECONDS) {
        battle.player.currentWard = Math.min(
          battle.player.stats.wardMax,
          battle.player.currentWard + battle.player.stats.wardRegenPerSecond * deltaSeconds,
        )
      }
    }

    for (const battleEnemy of battle.enemies) {
      if (!battleEnemy.entity.alive) {
        continue
      }

      const enemyRegen = battleEnemy.entity.stats.hpRegenPerSecond * deltaSeconds

      if (enemyRegen > 0) {
        this.combat.applyHealing(battleEnemy.entity, enemyRegen, battleEnemy.entity.id, 'regen')
      }

      battleEnemy.entity.currentMp = Math.min(
        battleEnemy.entity.stats.maxMp,
        battleEnemy.entity.currentMp + battleEnemy.entity.stats.manaRegenPerSecond * deltaSeconds,
      )

      battleEnemy.entity.timeSinceLastHitTaken += deltaSeconds

      if (battleEnemy.entity.timeSinceLastHitTaken >= WARD_REGEN_DELAY_SECONDS) {
        battleEnemy.entity.currentWard = Math.min(
          battleEnemy.entity.stats.wardMax,
          battleEnemy.entity.currentWard +
            battleEnemy.entity.stats.wardRegenPerSecond * deltaSeconds,
        )
      }
    }
  }

  /**

   * Hỏa Tu Pure (Plans/FirePath mục 7, 2026-08-21) — Hỏa Thế TỰ GIẢM

   * mỗi giây (chỉ player, quái không bao giờ tích được nên decay của

   * chúng luôn là no-op). Gain thật sự xảy ra ở castSkill()

   * (Skill.grantsHoaThePerCast) — hàm này CHỈ lo chiều giảm.

   */

  private updateHoaThe(battle: Battle, deltaSeconds: number) {
    if (battle.player.currentHoaThe <= 0) {
      return
    }

    const decayPerSecond =
      HOA_THE_BASE_DECAY_PER_SECOND *
      (1 - getSkillRuntimeStat(battle.player, 'hoaTheDecayReductionPercent'))

    battle.player.currentHoaThe = Math.max(
      0,
      battle.player.currentHoaThe - decayPerSecond * deltaSeconds,
    )
  }

  /**

   * Kim Tu Trúc Cơ Pure (Plans/KimPath mục 12, 2026-08-21) — Kim Thế

   * decay CHẬM và RỜI RẠC (khác Hỏa Thế's continuous per-second): 1

   * tầng mỗi KIM_THE_DECAY_INTERVAL_SECONDS giây KHÔNG proc Xuất Huyết

   * mới (reset về 0 trong SkillEffectSystem.ts's apply() mỗi lần proc

   * thành công). `while` (không phải `if`) để bù đúng số tầng nếu

   * deltaSeconds 1 tick > 1 interval (vd tab ẩn lâu rồi quay lại).

   */

  private updateKimThe(battle: Battle, deltaSeconds: number) {
    if (battle.player.currentKimThe <= 0) {
      return
    }

    battle.player.timeSinceLastBleedProc += deltaSeconds

    while (
      battle.player.timeSinceLastBleedProc >= KIM_THE_DECAY_INTERVAL_SECONDS &&
      battle.player.currentKimThe > 0
    ) {
      battle.player.currentKimThe -= 1

      battle.player.timeSinceLastBleedProc -= KIM_THE_DECAY_INTERVAL_SECONDS
    }
  }

  private updatePlayerAttack(battle: Battle) {
    if (battle.playerAttackTimer > 0) {
      return
    }

    if (this.isIncapacitated(battle.playerAilments)) {
      return
    }

    // PLAN HOÀN CHỈNH mục 6/8 — skill isBasicAttack equipped thay thế

    // đòn đánh cứng (thay getEquippedInCategory('basic') cũ). Skill

    // tree redesign (2026-08-21) — Pháp Tu KHÔNG còn skill nào flag

    // isBasicAttack (Hỏa Cầu Thuật giờ là root node/skill Loadout bình

    // thường, xem Skills.ts), nên basicSkill luôn undefined cho path

    // này — return SỚM, KHÔNG rơi xuống fallback vật lý bên dưới (đó

    // là hành vi vật lý-thuần dành cho Phàm Nhân/Kiếm Tu's Trảm/Ngự

    // Kiếm, không hợp lý cho hệ phái thuật). Toàn bộ sát thương Pháp Tu

    // đến từ updateAutoCast()'s Loadout rotation.

    const basicSkill = this.skillManager.getBasicAttackSkill()

    if (!basicSkill) {
      return
    }

    const basicTargeting = targetingForSkill(basicSkill)
    const target =
      selectPrimaryTarget(battle, battle.player, {
        ...basicTargeting,
        rangeColumns: Math.min(basicTargeting.rangeColumns, battle.player.stats.attackRange),
      }) ?? undefined

    // Chưa có quái nào trong tầm (hoặc chưa quái nào sống) — không

    // tốn nhịp timer, để đánh được NGAY khi vừa vào tầm thay vì phải

    // chờ hết 1 interval trọn vẹn. `target.x > VISIBLE_MAX_COLUMN`

    // (2026-08-22) — attackRange world-unit "vô hạn" của player

    // (PLAYER_ATTACK_RANGE_INFINITE, xem StatBlock.ts) KHÔNG còn nghĩa

    // là bắn trúng bất kỳ đâu nữa: phải THẤY quái mới bắn được, dù

    // stat range có lớn cỡ nào.

    if (
      !target ||
      Math.abs(target.x - battle.player.x) > battle.player.stats.attackRange ||
      target.x > VISIBLE_MAX_COLUMN
    ) {
      return
    }

    const attackSpeed = battle.player.stats.attackSpeed

    const interval = getAttackIntervalSeconds(attackSpeed)

    battle.playerAttackTimer = interval

    if (this.skillSystem.canUse(basicSkill.id, battle.player)) {
      this.castSkill(basicSkill, battle.player, target, battle)

      return
    }

    // Combat Grid Rework — đòn thường = 1 action impact có windup ngắn

    // (không còn projectile bay); preset 'slash' tại ô primary target.

    this.actionImpact.scheduleBasic({
      actionId: basicSkill.id,

      sourceId: battle.player.id,

      targetId: target.id,

      damage: { kind: 'physical', multiplier: 1 },

      skillId: basicSkill.id,

      presetId: 'slash',

      windupSeconds: PLAYER_BASIC_WINDUP_SECONDS,
    })
  }

  /**

   * PLAN HOÀN CHỈNH mục 8/12 — mỗi tick thử cast theo ĐÚNG thứ tự

   * Skill Loadout (slot 0→4, thay AUTO_CAST_PRIORITY theo category cố

   * định cũ — giờ thứ tự ưu tiên do CHÍNH người chơi quyết định lúc

   * set Loadout, không còn cố định basic/special/moving/ultimate).

   * Skill nào canUse() (đủ cooldown + mana/rage) thì cast rồi dừng,

   * không cast nhiều skill cùng 1 tick. getLoadoutSkills() đã tự loại

   * isBasicAttack (chạy theo attackSpeed timer riêng, xem

   * updatePlayerAttack()). Nhắm quái GẦN NHẤT còn sống (không phải

   * skill nào cũng cần trong tầm — xem quyết định thiết kế trong kế

   * hoạch: skill KHÔNG bị gate theo khoảng cách ở bản này).

   */

  private updateAutoCast(battle: Battle) {
    if (this.isIncapacitated(battle.playerAilments)) {
      return
    }

    // Cast Time (2026-08-21) — đang niệm dở 1 skill khác thì KHÔNG chọn

    // skill mới (updateCasting() sẽ tự resolve khi niệm xong), xem

    // beginCast().

    if (battle.player.castingSkillId) {
      return
    }

    for (const { skill, slotIndex } of this.skillManager.getLoadoutEntries()) {
      if (!this.skillSystem.canUseInSlot(skill.id, slotIndex, battle.player)) {
        continue
      }

      const primary = selectPrimaryTarget(battle, battle.player, targetingForSkill(skill))

      if (!primary) {
        continue
      }

      const target = skill.target === 'self' ? battle.player : primary

      this.beginCast(skill, battle.player, target, battle, slotIndex)

      break
    }
  }

  /**

   * Cast Time (2026-08-21) — cầu nối giữa "chọn skill để cast" (updateAutoCast())

   * và "hiệu ứng thi triển thật" (resolveSkillEffects()). Skill.castTime

   * undefined/0 (MỌI skill hiện có) = cast tức thời, hành vi Y HỆT

   * trước đây (use() rồi resolve NGAY). castTime > 0 thì use() NGAY

   * (tốn cooldown/resource tại thời điểm BẮT ĐẦU niệm, đúng quy ước

   * MMO chuẩn) nhưng hoãn resolveSkillEffects() tới khi updateCasting()

   * đếm castTimeRemaining về 0 — xem CombatEntity.castingSkillId.

   */

  private beginCast(
    skill: Skill,
    source: CombatEntity,
    target: CombatEntity,
    battle: Battle,
    slotIndex?: number,
  ) {
    const castTime = skill.castTime ?? 0

    if (castTime <= 0) {
      this.castSkill(skill, source, target, battle, slotIndex)

      return
    }

    if (slotIndex === undefined) this.skillSystem.use(skill.id, source)
    else this.skillSystem.useInSlot(skill.id, slotIndex, source)

    source.castingSkillId = skill.id

    source.castTimeRemaining = castTime

    source.castTimeTotal = castTime

    // MainScene/CombatScene vẽ cast bar + nảy tên skill qua event này —

    // xem CombatScene.ts's onCastStart(). skillName gửi kèm THẲNG (thay

    // vì chỉ skillId) vì CombatScene chỉ giao tiếp qua EventBus, không

    // cầm tham chiếu skillManager để tự tra tên (đúng nguyên tắc "core ↔

    // Phaser CHỈ giao tiếp qua EventBus" đã ghi ở đầu CombatScene.ts).

    this.eventBus.emit('cast_start', {
      type: 'cast_start',

      sourceId: source.id,

      skillId: skill.id,

      skillName: skill.name,

      castTimeSeconds: castTime,
    })
  }

  /**

   * Cast Time — tick castTimeRemaining mỗi frame, resolve hiệu ứng thật

   * khi về 0. CHỈ player dùng cơ chế Skill-based casting (enemy có

   * telegraph riêng, xem battleEnemy.castTimer ở updateEnemyAttacks() —

   * KHÁC hẳn, không đi qua Skill Loadout).

   */

  private updateCasting(battle: Battle, deltaSeconds: number) {
    const player = battle.player

    if (!player.castingSkillId || player.castTimeRemaining === undefined) {
      return
    }

    // Timer đúc KHÔNG trừ trong lúc Choáng/Đóng Băng — "dừng nhịp" giống

    // playerAttackTimer, KHÔNG huỷ cast đang dở.

    if (this.isIncapacitated(battle.playerAilments)) {
      return
    }

    player.castTimeRemaining -=
      deltaSeconds * (1 + Math.min(3, Math.max(0, player.stats.castSpeedPercent)))

    if (player.castTimeRemaining > 0) {
      return
    }

    const skillId = player.castingSkillId

    player.castingSkillId = undefined

    player.castTimeRemaining = undefined

    player.castTimeTotal = undefined

    const skill = this.skillManager.get(skillId)

    if (!skill) {
      return
    }

    const primary = selectPrimaryTarget(battle, player, targetingForSkill(skill))
    const target = skill.target === 'self' ? (primary ? player : undefined) : (primary ?? undefined)

    if (!target || !target.alive) {
      return
    }

    // MainScene/CombatScene ẩn cast bar qua event này — xem

    // CombatScene.ts's onCastComplete().

    this.eventBus.emit('cast_complete', {
      type: 'cast_complete',

      sourceId: player.id,

      skillId: skill.id,
    })

    this.resolveSkillEffects(skill, player, target, battle)
  }

  private castSkill(
    skill: Skill,
    source: CombatEntity,
    target: CombatEntity,
    battle: Battle,
    slotIndex?: number,
  ) {
    if (slotIndex === undefined) this.skillSystem.use(skill.id, source)
    else this.skillSystem.useInSlot(skill.id, slotIndex, source)

    this.resolveSkillEffects(skill, source, target, battle)
  }

  /**

   * Phần "hiệu ứng thật" của 1 lần cast — TÁCH khỏi castSkill() (Cast

   * Time, 2026-08-21) để beginCast()/updateCasting() dùng chung: skill

   * castTime=0 gọi NGAY qua castSkill(), skill castTime>0 gọi hàm này

   * SAU khi đếm ngược xong (use() đã chạy từ lúc beginCast(), KHÔNG gọi

   * lại ở đây để tránh trừ cooldown/resource 2 lần).

   */

  private resolveSkillEffects(
    skill: Skill,
    source: CombatEntity,
    target: CombatEntity,
    battle: Battle,
  ) {
    // Hỏa Tu Pure (Plans/FirePath mục 7) — 0 nếu chưa mua "Tụ Hỏa"

    // (hoaTheGainPerCast nền = 0), cùng hook "gain theo CAST" như Kiếm

    // Ý/Momentum nhưng ở đây thay vì missile-resolve callback (đó là

    // "theo ĐÒN TRÚNG") vì Hỏa Thế tích theo LƯỢT DÙNG SKILL, xem

    // FirePath.md mục 7.

    if (skill.grantsHoaThePerCast) {
      source.currentHoaThe = Math.min(
        MAX_HOA_THE,
        source.currentHoaThe + getSkillRuntimeStat(source, 'hoaTheGainPerCast'),
      )
    }

    // Thổ Tu Pure (Plans/EarthPath mục XV, 2026-08-21) — cùng hook

    // "gain theo CAST" như Hỏa Thế, nhưng KHÔNG có decay đối ứng (doc

    // không nhắc tới, xem CombatEntity.currentThoThe's ghi chú).

    if (skill.grantsThoThePerCast) {
      source.currentThoThe = Math.min(
        MAX_THO_THE,
        source.currentThoThe + getSkillRuntimeStat(source, 'thoTheGainPerCast'),
      )
    }

    // Nguồn duy nhất emit 'cast' — PassiveSystem dùng event này cho

    // passive có trigger 'cast'.

    this.eventBus.emit('cast', {
      type: 'cast',

      sourceId: source.id,

      targetId: target.id,

      skillId: skill.id,

      skillName: skill.name,
    })

    const sourceBuffs = new BuffSystem(this.getBuffsFor(battle, source))

    // Đọc qua getEffectiveSkill() để tôn trọng Specialization đã

    // chọn (behavior-changing node) + effect 'damage' đã scale theo

    // level hiện tại.

    const effective = this.skillSystem.getEffectiveSkill(skill, source.skillLevels?.[skill.id])

    // Combat Grid Rework — MỘT action = MỘT impact VFX: mở batch trước

    // vòng lặp, đóng sau; mọi fireHit trong lúc đó đăng ký target vào

    // cùng event action_impact neo tại ô PRIMARY target.

    const earthPureActive =
      effective.effects.some((effect) => effect.earthPureAreaBehavior === true) &&
      getSkillRuntimeStat(source, 'earthAoeRadius') > 0

    const baseTargeting = targetingForSkill(skill)
    const laneRadius = earthPureActive
      ? Math.max(1, Math.round(getSkillRuntimeStat(source, 'earthAoeRadius')))
      : (baseTargeting.laneRadius ?? 0)
    const columnRadius = earthPureActive ? laneRadius : (baseTargeting.columnRadius ?? 0)
    const targeting = earthPureActive
      ? { ...baseTargeting, shape: 'area' as const, laneRadius, columnRadius }
      : baseTargeting
    const anchorCell = worldToGridPosition(target.x, target.row + 0.5)
    const affectedArea = areaFor(target.row, anchorCell.column, targeting)

    if (!affectedArea) {
      return
    }

    this.actionImpact.beginSkillBatch({
      actionId: skill.id,

      sourceId: source.id,

      primaryTargetId: target.id,

      presetId: vfxPresetForSkill(skill),

      anchorCell,
      area: { ...affectedArea, shape: targeting.shape },
      hitCount: effective.effects.some((effect) => effect.hitCountByRealm)
        ? source.realmIndex + 1
        : 1,

      secondaryPercent: earthPureActive
        ? getSkillRuntimeStat(source, 'earthAoeSecondaryDamagePercent')
        : undefined,

      knockbackDistance: earthPureActive
        ? getSkillRuntimeStat(source, 'earthKnockbackDistance')
        : undefined,
    })

    const targets =
      skill.target === 'self'
        ? [source]
        : collectAffected(battle, source, target.id, target.row, anchorCell.column, targeting)

    const applyEffects = (effects: SkillEffect[], oneTarget: CombatEntity) => {
      let landedHit = false
      const targetBuffs = new BuffSystem(this.getBuffsFor(battle, oneTarget))

      const targetAilments = new AilmentSystem(this.getAilmentsFor(battle, oneTarget))

      this.skillEffectSystem.applyAll(effects, source, oneTarget, {
        combatSystem: this.combat,
        fireHit: (hitTarget, damageInfo) => {
          const result = this.actionImpact.fireSkillHit(
            battle,

            source,

            hitTarget,

            damageInfo,

            { skillId: skill.id },

            (battleRef, hitSource, hitTargetEntity, hitDamage, hitOptions) => {
              return this.applyActionHit(
                battleRef,
                hitSource,
                hitTargetEntity,
                hitDamage,
                hitOptions,
              )
            },
          )

          landedHit ||= result.landed
          return result
        },
        didLandHit: () => landedHit,
        buffRegistry: this.buffRegistry,

        ailmentRegistry: this.ailmentRegistry,

        sourceBuffs,

        targetBuffs,

        targetAilments,

        reactionManager: this.reactionManager,

        spawnLavaZone: (spec) => this.spawnLavaZone(battle, spec),

        skillId: skill.id,
      })
    }

    const sourceEffects = effective.effects.filter((effect) => scopeForEffect(effect) === 'source')
    const primaryEffects = effective.effects.filter(
      (effect) => scopeForEffect(effect) === 'primary_target',
    )
    const areaEffects = effective.effects.filter(
      (effect) => scopeForEffect(effect) === 'affected_targets',
    )

    if (sourceEffects.length > 0) {
      applyEffects(sourceEffects, source)
    }

    if (primaryEffects.length > 0) {
      applyEffects(primaryEffects, target)
    }

    for (const oneTarget of targets) {
      applyEffects(areaEffects, oneTarget)
    }

    this.actionImpact.endSkillBatch(battle)
  }

  private updateEnemyAttacks(
    battle: Battle,

    deltaSeconds: number,
  ) {
    if (!battle.player.alive) {
      return
    }

    for (const battleEnemy of battle.enemies) {
      if (!battleEnemy.entity.alive) {
        continue
      }

      if (this.isIncapacitated(battleEnemy.ailments)) {
        continue
      }

      // Core Loop Foundation checklist (Mục MONSTER) — 'caster' đang

      // trong khoảng lặng telegraph, đếm ngược riêng, KHÔNG đụng

      // attackTimer cho tới khi bắn xong.

      if (battleEnemy.castTimer !== undefined) {
        battleEnemy.castTimer -= deltaSeconds

        if (battleEnemy.castTimer > 0) {
          continue
        }

        battleEnemy.castTimer = undefined

        this.fireEnemyAttack(battleEnemy, battle)

        continue
      }

      if (battleEnemy.attackTimer > 0) {
        continue
      }

      const distance = Math.abs(battleEnemy.entity.x - battle.player.x)

      // Ngoài tầm — không tốn nhịp timer, giống lý do ở updatePlayerAttack().

      // target.x > VISIBLE_MAX_COLUMN (2026-08-22) — mob/boss cũng

      // không được tấn công trong lúc còn off-screen, kể cả loại

      // 'ranged'/'caster' có attackRange đủ xa để lý thuyết chạm tới.

      if (
        distance > battleEnemy.entity.stats.attackRange ||
        battleEnemy.entity.x > VISIBLE_MAX_COLUMN
      ) {
        continue
      }

      if (battleEnemy.entity.archetype === 'caster') {
        // Bắt đầu telegraph thay vì bắn ngay — attackTimer CHƯA reset

        // (làm ở nhánh trên khi khoảng lặng kết thúc), tránh 2 lần

        // trừ tempo cho cùng 1 đòn.

        battleEnemy.castTimer = CASTER_CAST_DELAY_SECONDS

        continue
      }

      this.fireEnemyAttack(battleEnemy, battle)
    }
  }

  private fireEnemyAttack(battleEnemy: Battle['enemies'][number], battle: Battle) {
    const attackSpeed = battleEnemy.entity.stats.attackSpeed

    battleEnemy.attackTimer = getAttackIntervalSeconds(attackSpeed)

    // Combat Grid Rework — enemy attack cũng là action impact: ranged

    // "bắn phép" = impact TẠI target (không vật thể bay), windup dài hơn.

    const isRanged =
      battleEnemy.entity.archetype === 'ranged' || battleEnemy.entity.archetype === 'caster'

    this.actionImpact.scheduleBasic({
      actionId: `${battleEnemy.entity.id}:basic`,

      sourceId: battleEnemy.entity.id,

      targetId: battle.player.id,

      damage: { kind: 'physical', multiplier: 1 },

      presetId:
        battleEnemy.entity.archetype === 'caster'
          ? 'arcane_impact'
          : isRanged
            ? 'arcane_impact'
            : 'claw',

      windupSeconds:
        battleEnemy.entity.archetype === 'caster' || isRanged
          ? ENEMY_RANGED_WINDUP_SECONDS
          : ENEMY_MELEE_WINDUP_SECONDS,
    })
  }

  /**

   * CHỈ quyết 'defeat' (player chết) — 'victory' giờ do GameManager

   * quyết (cần biết tiến độ Stage: đã spawn đủ + hết quái sống chưa,

   * thứ BattleSystem không nên biết, xem GameManager.updateStageProgress()).

   */

  private checkBattleEnd(battle: Battle) {
    if (!battle.player.alive) {
      battle.state = 'defeat'

      // Chỉ chạy tới đây đúng 1 lần — update() early-return ngay từ

      // đầu khi battle.state !== 'fighting' ở tick kế, nên khỏi cần

      // cờ chống emit lặp.

      this.eventBus.emit('battle_end', { type: 'battle_end', state: 'defeat' })
    }
  }

  stop() {
    this.actionImpact.clear()

    this.battle = null
  }
}
