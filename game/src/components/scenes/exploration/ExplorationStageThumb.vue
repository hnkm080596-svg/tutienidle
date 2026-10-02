<script setup lang="ts">
// Scene 09 scaffold - stage vista thumbnail in the detail panel (ref:
// painted landscape snippet of the selected stage). Temp CSS vista.
defineProps<{
  code: string
}>()
</script>

<template>
  <figure
    class="exploration-thumb art-needed"
    data-art-id="exploration-detail-stage-thumb"
    aria-hidden="true"
  >
    <span class="exploration-thumb__code">{{ code }}</span>
  </figure>
</template>

<style scoped>
.exploration-thumb {
  position: relative;
  margin: 0;
  height: 96px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--hk-gold, #b99a55) 45%, var(--paper-line));
  border-radius: var(--radius-sm);
  background:
    radial-gradient(ellipse 120% 60% at 50% 100%, color-mix(in srgb, #315f55 45%, var(--paper-200)), transparent 70%),
    radial-gradient(ellipse 60% 45% at 24% 90%, color-mix(in srgb, #315f55 30%, transparent), transparent 70%),
    radial-gradient(ellipse 55% 40% at 78% 88%, color-mix(in srgb, #315f55 24%, transparent), transparent 70%),
    linear-gradient(180deg, color-mix(in srgb, var(--paper-50) 85%, var(--scene-portal-glow)) 0%, var(--paper-200) 55%, color-mix(in srgb, #315f55 30%, var(--paper-200)) 100%);
  box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--paper-50) 60%, transparent);
}

.exploration-thumb::before {
  content: '';
  position: absolute;
  left: 12%;
  right: 10%;
  bottom: 8%;
  height: 46%;
  background:
    radial-gradient(ellipse 40% 100% at 30% 100%, color-mix(in srgb, #101718 34%, transparent), transparent 75%),
    radial-gradient(ellipse 34% 90% at 68% 100%, color-mix(in srgb, #101718 28%, transparent), transparent 75%);
  opacity: 0.8;
}

.exploration-thumb__code {
  position: absolute;
  right: 6px;
  bottom: 5px;
  padding: 1px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--brush-950) 80%, transparent);
  color: var(--paper-50);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .06em;
}
</style>
