// @vitest-environment jsdom
// Live-surface probe for the master-gated design mode on the fire
// constellation panel. The game scene does not pass :constellation yet
// (SkillSurface only renders the paper tree), so the panel's drag +
// export contract is pinned here on the real component:
//   - non-master mounts show no export chip and ignore node drags
//   - a master session with design mode on drags a node, the override
//     lands in skillDesignOverrides and persists to localStorage on
//     pointer-up, and export emits the merged {points} JSON.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import SkillConstellationPanel from './SkillConstellationPanel.vue'
import {
  SKILL_CONSTELLATION_LAYOUTS,
} from '@/data/progression/SkillConstellationLayouts'
import type { SkillUiNode } from '@/components/scenes/skill/fidelity/skillUi'
import {
  recordSessionLoginId,
  setSkillDesignMode,
  skillDesignMode,
  skillDesignOverrides,
} from '@/services/master/masterAccess'
import viMessages from '@/locales/vi.json'

const layout = SKILL_CONSTELLATION_LAYOUTS.fire!
const DESIGN_CONST_KEY = 'skill-tree-design-const-pos-v1'

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  messages: { vi: viMessages },
})

function nodeOf(id: string, x: number, y: number): SkillUiNode {
  return {
    id,
    name: id,
    icon: '',
    x,
    y,
    level: '0 / 1',
    state: 'locked',
    description: '',
    experience: '',
    stats: [],
    conditions: [],
    costLabel: '',
    actionLabel: '',
    actionDisabled: true,
    actionHint: '',
  }
}

const nodes = layout.points.map((point) => nodeOf(point.nodeId, point.x, point.y))

function mountPanel() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp({
    render: () =>
      h(SkillConstellationPanel, {
        layout,
        nodes,
        edges: [],
        selected: '',
      }),
  })
  app.use(i18n)
  app.mount(container)
  return {
    container,
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

function pointer(type: string, init: Record<string, unknown>): Event {
  return Object.assign(new Event(type, { bubbles: true }), init)
}

function stubRect(graph: HTMLElement) {
  graph.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 480,
      bottom: 300,
      width: 480,
      height: 300,
      toJSON: () => ({}),
    }) as DOMRect
}

function nodeHost(container: HTMLElement, id: string): HTMLElement {
  const host = container.querySelector(`[data-node-id="${id}"]`) as HTMLElement | null
  expect(host, `node host ${id}`).not.toBeNull()
  return host!
}

describe('skill constellation design mode', () => {
  beforeEach(() => {
    localStorage.clear()
    skillDesignOverrides.value = {}
    setSkillDesignMode(false)
  })
  afterEach(() => {
    recordSessionLoginId(undefined)
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('shows nothing to non-master sessions and ignores drags', async () => {
    recordSessionLoginId('guest')
    setSkillDesignMode(true) // flag alone cannot lift the master gate
    const { container, unmount } = mountPanel()
    await nextTick()
    expect(container.querySelector('.design-export')).toBeNull()
    const graph = container.querySelector('.constellation-graph') as HTMLElement
    stubRect(graph)
    const host = nodeHost(container, 'hoa_linh_ngo')
    host.dispatchEvent(pointer('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 }))
    graph.dispatchEvent(pointer('pointermove', { pointerId: 1, clientX: 160, clientY: 140 }))
    graph.dispatchEvent(pointer('pointerup', { pointerId: 1, clientX: 160, clientY: 140 }))
    expect(skillDesignOverrides.value).toEqual({})
    expect(localStorage.getItem(DESIGN_CONST_KEY)).toBeNull()
    unmount()
  })

  it('master drag writes the override, persists on release, exports merged layout', async () => {
    recordSessionLoginId('admin')
    setSkillDesignMode(true)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { container, unmount } = mountPanel()
    await nextTick()
    expect(container.querySelector('.design-export')).not.toBeNull()
    const graph = container.querySelector('.constellation-graph') as HTMLElement
    stubRect(graph)

    const point = layout.points.find((p) => p.nodeId === 'hoa_linh_ngo')!
    const host = nodeHost(container, 'hoa_linh_ngo')
    // viewBox 480x300 mapped onto a 480x300 box: 1 screen px = 1 unit.
    host.dispatchEvent(pointer('pointerdown', { pointerId: 1, clientX: 50, clientY: 50 }))
    graph.dispatchEvent(pointer('pointermove', { pointerId: 1, clientX: 90, clientY: 80 }))
    await nextTick()
    expect(skillDesignOverrides.value['fire:hoa_linh_ngo']).toEqual({
      x: point.x + 40,
      y: point.y + 30,
    })
    graph.dispatchEvent(pointer('pointerup', { pointerId: 1, clientX: 90, clientY: 80 }))
    const stored = JSON.parse(localStorage.getItem(DESIGN_CONST_KEY) ?? '{}')
    expect(stored['fire:hoa_linh_ngo']).toEqual({ x: point.x + 40, y: point.y + 30 })

    // The moved seat feeds the button position + connections (x/y merge).
    const moved = container.querySelector('[data-node-id="hoa_linh_ngo"]') as HTMLElement
    expect(moved.style.left).not.toBe('')
    const exportBtn = container.querySelector('.design-export') as HTMLButtonElement
    exportBtn.click()
    const emitted = logSpy.mock.calls.find(
      (call) => call[0] === '[skill-constellation-design]',
    )
    expect(emitted).toBeTruthy()
    const payload = JSON.parse(String(emitted![1]))
    const movedPoint = payload.points.find((p: { nodeId: string }) => p.nodeId === 'hoa_linh_ngo')
    expect(movedPoint).toEqual({ nodeId: 'hoa_linh_ngo', x: point.x + 40, y: point.y + 30 })
    const unmoved = payload.points.find((p: { nodeId: string }) => p.nodeId !== 'hoa_linh_ngo')
    const authored = layout.points.find((p) => p.nodeId === unmoved.nodeId)!
    expect(unmoved).toEqual({ nodeId: authored.nodeId, x: authored.x, y: authored.y })
    unmount()
  })

  it('a sub-threshold press selects instead of dragging', async () => {
    recordSessionLoginId('admin')
    setSkillDesignMode(true)
    const { container, unmount } = mountPanel()
    await nextTick()
    const graph = container.querySelector('.constellation-graph') as HTMLElement
    stubRect(graph)
    const host = nodeHost(container, 'hoa_linh_ngo')
    host.dispatchEvent(pointer('pointerdown', { pointerId: 2, clientX: 10, clientY: 10 }))
    graph.dispatchEvent(pointer('pointermove', { pointerId: 2, clientX: 12, clientY: 12 }))
    graph.dispatchEvent(pointer('pointerup', { pointerId: 2, clientX: 12, clientY: 12 }))
    expect(skillDesignOverrides.value).toEqual({})
    unmount()
  })

  it('logging in as a non-master login id clears mode and overrides', () => {
    recordSessionLoginId('admin')
    setSkillDesignMode(true)
    skillDesignOverrides.value = { 'fire:hoa_linh_ngo': { x: 1, y: 1 } }
    recordSessionLoginId('player123')
    expect(skillDesignMode.value).toBe(false)
    expect(skillDesignOverrides.value).toEqual({})
  })
})
