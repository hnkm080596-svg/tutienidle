<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SlotView from '../../common/SlotView.vue'
import Chip from '../../common/primitives/Chip.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useUiStore, type EquipmentSortMode } from '@/stores/ui'
import { useEquipmentActions } from '@/composables/useEquipmentActions'
import { compareNumber, compareText, stableSort, withDirection } from '@/composables/useBagSort'
import type { BagCell } from './BagCell'
import { buildEquipmentTooltip } from '@/composables/useEquipmentTooltip'
import { composeEquipmentNameSegments } from '@/core/equipment/EquipmentNaming'
import { gradeLabel } from '@/core/presentation/labels'
import { itemQualityRank, professionGradeRank } from '@/core/profession/slotRank'
import { compareProfessionGrades } from '@/core/profession/ProfessionGrade'
import { EQUIPMENT_SLOTS } from '@/core/equipment/EquipmentSlotState'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'
import type { SlotPresentationState } from '@/components/common/SlotTypes'

const { t } = useI18n()

// Codex home-equipment preview layout (ui-landscape-design Trang Bi):
// fixed 8-col x 5-row grid, no search box or pagination.
const EQUIPMENT_BAG_COLUMNS = 8
const EQUIPMENT_BAG_MIN_CELLS = EQUIPMENT_BAG_COLUMNS * 5
const gridStyle = {
  '--grid-columns': String(EQUIPMENT_BAG_COLUMNS),
}

const emit = defineEmits<{ 'open-dissolve': [] }>()

const ui = useUiStore()

const gameManager = useGameManager()

const { stateVersion } = useStateVersion()

const { equip } = useEquipmentActions()

function handleClick(instanceId: string) {
  equip(instanceId)
}

interface EquipmentEntry {
  cell: BagCell

  instance: EquipmentInstance

  name: string
}

