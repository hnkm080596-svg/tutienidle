<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { BASE_STAT_LABELS } from '@/core/stats/StatLabels'
import CharacterSectionPlaque from './CharacterSectionPlaque.vue'
import CharacterMainStatRow from './CharacterMainStatRow.vue'

// main-stats region: the five main attributes as seal-icon + bar rows
// (the reference's "Thuec Tinh Chinh" list). Allocate (+) / MAX live on
// each row - behavior identical to the previous list/meridian render.
const { t } = useI18n()
const player = usePlayerStore()

const attributeStats = computed(() =>
  BASE_STAT_LABELS.filter(stat => stat.category === 'attribute'),
)
</script>

<template>
  <section class="character-panel__stats main-stats" data-hk-region="main-stats">
    <CharacterSectionPlaque :title="t('panels.character.sections.mainStats')">
      <span v-if="player.attributePoints > 0" class="main-stats__points">
        ({{ t('panels.character.labels.attributePointsRemaining', { count: player.attributePoints }) }})
      </span>
    </CharacterSectionPlaque>

    <div class="main-stats__rows scrollfade">
      <CharacterMainStatRow
        v-for="stat in attributeStats"
        :key="stat.key"
        :stat="stat"
      />
    </div>
  </section>
</template>

<style scoped>
.main-stats {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0 var(--hk-space-2, 4px);
}

.main-stats__points {
  color: var(--hk-gold, #b99a55);
  font-weight: 600;
}

.main-stats__rows {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--hk-space-2, 6px);
  padding: var(--hk-space-2, 4px) 2px;
  scrollbar-width: none;
}
.main-stats__rows > * { flex: 1 1 0; min-height: 0; }
.main-stats__rows::-webkit-scrollbar { display: none; }
</style>
