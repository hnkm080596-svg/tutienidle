import type { Affix } from './Affix'
import {
  EQUIPMENT_SLOT_STAT_POLICY,
  isForbiddenEquipmentStat,
  isValidEquipmentSubstat,
} from './EquipmentStatPolicy'

export class AffixRegistry {
  private readonly affixes = new Map<string, Affix>()

  register(affix: Affix): void {
    if (this.affixes.has(affix.id)) {
      throw new Error(`Affix already registered: ${affix.id}`)
    }

    if (isForbiddenEquipmentStat(affix.stat)) {
      throw new Error(`Forbidden equipment stat on affix ${affix.id}: ${affix.stat}`)
    }

    const slots =
      affix.slots ??
      (Object.keys(EQUIPMENT_SLOT_STAT_POLICY) as Array<keyof typeof EQUIPMENT_SLOT_STAT_POLICY>)
    const validSlots = slots.filter((slot) => isValidEquipmentSubstat(slot, affix.stat))

    if (validSlots.length === 0) {
      throw new Error(`Affix ${affix.id} is not allowed by any declared equipment slot policy`)
    }

    this.affixes.set(affix.id, { ...affix, slots: validSlots })
  }

  get(affixId: string): Affix {
    const affix = this.affixes.get(affixId)

    if (!affix) {
      throw new Error(`Affix not found: ${affixId}`)
    }

    return affix
  }

  has(affixId: string): boolean {
    return this.affixes.has(affixId)
  }

  getAll(): Affix[] {
    return Array.from(this.affixes.values())
  }

  getByKind(kind: Affix['kind']): Affix[] {
    return this.getAll().filter((affix) => affix.kind === kind)
  }
}
