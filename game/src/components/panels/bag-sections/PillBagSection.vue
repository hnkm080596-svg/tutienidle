<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import SlotView from '../../common/SlotView.vue'
import BagPaginationControls, { type BagSortOption } from './BagPaginationControls.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useBagPagination } from '@/composables/useBagPagination'
import { useBagGridLayout } from '@/composables/useBagGridLayout'
import { useUiStore, type PillSortMode } from '@/stores/ui'
import { compareNumber, compareText, stableSort, withDirection } from '@/composables/useBagSort'
import { usePlayerStore } from '@/stores/player'
import { addCultivation } from '@/core/cultivation/CultivationSystem'
import { useNotificationStore } from '@/stores/notification'
import type { PillTarget } from '@/core/pill/PillSystem'
import type { Pill } from '@/core/pill/Pill'
import type { BagCell } from './BagCell'
import type { GradedItemTooltipContent, TooltipSection } from '@/composables/useTooltip'
import { statLabel, formatStat } from '@/core/stats/StatLabels'
import { ITEM_GRADE_LABELS } from '@/core/item/ItemGrade'
import { compareProfessionGrades, PROFESSION_GRADE_NAMES } from '@/core/profession/ProfessionGrade'

const ui = useUiStore()

const gameManager = useGameManager()
const player = usePlayerStore()
const { stateVersion, bumpState } = useStateVersion()

// Đồng hồ 1 giây — deadline timed effect hiển thị theo thời gian thực
// (Date.now), không phụ thuộc game pause (plan §5.4).
const nowMs = ref(Date.now())

let effectTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  effectTimer = setInterval(() => {
    nowMs.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (effectTimer) {
    clearInterval(effectTimer)
  }
})

// Grid responsive theo chiều rộng thật — xem ghi chú đầy đủ ở
// useBagGridLayout.ts/MaterialBagSection.vue (cùng pattern áp cho cả
// 5 bag-sections).
const { gridRef, pageSize, gridStyle } = useBagGridLayout()

