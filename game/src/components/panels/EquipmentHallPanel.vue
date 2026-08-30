<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useEquipmentActions } from '@/composables/useEquipmentActions'
import { usePanelPagination } from '@/composables/usePanelPagination'
import {
  equipmentEssenceMaterialId,
} from '@/core/equipment/RefinementBalance'
import { EQUIPMENT_RARITY_AFFIX_SLOTS } from '@/core/equipment/EquipmentRarity'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'
import type { EquipmentSlot } from '@/core/equipment/EquipmentTypes'
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
import SceneHeader from '@/components/common/SceneHeader.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'

// Khí Đường (2026-08-25, resource-professions-rework plan §7/§9.2) —
// bốn tab ĐÚNG contract: Cường Hóa (slot), Tẩy Luyện (identity substat
// theo phẩm Quáng), Tinh Luyện (±20% giá trị + khóa dòng N+L), Hóa
// Luyện (destructive → Tinh Hoa, batch all-or-nothing). Rework
// 2026-08-30: bỏ Nạp Điểm Rèn; cost Điểm Rèn Tẩy/Tinh theo quality.
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

const { enhance, wash, refine, dissolve } = useEquipmentActions()

const feedback = useActionFeedbackStore()

const activeTab = ref<TabId>('enhance')

function switchTab(tab: TabId) {
  activeTab.value = tab
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

  quality: EquipmentInstance['quality']

  rarity: EquipmentInstance['rarity']

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

      rarity: instance.rarity,

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

import { getMaxForgePoints } from '@/core/equipment/EquipmentSystem'

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

// =========================
// Tab Tẩy Luyện
// =========================

const washCost = computed(() => {
  stateVersion.value

  return gameManager.getWashCost(selectedRow.value?.realmId, selectedRow.value?.quality)
})

function canWash(): boolean {
  const ren = itemRenState.value
  const row = selectedRow.value
  if (!row) {
    return false
  }
  // Tẩy Luyện guard (2026-08-30) — đồ Hoàng (0 affix slot) không thể
  // roll được dòng nào; core trả no_eligible_affix nhưng UX kém nếu
  // đợi player bấm mới biết lỗi. Disable sớm tại UI.
  const affixSlotCap = EQUIPMENT_RARITY_AFFIX_SLOTS[row.rarity]
  const hasAffixSlots = affixSlotCap.prefix + affixSlotCap.suffix > 0

  return (
    hasAffixSlots &&
    selectedOreId.value !== null &&
    ren !== null &&
    gameManager.materialBag.getAmount(selectedOreId.value) >= washCost.value.oreAmount &&
    ren.points >= washCost.value.refinementPoints &&
    spiritStoneOwned.value >= washCost.value.spiritStone
  )
}

function doWash() {
  if (!selectedRow.value) {
    feedback.warning('Không thể Tẩy Luyện: cần chọn một trang bị.')
    return
  }

  if (!selectedOreId.value) {
    feedback.warning('Không thể Tẩy Luyện: cần chọn Quáng cùng cảnh giới.')
    return
  }

  wash(selectedRow.value.instanceId, selectedOreId.value)
}

// =========================
// Tab Tinh Luyện — khóa dòng (§7.4)
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

  return instance.affixes.map((rolled, index) => {
    const affix = gameManager.affixRegistry.has(rolled.affixId)
      ? gameManager.affixRegistry.get(rolled.affixId)
      : undefined

    return {
      index,

      label: affix
        ? `${affixLabel(rolled.affixId, gameManager.affixRegistry)} (${statLabel(affix.stat)})`
        : affixLabel(rolled.affixId, gameManager.affixRegistry),

      tier: rolled.tier,
    }
  })
})

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
}

