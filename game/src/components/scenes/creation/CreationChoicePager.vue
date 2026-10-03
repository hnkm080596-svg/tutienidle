<script setup lang="ts" generic="T extends { id: string }">
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
const props = defineProps<{ items: readonly T[]; label: string; busy?: boolean }>()
const { t } = useI18n()
const page = shallowRef(0)
const pageCount = computed(() => Math.max(1, Math.ceil(props.items.length / 3)))
const visibleItems = computed(() => props.items.slice(page.value * 3, page.value * 3 + 3))
watch(() => props.items, () => { page.value = 0 })
watch(pageCount, count => { page.value = Math.min(page.value, count - 1) })
</script>

<template>
  <div class="creation-choice-pager" :aria-label="label">
    <div class="creation-choice-pager__grid" :aria-busy="busy">
      <template v-for="item in visibleItems" :key="item.id"><slot :item="item" /></template>
      <div v-if="items.length === 0" class="creation-choice-pager__empty" role="status"><slot name="empty" /></div>
    </div>
    <div class="creation-choice-pager__footer">
      <span class="creation-choice-pager__action"><slot name="action" /></span>
      <nav class="creation-choice-pager__pages" :aria-label="label">
        <button type="button" :disabled="page === 0 || busy" :aria-label="t('onboarding.creation.pagination.previous')" @click="page--">‹</button>
        <span aria-live="polite">{{ page + 1 }} / {{ pageCount }}</span>
        <button type="button" :disabled="page >= pageCount - 1 || busy" :aria-label="t('onboarding.creation.pagination.next')" @click="page++">›</button>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.creation-choice-pager__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; min-height: 115px; }
.creation-choice-pager__empty { grid-column: 1 / -1; display: grid; place-items: center; color: #7a6742; font-size: 13px; }
.creation-choice-pager__footer { display: flex; align-items: center; justify-content: space-between; height: 25px; }
.creation-choice-pager__action { min-width: 0; }
.creation-choice-pager__pages { display: flex; align-items: center; gap: 4px; color: #7c6946; font-size: 11px; font-variant-numeric: tabular-nums; }
.creation-choice-pager__pages button { width: 25px; height: 25px; padding: 0; border: 0; background: transparent; color: #4f563e; font-size: 24px; line-height: 1; cursor: pointer; }
.creation-choice-pager__pages button:disabled { opacity: .3; cursor: default; }
.creation-choice-pager__pages button:focus-visible { outline: 2px solid #315f55; }
</style>
