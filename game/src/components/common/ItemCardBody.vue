<script setup lang="ts">
import { computed } from 'vue'
import SlotView from './SlotView.vue'
import { isMaxRankTone } from '@/core/profession/slotRank'
import { i18n } from '@/i18n'
import type { EquipmentTooltipContent, GradedItemTooltipContent } from '@/composables/useTooltip'

// Item card body (item-info-card spec 2026-09-14 §3) — ONE card
// skeleton shared by the equipment kind and the graded kinds
// (material/pill/talisman/formation). The header binds the source
// cell's own SlotView props (payload.slotPreview) onto a static
// SlotView, so the card preview IS the slot — seal stamp, Chat edge
// and badges included. Cultivation structure = letter-spaced eyebrow
// labels + hairline dividers + diamond affix markers on the existing
// dark-ink surface (NOT a paper-white card).
const props = defineProps<{
  content: EquipmentTooltipContent | GradedItemTooltipContent

  // Visible eyebrow label rendered above the card (compare pair:
  // "Dang Mac" / "Vat Pham Dang Xem"); aria-labels live on the pair
  // wrapper, not here.
  eyebrow?: string
}>()

const slotLabel = computed(() => (props.content.kind === 'equipment' ? props.content.slotLabel : undefined))
const gradeBadge = computed(() => (props.content.kind !== 'equipment' ? props.content.gradeLabel : undefined))

// Spec §2: one color for the whole name (the item's quality identity).
// A max-rank nameTone upgrades it to the rainbow gradient and beats
// nameColorVar.
const rainbowTitle = computed(() => isMaxRankTone(props.content.nameTone))
const titleStyle = computed(() =>
  !rainbowTitle.value && props.content.nameColorVar ? { color: `var(${props.content.nameColorVar})` } : undefined,
)

// "So huu: N" — graded kinds only, and ONLY when the player owns at
// least one (spec: never renders "So huu: 0"). i18n goes through the
// module import, not useI18n(), because tests mount this component
// via bare createApp without the plugin.
const ownedLabel = computed(() => {
  if (props.content.kind === 'equipment') return undefined
  const owned = props.content.ownedCount ?? 0
  return owned > 0 ? i18n.global.t('panels.bag.tooltip.owned', { count: owned }) : undefined
})

function hideBrokenImage(event: Event) {
  const image = event.currentTarget
  if (image instanceof HTMLImageElement) image.hidden = true
}
</script>

<template>
  <div class="item-card">
    <p v-if="eyebrow" class="item-card__eyebrow">{{ eyebrow }}</p>

    <header class="item-card__header">
      <SlotView
        v-if="content.slotPreview"
        v-bind="content.slotPreview"
        :item="{}"
        :static="true"
        class="item-card__slot"
      />
      <div v-else class="item-card__icon-shell">
        <span class="item-card__icon-fallback">{{ content.name.charAt(0) }}</span>
        <img
          v-if="content.imagePath"
          class="item-card__icon"
          :src="content.imagePath"
          :alt="content.name"
          @error="hideBrokenImage"
        />
      </div>
      <div class="item-card__heading">
        <p class="item-card__title" :class="{ 'item-card__title--max-rank': rainbowTitle }" :style="titleStyle">{{ content.name }}</p>
        <p v-if="content.gradeLine" class="item-card__meta">{{ content.gradeLine }}</p>
        <div v-if="slotLabel || gradeBadge || ownedLabel" class="item-card__badges">
          <span v-if="slotLabel" class="item-card__badge">{{ slotLabel }}</span>
          <span v-if="gradeBadge" class="item-card__badge">{{ gradeBadge }}</span>
          <span v-if="ownedLabel" class="item-card__badge item-card__badge--muted">{{ ownedLabel }}</span>
        </div>
      </div>
    </header>

    <section v-for="section in content.sections" :key="section.label" class="item-card__section">
      <p class="item-card__section-label">{{ section.label }}</p>
      <div
        v-for="row in section.rows" :key="row.label"
        class="item-card__row"
        :class="[row.tone ? `item-card__row--${row.tone}` : '', row.tier ? `item-card__row--tier-${row.tier}` : '']"
        :aria-label="row.tier ? `${row.label}, bậc ${row.tier}: ${row.value}` : undefined"
      >
        <span class="item-card__row-label"><span v-if="row.tier" class="item-card__gem" aria-hidden="true">◆</span>{{ row.label }}<small v-if="row.tier" class="item-card__tier">T{{ row.tier }}</small></span>
        <span class="item-card__row-value" :style="row.colorVar ? { color: `var(${row.colorVar})` } : undefined">{{ row.value }}<small v-if="row.range" class="item-card__range">{{ row.range }}</small><small v-if="row.delta" class="item-card__delta" :class="`item-card__delta--${row.deltaTone ?? 'muted'}`">{{ row.delta }}</small></span>
        <small v-if="row.detail" class="item-card__row-detail">{{ row.detail }}</small>
      </div>
    </section>

    <p v-if="content.description" class="item-card__description">{{ content.description }}</p>
  </div>
</template>

<style scoped>
/* Dark-ink card body — inherits the .tooltip paper->surface var remap,
   so the same tokens stay legible on the dark surface. */
