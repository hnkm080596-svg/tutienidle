export interface EquipmentDisplay {
  id: string
  name: string
  icon: string
  slot: string
  grade: string
  level: string
  enhancement: string
  description: string
  stats: readonly { label: string; value: string }[]
  tone: string
}
export interface EquipmentSocket { id: string; label: string; item: EquipmentDisplay | null }
