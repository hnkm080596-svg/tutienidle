<script setup lang="ts">
import { computed, ref, useId, type ComponentPublicInstance } from 'vue'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { i18n } from '@/i18n'
import InkNineSlice from './primitives/InkNineSlice.vue'
import GameButton from './GameButton.vue'
import HuyenKimSymbol from './HuyenKimSymbol.vue'
import SysPanel from './system/SysPanel.vue'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  width?: string
  height?: string
  layer?: number
  // M-UI-SYSTEM: 'system' renders the card as SysPanel chrome (spec 5).
  // Default 'ink' keeps every caller identical.
  variant?: 'ink' | 'system'
}>(), {
  width: 'min(900px, 94vw)',
  height: 'auto',
  layer: OVERLAY_LAYERS.panel,
  variant: 'ink',
})

const emit = defineEmits<{ close: [] }>()

// ref on the dynamic card resolves to an element ('ink' section) or the
// SysPanel instance ('system') - useDialogFocus needs a plain HTMLElement.
const cardRef = ref<HTMLElement | ComponentPublicInstance | null>(null)
const cardEl = computed<HTMLElement | null>(() => {
  const v = cardRef.value
  if (v instanceof HTMLElement) return v
  return (v?.$el as HTMLElement | null | undefined) ?? null
})
useDialogFocus(cardEl, computed(() => props.open), { onEscape: () => emit('close') })

// Remediation Task 6 (2026-09-05) - aria-labelledby tham chieu heading
// that (per-instance useId) thay vi aria-label duplicate.
const headingId = useId()

// i18n.global.t (not useI18n): dialog tests mount OverlayPanel through a
// bare createApp without installing the plugin; the module-level composer
// still resolves and stays locale-reactive.
const closeLabel = computed(() => i18n.global.t('panels.common.close'))
</script>

<template>
  <Transition name="overlay-fade">
    <div v-if="open" class="overlay-panel" :class="`overlay-panel--${variant}`" :style="{ zIndex: layer }" @click.self="emit('close')">
      <component
        :is="variant === 'system' ? SysPanel : 'section'"
        v-bind="variant === 'system' ? { variant: 'primary', rimActive: open } : {}"
        ref="cardRef"
        class="overlay-panel__card"
        :class="{ 'overlay-panel__card--system': variant === 'system' }"
        tabindex="-1"
        :style="{ width, height }"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="headingId"
      >
        <InkNineSlice v-if="variant === 'ink'" chrome-id="surface-m-panel" layer="surface" />
        <InkNineSlice v-if="variant === 'ink'" chrome-id="frame-m-modal" layer="frame" />
        <header class="overlay-panel__header">
          <div class="overlay-panel__heading">
            <slot name="heading">
              <h3 :id="headingId">{{ title }}</h3>
              <slot name="subtitle" />
            </slot>
          </div>
          <slot name="header-actions" />
        </header>
        <div class="overlay-panel__body"><slot /></div>
        <!-- Visible close affordance (ui-audit creation-meta): scrim click
             + Escape existed but nothing on the panel told the player it
             could be closed. Kept LAST in DOM order (absolute-positioned
             visually) so focus-on-open still lands on slotted content,
             not on this button. -->
        <GameButton
          variant="secondary"
          shape="circle"
          size="sm"
          class="overlay-panel__close"
          :aria-label="closeLabel"
          @click="emit('close')"
        ><HuyenKimSymbol name="close" /></GameButton>
      </component>
    </div>
  </Transition>
</template>

<style scoped>
.overlay-panel { position: absolute; inset: 0; display: grid; place-items: center; padding: 3vh 3vw; background: color-mix(in srgb, var(--hk-surface-base) 78%, transparent); backdrop-filter: blur(6px); }
.overlay-panel__card { position: relative; isolation: isolate; max-width: 100%; max-height: 94vh; min-height: 0; display: flex; flex-direction: column; overflow: hidden; container-type: inline-size; container-name: overlay-panel; color: var(--hk-text-primary); font-family: var(--hk-font-ui); background: transparent; border: 0; border-radius: var(--hk-radius-lg); box-shadow: 0 8px 32px var(--hk-shadow-high); }
.overlay-panel__header { position: relative; z-index: 3; flex: 0 0 auto; display: flex; align-items: center; gap: var(--hk-space-4); padding: clamp(32px, 4vw, 48px) clamp(30px, 4vw, 48px) var(--hk-space-4); border-bottom: 1px solid var(--hk-border-muted); }
.overlay-panel__heading { min-width: 0; margin-right: auto; }
.overlay-panel__heading h3 { margin: 0; color: var(--hk-text-primary); font: 700 var(--text-title) var(--hk-font-display); letter-spacing: .06em; }
/* Absolute in the card's top-right corner (DOM order stays last for
   focus-on-open); GameButton supplies the ghost-circle chrome. Nested
   under the card so these overrides outrank GameButton's own scoped
   size rules regardless of injection order. */
.overlay-panel__card .overlay-panel__close { position: absolute; top: clamp(20px, 3vw, 40px); right: clamp(20px, 3vw, 40px); z-index: 4; width: 34px; height: 34px; min-width: 0; min-height: 0; padding: 0; opacity: .75; }
.overlay-panel__card .overlay-panel__close:hover { opacity: 1; }
/* Fit-engine (2026-08-29) - body la ngan sach flex cho noi dung: con chiem
   flex thay vi scroll. Con tu paginate khi vuot ngan sach (pattern BagGrid).
   overflow hidden la rao chan cuoi - panel con KHONG duoc dua vao no. */
.overlay-panel__body { position: relative; z-index: 3; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; box-sizing: border-box; padding: 0 clamp(30px, 4vw, 48px) clamp(30px, 4vw, 48px); overflow: hidden; }
.overlay-fade-enter-active,.overlay-fade-leave-active { transition: opacity var(--hk-motion-micro) var(--hk-ease-standard); }
.overlay-fade-enter-active .overlay-panel__card,.overlay-fade-leave-active .overlay-panel__card { transition: transform var(--hk-motion-panel) var(--hk-ease-standard), opacity var(--hk-motion-panel) var(--hk-ease-standard); }
.overlay-fade-enter-from,.overlay-fade-leave-to { opacity: 0; }
.overlay-fade-enter-from .overlay-panel__card,.overlay-fade-leave-to .overlay-panel__card { transform: translateY(12px) scale(.985); opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .overlay-fade-enter-active,.overlay-fade-leave-active,
  .overlay-fade-enter-active .overlay-panel__card,.overlay-fade-leave-active .overlay-panel__card {
    transition: none;
  }
}
</style>
