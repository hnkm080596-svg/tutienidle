<script setup lang="ts">
// Scene 11 detail-panel "Xem Trước Thành Phẩm" block (audit EXACT:
// outcome preview "chắc chắn N + X% thêm" + brew duration).
import { useI18n } from 'vue-i18n'

defineProps<{
  outcomeLabel: string
  durationLabel: string
}>()
const { t } = useI18n()
</script>

<template>
  <section class="alchemy-detail__block">
    <h4>{{ t('alchemy.preview') }}</h4>
    <p class="alchemy-detail__outcome">{{ outcomeLabel }}</p>
    <p class="alchemy-detail__duration">{{ durationLabel }}</p>
  </section>
</template>

<style scoped>
.alchemy-detail__block h4 {
  margin: 0 0 6px;
  font-size: var(--text-xs);
  text-transform: uppercase;
  color: var(--cinnabar);
}
.alchemy-detail__outcome { margin: 0 0 4px; font-size: var(--text-sm); color: var(--jade); font-weight: 700; }
.alchemy-detail__duration { margin: 0; font-size: var(--text-xs); color: var(--paper-text-soft); }
</style>
