<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useEquipmentActions } from '@/composables/useEquipmentActions'
import { usePanelPagination } from '@/composables/usePanelPagination'
import {
  equipmentEssenceMaterialId,
} from '@/core/equipment/RefinementBalance'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'
import type { EquipmentSlot } from '@/core/equipment/EquipmentTypes'
import type { RolledAffix } from '@/core/equipment/RolledAffix'
import { materialLabel, affixLabel, equipmentSlotLabel, equipmentQualityLabel } from '@/core/presentation/labels'
import { statLabel } from '@/core/stats/StatLabels'
import { useActionFeedbackStore } from '@/stores/actionFeedback'
import { getSpiritStoneMaterialIdForEnhanceLevel } from '@/core/material/SpiritStoneMaterial'
import SlotView from '@/components/common/SlotView.vue'
import { EQUIPMENT_SLOTS } from '@/core/equipment/EquipmentSlotState'
import { buildEquipmentTooltip } from '@/composables/useEquipmentTooltip'
import { composeEquipmentNameSegments } from '@/core/equipment/EquipmentNaming'
import { equipmentQualityRank, itemGradeRank } from '@/composables/slots/normalizeSlotRank'
import GameButton from '@/components/common/GameButton.vue'
import TabBar from '@/components/common/TabBar.vue'
import Eyebrow from '@/components/common/primitives/Eyebrow.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import {
  getMaxForgePoints,
  calculateEquipmentScale,
  getEffectiveAffixValue,
  type RefineValueEntry,
} from '@/core/equipment/EquipmentSystem'

// Khí Đường (2026-08-25, resource-professions-rework plan §7/§9.2) —
// bốn tab ĐÚNG contract: Cường Hóa (slot), Tẩy Luyện (identity substat
// theo phẩm Quáng), Tinh Luyện (±20% giá trị + khóa dòng N+L), Hóa
// Luyện (destructive → Tinh Hoa, batch all-or-nothing).
//
// Redesign 2-cột "hiện tại / sau khi dùng chức năng" + preview-giữ-bỏ
// cho Tẩy/Tinh Luyện (2026-08-30, bug report — bố cục cũ trống trải,
// roll áp thẳng không cho xem trước rồi mới quyết định). Cường Hóa là
// phép tính XÁC ĐỊNH (không random) nên cột "sau" chỉ hiển thị kết quả
// tính trước, không cần cơ chế giữ/bỏ.
const TABS = [
  { id: 'enhance', label: 'Cường Hóa' },
  { id: 'wash', label: 'Tẩy Luyện' },
  { id: 'refine', label: 'Tinh Luyện' },
  { id: 'dissolve', label: 'Hóa Luyện' },
] as const

type TabId = (typeof TABS)[number]['id']

const player = usePlayerStore()

const gameManager = useGameManager()

const { stateVersion, bumpState } = useStateVersion()

const { enhance, washPreview, washCommit, refinePreview, refineCommit, dissolve } = useEquipmentActions()

const feedback = useActionFeedbackStore()

const activeTab = ref<TabId>('enhance')

// Preview đang chờ "giữ/bỏ" của Tẩy/Tinh Luyện — reset khi đổi tab,
// đổi trang bị chọn, đổi Quáng, hoặc đổi dòng khóa (kết quả cũ không
// còn khớp điều kiện mới).
const pendingWashAffixes = ref<RolledAffix[] | null>(null)

const pendingRefineValues = ref<RefineValueEntry[] | null>(null)

function switchTab(tab: TabId) {
  activeTab.value = tab

  pendingWashAffixes.value = null

  pendingRefineValues.value = null
}

// =========================
// Dữ liệu chung — slot đang mặc + bag
// =========================

interface EquippedRow {
  instance: EquipmentInstance

  instanceId: string

  slot: EquipmentSlot

  name: string

  realmId: string

  quality: string

  affixCount: number

  icon?: string

  nameSegments: ReturnType<typeof composeEquipmentNameSegments>

  tooltip: ReturnType<typeof buildEquipmentTooltip>

  qualityRank: number

  rarityRank: number
}

const equippedRows = computed<EquippedRow[]>(() => {
  stateVersion.value

  return gameManager.equipmentBag.getEquipped().map((instance) => {
    const template = gameManager.equipmentRegistry.get(instance.itemId)

    return {
      instance,

      instanceId: instance.instanceId,

      slot: instance.slot,

      name: template?.name ?? instance.itemId,

      realmId: instance.realmId,

      quality: instance.quality,

      affixCount: instance.affixes.length,

      icon: instance.icon ?? template?.icon,

      nameSegments: template
        ? composeEquipmentNameSegments(instance, template, gameManager.zoneRegistry)
        : [{ text: instance.itemId }],

      tooltip: buildEquipmentTooltip(
        instance,
        gameManager.equipmentRegistry.get(instance.itemId),
        gameManager.affixRegistry,
        gameManager.getSlotState(instance.slot),
        gameManager.zoneRegistry,
      ),

      qualityRank: equipmentQualityRank(instance.quality),

      rarityRank: itemGradeRank(instance.rarity),
    }
  })
})

const selectedInstanceId = ref<string | null>(null)

const selectedRow = computed(
  () => equippedRows.value.find((row) => row.instanceId === selectedInstanceId.value) ?? null,
)

// =========================
// Điểm Rèn PER-ITEM (rework 2026-08-26) = "Tình trạng rèn" trong
// tooltip — forgePoints / getMaxForgePoints(quality, forgePotential).
// Tẩy/Tinh Luyện tiêu thụ ngân sách này của CHÍNH món đồ.
// =========================

const itemRenState = computed<{ points: number; max: number } | null>(() => {
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

    max: getMaxForgePoints(instance.quality, instance.forgePotential),
  }
})

function selectEquipped(instanceId: string) {
  selectedInstanceId.value = instanceId

  lockedIndices.value = []

  selectedOreId.value = null

  pendingWashAffixes.value = null

  pendingRefineValues.value = null
}

