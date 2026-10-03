<script setup lang="ts">
// Linh Nhan formation (scene 03 dais dressing, canonical layer L5): the
// glowing spirit-eye array under the seated cultivator - radial glow plus
// three counter-pulsing formation rings. Temporary CSS art standing in
// for the painted dais/formation set (art inventory 03-dong-fu).
</script>

<template>
  <div
    class="home-linhnhan"
    data-canonical-layer="L5"
    art-needed
    data-art-id="dong-fu-dais-formation"
    aria-hidden="true"
  >
    <div class="home-linhnhan__glow" />
    <div class="home-linhnhan__ring home-linhnhan__ring--outer" />
    <div class="home-linhnhan__ring home-linhnhan__ring--mid" />
    <div class="home-linhnhan__ring home-linhnhan__ring--inner" />
  </div>
</template>

<style scoped>
.home-linhnhan {
  position: absolute;
  left: 50%;
  top: 78%;
  width: 22%;
  aspect-ratio: 3 / 1;
  transform: translate(-50%, -50%);
}

.home-linhnhan__glow {
  position: absolute;
  inset: -30%;
  border-radius: 50%;
  background: radial-gradient(ellipse, color-mix(in srgb, var(--chrome-500) 14%, transparent), color-mix(in srgb, var(--azure) 7%, transparent) 55%, transparent 75%);
  filter: blur(6px);
}

.home-linhnhan__ring {
  position: absolute;
  left: 50%;
  top: 50%;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--chrome-500) 30%, transparent);
  transform: translate(-50%, -50%) perspective(320px) rotateX(64deg);
}

.home-linhnhan__ring--outer {
  width: 100%;
  height: 300%;
  border-color: color-mix(in srgb, var(--azure) 25%, transparent);
  animation: home-pulse 4.5s ease-in-out infinite;
}

.home-linhnhan__ring--mid {
  width: 74%;
  height: 220%;
  border-color: color-mix(in srgb, var(--chrome-500) 32%, transparent);
}

.home-linhnhan__ring--inner {
  width: 46%;
  height: 140%;
  border-color: color-mix(in srgb, var(--chrome-500) 48%, transparent);
  animation: home-pulse 3.2s ease-in-out infinite reverse;
}

@keyframes home-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
</style>
