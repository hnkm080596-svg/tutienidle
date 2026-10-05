<script setup lang="ts">
// Beta scope v2 (frontend-contract sec.H) - the deliberate ending beat:
// a blocking dialog shown once betaCompletionFor(player).betaComplete
// resolves true. There is no Kim Dan CTA - the modal only acknowledges
// the completed slice; dismiss writes a device-local ack flag in
// App.vue (no save-schema impact).
import { onMounted, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import GameButton from './GameButton.vue'
import PcPaperChrome from './PcPaperChrome.vue'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import { useAudioStore } from '@/stores/audio'

const emit = defineEmits<{ dismiss: [] }>()

const { t } = useI18n()

const panelRef = ref<HTMLElement | null>(null)

// The ending beat IS the reward moment (same convention as the
// offline summary stinger).
onMounted(() => {
  useAudioStore().cue('stinger.announce')
})

function onContinue() {
  useAudioStore().cue('ui.confirm')
  useAudioStore().cue('ui.modal.close')
  emit('dismiss')
}

useDialogFocus(panelRef, ref(true), { onEscape: onContinue })

const titleId = useId()
</script>

<template>
  <div class="beta-completion" :style="{ zIndex: OVERLAY_LAYERS.modal }">
    <section
      ref="panelRef"
      class="beta-completion__panel paper-on-dark"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
    >

      <PcPaperChrome />


      <h3 :id="titleId" class="beta-completion__title">{{ t('betaComplete.title') }}</h3>

      <p class="beta-completion__body">{{ t('betaComplete.body') }}</p>

      <GameButton class="beta-completion__continue" :sound="false" @click="onContinue">{{ t('betaComplete.continue') }}</GameButton>
    </section>
  </div>
</template>

<style scoped>
.beta-completion {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--scrim);
}

.beta-completion__panel {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: min(340px, 92vw);
  max-width: min(460px, 92vw);
  padding: 44px 40px;
  color: var(--paper-text, #211f1a);
  font-family: var(--font-body);
}

.beta-completion__panel > :not(.ink-nine-slice) {
  position: relative;
  z-index: 3;
}

.beta-completion__title {
  margin: 0 0 6px;
  font-family: var(--font-display);
  font-size: var(--text-title);
  letter-spacing: 0.06em;
  color: var(--paper-text, #211f1a);
  text-align: center;
}

.beta-completion__body {
  margin: 0;
  font-size: var(--text-body);
  line-height: 1.55;
  text-align: center;
}

.beta-completion__continue {
  margin-top: 8px;
  align-self: center;
}
</style>