function clearSelection() {
  selectedInstanceId.value = null

  lockedIndices.value = []

  selectedOreId.value = null

  pendingWashAffixes.value = null

  pendingRefineValues.value = null
}

/**
 * 6 Ô TRANG BỊ LUÔN TỒN TẠI (2026-08-30 spec) — tham chiếu trực tiếp
 * equipped-or-trống theo SLOT, dùng CHUNG cho cả 3 tab Tẩy/Tinh Luyện
 * (Cường Hóa đã có enhanceRows cùng shape/mục đích, giữ nguyên). Bấm ô
 * trống → clearSelection() (không có instance để Tẩy/Tinh Luyện).
 */
interface HallSlotRow {
  slot: EquipmentSlot

  equippedRow?: EquippedRow
}

const hallSlotRows = computed<HallSlotRow[]>(() => {
  const equippedRowBySlot = new Map(equippedRows.value.map((row) => [row.slot, row]))

  return EQUIPMENT_SLOTS.map((slot) => ({ slot, equippedRow: equippedRowBySlot.get(slot) }))
})

function selectHallSlotForAction(row: HallSlotRow) {
  if (row.equippedRow) {
    selectEquipped(row.equippedRow.instanceId)
  } else {
    clearSelection()
  }
}

/** Chọn ore cùng realm cho Tẩy Luyện — chỉ hiện stack người chơi có. */
const oreChoices = computed(() => {
  stateVersion.value

  if (!selectedRow.value) {
    return []
  }

  const prefix = `${selectedRow.value.realmId}_ore_`

  return gameManager.materialBag
    .getAll()
    .filter((stack) => stack.material.id.startsWith(prefix))
    .map((stack) => ({
      materialId: stack.material.id,

      name: stack.material.name,

      owned: stack.amount,
    }))
})

const selectedOreId = ref<string | null>(null)

watch(selectedOreId, () => {
  pendingWashAffixes.value = null
})

// =========================
// Tab Cường Hóa
// =========================

interface EnhanceSlotRow {
  slot: EquipmentSlot

  itemName: string

  enhanceLevel: number

  maxLevel: number

  costs: Array<{ materialId: string; label: string; amount: number; owned: number }>

  spiritStone: number
  spiritStoneMaterialId: string
  spiritStoneOwned: number

  equippedRow?: EquippedRow
}

const enhanceRows = computed<EnhanceSlotRow[]>(() => {
  stateVersion.value

  // Slot-level rework (yêu cầu 2026-08-26): Cường Hóa gắn SLOT —
  // slot TRỐNG vẫn hiện trần/cost và nâng được; realmId lấy theo người
  // chơi hiện hành để resolve catalog nghề.
  const realmId = player.$state.realmId

  const equippedRowBySlot = new Map(equippedRows.value.map((row) => [row.slot, row]))

  return gameManager.getAllSlotStates().map((slotState) => {
    const equipped = gameManager.equipmentBag.getEquippedInSlot(slotState.slot)

    const costs = gameManager.getEnhanceCost(slotState.slot, realmId).map((entry) => ({
      materialId: entry.materialId,

      label: materialLabel(entry.materialId, gameManager.materialRegistry),

      amount: entry.amount,

      owned: gameManager.materialBag.getAmount(entry.materialId),
    }))

    const spiritStone = gameManager.getEnhanceSpiritStoneCost(slotState.slot, realmId)
    const spiritStoneMaterialId = getSpiritStoneMaterialIdForEnhanceLevel(slotState.enhanceLevel)

    const maxLevel = gameManager.getSlotMaxEnhanceLevel(slotState.slot, realmId)

    return {
      slot: slotState.slot,

      itemName: equipped
        ? gameManager.getEquipmentTemplate(equipped.itemId)?.name ?? equipped.itemId
        : '— trống (vẫn cường hóa được) —',

      enhanceLevel: slotState.enhanceLevel,

      maxLevel,

      costs,

      spiritStone,
      spiritStoneMaterialId,
      spiritStoneOwned: gameManager.materialBag.getAmount(spiritStoneMaterialId),

      equippedRow: equippedRowBySlot.get(slotState.slot),
    }
  })
})

const selectedEnhanceSlot = ref<EquipmentSlot>(EQUIPMENT_SLOTS[0]!)

const selectedEnhanceRow = computed(() =>
  enhanceRows.value.find((row) => row.slot === selectedEnhanceSlot.value) ?? null,
)

function selectEnhanceSlot(slot: EquipmentSlot) {
  selectedEnhanceSlot.value = slot
}

function canEnhance(row: EnhanceSlotRow): boolean {
  return (
    row.enhanceLevel < row.maxLevel &&
    row.costs.every((cost) => cost.owned >= cost.amount) &&
    row.spiritStoneOwned >= row.spiritStone
  )
}

function doEnhance(row: EnhanceSlotRow) {
  enhance(row.slot)
}

/** Xem trước "sau Cường Hóa" — xác định (không random), luôn tính được
 * ngay khi có mainStat, không cần preview/giữ/bỏ như Tẩy/Tinh Luyện. */
const enhancePreview = computed(() => {
  stateVersion.value

  const row = selectedEnhanceRow.value

  const instance = row?.equippedRow?.instance

  if (!row || !instance) {
    return null
  }

  const currentScale = calculateEquipmentScale(row.enhanceLevel, instance.forgePoints)

  const nextScale = calculateEquipmentScale(row.enhanceLevel + 1, instance.forgePoints)

  const currentValue = (instance.mainStat.flat ?? 0) * currentScale

  const nextValue = (instance.mainStat.flat ?? 0) * nextScale

  return {
    label: statLabel(instance.mainStat.stat),

    currentValue,

    nextValue,

    percent: currentValue > 0 ? ((nextValue - currentValue) / currentValue) * 100 : 0,
  }
})

// =========================
// Tab Tẩy Luyện — preview/giữ/bỏ (2026-08-30)
// =========================

