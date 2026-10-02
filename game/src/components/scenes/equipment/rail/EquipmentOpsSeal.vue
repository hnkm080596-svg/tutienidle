<script setup lang="ts">
// One hanging-seal button on the ops rail: nav-seal-vertical chrome when
// the slot is ready, token fallback otherwise (art-needed marks the temp
// art). Op seals share a diamond glyph until Minh's per-op rail icons
// land; the view seal uses the stable 'equipment' symbol.
import { computed } from 'vue'
import HuyenKimSymbol from '@/components/common/HuyenKimSymbol.vue'
import { hkChromeUrl } from '@/ui/huyenKimChrome'
import type { StableSymbolId } from '@/presentation/huyenKim/StableSceneArt'

const props = defineProps<{
  label: string
  symbol?: StableSymbolId
  active?: boolean
}>()

const emit = defineEmits<{ click: [] }>()

const sealArt = computed(() => hkChromeUrl('nav-seal-vertical'))
</script>

<template>
  <button
    type="button"
    class="equipment-ops-seal"
    :class="{ 'is-active': props.active }"
    :aria-pressed="props.active"
    :title="label"
    @click="emit('click')"
  >
    <img v-if="sealArt" class="equipment-ops-seal__art" :src="sealArt" alt="" aria-hidden="true" />
    <span
      v-else
      class="equipment-ops-seal__art-fallback"
      art-needed
      data-art-id="nav-seal-vertical"
      aria-hidden="true"
    />
    <HuyenKimSymbol v-if="symbol" :name="symbol" class="equipment-ops-seal__glyph" />
    <span
      v-else
      class="equipment-ops-seal__glyph equipment-ops-seal__glyph--diamond"
      art-needed
      data-art-id="ops-seal-glyph"
      aria-hidden="true"
    />
    <span class="equipment-ops-seal__label">{{ label }}</span>
  </button>
</template>

<style scoped>
.equipment-ops-seal {
  position: relative;
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

.equipment-ops-seal__art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
  opacity: 0.82;
  transition: opacity 0.16s ease;
}

/* Temp hanging-tag stand-in while the chrome slot is pending: a jade
   seal plaque with a muted-gold lip, matching the HK palette. */
.equipment-ops-seal__art-fallback {
  position: absolute;
  inset: 0;
  border: 1px solid var(--hk-border-muted, var(--paper-line));
  border-radius: var(--hk-radius-sm, 6px);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--hk-jade, #315f55) 34%, transparent), transparent 60%),
    var(--hk-surface-raised, var(--ink-800, #1a2320));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--hk-gold-muted, #b99a55) 25%, transparent);
  opacity: 0.82;
}

.equipment-ops-seal__glyph {
  position: relative;
  width: 30%;
  aspect-ratio: 1;
  flex: 0 0 auto;
}

.equipment-ops-seal__glyph--diamond {
  display: grid;
  place-items: center;
}
.equipment-ops-seal__glyph--diamond::before {
  content: '◆';
  color: var(--hk-gold-muted, #b99a55);
  font-size: var(--text-sm);
}

.equipment-ops-seal__label {
  position: relative;
  writing-mode: vertical-rl;
  max-height: 82%;
  font-size: clamp(9px, 0.8cqw, 11px);
  font-weight: 600;
  letter-spacing: 0.12em;
  line-height: 1;
  text-align: start;
  color: inherit;
  overflow: hidden;
  white-space: nowrap;
}

.equipment-ops-seal:hover {
  transform: translateY(-2px);
  color: var(--hk-text-primary, #f2ead8);
}
.equipment-ops-seal:hover .equipment-ops-seal__art,
.equipment-ops-seal:hover .equipment-ops-seal__art-fallback { opacity: 1; }

.equipment-ops-seal.is-active { color: var(--hk-gold, #e3bd67); }
.equipment-ops-seal.is-active .equipment-ops-seal__art,
.equipment-ops-seal.is-active .equipment-ops-seal__art-fallback {
  opacity: 1;
  filter: brightness(1.18) drop-shadow(0 0 6px rgba(227, 189, 103, 0.45));
}

.equipment-ops-seal:focus-visible {
  outline: 2px solid var(--hk-gold, #d8b45a);
  outline-offset: 2px;
}
</style>
