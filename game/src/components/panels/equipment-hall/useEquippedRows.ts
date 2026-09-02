// Task 19 (item-grade-quality-rework, rework P6) — extracted shared
// helper used identically by EnhanceTab/WashTab/RefineTab: "equipped
// slot metadata" (name/icon/tooltip/rank) built off gameManager.equipmentBag,
// plus the "6 slots always exist" row shape shared by Wash/Refine.
// Kept as an importable composable (not provide/inject) per Task 19 brief
// item 6 — each tab imports what it needs itself.
import { computed, type ComputedRef } from 'vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'
import type { EquipmentSlot } from '@/core/equipment/EquipmentTypes'
import { getRealmIdForProfessionGrade } from '@/core/profession/ProfessionGrade'
import { buildEquipmentTooltip } from '@/composables/useEquipmentTooltip'
import { composeEquipmentNameSegments } from '@/core/equipment/EquipmentNaming'
import { itemGradeRank, professionGradeRank } from '@/composables/slots/normalizeSlotRank'
import { EQUIPMENT_SLOTS } from '@/core/equipment/EquipmentSlotState'

export interface EquippedRow {
  instance: EquipmentInstance

  instanceId: string

  slot: EquipmentSlot

  name: string

  realmId: string

  quality: EquipmentInstance['quality']

  rarity: EquipmentInstance['quality']

  affixCount: number

  icon?: string

  nameSegments: ReturnType<typeof composeEquipmentNameSegments>

  // Audit fix 2026-08-31 — registry miss (itemId lạ) → không có tooltip
  // (buildEquipmentTooltip đòi template thật); template consumers đã
  // fallback `?.tooltip ?? { title/description slot trống }`.
  tooltip?: ReturnType<typeof buildEquipmentTooltip>

  qualityRank: number

  rarityRank: number
}

export function equipmentRealmId(instance: EquipmentInstance): string {
  const realmId = getRealmIdForProfessionGrade(instance.grade)

  if (!realmId) {
    throw new Error(`Missing realm for equipment grade ${instance.grade}`)
  }

  return realmId
}

export function useEquippedRows() {
  const gameManager = useGameManager()

  const { stateVersion } = useStateVersion()

  const equippedRows = computed<EquippedRow[]>(() => {
    stateVersion.value

    return gameManager.equipmentBag.getEquipped().map((instance) => {
      // Audit fix 2026-08-31 — equipmentRegistry.get() THROW với itemId
      // lạ (data edit/save lệch) từng chết cả panel qua ErrorBoundary;
      // getEquipmentTemplate() tra an toàn trả undefined (GameManager.ts).
      const template = gameManager.getEquipmentTemplate(instance.itemId)

      return {
        instance,

        instanceId: instance.instanceId,

        slot: instance.slot,

        name: template?.name ?? instance.itemId,

        realmId: equipmentRealmId(instance),

        quality: instance.quality,

        rarity: instance.quality,

        affixCount: instance.affixes.length,

        icon: instance.icon ?? template?.icon,

        // Registry miss → hiển thị itemId thô (pattern
        // EquipmentBagSection.vue:82-84); composeEquipmentNameSegments
        // KHÔNG nhận template nullable nên gọi có điều kiện.
        nameSegments: template
          ? composeEquipmentNameSegments(instance, template, gameManager.zoneRegistry)
          : [{ text: instance.itemId }],

        // buildEquipmentTooltip đòi template thật — registry miss thì
        // KHÔNG có tooltip (SlotView tooltip optional), không chết panel.
        tooltip: template
          ? buildEquipmentTooltip(
              instance,
              template,
              gameManager.affixRegistry,
              gameManager.getSlotState(instance.slot),
              gameManager.zoneRegistry,
            )
          : undefined,

        qualityRank: professionGradeRank(instance.grade),

        rarityRank: itemGradeRank(instance.quality),
      }
    })
  })

  return { equippedRows }
}

/**
 * 6 Ô TRANG BỊ LUÔN TỒN TẠI (2026-08-30 spec) — tham chiếu trực tiếp
 * equipped-or-trống theo SLOT, dùng CHUNG cho cả tab Tẩy/Tinh Luyện
 * (Cường Hóa dùng enhanceRows cùng shape/mục đích riêng, không dùng cái này).
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

/** Điểm Rèn PER-ITEM (rework 2026-08-26) = "Tình trạng rèn" trong tooltip
 * — forgeUsesRemaining / forgeUsesTotal. Tẩy/Tinh Luyện tiêu thụ ngân
 * sách này của CHÍNH món đồ. Dùng chung cho Wash/Refine tab. */
export function useItemRenState(selectedInstanceId: ComputedRef<string | null> | { value: string | null }) {
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
      points: gameManager.itemRefinementPoints(instance),

      max: instance.forgeUsesTotal,
    }
  })
}
