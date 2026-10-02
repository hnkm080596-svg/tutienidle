<script setup lang="ts">
// Scene 15/16 defeat title region (spec: 576/140/520/96, ornament,
// ceremony-ribbon with cinnabar tint - delivered). Ref adds a subtitle
// motto under the brush title.
import { hkChromeUrl } from '@/ui/huyenKimChrome'

defineProps<{
  title: string
  subtitle: string
}>()
const ribbonUrl = hkChromeUrl('ceremony-ribbon')
</script>

<template>
  <div class="combat-defeat-panel__title-band" data-hk-region="title">
    <img v-if="ribbonUrl" :src="ribbonUrl" alt="" aria-hidden="true" />
    <h2 class="combat-defeat-panel__title">{{ title }}</h2>
    <p class="combat-defeat-panel__subtitle">{{ subtitle }}</p>
  </div>
</template>

<style scoped>
.combat-defeat-panel__title-band {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 76px;
  margin: -10px 0 4px;
}
.combat-defeat-panel__title-band img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
  pointer-events: none;
  /* Defeat variation: wash the ribbon toward ink/cinnabar. */
  filter: sepia(0.45) hue-rotate(-18deg) saturate(1.3);
}
.combat-defeat-panel__title {
  position: relative;
  margin: 0;
  font-family: var(--font-display);
  color: var(--crimson);
  font-size: var(--text-display-lg);
  letter-spacing: 0.22em;
}
/* Ref: small motto under the brush title, ivory-on-ink. */
.combat-defeat-panel__subtitle {
  position: relative;
  margin: 6px 0 0;
  font-size: var(--text-xs);
  font-style: italic;
  color: var(--chrome-100);
  text-shadow: 0 1px 4px rgba(0, 0, 0, .7);
}
</style>
