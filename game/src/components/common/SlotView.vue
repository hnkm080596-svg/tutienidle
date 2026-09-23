<script setup lang="ts" generic="T">
import { computed, ref, watch } from 'vue'
import { formatNumber } from '@/core/format/NumberFormatter'
import { PROFESSION_GRADE_SEAL_ORDINALS } from '@/core/profession/ProfessionGrade'
import type { TooltipContent } from '@/composables/useTooltip'
import type { NameSegment } from '@/core/item/NameSegment'
import type { SlotBadge, SlotPresentationState, SlotVariant } from './SlotTypes'

// Slot presentation (tooltip-revamp-plan.md section 17 + user art pass
// 2026-09). Art layers: backdrop per variant (SlotTypes.ts SlotVariant
// - 'item' uses the flat dark tile inv-slot-backdrop.png, 'equipment'
// cells use the frosted-glass slot-backdrop.png), item `icon` prop on
// top, hover art per variant (per-variant inset), and the
// shared fx-border-beam repurposed as a persistent quality aura for
// equipment Chat Dia+. See SlotTypes.ts for the 5 semantic axes
// (availability/interaction/validation/marker/comparison) - NOT a list
// of loose booleans.
//
// InkNineSlice frame-s-slot REMOVED (2026-08-30) - the brush ink-wash
// repeated on EVERY slot (paperdoll + the whole Kho Vat grid, dozens of
// cells per screen) felt noisy/cluttered in a dense grid, far from the
// frame's original purpose (a decorative border for a LARGE panel, not
// a repeated per-cell ornament).
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

  /** Composed name segments - text structure only (item-info-card spec
   * 2026-09-14); the single display color lives on the tooltip payload.
   * Takes priority over the plain `label` when provided. */
  nameSegments?: NameSegment[]

  /** Normalized rank 1-10 (professionGradeRank, see
   * core/profession/slotRank.ts) - SlotView does NOT know domain ids
   * like 'cuu_pham'/'tien_pham'. The PHAM axis (realm grade) - renders
   * as a corner seal stamp carrying the Han grade glyph
   * (item-info-card spec 2026-09-14, replaces the underlay wash). */
  equipmentQualityRank?: number

  /** Normalized rank 1-5 (itemQualityRank, the 5 Chat tiers Hoang->Tien
   * mapped 1:1). The CHAT axis - decides the cell's frame/tint/aura,
   * colored via the --grade-* ramp (rank r -> --rank-color-(2r-1)) to
   * match the item name color. */
  rarityRank?: number

  /** Trần (max) của thang `rarityRank` — mặc định 5 (itemQualityRank,
   * Hoàng→Tiên) cho MỌI caller equipment hiện có. Material chỉ có 1 trục
   * rank (professionRankOf, 1-10) nên khi feed rank đó vào `rarityRank`
   * phải truyền kèm `rarityRankScale: 10`, nếu không rank=5 (Ngũ Phẩm,
   * giữa thang) sẽ bị hiểu nhầm là kịch trần (Fix 1, final review
   * item-grade-quality-rework — MaterialBagSection.vue từng feed rank
   * 1-10 vào prop 1-5 này). */
  rarityRankScale?: 5 | 10

  state?: SlotPresentationState

  badges?: readonly SlotBadge[]

  tooltip?: TooltipContent

  /** Tên truy cập — mặc định dùng `label` nếu không truyền riêng. */
  accessibleLabel?: string

  /** Show the name caption under the cell - OFF by default (2026-09-15
   * ruling: nametag removed from item/equipment cells, the name lives in
   * the tooltip). Places where the label is primary content (e.g.
   * combat skill names) opt in via this prop. */
  showLabel?: boolean

  /** Where the slot is used - decides the backdrop + hover art (see
   * SlotVariant in SlotTypes.ts). Default 'item' (dark tile + bright
   * hover frame). */
  variant?: SlotVariant

  /** Presentation-only render (tooltip card header): root becomes a
   * span role=img, tooltip/click/hover suppressed. */
  static?: boolean
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