const washCost = computed(() => {
  stateVersion.value

  return gameManager.getWashCost(selectedRow.value?.realmId)
})

function canWash(): boolean {
  const ren = itemRenState.value

  return (
    selectedRow.value !== null &&
    selectedOreId.value !== null &&
    ren !== null &&
    gameManager.materialBag.getAmount(selectedOreId.value) >= washCost.value.oreAmount &&
    ren.points >= washCost.value.refinementPoints &&
    spiritStoneOwned.value >= washCost.value.spiritStone
  )
}

function doWashPreview() {
  if (!selectedRow.value) {
    feedback.warning('Không thể Tẩy Luyện: cần chọn một trang bị.')

    return
  }

  if (!selectedOreId.value) {
    feedback.warning('Không thể Tẩy Luyện: cần chọn Quáng cùng cảnh giới.')

    return
  }

  const affixes = washPreview(selectedRow.value.instanceId, selectedOreId.value)

  if (affixes) {
    pendingWashAffixes.value = affixes
  }
}

function doWashKeep() {
  if (!selectedRow.value || !pendingWashAffixes.value) {
    return
  }

  if (washCommit(selectedRow.value.instanceId, pendingWashAffixes.value)) {
    pendingWashAffixes.value = null
  }
}

function affixDisplayLabel(rolled: RolledAffix): string {
  const affix = gameManager.affixRegistry.has(rolled.affixId)
    ? gameManager.affixRegistry.get(rolled.affixId)
    : undefined

  return affix
    ? `${affixLabel(rolled.affixId, gameManager.affixRegistry)} (${statLabel(affix.stat)})`
    : affixLabel(rolled.affixId, gameManager.affixRegistry)
}

const pendingWashAffixDisplay = computed(() =>
  (pendingWashAffixes.value ?? []).map((rolled, index) => ({
    index,

    label: affixDisplayLabel(rolled),

    tier: rolled.tier,
  })),
)

// =========================
// Tab Tinh Luyện — khóa dòng + preview/giữ/bỏ (§7.4, 2026-08-30)
// =========================

const selectedAffixes = computed(() => {
  stateVersion.value

  if (!selectedInstanceId.value) {
    return []
  }

  const instance = gameManager.equipmentBag.get(selectedInstanceId.value)

  if (!instance) {
    return []
  }

  return instance.affixes.map((rolled, index) => ({
    index,

    label: affixDisplayLabel(rolled),

    tier: rolled.tier,
  }))
})

/** Giá trị hiệu lực hiện tại của 1 dòng affix (cột "Hiện tại" Tinh Luyện). */
function currentAffixValue(index: number): number | null {
  if (!selectedInstanceId.value) {
    return null
  }

  const instance = gameManager.equipmentBag.get(selectedInstanceId.value)

  const rolled = instance?.affixes[index]

  if (!instance || !rolled) {
    return null
  }

  const affix = gameManager.affixRegistry.has(rolled.affixId)
    ? gameManager.affixRegistry.get(rolled.affixId)
    : undefined

  return affix ? getEffectiveAffixValue(rolled, affix) : rolled.value
}

const lockedIndices = ref<number[]>([])

function toggleLock(index: number) {
  const position = lockedIndices.value.indexOf(index)

  if (position >= 0) {
    lockedIndices.value.splice(position, 1)
  } else if (lockedIndices.value.length < 3) {
    // Không cho khóa toàn bộ: tối đa N-1 (và ≤3).
    if (lockedIndices.value.length + 1 < selectedAffixes.value.length) {
      lockedIndices.value.push(index)
    }
  }

  pendingRefineValues.value = null
}

const refineCost = computed(() => {
  stateVersion.value

  return gameManager.getRefineCost(
    selectedAffixes.value.length,
    lockedIndices.value.length,
    selectedRow.value?.realmId,
  )
})

// Plan Workstream F — số dư Linh Thạch đọc từ MaterialBag. T2 (review
// 2026-08-28): phẩm Linh Thạch cần cho Tẩy/Tinh Luyện resolve theo realm
// trang bị đang chọn — số dư hiển thị đúng phẩm đó.
const spiritStoneCostMaterialId = computed(() => {
  stateVersion.value

  return washCost.value.spiritStoneMaterialId
})

const spiritStoneCostName = computed(() => {
  const id = spiritStoneCostMaterialId.value

  return gameManager.materialRegistry.has(id) ? gameManager.materialRegistry.get(id).name : 'Linh Thạch'
})

const spiritStoneOwned = computed(() => {
  stateVersion.value

  return gameManager.materialBag.getAmount(spiritStoneCostMaterialId.value)
})

const refineEssenceOwned = computed(() => {
  stateVersion.value

  if (!selectedRow.value) {
    return 0
  }

  const essenceId = equipmentEssenceMaterialId(selectedRow.value.realmId)

  return essenceId ? gameManager.materialBag.getAmount(essenceId) : 0
})

function canRefine(): boolean {
  const ren = itemRenState.value

  return (
    selectedAffixes.value.length > 0 &&
    lockedIndices.value.length < selectedAffixes.value.length &&
    refineEssenceOwned.value >= refineCost.value.essenceUnits &&
    spiritStoneOwned.value >= refineCost.value.spiritStone &&
    ren !== null &&
    ren.points >= refineCost.value.refinementPoints
  )
}

function doRefinePreview() {
  if (!selectedRow.value) {
    feedback.warning('Không thể Tinh Luyện: cần chọn một trang bị có ít nhất một dòng phụ.')

    return
  }

  const values = refinePreview(selectedRow.value.instanceId, [...lockedIndices.value])

  if (values) {
    pendingRefineValues.value = values
  }
}

function doRefineKeep() {
  if (!selectedRow.value || !pendingRefineValues.value) {
    return
  }

  if (refineCommit(selectedRow.value.instanceId, pendingRefineValues.value)) {
    pendingRefineValues.value = null
  }
}

