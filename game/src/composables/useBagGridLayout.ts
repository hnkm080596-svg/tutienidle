import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { calculateBagGridLayout, GRID_GAP, MIN_COLUMNS, MIN_ROWS, type BagGridLayout } from '@/core/ui/SlotSizes'

/**
 * Do CHIEU RONG/CAO THAT cua .bag-section__grid qua ResizeObserver -
 * moi bag-section (Equipment/Material/Pill/Talisman/Formation) gan
 * `gridRef` len chinh div do de layout tu tinh lai moi khi container
 * doi kich thuoc (resize cua so, panel, ...), KHONG chi tinh 1 lan luc
 * mount. Truoc khi ResizeObserver ban lan dau, layout tam dung
 * MIN_COLUMNS/MIN_ROWS lam fallback (khong NaN/0 cot).
 *
 * Remediation Task 4 (2026-09-05) - grid co the nam trong v-if/tab nen
 * KHONG ton tai luc onMounted (bag section chi render khi tab active).
 * Watch `gridRef` (immediate) de attach KHI ref duoc gan - bat ke luc
 * nao trong doi component; observer cu disconnect khi ref doi (grid
 * unmount/remount), cleanup ca watcher + observer khi unmount. Cung
 * pattern usePanelPagination (audit H4 2026-08-31).
 */
export function useBagGridLayout() {
  const gridRef = ref<HTMLElement | null>(null)

  const layout = ref<BagGridLayout>({ columns: MIN_COLUMNS, rows: MIN_ROWS, slotSize: 0, gap: GRID_GAP })

  let observer: ResizeObserver | null = null

  const stopGridWatch = watch(gridRef, (el) => {
    observer?.disconnect()
    observer = null

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
  }, { immediate: true })

  onBeforeUnmount(() => {
    stopGridWatch()
    observer?.disconnect()
    observer = null
  })

  // pageSize that (= columns * rows hien tai) - truyen vao
  // useBagPagination thay cho hang so PAGE_SIZE co dinh cu, doi cot
  // luc resize khong lam mat/lech item.
  const pageSize = computed(() => layout.value.columns * layout.value.rows)

  // Bind qua CSS custom property thay vi width/height px cung - slot
  // tu fill 100% cot nho CSS Grid + aspect-ratio (xem bag-section__grid
  // trong tung *.vue), KHONG con v-bind ra 1 con so px co dinh.
  const gridStyle = computed(() => ({
    '--grid-columns': String(layout.value.columns),
    '--grid-gap': `${layout.value.gap}px`,
  }))

  return { gridRef, layout, pageSize, gridStyle }
}
