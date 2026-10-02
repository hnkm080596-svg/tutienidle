<script setup lang="ts">
// Spec SS12 Thien Co Bang -- right-side opportunity surface answering
// "what is worth doing right now". Pure navigation chrome: entries come
// from useThienCoEntries (read-only derivations), each CTA opens an
// existing surface. Huyen Kim S03 (scene-03 spec): the rail is a
// collapsed bottom-right chip by default; expanding opens the right-edge
// drawer. Chrome slot 'surface-l-drawer' is pending art; the card below
// is the CSS/token fallback.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import HuyenKimSymbol from '@/components/common/HuyenKimSymbol.vue'
import { useThienCoEntries, type ThienCoEntryKind } from '@/composables/useThienCoEntries'

const { t } = useI18n()
const { entries } = useThienCoEntries()

const open = ref(false)

const KIND_STATE_CLASS: Record<ThienCoEntryKind, string> = {
  breakthrough: 'hk-state-milestone',
  quest: 'hk-state-available',
  ready: 'hk-state-complete',
  active: 'hk-state-danger',
  upgradeable: 'hk-state-available',
}
</script>

<template>
  <aside
    class="thien-co-rail"
    :class="{ 'is-open': open }"
    role="complementary"
    :aria-label="t('home.thienCo.aria')"
    data-canonical-layer="L8"
  >
    <!-- Collapsed chip (spec region thien-co-collapsed): bottom-right,
         always rendered; badge shows the live entry count. -->
    <button
      type="button"
      class="thien-co-rail__chip"
      :aria-expanded="open"
      :aria-label="t('home.thienCo.aria')"
      @click="open = !open"
    >
      <span class="thien-co-rail__seal" aria-hidden="true">✦</span>
      <span class="thien-co-rail__chip-title">{{ t('home.thienCo.title') }}</span>
      <span v-if="entries.length > 0" class="thien-co-rail__count">{{ entries.length }}</span>
    </button>

    <!-- Open drawer (spec region thien-co-open): right-edge card. -->
    <div v-if="open" class="thien-co-rail__drawer" data-hk-region="thien-co-open">
      <header class="thien-co-rail__header">
        <span class="thien-co-rail__seal" aria-hidden="true">✦</span>
        <h2 class="thien-co-rail__title">{{ t('home.thienCo.title') }}</h2>
        <GameButton
          shape="circle"
          size="sm"
          variant="ghost"
          class="thien-co-rail__collapse"
          :aria-label="t('home.thienCo.collapse')"
          @click="open = false"
        >
          <HuyenKimSymbol name="close" />
        </GameButton>
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
    </div>
  </aside>
</template>

<style scoped>
.thien-co-rail {
  position: absolute;
  right: var(--hk-space-4, 12px);
  bottom: var(--hk-space-4, 12px);
  z-index: 9;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--hk-space-3, 8px);
  pointer-events: none;
}

.thien-co-rail > * {
  pointer-events: auto;
}

.thien-co-rail__chip {
  display: inline-flex;
  align-items: center;
  gap: var(--hk-space-2, 6px);
  padding: var(--hk-space-2, 6px) var(--hk-space-4, 12px);
  border: 1px solid var(--hk-border-muted, #2a352f);
  border-radius: 999px;
  background: color-mix(in srgb, var(--hk-surface-base, #0b0f0d) 78%, transparent);
  box-shadow: 0 8px 24px var(--hk-shadow-low, rgba(0, 0, 0, 0.4));
  color: var(--hk-text-primary, #ede6d6);
  cursor: pointer;
  backdrop-filter: blur(4px);
}

.thien-co-rail__chip:hover,
.thien-co-rail__chip:focus-visible {
  border-color: var(--hk-border-active, #7a6234);
}

.thien-co-rail__chip:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--hk-glow-gold, rgba(232, 195, 90, 0.35));
}

.thien-co-rail__chip-title {
  font-family: var(--hk-font-display, serif);
  font-size: var(--text-xs, 11px);
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--hk-gold, #c99a4a);
  white-space: nowrap;
}

.thien-co-rail__count {
  display: grid;
  place-items: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--hk-cinnabar, #b54432);
  color: var(--hk-text-primary, #ede6d6);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.thien-co-rail__drawer {
  position: absolute;
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
  .thien-co-rail__drawer {
    width: clamp(180px, 40vw, 240px);
    padding: var(--hk-space-3, 8px);
  }
}
</style>
