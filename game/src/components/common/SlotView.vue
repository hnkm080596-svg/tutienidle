<script setup lang="ts" generic="T">
import { computed, ref, watch } from 'vue'
import { formatNumber } from '@/core/format/NumberFormatter'
import { PROFESSION_GRADE_SEAL_ORDINALS } from '@/core/profession/ProfessionGrade'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
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
// Equipment-cell art history: flat tile -> frame-s-slot chrome (2026-10-04)
// -> item-slot-v1.png per the Codex preview (owner ruling 2026-10-08,
// variant ownership moved bag -> equipment 2026-10-08: the Trang Bi
// scope IS 'equipment'; 'bag' is reserved for Tru Vat grids).
// The art is painted via --slot-bg-image under :is(#app) so it wins the
// global slot-frame.png rule.
const props = defineProps<{
  /** Item ma Slot dang chua. null = slot trong - filled/empty suy truc
   * tiep tu day, KHONG co prop `hasItem` rieng. */
  item: T | null

  /** PNG icon trong suot cua item - khong co/loi tai thi roi ve
   * monogram CSS (chu cai dau `label`). */
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

  /** Tran (max) cua thang `rarityRank` - mac dinh 5 (itemQualityRank,
   * Hoang->Tien) cho MOI caller equipment hien co. Material chi co 1 truc
   * rank (professionRankOf, 1-10) nen khi feed rank do vao `rarityRank`
   * phai truyen kem `rarityRankScale: 10`, neu khong rank=5 (Ngu Pham,
   * giua thang) se bi hieu nham la kich tran (Fix 1, final review
   * item-grade-quality-rework - MaterialBagSection.vue tung feed rank
   * 1-10 vao prop 1-5 nay). */
  rarityRankScale?: 5 | 10

  state?: SlotPresentationState

  badges?: readonly SlotBadge[]

  tooltip?: TooltipContent

  /** Ten truy cap - mac dinh dung `label` neu khong truyen rieng. */
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

  /** Cuong hoa aura (owner ruling 2026-10-08): slot-level enhance 0-100,
   * 10 cap moi canh gioi. Mau = --rank-color-{canh} (ceil(level/10));
   * x1 = vien tinh (khong pulse); x2-4 band 1 mong, x5-7 band 2 dam,
   * x8-10 band 3 ruc. Drop-shadow filter bam theo hinh PNG icon (khong
   * sang ca o). Chi truyen khi o nay dang chua do MAC (socket doll);
   * o tui khong truyen -> khong aura. 0/undefined = khong aura. */
  enhanceLevel?: number
}>()

const emit = defineEmits<{
  click: []
}>()

// 'circle' variant (owner ruling 2026-10-08 - merge-instead-of-swap):
// the reskinned paperdoll sockets per the Codex home-equipment
// preview. The ring art below IS the socket chrome; the preview shows
// no seal/badge/hover-frame/square chrome on it, so `isCircle` turns
// those render layers off. Data props (nameSegments, ranks, badges,
// tooltip, aria) stay fully wired - only the painting is suppressed.
const isCircle = computed(() => props.variant === 'circle')
const CIRCLE_FRAME_SRC = resolveAssetUrl(
  '/assets/ui/tien-hiep-2026-10/controls/equipment-circle-frame-v1.png',
)

const filled = computed(() => props.item !== null)

function monogram(label?: string): string {
  return label?.trim().charAt(0).toUpperCase() ?? ''
}

// Icon loi tai (404/hong) - an han <img>, de monogram fallback hien
// qua. Reset lai moi khi doi sang icon khac (doi item trong cung o).
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
// Tran itemQualityRank = 5 (Tien Chat) - KHONG con 9 (model cu rai
// 1-3-5-7-9 da bo, xem normalizeSlotRank.ts). rarityRankScale cho phep
// caller feed 1 thang rank KHAC (vd Material professionRankOf 1-10) vao
// cung prop `rarityRank` ma van so dung tran cua thang do - mac dinh 5
// giu nguyen hanh vi moi caller equipment hien co (Fix 1, final review).
const isMaxRarityRank = computed(() => clampRank(props.rarityRank) === (props.rarityRankScale ?? 5))

