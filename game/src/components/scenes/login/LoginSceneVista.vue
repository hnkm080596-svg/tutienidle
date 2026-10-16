<script setup lang="ts">
// The persistent onboarding host shares this art across auth and creation.
import GridSheetSprite from './GridSheetSprite.vue'
import { LOGIN_ART } from './loginArt'
import { useTemplateRef } from 'vue'
import { prepareRenderedImage } from '@/presentation/assets/prepareRenderedImage'
const birds = useTemplateRef<InstanceType<typeof GridSheetSprite>[]>('birds')
const flock = [
  { id: 'near', top: '21%', width: '78px', duration: '34s', delay: '-8s', fps: 28 },
  { id: 'middle', top: '15%', width: '57px', duration: '42s', delay: '-19s', fps: 25 },
  { id: 'far', top: '29%', width: '43px', duration: '49s', delay: '-34s', fps: 22 },
] as const
const backdrop = useTemplateRef<HTMLImageElement>('backdrop')
const mortal = useTemplateRef<InstanceType<typeof GridSheetSprite>>('mortal')
defineExpose({ prepare: (signal: AbortSignal) => Promise.all([
  prepareRenderedImage(backdrop.value, signal),
  ...(birds.value ?? []).map((bird) => bird.prepare(signal)),
  mortal.value ? mortal.value.prepare(signal) : Promise.reject(new Error('Mortal sprite missing')),
]) })
</script>

<template>
  <div class="login-vista" data-hk-region="vista" aria-hidden="true">
    <img ref="backdrop" class="login-world-vista" :src="LOGIN_ART.backdrop" alt="" draggable="false">
    <div v-for="bird in flock" :key="bird.id" class="login-vista__bird" :class="`login-vista__bird--${bird.id}`" :style="{ top: bird.top, width: bird.width, animationDuration: bird.duration, animationDelay: bird.delay }" data-testid="login-ambient-bird">
      <div class="login-vista__bird-bob">
        <GridSheetSprite ref="birds" :src="LOGIN_ART.crane" :columns="1" :rows="41" :frame-width="212" :frame-height="120" :fps="bird.fps" />
      </div>
    </div>
    <GridSheetSprite ref="mortal" class="login-vista__cultivator login-vista__mortal" :src="LOGIN_ART.mortal" :columns="1" :rows="41" :frame-width="128" :frame-height="192" :fps="14" />
  </div>
</template>

<style scoped>
.login-vista {
  position: absolute;
  inset: 0;
  z-index: 0;
}
.login-vista__mortal {
  position: absolute;
  left: 12%;
  bottom: 19%;
  width: 14%;
  height: auto;
  pointer-events: none;
  user-select: none;
}
.login-vista__bird { position: absolute; left: 0; opacity: .85; pointer-events: none; animation: login-bird-cross linear infinite; }
.login-vista__bird--middle { opacity: .68; }
.login-vista__bird--far { opacity: .5; }
.login-vista__bird-bob { animation: login-bird-bob 1.7s ease-in-out infinite; }
.login-vista__bird--middle .login-vista__bird-bob { animation-duration: 2.1s; animation-delay: -.6s; }
.login-vista__bird--far .login-vista__bird-bob { animation-duration: 1.9s; animation-delay: -1.2s; }
@keyframes login-bird-cross { from { transform: translateX(-180px); } to { transform: translateX(1620px); } }
@keyframes login-bird-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@media (prefers-reduced-motion: reduce) { .login-vista__bird { display: none; } }
:global(html[data-reduced-motion='true'] .login-vista__bird) { display: none; }
</style>
