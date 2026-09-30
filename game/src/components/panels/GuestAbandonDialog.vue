<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { i18n } from '@/i18n'
import GameButton from '@/components/common/GameButton.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import { useAudioStore } from '@/stores/audio'

// B1.9 guest-abandon confirmation: leaving the session clears the ONLY
// credential that can re-enter this account, so the dialog explains the
// access loss and offers upgrade / export / cancel before the explicit
// abandon. Same InkNineSlice recipe as ConfirmModal.
const props = defineProps<{ open: boolean; busy?: boolean }>()
const emit = defineEmits<(event: 'upgrade' | 'export' | 'abandon' | 'cancel') => void>()

const titleId = useId()
const messageId = useId()
const panelRef = ref<HTMLElement | null>(null)

function pick(event: 'upgrade' | 'export' | 'abandon' | 'cancel') {
  // Literal cue ids only - the manifest binding scan resolves cue args.
  if (event === 'cancel') useAudioStore().cue('ui.cancel')
  else useAudioStore().cue('ui.confirm')
  emit(event)
}

useDialogFocus(panelRef, computed(() => props.open), {
  onEscape: () => pick('cancel'),
})
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-modal">
      <div v-if="open" class="abandon-modal" :style="{ zIndex: OVERLAY_LAYERS.panel }">
        <section
          ref="panelRef"
          class="abandon-modal__panel paper-on-dark"
          tabindex="-1"
          role="alertdialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="messageId"
        >
          <InkNineSlice asset-id="surface-m-paper" layer="surface" />
          <InkNineSlice asset-id="frame-m-seal-corner" layer="frame" :thickness="18" />

          <h3 :id="titleId" class="abandon-modal__title">{{ i18n.global.t('account.abandon.title') }}</h3>
          <p :id="messageId" class="abandon-modal__message">{{ i18n.global.t('account.abandon.body') }}</p>

          <div class="abandon-modal__actions">
            <GameButton variant="secondary" :sound="false" :disabled="busy" data-testid="abandon-upgrade" @click="pick('upgrade')">
              {{ i18n.global.t('account.abandon.upgrade') }}
            </GameButton>
            <GameButton variant="secondary" :sound="false" :disabled="busy" data-testid="abandon-export" @click="pick('export')">
              {{ i18n.global.t('account.abandon.export') }}
            </GameButton>
            <GameButton variant="ghost" :sound="false" :disabled="busy" @click="pick('cancel')">
              {{ i18n.global.t('panels.common.cancel') }}
            </GameButton>
            <GameButton variant="danger" :sound="false" :loading="busy" data-testid="abandon-confirm" @click="pick('abandon')">
              {{ i18n.global.t('account.abandon.confirm') }}
            </GameButton>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.abandon-modal { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: var(--scrim); }
.abandon-modal__panel { position: relative; isolation: isolate; width: min(440px, 92vw); padding: 40px 36px; color: var(--paper-text); font-family: var(--font-body); text-align: center; }
.abandon-modal__panel > :not(.ink-nine-slice) { position: relative; z-index: 3; }
.abandon-modal__title { margin: 0 0 10px; font-family: var(--font-display); font-size: var(--text-title); letter-spacing: .06em; color: var(--cinnabar, #b54432); }
.abandon-modal__message { margin: 0 0 18px; color: var(--paper-text-soft, #5e5a50); font-size: var(--text-sm); line-height: 1.6; }
.abandon-modal__actions { display: grid; gap: 10px; }
</style>
