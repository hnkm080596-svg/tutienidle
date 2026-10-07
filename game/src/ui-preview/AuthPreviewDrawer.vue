<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()
const panel = ref<HTMLElement | null>(null)
const focusReady = ref(false)
const titleId = useId()
const art = {
  paper: resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png'),
  cloud: resolveAssetUrl('/assets/ui/tien-hiep-2026-10/runtime/cloud-ornament@2x.png'),
}
watch(() => props.open, () => { focusReady.value = false })
useDialogFocus(panel, computed(() => props.open && focusReady.value), { onEscape: () => emit('close') })
function outside(event: PointerEvent) {
  if (props.open && event.target instanceof Node && !panel.value?.contains(event.target)) emit('close')
}
document.addEventListener('pointerdown', outside, true)
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside, true))
</script>

<template>
  <Transition name="auth-preview-slide" :duration="{ enter: 360, leave: 360 }" @after-enter="focusReady = true">
    <div v-if="open" class="auth-preview-drawer-layer">
      <div class="auth-preview-drawer-scrim" />
      <aside ref="panel" class="auth-preview-drawer" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1" data-testid="entry-drawer" :style="{ '--preview-paper': `url('${art.paper}')` }">
        <header><img :src="art.cloud" alt="" aria-hidden="true"><h2 :id="titleId">{{ title }}</h2></header>
        <div class="auth-preview-drawer-content"><slot /></div>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.auth-preview-drawer-layer { position: absolute; inset: 0; z-index: 10; overflow: clip; }
.auth-preview-drawer-scrim { position: absolute; inset: 0; background: #30281926; }
.auth-preview-drawer { position: absolute; inset: 18px 18px 18px auto; width: 490px; display: flex; flex-direction: column; padding: 30px 34px; color: #30271b; border: 1px solid #aa874b; background: linear-gradient(#f5e5c9c9 0%,#f5e5c9e8 58%,#f5e5c947 100%), var(--preview-paper) 80% bottom / auto 100%; box-shadow: -12px 0 34px #57422230, inset 0 0 0 5px #f4e4c5, inset 0 0 0 6px #b9955980; }
.auth-preview-drawer header { position: relative; padding: 12px 0 22px; border-bottom: 1px solid #b18b45; }
.auth-preview-drawer header img { position: absolute; width: 210px; height: 88px; object-fit: contain; right: -10px; top: -12px; opacity: .25; pointer-events: none; }
.auth-preview-drawer h2 { position: relative; margin: 0; font: 600 34px var(--pc-font-body); }
.auth-preview-drawer-content { min-height: 0; flex: 1; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #b18b4580 transparent; padding: 14px 0 150px; container-type: inline-size; display: flex; flex-direction: column; gap: 14px; }
.auth-preview-slide-enter-active .auth-preview-drawer, .auth-preview-slide-leave-active .auth-preview-drawer { transition: transform 360ms cubic-bezier(.22,.8,.3,1); }
.auth-preview-slide-enter-from .auth-preview-drawer, .auth-preview-slide-leave-to .auth-preview-drawer { transform: translateX(calc(100% + 20px)); }
@media (prefers-reduced-motion: reduce) { .auth-preview-slide-enter-active .auth-preview-drawer, .auth-preview-slide-leave-active .auth-preview-drawer { transition: none; } }
</style>
