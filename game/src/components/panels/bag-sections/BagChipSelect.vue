<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

// Custom chip-art dropdown (owner ruling 2026-10-08): a native <select>
// cannot wear the equipment filter art or restyle its popup, so the
// control is drawn from the equipment-filter-* art set like
// EquipmentArtButton and the list pops on the bag card nine-slice.
export interface BagChipOption {
  value: string
  label: string
}

const props = defineProps<{
  modelValue: string
  options: readonly BagChipOption[]
  label: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

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

function toggle() {
  open.value = !open.value
  if (open.value) {
    const idx = props.options.findIndex((o) => o.value === props.modelValue)
    activeIndex.value = idx >= 0 ? idx : 0
  }
}

function close() {
  open.value = false
}

function pick(value: string) {
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
  const len = props.options.length
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
    const opt = props.options[activeIndex.value]
    if (opt) pick(opt.value)
  }
}
</script>

<template>
  <div ref="rootEl" class="chip-select" :class="{ 'is-open': open }">
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
    <ul
      v-if="open"
      class="chip-select__list"
      role="listbox"
      :aria-label="label"
      tabindex="-1"
      @keydown="onListKeydown"
    >
      <li
        v-for="(opt, i) in options"
        :key="opt.value"
        role="option"
        :aria-selected="opt.value === modelValue"
        class="chip-select__option"
        :class="{ selected: opt.value === modelValue, active: i === activeIndex }"
        @click="pick(opt.value)"
        @mouseenter="activeIndex = i"
      >{{ opt.label }}</li>
    </ul>
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
  background: url('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-normal-v2.png') center / contain no-repeat;
  pointer-events: none;
}
.chip-select:hover::before {
  background-image: url('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-hover-v2.png');
}
.chip-select:active::before {
  background-image: url('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-pressed-v2.png');
}
/* Open state rides the gold "selected" art - same cue the filter chips
   give the active group in the preview. */
.chip-select.is-open::before {
  background-image: url('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-selected-v2.png');
}

.chip-select__button {
  position: relative;
  z-index: 3;
  width: 100%;
  height: 100%;
  border: 0;
  background: transparent;
  color: #f2e3c2;
  font-family: var(--font-body);
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  cursor: pointer;
  padding: 0 16px;
}
.chip-select.is-open .chip-select__button {
  color: #30210e;
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
  /* Centered under the chip, a touch wider than it - the list used to
     hug the chip's left edge which read as a misalignment. */
  left: 50%;
  transform: translateX(-50%);
  width: 112%;
  z-index: 50;
  min-width: 150px;
  max-height: 260px;
  overflow: auto;
  margin: 0;
  padding: 8px;
  list-style: none;
  scrollbar-width: thin;
  scrollbar-color: #8a7444 transparent;
  /* Owner ruling: option list wears the same nine-slice card backdrop as
     the bag workspace, not the native popup frame. */
  border: 12px solid transparent;
  border-image: url('/assets/ui/tien-hiep-2026-10/controls/character-card-nine-slice-v2.png') 90 fill / 12px stretch;
  color: #f2e3c2;
}

.chip-select__option {
  padding: 7px 12px;
  font-family: var(--font-body);
  font-size: 16px;
  font-weight: 600;
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