// Rework P6 (Task 20) - 2 independent rank axes, each with its OWN
// ceiling: equipmentQualityRank (Pham seal) takes professionGradeRank
// 1-10 (Cuu Pham -> Tien Pham); rarityRank (main frame/glow) takes
// itemQualityRank 1-5 (Hoang -> Tien). clampRank only bounds values to
// the shared valid range (1-10) - SlotView does not know each axis's
// REAL ceiling, so "max" is computed per-prop below.
function clampRank(rank: number | undefined): number | undefined {
  if (rank === undefined) return undefined
  return Math.min(10, Math.max(1, Math.round(rank)))
}

// Chat color rides the shared ramp at the --grade-* positions
// (hoang/huyen/dia/thien/tien = rank 1/3/5/7/9) so the slot frame, tint
// and beam match the item-name prefix exactly. Scale-10 callers
// (materials) keep the direct 1:1 ramp position - their single axis IS
// the Pham rank.
const rarityColor = computed(() => {
  const rank = clampRank(props.rarityRank)
  if (!rank) return undefined
  return `var(--rank-color-${(props.rarityRankScale ?? 5) === 5 ? rank * 2 - 1 : rank})`
})

// Seal stamp (item-info-card spec 2026-09-14, seal art pass
// 2026-09-15): the Pham axis renders as a carved seal frame + Han
// grade glyph - replaces the underlay wash. Same rank source as
// before: equipmentQualityRank (equipment/pills), or rarityRank when
// fed on the 10-step scale (materials). Chat stays on the rarity
// edge + aura.
const sealRank = computed(() => {
  const gradeRank = clampRank(props.equipmentQualityRank)
  if (gradeRank) return gradeRank
  if ((props.rarityRankScale ?? 5) === 10) return clampRank(props.rarityRank)
  return undefined
})
const sealOrdinal = computed(() => (sealRank.value ? PROFESSION_GRADE_SEAL_ORDINALS[sealRank.value - 1] : undefined))
// Trần itemQualityRank = 5 (Tiên Chất) — KHÔNG còn 9 (model cũ rải
// 1-3-5-7-9 đã bỏ, xem normalizeSlotRank.ts). rarityRankScale cho phép
// caller feed 1 thang rank KHÁC (vd Material professionRankOf 1-10) vào
// cùng prop `rarityRank` mà vẫn so đúng trần của thang đó — mặc định 5
// giữ nguyên hành vi mọi caller equipment hiện có (Fix 1, final review).
const isMaxRarityRank = computed(() => clampRank(props.rarityRank) === (props.rarityRankScale ?? 5))

// Quality aura (user art pass 2026-09): the repurposed border-beam is no
// longer a hover effect - it is the persistent Chat indicator for
// equipment (itemQualityRank, 5-step scale). Only Dia (rank 3) and above
// show it, each tier tinted by its rank color. Materials feeding
// professionRankOf (rarityRankScale = 10) are NOT equipment Chat - no
// aura. Empty slots never show it either.
const qualityAuraTier = computed(() => {
  const rank = clampRank(props.rarityRank)
  if (!filled.value || (props.rarityRankScale ?? 5) !== 5 || rank === undefined || rank < 3) {
    return 0
  }
  // Clamp to the declared 5-step scale - a caller feeding an out-of-
  // contract rank must not fabricate unstyled fx-6..10 tiers.
  return Math.min(rank, 5)
})

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
  if (props.static) return
  if (isBlocked.value) return
  emit('click')
}

const tooltipContent = computed(() => props.tooltip ?? (props.label || props.description
  ? { title: props.label, description: props.description }
  : undefined))
</script>

