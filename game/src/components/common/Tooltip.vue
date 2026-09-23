<script setup lang="ts">
import { computed, ref } from 'vue'
import { autoUpdate, flip, offset, shift, size, useFloating } from '@floating-ui/vue'
import { useTooltip } from '@/composables/useTooltip'
import ItemCardBody from '@/components/common/ItemCardBody.vue'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import type { EquipmentTooltipContent, GradedItemTooltipContent, TechniqueTooltipContent } from '@/composables/useTooltip'
import { i18n } from '@/i18n'

const { content, reference } = useTooltip()
const floating = ref<HTMLElement | null>(null)
const open = computed(() => content.value !== null)

// Item-info-card spec section 3: equipment + the graded kinds
// (material/pill/talisman/formation) all render through the shared
// ItemCardBody skeleton.
const cardContent = computed<GradedItemTooltipContent | EquipmentTooltipContent | null>(() => {
  const value = content.value
  if (!value) return null

  switch (value.kind) {
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

// Compare pair (spec section 4): the hovered equipment carries its
// equipped counterpart as compareWith - the tooltip renders two cards
// side by side, equipped LEFT, hovered RIGHT.
const comparePair = computed(() => {
  const value = content.value
  return value?.kind === 'equipment' && value.compareWith !== undefined
    ? { equipped: value.compareWith, candidate: value }
    : null
})

// Technique keeps its own header + the shared flat section loop -
// spec section 3 leaves the technique kind unchanged.
const techniqueContent = computed<TechniqueTooltipContent | null>(() =>
  content.value?.kind === 'technique' ? content.value : null,
)
const visibleSections = computed(() => techniqueContent.value?.sections ?? [])

// Cap density theo từng loại tooltip (mục 5 tooltip-revamp-plan.md) —
// khớp với .tooltip/--rich/--detailed ở CSS bên dưới. size() chỉ
// dùng để clamp khi availableWidth NHỎ HƠN cap này (an toàn viewport),
// không được ghi đè cap khi màn hình đủ rộng.
function maxWidthForKind(kind: string | undefined): number {
  if (kind === 'equipment') return 380
  if (kind === 'element') return 300
  if (kind && kind !== 'plain') return 320
  return 240
}

// Element banner tooltips use the element's own painted banner as the
// background layer instead of the paper InkNineSlice (Ngu Hanh
// formation redesign, 2026-09-15).
const elementBannerUrl = computed(() =>
  content.value?.kind === 'element'
    ? `/assets/ui/elements/banner-${content.value.element}.png`
    : undefined,
)

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
          // A compare pair is two ~380px cards + gap - raise the cap so
          // flip/shift see the real footprint (clamped by availableWidth).
          maxWidth: `${Math.min(comparePair.value ? 800 : maxWidthForKind(content.value?.kind), availableWidth)}px`,
          maxHeight: `${availableHeight}px`,
        })
      },
    }),
  ],
})

// Pair group labels - i18n via the module import (tests mount this
// component through bare createApp without the i18n plugin).
const equippedLabel = computed(() => i18n.global.t('panels.bag.tooltip.compare.equipped'))
const viewingLabel = computed(() => i18n.global.t('panels.bag.tooltip.compare.viewing'))

// Quality/Pham → 1 màu accent qua namespace --grade-* (5 vars riêng,
// rải 1-3-5-7-9 trên thang --rank-color, xem assets/theme.css) — KHÔNG
// còn `--rank-color-${itemQualityRank(...)}` (1-5) như trước Fix 2
// (final review, item-grade-quality-rework): equipment tooltip còn hiện
// grade segment (ProfessionGrade, 10 bậc, tô --rank-color-1..10) cạnh
// quality accent này, nên quality PHẢI dùng dải màu riêng --grade-*
// (không trùng --rank-color-1..10) để tránh nhầm, đúng spec §5.8. Dùng
// isMaxRankTone thay vì tự liệt kê lại từng ID quality/pham thành 1
// rule CSS[data-quality=...]/[data-rarity=...] riêng (dễ sót khi thêm
// bậc mới, xem git history).
const qualityAccentColor = computed(() => {
  if (content.value?.kind !== 'equipment') return undefined
  return `var(--grade-${content.value.qualityKey})`
})

