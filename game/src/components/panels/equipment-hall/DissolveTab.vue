<script setup lang="ts">
// Task 19 (item-grade-quality-rework, rework P6) - Tab Hoa Luyen extracted
// from EquipmentHallPanel.vue shell. Fully self-contained multi-select -
// does NOT use the shared HALL_SELECTION_KEY (selectedInstanceId/
// selectEquipped) since Hoa Luyen has its own independent Set-based
// selection, confirmed by reading the pre-extraction template/script.
//
// Filter rework v2 (owner ruling 2026-10-09): the card's own
// grade/quality selects are gone - the embedded bag's Loai-item + Sap
// Xep dropdowns are the only filters. The bag reports its visible id
// set back via 'filtered' so Chon Tat Ca scopes to what the player
// actually sees.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useEquipmentActions } from '@/composables/useEquipmentActions'
import { materialLabel } from '@/core/presentation/labels'
import EquipmentArtButton from '@/components/common/art/EquipmentArtButton.vue'
import EquipmentBagSection from '@/components/panels/bag-sections/EquipmentBagSection.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'

const { t } = useI18n()

const gameManager = useGameManager()

const { stateVersion } = useStateVersion()

const { dissolve } = useEquipmentActions()

// =========================
// Tab Hoa Luyen (sec7.5) - filter + multi-select + preview + confirm
// =========================

const dissolveSelected = ref<Set<string>>(new Set())

// Minh ruling 2026-10-09: the card embeds the WHOLE equipment bag via
// EquipmentBagSection pick mode - this light list only drives
// select-all, the inert id set (locked/favorite cells render dimmed and
// cannot be picked), and ghost-pruning of the selection.
const dissolveEligible = computed(() => {
  stateVersion.value

  return gameManager.equipmentBag.getAll().filter((instance) => !instance.equipped)
})

const dissolveSelectableIds = computed(() =>
  dissolveEligible.value
    .filter((instance) => !instance.locked && !instance.favorite)
    .map((instance) => instance.instanceId),
)

// The bag's currently visible ids (after its own Loai-item filter) -
// reported back via the 'filtered' emit so bulk actions scope to the
// view, not the whole bag. Seeded with the full selectable set: the
// bag mounts AFTER this row renders, so without a seed the first
// paint would show count 0 + a disabled Chon Tat Ca until the emit
// lands a frame later.
const dissolveVisibleIds = ref<Set<string>>(new Set(dissolveSelectableIds.value))

function onBagFiltered(ids: string[]) {
  dissolveVisibleIds.value = new Set(ids)
}

const dissolveVisibleSelectableIds = computed(() => {
  const visible = dissolveVisibleIds.value

  return dissolveSelectableIds.value.filter((id) => visible.has(id))
})

const dissolveInertIds = computed(() =>
  dissolveEligible.value.filter((instance) => instance.locked || instance.favorite).map((i) => i.instanceId),
)

const dissolvePickedIds = computed(() => [...dissolveSelected.value])

