import type { Reward } from '../../core/reward/Reward'
import type { RecurringCadence, RecurringRealmBand } from '../../core/quest/recurring/RecurringSchedule'

export type RecurringV2ObjectiveKind =
  | 'enemy_defeated'
  | 'material_delivered'
  | 'production_batch_claimed'
  | 'alchemy_crafted'
  | 'cultivation_session_committed'
  | 'equipment_enhanced'
  | 'body_refinement_committed'
  | 'battle_victory'

export interface RecurringV2Objective {
  kind: RecurringV2ObjectiveKind
  amount: number
  materialIdByRealm?: Partial<Record<RecurringRealmBand, string>>
  /** D4 binds one variant when the board is assigned. */
  variantsByRealm?: Partial<Record<RecurringRealmBand, RecurringV2Objective>>
}

export interface RecurringV2Template {
  id: string
  cadence: RecurringCadence
  title: string
  description: string
  objective: RecurringV2Objective
  rewardBase: Reward
  /** Possible producers across variants, not a requirement to unlock every kind. */
  requiresProducer: RecurringV2ObjectiveKind[]
}

const oreByRealm: Record<RecurringRealmBand, string> = {
  mortal: 'material_spirit_ore_decade',
  qi_refining: 'material_spirit_ore_decade',
  foundation_establishment: 'material_spirit_ore_decade',
}

export const RECURRING_V2_CONTENT_VERSION = 'thanh-van-v2.1'

