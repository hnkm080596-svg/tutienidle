<script setup lang="ts" generic="T">
import { computed, ref, watch } from 'vue'
import { formatNumber } from '@/core/format/NumberFormatter'
import type { TooltipContent } from '@/composables/useTooltip'
import type { NameSegment } from '@/core/item/NameSegment'
import type { SlotBadge, SlotPresentationState } from './SlotTypes'
import InkNineSlice from './primitives/InkNineSlice.vue'

// Slot Revamp — CSS-only presentation (tooltip-revamp-plan.md mục 17).
// PNG DUY NHẤT được phép là icon riêng của item (prop `icon`); mọi
// backdrop/frame/badge/glow khác giờ do CSS đảm nhiệm. Xem SlotTypes.ts
// cho 5 trục semantic (availability/interaction/validation/marker/
// comparison) — KHÔNG dùng danh sách boolean rời rạc.
const props = defineProps<{
  /** Item mà Slot đang chứa. null = slot trống — filled/empty suy trực
   * tiếp từ đây, KHÔNG có prop `hasItem` riêng. */
  item: T | null

  /** PNG icon trong suốt của item — không có/lỗi tải thì rơi về
   * monogram CSS (chữ cái đầu `label`). */
  icon?: string

  label?: string

  description?: string

  amount?: number

  /** Tên ghép động nhiều đoạn tô màu riêng (Phẩm/Set/Địa Giới) — ưu
   * tiên HƠN `label` (chuỗi đơn) nếu có truyền vào. */
  nameSegments?: NameSegment[]

  /** Rank chuẩn hoá 1-9 (xem composables/slots/normalizeSlotRank.ts) —
   * SlotView KHÔNG biết ID domain như 'pham_khi'/'tien'. */
  equipmentQualityRank?: number

  /** Rank chuẩn hoá 1/3/5/7/9 (5 bậc Phẩm ánh xạ đều lên thang 1-9). */
  rarityRank?: number

  state?: SlotPresentationState

  badges?: readonly SlotBadge[]

  tooltip?: TooltipContent

  /** Tên truy cập — mặc định dùng `label` nếu không truyền riêng. */
  accessibleLabel?: string
}>()

const emit = defineEmits<{
  click: []
}>()

const filled = computed(() => props.item !== null)

function monogram(label?: string): string {
  return label?.trim().charAt(0).toUpperCase() ?? ''
}

// Icon lỗi tải (404/hỏng) — ẩn hẳn <img>, để monogram fallback hiện
// qua. Reset lại mỗi khi đổi sang icon khác (đổi item trong cùng ô).
const failedIconSrc = ref<string | null>(null)

watch(() => props.icon, () => {
  failedIconSrc.value = null
})

const showIcon = computed(() => Boolean(props.icon) && props.icon !== failedIconSrc.value)

function onIconError() {
  failedIconSrc.value = props.icon ?? null
}

function clampRank(rank: number | undefined): number | undefined {
  if (rank === undefined) return undefined
  return Math.min(9, Math.max(1, Math.round(rank)))
}

const qualityColor = computed(() => {
  const rank = clampRank(props.equipmentQualityRank)
  return rank ? `var(--rank-color-${rank})` : undefined
})

const rarityColor = computed(() => {
  const rank = clampRank(props.rarityRank)
  return rank ? `var(--rank-color-${rank})` : undefined
})

const isMaxRank = computed(() => clampRank(props.equipmentQualityRank) === 9)
const isMaxRarityRank = computed(() => clampRank(props.rarityRank) === 9)

// ============================================================
// PRECEDENCE (mục 17.2) — locked chặn interaction+validation; disabled
// chặn click nhưng KHÔNG chặn validation; processing chặn click,
// giữ nguyên Quality/Rarity; selected không che validation.
// ============================================================

const availability = computed(() => props.state?.availability ?? 'available')
const interaction = computed(() => props.state?.interaction ?? 'idle')

const isBlocked = computed(() => availability.value !== 'available' || interaction.value === 'processing')

const showSelected = computed(() => availability.value === 'available' && interaction.value === 'selected')
const showProcessing = computed(() => availability.value === 'available' && interaction.value === 'processing')

