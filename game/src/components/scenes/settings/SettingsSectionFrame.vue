<script setup lang="ts">
// Scene 16/17 shared section frame — bordered card + plaque'd h4 per the
// ref's section plaques (Chung/Âm Thanh/Hiển Thị/Ngôn Ngữ headers).
// Spec asset: section-plaque (chrome) — temp art until Minh delivers.
defineProps<{
  title: string
  label: string
}>()
</script>

<template>
  <section class="settings-panel__section" :aria-label="label">
    <h4><i class="settings-panel__plaque art-needed" data-art-id="settings-section-plaque" aria-hidden="true" />{{ title }}</h4>
    <slot />
  </section>
</template>

<style scoped>
.settings-panel__section {
  padding: 14px;
  border: 1px solid var(--paper-line);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--paper-100) 35%, transparent);
}
.settings-panel__section h4 {
  margin: 0 0 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--paper-text);
  font-family: var(--font-display);
  font-size: var(--text-md);
  letter-spacing: 0.05em;
}
/* TEMP ART (art-needed) — ref's small icon plaque left of each header. */
.settings-panel__plaque {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  border-radius: 4px;
  border: 1px solid color-mix(in srgb, var(--hk-gold-muted, #b99a55) 70%, transparent);
  background:
    radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--hk-gold-muted, #b99a55) 40%, transparent), transparent 70%),
    color-mix(in srgb, var(--ink-800, #101718) 80%, transparent);
  outline: 1px dashed color-mix(in srgb, #b99a55 60%, transparent);
  outline-offset: -3px;
}
</style>
