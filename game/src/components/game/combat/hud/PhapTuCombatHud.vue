<script setup lang="ts">
// Slice 7 (master plan Task 8, 2026-09-04) — Pháp Tu: 3 slot cố định
// basic/special/ultimate (mô hình 3-skill Slice 2 thay N-slot loadout 5 ô
// cũ), giữ ArtifactCombatSlot riêng của path. Bấm chọn skill khi là lượt
// player paused (manual mode) qua useCombatSkillPresentation.
import CombatSkillSlot from './CombatSkillSlot.vue'
import ArtifactCombatSlot from './ArtifactCombatSlot.vue'
import { useCombatSkillPresentation } from '@/composables/useCombatSkillPresentation'
import { useArtifactCombatPresentation } from '@/composables/useArtifactCombatPresentation'

const { basic, special, ultimate, chooseSkill } = useCombatSkillPresentation()
const { presentation: artifactPresentation } = useArtifactCombatPresentation()
</script>

<template>
  <div class="phap-tu-combat-hud">
    <CombatSkillSlot
      v-if="basic && basic.skillId"
      class="phap-tu-combat-hud__slot"
      :empty-label="basic.skillId"
      :remaining="basic.cooldownRemaining"
      :total="basic.cooldownTotal"
      :is-masked="basic.state === 'cooldown'"
      :resource-cost="basic.resourceCost"
      :is-insufficient-resource="basic.state === 'blocked_resource'"
      :is-tappable="basic.state === 'ready'"
      @click="chooseSkill('basic')"
    />

    <CombatSkillSlot
      v-if="special && special.skillId"
      class="phap-tu-combat-hud__slot"
      :empty-label="special.skillId"
      :remaining="special.cooldownRemaining"
      :total="special.cooldownTotal"
      :is-masked="special.state === 'cooldown'"
      :resource-cost="special.resourceCost"
      :is-insufficient-resource="special.state === 'blocked_resource'"
      :is-tappable="special.state === 'ready'"
      @click="chooseSkill('special')"
    />

    <CombatSkillSlot
      v-if="ultimate && ultimate.skillId"
      class="phap-tu-combat-hud__slot"
      :empty-label="ultimate.skillId"
      :remaining="ultimate.cooldownRemaining"
      :total="ultimate.cooldownTotal"
      :is-masked="ultimate.state === 'cooldown'"
      :resource-cost="ultimate.resourceCost"
      :is-insufficient-resource="ultimate.state === 'blocked_resource'"
      :is-tappable="ultimate.state === 'ready'"
      @click="chooseSkill('ultimate')"
    />

    <ArtifactCombatSlot :state="artifactPresentation" />
  </div>
</template>

<style scoped>
.phap-tu-combat-hud {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: var(--space-2);
}

.phap-tu-combat-hud__slot {
  width: 72px;
}
</style>
