<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useUiStore } from '@/stores/ui'

// Intro/transition phase (2026-09-07 plan Task 4) - curtain + zone/stage
// reveal during the 2s 'intro' phase BEFORE the 3-2-1 countdown (Combat
// playtest symptom: countdown starts before the player can even see where
// they are). Visible only while turnBattle.state === 'intro'. Modeled on
// CombatCountdownOverlay.vue - same primitive-computed + stateVersion
// pattern (mutate-in-place battle objects defeat Object.is() tracking).
const { t } = useI18n()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const ui = useUiStore()

const visible = computed(() => {
  stateVersion.value

  return gameManager.getBattle()?.state === 'intro'
})

// Same zone/stage accessor CombatTopBar.vue uses - no second source of
// truth for stage/zone naming (plan Task 4 interface requirement).
const stage = computed(() => ui.selectedStageId ? gameManager.getStage(ui.selectedStageId) : undefined)

const zoneName = computed(() => {
  if (!ui.selectedZoneId) {
    return ''
  }

  return gameManager.zoneRegistry.has(ui.selectedZoneId) ? gameManager.zoneRegistry.get(ui.selectedZoneId).name : ''
})

const zoneStageLabel = computed(() => {
  stateVersion.value

  const stageName = stage.value?.name

  return stageName ? `${zoneName.value} • ${stageName}` : zoneName.value
})
</script>

<template>
  <div v-if="visible" class="combat-intro-overlay">
    <div class="combat-intro-overlay__curtain combat-intro-overlay__curtain--left" />
    <div class="combat-intro-overlay__curtain combat-intro-overlay__curtain--right" />
    <div class="combat-intro-overlay__content">
      <span class="combat-intro-overlay__label">{{ t('combat.overlay.intro.entering') }}</span>
      <span v-if="zoneStageLabel" class="combat-intro-overlay__zone-stage">{{ zoneStageLabel }}</span>
    </div>
  </div>
</template>

<style scoped>
.combat-intro-overlay {
  position: absolute;
  inset: 0;
  z-index: 13;
  pointer-events: none;
  overflow: hidden;
}

.combat-intro-overlay__curtain {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 50%;
  background: var(--ink-950);
  animation: combat-intro-curtain-close 0.4s ease-out forwards;
}

.combat-intro-overlay__curtain--left {
  left: 0;
  transform: translateX(-100%);
}

.combat-intro-overlay__curtain--right {
  right: 0;
  transform: translateX(100%);
}

@keyframes combat-intro-curtain-close {
  to {
    transform: translateX(0);
  }
}

.combat-intro-overlay__content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  z-index: 1;
  animation: combat-intro-content-fade 0.5s ease-out 0.3s backwards;
}

.combat-intro-overlay__label {
  font-family: var(--font-display);
  font-size: var(--text-hero);
  font-weight: 700;
  color: var(--gold-300);
  text-shadow: 0 0 24px color-mix(in srgb, var(--gold-500) 60%, transparent), 0 2px 8px rgba(0, 0, 0, 0.8);
}

.combat-intro-overlay__zone-stage {
  font-family: var(--font-body);
  font-size: var(--text-body);
  color: var(--chrome-100);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
}

@keyframes combat-intro-content-fade {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
