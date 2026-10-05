<script setup lang="ts">
// Shared pagination footer (plan Workstream E) - dung chung cho ca 3
// bag-section (Trang Bi/Nguyen Lieu/Dan Duoc) thay lap cung pagination:
//
//   | khoang can bang | < 1 2 3 > | [Sap xep <->] |
//
// grid-template-columns: 1fr auto 1fr - pagination LUON o giua, sort
// control sat phai. Nut sort hien thi ca khi chi co mot trang. Khung
// hep: nut sort chi con icon, tooltip van mang nhan day du.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import type { SortDirection } from '@/stores/ui'

export interface BagSortOption {
  value: string

  label: string

  /** Nhan hien thi rieng cho chieu (vd "Ten A-Z"). */
  ascLabel?: string

  descLabel?: string
}

const props = defineProps<{
  currentPage: number

  totalPages: number

  sortOptions: BagSortOption[]

  activeMode: string

  activeDirection: SortDirection
}>()

const emit = defineEmits<{
  goToPage: [page: number]

  selectMode: [mode: string]

  toggleDirection: []

  resetSort: []
}>()

const activeOption = computed(() => props.sortOptions.find((option) => option.value === props.activeMode))

const { t } = useI18n()

const sortButtonLabel = computed(() => {
  if (!activeOption.value || props.activeMode === 'default') {
    return t('panels.bag.sort.button')
  }

  if (props.activeDirection === 'asc') {
    return activeOption.value.ascLabel ?? `${activeOption.value.label} ↑`
  }

  return activeOption.value.descLabel ?? `${activeOption.value.label} ↓`
})

const isMenuOpen = ref(false)

const menuRoot = ref<HTMLElement | null>(null)

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value
}

function select(mode: string) {
  isMenuOpen.value = false

  if (mode === 'default') {
    emit('resetSort')

    return
  }

  if (mode === 'direction') {
    emit('toggleDirection')

    return
  }

  emit('selectMode', mode)
}

