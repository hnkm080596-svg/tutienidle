<script setup lang="ts">
import GridSheetSprite from './GridSheetSprite.vue'
import { LOGIN_ART } from './loginArt'
import { computed, nextTick, onBeforeUnmount, shallowRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { prefersReducedMotion } from '@/presentation/motionPreference'
import { prepareRenderedImage } from '@/presentation/assets/prepareRenderedImage'

const props = defineProps<{ progress: number }>()
const { t } = useI18n()
const covered = shallowRef(true)
const revealing = shallowRef(false)
const cloud = useTemplateRef<HTMLElement>('cloud')
const nearCloud = useTemplateRef<HTMLImageElement>('nearCloud')
const crane = useTemplateRef<HTMLElement>('crane')
const craneSprite = useTemplateRef<InstanceType<typeof GridSheetSprite>>('craneSprite')
const cloudTexture = useTemplateRef<HTMLImageElement>('cloudTexture')
const animations = new Set<Animation>()
let activeAbort: (() => void) | undefined
const percent = computed(() => revealing.value ? 100 : Math.floor(Math.max(0, Math.min(0.99, props.progress)) * 100))
const cranePosition = computed(() => ({ left: `${27 + percent.value * 0.46}%` }))
const cloudUrl = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/auth-opening/cloud-curtain-v1.png')
const craneUrl = LOGIN_ART.crane

function close(_id: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new DOMException('Opening aborted', 'AbortError'))
  covered.value = true
  revealing.value = false
  return Promise.resolve()
}

async function prepare(signal: AbortSignal): Promise<void> {
  await Promise.all([
    ...[cloudTexture.value, nearCloud.value].map((image) => prepareRenderedImage(image, signal)),
    craneSprite.value ? craneSprite.value.prepare(signal) : Promise.reject(new Error('Crane sprite missing')),
  ])
}

async function open(_id: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw new DOMException('Opening aborted', 'AbortError')
  revealing.value = true
  await nextTick()
  if (signal.aborted) { revealing.value = false; throw new DOMException('Opening aborted', 'AbortError') }
  try {
    if (!prefersReducedMotion() && cloud.value?.animate) {
      await new Promise<void>((resolve, reject) => {
        let settled = false
        const finish = (aborted: boolean) => {
          if (settled) return
          settled = true
          signal.removeEventListener('abort', abort)
          activeAbort = undefined
          for (const animation of animations) animation.cancel()
          animations.clear()
          if (aborted) reject(new DOMException('Opening aborted', 'AbortError'))
          else resolve()
        }
        const abort = () => finish(true)
        activeAbort = abort
        signal.addEventListener('abort', abort, { once: true })
        const tracks: Array<[HTMLElement | null, Keyframe[], number]> = [
          [cloud.value, [{ transform: 'translateX(0)' }, { transform: 'translateX(135%)' }], 1050],
          [nearCloud.value, [{ transform: 'translateX(0)' }, { transform: 'translateX(150%)' }], 900],
          [crane.value, [{ transform: 'translate(-50%, 0)', opacity: 1 }, { transform: 'translate(calc(-50% + 900px), -160px)', opacity: 0 }], 900],
        ]
        for (const [element, frames, duration] of tracks) {
          if (element) animations.add(element.animate(frames, { duration, easing: 'cubic-bezier(.42,0,.35,1)', fill: 'forwards' }))
        }
        void Promise.all([...animations].map((animation) => animation.finished)).then(() => finish(false), () => finish(true))
      })
    }
    covered.value = false
    await nextTick()
  } catch (error) {
    activeAbort?.()
    revealing.value = false
    throw error
  }
}
onBeforeUnmount(() => activeAbort?.())
defineExpose({ close, open, prepare })
</script>

<template>
  <div v-if="covered" class="auth-opening-curtain" :class="{ 'is-revealing': revealing }" data-testid="auth-opening-curtain">
    <div ref="cloud" class="auth-opening-cloud">
      <img ref="cloudTexture" class="auth-opening-cloud__texture" :src="cloudUrl" alt="" aria-hidden="true">
    </div>
    <img ref="nearCloud" class="auth-opening-cloud-near" :src="cloudUrl" alt="" aria-hidden="true">
    <div class="auth-opening-loading" :class="{ 'is-revealing': revealing }">
      <div class="auth-opening-track" role="progressbar" :aria-label="t('authOpening.loading')" :aria-valuenow="percent" aria-valuemin="0" aria-valuemax="100">
        <span class="auth-opening-track__fill" :style="{ width: `${percent}%` }" />
      </div>
      <p class="auth-opening-loading__percent">{{ percent }}%</p>
      <p class="auth-opening-loading__label">{{ t('authOpening.loading') }}</p>
    </div>
    <div ref="crane" class="auth-opening-crane" :style="cranePosition" aria-hidden="true">
      <div class="auth-opening-crane__bob">
        <GridSheetSprite ref="craneSprite" :src="craneUrl" :columns="1" :rows="41" :frame-width="212" :frame-height="120" :fps="28" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-opening-curtain { position: absolute; inset: 0; z-index: 30; overflow: hidden; pointer-events: auto; }
.auth-opening-cloud { position: absolute; inset: 0; background: #f5ebd7; }
.auth-opening-cloud::before { content: ''; position: absolute; inset: -10% 94% -10% -24%; background: linear-gradient(90deg, transparent, #f5ebd7 75%); }
.auth-opening-cloud__texture { position: absolute; left: -18%; top: -18%; width: 135%; height: 140%; object-fit: fill; }
.auth-opening-cloud-near { position: absolute; left: -30%; bottom: -38%; width: 160%; height: 125%; object-fit: fill; opacity: .75; }
.auth-opening-loading { position: absolute; left: 28%; top: 58%; width: 44%; text-align: center; color: #634b25; transition: opacity 180ms ease; }
.auth-opening-track { height: 8px; border: 1px solid #a5803b; background: #4e453332; box-shadow: 0 0 0 3px #f9eccc; }
.auth-opening-track__fill { display: block; height: 100%; background: linear-gradient(90deg, #95662a, #e6c071); transition: width 180ms ease-out; }
.auth-opening-loading__percent { margin: 20px 0 4px; font: 26px var(--font-display, Georgia, serif); }
.auth-opening-loading__label { margin: 0; font: 18px var(--font-display, Georgia, serif); }
.auth-opening-crane { position: absolute; top: 45%; width: 155px; height: auto; transform: translateX(-50%); transition: left 180ms ease-out; }
.auth-opening-crane__bob { animation: crane-bob 1500ms ease-in-out infinite; transform-origin: 55% 50%; }
@keyframes crane-bob {
  0%, 100% { transform: translateY(0) rotate(-1deg); }
  25% { transform: translateY(-8px) rotate(-2deg); }
  75% { transform: translateY(7px) rotate(1deg); }
}
@media (prefers-reduced-motion: reduce) { .auth-opening-crane__bob { animation: none; } }
:global(html[data-reduced-motion='true'] .auth-opening-crane__bob) { animation: none; }
.auth-opening-loading.is-revealing { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .auth-opening-crane, .auth-opening-track__fill, .auth-opening-loading { transition: none; } }
:global(html[data-reduced-motion='true'] .auth-opening-crane),
:global(html[data-reduced-motion='true'] .auth-opening-track__fill),
:global(html[data-reduced-motion='true'] .auth-opening-loading) { transition: none; }
</style>
