<script setup lang="ts">
// Khí Đường (Home Hub Phase 5) — cắt nguyên khối xử lý tab 'artifact'
// từ CraftingPanel.vue (không viết lại logic, chỉ đổi nơi ở).
// UI redesign Step 9 (2026-08-20, spec mục 16 "Luyện Khí") — thu gọn
// về THUẦN màn rèn: bỏ hẳn EquipmentPaperdoll (top 28%) + bag equip-
// by-click (bottom 22%, EquipmentBagSection cũ) — 2 khối đó là việc
// "quản lý trang bị đang mặc" (spec mục 11/13), giờ đã có ở Character
// header (Step 8) + Kho/tab Trang Bị (bag click-to-equip THẬT, xem
// BagGrid.vue), không cần giữ bản thứ 2 ở đây chỉ để duyệt/mặc đồ.
// Luồng liên-panel Trận Đài/Phù Viện "chọn 1 trang bị làm đích" cũng
// dời theo sang Kho (ui.pendingEquipTarget, xem stores/ui.ts + BagGrid.vue)
// — nó là hành động "chọn đồ đang mặc", không phải rèn. Visual center
// còn lại của màn này đúng CHỈ còn "Equipment đang rèn" (spec mục 35),
// tức enhance-view__preview bên dưới — đã nâng cấp icon "chữ cái trong
// vòng tròn" cũ thành SlotView thật (khung Quality/Phẩm + icon + tooltip
// đúng chuẩn, khớp mục 34 checklist "Có duplicate ItemSlot không?").
import { computed, ref } from 'vue'
import CraftProgress from './CraftProgress.vue'
import SlotView from '../common/SlotView.vue'
import BuildingConstructionGate from './BuildingConstructionGate.vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useEquipmentActions } from '@/composables/useEquipmentActions'
import { buildEquipmentTooltip } from '@/composables/useEquipmentTooltip'
import type { Equipment } from '@/core/equipment/Equipment'
import { formatNumber } from '@/core/format/NumberFormatter'
import { EQUIPMENT_QUALITY_IMPLICIT_MULTIPLIER, EQUIPMENT_QUALITY_LABELS } from '@/core/equipment/EquipmentQuality'
import { PHAM_LABELS } from '@/core/item/Pham'
import type { EquipmentSlot } from '@/core/equipment/EquipmentTypes'
import { EQUIPMENT_SLOT_LABELS } from '@/core/equipment/EquipmentTypes'
import { EQUIPMENT_SLOTS } from '@/core/equipment/EquipmentSlotState'
import type { StatType } from '@/core/stats/StatTypes'
import { calculateEquipmentScale, getMaxForgePoints } from '@/core/equipment/EquipmentSystem'

type OperationId = 'enhance' | 'wash' | 'refine' | 'forge' | 'upgradeQuality' | 'upgradeRealm' | 'addAffix' | 'upgradeAffixTier'

// Equipment Rework (2026-08-14) — Tinh Luyện đổi mục tiêu (reroll
// Implicit thay vì tăng level, xem EquipmentSystem.refine()) và thêm
// Rèn (forgePoints — đầu tư sức mạnh deterministic, thay vai trò cũ
// của refineLevel). costKey của 'forge' chỉ dùng để tra tên hiển thị —
// chi phí THẬT lấy qua gameManager.getForgeCost() (scale theo
// forgePoints hiện tại), giống hệt cách 'enhance' đã làm với
// getEnhanceCost() bên dưới.
const OPERATIONS: { id: OperationId; label: string; costKey: keyof Equipment }[] = [
  { id: 'enhance', label: 'Cường Hóa', costKey: 'enhanceCost' },
  { id: 'wash', label: 'Tẩy Luyện', costKey: 'washCost' },
  { id: 'refine', label: 'Tinh Luyện', costKey: 'refineCost' },
  { id: 'forge', label: 'Rèn', costKey: 'forgeCost' },
  { id: 'upgradeQuality', label: 'Nâng Phẩm', costKey: 'upgradeQualityCost' },
  { id: 'upgradeRealm', label: 'Nâng Cảnh Giới', costKey: 'upgradeRealmCost' },
  { id: 'addAffix', label: 'Thêm Dòng', costKey: 'addAffixCost' },
  { id: 'upgradeAffixTier', label: 'Nâng Cấp Dòng', costKey: 'upgradeAffixCost' },
]

