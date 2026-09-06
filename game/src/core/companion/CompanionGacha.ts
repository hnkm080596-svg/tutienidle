// CompanionGacha (Companion Roster spec §7, 2026-09-05) — chỉ cơ chế:
// giá trị rate table cụ thể và loại tiền tệ dùng để pull là quyết định
// content/balance (spec §8), không thiết kế ở đây. Pull trùng (duplicate)
// sẽ convert sang exp (qua CompanionLeveling.grantCompanionExp) thay vì
// no-op hoặc tạo thêm 1 instance sở hữu thứ hai — xem spec §7.
import type { ItemGrade } from '@/core/item/ItemGrade'
import type { CompanionDefinition, CompanionInstance } from '@/data/companion/Companions'
import { grantCompanionExp } from './CompanionLeveling'

const GRADE_ORDER: readonly ItemGrade[] = ['hoang', 'huyen', 'dia', 'thien', 'tien']

/** Exp cộng cho companion đã sở hữu khi pull trúng trùng. Giá trị content/balance, tách riêng ở đây để dễ tune sau. */
const DUPLICATE_PULL_EXP = 50

// Roll grade theo bảng tỉ lệ tích lũy: cộng dồn rate theo GRADE_ORDER,
// grade nào khiến tổng tích lũy vượt qua random roll thì chọn grade đó.
export function rollCompanionGrade(rates: Record<ItemGrade, number>, random: () => number = Math.random): ItemGrade {
  const roll = random()

  let cumulative = 0

  for (const grade of GRADE_ORDER) {
    cumulative += rates[grade]

    if (roll < cumulative) {
      return grade
    }
  }

  // Phòng sai số làm tròn (tổng rate không đủ 1.0): fallback về grade cuối cùng.
  return GRADE_ORDER[GRADE_ORDER.length - 1]!
}

// Chọn ngẫu nhiên đều (uniform) 1 definition trong số các definition cùng grade đã roll được.
export function pickDefinitionOfGrade(
  grade: ItemGrade,
  pool: readonly CompanionDefinition[],
  random: () => number = Math.random,
): CompanionDefinition {
  const candidates = pool.filter((definition) => definition.grade === grade)

  if (candidates.length === 0) {
    throw new Error(`pickDefinitionOfGrade: no companion definitions of grade "${grade}" in the pool`)
  }

  const index = Math.floor(random() * candidates.length)

  return candidates[index]!
}

// Hàm pure: trả về mảng owned MỚI (không mutate mảng truyền vào) cùng
// kết quả pull. Nếu companion chưa sở hữu → thêm instance mới ở level 1;
// nếu đã sở hữu (duplicate) → cộng exp vào instance hiện có thay vì thêm bản sao.
export function pullCompanion(
  owned: CompanionInstance[],
  rates: Record<ItemGrade, number>,
  pool: readonly CompanionDefinition[],
  random: () => number = Math.random,
): { owned: CompanionInstance[]; result: { definitionId: string; isDuplicate: boolean } } {
  const grade = rollCompanionGrade(rates, random)
  const definition = pickDefinitionOfGrade(grade, pool, random)

  const existingIndex = owned.findIndex((instance) => instance.definitionId === definition.id)

  if (existingIndex === -1) {
    return {
      owned: [...owned, { definitionId: definition.id, level: 1, exp: 0 }],
      result: { definitionId: definition.id, isDuplicate: false },
    }
  }

  const updated = [...owned]

  updated[existingIndex] = grantCompanionExp(updated[existingIndex]!, DUPLICATE_PULL_EXP)

  return { owned: updated, result: { definitionId: definition.id, isDuplicate: true } }
}