// Enhance aura (owner ruling 2026-10-08): equipped-slot only. Color =
// the realm's --rank-color-{ceil(level/10)}; the step inside the realm
// picks the treatment - x1 = static colored rim (no pulse, the realm's
// own 'khong glow' level that still announces the new color), x2-4
// band 1 thin, x5-7 band 2 dense, x8-10 band 3 bright.
const enhanceAura = computed(() => {
  const level = props.enhanceLevel ?? 0
  if (level <= 0) return undefined
  const realm = Math.min(10, Math.ceil(level / 10))
  const step = ((level - 1) % 10) + 1 // 1..10 within the realm
  const band = step === 1 ? 0 : step <= 4 ? 1 : step <= 7 ? 2 : 3
  return { realm, band }
})
const enhanceAuraClass = computed(() => (enhanceAura.value ? `slot-view--enhance-${enhanceAura.value.band}` : ''))
const enhanceAuraColor = computed(() => (enhanceAura.value ? `var(--rank-color-${enhanceAura.value.realm})` : undefined))

// Pham cell recolor (owner ruling 2026-10-08): the art-frame cells
// (equipment/bag/socket variants) recolor to the item's Pham rank on
// the shared --rank-color-{1..10} ramp. Empty cells take rank 1 - the
// basic gray ("mau thap nhat neu khong co do"). Rendered by the
// .slot-view__quality-tint layer masked to the art itself.
const ART_FRAME_VARIANTS = new Set(['equipment', 'bag', 'socket'])
// 'gương' = the 6 worn equipment sockets only (owner ruling
// 2026-10-08): the ~100 bag cells render variant='equipment' (bag
// grid shares the art) but get NO sheen - the rule is the WORN slot,
// not the art.
const MIRROR_GLINT_VARIANTS = new Set(['socket'])
const qualityTintColor = computed(() => {
  if (!ART_FRAME_VARIANTS.has(props.variant ?? 'item')) return undefined
  const rank = sealRank.value ?? 1
  // Rank 10 (Tien Pham) paints the seven-colour gradient per theme.css
  // spec; --rank-color-10 is only the flat fallback for non-gradient
  // consumers.
  if (rank >= 10) return 'var(--rank-gradient-10)'
  // Rank 1 (Cuu Pham, basic): steel gray, scoped to this tint only -
  // --rank-color-1 is shared by --grade-hoang / --affix-tier-1 /
  // talent-tier-pham so the token itself must not change (owner ruling
  // 2026-10-08: 'đổi đi cho rõ màu').
  if (rank <= 1) return '#7f8792'
  return `var(--rank-color-${rank})`
})

// Chat meteors (owner ruling 2026-10-08): the approved demo cell is
// the groove 'sao băng' - twin bright streaks running the art's inner
// groove. Chat 1 (Hoang, lowest) gets NO streak at all - the effect
// starts at Huyen (rank 2); tiers differ by COLOR only
// (--slot-rarity-color already maps rank -> --grade-* ramp positions).
// rarityRankScale=10 callers (materials) are not equipment Chat - off.
const chatMeteorTier = computed(() => {
  if (!ART_FRAME_VARIANTS.has(props.variant ?? 'item')) return 0
  const rank = clampRank(props.rarityRank)
  if (!filled.value || (props.rarityRankScale ?? 5) !== 5 || !rank || rank < 2) return 0
  return Math.min(rank, 5)
})

// Mirror glint (owner ruling 2026-10-08): 'gương' = the white sheen
// pass - the occupied marker on the worn sockets only; bag cells share
// the art but skip it. Empty cells get no sheen either way.
const showMirrorGlint = computed(
  () => filled.value && MIRROR_GLINT_VARIANTS.has(props.variant ?? 'item'),
)

// ============================================================
// PRECEDENCE (muc 17.2) - locked chan interaction+validation; disabled
// chan click nhung KHONG chan validation; processing chan click,
// giu nguyen Quality/Rarity; selected khong che validation.
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

