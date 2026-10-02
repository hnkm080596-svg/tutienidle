<script setup lang="ts">
// Scene 11 detail-panel header (ref: recipe name + grade chips +
// pill art tile). Canonical content = pill name + profession grade;
// the recipe icon tile is temp art until per-recipe art exists.
import { useI18n } from 'vue-i18n'

defineProps<{
  pillName: string
  gradeLabel: string
  gradeColor: string | undefined
}>()
const { t } = useI18n()
</script>

<template>
  <header class="alchemy-detail__header">
    <i class="alchemy-detail__recipe-icon art-needed" data-art-id="alchemy-recipe-icon" aria-hidden="true" />
    <div class="alchemy-detail__header-text">
      <span>{{ t('alchemy.recipe') }}</span>
      <h3>{{ pillName }}</h3>
      <small class="alchemy-detail__grade-chip" :style="{ color: gradeColor }">{{ gradeLabel }}</small>
    </div>
  </header>
</template>

<style scoped>
.alchemy-detail__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--scene-fire-accent) 32%, var(--paper-line));
  border-radius: var(--radius-md);
  background: linear-gradient(110deg, color-mix(in srgb, var(--scene-fire-accent) 12%, var(--paper-50)), color-mix(in srgb, var(--scene-fire-accent) 4%, var(--paper-100)));
}
.alchemy-detail__header span { color: var(--cinnabar); font-size: var(--text-xs); letter-spacing: .18em; }
.alchemy-detail__header h3 { margin: 3px 0; color: var(--paper-text); font: 700 var(--text-panel-title) var(--font-display); }
.alchemy-detail__header small { color: var(--paper-text-soft); }
.alchemy-detail__header-text { min-width: 0; }
.alchemy-detail__grade-chip { font-weight: 700; }

/* Ref: square recipe art tile (temp art — molten pill vignette). */
.alchemy-detail__recipe-icon {
  flex: 0 0 auto;
  width: 52px;
  height: 52px;
  border-radius: var(--radius-sm);
  background: radial-gradient(circle at 40% 32%, color-mix(in srgb, var(--scene-fire-accent) 80%, #ffe1b0), var(--scene-fire-accent) 50%, #34160e);
  border: 1px solid color-mix(in srgb, var(--scene-fire-glow, #d8a24a) 60%, transparent);
  box-shadow: inset 0 0 10px rgba(0, 0, 0, .35), 0 0 10px color-mix(in srgb, var(--scene-fire-accent) 30%, transparent);
}
</style>
