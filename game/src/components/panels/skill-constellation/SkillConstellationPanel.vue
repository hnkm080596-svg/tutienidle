<script setup lang="ts">
// Han-character constellation panel (skill-constellation-glyph-plan.md)
// - a drop-in replacement for the radial tree surface when the selected
// element has an authored glyph layout. Renders the backdrop, the
// glyph/prereq connection layers, and the node buttons in authored
// stroke order so keyboard navigation walks the strokes. Purchase,
// prereq facts and inspector wiring stay with SkillPaperDetails -
// this panel only swaps layout and chrome.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ConstellationBackdrop from './ConstellationBackdrop.vue'
import ConstellationConnections from './ConstellationConnections.vue'
import ConstellationNode from './ConstellationNode.vue'
import {
  constellationPointsById,
  type SkillConstellationLayout,
} from '@/data/progression/SkillConstellationLayouts'
import type { SkillUiEdge, SkillUiNode } from '@/components/scenes/skill/fidelity/skillUi'
import {
  persistSkillDesignOverrides,
  skillDesignMode,
  skillDesignOverrides,
  useMasterAccess,
} from '@/services/master/masterAccess'

const props = withDefaults(
  defineProps<{
    layout: SkillConstellationLayout
    nodes: readonly SkillUiNode[]
    edges: readonly SkillUiEdge[]
    selected: string
    unlocking?: string
    accent?: string
  }>(),
  { unlocking: '', accent: '' },
)
const emit = defineEmits<{ select: [id: string] }>()
const { t } = useI18n()
const { isMaster } = useMasterAccess()

// Design mode (Minh 2026-10-07, master accounts only): drag a node to
// re-seat it on the glyph. Overrides persist under
// `${layout.id}:${nodeId}` keys through masterAccess and apply over the
// authored points for BOTH the node buttons and the connection layer,
// so a dragged node keeps its strokes attached.
const designOn = computed(() => isMaster.value && skillDesignMode.value)
const overrideKey = (nodeId: string) => `${props.layout.id}:${nodeId}`
const posOf = (node: SkillUiNode) =>
  skillDesignOverrides.value[overrideKey(node.id)] ?? { x: node.x, y: node.y }

const viewBox = computed(() => {
  const [x = 0, y = 0, w = 1, h = 1] = props.layout.viewBox.split(/\s+/).map(Number)
  return { x, y, w, h }
})
const points = computed(() => constellationPointsById(props.layout))