const refineCost = computed(() => {
  stateVersion.value

  return gameManager.getRefineCost(
    selectedAffixes.value.length,
    lockedIndices.value.length,
    selectedRow.value?.realmId,
    selectedRow.value?.quality,
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

function doRefine() {
  if (!selectedRow.value) {
    feedback.warning('Không thể Tinh Luyện: cần chọn một trang bị có ít nhất một dòng phụ.')
    return
  }

  refine(selectedRow.value.instanceId, [...lockedIndices.value])
}

// =========================
// Bảng so sánh Trước ⇒ Sau dùng chung Tẩy/Tinh Luyện (rework
// 2026-08-30) — thông tin trước và sau thao tác nằm CÙNG MỘT HÀNG
// cho từng chỉ số, thay vì text rời rạc từng tab.
// =========================

interface CompareRow {
  key: string

  label: string

  before: string

  after: string
}

const washPreviewRows = computed<CompareRow[]>(() => {
  stateVersion.value

  const ren = itemRenState.value

  const row = selectedRow.value

  if (!ren || !row) {
    return []
  }

  return [
    {
      key: 'ren',
      label: 'Điểm Rèn',
      before: `${ren.points}/${ren.max}`,
      after: `${Math.max(0, ren.points - washCost.value.refinementPoints)}/${ren.max}`,
    },
    {
      key: 'lines',
      label: 'Số dòng phụ',
      before: `${row.affixCount}`,
      after: 'roll lại theo Quáng',
    },
    {
      key: 'tier',
      label: 'Tier ban đầu',
      before: `${Math.max(...row.instance.affixes.map((a) => a.tier), 0)}`,
      after: 'roll lại theo Quáng',
    },
  ]
})

const refinePreviewRows = computed<CompareRow[]>(() => {
  stateVersion.value

  const ren = itemRenState.value

  const row = selectedRow.value

  if (!ren || !row) {
    return []
  }

  return [
    {
      key: 'ren',
      label: 'Điểm Rèn',
      before: `${ren.points}/${ren.max}`,
      after: `${Math.max(0, ren.points - refineCost.value.refinementPoints)}/${ren.max}`,
    },
    {
      key: 'locked',
      label: 'Dòng giữ nguyên',
      before: `${lockedIndices.value.length}`,
      after: `${lockedIndices.value.length} (không đổi)`,
    },
    {
      key: 'rerolled',
      label: 'Dòng roll lại',
      before: `${row.affixCount - lockedIndices.value.length}`,
      after: '±20% trong range tier',
    },
  ]
})

// =========================
// Tab Hóa Luyện (§7.5) — filter + multi-select + preview + confirm
// =========================

interface DissolveCandidate {
  instanceId: string

  name: string

  slotLabel: string

  quality: string

  realmId: string
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
      }
    })
})