const pendingRefineByIndex = computed(() => {
  const map = new Map<number, number>()

  for (const entry of pendingRefineValues.value ?? []) {
    map.set(entry.index, entry.value)
  }

  return map
})

// =========================
// Tab Hóa Luyện (§7.5) — lưới slot giống inventory + tick chọn + preview + confirm
// =========================

interface DissolveCandidate {
  instanceId: string

  name: string

  slotLabel: string

  quality: string

  realmId: string

  icon?: string

  nameSegments: ReturnType<typeof composeEquipmentNameSegments>

  tooltip: ReturnType<typeof buildEquipmentTooltip>

  qualityRank: number

  rarityRank: number
}

// Fit-refactor đợt 4 — sắp xếp khai báo theo thứ tự phụ thuộc (refs ->
// hàm -> computed -> pagination) để không rơi vào TDZ khi computed evaluate
// ngay lúc mount (test bắt được lỗi này).
const dissolveFilterRealm = ref<string>('any')

const dissolveFilterQuality = ref<string>('any')

function passesDissolveFilter(instance: EquipmentInstance): boolean {
  if (dissolveFilterRealm.value !== 'any' && instance.realmId !== dissolveFilterRealm.value) {
    return false
  }

  if (
    dissolveFilterQuality.value !== 'any' &&
    instance.rarity !== dissolveFilterQuality.value
  ) {
    return false
  }

  return true
}

// Tick nhẹ để preview cập nhật khi selection đổi (computed phụ thuộc
// stateVersion là chính).
const nowTick = ref(0)

const dissolveCandidates = computed<DissolveCandidate[]>(() => {
  stateVersion.value

  void nowTick.value

  return gameManager.equipmentBag
    .getAll()
    .filter((instance) => !instance.equipped && !instance.locked && !instance.favorite)
    .filter((instance) => passesDissolveFilter(instance))
    .map((instance) => {
      const template = gameManager.getEquipmentTemplate(instance.itemId)

      return {
        instanceId: instance.instanceId,

        name: template?.name ?? instance.itemId,

        slotLabel: equipmentSlotLabel(instance.slot),

        quality: equipmentQualityLabel(instance.quality),

        realmId: instance.realmId,

        icon: instance.icon ?? template?.icon,

        nameSegments: template
          ? composeEquipmentNameSegments(instance, template, gameManager.zoneRegistry)
          : [{ text: instance.itemId }],

        tooltip: buildEquipmentTooltip(
          instance,
          gameManager.equipmentRegistry.get(instance.itemId),
          gameManager.affixRegistry,
          gameManager.getSlotState(instance.slot),
          gameManager.zoneRegistry,
        ),

        qualityRank: equipmentQualityRank(instance.quality),

        rarityRank: itemGradeRank(instance.rarity),
      }
    })
})

// Hóa Luyện phân trang theo ngân sách chiều cao thật của lưới (ước
// lượng 1 "hàng" ~80px — lưới nhiều cột nên số item hiển thị thực tế
// mỗi trang thường NHIỀU hơn số hàng tính được, an toàn vì chỉ làm hụt
// chỗ trống chứ không bao giờ tràn).
const {
  containerEl: dissolveListEl,
  currentPage: dissolvePage,
  totalPages: dissolveTotalPages,
  goToPage: dissolveGoTo,
  pageItemsRange: dissolvePageRange,
} = usePanelPagination(
  computed(() => dissolveCandidates.value.length),
  80,
)

const dissolveSelected = ref<Set<string>>(new Set())

function toggleDissolve(instanceId: string) {
  const next = new Set(dissolveSelected.value)

  if (next.has(instanceId)) {
    next.delete(instanceId)
  } else {
    next.add(instanceId)
  }

  dissolveSelected.value = next
}

/**
 * Chọn TẤT CẢ candidate đang qua filter hiện hành (yêu cầu "hóa luyện
 * toàn bộ/theo filter") — an toàn vì candidates đã loại equipped/locked/
 * favorite ở computed nguồn.
 */
function selectAllDissolveByFilter() {
  dissolveSelected.value = new Set(dissolveCandidates.value.map((candidate) => candidate.instanceId))
}

function clearDissolveSelection() {
  dissolveSelected.value = new Set()
}

const dissolvePreview = computed(() => {
  stateVersion.value

  return gameManager.previewDissolveRewards(Array.from(dissolveSelected.value))
})

const dissolveConfirming = ref(false)

function doDissolve() {
  if (dissolveSelected.value.size === 0) {
    return
  }

  if (!dissolveConfirming.value) {
    dissolveConfirming.value = true

    return
  }

  if (dissolve(Array.from(dissolveSelected.value))) {
    dissolveSelected.value = new Set()

    nowTick.value += 1
  }

  dissolveConfirming.value = false
}
</script>

