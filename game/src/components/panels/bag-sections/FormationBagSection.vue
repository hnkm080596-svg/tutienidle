<script setup lang="ts">
import { computed } from 'vue'
import SlotView from '../../common/SlotView.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useBagPagination } from '@/composables/useBagPagination'
import type { BagCell } from './BagCell'
import type { Formation } from '@/core/formation/Formation'
import type { GradedItemTooltipContent } from '@/composables/useTooltip'
import { statLabel, formatStat } from '@/core/stats/StatLabels'
import { ITEM_GRADE_LABELS, composeItemGradeNameSegments } from '@/core/item/ItemGrade'
import { PASSIVE_TRIGGER_LABELS } from '@/core/skill/PassiveTriggerLabels'
import { useBagGridLayout } from '@/composables/useBagGridLayout'

// Grid responsive theo chiều rộng thật — xem ghi chú đầy đủ ở
// useBagGridLayout.ts/MaterialBagSection.vue (cùng pattern áp cho cả
// 5 bag-sections).
const { gridRef, pageSize, gridStyle } = useBagGridLayout()

const props = defineProps<{ selectedId?: string | null }>()

const emit = defineEmits<{ toggle: [formationId: string] }>()

const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

// Tooltip có cấu trúc (2026-08-15) — cùng khuôn GradedItemTooltipContent
// với Pill/Talisman, xem useTooltip.ts. maxStacks luôn có giá trị thật
// trong data hiện tại (xem data/formation/formations.ts) nhưng field
// optional trên StatModifier — coi undefined như 1 stack (không tích
// luỹ) để không chia 0/hiện NaN.
function buildTooltip(formation: Formation, owned: number): GradedItemTooltipContent {
  return {
    kind: 'formation',

    name: formation.name,

    imagePath: formation.icon,

    gradeLabel: ITEM_GRADE_LABELS[formation.grade],

    gradeKey: formation.grade,

    ownedLabel: `Sở hữu: ${owned}`,

    description: formation.description,

    sections: [
      {
        label: 'Kích Hoạt',

        rows: [{ label: 'Điều kiện', value: PASSIVE_TRIGGER_LABELS[formation.trigger] }],
      },

      {
        label: 'Chỉ Số Tích Luỹ',

        rows: formation.modifiers.map(modifier => {
          const maxStacks = modifier.maxStacks ?? 1

          const perStackFlat = modifier.flat ?? 0
          const perStackPercent = modifier.percent ?? 0

          const maxValue = perStackFlat !== 0
            ? `+${formatStat(modifier.stat, perStackFlat * maxStacks)}`
            : `+${(perStackPercent * maxStacks * 100).toFixed(1)}%`

          return {
            label: statLabel(modifier.stat),

            value: `${maxValue} (tối đa ${maxStacks} stack)`,
          }
        }),
      },
    ],
  }
}

const cells = computed<BagCell[]>(() => {
  stateVersion.value

  return gameManager.formationBag.getAll().map(stack => ({
    key: stack.formation.id,

    label: stack.formation.name,

    nameSegments: composeItemGradeNameSegments(stack.formation.name, stack.formation.grade),

    description: stack.formation.description,

    amount: stack.amount,

    selected: props.selectedId === stack.formation.id,

    tooltip: buildTooltip(stack.formation, stack.amount),

    icon: stack.formation.icon,

    onClick: () => emit('toggle', stack.formation.id),
  }))
})

const { currentPage, totalPages, goToPage, gridCells } = useBagPagination(cells, pageSize)
</script>

<template>
  <div class="bag-section">
    <div ref="gridRef" class="bag-section__grid" :style="gridStyle">
      <SlotView
        v-for="(cell, index) in gridCells"
        :key="cell?.key ?? index"
        class="bag-section__slot"
        :item="cell"
        :label="cell?.label"
        :name-segments="cell?.nameSegments"
        :description="cell?.description"
        :amount="cell?.amount"
        :state="{ interaction: cell?.selected ? 'selected' : 'idle' }"
        :tooltip="cell?.tooltip"
        :icon="cell?.icon"
        @click="cell?.onClick?.()"
      />
    </div>

    <div class="bag-section__pages">
      <button type="button" :disabled="currentPage === 0" @click="goToPage(currentPage - 1)">‹</button>

      <button
        v-for="page in totalPages"
        :key="page"
        type="button"
        :class="{ 'is-active': currentPage === page - 1 }"
        @click="goToPage(page - 1)"
      >
        {{ page }}
      </button>

      <button type="button" :disabled="currentPage === totalPages - 1" @click="goToPage(currentPage + 1)">›</button>
    </div>
  </div>
</template>

<style scoped>
.bag-section {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 6px;
}

.bag-section__grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(var(--grid-columns), minmax(0, 1fr));
  align-content: start;
  gap: var(--grid-gap);
  overflow: hidden;
}

.bag-section__slot {
  width: 100%;
  aspect-ratio: 1 / 1;
}

.bag-section__pages {
  flex: 0 0 auto;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
}

.bag-section__pages button {
  min-width: 36px;
  min-height: 32px;
  padding: 0;
  font-size: var(--text-sm);
  background: var(--ink-800);
  color: var(--text-secondary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-body);
}

.bag-section__pages button.is-active {
  background: var(--gold-500);
  color: var(--gold-ink);
  border-color: var(--gold-500);
}
</style>
