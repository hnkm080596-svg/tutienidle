<script setup lang="ts">
// Beta scope v2 (frontend-contract sec.H) - the deliberate ending beat:
// a blocking dialog shown once betaCompletionFor(player).betaComplete
// resolves true. There is no Kim Dan CTA - the modal only acknowledges
// the completed slice; dismiss writes a device-local ack flag in
// App.vue (no save-schema impact).
import { onMounted, ref, useId, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import OrnateDialog from './art/OrnateDialog.vue'
import OrnateButton from './art/OrnateButton.vue'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import { useAudioStore } from '@/stores/audio'

const emit = defineEmits<{ dismiss: [] }>()

const { t } = useI18n()

const dialogRef = ref<ComponentPublicInstance | null>(null)
const panelEl = () => (dialogRef.value?.$el as HTMLElement | undefined) ?? null

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

useDialogFocus(panelEl, ref(true), { onEscape: onContinue })

const titleId = useId()
</script>

<template>
  <div class="beta-completion" :style="{ zIndex: OVERLAY_LAYERS.modal }">
    <OrnateDialog
      ref="dialogRef"
      class="beta-completion__panel"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :title="t('betaComplete.title')"
      :title-id="titleId"
      badge="info"
      show-close
      :close-label="t('betaComplete.continue')"
      width="min(500px, 94vw)"
      @close="onContinue"
    >
      <p class="beta-completion__body">{{ t('betaComplete.body') }}</p>

      <template #actions>
        <OrnateButton class="beta-completion__continue" variant="gold" :sound="false" @click="onContinue">{{ t('betaComplete.continue') }}</OrnateButton>
      </template>
    </OrnateDialog>
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
  flex: none;
}

.beta-completion__body {
  margin: 3cqh 0 0;
  font-size: min(3.2cqh, var(--text-body));
  line-height: 1.55;
  text-align: center;
}
</style>
