<script setup lang="ts">
// Han-character constellation panel (skill-constellation-glyph-plan.md)
// - a drop-in replacement for the radial tree surface when the selected
// element has an authored glyph layout. Renders the backdrop, the
// glyph/prereq connection layers, and the node buttons in authored
// stroke order so keyboard navigation walks the strokes. Purchase,
// prereq facts and inspector wiring stay with SkillPaperDetails -
// this panel only swaps layout and chrome.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ConstellationBackdrop from './ConstellationBackdrop.vue'
import ConstellationConnections from './ConstellationConnections.vue'
import ConstellationNode from './ConstellationNode.vue'
import {
  constellationPointsById,
  type SkillConstellationLayout,
} from '@/data/progression/SkillConstellationLayouts'
import type { SkillUiEdge, SkillUiNode } from '@/components/scenes/skill/fidelity/skillUi'

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

const viewBox = computed(() => {
  const [x = 0, y = 0, w = 1, h = 1] = props.layout.viewBox.split(/\s+/).map(Number)
  return { x, y, w, h }
})
const points = computed(() => constellationPointsById(props.layout))

// DOM order = authored stroke order so Tab walks the glyph; a node
// without a slot is appended instead of dropped (the layout test keeps
// that case a test failure upstream).
const orderedNodes = computed(() => {
  const rank = new Map(props.layout.points.map((point, i) => [point.nodeId, i]))
  return [...props.nodes].sort(
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
</script>

<template>
  <div class="constellation-panel" :style="panelStyle">
    <ConstellationBackdrop :glyph="layout.glyph" />
    <div
      class="constellation-graph"
      role="group"
      :aria-label="t('skill.constellation.canvas', { glyph: layout.glyph })"
    >
      <svg
        class="constellation-svg"
        :viewBox="layout.viewBox"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <ConstellationConnections
          :nodes="nodes"
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
        @select="emit('select', $event)"
      />
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
  border-color: var(--constellation-accent, #d8b45f);
  margin-left: 10px;
}
</style>
