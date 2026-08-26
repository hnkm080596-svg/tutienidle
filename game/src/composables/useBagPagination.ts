import { type ComputedRef, computed, ref, watch } from 'vue'
import type { BagCell } from '@/components/panels/bag-sections/BagCell'

/**
 * Trích từ BagGrid.vue (Home Hub Phase 2) — mỗi bag-section (Equipment/
 * Material/Pill/Talisman/Formation) tự phân trang riêng, không còn 1
 * state pagination DÙNG CHUNG cho cả 5 loại như bản BagGrid.vue cũ
 * (đổi tab hồi đó reset trang vì chỉ có 1 currentPage; giờ mỗi section
 * là 1 component riêng, currentPage tự nhiên tách theo instance, khỏi
 * cần watch(tab) để reset).
 *
 * pageSize giờ REACTIVE (columns * rows đo THẬT từ
 * useBagGridLayout.ts, không còn hằng số cố định) — cột/hàng đổi lúc
 * resize (responsive width-first grid) khiến pageSize đổi theo, watch
 * totalPages bên dưới tự lùi currentPage nếu trang hiện tại vượt quá
 * số trang mới, không mất/lệch item.
 */
export function useBagPagination(cells: ComputedRef<BagCell[]>, pageSize: ComputedRef<number>) {
  const currentPage = ref(0)

  const totalPages = computed(() => Math.max(1, Math.ceil(cells.value.length / pageSize.value)))

  // Item bị tiêu hao khiến trang hiện tại vượt quá tổng số trang mới
  // (vd đang ở trang cuối rồi dùng hết item) thì lùi về trang hợp lệ
  // gần nhất thay vì hiện trang trắng.
  watch(totalPages, pages => {
    if (currentPage.value > pages - 1) {
      currentPage.value = pages - 1
    }
  })

  function goToPage(page: number) {
    currentPage.value = Math.min(Math.max(0, page), totalPages.value - 1)
  }

  // Sort (plan Workstream E) — đổi mode/direction quay về trang đầu.
  function resetPage() {
    currentPage.value = 0
  }

  // Luôn đủ pageSize ô — ô thừa hiển thị rỗng.
  const gridCells = computed<(BagCell | null)[]>(() => {
    const size = pageSize.value
    const start = currentPage.value * size

    const pageItems = cells.value.slice(start, start + size)

    return Array.from({ length: size }, (_, index) => pageItems[index] ?? null)
  })

  return { currentPage, totalPages, goToPage, resetPage, gridCells }
}