<template>
  <div class="qi-hall">
    <InkNineSlice asset-id="surface-xl-paper-scroll" layer="surface" />
    <InkNineSlice asset-id="frame-xl-ceremony" layer="frame" />

    <!-- Nav chức năng lên NGAY đầu card, không nền riêng (2026-08-30,
         bug report) — bỏ hẳn header "Chọn một trang bị..." cũ. -->
    <TabBar
      class="qi-hall__tabs"
      :tabs="TABS.map((tab) => ({ id: tab.id, label: tab.label }))"
      :model-value="activeTab"
      @update:model-value="switchTab($event as TabId)"
    />

    <!-- ===== CƯỜNG HÓA (slot-level, §7.1) ===== -->
    <section v-if="activeTab === 'enhance'" class="qi-hall__body qi-hall__split">
      <div class="qi-hall__split-left">
        <div class="qi-hall__slot-grid" aria-label="Chọn slot cường hóa">
          <SlotView
            v-for="row in enhanceRows"
            :key="row.slot"
            class="qi-hall__slot"
            :item="row.equippedRow?.instance ?? null"
            :label="row.equippedRow?.name ?? equipmentSlotLabel(row.slot)"
            :name-segments="row.equippedRow?.nameSegments"
            :icon="row.equippedRow?.icon"
            :equipment-quality-rank="row.equippedRow?.qualityRank"
            :rarity-rank="row.equippedRow?.rarityRank"
            :tooltip="row.equippedRow?.tooltip ?? { title: equipmentSlotLabel(row.slot), description: 'Slot trống vẫn có thể Cường Hóa.' }"
            :badges="[{ kind: 'enhance', text: `+${row.enhanceLevel}` }]"
            :state="{ interaction: row.slot === selectedEnhanceSlot ? 'selected' : 'idle' }"
            @click="selectEnhanceSlot(row.slot)"
          />
        </div>
      </div>

      <div v-if="selectedEnhanceRow" class="qi-hall__split-right">
        <div class="qi-hall__compare">
          <div class="qi-hall__col">
            <Eyebrow>Hiện tại</Eyebrow>

            <p class="qi-hall__col-title">{{ equipmentSlotLabel(selectedEnhanceRow.slot) }} · {{ selectedEnhanceRow.itemName }}</p>

            <p class="qi-hall__col-level">+{{ selectedEnhanceRow.enhanceLevel }}/{{ selectedEnhanceRow.maxLevel }}</p>

            <p v-if="enhancePreview" class="qi-hall__stat-line">
              {{ enhancePreview.label }}: <strong>{{ enhancePreview.currentValue.toFixed(1) }}</strong>
            </p>
          </div>

          <span class="qi-hall__compare-arrow" aria-hidden="true">⇒</span>

          <div class="qi-hall__col">
            <Eyebrow>Sau Cường Hóa</Eyebrow>

            <template v-if="enhancePreview && selectedEnhanceRow.enhanceLevel < selectedEnhanceRow.maxLevel">
              <p class="qi-hall__col-level">+{{ selectedEnhanceRow.enhanceLevel + 1 }}/{{ selectedEnhanceRow.maxLevel }}</p>

              <p class="qi-hall__stat-line">
                {{ enhancePreview.label }}: <strong>{{ enhancePreview.nextValue.toFixed(1) }}</strong>

                <span class="qi-hall__up-arrow">▲ +{{ enhancePreview.percent.toFixed(1) }}%</span>
              </p>
            </template>

            <p v-else class="qi-hall__empty">
              {{ enhancePreview ? 'Đã đạt cấp tối đa.' : 'Slot trống — không có chỉ số chính để xem trước.' }}
            </p>
          </div>
        </div>

        <ul v-if="selectedEnhanceRow.enhanceLevel < selectedEnhanceRow.maxLevel" class="qi-hall__info-row enhance-row__costs">
          <li
            v-for="cost in selectedEnhanceRow.costs"
            :key="cost.materialId"
            :class="{ 'is-missing': cost.owned < cost.amount }"
          >
            {{ cost.label }}: {{ cost.owned }}/{{ cost.amount }}
          </li>
          <li :class="{ 'is-missing': selectedEnhanceRow.spiritStoneOwned < selectedEnhanceRow.spiritStone }">
            {{ materialLabel(selectedEnhanceRow.spiritStoneMaterialId, gameManager.materialRegistry) }}:
            {{ selectedEnhanceRow.spiritStoneOwned }}/{{ selectedEnhanceRow.spiritStone }}
          </li>
        </ul>

        <div class="qi-hall__button-row">
          <GameButton
            v-if="selectedEnhanceRow.enhanceLevel < selectedEnhanceRow.maxLevel"
            size="lg"
            :disabled="!canEnhance(selectedEnhanceRow)"
            @click="doEnhance(selectedEnhanceRow)"
          >
            Cường Hóa
          </GameButton>
        </div>
      </div>
    </section>

    <!-- ===== TẨY LUYỆN (§7.3) — preview/giữ/bỏ ===== -->
    <section v-else-if="activeTab === 'wash'" class="qi-hall__body qi-hall__split">
      <div class="qi-hall__split-left">
        <div class="qi-hall__slot-grid" aria-label="Chọn trang bị để tẩy luyện">
          <SlotView
            v-for="row in hallSlotRows"
            :key="row.slot"
            class="qi-hall__slot"
            :item="row.equippedRow?.instance ?? null"
            :label="row.equippedRow?.name ?? equipmentSlotLabel(row.slot)"
            :name-segments="row.equippedRow?.nameSegments"
            :icon="row.equippedRow?.icon"
            :equipment-quality-rank="row.equippedRow?.qualityRank"
            :rarity-rank="row.equippedRow?.rarityRank"
            :tooltip="row.equippedRow?.tooltip ?? { title: equipmentSlotLabel(row.slot), description: 'Slot trống — không có gì để Tẩy Luyện.' }"
            :state="{ interaction: row.equippedRow?.instanceId === selectedInstanceId ? 'selected' : 'idle', marker: row.equippedRow ? 'equipped' : undefined }"
            @click="selectHallSlotForAction(row)"
          />
        </div>
      </div>

      <div v-if="selectedRow" class="qi-hall__split-right">
        <div class="qi-hall__compare">
          <div class="qi-hall__col">
            <Eyebrow>Hiện tại</Eyebrow>

            <p v-for="affix in selectedAffixes" :key="affix.index" class="qi-hall__affix-line">
              {{ affix.label }} (tier {{ affix.tier }})
            </p>

            <p v-if="selectedAffixes.length === 0" class="qi-hall__empty">Chưa có dòng phụ.</p>
          </div>

          <span class="qi-hall__compare-arrow" aria-hidden="true">⇒</span>

          <div class="qi-hall__col">
            <Eyebrow>Sau Tẩy Luyện</Eyebrow>

            <template v-if="pendingWashAffixes">
              <p v-for="affix in pendingWashAffixDisplay" :key="affix.index" class="qi-hall__affix-line qi-hall__affix-line--new">
                {{ affix.label }} (tier {{ affix.tier }})
              </p>
            </template>

            <p v-else class="qi-hall__empty">Bấm Tẩy Luyện để xem trước kết quả rồi mới Giữ.</p>
          </div>
        </div>

        <div class="qi-hall__info-row">
          <div class="qi-hall__info-options">
            <span class="qi-hall__info-label">Chọn Quáng (×{{ washCost.oreAmount }})</span>

            <label v-for="ore in oreChoices" :key="ore.materialId" class="qi-hall__option">
              <input type="radio" :value="ore.materialId" v-model="selectedOreId" />

              <span>{{ ore.name }} ×{{ ore.owned }}</span>
            </label>
          </div>

          <p class="qi-hall__costline">
            Chi phí mỗi lượt: {{ washCost.refinementPoints }} Điểm Rèn (còn {{ itemRenState?.points ?? 0 }})
            · {{ washCost.spiritStone }} {{ spiritStoneCostName }}
          </p>
        </div>

        <div class="qi-hall__button-row">
          <GameButton size="lg" :disabled="!canWash()" @click="doWashPreview">
            Tẩy Luyện
          </GameButton>

          <GameButton v-if="pendingWashAffixes" size="lg" variant="secondary" @click="doWashKeep">
            Giữ
          </GameButton>
        </div>
      </div>

      <p v-else class="qi-hall__split-right qi-hall__empty qi-hall__empty--centered">Chọn một trang bị bên trái để xem chi tiết.</p>
    </section>

    <!-- ===== TINH LUYỆN (§7.4) — preview/giữ/bỏ ===== -->
    <section v-else-if="activeTab === 'refine'" class="qi-hall__body qi-hall__split">
      <div class="qi-hall__split-left">
        <div class="qi-hall__slot-grid" aria-label="Chọn trang bị để tinh luyện">
          <SlotView
            v-for="row in hallSlotRows"
            :key="row.slot"
            class="qi-hall__slot"
            :item="row.equippedRow?.instance ?? null"
            :label="row.equippedRow?.name ?? equipmentSlotLabel(row.slot)"
            :name-segments="row.equippedRow?.nameSegments"
            :icon="row.equippedRow?.icon"
            :equipment-quality-rank="row.equippedRow?.qualityRank"
            :rarity-rank="row.equippedRow?.rarityRank"
            :tooltip="row.equippedRow?.tooltip ?? { title: equipmentSlotLabel(row.slot), description: 'Slot trống — không có gì để Tinh Luyện.' }"
            :state="{ interaction: row.equippedRow?.instanceId === selectedInstanceId ? 'selected' : 'idle', marker: row.equippedRow ? 'equipped' : undefined }"
            @click="selectHallSlotForAction(row)"
          />
        </div>
      </div>

      <div v-if="selectedRow" class="qi-hall__split-right">
        <div class="qi-hall__compare">
          <div class="qi-hall__col">
            <Eyebrow>Hiện tại · khóa tối đa {{ Math.min(3, Math.max(0, selectedAffixes.length - 1)) }} dòng</Eyebrow>

            <label v-for="affix in selectedAffixes" :key="affix.index" class="qi-hall__option">
              <input
                type="checkbox"
                :checked="lockedIndices.includes(affix.index)"
                @change="toggleLock(affix.index)"
              />

              <span>{{ affix.label }} (tier {{ affix.tier }})</span>

              <span class="qi-hall__owned">{{ currentAffixValue(affix.index)?.toFixed(1) }}</span>
            </label>

            <p v-if="selectedAffixes.length === 0" class="qi-hall__empty">Không có dòng phụ để Tinh Luyện.</p>
          </div>

          <span class="qi-hall__compare-arrow" aria-hidden="true">⇒</span>

          <div class="qi-hall__col">
            <Eyebrow>Sau Tinh Luyện</Eyebrow>

            <p v-for="affix in selectedAffixes" :key="affix.index" class="qi-hall__affix-line">
              {{ affix.label }} (tier {{ affix.tier }}) —
              <span v-if="lockedIndices.includes(affix.index)" class="qi-hall__owned">giữ nguyên</span>
              <strong v-else-if="pendingRefineByIndex.has(affix.index)">{{ pendingRefineByIndex.get(affix.index)?.toFixed(1) }}</strong>
              <span v-else class="qi-hall__owned">chưa roll</span>
            </p>
          </div>
        </div>

        <p class="qi-hall__info-row qi-hall__costline">
          Giá trị từng dòng không khóa roll trong ±20%. Cost hệ số N+L =
          {{ refineCost.essenceUnits }} Tinh Hoa · {{ refineCost.spiritStone }}
          {{ spiritStoneCostName }} · {{ refineCost.refinementPoints }} Điểm Rèn (còn
          {{ itemRenState?.points ?? 0 }} · Tinh Hoa đang có {{ refineEssenceOwned }}).
        </p>

        <div class="qi-hall__button-row">
          <GameButton size="lg" :disabled="!canRefine()" @click="doRefinePreview">
            Tinh Luyện
          </GameButton>

          <GameButton v-if="pendingRefineValues" size="lg" variant="secondary" @click="doRefineKeep">
            Giữ
          </GameButton>
        </div>
      </div>

      <p v-else class="qi-hall__split-right qi-hall__empty qi-hall__empty--centered">Chọn một trang bị bên trái để xem chi tiết.</p>
    </section>

    <!-- ===== HÓA LUYỆN (§7.5) — lưới slot + tick chọn ===== -->
    <section v-else class="qi-hall__body qi-hall__dissolve">
      <div class="dissolve-filters">
        <select v-model="dissolveFilterRealm">
          <option value="any">Mọi cảnh giới</option>

          <option value="mortal">Phàm Nhân</option>

          <option value="qi_refining">Luyện Khí</option>

          <option value="foundation_establishment">Trúc Cơ</option>
        </select>

        <select v-model="dissolveFilterQuality">
          <option value="any">Mọi phẩm</option>

          <option value="hoang">Hoàng</option>

          <option value="huyen">Huyền</option>

          <option value="dia">Địa</option>

          <option value="thien">Thiên</option>

          <option value="tien">Tiên</option>
        </select>

        <button
          type="button"
          class="dissolve-filters__bulk"
          :disabled="dissolveCandidates.length === 0"
          @click="selectAllDissolveByFilter"
        >
          Chọn tất cả ({{ dissolveCandidates.length }})
        </button>

        <button
          type="button"
          class="dissolve-filters__bulk"
          :disabled="dissolveSelected.size === 0"
          @click="clearDissolveSelection"
        >
          Bỏ chọn hết
        </button>
      </div>

      <div ref="dissolveListEl" class="dissolve-grid">
        <div
          v-for="candidate in dissolveCandidates.slice(dissolvePageRange.start, dissolvePageRange.end)"
          :key="candidate.instanceId"
          class="dissolve-slot-wrap"
          @click="toggleDissolve(candidate.instanceId)"
        >
          <SlotView
            class="qi-hall__slot"
            :item="{ id: candidate.instanceId }"
            :label="candidate.name"
            :name-segments="candidate.nameSegments"
            :icon="candidate.icon"
            :equipment-quality-rank="candidate.qualityRank"
            :rarity-rank="candidate.rarityRank"
            :tooltip="candidate.tooltip"
            :state="{ interaction: dissolveSelected.has(candidate.instanceId) ? 'selected' : 'idle' }"
          />

          <span v-if="dissolveSelected.has(candidate.instanceId)" class="dissolve-slot-tick" aria-hidden="true">✓</span>
        </div>

        <p v-if="dissolveCandidates.length === 0" class="qi-hall__empty">Không có món nào đủ điều kiện Hóa Luyện qua filter hiện tại.</p>
      </div>

      <div v-if="dissolveTotalPages > 1" class="dissolve-pagination">
        <GameButton variant="ghost" size="sm" :disabled="dissolvePage === 0" @click="dissolveGoTo(dissolvePage - 1)">‹</GameButton>
        <span class="dissolve-pagination__label">{{ dissolvePage + 1 }} / {{ dissolveTotalPages }}</span>
        <GameButton variant="ghost" size="sm" :disabled="dissolvePage >= dissolveTotalPages - 1" @click="dissolveGoTo(dissolvePage + 1)">›</GameButton>
      </div>

      <div v-if="dissolvePreview.length > 0" class="dissolve-preview">
        <h4>Nhận được ({{ dissolveSelected.size }} món):</h4>

        <p v-for="entry in dissolvePreview" :key="entry.materialId">
          {{ materialLabel(entry.materialId, gameManager.materialRegistry) }}: {{ entry.minAmount }}–{{ entry.maxAmount }}
        </p>

        <p class="qi-hall__warning">Thao tác KHÔNG thể hoàn tác.</p>
      </div>

      <GameButton
        size="lg"
        variant="danger"
        class="qi-hall__primary-action"
        :disabled="dissolveSelected.size === 0"
        @click="doDissolve"
      >
        {{ dissolveConfirming ? 'XÁC NHẬN HÓA LUYỆN' : `Hóa Luyện (${dissolveSelected.size})` }}
      </GameButton>
    </section>
  </div>
