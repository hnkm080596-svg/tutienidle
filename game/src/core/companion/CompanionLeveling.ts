// CompanionLeveling (Companion Roster spec §6, 2026-09-05)
// Đường cong exp/level được tách riêng ra file này theo quy ước của dự án
// là "hằng số balance sống trong file riêng của nó", để sau này chỉnh
// balance không phải đụng vào code tích hợp combat (CompanionCombat.ts).
import type { CompanionInstance } from '@/data/companion/Companions'

const EXP_PER_LEVEL = 100

// Level 1 khi exp = 0, mỗi EXP_PER_LEVEL điểm exp lên 1 level.
export function companionLevelForExp(exp: number): number {
  return 1 + Math.floor(exp / EXP_PER_LEVEL)
}

// Pure function: returns a NEW instance with exp accumulated, never
// mutates the input. (2026-09-12 schema: instances no longer carry a
// `level` field - this file is deleted wholesale by companion-gacha Task 2.)
export function grantCompanionExp(instance: CompanionInstance, amount: number): CompanionInstance {
  return {
    ...instance,
    exp: instance.exp + amount,
  }
}
