<script setup lang="ts">
// Scene 14 region `rewards` (design 526/280/620/120): the horizontal
// slot row of treasure gains (spirit stones + dropped items). Slot
// count is dynamic; the row wraps + scrollfades when a rich battle
// drops more kinds than fit on one line.
import type { VictorySlotView } from './victorySceneModel'
import VictoryRewardSlot from './VictoryRewardSlot.vue'

defineProps<{ slots: VictorySlotView[] }>()
</script>

<template>
  <ul
    class="victory-slots scrollfade"
    data-hk-region="rewards"
  >
    <VictoryRewardSlot v-for="slot in slots" :key="slot.id" :slot="slot" />
  </ul>
</template>

<style scoped>
.victory-slots {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-content: flex-start;
  gap: 10px 12px;
  margin: 0;
  padding: 6px 4px;
  list-style: none;
  max-height: 168px;
  overflow-y: auto;
  scrollbar-width: none;
}
.victory-slots::-webkit-scrollbar { display: none; }
</style>
