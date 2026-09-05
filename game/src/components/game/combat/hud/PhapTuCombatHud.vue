<script setup lang="ts">
// Slice 7 HUD dedup fix (Defect Task 7, 2026-09-05) — the 3 basic/special/
// ultimate skill slots this file used to render (via useCombatSkillPresentation)
// were a duplicate of TurnCombatSkillBar.vue, which CombatSceneOverlay.vue
// mounts side-by-side with CombatBuildHud. TurnCombatSkillBar is the complete,
// correct surface (manual/auto toggle, awaiting-choice label, disabled-state
// gating) — this file now only keeps ArtifactCombatSlot, which is unique to
// the Pháp Tu path and not duplicated anywhere else.
import ArtifactCombatSlot from './ArtifactCombatSlot.vue'
import { useArtifactCombatPresentation } from '@/composables/useArtifactCombatPresentation'

const { presentation: artifactPresentation } = useArtifactCombatPresentation()
</script>

<template>
  <div class="phap-tu-combat-hud">
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
</style>
