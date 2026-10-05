<script setup lang="ts">
// Combat AI strategy panel (combat-gate-teleport-autocast plan sec11.1) -
// bang AI nam TRUC TIEP o goc trai battlefield trong Combat Scene.
// PlayerData la nguon su that duy nhat: doi option goi API co validate
// (GameManager.setCombatAiStrategy) roi bumpState() - tu luu qua save
// scheduling hien co (autosave/visibilitychange). Panel la lop overlay
// RIENG, chi no nhan pointer events, khong chan battlefield va khong
// lam doi combat insets (plan sec11.2).
//
// ui-combat reskin (2026-10-04): the mock's AI panel is an 'AI Chien
// Dau' card - heading with a x close button, a 'target' fieldset legend,
// and the strategy radios as bordered rows whose selected one wears a
// gold wash. The close button only emits `close`; the rail owns the
// collapsed state + reopen control (the region must stay mounted for
// the reopen button to render).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import {
  COMBAT_AI_STRATEGIES,
  type CombatAiStrategy,
} from '@/core/battle/CombatAiStrategy'

const emit = defineEmits<{ close: [] }>()

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
  if (!gameManager.progressionOps.setCombatAiStrategy(player.$state, strategy)) {
    return
  }

  bumpState()
}
</script>

<template>
  <div class="combat-ai-panel" role="radiogroup" :aria-label="t('combat.overlay.aiPanel.ariaGroup')">
    <div class="combat-ai-panel__heading">
      <span class="combat-ai-panel__title">{{ t('combat.overlay.aiPanel.title') }}</span>
      <button
        type="button"
        class="combat-ai-panel__close"
        :aria-label="t('combat.overlay.aiPanel.close')"
        @click="emit('close')"
      >×</button>
    </div>

    <fieldset class="combat-ai-panel__strategies">
      <legend class="combat-ai-panel__legend">{{ t('combat.overlay.aiPanel.target') }}</legend>

      <label
        v-for="strategy in COMBAT_AI_STRATEGIES"
        :key="strategy"
        class="combat-ai-panel__option"
        :class="{ 'is-selected': current === strategy }"
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
    </fieldset>
  </div>
</template>

<style scoped>
/* wave B chrome: the rail's surface-m-panel slice owns the shell - this
   panel keeps content layout only (no hand border/scrim/backdrop). */
.combat-ai-panel {
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 10px 12px 14px;
  font-size: var(--text-xs, 0.75rem);
  color: var(--text-primary);
  user-select: none;
}

/* Mock: gold heading row, hairline underline, bare x close button. */
.combat-ai-panel__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #9e854957;
  margin-bottom: 8px;
}

.combat-ai-panel__title {
  font-family: var(--font-display);
  font-size: var(--text-body);
  font-weight: 500;
  color: #f0dcaa;
  letter-spacing: 0.04em;
}

.combat-ai-panel__close {
  background: none;
  border: 0;
  padding: 0 4px;
  color: #c9ad66;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.combat-ai-panel__close:hover {
  color: #ffe8a4;
}

.combat-ai-panel__strategies {
  border: 0;
  padding: 0;
  margin: 0;
}

.combat-ai-panel__legend {
  padding: 0 0 8px;
  font-size: var(--text-2xs, 10px);
  color: #b9a880;
}

/* Mock .strategy rows: bordered, min-height, gold wash when selected. */
.combat-ai-panel__option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--tap-min);
  margin-bottom: 5px;
  padding: 4px 8px;
  border: 1px solid #b59a4f22;
  border-radius: 4px;
  cursor: pointer;
  line-height: 1.5;
  color: #dacba8;
  background: #0002;
}

.combat-ai-panel__option.is-selected {
  border-color: #d3b268;
  background: linear-gradient(90deg, #8b672750, #20201800);
  color: #ffe4a8;
  box-shadow: inset 0 0 8px #e4ba4b22;
}

.combat-ai-panel__option input {
  accent-color: #be9e4c;
  margin: 0;
}
</style>