// BUILDing spec mục 8/10 — Cường Hóa gắn theo SLOT (EquipmentSlotState,
// xem ghi chú "MASTER SPEC Mục XVI" ở đó), KHÔNG theo item cụ thể —
// đổi trang bị trong slot không mất cấp đã cường hóa. Vì vậy picker
// của thao tác này phải là CHỌN SLOT (rồi tự resolve item đang trang
// bị ở đó), không phải chọn thẳng 1 item trong túi như 6 thao tác còn
// lại (wash/refine/upgradeQuality/upgradeRealm/addAffix/
// upgradeAffixTier — tất cả đều sửa field NẰM TRÊN EquipmentInstance,
// xem EquipmentInstance.ts, nên phải tháo ra khỏi slot trước — spec
// mục 10 "Item đang trang bị phải tháo trước").
const SLOT_SCOPED_OPERATIONS: OperationId[] = ['enhance']

const STAT_DISPLAY_NAMES: Partial<Record<StatType, string>> = {
  attack: 'Công kích',
  defense: 'Phòng ngự',
  maxHp: 'Khí huyết',
  maxMp: 'Linh lực',
  attackSpeed: 'Tốc đánh',
  criticalRate: 'Tỉ lệ bạo kích',
  criticalDamage: 'ST bạo kích',
  dexterity: 'Thân Pháp',
  vitality: 'Thể Chất',
  strength: 'Căn Cốt',
  intelligence: 'Thần Thức',
  attunement: 'Linh Căn',
}

function statLabel(stat: StatType): string {
  return STAT_DISPLAY_NAMES[stat] ?? stat
}

const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()
const equipmentActions = useEquipmentActions()

// "tunghematandsuch" pass (2026-08-14) — Luyện Khí (mint 1 equipment
// MỚI từ Linh Thiết + Linh Thạch, xem GameManager.smeltEquipment()) —
// KHÔNG dùng OPERATIONS/selectedInstance (không sửa 1 item có sẵn, mà
// tạo MỚI), nên có state/picker riêng, tách hẳn khỏi khối enhance-view.
const LINH_THIET_IDS = ['black-iron', 'red-copper', 'thanh-dong', 'han-thiet', 'hoang-kim-linh-thiet']

const smeltTemplateId = ref<string | null>(null)
const smeltLinhThietId = ref<string>(LINH_THIET_IDS[0]!)
const smeltStatus = ref<'idle' | 'success' | 'failure'>('idle')

const smeltableTemplates = computed(() => gameManager.equipmentRegistry.getAll())

const canSmelt = computed(() => {
  stateVersion.value

  return smeltTemplateId.value !== null && gameManager.canSmeltEquipment(player.$state, smeltLinhThietId.value)
})

function smelt() {
  if (!smeltTemplateId.value) {
    return
  }

  const result = gameManager.smeltEquipment(smeltTemplateId.value, player.$state, smeltLinhThietId.value)

  smeltStatus.value = result ? 'success' : 'failure'

  if (result) {
    bumpState()
  }
}

const canRefineBuiCot = computed(() => {
  stateVersion.value

  return gameManager.canRefineBuiCot(player.$state)
})

function refineBuiCot() {
  if (gameManager.refineBuiCot(player.$state)) {
    bumpState()
  }
}

// refiningInstanceId (spec mục 12-13 "Function Slot") — item đã chọn
// GIỮ NGUYÊN qua nhiều lượt Tinh/Tẩy Luyện liên tiếp (không phải chọn
// lại mỗi lần), chỉ đổi khi người chơi tự chọn item khác hoặc rời
// panel (component unmount, ref mất theo). Không cần MOVE item khỏi
// EquipmentBag thật sự (đây vốn đã là container DUY NHẤT cho cả "còn
// trong túi" lẫn "đang trang bị", equip chỉ là boolean flag — xem
// EquipmentSystem.equip()) — persistence chỉ cần KHÔNG tự clear ref.
const selectedInstanceId = ref<string | null>(null)

// Slot picker riêng cho Cường Hóa (xem SLOT_SCOPED_OPERATIONS).
const selectedSlot = ref<EquipmentSlot | null>(null)

