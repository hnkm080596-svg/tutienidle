<script setup lang="ts">
// Thien Co open drawer (scene 03 spec region `thien-co-open`): the
// right-edge card listing actionable opportunities. The `surface-l-drawer`
// chrome nine-slice owns the card surface when the slot is ready; the
// bordered card below is the fallback path. Entries render as
// DongFuThienCoEntry rows.
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import HuyenKimSymbol from '@/components/common/HuyenKimSymbol.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { chromeSlice } from '@/ui/huyenKimChrome'
import type { ThienCoEntry } from '@/composables/useThienCoEntries'
import DongFuThienCoEntry from './DongFuThienCoEntry.vue'

defineProps<{
  entries: readonly ThienCoEntry[]
}>()

const emit = defineEmits<{
  collapse: []
}>()

const { t } = useI18n()
const drawerSlice = chromeSlice('surface-l-drawer')
</script>

<template>
  <div
    class="thien-co-rail__drawer"
    data-hk-region="thien-co-open"
    :art-needed="!drawerSlice"
    data-art-id="surface-l-drawer"
  >
    <InkNineSlice v-if="drawerSlice" chrome-id="surface-l-drawer" layer="surface" />
    <header class="thien-co-rail__header">
      <span class="thien-co-rail__seal" aria-hidden="true">✦</span>
      <h2 class="thien-co-rail__title">{{ t('home.thienCo.title') }}</h2>
      <GameButton
        shape="circle"
        size="sm"
        variant="ghost"
        class="thien-co-rail__collapse"
        :aria-label="t('home.thienCo.collapse')"
        @click="emit('collapse')"
      >
        <HuyenKimSymbol name="close" />
      </GameButton>
    </header>

    <p v-if="entries.length === 0" class="thien-co-rail__empty">{{ t('home.thienCo.empty') }}</p>

    <ul v-else class="thien-co-rail__list">
      <DongFuThienCoEntry
        v-for="(entry, index) in entries"
        :key="entry.id"
        :entry="entry"
        :lead="index === 0"
      />
    </ul>
  </div>
</template>

<style scoped>
.thien-co-rail__drawer {
  position: absolute;
  isolation: isolate;
  right: 0;
  bottom: calc(100% + var(--hk-space-3, 8px));
  display: flex;
  flex-direction: column;
  gap: var(--hk-space-3, 8px);
  width: clamp(210px, 22vw, 276px);
  max-height: min(66vh, 490px);
  padding: var(--hk-space-4, 12px);
  border: 1px solid var(--hk-border-muted, #2a352f);
  border-radius: var(--hk-radius-lg, 12px);
  background: color-mix(in srgb, var(--hk-surface-base, #0b0f0d) 78%, transparent);
  box-shadow: 0 8px 24px var(--hk-shadow-low, rgba(0, 0, 0, 0.4));
  backdrop-filter: blur(4px);
}

.thien-co-rail__drawer > :not(.ink-nine-slice) { position: relative; z-index: 2; }

.thien-co-rail__header {
  display: flex;
  align-items: center;
  gap: var(--hk-space-3, 8px);
  padding-bottom: var(--hk-space-3, 8px);
  border-bottom: 1px solid var(--hk-border-muted, #2a352f);
}

.thien-co-rail__collapse {
  margin-left: auto;
}

.thien-co-rail__seal {
  color: var(--hk-gold, #c99a4a);
  font-size: var(--text-sm, 12px);
  line-height: 1;
}

.thien-co-rail__title {
  margin: 0;
  color: var(--hk-gold, #c99a4a);
  font-family: var(--hk-font-display, serif);
  font-size: var(--text-sm, 12px);
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.thien-co-rail__empty {
  margin: 0;
  color: var(--hk-text-muted, #7a7260);
  font-family: var(--hk-font-ui, sans-serif);
  font-size: var(--text-xs, 11px);
  line-height: 1.5;
}

.thien-co-rail__list {
  display: flex;
  flex-direction: column;
  gap: var(--hk-space-3, 8px);
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
}

@media (max-width: 720px) {
  .thien-co-rail__drawer {
    width: clamp(180px, 40vw, 240px);
    padding: var(--hk-space-3, 8px);
  }
}
</style>
