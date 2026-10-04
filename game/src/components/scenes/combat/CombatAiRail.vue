<script setup lang="ts">
// Scene 10 ai-panel region (spec: 16/140/228/280, shell-panel family,
// surface-m-panel + list-row). 5 canonical strategies live inside
// CombatAiPanel (audit: ref's 4 -> real 5).
//
// ui-combat reskin (2026-10-04): the mock's panel collapses to a small
// 'AI Chiến Đấu' reopen button at the same anchor - the rail owns that
// collapsed state so the region stays mounted either way.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import CombatAiPanel from '@/components/game/combat/CombatAiPanel.vue'

const { t } = useI18n()
const collapsed = ref(false)
</script>

<template>
  <div class="combat-ai-rail" data-hk-region="ai-panel">
    <template v-if="!collapsed">
      <InkNineSlice chrome-id="surface-m-panel" layer="surface" />
      <CombatAiPanel @close="collapsed = true" />
    </template>
    <button
      v-else
      type="button"
      class="combat-ai-rail__reopen"
      @click="collapsed = false"
    >{{ t('combat.overlay.aiPanel.title') }}</button>
  </div>
</template>

<style scoped>
.combat-ai-rail { position: relative; isolation: isolate; }

/* InkNineSlice 'surface' renders at z-index 1 - contents need 2. */
.combat-ai-rail > :not(.ink-nine-slice) { position: relative; z-index: 2; }

/* The mock's collapsed .reopen utility button (same anchor as the
   panel). */
.combat-ai-rail__reopen {
  min-height: 32px;
  padding: 5px 12px;
  border: 1px solid #b69b58;
  border-radius: 4px;
  background: #0c1616e8;
  color: #ead69f;
  font-family: var(--font-display);
  font-size: var(--text-sm);
  cursor: pointer;
  pointer-events: auto;
}

.combat-ai-rail__reopen:hover {
  color: #ffe8a4;
  border-color: #e4c673;
}
</style>
