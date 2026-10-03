<script setup lang="ts">
// Primitive khoi trong - thay ~13 div empty tu viet ("Chua co...",
// "Chon mot... de xem"). size sm/md/lg dieu padding; framed them vien
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
  color: var(--hk-text-muted);
  font-size: var(--text-sm);
}

.empty-state--sm { padding: var(--hk-space-3) var(--hk-space-2); }
.empty-state--md { padding: var(--hk-space-5) var(--hk-space-3); }
.empty-state--lg { padding: var(--hk-space-6) var(--hk-space-3); font-size: var(--text-body); }

.empty-state--framed {
  border: 1px dashed var(--hk-border-muted);
  border-radius: var(--hk-radius-sm);
}
</style>
