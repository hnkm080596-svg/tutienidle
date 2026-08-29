import type { FoundationType } from '../../core/breakthrough/FoundationType'

// Hệ Lôi Kiếp mới (spec dot-pha-loi-kiep §5) — chương kiếp theo realm,
// KHÔNG quái Kiếp: Tâm Ma (minigame hỏi đáp) + Thân/Lôi (tank lôi).
// Số liệu first-pass theo spec §5.4, playtest chỉnh (spec §9).

export type TribulationChapterKind = 'mind' | 'body' | 'lightning'

export interface MindTrialProfile {
  questionCount: number
  /** Thời gian câu ĐẦU (giây) — giảm dần tới lastQuestionSeconds ở câu cuối. */
  firstQuestionSeconds: number
  lastQuestionSeconds: number
  /** Nghỉ giữa 2 câu (giây). */
  restSecondsBetweenQuestions: number
}

export interface TankTrialProfile {
  durationSeconds: number
  strikeIntervalSeconds: number
  /** %maxHP mỗi lôi kích (fraction). */
  lightningMaxHpDamagePercent: number
  /** Đại lôi cuối chương (chỉ lightning) — undefined = không có. */
  finalStrikeMaxHpDamagePercent?: number
}

export interface TribulationChapterProfile {
  kind: TribulationChapterKind
  name: string
  description: string
  mind?: MindTrialProfile
  tank?: TankTrialProfile
}

// Hệ số khó theo bậc đã chốt (spec §5.5): nhân vào số lôi + %maxHP +
// tốc độ tâm ma. Chuẩn bị tốt → kiếp khó hơn → passive mạnh hơn.
export const GRADE_DIFFICULTY_MULTIPLIER: Record<FoundationType, number> = {
  human: 1,
  earth: 1.15,
  heaven: 1.3,
  great_dao: 1.85,
}

// Phạt thất bại chuẩn hóa theo realm (spec §5.7) — tu vi giảm dần theo
// realm (sàn 0.2, fallback 0.3 cho realm chưa khai), Linh Thạch scale
// theo realm (fallback 2000).
export const TRIBULATION_DEFEAT_CULTIVATION_LOSS_BY_REALM: Record<string, number> = {
  qi_refining: 0.5,
  foundation_establishment: 0.4,
}

export const TRIBULATION_DEFEAT_CULTIVATION_LOSS_FALLBACK = 0.3
export const TRIBULATION_DEFEAT_CULTIVATION_LOSS_FLOOR = 0.2

export const TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_BY_REALM: Record<string, number> = {
  qi_refining: 50,
  foundation_establishment: 200,
}

export const TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_FALLBACK = 2000

const CHAPTERS_BY_REALM: Record<string, readonly TribulationChapterProfile[]> = {
  // Quán Khí (Phàm Nhân → Luyện Khí) — 2 chương: Tâm Ma → Lôi (tank hợp
  // nhất, lôi nhẹ). Số câu tâm ma: 3 (spec §5.3 — gate đầu).
  qi_refining: [
    {
      kind: 'mind',
      name: 'Tâm Ma Kiếp',
      description: 'Tâm ma vấn đạo — trả lời đúng để tâm trí vững vàng trước thiên lôi.',
      mind: { questionCount: 3, firstQuestionSeconds: 12, lastQuestionSeconds: 8, restSecondsBetweenQuestions: 1.5 },
    },
    {
      kind: 'lightning',
      name: 'Lôi Kiếp',
      description: 'Thiên lôi giáng xuống — trụ vững thân thể cho đến khi kiếp tan.',
      tank: { durationSeconds: 15, strikeIntervalSeconds: 3, lightningMaxHpDamagePercent: 0.07 },
    },
  ],
  // Trúc Cơ (Luyện Khí → Trúc Cơ) — 3 chương: Tâm Ma → Thân → Lôi
  // (dồn dập + đại lôi). Số câu tâm ma: 4.
  foundation_establishment: [
    {
      kind: 'mind',
      name: 'Tâm Ma Kiếp',
      description: 'Tâm ma vấn đạo — câu hỏi càng về sau càng gấp gáp.',
      mind: { questionCount: 4, firstQuestionSeconds: 10, lastQuestionSeconds: 6, restSecondsBetweenQuestions: 1.5 },
    },
    {
      kind: 'body',
      name: 'Thân Kiếp',
      description: 'Lôi hỏa rèn thân — lôi kích đều đặn, máu phải trụ được.',
      tank: { durationSeconds: 20, strikeIntervalSeconds: 2, lightningMaxHpDamagePercent: 0.1 },
    },
    {
      kind: 'lightning',
      name: 'Lôi Kiếp',
      description: 'Cửu tiêu thần lôi — đợt dồn dập khép lại bằng một đạo đại lôi.',
      tank: { durationSeconds: 18, strikeIntervalSeconds: 1.5, lightningMaxHpDamagePercent: 0.13, finalStrikeMaxHpDamagePercent: 0.3 },
    },
  ],
}

export function getTribulationChapters(targetRealmId: string): readonly TribulationChapterProfile[] | undefined {
  return CHAPTERS_BY_REALM[targetRealmId]
}
