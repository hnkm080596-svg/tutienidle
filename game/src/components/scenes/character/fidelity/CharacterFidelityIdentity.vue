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
</script>
<template>
  <section class="character-portrait">
    <h2>{{ model.name }}</h2>
    <p class="character-portrait__line">{{ model.realm }} · {{ model.path }}</p>
    <p v-if="model.pathVerse" class="character-portrait__verse">{{ model.pathVerse }}</p>
    <CharacterFidelityFigure />
    <div class="character-card character-power" v-tooltip="powerTooltip">
      <h3>{{ t('character.power') }}</h3>
      <b>{{ model.combatPower }}</b>
    </div>
  </section>
</template>
<style scoped>
.character-portrait { position: relative; text-align: center; min-height: 0; color: #302519; }
.character-portrait h2 { font-size: 24px; margin: 0; font-weight: 650; }
.character-portrait__line { font-size: 15px; margin: 6px; }
.character-portrait__verse { margin: -4px 0 0; font-size: 11px; letter-spacing: 0.5px; color: #8a6420; }
.character-portrait .character-power { position: absolute; bottom: 0; left: 0; right: 0; padding: 8px 16px; }
.character-power h3 { margin: 0; font-size: 16px; font-weight: 500; }
.character-power b { font-size: 29px; color: #dfbc71; font-variant-numeric: tabular-nums; }
</style>
