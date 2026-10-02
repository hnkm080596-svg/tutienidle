<script setup lang="ts">
// Spec SS14.5 context dim (scene 03): a radial mask keeps a clear window
// around the focused building while the rest of the scene falls back.
// Temporary CSS mask pending a painted ink-dim treatment (art inventory
// 03-dong-fu). --focus-x/--focus-y arrive via fallthrough style from the
// scene root; the .home-scene.is-focusing opacity rule lives in the
// parent's stylesheet (this root carries its scope id).
</script>

<template>
  <div
    class="home-scene__focus-dim"
    aria-hidden="true"
    art-needed
    data-art-id="dong-fu-focus-dim"
  />
</template>

<style scoped>
/* Sits above the building hotspots (DOM order) but below the cultivating
   player, so the focused building stays lit while surroundings recede. */
.home-scene__focus-dim {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  background: color-mix(in srgb, var(--ink-950) 52%, transparent);
  -webkit-mask-image: radial-gradient(
    ellipse 30% 26% at var(--focus-x, 50%) var(--focus-y, 50%),
    transparent 55%,
    black 100%
  );
  mask-image: radial-gradient(
    ellipse 30% 26% at var(--focus-x, 50%) var(--focus-y, 50%),
    transparent 55%,
    black 100%
  );
  transition: opacity var(--hk-motion-scene, 450ms) var(--hk-ease-standard, ease);
}

@media (prefers-reduced-motion: reduce) {
  .home-scene__focus-dim {
    animation: none;
    transition: none;
    transform: none;
    translate: none;
  }
}
</style>
