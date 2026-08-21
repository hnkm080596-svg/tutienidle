<script setup lang="ts">
import { computed } from 'vue'
import SlotView from '../../common/SlotView.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useBagPagination } from '@/composables/useBagPagination'
import { usePlayerStore } from '@/stores/player'
import { addCultivation } from '@/core/cultivation/CultivationSystem'
import type { PillTarget } from '@/core/pill/PillSystem'
import type { Pill } from '@/core/pill/Pill'
import type { BagCell } from './BagCell'
import type { GradedItemTooltipContent, TooltipSection } from '@/composables/useTooltip'
import { statLabel, formatStat } from '@/core/stats/StatLabels'
import { PHAM_LABELS, composePhamNameSegments } from '@/core/item/Pham'
import { useBagGridLayout } from '@/composables/useBagGridLayout'

const gameManager = useGameManager()
const player = usePlayerStore()
const { stateVersion, bumpState } = useStateVersion()

// Grid responsive theo chiều rộng thật — xem ghi chú đầy đủ ở
// useBagGridLayout.ts/MaterialBagSection.vue (cùng pattern áp cho cả
// 5 bag-sections).
const { gridRef, pageSize, gridStyle } = useBagGridLayout()

// Tooltip có cấu trúc (2026-08-15, cùng khuôn GradedItemTooltipContent
// dùng chung Pill/Talisman/Formation, xem useTooltip.ts) — build TỪ
// ĐÚNG PillEffect[] thật, không bịa số.
function buildTooltip(pill: Pill, owned: number): GradedItemTooltipContent {
  const rows = pill.effects.map(effect => {
    switch (effect.type) {
      case 'heal':
        return { label: 'Hồi Khí Huyết', value: `+${formatStat('maxHp', effect.value ?? 0)}` }

      case 'cultivation':
        return { label: 'Tu Vi', value: `+${effect.value ?? 0}` }

      case 'permanent_stat':
        return {
          label: `${effect.stat ? statLabel(effect.stat) : '?'} (vĩnh viễn)`,
          value: `+${effect.stat ? formatStat(effect.stat, effect.value ?? 0) : effect.value}`,
        }

      case 'buff': {
        const buff = effect.buff

        if (!buff) {
          return { label: 'Buff', value: '—' }
        }

        const modifierLabel = buff.modifiers
          .map(modifier => `${statLabel(modifier.stat)} +${formatStat(modifier.stat, modifier.flat ?? modifier.percent ?? 0)}`)
          .join(', ')

        return {
          label: buff.name,
          value: `${modifierLabel}${buff.duration ? ` (${buff.duration}s)` : ''}`,
        }
      }
    }
  })

  const sections: TooltipSection[] = rows.length > 0 ? [{ label: 'Hiệu Ứng', rows }] : []

  return {
    kind: 'pill',

    name: pill.name,

    imagePath: pill.icon,

    phamLabel: PHAM_LABELS[pill.pham],

    ownedLabel: `Sở hữu: ${owned}`,

    description: pill.description,

    sections,
  }
}

// Đan Dược dùng được cả trong lẫn ngoài trận — cultivation cộng thẳng
// qua đúng công thức chặn-trần dùng chung (addCultivation), hồi máu
// chỉ có tác dụng khi đang có trận đang đánh (ngoài trận player không
// có HP sống để hồi, uống "Tiểu Hồi Đan" lúc đó coi như không có gì
// để hồi — không phải lỗi, chỉ là không có đích).
function drinkPill(pillId: string) {
  const target: PillTarget = {
    addCultivation: amount => addCultivation(player.$state, amount),

    heal: amount => {
      const battle = gameManager.getBattle()

      if (battle && battle.player.alive) {
        battle.player.currentHp = Math.min(battle.player.maxHp, battle.player.currentHp + amount)
      }
    },
  }

  if (gameManager.usePill(pillId, target, player.$state)) {
    bumpState()
  }
}

const cells = computed<BagCell[]>(() => {
  stateVersion.value

  return gameManager.pillBag.getAll().map(stack => ({
    key: stack.pill.id,

    label: stack.pill.name,

    nameSegments: composePhamNameSegments(stack.pill.name, stack.pill.pham),

    description: stack.pill.description,

    amount: stack.amount,

    tooltip: buildTooltip(stack.pill, stack.amount),

    itemIcon: stack.pill.icon,

    onClick: () => drinkPill(stack.pill.id),
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
        :tooltip="cell?.tooltip"
        :item-icon="cell?.itemIcon"
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
  min-width: 22px;
  height: 22px;
  padding: 0;
  font-size: 0.7rem;
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