</template>

<style scoped>
.qi-hall {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--text-primary);
  font-family: var(--font-body);
}

.qi-hall > :not(.ink-nine-slice) {
  position: relative;
  z-index: 3;
}

/* Nav lên đầu, KHÔNG nền riêng (2026-08-30, bug report) — hoà vào card
   giống Chip.vue paper-toned thay vì dải tối tách biệt. */
.qi-hall__tabs {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--paper-line, rgba(42, 41, 36, 0.42));
  background: transparent;
}

/* Fit-refactor đợt 4 — body là ngân sách flex; section nào dài (Hóa Luyện)
   tự paginate, section ngắn (Cường Hóa...) flex-fit; overflow hidden là rào
   cuối, KHÔNG dùng để scroll. */
.qi-hall__body {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Ảnh lò rèn mờ LÀM NỀN PHỤ thay banner SceneHeader đã bỏ (2026-08-30) —
   ngồi TRÊN nền giấy/vàng hiện có, DƯỚI nội dung, chỉ phủ khung info này
   (không phải toàn panel). */
.qi-hall__body::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  background: url('/assets/buildings/dong-fu/equipment_hall.png') center center / 50% no-repeat;
  opacity: 0.08;
  pointer-events: none;
}

.qi-hall__body > * {
  position: relative;
  z-index: 1;
}

