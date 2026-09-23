<script setup lang="ts">
/**
 * A11 (spec §6.1) — the pause overlay is NOT the curtain. The curtain
 * belongs to the presentation coordinator and covers route transitions
 * (App.vue's <PresentationTransitionOverlay>, position:fixed,
 * OVERLAY_LAYERS.curtain); this belongs to the battle and covers a
 * stopped CombatClock. Separate owners, separate state, separate
 * z-layers — neither may drive the other.
 * Conflating them would recreate the dead-control defect the coordinator
 * design already had to fix once.
 *
 * A7 — it dims and blocks input. It does NOT stop the scene: units keep
 * animating behind it (Phaser's own render loop is untouched — no
 * scene.pause(), no anims.pauseAll()). The dim is light enough that a
 * paused battle still looks like a battle waiting, not a screenshot.
 */
// M-UI-OVERHAUL: console card on SysModalBase (system chrome + focus
// trap); the scrim keeps the LIGHT dim - the .sys-scrim default + blur
// would hide the still-animating battlefield, which A7 forbids.
import { useI18n } from 'vue-i18n'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import SysModalBase from '@/components/common/system/SysModalBase.vue'

const emit = defineEmits<{ continue: [] }>()

const { t } = useI18n()
</script>

<template>
  <!-- :open=true - App.vue gates the component itself on isCombatPaused.
       Scrim click stays dead (closeOnScrim=false); Escape resumes via
       @close -> continue (standard pause-menu behavior). -->
  <SysModalBase
    :open="true"
    :title="t('combat.overlay.pause.title')"
    width="min(360px, 88vw)"
    :layer="OVERLAY_LAYERS.combatPause"
    :close-on-scrim="false"
    class="combat-pause"
    card-class="combat-pause__card"
    data-testid="combat-pause-overlay"
    @close="emit('continue')"
  >
    <p class="combat-pause__body">{{ t('combat.overlay.pause.body') }}</p>
    <button
      type="button"
      class="combat-pause__action"
      data-testid="combat-pause-continue"
      @click="emit('continue')"
    >
      {{ t('combat.overlay.pause.action') }}
    </button>
  </SysModalBase>
</template>

<style scoped>
/* .sys-modal is SysModalBase's root; the double-class selector outranks its
   scoped rule regardless of stylesheet order. Keeps A7's light dim - units
   must stay visible animating behind the pause prompt. */
.combat-pause.sys-modal {
  background: rgba(3, 7, 14, 0.45);
  backdrop-filter: none;
}

.combat-pause__card {
  text-align: center;
}

.combat-pause__body {
  margin: 0 0 18px;
  color: var(--sys-text-muted, var(--text-secondary, #cbd5e1));
  font-size: var(--text-sm, 14px);
}

.combat-pause__action {
  padding: 8px 20px;
  border: 1px solid var(--sys-accent, var(--gold-400, #d4a72c));
  border-radius: 0;
  background: color-mix(in srgb, var(--sys-accent, #d4a72c) 16%, transparent);
  color: var(--sys-text, #000);
  font-family: var(--sys-font-display, var(--font-body));
  font-size: var(--text-sm, 14px);
  letter-spacing: .08em;
  text-transform: uppercase;
  cursor: pointer;
}

.combat-pause__action:focus-visible {
  outline: 2px solid var(--sys-focus, rgba(217, 212, 199, .65));
  outline-offset: 2px;
}
</style>
