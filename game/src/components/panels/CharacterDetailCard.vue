<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { BASE_STAT_LABELS, formatStat, type StatCategory } from '@/core/stats/StatLabels'

// Detail stat card - split out of CharacterPanel (which now keeps only
// the meridian figure + Ngu Hanh) and docked to the right edge of the
// Character drawer (rendered by LeftPanel.vue). Toggled via ui.characterDetailOpen.
const { t } = useI18n()
const player = usePlayerStore()
const ui = useUiStore()

const STAT_CATEGORY_KEYS: Record<Exclude<StatCategory, 'attribute'>, string> = {
  combat: 'panels.character.sections.combat',
  survival: 'panels.character.sections.survival',
  special: 'panels.character.sections.special',
  defense_advanced: 'panels.character.sections.defenseAdvanced',
}

const STAT_CATEGORY_ORDER: Array<Exclude<StatCategory, 'attribute'>> = [
  'combat',
  'survival',
  'special',
  'defense_advanced',
]

const statGroups = computed(() =>
  STAT_CATEGORY_ORDER.map(category => ({
    category,
    label: t(STAT_CATEGORY_KEYS[category]),
    stats: BASE_STAT_LABELS.filter(stat => stat.category === category),
  })),
)
</script>

<template>
  <aside class="character-detail sys-surface" data-testid="character-detail-card" role="complementary">
    <div class="character-detail__head">
      <h4 class="character-detail__title">{{ t('panels.character.labels.detailsTitle') }}</h4>
      <button
        type="button"
        class="character-detail__close"
        :aria-label="t('panels.character.actions.details')"
        @click="ui.toggleCharacterDetail()"
      >✕</button>
    </div>

    <div class="character-detail__body scrollfade">
      <div v-for="group in statGroups" :key="group.category" class="character-detail__group">
        <h5 class="character-detail__group-title">{{ group.label }}</h5>
        <ul class="character-detail__list">
          <li v-for="stat in group.stats" :key="stat.key" v-tooltip="stat.description">
            <span>{{ stat.label }}</span>
            <span>{{ formatStat(stat.key, player.finalStats[stat.key]) }}</span>
          </li>
        </ul>
      </div>
    </div>
  </aside>
</template>

<style scoped>
/* Docked card - position (absolute, left:100% of the drawer) is set by
   LeftPanel via the incoming .left-panel__detail class; this file only
   styles the surface. --paper-* tokens are remapped dark by .ink-drawer
   so the card inherits the drawer tone. */
.character-detail {
  width: 280px;
  max-height: calc(100% - 24px);
  display: flex;
  flex-direction: column;
  border: 1px solid var(--paper-line);
  border-radius: var(--radius-md);
  background:
    var(--paper-grain) 0 0 / 140px 140px repeat,
    linear-gradient(175deg, var(--paper-50) 0%, var(--paper-100) 100%);
  box-shadow: var(--surface-shadow-deep, 0 12px 32px rgba(0, 0, 0, 0.5));
  color: var(--paper-text);
  font-family: var(--font-body);
}

.character-detail__head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--paper-line);
}

.character-detail__title {
  margin: 0;
  font: 700 var(--text-md) var(--font-display);
  letter-spacing: 0.03em;
  color: var(--paper-text);
}

.character-detail__close {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--paper-line);
  border-radius: var(--radius-sm);
  background: var(--paper-100);
  color: var(--paper-text-soft);
  font-size: var(--text-xs);
  line-height: 1;
  cursor: pointer;
}

.character-detail__close:hover {
  color: var(--mineral-gold);
  border-color: var(--mineral-gold);
}

.character-detail__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-2) var(--space-3) var(--space-3);
  scrollbar-width: none;
}

.character-detail__body::-webkit-scrollbar { display: none; }

.character-detail__group {
  margin-bottom: var(--space-2);
}

.character-detail__group-title {
  margin: 0 0 4px;
  padding-left: 8px;
  border-left: 3px solid var(--paper-eyebrow);
  font: 700 var(--text-sm) var(--font-display);
  letter-spacing: 0.03em;
  color: var(--paper-text);
}

.character-detail__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.character-detail__list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  padding: 5px 0;
  border-bottom: 1px solid var(--paper-line);
  font-size: var(--text-sm);
}

.character-detail__list li > span:first-child {
  color: var(--paper-text-soft);
}

.character-detail__list li > span:last-child {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--paper-text);
}

/* Narrow viewport - LeftPanel switches the card to an in-drawer overlay
   (left/right insets), width stretches to fit. */
@media (max-width: 900px) {
  .character-detail {
    width: auto;
  }
}
</style>
