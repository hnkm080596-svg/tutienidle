<script setup lang="ts">
// Scene 08 tier-chip region: one selector chip per chapter unit (Luyen
// The tier, Bat Mach vessel, Chu Thien milestone). Locked = ink + lock
// glyph per audit; active = gold seal; done = jade.
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import type { BodyChipView } from './bodySceneModel'

defineProps<{
  chip: BodyChipView
  selected: boolean
}>()

const emit = defineEmits<{ select: [id: string] }>()
const { t } = useI18n()
</script>

<template>
  <button
    type="button"
    class="body-tier-chip"
    :class="[`body-tier-chip--${chip.status}`, { 'is-selected': selected }]"
    :title="chip.hint"
    :aria-pressed="selected"
    @click="emit('select', chip.id)"
  >
    <InkNineSlice
      chrome-id="seal-chip"
      layer="frame"
      :tint-var="chip.status === 'done' ? 'var(--hk-jade, #3fa68b)' : chip.status === 'active' ? 'var(--chip-active-bg, var(--hk-gold))' : undefined"
    />
    <span v-if="chip.status === 'locked'" class="body-tier-chip__lock" aria-hidden="true">
      <svg viewBox="0 0 10 10" class="body-tier-chip__lock-icon">
        <rect x="2" y="4.5" width="6" height="4.5" rx="1" fill="currentColor" />
        <path d="M3 4.5V3a2 2 0 0 1 4 0v1.5" fill="none" stroke="currentColor" stroke-width="1.1" />
      </svg>
    </span>
    <span class="body-tier-chip__label">{{ chip.label }}</span>
    <span v-if="chip.status === 'locked'" class="body-tier-chip__state">{{ t('panels.body.states.locked') }}</span>
  </button>
</template>

<style scoped>
.body-tier-chip {
  position: relative;
  isolation: isolate;
  flex: 1 1 0;
  min-width: 0;
  min-height: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 6px 8px;
  border: 0;
  border-radius: var(--hk-radius-sm, 6px);
  background: transparent;
  color: var(--hk-text-secondary, #b8ae97);
  font-family: var(--font-body);
  font-weight: 600;
  font-size: var(--text-xs);
  cursor: pointer;
}
.body-tier-chip__lock {
  position: relative;
  z-index: 3;
  width: 10px;
  height: 10px;
  color: var(--hk-ink, #5b6266);
  line-height: 1;
}
.body-tier-chip__lock-icon { width: 100%; height: 100%; display: block; }
.body-tier-chip__label {
  position: relative;
  z-index: 3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.body-tier-chip__state {
  position: relative;
  z-index: 3;
  font-size: 9px;
  font-weight: 500;
  color: var(--hk-ink, #5b6266);
}
.body-tier-chip:hover .body-tier-chip__label { color: var(--hk-text-primary, #ede6d6); }

.body-tier-chip--active .body-tier-chip__label {
  color: var(--hk-gold-radiant, #f4d98b);
}
.body-tier-chip--done .body-tier-chip__label {
  color: var(--hk-jade-soft, #67c4ab);
}
.body-tier-chip--locked { color: var(--hk-ink, #5b6266); }

.body-tier-chip.is-selected {
  filter: drop-shadow(0 0 5px var(--hk-glow-gold, rgba(232, 195, 90, 0.4)));
}
</style>
