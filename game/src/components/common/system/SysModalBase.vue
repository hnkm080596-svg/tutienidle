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
defineOptions({
  // Teleport is the component root so automatic attr fallthrough cannot
  // run; bind $attrs onto the scrim div explicitly instead.
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  width?: string
  height?: string
  layer?: number
  // 'alertdialog' for confirm flows; defaults to plain 'dialog'.
  role?: string
  // aria-describedby target inside the slot body (confirm message etc).
  describedBy?: string
  // scrim click emits close unless explicitly disabled (confirm dialogs).
  closeOnScrim?: boolean
  // Extra class applied to the card (per-modal tweaks + stable e2e/test
  // selectors that target the card, not the scrim).
  cardClass?: string
}>(), {
  width: 'min(900px, 94vw)',
  height: 'auto',
  layer: OVERLAY_LAYERS.panel,
  role: 'dialog',
  describedBy: undefined,
  closeOnScrim: true,
  cardClass: undefined,
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
  <!-- Teleport to body: a modal must escape its caller's containing block
       and overflow clipping (backdrop-filter/transform/overflow:hidden on
       an ancestor would otherwise bound position:fixed to that box, so the
       scrim would not cover the viewport and scrim clicks would land on
       whatever overlay renders behind it). Same convention as Tooltip/
       ToastContainer. -->
  <Teleport to="body">
  <Transition name="sys-fade">
    <div
      v-if="open"
      class="sys-modal"
      v-bind="$attrs"
      :style="{ zIndex: layer }"
      @click.self="closeOnScrim && emit('close')"
    >
      <SysPanel
        ref="cardRef"
        variant="primary"
        :rim-active="open"
        class="sys-modal__card"
        :class="cardClass"
        :style="{ width, height }"
        tabindex="-1"
        :role="role"
        aria-modal="true"
        :aria-labelledby="headingId"
        :aria-describedby="describedBy"
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
  </Teleport>
</template>

<style scoped>
/* Structural fallback lives HERE (R41): the modal must stay functional and
   legible if system-theme.css is not imported - the approved revert
   invariant (spec 2.3) degrades to a plain centered dialog on a dim scrim.
   Only the --sys-* visual treatment stays in system-theme.css. */
.sys-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--sys-scrim, rgba(5, 10, 18, .82));
  /* T1 veil: covered page stays legible beneath the console (spec 2.1). */
  backdrop-filter: blur(6px);
}
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