const selectedOperation = ref<OperationId | null>(null)
const lastStatus = ref<'idle' | 'success' | 'failure'>('idle')

const selectedAffixIndex = ref<number | null>(null)

// Processing lock (spec mục 17-19) — mọi thao tác artifact đều đi qua
// 1 độ trễ ngắn có khoá UI, dù mutation nền vẫn đồng bộ/tức thời.
const ACTION_DURATION_MS = 1000
const isProcessing = ref(false)

const ownedEquipment = computed(() => {
  stateVersion.value

  return gameManager.equipmentBag.getAll()
})

const isSlotScopedOperation = computed(
  () => selectedOperation.value !== null && SLOT_SCOPED_OPERATIONS.includes(selectedOperation.value),
)

const equippedInSelectedSlot = computed(() => {
  stateVersion.value

  if (!selectedSlot.value) {
    return null
  }

  return ownedEquipment.value.find(instance => instance.slot === selectedSlot.value && instance.equipped) ?? null
})

const selectedInstance = computed(() =>
  isSlotScopedOperation.value
    ? equippedInSelectedSlot.value
    : ownedEquipment.value.find(instance => instance.instanceId === selectedInstanceId.value) ?? null,
)

// spec mục 10 — item ĐANG trang bị phải tháo trước khi Tinh/Tẩy
// Luyện/Nâng Phẩm/Nâng Cảnh Giới/Affix (những field NẰM TRÊN
// EquipmentInstance, xem ghi chú SLOT_SCOPED_OPERATIONS phía trên).
// Cường Hóa KHÔNG áp dụng — slot-scoped, item equipped hay không
// không quan trọng.
const requiresUnequipFirst = computed(
  () => !isSlotScopedOperation.value && selectedInstance.value?.equipped === true,
)

const selectedSlotState = computed(() => {
  stateVersion.value

  return selectedInstance.value ? gameManager.getSlotState(selectedInstance.value.slot) : null
})

// Tooltip THẬT cho preview (thay hộp "chữ cái trong vòng tròn" cũ,
// không có tooltip nào cả) — cùng công thức buildEquipmentTooltip mà
// EquipmentPaperdoll.vue/EquipmentBagSection.vue đang dùng, slotState
// chỉ có ý nghĩa khi item ĐANG trang bị (y hệt pattern trong
// EquipmentBagSection.vue's cells computed).
const previewTooltip = computed(() => {
  stateVersion.value

  if (!selectedInstance.value) {
    return undefined
  }

  return buildEquipmentTooltip(
    selectedInstance.value,
    gameManager.equipmentRegistry.get(selectedInstance.value.itemId),
    gameManager.affixRegistry,
    selectedInstance.value.equipped ? gameManager.getSlotState(selectedInstance.value.slot) : null,
    gameManager.formationRegistry,
    gameManager.talismanRegistry,
    gameManager.zoneRegistry,
    gameManager.equipmentSetRegistry,
  )
})

const artifactMaterials = computed(() => {
  // BẮT BUỘC đọc trực tiếp stateVersion.value ở đây (không chỉ qua
  // selectedInstance/selectedSlotState) — 2 computed đó trả về THẲNG
  // object bị mutate-in-place, Vue coi "giá trị không đổi" (cùng
  // reference) và KHÔNG re-run computed phụ thuộc dù state đã đổi
  // thật (vd sau addAffix/upgradeAffixTier trừ nguyên liệu).
  stateVersion.value

  if (!selectedInstance.value || !selectedOperation.value) {
    return []
  }

  const template = gameManager.equipmentRegistry.get(selectedInstance.value.itemId)

  const operation = OPERATIONS.find(op => op.id === selectedOperation.value)!

  const cost = operation.id === 'enhance'
    ? gameManager.getEnhanceCost(selectedInstance.value.instanceId)
    : operation.id === 'forge'
      ? gameManager.getForgeCost(selectedInstance.value.instanceId)
      : (template[operation.costKey] as Equipment['enhanceCost']) ?? []

  return cost.map(entry => ({
    key: entry.materialId,

    label: gameManager.materialRegistry.has(entry.materialId)
      ? gameManager.materialRegistry.get(entry.materialId).name
      : entry.materialId,

    owned: gameManager.materialBag.getAmount(entry.materialId),

    required: entry.amount,
  }))
})

