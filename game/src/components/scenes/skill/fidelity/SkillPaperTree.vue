<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SkillUiNode, SkillUiEdge } from './skillUi'
import SkillPaperNode from './SkillPaperNode.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
const props = withDefaults(defineProps<{
  nodes: readonly SkillUiNode[]
  edges: readonly SkillUiEdge[]
  selected: string
  /** Natural square size (px) of the layout space x/y are expressed in. */
  size?: number
  /** Zoom-to-fit factor applied to the whole graph (cards included). */
  fit?: number
}>(), { size: 710, fit: 1 })
const emit = defineEmits<{ select: [id: string] }>()
const { t } = useI18n()
const pipe = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/skill-connection-pipe-v1.png')
// G3 edge skin (HomeSkillArtPanel): the pipe image spans each link; when
// both ends are learned a light flow runs along it. Links into a locked
// node keep the muted look so gating still reads at a glance.
const connections = computed(() => props.edges.flatMap(edge => {
  const from = props.nodes.find(node => node.id === edge.from)
  const to = props.nodes.find(node => node.id === edge.to)
  if (!from || !to) return []
  return [{
    ...edge,
    fromNode: from,
    toNode: to,
    length: Math.hypot(to.x - from.x, to.y - from.y),
    angle: Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI,
    active: from.state === 'learned' && to.state === 'learned',
    muted: to.state === 'locked',
  }]
}))

// Paint lowest nodes first: a node's name/level label hangs below its disc
// into the next ring, so any disc that can cover it sits at a larger y.
// Descending-y order keeps every label above every disc that could occlude it.
const paintNodes = computed(() => [...props.nodes].sort((a, b) => b.y - a.y))
const viewBox = computed(() => `0 0 ${props.size} ${props.size}`)
const graphStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  transform: `translate(-50%, -50%) scale(${props.fit})`,
}))
</script>
<template>
  <div class="skill-paper-tree" :aria-label="t('skill.tree')">
    <div class="skill-graph" :style="graphStyle">
      <svg class="skill-tree-lines" :viewBox="viewBox" aria-hidden="true">
        <defs><filter id="skill-flow-glow"><feGaussianBlur stdDeviation="1.8" /></filter></defs>
        <g v-for="edge in connections" :key="`${edge.from}-${edge.to}`" :class="['skill-edge', { muted: edge.muted }]">
          <image :href="pipe" :x="edge.fromNode.x" :y="edge.fromNode.y - 7" :width="edge.length" height="14" preserveAspectRatio="none" :transform="`rotate(${edge.angle} ${edge.fromNode.x} ${edge.fromNode.y})`" />
          <template v-if="edge.active">
            <line class="connection-flow connection-flow-glow" pathLength="100" :x1="edge.fromNode.x" :y1="edge.fromNode.y" :x2="edge.toNode.x" :y2="edge.toNode.y" />
            <line class="connection-flow" pathLength="100" :x1="edge.fromNode.x" :y1="edge.fromNode.y" :x2="edge.toNode.x" :y2="edge.toNode.y" />
          </template>
        </g>
      </svg>
      <SkillPaperNode v-for="node in paintNodes" :key="node.id" class="skill-positioned-node" :node="node" :selected="selected === node.id" :style="{ left: `${node.x}px`, top: `${node.y}px` }" @select="emit('select', $event)" />
    </div>
  </div>
</template>
<style scoped>
.skill-positioned-node { position:absolute; transform:translate(-50%,-38px); }
.skill-paper-tree { position:absolute; left:228px; top:259px; width:710px; height:445px; }
.skill-graph { position:absolute; left:50%; top:50%; transform-origin:center; }
.skill-tree-lines { position:absolute; inset:0; width:100%; height:100%; overflow:visible; pointer-events:none; }
.connection-flow { stroke:#fff0aa; stroke-width:2; stroke-dasharray:9 91; stroke-linecap:round; animation:skill-line-energy 3s linear infinite; }
.connection-flow-glow { stroke:#ffd36c; stroke-width:6; filter:url(#skill-flow-glow); opacity:.7; }
@keyframes skill-line-energy { from { stroke-dashoffset:100; } to { stroke-dashoffset:0; } }
@media (prefers-reduced-motion:reduce) { .connection-flow { animation:none; stroke-dasharray:none; opacity:.4; } }
</style>
