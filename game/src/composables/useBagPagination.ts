import { type ComputedRef, computed, ref, watch } from 'vue'
import type { BagCell } from '@/components/panels/bag-sections/BagCell'

/**
 * Trich tu BagGrid.vue (Home Hub Phase 2) - moi bag-section (Equipment/
 * Material/Pill/Talisman/Formation) tu phan trang rieng, khong con 1
 * state pagination DUNG CHUNG cho ca 5 loai nhu ban BagGrid.vue cu
 * (doi tab hoi do reset trang vi chi co 1 currentPage; gio moi section
 * la 1 component rieng, currentPage tu nhien tach theo instance, khoi
 * can watch(tab) de reset).
 *
 * pageSize gio REACTIVE (columns * rows do THAT tu
 * useBagGridLayout.ts, khong con hang so co dinh) - cot/hang doi luc
 * resize (responsive width-first grid) khien pageSize doi theo, watch
 * totalPages ben duoi tu lui currentPage neu trang hien tai vuot qua
 * so trang moi, khong mat/lech item.
 */
export function useBagPagination<T extends BagCell>(cells: ComputedRef<T[]>, pageSize: ComputedRef<number>) {
  const currentPage = ref(0)

  const totalPages = computed(() => Math.max(1, Math.ceil(cells.value.length / pageSize.value)))

  // Item bi tieu hao khien trang hien tai vuot qua tong so trang moi
  // (vd dang o trang cuoi roi dung het item) thi lui ve trang hop le
  // gan nhat thay vi hien trang trang.
  watch(totalPages, pages => {
    if (currentPage.value > pages - 1) {
      currentPage.value = pages - 1
    }
  })

  function goToPage(page: number) {
    currentPage.value = Math.min(Math.max(0, page), totalPages.value - 1)
  }

  // Sort (plan Workstream E) - doi mode/direction quay ve trang dau.
  function resetPage() {
    currentPage.value = 0
  }

  // Luon du pageSize o - o thua hien thi rong.
  const gridCells = computed<(T | null)[]>(() => {
    const size = pageSize.value
    const start = currentPage.value * size

    const pageItems = cells.value.slice(start, start + size)

    return Array.from({ length: size }, (_, index) => pageItems[index] ?? null)
  })

  return { currentPage, totalPages, goToPage, resetPage, gridCells }
}
