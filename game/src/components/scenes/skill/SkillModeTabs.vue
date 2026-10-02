<script setup lang="ts">
// Scene 07 mode-tabs region (spec: 516/708/640/44, navigation family,
// tab-seal). Tree/Detail toggle - M-QI-05 (D7): selected = jade tint.
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'

defineProps<{ mode: 'tree' | 'detail' }>()

const emit = defineEmits<{ select: [mode: 'tree' | 'detail'] }>()

const { t } = useI18n()
</script>

<template>
  <div
    class="skill-path-panel__mode-tabs"
    role="group"
    :aria-label="t('panels.skillPath.centerTabs.aria')"
    data-hk-region="mode-tabs"
  >
    <button
      type="button"
      class="skill-path-panel__mode-tab art-needed"
      data-art-id="skill-mode-tab-seal"
      :class="{ 'is-selected': mode === 'tree' }"
      @click="emit('select', 'tree')"
    >
      <InkNineSlice chrome-id="tab-seal" layer="surface" :tint-var="mode === 'tree' ? '--hk-jade' : undefined" />
      <span class="skill-path-panel__mode-tab-label">{{ t('panels.skillPath.centerTabs.tree') }}</span>
    </button>
    <button
      type="button"
      class="skill-path-panel__mode-tab art-needed"
      data-art-id="skill-mode-tab-seal"
      :class="{ 'is-selected': mode === 'detail' }"
      @click="emit('select', 'detail')"
    >
      <InkNineSlice chrome-id="tab-seal" layer="surface" :tint-var="mode === 'detail' ? '--hk-jade' : undefined" />
      <span class="skill-path-panel__mode-tab-label">{{ t('panels.skillPath.centerTabs.detail') }}</span>
    </button>
  </div>
</template>

<style scoped>
.skill-path-panel__mode-tabs {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  /* Spec 07 mode-tabs band 516/708/640/44 -> 4.68vh fixed, a 6
     design-px gap under the tree canvas. */
  height: 4.68vh;
  margin-top: 0.64vh;
}
.skill-path-panel__mode-tab {
  position: relative;
  isolation: isolate;
  padding: 4px 14px;
  background: none;
  border: 0;
  color: var(--hk-text-secondary, #b8ae97);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  cursor: pointer;
}
.skill-path-panel__mode-tab-label { position: relative; z-index: 3; }
.skill-path-panel__mode-tab.is-selected { color: var(--hk-jade-soft, #67c4ab); font-weight: 600; }
</style>
