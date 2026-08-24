<script setup lang="ts">
// UI redesign (spec mục 7) — chip icon + số lượng dùng chung cho mọi
// nơi cần hiện tài nguyên gọn (DongFuTopBar.vue là chỗ dùng đầu tiên).
import { formatNumber } from '@/core/format/NumberFormatter'

defineProps<{
  amount: number

  label?: string
}>()
</script>

<template>
  <div class="resource-display" v-tooltip="label ? { title: label } : undefined">
    <svg class="resource-display__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--gold-500)" stroke-width="1.4">
      <path d="M8 1 L14 8 L8 15 L2 8 Z" stroke-linejoin="round" />
    </svg>

    <span class="resource-display__amount">{{ formatNumber(amount) }}</span>
  </div>
</template>

<style scoped>
.resource-display {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-family: var(--font-body);
  /* WS2 — giá trị tài nguyên là nội dung chính: >= --text-body (14px). */
  font-size: var(--text-body);
  line-height: var(--lh-tight);
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.resource-display__icon {
  flex: 0 0 auto;
}
</style>
