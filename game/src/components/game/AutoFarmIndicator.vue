<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager } from '@/composables/useGameState'
import GameButton from '@/components/common/GameButton.vue'

// Audit T1-6 fix — auto-farm holds the single StageManager slot while
// armed, so no combat can be mounted at the same time; the indicator must
// live in the home chrome (GameRoot), not the combat HUD. Stop is a
// domain command (A7): the component never mutates farm state itself.
const { t } = useI18n()
const player = usePlayerStore()
const gameManager = useGameManager()

const armedStageName = computed(() => {
  const armed = player.autoFarmStage
  if (!armed) {
    return null
  }

  return gameManager.catalogOps.getStage(armed.stageId)?.name ?? armed.stageId
})

function stopAutoFarm() {
  gameManager.turnBattleOps.autoFarmOps.stopAutoFarm(player.$state)
}
</script>

<template>
  <div v-if="armedStageName" class="auto-farm-indicator sys-ephemeral">
    <span class="auto-farm-indicator__label">
      {{ t('autoFarm.running', { stage: armedStageName }) }}
    </span>
    <GameButton variant="system" size="sm" accent-var="var(--sys-danger, var(--crimson))" data-testid="autofarm-stop" @click="stopAutoFarm">
      {{ t('autoFarm.stop') }}
    </GameButton>
  </div>
</template>

<style scoped>
.auto-farm-indicator {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  z-index: 12;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 10px;
  font-size: var(--text-sm);
  color: var(--sys-text, var(--paper-text));
}
</style>
