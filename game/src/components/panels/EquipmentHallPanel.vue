<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useEquipmentActions } from '@/composables/useEquipmentActions'
import { SPIRIT_STONE_MATERIAL_ID } from '@/core/material/SpiritStoneMaterial'
import {
  WASH_ORE_AMOUNT,
  WASH_REFINEMENT_COST,
  WASH_SPIRIT_STONE_COST,
  REFINE_REFINEMENT_COST,
  REFINE_SPIRIT_STONE_PER_UNIT,
  equipmentEssenceMaterialId,
} from '@/core/equipment/RefinementBalance'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'
import type { EquipmentSlot } from '@/core/equipment/EquipmentTypes'

// Khí Đường (2026-08-25, resource-professions-rework plan §7/§9.2) —
// bốn tab ĐÚNG contract: Cường Hóa (slot), Tẩy Luyện (identity substat
// theo phẩm Quáng), Tinh Luyện (±20% giá trị + khóa dòng N+L), Hóa
// Luyện (destructive → Tinh Hoa, batch all-or-nothing).
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

const activeTab = ref<TabId>('enhance')

function switchTab(tab: TabId) {
  activeTab.value = tab
}

// =========================
// Dữ liệu chung — slot đang mặc + bag
// =========================

interface EquippedRow {
  instanceId: string

  slot: EquipmentSlot

  name: string

  realmId: string

  quality: string

  affixCount: number
}

const equippedRows = computed<EquippedRow[]>(() => {
  stateVersion.value

  return gameManager.equipmentBag.getEquipped().map((instance) => {
    const template = gameManager.equipmentRegistry.get(instance.itemId)

    return {
      instanceId: instance.instanceId,

      slot: instance.slot,

      name: template?.name ?? instance.itemId,

      realmId: instance.realmId,

      quality: instance.quality,

      affixCount: instance.affixes.length,
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

  costs: Array<{ materialId: string; amount: number; owned: number }>

  spiritStone: number
}

const enhanceRows = computed<EnhanceSlotRow[]>(() => {
  stateVersion.value

  // Slot-level rework (yêu cầu 2026-08-26): Cường Hóa gắn SLOT —
  // slot TRỐNG vẫn hiện trần/cost và nâng được; realmId lấy theo người
  // chơi hiện hành để resolve catalog nghề.
  const realmId = player.$state.realmId

  return gameManager.getAllSlotStates().map((slotState) => {
    const equipped = gameManager.equipmentBag.getEquippedInSlot(slotState.slot)

    const costs = gameManager.getEnhanceCost(slotState.slot, realmId).map((entry) => ({
      materialId: entry.materialId,

      amount: entry.amount,

      owned: gameManager.materialBag.getAmount(entry.materialId),
    }))

    const spiritStone = gameManager.getEnhanceSpiritStoneCost(slotState.slot, realmId)

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
    }
  })
})

function canEnhance(row: EnhanceSlotRow): boolean {
  return (
    row.enhanceLevel < row.maxLevel &&
    row.costs.every((cost) => cost.owned >= cost.amount) &&
    spiritStoneOwned.value >= row.spiritStone
  )
}

function doEnhance(row: EnhanceSlotRow) {
  enhance(row.slot)
}

// =========================
// Tab Tẩy Luyện
// =========================

function canWash(): boolean {
  const ren = itemRenState.value

  return (
    selectedRow.value !== null &&
    selectedOreId.value !== null &&
    ren !== null &&
    gameManager.materialBag.getAmount(selectedOreId.value) >= WASH_ORE_AMOUNT &&
    ren.points >= WASH_REFINEMENT_COST &&
    spiritStoneOwned.value >= WASH_SPIRIT_STONE_COST
  )
}

function doWash() {
  if (!selectedRow.value || !selectedOreId.value) {
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

  return instance.affixes.map((rolled, index) => ({
    index,

    label: gameManager.affixRegistry.has(rolled.affixId)
      ? rolled.affixId
      : rolled.affixId,

    tier: rolled.tier,
  }))
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

const refineEssenceUnits = computed(
  () => (selectedAffixes.value.length || 0) + lockedIndices.value.length,
)

// Plan Workstream F — số dư Linh Thạch đọc từ MaterialBag.
const spiritStoneOwned = computed(() => {
  stateVersion.value

  return gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)
})

const refineEssenceOwned = computed(() => {
  stateVersion.value

  if (!selectedRow.value) {
    return 0
  }

  return gameManager.materialBag.getAmount(equipmentEssenceMaterialId(selectedRow.value.realmId))
})

function canRefine(): boolean {
  const ren = itemRenState.value

  return (
    selectedAffixes.value.length > 0 &&
    lockedIndices.value.length < selectedAffixes.value.length &&
    refineEssenceOwned.value >= refineEssenceUnits.value &&
    spiritStoneOwned.value >= refineEssenceUnits.value * REFINE_SPIRIT_STONE_PER_UNIT &&
    ren !== null &&
    ren.points >= REFINE_REFINEMENT_COST
  )
}

function doRefine() {
  if (!selectedRow.value) {
    return
  }

  refine(selectedRow.value.instanceId, [...lockedIndices.value])
}

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

        slotLabel: instance.slot,

        quality: instance.quality,

        realmId: instance.realmId,
      }
    })
})

