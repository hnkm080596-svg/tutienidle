// Task 19 (item-grade-quality-rework, rework P6) - extracted shared
// helper used identically by EnhanceTab/WashTab/RefineTab: "equipped
// slot metadata" (name/icon/tooltip/rank) built off gameManager.equipmentBag,
// plus the "6 slots always exist" row shape shared by Wash/Refine.
// Kept as an importable composable (not provide/inject) per Task 19 brief
// item 6 - each tab imports what it needs itself.
import { computed, type ComputedRef, type Ref } from 'vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'
import type { EquipmentSlot } from '@/core/equipment/EquipmentTypes'
import { buildEquipmentTooltip } from '@/composables/useEquipmentTooltip'
import { composeEquipmentNameSegments } from '@/core/equipment/EquipmentNaming'
import { gradeLabel } from '@/core/presentation/labels'
import { itemQualityRank, professionGradeRank } from '@/core/profession/slotRank'
import { EQUIPMENT_SLOTS } from '@/core/equipment/EquipmentSlotState'

export interface EquippedRow {
  instance: EquipmentInstance

  instanceId: string

  slot: EquipmentSlot

  name: string

  // spec section 5b - "{name}, {grade}" so aria includes Pham (the seal
  // is a decorative glyph; screen readers get the grade through this label).
  accessibleLabel: string

  quality: EquipmentInstance['quality']

  affixCount: number

  icon?: string

  nameSegments: ReturnType<typeof composeEquipmentNameSegments>

  // Audit fix 2026-08-31 - registry miss (itemId la) -> khong co tooltip
  // (buildEquipmentTooltip doi template that); template consumers da
  // fallback `?.tooltip ?? { title/description slot trong }`.
  tooltip?: ReturnType<typeof buildEquipmentTooltip>

  // Rework P6 (item-grade-quality-rework, final-review round 2) - renamed
  // from qualityRank/rarityRank (which held content INVERSE to their
  // names: qualityRank was actually the GRADE rank, rarityRank was the
  // QUALITY rank - leftover from the deleted rarity axis). Field names
  // now match content; SlotView's own props (equipmentQualityRank/
  // rarityRank) are UNCHANGED - see the template bindings in
  // WashTab/RefineTab/EnhanceTab/DissolveTab.vue that map gradeRank->
  // equipment-quality-rank and qualityRank->rarity-rank.
  gradeRank: number

  qualityRank: number
}

export function useEquippedRows() {
  const gameManager = useGameManager()

  const { stateVersion } = useStateVersion()

  const equippedRows = computed<EquippedRow[]>(() => {
    stateVersion.value

    return gameManager.equipmentBag.getEquipped().map((instance) => {
      // Audit fix 2026-08-31 - equipmentRegistry.get() THROW voi itemId
      // la (data edit/save lech) tung chet ca panel qua ErrorBoundary;
      // getEquipmentTemplate() tra an toan tra undefined (GameManager.ts).
      const template = gameManager.equipmentOps.getEquipmentTemplate(instance.itemId)

      // G1 (Mission G Task 37) - the tooltip contract requires the
      // authoritative range quote; a miss = malformed item data.
      const mainStatRangeQuote = template
        ? gameManager.equipmentSystem.quoteMainStatRange(instance, gameManager.equipmentRegistry)
        : undefined

      return {
        instance,

        instanceId: instance.instanceId,

        slot: instance.slot,

        name: template?.name ?? instance.itemId,

        accessibleLabel: `${template?.name ?? instance.itemId}, ${gradeLabel(instance.grade)}`,

        quality: instance.quality,

        affixCount: instance.affixes.length,

        icon: instance.icon ?? template?.icon,

        // Registry miss -> hien thi itemId tho (pattern
        // EquipmentBagSection.vue:82-84); composeEquipmentNameSegments
        // KHONG nhan template nullable nen goi co dieu kien.
        nameSegments: template
          ? composeEquipmentNameSegments(instance, template, gameManager.zoneRegistry)
          : [{ text: instance.itemId }],

        // buildEquipmentTooltip doi template that - registry miss thi
        // KHONG co tooltip (SlotView tooltip optional), khong chet panel.
        // G1 (Task 37): the quote is required too - a miss means malformed
        // item data, same drop rule.
        tooltip: template && mainStatRangeQuote
          ? buildEquipmentTooltip(
              instance,
              template,
              gameManager.affixRegistry,
              gameManager.equipmentOps.getSlotState(instance.slot),
              gameManager.zoneRegistry,
              // No compare context (item-info-card spec section 4): these
              // rows ARE the equipped items - an equipped item is the
              // compare counterpart, never a candidate for one.
              undefined,
              mainStatRangeQuote,
            )
          : undefined,

        gradeRank: professionGradeRank(instance.grade),

        qualityRank: itemQualityRank(instance.quality),
      }
    })
  })

  return { equippedRows }
}

/**
 * 6 O TRANG BI LUON TON TAI (2026-08-30 spec) - tham chieu truc tiep
 * equipped-or-trong theo SLOT, dung CHUNG cho ca tab Tay/Tinh Luyen
 * (Cuong Hoa dung enhanceRows cung shape/muc dich rieng, khong dung cai nay).
 */
export interface HallSlotRow {
  slot: EquipmentSlot

  equippedRow?: EquippedRow
}

export function useHallSlotRows(equippedRows: ComputedRef<EquippedRow[]>) {
  return computed<HallSlotRow[]>(() => {
    const equippedRowBySlot = new Map(equippedRows.value.map((row) => [row.slot, row]))

    return EQUIPMENT_SLOTS.map((slot) => ({ slot, equippedRow: equippedRowBySlot.get(slot) }))
  })
}

/** Diem Ren PER-ITEM (rework 2026-08-26) = "Tinh trang ren" trong tooltip
 * - forgeUsesRemaining / forgeUsesTotal. Tay/Tinh Luyen tieu thu ngan
 * sach nay cua CHINH mon do. Dung chung cho Wash/Refine tab. */
export function useItemRenState(selectedInstanceId: Ref<string | null> | ComputedRef<string | null>) {
  const gameManager = useGameManager()

  const { stateVersion } = useStateVersion()

  return computed<{ points: number; max: number } | null>(() => {
    stateVersion.value

    if (!selectedInstanceId.value) {
      return null
    }

    const instance = gameManager.equipmentBag.get(selectedInstanceId.value)

    if (!instance) {
      return null
    }

    return {
      points: gameManager.equipmentOps.itemRefinementPoints(instance),

      max: instance.forgeUsesTotal,
    }
  })
}
