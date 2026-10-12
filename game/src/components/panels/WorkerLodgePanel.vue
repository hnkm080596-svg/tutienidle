<script setup lang="ts">
// Retained as an inert compatibility surface for old imports. Chiêu Hiền
// Quán is represented as an art-only landmark in Architecture; it owns no
// worker, companion, or upgrade controls.
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const artUrl = '/assets/buildings/dong-fu/v2/chi_hien_quan/base.png'
</script>

<template>
  <section class="worker-lodge-panel" data-testid="chi-hien-quan-art-only">
    <img :src="artUrl" alt="" class="worker-lodge-panel__art" />
    <h2>{{ t('panels.wheel.slots.chi_hien_quan') }}</h2>
    <p>{{ t('architecture.artOnly') }}</p>
  </section>
</template>

<style scoped>
.worker-lodge-panel {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 12px;
  padding: 18px;
  color: var(--paper-text);
  background:
    var(--paper-grain) 0 0 / 160px 160px repeat,
    radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--jade) 8%, transparent), transparent 40%),
    linear-gradient(175deg, var(--paper-50) 0%, var(--paper-100) 60%, var(--paper-200) 100%);
}
.worker-lodge-panel__art {
  width: min(42vh, 280px);
  max-height: 42vh;
  object-fit: contain;
}
.worker-lodge-panel h2, .worker-lodge-panel p { margin: 0; text-align: center; }
.worker-lodge-panel p { color: var(--paper-text-muted); }
</style>
