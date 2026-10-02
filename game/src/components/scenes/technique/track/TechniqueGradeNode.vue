<script setup lang="ts">
import { computed } from 'vue'
import { hkChromeUrl } from '@/ui/huyenKimChrome'

// One disc in the grade chain: dao-luan-node art (or token fallback) +
// grade caption. States: is-current (gold, filled) / is-next (jade ring).
const props = defineProps<{
  label: string
  state: 'current' | 'next'
}>()

const nodeArt = computed(() => hkChromeUrl('dao-luan-node'))

const stateClass = computed(() => `is-${props.state}`)
</script>

<template>
  <li class="technique-scene__track-node technique-grade-node" :class="stateClass">
    <span
      class="technique-grade-node__disc"
      :style="nodeArt ? { backgroundImage: `url(${nodeArt})` } : undefined"
      :art-needed="!nodeArt || undefined"
      data-art-id="dao-luan-node"
    />
    <span class="technique-grade-node__label">{{ label }}</span>
  </li>
</template>

<style scoped>
.technique-grade-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.technique-grade-node__disc {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, var(--paper-200), var(--hk-surface-raised) 78%);
  background-size: cover;
  background-position: center;
  border: 2px solid var(--hk-border-active);
}

.technique-grade-node.is-current .technique-grade-node__disc {
  border-color: var(--hk-gold);
  box-shadow: 0 0 10px rgba(185, 154, 85, 0.5);
}

.technique-grade-node.is-next .technique-grade-node__disc {
  border-color: var(--hk-jade);
  border-style: dashed;
  opacity: 0.85;
}

.technique-grade-node__label {
  font-size: var(--text-xs);
  color: var(--hk-text-secondary);
  white-space: nowrap;
}

.technique-grade-node.is-current .technique-grade-node__label {
  color: var(--hk-gold);
  font-weight: 600;
}
</style>