// Hóa Luyện phân trang theo ngân sách chiều cao thật của list (row =
// min-height 40px + padding 10px + border 2px + gap 3px).
const {
  containerEl: dissolveListEl,
  currentPage: dissolvePage,
  totalPages: dissolveTotalPages,
  goToPage: dissolveGoTo,
  pageItemsRange: dissolvePageRange,
} = usePanelPagination(
  computed(() => dissolveCandidates.value.length),
  55,
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
    <SceneHeader
      class="qi-hall__forge-scene"
      asset="/assets/buildings/dong-fu/equipment_hall.png"
      scene="fire"
      height="clamp(72px, 13vh, 132px)"
      object-position="center 58%"
      :image-opacity="0.58"
      caption="THIÊN HỎA LUYỆN KHÍ"
    >
      <template #decoration>
        <div class="qi-hall__forge-fire" />
        <div class="qi-hall__anvil">⚒</div>
      </template>
    </SceneHeader>

    <header class="qi-hall__points">
      <template v-if="itemRenState !== null">
        <span>
          Điểm Rèn món đang chọn:
          {{ itemRenState.points }}/{{ itemRenState.max }}
        </span>

        <small class="qi-hall__points-hint">
          Điểm Rèn gắn với từng món đồ, sinh ra đúng trần theo phẩm — Tẩy/Tinh Luyện tiêu và không thể nạp lại.
        </small>
      </template>

      <span v-else>Chọn một trang bị để xem Điểm Rèn của nó</span>
    </header>

    <TabBar
      class="qi-hall__tabs"
      :tabs="TABS.map((tab) => ({ id: tab.id, label: tab.label }))"
      :model-value="activeTab"
      @update:model-value="switchTab($event as TabId)"
    />

    <!-- ===== CƯỜNG HÓA (slot-level, §7.1) ===== -->
    <section v-if="activeTab === 'enhance'" class="qi-hall__body">
      <p class="qi-hall__hint">Cường Hóa gắn với SLOT — đổi trang bị không mất cấp.</p>

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

      <article v-if="selectedEnhanceRow" class="enhance-row">
        <div class="enhance-row__head">
          <strong>{{ equipmentSlotLabel(selectedEnhanceRow.slot) }} · {{ selectedEnhanceRow.itemName }}</strong>

          <span>+{{ selectedEnhanceRow.enhanceLevel }}/{{ selectedEnhanceRow.maxLevel }}</span>
        </div>

        <ul v-if="selectedEnhanceRow.enhanceLevel < selectedEnhanceRow.maxLevel" class="enhance-row__costs">
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

        <GameButton
          v-if="selectedEnhanceRow.enhanceLevel < selectedEnhanceRow.maxLevel"
          size="sm"
          :disabled="!canEnhance(selectedEnhanceRow)"
          @click="doEnhance(selectedEnhanceRow)"
        >
          Cường Hóa
        </GameButton>
      </article>
    </section>

    <!-- ===== TẦY LUYỆN (§7.3) ===== -->
    <section v-else-if="activeTab === 'wash'" class="qi-hall__body">
      <div class="qi-hall__slot-grid" aria-label="Chọn trang bị để tẩy luyện">
        <SlotView
          v-for="row in equippedRows"
          :key="row.instanceId"
          class="qi-hall__slot"
          :item="row.instance"
          :label="row.name"
          :name-segments="row.nameSegments"
          :icon="row.icon"
          :equipment-quality-rank="row.qualityRank"
          :rarity-rank="row.rarityRank"
          :tooltip="row.tooltip"
          :state="{ interaction: row.instanceId === selectedInstanceId ? 'selected' : 'idle', marker: 'equipped' }"
          @click="selectEquipped(row.instanceId)"
        />
      </div>

      <p v-if="equippedRows.length === 0" class="qi-hall__empty">Hãy trang bị một món đồ trước khi Tẩy Luyện.</p>

      <template v-if="selectedRow">
        <h4>Chọn Quáng cùng cảnh giới (×{{ washCost.oreAmount }})</h4>

        <label v-for="ore in oreChoices" :key="ore.materialId" class="qi-hall__option">
          <input type="radio" :value="ore.materialId" v-model="selectedOreId" />

          <span>{{ ore.name }}</span>

          <span class="qi-hall__owned">×{{ ore.owned }}</span>
        </label>

        <!-- Trước ⇒ Sau — từng chỉ số cùng một hàng -->
        <table class="qi-hall__compare-table" aria-label="So sánh trước và sau Tẩy Luyện">
          <thead>
            <tr>
              <th scope="col">Chỉ số</th>
              <th scope="col">Trước</th>
              <th scope="col" aria-hidden="true"></th>
              <th scope="col">Sau</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in washPreviewRows" :key="row.key">
              <th scope="row">{{ row.label }}</th>
              <td>{{ row.before }}</td>
              <td class="qi-hall__compare-arrow" aria-hidden="true">⇒</td>
              <td>{{ row.after }}</td>
            </tr>
          </tbody>
        </table>

        <p class="qi-hall__costline">
          Chi phí: {{ washCost.refinementPoints }} Điểm Rèn · {{ washCost.spiritStone }}
          {{ spiritStoneCostName }}
        </p>

        <GameButton size="sm" :disabled="!canWash()" @click="doWash()">
          Tẩy Luyện — roll lại toàn bộ dòng phụ
        </GameButton>
      </template>
    </section>

    <!-- ===== TINH LUYỆN (§7.4) ===== -->
    <section v-else-if="activeTab === 'refine'" class="qi-hall__body">
      <div class="qi-hall__slot-grid" aria-label="Chọn trang bị để tinh luyện">
        <SlotView
          v-for="row in equippedRows.filter((entry) => entry.affixCount > 0)"
          :key="row.instanceId"
          class="qi-hall__slot"
          :item="row.instance"
          :label="row.name"
          :name-segments="row.nameSegments"
          :icon="row.icon"
          :equipment-quality-rank="row.qualityRank"
          :rarity-rank="row.rarityRank"
          :tooltip="row.tooltip"
          :state="{ interaction: row.instanceId === selectedInstanceId ? 'selected' : 'idle', marker: 'equipped' }"
          @click="selectEquipped(row.instanceId)"
        />
      </div>

      <p v-if="equippedRows.every((entry) => entry.affixCount === 0)" class="qi-hall__empty">
        Không có trang bị đang mặc nào có dòng phụ để Tinh Luyện.
      </p>

      <template v-if="selectedRow">
        <h4>Chọn dòng KHÓA (tối đa {{ Math.min(3, Math.max(0, selectedAffixes.length - 1)) }})</h4>

        <label
          v-for="affix in selectedAffixes"
          :key="affix.index"
          class="qi-hall__option"
        >
          <input
            type="checkbox"
            :checked="lockedIndices.includes(affix.index)"
            @change="toggleLock(affix.index)"
          />

          <span>{{ affix.label }} (tier {{ affix.tier }})</span>
        </label>

        <!-- Trước ⇒ Sau — từng chỉ số cùng một hàng -->
        <table class="qi-hall__compare-table" aria-label="So sánh trước và sau Tinh Luyện">
          <thead>
            <tr>
              <th scope="col">Chỉ số</th>
              <th scope="col">Trước</th>
              <th scope="col" aria-hidden="true"></th>
              <th scope="col">Sau</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in refinePreviewRows" :key="row.key">
              <th scope="row">{{ row.label }}</th>
              <td>{{ row.before }}</td>
              <td class="qi-hall__compare-arrow" aria-hidden="true">⇒</td>
              <td>{{ row.after }}</td>
            </tr>
          </tbody>
        </table>

        <p class="qi-hall__costline">
          Cost hệ số N+L = {{ refineCost.essenceUnits }} Tinh Hoa ·
          {{ refineCost.spiritStone }} {{ spiritStoneCostName }} ·
          {{ refineCost.refinementPoints }} Điểm Rèn (Tinh Hoa đang có {{ refineEssenceOwned }}).
        </p>

        <GameButton size="sm" :disabled="!canRefine()" @click="doRefine()">
          Tinh Luyện
        </GameButton>
      </template>
    </section>

    <!-- ===== HÓA LUYỆN (§7.5) ===== -->
    <section v-else class="qi-hall__body">
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

      <p class="qi-hall__hint">
        Đã chọn {{ dissolveSelected.size }}/{{ dissolveCandidates.length }} món qua filter hiện tại.
      </p>

      <!-- Fit-refactor đợt 4 — list Hóa Luyện phân trang theo ngân sách
           chiều cao thật của <ul> (ResizeObserver), không còn scroll. -->
      <ul ref="dissolveListEl" class="dissolve-list">
        <li
          v-for="candidate in dissolveCandidates.slice(dissolvePageRange.start, dissolvePageRange.end)"
          :key="candidate.instanceId"
          :class="{ 'is-selected': dissolveSelected.has(candidate.instanceId) }"
          @click="toggleDissolve(candidate.instanceId)"
        >
          <span>{{ candidate.name }}</span>

          <span>{{ candidate.slotLabel }} · {{ candidate.quality }}</span>
        </li>
      </ul>

      <div v-if="dissolveTotalPages > 1" class="dissolve-pagination">
        <GameButton variant="ghost" size="sm" :disabled="dissolvePage === 0" @click="dissolveGoTo(dissolvePage - 1)">‹</GameButton>
        <span class="dissolve-pagination__label">{{ dissolvePage + 1 }} / {{ dissolveTotalPages }}</span>
        <GameButton variant="ghost" size="sm" :disabled="dissolvePage >= dissolveTotalPages - 1" @click="dissolveGoTo(dissolvePage + 1)">›</GameButton>
      </div>

      <div v-if="dissolvePreview.length > 0" class="dissolve-preview">
        <h4>Xác nhận phân giải {{ dissolveSelected.size }} món:</h4>

        <p v-for="entry in dissolvePreview" :key="entry.materialId">
          {{ materialLabel(entry.materialId, gameManager.materialRegistry) }}: {{ entry.minAmount }}–{{ entry.maxAmount }}
        </p>

        <p class="qi-hall__warning">Thao tác KHÔNG thể hoàn tác.</p>

        <GameButton size="sm" variant="danger" :disabled="dissolveSelected.size === 0" @click="doDissolve">
          {{ dissolveConfirming ? 'XÁC NHẬN HÓA LUYỆN' : 'Hóa Luyện' }}
        </GameButton>
      </div>
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

.qi-hall__forge-scene {
  flex: 0 0 auto;
  border-bottom: 1px solid color-mix(in srgb, var(--scene-fire-text-soft) 35%, transparent);
  box-shadow: inset 0 -30px 45px rgba(0, 0, 0, .68);
}

.qi-hall__forge-scene :deep(.scene-header__image) {
  filter: sepia(.18) saturate(1.25) contrast(1.08);
}

.qi-hall__forge-scene :deep(.scene-header__caption) {
  bottom: 12px;
  color: var(--scene-fire-text);
  letter-spacing: .18em;
  text-shadow: 0 2px 5px #000;
}

.qi-hall__anvil {
  position: absolute;
  right: 32px;
  bottom: 18px;
  color: var(--scene-fire-text);
  font-size: var(--text-display-lg);
  filter: drop-shadow(0 0 10px color-mix(in srgb, var(--scene-fire-glow) 80%, transparent));
}

.qi-hall__forge-fire {
  position: absolute;
  right: 25px;
  bottom: -35px;
  width: 85px;
  height: 95px;
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--scene-fire-text) 95%, transparent), color-mix(in srgb, var(--scene-fire-glow) 60%, transparent) 35%, transparent 70%);
  filter: blur(4px);
  animation: forge-fire 1.35s ease-in-out infinite alternate;
}

