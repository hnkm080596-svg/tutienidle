<script setup lang="ts">
import GameCard from '@/components/common/GameCard.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { computed, onMounted, onUnmounted, ref } from 'vue'

// Custom chip-art dropdown (owner ruling 2026-10-08): a native <select>
// cannot wear the equipment filter art or restyle its popup, so the
// control is drawn from the equipment-filter-* art set like
// EquipmentArtButton and the list pops on the bag card nine-slice.
export interface GameDropdownOption {
  value: string
  label: string
  disabled?: boolean
}

const props = defineProps<{
  modelValue: string
  options: readonly GameDropdownOption[]
  label: string
  placement?: 'down' | 'up'
  hideSelected?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const frame = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/dropdown-frame-cloud-v1.svg')

const open = ref(false)
const activeIndex = ref(0)
const rootEl = ref<HTMLElement | null>(null)

// Owner ruling: any press outside the control closes it - a hanging
// open dropdown with no confirmation is a bug state. Capture phase so
// elements painted above the backdrop still close it first.
function onDocPointer(e: PointerEvent) {
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) close()
}
onMounted(() => document.addEventListener('pointerdown', onDocPointer, true))
onUnmounted(() => document.removeEventListener('pointerdown', onDocPointer, true))

const currentLabel = computed(
  () => props.options.find((o) => o.value === props.modelValue)?.label ?? '',
)
const visibleOptions = computed(() => props.hideSelected ? props.options.filter(o => o.value !== props.modelValue) : props.options)

function toggle() {
  open.value = !open.value
  if (open.value) {
    const idx = visibleOptions.value.findIndex((o) => o.value === props.modelValue)
    activeIndex.value = idx >= 0 ? idx : 0
  }
}

function close() {
  open.value = false
}

function pick(value: string) {
  if (props.options.find(o => o.value === value)?.disabled) return
  emit('update:modelValue', value)
  close()
}

function onButtonKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    if (!open.value) toggle()
  } else if (e.key === 'Escape') {
    close()
  }
}

function onListKeydown(e: KeyboardEvent) {
  const len = visibleOptions.value.length
  if (len === 0) { if (e.key === 'Escape') close(); return }
  if (e.key === 'Escape') {
    close()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % len
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + len) % len
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    const opt = visibleOptions.value[activeIndex.value]
    if (opt) pick(opt.value)
  }
}
</script>

<template>
  <div ref="rootEl" class="chip-select" :class="{ 'is-open': open, 'opens-up': placement === 'up' }" :style="{ '--dropdown-frame': `url('${frame}')` }">
    <button
      type="button"
      class="chip-select__button"
      :aria-label="label"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="toggle"
      @keydown="onButtonKeydown"
    >{{ currentLabel }}</button>
    <div v-if="open" class="chip-select__backdrop" @click="close" />
    <GameCard as="ul"
      v-if="open"
      class="chip-select__list"
      role="listbox"
      :aria-label="label"
      tabindex="-1"
      @keydown="onListKeydown"
    >
      <li
        v-for="(opt, i) in visibleOptions"
        :key="opt.value"
        role="option"
        :aria-selected="opt.value === modelValue"
        :aria-disabled="opt.disabled || undefined"
        class="chip-select__option"
        :class="{ selected: opt.value === modelValue, active: i === activeIndex }"
        @click="pick(opt.value)"
        @mouseenter="activeIndex = i"
      >{{ opt.label }}</li>
    </GameCard>
  </div>
</template>

<style scoped>
.chip-select {
  position: relative;
  isolation: isolate;
  /* z-index lifts the whole open dropdown (backdrop + list) above the
     grid painted after the toolbar - without it the list hides under
     the cells and only the chip frame appears to change. */
  z-index: 30;
  /* Art kept at native 1225x324 proportions (owner ruling: no stretch). */
  flex: 0 0 auto;
  height: 47px;
  aspect-ratio: 1225 / 324;
  cursor: pointer;
}
.chip-select::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: rgba(9,14,11,.92);
  clip-path: polygon(10px 0,calc(100% - 10px) 0,100% 10px,100% calc(100% - 10px),calc(100% - 10px) 100%,10px 100%,0 calc(100% - 10px),0 10px);
  inset: 6px;
  pointer-events: none;
}
.chip-select::after {
  content:'';
  position:absolute;
  inset:0;
  z-index:-1;
  border:14px solid transparent;
  border-image:var(--dropdown-frame) 28 / 14px stretch;
  pointer-events:none;
}
.chip-select:hover::after, .chip-select.is-open::after { filter:brightness(1.25); }
.chip-select:active::after { filter:brightness(.9); }

.chip-select__button {
  position: relative;
  z-index: 3;
  width: 100%;
  height: 100%;
  border: 0;
  background: transparent;
  color: #f2e3c2;
  /* Owner ruling 2026-10-09: same face/weight as the scene op-tab
     buttons so every function control in Trang Bi reads alike. */
  font-family: var(--pc-font-body, var(--font-display, Georgia, serif));
  font-size: 16px;
  font-weight: 700;
  text-align: center;
  cursor: pointer;
  padding: 0 18px;
}
.chip-select.is-open .chip-select__button {
  color: #ffe7ae;
}
.chip-select__button:focus-visible {
  outline: 2px solid #e5bd65;
  outline-offset: 2px;
}

/* Invisible click-away layer under the list (z between button + list). */
.chip-select__backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
}

.chip-select__list {
  position: absolute;
  top: calc(100% + 4px);
  /* Grow toward the content area without crossing the left clip boundary. */
  left: 0;
  width: max-content;
  z-index: 50;
  min-width: max(112%, 150px);
  overflow: visible;
  margin: 0;
  padding: 8px;
  list-style: none;
  scrollbar-width: none;
  /* Owner ruling: option list wears the same nine-slice card backdrop as
     the bag workspace, not the native popup frame. */
  
  color: #f2e3c2;
}

.chip-select__list::-webkit-scrollbar {
  display: none;
}
.opens-up .chip-select__list { top:auto; bottom:calc(100% + 4px); }
.chip-select__option[aria-disabled='true'] { opacity:.45; cursor:default; }

.chip-select__option {
  padding: 7px 12px;
  font-family: var(--pc-font-body, var(--font-display, Georgia, serif));
  font-size: 16px;
  font-weight: 700;
  color: #d8c49a;
  cursor: pointer;
  white-space: nowrap;
}
.chip-select__option:hover,
.chip-select__option.active {
  color: #ffe9ae;
  background: rgba(201, 169, 95, 0.16);
}
.chip-select__option.selected {
  color: #ffd977;
}
</style>
