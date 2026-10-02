<script setup lang="ts">
// One Thien Co entry row (scene 03 drawer content): state marker +
// title/detail body + CTA button that runs the entry's existing
// navigation. The `list-row` chrome nine-slice owns the row surface when
// the slot is ready; the bordered card below is the fallback path.
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { chromeSlice } from '@/ui/huyenKimChrome'
import type { ThienCoEntry, ThienCoEntryKind } from '@/composables/useThienCoEntries'

const KIND_STATE_CLASS: Record<ThienCoEntryKind, string> = {
  breakthrough: 'hk-state-milestone',
  quest: 'hk-state-available',
  ready: 'hk-state-complete',
  active: 'hk-state-danger',
  upgradeable: 'hk-state-available',
}

defineProps<{
  entry: ThienCoEntry
  /** First row carries the primary CTA emphasis. */
  lead: boolean
}>()

const { t } = useI18n()
const rowSlice = chromeSlice('list-row')
</script>

<template>
  <li
    class="thien-co-rail__entry"
    :data-kind="entry.kind"
    :art-needed="!rowSlice"
    data-art-id="list-row"
  >
    <InkNineSlice v-if="rowSlice" chrome-id="list-row" layer="surface" />
    <span class="thien-co-rail__marker" :class="KIND_STATE_CLASS[entry.kind]" aria-hidden="true" />
    <div class="thien-co-rail__body">
      <p class="thien-co-rail__entry-title">{{ t(entry.titleKey, entry.titleParams ?? {}) }}</p>
      <p class="thien-co-rail__entry-detail">{{ t(entry.detailKey, entry.detailParams ?? {}) }}</p>
    </div>
    <GameButton
      size="sm"
      :variant="lead ? 'primary' : 'secondary'"
      :class="{ 'hk-attention': lead }"
      @click="entry.run()"
    >
      {{ t(entry.ctaKey) }}
    </GameButton>
  </li>
</template>

<style scoped>
.thien-co-rail__entry {
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--hk-space-3, 8px);
  padding: var(--hk-space-3, 8px);
  border: 1px solid var(--hk-border-muted, #2a352f);
  border-radius: var(--hk-radius-md, 8px);
  background: color-mix(in srgb, var(--hk-surface-raised, #131b17) 82%, transparent);
}

.thien-co-rail__entry > :not(.ink-nine-slice) { position: relative; z-index: 2; }

.thien-co-rail__marker {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 6px currentColor;
}

.thien-co-rail__body {
  min-width: 0;
}

.thien-co-rail__entry-title {
  margin: 0;
  color: var(--hk-text-primary, #ede6d6);
  font-family: var(--hk-font-ui, sans-serif);
  font-size: var(--text-xs, 11px);
  font-weight: 600;
  line-height: 1.35;
}

.thien-co-rail__entry-detail {
  margin: 2px 0 0;
  color: var(--hk-text-secondary, #b8ae97);
  font-family: var(--hk-font-ui, sans-serif);
  font-size: var(--text-xs, 11px);
  line-height: 1.4;
}
</style>
