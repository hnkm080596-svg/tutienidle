<script setup lang="ts" generic="T extends { id: string }">
// Scene 02 choice grid - renders the whole offer set at once (the spec's
// 3x3 talent grid / starter preview row). Group semantics come from the
// consumer (role="radiogroup" for talents; plain group for previews).
defineProps<{ items: readonly T[]; label: string; busy?: boolean }>()
</script>

<template>
  <div class="creation-choice-grid" :aria-label="label">
    <div class="creation-choice-grid__items" :aria-busy="busy">
      <template v-for="item in items" :key="item.id"><slot :item="item" /></template>
      <div v-if="items.length === 0" class="creation-choice-grid__empty" role="status"><slot name="empty" /></div>
    </div>
  </div>
</template>

<style scoped>
.creation-choice-grid__items { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.creation-choice-grid__empty { grid-column: 1 / -1; display: grid; place-items: center; min-height: 60px; color: #7a6742; font-size: 13px; }
</style>
