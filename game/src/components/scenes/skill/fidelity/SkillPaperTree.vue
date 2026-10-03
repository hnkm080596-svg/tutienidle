<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SkillUiNode, SkillUiEdge } from './skillUi'
import SkillPaperNode from './SkillPaperNode.vue'
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
        <line v-for="edge in connections" :key="`${edge.from}-${edge.to}`" :x1="edge.fromNode.x" :y1="edge.fromNode.y" :x2="edge.toNode.x" :y2="edge.toNode.y" :class="['skill-connection', { muted: edge.toNode.state === 'locked' }]" />
      </svg>
      <SkillPaperNode v-for="node in nodes" :key="node.id" class="skill-positioned-node" :node="node" :selected="selected === node.id" :style="{ left: `${node.x}px`, top: `${node.y}px` }" @select="emit('select', $event)" />
    </div>
  </div>
</template>
<style scoped>
.skill-positioned-node { position:absolute; transform:translate(-50%,-38px); }
.skill-paper-tree { position:absolute; left:228px; top:259px; width:710px; height:445px; }
.skill-graph { position:absolute; left:50%; top:50%; transform-origin:center; }
.skill-tree-lines { position:absolute; inset:0; width:100%; height:100%; overflow:visible; }
.skill-connection { stroke:#b48732; stroke-width:2; filter:drop-shadow(0 0 3px #edc56a); }
.skill-connection.muted { stroke:#aa9c78; stroke-dasharray:4 6; filter:none; }
</style>
