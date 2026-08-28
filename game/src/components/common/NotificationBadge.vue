<script setup lang="ts">
// Shared chrome primitive (UI/UX rework Giai đoạn A/C) — idle-game
// convention còn thiếu hoàn toàn trước đợt này (đã grep xác nhận không
// có pattern "unseen/new" nào trong src). variant="dot" cho trạng thái
// nhị phân (có/không có gì mới), variant="count" hiện số thật.
const props = withDefaults(defineProps<{
  count?: number
  variant?: 'dot' | 'count'
  max?: number
}>(), {
  variant: 'count',
  max: 99,
})

const displayCount = () => (props.count !== undefined && props.count > props.max ? `${props.max}+` : String(props.count ?? 0))

const isVisible = () => props.variant === 'dot' || (props.count ?? 0) > 0
</script>

<template>
  <span v-if="isVisible()" class="notification-badge" :class="`notification-badge--${variant}`">
    <template v-if="variant === 'count'">{{ displayCount() }}</template>
  </span>
</template>

<style scoped>
.notification-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--crimson);
  border: 1px solid var(--ink-950);
  border-radius: 999px;
  color: #fff;
  font-family: var(--font-body);
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 0 6px -1px rgba(229, 72, 77, 0.7);
}

.notification-badge--dot {
  width: 9px;
  height: 9px;
  padding: 0;
}

.notification-badge--count {
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
}
</style>
