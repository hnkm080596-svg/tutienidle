// @vitest-environment jsdom
//
// DongFuWheel single-ring layout contract (wheel nav redesign):
// - Every action rides ONE painted orbit - no inner/outer split, so no
//   orb can ever sit on top of a neighbor and steal its click.
// - Orb centers land exactly ON the ring (radius RING_RADIUS around the
//   wheel-box center) with even 360/N angular spacing.
// - Adjacent orb centers are always farther apart than the orb diameter
//   for every reachable slot count - hit targets cannot overlap.
import { describe, expect, it } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import { i18n } from '@/i18n'
import DongFuWheel from './DongFuWheel.vue'
import type { DongFuUiAction } from './dongFuUi'

// Mirror of the component's geometry constants (design-canvas px).
const WHEEL_CENTER = 210
const RING_RADIUS = 187
const ORB_DIAMETER = 73
// Node anchor offsets from the component markup/CSS: the node box is
// positioned so its orb center lands exactly on the computed ring point,
// i.e. orb center = (node.left + 52, node.top + 36.5).
const ORB_CENTER_OFFSET_X = 52
const ORB_CENTER_OFFSET_Y = 36.5

function makeActions(count: number): DongFuUiAction[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `slot_${index}`,
    labelKey: 'panels.wheel.slots.character',
    symbol: 'character',
  }))
}

function mountWheel(actions: DongFuUiAction[]) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const emitted: string[] = []
  const Root = defineComponent({
    render: () =>
      h(DongFuWheel, {
        actions,
        selected: null,
        open: true,
        onAction: (id: string) => emitted.push(id),
      }),
  })
  const app = createApp({ render: () => h(Root) })
  app.use(i18n)
  app.mount(container)
  return { container, emitted, unmount: () => app.unmount() }
}

function orbCenters(container: HTMLElement): { x: number; y: number }[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.df-node')).map((node) => {
    const left = parseFloat(node.style.left)
    const top = parseFloat(node.style.top)
    return {
      x: left + ORB_CENTER_OFFSET_X,
      y: top + ORB_CENTER_OFFSET_Y,
    }
  })
}

describe('DongFuWheel single-ring layout', () => {
  it('renders exactly one painted orbit and one orb per action', () => {
    const { container, unmount } = mountWheel(makeActions(10))
    expect(container.querySelectorAll('.df-wheel__orbit').length).toBe(1)
    expect(container.querySelectorAll('.df-node__orb').length).toBe(10)
    unmount()
  })

  it.each([1, 5, 10, 14])('places %i orb centers on the single ring', (count) => {
    const { container, unmount } = mountWheel(makeActions(count))
    for (const center of orbCenters(container)) {
      const radius = Math.hypot(center.x - WHEEL_CENTER, center.y - WHEEL_CENTER)
      expect(radius).toBeCloseTo(RING_RADIUS, 5)
    }
    unmount()
  })

  it.each([2, 10, 14])('spaces %i orbs evenly with non-overlapping hit targets', (count) => {
    const { container, unmount } = mountWheel(makeActions(count))
    const centers = orbCenters(container)
    const angles = centers
      .map((center) => Math.atan2(center.y - WHEEL_CENTER, center.x - WHEEL_CENTER))
      .sort((a, b) => a - b)
    const expectedStep = (2 * Math.PI) / count
    for (let index = 1; index < angles.length; index += 1) {
      expect(angles[index]! - angles[index - 1]!).toBeCloseTo(expectedStep, 5)
    }
    const wrapAround = angles[0]! + 2 * Math.PI - angles[angles.length - 1]!
    expect(wrapAround).toBeCloseTo(expectedStep, 5)
    for (let a = 0; a < centers.length; a += 1) {
      for (let b = a + 1; b < centers.length; b += 1) {
        const pa = centers[a]!
        const pb = centers[b]!
        const chord = Math.hypot(pa.x - pb.x, pa.y - pb.y)
        expect(chord).toBeGreaterThan(ORB_DIAMETER)
      }
    }
    unmount()
  })

  it('each orb emits its own action id', () => {
    const { container, emitted, unmount } = mountWheel(makeActions(3))
    const orbs = Array.from(container.querySelectorAll<HTMLElement>('.df-node__orb'))
    orbs.forEach((orb, index) => {
      emitted.length = 0
      orb.click()
      expect(emitted).toEqual([`slot_${index}`])
    })
    unmount()
  })
})
