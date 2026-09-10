<script setup lang="ts">
/**
 * A11 (spec §6.1) — the pause overlay is NOT the curtain. The curtain
 * belongs to the presentation coordinator and covers route transitions
 * (App.vue's <PresentationTransitionOverlay>, position:fixed, z-index 1000);
 * this belongs to the battle and covers a stopped CombatClock. Separate
 * owners, separate state, separate z-layers — neither may drive the other.
 * Conflating them would recreate the dead-control defect the coordinator
 * design already had to fix once.
 *
 * A7 — it dims and blocks input. It does NOT stop the scene: units keep
 * animating behind it (Phaser's own render loop is untouched — no
 * scene.pause(), no anims.pauseAll()). The dim is light enough that a
 * paused battle still looks like a battle waiting, not a screenshot.
 */
import { useI18n } from 'vue-i18n'

defineEmits<{ continue: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="combat-pause" data-testid="combat-pause-overlay" role="dialog" aria-modal="true">
    <div class="combat-pause__card">
      <h3 class="combat-pause__title">{{ t('combat.overlay.pause.title') }}</h3>
      <p class="combat-pause__body">{{ t('combat.overlay.pause.body') }}</p>
      <button
        type="button"
        class="combat-pause__action"
        data-testid="combat-pause-continue"
        @click="$emit('continue')"
      >
        {{ t('combat.overlay.pause.action') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* position:fixed (not absolute) — mounted at App.vue's template top level,
   which has no positioned ancestor, same reasoning as the curtain's own
   .transition-overlay rule. z-index sits BELOW the curtain's 1000: the
   curtain must always be able to cover this, never the reverse. */
.combat-pause {
  position: fixed;
  inset: 0;
  z-index: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Light dim on purpose (A7) — units must stay visible animating behind it. */
  background: rgba(0, 0, 0, 0.45);
}

.combat-pause__card {
  padding: 24px 32px;
  text-align: center;
  background: var(--ink-900, #141820);
  border: 1px solid var(--gold-400, #d4a72c);
  border-radius: 8px;
  max-width: min(360px, 88vw);
}

.combat-pause__title {
  margin: 0 0 10px;
  color: var(--gold-300, #ffd54f);
  font-family: var(--font-display, serif);
  font-size: var(--text-md, 18px);
}

.combat-pause__body {
  margin: 0 0 18px;
  color: var(--text-secondary, #cbd5e1);
  font-size: var(--text-sm, 14px);
}

.combat-pause__action {
  padding: 8px 20px;
  border: none;
  border-radius: 4px;
  background: var(--gold-400, #d4a72c);
  color: #000;
  font-size: var(--text-sm, 14px);
  cursor: pointer;
}
</style>