const statPreviewRows = computed(() => {
  stateVersion.value

  if (!selectedInstance.value || !selectedSlotState.value) {
    return []
  }

  const instance = selectedInstance.value

  const enhanceLevel = selectedSlotState.value.enhanceLevel

  const currentScale = calculateEquipmentScale(enhanceLevel, instance.forgePoints)

  // Tinh Luyện (refine) giờ reroll Implicit thay vì tăng scale — không
  // còn before/after xác định trước để hiện (kết quả ngẫu nhiên trong
  // range), nên KHÔNG nằm trong nhánh tính afterScale này nữa.
  const afterScale = selectedOperation.value === 'enhance'
    ? calculateEquipmentScale(enhanceLevel + 1, instance.forgePoints)
    : selectedOperation.value === 'forge'
      ? calculateEquipmentScale(enhanceLevel, instance.forgePoints + 1)
      : currentScale

  const mainRow = {
    stat: instance.mainStat.stat,

    label: `${statLabel(instance.mainStat.stat)} (Implicit)`,

    current: Math.round((instance.mainStat.flat ?? 0) * currentScale * 10) / 10,

    after: Math.round((instance.mainStat.flat ?? 0) * afterScale * 10) / 10,

    affixIndex: null as number | null,

    isExalted: false,
  }

  const affixRows = instance.affixes.map((rolled, index) => {
    const affix = gameManager.affixRegistry.get(rolled.affixId)

    const kindLabel = affix.kind === 'prefix' ? 'Tiền Tố' : 'Hậu Tố'

    return {
      stat: affix.stat,

      label: `${statLabel(affix.stat)} (${kindLabel} T${rolled.tier})`,

      current: Math.round(rolled.value * currentScale * 10) / 10,

      after: Math.round(rolled.value * afterScale * 10) / 10,

      affixIndex: index,

      // Exalted Affix (Equipment Rework mục 2) — affix bonus roll từ
      // pool 'supreme' của rarity thien_duyen, tô nổi bật riêng trong
      // stat list (--affix-exalted, xem assets/theme.css).
      isExalted: affix.pool === 'supreme',
    }
  })

  return [mainRow, ...affixRows]
})

// Tinh Luyện giờ reroll Implicit (random trong range) thay vì tăng
// scale deterministic — không có before/after cố định để hiện (xem
// statPreviewRows), thay bằng gợi ý khoảng roll sẽ rơi vào.
const refineRollRangeHint = computed(() => {
  if (selectedOperation.value !== 'refine' || !selectedInstance.value) {
    return null
  }

  const template = gameManager.equipmentRegistry.get(selectedInstance.value.itemId)

  const scale = calculateEquipmentScale(
    selectedSlotState.value?.enhanceLevel ?? 0,
    selectedInstance.value.forgePoints,
  )

  const qualityMultiplier = EQUIPMENT_QUALITY_IMPLICIT_MULTIPLIER[selectedInstance.value.quality]

  const min = Math.round(template.mainStat.min * qualityMultiplier * scale)

  const max = Math.round(template.mainStat.max * qualityMultiplier * scale)

  return `${statLabel(template.mainStat.stat)} sẽ roll lại trong khoảng ${min} – ${max}`
})

const artifactCanExecute = computed(() => {
  if (isProcessing.value || !selectedInstance.value || !selectedOperation.value) {
    return false
  }

  if (requiresUnequipFirst.value) {
    return false
  }

  if (selectedOperation.value === 'upgradeAffixTier' && selectedAffixIndex.value === null) {
    return false
  }

  return artifactMaterials.value.every(material => material.owned >= material.required)
})

function selectArtifactRecipe(id: string) {
  selectedOperation.value = id as OperationId

  selectedAffixIndex.value = null

  lastStatus.value = 'idle'
}

function selectAffixRow(affixIndex: number | null) {
  if (selectedOperation.value !== 'upgradeAffixTier' || affixIndex === null) {
    return
  }

  selectedAffixIndex.value = affixIndex
}

