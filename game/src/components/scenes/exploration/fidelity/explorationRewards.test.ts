import { describe, expect, it } from 'vitest'
import type { DropEntry } from '@/core/drop/DropTable'
import {
  dropAmountText,
  dropKindLabel,
  extraDropRows,
  plainRewardTooltip,
  rangeLabel,
} from './explorationRewards'

const LABELS: Record<string, string> = {
  'panels.stageSelect.rewards.kinds.material': 'Vật Liệu',
  'panels.stageSelect.rewards.kinds.equipment': 'Trang Bị',
  'panels.stageSelect.rewards.kinds.equipmentAny': 'Trang Bị Ngẫu Nhiên',
  'panels.stageSelect.rewards.kinds.pill': 'Đan Dược',
  'panels.stageSelect.rewards.dropAmount': 'Số lượng rơi',
  'panels.stageSelect.rewards.dropChance': 'Tỉ lệ rơi',
}
const t = (key: string) => LABELS[key] ?? key

describe('explorationRewards helpers', () => {
  it('rangeLabel collapses equal bounds and formats open ranges', () => {
    expect(rangeLabel({ min: 3, max: 3 })).toBe('3')
    expect(rangeLabel({ min: 2, max: 5 })).toBe('2–5')
  })

  it('dropAmountText carries the authored range for materials and pills', () => {
    expect(dropAmountText({ kind: 'material', itemId: 'm1', amount: { min: 1, max: 3 } })).toBe('×1–3')
    expect(dropAmountText({ kind: 'pill', itemId: 'p1', amount: { min: 2, max: 2 } })).toBe('×2')
  })

  it('dropAmountText reports the implied x1 for both equipment kinds', () => {
    expect(dropAmountText({ kind: 'equipment', itemId: 'e1' })).toBe('×1')
    expect(dropAmountText({ kind: 'equipment_any' })).toBe('×1')
    expect(dropAmountText({ kind: 'material', itemId: 'm1' })).toBe('')
  })

  it('dropKindLabel resolves the kind label without an amount suffix', () => {
    expect(dropKindLabel({ kind: 'equipment_any' }, t)).toBe('Trang Bị Ngẫu Nhiên')
    const entry: DropEntry = { kind: 'material', itemId: 'm1', amount: { min: 4, max: 6 } }
    const label = dropKindLabel(entry, t)
    expect(label).toBe('Vật Liệu')
    expect(label).not.toContain('×')
  })

  it('extraDropRows emits the amount row plus a chance row only under 100%', () => {
    const rows = extraDropRows(
      { kind: 'material', itemId: 'm1', amount: { min: 1, max: 2 } },
      0.5,
      t,
    )
    expect(rows).toEqual([
      { label: 'Số lượng rơi', value: '×1–2' },
      { label: 'Tỉ lệ rơi', value: '50%' },
    ])
    const guaranteed = extraDropRows(
      { kind: 'material', itemId: 'm1', amount: { min: 1, max: 1 } },
      1,
      t,
    )
    expect(guaranteed).toEqual([{ label: 'Số lượng rơi', value: '×1' }])
  })

  it('plainRewardTooltip folds description and row text into the card body', () => {
    const tooltip = plainRewardTooltip('Linh Mộc', 'Gỗ linh khí', [
      { label: 'Số lượng rơi', value: '×2–4' },
    ])
    expect(tooltip.kind).toBe('plain')
    if (tooltip.kind !== 'plain') return
    expect(tooltip.title).toBe('Linh Mộc')
    expect((tooltip as { description?: string }).description).toBe('Gỗ linh khí\nSố lượng rơi: ×2–4')
  })
})