.qi-hall__body h4 {
  margin: 0 0 4px;
  color: var(--paper-text, #211f1a);
  font-size: var(--text-lg);
}

.qi-hall__option {
  color: var(--paper-text, #211f1a);
  font-size: var(--text-sm);
}

/* Nút hành động chính (Hóa Luyện, full width — layout riêng của tab đó). */
.qi-hall__primary-action {
  width: 100%;
  margin-top: 4px;
}

/* Cụm nút hành động/Giữ LUÔN Ở CUỐI, CĂN PHẢI (2026-08-30 spec) — dùng
   chung cho Cường Hóa/Tẩy/Tinh Luyện, thay vì mỗi tab một kiểu canh
   riêng (full-width/giữa/giữa-2-cột) như trước. */
.qi-hall__button-row {
  flex: 0 0 auto;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.qi-hall__button-row .game-button {
  min-width: 120px;
}

.enhance-row__costs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.enhance-row__costs li.is-missing {
  color: var(--crimson);
}

/* Split trái/phải (2026-08-30) — chọn trang bị bên trái (1 CỘT DUY
   NHẤT, kích cỡ nhỏ vừa khớp chiều cao card chi tiết bên phải), chi
   tiết/hành động bên phải. */
.qi-hall__split {
  flex-direction: row;
  gap: 14px;
}

.qi-hall__split-left {
  flex: 0 0 84px;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding-right: 10px;
  border-right: 1px solid color-mix(in srgb, var(--scene-fire-text-soft) 22%, transparent);
}

.qi-hall__split-right {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 4%;
}

/* Cột trang bị: 6 Ô LUÔN TỒN TẠI, CÁCH ĐỀU, AUTOFIT CHIỀU CAO (2026-08-30
   spec) — 1 cột dọc duy nhất, mỗi ô chiếm đúng 1/6 chiều cao khả dụng
   (khớp với tổng chiều cao cột phải: so sánh + info + nút), không co cụm
   giữa để lại khoảng trống trên/dưới. */
.qi-hall__slot-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: repeat(6, 1fr);
  gap: 4px;
}

.qi-hall__slot {
  min-width: 0;
}

.qi-hall__empty {
  margin: 0;
  padding: 12px;
  border: 1px dashed var(--paper-line, rgba(42, 41, 36, 0.42));
  color: var(--paper-text-soft, #5e5a50);
  font-size: var(--text-sm);
  text-align: center;
}

.qi-hall__empty--centered {
  display: flex;
  align-items: center;
  justify-content: center;
}

.qi-hall__option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  min-height: var(--tap-min);
  font-size: var(--text-sm);
  cursor: pointer;
}

.qi-hall__owned {
  margin-left: auto;
  color: var(--paper-text-soft, #5e5a50);
}

.qi-hall__costline {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--paper-text-soft, #5e5a50);
}

/* "Vùng thông tin trước ⇒ vùng thông tin sau" (2026-08-30 spec) — dùng
   CHUNG cho cả 3 tab Cường Hóa/Tẩy/Tinh Luyện, thay vì mỗi tab một bố
   cục cột riêng như trước. */
.qi-hall__compare {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: stretch;
  gap: 12px;
}

.qi-hall__compare-arrow {
  align-self: center;
  color: var(--paper-eyebrow);
  font-size: 22px;
  line-height: 1;
}

.qi-hall__col {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid var(--paper-line, rgba(42, 41, 36, 0.42));
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--paper-50) 70%, transparent);
  overflow-y: auto;
}

/* Dải "nguyên liệu cần thiết / options" NGAY DƯỚI vùng so sánh, phía
   trên cụm nút — dùng chung cho Tẩy/Tinh Luyện (Cường Hóa dùng biến thể
   enhance-row__costs sẵn có). */
.qi-hall__info-row {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 16px;
  padding: 6px 0;
  border-top: 1px solid color-mix(in srgb, var(--scene-fire-text-soft) 22%, transparent);
}

.qi-hall__info-options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
}