function executeArtifact() {
  if (!artifactCanExecute.value || !selectedInstance.value || !selectedOperation.value) {
    return
  }

  const instanceId = selectedInstance.value.instanceId
  const operation = selectedOperation.value
  const affixIndex = selectedAffixIndex.value

  isProcessing.value = true

  // spec mục 17-19 — khoá UI trong lúc "xử lý" dù mutation nền vẫn
  // đồng bộ; chặn double-click/đổi item/đổi thao tác giữa chừng qua
  // :disabled trong template (artifactCanExecute/isProcessing).
  window.setTimeout(() => {
    let ok: boolean

    switch (operation) {
      case 'enhance':
        ok = equipmentActions.enhance(instanceId)
        break

      case 'wash':
        ok = equipmentActions.wash(instanceId)
        break

      case 'refine':
        ok = equipmentActions.refine(instanceId)
        break

      case 'forge':
        ok = equipmentActions.forge(instanceId)
        break

      case 'upgradeQuality':
        ok = equipmentActions.upgradeQuality(instanceId)
        break

      case 'upgradeRealm':
        ok = equipmentActions.upgradeRealm(instanceId)
        break

      case 'addAffix':
        ok = equipmentActions.addAffix(instanceId)
        break

      case 'upgradeAffixTier':
        ok = affixIndex !== null && equipmentActions.upgradeAffixTier(instanceId, affixIndex)
        break
    }

    if (ok) {
      selectedAffixIndex.value = null
    }

    lastStatus.value = ok ? 'success' : 'failure'

    isProcessing.value = false
  }, ACTION_DURATION_MS)
}

</script>

