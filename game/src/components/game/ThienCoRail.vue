<script setup lang="ts">
// Spec SS12 Thien Co Bang -- right-side opportunity surface answering
// "what is worth doing right now". Pure navigation chrome: entries come
// from useThienCoEntries (read-only derivations), each CTA opens an
// existing surface. Chrome slot 'surface-l-drawer' is pending art; the
// card below is the CSS/token fallback.
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import { useThienCoEntries, type ThienCoEntryKind } from '@/composables/useThienCoEntries'

const { t } = useI18n()
const { entries } = useThienCoEntries()

const KIND_STATE_CLASS: Record<ThienCoEntryKind, string> = {
  breakthrough: 'hk-state-milestone',
  quest: 'hk-state-available',
  ready: 'hk-state-complete',
  active: 'hk-state-danger',
  upgradeable: 'hk-state-available',
}
</script>

<template>
  <aside class="thien-co-rail" role="complementary" :aria-label="t('home.thienCo.aria')" data-canonical-layer="L8">
    <header class="thien-co-rail__header">
      <span class="thien-co-rail__seal" aria-hidden="true">✦</span>
      <h2 class="thien-co-rail__title">{{ t('home.thienCo.title') }}</h2>
    </header>

    <p v-if="entries.length === 0" class="thien-co-rail__empty">{{ t('home.thienCo.empty') }}</p>

    <ul v-else class="thien-co-rail__list">
      <li
        v-for="(entry, index) in entries"
        :key="entry.id"
        class="thien-co-rail__entry"
        :data-kind="entry.kind"
      >
        <span class="thien-co-rail__marker" :class="KIND_STATE_CLASS[entry.kind]" aria-hidden="true" />
        <div class="thien-co-rail__body">
          <p class="thien-co-rail__entry-title">{{ t(entry.titleKey, entry.titleParams ?? {}) }}</p>
          <p class="thien-co-rail__entry-detail">{{ t(entry.detailKey, entry.detailParams ?? {}) }}</p>
        </div>
        <GameButton
          size="sm"
          :variant="index === 0 ? 'primary' : 'secondary'"
          :class="{ 'hk-attention': index === 0 }"
          @click="entry.run()"
        >
          {{ t(entry.ctaKey) }}
        </GameButton>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.thien-co-rail {
  position: absolute;
  right: var(--hk-space-4, 12px);
  top: 50%;
  z-index: 9;
  display: flex;
  flex-direction: column;
  gap: var(--hk-space-3, 8px);
  width: clamp(180px, 20vw, 260px);
  max-height: 62vh;
  padding: var(--hk-space-4, 12px);
  border: 1px solid var(--hk-border-muted, #2a352f);
  border-radius: var(--hk-radius-lg, 12px);
  background: color-mix(in srgb, var(--hk-surface-base, #0b0f0d) 78%, transparent);
  box-shadow: 0 8px 24px var(--hk-shadow-low, rgba(0, 0, 0, 0.4));
  backdrop-filter: blur(4px);
  transform: translateY(-50%);
}

.thien-co-rail__header {
  display: flex;
  align-items: center;
  gap: var(--hk-space-3, 8px);
  padding-bottom: var(--hk-space-3, 8px);
  border-bottom: 1px solid var(--hk-border-muted, #2a352f);
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

.thien-co-rail__entry {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--hk-space-3, 8px);
  padding: var(--hk-space-3, 8px);
  border: 1px solid var(--hk-border-muted, #2a352f);
  border-radius: var(--hk-radius-md, 8px);
  background: color-mix(in srgb, var(--hk-surface-raised, #131b17) 82%, transparent);
}

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

@media (max-width: 720px) {
  .thien-co-rail {
    width: clamp(150px, 34vw, 200px);
    padding: var(--hk-space-3, 8px);
  }
}
</style>
