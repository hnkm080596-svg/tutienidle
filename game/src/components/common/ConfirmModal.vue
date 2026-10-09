<script setup lang="ts">
import { computed, ref, useId, watch, type ComponentPublicInstance } from 'vue'
import { i18n } from '@/i18n'
import OrnateDialog from './art/OrnateDialog.vue'
import OrnateDivider from './art/OrnateDivider.vue'
import OrnateInfoCard from './art/OrnateInfoCard.vue'
import OrnateButton from './art/OrnateButton.vue'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import { useAudioStore } from '@/stores/audio'

// Restyle (2026-10-09, ornate dialog art) - the parchment recipe
// (surface-xl-scroll + frame-m-modal) is replaced by whole-component
// slices from the owner's ornate-ui-sheet: ornate frame + crest title
// band + flame badge + ornament divider + gold/dark buttons + diamond X.
// Per owner ruling the art renders intact at native aspect - content
// scrolls inside the frame instead of resizing it. Public API, a11y
// wiring and confirm/cancel semantics are unchanged.
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

const dialogRef = ref<ComponentPublicInstance | null>(null)
const panelEl = () => (dialogRef.value?.$el as HTMLElement | undefined) ?? null
// onEscape maps to cancel (an explicit choice), never confirm; scrim has
// no click handler on purpose - a destructive confirm must not dismiss
// from an accidental outside tap. The diamond X close is another cancel.
useDialogFocus(panelEl, computed(() => props.open), {
  onEscape: onCancel,
})
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-modal">
      <div v-if="open" class="confirm-modal" :style="{ zIndex: layer }">
        <OrnateDialog
          ref="dialogRef"
          class="confirm-modal__panel"
          role="alertdialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="messageId"
          :title="title"
          :title-id="titleId"
          :badge="danger ? 'alert' : 'info'"
          show-close
          :close-label="cancelLabel"
          @close="onCancel"
        >
          <p :id="messageId" class="confirm-modal__message">{{ message }}</p>
          <OrnateDivider />
          <!-- Optional rich detail block (item/material lists, warnings)
               rendered inside the info-card art between divider and
               actions; consumers without slot content get the plain
               message + divider composition. -->
          <OrnateInfoCard v-if="$slots.default" class="confirm-modal__detail">
            <slot />
          </OrnateInfoCard>

          <template #actions>
            <OrnateButton class="confirm-modal__confirm" variant="gold" :sound="false" @click="onConfirm">{{ confirmLabel }}</OrnateButton>
            <OrnateButton variant="dark" :sound="false" @click="onCancel">{{ cancelLabel }}</OrnateButton>
          </template>
        </OrnateDialog>
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

/* The ornate frame art carries its own silhouette - no radius/overflow
   clipping here; the panel class only marks the dialog for tests/e2e. */
.confirm-modal__panel {
  flex: none;
}

.confirm-modal__message {
  flex: none;
  margin: 0;
  max-width: 100%;
  color: var(--paper-text, #302719);
  font-size: min(3cqh, var(--text-sm));
  line-height: 1.5;
  text-align: center;
  word-break: break-word;
  white-space: pre-line;
}

.confirm-modal__detail {
  --ornate-info-card-width: 92%;
  margin-top: 0.8cqh;
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
