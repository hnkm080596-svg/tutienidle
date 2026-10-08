<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogFocus } from '@/composables/useDialogFocus'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'

const props = defineProps<{ open: boolean; title: string; busy: boolean }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const panel = ref<HTMLElement | null>(null)
const titleId = useId()
function close() { if (!props.busy) emit('close') }
useDialogFocus(panel, computed(() => props.open), { onEscape: close })
</script>

<template>
  <!-- Persistent layer toggled by class: class-based transition interpolates
       from the in-flight position on reversal, so rapid open/close clicks
       glide instead of snapping to the enter-from offset. -->
  <div class="login-drawer-layer" :class="{ 'login-drawer-layer--open': open }">
    <div class="login-drawer-scrim" @click="close" />
    <aside ref="panel" class="login-side-drawer" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1" data-testid="entry-drawer">
      <InkNineSlice chrome-id="surface-l-drawer" layer="surface" />
      <!-- Content swap keyed on title: switching tabs (login/register/settings/
           exit) slides the old block down-left + fades, new block drops in
           from top-right - keeps the drawer itself stationary. -->
      <Transition name="login-drawer-swap" mode="out-in">
        <div :key="title" class="login-side-drawer__swap">
          <header class="login-side-drawer__header">
            <h2 :id="titleId">{{ title }}</h2>
          </header>
          <div class="login-side-drawer__content"><slot /></div>
        </div>
      </Transition>
    </aside>
  </div>
</template>

<style scoped>
.login-drawer-layer { position: absolute; inset: 0; z-index: 10; opacity: 0; visibility: hidden; pointer-events: none; transition: opacity 320ms ease, visibility 0s linear 320ms; }
.login-drawer-layer--open { opacity: 1; visibility: visible; pointer-events: auto; transition: opacity 320ms ease, visibility 0s linear 0s; }
.login-drawer-scrim { position: absolute; inset: 0; background: #30281933; }
/* Dark ink card: surface-l-drawer slice paints the ornate frame; the dark
   fill + light text match the Thien Co Bang dark-card recipe (df-board). */
.login-side-drawer { position: absolute; right: 18px; top: 18px; bottom: 18px; width: 440px; display: flex; flex-direction: column; padding: 30px; color: #e6d5ac; background: linear-gradient(175deg, #211a10, #141009); border: 1px solid #6b5324; box-shadow: -18px 0 50px #48351b30; transform: translateX(calc(100% + 20px)); transition: transform 320ms cubic-bezier(.22,.8,.3,1); }
.login-side-drawer > :not(.ink-nine-slice) { position: relative; z-index: 2; }
.login-drawer-layer--open .login-side-drawer { transform: translateX(0); }
.login-side-drawer__header { border-bottom: 1px solid #c9a66a80; padding-bottom: 12px; }
.login-side-drawer__header h2 { margin: 0; font: 600 34px var(--pc-font-body); }
.login-side-drawer__header button { min-width: 44px; min-height: 44px; font-size: 28px; }
.login-side-drawer__swap { display: flex; flex-direction: column; min-height: 0; flex: 1; }
/* Scrollable but chrome-less per Minh: no visible scrollbar. */
.login-side-drawer__content { min-height: 0; overflow-y: auto; flex: 1; padding-top: 14px; scrollbar-width: none; container-type: inline-size; display: flex; flex-direction: column; gap: 14px; }
.login-side-drawer__content::-webkit-scrollbar { display: none; }
.login-drawer-swap-enter-active, .login-drawer-swap-leave-active { transition: opacity 220ms ease, transform 220ms ease; }
.login-drawer-swap-enter-from { opacity: 0; transform: translate(16px, -12px); }
.login-drawer-swap-leave-to { opacity: 0; transform: translate(-16px, 12px); }
@media (prefers-reduced-motion: reduce) { .login-drawer-layer, .login-drawer-layer--open, .login-side-drawer, .login-drawer-swap-enter-active, .login-drawer-swap-leave-active { transition: none; } }
</style>
