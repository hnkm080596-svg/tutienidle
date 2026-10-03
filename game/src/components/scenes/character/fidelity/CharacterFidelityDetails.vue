<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { CharacterUiDetail, CharacterUiModel } from './characterUi'
import { buildStatSourceTooltip } from './statSources'
import type { StatType } from '@/core/stats/StatTypes'
defineProps<{ model: CharacterUiModel }>()
const { t } = useI18n()
// Chi Tiet is always open (the old show/hide toggle is gone); rows
// carry the same per-source hover breakdown as the main stat list.
const rowTooltip = (row: CharacterUiDetail) =>
  buildStatSourceTooltip(row.id as StatType, row, t)
</script>
<template>
  <aside class="cf-details">
    <h2 class="cf-details__heading"><span>{{ t('character.details') }}</span></h2>
    <div class="cf-details__body">
      <section v-for="group in (['combat', 'other'] as const)" :key="group" class="cf-details__section">
        <h3>{{ t(`character.${group}`) }}</h3>
        <dl><div v-for="row in model[group]" :key="row.id" class="cf-detail-row" v-tooltip="rowTooltip(row)"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div></dl>
      </section>
    </div>
  </aside>
</template>
<style scoped>
.cf-details { position: absolute; left: 1160px; top: 174px; width: 252px; height: 540px; padding: 0 23px; border-left: 1px solid #96815260; z-index: 5; color: #30291d; }
/* Heading is static now - same look, no toggle affordance. */
.cf-details__heading { position: relative; display: flex; justify-content: space-between; align-items: center; margin: 0; padding: 0 0 11px; border-bottom: 1px solid #8d754c80; color: #4b3822; font-size: 22px; line-height: 25px; font-weight: 500; }
.cf-details__body { position: relative; height: 475px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #7f714c transparent; }
.cf-details__section h3 { font-size: 14px; color: #745730; margin: 16px 0 6px; font-weight: 600; }.cf-details__section dl { margin: 0; }
.cf-detail-row { display: flex; justify-content: space-between; gap: 8px; padding: 7px 0; border-bottom: 1px solid #96815230; font-size: 13px; line-height: 17px; }.cf-detail-row dt { color: #4e4430; }.cf-detail-row dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; color: #241e10; }
</style>
