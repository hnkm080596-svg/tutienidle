<script setup lang="ts">
import CharacterIdentityHeader from './CharacterIdentityHeader.vue'
import CharacterTalentSeals from './CharacterTalentSeals.vue'
import CharacterFigureWheel from './CharacterFigureWheel.vue'
import CharacterMainStats from './CharacterMainStats.vue'
import CharacterElementSummary from './CharacterElementSummary.vue'
import CharacterDerivedStats from './CharacterDerivedStats.vue'
import CharacterActionRail from './CharacterActionRail.vue'

// Scene 04 - Nhan Vat (imperial-scroll interior). Region grid follows
// the canonical scene-layout-spec: identity band + talent seals across
// the top, figure+wheel left, five main stats center, element summary
// over derived stats right, action rail in the footer zone. The Chi
// Tiet drawer overlays the right edge (LeftPanel mounts it).
</script>

<template>
  <div class="character-scene">
    <CharacterIdentityHeader class="character-scene__identity" />
    <CharacterTalentSeals class="character-scene__talents" />
    <CharacterFigureWheel class="character-scene__figure" />
    <CharacterMainStats class="character-scene__stats" />
    <div class="character-scene__right">
      <CharacterElementSummary class="character-scene__elements" />
      <CharacterDerivedStats class="character-scene__derived" />
    </div>
    <CharacterActionRail class="character-scene__rail" />
  </div>
</template>

<style scoped>
/* Spec fractions (content grid 1244x610): figure 400 | stats 560 |
   right column 252; header 84 + talents 88 over the 418 body band. */
.character-scene {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  /* Spec columns 400 | 560 | 252 on the 1244 band with two 16px gaps:
     fr shares + 1.29% gaps (16/1244) land the total on exactly 100%. */
  grid-template-columns: minmax(0, 400fr) minmax(0, 560fr) minmax(0, 252fr);
  grid-template-rows: minmax(0, auto) minmax(0, auto) minmax(0, 1fr) auto;
  grid-template-areas:
    'identity identity identity'
    'talents talents talents'
    'figure stats rightcol'
    'rail rail rail';
  column-gap: 1.29%;
  row-gap: var(--hk-space-3, 8px);
  color: var(--paper-text);
  font-family: var(--font-body);
}

.character-scene__identity { grid-area: identity; min-height: 0; }
.character-scene__talents { grid-area: talents; min-height: 0; }
.character-scene__figure { grid-area: figure; min-height: 0; }
.character-scene__stats { grid-area: stats; min-height: 0; }

.character-scene__right {
  grid-area: rightcol;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 48%) minmax(0, 52%);
  row-gap: var(--hk-space-3, 8px);
}
.character-scene__elements,
.character-scene__derived { min-height: 0; min-width: 0; }

/* The right column is ~193px but the shared section plaque's floor +
   rigid 44px orns make each card's min-content ~285px - the cards
   overflow their track and their right-aligned values clip at the
   envelope rim. Let the plaque and its flourishes shrink here. */
.character-scene__right :deep(.section-plaque) {
  box-sizing: border-box;
  min-width: 0;
  width: 100%;
}
.character-scene__right :deep(.section-plaque__orn) { flex: 0 1 44px; }
.character-scene__right :deep(.section-plaque__title) {
  overflow: hidden;
  text-overflow: ellipsis;
}

.character-scene__rail { grid-area: rail; min-height: 0; }

@container (max-width: 900px) {
  .character-scene {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto auto auto auto;
    grid-template-areas:
      'identity' 'talents' 'figure' 'stats' 'rightcol' 'rail';
    overflow-y: auto;
  }
  .character-scene__right {
    grid-template-rows: auto auto;
  }
}
</style>
