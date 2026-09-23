<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SlotView from '../../common/SlotView.vue'
import Chip from '../../common/primitives/Chip.vue'
import BagPaginationControls, { type BagSortOption } from './BagPaginationControls.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useBagPagination } from '@/composables/useBagPagination'
import { useBagGridLayout } from '@/composables/useBagGridLayout'
import { useUiStore, type PillSortMode } from '@/stores/ui'
import { compareNumber, compareText, stableSort, withDirection } from '@/composables/useBagSort'
import {
  useEntryFilter,
  PILL_EFFECT_GROUPS,
  PILL_EFFECT_GROUP_LABEL_KEYS,
  type PillEffectGroup,
} from '@/composables/useBagFilter'
import { usePlayerStore } from '@/stores/player'
import { addCultivation } from '@/core/cultivation/CultivationSystem'
import { useNotificationStore } from '@/stores/notification'
import type { PillTarget } from '@/core/pill/PillSystem'
import type { Pill } from '@/core/pill/Pill'
import type { BagCell } from './BagCell'
import type { GradedItemTooltipContent, TooltipSection } from '@/composables/useTooltip'
import { statLabel, formatStat } from '@/core/stats/StatLabels'
import { ITEM_GRADE_ORDER, composeItemGradeNameSegments } from '@/core/item/ItemGrade'
import { compareProfessionGrades, realmFromGrade } from '@/core/profession/ProfessionGrade'
import { professionGradeRank } from '@/core/profession/slotRank'
import { gradeLabel, realmLabel } from '@/core/presentation/labels'

const { t } = useI18n()

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

        const modifierLabel = (buff.statModifiers ?? [])
          .map(
            (modifier) =>
              `${statLabel(modifier.stat)} +${formatStat(modifier.stat, modifier.flat ?? modifier.percent ?? 0)}`,
          )
          .join(', ')

        const duration = buff.lifetime.duration

        return {
          label: buff.name,
          value: `${modifierLabel}${duration !== undefined ? ` (${duration}${buff.lifetime.clock === 'seconds' ? 's' : ''})` : ''}`,
        }
      }
    }
  })

  const sections: TooltipSection[] = rows.length > 0 ? [{ label: 'Hiệu Ứng', rows }] : []

  // Same naming model as equipment (2026-09-14): the title is the FULL
  // composed "{Chat} - {Name}" string; the single display color rides
  // the payload (spec section 2 - Pham ramp when the pill carries
  // professionGrade, Chat --grade-* fallback otherwise).
  const displayName = composeItemGradeNameSegments(pill.name, pill.grade)
    .map((segment) => segment.text)
    .join(' ')
  const phamRank = pill.professionGrade !== undefined
    ? professionGradeRank(pill.professionGrade)
    : undefined

  return {
    kind: 'pill',

    name: displayName,

    nameColorVar: phamRank !== undefined ? `--rank-color-${phamRank}` : `--grade-${pill.grade}`,

    nameTone: pill.grade === 'tien' ? 'tien' : undefined,

    // Static SlotView header (spec section 3): the same signal set the
    // bag cell binds - Pham seal (professionGrade), Chat edge (grade),
    // grade word in aria (professionGrade is optional on Pill).
    slotPreview: {
      icon: pill.icon,
      label: displayName,
      accessibleLabel: pill.professionGrade
        ? `${displayName}, ${gradeLabel(pill.professionGrade)}`
        : displayName,
      equipmentQualityRank: phamRank,
      rarityRank: ITEM_GRADE_ORDER.indexOf(pill.grade) + 1,
    },

    imagePath: pill.icon,

    gradeLine: pill.professionGrade
      ? `Cảnh giới: ${gradeLabel(pill.professionGrade)} (${realmLabel(realmFromGrade(pill.professionGrade))})`
      : undefined,

    gradeKey: pill.grade,

    // Spec: "So huu: N" renders only when the player owns at least one.
    ownedCount: owned > 0 ? owned : undefined,

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
      const battleEntity = gameManager.getTurnBattle()?.players[0]?.entity

      if (battleEntity?.alive) {
        gameManager.combatSystem.applyHealing(battleEntity, amount, battleEntity.id, 'healing')
      }
    },

    // Unified Buff System (Task 13b) — trong trận thì áp thẳng lên
    // CombatEntity thật đang chiến đấu (source = target = player, giống
    // cách skill tự buff bản thân); ngoài trận không có CombatEntity nào
    // sống nên đi qua applyPersistentBuff() (đúng pattern Kiếp Thương
    // debuff dùng, xem GameManager.ts).
    applyBuff: (definition) => {
      const battleEntity = gameManager.getTurnBattle()?.players[0]?.entity

      if (battleEntity?.alive) {
        gameManager.turnBattleOps.applyBuffToPlayer(definition.id)

        return
      }

      gameManager.effectOps.applyPersistentBuff(definition)
    },
  }

  const result = gameManager.pillOps.usePillDetailed(pillId, target, player.$state)

  if (result.ok) {
    bumpState()

    return
  }

  // Reason channel (plan §8): sai cảnh giới/capped báo ngay thay vì
  // fail silently. Mission E Task 2: keyed messages through the i18n
  // gateway (P16) - one map entry per domain reason.
  const reasonKeys: Record<NonNullable<typeof result.reason>, string> = {
    not_found: 'bag.pill.reason.fallback',
    wrong_realm: 'bag.pill.reason.wrong_realm',
    all_main_stats_capped: 'bag.pill.reason.all_main_stats_capped',
    requires_phap_tu: 'bag.pill.reason.requires_phap_tu',
    cap: 'bag.pill.reason.cap',
    retired: 'bag.pill.reason.retired',
    material_pill: 'bag.pill.reason.material_pill',
  }

  useNotificationStore().push('warning', t(reasonKeys[result.reason ?? 'not_found']))
}

