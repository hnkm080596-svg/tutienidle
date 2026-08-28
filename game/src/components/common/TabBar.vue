<script setup lang="ts">
import NotificationBadge from './NotificationBadge.vue'

// Shared chrome primitive (UI/UX rework Giai đoạn A) — hợp nhất pattern
// chip-tab đang lặp lại độc lập ở BagGrid.vue/EquipmentHallPanel.vue
// (cùng 1 kiểu CSS: nền --ink-800, viền --ink-line-soft, active dùng
// --gold-500) thành 1 component thật, kèm badge số optional (mảng #1
// idle-conventions) cho tab có nội dung mới.
withDefaults(defineProps<{
  tabs: { id: string; label: string; badge?: number }[]
  modelValue: string
  columns?: number
}>(), {})

const emit = defineEmits<{ 'update:modelValue': [string] }>()
</script>

<template>
  <nav class="tab-bar" :style="{ '--tab-columns': columns ?? tabs.length }">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      class="tab-bar__item"
      :class="{ 'is-active': modelValue === tab.id }"
      @click="emit('update:modelValue', tab.id)"
    >
      {{ tab.label }}
      <NotificationBadge v-if="tab.badge" :count="tab.badge" class="tab-bar__badge" />
    </button>
  </nav>
</template>

<style scoped>
.tab-bar {
  display: grid;
  grid-template-columns: repeat(var(--tab-columns), 1fr);
  align-items: stretch;
  gap: var(--space-1);
}

.tab-bar__item {
  position: relative;
  min-height: var(--tap-min);
  padding: var(--space-1) var(--space-2);
  background: var(--ink-800);
  color: var(--text-secondary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: border-color 150ms ease, color 150ms ease;
}

.tab-bar__item.is-active {
  border-color: var(--gold-500);
  color: var(--gold-500);
}

.tab-bar__item:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring-gold);
}

.tab-bar__badge {
  position: absolute;
  top: -4px;
  right: -4px;
}
</style>
