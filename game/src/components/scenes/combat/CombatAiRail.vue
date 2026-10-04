<script setup lang="ts">
// Scene 10 ai-panel region (spec: 16/140/228/280, shell-panel family,
// surface-m-panel + list-row). 5 canonical strategies live inside
// CombatAiPanel (audit: ref's 4 -> real 5).
//
// wave B (art-qa): the panel no longer auto-opens at battle start - the
// rail renders a compact 'AI Muc Tieu' chip; opening/closing is a local
// shell concern (CombatAiPanel stays content-only). The chip rides the
// drawn button-compact slice; the close affordance is icon-button-utility.
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import GameButton from '@/components/common/GameButton.vue'
import HuyenKimSymbol from '@/components/common/HuyenKimSymbol.vue'
import CombatAiPanel from '@/components/game/combat/CombatAiPanel.vue'

const { t } = useI18n()
const aiOpen = shallowRef(false)
</script>

<template>
  <button
    v-if="!aiOpen"
    class="combat-ai-rail__reopen"
    type="button"
    :title="t('combat.overlay.aiPanel.title')"
    @click="aiOpen = true"
  >
    <InkNineSlice chrome-id="button-compact" layer="surface" />
    <span class="combat-ai-rail__reopen-label">{{ t('combat.overlay.aiPanel.title') }}</span>
  </button>

  <div v-else class="combat-ai-rail" data-hk-region="ai-panel">
    <InkNineSlice chrome-id="surface-m-panel" layer="surface" />
    <GameButton
      class="combat-ai-rail__close"
      variant="secondary"
      shape="circle"
      size="sm"
      :aria-label="t('panels.common.close')"
      @click="aiOpen = false"
    ><HuyenKimSymbol name="close" /></GameButton>
    <CombatAiPanel />
  </div>
</template>

<style scoped>
.combat-ai-rail { position: relative; isolation: isolate; }

/* InkNineSlice 'surface' renders at z-index 1 - contents need 2. */
.combat-ai-rail > :not(.ink-nine-slice) { position: relative; z-index: 2; }

.combat-ai-rail__close {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 3;
  width: 24px;
  height: 24px;
  min-width: 0;
  min-height: 0;
  padding: 0;
  font-size: var(--text-xs);
}

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
  padding: 4px 12px;
  border: 0;
  background: transparent;
  color: var(--chrome-100);
  font: var(--text-xs) var(--font-display, Georgia, serif);
  letter-spacing: 0.04em;
  cursor: pointer;
  pointer-events: auto;
}

.combat-ai-rail__reopen-label { position: relative; z-index: 2; white-space: nowrap; }

.combat-ai-rail__reopen:focus-visible {
  outline: 2px solid var(--chrome-300);
  outline-offset: 2px;
}
</style>
