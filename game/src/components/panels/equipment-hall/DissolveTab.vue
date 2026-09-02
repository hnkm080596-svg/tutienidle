<script setup lang="ts">
// Task 19 (item-grade-quality-rework, rework P6) — Tab Hóa Luyện extracted
// from EquipmentHallPanel.vue shell. Fully self-contained multi-select —
// does NOT use the shared HALL_SELECTION_KEY (selectedInstanceId/
// selectEquipped) since Hóa Luyện has its own independent Set-based
// selection, confirmed by reading the pre-extraction template/script.
//
// Filter rework (Task 19 plan): the old 3-dropdown bridge (realm +
// rarity + quality, where rarity/quality secretly read the SAME
// ITEM_QUALITY/ITEM_GRADE-aliased axis) is now 2 dropdowns —
// grade (real ProfessionGrade axis, PROFESSION_GRADE_ORDER) and
// Chất (ITEM_QUALITY_ORDER, the merged rarity/quality dropdown) — plus
// a visual mismatch hint via canUseItemGrade() (Task 16's equip gate).
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useEquipmentActions } from '@/composables/useEquipmentActions'
import { usePanelPagination } from '@/composables/usePanelPagination'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'
import { materialLabel, equipmentRarityLabel } from '@/core/presentation/labels'
import { ITEM_QUALITY_ORDER } from '@/core/item/ItemQuality'
import { PROFESSION_GRADE_ORDER, PROFESSION_GRADE_NAMES } from '@/core/profession/ProfessionGrade'
import { canUseItemGrade } from '@/core/equipment/canUseItem'
import SlotView from '@/components/common/SlotView.vue'
import { buildEquipmentTooltip } from '@/composables/useEquipmentTooltip'
import { composeEquipmentNameSegments } from '@/core/equipment/EquipmentNaming'
import { itemQualityRank, professionGradeRank } from '@/composables/slots/normalizeSlotRank'
import GameButton from '@/components/common/GameButton.vue'

const { t } = useI18n({ useScope: 'local' })

const player = usePlayerStore()

const gameManager = useGameManager()

const { stateVersion } = useStateVersion()

const { dissolve } = useEquipmentActions()

// =========================
// Tab Hóa Luyện (§7.5) — filter + multi-select + preview + confirm
// =========================

interface DissolveCandidate {
  instanceId: string

  name: string

  grade: EquipmentInstance['grade']

  icon?: string

  nameSegments: ReturnType<typeof composeEquipmentNameSegments>

  // Audit fix 2026-08-31 — registry miss → không tooltip (pattern
  // EquippedRow.tooltip trong useEquippedRows.ts).
  tooltip?: ReturnType<typeof buildEquipmentTooltip>

  qualityRank: number

  rarityRank: number

  // Task 19 — hint trực quan khi phẩm món KHÔNG khớp cảnh giới hiện tại
  // của người chơi (canUseItemGrade, Task 16 equip gate).
  gradeMismatch: boolean
}

const dissolveFilterGrade = ref<string>('any')

const dissolveFilterQuality = ref<string>('any')

function passesDissolveFilter(instance: EquipmentInstance): boolean {
  if (dissolveFilterGrade.value !== 'any' && instance.grade !== dissolveFilterGrade.value) {
    return false
  }

  if (
    dissolveFilterQuality.value !== 'any' &&
    instance.quality !== dissolveFilterQuality.value
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

  const playerRealmId = player.$state.realmId

  return gameManager.equipmentBag
    .getAll()
    .filter((instance) => !instance.equipped && !instance.locked && !instance.favorite)
    .filter((instance) => passesDissolveFilter(instance))
    .map((instance) => {
      const template = gameManager.getEquipmentTemplate(instance.itemId)

      return {
        instanceId: instance.instanceId,

        name: template?.name ?? instance.itemId,

        grade: instance.grade,

        icon: instance.icon ?? template?.icon,

        nameSegments: template
          ? composeEquipmentNameSegments(instance, template, gameManager.zoneRegistry)
          : [{ text: instance.itemId }],

        // Audit fix 2026-08-31 — dùng lại template đã tra an toàn ở trên;
        // registry miss → không tooltip (SlotView tooltip optional),
        // không chết tab Hóa Luyện qua ErrorBoundary.
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

        rarityRank: itemQualityRank(instance.quality),

        gradeMismatch: !canUseItemGrade(instance.grade, playerRealmId),
      }
    })
})

