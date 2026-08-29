import type { Battle } from './Battle'
import type { CombatEntity } from '../combat/CombatEntity'
import type { SwordZone } from './SwordZone'
import type { KiemTuRoute } from '../player/Player'

// Ult Kiếm Tu (spec 2026-08-29-kiem-the-kiem-y mục 2/3.4) — 2 ult
// MANUAL (nút riêng trong CombatControlBar, KHÔNG chiếm loadout slot)
// + auto-toggle. Số liệu "khởi điểm tinh chỉnh playtest":
//   TTKT: cost = 10 × số kiếm trận hiện có (Lưỡng Nghi 20 → Vô Cực
//   90), nuke AoE + zone 6 tick × 1s.
//   KKTM: đốt TOÀN BỘ kiếm ý tạm (vĩnh viễn bất khả xâm phạm), đòn
//   đơn mục tiêu Ưu TIÊN BOSS, overkill tràn 50% chia đều địch còn
//   sống; auto khi boss trong trận + kiếm ý tạm ≥ 500.
export const KIEM_THE_PER_ULT_SWORD = 10
export const KIEM_Y_KKTM_AUTO_THRESHOLD = 500
export const TTKT_ZONE_TICKS = 6
export const TTKT_ZONE_TICK_INTERVAL = 1
export const KKTM_OVERKILL_SPLASH_PERCENT = 0.5

export interface UltimateNukeResolver {
  /** Resolve đòn nuke chính vào target — trả tổng damage đã gây để
   * tính overkill (KKTM). UltimateSystem thuần không depend pipeline
   * CombatSystem — BattleSystem inject resolver thật. */
  resolveNuke: (target: CombatEntity) => number
}

export interface UltimateCanUse {
  ok: boolean
  reason?: 'resource'
}

/** Số kiếm thế ult TTKT cần theo cấp trận hiện có. */
export function truTienKiemTranCost(swordCount: number): number {
  return KIEM_THE_PER_ULT_SWORD * swordCount
}

export function canUseUltimate(
  battle: Battle,
  route: KiemTuRoute,
  swordCount: number,
): UltimateCanUse {
  if (route === 'kiem_tran') {
    return (battle.player.currentKiemThe ?? 0) >= truTienKiemTranCost(swordCount)
      ? { ok: true }
      : { ok: false, reason: 'resource' }
  }

  // KKTM manual: chỉ cần kiếm ý tạm > 0 (burn-all — bao nhiêu cũng nổ)
  return (battle.player.currentKiemYTemp ?? 0) > 0 ? { ok: true } : { ok: false, reason: 'resource' }
}

/** Boss/Độ Kiếp có mặt trong trận? (KKTM auto điều kiện). */
function battleHasBoss(battle: Battle): boolean {
  return battle.enemies.some((enemy) => enemy.entity.alive && enemy.entity.isBoss === true)
}

/** Auto-AI (spec mục 3.4): TTKT auto khi đủ cost; KKTM auto khi có
 * boss + kiếm ý tạm ≥ ngưỡng (không nổ ult "không có mục tiêu xứng"). */
export function autoUltimateDecision(
  battle: Battle,
  route: KiemTuRoute,
  swordCount: number,
): 'ttkt' | 'kktm' | null {
  if (battle.state !== 'fighting' || !battle.player.alive) {
    return null
  }

  if (route === 'kiem_tran') {
    return canUseUltimate(battle, route, swordCount).ok ? 'ttkt' : null
  }

  const kiemYTemp = battle.player.currentKiemYTemp ?? 0
  return battleHasBoss(battle) && kiemYTemp >= KIEM_Y_KKTM_AUTO_THRESHOLD ? 'kktm' : null
}

/** Sinh id zone duy nhất — không import crypto (đơn giản, đủ dùng). */
let zoneCounter = 0
function nextZoneId(): string {
  zoneCounter += 1
  return `ttkt_zone_${zoneCounter}`
}

/** Thực thi ult. Trả false nếu không đủ tài nguyên. */
export function triggerUltimate(
  battle: Battle,
  route: KiemTuRoute,
  swordCount: number,
  nuke: UltimateNukeResolver,
): boolean {
  const check = canUseUltimate(battle, route, swordCount)
  if (!check.ok) {
    return false
  }

  if (route === 'kiem_tran') {
    // Nuke AoE: resolve vào MỌI địch còn sống (resolver tự pipeline),
    // sau đó đặt kiếm trận trường tồn 6 tick × 1s tại vị trí enemy gần nhất.
    battle.player.currentKiemThe =
      (battle.player.currentKiemThe ?? 0) - truTienKiemTranCost(swordCount)

    for (const enemy of battle.enemies) {
      if (enemy.entity.alive) {
        nuke.resolveNuke(enemy.entity)
      }
    }

    const anchor = battle.enemies.find((enemy) => enemy.entity.alive) ?? battle.enemies[0]
    if (anchor) {
      const zone: SwordZone = {
        id: nextZoneId(),
        ownerId: battle.player.id,
        row: anchor.entity.row,
        column: anchor.entity.x,
        laneRadius: 4,
        columnRadius: 4,
        remainingCharges: TTKT_ZONE_TICKS,
        tickInterval: TTKT_ZONE_TICK_INTERVAL,
        timeSinceLastTick: 0,
        damagePerTick: swordCount,
        element: 'metal',
      }
      battle.swordZones.push(zone)
    }

    return true
  }

  // KKTM — đốt TOÀN BỘ kiếm ý tạm (vĩnh viễn nằm ngoài pool, an toàn),
  // đơn mục tiêu ưu tiên boss.
  const burned = battle.player.currentKiemYTemp ?? 0
  battle.player.currentKiemYTemp = 0

  const aliveEnemies = battle.enemies.filter((enemy) => enemy.entity.alive)
  const boss = aliveEnemies.find((enemy) => enemy.entity.isBoss === true)
  const target = boss?.entity ?? aliveEnemies[0]?.entity

  if (!target) {
    return true // không có mục tiêu — kiếm ý vẫn đã đốt (chủ động ult giữa chừng)
  }

  const targetHpBefore = target.currentHp
  const totalNukeDamage = nuke.resolveNuke(target)
  const targetDamage = targetHpBefore - Math.max(0, target.currentHp)

  // Overkill tràn: phần damage dư × 50% chia ĐỀU địch còn sống (không
  // gồm target đã chết/nhận nuke).
  const overkill = Math.max(0, totalNukeDamage - targetDamage)
  if (overkill > 0) {
    const splashTargets = battle.enemies.filter(
      (enemy) => enemy.entity.alive && enemy.entity.id !== target.id,
    )
    if (splashTargets.length > 0) {
      const splashPer = (overkill * KKTM_OVERKILL_SPLASH_PERCENT) / splashTargets.length
      for (const enemy of splashTargets) {
        enemy.entity.currentHp = Math.max(0, enemy.entity.currentHp - splashPer)
        if (enemy.entity.currentHp <= 0) {
          enemy.entity.alive = false
        }
      }
    }
  }

  return true
}
