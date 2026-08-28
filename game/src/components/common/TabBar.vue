<script setup lang="ts">
import Chip from './primitives/Chip.vue'
import NotificationBadge from './NotificationBadge.vue'

// Shared chrome primitive (UI/UX rework Giai đoạn A) — hợp nhất pattern
// chip-tab đang lặp lại độc lập ở BagGrid.vue/EquipmentHallPanel.vue
// (cùng 1 kiểu CSS: nền --ink-800, viền --ink-line-soft, active dùng
// chrome-300) thành 1 component thật, kèm badge số optional (mảng #1
// idle-conventions) cho tab có nội dung mới.
// UI primitives refactor (2026-08-29) — mọi item giờ là Chip primitive;
// + layout prop: 'grid' (default, chiếm đều cột) hoặc 'row' (flex:1 từng
// chip, cho switcher dạng hàng như ScripturePavilion).
withDefaults(defineProps<{
  tabs: { id: string; label: string; badge?: number }[]
  modelValue: string
  columns?: number
  layout?: 'grid' | 'row'
}>(), {
  layout: 'grid',
})

const emit = defineEmits<{ 'update:modelValue': [string] }>()
</script>

<template>
  <nav class="tab-bar" :class="`tab-bar--${layout}`" :style="{ '--tab-columns': columns ?? tabs.length }">
    <Chip
      v-for="tab in tabs"
      :key="tab.id"
      class="tab-bar__item"
      :active="modelValue === tab.id"
      @click="emit('update:modelValue', tab.id)"
    >
      {{ tab.label }}
      <NotificationBadge v-if="tab.badge" :count="tab.badge" class="tab-bar__badge" />
    </Chip>
  </nav>
</template>

<style scoped>
.tab-bar {
  display: grid;
  grid-template-columns: repeat(var(--tab-columns), 1fr);
  align-items: stretch;
  gap: var(--space-1);
}

.tab-bar--row {
  display: flex;
}

.tab-bar--row .tab-bar__item {
  flex: 1;
}

.tab-bar__item {
  position: relative;
  min-height: var(--tap-min);
  font-size: var(--text-xs);
}

.tab-bar__badge {
  position: absolute;
  top: -4px;
  right: -4px;
}
</style>