// Hóa Luyện phân trang theo ngân sách chiều cao + CHIỀU RỘNG thật của
// lưới — bug 2026-09-01 (T2.3, user report "chỉ show đúng 1 món"):
// usePanelPagination gọi KHÔNG có columnWidth → columnCount cứng 1, khi
// ResizeObserver chưa fire availableHeight = 0 → pageSize = 1×1 = 1.
// Grid thật là CSS auto-fill minmax(64px) + gap 8px → columnWidth = 72
// (64 + 8 gap), pageSize = rows × measured columns.
const {
  containerEl: dissolveListEl,
  currentPage: dissolvePage,
  totalPages: dissolveTotalPages,
  goToPage: dissolveGoTo,
  pageItemsRange: dissolvePageRange,
} = usePanelPagination(
  computed(() => dissolveCandidates.value.length),
  80,
  { columnWidth: 72 },
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
  <section class="qi-hall__body qi-hall__dissolve">
    <div class="dissolve-filters">
      <select v-model="dissolveFilterGrade">
        <option value="any">{{ t('panels.equipmentHall.select.anyProfessionGrade') }}</option>

        <option v-for="grade in PROFESSION_GRADE_ORDER" :key="grade" :value="grade">
          {{ PROFESSION_GRADE_NAMES[grade] }}
        </option>
      </select>

      <!-- Chất — dropdown Chất duy nhất (Task 19: gộp rarity+quality cũ,
           2 dropdown đó vốn đã đọc CHUNG 1 trục ITEM_QUALITY/ITEM_GRADE). -->
      <select v-model="dissolveFilterQuality">
        <option value="any">{{ t('panels.equipmentHall.select.anyQuality') }}</option>

        <option v-for="quality in ITEM_QUALITY_ORDER" :key="quality" :value="quality">
          {{ equipmentRarityLabel(quality) }}
        </option>
      </select>

      <button
        type="button"
        class="dissolve-filters__bulk"
        :disabled="dissolveCandidates.length === 0"
        @click="selectAllDissolveByFilter"
      >
        {{ t('panels.equipmentHall.buttons.selectAll') }} ({{ dissolveCandidates.length }})
      </button>

      <button
        type="button"
        class="dissolve-filters__bulk"
        :disabled="dissolveSelected.size === 0"
        @click="clearDissolveSelection"
      >
        {{ t('panels.equipmentHall.buttons.clearAll') }}
      </button>
    </div>

    <div ref="dissolveListEl" class="dissolve-grid">
      <div
        v-for="candidate in dissolveCandidates.slice(dissolvePageRange.start, dissolvePageRange.end)"
        :key="candidate.instanceId"
        class="dissolve-slot-wrap"
        :class="{ 'dissolve-slot-wrap--grade-mismatch': candidate.gradeMismatch }"
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

      <p v-if="dissolveCandidates.length === 0" class="qi-hall__empty">{{ t('panels.equipmentHall.empty.noDissolveCandidates') }}</p>
    </div>

    <div v-if="dissolveTotalPages > 1" class="dissolve-pagination">
      <GameButton variant="ghost" size="sm" :disabled="dissolvePage === 0" @click="dissolveGoTo(dissolvePage - 1)">‹</GameButton>
      <span class="dissolve-pagination__label">{{ dissolvePage + 1 }} / {{ dissolveTotalPages }}</span>
      <GameButton variant="ghost" size="sm" :disabled="dissolvePage >= dissolveTotalPages - 1" @click="dissolveGoTo(dissolvePage + 1)">›</GameButton>
    </div>

    <div v-if="dissolvePreview.length > 0" class="dissolve-preview">
      <h4>{{ t('panels.equipmentHall.labels.dissolveReward') }} ({{ t('panels.equipmentHall.labels.itemCount', { count: dissolveSelected.size }) }}):</h4>

      <p v-for="entry in dissolvePreview" :key="entry.materialId">
        {{ materialLabel(entry.materialId, gameManager.materialRegistry) }}: {{ entry.minAmount }}–{{ entry.maxAmount }}
      </p>

      <p class="qi-hall__warning">{{ t('panels.equipmentHall.warnings.irreversible') }}</p>
    </div>

    <GameButton
      size="lg"
      variant="danger"
      class="qi-hall__primary-action"
      :disabled="dissolveSelected.size === 0"
      @click="doDissolve"
    >
      {{ dissolveConfirming ? t('panels.equipmentHall.buttons.dissolveConfirm') : `${t('panels.equipmentHall.tabs.dissolve')} (${dissolveSelected.size})` }}
    </GameButton>
  </section>
</template>

<style scoped>
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

.qi-hall__slot {
  min-width: 0;
}

.qi-hall__empty {
  margin: 0;
  padding: 12px;
  border: 1px dashed var(--paper-line);
  color: var(--paper-text-soft);
  font-size: var(--text-sm);
  text-align: center;
}

.qi-hall__primary-action {
  width: 100%;
  margin-top: 4px;
}

.qi-hall__warning {
  font-size: var(--text-xs);
  color: var(--crimson);
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

/* Task 19 — hint trực quan món KHÔNG khớp cảnh giới hiện tại (mờ đi,
   không chặn chọn — canUseItemGrade chỉ là gợi ý, Hóa Luyện không cần
   dùng được món mới thao tác). */
.dissolve-slot-wrap--grade-mismatch {
  opacity: 0.55;
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
  box-shadow: 0 0 0 2px var(--paper-50), var(--surface-shadow-soft);
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
  color: var(--paper-text-soft);
  font-variant-numeric: tabular-nums;
}

.dissolve-preview {
  flex: 0 0 auto;
}

.dissolve-preview h4 {
  margin: 0 0 4px;
  font-size: var(--text-sm);
  color: var(--paper-text);
}

.dissolve-preview p {
  margin: 0 0 3px;
  font-size: var(--text-xs);
  color: var(--jade);
}
</style>
