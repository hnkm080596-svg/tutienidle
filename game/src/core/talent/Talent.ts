export type TalentRarity = 'pham' | 'linh' | 'dia' | 'thien' | 'di'

export type TalentTag =
  | 'cultivation'
  | 'combat'
  | 'defense'
  | 'resource'
  | 'crafting'
  | 'element'
  | 'skill'
  | 'risk_reward'
  | 'mechanic'

export interface TalentDefinition {
  id: string
  name: string
  description: string
  rarity: TalentRarity
  weight: number
  tags: TalentTag[]
}

export const TALENT_RARITY_LABELS: Record<TalentRarity, string> = {
  pham: 'Phàm',
  linh: 'Linh',
  dia: 'Địa',
  thien: 'Thiên',
  di: 'Dị',
}