interface PillEntry {
  cell: BagCell

  pill: Pill

  amount: number

  /** Composed "{Chat} - {Name}" display name - the search axis. */
  name: string
}

const SORT_OPTIONS: Array<BagSortOption & { value: PillSortMode }> = [
  { value: 'grade', label: 'Phẩm đan' },
  { value: 'effect', label: 'Loại hiệu ứng' },
  { value: 'amount', label: 'Số lượng' },
  { value: 'name', label: 'Tên', ascLabel: 'Tên A–Z', descLabel: 'Tên Z–A' },
]

const entries = computed<PillEntry[]>(() => {
  stateVersion.value

  return gameManager.pillBag.getAll().map((stack) => {
    const displayName = composeItemGradeNameSegments(stack.pill.name, stack.pill.grade)
      .map((segment) => segment.text)
      .join(' ')

    return {
      pill: stack.pill,

      amount: stack.amount,

      name: displayName,

      cell: {
        key: stack.pill.id,

        label: stack.pill.name,

        // "{Name}, {Pham}" aria override (spec section 5b) -
        // professionGrade is optional on Pill, so the grade word is
        // gated on it.
        accessibleLabel: stack.pill.professionGrade
          ? `${displayName}, ${gradeLabel(stack.pill.professionGrade)}`
          : displayName,

        // "{Chat} - {Name}" - text structure only (item-info-card spec
        // 2026-09-14); display color lives on the tooltip payload.
        nameSegments: composeItemGradeNameSegments(stack.pill.name, stack.pill.grade),

        // Unified slot language: Pham -> seal, Chat (grade) -> frame/
        // aura. Pills now feed BOTH axes like equipment (rank >= dia gets
        // the quality beam).
        equipmentQualityRank: stack.pill.professionGrade
          ? professionGradeRank(stack.pill.professionGrade)
          : undefined,

        rarityRank: ITEM_GRADE_ORDER.indexOf(stack.pill.grade) + 1,

        description: stack.pill.description,

        amount: stack.amount,

        tooltip: buildTooltip(stack.pill, stack.amount),

        icon: stack.pill.icon,

        // Mission E Task 2 (audit T1-10): material pills have no drink
        // action - the cell renders without a click affordance.
        onClick: stack.pill.type === 'material' ? undefined : () => drinkPill(stack.pill.id),
      },
    }
  })
})

// ================= Filter/search/group chips =================
// Same pattern as MaterialBagSection: filter state is session-only and
// runs BEFORE sort + pagination. Group axis = first effect type (the
// 'effect' sort comparator reads the same field); 'other' catches pills
// with no effects.
const searchQuery = ref('')

const activeGroup = ref<PillEffectGroup | 'all'>('all')

const { filtered, visibleCount } = useEntryFilter(
  entries,
  { searchQuery, activeGroup },
  {
    name: (entry) => entry.name,
    group: (entry) => entry.pill.effects[0]?.type ?? 'other',
  },
)

