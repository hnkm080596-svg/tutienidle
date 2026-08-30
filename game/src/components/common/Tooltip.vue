<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { autoUpdate, flip, offset, shift, size, useFloating } from '@floating-ui/vue'
import { useTooltip } from '@/composables/useTooltip'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import type { EquipmentTooltipContent, GradedItemTooltipContent, TechniqueTooltipContent } from '@/composables/useTooltip'
import { itemGradeRank, equipmentQualityRank, isMaxRankTone } from '@/composables/slots/normalizeSlotRank'
import type { EquipmentQuality } from '@/core/equipment/EquipmentQuality'
import type { ItemGrade } from '@/core/item/ItemGrade'

const { content, reference } = useTooltip()
const floating = ref<HTMLElement | null>(null)
const open = computed(() => content.value !== null)
const isInspectModifierHeld = ref(false)

function updateInspectModifier(event: KeyboardEvent) {
  isInspectModifierHeld.value = event.altKey
}

function clearInspectModifier() {
  isInspectModifierHeld.value = false
}

onMounted(() => {
  window.addEventListener('keydown', updateInspectModifier)
  window.addEventListener('keyup', updateInspectModifier)
  window.addEventListener('blur', clearInspectModifier)
})

onUnmounted(() => {
  window.removeEventListener('keydown', updateInspectModifier)
  window.removeEventListener('keyup', updateInspectModifier)
  window.removeEventListener('blur', clearInspectModifier)
})

const visibleSections = computed(() => {
  const value = richContent.value
  if (!value) return []
  if (value.kind === 'equipment' && isInspectModifierHeld.value) {
    return value.advancedSections ?? value.sections
  }
  return value.sections
})

// Cap density theo từng loại tooltip (mục 5 tooltip-revamp-plan.md) —
// khớp với .tooltip/--rich/--detailed ở CSS bên dưới. size() chỉ
// dùng để clamp khi availableWidth NHỎ HƠN cap này (an toàn viewport),
// không được ghi đè cap khi màn hình đủ rộng.
function maxWidthForKind(kind: string | undefined): number {
  if (kind === 'equipment') return 380
  if (kind && kind !== 'plain') return 320
  return 240
}

const { floatingStyles } = useFloating(reference, floating, {
  open,
  placement: 'right-start',
  strategy: 'fixed',
  whileElementsMounted: autoUpdate,
  middleware: [
    offset(10),
    flip({ fallbackPlacements: ['left-start', 'top-start', 'bottom-start'] }),
    shift({ padding: 12 }),
    size({
      padding: 12,
      apply({ availableWidth, availableHeight, elements }) {
        Object.assign(elements.floating.style, {
          maxWidth: `${Math.min(maxWidthForKind(content.value?.kind), availableWidth)}px`,
          maxHeight: `${availableHeight}px`,
        })
      },
    }),
  ],
})

const gradedContent = computed<GradedItemTooltipContent | null>(() => {
  const value = content.value
  return value && (value.kind === 'material' || value.kind === 'pill' || value.kind === 'talisman' || value.kind === 'formation') ? value : null
})

const richContent = computed<TechniqueTooltipContent | GradedItemTooltipContent | EquipmentTooltipContent | null>(() => {
  const value = content.value
  if (!value) return null

  switch (value.kind) {
    case 'technique':
    case 'material':
    case 'pill':
    case 'talisman':
    case 'formation':
    case 'equipment':
      return value
    default:
      return null
  }
})

// Quality/Pham → 1 màu accent qua thang --rank-color-1..9 dùng CHUNG với
// SlotView.vue (normalizeSlotRank.ts) — thay vì tự liệt kê lại từng ID
// quality/pham thành 1 rule CSS[data-quality=...]/[data-rarity=...] riêng
// (dễ sót khi thêm bậc mới, xem git history). --rarity-*/--grade-*
// trong theme.css vốn CHỈ LÀ alias của cùng thang --rank-color-N này.
const qualityAccentColor = computed(() => {
  if (content.value?.kind !== 'equipment') return undefined
  return `var(--rank-color-${equipmentQualityRank(content.value.qualityKey as EquipmentQuality)})`
})

