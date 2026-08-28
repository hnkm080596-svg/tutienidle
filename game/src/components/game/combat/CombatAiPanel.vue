<script setup lang="ts">
// Combat AI strategy panel (combat-gate-teleport-autocast plan §11.1) —
// bảng AI nằm TRỰC TIẾP ở góc trái battlefield trong Combat Scene.
// PlayerData là nguồn sự thật duy nhất: đổi option gọi API có validate
// (GameManager.setCombatAiStrategy) rồi bumpState() — tự lưu qua save
// scheduling hiện có (autosave/visibilitychange). Panel là lớp overlay
// RIÊNG, chỉ nó nhận pointer events, không chặn battlefield và không
// làm đổi combat insets (plan §11.2).
import { computed } from 'vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import {
  COMBAT_AI_STRATEGIES,
  type CombatAiStrategy,
} from '@/core/battle/CombatAiStrategy'

const gameManager = useGameManager()
const player = usePlayerStore()
const { stateVersion, bumpState } = useStateVersion()

const LABELS: Record<CombatAiStrategy, string> = {
  nearest: 'Gần nhất',
  boss_first: 'Ưu tiên Boss',
  elite_first: 'Ưu tiên Elite',
  lowest_hp: 'HP thấp nhất',
  highest_hp: 'HP cao nhất',
}

const HINTS: Record<CombatAiStrategy, string> = {
  nearest: 'Chọn mục tiêu có khoảng cách Chebyshev nhỏ nhất.',
  boss_first: 'Boss trước, sau đó xếp theo khoảng cách.',
  elite_first: 'Boss → Elite → thường, sau đó xếp theo khoảng cách.',
  lowest_hp: 'Chọn mục tiêu đang còn máu thấp nhất.',
  highest_hp: 'Chọn mục tiêu đang còn máu cao nhất.',
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
  <div class="combat-ai-panel" role="radiogroup" aria-label="Chiến lược AI chọn mục tiêu">
    <span class="combat-ai-panel__title">AI Mục Tiêu</span>

    <label
      v-for="strategy in COMBAT_AI_STRATEGIES"
      :key="strategy"
      class="combat-ai-panel__option"
      :title="HINTS[strategy]"
    >
      <input
        type="radio"
        name="combat-ai-strategy"
        :value="strategy"
        :checked="current === strategy"
        @change="select(strategy)"
      />

      <span>{{ LABELS[strategy] }}</span>
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