const entries = computed<EquipmentEntry[]>(() => {
  stateVersion.value

  // Chi hien do CHUA trang bi (bam de trang bi).
  const instances = gameManager.equipmentBag.getAll().filter((instance) => !instance.equipped)

  return instances.map((instance) => {
    // Audit fix 2026-08-31 - equipmentRegistry.get() THROW voi itemId
    // la (data edit/save lech) tung chet ca panel qua ErrorBoundary;
    // getEquipmentTemplate() tra an toan tra undefined (GameManager.ts).
    const template = gameManager.equipmentOps.getEquipmentTemplate(instance.itemId)

    const equippedComparison = gameManager.equipmentBag.getEquippedInSlot(instance.slot)

    // Compare context (item-info-card spec section 4) - the equipped
    // counterpart's template is resolved the same safe way as the
    // candidate's; a registry miss just drops the compare pair.
    const equippedTemplate = equippedComparison
      ? gameManager.equipmentOps.getEquipmentTemplate(equippedComparison.itemId)
      : undefined

    // G1 (Mission G Task 37) - the tooltip contract requires the
    // authoritative range quote. A quote miss = malformed item data, so
    // the dependent surface drops (same "registry miss -> no tooltip"
    // rule above): no candidate quote, no tooltip; no equipped quote,
    // no compare pair.
    const mainStatRangeQuote = template
      ? gameManager.equipmentSystem.quoteMainStatRange(instance, gameManager.equipmentRegistry)
      : undefined

    const equippedMainStatRangeQuote = equippedComparison && equippedTemplate
      ? gameManager.equipmentSystem.quoteMainStatRange(equippedComparison, gameManager.equipmentRegistry)
      : undefined

    // Registry miss -> hien thi itemId tho thay vi chet ca man hinh
    // (pattern EquipmentHallPanel.vue:126 `template?.name ?? instance.itemId`).
    const displayName = template?.name ?? instance.itemId

    // Ten ghep dong (2026-08-15) - Pham * Set (neu co) * Dia Gioi+Ten
    // goc, xem EquipmentNaming.ts. "(dang mac)" noi them lam segment
    // rieng (mau mac dinh), giu nguyen hanh vi cu. Registry miss chi
    // hien itemId tho - composeEquipmentNameSegments KHONG nhan
    // template nullable nen goi co dieu kien (pattern
    // EquipmentHallPanel.vue:138-140).
    const nameSegments = template
      ? composeEquipmentNameSegments(instance, template, gameManager.zoneRegistry)
      : [{ text: instance.itemId }]

    if (instance.equipped) {
      nameSegments.push({ text: '(đang mặc)' })
    }

    // Slot Revamp (muc 17.7 "Equipment bag: Quality, Rarity, equipped,
    // comparison") - equipped chi la marker nho (khong doi nen). So sanh
    // chi tiet hien chi duoc lo trong tooltip advanced khi giu Alt; chua co
    // nut/toggle bat mui ten ^/v truc tiep tren slot. Vi vay khong tu gan
    // state.comparison cho toi khi UX toggle do duoc thiet ke va trien khai.
    const state: SlotPresentationState = {}

    if (instance.equipped) {
      state.marker = 'equipped'
    }

    return {
      instance,

      name: displayName,

      cell: {
        key: instance.instanceId,

        label: displayName,

        // spec section 5b - aria includes the Pham word (the seal is a
        // decorative glyph; screen readers get the grade via this label).
        accessibleLabel: `${displayName}, ${gradeLabel(instance.grade)}`,

        nameSegments,

        description: template?.description,

        equipmentQualityRank: professionGradeRank(instance.grade),

        rarityRank: itemQualityRank(instance.quality),

        state,

        // slotState (Cuong Hoa) gan theo SLOT chu khong theo instance
        // (xem EquipmentSlotState.ts) - chi co y nghia THAT SU thuoc ve
        // mon do nay khi no dang duoc trang bi. Registry miss -> khong
        // tooltip (buildEquipmentTooltip doi template that, BagCell.tooltip
        // optional) - cell van hien thi, khong chet panel.
        tooltip: template && mainStatRangeQuote
          ? buildEquipmentTooltip(
              instance,
              template,
              gameManager.affixRegistry,
              instance.equipped ? gameManager.equipmentOps.getSlotState(instance.slot) : null,
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

        icon: instance.icon ?? template?.icon,

        onClick: () => handleClick(instance.instanceId),
      },
    }
  })
})

// ================= Filter chips + quality/order selects =============
// Codex preview contract: 4 group chips (Tat Ca / Dao Khi / Dao Bao /
// Trang Suc) and two selects - Pham Chat tone + Sap Xep.
type BagGroup = 'all' | 'weapon' | 'armor' | 'jewelry'
const activeGroup = ref<BagGroup>('all')

const GROUP_CHIPS = computed<Array<{ value: BagGroup; label: string }>>(() => [
  { value: 'all', label: t('panels.bag.groups.all') },
  { value: 'weapon', label: t('panels.bag.paperdoll.slots.weapon') },
  { value: 'armor', label: t('panels.bag.paperdoll.slots.armor') },
  { value: 'jewelry', label: t('equipment.bagFilters.jewelry') },
])

// Clicking the already-active chip clears the group filter.
function toggleGroup(value: BagGroup) {
  activeGroup.value = activeGroup.value === value ? 'all' : value
}

// Pham Chat tone select: the preview groups the five ItemQuality tiers
// into three display tones - Lam (Hoang+Huyen), Tu (Dia+Thien), Kim
// (Tien).
type QualityTone = 'all' | 'blue' | 'purple' | 'gold'
const qualityTone = ref<QualityTone>('all')
const QUALITY_TONES: readonly QualityTone[] = ['all', 'gold', 'purple', 'blue']

function toneMatches(entry: EquipmentEntry): boolean {
  if (qualityTone.value === 'all') return true
  const rank = itemQualityRank(entry.instance.quality)
  if (qualityTone.value === 'gold') return rank >= 5
  if (qualityTone.value === 'purple') return rank >= 3
  return rank <= 2
}

const filtered = computed(() =>
  entries.value.filter((entry) => {
    const slot = entry.instance.slot
    const groupOk =
      activeGroup.value === 'all' ||
      (activeGroup.value === 'jewelry'
        ? slot === 'necklace' || slot === 'ring'
        : slot === activeGroup.value)
    return groupOk && toneMatches(entry)
  }),
)
const visibleCount = computed(() => filtered.value.length)

// Design capacity label (preview "18/100") - the domain has no real bag
// cap; 100 is the designed display cap.
const BAG_DISPLAY_CAPACITY = 100

// Tieu chi Trang Bi (plan Workstream E) - mac dinh/quality/rarity/
// realm/slot/name/forge.
const EQUIPMENT_COMPARATORS: Record<Exclude<EquipmentSortMode, 'default'>, (a: EquipmentEntry, b: EquipmentEntry) => number> = {
  quality: (a, b) =>
    professionGradeRank(a.instance.grade) - professionGradeRank(b.instance.grade),

  rarity: (a, b) => itemQualityRank(a.instance.quality) - itemQualityRank(b.instance.quality),

  realm: (a, b) => compareProfessionGrades(a.instance.grade, b.instance.grade),

  slot: (a, b) => {
    const indexA = EQUIPMENT_SLOTS.indexOf(a.instance.slot)

    const indexB = EQUIPMENT_SLOTS.indexOf(b.instance.slot)

    return (indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA) -
      (indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB)
  },

  name: (a, b) => compareText(a.name, b.name),

  forge: (a, b) => compareNumber(a.instance.forgeUsesRemaining, b.instance.forgeUsesRemaining),
}

// Sort chay tren ban copy cua list DA LOC - the preview's Sap Xep
// select maps onto the existing equipment sort store ('default' vs
// 'quality'); direction stays whatever the store holds.
const cells = computed<BagCell[]>(() => {
  const sortState = ui.bagSorts.equipment

  if (sortState.mode === 'default') {
    return filtered.value.map((entry) => entry.cell)
  }

  const sorted = stableSort(
    filtered.value,
    withDirection(EQUIPMENT_COMPARATORS[sortState.mode], sortState.direction),
  )

  return sorted.map((entry) => entry.cell)
})

// Sap Xep select: Mac Dinh / Theo Pham Chat -> 'default' / 'quality'.
const sortMode = computed<EquipmentSortMode>({
  get: () => ui.bagSorts.equipment.mode,
  set: (mode) => ui.setBagSortMode('equipment', mode),
})

// No pagination in the design: the grid always paints full columns and
// pads to at least 40 cells; overflow scrolls.
const gridCells = computed<Array<BagCell | undefined>>(() => {
  const list = cells.value
  const target = Math.max(
    EQUIPMENT_BAG_MIN_CELLS,
    list.length + ((EQUIPMENT_BAG_COLUMNS - (list.length % EQUIPMENT_BAG_COLUMNS)) % EQUIPMENT_BAG_COLUMNS),
  )
  const padded = list.slice()
  while (padded.length < target) padded.push(undefined as unknown as BagCell)
  return padded
})

// Codex design-paper cells: square item-slot art owns the bag cell edge
// (the drawn tien-hiep slot frame) - applied here only, material/pill
// bags keep their own chrome.
const ITEM_SLOT_SRC = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/item-slot-v1.png')
</script>

<template>
  <div class="bag-section" :style="{ '--equipment-item-slot': `url('${ITEM_SLOT_SRC}')` }">
    <!-- Header (Codex preview): title + count/capacity + expand +
         "Hoa Luyen" dissolve shortcut. -->
    <header class="bag-section__header">
      <h2 class="bag-section__title">{{ t('equipment.bag') }}</h2>
      <span class="bag-section__count-label">{{ visibleCount }}/{{ BAG_DISPLAY_CAPACITY }}</span>
      <button
        type="button"
        class="bag-section__icon-btn"
        :aria-label="t('equipment.capacity')"
        :title="t('equipment.capacity')"
      >＋</button>
      <button
        type="button"
        class="bag-section__op-btn"
        @click="emit('open-dissolve')"
      >{{ t('panels.equipmentHall.tabs.dissolve') }}</button>
    </header>

    <nav class="bag-section__chips" :aria-label="t('panels.bag.filterAriaEquipment')">
      <Chip
        v-for="chip in GROUP_CHIPS"
        :key="chip.value"
        :active="activeGroup === chip.value"
        @click="toggleGroup(chip.value)"
      >
        {{ chip.label }}
      </Chip>
    </nav>

    <div class="bag-section__grid" :style="gridStyle">
      <SlotView
        v-for="(cell, index) in gridCells"
        :key="cell?.key ?? index"
        class="bag-section__slot"
        variant="bag"
        :item="cell"
        :label="cell?.label"
        :accessible-label="cell?.accessibleLabel"
        :name-segments="cell?.nameSegments"
        :description="cell?.description"
        :amount="cell?.amount"
        :equipment-quality-rank="cell?.equipmentQualityRank"
        :rarity-rank="cell?.rarityRank"
        :state="cell?.state"
        :tooltip="cell?.tooltip"
        :icon="cell?.icon"
        @click="cell?.onClick?.()"
      />
    </div>

    <footer class="bag-section__footer">
      <label class="bag-section__select-wrap">
        {{ t('equipment.quality') }}
        <select v-model="qualityTone" class="bag-section__select" :aria-label="t('equipment.quality')">
          <option v-for="tone in QUALITY_TONES" :key="tone" :value="tone">
            {{ t(`equipment.qualities.${tone}`) }}
          </option>
        </select>
      </label>
      <label class="bag-section__select-wrap">
        {{ t('equipment.order') }}
        <select v-model="sortMode" class="bag-section__select" :aria-label="t('equipment.order')">
          <option value="default">{{ t('equipment.defaultOrder') }}</option>
          <option value="quality">{{ t('equipment.qualityOrder') }}</option>
        </select>
      </label>
    </footer>
  </div>
</template>

<style scoped>
.bag-section {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 8px;
}

/* Preview header: title owns the row start, count/capacity + the two
   action buttons pin to the right above a hairline rule. */
.bag-section__header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 33px;
  padding-bottom: 7px;
  border-bottom: 1px solid #92783e66;
}

