<script setup lang="ts">
// Shared pagination footer (plan Workstream E) — dùng chung cho cả 3
// bag-section (Trang Bị/Nguyên Liệu/Đan Dược) thay lặp cùng pagination:
//
//   | khoảng cân bằng | ‹ 1 2 3 › | [Sắp xếp ↕] |
//
// grid-template-columns: 1fr auto 1fr — pagination LUÔN ở giữa, sort
// control sát phải. Nút sort hiển thị cả khi chỉ có một trang. Khung
// hẹp: nút sort chỉ còn icon, tooltip vẫn mang nhãn đầy đủ.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SortDirection } from '@/stores/ui'

export interface BagSortOption {
  value: string

  label: string

  /** Nhãn hiển thị riêng cho chiều (vd "Tên A–Z"). */
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

const { t } = useI18n({ useScope: 'local' })

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
    <span class="bag-pagination__spacer" aria-hidden="true" />

    <div class="bag-pagination__pages">
      <button type="button" :disabled="currentPage === 0" @click="emit('goToPage', currentPage - 1)">
        ‹
      </button>

      <button
        v-for="page in totalPages"
        :key="page"
        type="button"
        :class="{ 'is-active': currentPage === page - 1 }"
        @click="emit('goToPage', page - 1)"
      >
        {{ page }}
      </button>

      <button
        type="button"
        :disabled="currentPage === totalPages - 1"
        @click="emit('goToPage', currentPage + 1)"
      >
        ›
      </button>
    </div>

    <div ref="menuRoot" class="bag-pagination__sort">
      <button
        type="button"
        class="bag-pagination__sort-btn"
        :class="{ 'is-active': activeMode !== 'default' }"
        aria-haspopup="menu"
        :aria-expanded="isMenuOpen"
        v-tooltip="t('panels.bag.sort.tooltip', { label: sortButtonLabel })"
        @click="toggleMenu"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <path d="M6 3v14M6 17l-3-3M6 17l3-3" />
          <path d="M14 17V3M14 3l-3 3M14 3l3 3" />
        </svg>

        <span class="bag-pagination__sort-label">{{ sortButtonLabel }}</span>
      </button>

      <div v-if="isMenuOpen" class="bag-pagination__menu" role="menu">
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
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 4px;
}

.bag-pagination__spacer {
  display: block;
}

.bag-pagination__pages {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
}

.bag-pagination button {
  min-width: 36px;
  min-height: var(--tap-min);
  padding: 0;
  font-size: var(--text-sm);
  background: var(--ink-800);
  color: var(--text-secondary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-body);
}

.bag-pagination__pages button.is-active {
  background: linear-gradient(180deg, var(--chrome-100), var(--chrome-500));
  color: var(--ink-950);
  border-color: var(--chrome-500);
}

/* ================= Sort control — sát phải ========================== */
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
  padding: 0 10px;
  white-space: nowrap;
}

.bag-pagination__sort-btn.is-active {
  border-color: var(--chrome-300);
  color: var(--chrome-100);
}

.bag-pagination__menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 6px);
  z-index: 30;
  display: flex;
  flex-direction: column;
  min-width: 168px;
  padding: 4px;
  background: var(--ink-900);
  border: 1px solid var(--chrome-500);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-panel);
}

.bag-pagination__menu button {
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

/* Khung hẹp — icon-only, tooltip vẫn mang nhãn đầy đủ. Container query
   theo chiều rộng THẬT của panel chứa bag (RightPanel khai báo
   container-name: right-panel) — viewport media query không đúng vì
   width panel decoupled khỏi width viewport; giữ thêm media fallback
   cho cửa sổ thật hẹp. */
@container right-panel (max-width: 420px) {
  .bag-pagination__sort-label {
    display: none;
  }

  .bag-pagination__sort-btn {
    padding: 0 8px;
  }
}

/* Fallback media cho ngữ cảnh ngoài right-panel (bag trong overlay). */
@media (max-width: 480px) {
  .bag-pagination__sort-label {
    display: none;
  }

  .bag-pagination__sort-btn {
    padding: 0 8px;
  }
}
</style>
