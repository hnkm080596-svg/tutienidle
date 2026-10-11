// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  bagGridPoint,
  collectBagCellPoints,
  playDecomposeFx,
  resolveFxChipPoint,
  settleDecomposeFxBurst,
  useDecomposeFxBursts,
} from './decomposeFx'

// DOM helpers only - the animation layer is rAF-bound and covered by the
// body pour precedent; these pin the queue contract + DOM resolution.

function makeCell(key: string, picked = false): HTMLElement {
  const el = document.createElement('div')
  el.className = picked ? 'bag-section__slot bag-section__slot--picked' : 'bag-section__slot'
  el.dataset.bagKey = key
  return el
}

describe('decomposeFx queue', () => {
  it('queues a burst and settles it', () => {
    playDecomposeFx([{ materialId: 'bui_go', amount: 5, origins: [{ x: 1, y: 2 }] }])

    const queue = useDecomposeFxBursts()
    expect(queue.value).toHaveLength(1)
    expect(queue.value[0]!.streams[0]!.materialId).toBe('bui_go')

    settleDecomposeFxBurst(queue.value[0]!.id)
    expect(queue.value).toHaveLength(0)
  })

  it('drops streams without origins and never queues an empty burst', () => {
    playDecomposeFx([{ materialId: 'bui_go', amount: 5, origins: [] }])
    expect(useDecomposeFxBursts().value).toHaveLength(0)

    playDecomposeFx([
      { materialId: 'bui_go', amount: 5, origins: [] },
      { materialId: 'luyen_khi_tinh_hoa', amount: 3, origins: [{ x: 0, y: 0 }] },
    ])

    const queue = useDecomposeFxBursts()
    expect(queue.value).toHaveLength(1)
    expect(queue.value[0]!.streams).toHaveLength(1)
    settleDecomposeFxBurst(queue.value[0]!.id)
  })
})

describe('decomposeFx DOM glue', () => {
  it('collectBagCellPoints picks cells by data-bag-key', () => {
    const root = document.createElement('div')
    root.append(makeCell('ore_a'), makeCell('wood_b'), makeCell('herb_c'))

    const points = collectBagCellPoints(root, ['ore_a', 'herb_c', 'missing'])
    expect(points).toHaveLength(2)
  })

  it('collectBagCellPoints without keys takes picked cells only', () => {
    const root = document.createElement('div')
    root.append(makeCell('a', true), makeCell('b'), makeCell('c', true))

    expect(collectBagCellPoints(root)).toHaveLength(2)
  })

  it('bagGridPoint reads the bag grid element', () => {
    const root = document.createElement('div')
    const grid = document.createElement('div')
    grid.className = 'bag-section__grid'
    root.append(grid)

    expect(bagGridPoint(root)).not.toBeNull()
    expect(bagGridPoint(document.createElement('div'))).toBeNull()
  })

  it('resolveFxChipPoint prefers the data-currency-id chip', () => {
    const chip = document.createElement('div')
    chip.dataset.currencyId = 'bui_go'
    document.body.append(chip)
    const strip = document.createElement('div')
    strip.className = 'home-design-currencies'
    document.body.append(strip)

    const fromChip = resolveFxChipPoint('bui_go')
    const fromStrip = resolveFxChipPoint('unmounted_material')

    expect(fromChip).not.toBeNull()
    expect(fromStrip).not.toBeNull()

    chip.remove()
    strip.remove()
  })

  it('resolveFxChipPoint falls back to the viewport corner', () => {
    expect(resolveFxChipPoint('no_chip_no_strip')).not.toBeNull()
  })
})
