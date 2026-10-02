<script setup lang="ts">
import { computed } from 'vue'
import Eyebrow from '@/components/common/primitives/Eyebrow.vue'
import StatRow from '@/components/common/primitives/StatRow.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { chromeSlice } from '@/ui/huyenKimChrome'
import type { TechniqueDisplaySection } from '@/core/betaScopeTechniqueDomain'

// One labeled section of the technique read-model ("Chiến Đấu", ...):
// plaque-backed eyebrow + verbatim display rows. The .technique-scene__rows
// class on the list preserves the existing DOM test contract.
defineProps<{
  section: TechniqueDisplaySection
}>()

const plaqueSlice = computed(() => chromeSlice('section-plaque'))
</script>

<template>
  <section class="technique-section-block">
    <div class="technique-section-block__head" :art-needed="!plaqueSlice || undefined" data-art-id="section-plaque">
      <InkNineSlice chrome-id="section-plaque" layer="surface" />
      <Eyebrow as="h4">{{ section.label }}</Eyebrow>
    </div>
    <ul class="technique-scene__rows technique-section-block__rows">
      <StatRow v-for="row in section.rows" :key="row.label" :label="row.label" bordered>
        {{ row.value }}
      </StatRow>
    </ul>
  </section>
</template>

<style scoped>
.technique-section-block {
  display: flex;
  flex-direction: column;
  gap: var(--hk-space-1);
}

.technique-section-block__head {
  position: relative;
  isolation: isolate;
  align-self: flex-start;
  padding: 2px var(--hk-space-3);
}

.technique-section-block__head > :not(.ink-nine-slice) {
  position: relative;
  z-index: 2;
}

.technique-section-block__rows {
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