.bag-section__title {
  flex: 1;
  margin: 0;
  font: 700 24px/1.2 var(--font-display, Georgia, serif);
  color: #f3e4c4;
}

.bag-section__count-label {
  font-size: 15px;
  font-weight: 600;
  color: #e8d9ae;
  white-space: nowrap;
}

.bag-section__icon-btn,
.bag-section__op-btn {
  border: 1px solid #8e7440;
  background: #23251e;
  color: #eedfbf;
  font-family: var(--font-body);
  font-weight: 600;
  cursor: pointer;
}

.bag-section__icon-btn {
  width: 26px;
  height: 26px;
  padding: 0;
  font-size: 15px;
  line-height: 1;
}

.bag-section__op-btn {
  height: 30px;
  min-width: 118px;
  padding: 0 12px;
  font-size: 14px;
}

.bag-section__icon-btn:hover,
.bag-section__op-btn:hover {
  color: #ffe9ae;
  border-color: #c9a95f;
}

.bag-section__chips {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;
}

.bag-section__grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(var(--grid-columns), minmax(0, 1fr));
  grid-auto-rows: 1fr;
  align-content: start;
  gap: 5px;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: #8a7444 transparent;
}

/* item-slot-v1 IS the cell (design-paper Trang Bi): hides the
   frame-s-slot chrome + the flat backdrop; badges/quality/hover layers
   ride on top untouched. */
.bag-section__grid :deep(.slot-view--bag),
.bag-section__grid :deep(.slot-view--bag.slot-view--filled) {
  background:
    var(--equipment-item-slot) center / 100% 100% no-repeat,
    var(--hk-surface-base);
  border-radius: 0;
}
.bag-section__grid :deep(.slot-view--bag .slot-view__frame-art) {
  display: none;
}

.bag-section__slot {
  width: 100%;
  aspect-ratio: 1 / 1;
}

/* Preview footer: two labeled selects on the card's bottom edge. */
.bag-section__footer {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding-top: 2px;
  color: #c9b184;
  font-size: 13px;
  font-weight: 600;
}

.bag-section__select-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.bag-section__select {
  flex: 1;
  min-width: 0;
  height: 29px;
  border: 1px solid #8e7440;
  background: #23251e;
  color: #eedfbf;
  font-family: var(--font-body);
  font-size: 13px;
  padding: 0 6px;
}
</style>
