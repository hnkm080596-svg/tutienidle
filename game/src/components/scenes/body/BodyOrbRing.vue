<script setup lang="ts">
// Scene 08 figure-focus `orb ring`: the Bat Mach meridian map - the eight
// authored meridian nodes (data/realm/Meridians.ts, Ky Kinh Bat Mach)
// sit on an ellipse around the cultivation figure, lit by real chapter
// progress. Placement mirrors the reference arc over/around the figure;
// the ring is decorative while orb state stays canonical.
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useStateVersion } from '@/composables/useGameState'
import { getBodyChapterProgress } from '@/core/realm/body/BodyProgressionSystem'
import { MERIDIANS } from '@/data/realm/Meridians'
import BodyOrb from './BodyOrb.vue'

const player = usePlayerStore()
const { stateVersion } = useStateVersion()

// Ellipse arc around the figure - positions in % of the orbit box,
// top center sweeping down both sides like the reference layout.
const ORB_POSITIONS: readonly { x: number; y: number }[] = [
  { x: 50, y: 4 },
  { x: 27, y: 13 },
  { x: 73, y: 13 },
  { x: 10, y: 36 },
  { x: 90, y: 36 },
  { x: 16, y: 62 },
  { x: 84, y: 62 },
  { x: 50, y: 80 },
]

const orbs = computed(() => {
  stateVersion.value

  const completed = getBodyChapterProgress(player.$state, 'meridian').completed

  return MERIDIANS.map((meridian, index) => ({
    id: meridian.id,
    name: meridian.name,
    status: index < completed ? 'done' as const : index === completed ? 'next' as const : 'locked' as const,
    position: ORB_POSITIONS[index] ?? ORB_POSITIONS[0]!,
  }))
})
</script>

<template>
  <div class="body-orb-ring" data-hk-region="orb-ring" aria-hidden="true">
    <div class="body-orb-ring__ellipse art-needed" data-art-id="body-meridian-ring" />
    <BodyOrb
      v-for="orb in orbs"
      :key="orb.id"
      class="body-orb-ring__orb"
      :style="{ left: `${orb.position.x}%`, top: `${orb.position.y}%` }"
      :name="orb.name"
      :status="orb.status"
    />
  </div>
</template>

<style scoped>
.body-orb-ring {
  position: absolute;
  /* 5% top clearance: the topmost node (y4% centers) is a 30-44px disc
     plus label - without the offset its cap clipped at the figure box's
     overflow-hidden top edge. */
  inset: 5% 0 0;
  pointer-events: none;
}
.body-orb-ring__ellipse {
  position: absolute;
  left: 50%;
  top: 42%;
  width: 92%;
  height: 84%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--hk-border-muted, #2a352f) 70%, transparent);
  box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.35);
}
.body-orb-ring__orb { pointer-events: auto; }
</style>
