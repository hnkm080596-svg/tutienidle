<script setup lang="ts">
import InkNineSlice from './primitives/InkNineSlice.vue'
// Shared chrome primitive (UI/UX rework Giai đoạn A/C) — idle-game
// convention còn thiếu hoàn toàn trước đợt này (đã grep xác nhận không
// có pattern "unseen/new" nào trong src). variant="dot" cho trạng thái
// nhị phân (có/không có gì mới), variant="count" hiện số thật.
const props = withDefaults(defineProps<{
  count?: number
  variant?: 'dot' | 'count'
  max?: number
}>(), {
  count: undefined,
  variant: 'count',
  max: 99,
})

const displayCount = () => (props.count !== undefined && props.count > props.max ? `${props.max}+` : String(props.count ?? 0))

const isVisible = () => props.variant === 'dot' || (props.count ?? 0) > 0
</script>

<template>
  <span v-if="isVisible()" class="notification-badge" :class="`notification-badge--${variant}`">
    <InkNineSlice asset-id="frame-xs-ink-line" layer="frame" />
    <span v-if="variant === 'count'" class="notification-badge__count">{{ displayCount() }}</span>
  </span>
</template>

<style scoped>
.notification-badge {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--crimson);
  border: 0;
  border-radius: 999px;
  color: #fff;
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: 700;
  line-height: 1;
  box-shadow: none;
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

.notification-badge__count {
  position: relative;
  z-index: 3;
}
</style>
