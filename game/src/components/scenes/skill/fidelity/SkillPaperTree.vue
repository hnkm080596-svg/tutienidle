<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SkillUiNode, SkillUiEdge } from './skillUi'
import SkillPaperNode from './SkillPaperNode.vue'
import { skillGraphViewport } from './skillGraphViewport'
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
const connections = computed(() => props.edges.flatMap(edge => {
  const from = props.nodes.find(node => node.id === edge.from)
  const to = props.nodes.find(node => node.id === edge.to)
  return from && to ? [{ ...edge, fromNode: from, toNode: to }] : []
}))

// Paint lowest nodes first: a node's name/level label hangs below its disc
// into the next ring, so any disc that can cover it sits at a larger y.
// Descending-y order keeps every label above every disc that could occlude it.
const paintNodes = computed(() => [...props.nodes].sort((a, b) => b.y - a.y))
const viewBox = computed(() => `0 0 ${props.size} ${props.size}`)
const viewport = computed(() => skillGraphViewport(props.nodes, props.fit))
const graphStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  transform: `translate(${viewport.value.x}px, ${viewport.value.y}px) scale(${viewport.value.scale})`,
}))
</script>
<template>
  <div class="skill-paper-tree" :aria-label="t('skill.tree')">
    <div class="skill-graph" :style="graphStyle">
      <svg class="skill-tree-lines" :viewBox="viewBox" aria-hidden="true">
        <line v-for="edge in connections" :key="`${edge.from}-${edge.to}`" :x1="edge.fromNode.x" :y1="edge.fromNode.y" :x2="edge.toNode.x" :y2="edge.toNode.y" :class="['skill-connection', { muted: edge.toNode.state === 'locked' }]" />
      </svg>
      <SkillPaperNode v-for="node in paintNodes" :key="node.id" class="skill-positioned-node" :node="node" :selected="selected === node.id" :style="{ left: `${node.x}px`, top: `${node.y}px` }" @select="emit('select', $event)" />
    </div>
  </div>
</template>
<style scoped>
.skill-positioned-node { position:absolute; transform:translate(-50%,-38px); }
.skill-paper-tree { position:absolute; left:205px; top:282px; width:740px; height:420px; }
.skill-graph { position:absolute; left:0; top:0; transform-origin:0 0; }
.skill-tree-lines { position:absolute; inset:0; width:100%; height:100%; overflow:visible; }
.skill-connection { stroke:#b48732; stroke-width:2; filter:drop-shadow(0 0 3px #edc56a); }
.skill-connection.muted { stroke:#aa9c78; stroke-dasharray:4 6; filter:none; }
</style>
