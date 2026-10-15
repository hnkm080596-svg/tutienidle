<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

const props = defineProps<{ outcome: 'victory' | 'defeat' }>()
const { t } = useI18n()
const titleUrl = computed(() =>
  resolveAssetUrl(
    props.outcome === 'victory'
      ? '/assets/ui/huyen-kim/scene/victory-v2/victory-title-v1.png'
      : '/assets/ui/huyen-kim/scene/defeat-v2/defeat-title-v1.png',
  ),
)
</script>

<template>
  <h1 class="ceremony-title" :aria-label="t(`combat.${outcome}.title`)">
    <span class="ceremony-title__halo" aria-hidden="true" />
    <img class="ceremony-title__art" :src="titleUrl" alt="" aria-hidden="true" fetchpriority="high" />
    <span class="ceremony-title__rule" aria-hidden="true" />
  </h1>
</template>

<style scoped>
.ceremony-title {
  position: relative;
  margin: 0;
  display: grid;
  place-items: center;
  isolation: isolate;
}
.ceremony-title__art {
  position: relative;
  width: min(420px, 70vw);
  height: clamp(85px, 16vh, 150px);
  object-fit: contain;
  mask-image: linear-gradient(110deg, #000 35%, #000c 40%, transparent 50%);
  mask-size: 300% 100%;
  mask-position: 100% 0;
  animation: ink-reveal calc(850ms * var(--ceremony-pace)) 120ms cubic-bezier(0.2, 0.65, 0.2, 1)
    both;
  filter: drop-shadow(0 5px 18px #0009);
}
.ceremony-title__halo {
  position: absolute;
  z-index: -1;
  width: 100%;
  height: 150%;
  background: radial-gradient(ellipse, var(--ceremony-glow), transparent 68%);
  animation: halo-in 1200ms ease-out both;
}
.ceremony-title__rule {
  position: absolute;
  bottom: -3px;
  height: 1px;
  width: 65%;
  background: linear-gradient(90deg, transparent, var(--ceremony-accent), transparent);
  transform-origin: center;
  animation: rule-in calc(700ms * var(--ceremony-pace)) calc(450ms * var(--ceremony-pace)) both;
}
@keyframes ink-reveal {
  from {
    mask-position: 100% 0;
    transform: translateY(8px) scale(1.035);
    opacity: 0.4;
  }
  to {
    mask-position: 0 0;
    transform: none;
    opacity: 1;
  }
}
@keyframes halo-in {
  from {
    opacity: 0;
    transform: scale(0.75);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes rule-in {
  from {
    transform: scaleX(0);
    opacity: 0;
  }
  to {
    transform: none;
    opacity: 0.65;
  }
}
</style>
