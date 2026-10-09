<script setup lang="ts">
import { computed, ref, useId, type ComponentPublicInstance } from 'vue'
import { i18n } from '@/i18n'
import OrnateDialog from '@/components/common/art/OrnateDialog.vue'
import OrnateButton from '@/components/common/art/OrnateButton.vue'
import OrnateDivider from '@/components/common/art/OrnateDivider.vue'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import { useAudioStore } from '@/stores/audio'

// B1.9 guest-abandon confirmation: leaving the session clears the ONLY
// credential that can re-enter this account, so the dialog explains the
// access loss and offers upgrade / export / cancel before the explicit
// abandon. Same ornate chrome recipe as ConfirmModal.
const props = defineProps<{ open: boolean; busy?: boolean }>()
const emit = defineEmits<(event: 'upgrade' | 'export' | 'abandon' | 'cancel') => void>()

const titleId = useId()
const messageId = useId()
const dialogRef = ref<ComponentPublicInstance | null>(null)
const panelEl = () => (dialogRef.value?.$el as HTMLElement | undefined) ?? null

function pick(event: 'upgrade' | 'export' | 'abandon' | 'cancel') {
  // Literal cue ids only - the manifest binding scan resolves cue args.
  if (event === 'cancel') useAudioStore().cue('ui.cancel')
  else useAudioStore().cue('ui.confirm')
  emit(event)
}

useDialogFocus(panelEl, computed(() => props.open), {
  onEscape: () => pick('cancel'),
})
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-modal">
      <div v-if="open" class="abandon-modal" :style="{ zIndex: OVERLAY_LAYERS.panel }">
        <OrnateDialog
          ref="dialogRef"
          class="abandon-modal__panel"
          role="alertdialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="messageId"
          :title="i18n.global.t('account.abandon.title')"
          :title-id="titleId"
          badge="alert"
          show-close
          :close-label="i18n.global.t('panels.common.cancel')"
          width="min(600px, 94vw)"
          @close="pick('cancel')"
        >
          <p :id="messageId" class="abandon-modal__message">{{ i18n.global.t('account.abandon.body') }}</p>
          <OrnateDivider />

          <template #actions>
            <div class="abandon-modal__actions">
              <OrnateButton variant="dark" :sound="false" :disabled="busy" data-testid="abandon-upgrade" @click="pick('upgrade')">
                {{ i18n.global.t('account.abandon.upgrade') }}
              </OrnateButton>
              <OrnateButton variant="dark" :sound="false" :disabled="busy" data-testid="abandon-export" @click="pick('export')">
                {{ i18n.global.t('account.abandon.export') }}
              </OrnateButton>
              <OrnateButton variant="dark" :sound="false" :disabled="busy" @click="pick('cancel')">
                {{ i18n.global.t('panels.common.cancel') }}
              </OrnateButton>
              <OrnateButton variant="gold" :sound="false" :loading="busy" data-testid="abandon-confirm" @click="pick('abandon')">
                {{ i18n.global.t('account.abandon.confirm') }}
              </OrnateButton>
            </div>
          </template>
        </OrnateDialog>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.abandon-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--scrim);
}

.abandon-modal__panel {
  --ornate-actions-h: 30cqh;
  flex: none;
}

.abandon-modal__message {
  flex: none;
  margin: 0;
  max-width: 100%;
  color: var(--paper-text-soft, #5e5a50);
  font-size: min(3cqh, var(--text-sm));
  line-height: 1.5;
  text-align: center;
}

.abandon-modal__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 2cqh 6cqw;
  width: 74cqw;
  height: 100%;
}
</style>