// Tick nhẹ để preview cập nhật khi selection đổi (computed phụ thuộc
// stateVersion là chính).
const nowTick = ref(0)

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
    <header class="qi-hall__points">
      <template v-if="itemRenState !== null">
        <span>
          Tình trạng rèn món đang chọn:
          {{ itemRenState.points }}/{{ itemRenState.max }}
        </span>

        <small class="qi-hall__points-hint">
          Điểm Rèn gắn với từng món đồ (cùng ngân sách với Rèn +power) — cạn là hết phát triển.
        </small>
      </template>

      <span v-else>Chọn một trang bị để xem Tình trạng rèn của nó</span>
    </header>

    <nav class="qi-hall__tabs">
      <button
        v-for="tab in TABS"
        :key="tab.id"
        type="button"
        :class="{ 'is-active': activeTab === tab.id }"
        @click="switchTab(tab.id)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <!-- ===== CƯỜNG HÓA (slot-level, §7.1) ===== -->
    <section v-if="activeTab === 'enhance'" class="qi-hall__body">
      <p class="qi-hall__hint">Cường Hóa gắn với SLOT — đổi trang bị không mất cấp.</p>

      <article v-for="row in enhanceRows" :key="row.slot" class="enhance-row">
        <div class="enhance-row__head">
          <strong>{{ row.itemName }}</strong>

          <span>+{{ row.enhanceLevel }}/{{ row.maxLevel }}</span>
        </div>

        <ul v-if="row.enhanceLevel < row.maxLevel" class="enhance-row__costs">
          <li
            v-for="cost in row.costs"
            :key="cost.materialId"
            :class="{ 'is-missing': cost.owned < cost.amount }"
          >
            {{ cost.materialId }}: {{ cost.owned }}/{{ cost.amount }}
          </li>
        </ul>

        <button
          v-if="row.enhanceLevel < row.maxLevel"
          type="button"
          :disabled="!canEnhance(row)"
          @click="doEnhance(row)"
        >
          Cường Hóa
        </button>
      </article>
    </section>

    <!-- ===== TẦY LUYỆN (§7.3) ===== -->
    <section v-else-if="activeTab === 'wash'" class="qi-hall__body">
      <div class="qi-hall__picker">
        <button
          v-for="row in equippedRows"
          :key="row.instanceId"
          type="button"
          :class="{ 'is-selected': row.instanceId === selectedInstanceId }"
          @click="selectEquipped(row.instanceId)"
        >
          {{ row.name }}
        </button>
      </div>

      <template v-if="selectedRow">
        <h4>Chọn Quáng cùng cảnh giới (×{{ WASH_ORE_AMOUNT }})</h4>

        <label v-for="ore in oreChoices" :key="ore.materialId" class="qi-hall__option">
          <input type="radio" :value="ore.materialId" v-model="selectedOreId" />

          <span>{{ ore.name }}</span>

          <span class="qi-hall__owned">×{{ ore.owned }}</span>
        </label>

        <p class="qi-hall__costline">
          Chi phí: {{ WASH_REFINEMENT_COST }} Điểm Rèn (tình trạng rèn còn
          {{ itemRenState?.points ?? 0 }}) · {{ WASH_SPIRIT_STONE_COST }} Linh Thạch
        </p>

        <button type="button" class="qi-hall__action" :disabled="!canWash()" @click="doWash()">
          Tẩy Luyện — roll lại toàn bộ dòng phụ
        </button>
      </template>
    </section>

    <!-- ===== TINH LUYỆN (§7.4) ===== -->
    <section v-else-if="activeTab === 'refine'" class="qi-hall__body">
      <div class="qi-hall__picker">
        <button
          v-for="row in equippedRows.filter((entry) => entry.affixCount > 0)"
          :key="row.instanceId"
          type="button"
          :class="{ 'is-selected': row.instanceId === selectedInstanceId }"
          @click="selectEquipped(row.instanceId)"
        >
          {{ row.name }}
        </button>
      </div>

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

        <p class="qi-hall__costline">
          Giá trị từng dòng không khóa roll trong ±20%. Cost hệ số N+L =
          {{ refineEssenceUnits }} Tinh Hoa · {{ refineEssenceUnits * REFINE_SPIRIT_STONE_PER_UNIT }}
          Linh Thạch · {{ REFINE_REFINEMENT_COST }} Điểm Rèn (tình trạng rèn còn
          {{ itemRenState?.points ?? 0 }} · Tinh Hoa đang có {{ refineEssenceOwned }}).
        </p>

        <button type="button" class="qi-hall__action" :disabled="!canRefine()" @click="doRefine()">
          Tinh Luyện
        </button>
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

      <ul class="dissolve-list">
        <li
          v-for="candidate in dissolveCandidates"
          :key="candidate.instanceId"
          :class="{ 'is-selected': dissolveSelected.has(candidate.instanceId) }"
          @click="toggleDissolve(candidate.instanceId)"
        >
          <span>{{ candidate.name }}</span>

          <span>{{ candidate.slotLabel }} · {{ candidate.quality }}</span>
        </li>
      </ul>

      <div v-if="dissolvePreview.length > 0" class="dissolve-preview">
        <h4>Xác nhận phân giải {{ dissolveSelected.size }} món:</h4>

        <p v-for="entry in dissolvePreview" :key="entry.materialId">
          {{ entry.materialId }}: {{ entry.minAmount }}–{{ entry.maxAmount }}
        </p>

        <p class="qi-hall__warning">Thao tác KHÔNG thể hoàn tác.</p>

        <button type="button" class="qi-hall__action qi-hall__action--danger" @click="doDissolve">
          {{ dissolveConfirming ? 'XÁC NHẬN HÓA LUYỆN' : 'Hóa Luyện' }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.qi-hall {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--text-primary);
  font-family: var(--font-body);
}

