<script setup lang="ts">
// Scene 10 ai-panel region (spec: 16/140/228/280, shell-panel family,
// surface-m-panel + list-row). 5 canonical strategies live inside
// CombatAiPanel (audit: ref's 4 -> real 5).
//
// wave B (art-qa): the panel no longer auto-opens at battle start - the
// rail renders a compact 'AI Muc Tieu' chip; opening/closing is a local
// shell concern (CombatAiPanel stays content-only). The chip rides the
// drawn button-compact slice. ui-combat reskin (2026-10-04): the mock's
// 'AI Chien Dau' card carries its own x close in the panel heading -
// the panel emits `close` and the rail flips back to the chip.
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import GameCard from '@/components/common/GameCard.vue'
import GameActionButton from '@/components/common/GameActionButton.vue'
import CombatAiPanel from '@/components/game/combat/CombatAiPanel.vue'

const { t } = useI18n()
const aiOpen = shallowRef(false)
</script>

<template>
  <GameActionButton
    v-if="!aiOpen"
    class="combat-ai-rail__reopen"
    type="button"
    v-tooltip="{ title: t('combat.overlay.aiPanel.title') }"
    @click="aiOpen = true"
  >
    <span class="combat-ai-rail__reopen-label">{{ t('combat.overlay.aiPanel.title') }}</span>
  </GameActionButton>

  <GameCard v-else class="combat-ai-rail" data-hk-region="ai-panel">
    <CombatAiPanel @close="aiOpen = false" />
  </GameCard>
</template>

<style scoped>
.combat-ai-rail { position: relative; isolation: isolate; }

.combat-ai-rail > .combat-ai-panel { position: relative; z-index: 2; }

/* Collapsed state: the reopen chip keeps the rail's anchor but takes a
   fraction of the footprint - battlefield stays clear until asked. */
.combat-ai-rail__reopen {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 30px;
  padding: 0 16px;
  border: 0;
  background: transparent;
  color: var(--chrome-100);
  font: 700 13px/1 var(--font-display, Georgia, serif);
  letter-spacing: 0.02em;
  cursor: pointer;
  pointer-events: auto;
}

.combat-ai-rail__reopen-label {
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  line-height: 1;
}

.combat-ai-rail__reopen:focus,
.combat-ai-rail__reopen:focus-visible {
  outline: none;
}
.combat-ai-rail.game-card { padding: 0; }
.combat-ai-rail__reopen.game-action-button {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  text-align: center;
  width: auto;
  height: 40px;
  min-width: 156px;
  padding: 0 18px;
}
</style>
