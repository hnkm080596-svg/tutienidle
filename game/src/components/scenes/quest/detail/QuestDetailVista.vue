<script setup lang="ts">
// Detail header: renders the quest name and its group label cleanly
// at the top of the detail card without a placeholder vista image.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BetaQuestSurfaceModel } from '@/core/betaScopeQuestDomain'

const props = defineProps<{ row: BetaQuestSurfaceModel }>()

const { t, te } = useI18n()

const groupLabel = computed(() => {
  const id = props.row.group ?? props.row.cadence
  const key = `panels.quest.groups.${id}`
  return te(key) ? t(key) : t(`panels.quest.cadence.${props.row.cadence}`)
})
</script>

<template>
  <div class="quest-detail-vista">
    <h2 class="quest-detail-vista__name">{{ row.name }}</h2>
    <p class="quest-detail-vista__group">{{ groupLabel }}</p>
  </div>
</template>

<style scoped>
.quest-detail-vista {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 0 8px;
  border-bottom: 1px solid #b28a4344;
  box-sizing: border-box;
}
.quest-detail-vista__name {
  margin: 0;
  font-size: 20px;
  color: #ffe6aa;
}
.quest-detail-vista__group {
  margin: 0;
  font-size: 12px;
  color: #c9b489;
}
</style>
