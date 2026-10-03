<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import SkillSurface from '@/components/scenes/skill/SkillSurface.vue'

// Scene 07 (Ky Nang) fidelity integration: the imperial-scroll 3-column
// panel is replaced by the approved skill-v2 paper constellation surface
// mounted on an overlay design canvas above the Dong Fu vista. The store
// contract is unchanged - ui.standalonePanel === 'skill' is the open
// authority and closeHomeOverlays() is the close command. User ruling
// (S07): skills auto-mount by pathway - no equip/role library, only
// unlock + upgrade + respec on the current pathway's tree.
const ui = useUiStore()
</script>

<template>
  <SkillSurface v-if="ui.standalonePanel === 'skill'" />
</template>
