<script setup lang="ts">
import GameCard from "@/components/common/GameCard.vue"
import CharacterCardTitle from './CharacterCardTitle.vue'
// Central column (G3 mock): main-stats card (gold tubes + energy shimmer),
// Thien Phu card (icon + name, hover shows the talent description - R10),
// Ngu Hanh card (ivory element pucks + share). Stat rows keep the
// per-source hover breakdown (R38).
import { useI18n } from 'vue-i18n'
import { symbolUrl } from '../../dong-fu/fidelity/dongFuUi'
import { elementArt, talentGlyph, type CharacterUiModel, type CharacterUiStat, type CharacterUiTalent } from './characterUi'
import { buildStatSourceTooltip } from './statSources'
import { getTalentDefinition } from '@/data/talent/Talents'
import { buildTalentTooltip } from '@/composables/useTalentTooltip'
import type { StatType } from '@/core/stats/StatTypes'
defineProps<{ model: CharacterUiModel }>()
const emit = defineEmits<{ select: [id: string]; allocate: [id: string] }>()
const { t } = useI18n()
// Aggregate board: hovering a stat row shows where the value comes
// from (base + each contributing source and its amount).
const statTooltip = (stat: CharacterUiStat) =>
  buildStatSourceTooltip(stat.id as StatType, stat, t)
const talentTooltip = (talent: CharacterUiTalent) => {
  const definition = getTalentDefinition(talent.id)
  return definition ? buildTalentTooltip(definition, t) : { title: talent.name, description: talent.description }
}
const talentIconError = (event: Event) => {
  const img = event.target as HTMLImageElement
  if (!img.dataset.fallback) {
    img.dataset.fallback = '1'
    img.src = symbolUrl('technique')
  }
}
</script>
<template>
  <section class="character-central">
    <GameCard as="div" class="character-card character-mainstats">
      <template #title><CharacterCardTitle :label="t('character.mainStats')" /></template>
      <div
        v-for="stat in model.stats"
        :key="stat.id"
        class="character-stat-row"
        v-tooltip="statTooltip(stat)"
      >
        <span class="character-stat-name">
          <span>{{ stat.label }}</span>
          <button v-if="stat.allocatable" class="character-allocate" type="button" :aria-label="`${t('character.allocate')} ${stat.label}`" @click.stop="emit('allocate', stat.id)">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2 2 8h4v6h4V8h4Z" fill="currentColor" /></svg>
          </button>
          <em v-else-if="stat.capped" class="character-stat-max">{{ t('character.max') }}</em>
        </span>
        <span class="character-stat-tube"><i :style="{ width: `${Math.min(100, Math.max(0, stat.fill))}%` }" /></span>
      </div>
    </GameCard>
    <GameCard as="div" class="character-card character-small-card">
      <template #title><CharacterCardTitle :label="t('character.elements')" /></template>
      <div class="character-element-row">
        <span
          v-for="element in model.elements"
          :key="element.id"
          class="character-element"
          :aria-label="element.name"
          v-tooltip="{ title: element.name, description: t('character.elementNotice', { name: element.name, power: element.power, resistance: element.resistance, penetration: element.penetration }) }"
        ><img :src="elementArt(element.id)" :alt="element.name"><b>{{ element.share }}</b></span>
      </div>
    </GameCard>
    <GameCard as="div" class="character-card character-small-card">
      <template #title><CharacterCardTitle :label="t('character.talent')" /></template>
      <span
        v-for="talent in model.talents"
        :key="talent.id"
        class="character-talent"
        v-tooltip="talentTooltip(talent)"
      ><img :src="talentGlyph(talent.id)" alt="" @error="talentIconError"><span>{{ talent.name }}</span></span>
    </GameCard>
  </section>
</template>
<style scoped>
.character-central { display: grid; grid-template-rows: minmax(0, 1fr) auto var(--character-footer-card-height, 96px); gap: 24px; min-height: 0; }
.character-mainstats { display: flex; flex-direction: column; justify-content: space-evenly; }
/* Rows: compact name/action | value, then a full-width tube. */
.character-stat-row { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); gap: 3px; padding: 3px 0; font-size: 15px; line-height: 1.2; min-height: 40px; }
.character-stat-name { display: inline-flex; align-items: center; gap: 5px; min-width: 0; white-space: nowrap; }
/* Gold tubes (user ruling 2026-10-06): one shared metallic gradient for
   every stat - the old per-stat colors went away with the G3 reskin. */
.character-stat-tube { grid-column: 1 / -1; position: relative; height: 9px; border: 1px solid #927747; border-radius: 9px; background: #111912; overflow: hidden; box-shadow: inset 0 2px 3px #0009; }
.character-stat-tube i { display: block; height: 100%; border-radius: 7px; background: linear-gradient(90deg, #8a6420, #dfbc71); box-shadow: inset 0 2px 2px #fff5; position: relative; overflow: hidden; transition: width .45s cubic-bezier(.25,.8,.35,1); }
.character-stat-tube i::after { content: ''; position: absolute; inset: 0; background: linear-gradient(100deg, transparent 10%, #ffffff18 30%, #fff8 48%, #ffffff20 60%, transparent 80%); width: 60%; transform: translateX(-160%); animation: stat-energy-flow 2.8s linear infinite; }
.character-stat-row:nth-of-type(3) .character-stat-tube i::after { animation-delay: -.7s; }
.character-stat-row:nth-of-type(4) .character-stat-tube i::after { animation-delay: -1.4s; }
.character-stat-row:nth-of-type(5) .character-stat-tube i::after { animation-delay: -2.1s; }
@keyframes stat-energy-flow { to { transform: translateX(270%); } }
@media (prefers-reduced-motion: reduce) { .character-stat-tube i { transition: none; } .character-stat-tube i::after { animation: none; transform: translateX(65%); opacity: .3; } }
.character-allocate { flex: 0 0 20px; display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; padding: 2px; border: 0; background: transparent; color: #76d995; cursor: pointer; }
.character-allocate svg { width: 16px; height: 16px; }
.character-allocate:hover { color: #a4ffc1; }
.character-allocate:focus-visible { outline: 1px solid #76d995; outline-offset: 1px; border-radius: 3px; }
.character-stat-max { flex: none; margin: 0; font: 700 11px/1 var(--pc-font-body, serif); letter-spacing: .04em; color: #efce80; }
.character-talent { display: inline-flex; align-items: center; gap: 10px; margin: 0 12px 4px 0; padding: 0; border: 0; background: none; color: inherit; font-size: 13px; cursor: default; text-align: left; }
.character-talent img { width: 24px; height: 24px; object-fit: contain; }
.character-element-row { display: flex; justify-content: space-between; align-items: center; }
.character-element { display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: none; color: inherit; font-size: 13px; cursor: default; }
.character-element img { width: 27px; height: 27px; object-fit: contain; }
.character-element b { font-size: 13px; }
</style>
