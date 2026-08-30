<script setup lang="ts">
// Primitive hàng label — value dùng cho mọi bảng chỉ số 2 cột (đang lặp
// ~14 chỗ). Value luôn tabular-nums; tone khớp hệ tone của Tooltip.
// Nội dung value qua slot (cho span màu riêng); label qua prop.
withDefaults(defineProps<{
  label: string
  tone?: 'default' | 'positive' | 'negative' | 'warning' | 'muted'
  bordered?: boolean
}>(), {
  tone: 'default',
  bordered: false,
})
</script>

<script lang="ts">
export default { name: 'StatRow' }
</script>

<template>
  <li class="stat-row" :class="[{ 'stat-row--bordered': bordered }, `stat-row--${tone}`]">
    <span class="stat-row__label">{{ label }}</span>
    <span class="stat-row__value"><slot /></span>
  </li>
</template>

<style scoped>
.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-2);
  padding: 3px 4px;
}

.stat-row--bordered {
  border-bottom: 1px solid var(--paper-line-soft);
}

.stat-row__label {
  color: var(--paper-text-soft);
}

.stat-row__value {
  color: var(--paper-text);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.stat-row--positive .stat-row__value { color: var(--jade); }
.stat-row--negative .stat-row__value { color: var(--crimson); }
.stat-row--warning .stat-row__value { color: var(--gold-700); }
.stat-row--muted .stat-row__value { color: var(--paper-text-muted); }
</style>
