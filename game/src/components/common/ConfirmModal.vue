<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { i18n } from '@/i18n'
import GameButton from './GameButton.vue'
import InkNineSlice from './primitives/InkNineSlice.vue'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import { useAudioStore } from '@/stores/audio'

// Restyle (2026-09-28, ui-audit creation-meta) - was SysModalBase system
// chrome (sci-fi chrome chrome + translucent panel) clashing with the
// game's ink/paper art. Now the huyen-kim paper recipe: surface-xl-scroll
// cream surface + frame-m-modal gold band (same as OfflineSummaryModal).
// Panel renders opaque (the PNG art has no translucency knob).
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
          <InkNineSlice chrome-id="surface-xl-scroll" layer="surface" />
          <InkNineSlice chrome-id="frame-m-modal" layer="frame" />

          <h3 :id="titleId" class="confirm-modal__title" :class="{ 'is-danger': danger }">{{ title }}</h3>
          <p :id="messageId" class="confirm-modal__message">{{ message }}</p>
          <!-- Optional rich detail block (item/material lists, warnings)
               rendered between the message and the actions; consumers
               without slot content render exactly as before. -->
          <div v-if="$slots.default" class="confirm-modal__detail"><slot /></div>

          <div class="confirm-modal__actions">
            <GameButton class="ghost-on-paper" variant="ghost" :sound="false" @click="onCancel">{{ cancelLabel }}</GameButton>
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

/* Same recipe as OfflineSummaryModal - cream scroll surface + the 40px
   frame-m-modal band fit a small dialog (frame-xl-ceremony's 72px band
   would eat the card). overflow:hidden + border-radius clip the scroll's
   square corners under the frame's rounded silhouette. */
.confirm-modal__panel {
  position: relative;
  isolation: isolate;
  width: min(420px, 92vw);
  padding: 48px var(--hk-space-8);
  overflow: hidden;
  border-radius: 16px;
  box-shadow: 0 8px 32px var(--hk-shadow-high);
  color: var(--paper-text, #211f1a);
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
  color: var(--paper-text, #211f1a);
}

.confirm-modal__title.is-danger {
  color: var(--cinnabar, #b54432);
}

.confirm-modal__message {
  margin: 0 0 var(--hk-space-5);
  color: var(--paper-text-soft, #5e5a50);
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