<template>
  <component
    :is="props.static ? 'span' : 'button'"
    :type="props.static ? undefined : 'button'"
    class="slot-view"
    :class="[
      `slot-view--${props.variant ?? 'item'}`,
      filled ? 'slot-view--filled' : 'slot-view--empty',
      showSelected ? 'slot-view--selected' : '',
      veil !== 'none' ? `slot-view--veil-${veil}` : '',
      validation !== 'neutral' ? `slot-view--validation-${validation}` : '',
      isMaxRarityRank ? 'slot-view--max-rank' : '',
      qualityAuraTier > 0 ? `slot-view--quality-fx-${qualityAuraTier}` : '',
      qualityAuraTier >= 4 ? 'fx-border-beam fx-border-beam--active' : '',
      props.static ? 'slot-view--static' : '',
    ]"
    :style="{
      '--slot-rarity-color': rarityColor,
      '--fx-beam-color': qualityAuraTier > 0 ? rarityColor : undefined,
    }"
    :role="props.static ? 'img' : undefined"
    :aria-disabled="props.static ? undefined : isBlocked ? 'true' : undefined"
    :aria-busy="props.static ? undefined : showProcessing ? 'true' : undefined"
    :aria-label="accessibleLabel ?? label"
    v-tooltip="props.static ? undefined : tooltipContent"
    @click="handleClick"
  >
    <!-- layer 1.5: Pham seal - carved seal-frame art + Han grade
         glyph (replaces the underlay wash). -->
    <span v-if="filled && sealOrdinal" class="slot-view__seal" aria-hidden="true">{{ sealOrdinal }}</span>

    <!-- layer 2: icon / monogram fallback -->
    <span class="slot-view__icon-wrap">
      <img v-if="showIcon" class="slot-view__item-icon" :src="icon" :alt="label || ''" @error="onIconError" />
      <span v-else-if="filled" class="slot-view__monogram" aria-hidden="true">{{ monogram(label) }}</span>
    </span>

    <!-- layer 4: validation glyph (màu KHÔNG phải tín hiệu duy nhất) -->
    <span v-if="validation !== 'neutral'" class="slot-view__validation-glyph" aria-hidden="true">{{ validationGlyph }}</span>

    <!-- layer 6: marker + comparison + custom badges -->
    <span v-if="marker === 'equipped'" class="slot-view__marker slot-view__marker--equipped" aria-hidden="true">●</span>
    <span v-else-if="marker === 'new'" class="slot-view__marker slot-view__marker--new" aria-hidden="true">NEW</span>

    <span v-if="comparison !== 'neutral'" class="slot-view__comparison" :class="`slot-view__comparison--${comparison}`" aria-hidden="true">
      {{ comparison === 'upgrade' ? '▲' : '▼' }}
    </span>

    <span v-for="(badge, index) in badges" :key="index" class="slot-view__badge" :class="[`slot-view__badge--${badge.kind}`, badge.tone ? `slot-view__badge--${badge.tone}` : '']">
      {{ badge.text }}
    </span>

    <!-- layer 7: amount + opt-in caption (nametag off by default -
         user ruling: names live in the tooltip; combat skill slots
         opt back in via showLabel since the skill name is content) -->
    <span v-if="amount !== undefined" class="slot-view__amount">x{{ formatNumber(amount) }}</span>

    <template v-if="showLabel">
      <span v-if="nameSegments && nameSegments.length > 0" class="slot-view__caption">
        <template v-for="(segment, index) in nameSegments" :key="index">
          <span v-if="index > 0" class="slot-view__caption-dot"> · </span>
          <span>{{ segment.text }}</span>
        </template>
      </span>

      <span v-else-if="label" class="slot-view__caption">{{ label }}</span>
    </template>

    <!-- layer 7.2: hover art - variant-owned (item = white sheen,
         equipment (6 worn slots) = pale-gold select frame). Replaces the
         old border-color hover affordance. Always in the DOM; CSS
         drives visibility. -->
    <span class="slot-view__hover-frame" aria-hidden="true" />

    <!-- layer 7.5: border-beam fx - the slot-view ::before/::after are
         busy (max-rank bar + rarity tint) so the beam paints via its own
         layer; shared class in theme.css. No longer a hover effect -
         only lights up with fx-border-beam(--active) when
         qualityAuraTier >= 4. -->
    <span class="fx-border-beam__fx" aria-hidden="true" />

    <!-- layer 8: locked/disabled/processing veil -->
    <span v-if="veil !== 'none'" class="slot-view__veil" aria-hidden="true">
      <span v-if="veil === 'locked'" class="slot-view__veil-glyph">🔒</span>
      <span v-else-if="veil === 'disabled'" class="slot-view__veil-glyph">⊘</span>
      <span v-else class="slot-view__spinner" />
    </span>
  </component>
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
  /* Inventory backdrop ("archive base" plain dark tile) - default for
     every item slot. Flat --surface-900 fallback (NOT the :root-resolved
     --slot-surface gradient, which bakes cream paper vars and shows
     through the translucent arts as a light-gray fill). Square art on
     a square slot -> cover never distorts. Per-place art lives behind
     the `variant` prop (SlotTypes.ts), not consumer CSS overrides. */
  background:
    var(--slot-bg-image, url('/assets/ui/Slot/inv-slot-backdrop.png')) center / cover no-repeat,
    var(--sys-bg-0, var(--surface-900));
  color: var(--sys-text, var(--text-primary));
  font-family: var(--sys-font-body, var(--font-body));
  font-size: var(--text-sm);
  cursor: pointer;
  overflow: hidden;
  isolation: isolate;
  /* container-type so the seal + crowding rule scale with the CELL edge
     (cqw), not the viewport. inline-size only - height stays free for
     aspect-ratio. */
  container-type: inline-size;
  transition: border-color 35ms linear, box-shadow 35ms linear, background-color 35ms linear;
}