<template>
  <BuildingConstructionGate building-id="equipment_hall">
    <div class="equipment-hall">
      <div class="enhance-view">
        <div class="enhance-view__preview">
          <div class="enhance-view__icon-wrap">
            <SlotView
              class="enhance-view__icon"
              :item="selectedInstance"
              :rarity="selectedInstance?.quality"
              :item-rarity="selectedInstance?.rarity"
              :item-icon="selectedInstance ? gameManager.equipmentRegistry.get(selectedInstance.itemId).icon : undefined"
              :tooltip="previewTooltip"
            />

            <span v-if="selectedSlotState" class="enhance-view__level-badge">+{{ selectedSlotState.enhanceLevel }}</span>
          </div>

          <p class="enhance-view__name">
            {{ selectedInstance ? gameManager.equipmentRegistry.get(selectedInstance.itemId).name : 'Chưa chọn trang bị' }}
          </p>

          <p v-if="selectedInstance" class="enhance-view__quality">
            {{ EQUIPMENT_QUALITY_LABELS[selectedInstance.quality] }}
          </p>

          <p v-if="selectedInstance" class="enhance-view__rarity" :style="{ color: `var(--item-rarity-${selectedInstance.rarity})` }">
            {{ PHAM_LABELS[selectedInstance.rarity] }}
          </p>

          <div v-if="selectedInstance" class="enhance-view__potential">
            <div class="enhance-view__potential-bar">
              <div class="enhance-view__potential-fill" :style="{ width: `${selectedInstance.forgePotential}%` }" />
            </div>
            <span class="enhance-view__potential-label">Tiềm Năng Rèn {{ selectedInstance.forgePotential }}/100</span>
          </div>

          <div v-if="selectedInstance" class="enhance-view__forge">
            <div class="enhance-view__forge-bar">
              <div
                class="enhance-view__forge-fill"
                :style="{ width: `${Math.min(100, (selectedInstance.forgePoints / Math.max(1, getMaxForgePoints(selectedInstance.quality, selectedInstance.forgePotential))) * 100)}%` }"
              />
            </div>
            <span class="enhance-view__forge-label">
              Rèn {{ selectedInstance.forgePoints }} / {{ getMaxForgePoints(selectedInstance.quality, selectedInstance.forgePotential) }}
            </span>
          </div>

          <!-- Cường Hóa gắn theo SLOT — chọn slot, tự resolve item đang
               trang bị (spec mục 8). Các thao tác khác chọn thẳng item
               trong túi, nhưng item ĐANG trang bị bị chặn (mục 10, xem
               requiresUnequipFirst) — người chơi phải tháo ra trước. -->
          <select v-if="isSlotScopedOperation" v-model="selectedSlot" class="enhance-view__select" :disabled="isProcessing">
            <option :value="null">— Chọn vị trí —</option>
            <option v-for="slot in EQUIPMENT_SLOTS" :key="slot" :value="slot">
              {{ EQUIPMENT_SLOT_LABELS[slot] }}
            </option>
          </select>

          <select v-else v-model="selectedInstanceId" class="enhance-view__select" :disabled="isProcessing">
            <option :value="null">— Chọn trang bị —</option>
            <option v-for="instance in ownedEquipment" :key="instance.instanceId" :value="instance.instanceId">
              {{ gameManager.equipmentRegistry.get(instance.itemId).name }} ({{ EQUIPMENT_QUALITY_LABELS[instance.quality] }}){{ instance.equipped ? ' · Đang trang bị' : '' }}
            </option>
          </select>

          <p v-if="isSlotScopedOperation && selectedSlot && !selectedInstance" class="enhance-view__hint">
            Chưa có trang bị ở vị trí này.
          </p>

          <p v-if="requiresUnequipFirst" class="enhance-view__hint enhance-view__hint--warning">
            Tháo trang bị trước khi thao tác.
          </p>
        </div>

        <div class="enhance-view__detail">
          <div class="enhance-view__ops">
            <button
              v-for="operation in OPERATIONS"
              :key="operation.id"
              type="button"
              :disabled="isProcessing"
              :class="{ 'is-active': selectedOperation === operation.id }"
              @click="selectArtifactRecipe(operation.id)"
            >
              {{ operation.label }}
            </button>
          </div>

          <div class="enhance-view__stats">
            <p v-if="statPreviewRows.length === 0" class="enhance-view__stats-empty">Chọn trang bị để xem chỉ số.</p>

            <p v-if="selectedOperation === 'upgradeAffixTier'" class="enhance-view__stats-empty">Chọn 1 dòng Affix để nâng cấp Tier.</p>

            <p v-if="refineRollRangeHint" class="enhance-view__stats-empty">{{ refineRollRangeHint }}</p>

            <div
              v-for="row in statPreviewRows"
              :key="row.affixIndex ?? 'implicit'"
              class="enhance-stat-row"
              :class="{
                'is-selectable': selectedOperation === 'upgradeAffixTier' && row.affixIndex !== null,
                'is-selected': selectedOperation === 'upgradeAffixTier' && row.affixIndex === selectedAffixIndex,
                'is-exalted': row.isExalted,
              }"
              @click="selectAffixRow(row.affixIndex)"
            >
              <span class="enhance-stat-row__label">{{ row.label }}</span>
              <span class="enhance-stat-row__value">{{ row.current }}</span>
              <template v-if="row.after !== row.current">
                <span class="enhance-stat-row__arrow">→</span>
                <span class="enhance-stat-row__after">{{ row.after }}</span>
              </template>
            </div>
          </div>

          <div class="enhance-view__materials">
            <div v-for="material in artifactMaterials" :key="material.key" class="enhance-material">
              <SlotView
                class="enhance-material__slot"
                :item="material"
                :label="material.label"
                :highlight="material.owned >= material.required ? 'ok' : 'missing'"
              />
              <span class="enhance-material__count">{{ formatNumber(material.owned) }} / {{ formatNumber(material.required) }}</span>
            </div>

            <p v-if="selectedOperation && artifactMaterials.length === 0" class="enhance-view__stats-empty">Không cần nguyên liệu</p>
          </div>

          <button type="button" class="enhance-view__execute" :disabled="!artifactCanExecute" @click="executeArtifact">
            {{ selectedOperation ? OPERATIONS.find(op => op.id === selectedOperation)?.label : 'Chọn thao tác' }}
          </button>

          <CraftProgress :status="isProcessing ? 'processing' : lastStatus" :progress="0" />
        </div>
      </div>

      <div class="equipment-hall__smelt">
        <div class="smelt-row">
          <span class="smelt-row__label">Luyện Khí</span>

          <select v-model="smeltTemplateId" class="smelt-row__select">
            <option :value="null">— Chọn Khí —</option>
            <option v-for="template in smeltableTemplates" :key="template.id" :value="template.id">
              {{ template.name }}
            </option>
          </select>

          <select v-model="smeltLinhThietId" class="smelt-row__select">
            <option v-for="materialId in LINH_THIET_IDS" :key="materialId" :value="materialId">
              {{ gameManager.materialRegistry.has(materialId) ? gameManager.materialRegistry.get(materialId).name : materialId }}
            </option>
          </select>

          <span class="smelt-row__cost">3 Linh Thiết + 20 Linh Thạch</span>

          <button type="button" :disabled="!canSmelt" @click="smelt">Luyện</button>

          <span v-if="smeltStatus !== 'idle'" class="smelt-row__status" :class="`smelt-row__status--${smeltStatus}`">
            {{ smeltStatus === 'success' ? 'Thành công! (+2 Bụi Cốt)' : 'Thất bại' }}
          </span>
        </div>

        <div class="smelt-row">
          <span class="smelt-row__label">Tinh Luyện Cốt</span>
          <span class="smelt-row__cost">5 Bụi Cốt + 10 Linh Thạch</span>
          <button type="button" :disabled="!canRefineBuiCot" @click="refineBuiCot">Chuyển Hoá</button>
        </div>
      </div>
    </div>
  </BuildingConstructionGate>
