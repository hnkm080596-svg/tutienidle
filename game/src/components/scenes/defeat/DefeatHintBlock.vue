<script setup lang="ts">
// Scene 15/16 hint region (spec: 526/260/620/80, shell-panel).
// Audit EXACT: isCultivationGap picks cultivate vs gear hint. Ref adds
// a "Nguyên Nhân Thất Bại" header and an exclamation seal medallion —
// the seal is temp art.
import { useI18n } from 'vue-i18n'

defineProps<{
  hint: string
}>()
const { t } = useI18n()
</script>

<template>
  <section class="combat-defeat-panel__hint-block" data-hk-region="hint">
    <p class="combat-defeat-panel__hint-header">
      <i class="combat-defeat-panel__hint-seal art-needed" data-art-id="defeat-hint-seal" aria-hidden="true">!</i>
      {{ t('combat.defeat.reasonHeader') }}
    </p>
    <p class="combat-defeat-panel__hint">{{ hint }}</p>
  </section>
</template>

<style scoped>
.combat-defeat-panel__hint-block {
  margin: 0 0 14px;
  padding: 10px 16px 12px;
  border: 1px solid color-mix(in srgb, var(--cinnabar) 40%, var(--paper-line));
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--cinnabar) 6%, var(--paper-50));
}
.combat-defeat-panel__hint-header {
  margin: 0 0 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: var(--font-display);
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--cinnabar);
  letter-spacing: .04em;
}
/* Ref: cinnabar '!' seal medallion (temp art). */
.combat-defeat-panel__hint-seal {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  font-style: normal;
  font-weight: 800;
  font-size: 14px;
  color: #f3e3d8;
  border-radius: 50%;
  background: radial-gradient(circle at 40% 30%, var(--cinnabar), #5c1f16 75%);
  border: 1px solid color-mix(in srgb, var(--hk-gold-muted, #b99a55) 55%, transparent);
  box-shadow: 0 0 8px color-mix(in srgb, var(--cinnabar) 50%, transparent);
}
.combat-defeat-panel__hint {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--text-small);
  font-style: italic;
}
</style>
