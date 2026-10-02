<script setup lang="ts">
// Spec 14 title-band 436/120/800/80: the realm card IS the centered
// title band - realm name + chapter progress move here from the
// top-right corner (audit CORRECTED: realm label from tribulation
// targetRealmId, progress = chapter x/y). The flame row is the
// temp-art strike marker row.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  realmName: string
  chapterProgress: string
  strikesTaken: number
}>()
const { t } = useI18n()
const flames = computed(() => Math.min(props.strikesTaken, 7))
</script>

<template>
  <div class="tribulation-realm-card" data-hk-region="realm-card">
    <p class="tribulation-realm-card__title">{{ t('tribulation.overlay.realmCardTitle', { name: realmName }) }}</p>
    <p class="tribulation-realm-card__progress">{{ t('tribulation.overlay.progressLabel') }}: {{ chapterProgress }}</p>
    <div class="tribulation-realm-card__flames" aria-hidden="true">
      <i v-for="n in flames" :key="n" class="tribulation-realm-card__flame art-needed" data-art-id="tribulation-realm-flame" />
    </div>
  </div>
</template>

<style scoped>
.tribulation-realm-card {
  position: absolute;
  top: 12.75%;
  left: 50%;
  transform: translateX(-50%);
  width: min(47.85%, 800px);
  min-width: 150px;
  padding: 10px 14px;
  text-align: center;
  isolation: isolate;
  border-radius: var(--radius-md);
  /* Near-solid fill: the band sits over the canvas' glowing chapter
     title - at .5 alpha the art bled through and erased the top half
     of the realm title text. */
  background: linear-gradient(180deg, rgba(16, 23, 24, .94), rgba(16, 23, 24, .88));
  border: 1px solid color-mix(in srgb, var(--hk-gold-muted, #b99a55) 45%, transparent);
}
.tribulation-realm-card__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--hk-gold-muted, #b99a55);
}
.tribulation-realm-card__progress { margin: 4px 0 0; font-size: var(--text-xs); color: var(--scene-tribulation-text-soft); }
.tribulation-realm-card__flames { display:flex; justify-content:center; gap:4px; margin-top:6px; }
.tribulation-realm-card__flame {
  width: 11px;
  height: 15px;
  clip-path: polygon(50% 0%, 82% 28%, 100% 62%, 84% 100%, 16% 100%, 0% 62%, 18% 28%);
  background: radial-gradient(circle at 50% 70%, #ffd489, var(--hk-gold-muted, #b99a55) 60%, #6b4c1e);
  box-shadow: 0 0 6px color-mix(in srgb, #ffd489 70%, transparent);
}
</style>