.slot-view--filled {
  background:
    var(--slot-bg-image, url('/assets/ui/Slot/inv-slot-backdrop.png')) center / cover no-repeat,
    var(--sys-bg-0, var(--surface-900));
  border-color: var(--slot-rarity-color, var(--sys-line, var(--ink-line)));
  box-shadow: var(--slot-shadow), 0 0 8px var(--slot-rarity-color, transparent);
}

.slot-view--filled.slot-view--max-rank {
  box-shadow: var(--slot-shadow), 0 0 12px var(--slot-rarity-color, var(--rank-color-5));
}

/* Bậc cao nhất (rarityRank = 5, Tiên Chất) — gradient bảy màu ở viền
   TRÊN (mục 17.4 "solid fallback + gradient"), border-color solid ở
   trên vẫn là fallback chính. */
.slot-view--filled.slot-view--max-rank::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 2px;
  z-index: 3;
  background: var(--rank-gradient-10);
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
  background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--slot-rarity-color, transparent) 22%, transparent), transparent 70%);
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
  background: var(--sys-bg-1, var(--ink-700));
  color: var(--slot-rarity-color, var(--sys-text-muted, var(--text-secondary)));
  font-family: var(--sys-font-display, var(--font-display));
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
  color: var(--sys-bg-0, var(--ink-950));
}

.slot-view--validation-invalid .slot-view__validation-glyph,
.slot-view--validation-missing .slot-view__validation-glyph {
  background: var(--slot-invalid);
  color: var(--sys-text, var(--text-primary));
}

/* ============================================================
   4.5 QUALITY AURA - itemQualityRank >= 3 (Dia+) carries a persistent
   edge signal; per user art direction each tier differs: Dia = static
   ring (cheapest - no per-frame repaint on the common tier), Thien =
   slow beam, Tien = fast bright beam. Color always --fx-beam-color
   (rank token). Materials (rarityRankScale=10) never reach this.
   ============================================================ */

.slot-view--quality-fx-3 {
  box-shadow:
    var(--slot-shadow),
    inset 0 0 0 1.5px var(--fx-beam-color),
    0 0 6px color-mix(in srgb, var(--fx-beam-color) 45%, transparent);
}

.slot-view--quality-fx-4 {
  --fx-beam-duration: 3.6s;
  --fx-beam-width: 2px;
}

