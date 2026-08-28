<script setup lang="ts">
// Primitive khối trống — thay ~13 div empty tự viết ("Chưa có...",
// "Chọn một... để xem"). size sm/md/lg điều padding; framed thêm viền
// dashed (EquipmentHall empty-state).
withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg'
  framed?: boolean
}>(), {
  size: 'md',
  framed: false,
})
</script>

<script lang="ts">
export default { name: 'EmptyState' }
</script>

<template>
  <p class="empty-state" :class="[`empty-state--${size}`, { 'empty-state--framed': framed }]">
    <slot />
  </p>
</template>

<style scoped>
.empty-state {
  margin: 0;
  text-align: center;
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.empty-state--sm { padding: 8px 4px; }
.empty-state--md { padding: 16px 8px; }
.empty-state--lg { padding: 24px 8px; font-size: var(--text-body); }

.empty-state--framed {
  border: 1px dashed var(--ink-line);
  border-radius: var(--radius-sm);
}
</style>