</template>

<style scoped>
.equipment-hall {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

/* "tunghematandsuch" pass — Luyện Khí/Tinh Luyện Cốt, 2 hàng gọn ở
   cuối màn, không phải instance-scoped nên tách hẳn khỏi OPERATIONS/
   selectedInstance. */
.equipment-hall__smelt {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  border-top: 1px solid var(--ink-line);
  font-family: var(--font-body);
}

.smelt-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.smelt-row__label {
  flex: 0 0 auto;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--gold-500);
  min-width: 70px;
}

.smelt-row__select {
  flex: 1 1 auto;
  min-width: 80px;
  background: var(--ink-900);
  color: var(--text-primary);
  border: 1px solid var(--ink-line);
  border-radius: var(--radius-sm);
  padding: 3px;
  font-size: 0.68rem;
}

.smelt-row__cost {
  flex: 0 0 auto;
  font-size: 0.62rem;
  color: var(--text-secondary);
}

.smelt-row button {
  flex: 0 0 auto;
  padding: 4px 10px;
  background: var(--gold-500);
  color: var(--gold-ink);
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 700;
  font-size: 0.68rem;
  cursor: pointer;
}

.smelt-row button:disabled {
  background: var(--ink-700);
  color: var(--text-muted);
  cursor: not-allowed;
}

.smelt-row__status {
  font-size: 0.62rem;
}

.smelt-row__status--success {
  color: var(--jade);
}

.smelt-row__status--failure {
  color: var(--crimson);
}

/* ==== Enhance ("Khí") — preview lớn bên trái + before/after +
   material list bên phải, cắt nguyên vẹn từ CraftingPanel.vue.
   UI redesign Step 9 — flex:1 auto (trước là 46%, cố định để chừa chỗ
   cho paperdoll/bag đã bỏ) — giờ là khối DUY NHẤT còn lại phía trên
   khối Luyện Khí, chiếm hết chiều cao còn dư. ==== */
.enhance-view {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  gap: 8px;
  padding: 8px;
  font-family: var(--font-body);
  color: var(--text-primary);
}

.enhance-view__preview {
  flex: 0 0 42%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-md);
}

/* SlotView thật thay "chữ cái trong vòng tròn" cũ (UI redesign Step 9)
   — wrapper chỉ để định vị badge cấp cường hóa (absolute, xem
   .enhance-view__level-badge) chồng lên góc SlotView. */
.enhance-view__icon-wrap {
  position: relative;
  width: 56%;
  margin-bottom: 4px;
}

.enhance-view__icon {
  width: 100%;
}

.enhance-view__level-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  padding: 2px 6px;
  border-radius: 10px;
  background: var(--gold-500);
  color: var(--gold-ink);
  font-size: 0.7rem;
  font-weight: 700;
}

.enhance-view__name {
  margin: 0;
  font-family: var(--font-display);
  font-size: 0.85rem;
  font-weight: 600;
  text-align: center;
}