const veil = computed(() => {
  if (availability.value === 'locked') return 'locked'
  if (availability.value === 'disabled') return 'disabled'
  if (showProcessing.value) return 'processing'
  return 'none'
})

const validation = computed(() => (availability.value === 'locked' ? 'neutral' : props.state?.validation ?? 'neutral'))

const marker = computed(() => props.state?.marker ?? 'none')
const comparison = computed(() => props.state?.comparison ?? 'neutral')

const validationGlyph = computed(() => {
  switch (validation.value) {
    case 'valid': return '✓'
    case 'invalid': return '✕'
    case 'missing': return '!'
    default: return ''
  }
})

// aria-disabled + click-guard THAY vì `disabled` thật — locked/disabled
// vẫn phải giữ được focus/hover để tooltip giải thích điều kiện (mục
// 17.4/17.5), native `disabled` sẽ chặn luôn cả việc đó.
function handleClick() {
  if (isBlocked.value) return
  emit('click')
}

const tooltipContent = computed(() => props.tooltip ?? (props.label || props.description
  ? { title: props.label, description: props.description }
  : undefined))
</script>

<template>
  <button
    type="button"
    class="slot-view"
    :class="[
      filled ? 'slot-view--filled' : 'slot-view--empty',
      showSelected ? 'slot-view--selected' : '',
      veil !== 'none' ? `slot-view--veil-${veil}` : '',
      validation !== 'neutral' ? `slot-view--validation-${validation}` : '',
      isMaxRank ? 'slot-view--max-rank' : '',
    ]"
    :style="{
      '--slot-quality-color': qualityColor,
      '--slot-rarity-color': rarityColor,
    }"
    :aria-disabled="isBlocked ? 'true' : undefined"
    :aria-busy="showProcessing ? 'true' : undefined"
    :aria-label="accessibleLabel ?? label"
    v-tooltip="tooltipContent"
    @click="handleClick"
  >
    <InkNineSlice asset-id="frame-s-slot" layer="frame" />
    <!-- layer 2: icon / monogram fallback -->
    <span class="slot-view__icon-wrap">
      <img v-if="showIcon" class="slot-view__item-icon" :src="icon" :alt="label || ''" @error="onIconError" />
      <span v-else-if="filled" class="slot-view__monogram" aria-hidden="true">{{ monogram(label) }}</span>
    </span>

    <!-- layer 4: validation glyph (màu KHÔNG phải tín hiệu duy nhất) -->
    <span v-if="validation !== 'neutral'" class="slot-view__validation-glyph" aria-hidden="true">{{ validationGlyph }}</span>

    <!-- layer 6: rarity chip + marker + comparison + custom badges -->
    <span v-if="filled && rarityRank !== undefined" class="slot-view__rarity-chip" :class="{ 'slot-view__rarity-chip--max': isMaxRarityRank }" aria-hidden="true" />

    <span v-if="marker === 'equipped'" class="slot-view__marker slot-view__marker--equipped" aria-hidden="true">●</span>
    <span v-else-if="marker === 'new'" class="slot-view__marker slot-view__marker--new" aria-hidden="true">NEW</span>

    <span v-if="comparison !== 'neutral'" class="slot-view__comparison" :class="`slot-view__comparison--${comparison}`" aria-hidden="true">
      {{ comparison === 'upgrade' ? '▲' : '▼' }}
    </span>

    <span v-for="(badge, index) in badges" :key="index" class="slot-view__badge" :class="[`slot-view__badge--${badge.kind}`, badge.tone ? `slot-view__badge--${badge.tone}` : '']">
      {{ badge.text }}
    </span>

    <!-- layer 7: amount + caption -->
    <span v-if="amount !== undefined" class="slot-view__amount">x{{ formatNumber(amount) }}</span>

    <span v-if="nameSegments && nameSegments.length > 0" class="slot-view__caption">
      <template v-for="(segment, index) in nameSegments" :key="index">
        <span v-if="index > 0" class="slot-view__caption-dot"> · </span>
        <span :data-name-tone="segment.tone" :style="{ color: segment.colorVar ? `var(${segment.colorVar})` : undefined }">{{ segment.text }}</span>
      </template>
    </span>

    <span v-else-if="label" class="slot-view__caption">{{ label }}</span>

    <!-- layer 8: locked/disabled/processing veil -->
    <span v-if="veil !== 'none'" class="slot-view__veil" aria-hidden="true">
      <span v-if="veil === 'locked'" class="slot-view__veil-glyph">🔒</span>
      <span v-else-if="veil === 'disabled'" class="slot-view__veil-glyph">⊘</span>
      <span v-else class="slot-view__spinner" />
    </span>
  </button>
