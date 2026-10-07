<script setup lang="ts">
// Two connection layers inside the glyph (plan sec.4): decorative
// stroke segments the brush draws but the progression data does not use,
// and real prerequisite edges which always render above them and keep
// their state styling. An edge that is not part of the glyph still
// draws, dashed, so a relation never hides inside a stroke.
import { computed } from 'vue'
import type { SkillUiEdge, SkillUiNode } from '@/components/scenes/skill/fidelity/skillUi'
import type { ConstellationGlyphStroke } from '@/data/progression/SkillConstellationLayouts'

const props = defineProps<{
  nodes: readonly SkillUiNode[]
  edges: readonly SkillUiEdge[]
  strokes: readonly ConstellationGlyphStroke[]
  selected: string
  unlocking: string
}>()

// Overlap is geometric, not directional: a brush stroke drawn A->B and
// a prereq edge authored B->A cover the same segment, so pair keys are
// direction-insensitive and the prereq always wins.
const pairKey = (a: string, b: string) => (a < b ? `${a}->${b}` : `${b}->${a}`)
const nodesById = computed(() => new Map(props.nodes.map((node) => [node.id, node])))
const prereqPairs = computed(() => new Set(props.edges.map((edge) => pairKey(edge.from, edge.to))))
const strokePairs = computed(
  () => new Set(props.strokes.map((stroke) => pairKey(stroke.fromNodeId, stroke.toNodeId))),
)

interface RenderedStroke {
  key: string
  d: string
}

const glyphOnly = computed<RenderedStroke[]>(() =>
  props.strokes
    .filter((stroke) => !prereqPairs.value.has(pairKey(stroke.fromNodeId, stroke.toNodeId)))
    .flatMap((stroke) => {
      const from = nodesById.value.get(stroke.fromNodeId)
      const to = nodesById.value.get(stroke.toNodeId)
      if (!from || !to) return []
      return [{ key: `${stroke.fromNodeId}-${stroke.toNodeId}`, d: `M ${from.x} ${from.y} L ${to.x} ${to.y}` }]
    }),
)

interface RenderedEdge extends RenderedStroke {
  state: SkillUiNode['state']
  free: boolean
  related: boolean
  unlocking: boolean
}

const prereqEdges = computed<RenderedEdge[]>(() =>
  props.edges.flatMap((edge) => {
    const from = nodesById.value.get(edge.from)
    const to = nodesById.value.get(edge.to)
    if (!from || !to) return []
    return [
      {
        key: `${edge.from}-${edge.to}`,
        d: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
        state: to.state,
        free: !strokePairs.value.has(pairKey(edge.from, edge.to)),
        related: props.selected === edge.from || props.selected === edge.to,
        unlocking: props.unlocking === edge.to,
      },
    ]
  }),
)

const unlockingEdges = computed(() => prereqEdges.value.filter((edge) => edge.unlocking))
const learnedEdges = computed(() => prereqEdges.value.filter((edge) => edge.state === 'learned'))
</script>

<template>
  <g class="constellation-connections">
    <path
      v-for="stroke in glyphOnly"
      :key="`glyph-${stroke.key}`"
      class="glyph-stroke"
      :d="stroke.d"
    />
    <path
      v-for="edge in prereqEdges"
      :key="`prereq-${edge.key}`"
      :class="['connection', edge.state, { free: edge.free, related: edge.related }]"
      :d="edge.d"
    />
    <path
      v-for="edge in learnedEdges"
      :key="`tail-${edge.key}`"
      class="connection-comet-tail"
      :d="edge.d"
      pathLength="1"
    />
    <path
      v-for="edge in learnedEdges"
      :key="`head-${edge.key}`"
      class="connection-comet-head"
      :d="edge.d"
      pathLength="1"
    />
    <path
      v-for="edge in unlockingEdges"
      :key="`unlock-${edge.key}`"
      class="unlock-flow"
      :d="edge.d"
      pathLength="1"
    />
  </g>
</template>

<style scoped>
/* Decorative brush strokes sit under the real edges: thinner, dimmer,
 * and never animated. Units are viewBox units (480x300 inside the
 * 710x445 panel). */
.glyph-stroke {
  fill: none;
  stroke: #d8c080;
  stroke-width: 1;
  opacity: 0.4;
}
.connection {
  fill: none;
  stroke: #bcae8d;
  stroke-width: 1.2;
  stroke-dasharray: 3 4;
  opacity: 0.85;
}
.connection.free {
  stroke-dasharray: 1.5 3;
}
.connection.available {
  stroke: #d8b45f;
  stroke-dasharray: none;
  opacity: 0.9;
}
/* Learned channels always read as lit gold (vang kim) - element accent
 * stays on the node discs, never on the beams. The line itself stays
 * thin; the energy travels as a comet (sao bang): a bright rounded head
 * dragging a slim tail along the channel. */
.connection.learned {
  stroke: #f0cf81;
  stroke-width: 1.1;
  stroke-dasharray: none;
  opacity: 0.95;
  filter: drop-shadow(0 0 2.5px #ffd36c);
}
.connection-comet-tail,
.connection-comet-head {
  fill: none;
  stroke-linecap: round;
  animation: constellationComet 2.4s linear infinite;
}
.connection-comet-tail {
  stroke: #f0cf81;
  stroke-width: 0.9;
  stroke-dasharray: 0.3 0.7;
  stroke-dashoffset: 1;
  opacity: 0.75;
}
.connection-comet-head {
  stroke: #fff6cc;
  stroke-width: 2.6;
  stroke-dasharray: 0.035 0.965;
  stroke-dashoffset: 1;
  filter: drop-shadow(0 0 3px #ffd36c) drop-shadow(0 0 6px #ffb84d);
}
@keyframes constellationComet {
  from {
    stroke-dashoffset: 1;
  }
  to {
    stroke-dashoffset: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .connection-comet-tail,
  .connection-comet-head {
    animation: none;
    opacity: 0;
  }
}
.connection.related {
  opacity: 1;
  stroke-width: 2.2;
}
/* Unlock travel: dash-offset carries a bright pulse parent->child; the
 * target node's own pop is handled by ConstellationNode. */
.unlock-flow {
  fill: none;
  stroke: #ffe9a3;
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: constellationFlow 0.55s ease-out forwards;
  filter: drop-shadow(0 0 4px #ffd977);
}
@keyframes constellationFlow {
  to {
    stroke-dashoffset: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .unlock-flow {
    animation: none;
    opacity: 0;
  }
}
</style>
