<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { i18n } from '@/i18n'
import GameButton from './GameButton.vue'
import PcPaperChrome from './PcPaperChrome.vue'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import { useAudioStore } from '@/stores/audio'

// Restyle (2026-09-28, ui-audit creation-meta) - was SysModalBase system
// chrome (sci-fi chrome chrome + translucent panel) clashing with the
// game's ink/paper art. Now the same M-tier InkNineSlice recipe as
// OfflineSummaryModal + .paper-on-dark token map. Panel renders opaque
// (ink art has no translucency knob).
//
// i18n.global.t (not useI18n): dialogFocus/dialogLabeling tests mount
// this component through a bare createApp without installing i18n - the
// module-level composer still resolves labels and stays locale-reactive.
const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
    layer?: number
  }>(),
  {
    confirmLabel: undefined,
    cancelLabel: undefined,
    danger: false,
    layer: OVERLAY_LAYERS.panel,
  },
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()

// W7: shared confirm chrome owns modal open + confirm/cancel cues for
// every ConfirmModal consumer (QuanKhiPanel path choice, save gate, ...).

watch(
  () => props.open,
  (open, wasOpen) => {
    if (open && !wasOpen) useAudioStore().cue('ui.modal.open')
    // The close edge is cue'd here too, not only in the button handlers:
    // a programmatic close (parent sets open=false) is still a close.
    if (!open && wasOpen) useAudioStore().cue('ui.modal.close')
  },
)

function onConfirm() {
  useAudioStore().cue('ui.confirm')
  emit('confirm')
}

function onCancel() {
  useAudioStore().cue('ui.cancel')
  emit('cancel')
}

const confirmLabel = computed(() => props.confirmLabel ?? i18n.global.t('panels.common.confirm'))
const cancelLabel = computed(() => props.cancelLabel ?? i18n.global.t('panels.common.cancel'))

const titleId = useId()
const messageId = useId()

const panelRef = ref<HTMLElement | null>(null)
// onEscape maps to cancel (an explicit choice), never confirm; scrim has
// no click handler on purpose - a destructive confirm must not dismiss
// from an accidental outside tap.
useDialogFocus(panelRef, computed(() => props.open), {
  onEscape: onCancel,
})
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-modal">
      <div v-if="open" class="confirm-modal" :style="{ zIndex: layer }">
        <section
          ref="panelRef"
          class="confirm-modal__panel"
          tabindex="-1"
          role="alertdialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="messageId"
        >

      <PcPaperChrome />


          <h3 :id="titleId" class="confirm-modal__title" :class="{ 'is-danger': danger }">{{ title }}</h3>
          <p :id="messageId" class="confirm-modal__message">{{ message }}</p>

          <div class="confirm-modal__actions">
            <GameButton class="confirm-modal__cancel" variant="ghost" :sound="false" @click="onCancel">{{ cancelLabel }}</GameButton>
            <GameButton class="confirm-modal__confirm" :variant="danger ? 'danger' : 'primary'" :sound="false" @click="onConfirm">{{ confirmLabel }}</GameButton>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--hk-surface-base) 70%, transparent);
}

/* Same recipe as OfflineSummaryModal - M-tier slices + thin frame band
   fit a small dialog (frame-xl-ceremony's 80px band would eat the card). */
.confirm-modal__panel {
  position: relative;
  isolation: isolate;
  width: min(420px, 92vw);
  padding: var(--hk-space-8) var(--hk-space-7);
  border-radius: var(--hk-radius-md);
  box-shadow: 0 8px 32px var(--hk-shadow-high);
  color: var(--hk-text-primary);
  font-family: var(--hk-font-ui);
  text-align: center;
}

.confirm-modal__panel > :not(.ink-nine-slice) {
  position: relative;
  z-index: 3;
}

.confirm-modal__title {
  margin: 0 0 var(--hk-space-3);
  font-family: var(--hk-font-display);
  font-size: var(--text-title);
  letter-spacing: 0.06em;
  color: var(--hk-text-primary);
}

.confirm-modal__title.is-danger {
  color: var(--hk-cinnabar-bright);
}

.confirm-modal__message {
  margin: 0 0 var(--hk-space-5);
  color: var(--hk-text-secondary);
  font-size: var(--text-sm);
  line-height: 1.55;
  word-break: break-word;
  white-space: pre-line;
}

.confirm-modal__actions {
  display: flex;
  gap: var(--hk-space-3);
  justify-content: center;
}

.confirm-modal-enter-active,
.confirm-modal-leave-active {
  transition: opacity var(--hk-motion-micro) var(--hk-ease-standard);
}

.confirm-modal-enter-from,
.confirm-modal-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .confirm-modal-enter-active,
  .confirm-modal-leave-active {
    transition: none;
  }
}
</style>
