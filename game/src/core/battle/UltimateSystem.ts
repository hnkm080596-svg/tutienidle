import type { Battle } from './Battle'
import type { CombatEntity } from '../combat/CombatEntity'
import type { SwordZone } from './SwordZone'
import type { KiemTuRoute } from '../player/Player'
import type { Skill } from '../skill/Skill'
import type { ElementType } from '../element/ElementType'
import { consumeTheForUlt, theManBuffId, theMaxWithBonus } from './TheResourceSystem'
import { BuffSystem } from '../buff/BuffSystem'

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

// ============================================================================
// Pháp Tu Đạo Sắc (spec 2026-08-30-phap-tu-dao-sac §2.4) — 5 ult Thuần
// hệ theo Thế đầy 100, pattern TTKT/KKTM: nút manual riêng
// (CombatControlBar) + toggle auto mặc định ON (AI bắn khi boss/Độ
// Kiếp active). KHÔNG chiếm loadout slot. Sát thương đọc qua nuke
// resolver (GameManager inject pipeline — cùng pattern Kiếm Tu).
// ============================================================================

export const PHAP_TU_ULTIMATE_IDS = {
  fire: 'tat_phuong',
  water: 'bat_thu',
  wood: 'kien_moc',
  metal: 'kim_phat',
  earth: 'thanh_luy',
} as const

export type PhapTuUltimateElement = keyof typeof PHAP_TU_ULTIMATE_IDS

/** E-6 (plan 2026-09-03-thuan-he) — targeting profile per hành:
 * 'all' = mọi địch còn sống (diện rộng — 4 ult), 'single_boss_priority'
 * = ĐÚNG 1 target, boss trước, không boss → HP HIỆN TẠI cao nhất,
 * KHÔNG splash overkill (Kim Phạt là "hình phạt" đơn — khác KKTM). */
export type PhapTuUltimateProfile = 'all' | 'single_boss_priority'

export const PHAP_TU_ULTIMATE_PROFILES: Record<ElementType, PhapTuUltimateProfile> = {
  fire: 'all',
  water: 'all',
  wood: 'all',
  metal: 'single_boss_priority',
  earth: 'all',
}

/** Seam effect-driven (E-6): UltimateSystem KHÔNG tự biết
 * SkillEffectSystem/ctx — GameManager glue (Task 12) inject:
 * - getUltSkill: tra skill ult theo id (`PHAP_TU_ULTIMATE_IDS[element]`)
 *   từ SkillManager — undefined (chưa đăng ký) = không resolve.
 * - runUltimateEffects: resolve effects của skill ult vào target set
 *   qua ĐÚNG đường cast thường (ctx đủ buffRegistry/reactionManager
 *   như skill thường — pattern BattleSystem.resolveSkillEffects).
 *   Shape diện rộng (all_lanes) do targeting của skill tự quyết theo
 *   target set đã chọn, không phải vòng lặp ở đây. */
export interface PhapTuUltimateDeps {
  getUltSkill: (element: PhapTuUltimateElement) => Skill | undefined
  runUltimateEffects: (
    skill: Skill,
    source: CombatEntity,
    targets: CombatEntity[],
  ) => void
}

/** Target set theo profile — MỘT lần resolve cho cả set (không loop
 * nuke từng con như bản cũ). */
function selectPhapTuUltimateTargets(
  battle: Battle,
  profile: PhapTuUltimateProfile,
): CombatEntity[] {
  const aliveEnemies = battle.enemies
    .filter((enemy) => enemy.entity.alive)
    .map((enemy) => enemy.entity)

  if (profile === 'all') {
    return aliveEnemies
  }

  const boss = aliveEnemies.find((enemy) => enemy.isBoss === true)
  const single =
    boss ??
    aliveEnemies.reduce<CombatEntity | undefined>(
      (best, enemy) => (best === undefined || enemy.currentHp > best.currentHp ? enemy : best),
      undefined,
    )

  return single ? [single] : []
}

/** Ult Thuần hệ mở khi Thế đầy MAX_THE + node bonus theMaxBonus của
 * skill A (E-7, 2026-09-03 — đọc qua player.skillStats do GameManager
 * snapshot; không bonus = y hệt MAX_THE cũ). */
export function canUsePhapTuUltimate(battle: Battle): boolean {
  return (battle.player.currentThe ?? 0) >= theMaxWithBonus(battle.player.skillStats)
}

/** Auto-AI (spec §2.4): bắn khi có boss/Độ Kiếp trong trận VÀ Thế đầy.
 * Ưu tiên boss làm mục tiêu — resolver tự xử (pattern KKTM). */
export function autoPhapTuUltimateDecision(
  battle: Battle,
  element: PhapTuUltimateElement,
): PhapTuUltimateElement | null {
  if (battle.state !== 'fighting' || !battle.player.alive) {
    return null
  }

  return battleHasBoss(battle) && canUsePhapTuUltimate(battle) ? element : null
}

/** Thực thi ult Pháp Tu: tiêu TOÀN BỘ Thế (reset 0 — spec §2.3 "dùng
 * xong tích lại"), resolve theo PROFILE E-6 (plan 2026-09-03-thuan-he):
 * có `deps` → chạy EFFECTS của skill ult qua `runUltimateEffects` một
 * lần cho target set của profile (zone/debuff/single-boss/ward nằm
 * trong skill data — Task 10); không `deps` (caller cũ/test) → fallback
 * nuke resolver từng target trong cùng set. Trả false nếu Thế chưa đầy.
 * E-7 (2026-09-03): trần so theo `theMaxWithBonus(player.skillStats)`;
 * truyền `element` (ult vừa bắn) → gỡ buff `the_man_<el>` trên player
 * khi reset (engine gỡ theo id — no-op nếu data chưa đăng ký). */
export function triggerPhapTuUltimate(
  battle: Battle,
  nuke: UltimateNukeResolver,
  element?: PhapTuUltimateElement,
  deps?: PhapTuUltimateDeps,
): boolean {
  if (!canUsePhapTuUltimate(battle)) {
    return false
  }

  consumeTheForUlt(battle.player, theMaxWithBonus(battle.player.skillStats))

  if (element) {
    new BuffSystem(battle.playerBuffs).removeAllById(theManBuffId(element))

    const profile = PHAP_TU_ULTIMATE_PROFILES[element]
    const targets = selectPhapTuUltimateTargets(battle, profile)

    if (deps) {
      const skill = deps.getUltSkill(element)

      if (skill && targets.length > 0) {
        deps.runUltimateEffects(skill, battle.player, targets)
      }
    } else {
      for (const target of targets) {
        nuke.resolveNuke(target)
      }
    }
  } else {
    // Caller cũ không truyền element (Kiếm Tu path / test E-7 cũ):
    // giữ nguyên hành vi nuke AoE đồng nhất mọi địch còn sống.
    for (const enemy of battle.enemies) {
      if (enemy.entity.alive) {
        nuke.resolveNuke(enemy.entity)
      }
    }
  }

  return true
}
