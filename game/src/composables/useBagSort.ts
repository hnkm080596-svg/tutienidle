import type { SortDirection } from '@/stores/ui'

// Sort model cho Hanh Trang (plan Workstream E) - moi tab co state rieng
// trong uiStore; sort chay tren MOT BAN COPY cua toan bo list TRUOC
// pagination, khong mutate thu tu that trong bag. Stable sort: comparator
// cuoi cung quay ve original index de item bang nhau giu nguyen thu tu.

export function stableSort<T>(items: readonly T[], compare: (a: T, b: T) => number): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => compare(a.item, b.item) || a.index - b.index)
    .map((entry) => entry.item)
}

/** Dao chieu comparator theo direction (asc = comparator goc). */
export function withDirection<T>(compare: (a: T, b: T) => number, direction: SortDirection) {
  if (direction === 'asc') {
    return compare
  }

  return (a: T, b: T) => -compare(a, b)
}

/** Comparator so an toan NaN/undefined - undefined/co thieu xep truoc o asc. */
export function compareNumber(a: number | undefined, b: number | undefined): number {
  return (a ?? Number.NEGATIVE_INFINITY) - (b ?? Number.NEGATIVE_INFINITY)
}

export function compareText(a: string | undefined, b: string | undefined): number {
  return (a ?? '').localeCompare(b ?? '', 'vi')
}
