// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import ExplorationPaperMap from './ExplorationPaperMap.vue'
import { MAP_DESIGN_W, MAP_DESIGN_H } from './stagePositions'

// QA R3 blind adversarial review - FAILING REPRO, no production edits.
//
// DEFECT D4 (clamp basis is the node CENTER, not the node extent):
// commit 811f527c clamps dragOffsets into [0, MAP_DESIGN_W]x[0,
// MAP_DESIGN_H] claiming "a node can't be dragged off-canvas". But the
// node is a 56px button positioned by left/top = pos and centered via
// transform: translate(-50%,-50%) - pos is the node's CENTER. A center
// clamped to the rect lets half the node (28px) hang past EVERY edge:
// at x=MAP_DESIGN_W the ring renders 972..1028 - 28px clipped by
// .exploration-map's overflow:hidden, the same at x=0 (renders -28..28)
// and on the y axis. The tuner can still hide half a node behind the
// canvas edge for the rest of the session.
//
// Expected: the clamp keeps the whole node inside the design rect -
// center in [NODE_HALF, MAP_DESIGN_*-NODE_HALF]. Actual: center reaches
// 0 / MAP_DESIGN_*, node half clipped.

const NODE_HALF = 28 // .stage-node is 56px, translate(-50%,-50%)

function mountMap() {
  const chapter = {
    id: 'c',
    label: 'Chapter',
    tone: '',
    nodes: [
      { id: 'n1', label: '1', x: 500, y: 400, state: 'available' as const, boss: false, perfect: false },
    ],
    edges: [],
  }
  const container = document.createElement('div')
  const app = createApp({
    render: () =>
      h(ExplorationPaperMap, { chapter, terrain: '/t.png', selected: '', onSelect: () => {} }),
  })
  app.use(
    createI18n({
      legacy: false,
      locale: 'vi',
      messages: { vi: { exploration: { stageLabel: '{chapter} {stage} {state}', state: { available: 'A', locked: 'L' }, boss: 'B' } } },
    }),
  ).mount(container)
  const button = () => container.querySelector<HTMLButtonElement>('button.stage-node')!
  return { app, button }
}

const pointer = (type: string, x: number, y: number) =>
  new MouseEvent(type, { bubbles: true, clientX: x, clientY: y })

describe('QA-R3 D4 - drag clamp must keep the whole node on-canvas', () => {
  it('dragging far past the right/bottom edge leaves half the node clipped', async () => {
    document.body.classList.add('layout-tuner-on')
    const { app, button } = mountMap()
    try {
      button().dispatchEvent(pointer('pointerdown', 500, 400))
      window.dispatchEvent(pointer('pointermove', 2000, 1800))
      await nextTick()

      const left = parseFloat(button().style.left)
      const top = parseFloat(button().style.top)

      // The rendered node spans [left-28, left+28] x [top-28, top+28]
      // in design coords - every pixel must stay inside the rect.
      expect(left).toBeLessThanOrEqual(MAP_DESIGN_W - NODE_HALF)
      expect(top).toBeLessThanOrEqual(MAP_DESIGN_H - NODE_HALF)
    } finally {
      window.dispatchEvent(pointer('pointerup', 0, 0))
      app.unmount()
      document.body.classList.remove('layout-tuner-on')
    }
  })

  it('dragging far past the left/top edge leaves half the node clipped', async () => {
    document.body.classList.add('layout-tuner-on')
    const { app, button } = mountMap()
    try {
      button().dispatchEvent(pointer('pointerdown', 500, 400))
      window.dispatchEvent(pointer('pointermove', -1000, -1000))
      await nextTick()

      const left = parseFloat(button().style.left)
      const top = parseFloat(button().style.top)

      expect(left).toBeGreaterThanOrEqual(NODE_HALF)
      expect(top).toBeGreaterThanOrEqual(NODE_HALF)
    } finally {
      window.dispatchEvent(pointer('pointerup', 0, 0))
      app.unmount()
      document.body.classList.remove('layout-tuner-on')
    }
  })
})
