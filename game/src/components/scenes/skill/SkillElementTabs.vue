<script setup lang="ts">
// Scene 07 element-tabs region (spec: 516/176/640/48, navigation
// family, tab-seal; pre-commitment only — the parent renders this only
// when the model still shows element branches). Each tab carries the
// element's identity color; the committed element fills jade→element.
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { ELEMENT_LABELS, ELEMENT_COLOR_VARS } from '@/core/element/ElementLabels'
import type { ElementType } from '@/core/element/ElementType'

defineProps<{
  elements: readonly ElementType[]
  selected: ElementType
  committed: ElementType | null | undefined
}>()

const emit = defineEmits<{ select: [element: ElementType] }>()

const { t } = useI18n()
</script>

<template>
  <div
    class="skill-path-panel__element-tabs"
    role="group"
    :aria-label="t('panels.skillPath.elementTabs.aria')"
    data-hk-region="element-tabs"
  >
    <button
      v-for="element in elements"
      :key="element"
      type="button"
      class="skill-path-panel__element-tab"
      :class="{ 'is-selected': element === selected, 'is-committed': element === committed }"
      :style="{ '--element-color': ELEMENT_COLOR_VARS[element] }"
      @click="emit('select', element)"
    >
      <InkNineSlice
        chrome-id="tab-seal"
        layer="surface"
        :tint-var="element === selected ? '--hk-jade' : undefined"
      />
      <span class="skill-path-panel__element-tab-label">{{ ELEMENT_LABELS[element] }}</span>
    </button>
  </div>
</template>

<style scoped>
.skill-path-panel__element-tabs {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.skill-path-panel__element-tab {
  position: relative;
  isolation: isolate;
  padding: 4px 14px;
  background: none;
  border: 0;
  color: var(--element-color, var(--hk-text-secondary, #b8ae97));
  font-family: var(--font-body);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: color var(--hk-motion-micro, 150ms) var(--hk-ease-standard, ease);
}
.skill-path-panel__element-tab-label {
  position: relative;
  z-index: 3;
  color: var(--element-color, var(--hk-text-secondary, #b8ae97));
}
.skill-path-panel__element-tab.is-selected .skill-path-panel__element-tab-label {
  font-weight: 600;
  color: var(--hk-text-primary, #ede6d6);
  text-shadow: 0 0 8px var(--element-color, transparent);
}
.skill-path-panel__element-tab.is-committed .skill-path-panel__element-tab-label {
  font-weight: 600;
}
</style>
