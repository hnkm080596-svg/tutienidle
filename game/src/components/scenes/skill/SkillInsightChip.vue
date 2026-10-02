<script setup lang="ts">
// Scene 07 header chip: "* Ngo Tinh" insight counter (audit 07 EXACT -
// header skillInsight chip). Rendered inside the scroll header slot.
import { useI18n } from 'vue-i18n'

defineProps<{ insight: number }>()

const { t } = useI18n()
</script>

<template>
  <span class="skill-path-panel__points">✦ {{ t('panels.nodeTree.labels.insight') }}: {{ insight }}</span>
</template>

<style scoped>
.skill-path-panel__points {
  font-size: var(--text-sm);
  color: var(--hk-gold, var(--gold-700));
}
</style>
