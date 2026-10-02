<script setup lang="ts">
// Scene 02 talent card - one offer in the 3x3 roll grid (corrected from
// the ref's 3 cards: real roll size is 9, card chrome = frame + emblem +
// text + seal; painted card art is the gameplay-art pipeline).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { TALENT_RARITY_LABELS, type TalentDefinition } from '@/core/talent/Talent'
import TalentCardEmblem from './TalentCardEmblem.vue'

const props = defineProps<{
  talent: TalentDefinition
  selected: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{ toggle: [] }>()
const { t, te } = useI18n()

// ui-audit creation-meta - talent tag chips rendered raw enum values
// ('combat', 'risk_reward'); route through locale keys, fall back to the
// raw tag only when a future tag ships without a label.
const tagLabel = computed(() => {
  const tag = props.talent.tags[0] ?? ''
  const key = `onboarding.creation.talentStep.tags.${tag}`
  return te(key) ? t(key) : tag
})
</script>

<template>
  <button
    type="button"
    class="talent-card art-needed"
    :class="[`talent-tier-${talent.rarity}`, { selected }]"
    :data-testid="`creation-talent-${talent.id}`"
    data-art-id="talent-card-frame"
    :disabled="disabled"
    :aria-pressed="selected"
    @click="emit('toggle')"
  >
    <TalentCardEmblem :rarity="talent.rarity" />
    <span class="talent-card__rarity">{{ TALENT_RARITY_LABELS[talent.rarity] }}</span>
    <h3 class="talent-card__name">{{ talent.name }}</h3>
    <p class="talent-card__desc">{{ talent.description }}</p>
    <small class="talent-card__tag">{{ tagLabel }}</small>
    <span
      class="talent-card__seal art-needed"
      data-art-id="talent-card-seal"
      aria-hidden="true"
    />
    <span class="talent-card__corners" aria-hidden="true" />
  </button>
</template>

<style scoped>
.talent-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-height: 0;
  height: 100%;
  padding: 4px 8px 12px;
  border: 1px solid var(--hk-border-muted, rgba(122, 98, 52, 0.42));
  border-radius: 3px;
  background:
    linear-gradient(170deg, color-mix(in srgb, #1b2621 92%, transparent), color-mix(in srgb, #101718 96%, transparent));
  color: var(--hk-text-primary, #ede6d6);
  text-align: center;
  cursor: pointer;
  transition: border-color var(--hk-motion-micro, 150ms) var(--hk-ease-standard, ease), box-shadow var(--hk-motion-micro, 150ms) var(--hk-ease-standard, ease);
}

/* hover = gold keyline breath only; no transform - the fidelity spec pins
   the grid's row geometry. */
.talent-card:hover {
  border-color: var(--hk-border-ceremony, #e8c35a);
  box-shadow: 0 0 10px color-mix(in srgb, var(--hk-gold, #c99a4a) 22%, transparent);
}

.talent-card.selected {
  border-color: var(--hk-border-ceremony, #e8c35a);
  box-shadow: inset 0 0 0 1px var(--hk-border-ceremony, #e8c35a);
  background:
    linear-gradient(170deg, color-mix(in srgb, #1f6b58 55%, #1b2621), #101718);
}

.talent-card__rarity {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.13em;
}

.talent-card__name {
  margin: 2px 0 2px;
  font: 600 var(--text-xs) var(--hk-font-display, var(--font-display));
  line-height: 1.25;
}

.talent-card__desc {
  margin: 0 0 2px;
  color: color-mix(in srgb, var(--hk-text-primary, #ede6d6) 66%, transparent);
  font-size: var(--text-xs);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.talent-card__tag {
  margin-top: auto;
  color: color-mix(in srgb, var(--hk-text-primary, #ede6d6) 45%, transparent);
  font-size: var(--text-xs);
}

/* Small ring seal hanging on the card's bottom edge (ref: round seal at
   each card's foot). Doubles as the selected check-moment. */
.talent-card__seal {
  position: absolute;
  left: 50%;
  bottom: -7px;
  width: 13px;
  height: 13px;
  transform: translateX(-50%);
  border-radius: 50%;
  background:
    radial-gradient(45% 45% at 50% 40%, #b99a55 40%, #101718 100%);
  box-shadow:
    inset 0 0 0 1.5px var(--hk-gold-muted, #7a6234),
    0 1px 4px rgba(5, 8, 9, 0.55);
}

.talent-card.selected .talent-card__seal {
  background:
    radial-gradient(45% 45% at 50% 40%, #67c4ab 40%, #101718 100%);
  box-shadow:
    inset 0 0 0 1.5px var(--hk-jade, #3fa68b),
    0 0 8px var(--hk-glow-jade, rgba(63, 166, 139, 0.35));
}

/* Gold filigree corner ticks on all four card corners (ref: ornate gilt
   brackets on the painted frame). Part of the card frame's temp art -
   covered by data-art-id="talent-card-frame" on the card itself. */
.talent-card__corners {
  position: absolute;
  inset: 3px;
  pointer-events: none;
  opacity: 0.75;
  background:
    linear-gradient(90deg, #b99a55 8px, transparent 8px) left top / 8px 1.5px no-repeat,
    linear-gradient(180deg, #b99a55 8px, transparent 8px) left top / 1.5px 8px no-repeat,
    linear-gradient(-90deg, #b99a55 8px, transparent 8px) right top / 8px 1.5px no-repeat,
    linear-gradient(180deg, #b99a55 8px, transparent 8px) right top / 1.5px 8px no-repeat,
    linear-gradient(90deg, #b99a55 8px, transparent 8px) left bottom / 8px 1.5px no-repeat,
    linear-gradient(0deg, #b99a55 8px, transparent 8px) left bottom / 1.5px 8px no-repeat,
    linear-gradient(-90deg, #b99a55 8px, transparent 8px) right bottom / 8px 1.5px no-repeat,
    linear-gradient(0deg, #b99a55 8px, transparent 8px) right bottom / 1.5px 8px no-repeat;
}

.talent-tier-pham .talent-card__rarity { color: var(--rank-color-1); }
.talent-tier-linh .talent-card__rarity { color: var(--rank-color-3); }
.talent-tier-dia .talent-card__rarity { color: var(--rank-color-5); }
.talent-tier-thien .talent-card__rarity { color: var(--rank-color-7); }
.talent-tier-di .talent-card__rarity { color: var(--rank-color-8); }
</style>
