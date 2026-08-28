import { type ComputedRef, computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * Fit-refactor đợt 4 (2026-08-29) — phân trang đo theo NGÂN SÁCH CHIỀU CAO
 * thật của container (ResizeObserver), thay scroll. Cùng tinh thần
 * useBagPagination (width-first grid) nhưng height-first cho list dọc:
 * pageSize = floor((height - padding) / rowHeight), tự lùi trang khi
 * container co lại, không mất item.
 *
 * Dùng cho các list vô hạn độ dài trong overlay panel (Hóa Luyện items,
 * codex grid...) —.list giới hạn độ dài (recipes 8 đan phương...) KHÔNG
 * dùng, chúng fit flex tự nhiên.
 */
export function usePanelPagination(rowCount: ComputedRef<number>, rowHeight: number, options?: { padding?: number; headerHeight?: number; maxRows?: number }) {
  const containerEl = ref<HTMLElement | null>(null)
  const availableHeight = ref(0)

  const padding = options?.padding ?? 0
  const headerHeight = options?.headerHeight ?? 0
  const maxRows = options?.maxRows ?? Number.POSITIVE_INFINITY

  let observer: ResizeObserver | undefined

  onMounted(() => {
    if (containerEl.value) {
      observer = new ResizeObserver(entries => {
        for (const entry of entries) {
          availableHeight.value = entry.contentRect.height
        }
      })

      observer.observe(containerEl.value)
    }
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
  })

  const pageSize = computed(() => {
    const budget = availableHeight.value - padding - headerHeight
    const rows = Math.floor(budget / rowHeight)

    return Math.min(Math.max(1, rows), maxRows)
  })

  const currentPage = ref(0)

  const totalPages = computed(() => Math.max(1, Math.ceil(rowCount.value / pageSize.value)))

  watch(totalPages, pages => {
    if (currentPage.value > pages - 1) {
      currentPage.value = pages - 1
    }
  })

  function goToPage(page: number) {
    currentPage.value = Math.min(Math.max(0, page), totalPages.value - 1)
  }

  const pageItemsRange = computed(() => {
    const start = currentPage.value * pageSize.value

    return { start, end: start + pageSize.value }
  })

  return { containerEl, currentPage, totalPages, goToPage, pageSize, pageItemsRange }
}
