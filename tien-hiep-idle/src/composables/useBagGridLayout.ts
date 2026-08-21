import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { calculateBagGridLayout, GRID_GAP, MIN_COLUMNS, MIN_ROWS, type BagGridLayout } from '@/core/ui/SlotSizes'

/**
 * Đo CHIỀU RỘNG/CAO THẬT của .bag-section__grid qua ResizeObserver —
 * mọi bag-section (Equipment/Material/Pill/Talisman/Formation) gắn
 * `gridRef` lên chính div đó để layout tự tính lại mỗi khi container
 * đổi kích thước (resize cửa sổ, panel, ...), KHÔNG chỉ tính 1 lần lúc
 * mount. Trước khi ResizeObserver bắn lần đầu, layout tạm dùng
 * MIN_COLUMNS/MIN_ROWS làm fallback (không NaN/0 cột).
 */
export function useBagGridLayout() {
  const gridRef = ref<HTMLElement | null>(null)

  const layout = ref<BagGridLayout>({ columns: MIN_COLUMNS, rows: MIN_ROWS, slotSize: 0, gap: GRID_GAP })

  let observer: ResizeObserver | null = null

  onMounted(() => {
    const el = gridRef.value

    if (!el) {
      return
    }

    observer = new ResizeObserver(entries => {
      const entry = entries[0]

      if (!entry) {
        return
      }

      layout.value = calculateBagGridLayout(entry.contentRect.width, entry.contentRect.height)
    })

    observer.observe(el)
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = null
  })

  // pageSize thật (= columns * rows hiện tại) — truyền vào
  // useBagPagination thay cho hằng số PAGE_SIZE cố định cũ, đổi cột
  // lúc resize không làm mất/lệch item.
  const pageSize = computed(() => layout.value.columns * layout.value.rows)

  // Bind qua CSS custom property thay vì width/height px cứng — slot
  // tự fill 100% cột nhờ CSS Grid + aspect-ratio (xem bag-section__grid
  // trong từng *.vue), KHÔNG còn v-bind ra 1 con số px cố định.
  const gridStyle = computed(() => ({
    '--grid-columns': String(layout.value.columns),
    '--grid-gap': `${layout.value.gap}px`,
  }))

  return { gridRef, layout, pageSize, gridStyle }
}