// Chip labels resolve through the locale-key map (useBagFilter does not
// import i18n). Clicking the active chip toggles back to 'all'.
const GROUP_CHIPS = computed<Array<{ value: PillEffectGroup | 'all'; label: string }>>(() => [
  { value: 'all', label: t('panels.bag.groups.all') },
  ...PILL_EFFECT_GROUPS.map((group) => ({
    value: group,
    label: t(PILL_EFFECT_GROUP_LABEL_KEYS[group]),
  })),
])

function toggleGroup(value: PillEffectGroup | 'all') {
  activeGroup.value = activeGroup.value === value ? 'all' : value
}

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

// Sort trên bản copy TRƯỚC pagination (plan Workstream E) — sort đọc
// list ĐÃ filter (filter chạy trước sort, xem MaterialBagSection).
const cells = computed<BagCell[]>(() => {
  const sortState = ui.bagSorts.pill

  if (sortState.mode === 'default') {
    return filtered.value.map((entry) => entry.cell)
  }

  const sorted = stableSort(
    filtered.value,
    withDirection(PILL_COMPARATORS[sortState.mode], sortState.direction),
  )

  return sorted.map((entry) => entry.cell)
})

const { currentPage, totalPages, goToPage, resetPage, gridCells } = useBagPagination(cells, pageSize)

watch(
  () => ({ ...ui.bagSorts.pill }),
  () => resetPage(),
)

watch([searchQuery, activeGroup], () => resetPage())

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
        effect.modifiers.find((modifier) => modifier.stat === 'manaRegenPerTurn')?.flat ?? 0

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

    <div class="bag-section__filters">
      <input
        v-model="searchQuery"
        type="search"
        class="bag-section__search"
        :placeholder="t('panels.bag.search.pillPlaceholder')"
        :aria-label="t('panels.bag.search.pillAria')"
      >

      <div class="bag-section__chips" role="group" :aria-label="t('panels.bag.filterAriaPill')">
        <Chip
          v-for="chip in GROUP_CHIPS"
          :key="chip.value"
          :active="activeGroup === chip.value"
          @click="toggleGroup(chip.value)"
        >
          {{ chip.label }}
        </Chip>
      </div>

      <span class="bag-section__count">{{ visibleCount }} {{ t('panels.bag.countUnitSuffix') }}</span>
    </div>

    <div ref="gridRef" class="bag-section__grid" :style="gridStyle">
      <SlotView
        v-for="(cell, index) in gridCells"
        :key="cell?.key ?? index"
        class="bag-section__slot"
        :item="cell"
        :label="cell?.label"
        :accessible-label="cell?.accessibleLabel"
        :name-segments="cell?.nameSegments"
        :equipment-quality-rank="cell?.equipmentQualityRank"
        :rarity-rank="cell?.rarityRank"
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
  background: var(--sys-bg-0, var(--ink-800));
  border: 1px solid var(--sys-success, var(--jade));
  border-radius: var(--radius-sm);
}

.pill-active__row {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  font-size: var(--text-xs);
}

.pill-active__name {
  color: var(--sys-text, var(--text-primary));
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pill-active__value {
  color: var(--sys-success, var(--jade));
  white-space: nowrap;
}

.pill-active__remaining {
  color: var(--sys-line, var(--chrome-500));
  white-space: nowrap;
  font-family: var(--sys-font-body, var(--font-body));
}
.bag-section {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 6px;
}

.bag-section__filters {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.bag-section__search {
  flex: 1 1 120px;
  min-width: 0;
  min-height: var(--tap-min);
  padding: 0 var(--space-2);
  background: var(--sys-bg-0, var(--ink-800));
  color: var(--sys-text, var(--text-primary));
  border: 1px solid var(--sys-line-soft, var(--ink-line-soft));
  border-radius: var(--radius-sm);
  font-family: var(--sys-font-body, var(--font-body));
  font-size: var(--text-xs);
}

.bag-section__search::placeholder {
  color: var(--sys-text-dim, var(--text-muted));
}

.bag-section__search:focus-visible {
  outline: none;
  border-color: var(--sys-text, var(--chrome-300));
  box-shadow: 0 0 0 2px var(--sys-focus, rgba(217, 212, 199, 0.65));
}

.bag-section__chips {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.bag-section__count {
  color: var(--sys-text-dim, var(--paper-text-muted));
  font-size: var(--text-xs);
  white-space: nowrap;
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
