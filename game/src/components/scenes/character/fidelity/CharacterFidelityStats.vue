<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { symbolUrl } from '../../dong-fu/fidelity/dongFuUi'
import { elementArt, type CharacterUiModel, type CharacterUiStat } from './characterUi'
import { buildStatSourceTooltip } from './statSources'
import type { StatType } from '@/core/stats/StatTypes'
defineProps<{ model: CharacterUiModel }>()
const emit = defineEmits<{ select: [id: string]; allocate: [id: string] }>()
const { t } = useI18n()
// Aggregate board: hovering a stat row shows where the value comes
// from (base + each contributing source and its amount).
const statTooltip = (stat: CharacterUiStat) =>
  buildStatSourceTooltip(stat.id as StatType, stat, t)
</script>
<template>
  <section class="cf-stats">
    <h2 class="cf-section">{{ t('character.mainStats') }}<small v-if="model.attributePoints > 0" class="cf-points">{{ t('character.points', { count: model.attributePoints }) }}</small></h2>
    <div class="cf-stat-list">
      <div v-for="stat in model.stats" :key="stat.id" class="cf-stat" :style="{ '--stat-color': stat.color }" v-tooltip="statTooltip(stat)">
        <button class="cf-stat__main" @click="emit('select', stat.id)">
          <span class="cf-stat__seal"><img :src="symbolUrl(stat.symbol)" alt=""></span>
          <span class="cf-stat__content"><span class="cf-stat__label"><span>{{ stat.label }}</span><b>{{ stat.value }}<i v-if="stat.capped" class="cf-stat__max">{{ t('character.max') }}</i></b></span><span class="cf-stat__track"><i :style="{ width: `${Math.min(100, Math.max(0, stat.fill))}%` }" /></span></span>
        </button>
        <button v-if="stat.allocatable" class="cf-stat__add" :aria-label="`${t('character.allocate')} ${stat.label}`" @click.stop="emit('allocate', stat.id)">+</button>
      </div>
    </div>
    <h2 class="cf-section cf-section--talent">{{ t('character.talent') }}</h2>
    <button v-for="talent in model.talents" :key="talent.id" class="cf-talent" :class="`cf-talent--${talent.rarity}`" :title="talent.description" @click="emit('select', `talent.${talent.id}`)"><span class="cf-talent__seal"><img :src="symbolUrl('technique')" alt=""></span><span class="cf-talent__text"><strong>{{ talent.name }}</strong><small>{{ talent.description }}</small></span></button>
    <h2 class="cf-section cf-section--elements">{{ t('character.elements') }}</h2>
    <div class="cf-element-summary"><button v-for="element in model.elements" :key="element.id" :title="element.name" @click="emit('select', `element.${element.id}`)"><img :src="elementArt(element.id)" alt=""><span>{{ element.name }}</span><b>{{ element.share }}</b></button></div>
  </section>
</template>
<style scoped>
/* Extended down to the paper's lower margin and tightened so the Ngu
   Hanh summary sits inside the visible column (ref shows it inline) -
   no scrollbar: content fits the region. */
.cf-stats { position: absolute; left: 891px; top: 180px; width: 248px; max-height: 560px; overflow-y: auto; scrollbar-width: none; z-index: 4; color: #302c20; }
.cf-section { display: flex; align-items: center; gap: 9px; justify-content: center; font-size: 18px; font-weight: 500; margin: 0 0 7px; white-space: nowrap; }
.cf-section::before, .cf-section::after { content: ''; flex: 1; height: 1px; background: #a58b50; }
.cf-points { font-size: 12px; color: #8a5a1f; }
.cf-stat-list { display: grid; gap: 7px; }
.cf-stat { display: flex; align-items: center; gap: 6px; }
.cf-stat__main { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; border: 0; background: transparent; padding: 0; color: inherit; cursor: pointer; text-align: left; }
.cf-stat__seal { width: 36px; height: 36px; flex: 0 0 36px; padding: 7px; border-radius: 50%; background: var(--stat-color); border: 2px solid #f5e5b7; box-shadow: 0 0 0 1px #8e7444; }
.cf-stat__seal img { width: 100%; filter: invert(91%) sepia(35%) saturate(251%); }
.cf-stat__content { flex: 1; display: grid; gap: 5px; }.cf-stat__label { display: flex; justify-content: space-between; font-size: 17px; }.cf-stat__label b { font-weight: 650; font-variant-numeric: tabular-nums; letter-spacing: .2px; color: #241e10; }
.cf-stat__max { font-style: normal; font-size: 11px; color: #9a5a1e; margin-left: 4px; }
.cf-stat__add { flex: 0 0 26px; height: 26px; border-radius: 50%; border: 1.5px solid #a5762e; background: linear-gradient(#ffe9ae,#d3a952); color: #4a2f0c; font-size: 17px; line-height: 1; cursor: pointer; }
.cf-stat__track { height: 7px; background: #474839; border: 1px solid #c7b984; border-radius: 5px; overflow: hidden; }.cf-stat__track i { display: block; height: 100%; background: linear-gradient(90deg,var(--stat-color),#fff3c9); }
.cf-section--talent { margin-top: 14px; }
.cf-talent { display: flex; align-items: center; width: 100%; gap: 11px; border: 0; background: none; padding: 0; color: inherit; text-align: left; cursor: pointer; }
.cf-talent + .cf-talent { margin-top: 8px; }
.cf-talent__seal { flex: 0 0 54px; height: 54px; padding: 11px; border: 2px solid #e4c778; border-radius: 50%; background: radial-gradient(circle,#7c5c22,#25261b); box-shadow: 0 0 0 2px #9f7b36, 0 0 12px #dfb95799; }.cf-talent__seal img { width: 100%; filter: invert(90%) sepia(38%) saturate(474%); }
.cf-talent__text { display: grid; gap: 5px; }.cf-talent__text strong { font-size: 15px; font-weight: 500; }.cf-talent__text small { font-size: 12px; line-height: 1.4; }
.cf-section--elements { margin-top: 13px; }.cf-element-summary { display: flex; justify-content: space-between; }.cf-element-summary button { width: 42px; border: 0; background: none; color: #302c20; padding: 0; display: grid; justify-items: center; gap: 3px; cursor: pointer; font-size: 12px; }.cf-element-summary img { width: 36px; height: 36px; border-radius: 50%; }.cf-element-summary b { font-size: 13px; font-weight: 500; }
</style>
