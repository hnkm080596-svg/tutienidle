<script setup lang="ts">
import InkNineSlice from './primitives/InkNineSlice.vue'
// Shared chrome primitive (UI/UX rework Giai doan A/C) - idle-game
// convention con thieu hoan toan truoc dot nay (da grep xac nhan khong
// co pattern "unseen/new" nao trong src). variant="dot" cho trang thai
// nhi phan (co/khong co gi moi), variant="count" hien so that.
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
    <InkNineSlice asset-id="frame-xs-ink-line" layer="frame" tint-var="--hk-cinnabar-bright" />
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
  background: var(--hk-cinnabar);
  border: 0;
  border-radius: var(--hk-radius-pill);
  color: var(--hk-text-primary);
  font-family: var(--hk-font-ui);
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
