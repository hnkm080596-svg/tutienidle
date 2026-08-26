import type { SortDirection } from '@/stores/ui'

// Sort model cho Hành Trang (plan Workstream E) — mỗi tab có state riêng
// trong uiStore; sort chạy trên MỘT BẢN COPY của toàn bộ list TRƯỚC
// pagination, không mutate thứ tự thật trong bag. Stable sort: comparator
// cuối cùng quay về original index để item bằng nhau giữ nguyên thứ tự.

export function stableSort<T>(items: readonly T[], compare: (a: T, b: T) => number): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => compare(a.item, b.item) || a.index - b.index)
    .map((entry) => entry.item)
}

/** Đảo chiều comparator theo direction (asc = comparator gốc). */
export function withDirection<T>(compare: (a: T, b: T) => number, direction: SortDirection) {
  if (direction === 'asc') {
    return compare
  }

  return (a: T, b: T) => -compare(a, b)
}

/** Comparator số an toàn NaN/undefined — undefined/co thiếu xếp trước ở asc. */
export function compareNumber(a: number | undefined, b: number | undefined): number {
  return (a ?? Number.NEGATIVE_INFINITY) - (b ?? Number.NEGATIVE_INFINITY)
}

export function compareText(a: string | undefined, b: string | undefined): number {
  return (a ?? '').localeCompare(b ?? '', 'vi')
}
