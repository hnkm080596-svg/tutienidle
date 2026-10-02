<script setup lang="ts">
// Scene 16/17 settings nav rail (ref left rail: Chung/Am Thanh/Hien Thi/
// Ngon Ngu/Luu Tru/Tai Khoan/Cap Nhat/Ho Tro seals - CORRECTED to real
// sections only). Selector/data-section contract pinned by tests + e2e.
defineProps<{
  sections: Array<{ id: string; label: string }>
  activeId: string
  label: string
}>()
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
      <i class="settings-panel__nav-glyph art-needed" :data-art-id="`settings-nav-glyph-${section.id}`" aria-hidden="true" />
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
  color: var(--paper-text-soft);
  font-family: var(--font-display);
  font-size: var(--text-sm);
  font-weight: 600;
  letter-spacing: 0.05em;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.16s ease, color 0.16s ease;
}
.settings-panel__nav-seal:hover { border-color: var(--hk-border-active, var(--paper-line)); }
/* Active seal must read on the scroll's dark ink-wash edge: an almost
   opaque paper fill keeps the dark ink text legible (the 30% raised
   wash washed it out). */
.settings-panel__nav-seal.is-active {
  border-color: var(--hk-jade, var(--jade));
  background: color-mix(in srgb, var(--paper-100) 88%, var(--jade) 12%);
  color: var(--paper-text);
  box-shadow: inset 3px 0 var(--hk-jade, var(--jade));
}
.settings-panel__nav-seal:focus-visible { outline: 2px solid var(--hk-gold, var(--gold-700)); outline-offset: 2px; }

/* TEMP ART (art-needed) - ref shows a small glyph left of each seal label. */
.settings-panel__nav-glyph {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  border-radius: 50%;
  border: 1.5px solid color-mix(in srgb, var(--hk-gold-muted, #b99a55) 80%, transparent);
  background: radial-gradient(circle at 40% 35%, color-mix(in srgb, var(--hk-jade, #315f55) 55%, transparent), transparent 75%);
}
</style>
