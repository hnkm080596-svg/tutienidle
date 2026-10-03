<script setup lang="ts">
// Scene 03 edge vignette - fixed darkening treatment over the vista
// edges. Temporary CSS gradient pending a painted ink-vignette texture
// (art inventory 03-dong-fu).
</script>

<template>
  <div
    class="home-scene__vignette"
    aria-hidden="true"
    art-needed
    data-art-id="dong-fu-vignette"
  />
</template>

<style scoped>
.home-scene__vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 70% 60% at 50% 46%, transparent 55%, rgba(0, 0, 0, 0.5) 100%);
}
</style>