</template>

<style scoped>
/* ============================================================
   0. BASE SURFACE
   ============================================================ */

.slot-view {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-end;
  width: 100%;
  aspect-ratio: 1;
  padding: 0;
  border: 1px solid var(--slot-border);
  border-radius: var(--radius-sm);
  background: var(--slot-surface);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  cursor: pointer;
  overflow: hidden;
  isolation: isolate;
  transition: border-color 35ms linear, box-shadow 35ms linear, background-color 35ms linear;
}

.slot-view--empty {
  border-style: dashed;
}

.slot-view--filled {
  background: var(--slot-surface-raised);
  border-color: var(--slot-quality-color, var(--ink-line));
  box-shadow: var(--slot-shadow), 0 0 8px var(--slot-quality-color, transparent);
}

.slot-view--filled.slot-view--max-rank {
  box-shadow: var(--slot-shadow), 0 0 12px var(--rank-color-9);
}

/* Bậc 9 — gradient bảy màu ở viền TRÊN (mục 17.4 "solid fallback +
   gradient"), border-color solid ở trên vẫn là fallback chính. */
.slot-view--filled.slot-view--max-rank::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 2px;
  z-index: 3;
  background: var(--rank-gradient-9);
  pointer-events: none;
}

/* ============================================================
   1. QUALITY TINT/AURA
   ============================================================ */

.slot-view--filled::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--slot-quality-color, transparent) 22%, transparent), transparent 70%);
  pointer-events: none;
}

/* ============================================================
   2. ICON / MONOGRAM
   ============================================================ */

.slot-view__icon-wrap {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.slot-view__item-icon {
  width: 84%;
  height: 84%;
  object-fit: contain;
  user-select: none;
}

.slot-view__monogram {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 62%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--ink-700);
  color: var(--slot-quality-color, var(--text-secondary));
  font-family: var(--font-display);
  font-weight: 600;
  font-size: var(--text-title);
}

/* ============================================================
   4. VALIDATION OVERLAY — ring + glyph, KHÔNG chỉ dựa vào màu.
   ============================================================ */

.slot-view--validation-valid {
  box-shadow: inset 0 0 0 2px var(--slot-valid);
}

.slot-view--validation-invalid,
.slot-view--validation-missing {
  box-shadow: inset 0 0 0 2px var(--slot-invalid);
}

.slot-view__validation-glyph {
  position: absolute;
  top: 2px;
  left: 2px;
  z-index: 6;
  width: 13px;
  height: 13px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-size: var(--text-xs);
  font-weight: 700;
  line-height: 1;
  pointer-events: none;
}

.slot-view--validation-valid .slot-view__validation-glyph {
  background: var(--slot-valid);
  color: var(--ink-950);
}

.slot-view--validation-invalid .slot-view__validation-glyph,
.slot-view--validation-missing .slot-view__validation-glyph {
  background: var(--slot-invalid);
  color: var(--text-primary);
}

/* ============================================================
   5. HOVER / FOCUS / SELECTED — selected thắng hover nhưng không
   che validation (ring validation ở trên là box-shadow riêng, ring
   selected bên dưới là outline riêng — 2 kênh khác nhau, không đè).
   ============================================================ */

.slot-view:hover:not([aria-disabled='true']) .slot-view__item-icon,
.slot-view:hover:not([aria-disabled='true']) .slot-view__monogram {
  transform: translateY(-1px);
}

.slot-view:hover:not([aria-disabled='true']) {
  border-color: var(--slot-hover);
}

.slot-view:focus-visible {
  outline: 2px solid var(--slot-hover);
  outline-offset: 1px;
}

.slot-view--selected {
  outline: 2px solid var(--slot-selected);
  outline-offset: -2px;
}

