<script setup lang="ts">
// Scene 03 vista dressing: linh khi motes drifting around the cultivator.
// Temporary CSS particles pending sprite art (art inventory 03-dong-fu).
// Canonical layer L5.
</script>

<template>
  <div
    class="home-motes"
    data-canonical-layer="L5"
    aria-hidden="true"
    art-needed
    data-art-id="dong-fu-spirit-motes"
  >
    <span style="left: 44%; top: 54%; --mx: 14px; --my: -18px; animation-delay: 0s;" />
    <span style="left: 58%; top: 58%; --mx: -12px; --my: -16px; animation-delay: 1.4s;" />
    <span style="left: 50%; top: 66%; --mx: 10px; --my: -22px; animation-delay: 2.8s;" />
    <span style="left: 52%; top: 50%; --mx: -16px; --my: -14px; animation-delay: 4.1s;" />
  </div>
</template>

<style scoped>
.home-motes {
  position: absolute;
  inset: 0;
}

.home-motes span {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--chrome-100);
  box-shadow: 0 0 6px 2px var(--chrome-100);
  animation: home-mote 7s ease-in-out infinite;
}

@keyframes home-mote {
  0%, 100% { transform: translate(0, 0); opacity: 0.15; }
  50% { transform: translate(var(--mx, 14px), var(--my, -18px)); opacity: 0.85; }
}
</style>