// DOM order = authored stroke order so Tab walks the glyph; a node
// without a slot is appended instead of dropped (the layout test keeps
// that case a test failure upstream).
// displayNodes carry the design overrides in their x/y so the
// connection layer (which reads node.x/y) draws to the moved seat.
const displayNodes = computed(() =>
  props.nodes.map((node) => ({ ...node, ...posOf(node) })),
)
const orderedNodes = computed(() => {
  const rank = new Map(props.layout.points.map((point, i) => [point.nodeId, i]))
  return [...displayNodes.value].sort(
    (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  )
})

const percent = (value: number, start: number, span: number) =>
  `${(((value - start) / span) * 100).toFixed(4)}%`
const nodeStyle = (node: SkillUiNode) => ({
  left: percent(node.x, viewBox.value.x, viewBox.value.w),
  top: percent(node.y, viewBox.value.y, viewBox.value.h),
})
const labelPlacementOf = (id: string) => points.value.get(id)?.labelPlacement
const panelStyle = computed(() =>
  props.accent ? ({ '--constellation-accent': props.accent } as Record<string, string>) : undefined,
)

// Node drag - same gesture contract as the paper tree: a sub-threshold
// press stays a select click; a real drag writes the override live and
// persists it on pointer-up. viewBox units per screen px come from the
// rendered box so the cursor tracks 1:1 at any scale.
let nodeDrag: {
  id: string
  px: number
  py: number
  x: number
  y: number
  sx: number
  sy: number
} | null = null
let activePointer: number | null = null
// Stays true past pointerup so the click that ends a drag never
// re-selects; cleared by the next pointerdown.
let dragMoved = false
const exported = ref(false)

function onPointerDown(event: PointerEvent) {
  if (!designOn.value || activePointer !== null) return
  const host = (event.target as HTMLElement).closest('[data-node-id]') as HTMLElement | null
  const id = host?.dataset.nodeId
  if (id === undefined) return
  const node = props.nodes.find((n) => n.id === id)
  if (node === undefined) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return
  const p = posOf(node)
  activePointer = event.pointerId
  dragMoved = false
  nodeDrag = {
    id,
    px: event.clientX,
    py: event.clientY,
    x: p.x,
    y: p.y,
    sx: rect.width / viewBox.value.w,
    sy: rect.height / viewBox.value.h,
  }
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
}
function onPointerMove(event: PointerEvent) {
  if (nodeDrag === null || event.pointerId !== activePointer) return
  const dx = event.clientX - nodeDrag.px
  const dy = event.clientY - nodeDrag.py
  if (!dragMoved && Math.abs(dx) + Math.abs(dy) <= 4) return
  dragMoved = true
  skillDesignOverrides.value = {
    ...skillDesignOverrides.value,
    [overrideKey(nodeDrag.id)]: {
      x: Math.min(viewBox.value.x + viewBox.value.w, Math.max(viewBox.value.x, nodeDrag.x + dx / nodeDrag.sx)),
      y: Math.min(viewBox.value.y + viewBox.value.h, Math.max(viewBox.value.y, nodeDrag.y + dy / nodeDrag.sy)),
    },
  }
}
function onPointerUp(event: PointerEvent) {
  if (event.pointerId !== activePointer) return
  activePointer = null
  if (nodeDrag !== null && dragMoved) persistSkillDesignOverrides()
  nodeDrag = null
  const host = event.currentTarget as HTMLElement
  if (host.hasPointerCapture?.(event.pointerId)) host.releasePointerCapture?.(event.pointerId)
}
function onSelect(id: string) {
  if (!dragMoved) emit('select', id)
}
// Export chip: the merged layout (authored points + live overrides) as
// `{points:[{nodeId,x,y}]}` for baking back into the data file.
function exportLayout() {
  const json = JSON.stringify({
    points: props.layout.points.map((point) => {
      const o = skillDesignOverrides.value[overrideKey(point.nodeId)]
      return { nodeId: point.nodeId, x: Math.round(o?.x ?? point.x), y: Math.round(o?.y ?? point.y) }
    }),
  })
  void navigator.clipboard?.writeText(json)
  console.log('[skill-constellation-design]', json)
  exported.value = true
  setTimeout(() => {
    exported.value = false
  }, 1500)
}
</script>

<template>
  <div class="constellation-panel" :style="panelStyle">
    <ConstellationBackdrop :glyph="layout.glyph" />
    <div
      class="constellation-graph"
      :class="{ design: designOn }"
      role="group"
      :aria-label="t('skill.constellation.canvas', { glyph: layout.glyph })"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <svg
        class="constellation-svg"
        :viewBox="layout.viewBox"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <ConstellationConnections
          :nodes="displayNodes"
          :edges="edges"
          :strokes="layout.strokes"
          :selected="selected"
          :unlocking="unlocking"
        />
      </svg>
      <ConstellationNode
        v-for="node in orderedNodes"
        :key="node.id"
        :node="node"
        :selected="selected === node.id"
        :unlocking="unlocking === node.id"
        :label-placement="labelPlacementOf(node.id)"
        :style="nodeStyle(node)"
        @select="onSelect"
      />
      <button
        v-if="designOn"
        type="button"
        class="design-export"
        @click="exportLayout"
      >
        {{ exported ? t('devPanel.exported') : t('devPanel.exportLayout') }}
      </button>
    </div>
    <p class="constellation-legend">
      <span class="legend-line legend-glyph" aria-hidden="true" /><span>{{
        t('skill.constellation.legendGlyph')
      }}</span>
      <span class="legend-line legend-prereq" aria-hidden="true" /><span>{{
        t('skill.constellation.legendPrereq')
      }}</span>
    </p>
  </div>
</template>

<style scoped>
/* Same frame slot as .skill-paper-tree: the constellation takes over
 * the tree region without moving the inspector or the paper frame. */
.constellation-panel {
  position: absolute;
  left: 228px;
  top: 259px;
  width: 710px;
  height: 445px;
}
.constellation-graph {
  position: absolute;
  inset: 0;
}
.constellation-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.constellation-legend {
  position: absolute;
  left: 14px;
  bottom: 9px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-display, Georgia, serif);
  font-size: 11.5px;
  color: #cdbd93;
  text-shadow: 0 1px 3px rgba(6, 9, 16, 0.9);
}
.legend-line {
  display: inline-block;
  width: 20px;
  border-top: 2px solid;
}
.legend-glyph {
  border-color: rgba(216, 192, 128, 0.5);
}
.legend-prereq {
  border-color: #f0cf81;
  margin-left: 10px;
}
.constellation-graph.design :deep(.constellation-node) {
  cursor: grab;
}
.design-export {
  position: absolute;
  right: 14px;
  bottom: 9px;
  padding: 2px 10px;
  border: 1px solid rgba(216, 192, 128, 0.5);
  border-radius: 4px;
  background: rgba(20, 14, 6, 0.75);
  color: #f0cf81;
  font-family: var(--font-display, Georgia, serif);
  font-size: 11.5px;
  cursor: pointer;
  z-index: 4;
}
.design-export:hover {
  border-color: #f0cf81;
}
</style>