.qi-hall__points {
  flex: 0 0 auto;
  padding: 8px 12px;
  font-size: var(--text-sm);
  color: var(--gold-500);
  border-bottom: 1px solid var(--ink-line-soft);
}

.qi-hall__tabs {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  padding: 8px 12px;
}

.qi-hall__tabs button {
  padding: 6px 4px;
  background: var(--ink-800);
  color: var(--text-secondary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: var(--text-xs);
}

.qi-hall__tabs button.is-active {
  border-color: var(--gold-500);
  color: var(--gold-500);
}

.qi-hall__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.qi-hall__hint {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.enhance-row {
  padding: 8px;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
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
  color: var(--danger, #e05d5d);
}

.qi-hall__picker {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.qi-hall__picker button {
  padding: 4px 8px;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  cursor: pointer;
  font-size: var(--text-xs);
  font-family: var(--font-body);
}

.qi-hall__picker button.is-selected {
  border-color: var(--gold-500);
  color: var(--gold-500);
}

.qi-hall__option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  font-size: var(--text-sm);
  cursor: pointer;
}

.qi-hall__owned {
  margin-left: auto;
  color: var(--text-secondary);
}

.qi-hall__costline {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.qi-hall__action {
  align-self: flex-start;
  padding: 8px 14px;
  background: var(--gold-500);
  color: var(--gold-ink);
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 700;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: var(--text-sm);
}

.qi-hall__action:disabled {
  background: var(--ink-700);
  color: var(--text-muted);
  cursor: not-allowed;
}

.qi-hall__action--danger {
  background: var(--danger, #e05d5d);
  color: #fff;
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
  font-family: var(--font-body);
}

.dissolve-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow-y: auto;
}

.dissolve-list li {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  padding: 5px 8px;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  cursor: pointer;
}

.dissolve-list li.is-selected {
  border-color: var(--danger, #e05d5d);
  color: var(--danger, #e05d5d);
}

.dissolve-preview h4 {
  margin: 0 0 4px;
  font-size: var(--text-sm);
}

.dissolve-preview p {
  margin: 0 0 3px;
  font-size: var(--text-xs);
  color: var(--jade);
}

.qi-hall__warning {
  font-size: var(--text-xs);
  color: var(--danger, #e05d5d);
}
</style>
