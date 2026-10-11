// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import ExplorationPaperMap from './ExplorationPaperMap.vue'
import { MAP_DESIGN_W, MAP_DESIGN_H } from './stagePositions'

// QA-C blind adversarial review - FAILING REPROS, no production edits.
//
// The drag tuner (backquote layout-tuner mode) registers
// window-level pointermove/pointerup/blur listeners but never
// pointercancel/lostpointercapture, and clamps nothing.
//
// DEFECT D2 (listener leak): a pointercancel mid-drag (touch scroll
// steal, OS gesture) detaches nothing - the move/up listeners stay
// armed and the node keeps following later pointer motion until the
// next pointerup or unmount. Expected: pointercancel ends the drag the
// same way pointerup/blur do.
//
// DEFECT D3 (unbounded offsets): dragOffsets accept any design coord -
// a node dragged outside the 1000x800 space is clipped by
// .exploration-map's overflow:hidden and becomes unreachable for the
// rest of the tuner session. Expected: the tuner clamps writes to the
// design rect so a node can never be lost off-canvas.

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

describe('QA-C D2 - drag tuner survives pointercancel', () => {
  it('a pointercancel mid-drag must end the drag (no more tracking)', async () => {
    document.body.classList.add('layout-tuner-on')
    const { app, button } = mountMap()
    try {
      button().dispatchEvent(pointer('pointerdown', 500, 400))
      window.dispatchEvent(pointer('pointermove', 540, 400))
      await nextTick()
      expect(button().style.left).toBe('540px')

      window.dispatchEvent(new Event('pointercancel'))

      // Correct behavior: drag ended at cancel, so further motion is ignored.
      window.dispatchEvent(pointer('pointermove', 560, 400))
      await nextTick()
      expect(button().style.left).toBe('540px')
    } finally {
      window.dispatchEvent(pointer('pointerup', 0, 0))
      app.unmount()
      document.body.classList.remove('layout-tuner-on')
    }
  })
})

describe('QA-C D3 - drag tuner clamps to the design space', () => {
  it('a node cannot be dragged outside the 1000x800 design rect', async () => {
    document.body.classList.add('layout-tuner-on')
    const { app, button } = mountMap()
    try {
      button().dispatchEvent(pointer('pointerdown', 500, 400))
      window.dispatchEvent(pointer('pointermove', -200, 1500))
      await nextTick()
      const x = parseFloat(button().style.left)
      const y = parseFloat(button().style.top)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(MAP_DESIGN_W)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(MAP_DESIGN_H)
    } finally {
      window.dispatchEvent(pointer('pointerup', 0, 0))
      app.unmount()
      document.body.classList.remove('layout-tuner-on')
    }
  })
})
