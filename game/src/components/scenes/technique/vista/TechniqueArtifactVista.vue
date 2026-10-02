<script setup lang="ts">
// Center region (`artifact-vista`): plinth dais + artifact frame + the
// runtime slot card standing in for the painted scroll/book artifact
// (content illustration = excluded art - frame + dais only). The default
// slot receives the canonical TechniqueSlotCard hero.
defineProps<{
  plinthSrc: string
}>()
</script>

<template>
  <div class="technique-scene__vista technique-artifact-vista" data-hk-region="artifact-vista">
    <img
      class="technique-scene__plinth technique-artifact-vista__plinth"
      :src="plinthSrc"
      alt=""
      aria-hidden="true"
    />
    <div class="technique-artifact-vista__frame" art-needed data-art-id="technique-artifact">
      <slot />
    </div>
    <div class="technique-artifact-vista__flourish" art-needed data-art-id="divider-ornament" />
  </div>
</template>

<style scoped>
.technique-artifact-vista {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.technique-artifact-vista__plinth {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  max-height: 78%;
  max-width: 100%;
  object-fit: contain;
  pointer-events: none;
}

.technique-artifact-vista__frame {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: min(78%, 340px);
  margin-bottom: 15%;
  aspect-ratio: 10 / 13;
  /* Temp art: bamboo-slat scroll panel until the painted artifact lands. */
  background:
    repeating-linear-gradient(
      90deg,
      rgba(185, 154, 85, 0.14) 0 14px,
      rgba(16, 23, 24, 0.12) 14px 16px
    ),
    radial-gradient(ellipse at 50% 30%, rgba(185, 154, 85, 0.12), transparent 70%),
    var(--paper-200);
  border: 2px solid var(--hk-border-active);
  border-radius: var(--hk-radius-md);
  box-shadow: 0 12px 28px rgba(16, 23, 24, 0.35);
}

.technique-artifact-vista__frame > * {
  max-width: 100%;
}

.technique-artifact-vista__flourish {
  position: absolute;
  bottom: 6%;
  left: 12%;
  right: 12%;
  height: 18px;
  background:
    radial-gradient(circle at 50% 50%, var(--hk-gold) 0 3px, transparent 4px),
    linear-gradient(90deg, transparent, var(--hk-border-muted) 20%, var(--hk-border-muted) 80%, transparent);
  opacity: 0.7;
  pointer-events: none;
}
</style>
