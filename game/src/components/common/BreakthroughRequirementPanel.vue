<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBreakthroughRequirementStore } from '@/stores/breakthroughRequirement'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useTribulation } from '@/composables/useTribulation'
import { projectTechniqueCompletion } from '@/core/technique/TechniqueProgression'
import OverlayPanel from '@/components/common/OverlayPanel.vue'
import GameButton from '@/components/common/GameButton.vue'

// Task 9.1 — panel xác nhận đơn giản: cảnh báo "không thể mặc trang bị
// khi độ kiếp" + 2 nút. Auto-unequip do triggerBreakthrough() lo.
const { t } = useI18n()
const store = useBreakthroughRequirementStore()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const { triggerBreakthrough } = useTribulation()

// M-F-TECHNIQUE (F-BREAK-CONFIRM) - unperfected warning: fires iff the
// live cycle's projected seal is below vien_man (the FIELD is compared
// - projectTechniqueCompletion returns an outcome object). Pure copy -
// the player may still breakthrough; sealed live-grade records return
// verbatim, in-band cycles project from the current rank + realmLevel.
const techniqueCompletionWarning = computed(() => {
  stateVersion.value

  const technique = gameManager.techniqueManager.getActive()
  if (!technique) return undefined

  const outcome = projectTechniqueCompletion(technique, player.$state.realmLevel)

  return outcome.completionState !== 'vien_man'
    ? { grade: technique.grade, state: outcome.completionState }
    : undefined
})

function onConfirm() {
  store.close()
  triggerBreakthrough()
}

function onCancel() {
  store.close()
}
</script>

<template>
  <OverlayPanel
    :open="store.isOpen"
    :title="t('tribulation.stillEquipped.title')"
    width="min(420px, 94vw)"
    variant="system"
    @close="onCancel"
  >
    <div class="breakthrough-confirm">
      <p class="breakthrough-confirm__warning">{{ t('tribulation.stillEquipped.subtitle') }}</p>

      <p v-if="techniqueCompletionWarning" class="breakthrough-confirm__warning">
        {{
          t('tribulation.unperfectedTechnique.warning', {
            grade: techniqueCompletionWarning.grade,
            state: t(`tribulation.unperfectedTechnique.state.${techniqueCompletionWarning.state}`),
          })
        }}
      </p>

      <div class="breakthrough-confirm__actions">
        <GameButton variant="ghost" size="sm" @click="onCancel">{{ t('tribulation.stillEquipped.cancel') }}</GameButton>
        <GameButton size="sm" @click="onConfirm">{{ t('tribulation.stillEquipped.confirm') }}</GameButton>
      </div>
    </div>
  </OverlayPanel>
</template>

<style scoped>
.breakthrough-confirm {
  padding: 20px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.breakthrough-confirm__warning {
  margin: 0;
  padding: 8px 12px;
  font-size: var(--text-sm);
  text-align: center;
  color: var(--danger, #c0392b);
  border: 1px dashed currentColor;
  border-radius: var(--radius-sm);
}

.breakthrough-confirm__actions {
  display: flex;
  gap: 10px;
}

.breakthrough-confirm__actions > * {
  flex: 1;
}
</style>
