import { type ComputedRef, computed, onBeforeUnmount, ref, watch } from 'vue'

/**
 * Fit-refactor dot 4 (2026-08-29) - phan trang do theo NGAN SACH CHIEU CAO
 * that cua container (ResizeObserver), thay scroll. Cung tinh than
 * useBagPagination (width-first grid) nhung height-first cho list doc:
 * pageSize = floor((height - padding) / rowHeight), tu lui trang khi
 * container co lai, khong mat item.
 *
 * Fit-refactor dot 5 (2026-08-29, review fix) - chon capacity theo LOAI
 * layout bang tuy chon `columnWidth`:
 * - KHONG truyen (mac dinh): list doc 1 cot - pageSize = so HANG thuan,
 *   dung Hoa Luyen dissolve-list (EquipmentHallPanel).
 * - TRUYEN columnWidth (px, da gom gap): flex-wrap grid - pageSize =
 *   rows x columns, columns = floor(width / columnWidth) do THAT tu
 *   contentRect (responsive theo chieu rong, giong width-first cua
 *   useBagGridLayout). Truoc do codex grid (LoreCodex) dung
 *   pageSize kieu list doc nen moi trang chi lap dung 1 cot, trang
 *   thua va khong tan dung so cot.
 *
 * Dung cho cac list vo han do dai trong overlay panel (Hoa Luyen items,
 * codex grid...) -.list gioi han do dai (recipes 8 dan phuong...) KHONG
 * dung, chung fit flex tu nhien.
 */
export function usePanelPagination(rowCount: ComputedRef<number>, rowHeight: number, options?: {
  padding?: number
  headerHeight?: number
  maxRows?: number
  /** Chieu rong 1 o (da gom gap) cua flex-wrap grid - truyen de bat capacity da cot. */
  columnWidth?: number
}) {
  const containerEl = ref<HTMLElement | null>(null)
  const availableHeight = ref(0)
  const availableWidth = ref(0)

  const padding = options?.padding ?? 0
  const headerHeight = options?.headerHeight ?? 0
  const maxRows = options?.maxRows ?? Number.POSITIVE_INFINITY
  const columnWidth = options?.columnWidth

  let observer: ResizeObserver | undefined

  // Audit fix 2026-08-31: container co the nam trong v-else/v-if - chua ton
  // tai luc onMounted (tab Hoa Luyen cua EquipmentHallPanel, lore grid rong).
  // Watch containerEl de attach KHI ref duoc gan (bat ke luc nao trong doi
  // component), thay vi chi thu dung 1 lan o mount.
  const stopContainerWatch = watch(containerEl, (el) => {
    observer?.disconnect()
    observer = undefined

    if (el) {
      observer = new ResizeObserver(entries => {
        for (const entry of entries) {
          availableHeight.value = entry.contentRect.height
          availableWidth.value = entry.contentRect.width
        }
      })

      observer.observe(el)
    }
  }, { immediate: true })

  onBeforeUnmount(() => {
    stopContainerWatch()
    observer?.disconnect()
  })

  // So cot do duoc - 1 khi list doc (khong truyen columnWidth), floor
  // (width / columnWidth) khi flex-wrap grid. Clamp toi thieu 1.
  const columnCount = computed(() => {
    if (columnWidth === undefined) {
      return 1
    }

    return Math.max(1, Math.floor(availableWidth.value / columnWidth))
  })

  // Bug 2026-09-01 (T2.3, "chi show dung 1 mon"): container nam trong
  // v-else tab + panel co the an (display:none) luc observer attach -
  // contentRect.height = 0, budget am -> rows max(1,...) = 1 -> pageSize
  // 1 mon, grid overflow:hidden giau phan con lai. Khi observer fire
  // lai voi height that, pageSize nhay nhung TRANG dang chua selection
  // co the trong vung nhin thay trong 1 tick.
  // Fallback: height chua do duoc (0) -> dung 6 hang mac dinh thay vi 1
  // - sai so hien thi tam thoi chap nhan duoc, KHONG chan content.
  const FALLBACK_ROWS_WHEN_UNMEASURED = 6

  const pageSize = computed(() => {
    const budget = availableHeight.value - padding - headerHeight

    const rows =
      budget > 0
        ? Math.min(Math.max(1, Math.floor(budget / rowHeight)), maxRows)
        : Math.min(FALLBACK_ROWS_WHEN_UNMEASURED, maxRows)

    return rows * columnCount.value
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

  return { containerEl, currentPage, totalPages, goToPage, pageSize, pageItemsRange, columnCount }
}
