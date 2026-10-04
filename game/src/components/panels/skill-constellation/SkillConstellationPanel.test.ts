// @vitest-environment jsdom
// Constellation panel contract: layout order in the DOM (keyboard walks
// the authored stroke order), the select event contract shared with
// SkillPaperTree, the two connection layers (decorative glyph stroke vs
// prerequisite edge - prereq wins on overlap), and the unlock-flow path
// emitted for the flagged node.
import { describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import SkillConstellationPanel from './SkillConstellationPanel.vue'
import { i18n } from '@/i18n'
import type { SkillConstellationLayout } from '@/data/progression/SkillConstellationLayouts'
import type { SkillUiEdge, SkillUiNode } from '@/components/scenes/skill/fidelity/skillUi'

const layout: SkillConstellationLayout = {
  id: 'fire',
  glyph: '火',
  viewBox: '0 0 400 200',
  points: [
    { nodeId: 'root', x: 200, y: 100, emphasis: 'root' },
    { nodeId: 'minor_a', x: 120, y: 40 },
    { nodeId: 'minor_b', x: 280, y: 160 },
    { nodeId: 'decor', x: 40, y: 100 },
  ],
  strokes: [
    { fromNodeId: 'root', toNodeId: 'minor_a' },
    { fromNodeId: 'root', toNodeId: 'minor_b' },
    // Decorative only: the brush draws it but progression does not.
    { fromNodeId: 'decor', toNodeId: 'root' },
  ],
}

const edges: readonly SkillUiEdge[] = [
  { from: 'root', to: 'minor_a' },
  { from: 'root', to: 'minor_b' },
]

function uiNode(id: string, x: number, y: number, state: SkillUiNode['state']): SkillUiNode {
  return {
    id,
    name: id,
    icon: '',
    x,
    y,
    level: '0 / 5',
    state,
    description: '',
    rows: [],
    conditions: [],
    costLabel: '',
    actionLabel: '',
    actionDisabled: true,
    actionHint: '',
  }
}

// Input order intentionally differs from layout order: the panel must
// reorder by authored stroke order, not by the prop order it receives.
const nodes = [
  uiNode('minor_b', 280, 160, 'locked'),
  uiNode('root', 200, 100, 'learned'),
  uiNode('decor', 40, 100, 'available'),
  uiNode('minor_a', 120, 40, 'available'),
]

function mountPanel(
  overrides: { selected?: string; unlocking?: string } = {},
  onSelect: (id: string) => void = () => {},
) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp({
    render: () =>
      h(SkillConstellationPanel, {
        layout,
        nodes,
        edges,
        selected: overrides.selected ?? 'root',
        unlocking: overrides.unlocking ?? '',
        accent: 'var(--el-fire)',
        onSelect,
      }),
  })
  app.use(i18n)
  app.mount(container)
  return {
    container,
    nodes: () => container.querySelectorAll('.constellation-node'),
    node: (id: string) =>
      container.querySelector<HTMLButtonElement>(`.constellation-node[data-node-id="${id}"]`),
    connections: (cls: string) =>
      container.querySelectorAll(`.constellation-connections .${cls}`),
    unmount: () => { app.unmount(); container.remove() },
  }
}

describe('SkillConstellationPanel', () => {
  it('emits node buttons in authored layout order regardless of input order', async () => {
    const view = mountPanel()
    await nextTick()
    const ids = [...view.nodes()].map((node) => node.getAttribute('data-node-id'))
    expect(ids).toEqual(['root', 'minor_a', 'minor_b', 'decor'])
    view.unmount()
  })

  it('emits the same select contract as SkillPaperTree', async () => {
    const onSelect = vi.fn()
    const view = mountPanel({}, onSelect)
    await nextTick()
    view.node('minor_a')!.click()
    await nextTick()
    expect(onSelect).toHaveBeenCalledWith('minor_a')
    view.unmount()
  })

  it('draws prerequisite edges as connections and non-prereq strokes as glyph strokes', async () => {
    const view = mountPanel()
    await nextTick()
    expect(view.connections('connection').length).toBe(2)
    expect(view.connections('glyph-stroke').length).toBe(1)
    view.unmount()
  })

  it('treats a stroke overlapping an edge in either direction as a prereq win', async () => {
    // decor->root is authored as a stroke while the edge runs root->decor:
    // the same segment, so no decorative glyph-stroke may double-draw it.
    const reversedEdges = [...edges, { from: 'root', to: 'decor' }]
    const container = document.createElement('div')
    document.body.appendChild(container)
    const app = createApp({
      render: () =>
        h(SkillConstellationPanel, {
          layout,
          nodes,
          edges: reversedEdges,
          selected: 'root',
          accent: '',
        }),
    })
    app.use(i18n)
    app.mount(container)
    await nextTick()
    expect(container.querySelectorAll('.constellation-connections .glyph-stroke').length).toBe(0)
    expect(container.querySelectorAll('.constellation-connections .connection.free').length).toBe(0)
    app.unmount()
    container.remove()
  })

  it('marks the selected node and its related connection', async () => {
    const view = mountPanel({ selected: 'minor_a' })
    await nextTick()
    expect(view.node('minor_a')!.classList.contains('selected')).toBe(true)
    expect(view.connections('connection.related').length).toBe(1)
    view.unmount()
  })

  it('emits an unlock-flow path only for the flagged node', async () => {
    const view = mountPanel({ unlocking: 'minor_b' })
    await nextTick()
    const flow = view.connections('unlock-flow')
    expect(flow.length).toBe(1)
    expect(flow[0]!.getAttribute('d')).toContain('200 100')
    expect(view.node('minor_b')!.classList.contains('unlocking')).toBe(true)
    view.unmount()
  })

  it('positions nodes from glyph points in viewBox coordinates', async () => {
    const view = mountPanel()
    await nextTick()
    expect(view.node('minor_a')!.style.left).toBe('30%')
    expect(view.node('minor_a')!.style.top).toBe('20%')
    view.unmount()
  })
})