// aria-disabled + click-guard THAY vi `disabled` that - locked/disabled
// van phai giu duoc focus/hover de tooltip giai thich dieu kien (muc
// 17.4/17.5), native `disabled` se chan luon ca viec do.
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
      (qualityTintColor && (sealRank ?? 1) >= 10) ? 'slot-view--quality-max' : '',
      (qualityTintColor && (sealRank ?? 1) <= 1) ? 'slot-view--quality-low' : '',
      enhanceAuraClass,
      props.static ? 'slot-view--static' : '',
    ]"
    :style="{
      '--slot-rarity-color': rarityColor,
      '--enhance-aura-color': enhanceAuraColor,
      '--slot-quality-color': qualityTintColor,
    }"
    :role="props.static ? 'img' : undefined"
    :aria-disabled="props.static ? undefined : isBlocked ? 'true' : undefined"
    :aria-busy="props.static ? undefined : showProcessing ? 'true' : undefined"
    :aria-label="accessibleLabel ?? label"
    v-tooltip="props.static ? undefined : tooltipContent"
    @click="handleClick"
  >
    <!-- layer 1.4 (art-frame variants only): Pham recolor - masked to
         the cell art, blend 'color' keeps the texture and rehues the
         frame to the item's rank color. -->
    <span v-if="qualityTintColor" class="slot-view__quality-tint" aria-hidden="true"></span>

    <!-- layer 1.45: Chat meteors - twin streaks in the art's inner
         groove, colored by the Chat tier (--slot-rarity-color). -->
    <span v-if="chatMeteorTier > 0" class="slot-view__chat" aria-hidden="true"></span>

    <!-- layer 1.46: 'gương' white sheen pass - the occupied marker for
         the art-frame cells. -->
    <span v-if="showMirrorGlint" class="slot-view__glint" aria-hidden="true"></span>

    <!-- layer 1.5: Pham seal - carved seal-frame art + Han grade
         glyph (replaces the underlay wash). -->
    <span v-if="filled && sealOrdinal && !isCircle" class="slot-view__seal" aria-hidden="true">{{ sealOrdinal }}</span>

    <!-- layer 1.8 (variant 'circle' only): the ring art IS the socket
         chrome - one <img> like the preview's EquipmentArtSlot, hover
         brightens it via the filter rule below. -->
    <img
      v-if="isCircle"
      class="slot-view__ring-art"
      :src="CIRCLE_FRAME_SRC"
      alt=""
      aria-hidden="true"
    />

    <!-- layer 2: icon / monogram fallback -->
    <span class="slot-view__icon-wrap">
      <img v-if="showIcon" class="slot-view__item-icon" :src="icon" :alt="label || ''" @error="onIconError" />
      <span v-else-if="filled" class="slot-view__monogram" aria-hidden="true">{{ monogram(label) }}</span>
    </span>

    <!-- layer 4: validation glyph (mau KHONG phai tin hieu duy nhat) -->
    <span v-if="validation !== 'neutral' && !isCircle" class="slot-view__validation-glyph" aria-hidden="true">{{ validationGlyph }}</span>

    <!-- layer 6: marker + comparison + custom badges (off for
         'circle' - preview paints none; data still feeds tooltip/aria) -->
    <template v-if="!isCircle">
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
    </template>

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
    <span v-if="!isCircle" class="slot-view__hover-frame" aria-hidden="true" />

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
  /* Huyen Kim rebind of the --slot-* semantic channel (theme.css still
     declares the paper-era defaults for any out-of-scope reader; the
     component owns its own values now). --slot-rarity-color stays the
     caller-driven rank channel. */
  --slot-border: var(--hk-border-muted);
  --slot-border-filled: var(--hk-border-active);
  --slot-hover: var(--hk-gold);
  --slot-selected: var(--hk-gold-bright);
  --slot-valid: var(--hk-jade);
  --slot-invalid: var(--hk-cinnabar);
  --slot-shadow: 0 2px 10px var(--hk-shadow-low);
  --slot-caption-bg: color-mix(in srgb, var(--hk-surface-base) 55%, transparent);
  --slot-caption-bg-strong: color-mix(in srgb, var(--hk-surface-base) 82%, transparent);

  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-end;
  width: 100%;
  aspect-ratio: 1;
  padding: 0;
  border: 1px solid var(--slot-border);
  border-radius: var(--hk-radius-sm);
  /* Inventory backdrop ("archive base" plain dark tile) - default for
     every item slot. Flat --hk-surface-base fallback (NOT the :root-resolved
     --slot-surface gradient, which bakes cream paper vars and shows
     through the translucent arts as a light-gray fill). Square art on
     a square slot -> cover never distorts. Per-place art lives behind
     the `variant` prop (SlotTypes.ts), not consumer CSS overrides. */
  background:
    var(--slot-bg-image, url('/assets/ui/Slot/inv-slot-backdrop.png')) center / var(--slot-bg-fit, cover) no-repeat,
    var(--hk-surface-base);
  color: var(--hk-text-primary);
  font-family: var(--hk-font-ui);
  font-size: var(--text-sm);
  cursor: pointer;
  overflow: hidden;
  isolation: isolate;
  /* container-type so the seal + crowding rule scale with the CELL edge
     (cqw), not the viewport. inline-size only - height stays free for
     aspect-ratio. */
  container-type: inline-size;
  transition: border-color var(--hk-motion-micro) var(--hk-ease-standard), box-shadow var(--hk-motion-micro) var(--hk-ease-standard), background-color var(--hk-motion-micro) var(--hk-ease-standard);
}

