<script setup lang="ts">
import GameCard from "@/components/common/GameCard.vue"
import CharacterCardTitle from './CharacterCardTitle.vue'
// Detail column (G3 mock): one scroll of stacked cards, each a stat
// group (offense/defense split - user ruling). Rows keep the per-source
// hover breakdown.
import { useI18n } from 'vue-i18n'
import type { CharacterUiDetail, CharacterUiModel } from './characterUi'
import { buildStatSourceTooltip } from './statSources'
import type { StatType } from '@/core/stats/StatTypes'
defineProps<{ model: CharacterUiModel }>()
const { t } = useI18n()
const rowTooltip = (row: CharacterUiDetail) =>
  buildStatSourceTooltip(row.id as StatType, row, t)
</script>
<template>
  <aside class="character-detail-scroll" data-testid="character-detail-scroll">
    <GameCard as="section" v-for="group in (['offense', 'defense'] as const)" :key="group" class="character-card character-detail-card">
      <template #title><CharacterCardTitle :label="t(`character.${group}`)" /></template>
      <dl class="character-card-scroll">
        <div v-for="row in model[group]" :key="row.id" v-tooltip="rowTooltip(row)">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
    </GameCard>
  </aside>
</template>
<style scoped>
.character-detail-scroll { min-height: 0; overflow: visible; display: grid; grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 24px; }
.character-detail-scroll::-webkit-scrollbar { display: none; }
.character-detail-card { margin: 0; min-height: 0; display: flex; flex-direction: column; }
.character-card-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: none; padding-bottom: 10px; mask-image: linear-gradient(to bottom, #000 calc(100% - 18px), transparent); -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 18px), transparent); }
.character-card-scroll::-webkit-scrollbar { display: none; }
.character-card-scroll > div { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #a98b4230; font-size: 14px; }
.character-card-scroll dd { margin: 0; font-variant-numeric: tabular-nums; }
</style>