function onDocumentPointerdown(event: PointerEvent) {
  if (!isMenuOpen.value || !menuRoot.value) {
    return
  }

  if (!menuRoot.value.contains(event.target as Node)) {
    isMenuOpen.value = false
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isMenuOpen.value) {
    isMenuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerdown)

  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerdown)

  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="bag-pagination">
    <!-- Left rail ornament: drawn divider-ornament line + endcap
         diamonds (ref image 2 footer chrome), centered on the
         pagination baseline. -->
    <span class="bag-pagination__spacer" aria-hidden="true"><InkNineSlice chrome-id="divider-ornament" layer="surface" /></span>

    <div class="bag-pagination__pages">
      <button type="button" :disabled="currentPage === 0" @click="emit('goToPage', currentPage - 1)">
        <InkNineSlice class="bag-pagination__btn-art" chrome-id="button-compact" layer="surface" />
        <span class="bag-pagination__btn-label">‹</span>
      </button>

      <button
        v-for="page in totalPages"
        :key="page"
        type="button"
        :class="{ 'is-active': currentPage === page - 1 }"
        @click="emit('goToPage', page - 1)"
      >
        <InkNineSlice
          class="bag-pagination__btn-art"
          chrome-id="button-compact"
          layer="surface"
          :tint-var="currentPage === page - 1 ? '--chrome-300' : undefined"
        />
        <span class="bag-pagination__btn-label">{{ page }}</span>
      </button>

      <button
        type="button"
        :disabled="currentPage === totalPages - 1"
        @click="emit('goToPage', currentPage + 1)"
      >
        <InkNineSlice class="bag-pagination__btn-art" chrome-id="button-compact" layer="surface" />
        <span class="bag-pagination__btn-label">›</span>
      </button>
    </div>

    <!-- wave B: hosts without a sort axis (DissolveTab reuse) pass an
         empty sortOptions - the whole sort cluster is hidden then. -->
    <div v-if="sortOptions.length" ref="menuRoot" class="bag-pagination__sort">
      <button
        type="button"
        class="bag-pagination__sort-btn"
        :class="{ 'is-active': activeMode !== 'default' }"
        aria-haspopup="menu"
        :aria-expanded="isMenuOpen"
        v-tooltip="t('panels.bag.sort.tooltip', { label: sortButtonLabel })"
        @click="toggleMenu"
      >
        <InkNineSlice
          class="bag-pagination__btn-art"
          chrome-id="button-compact"
          layer="surface"
          :tint-var="activeMode !== 'default' ? '--chrome-300' : undefined"
        />
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <path d="M6 3v14M6 17l-3-3M6 17l3-3" />
          <path d="M14 17V3M14 3l-3 3M14 3l3 3" />
        </svg>

        <span class="bag-pagination__sort-label">{{ sortButtonLabel }}</span>
      </button>

      <div v-if="isMenuOpen" class="bag-pagination__menu" role="menu">
        <InkNineSlice chrome-id="frame-xs-tooltip" layer="surface" />
        <button
          type="button"
          role="menuitem"
          :class="{ 'is-active': activeMode === 'default' }"
          @click="select('default')"
        >
          {{ t('panels.bag.sort.default') }}
        </button>

        <button
          v-for="option in sortOptions"
          :key="option.value"
          type="button"
          role="menuitem"
          :class="{ 'is-active': activeMode === option.value && option.value !== 'default' }"
          @click="select(option.value)"
        >
          {{ option.label }}
        </button>

        <button
          v-if="activeMode !== 'default'"
          type="button"
          role="menuitem"
          class="bag-pagination__menu-direction"
          @click="select('direction')"
        >
          {{ activeDirection === 'asc' ? t('panels.bag.sort.asc') : t('panels.bag.sort.desc') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bag-pagination {
  flex: 0 0 34px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 4px;
}

.bag-pagination__spacer {
  position: relative;
  display: block;
  height: 8px;
  align-self: center;
  opacity: 0.7;
}


.bag-pagination__pages {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
}

/* Drawn button chrome (owner ruling: bag controls use button-compact
   art, not flat CSS frames) - the InkNineSlice paints the capsule,
   the label/arrow sit on top. button-compact needs ~32px of height
   (16px slices) to keep its bevel. */
.bag-pagination button {
  position: relative;
  /* >= 56px: button-compact's 28px side slices need the room. */
  min-width: 56px;
  min-height: 34px;
  padding: 0;
  font-size: var(--text-sm);
  background: transparent;
  color: var(--chrome-100);
  border: 0;
  cursor: pointer;
  font-family: var(--font-body);
}

.bag-pagination__btn-label {
  position: relative;
  z-index: 2;
}

.bag-pagination button:disabled {
  cursor: default;
  opacity: 0.45;
}

.bag-pagination__pages button.is-active .bag-pagination__btn-label,
.bag-pagination__sort-btn.is-active .bag-pagination__sort-label,
.bag-pagination__sort-btn.is-active svg {
  color: #1a1208;
}

.bag-pagination button:focus-visible {
  outline: 2px solid var(--chrome-300);
  outline-offset: 2px;
}

/* ================= Sort control - sat phai ========================== */
.bag-pagination__sort {
  position: relative;
  display: flex;
  justify-content: flex-end;
}

.bag-pagination__sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  max-width: 100%;
  padding: 0 12px;
  white-space: nowrap;
}

.bag-pagination__sort-btn svg,
.bag-pagination__sort-btn .bag-pagination__sort-label {
  position: relative;
  z-index: 2;
}

/* wave B chrome: drawn frame-xs-tooltip card owns the menu shell -
   the slice fills the surface, items keep text-only styling. */
.bag-pagination__menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 6px);
  z-index: 30;
  display: flex;
  flex-direction: column;
  min-width: 168px;
  padding: 8px;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-panel);
}

.bag-pagination__menu button {
  position: relative;
  z-index: 2;
  min-height: var(--tap-min);
  padding: 0 10px;
  text-align: left;
  background: transparent;
  border-color: transparent;
}

.bag-pagination__menu button:hover {
  border-color: var(--ink-line);
  color: var(--chrome-100);
}

.bag-pagination__menu button.is-active {
  color: var(--chrome-100);
  border-color: var(--ink-line);
}

.bag-pagination__menu-direction {
  margin-top: 2px;
  border-top: 1px solid var(--ink-line-soft) !important;
  border-radius: 0 !important;
}

/* Narrow frame - icon-only, tooltip keeps the full label. The container
   query tracks the REAL width of the bag's host panel (InventoryPanel
   declares container-name: bag-panel) - a viewport media query is wrong
   because panel width is decoupled from viewport width; a media fallback
   stays for genuinely narrow windows. */
@container bag-panel (max-width: 420px) {
  .bag-pagination__sort-label {
    display: none;
  }

  .bag-pagination__sort-btn {
    padding: 0 8px;
  }
}

/* Media fallback for contexts outside bag-panel (bag in an overlay). */
@media (max-width: 480px) {
  .bag-pagination__sort-label {
    display: none;
  }

  .bag-pagination__sort-btn {
    padding: 0 8px;
  }
}
</style>
