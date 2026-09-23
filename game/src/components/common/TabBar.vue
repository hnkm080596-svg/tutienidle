<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
const props = withDefaults(defineProps<{
  tabs: { id: string; label: string; badge?: number }[]
  modelValue: string
  columns?: number
  layout?: 'grid' | 'row'
  // M-UI-OVERHAUL: 'system' renders the rail as .sys-tabs with a sliding
  // accent underline (transform-only motion, spec 2.4). Default 'ink' keeps
  // every caller identical.
  variant?: 'ink' | 'system'
}>(), {
  layout: 'grid',
  variant: 'ink',
})

const emit = defineEmits<{ 'update:modelValue': [string] }>()

// R11 (AR-28) — TabBar is a tab switcher: expose tablist/tab semantics and
// roving tabindex + arrow-key navigation on the Chip buttons.
function onKeydown(event: KeyboardEvent) {
  const key = event.key
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) {
    return
  }

  const nav = event.currentTarget as HTMLElement
  const buttons = Array.from(nav.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
  const index = buttons.indexOf(event.target as HTMLButtonElement)
  if (index === -1) {
    return
  }

  event.preventDefault()

  let next = index
  if (key === 'ArrowRight' || key === 'ArrowDown') next = (index + 1) % buttons.length
  else if (key === 'ArrowLeft' || key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length
  else if (key === 'Home') next = 0
  else if (key === 'End') next = buttons.length - 1

  const target = buttons[next]
  if (target) {
    target.focus()
    const tab = props.tabs[next]
    if (tab) {
      emit('update:modelValue', tab.id)
    }
  }
}

// System variant: measure the active tab's geometry and slide the .sys-tabs__ink
// underline under it (left offset via transform, width via layout). Recomputed
// on selection change + container resize.
const navEl = ref<HTMLElement | null>(null)
const inkBox = ref({ x: 0, w: 0 })

function measureInk() {
  const nav = navEl.value
  if (!nav) return
  const active = nav.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
  inkBox.value = active ? { x: active.offsetLeft, w: active.offsetWidth } : { x: 0, w: 0 }
}

const inkStyle = computed(() => ({
  transform: `translateX(${inkBox.value.x}px)`,
  width: `${inkBox.value.w}px`,
}))

let observer: ResizeObserver | null = null
onMounted(() => {
  measureInk()
  // jsdom has no ResizeObserver - guard so unit mounts stay alive.
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(measureInk)
    if (navEl.value) observer.observe(navEl.value)
  }
  // A late webfont swap changes tab widths without a nav resize.
  document.fonts?.addEventListener?.('loadingdone', measureInk)
  document.fonts?.ready.then(measureInk)
})
watch(() => props.modelValue, () => measureInk(), { flush: 'post' })
onBeforeUnmount(() => {
  observer?.disconnect()
  document.fonts?.removeEventListener?.('loadingdone', measureInk)
})
</script>

<template>
  <nav
    ref="navEl"
    class="tab-bar"
    :class="[`tab-bar--${layout}`, { 'tab-bar--system': variant === 'system' }]"
    :style="{ '--tab-columns': columns ?? tabs.length }"
    role="tablist"
    @keydown="onKeydown"
  >
    <span
      v-if="variant === 'system'"
      class="sys-tabs__ink"
      :style="inkStyle"
      aria-hidden="true"
    />
    <Chip
      v-for="tab in tabs"
      :key="tab.id"
      class="tab-bar__item"
      :active="modelValue === tab.id"
      role="tab"
      :aria-selected="modelValue === tab.id"
      :tabindex="modelValue === tab.id ? 0 : -1"
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

/* M-UI-OVERHAUL: system tab rail - hairline rail, quiet tabs, accent slide
   (the sliding underline element is .sys-tabs__ink in system-theme.css).
   Scoped overrides need :deep() to reach the Chip primitive's own chrome;
   values fall back to plain tabs when system-theme.css is absent. */
.tab-bar--system {
  position: relative;
  border-bottom: 1px solid var(--sys-line-soft, var(--paper-line-soft));
  gap: 2px;
}

.tab-bar--system :deep(.chip) {
  background: transparent;
  border: 0;
  border-radius: 0;
  color: var(--sys-text-muted, var(--paper-text-soft));
  font-family: var(--sys-font-display, var(--font-body));
  letter-spacing: .08em;
  text-transform: uppercase;
  box-shadow: none;
}

.tab-bar--system :deep(.chip .ink-nine-slice) {
  display: none;
}

.tab-bar--system :deep(.chip:not(.is-active):not(:disabled):hover) {
  color: var(--sys-text, var(--paper-text));
  border-color: transparent;
}

.tab-bar--system :deep(.chip.is-active) {
  background: transparent;
  color: var(--sys-accent, var(--mineral-gold));
  border-color: transparent;
  box-shadow: none;
}

.tab-bar--system :deep(.chip:focus-visible) {
  outline: 2px solid var(--sys-focus, rgba(217, 212, 199, .65));
  outline-offset: -2px;
  box-shadow: none;
}
</style>
