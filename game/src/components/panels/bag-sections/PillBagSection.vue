<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SlotView from '../../common/SlotView.vue'
import GameDropdownButton from '@/components/common/GameDropdownButton.vue'
import type { BagSortOption } from './BagPaginationControls.vue'
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
import { scopeHiddenPillFamilyOfId } from '@/core/betaScope'
import { useNotificationStore } from '@/stores/notification'
import type { PillTarget } from '@/core/pill/PillSystem'
import type { Pill } from '@/core/pill/Pill'
import type { BagCell } from './BagCell'
import type { GradedItemTooltipContent, TooltipSection } from '@/composables/useTooltip'
import { statLabel, formatStat } from '@/core/stats/StatLabels'
import { ITEM_GRADE_ORDER, composeItemGradeNameSegments } from '@/core/item/ItemGrade'
import { ITEM_QUALITY_ORDER } from '@/core/item/ItemQuality'
import type { ItemQuality } from '@/core/item/ItemQuality'
import { BASE_PILL_QUALITY, pillQualityUplift } from '@/core/pill/PillQuality'
import { realmFromGrade } from '@/core/profession/ProfessionGrade'
import { professionGradeRank } from '@/core/profession/slotRank'
import { gradeLabel, realmLabel } from '@/core/presentation/labels'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

// Equipment item-slot chrome for the cells (owner ruling 2026-10-11:
// Tru Vat cells wear the same ornate slot art as the Trang Bi bag).
const ITEM_SLOT_SRC = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/item-slot-v1.png')
// Design capacity label shared with the equipment bag - no real bag cap
// exists yet; 100 is the designed display cap.
const BAG_DISPLAY_CAPACITY = 100

const { t } = useI18n()

const ui = useUiStore()

const gameManager = useGameManager()
const player = usePlayerStore()
const { stateVersion, bumpState } = useStateVersion()

// Dong ho 1 giay -- deadline timed effect hien thi theo thoi gian thuc
// (Date.now), khong phu thuoc game pause (plan S5.4).
const nowMs = ref(gameManager.time.now())

let effectTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  effectTimer = setInterval(() => {
    nowMs.value = gameManager.time.now()
  }, 1000)
})

onUnmounted(() => {
  if (effectTimer) {
    clearInterval(effectTimer)
  }
})

// Grid responsive theo chieu rong that -- xem ghi chu day du o
// useBagGridLayout.ts/MaterialBagSection.vue (cung pattern ap cho ca
// 5 bag-sections).
const { gridRef, pageSize, gridStyle } = useBagGridLayout()