.item-card {
  color: var(--paper-text, #211f1a);
  font: var(--text-xs) var(--font-body);
}

.item-card__eyebrow {
  margin: 0 0 6px;
  color: var(--tooltip-accent, var(--chrome-300));
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
}

.item-card__header { display: flex; align-items: center; gap: 10px; }

.item-card__slot { width: 54px; flex: 0 0 54px; }

.item-card__icon-shell {
  flex: 0 0 54px;
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border: 1px solid color-mix(in srgb, var(--tooltip-accent, var(--chrome-300)) 42%, var(--paper-line, rgba(42,41,36,.42)));
  border-radius: 2px;
  background: color-mix(in srgb, var(--paper-100, #ebe3d2) 82%, transparent);
  overflow: hidden;
}
.item-card__icon, .item-card__icon-fallback { grid-area: 1 / 1; }
.item-card__icon {
  width: 100%; height: 100%; padding: 5px; object-fit: contain; box-sizing: border-box;
  background: color-mix(in srgb, var(--paper-50, #f5f0e4) 84%, transparent);
}
.item-card__icon-fallback { color: var(--tooltip-accent, var(--chrome-300)); font: 700 var(--text-panel-title) var(--font-display); }

.item-card__heading { min-width: 0; }
.item-card__title {
  margin: 0 0 3px;
  color: var(--paper-text, #211f1a);
  font-family: var(--font-display);
  font-size: var(--text-md);
  font-weight: 700;
  line-height: 1.25;
}
.item-card__title--max-rank {
  color: transparent;
  background: var(--rank-gradient-10);
  background-clip: text;
  -webkit-background-clip: text;
}
.item-card__meta { margin: 0; color: var(--paper-text-muted, #8f897c); font-size: var(--text-xs); }

.item-card__badges { display: flex; flex-wrap: wrap; gap: 4px; }
.item-card__badge {
  padding: 1px 5px;
  border: 1px solid var(--paper-line, rgba(42,41,36,.42));
  border-radius: 999px;
  color: var(--paper-text-soft, #5e5a50);
  font-size: var(--text-xs);
}
.item-card__badge--muted { color: var(--paper-text-muted, #8f897c); }

/* Eyebrow section label + hairline divider (cultivation structure on
   the dark ink skin — the divider IS the brush stroke, no extra art). */
.item-card__section {
  margin-top: 10px;
  padding-top: 7px;
  border-top: 1px solid color-mix(in srgb, var(--tooltip-accent, var(--chrome-300)) 18%, var(--paper-line, rgba(42,41,36,.42)));
}
.item-card__section-label {
  margin: 0 0 5px;
  color: color-mix(in srgb, var(--tooltip-accent, var(--chrome-300)) 76%, var(--paper-text, #211f1a));
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: .1em;
  text-transform: uppercase;
}

.item-card__row {
  display: grid;
  grid-template-columns: minmax(0,1fr) auto;
  column-gap: 14px;
  align-items: baseline;
  color: var(--paper-text-soft, #5e5a50);
  line-height: 1.55;
}
.item-card__gem { color: var(--tooltip-accent, var(--chrome-300)); margin-right: 4px; font-size: .8em; }
.item-card__tier { margin-left: 5px; color: var(--paper-text-muted, #8f897c); }
.item-card__row-value { color: var(--paper-text, #211f1a); font-variant-numeric: tabular-nums; text-align: right; }
.item-card__range { margin-left: 6px; color: var(--paper-text-muted, #8f897c); }
.item-card__delta { margin-left: 6px; }
.item-card__delta--positive { color: var(--jade); }
.item-card__delta--negative { color: var(--crimson); }
.item-card__delta--muted { color: var(--paper-text-muted, #8f897c); }
.item-card__row-detail { grid-column: 1/-1; color: var(--paper-text-muted, #8f897c); }

/* Row tones — same palette the old flat tooltip rows used. */
.item-card__row--positive .item-card__row-value { color: var(--jade); }
.item-card__row--negative .item-card__row-value { color: var(--crimson); }
.item-card__row--warning .item-card__row-value { color: var(--mineral-gold, #b79653); }
.item-card__row--muted { color: var(--paper-text-muted, #8f897c); }
.item-card__row--special .item-card__row-value { color: var(--affix-exalted); }

/* Affix tier chips — the old tier colors move from the row label to
   the T{n} chip (spec §3). Tier 5 keeps the max-rank rainbow. */
.item-card__row--tier-1 .item-card__tier { color: var(--affix-tier-1); }
.item-card__row--tier-2 .item-card__tier { color: var(--affix-tier-2); }
.item-card__row--tier-3 .item-card__tier { color: var(--affix-tier-3); }
.item-card__row--tier-4 .item-card__tier { color: var(--affix-tier-4); }
.item-card__row--tier-5 .item-card__tier {
  color: transparent;
  background: var(--rank-gradient-10);
  background-clip: text;
  -webkit-background-clip: text;
  font-weight: 700;
}

.item-card__description {
  margin: 10px 0 0;
  padding-top: 7px;
  border-top: 1px dashed color-mix(in srgb, var(--tooltip-accent, var(--chrome-300)) 24%, var(--paper-line, rgba(42,41,36,.42)));
  color: var(--paper-text-muted, #8f897c);
  font-style: italic;
  line-height: 1.45;
}
</style>
