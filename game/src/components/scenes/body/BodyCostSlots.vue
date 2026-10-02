<script setup lang="ts">
// Scene 08 detail-panel `Dieu Kien` block: the material requirement
// slots for the viewed unit.
import { useI18n } from 'vue-i18n'
import type { BodyCostView } from './bodySceneModel'
import BodyCostSlot from './BodyCostSlot.vue'

defineProps<{
  costs: BodyCostView[]
}>()

const { t } = useI18n()
</script>

<template>
  <section v-if="costs.length" class="body-costs" :aria-label="t('panels.body.sections.requirements')">
    <h3 class="body-costs__title">{{ t('panels.body.sections.requirements') }}</h3>
    <div class="body-costs__grid">
      <BodyCostSlot v-for="cost in costs" :key="cost.id" :cost="cost" />
    </div>
  </section>
</template>

<style scoped>
.body-costs { display: flex; flex-direction: column; gap: 6px; }
.body-costs__title {
  margin: 0;
  font-family: var(--font-display, serif);
  font-weight: 700;
  font-size: var(--text-sm);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--hk-gold, #b99a55);
}
.body-costs__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
  gap: 6px;
}
</style>
