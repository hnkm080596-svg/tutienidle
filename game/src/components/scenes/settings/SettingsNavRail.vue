<script setup lang="ts">
// Scene 16/17 settings nav rail (ref left rail: Chung/Am Thanh/Hien Thi/
// Ngon Ngu/Luu Tru/Tai Khoan/Cap Nhat/Ho Tro seals - CORRECTED to real
// sections only). Selector/data-section contract pinned by tests + e2e.
import HuyenKimSymbol from '@/components/common/HuyenKimSymbol.vue'
import type { StableSymbolId } from '@/presentation/huyenKim/StableSceneArt'

defineProps<{
  sections: Array<{ id: string; label: string }>
  activeId: string
  label: string
}>()

// Per-section seal glyph - nearest existing stable symbol per section
// (art-needed medallion stays only for an unknown id).
const SECTION_SYMBOL: Record<string, StableSymbolId> = {
  general: 'settings',
  display: 'realm',
  audio: 'feedback',
  account: 'character',
  update: 'auto-farm',
  support: 'confirm',
}

function sectionSymbol(id: string): StableSymbolId | null {
  return SECTION_SYMBOL[id] ?? null
}
const emit = defineEmits<{ select: [id: string] }>()
</script>

<template>
  <nav class="settings-panel__nav" :aria-label="label" data-hk-region="nav-rail">
    <button
      v-for="section in sections"
      :key="section.id"
      type="button"
      class="settings-panel__nav-seal"
      :class="{ 'is-active': activeId === section.id }"
      :data-section="section.id"
      @click="emit('select', section.id)"
    >
      <HuyenKimSymbol
        v-if="sectionSymbol(section.id)"
        :name="sectionSymbol(section.id)!"
        class="settings-panel__nav-glyph"
      />
      <i v-else class="settings-panel__nav-glyph settings-panel__nav-glyph--blank art-needed" :data-art-id="`settings-nav-glyph-${section.id}`" aria-hidden="true" />
      {{ section.label }}
    </button>
  </nav>
</template>

<style scoped>
.settings-panel__nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  mask-image: linear-gradient(180deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%);
}
.settings-panel__nav::-webkit-scrollbar { display: none; }

.settings-panel__nav-seal {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--hk-border-muted, var(--paper-line));
  border-radius: var(--hk-radius-md, 8px);
  background: var(--hk-surface-raised, color-mix(in srgb, var(--paper-100) 30%, transparent));
  /* Seal sits on the DARK raised surface - text must use the dark ramp
     (--paper-text-* is the light-paper ramp: dark ink on dark seal). */
  color: var(--hk-text-secondary, #b8ad97);
  font-family: var(--font-display);
  font-size: var(--text-sm);
  font-weight: 600;
  letter-spacing: 0.05em;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.16s ease, color 0.16s ease;
}
.settings-panel__nav-seal:hover { border-color: var(--hk-border-active, var(--paper-line)); }
.settings-panel__nav-seal.is-active {
  border-color: var(--hk-jade, var(--jade));
  color: var(--hk-text-primary, var(--paper-text));
  box-shadow: inset 3px 0 var(--hk-jade, var(--jade));
}
.settings-panel__nav-seal:focus-visible { outline: 2px solid var(--hk-gold, var(--gold-700)); outline-offset: 2px; }

.settings-panel__nav-glyph {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
}

/* TEMP ART (art-needed) - only for a section with no matching symbol. */
.settings-panel__nav-glyph--blank {
  border-radius: 50%;
  border: 1.5px solid color-mix(in srgb, var(--hk-gold-muted, #b99a55) 80%, transparent);
  background: radial-gradient(circle at 40% 35%, color-mix(in srgb, var(--hk-jade, #315f55) 55%, transparent), transparent 75%);
}
</style>