const isMaxQualityRank = computed(() =>
  content.value?.kind === 'equipment' && equipmentQualityRank(content.value.qualityKey as EquipmentQuality) === 9,
)

const rarityAccentColor = computed(() => {
  const gradeKey = gradedContent.value?.gradeKey
  return gradeKey ? `var(--rank-color-${itemGradeRank(gradeKey as ItemGrade)})` : undefined
})

const isMaxPhamRank = computed(() => {
  const gradeKey = gradedContent.value?.gradeKey
  return gradeKey ? itemGradeRank(gradeKey as ItemGrade) === 9 : false
})

function hideBrokenImage(event: Event) {
  const image = event.currentTarget
  if (image instanceof HTMLImageElement) image.hidden = true
}
</script>

<template>
  <Teleport to="body">
    <Transition name="tooltip-fade">
      <div
        v-if="content"
        id="global-tooltip"
        ref="floating"
        role="tooltip"
        class="tooltip"
        :class="[content.kind ? `tooltip--${content.kind}` : 'tooltip--plain', content.kind === 'equipment' ? 'tooltip--detailed' : '', content.kind && content.kind !== 'plain' ? 'tooltip--rich' : '', isMaxQualityRank ? 'tooltip--max-quality-rank' : '']"
        :style="{ ...floatingStyles, '--tooltip-accent': qualityAccentColor, zIndex: OVERLAY_LAYERS.tooltip }"
      >
        <InkNineSlice asset-id="surface-m-paper" layer="surface" />
        <InkNineSlice asset-id="frame-m-seal-corner" layer="frame" />
        <div class="tooltip__content">
        <header v-if="content.kind === 'technique'" class="tooltip__header">
          <div class="tooltip__icon-shell">
            <span class="tooltip__icon-fallback">{{ content.name.charAt(0) }}</span>
            <img v-if="content.imagePath" class="tooltip__icon" :src="content.imagePath" :alt="content.name" @error="hideBrokenImage" />
          </div>
          <div class="tooltip__heading">
            <p class="tooltip__title">{{ content.name }}</p>
            <p class="tooltip__meta">{{ [content.levelLabel, content.elementLabel].filter(Boolean).join(' · ') }}</p>
          </div>
        </header>

        <header v-else-if="gradedContent" class="tooltip__header">
          <div class="tooltip__icon-shell">
            <span class="tooltip__icon-fallback">{{ gradedContent.name.charAt(0) }}</span>
            <img v-if="gradedContent.imagePath" class="tooltip__icon" :src="gradedContent.imagePath" :alt="gradedContent.name" @error="hideBrokenImage" />
          </div>
          <div class="tooltip__heading">
            <p class="tooltip__title">{{ gradedContent.name }}</p>
            <div class="tooltip__badges">
              <span
                v-if="gradedContent.gradeLabel"
                class="tooltip__badge tooltip__badge--rarity"
                :class="{ 'tooltip__badge--max-rank': isMaxPhamRank }"
                :style="rarityAccentColor ? { color: rarityAccentColor } : undefined"
              >{{ gradedContent.gradeLabel }}</span>
              <span v-if="gradedContent.ownedLabel" class="tooltip__badge tooltip__badge--muted">{{ gradedContent.ownedLabel }}</span>
            </div>
          </div>
        </header>

        <header v-else-if="content.kind === 'equipment'" class="tooltip__header">
          <div class="tooltip__icon-shell">
            <span class="tooltip__icon-fallback">{{ content.name.charAt(0) }}</span>
            <img v-if="content.imagePath" class="tooltip__icon" :src="content.imagePath" :alt="content.name" @error="hideBrokenImage" />
          </div>
          <div class="tooltip__heading">
            <p class="tooltip__title">
              <template v-for="(segment, index) in content.nameSegments" :key="`${index}-${segment.text}`">
                <span v-if="index > 0"> </span>
                <span
                  :class="{ 'tooltip__title-segment--max-rank': isMaxRankTone(segment.tone) }"
                  :style="segment.colorVar && !isMaxRankTone(segment.tone) ? { color: `var(${segment.colorVar})` } : undefined"
                >{{ segment.text }}</span>
              </template>
            </p>
            <div class="tooltip__badges">
              <span class="tooltip__badge">{{ content.slotLabel }}</span>
            </div>
          </div>
        </header>

        <template v-else-if="content.kind === 'building'">
          <p class="tooltip__title">{{ content.name }}</p>
          <p v-if="content.functionLabel" class="tooltip__description">{{ content.functionLabel }}</p>
          <!-- Màu theo ĐÚNG trạng thái (2026-08-30 frontend-design pass) —
               trước đây LUÔN jade dù đang nói "Chưa mở" (trông như tích
               cực nhầm). isBuilt=false (chưa xây/chưa mở) → muted. -->
          <p
            class="tooltip__building-status"
            :class="{ 'tooltip__building-status--locked': content.isBuilt === false }"
          >{{ content.statusLabel }}</p>
        </template>

        <template v-else-if="content.kind === undefined || content.kind === 'plain'">
          <p v-if="content.title" class="tooltip__title">{{ content.title }}</p>
          <p v-if="content.description" class="tooltip__description">{{ content.description }}</p>
        </template>

        <template v-if="richContent">
          <p v-if="richContent.description" class="tooltip__description tooltip__description--rich">{{ richContent.description }}</p>
          <section v-for="section in visibleSections" :key="section.label" class="tooltip__section">
            <p class="tooltip__section-label">{{ section.label }}</p>
            <div v-for="row in section.rows" :key="row.label" class="tooltip__section-row" :class="[row.tone ? `tooltip__section-row--${row.tone}` : '', row.tier ? `tooltip__section-row--tier-${row.tier}` : '']" :aria-label="row.tier ? `${row.label}, bậc ${row.tier}: ${row.value}` : undefined">
              <span class="tooltip__row-label">{{ row.label }}</span>
              <span class="tooltip__row-value">{{ row.value }}</span>
              <small v-if="row.detail" class="tooltip__row-detail">{{ row.detail }}</small>
            </div>
          </section>
        </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.tooltip {
  --tooltip-accent: var(--chrome-300);
  position: fixed; width: max-content; max-width: min(240px, calc(100vw - 24px));
  padding: 8px 10px; overflow: hidden auto;
  border: 0; border-radius: 0;
  background: transparent;
  box-shadow: none; color: var(--paper-text, #211f1a); font: var(--text-xs) var(--font-body); pointer-events: none; isolation: isolate;
}
.tooltip::before { content: ''; position: absolute; z-index: 4; inset: 12px auto 12px 5px; width: 2px; background: var(--tooltip-accent); opacity: .72; }
.tooltip__content { position: relative; z-index: 3; }
.tooltip--rich { max-width: min(320px, calc(100vw - 24px)); padding: 12px 14px; }
.tooltip--detailed { max-width: min(380px, calc(100vw - 24px)); }
.tooltip__header { display: flex; align-items: center; gap: 10px; }
.tooltip__icon-shell { flex: 0 0 54px; display: grid; place-items: center; width: 54px; height: 54px; border: 1px solid color-mix(in srgb, var(--tooltip-accent) 42%, var(--paper-line, rgba(42,41,36,.42))); border-radius: 2px; background: color-mix(in srgb, var(--paper-100, #ebe3d2) 82%, transparent); overflow: hidden; }
.tooltip__icon, .tooltip__icon-fallback { grid-area: 1 / 1; } .tooltip__icon { width: 100%; height: 100%; padding: 5px; object-fit: contain; box-sizing: border-box; background: color-mix(in srgb, var(--paper-50, #f5f0e4) 84%, transparent); } .tooltip__icon-fallback { color: var(--tooltip-accent); font: 700 var(--text-panel-title) var(--font-display); }
.tooltip__heading { min-width: 0; }
/* Title trước đây thừa hưởng font-size 12px của .tooltip gốc — cùng cỡ
   với meta/description, chỉ khác weight/family (2026-08-30 frontend-
   design pass: tiêu đề tooltip cần tách bậc rõ khỏi nội dung). */
.tooltip__title { margin: 0 0 3px; color: var(--paper-text, #211f1a); font-family: var(--font-display); font-size: var(--text-md); font-weight: 700; line-height: 1.25; }
.tooltip__title-segment--max-rank { color: transparent; background: var(--rank-gradient-9); background-clip: text; -webkit-background-clip: text; } .tooltip__meta { margin: 0; color: var(--paper-text-muted, #8f897c); font-size: var(--text-xs); }
.tooltip__badges { display: flex; flex-wrap: wrap; gap: 4px; } .tooltip__badge { padding: 1px 5px; border: 1px solid var(--paper-line, rgba(42,41,36,.42)); border-radius: 999px; color: var(--paper-text-soft, #5e5a50); font-size: var(--text-xs); }
.tooltip__badge--quality { border-color: color-mix(in srgb, var(--tooltip-accent) 55%, var(--paper-line, rgba(42,41,36,.42))); color: var(--tooltip-accent); } .tooltip__badge--rarity { color: var(--paper-text, #211f1a); } .tooltip__badge--muted { color: var(--paper-text-muted, #8f897c); }
.tooltip--max-quality-rank .tooltip__badge--quality,
.tooltip__badge--rarity.tooltip__badge--max-rank { color: transparent; background: var(--rank-gradient-9); background-clip: text; -webkit-background-clip: text; font-weight: 700; }
.tooltip__description { margin: 3px 0 0; color: var(--paper-text-soft, #5e5a50); line-height: 1.45; } .tooltip__description--rich { margin-top: 9px; }
.tooltip__section { margin-top: 10px; padding-top: 7px; border-top: 1px solid color-mix(in srgb, var(--tooltip-accent) 18%, var(--paper-line, rgba(42,41,36,.42))); }
.tooltip__section-label { margin: 0 0 5px; color: color-mix(in srgb, var(--tooltip-accent) 76%, var(--paper-text, #211f1a)); font-size: var(--text-xs); font-weight: 700; letter-spacing: .07em; text-transform: uppercase; }
.tooltip__section-row { display: grid; grid-template-columns: minmax(0,1fr) auto; column-gap: 14px; align-items: baseline; color: var(--paper-text-soft, #5e5a50); line-height: 1.55; }
.tooltip__row-value { color: var(--paper-text, #211f1a); font-variant-numeric: tabular-nums; text-align: right; } .tooltip__row-detail { grid-column: 1/-1; color: var(--paper-text-muted, #8f897c); }
.tooltip__section-row--positive .tooltip__row-value { color: var(--jade); } .tooltip__section-row--negative .tooltip__row-value { color: var(--crimson); }
.tooltip__section-row--warning .tooltip__row-value { color: var(--mineral-gold, #b79653); } .tooltip__section-row--muted { color: var(--paper-text-muted, #8f897c); } .tooltip__section-row--special .tooltip__row-value { color: var(--affix-exalted); }
.tooltip__section-row--tier-1 .tooltip__row-label { color: var(--affix-tier-1); } .tooltip__section-row--tier-2 .tooltip__row-label { color: var(--affix-tier-2); }
.tooltip__section-row--tier-3 .tooltip__row-label { color: var(--affix-tier-3); } .tooltip__section-row--tier-4 .tooltip__row-label { color: var(--affix-tier-4); } .tooltip__section-row--tier-5 .tooltip__row-label { color: transparent; background: var(--rank-gradient-9); background-clip: text; -webkit-background-clip: text; font-weight: 700; }
.tooltip__building-status { margin: 5px 0 0; color: var(--jade); font-size: var(--text-xs); }
.tooltip__building-status--locked { color: var(--paper-text-muted, #8f897c); }
.tooltip-fade-enter-active { transition: opacity 35ms linear; } .tooltip-fade-leave-active { transition: opacity 30ms linear; }
.tooltip-fade-enter-from, .tooltip-fade-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .tooltip-fade-enter-active, .tooltip-fade-leave-active { transition: opacity 1ms linear; } }
</style>
