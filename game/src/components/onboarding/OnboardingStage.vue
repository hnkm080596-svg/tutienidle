<script setup lang="ts">
import { nextTick, onBeforeUnmount, shallowRef, useTemplateRef } from 'vue'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import Tooltip from '@/components/common/Tooltip.vue'
import LoginSceneVista from '@/components/scenes/login/LoginSceneVista.vue'
import AuthOpeningCurtain from '@/components/scenes/login/AuthOpeningCurtain.vue'
import { prefersReducedMotion } from '@/presentation/motionPreference'

const props = withDefaults(defineProps<{ initialOpening?: boolean; progress?: number }>(), { initialOpening: false, progress: 0 })
const entryPending = shallowRef(props.initialOpening)
const opening = useTemplateRef<InstanceType<typeof AuthOpeningCurtain>>('opening')
const vista = useTemplateRef<InstanceType<typeof LoginSceneVista>>('vista')
async function prepareEntry(signal: AbortSignal) {
  if (!opening.value || !vista.value) throw new Error('Auth opening scene not mounted')
  await Promise.all([vista.value.prepare(signal), opening.value.prepare(signal)])
}
async function openEntry(id: number, signal: AbortSignal) {
  if (!opening.value) throw new Error('Auth opening curtain not mounted')
  await opening.value.open(id, signal)
  if (signal.aborted) throw new DOMException('Opening aborted', 'AbortError')
  entryPending.value = false
}
function closeEntry(id: number, signal: AbortSignal) {
  if (!opening.value) throw new Error('Auth opening curtain not mounted')
  return opening.value.close(id, signal)
}

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
  if (!surface.value || prefersReducedMotion()) return
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
  closeEntry,
  openEntry,
  prepareEntry,
  isEntryPending: () => entryPending.value,
  close: (_id: number, signal: AbortSignal) => moveScroll(true, signal),
  open: (_id: number, signal: AbortSignal) => moveScroll(false, signal),
})
</script>

<template>
  <SceneDesignCanvas>
    <LoginSceneVista ref="vista" />
    <div ref="surface" class="onboarding-stage__surface" :class="{ 'is-hidden': hidden, 'auth-entry-pending': entryPending, 'auth-entry-ready': !entryPending }" :inert="entryPending">
      <slot />
    </div>
    <AuthOpeningCurtain v-if="entryPending" ref="opening" :progress="props.progress" />
    <Tooltip contained />
  </SceneDesignCanvas>
</template>

<style scoped>
.onboarding-stage__surface { position: absolute; inset: 0; z-index: 1; }
.onboarding-stage__surface.is-hidden { transform: translateX(100%); }
</style>
