import type { CombatEntity } from '../combat/CombatEntity'
import { MAX_THE, THE_GAIN_PER_FINISHER, THE_GAIN_PER_LINK } from '../combat/CombatTypes'
import type { BuffRegistry } from '../buff/BuffRegistry'
import type { BuffSystem } from '../buff/BuffSystem'
import type { ElementType } from '../element/ElementType'
import type { SkillRuntimeStats } from '../skill/SkillRuntimeStats'

// Thế Thuần hệ Pháp Tu (spec 2026-08-30-phap-tu-dao-sac §2.3) — runtime
// thuần của pool CHIẾN ĐẤU, pattern KiemTuResourceSystem (tick/gain riêng,
// KHÔNG đụng CombatSystem pipeline). Mọi hàm đọc field optional qua
// `?? 0` — CombatEntity.currentThe là optional theo precedent
// currentKiemThe: chỉ Pháp Tu đã chốt Thuần mới có ý nghĩa, mọi
// fixture/factory của path khác không cần touch.

/** Buff "Thế Mãn" theo hành — id `the_man_<element>`. Definition (data/
 * buffs, Task 9) duration Infinity, engine ÁP/GỠ theo trạng thái đầy
 * (không tick hết hạn). Export prefix + helper id để data/UI/test cùng
 * một nguồn sự thật. */
export const THE_MAN_BUFF_PREFIX = 'the_man_'

export function theManBuffId(element: ElementType): string {
  return `${THE_MAN_BUFF_PREFIX}${element}`
}

/** Trần Thế hiện hành: MAX_THE + node bonus (theMaxBonus — E-7). */
export function theMaxWithBonus(skillStats?: Partial<SkillRuntimeStats>): number {
  return MAX_THE + (skillStats?.theMaxBonus ?? 0)
}

/** +10 mỗi link chuỗi cast hoàn tất (+20 với finisher E), cap MAX_THE;
 * E-7: skillAStats (runtime stats skill A của chuỗi — node Thế cộng
 * `theGainPerLinkBonus` vào MỌI link, `theMaxBonus` nới trần).
 * Không decay theo thời gian — Thế tích xuyên kill, chỉ tiêu hao qua ult. */
export function gainTheOnChainLink(
  player: CombatEntity,
  isFinisher: boolean,
  skillAStats?: Partial<SkillRuntimeStats>,
): void {
  const bonus = skillAStats?.theGainPerLinkBonus ?? 0

  player.currentThe = Math.min(
    theMaxWithBonus(skillAStats),
    (player.currentThe ?? 0) + (isFinisher ? THE_GAIN_PER_FINISHER : THE_GAIN_PER_LINK) + bonus,
  )
}

/** Thế đã đầy theo trần (có bonus)? */
export function isTheFull(player: CombatEntity, maxOverride?: number): boolean {
  return (player.currentThe ?? 0) >= (maxOverride ?? MAX_THE)
}

/** Ult mở khi Thế đầy (MAX_THE + bonus — E-7); bắn xong reset về 0 (spec
 * §2.3 — "Thế tích xuyên kill, đầy → Ultimate, dùng xong tích lại"). Trả
 * false và KHÔNG trừ gì nếu chưa đầy. */
export function consumeTheForUlt(player: CombatEntity, maxOverride?: number): boolean {
  if (!isTheFull(player, maxOverride)) {
    return false
  }

  player.currentThe = 0
  return true
}

/**
 * E-7 — đồng bộ buff Thế Mãn (`the_man_<element>`) theo trạng thái đầy:
 * `currentThe >= max` → áp (nếu chưa có), ngược lại → gỡ. Engine áp/gỡ
 * THEO ID STRING — definition nằm ở data/buff (Task 9): registry chưa
 * có id là NO-OP (không crash path cũ/chưa data). source = target =
 * player (buff nội tại).
 */
export function updateTheManBuff(
  buffs: BuffSystem,
  registry: BuffRegistry,
  player: CombatEntity,
  element: ElementType,
  currentThe: number,
  max: number,
): void {
  const id = theManBuffId(element)

  if (currentThe >= max) {
    if (!registry.has(id) || buffs.getAllById(id).length > 0) {
      return
    }

    buffs.apply(registry.get(id), player, player, registry)
    return
  }

  buffs.removeAllById(id)
}
