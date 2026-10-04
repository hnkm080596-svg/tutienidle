<script setup lang="ts">
import { nextTick, onBeforeUnmount, shallowRef, useTemplateRef } from 'vue'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import Tooltip from '@/components/common/Tooltip.vue'
import LoginSceneVista from '@/components/scenes/login/LoginSceneVista.vue'

const surface = useTemplateRef<HTMLElement>('surface')
const hidden = shallowRef(false)
let animation: Animation | undefined

// The existing route coordinator calls this paint-only curtain port.
// The background never unmounts while auth and creation exchange scrolls.
async function moveScroll(hide: boolean, signal: AbortSignal) {
  if (signal.aborted) throw new DOMException('Scroll transition aborted', 'AbortError')
  hidden.value = hide
  await nextTick()
  if (signal.aborted) {
    hidden.value = false
    throw new DOMException('Scroll transition aborted', 'AbortError')
  }
  if (!surface.value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const current = surface.value.animate(
    [{ transform: hide ? 'translateX(0)' : 'translateX(100%)' },
      { transform: hide ? 'translateX(100%)' : 'translateX(0)' }],
    { duration: hide ? 400 : 520, easing: 'cubic-bezier(.3,.05,.15,1)' },
  )
  animation = current
  const abort = () => { current.cancel(); hidden.value = false }
  signal.addEventListener('abort', abort, { once: true })
  try { await current.finished }
  finally {
    signal.removeEventListener('abort', abort)
    if (animation === current) animation = undefined
  }
}
onBeforeUnmount(() => animation?.cancel())
defineExpose({
  close: (_id: number, signal: AbortSignal) => moveScroll(true, signal),
  open: (_id: number, signal: AbortSignal) => moveScroll(false, signal),
})
</script>

<template>
  <SceneDesignCanvas>
    <LoginSceneVista />
    <div ref="surface" class="onboarding-stage__surface" :class="{ 'is-hidden': hidden }">
      <slot />
    </div>
    <Tooltip contained />
  </SceneDesignCanvas>
</template>

<style scoped>
.onboarding-stage__surface { position: absolute; inset: 0; z-index: 1; }
.onboarding-stage__surface.is-hidden { transform: translateX(100%); }
</style>