.slot-view--filled {
  background:
    var(--slot-bg-image, url('/assets/ui/Slot/inv-slot-backdrop.png')) center / var(--slot-bg-fit, cover) no-repeat,
    var(--hk-surface-raised);
  border-color: var(--slot-rarity-color, var(--hk-border-muted));
  box-shadow: var(--slot-shadow), 0 0 8px var(--slot-rarity-color, transparent);
}

.slot-view--filled.slot-view--max-rank {
  box-shadow: var(--slot-shadow), 0 0 12px var(--slot-rarity-color, var(--rank-color-5));
}

/* Bac cao nhat (rarityRank = 5, Tien Chat) - gradient bay mau o vien
   TREN (muc 17.4 "solid fallback + gradient"), border-color solid o
   tren van la fallback chinh. */
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
  background: var(--hk-surface-raised);
  color: var(--slot-rarity-color, var(--hk-text-secondary));
  font-family: var(--hk-font-display);
  font-weight: 600;
  font-size: var(--text-title);
}

/* ============================================================
   4. VALIDATION OVERLAY - ring + glyph, KHONG chi dua vao mau.
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
  color: var(--hk-surface-base);
}

.slot-view--validation-invalid .slot-view__validation-glyph,
.slot-view--validation-missing .slot-view__validation-glyph {
  background: var(--slot-invalid);
  color: var(--hk-text-primary);
}

/* ============================================================
   5. HOVER / FOCUS / SELECTED - selected thang hover nhung khong
   che validation (ring validation o tren la box-shadow rieng, ring
   selected ben duoi la outline rieng - 2 kenh khac nhau, khong de).
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
  transition: opacity var(--hk-motion-micro) var(--hk-ease-standard);
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
/* All variants share the pale-gold hover frame: the old "cell select"
   wisp (a 1024x93 strip) squashed into square cells read as a smudge
   inside empty slots - the clean pale-gold frame is the square-cell
   hover art everywhere now. */
.slot-view--item,
.slot-view--equipment,
.slot-view--bag,
.slot-view--bag.slot-view--filled,
.slot-view--socket,
.slot-view--socket.slot-view--filled {
  --slot-hover-image: url('/assets/ui/Slot/slot-frame-hover.png');
  --slot-hover-inset: -4%;
}

/* 'equipment' variant (owner ruling 2026-10-08): the Trang Bi scope's
   cell art is the preview's item-slot-v1.png - one image owns backdrop
   + frame edge, painted via --slot-bg-image under :is(#app) to beat the
   global slot-frame.png rule (tien-hiep-ui.css:56-58). The flat CSS
   border steps aside; rarity still reads through the ::after glow, the
   box-shadow aura, the max-rank bar, and the shared pale-gold hover
   frame. ('bag' keeps the same art for the future Tru Vat grids.) */
