import type { Battle } from './Battle'
import type { BuffPool } from '../buff/BuffPool'
import type { CombatEntity } from '../combat/CombatEntity'
import { canEnemyReachGate } from './ActionTargetingSystem'
import { HERO_COLUMN, VISIBLE_MAX_COLUMN } from './BattleLane'
import { ActionImpactSystem } from './ActionImpactSystem'
import { getAttackIntervalSeconds } from '../combat/AttackTiming'

// Phase 4 mechanical split (Task 7, 2026-09-02) — extracted verbatim từ
// BattleSystem.updateEnemyAttacks()/fireEnemyAttack()/isEnemyInPosition(),
// KHÔNG đổi hành vi. Comments gốc giữ nguyên; xem BattleSystem.ts cho
// lịch sử/spec gắn với từng đoạn logic.

// Core Loop Foundation checklist (Mục MONSTER) — 'ranged' giữ khoảng
// cách bằng % attackRange (không đứng sát mép tầm đánh như melee).
const RANGED_PREFERRED_DISTANCE_RATIO = 0.6

const ENEMY_MELEE_WINDUP_SECONDS = 0.15

const ENEMY_RANGED_WINDUP_SECONDS = 0.3

// 'caster' có 1 khoảng "khoảng lặng" ngắn trước khi đòn thực sự bắn
// ra (telegraph) — khác melee/ranged bắn ngay khi tới lượt.
const CASTER_CAST_DELAY_SECONDS = 0.6

export interface EnemyAttackSystemDeps {
  readonly actionImpact: ActionImpactSystem
  /** BattleSystem.isIncapacitated — dùng chung cache BuffSystem của engine. */
  readonly isIncapacitated: (buffs: BuffPool) => boolean
}

/**
 * Enemy AI attack firing — tách khỏi BattleSystem (mechanical, Task 7).
 * Sở hữu state machine "đứng lại rồi mới đánh" (yêu cầu sản phẩm
 * 2026-08-26): telegraph caster, windup basic/special, và điểm dừng kiting
 * của ranged/caster (isEnemyInPosition).
 */
export class EnemyAttackSystem {
  constructor(private readonly deps: EnemyAttackSystemDeps) {}

  /**
   * Enemy đã ở THẾ ĐỨNG BẮN: trong tầm của chính nó tới cổng VÀ không
   * còn di chuyển nữa (kiter lùi về preferred thì coi như đang di chuyển).
   * Yêu cầu sản phẩm 2026-08-26 — KHÔNG bắn khi đang đi bộ; quái chỉ mở
   * hỏa lực sau khi dừng ở biên range.
   */
  isEnemyInPosition(entity: CombatEntity): boolean {
    if (!canEnemyReachGate(entity, HERO_COLUMN)) {
      return false
    }

    const isKiter = entity.archetype === 'ranged' || entity.archetype === 'caster'

    if (isKiter) {
      return Math.abs(entity.x - HERO_COLUMN) >= entity.stats.attackRange * RANGED_PREFERRED_DISTANCE_RATIO
    }

    return true
  }

  updateEnemyAttacks(battle: Battle, deltaSeconds: number) {
    // Targetability (plan §5.4/§13): Player và enemy ĐỀU phải materialize
    // + còn sống thì enemy mới có target (cổng) để đánh.
    if (!battle.playerMaterialized || !battle.player.alive) {
      return
    }

    for (const battleEnemy of battle.enemies) {
      if (!battleEnemy.entity.alive) {
        continue
      }

      if (this.deps.isIncapacitated(battleEnemy.buffs)) {
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

      // "Đứng lại rồi mới đánh" (yêu cầu sản phẩm 2026-08-26): quái còn
      // off-screen hoặc CHƯA dừng ở biên range của chính nó thì KHÔNG tiêu
      // attack timer, không mở telegraph — di chuyển và tấn công loại trừ
      // nhau.

      if (
        !this.isEnemyInPosition(battleEnemy.entity) ||
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
    const attackSpeed = battleEnemy.entity.stats.speed

    battleEnemy.attackTimer = getAttackIntervalSeconds(attackSpeed)

    // Combat Grid Rework — enemy attack cũng là action impact: ranged
    // "bắn phép" = impact TẠI target (không vật thể bay), windup dài hơn.

    const isRanged =
      battleEnemy.entity.archetype === 'ranged' || battleEnemy.entity.archetype === 'caster'

    // Combat Balance Pass (2026-08-29, plan §3.6) — action đặc biệt data-
    // driven: đếm attack 1-based, mỗi attack MỚI thứ `everyNth` (khớp
    // spec ĐẦU TIÊN trong danh sách) thay basic bằng impact với
    // damageMultiplier/presetId riêng. Đếm qua field runtime trên
    // battleEnemy — không mutate data gốc.
    const specialCount = (battleEnemy.specialAttackCounter ?? 0) + 1

    battleEnemy.specialAttackCounter = specialCount

    const special = battleEnemy.entity.specialAttacks?.find(
      candidate => specialCount % candidate.everyNth === 0,
    )

    if (special) {
      this.deps.actionImpact.scheduleBasic({
        actionId: `${battleEnemy.entity.id}:special`,
        sourceId: battleEnemy.entity.id,
        targetId: battle.player.id,
        damage: { kind: 'physical', multiplier: special.damageMultiplier },
        presetId: special.presetId ?? 'boss_ground_slam',
        windupSeconds: special.windupSeconds ?? ENEMY_MELEE_WINDUP_SECONDS,
      })

      return
    }

    this.deps.actionImpact.scheduleBasic({
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
}