/** Authored prototypes. They are not released until producer eligibility is proven. */
export const RECURRING_V2_TEMPLATES: readonly RecurringV2Template[] = [
  {
    id: 'tvdm2_daily_d1', cadence: 'daily', title: 'Tảo trừ yêu khí',
    description: 'Hạ 5 địch trong vùng phù hợp cảnh giới.',
    objective: { kind: 'enemy_defeated', amount: 5 },
    rewardBase: { spiritStone: 5, cultivation: 10 }, requiresProducer: ['enemy_defeated'],
  },
  {
    id: 'tvdm2_daily_d2', cadence: 'daily', title: 'Quặng cho ngày mai',
    description: 'Nhận mới 4 Thập Niên Linh Khoáng.',
    objective: { kind: 'material_delivered', amount: 4, materialIdByRealm: oreByRealm },
    rewardBase: { spiritStone: 6, cultivation: 10 }, requiresProducer: ['material_delivered'],
  },
  {
    id: 'tvdm2_daily_d3', cadence: 'daily', title: 'Chăm mạch linh điền',
    description: 'Nhận thành phẩm từ 2 lứa sản xuất.',
    objective: { kind: 'production_batch_claimed', amount: 2 },
    rewardBase: { spiritStone: 4, cultivation: 20 }, requiresProducer: ['production_batch_claimed'],
  },
  {
    id: 'tvdm2_daily_d4', cadence: 'daily', title: 'Ngày dưỡng khí',
    description: 'Phàm thu Linh Mộc, cảnh giới cao hơn luyện đan thành công.',
    objective: {
      kind: 'material_delivered', amount: 4,
      variantsByRealm: {
        mortal: { kind: 'material_delivered', amount: 4, materialIdByRealm: { mortal: 'material_spirit_wood_decade' } },
        qi_refining: { kind: 'alchemy_crafted', amount: 1 },
        foundation_establishment: { kind: 'alchemy_crafted', amount: 1 },
      },
    },
    rewardBase: { spiritStone: 5, cultivation: 10 },
    requiresProducer: ['material_delivered', 'alchemy_crafted'],
  },
  {
    id: 'tvdm2_daily_d5', cadence: 'daily', title: 'Một lần tĩnh tu',
    description: 'Hoàn tất 1 lần tu luyện có tăng tu vi thực.',
    objective: { kind: 'cultivation_session_committed', amount: 1 },
    rewardBase: { spiritStone: 5, cultivation: 15 }, requiresProducer: ['cultivation_session_committed'],
  },
  {
    id: 'tvdm2_daily_d6', cadence: 'daily', title: 'Tôi luyện thường nhật',
    description: 'Cường hóa trang bị thành công 1 lần.',
    objective: { kind: 'equipment_enhanced', amount: 1 },
    rewardBase: { spiritStone: 8, cultivation: 10 }, requiresProducer: ['equipment_enhanced'],
  },
  {
    id: 'tvdm2_daily_d7', cadence: 'daily', title: 'Thể phách ngày mới',
    description: 'Luyện Thể tiến triển thành công 1 lần.',
    objective: { kind: 'body_refinement_committed', amount: 1 },
    rewardBase: { spiritStone: 9, cultivation: 10 }, requiresProducer: ['body_refinement_committed'],
  },
  {
    id: 'tvdm2_weekly_w1', cadence: 'weekly', title: 'Thanh Vân trừ họa',
    description: 'Hạ 25 địch thuộc vùng và cảnh giới phù hợp trong tuần.',
    objective: { kind: 'enemy_defeated', amount: 25 },
    rewardBase: { spiritStone: 20, cultivation: 40 }, requiresProducer: ['enemy_defeated'],
  },
  {
    id: 'tvdm2_weekly_w2', cadence: 'weekly', title: 'Tích khoáng thất nhật',
    description: 'Thu mới 20 Thập Niên Linh Khoáng.',
    objective: { kind: 'material_delivered', amount: 20, materialIdByRealm: oreByRealm },
    rewardBase: { spiritStone: 20, cultivation: 40 }, requiresProducer: ['material_delivered'],
  },
  {
    id: 'tvdm2_weekly_w3', cadence: 'weekly', title: 'Bội thu linh mạch',
    description: 'Quyết toán 8 lứa sản xuất hợp lệ trong tuần.',
    objective: { kind: 'production_batch_claimed', amount: 8 },
    rewardBase: { spiritStone: 18, cultivation: 50 }, requiresProducer: ['production_batch_claimed'],
  },
  {
    id: 'tvdm2_weekly_w4', cadence: 'weekly', title: 'Tám trận tinh luyện',
    description: 'Chiến thắng trọn vẹn 8 trận trong tuần.',
    objective: { kind: 'battle_victory', amount: 8 },
    rewardBase: { spiritStone: 24, cultivation: 40 }, requiresProducer: ['battle_victory'],
  },
  {
    id: 'tvdm2_weekly_w5', cadence: 'weekly', title: 'Dược hỏa duy trì',
    description: 'Luyện thành công 3 lò đan.',
    objective: { kind: 'alchemy_crafted', amount: 3 },
    rewardBase: { spiritStone: 24, cultivation: 50 }, requiresProducer: ['alchemy_crafted'],
  },
  {
    id: 'tvdm2_weekly_w6', cadence: 'weekly', title: 'Binh khí tinh luyện',
    description: 'Cường hóa trang bị thành công 3 lần.',
    objective: { kind: 'equipment_enhanced', amount: 3 },
    rewardBase: { spiritStone: 30, cultivation: 50 }, requiresProducer: ['equipment_enhanced'],
  },
  {
    id: 'tvdm2_weekly_w7', cadence: 'weekly', title: 'Cường thân thủ mạch',
    description: 'Luyện Thể tiến triển thành công 3 lần.',
    objective: { kind: 'body_refinement_committed', amount: 3 },
    rewardBase: { spiritStone: 34, cultivation: 50 }, requiresProducer: ['body_refinement_committed'],
  },
] as const

/** Resolve the objective at assignment time; retain this variant across realm changes. */
export function resolveRecurringV2Objective(
  template: RecurringV2Template,
  realmBand: RecurringRealmBand,
): RecurringV2Objective | null {
  const objective = template.objective.variantsByRealm?.[realmBand] ?? template.objective
  if (objective.materialIdByRealm && !objective.materialIdByRealm[realmBand]) return null
  return {
    kind: objective.kind,
    amount: objective.amount,
    ...(objective.materialIdByRealm
      ? { materialIdByRealm: { [realmBand]: objective.materialIdByRealm[realmBand] } }
      : {}),
  }
}
