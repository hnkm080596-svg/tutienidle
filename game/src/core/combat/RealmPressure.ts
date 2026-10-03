import type { CombatEntity } from './CombatEntity'
import { clamp } from '../math/clamp'

// Realm Passive & Pressure System (2026-08-20) - thay the hoan toan
// RealmSuppression.ts cu (+/-8%/gap, khong co mitigation nao). Chenh
// lech canh gioi (dai canh gioi - REALMS index, khong phai tang nho
// trong cung 1 canh gioi) giua 2 ben combat: ben canh gioi cao hon gay
// nhieu sat thuong hon VA nhan it sat thuong hon - CHI 1 con so vi
// "gay du sat thuong" cua ben nay chinh la "nhan du sat thuong" cua
// ben kia (muc IX tai lieu - khong cong them Damage Taken rieng, tranh
// nhan doi).
const MAX_REALM_GAP = 5

// Bac Nhap Dao/Kien Co (1-6, xem core/player/Player.ts's
// breakthroughGrade) giam dan Pressure con lai: grade1 = 100% (khong
// giam), grade6 = 0% (mien nhiem hoan toan), dung bang muc VIII tai
// lieu. B2 (2026-08-27): Realm Pressure la tuyet doi theo canh gioi;
// can co la suc khang cua BEN YEU THE. gap > 0 doc grade cua target,
// gap < 0 doc grade cua source. Enemy khong co khai niem can co ->
// grade 1 (chiu/toan bo pressure, khong mien nhiem vo can cu).
const PRESSURE_REMAINING_PER_GRADE_STEP = 0.2
const DEFAULT_NO_FOUNDATION_GRADE = 1

// O gap = 1: ben cao gay x2.00 (grade1) -> x1.00 (grade6); ben thap
// gay x0.50 (grade1) -> x1.00 (grade6) - dung bang muc VII/VIII. Chua
// co curve multi-gap chinh thuc (tai lieu muc X khuyen nghi chi lam
// lien ke truoc) nen tuyen tinh hoa theo gap la phan mo rong DON GIAN
// NHAT giu dung hanh vi gap=1, can tinh chinh qua playtest.
const HIGH_TO_LOW_PRESSURE_PER_GAP = 1.0
const LOW_TO_HIGH_PRESSURE_PER_GAP = 0.5

// Chan duoi multiplier ben thap canh gioi - tranh multiplier 0/am khi
// gap lon (gap=5, grade1: 1 - 5*0.5 = -1.5 neu khong chan).
const LOW_TO_HIGH_MULTIPLIER_FLOOR = 0.1

function resolveWeakerSideGrade(source: CombatEntity, target: CombatEntity, gap: number): number {
  const weakerSide = gap > 0 ? target : source

  return clamp(weakerSide.breakthroughGrade ?? DEFAULT_NO_FOUNDATION_GRADE, 1, 6)
}

/**
 * He so Realm Pressure - nhan thang vao damage multiplier truoc khi
 * tinh damage (xem CombatSystem.resolveActionHit()). > 1 khi source
 * cao canh gioi hon target (gay du sat thuong), < 1 khi thap hon (gay
 * thieu sat thuong), = 1 khi cung canh gioi.
 */
export function getRealmPressureMultiplier(source: CombatEntity, target: CombatEntity): number {
  const gap = clamp(source.realmIndex - target.realmIndex, -MAX_REALM_GAP, MAX_REALM_GAP)

  if (gap === 0) {
    return 1
  }

  const grade = resolveWeakerSideGrade(source, target, gap)

  const pressureRemaining = clamp(1 - (grade - 1) * PRESSURE_REMAINING_PER_GRADE_STEP, 0, 1)

  if (gap > 0) {
    return 1 + gap * HIGH_TO_LOW_PRESSURE_PER_GAP * pressureRemaining
  }

  const lowered = 1 - Math.abs(gap) * LOW_TO_HIGH_PRESSURE_PER_GAP * pressureRemaining

  return clamp(lowered, LOW_TO_HIGH_MULTIPLIER_FLOOR, 1)
}