// Tooltip co cau truc (2026-08-15, cung khuon GradedItemTooltipContent
// dung chung Pill/Talisman/Formation, xem useTooltip.ts) -- build TU
// DUNG PillEffect[] that, khong bia so. Them 4 effect nghe (2026-08-24,
// resource-professions-rework S5).
function buildTooltip(
  pill: Pill,
  owned: number,
  quality: ItemQuality = BASE_PILL_QUALITY,
): GradedItemTooltipContent {
  const uplift = pillQualityUplift(quality)
  const rows = pill.effects.map((effect) => {
    switch (effect.type) {
      case 'heal':
        return { label: 'Hồi Khí Huyết', value: `+${formatStat('maxHp', (effect.value ?? 0) * uplift)}` }

      case 'cultivation':
        // Pill nghe dung % yeu cau tang; legacy dung flat.
        // formatStat('cultivationPercent') already appends "%" - the
        // extra literal here rendered "+3.0%%" (audit M2).
        return effect.cultivationPercent !== undefined
          ? {
              label: 'Tu Vi',
              value: `+${formatStat('cultivationPercent', effect.cultivationPercent * uplift)} yêu cầu tầng`,
            }
          : { label: 'Tu Vi', value: `+${(effect.value ?? 0) * uplift}` }

      case 'permanent_stat': {
        const statGrant = Math.round((effect.value ?? 0) * uplift)
        return {
          label: `${effect.stat ? statLabel(effect.stat) : '?'} (vĩnh viễn)`,
          value: `+${effect.stat ? formatStat(effect.stat, statGrant) : statGrant}`,
        }
      }

      case 'random_main_stat': {
        const randomPoints = Math.max(1, Math.round(uplift))
        return { label: 'Main Stat ngẫu nhiên', value: `+${randomPoints} (một trong 5 chỉ số chưa đạt trần)` }
      }

      case 'regen':
        return {
          label: 'Hồi phục theo giây',

          value: `+${(effect.hpPerSecond ?? 0) * uplift} HP/s, +${(effect.mpPerSecond ?? 0) * uplift} MP/s trong ${effect.durationSeconds ?? 0}s`,
        }

      case 'skill_insight':
        return { label: 'Cảm Ngộ', value: `+${Math.round((effect.value ?? 0) * uplift)}` }

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

  // audit M2: drinkable pills consume on a TWO-click confirm, so the
  // tooltip must advertise the gesture -- a {label, rows: []} section
  // renders as one caption line. Material pills stay inert.
  if (pill.type !== 'material') {
    sections.push({ label: t('bag.pill.useHint'), rows: [] })
  }

  // Same naming model as equipment (2026-09-14) + M-PILL-GRADE (2026-10-11):
  // the title and rarity axis follow the stack's rolled quality so the
  // tooltip header and effect numbers match the cell and drink potency.
  const displayName = composeItemGradeNameSegments(pill.name, quality)
    .map((segment) => segment.text)
    .join(' ')
  const phamRank = pill.professionGrade !== undefined
    ? professionGradeRank(pill.professionGrade)
    : undefined

  return {
    kind: 'pill',

    name: displayName,

    nameColorVar: phamRank !== undefined ? `--rank-color-${phamRank}` : `--grade-${quality}`,

    nameTone: quality === 'tien' ? 'tien' : undefined,

    // Static SlotView header (spec section 3): the same signal set the
    // bag cell binds - Pham seal (professionGrade), Chat edge (quality),
    // grade word in aria (professionGrade is optional on Pill).
    slotPreview: {
      icon: pill.icon,
      label: displayName,
      accessibleLabel: pill.professionGrade
        ? `${displayName}, ${gradeLabel(pill.professionGrade)}`
        : displayName,
      equipmentQualityRank: phamRank,
      rarityRank: ITEM_QUALITY_ORDER.indexOf(quality) + 1,
    },

    imagePath: pill.icon,

    gradeLine: pill.professionGrade
      ? `Cảnh giới: ${gradeLabel(pill.professionGrade)} (${realmLabel(realmFromGrade(pill.professionGrade))})`
      : undefined,

    gradeKey: quality,

    // Spec: "So huu: N" renders only when the player owns at least one.
    ownedCount: owned > 0 ? owned : undefined,

    description: pill.description,

    sections,
  }
}

// Dan Duoc dung duoc ca trong lan ngoai tran - cultivation cong thang
// qua dung cong thuc chan-tran dung chung (addCultivation), hoi mau
// chi co tac dung khi dang co tran dang danh (ngoai tran player khong
// co HP song de hoi, uong "Tieu Hoi Dan" luc do coi nhu khong co gi
// de hoi - khong phai loi, chi la khong co dich).
function drinkPill(pillId: string, pillName: string, quality: ItemQuality) {
  const target: PillTarget = {
    addCultivation: (amount) => addCultivation(player.$state, amount),

    heal: (amount) => {
      const battleEntity = gameManager.getTurnBattle()?.players[0]?.entity

      if (battleEntity?.alive) {
        gameManager.combatSystem.applyHealing(battleEntity, amount, battleEntity.id, 'healing')
      }
    },

    // Unified Buff System (Task 13b) - trong tran thi ap thang len
    // CombatEntity that dang chien dau (source = target = player, giong
    // cach skill tu buff ban than); ngoai tran khong co CombatEntity nao
    // song nen di qua applyPersistentBuff() (dung pattern Kiep Thuong
    // debuff dung, xem GameManager.ts).
    applyBuff: (definition) => {
      const battleEntity = gameManager.getTurnBattle()?.players[0]?.entity

      if (battleEntity?.alive) {
        gameManager.turnBattleOps.applyBuffToPlayer(definition.id)

        return
      }

      gameManager.effectOps.applyPersistentBuff(definition)
    },
  }

  const result = gameManager.pillOps.usePillDetailed(
    pillId,
    target,
    player.$state,
    undefined,
    quality,
  )

  if (result.ok) {
    // audit M2: one-click consume had NO success feedback - push a loot
    // toast with the pill name.
    useNotificationStore().push('loot', t('bag.pill.used', { name: pillName }))

    bumpState()

    return
  }

  // Reason channel (plan sec8): sai canh gioi/capped bao ngay thay vi
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
    in_battle: 'bag.pill.reason.in_battle',
    scope_hidden: 'bag.pill.reason.scope_hidden',
  }

  useNotificationStore().push('warning', t(reasonKeys[result.reason ?? 'not_found']))
}

interface PillEntry {
  cell: BagCell

  pill: Pill

  amount: number

  /** Chat da roll cua stack nay (mac dinh hoang cho dan cu). */
  quality: ItemQuality

  /** Composed "{Chat} - {Name}" display name - the search axis. */
  name: string
}

// audit M2 (2026-09-28) - pills used to consume on a single click with
// zero confirmation or success feedback, so one stray click burned a
// rare elixir. First click now ARMS the pill (selected ring + a short
// disarm timeout); only the second click on the same pill calls the
// consume path. Clicking a different cell re-arms onto it instead.
// M-PILL-GRADE: khoa arm theo pillId+chat - hai stack cung vien dan
// nhung khac chat la hai o rieng, arm o nay khong uong nham stack kia.
const armedPillId = ref<string | null>(null)

const ARM_TIMEOUT_MS = 4000

let armTimer: ReturnType<typeof setTimeout> | undefined

function disarmPill() {
  armedPillId.value = null

  if (armTimer !== undefined) {
    clearTimeout(armTimer)
    armTimer = undefined
  }
}

function pillCellKey(pillId: string, quality: ItemQuality): string {
  return `${pillId}|${quality}`
}

function onPillClick(pillId: string, name: string, quality: ItemQuality) {
  const cellKey = pillCellKey(pillId, quality)

  if (armedPillId.value === cellKey) {
    disarmPill()
    drinkPill(pillId, name, quality)

    return
  }

  armedPillId.value = cellKey

  if (armTimer !== undefined) {
    clearTimeout(armTimer)
  }

  armTimer = setTimeout(() => {
    armedPillId.value = null
    armTimer = undefined
  }, ARM_TIMEOUT_MS)
}

onUnmounted(disarmPill)

const SORT_OPTIONS: Array<BagSortOption & { value: PillSortMode }> = [
  { value: 'default', label: t('panels.bag.sort.default') },
  { value: 'grade', label: 'Phẩm đan' },
  { value: 'effect', label: 'Loại hiệu ứng' },
  { value: 'amount', label: 'Số lượng' },
  { value: 'name', label: 'Tên', ascLabel: 'Tên A–Z', descLabel: 'Tên Z–A' },
]

// Sort dropdown (owner ruling 2026-10-11: Tru Vat toolbar matches the
// equipment bag - filter chip + sort chip + pager + count). Picking
// the ACTIVE mode toggles direction like the equipment select.
const SORT_CHIP_OPTIONS = computed<Array<{ value: PillSortMode; label: string }>>(() =>
  SORT_OPTIONS.map((option) => {
    const active = option.value === ui.bagSorts.pill.mode && option.value !== 'default'
    if (!active) return { value: option.value, label: option.label }
    const directed =
      option.ascLabel || option.descLabel
        ? (ui.bagSorts.pill.direction === 'asc' ? option.ascLabel : option.descLabel)
        : option.label + (ui.bagSorts.pill.direction === 'asc' ? ' ↑' : ' ↓')
    return { value: option.value, label: directed ?? option.label }
  }),
)

function onSortPick(mode: string) {
  if (mode === ui.bagSorts.pill.mode) {
    ui.toggleBagSortDirection('pill')
  } else {
    ui.setBagSortMode('pill', mode as PillSortMode)
  }
}

const entries = computed<PillEntry[]>(() => {
  stateVersion.value

  // BETA SCOPE LOCK - a carried save's dormant-family stacks are
  // scope-hidden: the drink path (usePillDetailed) fails closed, so a
  // rendered cell would arm a consume it can never complete.
  return gameManager.pillBag
    .getAll()
    .filter((stack) => scopeHiddenPillFamilyOfId(stack.pill.id) === null)
    .map((stack) => {
    // M-PILL-GRADE: truc chat hien thi = chat DA ROLL cua stack (dan
    // cu khong field = hoang) - khung mau + tien to ten theo chat do,
    // khong theo grade authored cua recipe.
    const quality = stack.quality ?? BASE_PILL_QUALITY

    const displayName = composeItemGradeNameSegments(stack.pill.name, quality)
      .map((segment) => segment.text)
      .join(' ')

    return {
      pill: stack.pill,

      amount: stack.amount,

      quality,

      name: displayName,

      cell: {
        key: pillCellKey(stack.pill.id, quality),

        label: stack.pill.name,

        // "{Name}, {Pham}" aria override (spec section 5b) -
        // professionGrade is optional on Pill, so the grade word is
        // gated on it.
        accessibleLabel: stack.pill.professionGrade
          ? `${displayName}, ${gradeLabel(stack.pill.professionGrade)}`
          : displayName,

        // "{Chat} - {Name}" - text structure only (item-info-card spec
        // 2026-09-14); display color lives on the tooltip payload.
        nameSegments: composeItemGradeNameSegments(stack.pill.name, quality),

        // Unified slot language: Pham -> seal, Chat (grade) -> frame/
        // aura. Pills now feed BOTH axes like equipment (rank >= dia gets
        // the quality beam).
        equipmentQualityRank: stack.pill.professionGrade
          ? professionGradeRank(stack.pill.professionGrade)
          : undefined,

        // M-PILL-GRADE: frame/aura theo chat da roll cua stack.
        rarityRank: ITEM_QUALITY_ORDER.indexOf(quality) + 1,

        description: stack.pill.description,

        amount: stack.amount,

        tooltip: buildTooltip(stack.pill, stack.amount, quality),

        icon: stack.pill.icon,

        // Mission E Task 2 (audit T1-10): material pills have no drink
        // action - the cell renders without a click affordance.
        onClick:
          stack.pill.type === 'material'
            ? undefined
            : () => onPillClick(stack.pill.id, displayName, quality),

        // audit M2 two-click consume: the armed pill reads
        // interaction:'selected' so the ring shows WHICH pill the
        // second click will drink.
        state: armedPillId.value === pillCellKey(stack.pill.id, quality)
          ? { interaction: 'selected' }
          : undefined,
      },
    }
  })
})

// ================= Filter/search/group chips =================
// Same pattern as MaterialBagSection: filter state is session-only and
// runs BEFORE sort + pagination. Group axis = first effect type (the
// 'effect' sort comparator reads the same field); 'other' catches pills
// with no effects.
// Owner ruling 2026-10-11: search UI removed - the query stays
// permanently empty, feeding the filter pipeline an inert input.
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


// Tieu chi Dan Duoc (plan Workstream E) - pham dan/loai hieu ung/so
// luong/ten. "Loai hieu ung" so sanh effect type DAU TIEN cua recipe.
const PILL_COMPARATORS: Record<Exclude<PillSortMode, 'default'>, (a: PillEntry, b: PillEntry) => number> = {
  // QA fixpoint 2026-10-10 + truc chat: total order - Chat da roll
  // (ITEM_QUALITY_ORDER) first, then Pham rank (missing=0), ties use
  // ITEM_GRADE_ORDER (mixed-axis compare is non-transitive).
  grade: (a, b) => {
    const qa = ITEM_QUALITY_ORDER.indexOf(a.quality)
    const qb = ITEM_QUALITY_ORDER.indexOf(b.quality)
    if (qa !== qb) return compareNumber(qa, qb)
    const ra = a.pill.professionGrade !== undefined ? professionGradeRank(a.pill.professionGrade) : 0
    const rb = b.pill.professionGrade !== undefined ? professionGradeRank(b.pill.professionGrade) : 0
    if (ra !== rb) return compareNumber(ra, rb)
    return compareNumber(ITEM_GRADE_ORDER.indexOf(a.pill.grade), ITEM_GRADE_ORDER.indexOf(b.pill.grade))
  },

  effect: (a, b) => compareText(a.pill.effects[0]?.type, b.pill.effects[0]?.type),

  amount: (a, b) => compareNumber(a.amount, b.amount),

  name: (a, b) => compareText(a.pill.name, b.pill.name),
}

// Sort tren ban copy TRUOC pagination (plan Workstream E) - sort doc
// list DA filter (filter chay truoc sort, xem MaterialBagSection).
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

watch(activeGroup, () => resetPage())

// Buff regen deadline (plan sec8): hien thi timed effect DANG hoat dong
// voi thoi gian con lai THUC (Date.now vs expiresAtMs) - menu va combat
// doc cung mot nguon (player.persistentTimedEffects), khong tao timer
// thu hai. Tick moi giay cung progressTimer cua panel.
const activeTimedEffects = computed(() => {
  stateVersion.value

  const now = nowMs.value

  return player.$state.persistentTimedEffects
    .filter((effect) => effect.expiresAtMs > now)
    // BETA SCOPE LOCK - same dormant-family admission as the stack
    // cells above: a carried dormant-family timed effect (e.g.
    // hoi_xuan_dan_*) renders no active-effects chip.
    .filter((effect) => scopeHiddenPillFamilyOfId(effect.sourceItemId) === null)
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

        // 2026-08-30 bug report: fallback cu hien thang ID noi bo neu pill
        // khong con trong registry - thay bang nhan trung tinh, khong lo
        // du lieu he thong ra UI.
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
  <div class="bag-section" :style="{ '--equipment-item-slot': `url('${ITEM_SLOT_SRC}')` }">
    <!-- Buff regen dang hoat dong (plan S8) -- deadline thuc, cung nguon
         voi combat (player.persistentTimedEffects), khong tao timer thu hai. -->
    <div v-if="activeTimedEffects.length > 0" class="pill-active">
      <div v-for="effect in activeTimedEffects" :key="effect.id" class="pill-active__row">
        <span class="pill-active__name">{{ effect.label }}</span>

        <span class="pill-active__value">{{ effect.value }}</span>

        <span class="pill-active__remaining">{{ effect.remaining }}</span>
      </div>
    </div>

    <div class="bag-section__toolbar">
      <!-- Owner ruling 2026-10-11: no search field - toolbar matches
           the equipment bag verbatim (filter + sort + pager + count). -->
      <GameDropdownButton
        v-model="activeGroup"
        :options="GROUP_CHIPS"
        :label="t('panels.bag.filterAriaPill')"
      />
      <GameDropdownButton
        :model-value="ui.bagSorts.pill.mode"
        :options="SORT_CHIP_OPTIONS"
        :label="t('panels.bag.sort.button')"
        @update:model-value="onSortPick"
      />
      <div v-if="totalPages > 1" class="bag-section__pager">
        <button
          type="button"
          class="bag-section__page-btn"
          :disabled="currentPage === 0"
          :aria-label="t('panels.bag.pagePrev')"
          @click="goToPage(currentPage - 1)"
        >
‹
</button>
        <span class="bag-section__page-label">{{ currentPage + 1 }}/{{ totalPages }}</span>
        <button
          type="button"
          class="bag-section__page-btn"
          :disabled="currentPage >= totalPages - 1"
          :aria-label="t('panels.bag.pageNext')"
          @click="goToPage(currentPage + 1)"
        >
›
</button>
      </div>
      <!-- Owner ruling 2026-10-11: "N loai" IS the slot count - render
           it in the equipment bag's x/100 capacity format. -->
      <span class="bag-section__count-label">{{ visibleCount }}/{{ BAG_DISPLAY_CAPACITY }}</span>
    </div>

    <div ref="gridRef" class="bag-section__grid" :style="gridStyle">
      <SlotView
        v-for="(cell, index) in gridCells"
        :key="cell?.key ?? index"
        class="bag-section__slot"
        variant="bag"
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
        :state="cell?.state"
        @click="cell?.onClick?.()"
      />
    </div>
  </div>
</template>

<style scoped>
.pill-active {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
  padding: 6px;
  background: var(--ink-800);
  border: 1px solid var(--jade);
  border-radius: var(--radius-sm);
}

.pill-active__row {
  display: flex;
  justify-content: space-between;
  gap: 4px;
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

.bag-section__toolbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
}

.bag-section__pager {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 4px;
}

.bag-section__page-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid #8a7444;
  background: #23251e;
  color: #f3e4c4;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.bag-section__page-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.bag-section__page-label {
  font-size: var(--text-xs);
  color: #e8d9ae;
  white-space: nowrap;
}

.bag-section__count-label {
  margin-left: auto;
  font-size: var(--text-xs);
  color: #e8d9ae;
  white-space: nowrap;
}

.bag-section__chips {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
}

/* Grid fills the card like the equipment bag: rows split the card
   height evenly (minmax 0 so they may shrink) and pack to the BOTTOM
   edge; columns/gap come from useBagGridLayout measuring the real
   grid rect. */
.bag-section__grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(var(--grid-columns), minmax(0, 1fr));
  grid-auto-rows: minmax(0, 1fr);
  align-content: end;
  gap: var(--grid-gap);
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: #8a7444 transparent;
}

.bag-section__slot {
  width: 100%;
  aspect-ratio: 1 / 1;
}
</style>
