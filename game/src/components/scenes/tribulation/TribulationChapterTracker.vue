<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  chapterNames: readonly string[]
  chapterIndex: number
  label: string
}>()
const names = computed(() => props.chapterNames)
</script>

<template>
  <ol class="tribulation-ui__tracker" data-hk-region="chapter-tracker" :aria-label="label">
    <li
      v-for="(name, index) in names"
      :key="index"
      class="tribulation-ui__tracker-pip"
      :class="{ 'is-done': index < chapterIndex, 'is-current': index === chapterIndex }"
    >
      <span class="tribulation-ui__tracker-step">{{ index + 1 }}</span>
      <span class="tribulation-ui__tracker-name">{{ name }}</span>
    </li>
  </ol>
</template>

<style scoped>
.tribulation-ui__tracker {
  position: absolute;
  top: 72px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tribulation-ui__tracker-pip {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 6px;
  background: rgba(12, 17, 20, 0.82);
  border: 1px solid rgba(213, 183, 116, 0.24);
  font-family: var(--font-display);
  font-size: 13px;
  letter-spacing: 0.04em;
  color: rgba(233, 220, 196, 0.55);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
}

.tribulation-ui__tracker-step {
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
  background: rgba(213, 183, 116, 0.12);
  border: 1px solid rgba(213, 183, 116, 0.3);
  color: rgba(233, 220, 196, 0.7);
}

.tribulation-ui__tracker-pip.is-done {
  color: #d8c396;
  border-color: rgba(213, 183, 116, 0.42);
  background: rgba(18, 25, 28, 0.88);
}

.tribulation-ui__tracker-pip.is-done .tribulation-ui__tracker-step {
  background: rgba(213, 183, 116, 0.22);
  border-color: rgba(213, 183, 116, 0.55);
  color: #f3e7bd;
}

.tribulation-ui__tracker-pip.is-current {
  color: #f7ecd0;
  border-color: rgba(232, 198, 122, 0.85);
  background: linear-gradient(180deg, rgba(36, 46, 48, 0.94), rgba(18, 25, 28, 0.96));
  box-shadow:
    0 0 14px rgba(213, 183, 116, 0.25),
    0 4px 12px rgba(0, 0, 0, 0.55);
}

.tribulation-ui__tracker-pip.is-current .tribulation-ui__tracker-step {
  background: rgba(213, 183, 116, 0.32);
  border-color: #f3e7bd;
  color: #fff6dc;
}
</style>
