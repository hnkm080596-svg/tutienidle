<script setup lang="ts">
// Scene 08 detail-panel `Thuoc Tinh Tang` block: one icon + stat label +
// delta row per gain the viewed unit confers.
import { useI18n } from 'vue-i18n'
import type { BodyGainView } from './bodySceneModel'

defineProps<{
  gains: BodyGainView[]
}>()

const { t } = useI18n()
</script>

<template>
  <section class="body-gains" :aria-label="t('panels.body.sections.gains')">
    <h3 class="body-gains__title">{{ t('panels.body.sections.gains') }}</h3>
    <ul class="body-gains__list">
      <li
        v-for="gain in gains"
        :key="gain.label"
        class="body-gains__row"
        :data-stat="gain.stat ?? undefined"
      >
        <span class="body-gains__icon art-needed" :data-art-id="`body-stat-icon-${gain.stat ?? 'misc'}`" aria-hidden="true" />
        <span class="body-gains__label">{{ gain.label }}</span>
        <span class="body-gains__value">{{ gain.value }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.body-gains { display: flex; flex-direction: column; gap: 6px; }
.body-gains__title {
  margin: 0;
  font-family: var(--font-display, serif);
  font-weight: 700;
  font-size: var(--text-sm);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--hk-gold, #b99a55);
}
.body-gains__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.body-gains__row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.body-gains__icon {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid var(--hk-border-ceremony, #b99a55);
  background:
    radial-gradient(circle at 35% 30%, rgba(63, 166, 139, 0.5) 0%, transparent 60%),
    var(--hk-surface-raised, #131b17);
}
.body-gains__label {
  flex: 1;
  min-width: 0;
  font-size: var(--text-sm);
  color: var(--hk-text-primary, #ede6d6);
}
.body-gains__value {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  font-size: var(--text-sm);
  color: var(--hk-jade-soft, #67c4ab);
}
</style>