:is(#app) .slot-view--equipment,
.slot-view--equipment,
.slot-view--equipment.slot-view--filled,
:is(#app) .slot-view--bag,
.slot-view--bag,
.slot-view--bag.slot-view--filled {
  --slot-bg-image: url('/assets/ui/tien-hiep-2026-10/controls/item-slot-v2.png');
  --slot-ornament-mask: url('/assets/ui/tien-hiep-2026-10/controls/item-slot-v2-ornament-mask.png');
  border-color: transparent;
  /* The v2 art bakes transparent chamfer corners - a solid fill under it
     shows as a dark rim. The art carries its own dark centre. */
  background-color: transparent;
}
:is(#app) .slot-view--equipment,
.slot-view--equipment,
.slot-view--equipment.slot-view--filled,
:is(#app) .slot-view--bag,
.slot-view--bag,
.slot-view--bag.slot-view--filled {
  /* Owner ruling 2026-10-08: only the art renders around the cell - the
     filled-state shadow and the square rarity tint both draw outside the
     chamfered edge, so they are suppressed. Chat still reads via the
     seal, the max-rank bar and the tooltip. */
  box-shadow: none;
}
:is(#app) .slot-view--equipment::after,
.slot-view--equipment::after,
:is(#app) .slot-view--bag::after,
.slot-view--bag::after,
:is(#app) .slot-view--socket::after,
.slot-view--socket::after {
  display: none;
}

/* 'socket' variant (owner ruling 2026-10-08): the 6 worn sockets on the
   paperdoll use equipment-socket-v2.png - chamfered square with ornate
   cloud corners. Seal stamp is suppressed: it would sit on the art's
   top-left cloud flourish. Hover-frame + enhance badge still render. */
:is(#app) .slot-view--socket,
.slot-view--socket,
.slot-view--socket.slot-view--filled {
  --slot-bg-image: url('/assets/ui/tien-hiep-2026-10/controls/equipment-socket-v2.png');
  --slot-ornament-mask: url('/assets/ui/tien-hiep-2026-10/controls/equipment-socket-v2-ornament-mask.png');
  border-color: transparent;
  background-color: transparent;
}
.slot-view--socket,
.slot-view--socket.slot-view--filled {
  /* The filled-state shadow is a square spread - it draws a light square
     rim outside the chamfered art. */
  box-shadow: none;
}
.slot-view--socket .slot-view__seal {
  display: none;
}
/* The art's cloud flourishes reach ~30% inward at both ornate corners;
   keep the icon inside the plain dark centre. */
.slot-view--socket .slot-view__item-icon {
  width: 72%;
  height: 72%;
}

/* Pham recolor (owner ruling 2026-10-08, "Phuong an D"): mask PNG
   extracted from the art's ornament pixels by scripts/gen_ornament_mask.py
   keeps only the golden filigree, so the tint lands on exactly those
   pixels - dark centre, icon, transparent rim untouched. Three layers:
   color blend (true hue) + overlay blend with drop-shadow (brightness)
   + animated white sweep. Rank 10 additionally hue-rotates its gradient
   ("cau vong dong"). Empty cells run at rank 1 (basic gray). Sits under
   the icon/seal. */
.slot-view__quality-tint,
.slot-view__quality-tint::before,
.slot-view__quality-tint::after {
  position: absolute;
  inset: 0;
  pointer-events: none;
  -webkit-mask-image: var(--slot-ornament-mask, none);
  mask-image: var(--slot-ornament-mask, none);
  -webkit-mask-size: var(--slot-bg-fit, cover);
  mask-size: var(--slot-bg-fit, cover);
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}
.slot-view__quality-tint {
  background: var(--slot-quality-color, transparent);
  mix-blend-mode: color;
  opacity: 0.9;
}
.slot-view__quality-tint::before {
  content: '';
  background: var(--slot-quality-color, transparent);
  mix-blend-mode: overlay;
  opacity: 0.85;
  filter: drop-shadow(0 0 1.5px var(--slot-quality-color)) saturate(1.35) brightness(1.25);
}
/* Rank 1 (Cuu Pham): the base 'color' blend keeps the gold art's
   luminance, so a plain gray still reads as faded gold. Swap the
   overlay layer to multiply - it pulls the ornament's brightness down
   toward the steel tone so basic cells read clearly gray. */
.slot-view--quality-low .slot-view__quality-tint::before {
  mix-blend-mode: multiply;
  filter: saturate(0.6);
}
.slot-view__quality-tint::after {
  content: '';
  background: linear-gradient(105deg,
    transparent 38%, rgba(255, 255, 255, 0.05) 44%,
    rgba(255, 255, 255, 0.95) 50%, rgba(255, 255, 255, 0.05) 56%, transparent 62%) no-repeat;
  background-size: 300% 100%;
  mix-blend-mode: screen;
  opacity: 0.9;
  animation: slot-ornament-sweep 5s ease-in-out infinite;
}
@keyframes slot-ornament-sweep {
  0% { background-position: 130% 0; }
  100% { background-position: -130% 0; }
}
/* Rank 10 (Tien Pham): the seven-colour gradient itself flows - hue-rotate
   cycles it continuously ("cau vong dong"), plus a rainbow sweep streak. */
.slot-view--quality-max .slot-view__quality-tint {
  animation: slot-quality-hue-flow-flat 3s linear infinite;
}
.slot-view--quality-max .slot-view__quality-tint::before {
  animation: slot-quality-hue-flow 3s linear infinite;
}
.slot-view--quality-max .slot-view__quality-tint::after {
  background-image: linear-gradient(105deg,
    transparent 40%, rgba(255, 107, 107, 0.85) 46%, rgba(255, 214, 107, 0.9) 49%,
    rgba(103, 216, 255, 0.9) 52%, rgba(158, 140, 255, 0.85) 55%, transparent 61%);
  animation: slot-ornament-sweep 3s ease-in-out infinite, slot-quality-hue-flow 3s linear infinite;
}
@keyframes slot-quality-hue-flow {
  to { filter: hue-rotate(360deg) drop-shadow(0 0 2px #ffd66b) saturate(1.3) brightness(1.3); }
}
@keyframes slot-quality-hue-flow-flat {
  to { filter: hue-rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .slot-view__quality-tint::after,
  .slot-view--quality-max .slot-view__quality-tint,
  .slot-view--quality-max .slot-view__quality-tint::before,
  .slot-view--quality-max .slot-view__quality-tint::after {
    animation: none;
  }
}

/* Chat meteors (owner ruling 2026-10-08): twin 'sao băng' streaks
   chasing each other through the art's inner groove - the groove band
   was pixel-measured on item-slot-v2.png (dark channel ~3.4%-5% of the
   cell, between the bright outer frame and the inner filigree), so the
   evenodd octagon below clips to exactly that ring. All 5 Chat tiers
   render it; tiers differ by COLOR only (--slot-rarity-color). */
@property --slot-meteor {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}
.slot-view__chat {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  background: conic-gradient(from var(--slot-meteor),
    color-mix(in srgb, var(--slot-rarity-color, transparent) 0%, transparent) 0deg,
    color-mix(in srgb, var(--slot-rarity-color, transparent) 0%, transparent) 30deg,
    color-mix(in srgb, var(--slot-rarity-color, transparent) 40%, transparent) 80deg,
    color-mix(in srgb, var(--slot-rarity-color, transparent) 70%, transparent) 120deg,
    color-mix(in srgb, var(--slot-rarity-color, transparent) 90%, transparent) 160deg,
    #fff8dc 172deg,
    color-mix(in srgb, var(--slot-rarity-color, transparent) 0%, transparent) 185deg,
    color-mix(in srgb, var(--slot-rarity-color, transparent) 0%, transparent) 210deg,
    color-mix(in srgb, var(--slot-rarity-color, transparent) 40%, transparent) 260deg,
    color-mix(in srgb, var(--slot-rarity-color, transparent) 70%, transparent) 300deg,
    color-mix(in srgb, var(--slot-rarity-color, transparent) 90%, transparent) 340deg,
    #fff8dc 352deg,
    color-mix(in srgb, var(--slot-rarity-color, transparent) 0%, transparent) 360deg);
  clip-path: polygon(evenodd,
    10.4% 3.4%, 89.6% 3.4%, 96.6% 10.4%, 96.6% 89.6%, 89.6% 96.6%, 10.4% 96.6%, 3.4% 89.6%, 3.4% 10.4%,
    11.1% 5%, 88.9% 5%, 95% 11.1%, 95% 88.9%, 88.9% 95%, 11.1% 95%, 5% 88.9%, 5% 11.1%);
  filter: drop-shadow(0 0 3px color-mix(in srgb, var(--slot-rarity-color, transparent) 85%, transparent));
  animation: slot-meteor-run 1.8s linear infinite;
}
@keyframes slot-meteor-run {
  to { --slot-meteor: 360deg; }
}
/* equipment-socket-v2.png has a WIDER groove than item-slot-v2
   (~4.2%-7.8% measured the same way) - its own ring so the meteors
   run in the groove instead of overlapping the bright frame. */
.slot-view--socket .slot-view__chat {
  clip-path: polygon(evenodd,
    10.8% 4.3%, 89.2% 4.3%, 95.7% 10.8%, 95.7% 89.2%, 89.2% 95.7%, 10.8% 95.7%, 4.3% 89.2%, 4.3% 10.8%,
    12.2% 7.7%, 87.8% 7.7%, 92.3% 12.2%, 92.3% 87.8%, 87.8% 92.3%, 12.2% 92.3%, 7.7% 87.8%, 7.7% 12.2%);
}

/* 'gương' (owner ruling 2026-10-08): one soft white sheen pass - the
   occupied-state channel for the art-frame cells. Pure white, no tint;
   clip follows the octagon silhouette. */
.slot-view__glint {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  opacity: 0.6;
  clip-path: polygon(9% 0, 91% 0, 100% 9%, 100% 91%, 91% 100%, 9% 100%, 0 91%, 0 9%);
  background: linear-gradient(105deg, transparent 42%, rgba(255, 255, 255, 0.55) 50%, transparent 58%);
  background-size: 300% 300%;
  background-repeat: no-repeat;
  mix-blend-mode: screen;
  animation: slot-glint-pass 5s ease-in-out infinite;
}
/* One flash per 5s cycle (owner ruling): the band crosses in the first
   ~25% then parks off-cell for the rest. */
@keyframes slot-glint-pass {
  0% { background-position: 130% 130%; }
  25%, 100% { background-position: -30% -30%; }
}
@media (prefers-reduced-motion: reduce) {
  .slot-view__chat,
  .slot-view__glint {
    animation: none;
  }
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
  /* Ma Shan Zheng / Noto Serif SC are loaded webfonts that cover the Han
     seal numerals - the local Kai stacks below only render where a KaiTi
     font is installed, otherwise the ordinals render as tofu boxes. */
  font-family: 'Ma Shan Zheng', 'Kaiti SC', 'KaiTi', 'STKaiti', 'TW-Kai', 'DFKai-SB',
    'AR PL KaitiM GB', 'Noto Serif CJK SC', 'Noto Serif SC', var(--font-display);
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
  background: var(--hk-cinnabar);
  color: var(--hk-text-primary);
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
  border-radius: var(--hk-radius-sm);
  background: var(--slot-caption-bg-strong);
  color: var(--hk-text-primary);
  font-size: var(--text-xs);
  font-weight: 700;
  line-height: 1.4;
  pointer-events: none;
  white-space: nowrap;
}

.slot-view__badge--enhance {
  bottom: 34px;
  right: 3px;
  background: linear-gradient(180deg, var(--hk-gold-bright), var(--hk-gold));
  color: var(--hk-surface-base);
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
  border-radius: var(--hk-radius-sm);
  background: var(--slot-caption-bg);
  color: var(--hk-text-secondary);
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
  color: var(--hk-text-primary);
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
  background: color-mix(in srgb, var(--hk-surface-base) 35%, transparent);
}

.slot-view__spinner {
  width: 40%;
  aspect-ratio: 1;
  border-radius: 50%;
  border: 2px solid var(--hk-border-muted);
  border-top-color: var(--hk-gold);
  animation: slot-spin 0.8s linear infinite;
}

/* ============================================================
   9. VARIANT 'circle' - reskinned paperdoll socket (owner ruling
   2026-10-08: merge the preview art INTO SlotView instead of
   swapping the component out). The ring <img> is the chrome; every
   square-slot ornament is unmounted (template) or unpainted here.
   ============================================================ */

/* Chrome reset. tien-hiep-ui.css paints slot-frame.png on every
   .slot-view via `:is(#app, body)` - ID specificity (1,0,1). The
   :is(#app) selector beats it (1,2,0); the plain selectors keep the
   reset working outside #app (tests, detached mounts), and the
   2-class ones win the filled/max-rank box-shadows. */
:is(#app) .slot-view--circle,
.slot-view--circle,
.slot-view--circle.slot-view--filled,
.slot-view--circle.slot-view--filled.slot-view--max-rank {
  --slot-bg-image: none;
  background: none;
  border: 0;
  /* Round hit area: the ring art is a circle, so the click region
     follows the ellipse instead of the full cell rect (owner ruling
     2026-10-08). */
  border-radius: 50%;
  box-shadow: none;
  /* Circle units are not square (paperdoll cell 88x80) - the base
     aspect-ratio:1 must not squeeze the element. */
  aspect-ratio: auto;
}

/* Rank tint + max-rank bar paint via pseudos - preview shows none. */
.slot-view--circle::before,
.slot-view--circle::after,
.slot-view--circle.slot-view--filled::before,
.slot-view--circle.slot-view--filled::after {
  content: none;
}

/* The ring art - object-fit contain inside whatever rect the parent
   gives the slot (paperdoll unit 88x80). */
.slot-view__ring-art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  z-index: 1;
}

/* Hover = brighten the ring itself (preview spec), not a square
   hover-frame layer. */
.slot-view--circle:hover:not([aria-disabled='true']) .slot-view__ring-art {
  filter: brightness(1.65) drop-shadow(0 0 3px #ffd785) drop-shadow(0 0 7px #e9a935aa);
}

/* Icon sits in the ring's inset zone (preview: inset 20% -> the icon
   covers 60%x60% of the unit). */
.slot-view--circle .slot-view__icon-wrap {
  inset: 20%;
}
.slot-view--circle .slot-view__item-icon {
  width: 100%;
  height: 100%;
}

/* Enhance aura (owner ruling 2026-10-08) - drop-shadow bam theo hinh
   PNG icon (khong sang ca o). Mau = --enhance-aura-color (realm var
   --rank-color-N inject tu script). x1 = vien tinh khong pulse; x2+
   = 3 band pulse tang dan. Chi hien khi caller truyen enhanceLevel
   (socket doll do dang mac) - o tui khong co. */
.slot-view--enhance-0 .slot-view__item-icon {
  filter: drop-shadow(0 0 3px var(--enhance-aura-color));
}
.slot-view--enhance-1 .slot-view__item-icon {
  animation: slot-enhance-glow-1 3s ease-in-out infinite;
}
.slot-view--enhance-2 .slot-view__item-icon {
  animation: slot-enhance-glow-2 2s ease-in-out infinite;
}
.slot-view--enhance-3 .slot-view__item-icon {
  animation: slot-enhance-glow-3 1.2s ease-in-out infinite;
}
@keyframes slot-enhance-glow-1 {
  0%, 100% { filter: drop-shadow(0 0 2.5px var(--enhance-aura-color)) drop-shadow(0 0 5px color-mix(in srgb, var(--enhance-aura-color) 60%, transparent)); }
  50% { filter: drop-shadow(0 0 4px var(--enhance-aura-color)) drop-shadow(0 0 8px color-mix(in srgb, var(--enhance-aura-color) 70%, transparent)); }
}
@keyframes slot-enhance-glow-2 {
  0%, 100% { filter: drop-shadow(0 0 3px var(--enhance-aura-color)) drop-shadow(0 0 8px color-mix(in srgb, var(--enhance-aura-color) 75%, transparent)) drop-shadow(0 0 14px color-mix(in srgb, var(--enhance-aura-color) 40%, transparent)); }
  50% { filter: drop-shadow(0 0 5px var(--enhance-aura-color)) drop-shadow(0 0 12px color-mix(in srgb, var(--enhance-aura-color) 85%, transparent)) drop-shadow(0 0 20px color-mix(in srgb, var(--enhance-aura-color) 55%, transparent)); }
}
@keyframes slot-enhance-glow-3 {
  0%, 100% { filter: drop-shadow(0 0 4px var(--enhance-aura-color)) drop-shadow(0 0 10px var(--enhance-aura-color)) drop-shadow(0 0 18px color-mix(in srgb, var(--enhance-aura-color) 70%, transparent)); }
  50% { filter: drop-shadow(0 0 7px var(--enhance-aura-color)) drop-shadow(0 0 16px var(--enhance-aura-color)) drop-shadow(0 0 28px color-mix(in srgb, var(--enhance-aura-color) 85%, transparent)); }
}

@media (prefers-reduced-motion: reduce) {
  .slot-view,
  .slot-view__hover-frame {
    transition: none;
  }

  .slot-view__item-icon {
    animation: none;
  }

  .slot-view__spinner {
    animation: none;
    border-top-color: var(--hk-border-muted);
    opacity: 0.7;
  }
}

@keyframes slot-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
