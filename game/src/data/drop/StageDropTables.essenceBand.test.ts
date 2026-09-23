import { describe, expect, it } from 'vitest'
import { resolveDrops } from '../../core/drop/resolveDrops'
import { stageDropTableFor } from './StageDropTables'

// M-QI-10 - production proof that the authored band entries are LIVE,
// not merely present in data: a scripted kill resolved through the same
// stageDropTableFor + resolveDrops path BattleLootSystem drives emits
// the band's grade material (spec sec.4 invariant 5).
function scriptedRng(values: number[]): () => number {
  let index = 0

  return () => (index < values.length ? values[index++]! : 0)
}

function killItems(realmId: string, floor: number, rolls: number[]) {
  const stageTable = stageDropTableFor(realmId, floor)
  expect(stageTable, `no stage table for ${realmId} floor ${floor}`).toBeDefined()
  return resolveDrops({
    modifiers: [],
    channel: 'active',
    stageTable,
    rng: scriptedRng(rolls),
  }).items
}

describe('essence drop-band production swap (M-QI-10)', () => {
  it('a qi_refining kill emits tinh_hoa_bao_the through the live stage table', () => {
    // rng[0] = 0.5 passes the 0.7 band-entry chance; the scripted tail
    // (zeros) keeps the rest of the resolution deterministic.
    const items = killItems('qi_refining', 1, [0.5])
    const essence = items.filter(item => item.itemId === 'tinh_hoa_bao_the')
    expect(essence).toHaveLength(1)
    expect(essence[0]!.kind).toBe('material')
    expect(essence[0]!.amount).toBeGreaterThanOrEqual(1)
    expect(essence[0]!.amount).toBeLessThanOrEqual(3)
  })

  it('a foundation_establishment kill emits tinh_hoa_phap_the through the live stage table', () => {
    const items = killItems('foundation_establishment', 1, [0.5])
    const essence = items.filter(item => item.itemId === 'tinh_hoa_phap_the')
    expect(essence).toHaveLength(1)
    expect(essence[0]!.amount).toBeGreaterThanOrEqual(1)
    expect(essence[0]!.amount).toBeLessThanOrEqual(3)
  })

  it('a mortal kill still emits tinh_hoa_pham_the through the same authority', () => {
    const items = killItems('mortal', 1, [0.5])
    expect(items.filter(item => item.itemId === 'tinh_hoa_pham_the')).toHaveLength(1)
  })

  it('the band line is chance-gated: a roll above 0.7 emits nothing', () => {
    const items = killItems('qi_refining', 1, [0.99])
    expect(items.some(item => item.itemId === 'tinh_hoa_bao_the')).toBe(false)
  })
})