// Item aura (2026-09-14 ruling): bag item tooltips get a soft outer
// glow tinted by the item's own rank color - equipment by Chat
// (--grade-*), pills/talismans/formations by gradeKey, materials by
// their Pham rank on the 10-step ramp. Only item kinds carry an aura;
// building/technique/plain tooltips stay unlit.
const itemAuraColor = computed(() => {
  const value = content.value
  if (!value) return undefined
  if (value.kind === 'equipment') return `var(--grade-${value.qualityKey})`
  if (value.kind === 'material' || value.kind === 'pill' || value.kind === 'talisman' || value.kind === 'formation') {
    if (value.gradeKey) return `var(--grade-${value.gradeKey})`
    if (value.gradeRank) return `var(--rank-color-${value.gradeRank})`
  }
  return undefined
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
        :class="[content.kind ? `tooltip--${content.kind}` : 'tooltip--plain', content.kind === 'element' ? `tooltip--element-${content.element}` : '', content.kind === 'equipment' ? 'tooltip--detailed' : '', content.kind && content.kind !== 'plain' ? 'tooltip--rich' : '', itemAuraColor ? 'tooltip--aura' : '']"
        :style="{ ...floatingStyles, '--tooltip-accent': qualityAccentColor ?? itemAuraColor, '--tooltip-aura': itemAuraColor, zIndex: OVERLAY_LAYERS.tooltip }"
      >
        <img v-if="elementBannerUrl" class="tooltip__banner" :src="elementBannerUrl" alt="" aria-hidden="true" />
        <!-- M-UI-OVERHAUL: chamfered sys readout card replaces the paper
             InkNineSlice frame; element tooltips keep their painted banner. -->
        <div v-else class="tooltip__sys-surface" aria-hidden="true" />
        <div class="tooltip__content">
        <!-- Compare pair (spec section 4): equipped card LEFT, hovered card
             RIGHT; each is a role=group with its own aria-label so
             screen readers can tell the two cards apart. -->
        <div v-if="comparePair" class="tooltip__pair">
          <div class="tooltip__card" role="group" :aria-label="equippedLabel">
            <ItemCardBody :content="comparePair.equipped" :eyebrow="equippedLabel" />
          </div>
          <div class="tooltip__card" role="group" :aria-label="viewingLabel">
            <ItemCardBody :content="comparePair.candidate" :eyebrow="viewingLabel" />
          </div>
        </div>

        <ItemCardBody v-else-if="cardContent" :content="cardContent" />

        <header v-else-if="techniqueContent" class="tooltip__header">
          <div class="tooltip__icon-shell">
            <span class="tooltip__icon-fallback">{{ techniqueContent.name.charAt(0) }}</span>
            <img v-if="techniqueContent.imagePath" class="tooltip__icon" :src="techniqueContent.imagePath" :alt="techniqueContent.name" @error="hideBrokenImage" />
          </div>
          <div class="tooltip__heading">
            <p class="tooltip__title">{{ techniqueContent.name }}</p>
            <p class="tooltip__meta">{{ [techniqueContent.levelLabel, techniqueContent.elementLabel].filter(Boolean).join(' · ') }}</p>
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

        <template v-else-if="content.kind === 'element'">
          <p v-if="content.description" class="tooltip__description">{{ content.description }}</p>
        </template>

        <template v-else-if="content.kind === undefined || content.kind === 'plain'">
          <p v-if="content.title" class="tooltip__title">{{ content.title }}</p>
          <p v-if="content.description" class="tooltip__description">{{ content.description }}</p>
        </template>

        <template v-if="techniqueContent">
          <p v-if="techniqueContent.description" class="tooltip__description tooltip__description--rich">{{ techniqueContent.description }}</p>
          <section v-for="section in visibleSections" :key="section.label" class="tooltip__section">
            <p class="tooltip__section-label">{{ section.label }}</p>
            <div v-for="row in section.rows" :key="row.label" class="tooltip__section-row" :class="[row.tone ? `tooltip__section-row--${row.tone}` : '', row.tier ? `tooltip__section-row--tier-${row.tier}` : '']" :aria-label="row.tier ? `${row.label}, bậc ${row.tier}: ${row.value}` : undefined">
              <span class="tooltip__row-label">{{ row.label }}</span>
              <span class="tooltip__row-value" :style="row.colorVar ? { color: `var(${row.colorVar})` } : undefined">{{ row.value }}</span>
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
  --tooltip-accent: var(--sys-text, var(--chrome-300));
  position: fixed; width: max-content; max-width: min(240px, calc(100vw - 24px));
  padding: 12px 14px; overflow: hidden auto;
  border: 0; border-radius: 0;
  background: transparent;
  box-shadow: none; color: var(--sys-text, var(--paper-text, #211f1a)); font: var(--text-xs) var(--sys-font-body, var(--font-body)); pointer-events: none; isolation: isolate;
}
/* M-UI-OVERHAUL ephemeral surface: chamfered dark card + hairline,
   drawn under the content. Element tooltips hide it (painted banner). */
.tooltip__sys-surface {
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    linear-gradient(180deg, rgba(56, 225, 255, .045), transparent 38%),
    var(--sys-bg-1, var(--surface-700, #141820));
  border: 1px solid var(--sys-line-soft, rgba(255, 255, 255, .14));
  clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
  filter: drop-shadow(0 6px 18px rgba(0, 0, 0, .5));
}
.tooltip--element .tooltip__sys-surface { display: none; }

/* Paper family -> dark surface equivalents. The tooltip teleports to
   <body> so it never inherits the .ink-drawer remap, while its
   surface-m-paper layer is dark navy - without this, --paper-* light-
   paper inks render dark-on-dark (invisible stat values). Element
   banners keep the real paper inks: their art is cream. */
.tooltip:not(.tooltip--element) {
  --paper-text: var(--sys-text, var(--surface-text));
  --paper-text-soft: var(--sys-text-muted, var(--surface-text-soft));
  --paper-text-muted: var(--sys-text-dim, var(--surface-text-muted));
  --paper-line: var(--sys-line-soft, var(--surface-line));
}
.tooltip::before { content: ''; position: absolute; z-index: 4; inset: 12px auto 12px 5px; width: 2px; background: var(--tooltip-accent); opacity: .72; }
.tooltip::after { content: ''; position: absolute; z-index: 4; right: 12px; bottom: 5px; width: 8px; height: 8px; border-right: 1px solid var(--tooltip-accent); border-bottom: 1px solid var(--tooltip-accent); opacity: .55; }
.tooltip--element::before, .tooltip--element::after { display: none; }
/* Item aura - soft outer glow in the item's own rank color (bag item
   tooltips only, see itemAuraColor). color-mix keeps it translucent. */
.tooltip--aura { box-shadow: 0 0 20px color-mix(in srgb, var(--tooltip-aura) 38%, transparent), 0 0 6px color-mix(in srgb, var(--tooltip-aura) 26%, transparent); }
.tooltip__content { position: relative; z-index: 3; }
.tooltip--rich { max-width: min(320px, calc(100vw - 24px)); padding: 12px 14px; }
.tooltip--detailed { max-width: min(380px, calc(100vw - 24px)); }
.tooltip__header { display: flex; align-items: center; gap: 10px; }
.tooltip__icon-shell { flex: 0 0 54px; display: grid; place-items: center; width: 54px; height: 54px; border: 1px solid color-mix(in srgb, var(--tooltip-accent) 42%, var(--sys-line-soft, var(--paper-line, rgba(42,41,36,.42)))); border-radius: 2px; background: color-mix(in srgb, var(--sys-bg-1, var(--paper-100, #ebe3d2)) 82%, transparent); overflow: hidden; }
.tooltip__icon, .tooltip__icon-fallback { grid-area: 1 / 1; } .tooltip__icon { width: 100%; height: 100%; padding: 5px; object-fit: contain; box-sizing: border-box; background: color-mix(in srgb, var(--sys-bg-0, var(--paper-50, #f5f0e4)) 84%, transparent); } .tooltip__icon-fallback { color: var(--tooltip-accent); font: 700 var(--text-panel-title) var(--sys-font-display, var(--font-display)); }
.tooltip__pair { display: flex; gap: 12px; }
.tooltip__card { min-width: 0; flex: 1 1 0; }
.tooltip__heading { min-width: 0; }
/* Title trước đây thừa hưởng font-size 12px của .tooltip gốc — cùng cỡ
   với meta/description, chỉ khác weight/family (2026-08-30 frontend-
   design pass: tiêu đề tooltip cần tách bậc rõ khỏi nội dung). */
.tooltip__title { margin: 0 0 3px; color: var(--sys-text, var(--paper-text, #211f1a)); font-family: var(--sys-font-display, var(--font-display)); font-size: var(--text-md); font-weight: 700; line-height: 1.25; }
.tooltip__meta { margin: 0; color: var(--sys-text-dim, var(--paper-text-muted, #8f897c)); font-size: var(--text-xs); }
.tooltip__description { margin: 3px 0 0; color: var(--sys-text-muted, var(--paper-text-soft, #5e5a50)); line-height: 1.45; } .tooltip__description--rich { margin-top: 9px; }
.tooltip__section { margin-top: 10px; padding-top: 7px; border-top: 1px solid color-mix(in srgb, var(--tooltip-accent) 18%, var(--sys-line-soft, var(--paper-line, rgba(42,41,36,.42)))); }
.tooltip__section-label { margin: 0 0 5px; color: color-mix(in srgb, var(--tooltip-accent) 76%, var(--sys-text, var(--paper-text, #211f1a))); font-size: var(--text-xs); font-weight: 700; letter-spacing: .07em; text-transform: uppercase; }
.tooltip__section-row { display: grid; grid-template-columns: minmax(0,1fr) auto; column-gap: 14px; align-items: baseline; color: var(--sys-text-muted, var(--paper-text-soft, #5e5a50)); line-height: 1.55; }
.tooltip__row-value { color: var(--sys-text, var(--paper-text, #211f1a)); font-variant-numeric: tabular-nums; text-align: right; } .tooltip__row-detail { grid-column: 1/-1; color: var(--sys-text-dim, var(--paper-text-muted, #8f897c)); }
.tooltip__section-row--positive .tooltip__row-value { color: var(--sys-success, var(--jade)); } .tooltip__section-row--negative .tooltip__row-value { color: var(--sys-danger, var(--crimson)); }
.tooltip__section-row--warning .tooltip__row-value { color: var(--sys-accent, var(--mineral-gold, #b79653)); } .tooltip__section-row--muted { color: var(--sys-text-dim, var(--paper-text-muted, #8f897c)); } .tooltip__section-row--special .tooltip__row-value { color: var(--affix-exalted); }
.tooltip__section-row--tier-1 .tooltip__row-label { color: var(--affix-tier-1); } .tooltip__section-row--tier-2 .tooltip__row-label { color: var(--affix-tier-2); }
.tooltip__section-row--tier-3 .tooltip__row-label { color: var(--affix-tier-3); } .tooltip__section-row--tier-4 .tooltip__row-label { color: var(--affix-tier-4); } .tooltip__section-row--tier-5 .tooltip__row-label { color: transparent; background: var(--rank-gradient-10); background-clip: text; -webkit-background-clip: text; font-weight: 700; }
.tooltip__building-status { margin: 5px 0 0; color: var(--sys-success, var(--jade)); font-size: var(--text-xs); }
.tooltip__building-status--locked { color: var(--sys-text-dim, var(--paper-text-muted, #8f897c)); }

/* Element banner tooltip (Ngu Hanh formation redesign) - the element's
   painted banner is the background layer; the stat line lives on a
   content layer inset into the CLEAR paper zone of each banner. The
   covers differ (icon medallion top-left, element art hugging edges),
   so every element gets its own inset measured on the art - text can
   never be covered. No title: the banner art carries the identity.
   Fixed width + per-element aspect-ratio = art scales, never distorts. */
.tooltip--element { width: 300px; padding: 0; overflow: hidden; }
.tooltip--element::before { content: none; }
.tooltip--element-wood { aspect-ratio: 445 / 175; --tooltip-accent: var(--el-wood); }
.tooltip--element-wood .tooltip__content { inset: 38% 24% 30% 30%; }
.tooltip--element-metal { aspect-ratio: 465 / 172; --tooltip-accent: var(--el-metal); }
.tooltip--element-metal .tooltip__content { inset: 38% 25% 30% 30%; }
.tooltip--element-water { aspect-ratio: 465 / 152; --tooltip-accent: var(--el-water); }
.tooltip--element-water .tooltip__content { inset: 38% 26% 36% 34%; }
.tooltip--element-earth { aspect-ratio: 475 / 154; --tooltip-accent: var(--el-earth); }
.tooltip--element-earth .tooltip__content { inset: 38% 25% 30% 30%; }
.tooltip--element-fire { aspect-ratio: 470 / 152; --tooltip-accent: var(--el-fire); }
.tooltip--element-fire .tooltip__content { inset: 38% 25% 30% 30%; }
.tooltip--element-primordial { aspect-ratio: 342 / 88; --tooltip-accent: var(--el-primordial); }
.tooltip--element-primordial .tooltip__content { inset: 32% 15% 34% 15%; }
.tooltip__banner { position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%; }
.tooltip--element .tooltip__content { position: absolute; z-index: 3; display: flex; flex-direction: column; justify-content: center; align-items: center; }
.tooltip--element .tooltip__description { margin: 0; font-size: var(--text-xs); text-align: center; }
.tooltip-fade-enter-active { transition: opacity 35ms linear; } .tooltip-fade-leave-active { transition: opacity 30ms linear; }
.tooltip-fade-enter-from, .tooltip-fade-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .tooltip-fade-enter-active, .tooltip-fade-leave-active { transition: opacity 1ms linear; } }
</style>