/* ============================================================
   6. RARITY CHIP / MARKER / COMPARISON / BADGES
   ============================================================ */

.slot-view__rarity-chip {
  position: absolute;
  top: 3px;
  right: 3px;
  z-index: 6;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: var(--slot-rarity-color, var(--text-muted));
  pointer-events: none;
}

.slot-view__rarity-chip--max {
  background: var(--rank-gradient-9);
}

.slot-view__marker {
  position: absolute;
  top: 2px;
  right: 2px;
  z-index: 6;
  padding: 0 3px;
  border-radius: 3px;
  font-size: var(--text-xs);
  font-weight: 700;
  line-height: 1.3;
  pointer-events: none;
}

.slot-view__marker--equipped {
  color: var(--slot-valid);
  font-size: var(--text-xs);
}

.slot-view__marker--new {
  background: var(--crimson);
  color: var(--text-primary);
  letter-spacing: 0.02em;
}

.slot-view__comparison {
  position: absolute;
  bottom: 16px;
  left: 3px;
  z-index: 6;
  font-size: var(--text-xs);
  font-weight: 700;
  line-height: 1;
  pointer-events: none;
}

.slot-view__comparison--upgrade {
  color: var(--slot-valid);
}

.slot-view__comparison--downgrade {
  color: var(--slot-invalid);
}

.slot-view__badge {
  position: absolute;
  z-index: 6;
  padding: 0 4px;
  border-radius: 3px;
  background: var(--slot-caption-bg-strong);
  color: var(--text-primary);
  font-size: var(--text-xs);
  font-weight: 700;
  line-height: 1.4;
  pointer-events: none;
  white-space: nowrap;
}

.slot-view__badge--enhance {
  bottom: 34px;
  right: 3px;
  background: linear-gradient(180deg, var(--chrome-100), var(--chrome-500));
  color: var(--ink-950);
}

.slot-view__badge--positive {
  color: var(--slot-valid);
}

.slot-view__badge--negative {
  color: var(--slot-invalid);
}

/* ============================================================
   7. AMOUNT / CAPTION
   ============================================================ */

.slot-view__amount {
  position: absolute;
  right: 3px;
  bottom: 16px;
  padding: 0 4px;
  border-radius: 3px;
  background: var(--slot-caption-bg);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  line-height: 1.4;
  z-index: 6;
  pointer-events: none;
}

.slot-view__caption {
  position: relative;
  flex: 0 0 auto;
  padding: 2px 3px;
  background: var(--slot-caption-bg);
  color: var(--text-primary);
  font-size: var(--text-xs);
  line-height: 1.15;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  z-index: 6;
  pointer-events: none;
}

.slot-view__caption [data-name-tone='tien'],
.slot-view__caption [data-name-tone='thien_dia_trong_khi'] {
  color: transparent !important;
  background: var(--rank-gradient-9);
  background-clip: text;
  -webkit-background-clip: text;
  font-weight: 700;
}

/* ============================================================
   8. LOCKED / DISABLED / PROCESSING VEIL
   ============================================================ */

.slot-view__veil {
  position: absolute;
  inset: 0;
  z-index: 9;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.slot-view--veil-locked .slot-view__veil,
.slot-view--veil-disabled .slot-view__veil {
  background: var(--slot-caption-bg);
}

.slot-view--veil-locked,
.slot-view--veil-disabled {
  cursor: not-allowed;
}

.slot-view--veil-locked .slot-view__icon-wrap,
.slot-view--veil-disabled .slot-view__icon-wrap {
  opacity: var(--slot-disabled-opacity);
}

.slot-view__veil-glyph {
  font-size: var(--text-lg);
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
}

.slot-view--veil-processing .slot-view__veil {
  background: color-mix(in srgb, var(--ink-950) 35%, transparent);
}

.slot-view__spinner {
  width: 40%;
  aspect-ratio: 1;
  border-radius: 50%;
  border: 2px solid var(--ink-line);
  border-top-color: var(--chrome-300);
  animation: slot-spin 0.8s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .slot-view__spinner {
    animation: none;
    border-top-color: var(--ink-line);
    opacity: 0.7;
  }
}

@keyframes slot-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