.enhance-view__quality {
  /* "EquipemtnQuality&rarity" pass — Phẩm Chất giờ hiện NỔI BẬT hơn
     hẳn Tiềm Năng Rèn bên dưới (font lớn hơn, có viền) — đúng tinh
     thần "phẩm chất ở header, chất lượng chỉ ở phần chế tạo". */
  margin: 2px 0 0;
  padding: 2px 10px;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--gold-500);
  border: 1px solid var(--gold-500);
  border-radius: var(--radius-sm);
}

.enhance-view__rarity {
  margin: 0;
  font-size: 0.62rem;
  font-weight: 700;
}

.enhance-view__potential {
  width: 100%;
  margin-top: 6px;
}

.enhance-view__potential-bar {
  height: 4px;
  border-radius: 2px;
  background: var(--ink-900);
  border: 1px solid var(--ink-line);
  overflow: hidden;
}

.enhance-view__potential-fill {
  height: 100%;
  background: var(--text-secondary);
  transition: width 0.15s ease;
}

.enhance-view__potential-label {
  display: block;
  margin-top: 2px;
  font-size: 0.58rem;
  color: var(--text-muted);
  text-align: center;
}

.enhance-view__forge {
  width: 100%;
  margin-top: 6px;
}

.enhance-view__forge-bar {
  height: 6px;
  border-radius: 3px;
  background: var(--ink-900);
  border: 1px solid var(--ink-line);
  overflow: hidden;
}

.enhance-view__forge-fill {
  height: 100%;
  background: var(--gold-500);
  transition: width 0.15s ease;
}

.enhance-view__forge-label {
  display: block;
  margin-top: 2px;
  font-size: 0.6rem;
  color: var(--text-secondary);
  text-align: center;
}

.enhance-view__select {
  width: 100%;
  margin-top: 6px;
  background: var(--ink-900);
  color: var(--text-primary);
  border: 1px solid var(--ink-line);
  border-radius: var(--radius-sm);
  padding: 4px;
}

.enhance-view__hint {
  margin: 4px 0 0;
  font-size: 0.65rem;
  color: var(--text-muted);
}

.enhance-view__hint--warning {
  color: var(--crimson);
}

.enhance-view__detail {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
}

.enhance-view__ops {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.enhance-view__ops button {
  flex: 1 1 auto;
  padding: 4px 6px;
  font-size: 0.65rem;
  background: var(--ink-800);
  color: var(--text-secondary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.enhance-view__ops button.is-active {
  border-color: var(--gold-500);
  color: var(--gold-500);
}

.enhance-view__stats {
  flex: 0 0 auto;
  max-height: 30%;
  overflow-y: auto;
  padding: 4px 6px;
  background: var(--ink-800);
  border-radius: var(--radius-sm);
}

.enhance-view__stats-empty {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.68rem;
}

.enhance-stat-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.68rem;
  padding: 1px 3px;
  border-radius: var(--radius-sm);
}

.enhance-stat-row.is-selectable {
  cursor: pointer;
}

.enhance-stat-row.is-selectable:hover {
  background: var(--ink-700);
}

.enhance-stat-row.is-selected {
  background: var(--ink-700);
  outline: 1px solid var(--gold-500);
}

.enhance-stat-row.is-exalted {
  outline: 1px solid var(--affix-exalted);
}

.enhance-stat-row.is-exalted .enhance-stat-row__label {
  color: var(--affix-exalted);
}

.enhance-stat-row__label {
  flex: 1;
  color: var(--text-secondary);
}

.enhance-stat-row__value {
  color: var(--text-primary);
}

.enhance-stat-row__arrow {
  color: var(--text-muted);
}

.enhance-stat-row__after {
  color: var(--jade);
  font-weight: 600;
}

.enhance-view__materials {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 8px;
  overflow-y: auto;
}

.enhance-material {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 0 0 48px;
}

.enhance-material__slot {
  width: 48px;
}

.enhance-material__count {
  font-size: 0.6rem;
  color: var(--text-secondary);
  margin-top: 2px;
}

.enhance-view__execute {
  flex: 0 0 auto;
  padding: 6px;
  background: var(--gold-500);
  color: var(--gold-ink);
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 700;
  cursor: pointer;
}

.enhance-view__execute:disabled {
  background: var(--ink-700);
  color: var(--text-muted);
  cursor: not-allowed;
}
</style>
