<script setup lang="ts">
import TechniqueGradeNode from './TechniqueGradeNode.vue'
import TechniqueMasteryBar from './TechniqueMasteryBar.vue'

export interface TechniqueTrackNode {
  key: string
  label: string
  state: 'current' | 'next'
}

// Bottom strip (`grade-track`): region caption, the current->target grade
// chain with connector links, and the rank mastery line. The node list is
// contract-true (model can only quote current + target grades - the ref's
// 7-node realm chain is AI-invented, see report flags).
defineProps<{
  caption: string
  nodes: TechniqueTrackNode[]
  rankLine: string
  masteryValue: number
  masteryMax: number
  masteryLabel: string
}>()
</script>

<template>
  <section class="technique-scene__track technique-grade-track" data-hk-region="grade-track">
    <p class="technique-grade-track__caption">{{ caption }}</p>
    <ol class="technique-grade-track__nodes">
      <template v-for="(node, index) in nodes" :key="node.key">
        <TechniqueGradeNode :label="node.label" :state="node.state" />
        <li
          v-if="index < nodes.length - 1"
          class="technique-scene__track-link technique-grade-track__link"
          aria-hidden="true"
        />
      </template>
    </ol>
    <TechniqueMasteryBar
      :rank-line="rankLine"
      :value="masteryValue"
      :max="masteryMax"
      :value-label="masteryLabel"
    />
  </section>
</template>

<style scoped>
.technique-grade-track {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--hk-space-2);
  min-width: 0;
  min-height: 0;
  padding: var(--hk-space-2) var(--hk-space-4);
}

.technique-grade-track__caption {
  margin: 0;
  font-size: var(--text-xs);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--hk-text-muted);
}

.technique-grade-track__nodes {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--hk-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.technique-grade-track__link {
  width: 56px;
  height: 2px;
  align-self: center;
  margin-bottom: 18px;
  background: linear-gradient(90deg, var(--hk-gold), var(--hk-border-muted));
  flex-shrink: 0;
}
</style>