.qi-hall__info-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--paper-eyebrow);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.qi-hall__col-title {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--paper-text, #211f1a);
}

.qi-hall__col-level {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--paper-text-soft, #5e5a50);
}

.qi-hall__stat-line {
  margin: 0;
  font-size: var(--text-body);
  color: var(--paper-text, #211f1a);
}

.qi-hall__up-arrow {
  margin-left: 6px;
  color: var(--jade);
  font-weight: 700;
  font-size: var(--text-xs);
}

.qi-hall__affix-line {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--paper-text, #211f1a);
}

.qi-hall__affix-line--new strong,
.qi-hall__affix-line--new {
  color: var(--jade);
}

/* Hóa Luyện — cột đơn full width, không split trái/phải. */
.qi-hall__dissolve {
  gap: 8px;
}

.dissolve-filters {
  display: flex;
  gap: 6px;
}

.dissolve-filters select {
  background: var(--ink-800);
  color: var(--text-primary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  padding: 4px;
  min-height: var(--tap-min);
  font-family: var(--font-body);
}

.dissolve-filters__bulk {
  background: var(--ink-800);
  color: var(--text-primary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  padding: 4px 10px;
  min-height: var(--tap-min);
  font-family: var(--font-body);
  font-size: var(--text-xs);
  cursor: pointer;
}

.dissolve-filters__bulk:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Lưới slot Hóa Luyện — tham chiếu đúng kiểu ô inventory (2026-08-30
   spec), thay danh sách <li> text cũ. */
.dissolve-grid {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 8px;
  align-content: flex-start;
  overflow: hidden;
}

.dissolve-slot-wrap {
  position: relative;
  cursor: pointer;
}

/* Dấu tick món đã chọn (2026-08-30 spec: "hiệu ứng gì đó, ví dụ dấu
   tick") — SlotView tự viền sáng qua state.interaction='selected',
   badge tick này là tín hiệu PHỤ rõ ràng hơn ở góc. */
.dissolve-slot-tick {
  position: absolute;
  top: -4px;
  right: -4px;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--jade);
  color: var(--paper-50);
  font-size: 11px;
  font-weight: 700;
  box-shadow: 0 0 0 2px var(--paper-50), 0 2px 4px rgba(0, 0, 0, 0.35);
}

.dissolve-pagination {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.dissolve-pagination__label {
  font-size: var(--text-sm);
  color: var(--paper-text-soft, #5e5a50);
  font-variant-numeric: tabular-nums;
}

.dissolve-preview {
  flex: 0 0 auto;
}

.dissolve-preview h4 {
  margin: 0 0 4px;
  font-size: var(--text-sm);
  color: var(--paper-text, #211f1a);
}

.dissolve-preview p {
  margin: 0 0 3px;
  font-size: var(--text-xs);
  color: var(--jade);
}

.qi-hall__warning {
  font-size: var(--text-xs);
  color: var(--crimson);
}

@container overlay-panel (max-width: 760px) {
  .qi-hall__split { flex-direction: column; }
  .qi-hall__split-left {
    flex: 0 0 auto;
    flex-direction: row;
    padding-right: 0;
    padding-bottom: 8px;
    border-right: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--scene-fire-text-soft) 22%, transparent);
  }
  .qi-hall__slot-grid { grid-template-columns: repeat(auto-fill, minmax(56px, 1fr)); grid-template-rows: none; }
  .qi-hall__compare { grid-template-columns: 1fr; }
  .qi-hall__compare-arrow { justify-self: center; transform: rotate(90deg); }
}
</style>
