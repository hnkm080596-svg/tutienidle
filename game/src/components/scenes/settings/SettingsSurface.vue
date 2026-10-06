<script setup lang="ts">
// Scene 17 (Cai Dat) production adapter: mounts the real SettingsPanel
// inside the approved paper chrome on an overlay design canvas - the
// same SceneDesignCanvas + fidelity shell + usePaperNavigation wiring
// the other migrated tabs use. Close is ui.closeHomeOverlays(); the
// panel's save/cloud/account logic is untouched.
import { useUiStore } from '@/stores/ui'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import SettingsFidelityScene from './fidelity/SettingsFidelityScene.vue'
import SettingsPanel from '@/components/panels/SettingsPanel.vue'

const ui = useUiStore()
</script>

<template>
  <SceneDesignCanvas overlay>
    <SettingsFidelityScene :groups="[]" active="" notice="" @back="ui.closeHomeOverlays()">
      <template #workspace>
        <SettingsPanel />
      </template>
    </SettingsFidelityScene>
  </SceneDesignCanvas>
</template>