// Tooltip có cấu trúc (2026-08-15, cùng khuôn GradedItemTooltipContent
// dùng chung Pill/Talisman/Formation, xem useTooltip.ts) — build TỪ
// ĐÚNG PillEffect[] thật, không bịa số. Thêm 4 effect nghề (2026-08-24,
// resource-professions-rework §5).
function buildTooltip(pill: Pill, owned: number): GradedItemTooltipContent {
  const rows = pill.effects.map((effect) => {
    switch (effect.type) {
      case 'heal':
        return { label: 'Hồi Khí Huyết', value: `+${formatStat('maxHp', effect.value ?? 0)}` }

      case 'cultivation':
        // Pill nghề dùng % yêu cầu tầng; legacy dùng flat.
        return effect.cultivationPercent !== undefined
          ? {
              label: 'Tu Vi',
              value: `+${formatStat('cultivationPercent', effect.cultivationPercent)}% yêu cầu tầng`,
            }
          : { label: 'Tu Vi', value: `+${effect.value ?? 0}` }

      case 'permanent_stat':
        return {
          label: `${effect.stat ? statLabel(effect.stat) : '?'} (vĩnh viễn)`,
          value: `+${effect.stat ? formatStat(effect.stat, effect.value ?? 0) : effect.value}`,
        }

      case 'random_main_stat':
        return { label: 'Main Stat ngẫu nhiên', value: '+1 (một trong 5 chỉ số chưa đạt trần)' }

      case 'regen':
        return {
          label: 'Hồi phục theo giây',

          value: `+${effect.hpPerSecond ?? 0} HP/s, +${effect.mpPerSecond ?? 0} MP/s trong ${effect.durationSeconds ?? 0}s`,
        }

      case 'skill_insight':
        return { label: 'Cảm Ngộ', value: `+${effect.value ?? 0}` }

      case 'buff': {
        const buff = effect.buff

        if (!buff) {
          return { label: 'Buff', value: '—' }
        }

        const modifierLabel = buff.effects
          .filter((buffEffect) => buffEffect.type === 'statModifier')
          .map(
            (modifier) =>
              `${statLabel(modifier.stat)} +${formatStat(modifier.stat, modifier.flat ?? modifier.percent ?? 0)}`,
          )
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

    gradeLabel: pill.professionGrade
      ? PROFESSION_GRADE_NAMES[pill.professionGrade]
      : ITEM_GRADE_LABELS[pill.grade],

    gradeKey: pill.grade,

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
    addCultivation: (amount) => addCultivation(player.$state, amount),

    heal: (amount) => {
      const battle = gameManager.getBattle()

      if (battle && battle.player.alive) {
        gameManager.combatSystem.applyHealing(battle.player, amount, battle.player.id, 'healing')
      }
    },

    // Unified Buff System (Task 13b) — trong trận thì áp thẳng lên
    // CombatEntity thật đang chiến đấu (source = target = player, giống
    // cách skill tự buff bản thân); ngoài trận không có CombatEntity nào
    // sống nên đi qua applyPersistentBuff() (đúng pattern Kiếp Thương
    // debuff dùng, xem GameManager.ts).
    applyBuff: (definition) => {
      const battle = gameManager.getBattle()

      if (battle && battle.player.alive) {
        gameManager.buffSystem.apply(definition, battle.player, battle.player, gameManager.buffRegistry)

        return
      }

      gameManager.applyPersistentBuff(definition, player.finalStats)
    },
  }

  const result = gameManager.usePillDetailed(pillId, target, player.$state)

  if (result.ok) {
    bumpState()

    return
  }

  // Reason channel (plan §8): sai cảnh giới/capped báo ngay thay vì
  // fail im lặng.
  const reasonText =
    result.reason === 'wrong_realm'
      ? 'Chỉ dùng được tại đúng cảnh giới của đan dược.'
      : result.reason === 'all_main_stats_capped'
        ? 'Cả 5 chỉ số chính đã đạt trần cảnh giới.'
        : result.reason === 'requires_phap_tu'
          ? 'Đan dược hồi Linh Lực chỉ dùng được cho Pháp Tu.'
          : result.reason === 'cap'
            ? 'Chỉ số liên quan đã đạt trần cảnh giới.'
            : 'Không thể dùng đan dược.'

  useNotificationStore().push('warning', reasonText)
}

interface PillEntry {
  cell: BagCell

  pill: Pill

  amount: number
}

const SORT_OPTIONS: Array<BagSortOption & { value: PillSortMode }> = [
  { value: 'grade', label: 'Phẩm đan' },
  { value: 'effect', label: 'Loại hiệu ứng' },
  { value: 'amount', label: 'Số lượng' },
  { value: 'name', label: 'Tên', ascLabel: 'Tên A–Z', descLabel: 'Tên Z–A' },
]

const entries = computed<PillEntry[]>(() => {
  stateVersion.value

  return gameManager.pillBag.getAll().map((stack) => ({
    pill: stack.pill,

    amount: stack.amount,

    cell: {
      key: stack.pill.id,

      label: stack.pill.name,

      nameSegments: [
        {
          text: stack.pill.professionGrade
            ? PROFESSION_GRADE_NAMES[stack.pill.professionGrade]
            : ITEM_GRADE_LABELS[stack.pill.grade],
          colorVar: `--grade-${stack.pill.grade}`,
          tone: stack.pill.grade,
        },
        { text: stack.pill.name },
      ],

      description: stack.pill.description,

      amount: stack.amount,

      tooltip: buildTooltip(stack.pill, stack.amount),

      icon: stack.pill.icon,

      onClick: () => drinkPill(stack.pill.id),
    },
  }))
})

// Tiêu chí Đan Dược (plan Workstream E) — phẩm đan/loại hiệu ứng/số
// lượng/tên. "Loại hiệu ứng" so sánh effect type ĐẦU TIÊN của recipe.
const PILL_COMPARATORS: Record<Exclude<PillSortMode, 'default'>, (a: PillEntry, b: PillEntry) => number> = {
  grade: (a, b) => a.pill.professionGrade && b.pill.professionGrade
    ? compareProfessionGrades(a.pill.professionGrade, b.pill.professionGrade)
    : compareText(a.pill.grade, b.pill.grade),

  effect: (a, b) => compareText(a.pill.effects[0]?.type, b.pill.effects[0]?.type),

  amount: (a, b) => compareNumber(a.amount, b.amount),

  name: (a, b) => compareText(a.pill.name, b.pill.name),
}

// Sort trên bản copy TRƯỚC pagination (plan Workstream E).
const cells = computed<BagCell[]>(() => {
  const sortState = ui.bagSorts.pill

  if (sortState.mode === 'default') {
    return entries.value.map((entry) => entry.cell)
  }

  const sorted = stableSort(
    entries.value,
    withDirection(PILL_COMPARATORS[sortState.mode], sortState.direction),
  )

  return sorted.map((entry) => entry.cell)
})

const { currentPage, totalPages, goToPage, resetPage, gridCells } = useBagPagination(cells, pageSize)

watch(
  () => ({ ...ui.bagSorts.pill }),
  () => resetPage(),
)

// Buff regen deadline (plan §8): hiển thị timed effect ĐANG hoạt động
// với thời gian còn lại THỰC (Date.now vs expiresAtMs) — menu và combat
// đọc cùng một nguồn (player.persistentTimedEffects), không tạo timer
// thứ hai. Tick mỗi giây cùng progressTimer của panel.
const activeTimedEffects = computed(() => {
  stateVersion.value

  const now = nowMs.value

  return player.$state.persistentTimedEffects
    .filter((effect) => effect.expiresAtMs > now)
    .map((effect) => {
      const remainingSeconds = Math.ceil((effect.expiresAtMs - now) / 1000)

      const hp =
        effect.modifiers.find((modifier) => modifier.stat === 'hpRegenPerTurn')?.flat ?? 0
      const mp =
        effect.modifiers.find((modifier) => modifier.stat === 'manaRegenPerSecond')?.flat ?? 0

      const minutes = Math.floor(remainingSeconds / 60)
      const seconds = remainingSeconds % 60

      return {
        id: effect.id,

        // 2026-08-30 bug report: fallback cũ hiện thẳng ID nội bộ nếu pill
        // không còn trong registry — thay bằng nhãn trung tính, không lộ
        // dữ liệu hệ thống ra UI.
        label: gameManager.pillRegistry.has(effect.sourceItemId)
          ? gameManager.pillRegistry.get(effect.sourceItemId).name
          : 'Đan dược không rõ',

        value: `+${hp} HP/s, +${mp} MP/s`,

        remaining: `${minutes}:${String(seconds).padStart(2, '0')}`,
      }
    })
})
</script>

<template>
  <div class="bag-section">
    <!-- Buff regen đang hoạt động (plan §8) — deadline thực, cùng nguồn
         với combat (player.persistentTimedEffects), không tạo timer thứ hai. -->
    <div v-if="activeTimedEffects.length > 0" class="pill-active">
      <div v-for="effect in activeTimedEffects" :key="effect.id" class="pill-active__row">
        <span class="pill-active__name">{{ effect.label }}</span>

        <span class="pill-active__value">{{ effect.value }}</span>

        <span class="pill-active__remaining">{{ effect.remaining }}</span>
      </div>
    </div>

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
        :icon="cell?.icon"
        @click="cell?.onClick?.()"
      />
    </div>

    <BagPaginationControls
      :current-page="currentPage"
      :total-pages="totalPages"
      :sort-options="SORT_OPTIONS"
      :active-mode="ui.bagSorts.pill.mode"
      :active-direction="ui.bagSorts.pill.direction"
      @go-to-page="goToPage"
      @select-mode="(mode) => ui.setBagSortMode('pill', mode as PillSortMode)"
      @toggle-direction="ui.toggleBagSortDirection('pill')"
      @reset-sort="ui.resetBagSort('pill')"
    />
  </div>
</template>

<style scoped>
.pill-active {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
  padding: 6px;
  background: var(--ink-800);
  border: 1px solid var(--jade);
  border-radius: var(--radius-sm);
}

.pill-active__row {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  font-size: var(--text-xs);
}

.pill-active__name {
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pill-active__value {
  color: var(--jade);
  white-space: nowrap;
}

.pill-active__remaining {
  color: var(--chrome-500);
  white-space: nowrap;
  font-family: var(--font-body);
}
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
</style>
