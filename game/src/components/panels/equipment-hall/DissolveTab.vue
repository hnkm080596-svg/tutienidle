<script setup lang="ts">
// Task 19 (item-grade-quality-rework, rework P6) - Tab Hoa Luyen extracted
// from EquipmentHallPanel.vue shell. Fully self-contained multi-select -
// does NOT use the shared HALL_SELECTION_KEY (selectedInstanceId/
// selectEquipped) since Hoa Luyen has its own independent Set-based
// selection, confirmed by reading the pre-extraction template/script.
//
// Filter rework (Task 19 plan): the old 3-dropdown bridge (realm +
// rarity + quality, where rarity/quality secretly read the SAME
// ITEM_QUALITY/ITEM_GRADE-aliased axis) is now 2 dropdowns -
// grade (real ProfessionGrade axis, PROFESSION_GRADE_ORDER) and
// Chat (ITEM_QUALITY_ORDER, the merged rarity/quality dropdown) - plus
// a visual mismatch hint via canUseItemGrade() (Task 16's equip gate).
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useEquipmentActions } from '@/composables/useEquipmentActions'
import { usePanelPagination } from '@/composables/usePanelPagination'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'
import { materialLabel, equipmentQualityLabel, gradeLabel } from '@/core/presentation/labels'
import { ITEM_QUALITY_ORDER } from '@/core/item/ItemQuality'
import { PROFESSION_GRADE_ORDER, PROFESSION_GRADE_NAMES } from '@/core/profession/ProfessionGrade'
import { canUseItemGrade } from '@/core/equipment/canUseItem'
import SlotView from '@/components/common/SlotView.vue'
import { buildEquipmentTooltip } from '@/composables/useEquipmentTooltip'
import { composeEquipmentNameSegments } from '@/core/equipment/EquipmentNaming'
import { itemQualityRank, professionGradeRank } from '@/core/profession/slotRank'
import EquipmentArtButton from '@/components/common/art/EquipmentArtButton.vue'
import BagPaginationControls from '@/components/panels/bag-sections/BagPaginationControls.vue'

const { t } = useI18n()

const player = usePlayerStore()

const gameManager = useGameManager()

const { stateVersion } = useStateVersion()

const { dissolve } = useEquipmentActions()

// =========================
// Tab Hoa Luyen (sec7.5) - filter + multi-select + preview + confirm
// =========================

interface DissolveCandidate {
  instanceId: string

  name: string

  // spec section 5b - "{name}, {grade}" so aria includes Pham (the seal
  // is a decorative glyph; screen readers get the grade via this label).
  accessibleLabel: string

  grade: EquipmentInstance['grade']

  icon?: string

  nameSegments: ReturnType<typeof composeEquipmentNameSegments>

  // Audit fix 2026-08-31 - registry miss -> khong tooltip (pattern
  // EquippedRow.tooltip trong useEquippedRows.ts).
  tooltip?: ReturnType<typeof buildEquipmentTooltip>

  // Rework P6 (final-review round 2) - renamed from qualityRank/rarityRank
  // (content was INVERSE to those names, see useEquippedRows.ts's
  // EquippedRow for the same fix); SlotView's own props stay unchanged.
  gradeRank: number

  qualityRank: number

  // Task 19 - hint truc quan khi pham mon KHONG khop canh gioi hien tai
  // cua nguoi choi (canUseItemGrade, Task 16 equip gate).
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

// Tick nhe de preview cap nhat khi selection doi (computed phu thuoc
// stateVersion la chinh).
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
      const template = gameManager.equipmentOps.getEquipmentTemplate(instance.itemId)

      // Compare context (item-info-card spec section 4) - candidates are
      // always unequipped, so the counterpart is whatever is worn in that
      // slot.
      const equippedComparison = gameManager.equipmentBag.getEquippedInSlot(instance.slot)
      const equippedTemplate = equippedComparison
        ? gameManager.equipmentOps.getEquipmentTemplate(equippedComparison.itemId)
        : undefined

      // G1 (Mission G Task 37) - required authoritative quote: a quote
      // miss = malformed item data, dropping the dependent surface (no
      // quote, no tooltip; no equipped quote, no compare pair).
      const mainStatRangeQuote = template
        ? gameManager.equipmentSystem.quoteMainStatRange(instance, gameManager.equipmentRegistry)
        : undefined

      const equippedMainStatRangeQuote = equippedComparison && equippedTemplate
        ? gameManager.equipmentSystem.quoteMainStatRange(equippedComparison, gameManager.equipmentRegistry)
        : undefined

