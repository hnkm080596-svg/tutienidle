<script setup lang="ts">
// Scene 02 section header - engraved seal chip + section title + optional
// right-aligned hint (ref: icon disc left, hint text right). The medallion
// is TEMP ART; the glyph inside it is delivered stable symbol art.
import HuyenKimSymbol from '@/components/common/HuyenKimSymbol.vue'
import type { StableSymbolId } from '@/presentation/huyenKim/StableSceneArt'

defineProps<{
  icon: StableSymbolId
  title: string
}>()
</script>

<template>
  <header class="creation-section-header">
    <span
      class="creation-section-header__seal art-needed"
      data-art-id="creation-section-seal"
      aria-hidden="true"
    >
      <HuyenKimSymbol :name="icon" />
    </span>
    <h2 class="creation-section-header__title">{{ title }}</h2>
    <span v-if="$slots.hint" class="creation-section-header__hint"><slot name="hint" /></span>
  </header>
</template>

<style scoped>
.creation-section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: clamp(4px, 0.8vh, 8px);
}

/* Engraved circular medallion - ink disc, muted-gold ring, gold glyph. */
.creation-section-header__seal {
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  border-radius: 50%;
  color: var(--hk-gold, #b99a55);
  font-size: 11px;
  background:
    radial-gradient(60% 60% at 50% 42%, #315f55 30%, #101718 100%);
  box-shadow:
    inset 0 0 0 1.5px var(--hk-gold-muted, #7a6234),
    inset 0 1px 2px rgba(237, 230, 214, 0.14),
    0 1px 3px rgba(5, 8, 9, 0.5);
}

.creation-section-header__title {
  margin: 0;
  /* section titles sit on ivory scroll paper -> dark ink, not light text */
  color: #2e2a22;
  font: 600 var(--text-sm, 14px) var(--hk-font-display, var(--font-display));
  letter-spacing: 0.05em;
}

.creation-section-header__hint {
  margin-left: auto;
  color: #6b6151;
  font-size: var(--text-xs);
  white-space: nowrap;
}
</style>
