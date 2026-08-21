<script setup lang="ts">
// UI redesign (spec mục 7 — Shared UI primitives) — nút icon vuông
// dùng chung cho mọi top bar/toolbar (Menu/Settings ở DongFuTopBar.vue
// là 2 chỗ dùng đầu tiên). Không tự thêm variant/size chưa có nơi nào
// cần — mở rộng khi có screen khác thật sự cần khác biệt.
defineProps<{
  label?: string
}>()

defineEmits<{ click: [] }>()
</script>

<template>
  <button type="button" class="icon-button" :aria-label="label" @click="$emit('click')">
    <slot />
  </button>
</template>

<style scoped>
.icon-button {
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}

.icon-button:hover {
  color: var(--gold-500);
  background: rgba(255, 255, 255, 0.04);
}
</style>
