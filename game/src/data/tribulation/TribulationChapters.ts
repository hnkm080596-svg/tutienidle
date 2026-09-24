import type { ResolvableKienCoGrade } from '../breakthrough/BreakthroughGrades'

// He Loi Kiep moi (spec dot-pha-loi-kiep sec.5) - chuong kiep theo realm,
// KHONG quai Kiep: Tam Ma (minigame hoi dap) + Than/Loi (tank loi).
// So lieu first-pass theo spec sec.5.4, playtest chinh (spec sec.9).

export type TribulationChapterKind = 'mind' | 'body' | 'lightning'

export interface MindTrialProfile {
  questionCount: number
  /** Thoi gian cau DAU (giay) - giam dan toi lastQuestionSeconds o cau cuoi. */
  firstQuestionSeconds: number
  lastQuestionSeconds: number
  /** Nghi giua 2 cau (giay). */
  restSecondsBetweenQuestions: number
}

export interface TankTrialProfile {
  durationSeconds: number
  strikeIntervalSeconds: number
  /** %maxHP moi loi kich (fraction). */
  lightningMaxHpDamagePercent: number
  /** Dai loi cuoi chuong (chi lightning) - undefined = khong co. */
  finalStrikeMaxHpDamagePercent?: number
}

export interface TribulationChapterProfile {
  kind: TribulationChapterKind
  name: string
  description: string
  mind?: MindTrialProfile
  tank?: TankTrialProfile
}

// He so kho theo bac da chot (spec sec.5.5): nhan vao so loi + %maxHP +
// toc do tam ma. Chuan bi tot -> kiep kho hon -> passive manh hon.
// Hidden Perfection Lineage (2026-09-23): the 'great_dao' difficulty
// row retired - design defines no separate hidden challenge, so a
// hidden-typed run rides its RESOLVABLE quality grade like any other.
export const GRADE_DIFFICULTY_MULTIPLIER: Record<ResolvableKienCoGrade, number> = {
  human: 1,
  earth: 1.15,
  heaven: 1.3,
}

// Phat that bai chuan hoa theo realm (spec sec.5.7) - tu vi giam dan theo
// realm (san 0.2, fallback 0.3 cho realm chua khai), Linh Thach scale
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
  // Quan Khi (Pham Nhan -> Luyen Khi) - 2 chuong: Tam Ma -> Loi (tank hop
  // nhat, loi nhe). So cau tam ma: 3 (spec sec.5.3 - gate dau).
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
  // Truc Co (Luyen Khi -> Truc Co) - 3 chuong: Tam Ma -> Than -> Loi
  // (don dap + dai loi). So cau tam ma: 4.
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