      return {
        instanceId: instance.instanceId,

        name: template?.name ?? instance.itemId,

        accessibleLabel: `${template?.name ?? instance.itemId}, ${gradeLabel(instance.grade)}`,

        grade: instance.grade,

        icon: instance.icon ?? template?.icon,

        nameSegments: template
          ? composeEquipmentNameSegments(instance, template, gameManager.zoneRegistry)
          : [{ text: instance.itemId }],

        // Audit fix 2026-08-31 - dung lai template da tra an toan o tren;
        // registry miss -> khong tooltip (SlotView tooltip optional),
        // khong chet tab Hoa Luyen qua ErrorBoundary.
        tooltip: template && mainStatRangeQuote
          ? buildEquipmentTooltip(
              instance,
              template,
              gameManager.affixRegistry,
              // Candidates are unequipped - the slot enhance level belongs
              // to the worn item, never to this card (null, not
              // getSlotState(instance.slot)).
              null,
              gameManager.zoneRegistry,
              equippedComparison && equippedTemplate && equippedMainStatRangeQuote
                ? {
                    instance: equippedComparison,
                    template: equippedTemplate,
                    slotState: gameManager.equipmentOps.getSlotState(equippedComparison.slot),
                    mainStatRangeQuote: equippedMainStatRangeQuote,
                  }
                : undefined,
              mainStatRangeQuote,
            )
          : undefined,

        gradeRank: professionGradeRank(instance.grade),

        qualityRank: itemQualityRank(instance.quality),

        gradeMismatch: !canUseItemGrade(instance.grade, playerRealmId),
      }
    })
})

// Hoa Luyen phan trang theo ngan sach chieu cao + CHIEU RONG that cua
// luoi - bug 2026-09-01 (T2.3, user report "chi show dung 1 mon"):
// usePanelPagination goi KHONG co columnWidth -> columnCount cung 1, khi
// ResizeObserver chua fire availableHeight = 0 -> pageSize = 1x1 = 1.
// Grid that la CSS auto-fill minmax(64px) + gap 8px -> columnWidth = 72
// (64 + 8 gap), pageSize = rows x measured columns.
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

