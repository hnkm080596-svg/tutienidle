<script setup lang="ts">
import { computed, ref, useId, type ComponentPublicInstance } from 'vue'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import { useDialogFocus } from '@/composables/useDialogFocus'
import SysPanel from './SysPanel.vue'

// System modal chrome (spec 5): --sys-scrim scrim + SysPanel variant=primary
// card holding the same dialog contract OverlayPanel owns today (role=dialog,
// aria-modal, aria-labelledby via useId, useDialogFocus focus trap + Escape).
// The card passes :rim-active="open" - it claims the live rim while open and
// releases on close (active-claimant order, spec 4.1.1).
const props = withDefaults(defineProps<{
  open: boolean
  title: string
  width?: string
  height?: string
  layer?: number
}>(), {
  width: 'min(900px, 94vw)',
  height: 'auto',
  layer: OVERLAY_LAYERS.panel,
})

const emit = defineEmits<{ close: [] }>()

// ref on SysPanel resolves to the component instance - resolve its root $el
// so useDialogFocus gets a plain HTMLElement.
const cardRef = ref<HTMLElement | ComponentPublicInstance | null>(null)
const cardEl = computed<HTMLElement | null>(() => {
  const v = cardRef.value
  if (v instanceof HTMLElement) return v
  return (v?.$el as HTMLElement | null | undefined) ?? null
})
useDialogFocus(cardEl, computed(() => props.open), { onEscape: () => emit('close') })

const headingId = useId()
</script>

<template>
  <Transition name="sys-fade">
    <div v-if="open" class="sys-modal" :style="{ zIndex: layer }" @click.self="emit('close')">
      <SysPanel
        ref="cardRef"
        variant="primary"
        :rim-active="open"
        class="sys-modal__card"
        :style="{ width, height }"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="headingId"
      >
        <header class="sys-modal__header">
          <div class="sys-modal__heading">
            <slot name="heading">
              <h3 :id="headingId">{{ title }}</h3>
              <slot name="subtitle" />
            </slot>
          </div>
          <slot name="header-actions" />
        </header>
        <div class="sys-modal__body"><slot /></div>
      </SysPanel>
    </div>
  </Transition>
</template>

<style scoped>
/* Layout/structure only - all color/glow/border values come from --sys-* in
   system-theme.css (single ownership, spec 2.4). */
.sys-modal__card {
  position: relative;
  max-width: 94vw;
  max-height: 92vh;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: auto;
}
.sys-modal__header {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  padding: var(--space-4, 16px) var(--space-4, 16px) var(--space-3, 12px);
  border-bottom: 1px solid var(--sys-line-soft);
}
.sys-modal__heading { min-width: 0; margin-right: auto; }
.sys-modal__heading h3 {
  margin: 0;
  font: 700 var(--text-title, 18px) var(--sys-font-display);
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--sys-text);
}
.sys-modal__body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: var(--space-4, 16px);
}
.sys-fade-enter-active,
.sys-fade-leave-active { transition: opacity .2s ease; }
.sys-fade-enter-active .sys-modal__card,
.sys-fade-leave-active .sys-modal__card { transition: transform .22s ease, opacity .22s ease; }
.sys-fade-enter-from,
.sys-fade-leave-to { opacity: 0; }
.sys-fade-enter-from .sys-modal__card,
.sys-fade-leave-to .sys-modal__card { transform: translateY(12px) scale(.985); opacity: 0; }
</style>
