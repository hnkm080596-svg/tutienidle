import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

export type EquipmentPreviewTab = 'equipment' | 'enhance' | 'wash' | 'refine'
export type EquipmentPreviewSlot = 'weapon' | 'armor' | 'boots' | 'helmet' | 'necklace' | 'ring'
export type EquipmentPreviewFilter = 'all' | 'weapon' | 'armor' | 'jewelry' | 'other'
export interface EquipmentPreviewItem {
  id: string
  slot: EquipmentPreviewSlot
  icon: string
  quality: 'gold' | 'blue' | 'purple'
}
export interface EquipmentPreviewStat {
  id: string
  glyph: string
  current: string
  next: string
  color: string
  fill: number
}

export const equipmentTabs: readonly EquipmentPreviewTab[] = [
  'equipment',
  'enhance',
  'wash',
  'refine',
]
export const equipmentSlots: readonly EquipmentPreviewSlot[] = [
  'weapon',
  'armor',
  'boots',
  'helmet',
  'necklace',
  'ring',
]
export const equipmentFilters: readonly EquipmentPreviewFilter[] = [
  'all',
  'weapon',
  'armor',
  'jewelry',
  'other',
]
const itemFamilies: Record<EquipmentPreviewSlot, string> = {
  weapon: 'kiem',
  armor: 'bao',
  boots: 'hai',
  helmet: 'quan',
  necklace: 'truy',
  ring: 'gioi',
}
export function equipmentItemIcon(slot: EquipmentPreviewSlot, variant = 5): string {
  const family = itemFamilies[slot]
  return resolveAssetUrl(`/assets/equipment/items/base-${family}/${family}-0${variant}.png`)
}
export const equipmentItems: readonly EquipmentPreviewItem[] = equipmentSlots.flatMap((slot) =>
  [5, 4, 3].map((variant, index) => ({
    id: `${slot}-${variant}`,
    slot,
    icon: equipmentItemIcon(slot, variant),
    quality: (['gold', 'blue', 'purple'] as const)[index]!,
  })),
)
export const equipmentStats: readonly EquipmentPreviewStat[] = [
  { id: 'hp', glyph: '♥', current: '+1.800', next: '+1.950', color: '#d8b15a', fill: 76 },
  { id: 'attack', glyph: '⚔', current: '+220', next: '+240', color: '#58b9e1', fill: 54 },
  { id: 'defense', glyph: '◈', current: '+150', next: '+165', color: '#bb8dde', fill: 45 },
  { id: 'mana', glyph: '☯', current: '+400', next: '+440', color: '#70b994', fill: 60 },
  { id: 'critical', glyph: '✧', current: '+5%', next: '+5,5%', color: '#c99bdc', fill: 65 },
  { id: 'speed', glyph: '➶', current: '+12%', next: '+13%', color: '#74c393', fill: 42 },
]
export const refineStats = [
  equipmentStats[0]!,
  equipmentStats[1]!,
  equipmentStats[2]!,
  equipmentStats[5]!,
]
export const washStats = [
  equipmentStats[1]!,
  equipmentStats[4]!,
  equipmentStats[0]!,
  equipmentStats[5]!,
]
export { equipmentArt, equipmentArtRoot } from '@/components/common/art/equipmentArt'
