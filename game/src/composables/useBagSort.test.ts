import { describe, expect, it } from 'vitest'
import { compareNumber, compareText, stableSort, withDirection } from './useBagSort'

interface Row {
  name: string

  amount?: number
}

describe('useBagSort — sort model (plan Workstream E)', () => {
  it('stableSort: item bằng nhau giữ thứ tự original (comparator cuối về index)', () => {
    const rows: Row[] = [
      { name: 'a', amount: 5 },
      { name: 'b', amount: 1 },
      { name: 'c', amount: 5 },
      { name: 'd', amount: 1 },
    ]

    const sorted = stableSort(rows, (a, b) => (a.amount ?? 0) - (b.amount ?? 0))

    // amount bằng nhau giữ original relative order.
    expect(sorted.map((row) => row.name)).toEqual(['b', 'd', 'a', 'c'])
  })

  it('stableSort KHÔNG mutate list gốc', () => {
    const rows: Row[] = [{ name: 'b' }, { name: 'a' }]

    const sorted = stableSort(rows, (a, b) => compareText(a.name, b.name))

    expect(rows.map((row) => row.name)).toEqual(['b', 'a'])
    expect(sorted.map((row) => row.name)).toEqual(['a', 'b'])
  })

  it('withDirection asc giữ comparator; desc đảo chiều', () => {
    const rows: Row[] = [{ name: 'a', amount: 2 }, { name: 'b', amount: 1 }]
    const byAmount = (a: Row, b: Row) => (a.amount ?? 0) - (b.amount ?? 0)

    expect(stableSort(rows, withDirection(byAmount, 'asc')).map((r) => r.name)).toEqual(['b', 'a'])
    expect(stableSort(rows, withDirection(byAmount, 'desc')).map((r) => r.name)).toEqual(['a', 'b'])
  })

  it('compareNumber: undefined xếp trước ở asc', () => {
    expect(compareNumber(undefined, 3)).toBeLessThan(0)
    expect(compareNumber(3, undefined)).toBeGreaterThan(0)
    expect(compareNumber(2, 3)).toBeLessThan(0)
  })

  it('compareText dùng locale vi', () => {
    expect(compareText('a', 'b')).toBeLessThan(0)
    expect(compareText('b', 'a')).toBeGreaterThan(0)
    expect(compareText(undefined, 'x')).toBeLessThan(0)
  })
})