.qi-hall__points {
  flex: 0 0 auto;
  padding: 8px 12px;
  font-size: var(--text-sm);
  color: var(--paper-text, #211f1a);
  border-bottom: 1px solid var(--paper-line, rgba(42, 41, 36, 0.42));
}

.qi-hall__tabs {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(var(--tab-columns, 4), 1fr);
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--scene-fire-text-soft) 20%, transparent);
  background: color-mix(in srgb, var(--scene-fire-deep) 88%, transparent);
}

/* Bảng so sánh Trước ⇒ Sau dùng chung Tẩy/Tinh Luyện (rework 2026-08-30)
   — từng chỉ số nằm CÙNG MỘT HÀNG, hết tình trạng "trước/sau tách rời". */
.qi-hall__compare-table {
  width: 100%;
  margin: 0;
  border-collapse: collapse;
  font-size: var(--text-xs);
}

.qi-hall__compare-table th,
.qi-hall__compare-table td {
  padding: 4px 6px;
  border-bottom: 1px solid color-mix(in srgb, var(--paper-line, rgba(42, 41, 36, 0.42)) 60%, transparent);
  text-align: left;
  color: var(--paper-text, #211f1a);
}

.qi-hall__compare-table thead th {
  font-weight: 600;
  color: var(--paper-text-soft, #5e5a50);
}

.qi-hall__compare-table tbody th {
  font-weight: 500;
}

.qi-hall__compare-table td.qi-hall__compare-arrow {
  width: 24px;
  padding: 4px 2px;
  text-align: center;
  color: var(--paper-text-soft, #5e5a50);
  border-bottom-color: transparent;
}

/* Fit-refactor đợt 4 — body là ngân sách flex; section nào dài (Hóa Luyện)
   tự paginate, section ngắn (Cường Hóa...) flex-fit; overflow hidden là rào
   cuối, KHÔNG dùng để scroll. */
.qi-hall__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.qi-hall__hint {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--paper-text-soft, #5e5a50);
}

.qi-hall__body h4 {
  margin: 0;
  color: var(--paper-text, #211f1a);
  font-size: var(--text-sm);
}

.qi-hall__option {
  color: var(--paper-text, #211f1a);
}

.enhance-row {
  padding: 8px;
  background: linear-gradient(105deg, color-mix(in srgb, var(--scene-fire-deep) 70%, transparent), color-mix(in srgb, var(--ink-900) 82%, transparent));
  border: 1px solid color-mix(in srgb, var(--scene-fire-text-soft) 28%, transparent);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.enhance-row__head {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-sm);
}

.enhance-row__costs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.enhance-row__costs li.is-missing {
  color: var(--crimson);
}

.qi-hall__slot-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(70px, 1fr));
  gap: 8px;
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

.dissolve-list {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow: hidden;
}

.dissolve-pagination {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 6px;
}

.dissolve-pagination__label {
  font-size: var(--text-sm);
  color: var(--paper-text-soft, #5e5a50);
  font-variant-numeric: tabular-nums;
}

.dissolve-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 5px 8px;
  min-height: var(--tap-min);
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  cursor: pointer;
}

.dissolve-list li.is-selected {
  border-color: var(--crimson);
  color: var(--crimson);
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

@keyframes forge-fire {
  to { transform: scale(1.12) translateY(-4px); opacity: .82; }
}

@container overlay-panel (max-width: 760px) {
  .qi-hall__slot-grid { grid-template-columns: repeat(3, minmax(64px, 1fr)); }
}
</style>
