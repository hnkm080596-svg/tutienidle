<script setup lang="ts">
// Scene 09 scaffold - circular chapter seal + realm name marking a
// chapter band's left edge (ref: Pham Nhan / Luyen Khi / Truc Co seals).
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  chapter: number
  label: string
}>()

const { t } = useI18n()
</script>

<template>
  <header class="exploration-marker">
    <span class="exploration-marker__seal art-needed" :data-art-id="`exploration-chapter-seal-ch${props.chapter}`" aria-hidden="true">
      {{ props.chapter }}
    </span>
    <span class="exploration-marker__copy">
      <strong>{{ props.label }}</strong>
      <small>{{ t('panels.stageSelect.labels.chapterPrefix', { chapter: props.chapter }) }}</small>
    </span>
  </header>
</template>

<style scoped>
.exploration-marker {
  position: absolute;
  top: 50%;
  left: 8px;
  transform: translateY(-50%);
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 82px;
  text-align: center;
}

.exploration-marker__seal {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--hk-gold, #b99a55) 70%, var(--brush-950));
  background:
    radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--paper-50) 26%, transparent), transparent 62%),
    color-mix(in srgb, #315f55 62%, var(--brush-950));
  color: var(--paper-50);
  font: 700 var(--text-sm) var(--font-display);
  box-shadow: 0 1px 6px rgba(16, 23, 24, 0.4);
}

.exploration-marker__copy {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.exploration-marker__copy strong {
  font-size: var(--text-xs);
  color: var(--paper-text);
  text-shadow: 0 1px 2px var(--paper-50);
}

.exploration-marker__copy small {
  font-size: 10px;
  color: var(--paper-text-muted);
  text-shadow: 0 1px 2px var(--paper-50);
}
</style>
