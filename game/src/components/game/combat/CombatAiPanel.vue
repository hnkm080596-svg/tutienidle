<script setup lang="ts">
// Combat AI strategy panel (combat-gate-teleport-autocast plan §11.1) —
// bảng AI nằm TRỰC TIẾP ở góc trái battlefield trong Combat Scene.
// PlayerData là nguồn sự thật duy nhất: đổi option gọi API có validate
// (GameManager.setCombatAiStrategy) rồi bumpState() — tự lưu qua save
// scheduling hiện có (autosave/visibilitychange). Panel là lớp overlay
// RIÊNG, chỉ nó nhận pointer events, không chặn battlefield và không
// làm đổi combat insets (plan §11.2).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import {
  COMBAT_AI_STRATEGIES,
  type CombatAiStrategy,
} from '@/core/battle/CombatAiStrategy'

const { t } = useI18n()
const gameManager = useGameManager()
const player = usePlayerStore()
const { stateVersion, bumpState } = useStateVersion()

function strategyLabel(strategy: CombatAiStrategy): string {
  return t(`combat.overlay.aiPanel.strategies.${strategy}`)
}

function strategyHint(strategy: CombatAiStrategy): string {
  return t(`combat.overlay.aiPanel.hints.${strategy}`)
}

const current = computed<CombatAiStrategy>(() => {
  stateVersion.value

  return player.combatAiStrategy
})

function select(strategy: CombatAiStrategy) {
  if (!gameManager.setCombatAiStrategy(player.$state, strategy)) {
    return
  }

  bumpState()
}
</script>

<template>
  <div class="combat-ai-panel" role="radiogroup" :aria-label="t('combat.overlay.aiPanel.ariaGroup')">
    <span class="combat-ai-panel__title">{{ t('combat.overlay.aiPanel.title') }}</span>

    <label
      v-for="strategy in COMBAT_AI_STRATEGIES"
      :key="strategy"
      class="combat-ai-panel__option"
      :title="strategyHint(strategy)"
    >
      <input
        type="radio"
        name="combat-ai-strategy"
        :value="strategy"
        :checked="current === strategy"
        @change="select(strategy)"
      />

      <span>{{ strategyLabel(strategy) }}</span>
    </label>
  </div>
</template>

<style scoped>
.combat-ai-panel {
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--ink-line);
  border-radius: var(--radius-md);
  background: var(--scrim);
  backdrop-filter: blur(2px);
  font-size: var(--text-xs, 0.75rem);
  color: var(--text-primary);
  user-select: none;
}

.combat-ai-panel__title {
  font-family: var(--font-display);
  color: var(--chrome-100);
  letter-spacing: 0.04em;
}

.combat-ai-panel__option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--tap-min);
  cursor: pointer;
  line-height: 1.5;
}

.combat-ai-panel__option input {
  accent-color: var(--chrome-300);
}
</style>
