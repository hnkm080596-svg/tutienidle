<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import HuyenKimSymbol from './HuyenKimSymbol.vue'
import { useImperialNav } from '@/composables/useImperialNav'
import { hkChromeUrl } from '@/ui/huyenKimChrome'

// Vertical seal rail inside ImperialScrollScene (layout spec:
// nav-seal-vertical items, icon-first; labels stay for clarity).
const { t } = useI18n()
const { items, navigate } = useImperialNav()
const sealUrl = hkChromeUrl('nav-seal-vertical')
</script>

<template>
  <nav class="hk-nav" :aria-label="t('panels.hkNav.aria')" data-testid="hk-nav-rail">
    <ul class="hk-nav__list">
      <li v-for="item in items" :key="item.id" class="hk-nav__item">
        <button
          type="button"
          class="hk-nav-seal"
          :class="{ 'is-active': item.active }"
          :data-scene="item.id"
          :aria-pressed="item.active"
          :title="t(item.labelKey)"
          @click="navigate(item.id)"
        >
          <img v-if="sealUrl" class="hk-nav-seal__art" :src="sealUrl" alt="" aria-hidden="true" />
          <HuyenKimSymbol :name="item.symbol" class="hk-nav-seal__glyph" />
          <span class="hk-nav-seal__label">{{ t(item.labelKey) }}</span>
        </button>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.hk-nav { height: 100%; min-height: 0; }

.hk-nav__list {
  height: 100%;
  margin: 0;
  padding: 0 4px;
  list-style: none;
  display: flex;
  flex-direction: column;
  /* stretch, not center: centering shrank each li to its child, and the
     seal's own `width: min(100%, 84px)` % had no definite containing
     width to resolve against - the whole rail rendered ~25px-wide
     slivers with illegible labels. */
  align-items: stretch;
  gap: clamp(6px, 0.9cqh, 12px);
  overflow-y: auto;
  scrollbar-width: none;
  /* Scrollfade per spec scrollbar policy (no visible bar). */
  mask-image: linear-gradient(180deg, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%);
}
.hk-nav__list::-webkit-scrollbar { display: none; }

.hk-nav-seal {
  position: relative;
  flex: 0 0 auto;
  /* Center the 84px cap inside the stretched li (~93px rail). */
  margin-inline: auto;
  width: min(100%, 84px);
  aspect-ratio: 96 / 128;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8%;
  padding: 9% 8%;
  border: 0;
  background: transparent;
  cursor: pointer;
  color: var(--hk-text-muted, #b8ad97);
  transition: transform 0.16s ease, color 0.16s ease, filter 0.16s ease;
}
.hk-nav-seal__art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
  opacity: 0.82;
  transition: opacity 0.16s ease;
}
.hk-nav-seal__glyph {
  position: relative;
  width: 30%;
  aspect-ratio: 1;
  flex: 0 0 auto;
}
/* Vertical nameplate labels (scene spec nav-seal-vertical): the seal
   art is a hanging tag, so the label reads top-down beside the glyph
   instead of clipping two horizontal lines. */
.hk-nav-seal__label {
  position: relative;
  writing-mode: vertical-rl;
  /* Longest labels wrap into a second upright column (vertical-rl wraps
     leftwards) inside the seal width instead of clipping mid-glyph at
     the seal bottom; overflow stays guarded past ~3 columns. */
  white-space: normal;
  max-height: 88%;
  max-width: 62%;
  font-size: clamp(9px, 0.8cqw, 11px);
  font-weight: 600;
  letter-spacing: 0.12em;
  line-height: 1;
  text-align: start;
  color: inherit;
  overflow: hidden;
}
.hk-nav-seal:hover {
  transform: translateY(-2px);
  color: var(--hk-text-primary, #f2ead8);
}
.hk-nav-seal:hover .hk-nav-seal__art { opacity: 1; }
.hk-nav-seal.is-active {
  color: var(--hk-gold, #e3bd67);
}
.hk-nav-seal.is-active .hk-nav-seal__art {
  opacity: 1;
  filter: brightness(1.18) drop-shadow(0 0 6px rgba(227, 189, 103, 0.45));
}
.hk-nav-seal:focus-visible {
  outline: 2px solid var(--hk-gold, #d8b45a);
  outline-offset: 2px;
}
</style>
