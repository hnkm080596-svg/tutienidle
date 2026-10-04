<script setup lang="ts">
// Scene 15/16 reason column (huyen-kim reskin): sits on the cream paper
// inside the left split of the defeat panel - cinnabar '!' seal +
// "Nguyen Nhan That Bai" header + italic hint, hairline divider on the
// right edge. The seal stays temp art (no ready chrome slot for it).
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
  position: relative;
  margin: 0;
  padding: 6px 18px 6px 4px;
  border-right: 1px solid var(--paper-line, rgba(42, 41, 36, 0.42));
  text-align: left;
}
/* No rewards -> the reason block spans the whole paper width. */
.combat-defeat-panel__hint-block:last-child {
  grid-column: 1 / -1;
  border-right: 0;
  max-width: 560px;
  margin: 0 auto;
  text-align: center;
}
.combat-defeat-panel__hint-header {
  position: relative;
  margin: 0 0 8px;
  padding-left: 46px;
  min-height: 36px;
  display: flex;
  align-items: center;
  font-family: var(--font-display);
  font-size: var(--text-md);
  font-weight: 700;
  color: var(--cinnabar);
  letter-spacing: 0.04em;
  line-height: 1.35;
}
.combat-defeat-panel__hint-block:last-child .combat-defeat-panel__hint-header {
  justify-content: center;
}
/* Ref: cinnabar '!' seal medallion (temp art). */
.combat-defeat-panel__hint-seal {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  font-style: normal;
  font-weight: 800;
  font-size: 20px;
  font-family: var(--font-display, Georgia, serif);
  color: var(--cinnabar);
  border-radius: 50%;
  border: 2px solid var(--cinnabar);
  background: color-mix(in srgb, var(--cinnabar) 8%, var(--paper-50, #f5f0e4));
  box-shadow: 0 0 6px color-mix(in srgb, var(--cinnabar) 35%, transparent);
}
.combat-defeat-panel__hint {
  margin: 0;
  color: var(--paper-text-soft, #5e5a50);
  font-size: var(--text-sm);
  font-style: italic;
  line-height: 1.7;
}
</style>