// Reconcile the Set whenever the pickable list changes (filter edits,
// failed submits, items removed by a successful dissolve): a selection
// id that leaves the pickable set is a ghost - it would keep the '(n)'
// count and preview wrong while its cell is hidden by the filter.
watch(dissolveSelectableIds, (ids) => {
  if (dissolveSelected.value.size === 0) {
    return
  }

  const live = new Set(ids)
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
 * Chon TAT CA mon co the hoa trong tap DANG HIEN THI qua filter tui
 * (yeu cau "hoa luyen toan bo/theo filter") - an toan vi selectable da
 * loai locked/favorite.
 */
function selectAllDissolveByFilter() {
  dissolveSelected.value = new Set(dissolveVisibleSelectableIds.value)
}

function clearDissolveSelection() {
  dissolveSelected.value = new Set()
}

const dissolvePreview = computed(() => {
  stateVersion.value

  return gameManager.equipmentOps.previewDissolveRewards(Array.from(dissolveSelected.value))
})

const dissolveDialogOpen = ref(false)

// Owner ruling 2026-10-09: the notice + confirm moved into a popup -
// the submit opens a ConfirmModal carrying the reward list and the
// irreversible warning; the inline notice block is gone.
//
// The dialog belongs to the selection it was raised on: any churn
// (prune, clear, toggle, select-all, post-dissolve reset) makes the
// reviewed set stale, so it closes and a re-selected set needs a
// fresh review.
watch(dissolveSelected, () => {
  dissolveDialogOpen.value = false
})

function doDissolve() {
  if (dissolveSelected.value.size === 0) {
    return
  }

  dissolveDialogOpen.value = true
}

function confirmDissolve() {
  if (dissolve(Array.from(dissolveSelected.value))) {
    dissolveSelected.value = new Set()
  }

  dissolveDialogOpen.value = false
}
</script>

<template>
  <!-- Reskin vao card toi cua sheet moi (preview khong co design Hoa
       Luyen -> dung chrome cua chinh card: select kieu footer tui,
       slot grid, nut vang). Giu nguyen chuc nang thuc. -->
  <div class="equipment-forge-workspace dissolve-workspace">
    <!-- Header removed (owner ruling 2026-10-09): the active tab already
         labels the card; a second "Hóa Luyện" line is redundant. -->
    <!-- Owner ruling 2026-10-09: the grade/quality selects are gone -
         the embedded bag's own dropdowns (Loai item + Sap Xep) are the
         only filters; the bulk actions moved down to the submit row. -->
    <EquipmentBagSection
      class="dissolve-bag"
      mode="pick"
      sort-key="dissolve"
      :picked-ids="dissolvePickedIds"
      :inert-ids="dissolveInertIds"
      @pick="toggleDissolve"
      @filtered="onBagFiltered"
    />

    <!-- Owner ruling 2026-10-09: the bulk actions share the submit row -
         select-all/clear on the left, the dissolve button pinned right. -->
    <div class="equipment-forge-actions">
      <button
        type="button"
        class="dissolve-filters__bulk"
        :disabled="dissolveVisibleSelectableIds.length === 0"
        @click="selectAllDissolveByFilter"
      >
        {{ t('panels.equipmentHall.buttons.selectAll') }} ({{ dissolveVisibleSelectableIds.length }})
      </button>

      <button
        type="button"
        class="dissolve-filters__bulk"
        :disabled="dissolveSelected.size === 0"
        @click="clearDissolveSelection"
      >
        {{ t('panels.equipmentHall.buttons.clearAll') }}
      </button>

      <!-- Owner ruling 2026-10-09: same state machine as the enhance
           submit - normal dark pill when nothing is picked, gold
           'selected' art once there is a selection. -->
      <EquipmentArtButton
        filter-art
        :gold="dissolveSelected.size > 0"
        class="equipment-forge-actions__submit"
        :disabled="dissolveSelected.size === 0"
        @click="doDissolve"
      >
        <!-- Owner ruling 2026-10-09: plain label, no selection count. -->
        {{ t('panels.equipmentHall.tabs.dissolve') }}
      </EquipmentArtButton>
    </div>

    <!-- Owner ruling 2026-10-09: reward notice + 2-step confirm moved
         into this popup (danger chrome - dissolving is irreversible). -->
    <ConfirmModal
      :open="dissolveDialogOpen"
      danger
      :title="t('panels.equipmentHall.tabs.dissolve')"
      :message="`${t('panels.equipmentHall.labels.dissolveReward')} (${t('panels.equipmentHall.labels.itemCount', { count: dissolveSelected.size })})`"
      :confirm-label="t('panels.equipmentHall.buttons.dissolveConfirm')"
      @confirm="confirmDissolve"
      @cancel="dissolveDialogOpen = false"
    >
      <div class="dissolve-dialog__detail">
        <p v-for="entry in dissolvePreview" :key="entry.materialId">
          {{ materialLabel(entry.materialId, gameManager.materialRegistry) }}: {{ entry.minAmount }}–{{ entry.maxAmount }}
        </p>
        <p class="dissolve-warning">{{ t('panels.equipmentHall.warnings.irreversible') }}</p>
      </div>
    </ConfirmModal>
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
/* Owner ruling 2026-10-09: bulk buttons wear the same chip art as the
   bag's Loai-item/Sap-Xep dropdowns (equipment-filter-*, native
   1225x324 aspect, hover/pressed variants; disabled fades - no
   disabled art exists). */
.dissolve-filters__bulk {
  flex: 0 0 auto;
  /* Owner ruling 2026-10-09 (option A): 40px tall so the actions row
     fits inside the card again - at 47px the three buttons overflowed
     ~40px past the card edge and space-between could not distribute. */
  height: 40px;
  aspect-ratio: 1225 / 324;
  border: 0;
  background: url('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-normal-v2.png') center / contain no-repeat;
  color: #f2e3c2;
  /* Owner ruling 2026-10-09: same face/weight as the scene's op-tab
     buttons (font: 700 ... var(--pc-font-body, var(--font-display))). */
  font: 700 12px var(--pc-font-body, var(--font-display, Georgia, serif));
  padding: 0 12px;
  cursor: pointer;
  white-space: nowrap;
}
.dissolve-filters__bulk:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.dissolve-filters__bulk:not(:disabled):hover {
  background-image: url('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-hover-v2.png');
}
.dissolve-filters__bulk:not(:disabled):active {
  background-image: url('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-pressed-v2.png');
}
.dissolve-bag {
  flex: 1 1 auto;
  min-height: 0;
}
.dissolve-dialog__detail p {
  margin: 0 0 3px;
  font-size: 12px;
  color: #2f5d33;
}
.dissolve-warning {
  color: var(--crimson, #c05a4e) !important;
}
.equipment-forge-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: none;
}
/* Even spacing across the row (owner ruling 2026-10-09): select-all on
   the left edge, dissolve submit on the right edge, clear in the
   middle - both gaps equal. */
.equipment-forge-actions__submit {
  min-width: 255px;
  min-height: 48px;
  font-family: var(--pc-font-body, var(--font-display, Georgia, serif));
  font-weight: 700;
  font-size: 24px;
  padding: 8px 29px;
  /* Owner ruling 2026-10-09: pull the button 10px in from the card's
     right edge. */
  margin-right: 10px;
}

</style>
