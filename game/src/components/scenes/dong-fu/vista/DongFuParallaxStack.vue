<script setup lang="ts">
// Scene 03 vista region: ONE parallax texture stack (active or outgoing).
// Pure presentation - the parent scene owns variant selection, preload,
// and the pointer/focus parallax math, and hands each layer its
// --parallax-x/y style through `layerStyle`.
import type { DongFuLayerDescriptor } from '@/presentation/background/DongFuArt'
import type { ThanhVanVariant } from '@/presentation/background/BackgroundVariant'

defineProps<{
  variant: ThanhVanVariant
  layers: readonly DongFuLayerDescriptor[]
  /** 'active' renders the live stack; 'previous' renders the leaving stack. */
  mode: 'active' | 'previous'
  entering?: boolean
  reducedMotion: boolean
  layerStyle: (layer: DongFuLayerDescriptor) => Record<string, string>
}>()

const emit = defineEmits<{
  leaveDone: []
}>()
</script>

<template>
  <div
    class="home-scene__parallax-stack"
    :class="[
      `home-scene__parallax-stack--${mode}`,
      {
        'is-entering': entering,
        'is-leaving': mode === 'previous',
        'is-reduced-motion': reducedMotion,
      },
    ]"
    :data-hk-region="mode === 'active' ? 'vista' : undefined"
    :data-season="variant.season"
    :data-time="variant.time"
    @animationend.self="emit('leaveDone')"
  >
    <img
      v-for="layer in layers"
      :key="layer.key"
      class="home-scene__parallax-layer"
      :class="`home-scene__parallax-layer--${layer.motion}`"
      :data-layer="layer.name"
      :data-canonical-layer="layer.canonical"
      :data-fx-pending="layer.fxPending"
      :data-season="variant.season"
      :data-time="variant.time"
      :src="layer.url"
      :style="layerStyle(layer)"
      alt=""
      draggable="false"
      decoding="async"
    />
  </div>
</template>

<style scoped>
/* Bon texture 1672x941 dung cung cover geometry de luon khop hinh khi dich
   nhe theo con tro; vung bleed 2% che mep trong bien do parallax toi da. */
.home-scene__parallax-stack {
  position: absolute;
  inset: 0;
}

.home-scene__parallax-stack.is-entering {
  animation: dong-fu-stack-enter 520ms ease-out both;
}

.home-scene__parallax-stack.is-leaving {
  animation: dong-fu-stack-leave 520ms ease-out both;
}

.home-scene__parallax-layer {
  position: absolute;
  inset: -2%;
  width: 104%;
  height: 104%;
  object-fit: cover;
  user-select: none;
  transform: translate3d(var(--parallax-x, 0), var(--parallax-y, 0), 0);
  transition: transform 140ms cubic-bezier(0.22, 0.61, 0.36, 1);
  will-change: transform;
}

.home-scene__parallax-layer--cloud-slow {
  animation: dong-fu-cloud-slow 48s ease-in-out infinite alternate;
}

.home-scene__parallax-layer--cloud-medium {
  animation: dong-fu-cloud-medium 36s ease-in-out infinite alternate;
}

.home-scene__parallax-layer--mist-slow {
  animation: dong-fu-mist-slow 28s ease-in-out infinite alternate;
}

@keyframes dong-fu-stack-enter {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes dong-fu-stack-leave {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes dong-fu-cloud-slow {
  to { translate: 0.8% 0; }
}

@keyframes dong-fu-cloud-medium {
  to { translate: -1.1% 0.2%; }
}

@keyframes dong-fu-mist-slow {
  to { translate: 1.4% -0.2%; }
}

@media (prefers-reduced-motion: reduce) {
  .home-scene__parallax-stack,
  .home-scene__parallax-layer {
    animation: none;
    transition: none;
    transform: none;
    translate: none;
  }
}
</style>
