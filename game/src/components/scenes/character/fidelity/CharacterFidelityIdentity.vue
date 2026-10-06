<script setup lang="ts">
// Portrait column (G3 mock): name + realm/path line, the dao-path idle
// figure, and the Suc Manh card docked at the bottom. R12: the card's
// hover tooltip breaks combat power down per formula term.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CharacterUiModel } from './characterUi'
import CharacterFidelityFigure from './CharacterFidelityFigure.vue'
const props = defineProps<{ model: CharacterUiModel }>()
const { t } = useI18n()
const powerTooltip = computed(() => {
  const sources = props.model.powerSources
  if (!sources?.length) return undefined
  const rows = sources.map((row) => `${row.label}: +${row.value}`).join('\n')
  return `${t('character.powerSources')}\n${rows}\n${t('character.powerFormula')}`
})
// The dao verse renders as a couplet (Minh ruling): one vertical
// column per clause flanking the idle figure - first clause on the
// left, second on the right.
const couplet = computed(() => {
  const clauses = props.model.pathVerse?.split('·').map((clause) => clause.trim()).filter(Boolean)
  const [first, second] = clauses ?? []
  if (!first || !second) return undefined
  // Each word drops one line so the columns read as a Vietnamese couplet.
  return { left: first.split(/\s+/), right: second.split(/\s+/) }
})
</script>
<template>
  <section class="character-portrait">
    <h2>{{ model.name }}</h2>
    <p class="character-portrait__line">{{ model.realm }}<template v-if="model.path"> · {{ model.path }}</template></p>
    <CharacterFidelityFigure />
    <template v-if="couplet">
      <span class="character-couplet character-couplet--left"><em v-for="word in couplet.left" :key="word">{{ word }}</em></span>
      <span class="character-couplet character-couplet--right"><em v-for="word in couplet.right" :key="word">{{ word }}</em></span>
    </template>
    <div class="character-card character-power" v-tooltip="powerTooltip">
      <h3>{{ t('character.power') }}</h3>
      <b>{{ model.combatPower }}</b>
    </div>
  </section>
</template>
<style scoped>
.character-portrait { position: relative; text-align: center; min-height: 0; color: #302519; }
.character-portrait h2 { font-size: 24px; margin: 0; font-weight: 650; }
.character-portrait__line { font-size: 14px; margin: 6px; white-space: nowrap; }
/* Couplet columns (Minh ruling): Vietnamese words stacked one per line
   flanking the figure like a câu đối. Top/bottom track the figure zone
   (15%..88%) so the columns sit beside the art, not under the name. */
.character-couplet { position: absolute; top: 19%; bottom: 19%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; pointer-events: none; }
.character-couplet em { font-style: normal; font: 700 13px/1.3 var(--pc-font-title, serif); letter-spacing: .12em; color: #8a6420; text-shadow: 0 0 3px rgba(240,214,150,.45), 0 1px 1px #000; white-space: nowrap; }
.character-couplet--right { right: 4%; }
.character-couplet--left { left: 4%; }
.character-portrait .character-power { position: absolute; bottom: 0; left: 0; right: 0; padding: 8px 16px; }
.character-power h3 { margin: 0; font-size: 16px; font-weight: 500; }
.character-power b { font-size: 29px; color: #dfbc71; font-variant-numeric: tabular-nums; }
</style>