.slot-view--quality-fx-5 {
  --fx-beam-duration: 1.5s;
  --fx-beam-width: 3px;
  filter: drop-shadow(0 0 4px var(--fx-beam-color));
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

/* Hover affordance = variant-owned art (item sheen / select frame) -
   no more border-color swap or hover beam. Focus-visible keeps the
   outline for keyboard users (frame shows too - same signal as hover). */
.slot-view__hover-frame {
  position: absolute;
  inset: var(--slot-hover-inset, 0%);
  z-index: 7;
  background: var(--slot-hover-image, url('/assets/ui/Slot/bag-slot-hover.png')) center / var(--slot-hover-fit, 100% 100%) no-repeat;
  opacity: 0;
  transition: opacity 0.15s ease;
  pointer-events: none;
}

.slot-view:hover:not([aria-disabled='true']) > .slot-view__hover-frame,
.slot-view:focus-visible > .slot-view__hover-frame {
  opacity: 1;
}

/* Variant art (SlotVariant registry - one owner for per-place slot
   modifications; user ruling 2026-09-15):
   - item (default, every bag slot + hall pickers): "archive base"
     plain dark tile as bg + "cell select" white sheen on hover.
   - equipment (the 6 worn slots): "empty" glass tile + "click"
     pale-gold frame on hover. The gold frame art bakes ~2-3%
     transparent padding into its edges, so the layer overshoots the
     cell by 4% to land its bright stroke on the slot border. */
.slot-view--item {
  --slot-hover-image: url('/assets/ui/Slot/bag-slot-hover.png');
}

.slot-view--equipment {
  --slot-bg-image: url('/assets/ui/Slot/slot-backdrop.png');
  --slot-hover-image: url('/assets/ui/Slot/slot-frame-hover.png');
  --slot-hover-inset: -4%;
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
   5.5 PHAM SEAL - carved seal stamp (seal-frame.png art, user art
   pass 2026-09-15) + Han grade glyph in seal-paste vermillion
   (item-info-card spec 2026-09-14, replaces the transparent underlay
   wash). Sized in cqw so it scales with the cell edge.
   ============================================================ */

.slot-view__seal {
  position: absolute;
  top: 3%;
  left: 3%;
  z-index: 5;
  box-sizing: border-box;
  width: 30cqw;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  background: url('/assets/ui/Slot/seal-frame.png') center / contain no-repeat;
  /* Seal-paste vermillion, lifted one step from the frame ink
     (#950100) so the thin strokes stay legible on the dark tile. */
  color: #d13a24;
  font-family: 'Kaiti SC', 'KaiTi', 'STKaiti', 'TW-Kai', 'DFKai-SB',
    'AR PL KaitiM GB', 'Noto Serif CJK SC', var(--sys-font-display, var(--font-display));
  font-weight: 700;
  font-size: 15cqw;
  line-height: 1;
  text-shadow: 0 0 1px rgba(0, 0, 0, 0.45);
  pointer-events: none;
}

/* Crowding rule (spec section 1): under ~48px cells the glance signals
   that duplicate the compare card pair disappear first. Seal + amount
   are the cell minimum - never hidden. */
@container (max-width: 47px) {
  .slot-view__comparison,
  .slot-view__marker {
    display: none;
  }
}

/* Static presentation mode (tooltip card header): non-interactive
   span render - no hover art, no beam fx, no icon lift. */
.slot-view--static {
  cursor: default;
}
.slot-view--static .slot-view__hover-frame,
.slot-view--static .fx-border-beam__fx {
  display: none;
}
.slot-view--static .slot-view__item-icon,
.slot-view--static .slot-view__monogram {
  transform: none;
}

/* ============================================================
   6. MARKER / COMPARISON / BADGES
   ============================================================ */

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
  background: var(--sys-danger, var(--crimson));
  color: var(--sys-text, var(--text-primary));
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
  color: var(--sys-text, var(--text-primary));
  font-size: var(--text-xs);
  font-weight: 700;
  line-height: 1.4;
  pointer-events: none;
  white-space: nowrap;
}

.slot-view__badge--enhance {
  bottom: 34px;
  right: 3px;
  background: linear-gradient(180deg, var(--sys-text, var(--chrome-100)), var(--sys-line, var(--chrome-500)));
  color: var(--sys-bg-0, var(--ink-950));
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
  color: var(--sys-text-muted, var(--text-secondary));
  font-size: var(--text-xs);
  line-height: 1.4;
  z-index: 6;
  pointer-events: none;
}

/* Nametag caption hidden by default (user ruling 2026-09-15) - slot
   names live in the tooltip; `label`/`nameSegments` props still feed
   tooltip + aria-label. `showLabel` opts back in for contexts where
   the name IS the slot content (combat skill bar). */
.slot-view__caption {
  position: relative;
  flex: 0 0 auto;
  padding: 2px 3px;
  background: var(--slot-caption-bg);
  color: var(--sys-text, var(--text-primary));
  font-size: var(--text-xs);
  line-height: 1.15;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  z-index: 6;
  pointer-events: none;
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
  background: color-mix(in srgb, var(--sys-bg-0, var(--ink-950)) 35%, transparent);
}

.slot-view__spinner {
  width: 40%;
  aspect-ratio: 1;
  border-radius: 50%;
  border: 2px solid var(--sys-line, var(--ink-line));
  border-top-color: var(--sys-text, var(--chrome-300));
  animation: slot-spin 0.8s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .slot-view__spinner {
    animation: none;
    border-top-color: var(--sys-line, var(--ink-line));
    opacity: 0.7;
  }
}

@keyframes slot-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
