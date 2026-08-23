import type { Battle, BattleEnemy } from './Battle'

import type {
  CombatSystem,
} from '../combat/CombatSystem'

import { BuffManager } from '../buff/BuffManager'
import { BuffSystem } from '../buff/BuffSystem'
import type { BuffRegistry } from '../buff/BuffRegistry'
import { AilmentManager } from '../ailment/AilmentManager'
import { AilmentSystem } from '../ailment/AilmentSystem'
import type { AilmentRegistry } from '../ailment/AilmentRegistry'
import { calculateStats } from '../stats/StatCalculator'

import type { SkillManager } from '../skill/SkillManager'
import type { SkillSystem } from '../skill/SkillSystem'
import { ACTIVE_SKILL_XP_PER_CAST } from '../skill/SkillSystem'
import type { SkillEffectSystem } from '../skill/SkillEffectSystem'
import type { Skill } from '../skill/Skill'
import { getSkillRuntimeStat } from '../skill/SkillRuntimeStats'
import type { CombatEntity } from '../combat/CombatEntity'
import type { EventBus } from '../events/EventBus'
import type { MissileSystem, MissileTarget } from '../combat/missile/MissileSystem'
import { ReactionManager } from '../element/ReactionManager'
import { HERO_HOME_X, ENEMY_SPAWN_X, SCREEN_VISIBLE_MAX_X } from './BattleLane'
import { MAX_SWORD_INTENT, MAX_MOMENTUM, MAX_HOA_THE, MAX_THO_THE, KIM_THE_DECAY_INTERVAL_SECONDS } from '../combat/CombatTypes'
import type { MissileDamageInfo } from '../combat/missile/Missile'
import type { BattlePositionsEvent } from './BattleEvents'
import type { LavaZone } from './LavaZone'
import type { ElementType } from '../element/ElementType'

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
    private readonly missileSystem: MissileSystem,
  ) {
    this.reactionManager = new ReactionManager(eventBus)

    // Uncommitted audit followup plan, mục "Projectile phải có authority
    // ở core" (2026-08-24) — trước đây CombatScene.create() emit
    // 'projectile_collision_ready:{enabled:true}' tắt hẳn
    // resolveMissilesHeadless() bên dưới (update()), khiến sát thương
    // missile phụ thuộc HOÀN TOÀN vào Phaser tự phát 'projectile_impact'
    // qua physics.overlap() mỗi frame render — scene shutdown/FPS thấp/
    // không có renderer (test headless, Electron chạy nền) thì combat
    // ĐỨNG YÊN vĩnh viễn vì damage không bao giờ tự xảy ra. Core giờ LUÔN
    // tự cập nhật vị trí/retarget/quyết định impact qua
    // resolveMissilesHeadless() mỗi bước, không điều kiện. 'projectile_impact'
    // do Phaser phát (nếu có renderer) chỉ còn là đường tắt hiển thị —
    // impact()/resolveArrival() đã idempotent (missile đã bị remove thì
    // gọi lại là no-op, xem MissileSystem.impact()), nên 2 nguồn cùng tồn
    // tại KHÔNG áp damage 2 lần.
    this.eventBus.on<{ projectileId: string; targetId: string }>('projectile_impact', event => {
      const battle = this.battle

      if (battle?.state === 'fighting') {
        this.resolveMissileImpact(battle, event.projectileId, event.targetId)
      }
    })
  }

  start(
    player: CombatEntity,
    firstEnemy: CombatEntity,
  ) {
    this.missileSystem.clear()
    player.x = HERO_HOME_X
    firstEnemy.x = ENEMY_SPAWN_X

    this.battle = {
      id: crypto.randomUUID(),

      player,

      enemies: [this.createBattleEnemy(firstEnemy)],

      state: 'countdown',

      countdownSecondsRemaining: BATTLE_COUNTDOWN_SECONDS,

      playerAttackTimer: 0,

      playerBuffs: new BuffManager(),

      playerAilments: new AilmentManager(),

      elapsedSeconds: 0,

      pendingSummons: [],

      lavaZones: [],
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
    this.missileSystem.clear()
    player.x = (HERO_HOME_X + SCREEN_VISIBLE_MAX_X) / 2
    this.battle = {
      id: crypto.randomUUID(), player, enemies: [], state: 'fighting', mode: 'tribulation',
      playerAttackTimer: 0, playerBuffs: new BuffManager(), playerAilments: new AilmentManager(),
      elapsedSeconds: 0, pendingSummons: [], lavaZones: [],
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
    newEnemy.x = ENEMY_SPAWN_X

    battle.enemies.push(this.createBattleEnemy(newEnemy))

    this.eventBus.emit('enemy_spawned', { type: 'enemy_spawned', targetId: newEnemy.id })

    // Quái mới có vị trí ngay, khỏi đợi tick kế tiếp mới xuất hiện.
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
        .filter(battleEnemy => battleEnemy.entity.alive)
        .map(battleEnemy => ({
          id: battleEnemy.entity.id,
          name: battleEnemy.entity.name,
          x: battleEnemy.entity.x,
          lane: battleEnemy.entity.lane,
          currentHp: battleEnemy.entity.currentHp,
          maxHp: battleEnemy.entity.maxHp,
          isBoss: battleEnemy.entity.isBoss ?? false,
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
    const battle =
      this.battle

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
      battle.countdownSecondsRemaining = Math.max(0, (battle.countdownSecondsRemaining ?? 0) - deltaSeconds)

      this.emitPositions(battle)

      if (battle.countdownSecondsRemaining <= 0) {
        battle.state = 'fighting'
      }

      return
    }

    if (
      battle.state !== 'fighting'
    ) {
      return
    }

    // Trước updateStatsFromModifiers() để buff phase mới áp (nếu có)
    // được recompute vào stats hiệu lực NGAY trong tick này, không
    // trễ 1 tick.
    this.updateTribulationPhases(battle)

    this.updateEnrage(battle, deltaSeconds)

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

    // Homing retarget-on-death (2026-08-22) — quét SỚM, trước
    // resolveMissilesHeadless() ở cuối update() (xem dưới), để 1 missile
    // vừa mất mục tiêu ở tick TRƯỚC được retarget/dọn NGAY từ đầu tick
    // này — retarget trong tick này nhờ vậy phản ánh đúng trong snapshot
    // emitPositions() gửi Phaser, không phải đợi thêm 1 tick nữa.
    this.missileSystem.pruneDeadTargets(sourceId => this.getMissileTargets(battle, sourceId))

    // Emit NGAY SAU resolveMovement(), TRƯỚC updatePlayerAttack()/
    // updateEnemyAttacks() bên dưới — EventBus.emit() đồng bộ, nên
    // MainScene đã có snapshot MỚI của tick này trước khi 'attack'
    // (bắn missile) có thể fire cùng tick, missile xuất phát đúng vị
    // trí hiện tại thay vì vị trí tick trước.
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

    this.updatePlayerAttack(
      battle,
    )

    this.updateEnemyAttacks(
      battle,
      deltaSeconds,
    )

    this.updateAutoCast(
      battle,
    )

    // Core luôn tự cập nhật vị trí/retarget/impact projectile — không còn
    // phụ thuộc Phaser gọi 'projectile_impact' (xem ghi chú ở constructor).
    this.resolveMissilesHeadless(battle, deltaSeconds)

    this.checkBattleEnd(
      battle,
    )

    // Snapshot sau khi toàn bộ damage/regen/thorns/ward-break của tick đã
    // hoàn tất. Snapshot đầu tick vẫn cần cho vị trí bắn missile; snapshot
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

      while (appliedCount < phases.length && hpPercent <= phases[appliedCount]!.hpThresholdPercent) {
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

      // Core Loop Foundation checklist (Mục MONSTER) — 'ranged' thích
      // giữ khoảng cách, lùi lại nếu player áp sát quá gần thay vì
      // đứng ì hoặc tiếp tục tiến (hành vi 'melee'/không khai archetype
      // giữ NGUYÊN như cũ, không đổi gì).
      if (battleEnemy.entity.archetype === 'ranged') {
        const preferredDistance = range * RANGED_PREFERRED_DISTANCE_RATIO

        if (distance < preferredDistance) {
          const step = Math.min(battleEnemy.entity.stats.movementSpeed * deltaSeconds, preferredDistance - distance)

          battleEnemy.entity.x += battleEnemy.entity.x > battle.player.x ? step : -step

          continue
        }
      }

      if (distance > range) {
        const step = Math.min(battleEnemy.entity.stats.movementSpeed * deltaSeconds, distance - range)

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

    return battle.enemies.find(battleEnemy => battleEnemy.entity.id === entity.id)?.buffs
      ?? new BuffManager()
  }

  private getAilmentsFor(battle: Battle, entity: CombatEntity): AilmentManager {
    if (entity.id === battle.player.id) {
      return battle.playerAilments
    }

    return battle.enemies.find(battleEnemy => battleEnemy.entity.id === entity.id)?.ailments
      ?? new AilmentManager()
  }

  /**
   * Di chuyển toàn bộ missile đang bay của trận này + áp damage cho
   * con nào vừa chạm đích — xem MissileSystem.update(). Đặt cuối
   * update() (sau khi timer/skill có thể vừa bắn thêm missile mới
   * trong CHÍNH tick này) để 1 tick chỉ tính di chuyển 1 lần, tránh
   * missile vừa bắn đã bay luôn trong tick nó sinh ra.
   */
  private resolveMissileImpact(battle: Battle, projectileId: string, collisionTargetId: string) {
    const getTargets = (sourceId: string) => this.getMissileTargets(battle, sourceId)

    this.missileSystem.impact(projectileId, collisionTargetId, getTargets, (missile, targetId, isPrimary) => {
      this.applyResolvedMissileHit(battle, missile, targetId, isPrimary)
    })
  }

  // Pierce/Bounce/AOE (Phase 3) + homing retarget-on-death cần biết
  // TOÀN BỘ mục tiêu khả dụng của phe đối lập với nguồn bắn, không chỉ
  // đúng 1 targetId ban đầu — missile của player nhắm được MỌI quái
  // còn sống, missile của quái chỉ có đúng 1 mục tiêu khả dĩ (player).
  // Dùng chung bởi resolveMissileImpact()/resolveMissilesHeadless()/
  // pruneDeadTargets() thay vì 3 closure gần giống hệt nhau.
  private getMissileTargets(battle: Battle, sourceId: string): MissileTarget[] {
    if (sourceId === battle.player.id) {
      return battle.enemies
        .filter(battleEnemy => battleEnemy.entity.alive)
        .map(battleEnemy => ({ id: battleEnemy.entity.id, x: battleEnemy.entity.x }))
    }

    return battle.player.alive ? [{ id: battle.player.id, x: battle.player.x }] : []
  }

  private applyResolvedMissileHit(battle: Battle, missile: import('../combat/missile/Missile').Missile, targetId: string, isPrimary: boolean) {
      const source = missile.sourceId === battle.player.id
        ? battle.player
        : battle.enemies.find(enemy => enemy.entity.id === missile.sourceId)?.entity
      const target = targetId === battle.player.id
        ? battle.player
        : battle.enemies.find(enemy => enemy.entity.id === targetId)?.entity

      if (!source || !target || !target.alive) {
        return
      }

      // Thổ Tu Pure (Plans/EarthPath mục XVI, 2026-08-21) — mục tiêu
      // PHỤ (trúng qua behavior.aoeRadius, isPrimary=false) chịu
      // earthAoeSecondaryDamagePercent thay vì 100% như mục tiêu
      // chính. undefined = hành vi cũ (mọi mục tiêu AOE ăn full damage,
      // xem Combat Rework Phase 3's aoeRadius gốc — vẫn giữ nguyên cho
      // skill nào chưa khai field mới này).
      const damage =
        !isPrimary && missile.behavior?.aoeSecondaryDamagePercent !== undefined
          ? this.scaleMissileDamage(missile.damage, missile.behavior.aoeSecondaryDamagePercent)
          : missile.damage

      const result = this.combat.resolveMissileHit(source, target, damage, missile.critical)

      // Thổ Tu (Thạch Hóa, Plans/magicpathgeneral, 2026-08-21) — MỌI
      // đòn đánh TRÚNG (không dodged) lên 1 target CÒN SỐNG roll các
      // ailment on-hit-proc ĐANG active trên target đó (xem
      // AilmentSystem.rollOnHitEffects() — field tổng quát, không
      // riêng gì Thạch Hóa). Đặt TRƯỚC mọi hook khác dưới đây vì độc
      // lập hoàn toàn (không phụ thuộc skillId/breakGauge).
      if (!result.dodged && target.alive) {
        new AilmentSystem(this.getAilmentsFor(battle, target)).rollOnHitEffects(source, target, this.ailmentRegistry)
      }

      // Kiếm Tu (Ngự Kiếm Thuật, 2026-08-15) — mỗi kiếm ĐÁNH TRÚNG
      // (không tính né) +1 Kiếm Ý chiến đấu. Tra qua skillManager thay
      // vì hardcode id skill ở đây — engine chung, KHÔNG cần biết về
      // "Kiếm Tu" cụ thể, chỉ đọc field generic Skill.grantsSwordIntentPerHit.
      // Mỗi mục tiêu Pierce/Bounce/AOE trúng riêng cũng tự tích, đúng
      // tinh thần "1 kiếm/1 lần trúng" của skill gốc.
      if (!result.dodged && missile.skillId) {
        const skill = this.skillManager.get(missile.skillId)

        if (skill?.grantsSwordIntentPerHit) {
          source.currentSwordIntent = Math.min(MAX_SWORD_INTENT, source.currentSwordIntent + 1)
        }

        // Thể Tu (Combat Rework Phase 7) — Momentum tích theo LƯỢNG
        // (khác Kiếm Ý cố định +1/đòn), cùng hook missile-resolve.
        if (skill?.grantsMomentumPerHit) {
          source.currentMomentum = Math.min(MAX_MOMENTUM, source.currentMomentum + skill.grantsMomentumPerHit)
        }

        // Thể Tu — Break: trừ thẳng currentBreakGauge (KHÔNG qua Damage
        // Engine, cùng tinh thần Detonate), chỉ áp dụng nếu target THẬT
        // SỰ có Break (breakGaugeMax khai — boss/quái lớn). Chạm 0 thì
        // Stagger (tái dùng ailment 'choang' có sẵn) rồi reset đầy lại
        // để Break là cơ chế LẶP LẠI được trong 1 trận, không chỉ 1 lần.
        if (skill?.breakDamagePerHit && target.breakGaugeMax !== undefined && target.currentBreakGauge !== undefined) {
          target.currentBreakGauge -= skill.breakDamagePerHit

          if (target.currentBreakGauge <= 0) {
            const targetAilments = new AilmentSystem(this.getAilmentsFor(battle, target))

            targetAilments.apply(this.ailmentRegistry.get('choang'), source, target, this.ailmentRegistry)

            target.currentBreakGauge = target.breakGaugeMax
          }
        }
      }

      // Thổ Tu Pure (Plans/EarthPath mục XVI) — Knockback: đẩy target
      // CÒN SỐNG (không đẩy xác chết) ra XA nguồn bắn, áp cho MỌI mục
      // tiêu missile này trúng (cả primary lẫn secondary AOE — doc: "Đây
      // là đặc tính cốt lõi của Pure", không riêng gì mục tiêu chính).
      if (missile.behavior?.knockbackDistance && target.alive) {
        const direction = target.x >= source.x ? 1 : -1

        target.x += direction * missile.behavior.knockbackDistance
      }
  }

  private resolveMissilesHeadless(battle: Battle, deltaSeconds: number) {
    const getTargets = (sourceId: string) => this.getMissileTargets(battle, sourceId)

    this.missileSystem.update(deltaSeconds, getTargets, (missile, targetId, isPrimary) => {
      this.applyResolvedMissileHit(battle, missile, targetId, isPrimary)
    })
  }

  // Thổ Tu Pure (Plans/EarthPath mục XVI) — nhân multiplier của
  // MissileDamageInfo (giữ nguyên union shape 'physical'/'primordial'/
  // 'elemental', chỉ đổi multiplier) cho mục tiêu phụ AOE.
  private scaleMissileDamage(damage: MissileDamageInfo, percent: number): MissileDamageInfo {
    return { ...damage, multiplier: damage.multiplier * percent }
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
    // Plans/magicpathgeneral Phase 10-11 (2026-08-21) — resolver để DoT
    // tick biết entity NGUỒN THẬT (Kim Thế penetration/Poison Recovery
    // cần đọc stats/currentHp của nguồn), cùng mẫu findEntity() ở
    // resolveMissiles() bên dưới. sourceId có thể KHÔNG còn tồn tại
    // (nguồn đã chết/rời trận) — trả về undefined an toàn.
    const resolveSource = (id: string): CombatEntity | undefined => {
      if (id === battle.player.id) {
        return battle.player
      }

      return battle.enemies.find(battleEnemy => battleEnemy.entity.id === id)?.entity
    }

    new AilmentSystem(battle.playerAilments).update(deltaSeconds, battle.player, this.combat, this.ailmentRegistry, resolveSource)

    for (const battleEnemy of battle.enemies) {
      if (!battleEnemy.entity.alive) {
        continue
      }

      new AilmentSystem(battleEnemy.ailments).update(deltaSeconds, battleEnemy.entity, this.combat, this.ailmentRegistry, resolveSource)
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
      x: number
      radius: number
      duration: number
      tickInterval: number
      damagePerTick: number
      element: ElementType | 'physical'
    },
  ) {
    battle.lavaZones.push({
      id: crypto.randomUUID(),

      ownerId: spec.ownerId,

      x: spec.x,

      radius: spec.radius,

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

    battle.lavaZones = battle.lavaZones.filter(zone => zone.remainingTime > 0)
  }

  private tickLavaZone(battle: Battle, zone: LavaZone) {
    const isPlayerOwned = zone.ownerId === battle.player.id

    const owner = isPlayerOwned
      ? battle.player
      : battle.enemies.find(battleEnemy => battleEnemy.entity.id === zone.ownerId)?.entity

    const targets: CombatEntity[] = isPlayerOwned
      ? battle.enemies.filter(battleEnemy => battleEnemy.entity.alive).map(battleEnemy => battleEnemy.entity)
      : battle.player.alive
        ? [battle.player]
        : []

    for (const target of targets) {
      if (Math.abs(target.x - zone.x) > zone.radius) {
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

      battle.player.currentMp = Math.min(battle.player.stats.maxMp, battle.player.currentMp + battle.player.stats.manaRegenPerSecond * deltaSeconds)

      battle.player.timeSinceLastHitTaken += deltaSeconds

      if (battle.player.timeSinceLastHitTaken >= WARD_REGEN_DELAY_SECONDS) {
        battle.player.currentWard = Math.min(battle.player.stats.wardMax, battle.player.currentWard + battle.player.stats.wardRegenPerSecond * deltaSeconds)
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

      battleEnemy.entity.currentMp = Math.min(battleEnemy.entity.stats.maxMp, battleEnemy.entity.currentMp + battleEnemy.entity.stats.manaRegenPerSecond * deltaSeconds)

      battleEnemy.entity.timeSinceLastHitTaken += deltaSeconds

      if (battleEnemy.entity.timeSinceLastHitTaken >= WARD_REGEN_DELAY_SECONDS) {
        battleEnemy.entity.currentWard = Math.min(battleEnemy.entity.stats.wardMax, battleEnemy.entity.currentWard + battleEnemy.entity.stats.wardRegenPerSecond * deltaSeconds)
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

    const decayPerSecond = HOA_THE_BASE_DECAY_PER_SECOND * (1 - getSkillRuntimeStat(battle.player, 'hoaTheDecayReductionPercent'))

    battle.player.currentHoaThe = Math.max(0, battle.player.currentHoaThe - decayPerSecond * deltaSeconds)
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

    while (battle.player.timeSinceLastBleedProc >= KIM_THE_DECAY_INTERVAL_SECONDS && battle.player.currentKimThe > 0) {
      battle.player.currentKimThe -= 1
      battle.player.timeSinceLastBleedProc -= KIM_THE_DECAY_INTERVAL_SECONDS
    }
  }

  private updatePlayerAttack(
    battle: Battle,
  ) {
    if (
      battle.playerAttackTimer > 0
    ) {
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

    const target = this.findNearestAliveEnemy(battle)

    // Chưa có quái nào trong tầm (hoặc chưa quái nào sống) — không
    // tốn nhịp timer, để đánh được NGAY khi vừa vào tầm thay vì phải
    // chờ hết 1 interval trọn vẹn. `target.x > SCREEN_VISIBLE_MAX_X`
    // (2026-08-22) — attackRange world-unit "vô hạn" của player
    // (PLAYER_ATTACK_RANGE_INFINITE, xem StatBlock.ts) KHÔNG còn nghĩa
    // là bắn trúng bất kỳ đâu nữa: phải THẤY quái mới bắn được, dù
    // stat range có lớn cỡ nào.
    if (!target || Math.abs(target.x - battle.player.x) > battle.player.stats.attackRange || target.x > SCREEN_VISIBLE_MAX_X) {
      return
    }

    const attackSpeed =
      battle.player.stats.attackSpeed

    const interval =
      1 / Math.max(1, attackSpeed)

    battle.playerAttackTimer =
      interval

    if (this.skillSystem.canUse(basicSkill.id, battle.player)) {
      this.castSkill(basicSkill, battle.player, target, battle)

      return
    }

    this.missileSystem.fire(
      battle.player,
      target,
      { kind: 'physical', multiplier: 1 },
      this.combat.rollCritical(battle.player, target),
    )
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

    const nearest = this.findNearestAliveEnemy(battle)

    if (!nearest) {
      return
    }

    for (const { skill, slotIndex } of this.skillManager.getLoadoutEntries()) {
      if (!this.skillSystem.canUseInSlot(skill.id, slotIndex, battle.player)) {
        continue
      }

      const target = skill.target === 'self' ? battle.player : nearest

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
  private beginCast(skill: Skill, source: CombatEntity, target: CombatEntity, battle: Battle, slotIndex?: number) {
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

    player.castTimeRemaining -= deltaSeconds * (1 + Math.min(3, Math.max(0, player.stats.castSpeedPercent)))

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

    const target = skill.target === 'self' ? player : this.findNearestAliveEnemy(battle)

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

  private castSkill(skill: Skill, source: CombatEntity, target: CombatEntity, battle: Battle, slotIndex?: number) {
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
  private resolveSkillEffects(skill: Skill, source: CombatEntity, target: CombatEntity, battle: Battle) {
    // Hỏa Tu Pure (Plans/FirePath mục 7) — 0 nếu chưa mua "Tụ Hỏa"
    // (hoaTheGainPerCast nền = 0), cùng hook "gain theo CAST" như Kiếm
    // Ý/Momentum nhưng ở đây thay vì missile-resolve callback (đó là
    // "theo ĐÒN TRÚNG") vì Hỏa Thế tích theo LƯỢT DÙNG SKILL, xem
    // FirePath.md mục 7.
    if (skill.grantsHoaThePerCast) {
      source.currentHoaThe = Math.min(MAX_HOA_THE, source.currentHoaThe + getSkillRuntimeStat(source, 'hoaTheGainPerCast'))
    }

    // Thổ Tu Pure (Plans/EarthPath mục XV, 2026-08-21) — cùng hook
    // "gain theo CAST" như Hỏa Thế, nhưng KHÔNG có decay đối ứng (doc
    // không nhắc tới, xem CombatEntity.currentThoThe's ghi chú).
    if (skill.grantsThoThePerCast) {
      source.currentThoThe = Math.min(MAX_THO_THE, source.currentThoThe + getSkillRuntimeStat(source, 'thoTheGainPerCast'))
    }

    // Nguồn duy nhất emit 'cast' — PassiveSystem dùng event này cho
    // passive có trigger 'cast'.
    this.eventBus.emit('cast', {
      type: 'cast',

      sourceId: source.id,

      skillId: skill.id,

      skillName: skill.name,
    })

    const sourceBuffs = new BuffSystem(this.getBuffsFor(battle, source))

    // Đọc qua getEffectiveSkill() để tôn trọng Specialization đã
    // chọn (behavior-changing node) + effect 'damage' đã scale theo
    // level hiện tại.
    const effective = this.skillSystem.getEffectiveSkill(skill, source.skillLevels?.[skill.id])

    // Pháp Tu (Thổ Tu) — 'all_enemies' trước đây chỉ là NHÃN, không
    // hề fan-out (Viêm Hải/Độc Vụ trước đó thực chất chỉ trúng đúng 1
    // quái gần nhất, y hệt skill đơn mục tiêu — bug im lặng phát hiện
    // khi thiết kế Thạch Giáp Trận). Giờ áp effects lên TỪNG quái còn
    // sống nếu skill khai target này, mỗi quái tự roll ailment/buff
    // riêng (pool buff/ailment tách theo entity, xem getBuffsFor()).
    const targets = skill.target === 'all_enemies'
      ? battle.enemies.filter(enemy => enemy.entity.alive).map(enemy => enemy.entity)
      : [target]

    for (const oneTarget of targets) {
      const targetBuffs = new BuffSystem(this.getBuffsFor(battle, oneTarget))

      const targetAilments = new AilmentSystem(this.getAilmentsFor(battle, oneTarget))

      this.skillEffectSystem.applyAll(effective.effects, source, oneTarget, {
        combatSystem: this.combat,
        missileSystem: this.missileSystem,
        buffRegistry: this.buffRegistry,
        ailmentRegistry: this.ailmentRegistry,
        sourceBuffs,
        targetBuffs,
        targetAilments,
        reactionManager: this.reactionManager,
        spawnLavaZone: spec => this.spawnLavaZone(battle, spec),
        skillId: skill.id,
      })
    }

    // Chỉ cấp XP sau khi cast hợp lệ đã áp hiệu ứng. Vì effective skill được
    // tính ở trên, lần cast làm tăng level không tự buff ngược chính nó.
    this.skillSystem.gainExperience(skill.id, ACTIVE_SKILL_XP_PER_CAST)
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
      // target.x > SCREEN_VISIBLE_MAX_X (2026-08-22) — mob/boss cũng
      // không được tấn công trong lúc còn off-screen, kể cả loại
      // 'ranged'/'caster' có attackRange đủ xa để lý thuyết chạm tới.
      if (distance > battleEnemy.entity.stats.attackRange || battleEnemy.entity.x > SCREEN_VISIBLE_MAX_X) {
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

    battleEnemy.attackTimer = 1 / Math.max(1, attackSpeed)

    this.missileSystem.fire(
      battleEnemy.entity,
      battle.player,
      { kind: 'physical', multiplier: 1 },
      this.combat.rollCritical(battleEnemy.entity, battle.player),
    )
  }

  /**
   * CHỈ quyết 'defeat' (player chết) — 'victory' giờ do GameManager
   * quyết (cần biết tiến độ Stage: đã spawn đủ + hết quái sống chưa,
   * thứ BattleSystem không nên biết, xem GameManager.updateStageProgress()).
   */
  private checkBattleEnd(
    battle: Battle,
  ) {
    if (!battle.player.alive) {
      battle.state = 'defeat'

      // Chỉ chạy tới đây đúng 1 lần — update() early-return ngay từ
      // đầu khi battle.state !== 'fighting' ở tick kế, nên khỏi cần
      // cờ chống emit lặp.
      this.eventBus.emit('battle_end', { type: 'battle_end', state: 'defeat' })
    }
  }

  stop() {
    this.missileSystem.clear()
    this.battle = null
  }
}
