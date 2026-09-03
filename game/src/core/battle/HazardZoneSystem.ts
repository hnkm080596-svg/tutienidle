import type { Battle } from './Battle'

import type { CombatEntity } from '../combat/CombatEntity'
import type { CombatSystem } from '../combat/CombatSystem'

import type { ElementType } from '../element/ElementType'

import type { LavaZone } from './LavaZone'
import type { SwordZone } from './SwordZone'

// Phase 7 mechanical split (Task 7, 2026-09-02) — extracted VERBATIM từ
// BattleSystem's spawnLavaZone/updateLavaZones/tickLavaZone +
// spawnSwordZone/updateSwordZones/tickSwordZone. KHÔNG đổi hành vi; comments
// gốc giữ nguyên. BattleSystem.spawnLavaZone/spawnSwordZone/updateLavaZones/
// updateSwordZones ở lại như thin wrapper (public API/call sites không đổi)
// delegate vào đây qua `this.hazardZoneSystem`.

/**
 * Collaborator surface — chỉ 1 dependency: CombatSystem.applyDotDamage(),
 * pipeline damage DUY NHẤT cả 2 loại zone đi qua (DOT RES/Poison Recovery/
 * DamageEvent).
 */
export interface HazardZoneSystemDeps {
  readonly combat: CombatSystem
}

export class HazardZoneSystem {
  constructor(private readonly deps: HazardZoneSystemDeps) {}

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
  updateLavaZones(battle: Battle, deltaSeconds: number) {
    for (const zone of battle.lavaZones) {
      zone.remainingTime -= deltaSeconds

      zone.timeSinceLastTick += deltaSeconds

      // Guard tickInterval > 0 — interval 0/âm làm timeSinceLastTick không
      // bao giờ giảm dưới ngưỡng, vòng lặp thành vô hạn.
      while (zone.tickInterval > 0 && zone.timeSinceLastTick >= zone.tickInterval) {
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

      this.deps.combat.applyDotDamage({
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
   * Task 8 (Kiếm Trận keystone, 2026-08-28) — spawn SwordZone. KHÁC
   * spawnLavaZone: gọi trực tiếp từ SkillEffectSystem's case 'damage'
   * (SkillEffect.grantsSwordZone), KHÔNG đi qua ReactionManager.
   * Pháp Tu Thuần Hệ (E-5, 2026-09-03) — `element` override cho
   * grantsZone mọi hành; không truyền = 'metal' như cũ (Kiếm Trận).
   */
  spawnSwordZone(
    battle: Battle,
    spec: {
      ownerId: string
      row: number
      column: number
      laneRadius: number
      columnRadius: number
      charges: number
      tickInterval: number
      damagePerTick: number
      element?: ElementType
    },
  ) {
    battle.swordZones.push({
      id: crypto.randomUUID(),
      ownerId: spec.ownerId,
      row: spec.row,
      column: spec.column,
      laneRadius: spec.laneRadius,
      columnRadius: spec.columnRadius,
      remainingCharges: spec.charges,
      tickInterval: spec.tickInterval,
      timeSinceLastTick: 0,
      damagePerTick: spec.damagePerTick,
      // E-5: nhận element từ spec (grantsZone mọi hành), mặc định
      // 'metal' giữ nguyên hành vi Kiếm Trận cũ.
      element: spec.element ?? 'metal',
    })
  }

  /**
   * Tick từng Sword Zone — vòng lặp `while` (bắt kịp overshoot, cùng
   * pattern updateLavaZones()), nhưng mỗi tick THẬT SỰ trôi qua trừ 1
   * `remainingCharges` thay vì trừ `deltaSeconds` khỏi remainingTime —
   * zone hết hạn theo SỐ TICK ĐÃ LAND, không theo thời gian.
   */
  updateSwordZones(battle: Battle, deltaSeconds: number) {
    for (const zone of battle.swordZones) {
      zone.timeSinceLastTick += deltaSeconds

      // Guard tickInterval > 0 — interval 0/âm làm timeSinceLastTick không
      // bao giờ giảm dưới ngưỡng, vòng lặp thành vô hạn.
      while (
        zone.tickInterval > 0 &&
        zone.timeSinceLastTick >= zone.tickInterval &&
        zone.remainingCharges > 0
      ) {
        zone.timeSinceLastTick -= zone.tickInterval

        zone.remainingCharges -= 1

        this.tickSwordZone(battle, zone)
      }
    }

    battle.swordZones = battle.swordZones.filter((zone) => zone.remainingCharges > 0)
  }

  private tickSwordZone(battle: Battle, zone: SwordZone) {
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

      this.deps.combat.applyDotDamage({
        sourceId: zone.ownerId,
        source: owner,
        target,
        rawDamage: zone.damagePerTick,
        element: zone.element,
        effectId: zone.id,
      })
    }
  }
}