// Reconcile the Set whenever the candidate list changes (filter edits,
// failed submits, items removed by a successful dissolve): a selection
// id that no longer maps to a candidate is a ghost - it would keep the
// '(n)' count and preview wrong while the slot is gone.
watch(dissolveCandidates, (candidates) => {
  if (dissolveSelected.value.size === 0) {
    return
  }

  const live = new Set(candidates.map((candidate) => candidate.instanceId))
  const next = new Set([...dissolveSelected.value].filter((id) => live.has(id)))

  if (next.size !== dissolveSelected.value.size) {
    dissolveSelected.value = next
  }
})

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
 * Chon TAT CA candidate dang qua filter hien hanh (yeu cau "hoa luyen
 * toan bo/theo filter") - an toan vi candidates da loai equipped/locked/
 * favorite o computed nguon.
 */
function selectAllDissolveByFilter() {
  dissolveSelected.value = new Set(dissolveCandidates.value.map((candidate) => candidate.instanceId))
}

function clearDissolveSelection() {
  dissolveSelected.value = new Set()
}

const dissolvePreview = computed(() => {
  stateVersion.value

  return gameManager.equipmentOps.previewDissolveRewards(Array.from(dissolveSelected.value))
})

const dissolveConfirming = ref(false)

// The armed confirm belongs to the selection it was raised on: any
// churn (prune, clear, toggle, select-all, post-dissolve reset) makes
// the confirmed set stale, so a re-selected item needs a fresh 2-step
// confirm.
watch(dissolveSelected, () => {
  dissolveConfirming.value = false
})

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
  <!-- Reskin vao card toi cua sheet moi (preview khong co design Hoa
       Luyen -> dung chrome cua chinh card: select kieu footer tui,
       slot grid, nut vang). Giu nguyen chuc nang thuc. -->
  <div class="equipment-forge-workspace dissolve-workspace">
    <h2>{{ t('panels.equipmentHall.tabs.dissolve') }}</h2>

    <div class="dissolve-filters">
      <label class="dissolve-filters__field">
        <select v-model="dissolveFilterGrade">
          <option value="any">{{ t('panels.equipmentHall.select.anyProfessionGrade') }}</option>

          <option
            v-for="grade in PROFESSION_GRADE_ORDER"
            :key="grade"
            :value="grade"
            :style="{ color: `var(--rank-color-${professionGradeRank(grade)})` }"
          >
            {{ PROFESSION_GRADE_NAMES[grade] }}
          </option>
        </select>
      </label>

      <label class="dissolve-filters__field">
        <select v-model="dissolveFilterQuality">
          <option value="any">{{ t('panels.equipmentHall.select.anyQuality') }}</option>

          <option
            v-for="quality in ITEM_QUALITY_ORDER"
            :key="quality"
            :value="quality"
            :style="{ color: `var(--grade-${quality})` }"
          >
            {{ equipmentQualityLabel(quality) }}
          </option>
        </select>
      </label>

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
          class="dissolve-slot"
          :item="{ id: candidate.instanceId }"
          :label="candidate.name"
          :accessible-label="candidate.accessibleLabel"
          :name-segments="candidate.nameSegments"
          :icon="candidate.icon"
          :equipment-quality-rank="candidate.gradeRank"
          :rarity-rank="candidate.qualityRank"
          :tooltip="candidate.tooltip"
          :state="{ interaction: dissolveSelected.has(candidate.instanceId) ? 'selected' : 'idle' }"
        />

        <span v-if="dissolveSelected.has(candidate.instanceId)" class="dissolve-slot-tick" aria-hidden="true">✓</span>
      </div>

      <p v-if="dissolveCandidates.length === 0" class="dissolve-empty">{{ t('panels.equipmentHall.empty.noDissolveCandidates') }}</p>
    </div>

    <BagPaginationControls
      v-if="dissolveTotalPages > 1"
      :current-page="dissolvePage"
      :total-pages="dissolveTotalPages"
      :sort-options="[]"
      active-mode="default"
      active-direction="asc"
      @go-to-page="dissolveGoTo"
    />

    <div v-if="dissolvePreview.length > 0" class="dissolve-preview">
      <h4>{{ t('panels.equipmentHall.labels.dissolveReward') }} ({{ t('panels.equipmentHall.labels.itemCount', { count: dissolveSelected.size }) }}):</h4>

      <p v-for="entry in dissolvePreview" :key="entry.materialId">
        {{ materialLabel(entry.materialId, gameManager.materialRegistry) }}: {{ entry.minAmount }}–{{ entry.maxAmount }}
      </p>

      <p class="dissolve-warning">{{ t('panels.equipmentHall.warnings.irreversible') }}</p>
    </div>

    <div class="equipment-forge-actions">
      <EquipmentArtButton
        gold
        :disabled="dissolveSelected.size === 0"
        @click="doDissolve"
      >
        {{ dissolveConfirming ? t('panels.equipmentHall.buttons.dissolveConfirm') : `${t('panels.equipmentHall.tabs.dissolve')} (${dissolveSelected.size})` }}
      </EquipmentArtButton>
    </div>
  </div>
</template>

<style scoped>
.equipment-forge-workspace {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}
.equipment-forge-workspace h2 {
  font-size: 26px;
  margin: 0;
  border-bottom: 1px solid #9b7d4066;
  padding-bottom: 7px;
  line-height: 1.15;
}
.dissolve-filters {
  display: flex;
  gap: 8px;
  flex: none;
}
.dissolve-filters__field {
  flex: 1;
  min-width: 0;
}
.dissolve-filters__field select {
  width: 100%;
  height: 29px;
  border: 1px solid #8e7440;
  background: #23251e;
  color: #eedfbf;
  font: 13px var(--font-body, Georgia, serif);
  padding: 0 8px;
}
.dissolve-filters__field select:focus-visible {
  outline: 2px solid #d6ad5d;
  outline-offset: 1px;
}
.dissolve-filters__bulk {
  flex: none;
  min-height: 29px;
  border: 1px solid #8e7440;
  background: #23251e;
  color: #eedfbf;
  font: 12px var(--font-body, Georgia, serif);
  padding: 0 10px;
  cursor: pointer;
  white-space: nowrap;
}
.dissolve-filters__bulk:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.dissolve-filters__bulk:not(:disabled):hover {
  color: #f5d78e;
  border-color: #b28a43;
}
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
.dissolve-slot-wrap--grade-mismatch {
  opacity: 0.55;
}
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
  background: var(--jade, #5b8a6a);
  color: #f3e4c4;
  font-size: 11px;
  font-weight: 700;
  box-shadow: 0 0 0 2px #151713;
}
.dissolve-empty {
  grid-column: 1 / -1;
  margin: 0;
  align-self: center;
  text-align: center;
  font-size: 14px;
  color: #c1b18d;
}
.dissolve-preview {
  flex: 0 0 auto;
  border-top: 1px solid #9b7d4066;
  padding-top: 6px;
}
.dissolve-preview h4 {
  margin: 0 0 4px;
  font-size: 13px;
  color: #f3e4c4;
}
.dissolve-preview p {
  margin: 0 0 3px;
  font-size: 12px;
  color: #8bca8d;
}
.dissolve-warning {
  color: var(--crimson, #c05a4e) !important;
}
.equipment-forge-actions {
  display: flex;
  justify-content: center;
  gap: 18px;
  flex: none;
}
.equipment-forge-actions > button {
  min-width: 220px;
  min-height: 42px;
  font-size: 21px;
  padding: 7px 25px;
}
</style>
