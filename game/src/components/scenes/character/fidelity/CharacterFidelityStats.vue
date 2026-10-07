<script setup lang="ts">
// Central column (G3 mock): main-stats card (gold tubes + energy shimmer),
// Thien Phu card (icon + name, hover shows the talent description - R10),
// Ngu Hanh card (ivory element pucks + share). Stat rows keep the
// per-source hover breakdown (R38).
import { useI18n } from 'vue-i18n'
import { symbolUrl } from '../../dong-fu/fidelity/dongFuUi'
import { CHARACTER_ART, elementArt, talentGlyph, type CharacterUiModel, type CharacterUiStat, type CharacterUiTalent } from './characterUi'
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
    <div class="character-card character-mainstats">
      <div
        v-for="stat in model.stats"
        :key="stat.id"
        class="character-stat-row"
        v-tooltip="statTooltip(stat)"
      >
        <span>{{ stat.label }}</span>
        <b>{{ stat.value }}</b>
        <span class="character-stat-tube"><i :style="{ width: `${Math.min(100, Math.max(0, stat.fill))}%` }" /></span>
        <button
          v-if="stat.allocatable"
          class="character-allocate"
          :aria-label="`${t('character.allocate')} ${stat.label}`"
          @click.stop="emit('allocate', stat.id)"
        ><img :src="CHARACTER_ART.plus" alt=""></button>
        <em v-else-if="stat.capped" class="character-stat-max">{{ t('character.max') }}</em>
      </div>
    </div>
    <div class="character-card character-small-card">
      <h2>{{ t('character.talent') }}</h2>
      <button
        v-for="talent in model.talents"
        :key="talent.id"
        class="character-talent"
        v-tooltip="talentTooltip(talent)"
        @click="emit('select', `talent.${talent.id}`)"
      ><img :src="talentGlyph(talent.id)" alt="" @error="talentIconError"><span>{{ talent.name }}</span></button>
    </div>
    <div class="character-card character-small-card">
      <h2>{{ t('character.elements') }}</h2>
      <div class="character-element-row">
        <button
          v-for="element in model.elements"
          :key="element.id"
          class="character-element"
          :title="element.name"
          @click="emit('select', `element.${element.id}`)"
        ><img :src="elementArt(element.id)" :alt="element.name"><b>{{ element.share }}</b></button>
      </div>
    </div>
  </section>
</template>
<style scoped>
.character-central { display: grid; grid-template-rows: minmax(0, 1fr) auto auto; gap: 9px; min-height: 0; }
.character-mainstats { display: flex; flex-direction: column; justify-content: space-evenly; }
/* Rows: label | value | [tube under both] | allocate puck. */
.character-stat-row { position: relative; display: grid; grid-template-columns: 1fr auto 39px; gap: 3px 8px; padding: 3px 0; font-size: 15px; line-height: 1.2; min-height: 40px; }
.character-stat-row b { font-size: 15px; font-variant-numeric: tabular-nums; }
/* Gold tubes (user ruling 2026-10-06): one shared metallic gradient for
   every stat - the old per-stat colors went away with the G3 reskin. */
.character-stat-tube { grid-column: 1/3; position: relative; height: 9px; border: 1px solid #927747; border-radius: 9px; background: #111912; overflow: hidden; box-shadow: inset 0 2px 3px #0009; }
.character-stat-tube i { display: block; height: 100%; border-radius: 7px; background: linear-gradient(90deg, #8a6420, #dfbc71); box-shadow: inset 0 2px 2px #fff5; position: relative; overflow: hidden; transition: width .45s cubic-bezier(.25,.8,.35,1); }
.character-stat-tube i::after { content: ''; position: absolute; inset: 0; background: linear-gradient(100deg, transparent 10%, #ffffff18 30%, #fff8 48%, #ffffff20 60%, transparent 80%); width: 60%; transform: translateX(-160%); animation: stat-energy-flow 2.8s linear infinite; }
.character-stat-row:nth-of-type(3) .character-stat-tube i::after { animation-delay: -.7s; }
.character-stat-row:nth-of-type(4) .character-stat-tube i::after { animation-delay: -1.4s; }
.character-stat-row:nth-of-type(5) .character-stat-tube i::after { animation-delay: -2.1s; }
@keyframes stat-energy-flow { to { transform: translateX(270%); } }
@media (prefers-reduced-motion: reduce) { .character-stat-tube i { transition: none; } .character-stat-tube i::after { animation: none; transform: translateX(65%); opacity: .3; } }
.character-allocate { grid-column: 3; grid-row: 1/3; position: relative; z-index: 1; width: 39px; height: 39px; padding: 0; border: 0; background: transparent; align-self: center; cursor: pointer; }
.character-allocate img { width: 100%; height: 100%; object-fit: contain; }
.character-allocate:not(:disabled):hover img { filter: brightness(1.18) drop-shadow(0 0 3px #e8b657); }
.character-allocate:not(:disabled):active img { filter: brightness(.88); transform: translateY(1px); }
.character-allocate:disabled img { opacity: .45; filter: saturate(.4); }
/* Maxed stat: the cap label sits in the allocate slot (where + was),
   vertically centred on the tube row, in bright gold (user ruling). */
.character-stat-max { grid-column: 3; grid-row: 2; align-self: center; justify-self: center; transform: translateY(-4px); font: italic 700 20px/20px var(--pc-font-body, serif); letter-spacing: .14em; text-transform: uppercase; color: #ffe9b3; text-shadow: 0 0 4px #ffd76a, 0 0 10px #e8a93c, 0 0 18px #b8860b, 0 1px 1px #000; }
/* Small cards: icon + name talent rows (hover = description, R10) and
   the five ivory element pucks with share. */
.character-talent { display: inline-flex; align-items: center; gap: 10px; margin: 0 12px 4px 0; padding: 0; border: 0; background: none; color: inherit; font-size: 13px; cursor: pointer; text-align: left; }
.character-talent img { width: 24px; height: 24px; object-fit: contain; }
.character-element-row { display: flex; justify-content: space-between; align-items: center; }
.character-element { display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: none; color: inherit; font-size: 13px; cursor: pointer; }
.character-element img { width: 27px; height: 27px; object-fit: contain; }
.character-element b { font-size: 13px; }
</style>
